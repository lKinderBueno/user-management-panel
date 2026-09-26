package tracking

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// MemoryTracker implements an in-memory thread-safe Tracker with automatic expiration.
type MemoryTracker struct {
	mu         sync.RWMutex
	sessions   map[string]*ConnectionSession
	defaultTTL time.Duration
}

// NewMemoryTracker constructs an in-memory Tracker.
func NewMemoryTracker(defaultTTL time.Duration) *MemoryTracker {
	if defaultTTL <= 0 {
		defaultTTL = DefaultTrackingTimeout
	}
	t := &MemoryTracker{
		sessions:   make(map[string]*ConnectionSession),
		defaultTTL: defaultTTL,
	}

	// Periodic background pruner
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			t.pruneExpired()
		}
	}()

	return t
}

func (m *MemoryTracker) IsRedis() bool {
	return false
}

func (m *MemoryTracker) sessionKey(listID uint64, userID int, deviceKey string) string {
	return fmt.Sprintf("%d:%d:%s", listID, userID, deviceKey)
}

func (m *MemoryTracker) pruneExpired() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	for k, s := range m.sessions {
		if s.ExpiresAt.Before(now) {
			delete(m.sessions, k)
		}
	}
}

func (m *MemoryTracker) getUserActiveCountLocked(userID int, now time.Time) int {
	count := 0
	for _, s := range m.sessions {
		if s.UserID == userID && s.ExpiresAt.After(now) {
			count++
		}
	}
	return count
}

// Track registers or updates a stream session in memory.
func (m *MemoryTracker) Track(ctx context.Context, session *ConnectionSession, ttl time.Duration) error {
	_, _, err := m.RegisterConnection(ctx, session, 0, false, ttl)
	return err
}

// RegisterConnection evaluates whether a connection from session.DeviceKey is permitted under maxConnections.
// If permitted, it registers or refreshes the session with the specified TTL.
// If limitMaxConnections is true and the device is new while activeCount >= maxConnections:
// it returns allowed = false, activeCount, nil.
// If limitMaxConnections is false, it always permits and records the session.
func (m *MemoryTracker) RegisterConnection(
	ctx context.Context,
	session *ConnectionSession,
	maxConnections int,
	limitMaxConnections bool,
	ttl time.Duration,
) (bool, int, error) {
	if session == nil {
		return true, 0, nil
	}
	if ttl <= 0 {
		ttl = m.defaultTTL
	}

	if session.DeviceKey == "" {
		session.DeviceKey = GenerateDeviceKey(session.IP, session.UserAgent)
	}
	session.ID = session.DeviceKey

	now := time.Now().UTC()
	key := m.sessionKey(session.ListID, session.UserID, session.DeviceKey)

	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Prune expired sessions
	for k, s := range m.sessions {
		if s.ExpiresAt.Before(now) {
			delete(m.sessions, k)
		}
	}

	// 2. Check if device is already active (preserves connection time and channel zapping)
	existing, exists := m.sessions[key]
	if exists && existing.ExpiresAt.After(now) {
		session.ConnectedAt = existing.ConnectedAt
		if existing.StreamID != session.StreamID {
			session.StreamStartedAt = now
		} else {
			session.StreamStartedAt = existing.StreamStartedAt
		}
		session.LastActivity = now
		session.ExpiresAt = now.Add(ttl)

		copied := *session
		m.sessions[key] = &copied

		activeCount := m.getUserActiveCountLocked(session.UserID, now)
		return true, activeCount, nil
	}

	// 3. Device is NOT currently active: calculate current active devices count for this user
	currentCount := m.getUserActiveCountLocked(session.UserID, now)

	// 4. Enforce limit if limitMaxConnections is enabled
	if limitMaxConnections && maxConnections > 0 && currentCount >= maxConnections {
		return false, currentCount, nil
	}

	// 5. Allowed: register new connection
	session.ConnectedAt = now
	session.StreamStartedAt = now
	session.LastActivity = now
	session.ExpiresAt = now.Add(ttl)

	copied := *session
	m.sessions[key] = &copied

	return true, currentCount + 1, nil
}

// GetUserActiveCount returns the count of active connections for a user.
func (m *MemoryTracker) GetUserActiveCount(ctx context.Context, userID int) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return m.getUserActiveCountLocked(userID, time.Now().UTC()), nil
}

// GetUserConnections returns all active sessions for a user.
func (m *MemoryTracker) GetUserConnections(ctx context.Context, listID uint64, userID int) ([]ConnectionSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now().UTC()
	var results []ConnectionSession
	for _, s := range m.sessions {
		if s.ListID == listID && s.UserID == userID && s.ExpiresAt.After(now) {
			results = append(results, *s)
		}
	}
	return results, nil
}

// GetPlaylistOnlineUserCounts returns map[userID]deviceCount for all online users in a playlist.
func (m *MemoryTracker) GetPlaylistOnlineUserCounts(ctx context.Context, listID uint64) (map[int]int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now().UTC()
	counts := make(map[int]int)
	for _, s := range m.sessions {
		if s.ListID == listID && s.ExpiresAt.After(now) {
			counts[s.UserID]++
		}
	}
	return counts, nil
}

// GetPlaylistConnections returns all active sessions across a playlist.
func (m *MemoryTracker) GetPlaylistConnections(ctx context.Context, listID uint64) ([]ConnectionSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now().UTC()
	var results []ConnectionSession
	for _, s := range m.sessions {
		if s.ListID == listID && s.ExpiresAt.After(now) {
			results = append(results, *s)
		}
	}
	return results, nil
}

// CloseConnection terminates a session.
func (m *MemoryTracker) CloseConnection(ctx context.Context, listID uint64, userID int, deviceKey string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := m.sessionKey(listID, userID, deviceKey)
	delete(m.sessions, key)
	return nil
}
