package security

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"playlistlabs_user_management_os/internal/config"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
)

type attemptEntry struct {
	firstAttempt      time.Time
	lastAttempt       time.Time
	credentials       map[string]map[string]bool // username -> set of distinct passwords
	lastLoggedFailure time.Time
	lastReason        string
	totalRawCount     int
}

func (e *attemptEntry) addCredential(username, password string) {
	if e.credentials == nil {
		e.credentials = make(map[string]map[string]bool)
	}
	u := strings.TrimSpace(username)
	if u == "" {
		u = "(empty)"
	}
	if e.credentials[u] == nil {
		e.credentials[u] = make(map[string]bool)
	}
	e.credentials[u][password] = true
}

func (e *attemptEntry) distinctMetrics() (distinctUsers int, maxPasswordsPerUser int) {
	distinctUsers = len(e.credentials)
	for _, pwMap := range e.credentials {
		if len(pwMap) > maxPasswordsPerUser {
			maxPasswordsPerUser = len(pwMap)
		}
	}
	return distinctUsers, maxPasswordsPerUser
}

type userAccessEntry struct {
	firstSeen time.Time
	lastSeen  time.Time
	subnets   map[string]time.Time // subnet -> last seen timestamp
	rawIPs    map[string]bool      // sample of distinct IPs
	listID    uint64
	userID    int
}

// Service provides high-performance distributed anti-brute-force and IP blocking capabilities.
type Service struct {
	repo         *repository.SecurityRepo
	redisClient  *redis.Client
	redisEnabled bool

	// In-memory L1 cache for nanosecond lookup
	mu         sync.RWMutex
	blockedIPs map[string]time.Time        // ip -> expiration time (zero time means permanent)
	attempts   map[string]*attemptEntry    // in-memory sliding window credential entropy counter
	userAccess map[string]*userAccessEntry // in-memory sliding window multi-ip access tracker

	// Configurable settings
	enabled     bool
	maxAttempts int
	window      time.Duration
	banDuration time.Duration

	// Multi-IP detection settings
	multiIPEnabled     bool
	multiIPMaxSubnets  int
	multiIPWindow      time.Duration
	multiIPAutoSuspend bool

	// Retention setting
	retentionDays int
}

// NewService initializes the anti-brute-force security service with optional Redis integration.
func NewService(cfg *config.Config, repo *repository.SecurityRepo) *Service {
	maxAttempts := cfg.AntiBruteForceMaxAttempts
	if maxAttempts <= 0 {
		maxAttempts = 5
	}
	window := cfg.AntiBruteForceWindow
	if window <= 0 {
		window = 15 * time.Minute
	}
	banDuration := cfg.AntiBruteForceBanDuration
	if banDuration <= 0 {
		banDuration = 24 * time.Hour
	}

	s := &Service{
		repo:               repo,
		blockedIPs:         make(map[string]time.Time),
		attempts:           make(map[string]*attemptEntry),
		userAccess:         make(map[string]*userAccessEntry),
		enabled:            true,
		maxAttempts:        maxAttempts,
		window:             window,
		banDuration:        banDuration,
		multiIPEnabled:     true,
		multiIPMaxSubnets:  10,
		multiIPWindow:      2 * time.Hour,
		multiIPAutoSuspend: true,
		retentionDays:      7,
	}

	// Initialize Redis ONLY if configured
	if cfg.RedisURL != "" || cfg.RedisHost != "" {
		var opt *redis.Options
		var err error

		if cfg.RedisURL != "" {
			opt, err = redis.ParseURL(cfg.RedisURL)
			if err != nil {
				log.Printf("[WARN] Failed parsing REDIS_URL: %v - falling back to in-memory mode", err)
			}
		} else {
			addr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)
			opt = &redis.Options{
				Addr:     addr,
				Password: cfg.RedisPassword,
				DB:       cfg.RedisDB,
			}
		}

		if opt != nil {
			client := redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			if err := client.Ping(ctx).Err(); err != nil {
				log.Printf("[WARN] Redis ping failed (%v) - falling back to in-memory mode", err)
			} else {
				s.redisClient = client
				s.redisEnabled = true
				log.Printf("[INFO] AntiBruteForce: Redis connected successfully at %s", opt.Addr)
			}
		}
	} else {
		log.Println("[INFO] AntiBruteForce: Running in standalone in-memory + MariaDB mode (Redis not configured)")
	}

	// Load active bans from MariaDB on startup
	s.loadInitialBans()

	// Periodic cleanup of expired entries in memory (every 1 minute)
	go s.cleanupExpiredLoop()

	return s
}

func (s *Service) loadInitialBans() {
	if s.repo == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	activeBans, err := s.repo.GetActiveBlockedIPs(ctx)
	if err != nil {
		log.Printf("[WARN] Failed loading active blocked IPs on startup: %v", err)
		return
	}

	s.mu.Lock()
	for ip, exp := range activeBans {
		s.blockedIPs[ip] = exp
		// Also sync to Redis if available
		if s.redisEnabled && s.redisClient != nil {
			var ttl time.Duration
			if !exp.IsZero() {
				ttl = time.Until(exp)
				if ttl <= 0 {
					continue
				}
			}
			_ = s.redisClient.Set(ctx, "sec:blocked:"+ip, "1", ttl).Err()
		}
	}
	count := len(s.blockedIPs)
	s.mu.Unlock()

	log.Printf("[INFO] AntiBruteForce: Loaded %d active blocked IPs into security cache", count)
}

func (s *Service) cleanupExpiredLoop() {
	minTicker := time.NewTicker(time.Minute)
	hourTicker := time.NewTicker(time.Hour)
	defer minTicker.Stop()
	defer hourTicker.Stop()

	for {
		select {
		case <-minTicker.C:
			now := time.Now()
			s.mu.Lock()
			for ip, exp := range s.blockedIPs {
				if !exp.IsZero() && now.After(exp) {
					delete(s.blockedIPs, ip)
				}
			}
			for ip, entry := range s.attempts {
				if now.Sub(entry.lastAttempt) > s.window {
					delete(s.attempts, ip)
				}
			}
			for username, entry := range s.userAccess {
				if now.Sub(entry.lastSeen) > s.multiIPWindow {
					delete(s.userAccess, username)
				}
			}
			s.mu.Unlock()

		case <-hourTicker.C:
			if s.repo != nil {
				ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
				s.mu.RLock()
				retDays := s.retentionDays
				if retDays <= 0 {
					retDays = 7
				}
				s.mu.RUnlock()
				_, _ = s.repo.CleanOldLogs(ctx, retDays)
				_, _ = s.repo.CleanOldBans(ctx, 30)
				cancel()
			}
		}
	}
}

// ExtractClientIP parses the client IP address, handling proxies and stripping port.
func (s *Service) ExtractClientIP(r *http.Request) string {
	if s == nil || r == nil {
		return ""
	}

	// 1. Cloudflare header
	if cfIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cfIP != "" {
		return cfIP
	}

	// 2. X-Forwarded-For (client, proxy1, proxy2...)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		first := strings.TrimSpace(parts[0])
		if first != "" {
			return first
		}
	}

	// 3. X-Real-IP
	if xrip := strings.TrimSpace(r.Header.Get("X-Real-IP")); xrip != "" {
		return xrip
	}

	// 4. RemoteAddr
	remote := strings.TrimSpace(r.RemoteAddr)
	if host, _, err := net.SplitHostPort(remote); err == nil {
		return host
	}
	return remote
}

// IsBlocked checks whether the given IP is currently blocked (O(1) in-memory or Redis check).
func (s *Service) IsBlocked(ctx context.Context, ip string) bool {
	if s == nil || ip == "" || isLoopback(ip) {
		return false
	}

	now := time.Now()

	// 1. Check L1 in-memory cache
	s.mu.RLock()
	exp, found := s.blockedIPs[ip]
	s.mu.RUnlock()

	if found {
		if exp.IsZero() || now.Before(exp) {
			return true
		}
		// Expired locally: clean up
		s.mu.Lock()
		delete(s.blockedIPs, ip)
		s.mu.Unlock()
	}

	// 2. Check Redis if enabled
	if s.redisEnabled && s.redisClient != nil {
		val, err := s.redisClient.Exists(ctx, "sec:blocked:"+ip).Result()
		if err == nil && val > 0 {
			// Cache in local memory for 1 minute or until TTL
			ttl, _ := s.redisClient.TTL(ctx, "sec:blocked:"+ip).Result()
			var expTime time.Time
			if ttl > 0 {
				expTime = now.Add(ttl)
			}
			s.mu.Lock()
			s.blockedIPs[ip] = expTime
			s.mu.Unlock()
			return true
		}
	}

	return false
}

// SetSettings updates anti-brute force settings dynamically in runtime.
func (s *Service) SetSettings(enabled bool, banHours, maxAttempts, windowMinutes int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.enabled = enabled
	if banHours > 0 {
		s.banDuration = time.Duration(banHours) * time.Hour
	}
	if maxAttempts > 0 {
		s.maxAttempts = maxAttempts
	}
	if windowMinutes > 0 {
		s.window = time.Duration(windowMinutes) * time.Minute
	}
}

// SetMultiIPSettings updates multi-IP detection parameters dynamically in runtime.
func (s *Service) SetMultiIPSettings(enabled bool, maxSubnets, windowHours int, autoSuspend bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.multiIPEnabled = enabled
	if maxSubnets > 0 {
		s.multiIPMaxSubnets = maxSubnets
	}
	if windowHours > 0 {
		s.multiIPWindow = time.Duration(windowHours) * time.Hour
	}
	s.multiIPAutoSuspend = autoSuspend
}

// SetRetentionDays updates the security log retention period in days.
func (s *Service) SetRetentionDays(days int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if days > 0 {
		s.retentionDays = days
	}
}

// RecordFailure registers a failed authentication/access attempt for the given IP.
// If distinct usernames or distinct passwords exceed the threshold, the IP is automatically blocked.
func (s *Service) RecordFailure(ctx context.Context, ip, attemptType, username, password, reason string, r *http.Request) (bool, error) {
	if s == nil || ip == "" || isLoopback(ip) {
		return false, nil
	}

	// If IP is already blocked, do not log or count further attempts
	if s.IsBlocked(ctx, ip) {
		return true, nil
	}

	userAgent := ""
	if r != nil {
		userAgent = r.UserAgent()
	}

	s.mu.RLock()
	banHours := int(s.banDuration.Hours())
	if banHours <= 0 {
		banHours = 24
	}
	windowMinutes := int(s.window.Minutes())
	if windowMinutes <= 0 {
		windowMinutes = 15
	}
	maxAttempts := s.maxAttempts
	banDuration := s.banDuration
	windowDuration := s.window
	enabled := s.enabled
	s.mu.RUnlock()

	now := time.Now()
	var shouldBlock bool
	var shouldLogAudit bool = true

	// 1. In-memory sliding window credential entropy tracker
	s.mu.Lock()
	entry, exists := s.attempts[ip]
	if !exists || now.Sub(entry.lastAttempt) > windowDuration {
		entry = &attemptEntry{
			firstAttempt: now,
			lastAttempt:  now,
			credentials:  make(map[string]map[string]bool),
		}
		s.attempts[ip] = entry
	}
	entry.lastAttempt = now
	entry.totalRawCount++

	// Only add to credential entropy if not simply an "account_expired" notice
	if reason != "account_expired" {
		entry.addCredential(username, password)
	}

	distinctUsers, maxPw := entry.distinctMetrics()
	effectiveAttempts := distinctUsers
	if maxPw > effectiveAttempts {
		effectiveAttempts = maxPw
	}
	if effectiveAttempts <= 0 {
		effectiveAttempts = 1
	}

	// Throttle duplicate audit logs for identical client failures within 15 seconds to protect DB resources
	if attemptType != "admin_login" && entry.lastReason == reason && now.Sub(entry.lastLoggedFailure) < 15*time.Second {
		shouldLogAudit = false
	} else {
		entry.lastLoggedFailure = now
		entry.lastReason = reason
	}

	// Ban triggers if distinct usernames or distinct passwords reach threshold,
	// or if api_token failures reach threshold.
	if enabled && (distinctUsers >= maxAttempts || maxPw >= maxAttempts || (attemptType == "api_token" && entry.totalRawCount >= maxAttempts)) {
		shouldBlock = true
	}
	s.mu.Unlock()

	// 2. Redis rate counter if available
	if s.redisEnabled && s.redisClient != nil {
		usersKey := "sec:attempts:users:" + ip
		pwKey := "sec:attempts:pw:" + ip + ":" + username
		rawKey := "sec:attempts:raw:" + ip
		blockedKey := "sec:blocked:" + ip

		if reason != "account_expired" {
			_ = s.redisClient.SAdd(ctx, usersKey, username).Err()
			_ = s.redisClient.Expire(ctx, usersKey, windowDuration).Err()
			if password != "" {
				_ = s.redisClient.SAdd(ctx, pwKey, password).Err()
				_ = s.redisClient.Expire(ctx, pwKey, windowDuration).Err()
			}
			if attemptType == "api_token" {
				_ = s.redisClient.Incr(ctx, rawKey).Err()
				_ = s.redisClient.Expire(ctx, rawKey, windowDuration).Err()
			}
		}

		uCount, _ := s.redisClient.SCard(ctx, usersKey).Result()
		pCount, _ := s.redisClient.SCard(ctx, pwKey).Result()
		rCount, _ := s.redisClient.Get(ctx, rawKey).Int64()
		if enabled && (uCount >= int64(maxAttempts) || pCount >= int64(maxAttempts) || (attemptType == "api_token" && rCount >= int64(maxAttempts))) {
			shouldBlock = true
			_ = s.redisClient.Set(ctx, blockedKey, "1", banDuration).Err()
		}
	}

	// 3. Persist to MariaDB repository
	if s.repo != nil {
		dbBlocked, err := s.repo.RecordFailedAttempt(
			ctx, ip, attemptType, username, reason, userAgent,
			effectiveAttempts, maxAttempts, windowMinutes, banHours, shouldLogAudit, shouldBlock,
		)
		if err != nil {
			log.Printf("[WARN] AntiBruteForce: Failed recording failure to DB for %s: %v", ip, err)
		}
		if dbBlocked {
			shouldBlock = true
		}
	}

	// 4. Update L1 in-memory cache if blocked
	if shouldBlock {
		exp := now.Add(banDuration)
		s.mu.Lock()
		s.blockedIPs[ip] = exp
		s.mu.Unlock()
		log.Printf("[SECURITY ALERT] IP %s blocked for %v due to brute-force violation on %s (%s)", ip, banDuration, attemptType, reason)
	}

	return shouldBlock, nil
}

// RecordSuccess records a successful login and clears transient attempt counters for the IP.
func (s *Service) RecordSuccess(ctx context.Context, ip, attemptType, username string, r *http.Request) {
	if s == nil || ip == "" || isLoopback(ip) {
		return
	}

	userAgent := ""
	if r != nil {
		userAgent = r.UserAgent()
	}

	// Check if this IP had failed attempts before clearing
	s.mu.Lock()
	_, hadAttempts := s.attempts[ip]
	delete(s.attempts, ip)
	s.mu.Unlock()

	// Clear attempts in Redis
	if s.redisEnabled && s.redisClient != nil {
		_ = s.redisClient.Del(ctx, "sec:attempts:"+ip, "sec:attempts:users:"+ip, "sec:attempts:raw:"+ip).Err()
	}

	// Only audit log successful authentication for administrative dashboard logins ("admin_login").
	// High-throughput client endpoints (stream_auth, xtream_auth, short_url, stalker_auth) MUST NOT write
	// successful requests to the database, preventing hundreds of thousands of useless disk I/O writes.
	logToAudit := (attemptType == "admin_login")
	if s.repo != nil {
		_ = s.repo.RecordSuccess(ctx, ip, attemptType, username, userAgent, logToAudit, hadAttempts)
	}
}

// ManualBlock explicitly blocks an IP address with a reason and duration.
func (s *Service) ManualBlock(ctx context.Context, ip, reason string, durationHours int) error {
	if ip == "" {
		return fmt.Errorf("ip address cannot be empty")
	}

	now := time.Now()
	var exp time.Time
	var ttl time.Duration
	if durationHours > 0 {
		exp = now.Add(time.Duration(durationHours) * time.Hour)
		ttl = time.Duration(durationHours) * time.Hour
	}

	// 1. Update in-memory
	s.mu.Lock()
	s.blockedIPs[ip] = exp
	s.mu.Unlock()

	// 2. Update Redis
	if s.redisEnabled && s.redisClient != nil {
		_ = s.redisClient.Set(ctx, "sec:blocked:"+ip, "1", ttl).Err()
	}

	// 3. Update DB
	if s.repo != nil {
		return s.repo.BlockIP(ctx, ip, reason, durationHours)
	}

	return nil
}

// Unblock immediately unbans an IP address across Redis, in-memory cache and MariaDB.
func (s *Service) Unblock(ctx context.Context, ip string) error {
	if ip == "" {
		return fmt.Errorf("ip address cannot be empty")
	}

	// 1. Remove from in-memory
	s.mu.Lock()
	delete(s.blockedIPs, ip)
	delete(s.attempts, ip)
	s.mu.Unlock()

	// 2. Remove from Redis
	if s.redisEnabled && s.redisClient != nil {
		_ = s.redisClient.Del(ctx, "sec:blocked:"+ip, "sec:attempts:"+ip).Err()
	}

	// 3. Remove from DB
	if s.repo != nil {
		return s.repo.UnblockIP(ctx, ip)
	}

	return nil
}

// ResetAttempts clears failed attempts for an IP without changing its block status.
func (s *Service) ResetAttempts(ctx context.Context, ip string) error {
	s.mu.Lock()
	delete(s.attempts, ip)
	s.mu.Unlock()

	if s.redisEnabled && s.redisClient != nil {
		_ = s.redisClient.Del(ctx, "sec:attempts:"+ip).Err()
	}
	if s.repo != nil {
		return s.repo.ResetAttempts(ctx, ip)
	}
	return nil
}

// DeleteIP removes an IP record completely.
func (s *Service) DeleteIP(ctx context.Context, ip string) error {
	_ = s.Unblock(ctx, ip)
	if s.repo != nil {
		return s.repo.DeleteIP(ctx, ip)
	}
	return nil
}

// GetStats returns security overview stats including Redis connection status.
func (s *Service) GetStats(ctx context.Context) (*models.SecurityStats, error) {
	var stats *models.SecurityStats
	if s.repo != nil {
		var err error
		stats, err = s.repo.GetStats(ctx)
		if err != nil {
			return nil, err
		}
	} else {
		stats = &models.SecurityStats{}
	}

	stats.RedisEnabled = s.redisEnabled
	if s.redisEnabled && s.redisClient != nil {
		pingErr := s.redisClient.Ping(ctx).Err()
		stats.RedisConnected = (pingErr == nil)
	}

	return stats, nil
}

// IPBlockerMiddleware creates an HTTP middleware that blocks all requests from banned IPs.
func (s *Service) IPBlockerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := s.ExtractClientIP(r)

		if ip != "" && s.IsBlocked(r.Context(), ip) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"error":"forbidden","message":"Your IP address has been blocked due to repeated security violations."}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func isLoopback(ipStr string) bool {
	clean := strings.TrimSpace(ipStr)
	if clean == "127.0.0.1" || clean == "::1" || clean == "localhost" {
		return true
	}
	if host, _, err := net.SplitHostPort(clean); err == nil {
		clean = host
	}
	ip := net.ParseIP(clean)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsUnspecified() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// NormalizeIPToSubnet normalizes an IPv4 or IPv6 address to its respective network prefix:
// /24 for IPv4 (e.g., "198.51.100.42" -> "198.51.100.0/24")
// /64 for IPv6 (e.g., "2001:db8:abcd:12::1" -> "2001:db8:abcd:12::/64")
// Port numbers, if present, are stripped beforehand.
func NormalizeIPToSubnet(ipStr string) string {
	host := strings.TrimSpace(ipStr)
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return ipStr
	}
	if ipv4 := ip.To4(); ipv4 != nil {
		mask := net.CIDRMask(24, 32)
		return ipv4.Mask(mask).String() + "/24"
	}
	mask := net.CIDRMask(64, 128)
	return ip.Mask(mask).String() + "/64"
}

// RecordUserAccess tracks successful or valid user access (login, stream, playlist download)
// and detects account sharing / credential leaks across multiple network subnets.
// If the number of distinct subnets (/24 IPv4 or /64 IPv6) reaches or exceeds multiIPMaxSubnets within
// multiIPWindow, an incident is recorded in the security center and the account is optionally suspended.
// Returns (isSuspended, error).
func (s *Service) RecordUserAccess(ctx context.Context, username string, listID uint64, userID int, ipStr, endpoint, userAgent string) (bool, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return false, nil
	}

	s.mu.Lock()
	if !s.multiIPEnabled {
		s.mu.Unlock()
		return false, nil
	}

	subnet := NormalizeIPToSubnet(ipStr)
	now := time.Now()

	entry, exists := s.userAccess[username]
	if !exists || now.Sub(entry.lastSeen) > s.multiIPWindow {
		entry = &userAccessEntry{
			firstSeen: now,
			lastSeen:  now,
			subnets:   make(map[string]time.Time),
			rawIPs:    make(map[string]bool),
			listID:    listID,
			userID:    userID,
		}
		s.userAccess[username] = entry
	}

	// Prune subnets older than sliding window
	for sub, seen := range entry.subnets {
		if now.Sub(seen) > s.multiIPWindow {
			delete(entry.subnets, sub)
		}
	}

	entry.lastSeen = now
	entry.subnets[subnet] = now
	if len(entry.rawIPs) < 50 && ipStr != "" {
		entry.rawIPs[ipStr] = true
	}
	if listID > 0 {
		entry.listID = listID
	}
	if userID > 0 {
		entry.userID = userID
	}

	distinctCount := len(entry.subnets)
	maxSubnets := s.multiIPMaxSubnets
	autoSuspend := s.multiIPAutoSuspend

	shouldTrigger := distinctCount >= maxSubnets
	s.mu.Unlock()

	if shouldTrigger {
		if s.repo != nil {
			s.mu.RLock()
			subnetsList := make([]string, 0, distinctCount)
			for sub := range entry.subnets {
				subnetsList = append(subnetsList, sub)
			}
			rawIPsList := make([]string, 0, len(entry.rawIPs))
			for rip := range entry.rawIPs {
				rawIPsList = append(rawIPsList, rip)
			}
			lID := entry.listID
			uID := entry.userID
			s.mu.RUnlock()

			inc := &models.MultiIPIncident{
				Username:        username,
				ListID:          lID,
				UserID:          uID,
				SubnetsCount:    distinctCount,
				SubnetsList:     subnetsList,
				RawIPs:          rawIPsList,
				TriggerEndpoint: endpoint,
				UserAgent:       userAgent,
				Status:          "detected",
			}
			if autoSuspend {
				inc.Status = "suspended"
			}

			if err := s.repo.RecordMultiIPIncident(ctx, inc, autoSuspend); err != nil {
				log.Printf("[WARN] Failed recording multi-IP incident for %s: %v", username, err)
			}
		}

		return autoSuspend, nil
	}

	return false, nil
}

// UnsuspendUser restores a suspended compromised user and clears their access history.
func (s *Service) UnsuspendUser(ctx context.Context, username string) error {
	username = strings.TrimSpace(username)
	s.mu.Lock()
	delete(s.userAccess, username)
	s.mu.Unlock()

	if s.repo != nil {
		return s.repo.UnsuspendUser(ctx, username)
	}
	return nil
}

// GetMultiIPIncidents retrieves recorded multi-IP incidents.
func (s *Service) GetMultiIPIncidents(ctx context.Context, limit int, statusFilter string) ([]models.MultiIPIncident, error) {
	if s.repo != nil {
		return s.repo.GetMultiIPIncidents(ctx, limit, statusFilter)
	}
	return []models.MultiIPIncident{}, nil
}

// ResolveMultiIPIncident marks an incident as resolved and unsuspends the user.
func (s *Service) ResolveMultiIPIncident(ctx context.Context, incidentID uint64, resolvedBy string) error {
	if s.repo != nil {
		return s.repo.ResolveMultiIPIncident(ctx, incidentID, resolvedBy)
	}
	return nil
}

