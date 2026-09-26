package models

import "time"

// TrackedIP represents an IP address tracked by the anti-brute force system.
type TrackedIP struct {
	ID             uint64     `json:"id"`
	IP             string     `json:"ip"`
	FailedAttempts int        `json:"failed_attempts"`
	IsBlocked      bool       `json:"is_blocked"`
	BlockedReason  string     `json:"blocked_reason,omitempty"`
	BlockedAt      *time.Time `json:"blocked_at,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	LastAttemptAt  time.Time  `json:"last_attempt_at"`
	UnblockedAt    *time.Time `json:"unblocked_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// SecurityAccessLog represents an individual authentication or access attempt audit entry.
type SecurityAccessLog struct {
	ID          uint64    `json:"id"`
	IP          string    `json:"ip"`
	AttemptType string    `json:"attempt_type"` // e.g. "admin_login", "xtream_auth", "short_url"
	Username    string    `json:"username,omitempty"`
	Success     bool      `json:"success"`
	Reason      string    `json:"reason,omitempty"`
	UserAgent   string    `json:"user_agent,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// SecurityStats contains aggregate statistics for the security dashboard.
type SecurityStats struct {
	TotalBlocked          int  `json:"total_blocked"`
	TotalTracked          int  `json:"total_tracked"`
	AttemptsLast24h       int  `json:"attempts_last_24h"`
	AdminAttemptsLast24h  int  `json:"admin_attempts_last_24h"`
	XtreamAttemptsLast24h int  `json:"xtream_attempts_last_24h"`
	CompromisedUsersCount int  `json:"compromised_users_count"`
	RedisConnected        bool `json:"redis_connected"`
	RedisEnabled          bool `json:"redis_enabled"`
}

// ManualBlockRequest represents the payload to manually block an IP.
type ManualBlockRequest struct {
	IP            string `json:"ip"`
	Reason        string `json:"reason"`
	DurationHours int    `json:"duration_hours"` // 0 = permanent until manual unblock, or e.g. 24
}

// UnblockRequest represents the payload to unblock an IP.
type UnblockRequest struct {
	IP string `json:"ip"`
}

// ResetAttemptsRequest represents the payload to reset failed attempts for an IP.
type ResetAttemptsRequest struct {
	IP string `json:"ip"`
}

// SecuritySettings holds configurable anti-brute force parameters.
type SecuritySettings struct {
	Enabled                 bool `json:"enabled"`
	MaxAttempts             int  `json:"max_attempts"`
	WindowMinutes           int  `json:"window_minutes"`
	BanHours                int  `json:"ban_hours"`
	LogRetentionDays        int  `json:"log_retention_days"`
	MultiIPDetectionEnabled bool `json:"multi_ip_detection_enabled"`
	MultiIPMaxSubnets       int  `json:"multi_ip_max_subnets"`
	MultiIPWindowHours      int  `json:"multi_ip_window_hours"`
	MultiIPAutoSuspend      bool `json:"multi_ip_auto_suspend"`
}

// MultiIPIncident represents a detected multi-subnet leak incident for an account.
type MultiIPIncident struct {
	ID              uint64     `json:"id"`
	Username        string     `json:"username"`
	ListID          uint64     `json:"list_id"`
	UserID          int        `json:"user_id"`
	SubnetsCount    int        `json:"subnets_count"`
	SubnetsList     []string   `json:"subnets_list"`
	RawIPs          []string   `json:"raw_ips"`
	TriggerEndpoint string     `json:"trigger_endpoint"`
	UserAgent       string     `json:"user_agent"`
	DetectedAt      time.Time  `json:"detected_at"`
	Status          string     `json:"status"` // "suspended", "resolved"
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy      *string    `json:"resolved_by,omitempty"`
}
