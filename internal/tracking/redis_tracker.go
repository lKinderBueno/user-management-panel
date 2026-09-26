package tracking

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisTracker implements Tracker using Redis Sorted Sets and TTL keys.
type RedisTracker struct {
	client     *redis.Client
	defaultTTL time.Duration
}

// NewRedisTracker constructs a new Redis-backed Tracker.
func NewRedisTracker(client *redis.Client, defaultTTL time.Duration) *RedisTracker {
	if defaultTTL <= 0 {
		defaultTTL = DefaultTrackingTimeout
	}
	return &RedisTracker{
		client:     client,
		defaultTTL: defaultTTL,
	}
}

func (r *RedisTracker) IsRedis() bool {
	return true
}

func (r *RedisTracker) connKey(listID uint64, userID int, deviceKey string) string {
	return fmt.Sprintf("stream:conn:%d:%d:%s", listID, userID, deviceKey)
}

func (r *RedisTracker) userDevicesKey(userID int) string {
	return fmt.Sprintf("stream:user_devices:%d", userID)
}

func (r *RedisTracker) playlistOnlineKey(listID uint64) string {
	return fmt.Sprintf("stream:playlist_online:%d", listID)
}

func (r *RedisTracker) playlistConnsKey(listID uint64) string {
	return fmt.Sprintf("stream:playlist_conns:%d", listID)
}

var registerConnScript = redis.NewScript(`
	local userDevKey = KEYS[1]
	local deviceKey = ARGV[1]
	local nowUnix = tonumber(ARGV[2])
	local expireUnix = tonumber(ARGV[3])
	local maxConn = tonumber(ARGV[4])
	local limitEnabled = tonumber(ARGV[5])
	local ttlSec = tonumber(ARGV[6])

	-- 1. Remove expired devices from Sorted Set
	redis.call('ZREMRANGEBYSCORE', userDevKey, '-inf', nowUnix)

	-- 2. Check if device is already active
	local existingScore = redis.call('ZSCORE', userDevKey, deviceKey)
	if existingScore ~= false then
		-- Device is already active! Refresh its score
		redis.call('ZADD', userDevKey, expireUnix, deviceKey)
		redis.call('EXPIRE', userDevKey, ttlSec + 120)
		local count = redis.call('ZCARD', userDevKey)
		return {1, count}
	end

	-- 3. Device is new! Check active count against maxConn
	local currentCount = redis.call('ZCARD', userDevKey)
	if limitEnabled == 1 and maxConn > 0 and currentCount >= maxConn then
		return {0, currentCount}
	end

	-- 4. Within limits, allow and add new device
	redis.call('ZADD', userDevKey, expireUnix, deviceKey)
	redis.call('EXPIRE', userDevKey, ttlSec + 120)
	local newCount = redis.call('ZCARD', userDevKey)
	return {1, newCount}
`)

// Track registers or updates an active stream connection.
func (r *RedisTracker) Track(ctx context.Context, session *ConnectionSession, ttl time.Duration) error {
	_, _, err := r.RegisterConnection(ctx, session, 0, false, ttl)
	return err
}

// RegisterConnection evaluates whether a connection from session.DeviceKey is permitted under maxConnections.
// If permitted, it registers or refreshes the session with the specified TTL.
// If limitMaxConnections is true and the device is new while activeCount >= maxConnections:
// it returns allowed = false, activeCount, nil.
// If limitMaxConnections is false, it always permits and records the session.
func (r *RedisTracker) RegisterConnection(
	ctx context.Context,
	session *ConnectionSession,
	maxConnections int,
	limitMaxConnections bool,
	ttl time.Duration,
) (bool, int, error) {
	if r.client == nil || session == nil {
		return true, 0, nil
	}

	if ttl <= 0 {
		ttl = r.defaultTTL
	}

	if session.DeviceKey == "" {
		session.DeviceKey = GenerateDeviceKey(session.IP, session.UserAgent)
	}
	session.ID = session.DeviceKey

	now := time.Now().UTC()
	expiresAt := now.Add(ttl)
	session.LastActivity = now
	session.ExpiresAt = expiresAt

	userDevKey := r.userDevicesKey(session.UserID)
	limitInt := 0
	if limitMaxConnections {
		limitInt = 1
	}

	res, err := registerConnScript.Run(ctx, r.client, []string{userDevKey},
		session.DeviceKey,
		now.Unix(),
		expiresAt.Unix(),
		maxConnections,
		limitInt,
		int(ttl.Seconds()),
	).Slice()
	if err != nil {
		return false, 0, fmt.Errorf("failed executing connection limit script in redis: %w", err)
	}

	var allowedVal int64
	var activeCountVal int64
	if len(res) >= 2 {
		if v, ok := res[0].(int64); ok {
			allowedVal = v
		}
		if v, ok := res[1].(int64); ok {
			activeCountVal = v
		}
	}

	allowed := allowedVal == 1
	activeCount := int(activeCountVal)

	if !allowed {
		return false, activeCount, nil
	}

	// Allowed: write connection session JSON and playlist indices
	key := r.connKey(session.ListID, session.UserID, session.DeviceKey)
	existingRaw, err := r.client.Get(ctx, key).Result()
	if err == nil && existingRaw != "" {
		var existing ConnectionSession
		if jsonErr := json.Unmarshal([]byte(existingRaw), &existing); jsonErr == nil {
			session.ConnectedAt = existing.ConnectedAt
			if existing.StreamID != session.StreamID {
				session.StreamStartedAt = now
			} else {
				session.StreamStartedAt = existing.StreamStartedAt
			}
		} else {
			session.ConnectedAt = now
			session.StreamStartedAt = now
		}
	} else {
		session.ConnectedAt = now
		session.StreamStartedAt = now
	}

	payload, err := json.Marshal(session)
	if err != nil {
		return true, activeCount, fmt.Errorf("failed marshaling connection session: %w", err)
	}

	pipe := r.client.Pipeline()
	pipe.Set(ctx, key, payload, ttl)

	// Playlist online users index
	playOnlineKey := r.playlistOnlineKey(session.ListID)
	pipe.ZAdd(ctx, playOnlineKey, redis.Z{
		Score:  float64(expiresAt.Unix()),
		Member: strconv.Itoa(session.UserID),
	})
	pipe.Expire(ctx, playOnlineKey, ttl+2*time.Minute)

	// Playlist connections index
	playConnsKey := r.playlistConnsKey(session.ListID)
	pipe.ZAdd(ctx, playConnsKey, redis.Z{
		Score:  float64(expiresAt.Unix()),
		Member: fmt.Sprintf("%d:%s", session.UserID, session.DeviceKey),
	})
	pipe.Expire(ctx, playConnsKey, ttl+2*time.Minute)

	_, err = pipe.Exec(ctx)
	if err != nil {
		return true, activeCount, fmt.Errorf("failed saving session details in redis: %w", err)
	}

	return true, activeCount, nil
}

// GetUserActiveCount returns the number of active devices for a user.
func (r *RedisTracker) GetUserActiveCount(ctx context.Context, userID int) (int, error) {
	if r.client == nil {
		return 0, nil
	}

	now := time.Now().UTC().Unix()
	devKey := r.userDevicesKey(userID)

	// Purge expired device keys from user set
	_ = r.client.ZRemRangeByScore(ctx, devKey, "-inf", fmt.Sprintf("%d", now)).Err()

	count, err := r.client.ZCount(ctx, devKey, fmt.Sprintf("%d", now+1), "+inf").Result()
	if err != nil {
		return 0, err
	}

	return int(count), nil
}

// GetUserConnections returns all active sessions for a user.
func (r *RedisTracker) GetUserConnections(ctx context.Context, listID uint64, userID int) ([]ConnectionSession, error) {
	if r.client == nil {
		return []ConnectionSession{}, nil
	}

	now := time.Now().UTC().Unix()
	devKey := r.userDevicesKey(userID)

	_ = r.client.ZRemRangeByScore(ctx, devKey, "-inf", fmt.Sprintf("%d", now)).Err()

	deviceKeys, err := r.client.ZRevRangeByScore(ctx, devKey, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", now+1),
		Max: "+inf",
	}).Result()
	if err != nil {
		return nil, err
	}

	if len(deviceKeys) == 0 {
		return []ConnectionSession{}, nil
	}

	var sessions []ConnectionSession
	for _, devKey := range deviceKeys {
		raw, err := r.client.Get(ctx, r.connKey(listID, userID, devKey)).Result()
		if err != nil || raw == "" {
			continue
		}
		var s ConnectionSession
		if err := json.Unmarshal([]byte(raw), &s); err == nil {
			sessions = append(sessions, s)
		}
	}

	return sessions, nil
}

// GetPlaylistOnlineUserCounts returns a map of userID -> activeDeviceCount for a playlist.
func (r *RedisTracker) GetPlaylistOnlineUserCounts(ctx context.Context, listID uint64) (map[int]int, error) {
	result := make(map[int]int)
	if r.client == nil {
		return result, nil
	}

	now := time.Now().UTC().Unix()
	onlineKey := r.playlistOnlineKey(listID)

	// Clean expired users from playlist set
	_ = r.client.ZRemRangeByScore(ctx, onlineKey, "-inf", fmt.Sprintf("%d", now)).Err()

	userIDs, err := r.client.ZRevRangeByScore(ctx, onlineKey, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", now+1),
		Max: "+inf",
	}).Result()
	if err != nil {
		return result, err
	}

	for _, uidStr := range userIDs {
		uid, err := strconv.Atoi(uidStr)
		if err != nil {
			continue
		}

		devKey := r.userDevicesKey(uid)
		_ = r.client.ZRemRangeByScore(ctx, devKey, "-inf", fmt.Sprintf("%d", now)).Err()
		count, err := r.client.ZCount(ctx, devKey, fmt.Sprintf("%d", now+1), "+inf").Result()
		if err == nil && count > 0 {
			result[uid] = int(count)
		} else {
			// Clean up user from playlist if no devices left
			_ = r.client.ZRem(ctx, onlineKey, uidStr).Err()
		}
	}

	return result, nil
}

// GetPlaylistConnections returns all active sessions across an entire playlist.
func (r *RedisTracker) GetPlaylistConnections(ctx context.Context, listID uint64) ([]ConnectionSession, error) {
	if r.client == nil {
		return []ConnectionSession{}, nil
	}

	now := time.Now().UTC().Unix()
	playConnsKey := r.playlistConnsKey(listID)

	_ = r.client.ZRemRangeByScore(ctx, playConnsKey, "-inf", fmt.Sprintf("%d", now)).Err()

	members, err := r.client.ZRevRangeByScore(ctx, playConnsKey, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", now+1),
		Max: "+inf",
	}).Result()
	if err != nil {
		return nil, err
	}

	var sessions []ConnectionSession
	for _, member := range members {
		parts := strings.SplitN(member, ":", 2)
		if len(parts) != 2 {
			continue
		}
		uid, _ := strconv.Atoi(parts[0])
		devKey := parts[1]

		raw, err := r.client.Get(ctx, r.connKey(listID, uid, devKey)).Result()
		if err != nil || raw == "" {
			continue
		}
		var s ConnectionSession
		if err := json.Unmarshal([]byte(raw), &s); err == nil {
			sessions = append(sessions, s)
		}
	}

	return sessions, nil
}

// CloseConnection terminates an active connection session in Redis.
func (r *RedisTracker) CloseConnection(ctx context.Context, listID uint64, userID int, deviceKey string) error {
	if r.client == nil {
		return nil
	}

	pipe := r.client.Pipeline()
	pipe.Del(ctx, r.connKey(listID, userID, deviceKey))
	pipe.ZRem(ctx, r.userDevicesKey(userID), deviceKey)
	pipe.ZRem(ctx, r.playlistConnsKey(listID), fmt.Sprintf("%d:%s", userID, deviceKey))
	_, err := pipe.Exec(ctx)
	if err != nil {
		return err
	}

	// If no more devices remain for this user, remove from playlist online set
	count, _ := r.GetUserActiveCount(ctx, userID)
	if count == 0 {
		_ = r.client.ZRem(ctx, r.playlistOnlineKey(listID), strconv.Itoa(userID)).Err()
	}

	return nil
}
