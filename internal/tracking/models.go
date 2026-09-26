package tracking

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// ConnectionSession represents an active streaming session initiated via the redirector.
type ConnectionSession struct {
	ID                 string    `json:"id"`
	ListID             uint64    `json:"list_id"`
	UserID             int       `json:"user_id"`
	Username           string    `json:"username"`
	IP                 string    `json:"ip"`
	UserAgent          string    `json:"user_agent"`
	DeviceKey          string    `json:"device_key"`
	StreamID           uint64    `json:"stream_id"`
	StreamType         string    `json:"stream_type"`
	StreamName         string    `json:"stream_name"`
	ContainerExtension string    `json:"container_extension"`
	ConnectedAt        time.Time `json:"connected_at"`
	StreamStartedAt    time.Time `json:"stream_started_at"`
	LastActivity       time.Time `json:"last_activity"`
	ExpiresAt          time.Time `json:"expires_at"`
}

// GenerateDeviceKey generates a deterministic 32-byte hex hash representing the device
// based on client IP and sanitized User-Agent.
func GenerateDeviceKey(ip, userAgent string) string {
	cleanIP := strings.TrimSpace(ip)
	cleanUA := strings.TrimSpace(userAgent)
	raw := fmt.Sprintf("%s|%s", cleanIP, cleanUA)
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
