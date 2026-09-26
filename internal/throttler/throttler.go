package throttler

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/models"

	"github.com/redis/go-redis/v9"
)

// Supported throttling scopes.
const (
	ScopeRouter  = "router"
	ScopeM3UEPG  = "m3u_epg"
	ScopeXtream  = "xtream"
	ScopeStalker = "stalker"
)

// ScopeConfig holds threshold and window settings for a specific scope.
type ScopeConfig struct {
	Enabled bool
	Limit   int
	Window  time.Duration
}

type clientBucket struct {
	count     int
	resetTime time.Time
}

// Throttler manages per-IP rate limiting across multiple distinct scopes.
type Throttler struct {
	mu           sync.RWMutex
	globalEnable bool
	scopes       map[string]ScopeConfig
	buckets      map[string]map[string]*clientBucket // scope -> ip -> bucket

	redisClient  *redis.Client
	redisEnabled bool
	stopCleanup  chan struct{}
}

// New creates and initializes a Throttler instance.
func New(s *models.SystemSettings, rdb *redis.Client) *Throttler {
	t := &Throttler{
		scopes:      make(map[string]ScopeConfig),
		buckets:     make(map[string]map[string]*clientBucket),
		redisClient: rdb,
		stopCleanup: make(chan struct{}),
	}

	if rdb != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := rdb.Ping(ctx).Err(); err == nil {
			t.redisEnabled = true
		}
	}

	// Initialize default scopes
	t.scopes[ScopeRouter] = ScopeConfig{Enabled: true, Limit: 30, Window: 10 * time.Second}
	t.scopes[ScopeM3UEPG] = ScopeConfig{Enabled: true, Limit: 18, Window: 300 * time.Second}
	t.scopes[ScopeXtream] = ScopeConfig{Enabled: true, Limit: 40, Window: 20 * time.Second}
	t.scopes[ScopeStalker] = ScopeConfig{Enabled: false, Limit: 60, Window: 60 * time.Second}
	t.globalEnable = true

	if s != nil {
		t.SetSettings(s)
	}

	t.startCleanupTicker()
	return t
}

// Close gracefully terminates background cleanup tickers.
func (t *Throttler) Close() {
	select {
	case <-t.stopCleanup:
	default:
		close(t.stopCleanup)
	}
}

// SetSettings updates the throttling configuration dynamically in runtime.
func (t *Throttler) SetSettings(s *models.SystemSettings) {
	if s == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()

	t.globalEnable = s.ThrottleEnabled

	// Router scope
	rLimit := s.ThrottleRouterLimit
	if rLimit <= 0 {
		rLimit = 30
	}
	rWin := s.ThrottleRouterWindowSeconds
	if rWin <= 0 {
		rWin = 10
	}
	t.scopes[ScopeRouter] = ScopeConfig{
		Enabled: s.ThrottleRouterEnabled,
		Limit:   rLimit,
		Window:  time.Duration(rWin) * time.Second,
	}

	// M3U & EPG scope
	m3uLimit := s.ThrottleM3UEPGLimit
	if m3uLimit <= 0 {
		m3uLimit = 18
	}
	m3uWin := s.ThrottleM3UEPGWindowSeconds
	if m3uWin <= 0 {
		m3uWin = 300
	}
	t.scopes[ScopeM3UEPG] = ScopeConfig{
		Enabled: s.ThrottleM3UEPGEnabled,
		Limit:   m3uLimit,
		Window:  time.Duration(m3uWin) * time.Second,
	}

	// Xtream API scope
	xcLimit := s.ThrottleXtreamLimit
	if xcLimit <= 0 {
		xcLimit = 40
	}
	xcWin := s.ThrottleXtreamWindowSeconds
	if xcWin <= 0 {
		xcWin = 20
	}
	t.scopes[ScopeXtream] = ScopeConfig{
		Enabled: s.ThrottleXtreamEnabled,
		Limit:   xcLimit,
		Window:  time.Duration(xcWin) * time.Second,
	}

	// Stalker scope
	stLimit := s.ThrottleStalkerLimit
	if stLimit <= 0 {
		stLimit = 60
	}
	stWin := s.ThrottleStalkerWindowSeconds
	if stWin <= 0 {
		stWin = 60
	}
	t.scopes[ScopeStalker] = ScopeConfig{
		Enabled: s.ThrottleStalkerEnabled,
		Limit:   stLimit,
		Window:  time.Duration(stWin) * time.Second,
	}
}

// Allow evaluates if a request from the given IP for the given scope is within limits.
// Returns whether the request is allowed, remaining requests in current window, and retry duration if blocked.
func (t *Throttler) Allow(scope, ip string) (allowed bool, remaining int, retryAfter time.Duration) {
	t.mu.RLock()
	global := t.globalEnable
	cfg, exists := t.scopes[scope]
	t.mu.RUnlock()

	if !global || !exists || !cfg.Enabled || cfg.Limit <= 0 {
		return true, 999999, 0
	}

	ip = strings.TrimSpace(ip)
	if ip == "" {
		ip = "127.0.0.1"
	}

	// Redis backend if connected
	if t.redisEnabled && t.redisClient != nil {
		return t.allowRedis(scope, ip, cfg)
	}

	// Fallback to in-memory sliding window
	return t.allowMemory(scope, ip, cfg)
}

func (t *Throttler) allowMemory(scope, ip string, cfg ScopeConfig) (bool, int, time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.buckets[scope] == nil {
		t.buckets[scope] = make(map[string]*clientBucket)
	}

	now := time.Now()
	b, ok := t.buckets[scope][ip]

	if !ok || now.After(b.resetTime) {
		resetTime := now.Add(cfg.Window)
		t.buckets[scope][ip] = &clientBucket{
			count:     1,
			resetTime: resetTime,
		}
		return true, cfg.Limit - 1, 0
	}

	b.count++
	if b.count <= cfg.Limit {
		return true, cfg.Limit - b.count, 0
	}

	retryAfter := b.resetTime.Sub(now)
	if retryAfter < time.Second {
		retryAfter = time.Second
	}
	return false, 0, retryAfter
}

func (t *Throttler) allowRedis(scope, ip string, cfg ScopeConfig) (bool, int, time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	key := fmt.Sprintf("throttle:%s:%s", scope, ip)
	windowSecs := int64(math.Ceil(cfg.Window.Seconds()))
	if windowSecs < 1 {
		windowSecs = 1
	}

	script := redis.NewScript(`
		local current = redis.call('INCR', KEYS[1])
		if current == 1 then
			redis.call('EXPIRE', KEYS[1], ARGV[1])
		end
		local ttl = redis.call('TTL', KEYS[1])
		return {current, ttl}
	`)

	res, err := script.Run(ctx, t.redisClient, []string{key}, windowSecs).Result()
	if err != nil {
		// If Redis fails, fall back to in-memory
		return t.allowMemory(scope, ip, cfg)
	}

	slice, ok := res.([]interface{})
	if !ok || len(slice) < 2 {
		return t.allowMemory(scope, ip, cfg)
	}

	count, _ := slice[0].(int64)
	ttl, _ := slice[1].(int64)
	if ttl < 1 {
		ttl = 1
	}
	retryAfter := time.Duration(ttl) * time.Second

	if count <= int64(cfg.Limit) {
		return true, int(int64(cfg.Limit) - count), 0
	}

	return false, 0, retryAfter
}

// Check inspects the HTTP request against the scope's throttling policy.
// If allowed, it returns true.
// If throttled, it sets standard HTTP 429 response headers and body, then returns false.
func (t *Throttler) Check(w http.ResponseWriter, r *http.Request, scope string) bool {
	ip := ExtractClientIP(r)
	allowed, remaining, retryAfter := t.Allow(scope, ip)

	t.mu.RLock()
	cfg := t.scopes[scope]
	t.mu.RUnlock()

	w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", cfg.Limit))
	w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

	if allowed {
		return true
	}

	retrySecs := int(math.Ceil(retryAfter.Seconds()))
	if retrySecs < 1 {
		retrySecs = 1
	}
	w.Header().Set("Retry-After", fmt.Sprintf("%d", retrySecs))
	w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(retryAfter).Unix()))

	switch scope {
	case ScopeXtream:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "error",
			"message": "Rate limit exceeded. Please try again later.",
		})

	case ScopeStalker:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"js": map[string]string{
				"error": "Rate limit exceeded. Please try again later.",
			},
		})

	default:
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprintf(w, "Rate limit exceeded. Please try again in %d seconds.\n", retrySecs)
	}

	return false
}

// Middleware creates an HTTP handler middleware enforcing throttling for a specific scope.
func (t *Throttler) Middleware(scope string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !t.Check(w, r, scope) {
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ExtractClientIP extracts the real client IP address from proxy headers or remote addr.
func ExtractClientIP(r *http.Request) string {
	if r == nil {
		return "127.0.0.1"
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		ip := strings.TrimSpace(parts[0])
		if ip != "" {
			return ip
		}
	}
	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		ip := strings.TrimSpace(xrip)
		if ip != "" {
			return ip
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "127.0.0.1"
}

func (t *Throttler) startCleanupTicker() {
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				t.mu.Lock()
				now := time.Now()
				for _, ipMap := range t.buckets {
					for ip, b := range ipMap {
						if now.After(b.resetTime) {
							delete(ipMap, ip)
						}
					}
				}
				t.mu.Unlock()
			case <-t.stopCleanup:
				return
			}
		}
	}()
}
