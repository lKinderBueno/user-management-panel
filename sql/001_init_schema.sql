-- PlaylistLabs User Management - MariaDB Complete Database Schema
-- Unified schema for Initial Release

-- ============================================================================
-- 1. PLAYLISTS & METADATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS `playlists` (
    `id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `message` VARCHAR(255) NULL,
    `language` VARCHAR(255) NULL,
    `use_provider_movie_info` BOOLEAN NOT NULL DEFAULT FALSE,
    `epg_days` SMALLINT NOT NULL DEFAULT 4,
    `tvg_id` BOOLEAN NOT NULL DEFAULT FALSE,
    `gzip` BOOLEAN NOT NULL DEFAULT FALSE,
    `epg_dummy` VARCHAR(255) NULL,
    `max_connections` SMALLINT NOT NULL DEFAULT 1,
    `limit_max_connections` BOOLEAN NOT NULL DEFAULT FALSE,
    `allow_tracking` BOOLEAN NOT NULL DEFAULT FALSE,
    `tracking_timeout_minutes` INT NOT NULL DEFAULT 10,
    `time_shift` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `patterns` LONGTEXT NULL,
    `welcome_info` LONGTEXT NULL,
    `cname` TEXT NULL,
    `enforce_cname` TINYINT(1) NOT NULL DEFAULT 0,
    `cname_ssl` TINYINT(1) NOT NULL DEFAULT 0,
    `portal_branding` MEDIUMTEXT NULL,
    `expiry` DATETIME NULL,
    `logo` VARCHAR(255) NULL,
    `color` VARCHAR(8) NULL,
    `last_updated_channel` DATETIME(3) NULL,
    `last_updated_movie` DATETIME(3) NULL,
    `last_updated_series` DATETIME(3) NULL,
    `active_channels` INT NOT NULL DEFAULT 0,
    `active_movies` INT NOT NULL DEFAULT 0,
    `active_series` INT NOT NULL DEFAULT 0,
    `synced_at` DATETIME(3) NULL,
    `is_orphaned` TINYINT(1) NOT NULL DEFAULT 0,
    `orphaned_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `idx_playlists_is_orphaned` (`is_orphaned`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. LIVE CHANNELS & CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `channels_categories` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_channels_cat_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_channels_cat_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `channels` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `epg` VARCHAR(255) NULL,
    `shift` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `number` INT NOT NULL DEFAULT 0,
    `image` TEXT NULL,
    `url` VARCHAR(12500) NOT NULL DEFAULT '',
    `catchup` INT NOT NULL DEFAULT -1,
    `is_type_moved` BOOLEAN NOT NULL DEFAULT FALSE,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_channels_category` (`list_id`, `category_id`),
    KEY `idx_channels_epg` (`epg`),
    KEY `idx_channels_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_channels_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. MOVIES / VOD & CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `vods_categories` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_vods_cat_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_vods_cat_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `vods` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `image` TEXT NULL,
    `tmdb` INT NULL,
    `rating` DOUBLE NULL,
    `url` VARCHAR(12500) NOT NULL DEFAULT '',
    `is_type_moved` BOOLEAN NOT NULL DEFAULT FALSE,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_vods_category` (`list_id`, `category_id`),
    KEY `idx_vods_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_vods_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. TV SERIES, SEASONS & EPISODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `series_categories` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_series_cat_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_series_cat_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `series` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `position` INT NOT NULL DEFAULT 0,
    `image` TEXT NULL,
    `tmdb` INT NULL,
    `rating` DOUBLE NULL,
    `cast` VARCHAR(255) NULL,
    `director` VARCHAR(255) NULL,
    `genre` VARCHAR(255) NULL,
    `release_date` VARCHAR(255) NULL,
    `youtube_trailer` VARCHAR(255) NULL,
    `episode_run_time` VARCHAR(255) NULL,
    `finished` BOOLEAN NOT NULL DEFAULT FALSE,
    `url` LONGTEXT NULL,
    `episode_updated` DATETIME(3) NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_series_category` (`list_id`, `category_id`),
    KEY `idx_series_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_series_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `series_episodes` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` BIGINT UNSIGNED NOT NULL,
    `series_id` BIGINT UNSIGNED NOT NULL DEFAULT 0,
    `name` VARCHAR(255) NOT NULL DEFAULT '',
    `season` INT NOT NULL DEFAULT 0,
    `episode` INT NOT NULL DEFAULT 0,
    `url` VARCHAR(12500) NOT NULL DEFAULT '',
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`list_id`, `id`),
    KEY `idx_episodes_series` (`list_id`, `series_id`, `season`, `episode`),
    KEY `idx_series_episodes_last_seen` (`list_id`, `last_seen_at`),
    CONSTRAINT `fk_series_episodes_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. ELECTRONIC PROGRAM GUIDE (EPG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `epg_programmes` (
    `id` VARCHAR(255) NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `stop` DATETIME(3) NOT NULL,
    `title` TEXT NULL,
    `description` LONGTEXT NULL,
    `sub_title` VARCHAR(255) NULL,
    `icon` VARCHAR(500) NULL,
    `categories` LONGTEXT NULL,
    `actors` LONGTEXT NULL,
    `directors` LONGTEXT NULL,
    `producers` LONGTEXT NULL,
    `writers` LONGTEXT NULL,
    `season` INT NULL,
    `episode` INT NULL,
    `rating` VARCHAR(50) NULL,
    `live` BOOLEAN NOT NULL DEFAULT FALSE,
    `new` BOOLEAN NOT NULL DEFAULT FALSE,
    `release_date` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`, `start`),
    KEY `idx_epg_stop` (`id`, `stop`),
    KEY `idx_epg_programmes_stop` (`stop`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `epg_channels` (
    `id` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NULL,
    `lang` VARCHAR(50) NULL,
    `max_stop` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `epg_sync_state` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `settings_hash` VARCHAR(64) NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `epg_sync_state` (`id`, `settings_hash`) VALUES (1, NULL);

-- ============================================================================
-- 6. ADMINS & TEAM MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'collaborator',
    `manage_all_playlists` TINYINT(1) NOT NULL DEFAULT 1,
    `can_see_all_users` TINYINT(1) NOT NULL DEFAULT 1,
    `can_create_collaborators` TINYINT(1) NOT NULL DEFAULT 0,
    `can_create_admins` TINYINT(1) NOT NULL DEFAULT 0,
    `can_manage_api_tokens` TINYINT(1) NOT NULL DEFAULT 0,
    `created_by` INT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_playlists` (
    `admin_id` INT NOT NULL,
    `playlist_id` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`admin_id`, `playlist_id`),
    KEY `idx_team_playlists_playlist` (`playlist_id`),
    CONSTRAINT `fk_team_playlists_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_team_playlists_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. MANAGED CUSTOMERS / USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `managed_users` (
    `list_id` BIGINT UNSIGNED NOT NULL,
    `id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `expiry` DATETIME NULL,
    `channels_categories` JSON NULL,
    `vods_categories` JSON NULL,
    `series_categories` JSON NULL,
    `m3u` VARCHAR(50) NOT NULL,
    `epg` VARCHAR(50) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `patterns` JSON NOT NULL,
    `note` VARCHAR(1000) NULL,
    `language` VARCHAR(255) NULL,
    `message` VARCHAR(255) NULL,
    `max_connections` SMALLINT DEFAULT 1 NULL,
    `sync_expiry_date` TINYINT(1) DEFAULT 1 NULL,
    `user_settings` JSON NULL,
    `created_by_admin_id` INT NULL,
    `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
    `is_compromised` TINYINT(1) NOT NULL DEFAULT 0,
    `compromised_reason` VARCHAR(255) NULL,
    `compromised_at` DATETIME NULL,
    `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`list_id`, `id`),
    CONSTRAINT `customers_epg_key` UNIQUE (`epg`),
    CONSTRAINT `customers_m3u_key` UNIQUE (`m3u`),
    CONSTRAINT `customers_username_key` UNIQUE (`username`),
    CONSTRAINT `chk_managed_users_m3u_epg_diff` CHECK (`m3u` <> `epg`),
    CONSTRAINT `fk_managed_users_playlist` FOREIGN KEY (`list_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE,
    KEY `customers_list_id_idx` (`list_id`),
    KEY `customers_username_password_idx` (`username`, `password`),
    KEY `idx_managed_users_created_by` (`created_by_admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. PLAYLIST SYNC LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `playlist_sync_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `playlist_id` BIGINT UNSIGNED NULL,
    `playlist_name` VARCHAR(255) NOT NULL DEFAULT '',
    `sync_type` VARCHAR(50) NOT NULL DEFAULT 'playlist',
    `status` VARCHAR(50) NOT NULL DEFAULT 'success',
    `channels_count` INT NOT NULL DEFAULT 0,
    `movies_count` INT NOT NULL DEFAULT 0,
    `series_count` INT NOT NULL DEFAULT 0,
    `episodes_count` INT NOT NULL DEFAULT 0,
    `epg_count` INT NOT NULL DEFAULT 0,
    `message` TEXT NULL,
    `details` LONGTEXT NULL,
    `duration_ms` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    KEY `idx_sync_logs_playlist_created` (`playlist_id`, `created_at`),
    KEY `idx_sync_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS `system_settings` (
    `id` INT PRIMARY KEY DEFAULT 1,
    `iptveditor_api_token` VARCHAR(255) NULL,
    `playlist_sync_interval_hours` INT NOT NULL DEFAULT 6,
    `playlist_sync_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `expiry_sync_interval_hours` INT NOT NULL DEFAULT 12,
    `expiry_sync_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `expiry_sync_all` TINYINT(1) NOT NULL DEFAULT 0,
    `expiry_sync_days_range` INT NOT NULL DEFAULT 5,
    `backup_interval_hours` INT NOT NULL DEFAULT 24,
    `backup_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `backup_retention_days` INT NOT NULL DEFAULT 30,
    `tracking_timeout_minutes` INT NOT NULL DEFAULT 10,
    `throttle_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `throttle_router_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `throttle_router_limit` INT NOT NULL DEFAULT 30,
    `throttle_router_window_seconds` INT NOT NULL DEFAULT 10,
    `throttle_m3u_epg_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `throttle_m3u_epg_limit` INT NOT NULL DEFAULT 18,
    `throttle_m3u_epg_window_seconds` INT NOT NULL DEFAULT 300,
    `throttle_xtream_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `throttle_xtream_limit` INT NOT NULL DEFAULT 40,
    `throttle_xtream_window_seconds` INT NOT NULL DEFAULT 20,
    `throttle_stalker_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `throttle_stalker_limit` INT NOT NULL DEFAULT 60,
    `throttle_stalker_window_seconds` INT NOT NULL DEFAULT 60,
    `antibruteforce_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `antibruteforce_max_attempts` INT NOT NULL DEFAULT 5,
    `antibruteforce_window_minutes` INT NOT NULL DEFAULT 15,
    `antibruteforce_ban_hours` INT NOT NULL DEFAULT 24,
    `security_log_retention_days` INT NOT NULL DEFAULT 7,
    `multi_ip_detection_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `multi_ip_max_subnets` INT NOT NULL DEFAULT 10,
    `multi_ip_window_hours` INT NOT NULL DEFAULT 2,
    `multi_ip_auto_suspend` TINYINT(1) NOT NULL DEFAULT 1,
    `user_dashboard_enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `user_dashboard_title` VARCHAR(255) NOT NULL DEFAULT 'Client Portal',
    `user_dashboard_allow_hide_categories` TINYINT(1) NOT NULL DEFAULT 1,
    `user_dashboard_html` MEDIUMTEXT NULL,
    `user_dashboard_logo` MEDIUMTEXT NULL,
    `user_dashboard_primary_color` VARCHAR(32) NOT NULL DEFAULT '#3b82f6',
    `user_dashboard_secondary_color` VARCHAR(32) NOT NULL DEFAULT '#6366f1',
    `user_dashboard_accent_color` VARCHAR(32) NOT NULL DEFAULT '#10b981',
    `user_dashboard_background_theme` VARCHAR(32) NOT NULL DEFAULT 'slate',
    `epg_max_days` INT NOT NULL DEFAULT 4,
    `ssl_on_demand_enabled` TINYINT(1) NOT NULL DEFAULT 0,
    `additional_ssl_domains` TEXT NULL,
    `license_suspended` TINYINT(1) NOT NULL DEFAULT 0,
    `license_suspended_at` DATETIME(3) NULL,
    `license_upgrade_url` VARCHAR(512) NOT NULL DEFAULT '',
    `last_playlist_sync` DATETIME NULL,
    `last_expiry_sync` DATETIME NULL,
    `last_backup` DATETIME NULL,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `system_settings` (
    `id`,
    `playlist_sync_interval_hours`,
    `playlist_sync_enabled`,
    `expiry_sync_interval_hours`,
    `expiry_sync_enabled`,
    `expiry_sync_all`,
    `expiry_sync_days_range`,
    `backup_interval_hours`,
    `backup_enabled`,
    `backup_retention_days`,
    `tracking_timeout_minutes`,
    `throttle_enabled`,
    `throttle_router_enabled`,
    `throttle_router_limit`,
    `throttle_router_window_seconds`,
    `throttle_m3u_epg_enabled`,
    `throttle_m3u_epg_limit`,
    `throttle_m3u_epg_window_seconds`,
    `throttle_xtream_enabled`,
    `throttle_xtream_limit`,
    `throttle_xtream_window_seconds`,
    `throttle_stalker_enabled`,
    `throttle_stalker_limit`,
    `throttle_stalker_window_seconds`,
    `antibruteforce_enabled`,
    `antibruteforce_max_attempts`,
    `antibruteforce_window_minutes`,
    `antibruteforce_ban_hours`,
    `security_log_retention_days`,
    `multi_ip_detection_enabled`,
    `multi_ip_max_subnets`,
    `multi_ip_window_hours`,
    `multi_ip_auto_suspend`,
    `user_dashboard_enabled`,
    `user_dashboard_title`,
    `user_dashboard_allow_hide_categories`,
    `user_dashboard_primary_color`,
    `user_dashboard_secondary_color`,
    `user_dashboard_accent_color`,
    `user_dashboard_background_theme`,
    `epg_max_days`,
    `ssl_on_demand_enabled`
) VALUES (
    1, 6, 1, 12, 1, 0, 5, 24, 1, 30, 10, 1, 1, 30, 10, 1, 18, 300, 1, 40, 20, 0, 60, 60,
    1, 5, 15, 24, 7, 1, 10, 2, 1,
    1, 'Client Portal', 1, '#3b82f6', '#6366f1', '#10b981', 'slate', 4, 0
);

-- ============================================================================
-- 10. SECURITY & ANTI-BRUTE FORCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `security_ip_bans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `ip` VARCHAR(45) NOT NULL UNIQUE,
    `failed_attempts` INT NOT NULL DEFAULT 0,
    `is_blocked` TINYINT(1) NOT NULL DEFAULT 0,
    `blocked_reason` VARCHAR(255) NULL,
    `blocked_at` DATETIME NULL,
    `expires_at` DATETIME NULL,
    `last_attempt_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `unblocked_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_sec_ip_blocked` (`is_blocked`),
    KEY `idx_sec_ip_expires` (`expires_at`),
    KEY `idx_sec_ip_last_attempt` (`last_attempt_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `security_access_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `ip` VARCHAR(45) NOT NULL,
    `attempt_type` VARCHAR(50) NOT NULL,
    `username` VARCHAR(100) NULL,
    `success` TINYINT(1) NOT NULL DEFAULT 0,
    `reason` VARCHAR(255) NULL,
    `user_agent` VARCHAR(500) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_sec_logs_ip` (`ip`, `created_at`),
    KEY `idx_sec_logs_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `security_multi_ip_incidents` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL,
    `list_id` BIGINT UNSIGNED NOT NULL,
    `user_id` INT NOT NULL,
    `subnets_count` INT NOT NULL,
    `subnets_list` JSON NOT NULL,
    `trigger_endpoint` VARCHAR(50) NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `detected_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` VARCHAR(20) NOT NULL DEFAULT 'suspended',
    `resolved_at` DATETIME NULL,
    `resolved_by` VARCHAR(50) NULL,
    KEY `idx_incidents_user` (`username`, `detected_at`),
    KEY `idx_incidents_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. API TOKENS (THIRD PARTY ACCESS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `api_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL UNIQUE,
    `token_prefix` VARCHAR(64) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `has_password` TINYINT(1) NOT NULL DEFAULT 0,
    `allowed_ips` TEXT NULL,
    `allowed_playlist_ids` TEXT NULL,
    `last_used_at` DATETIME NULL,
    `expires_at` DATETIME NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_api_tokens_admin` (`admin_id`),
    KEY `idx_api_tokens_hash` (`token_hash`),
    CONSTRAINT `fk_api_tokens_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. TRIGGERS (UNIQUE USER SHORT TOKENS INTEGRITY)
-- ============================================================================

DROP TRIGGER IF EXISTS `trg_managed_users_tokens_insert`;
DELIMITER $$
CREATE TRIGGER `trg_managed_users_tokens_insert`
BEFORE INSERT ON `managed_users`
FOR EACH ROW
BEGIN
    IF NEW.m3u = NEW.epg THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M3U and EPG tokens cannot be identical';
    END IF;
    IF EXISTS (SELECT 1 FROM `managed_users` WHERE m3u = NEW.m3u OR epg = NEW.m3u) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M3U token is already in use by another user as M3U or EPG';
    END IF;
    IF EXISTS (SELECT 1 FROM `managed_users` WHERE m3u = NEW.epg OR epg = NEW.epg) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EPG token is already in use by another user as M3U or EPG';
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_managed_users_tokens_update`;
DELIMITER $$
CREATE TRIGGER `trg_managed_users_tokens_update`
BEFORE UPDATE ON `managed_users`
FOR EACH ROW
BEGIN
    IF NEW.m3u = NEW.epg THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M3U and EPG tokens cannot be identical';
    END IF;
    IF NEW.m3u <> OLD.m3u THEN
        IF EXISTS (
            SELECT 1 FROM `managed_users`
            WHERE (m3u = NEW.m3u OR epg = NEW.m3u)
              AND NOT (list_id = NEW.list_id AND id = NEW.id)
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M3U token is already in use by another user as M3U or EPG';
        END IF;
    END IF;
    IF NEW.epg <> OLD.epg THEN
        IF EXISTS (
            SELECT 1 FROM `managed_users`
            WHERE (m3u = NEW.epg OR epg = NEW.epg)
              AND NOT (list_id = NEW.list_id AND id = NEW.id)
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'EPG token is already in use by another user as M3U or EPG';
        END IF;
    END IF;
END$$
DELIMITER ;
