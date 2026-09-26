package models

import "time"

// SystemSettings represents configuration for automated sync and backup jobs.
type SystemSettings struct {
	ID                        int        `json:"id"`
	IPTVEditorAPIToken        string     `json:"iptveditor_api_token"`
	IPTVEditorAPIPassword     string     `json:"iptveditor_api_password"`
	IPTVEditorAPIURL          string     `json:"iptveditor_api_url"`
	SetupCompleted            bool       `json:"setup_completed"`
	CaptchaProvider           string     `json:"captcha_provider"` // "default", "turnstile", "recaptcha_v2", "recaptcha_v3", "hcaptcha", "disabled"
	CaptchaSiteKey            string     `json:"captcha_site_key"`
	CaptchaSecretKey          string     `json:"captcha_secret_key"`
	TMDBApiKey                string     `json:"tmdb_api_key"`
	PlaylistSyncIntervalHours int        `json:"playlist_sync_interval_hours"`
	PlaylistSyncEnabled       bool       `json:"playlist_sync_enabled"`
	ExpirySyncIntervalHours   int        `json:"expiry_sync_interval_hours"`
	ExpirySyncEnabled         bool       `json:"expiry_sync_enabled"`
	ExpirySyncAll             bool       `json:"expiry_sync_all"`
	ExpirySyncDaysRange       int        `json:"expiry_sync_days_range"`
	BackupIntervalHours       int        `json:"backup_interval_hours"`
	BackupEnabled             bool       `json:"backup_enabled"`
	BackupRetentionDays       int        `json:"backup_retention_days"`
	SecurityLogRetentionDays  int        `json:"security_log_retention_days"`
	AntiBruteForceEnabled     bool       `json:"antibruteforce_enabled"`
	AntiBruteForceMaxAttempts int        `json:"antibruteforce_max_attempts"`
	AntiBruteForceWindowMinutes int      `json:"antibruteforce_window_minutes"`
	AntiBruteForceBanHours    int        `json:"antibruteforce_ban_hours"`
	MultiIPDetectionEnabled   bool       `json:"multi_ip_detection_enabled"`
	MultiIPMaxSubnets         int        `json:"multi_ip_max_subnets"`
	MultiIPWindowHours        int        `json:"multi_ip_window_hours"`
	MultiIPAutoSuspend        bool       `json:"multi_ip_auto_suspend"`
	BackupDownloadMode        string     `json:"backup_download_mode"` // "disabled", "prompt", "auto"
	CacheEnabled               bool       `json:"cache_enabled"`
	CacheAuthTTLMinutes        int        `json:"cache_auth_ttl_minutes"`
	CacheCategoriesTTLMinutes  int        `json:"cache_categories_ttl_minutes"`
	CacheStreamsTTLMinutes     int        `json:"cache_streams_ttl_minutes"`
	TrackingTimeoutMinutes    int        `json:"tracking_timeout_minutes"`
	// Throttling & Rate Limiting
	ThrottleEnabled              bool       `json:"throttle_enabled"`
	ThrottleRouterEnabled        bool       `json:"throttle_router_enabled"`
	ThrottleRouterLimit          int        `json:"throttle_router_limit"`
	ThrottleRouterWindowSeconds  int        `json:"throttle_router_window_seconds"`
	ThrottleM3UEPGEnabled        bool       `json:"throttle_m3u_epg_enabled"`
	ThrottleM3UEPGLimit          int        `json:"throttle_m3u_epg_limit"`
	ThrottleM3UEPGWindowSeconds  int        `json:"throttle_m3u_epg_window_seconds"`
	ThrottleXtreamEnabled        bool       `json:"throttle_xtream_enabled"`
	ThrottleXtreamLimit          int        `json:"throttle_xtream_limit"`
	ThrottleXtreamWindowSeconds  int        `json:"throttle_xtream_window_seconds"`
	ThrottleStalkerEnabled       bool       `json:"throttle_stalker_enabled"`
	ThrottleStalkerLimit         int        `json:"throttle_stalker_limit"`
	ThrottleStalkerWindowSeconds int        `json:"throttle_stalker_window_seconds"`
	UserDashboardEnabled             bool       `json:"user_dashboard_enabled"`
	UserDashboardTitle               string     `json:"user_dashboard_title"`
	UserDashboardAllowHideCategories bool       `json:"user_dashboard_allow_hide_categories"`
	UserDashboardHTML                string     `json:"user_dashboard_html"`
	UserDashboardLogo                string     `json:"user_dashboard_logo"`
	UserDashboardPrimaryColor        string     `json:"user_dashboard_primary_color"`
	UserDashboardSecondaryColor      string     `json:"user_dashboard_secondary_color"`
	UserDashboardAccentColor         string     `json:"user_dashboard_accent_color"`
	UserDashboardBackgroundTheme     string     `json:"user_dashboard_background_theme"`
	EPGMaxDays                   int        `json:"epg_max_days"`
	// Host & Domain Access Isolation & SSL
	AdminHostname               string     `json:"admin_hostname"`
	BlockStreamingOnAdminHost   bool       `json:"block_streaming_on_admin_host"`
	RestrictAdminToAdminHost    bool       `json:"restrict_admin_to_admin_host"`
	BlockDirectIPStreaming      bool       `json:"block_direct_ip_streaming"`
	SSLOnDemandEnabled          bool       `json:"ssl_on_demand_enabled"`
	AdditionalSSLDomains        string     `json:"additional_ssl_domains"`
	LicenseSuspended            bool       `json:"license_suspended"`
	LicenseSuspendedAt          *time.Time `json:"license_suspended_at"`
	LicenseUpgradeURL           string     `json:"license_upgrade_url"`
	LastPlaylistSync          *time.Time `json:"last_playlist_sync"`
	LastExpirySync            *time.Time `json:"last_expiry_sync"`
	LastBackup                *time.Time `json:"last_backup"`
	UpdatedAt                 *time.Time `json:"updated_at"`
}

// BackupFileMetadata describes a backup file stored on disk.
type BackupFileMetadata struct {
	Filename     string    `json:"filename"`
	SizeBytes    int64     `json:"size_bytes"`
	TotalUsers   int       `json:"total_users"`
	CreatedAt    time.Time `json:"created_at"`
	IsAuto       bool      `json:"is_auto"`
	BackupType   string      `json:"backup_type,omitempty"` // "users", "settings", "full"
	PlaylistID   *FlexUint64 `json:"playlist_id,omitempty"`
	PlaylistName string      `json:"playlist_name,omitempty"`
	HasSettings  bool        `json:"has_settings"`
	HasPlaylists   bool      `json:"has_playlists"`
	HasToken       bool      `json:"has_token"`
	HasTeamMembers bool      `json:"has_team_members"`
	TotalTeam      int       `json:"total_team"`
}

// RestoreStoredBackupRequest holds parameters to restore a specific server-side backup snapshot.
type RestoreStoredBackupRequest struct {
	Filename           string      `json:"filename"`
	Mode               string      `json:"mode"` // "skip" or "overwrite"
	SourceListID       *FlexUint64 `json:"source_list_id,omitempty"`
	TargetListID       *FlexUint64 `json:"target_list_id,omitempty"`
	RestoreUsers       *bool   `json:"restore_users,omitempty"`
	RestoreSettings    bool    `json:"restore_settings,omitempty"`
	RestoreToken       bool    `json:"restore_token,omitempty"`
	RestorePlaylists   bool    `json:"restore_playlists,omitempty"`
	RestoreTeamMembers bool    `json:"restore_team_members,omitempty"`
	RestoreTeamScope   string  `json:"restore_team_scope,omitempty"`
}

// TaskStatusSummary holds runtime execution status for a specific scheduler job.
type TaskStatusSummary struct {
	IsRunning   bool       `json:"is_running"`
	Status      string     `json:"status"` // "idle", "running", "completed", "failed"
	Step        string     `json:"step,omitempty"`
	LastRun     *time.Time `json:"last_run,omitempty"`
	NextRun     *time.Time `json:"next_run,omitempty"`
	LastError   string     `json:"last_error,omitempty"`
	UsersCount  int        `json:"users_count,omitempty"`
	UpdatedCount int       `json:"updated_count,omitempty"`
}

// CacheStatusSummary describes the active status of the Redis/Application cache.
type CacheStatusSummary struct {
	IsConnected bool   `json:"is_connected"`
	Backend     string `json:"backend"` // "redis" or "standalone"
	KeysCount   int64  `json:"keys_count"`
	MemoryUsed  string `json:"memory_used"`
	Uptime      string `json:"uptime"`
}

// SettingsResponse is returned by GET /api/admin/settings including live runtime scheduler state.
type SettingsResponse struct {
	Settings     SystemSettings      `json:"settings"`
	PlaylistSync TaskStatusSummary   `json:"playlist_sync"`
	ExpirySync   TaskStatusSummary   `json:"expiry_sync"`
	Backup       TaskStatusSummary   `json:"backup"`
	CacheStatus  CacheStatusSummary  `json:"cache_status"`
	LatestBackup *BackupFileMetadata `json:"latest_backup,omitempty"`
}
