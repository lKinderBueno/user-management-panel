package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"playlistlabs_user_management_os/internal/config"
)

// Cache defines the generic interface for application caching.
type Cache interface {
	// IsAvailable reports whether the cache backend is connected and ready.
	IsAvailable() bool
	// IsEnabled reports whether the administrator has enabled cache operations.
	IsEnabled() bool
	// SetSettings dynamically updates the cache runtime parameters (enabled toggle and TTLs).
	SetSettings(enabled bool, authTTL, catTTL, streamTTL time.Duration)
	// GetAuthTTL returns the configured TTL for user authentication caching.
	GetAuthTTL() time.Duration
	// GetCategoriesTTL returns the configured TTL for category caching.
	GetCategoriesTTL() time.Duration
	// GetStreamsTTL returns the configured TTL for stream resolution caching.
	GetStreamsTTL() time.Duration
	// Get retrieves a cached item by key and unmarshals it into dest.
	// Returns true if found, false if not found.
	Get(ctx context.Context, key string, dest any) (bool, error)
	// Set stores an item in cache with the given TTL.
	Set(ctx context.Context, key string, val any, ttl time.Duration) error
	// Delete removes one or more keys from cache.
	Delete(ctx context.Context, keys ...string) error
	// DeletePrefix deletes all keys matching the prefix using non-blocking SCAN.
	DeletePrefix(ctx context.Context, prefix string) error
	// GetStats returns live metrics: total keys count, human-readable RAM usage, and uptime.
	GetStats(ctx context.Context) (keysCount int64, memUsed string, uptime string, err error)
	// Flush deletes keys belonging to the specified scope ("all", "auth", "categories", "streams").
	Flush(ctx context.Context, scope string) (deletedCount int64, err error)
}

// New constructs a Cache instance based on configuration.
// If Redis is configured and reachable, a RedisCache is returned.
// Otherwise, it transparently falls back to a NoOpCache.
func New(cfg *config.Config) Cache {
	client := NewRedisClient(cfg)
	if client == nil {
		log.Println("[INFO] Cache: Running in NoOp standalone mode (Redis not configured or unreachable)")
		return NewNoOp()
	}
	log.Println("[INFO] Cache: Redis cache connected and ready")
	return NewRedisCache(client)
}

// NewRedisClient creates and tests a Redis client from configuration.
// Returns nil if Redis is not configured or fails the initial ping.
func NewRedisClient(cfg *config.Config) *redis.Client {
	if cfg == nil || (cfg.RedisURL == "" && cfg.RedisHost == "") {
		return nil
	}

	var opt *redis.Options
	var err error

	if cfg.RedisURL != "" {
		opt, err = redis.ParseURL(cfg.RedisURL)
		if err != nil {
			log.Printf("[WARN] Cache: Failed parsing REDIS_URL: %v", err)
			return nil
		}
	} else {
		addr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)
		opt = &redis.Options{
			Addr:     addr,
			Password: cfg.RedisPassword,
			DB:       cfg.RedisDB,
		}
	}

	if opt == nil {
		return nil
	}

	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[WARN] Cache: Redis ping failed (%v) - cache fallback to NoOp", err)
		_ = client.Close()
		return nil
	}

	return client
}

// RedisCache is a Cache implementation backed by Redis.
type RedisCache struct {
	client        *redis.Client
	mu            sync.RWMutex
	enabled       bool
	authTTL       time.Duration
	categoriesTTL time.Duration
	streamsTTL    time.Duration
}

// NewRedisCache creates a new RedisCache with default parameters.
func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{
		client:        client,
		enabled:       true,
		authTTL:       3 * time.Minute,
		categoriesTTL: 120 * time.Minute,
		streamsTTL:    10 * time.Minute,
	}
}

func (r *RedisCache) IsAvailable() bool {
	return r != nil && r.client != nil
}

func (r *RedisCache) IsEnabled() bool {
	if r == nil || r.client == nil {
		return false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.enabled
}

func (r *RedisCache) SetSettings(enabled bool, authTTL, catTTL, streamTTL time.Duration) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.enabled = enabled
	if authTTL > 0 {
		r.authTTL = authTTL
	}
	if catTTL > 0 {
		r.categoriesTTL = catTTL
	}
	if streamTTL > 0 {
		r.streamsTTL = streamTTL
	}
}

func (r *RedisCache) GetAuthTTL() time.Duration {
	if r == nil {
		return 3 * time.Minute
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.authTTL <= 0 {
		return 3 * time.Minute
	}
	return r.authTTL
}

func (r *RedisCache) GetCategoriesTTL() time.Duration {
	if r == nil {
		return 120 * time.Minute
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.categoriesTTL <= 0 {
		return 120 * time.Minute
	}
	return r.categoriesTTL
}

func (r *RedisCache) GetStreamsTTL() time.Duration {
	if r == nil {
		return 10 * time.Minute
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.streamsTTL <= 0 {
		return 10 * time.Minute
	}
	return r.streamsTTL
}

func (r *RedisCache) Get(ctx context.Context, key string, dest any) (bool, error) {
	if !r.IsEnabled() {
		return false, nil
	}

	raw, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return false, nil
		}
		return false, err
	}

	if err := json.Unmarshal(raw, dest); err != nil {
		return false, fmt.Errorf("failed unmarshaling cached item: %w", err)
	}

	return true, nil
}

func (r *RedisCache) Set(ctx context.Context, key string, val any, ttl time.Duration) error {
	if !r.IsEnabled() {
		return nil
	}

	raw, err := json.Marshal(val)
	if err != nil {
		return fmt.Errorf("failed marshaling item for cache: %w", err)
	}

	return r.client.Set(ctx, key, raw, ttl).Err()
}

func (r *RedisCache) Delete(ctx context.Context, keys ...string) error {
	if r == nil || r.client == nil || len(keys) == 0 {
		return nil
	}

	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisCache) DeletePrefix(ctx context.Context, prefix string) error {
	_, err := r.deleteWithCount(ctx, prefix)
	return err
}

func (r *RedisCache) deleteWithCount(ctx context.Context, prefix string) (int64, error) {
	if r == nil || r.client == nil || prefix == "" {
		return 0, nil
	}

	pattern := prefix
	if pattern[len(pattern)-1] != '*' {
		pattern += "*"
	}

	iter := r.client.Scan(ctx, 0, pattern, 200).Iterator()
	var batch []string
	var totalDeleted int64

	for iter.Next(ctx) {
		batch = append(batch, iter.Val())
		if len(batch) >= 200 {
			delCount, err := r.client.Del(ctx, batch...).Result()
			if err != nil {
				return totalDeleted, err
			}
			totalDeleted += delCount
			batch = batch[:0]
		}
	}

	if err := iter.Err(); err != nil {
		return totalDeleted, err
	}

	if len(batch) > 0 {
		delCount, err := r.client.Del(ctx, batch...).Result()
		if err != nil {
			return totalDeleted, err
		}
		totalDeleted += delCount
	}

	return totalDeleted, nil
}

func (r *RedisCache) GetStats(ctx context.Context) (keysCount int64, memUsed string, uptime string, err error) {
	if r == nil || r.client == nil {
		return 0, "N/A", "N/A", nil
	}

	// 1. Total keys count in active DB
	dbSize, err := r.client.DBSize(ctx).Result()
	if err != nil {
		dbSize = 0
	}

	// 2. Memory Info
	memInfo, err := r.client.Info(ctx, "memory").Result()
	memUsed = "N/A"
	if err == nil {
		for _, line := range strings.Split(memInfo, "\r\n") {
			if strings.HasPrefix(line, "used_memory_human:") {
				memUsed = strings.TrimPrefix(line, "used_memory_human:")
				break
			}
		}
	}

	// 3. Server Uptime
	srvInfo, err := r.client.Info(ctx, "server").Result()
	uptime = "N/A"
	if err == nil {
		for _, line := range strings.Split(srvInfo, "\r\n") {
			if strings.HasPrefix(line, "uptime_in_days:") {
				days := strings.TrimPrefix(line, "uptime_in_days:")
				uptime = fmt.Sprintf("%s days", days)
				break
			}
		}
	}

	return dbSize, memUsed, uptime, nil
}

func (r *RedisCache) Flush(ctx context.Context, scope string) (int64, error) {
	if r == nil || r.client == nil {
		return 0, nil
	}

	var prefix string
	switch strings.ToLower(strings.TrimSpace(scope)) {
	case "auth":
		prefix = "cache:auth:"
	case "categories", "cat":
		prefix = "cache:cat:"
	case "streams", "stream":
		prefix = "cache:stream:"
	default:
		// Flush all cache keys (all keys starting with "cache:")
		prefix = "cache:"
	}

	return r.deleteWithCount(ctx, prefix)
}

// NoOpCache is a no-operation Cache implementation used when Redis is not available.
type NoOpCache struct{}

// NewNoOp creates a new NoOpCache.
func NewNoOp() *NoOpCache {
	return &NoOpCache{}
}

func (n *NoOpCache) IsAvailable() bool {
	return false
}

func (n *NoOpCache) IsEnabled() bool {
	return false
}

func (n *NoOpCache) SetSettings(enabled bool, authTTL, catTTL, streamTTL time.Duration) {}

func (n *NoOpCache) GetAuthTTL() time.Duration {
	return 3 * time.Minute
}

func (n *NoOpCache) GetCategoriesTTL() time.Duration {
	return 120 * time.Minute
}

func (n *NoOpCache) GetStreamsTTL() time.Duration {
	return 10 * time.Minute
}

func (n *NoOpCache) Get(ctx context.Context, key string, dest any) (bool, error) {
	return false, nil
}

func (n *NoOpCache) Set(ctx context.Context, key string, val any, ttl time.Duration) error {
	return nil
}

func (n *NoOpCache) Delete(ctx context.Context, keys ...string) error {
	return nil
}

func (n *NoOpCache) DeletePrefix(ctx context.Context, prefix string) error {
	return nil
}

func (n *NoOpCache) GetStats(ctx context.Context) (keysCount int64, memUsed string, uptime string, err error) {
	return 0, "N/A", "N/A", nil
}

func (n *NoOpCache) Flush(ctx context.Context, scope string) (deletedCount int64, err error) {
	return 0, nil
}
