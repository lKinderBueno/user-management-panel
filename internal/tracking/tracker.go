package tracking

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"playlistlabs_user_management_os/internal/config"
)

const (
	// DefaultTrackingTimeout is the default duration after which an inactive stream session expires.
	DefaultTrackingTimeout = 10 * time.Minute
)

// Tracker defines the interface for tracking active user connections.
type Tracker interface {
	// Track registers or updates a stream connection session.
	Track(ctx context.Context, session *ConnectionSession, ttl time.Duration) error

	// RegisterConnection evaluates whether a connection from session.DeviceKey is permitted under maxConnections.
	// If permitted, it registers or refreshes the session with the specified TTL.
	// If limitMaxConnections is true and the device is new while activeCount >= maxConnections:
	// it returns allowed = false, activeCount, nil.
	// If limitMaxConnections is false, it always permits and records the session.
	RegisterConnection(ctx context.Context, session *ConnectionSession, maxConnections int, limitMaxConnections bool, ttl time.Duration) (allowed bool, activeCount int, err error)

	// GetUserConnections returns all currently active connections for a user.
	GetUserConnections(ctx context.Context, listID uint64, userID int) ([]ConnectionSession, error)

	// GetUserActiveCount returns the number of currently active devices/connections for a user.
	GetUserActiveCount(ctx context.Context, userID int) (int, error)

	// GetPlaylistOnlineUserCounts returns a map of userID -> activeDeviceCount for all online users in a playlist.
	GetPlaylistOnlineUserCounts(ctx context.Context, listID uint64) (map[int]int, error)

	// GetPlaylistConnections returns all currently active sessions across an entire playlist.
	GetPlaylistConnections(ctx context.Context, listID uint64) ([]ConnectionSession, error)

	// CloseConnection manually terminates an active session by device key.
	CloseConnection(ctx context.Context, listID uint64, userID int, deviceKey string) error

	// IsRedis returns true if this tracker is backed by Redis.
	IsRedis() bool
}

// NewTracker constructs a Tracker based on configuration.
// If Redis is configured and reachable, a RedisTracker is returned.
// Otherwise, it transparently falls back to an in-memory MemoryTracker.
func NewTracker(cfg *config.Config) Tracker {
	if cfg != nil && (cfg.RedisURL != "" || cfg.RedisHost != "") {
		var opt *redis.Options
		var err error

		if cfg.RedisURL != "" {
			opt, err = redis.ParseURL(cfg.RedisURL)
			if err != nil {
				log.Printf("[WARN] Tracking: Failed parsing REDIS_URL: %v - falling back to MemoryTracker", err)
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
			pingCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()

			if err := client.Ping(pingCtx).Err(); err != nil {
				log.Printf("[WARN] Tracking: Redis ping failed (%v) - falling back to MemoryTracker", err)
			} else {
				log.Printf("[INFO] Tracking: Redis tracker initialized successfully at %s", opt.Addr)
				return NewRedisTracker(client, DefaultTrackingTimeout)
			}
		}
	}

	log.Println("[INFO] Tracking: Running in standalone MemoryTracker mode")
	return NewMemoryTracker(DefaultTrackingTimeout)
}
