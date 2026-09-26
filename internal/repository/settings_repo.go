package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

type SettingsRepo struct {
	db *sql.DB
}

func NewSettingsRepo(db *sql.DB) *SettingsRepo {
	return &SettingsRepo{db: db}
}

// EnsureSchema applies schema migrations for system_settings safely.
func (r *SettingsRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS system_settings (
			id INT PRIMARY KEY DEFAULT 1,
			iptveditor_api_token VARCHAR(255) NULL,
			playlist_sync_interval_hours INT NOT NULL DEFAULT 6,
			playlist_sync_enabled TINYINT(1) NOT NULL DEFAULT 1,
			expiry_sync_interval_hours INT NOT NULL DEFAULT 12,
			expiry_sync_enabled TINYINT(1) NOT NULL DEFAULT 1,
			expiry_sync_all TINYINT(1) NOT NULL DEFAULT 0,
			expiry_sync_days_range INT NOT NULL DEFAULT 5,
			backup_interval_hours INT NOT NULL DEFAULT 24,
			backup_enabled TINYINT(1) NOT NULL DEFAULT 1,
			backup_retention_days INT NOT NULL DEFAULT 30,
			security_log_retention_days INT NOT NULL DEFAULT 7,
			backup_download_mode VARCHAR(32) NOT NULL DEFAULT 'disabled',
			last_playlist_sync DATETIME NULL,
			last_expiry_sync DATETIME NULL,
			last_backup DATETIME NULL,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS expiry_sync_days_range INT NOT NULL DEFAULT 5`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS iptveditor_api_token VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tmdb_api_key VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS security_log_retention_days INT NOT NULL DEFAULT 7`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS backup_download_mode VARCHAR(32) NOT NULL DEFAULT 'disabled'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cache_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cache_auth_ttl_minutes INT NOT NULL DEFAULT 3`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cache_categories_ttl_minutes INT NOT NULL DEFAULT 120`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cache_streams_ttl_minutes INT NOT NULL DEFAULT 10`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS tracking_timeout_minutes INT NOT NULL DEFAULT 10`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_max_attempts INT NOT NULL DEFAULT 5`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_window_minutes INT NOT NULL DEFAULT 15`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_ban_hours INT NOT NULL DEFAULT 24`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_detection_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_max_subnets INT NOT NULL DEFAULT 10`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_window_hours INT NOT NULL DEFAULT 2`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_auto_suspend TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_router_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_router_limit INT NOT NULL DEFAULT 30`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_router_window_seconds INT NOT NULL DEFAULT 10`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_m3u_epg_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_m3u_epg_limit INT NOT NULL DEFAULT 18`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_m3u_epg_window_seconds INT NOT NULL DEFAULT 300`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_xtream_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_xtream_limit INT NOT NULL DEFAULT 40`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_xtream_window_seconds INT NOT NULL DEFAULT 20`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_stalker_enabled TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_stalker_limit INT NOT NULL DEFAULT 60`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS throttle_stalker_window_seconds INT NOT NULL DEFAULT 60`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_title VARCHAR(255) NOT NULL DEFAULT 'Client Portal'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_allow_hide_categories TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_html MEDIUMTEXT NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_logo MEDIUMTEXT NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_primary_color VARCHAR(32) NOT NULL DEFAULT '#3b82f6'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_secondary_color VARCHAR(32) NOT NULL DEFAULT '#6366f1'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_accent_color VARCHAR(32) NOT NULL DEFAULT '#10b981'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS user_dashboard_background_theme VARCHAR(32) NOT NULL DEFAULT 'slate'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS epg_max_days INT NOT NULL DEFAULT 4`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS admin_hostname VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS block_streaming_on_admin_host TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS restrict_admin_to_admin_host TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS block_direct_ip_streaming TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS iptveditor_api_url VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS iptveditor_api_password VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS setup_completed TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS captcha_provider VARCHAR(32) NOT NULL DEFAULT 'default'`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS captcha_site_key VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS captcha_secret_key VARCHAR(255) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS ssl_on_demand_enabled TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS additional_ssl_domains TEXT NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS license_suspended TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS license_suspended_at DATETIME(3) NULL`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS license_upgrade_url VARCHAR(512) NOT NULL DEFAULT ''`,
		`INSERT IGNORE INTO system_settings (
			id,
			playlist_sync_interval_hours,
			playlist_sync_enabled,
			expiry_sync_interval_hours,
			expiry_sync_enabled,
			expiry_sync_all,
			backup_interval_hours,
			backup_enabled,
			backup_retention_days,
			security_log_retention_days,
			backup_download_mode,
			cache_enabled,
			cache_auth_ttl_minutes,
			cache_categories_ttl_minutes,
			cache_streams_ttl_minutes
		) VALUES (1, 6, 1, 12, 1, 0, 24, 1, 30, 7, 'disabled', 1, 3, 120, 10)`,
	}

	for _, q := range queries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			log.Printf("[WARN] EnsureSchema system_settings error: %v", err)
			return err
		}
	}
	return nil
}

// Get retrieves the system settings row (id = 1).
func (r *SettingsRepo) Get(ctx context.Context) (*models.SystemSettings, error) {
	query := `
		SELECT id, COALESCE(iptveditor_api_token, ''), COALESCE(tmdb_api_key, ''), playlist_sync_interval_hours, playlist_sync_enabled,
		       expiry_sync_interval_hours, expiry_sync_enabled, expiry_sync_all, COALESCE(expiry_sync_days_range, 5),
		       backup_interval_hours, backup_enabled, backup_retention_days,
		       COALESCE(security_log_retention_days, 7),
		       COALESCE(antibruteforce_enabled, 1),
		       COALESCE(antibruteforce_max_attempts, 5),
		       COALESCE(antibruteforce_window_minutes, 15),
		       COALESCE(antibruteforce_ban_hours, 24),
		       COALESCE(multi_ip_detection_enabled, 1),
		       COALESCE(multi_ip_max_subnets, 10),
		       COALESCE(multi_ip_window_hours, 2),
		       COALESCE(multi_ip_auto_suspend, 1),
		       COALESCE(backup_download_mode, 'disabled'),
		       COALESCE(cache_enabled, 1),
		       COALESCE(cache_auth_ttl_minutes, 3),
		       COALESCE(cache_categories_ttl_minutes, 120),
		       COALESCE(cache_streams_ttl_minutes, 10),
		       COALESCE(tracking_timeout_minutes, 10),
		       COALESCE(user_dashboard_enabled, 1),
		       COALESCE(user_dashboard_title, 'Client Portal'),
		       COALESCE(user_dashboard_allow_hide_categories, 1),
		       COALESCE(user_dashboard_html, ''),
		       COALESCE(user_dashboard_logo, ''),
		       COALESCE(user_dashboard_primary_color, '#3b82f6'),
		       COALESCE(user_dashboard_secondary_color, '#6366f1'),
		       COALESCE(user_dashboard_accent_color, '#10b981'),
		       COALESCE(user_dashboard_background_theme, 'slate'),
		       COALESCE(throttle_enabled, 1),
		       COALESCE(throttle_router_enabled, 1),
		       COALESCE(throttle_router_limit, 30),
		       COALESCE(throttle_router_window_seconds, 10),
		       COALESCE(throttle_m3u_epg_enabled, 1),
		       COALESCE(throttle_m3u_epg_limit, 18),
		       COALESCE(throttle_m3u_epg_window_seconds, 300),
		       COALESCE(throttle_xtream_enabled, 1),
		       COALESCE(throttle_xtream_limit, 40),
		       COALESCE(throttle_xtream_window_seconds, 20),
		       COALESCE(throttle_stalker_enabled, 0),
		       COALESCE(throttle_stalker_limit, 60),
		       COALESCE(throttle_stalker_window_seconds, 60),
		       COALESCE(epg_max_days, 4),
		       COALESCE(admin_hostname, ''),
		       COALESCE(block_streaming_on_admin_host, 1),
		       COALESCE(restrict_admin_to_admin_host, 0),
		       COALESCE(block_direct_ip_streaming, 0),
		       COALESCE(iptveditor_api_url, ''),
		       COALESCE(iptveditor_api_password, ''),
		       COALESCE(setup_completed, 0),
		       COALESCE(captcha_provider, 'default'),
		       COALESCE(captcha_site_key, ''),
		       COALESCE(captcha_secret_key, ''),
		       COALESCE(ssl_on_demand_enabled, 0),
		       COALESCE(additional_ssl_domains, ''),
		       COALESCE(license_suspended, 0),
		       license_suspended_at,
		       COALESCE(license_upgrade_url, ''),
		       last_playlist_sync, last_expiry_sync, last_backup, updated_at
		FROM system_settings
		WHERE id = 1
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query)

	var s models.SystemSettings
	var pSyncEnabled, eSyncEnabled, eSyncAll, bEnabled, cEnabled, abfEnabled int
	var multiIPDetEnabled, multiIPAutoSuspend int
	var uDashEnabled, uDashAllowHide int
	var uDashTitle, uDashHTML string
	var uDashLogo, uDashPrimary, uDashSecondary, uDashAccent, uDashTheme string
	var thEnabled, thRouter, thM3U, thXtream, thStalker int
	var blockStreamingOnAdminHost, restrictAdminToAdminHost, blockDirectIPStreaming int
	var setupCompleted int
	var sslOnDemandEnabled int
	var additionalSSLDomains string
	var licenseSuspended int
	var licenseSuspendedAt sql.NullTime
	var lastPlaylistSync, lastExpirySync, lastBackup sql.NullTime
	var updatedAt sql.NullTime

	err := row.Scan(
		&s.ID,
		&s.IPTVEditorAPIToken,
		&s.TMDBApiKey,
		&s.PlaylistSyncIntervalHours,
		&pSyncEnabled,
		&s.ExpirySyncIntervalHours,
		&eSyncEnabled,
		&eSyncAll,
		&s.ExpirySyncDaysRange,
		&s.BackupIntervalHours,
		&bEnabled,
		&s.BackupRetentionDays,
		&s.SecurityLogRetentionDays,
		&abfEnabled,
		&s.AntiBruteForceMaxAttempts,
		&s.AntiBruteForceWindowMinutes,
		&s.AntiBruteForceBanHours,
		&multiIPDetEnabled,
		&s.MultiIPMaxSubnets,
		&s.MultiIPWindowHours,
		&multiIPAutoSuspend,
		&s.BackupDownloadMode,
		&cEnabled,
		&s.CacheAuthTTLMinutes,
		&s.CacheCategoriesTTLMinutes,
		&s.CacheStreamsTTLMinutes,
		&s.TrackingTimeoutMinutes,
		&uDashEnabled,
		&uDashTitle,
		&uDashAllowHide,
		&uDashHTML,
		&uDashLogo,
		&uDashPrimary,
		&uDashSecondary,
		&uDashAccent,
		&uDashTheme,
		&thEnabled,
		&thRouter,
		&s.ThrottleRouterLimit,
		&s.ThrottleRouterWindowSeconds,
		&thM3U,
		&s.ThrottleM3UEPGLimit,
		&s.ThrottleM3UEPGWindowSeconds,
		&thXtream,
		&s.ThrottleXtreamLimit,
		&s.ThrottleXtreamWindowSeconds,
		&thStalker,
		&s.ThrottleStalkerLimit,
		&s.ThrottleStalkerWindowSeconds,
		&s.EPGMaxDays,
		&s.AdminHostname,
		&blockStreamingOnAdminHost,
		&restrictAdminToAdminHost,
		&blockDirectIPStreaming,
		&s.IPTVEditorAPIURL,
		&s.IPTVEditorAPIPassword,
		&setupCompleted,
		&s.CaptchaProvider,
		&s.CaptchaSiteKey,
		&s.CaptchaSecretKey,
		&sslOnDemandEnabled,
		&additionalSSLDomains,
		&licenseSuspended,
		&licenseSuspendedAt,
		&s.LicenseUpgradeURL,
		&lastPlaylistSync,
		&lastExpirySync,
		&lastBackup,
		&updatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Initialize default and fetch again
			if initErr := r.EnsureSchema(ctx); initErr != nil {
				return nil, initErr
			}
			return r.Get(ctx)
		}
		return nil, fmt.Errorf("failed to query system_settings: %w", err)
	}

	if s.BackupDownloadMode == "" {
		s.BackupDownloadMode = "disabled"
	}

	s.PlaylistSyncEnabled = pSyncEnabled == 1
	s.ExpirySyncEnabled = eSyncEnabled == 1
	s.ExpirySyncAll = eSyncAll == 1
	if s.ExpirySyncDaysRange <= 0 {
		s.ExpirySyncDaysRange = 5
	}
	s.BackupEnabled = bEnabled == 1
	s.CacheEnabled = cEnabled == 1
	s.AntiBruteForceEnabled = abfEnabled == 1
	s.MultiIPDetectionEnabled = multiIPDetEnabled == 1
	s.MultiIPAutoSuspend = multiIPAutoSuspend == 1
	s.BlockStreamingOnAdminHost = blockStreamingOnAdminHost == 1
	s.RestrictAdminToAdminHost = restrictAdminToAdminHost == 1
	s.BlockDirectIPStreaming = blockDirectIPStreaming == 1
	s.SetupCompleted = setupCompleted == 1
	s.SSLOnDemandEnabled = sslOnDemandEnabled == 1
	s.AdditionalSSLDomains = additionalSSLDomains
	s.LicenseSuspended = licenseSuspended == 1
	if licenseSuspendedAt.Valid {
		s.LicenseSuspendedAt = &licenseSuspendedAt.Time
	}
	s.UserDashboardEnabled = uDashEnabled == 1
	s.UserDashboardTitle = uDashTitle
	if s.UserDashboardTitle == "" {
		s.UserDashboardTitle = "Client Portal"
	}
	s.UserDashboardAllowHideCategories = uDashAllowHide == 1
	s.UserDashboardHTML = uDashHTML
	s.UserDashboardLogo = uDashLogo
	s.UserDashboardPrimaryColor = uDashPrimary
	if s.UserDashboardPrimaryColor == "" {
		s.UserDashboardPrimaryColor = "#3b82f6"
	}
	s.UserDashboardSecondaryColor = uDashSecondary
	if s.UserDashboardSecondaryColor == "" {
		s.UserDashboardSecondaryColor = "#6366f1"
	}
	s.UserDashboardAccentColor = uDashAccent
	if s.UserDashboardAccentColor == "" {
		s.UserDashboardAccentColor = "#10b981"
	}
	s.UserDashboardBackgroundTheme = uDashTheme
	if s.UserDashboardBackgroundTheme == "" {
		s.UserDashboardBackgroundTheme = "slate"
	}

	s.ThrottleEnabled = thEnabled == 1
	s.ThrottleRouterEnabled = thRouter == 1
	s.ThrottleM3UEPGEnabled = thM3U == 1
	s.ThrottleXtreamEnabled = thXtream == 1
	s.ThrottleStalkerEnabled = thStalker == 1

	if s.ThrottleRouterLimit <= 0 {
		s.ThrottleRouterLimit = 30
	}
	if s.ThrottleRouterWindowSeconds <= 0 {
		s.ThrottleRouterWindowSeconds = 10
	}
	if s.ThrottleM3UEPGLimit <= 0 {
		s.ThrottleM3UEPGLimit = 18
	}
	if s.ThrottleM3UEPGWindowSeconds <= 0 {
		s.ThrottleM3UEPGWindowSeconds = 300
	}
	if s.ThrottleXtreamLimit <= 0 {
		s.ThrottleXtreamLimit = 40
	}
	if s.ThrottleXtreamWindowSeconds <= 0 {
		s.ThrottleXtreamWindowSeconds = 20
	}
	if s.ThrottleStalkerLimit <= 0 {
		s.ThrottleStalkerLimit = 60
	}
	if s.ThrottleStalkerWindowSeconds <= 0 {
		s.ThrottleStalkerWindowSeconds = 60
	}

	if s.MultiIPMaxSubnets <= 0 {
		s.MultiIPMaxSubnets = 10
	}
	if s.MultiIPWindowHours <= 0 {
		s.MultiIPWindowHours = 2
	}

	if s.AntiBruteForceMaxAttempts <= 0 {
		s.AntiBruteForceMaxAttempts = 5
	}
	if s.AntiBruteForceWindowMinutes <= 0 {
		s.AntiBruteForceWindowMinutes = 15
	}
	if s.AntiBruteForceBanHours <= 0 {
		s.AntiBruteForceBanHours = 24
	}

	if s.CacheAuthTTLMinutes <= 0 {
		s.CacheAuthTTLMinutes = 3
	}
	if s.CacheCategoriesTTLMinutes <= 0 {
		s.CacheCategoriesTTLMinutes = 120
	}
	if s.CacheStreamsTTLMinutes <= 0 {
		s.CacheStreamsTTLMinutes = 10
	}
	if s.TrackingTimeoutMinutes <= 0 {
		s.TrackingTimeoutMinutes = 10
	}

	if lastPlaylistSync.Valid {
		s.LastPlaylistSync = &lastPlaylistSync.Time
	}
	if lastExpirySync.Valid {
		s.LastExpirySync = &lastExpirySync.Time
	}
	if lastBackup.Valid {
		s.LastBackup = &lastBackup.Time
	}
	if updatedAt.Valid {
		s.UpdatedAt = &updatedAt.Time
	}

	return &s, nil
}

// Update saves modified configuration to system_settings.
func (r *SettingsRepo) Update(ctx context.Context, s *models.SystemSettings) error {
	pSync := 0
	if s.PlaylistSyncEnabled {
		pSync = 1
	}
	eSync := 0
	if s.ExpirySyncEnabled {
		eSync = 1
	}
	eAll := 0
	if s.ExpirySyncAll {
		eAll = 1
	}
	bEnabled := 0
	if s.BackupEnabled {
		bEnabled = 1
	}
	cEnabled := 0
	if s.CacheEnabled {
		cEnabled = 1
	}
	abfEnabled := 0
	if s.AntiBruteForceEnabled {
		abfEnabled = 1
	}
	multiIPDet := 0
	if s.MultiIPDetectionEnabled {
		multiIPDet = 1
	}
	multiIPAuto := 0
	if s.MultiIPAutoSuspend {
		multiIPAuto = 1
	}
	blockStreamingOnAdmin := 1
	if !s.BlockStreamingOnAdminHost {
		blockStreamingOnAdmin = 0
	}
	restrictAdminToAdmin := 0
	if s.RestrictAdminToAdminHost {
		restrictAdminToAdmin = 1
	}
	blockDirectIP := 0
	if s.BlockDirectIPStreaming {
		blockDirectIP = 1
	}

	if s.MultiIPMaxSubnets <= 0 {
		s.MultiIPMaxSubnets = 10
	}
	if s.MultiIPWindowHours <= 0 {
		s.MultiIPWindowHours = 2
	}

	if s.PlaylistSyncIntervalHours <= 0 {
		s.PlaylistSyncIntervalHours = 6
	}
	if s.ExpirySyncIntervalHours <= 0 {
		s.ExpirySyncIntervalHours = 12
	}
	if s.ExpirySyncDaysRange <= 0 {
		s.ExpirySyncDaysRange = 5
	}
	if s.BackupIntervalHours <= 0 {
		s.BackupIntervalHours = 24
	}
	if s.BackupRetentionDays <= 0 {
		s.BackupRetentionDays = 30
	}
	if s.SecurityLogRetentionDays <= 0 {
		s.SecurityLogRetentionDays = 7
	}
	if s.AntiBruteForceMaxAttempts <= 0 {
		s.AntiBruteForceMaxAttempts = 5
	}
	if s.AntiBruteForceWindowMinutes <= 0 {
		s.AntiBruteForceWindowMinutes = 15
	}
	if s.AntiBruteForceBanHours <= 0 {
		s.AntiBruteForceBanHours = 24
	}
	if s.BackupDownloadMode != "prompt" && s.BackupDownloadMode != "auto" {
		s.BackupDownloadMode = "disabled"
	}
	if s.CacheAuthTTLMinutes <= 0 {
		s.CacheAuthTTLMinutes = 3
	}
	if s.CacheCategoriesTTLMinutes <= 0 {
		s.CacheCategoriesTTLMinutes = 120
	}
	if s.CacheStreamsTTLMinutes <= 0 {
		s.CacheStreamsTTLMinutes = 10
	}
	if s.TrackingTimeoutMinutes <= 0 {
		s.TrackingTimeoutMinutes = 10
	}

	uDashEnabled := 0
	if s.UserDashboardEnabled {
		uDashEnabled = 1
	}
	uDashAllowHide := 0
	if s.UserDashboardAllowHideCategories {
		uDashAllowHide = 1
	}
	if s.UserDashboardTitle == "" {
		s.UserDashboardTitle = "Client Portal"
	}
	if s.UserDashboardPrimaryColor == "" {
		s.UserDashboardPrimaryColor = "#3b82f6"
	}
	if s.UserDashboardSecondaryColor == "" {
		s.UserDashboardSecondaryColor = "#6366f1"
	}
	if s.UserDashboardAccentColor == "" {
		s.UserDashboardAccentColor = "#10b981"
	}
	if s.UserDashboardBackgroundTheme == "" {
		s.UserDashboardBackgroundTheme = "slate"
	}

	thEnabled := 0
	if s.ThrottleEnabled {
		thEnabled = 1
	}
	thRouter := 0
	if s.ThrottleRouterEnabled {
		thRouter = 1
	}
	thM3U := 0
	if s.ThrottleM3UEPGEnabled {
		thM3U = 1
	}
	thXtream := 0
	if s.ThrottleXtreamEnabled {
		thXtream = 1
	}
	thStalker := 0
	if s.ThrottleStalkerEnabled {
		thStalker = 1
	}

	if s.ThrottleRouterLimit <= 0 {
		s.ThrottleRouterLimit = 30
	}
	if s.ThrottleRouterWindowSeconds <= 0 {
		s.ThrottleRouterWindowSeconds = 10
	}
	if s.ThrottleM3UEPGLimit <= 0 {
		s.ThrottleM3UEPGLimit = 18
	}
	if s.ThrottleM3UEPGWindowSeconds <= 0 {
		s.ThrottleM3UEPGWindowSeconds = 300
	}
	if s.ThrottleXtreamLimit <= 0 {
		s.ThrottleXtreamLimit = 40
	}
	if s.ThrottleXtreamWindowSeconds <= 0 {
		s.ThrottleXtreamWindowSeconds = 20
	}
	if s.ThrottleStalkerLimit <= 0 {
		s.ThrottleStalkerLimit = 60
	}
	if s.ThrottleStalkerWindowSeconds <= 0 {
		s.ThrottleStalkerWindowSeconds = 60
	}
	if s.EPGMaxDays <= 0 {
		s.EPGMaxDays = 4
	}

	query := `
		UPDATE system_settings
		SET iptveditor_api_token = ?,
		    tmdb_api_key = ?,
		    playlist_sync_interval_hours = ?,
		    playlist_sync_enabled = ?,
		    expiry_sync_interval_hours = ?,
		    expiry_sync_enabled = ?,
		    expiry_sync_all = ?,
		    expiry_sync_days_range = ?,
		    backup_interval_hours = ?,
		    backup_enabled = ?,
		    backup_retention_days = ?,
		    security_log_retention_days = ?,
		    antibruteforce_enabled = ?,
		    antibruteforce_max_attempts = ?,
		    antibruteforce_window_minutes = ?,
		    antibruteforce_ban_hours = ?,
		    multi_ip_detection_enabled = ?,
		    multi_ip_max_subnets = ?,
		    multi_ip_window_hours = ?,
		    multi_ip_auto_suspend = ?,
		    backup_download_mode = ?,
		    cache_enabled = ?,
		    cache_auth_ttl_minutes = ?,
		    cache_categories_ttl_minutes = ?,
		    cache_streams_ttl_minutes = ?,
		    tracking_timeout_minutes = ?,
		    user_dashboard_enabled = ?,
		    user_dashboard_title = ?,
		    user_dashboard_allow_hide_categories = ?,
		    user_dashboard_html = ?,
		    user_dashboard_logo = ?,
		    user_dashboard_primary_color = ?,
		    user_dashboard_secondary_color = ?,
		    user_dashboard_accent_color = ?,
		    user_dashboard_background_theme = ?,
		    throttle_enabled = ?,
		    throttle_router_enabled = ?,
		    throttle_router_limit = ?,
		    throttle_router_window_seconds = ?,
		    throttle_m3u_epg_enabled = ?,
		    throttle_m3u_epg_limit = ?,
		    throttle_m3u_epg_window_seconds = ?,
		    throttle_xtream_enabled = ?,
		    throttle_xtream_limit = ?,
		    throttle_xtream_window_seconds = ?,
		    throttle_stalker_enabled = ?,
		    throttle_stalker_limit = ?,
		    throttle_stalker_window_seconds = ?,
		    epg_max_days = ?,
		    admin_hostname = ?,
		    block_streaming_on_admin_host = ?,
		    restrict_admin_to_admin_host = ?,
		    block_direct_ip_streaming = ?,
		    iptveditor_api_url = ?,
		    iptveditor_api_password = ?,
		    setup_completed = ?,
		    captcha_provider = ?,
		    captcha_site_key = ?,
		    captcha_secret_key = ?,
		    ssl_on_demand_enabled = ?,
		    additional_ssl_domains = ?
		WHERE id = 1
	`
	setupComp := 0
	if s.SetupCompleted {
		setupComp = 1
	}
	if s.CaptchaProvider == "" {
		s.CaptchaProvider = "default"
	}
	sslOnDemand := 0
	if s.SSLOnDemandEnabled {
		sslOnDemand = 1
	}
	_, err := r.db.ExecContext(ctx, query,
		s.IPTVEditorAPIToken,
		s.TMDBApiKey,
		s.PlaylistSyncIntervalHours,
		pSync,
		s.ExpirySyncIntervalHours,
		eSync,
		eAll,
		s.ExpirySyncDaysRange,
		s.BackupIntervalHours,
		bEnabled,
		s.BackupRetentionDays,
		s.SecurityLogRetentionDays,
		abfEnabled,
		s.AntiBruteForceMaxAttempts,
		s.AntiBruteForceWindowMinutes,
		s.AntiBruteForceBanHours,
		multiIPDet,
		s.MultiIPMaxSubnets,
		s.MultiIPWindowHours,
		multiIPAuto,
		s.BackupDownloadMode,
		cEnabled,
		s.CacheAuthTTLMinutes,
		s.CacheCategoriesTTLMinutes,
		s.CacheStreamsTTLMinutes,
		s.TrackingTimeoutMinutes,
		uDashEnabled,
		s.UserDashboardTitle,
		uDashAllowHide,
		s.UserDashboardHTML,
		s.UserDashboardLogo,
		s.UserDashboardPrimaryColor,
		s.UserDashboardSecondaryColor,
		s.UserDashboardAccentColor,
		s.UserDashboardBackgroundTheme,
		thEnabled,
		thRouter,
		s.ThrottleRouterLimit,
		s.ThrottleRouterWindowSeconds,
		thM3U,
		s.ThrottleM3UEPGLimit,
		s.ThrottleM3UEPGWindowSeconds,
		thXtream,
		s.ThrottleXtreamLimit,
		s.ThrottleXtreamWindowSeconds,
		thStalker,
		s.ThrottleStalkerLimit,
		s.ThrottleStalkerWindowSeconds,
		s.EPGMaxDays,
		s.AdminHostname,
		blockStreamingOnAdmin,
		restrictAdminToAdmin,
		blockDirectIP,
		s.IPTVEditorAPIURL,
		s.IPTVEditorAPIPassword,
		setupComp,
		s.CaptchaProvider,
		s.CaptchaSiteKey,
		s.CaptchaSecretKey,
		sslOnDemand,
		s.AdditionalSSLDomains,
	)
	return err
}

// UpdateLastPlaylistSync updates the timestamp of the last playlist sync.
func (r *SettingsRepo) UpdateLastPlaylistSync(ctx context.Context, t time.Time) error {
	query := `UPDATE system_settings SET last_playlist_sync = ? WHERE id = 1`
	_, err := r.db.ExecContext(ctx, query, t)
	return err
}

// UpdateLastExpirySync updates the timestamp of the last customer expiry sync.
func (r *SettingsRepo) UpdateLastExpirySync(ctx context.Context, t time.Time) error {
	query := `UPDATE system_settings SET last_expiry_sync = ? WHERE id = 1`
	_, err := r.db.ExecContext(ctx, query, t)
	return err
}

// UpdateLastBackup updates the timestamp of the last backup.
func (r *SettingsRepo) UpdateLastBackup(ctx context.Context, t time.Time) error {
	query := `UPDATE system_settings SET last_backup = ? WHERE id = 1`
	_, err := r.db.ExecContext(ctx, query, t)
	return err
}

// SetLicenseSuspension updates license_suspended, license_suspended_at, and optionally license_upgrade_url.
func (r *SettingsRepo) SetLicenseSuspension(ctx context.Context, suspended bool, suspendedAt *time.Time, upgradeURL ...string) error {
	var query string
	if suspended {
		query = `UPDATE system_settings SET license_suspended = 1, license_suspended_at = COALESCE(license_suspended_at, ?), license_upgrade_url = COALESCE(NULLIF(?, ''), license_upgrade_url) WHERE id = 1`
		now := time.Now()
		if suspendedAt != nil {
			now = *suspendedAt
		}
		var upURL string
		if len(upgradeURL) > 0 {
			upURL = strings.TrimSpace(upgradeURL[0])
		}
		_, err := r.db.ExecContext(ctx, query, now, upURL)
		return err
	}
	query = `UPDATE system_settings SET license_suspended = 0, license_suspended_at = NULL, license_upgrade_url = '' WHERE id = 1`
	_, err := r.db.ExecContext(ctx, query)
	return err
}
