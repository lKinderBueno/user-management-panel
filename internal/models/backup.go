package models

import "encoding/json"

// SystemSettingsBackup represents the configuration settings in a backup payload.
type SystemSettingsBackup struct {
	IPTVEditorAPIToken        string `json:"iptveditor_api_token,omitempty"`
	TMDBApiKey                string `json:"tmdb_api_key,omitempty"`
	HasToken                  bool   `json:"has_token"`
	PlaylistSyncIntervalHours int    `json:"playlist_sync_interval_hours"`
	PlaylistSyncMinuteOffset  int    `json:"playlist_sync_minute_offset,omitempty"`
	PlaylistSyncEnabled       bool   `json:"playlist_sync_enabled"`
	ExpirySyncIntervalHours   int    `json:"expiry_sync_interval_hours"`
	ExpirySyncEnabled         bool   `json:"expiry_sync_enabled"`
	ExpirySyncAll             bool   `json:"expiry_sync_all"`
	ExpirySyncDaysRange       int    `json:"expiry_sync_days_range"`
	BackupIntervalHours       int    `json:"backup_interval_hours"`
	BackupEnabled             bool   `json:"backup_enabled"`
	BackupRetentionDays       int    `json:"backup_retention_days"`
	SecurityLogRetentionDays  int    `json:"security_log_retention_days"`
	BackupDownloadMode        string `json:"backup_download_mode"`
	CacheEnabled              bool   `json:"cache_enabled"`
	CacheAuthTTLMinutes       int    `json:"cache_auth_ttl_minutes"`
	CacheCategoriesTTLMinutes int    `json:"cache_categories_ttl_minutes"`
	CacheStreamsTTLMinutes    int    `json:"cache_streams_ttl_minutes"`
	TrackingTimeoutMinutes    int    `json:"tracking_timeout_minutes"`
	// Throttling fields
	ThrottleEnabled              bool `json:"throttle_enabled"`
	ThrottleRouterEnabled        bool `json:"throttle_router_enabled"`
	ThrottleRouterLimit          int  `json:"throttle_router_limit"`
	ThrottleRouterWindowSeconds  int  `json:"throttle_router_window_seconds"`
	ThrottleM3UEPGEnabled        bool `json:"throttle_m3u_epg_enabled"`
	ThrottleM3UEPGLimit          int  `json:"throttle_m3u_epg_limit"`
	ThrottleM3UEPGWindowSeconds  int  `json:"throttle_m3u_epg_window_seconds"`
	ThrottleXtreamEnabled        bool `json:"throttle_xtream_enabled"`
	ThrottleXtreamLimit          int  `json:"throttle_xtream_limit"`
	ThrottleXtreamWindowSeconds  int  `json:"throttle_xtream_window_seconds"`
	ThrottleStalkerEnabled       bool `json:"throttle_stalker_enabled"`
	ThrottleStalkerLimit         int  `json:"throttle_stalker_limit"`
	ThrottleStalkerWindowSeconds int  `json:"throttle_stalker_window_seconds"`
	// Portal Studio & Branding (Global & Login)
	UserDashboardEnabled             bool   `json:"user_dashboard_enabled"`
	UserDashboardTitle               string `json:"user_dashboard_title,omitempty"`
	UserDashboardAllowHideCategories bool   `json:"user_dashboard_allow_hide_categories"`
	UserDashboardHTML                string `json:"user_dashboard_html,omitempty"`
	UserDashboardLogo                string `json:"user_dashboard_logo,omitempty"`
	UserDashboardPrimaryColor        string `json:"user_dashboard_primary_color,omitempty"`
	UserDashboardSecondaryColor      string `json:"user_dashboard_secondary_color,omitempty"`
	UserDashboardAccentColor         string `json:"user_dashboard_accent_color,omitempty"`
	UserDashboardBackgroundTheme     string `json:"user_dashboard_background_theme,omitempty"`
	// Anti-Brute Force & Multi-IP Protection
	AntiBruteForceEnabled       bool   `json:"antibruteforce_enabled"`
	AntiBruteForceMaxAttempts   int    `json:"antibruteforce_max_attempts"`
	AntiBruteForceWindowMinutes int    `json:"antibruteforce_window_minutes"`
	AntiBruteForceBanHours      int    `json:"antibruteforce_ban_hours"`
	MultiIPDetectionEnabled     bool   `json:"multi_ip_detection_enabled"`
	MultiIPMaxSubnets           int    `json:"multi_ip_max_subnets"`
	MultiIPWindowHours          int    `json:"multi_ip_window_hours"`
	MultiIPAutoSuspend          bool   `json:"multi_ip_auto_suspend"`
	CaptchaProvider             string `json:"captcha_provider,omitempty"`
	CaptchaSiteKey              string `json:"captcha_site_key,omitempty"`
	CaptchaSecretKey            string `json:"captcha_secret_key,omitempty"`
	// Host & Domain Access Isolation & SSL
	AdminHostname             string `json:"admin_hostname,omitempty"`
	BlockStreamingOnAdminHost bool   `json:"block_streaming_on_admin_host"`
	RestrictAdminToAdminHost  bool   `json:"restrict_admin_to_admin_host"`
	BlockDirectIPStreaming    bool   `json:"block_direct_ip_streaming"`
	SSLOnDemandEnabled        bool   `json:"ssl_on_demand_enabled"`
	AdditionalSSLDomains      string `json:"additional_ssl_domains,omitempty"`
	EPGMaxDays                int    `json:"epg_max_days"`
}

// PlaylistConfigBackup represents playlist configurations (including welcome_info & portal_branding).
type PlaylistConfigBackup struct {
	ID                     FlexUint64      `json:"id"`
	Name                   string          `json:"name"`
	MaxConnections         int             `json:"max_connections"`
	LimitMaxConnections    bool            `json:"limit_max_connections"`
	AllowTracking          bool            `json:"allow_tracking"`
	TrackingTimeoutMinutes int             `json:"tracking_timeout_minutes"`
	CName                  string          `json:"cname,omitempty"`
	EnforceCname           bool            `json:"enforce_cname"`
	CnameSSL               bool            `json:"cname_ssl"`
	Patterns               json.RawMessage `json:"patterns,omitempty"`
	WelcomeInfo            json.RawMessage `json:"welcome_info,omitempty"`
	PortalBranding         json.RawMessage `json:"portal_branding,omitempty"`
}

// TeamMemberBackup represents an administrator or collaborator account in a backup.
type TeamMemberBackup struct {
	Username               string      `json:"username"`
	PasswordHash           string      `json:"password_hash"`
	Role                   string      `json:"role"` // "admin" or "collaborator"
	ManageAllPlaylists     bool        `json:"manage_all_playlists"`
	CanSeeAllUsers         bool        `json:"can_see_all_users"`
	CanCreateCollaborators bool        `json:"can_create_collaborators"`
	CanCreateAdmins        bool        `json:"can_create_admins"`
	CreatedByUsername      *string     `json:"created_by_username,omitempty"`
	AllowedPlaylistIDs     Uint64Slice `json:"allowed_playlist_ids,omitempty"`
}

// BackupPayload is the standardized JSON structure for backup export/import (v1.0 and v2.0).
type BackupPayload struct {
	Version        string                 `json:"version"`
	ExportedAt     string                 `json:"exported_at"`
	ExportedBy     string                 `json:"exported_by"`
	BackupType     string                 `json:"backup_type,omitempty"` // "users", "settings", "team", "full"
	PlaylistID     *FlexUint64            `json:"playlist_id,omitempty"`
	PlaylistName   string                 `json:"playlist_name,omitempty"`
	TotalUsers     int                    `json:"total_users"`
	Users          []ManagedUser          `json:"users,omitempty"`
	SystemSettings *SystemSettingsBackup  `json:"system_settings,omitempty"`
	Playlists      []PlaylistConfigBackup `json:"playlists,omitempty"`
	TeamMembers    []TeamMemberBackup     `json:"team_members,omitempty"`
	HasTeamMembers bool                   `json:"has_team_members,omitempty"`
}

// RestoreRequest holds parameters to restore users and/or settings from a backup payload.
type RestoreRequest struct {
	SourceListID        *FlexUint64    `json:"source_list_id,omitempty"`     // Filter users in backup to only this playlist
	TargetListID        *FlexUint64    `json:"target_list_id,omitempty"`     // Reassign restored users to this playlist
	Mode                string         `json:"mode"`                          // "skip" (default) or "overwrite"
	RestoreUsers        *bool          `json:"restore_users,omitempty"`      // Defaults to true if users are present
	RestoreSettings     bool           `json:"restore_settings,omitempty"`   // Restore sync, cache and system settings
	RestoreToken        bool           `json:"restore_token,omitempty"`      // Explicitly restore API token if present
	RestorePlaylists    bool           `json:"restore_playlists,omitempty"`  // Restore welcome_info and playlist configs
	RestoreTeamMembers  bool           `json:"restore_team_members,omitempty"` // Restore admins and collaborators
	RestoreTeamScope    string         `json:"restore_team_scope,omitempty"` // "all", "collaborators_only"
	Users               []ManagedUser  `json:"users,omitempty"`              // Direct users array
	FileContent         *BackupPayload `json:"file_content,omitempty"`       // Wrapped backup payload from client upload
}

// RestoreResult contains statistics after restoring a backup payload.
type RestoreResult struct {
	Success             bool     `json:"success"`
	Mode                string   `json:"mode"`
	TotalInFile         int      `json:"total_in_file"`
	Created             int      `json:"created"`
	Updated             int      `json:"updated"`
	Skipped             int      `json:"skipped"`
	SettingsRestored    bool     `json:"settings_restored"`
	TokenRestored       bool     `json:"token_restored"`
	PlaylistsRestored   int      `json:"playlists_restored"`
	TeamMembersRestored int      `json:"team_members_restored"`
	Errors              []string `json:"errors,omitempty"`
	Message             string   `json:"message"`
}

