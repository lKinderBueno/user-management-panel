package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

type SecurityRepo struct {
	db *sql.DB
}

func NewSecurityRepo(db *sql.DB) *SecurityRepo {
	return &SecurityRepo{db: db}
}

// EnsureSchema applies schema migrations for security and anti-brute-force tables idempotently.
func (r *SecurityRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS security_ip_bans (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			ip VARCHAR(45) NOT NULL UNIQUE,
			failed_attempts INT NOT NULL DEFAULT 0,
			is_blocked TINYINT(1) NOT NULL DEFAULT 0,
			blocked_reason VARCHAR(255) NULL,
			blocked_at DATETIME NULL,
			expires_at DATETIME NULL,
			last_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			unblocked_at DATETIME NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			KEY idx_sec_ip_blocked (is_blocked),
			KEY idx_sec_ip_expires (expires_at),
			KEY idx_sec_ip_last_attempt (last_attempt_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		`CREATE TABLE IF NOT EXISTS security_access_logs (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			ip VARCHAR(45) NOT NULL,
			attempt_type VARCHAR(50) NOT NULL,
			username VARCHAR(100) NULL,
			success TINYINT(1) NOT NULL DEFAULT 0,
			reason VARCHAR(255) NULL,
			user_agent VARCHAR(500) NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			KEY idx_sec_logs_ip (ip, created_at),
			KEY idx_sec_logs_created (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_max_attempts INT NOT NULL DEFAULT 5`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_window_minutes INT NOT NULL DEFAULT 15`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS antibruteforce_ban_hours INT NOT NULL DEFAULT 24`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_detection_enabled TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_max_subnets INT NOT NULL DEFAULT 10`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_window_hours INT NOT NULL DEFAULT 2`,
		`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS multi_ip_auto_suspend TINYINT(1) NOT NULL DEFAULT 1`,

		`CREATE TABLE IF NOT EXISTS security_multi_ip_incidents (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
			username VARCHAR(100) NOT NULL,
			list_id BIGINT UNSIGNED NOT NULL,
			user_id INT NOT NULL,
			subnets_count INT NOT NULL,
			subnets_list JSON NOT NULL,
			trigger_endpoint VARCHAR(50) NOT NULL,
			user_agent VARCHAR(500) NULL,
			detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			status VARCHAR(20) NOT NULL DEFAULT 'suspended',
			resolved_at DATETIME NULL,
			resolved_by VARCHAR(50) NULL,
			KEY idx_incidents_user (username, detected_at),
			KEY idx_incidents_status (status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

		`ALTER TABLE security_multi_ip_incidents ADD COLUMN IF NOT EXISTS raw_ips JSON NULL`,

		`ALTER TABLE managed_users ADD COLUMN IF NOT EXISTS is_suspended TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE managed_users ADD COLUMN IF NOT EXISTS is_compromised TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE managed_users ADD COLUMN IF NOT EXISTS compromised_reason VARCHAR(255) NULL`,
		`ALTER TABLE managed_users ADD COLUMN IF NOT EXISTS compromised_at DATETIME NULL`,
	}

	for _, q := range queries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			log.Printf("[WARN] EnsureSchema security_repo warning: %v", err)
		}
	}

	return nil
}

// GetActiveBlockedIPs returns a map of all currently blocked IPs with their expiration time (or zero time if permanent).
func (r *SecurityRepo) GetActiveBlockedIPs(ctx context.Context) (map[string]time.Time, error) {
	query := `SELECT ip, expires_at FROM security_ip_bans 
		WHERE is_blocked = 1 AND (expires_at IS NULL OR expires_at > NOW())`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed querying active blocked ips: %w", err)
	}
	defer rows.Close()

	res := make(map[string]time.Time)
	for rows.Next() {
		var ip string
		var expiresAt sql.NullTime
		if err := rows.Scan(&ip, &expiresAt); err != nil {
			continue
		}
		if expiresAt.Valid {
			res[ip] = expiresAt.Time
		} else {
			res[ip] = time.Time{} // permanent until manual unblock
		}
	}

	return res, rows.Err()
}

// GetTrackedIPs lists tracked IPs with search, filtering and pagination.
func (r *SecurityRepo) GetTrackedIPs(ctx context.Context, search, statusFilter string, limit, offset int) ([]models.TrackedIP, int, error) {
	where := []string{"1=1"}
	var args []interface{}

	if search != "" {
		where = append(where, "(ip LIKE ? OR blocked_reason LIKE ?)")
		args = append(args, "%"+search+"%", "%"+search+"%")
	}

	now := time.Now()
	if statusFilter == "blocked" {
		where = append(where, "is_blocked = 1 AND (expires_at IS NULL OR expires_at > ?)")
		args = append(args, now)
	} else if statusFilter == "active" {
		where = append(where, "(is_blocked = 0 OR (is_blocked = 1 AND expires_at <= ?))")
		args = append(args, now)
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	countQuery := "SELECT COUNT(*) FROM security_ip_bans WHERE " + whereClause
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed counting tracked ips: %w", err)
	}

	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	selectQuery := fmt.Sprintf(`SELECT id, ip, failed_attempts, is_blocked, blocked_reason, 
		blocked_at, expires_at, last_attempt_at, unblocked_at, created_at, updated_at 
		FROM security_ip_bans WHERE %s 
		ORDER BY is_blocked DESC, last_attempt_at DESC LIMIT ? OFFSET ?`, whereClause)

	selectArgs := append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, selectQuery, selectArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed fetching tracked ips: %w", err)
	}
	defer rows.Close()

	var list []models.TrackedIP
	for rows.Next() {
		var item models.TrackedIP
		var blockedReason sql.NullString
		var blockedAt, expiresAt, unblockedAt sql.NullTime

		err := rows.Scan(
			&item.ID,
			&item.IP,
			&item.FailedAttempts,
			&item.IsBlocked,
			&blockedReason,
			&blockedAt,
			&expiresAt,
			&item.LastAttemptAt,
			&unblockedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed scanning tracked ip: %w", err)
		}

		if blockedReason.Valid {
			item.BlockedReason = blockedReason.String
		}
		if blockedAt.Valid {
			item.BlockedAt = &blockedAt.Time
		}
		if expiresAt.Valid {
			item.ExpiresAt = &expiresAt.Time
		}
		if unblockedAt.Valid {
			item.UnblockedAt = &unblockedAt.Time
		}

		// Adjust isBlocked if expired
		if item.IsBlocked && item.ExpiresAt != nil && item.ExpiresAt.Before(time.Now()) {
			item.IsBlocked = false
		}

		list = append(list, item)
	}

	return list, total, rows.Err()
}

// RecordFailedAttempt increments attempts for the IP and checks if threshold is exceeded.
func (r *SecurityRepo) RecordFailedAttempt(
	ctx context.Context,
	ip, attemptType, username, reason, userAgent string,
	effectiveAttempts, maxAttempts, windowMinutes, banHours int,
	shouldLogAudit, shouldBlock bool,
) (bool, error) {
	now := time.Now()

	// 1. Audit log entry (if not throttled)
	if shouldLogAudit {
		_, _ = r.db.ExecContext(ctx, `INSERT INTO security_access_logs 
			(ip, attempt_type, username, success, reason, user_agent, created_at) 
			VALUES (?, ?, ?, 0, ?, ?, ?)`,
			ip, attemptType, username, reason, userAgent, now,
		)
	}

	// 2. Fetch or initialize tracked record
	var currentAttempts int
	var isBlocked bool
	var lastAttempt time.Time
	var expiresAt sql.NullTime

	query := `SELECT failed_attempts, is_blocked, last_attempt_at, expires_at FROM security_ip_bans WHERE ip = ?`
	err := r.db.QueryRowContext(ctx, query, ip).Scan(&currentAttempts, &isBlocked, &lastAttempt, &expiresAt)

	if err != nil && err != sql.ErrNoRows {
		return false, fmt.Errorf("failed querying ip ban record: %w", err)
	}

	// If already blocked and ban has not expired, remain blocked
	if isBlocked && (!expiresAt.Valid || expiresAt.Time.After(now)) {
		_, _ = r.db.ExecContext(ctx, `UPDATE security_ip_bans SET last_attempt_at = ? WHERE ip = ?`, now, ip)
		return true, nil
	}

	newAttempts := effectiveAttempts
	if newAttempts <= 0 {
		newAttempts = 1
	}

	var newExpiresAt *time.Time
	if shouldBlock && banHours > 0 {
		exp := now.Add(time.Duration(banHours) * time.Hour)
		newExpiresAt = &exp
	}

	blockedReason := BuildBlockedReason(newAttempts, attemptType, reason)

	if err == sql.ErrNoRows {
		// Insert new record
		_, err = r.db.ExecContext(ctx, `INSERT INTO security_ip_bans 
			(ip, failed_attempts, is_blocked, blocked_reason, blocked_at, expires_at, last_attempt_at, created_at) 
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			ip,
			newAttempts,
			shouldBlock,
			func() interface{} {
				if shouldBlock {
					return blockedReason
				}
				return nil
			}(),
			func() interface{} {
				if shouldBlock {
					return now
				}
				return nil
			}(),
			newExpiresAt,
			now,
			now,
		)
	} else {
		// Update existing record
		if shouldBlock {
			_, err = r.db.ExecContext(ctx, `UPDATE security_ip_bans SET 
				failed_attempts = ?, is_blocked = 1, blocked_reason = ?, blocked_at = ?, expires_at = ?, last_attempt_at = ?, unblocked_at = NULL 
				WHERE ip = ?`,
				newAttempts, blockedReason, now, newExpiresAt, now, ip,
			)
		} else {
			_, err = r.db.ExecContext(ctx, `UPDATE security_ip_bans SET 
				failed_attempts = ?, last_attempt_at = ? 
				WHERE ip = ?`,
				newAttempts, now, ip,
			)
		}
	}

	if err != nil {
		return false, fmt.Errorf("failed updating security ip record: %w", err)
	}

	return shouldBlock, nil
}

// RecordSuccess logs a successful attempt and clears transient failed attempts if the IP was not blocked.
func (r *SecurityRepo) RecordSuccess(ctx context.Context, ip, attemptType, username, userAgent string, logToAudit, hadAttempts bool) error {
	now := time.Now()

	// Audit log entry only if requested (e.g. logins or explicit audit trail)
	if logToAudit {
		_, _ = r.db.ExecContext(ctx, `INSERT INTO security_access_logs 
			(ip, attempt_type, username, success, reason, user_agent, created_at) 
			VALUES (?, ?, ?, 1, 'success', ?, ?)`,
			ip, attemptType, username, userAgent, now,
		)
	}

	// Reset attempts only if had attempts and not currently blocked
	if hadAttempts {
		_, err := r.db.ExecContext(ctx, `UPDATE security_ip_bans SET failed_attempts = 0, blocked_reason = NULL WHERE ip = ? AND is_blocked = 0`, ip)
		return err
	}
	return nil
}

// BlockIP manually blocks an IP address with a reason and duration.
func (r *SecurityRepo) BlockIP(ctx context.Context, ip, reason string, durationHours int) error {
	now := time.Now()
	var expiresAt *time.Time
	if durationHours > 0 {
		exp := now.Add(time.Duration(durationHours) * time.Hour)
		expiresAt = &exp
	}

	if reason == "" {
		reason = "Blocked manually by administrator"
	}

	query := `INSERT INTO security_ip_bans 
		(ip, failed_attempts, is_blocked, blocked_reason, blocked_at, expires_at, last_attempt_at, created_at) 
		VALUES (?, 0, 1, ?, ?, ?, ?, ?) 
		ON DUPLICATE KEY UPDATE 
			is_blocked = 1, 
			blocked_reason = VALUES(blocked_reason), 
			blocked_at = VALUES(blocked_at), 
			expires_at = VALUES(expires_at), 
			unblocked_at = NULL, 
			last_attempt_at = VALUES(last_attempt_at)`

	_, err := r.db.ExecContext(ctx, query, ip, reason, now, expiresAt, now, now)
	return err
}

// UnblockIP removes the ban on an IP and resets attempts.
func (r *SecurityRepo) UnblockIP(ctx context.Context, ip string) error {
	now := time.Now()
	query := `UPDATE security_ip_bans SET 
		is_blocked = 0, 
		failed_attempts = 0, 
		blocked_reason = NULL, 
		unblocked_at = ?, 
		expires_at = NULL 
		WHERE ip = ?`

	_, err := r.db.ExecContext(ctx, query, now, ip)
	return err
}

// ResetAttempts clears failed attempts for an IP without changing its block status.
func (r *SecurityRepo) ResetAttempts(ctx context.Context, ip string) error {
	query := `UPDATE security_ip_bans SET failed_attempts = 0, blocked_reason = CASE WHEN is_blocked = 0 THEN NULL ELSE blocked_reason END WHERE ip = ?`
	_, err := r.db.ExecContext(ctx, query, ip)
	return err
}

// DeleteIP deletes the tracked IP entry from the database.
func (r *SecurityRepo) DeleteIP(ctx context.Context, ip string) error {
	query := `DELETE FROM security_ip_bans WHERE ip = ?`
	_, err := r.db.ExecContext(ctx, query, ip)
	return err
}

// GetRecentLogs retrieves the most recent security access attempts.
func (r *SecurityRepo) GetRecentLogs(ctx context.Context, limit int, ipFilter, typeFilter string) ([]models.SecurityAccessLog, error) {
	if limit <= 0 {
		limit = 100
	}

	where := []string{"1=1"}
	var args []interface{}
	if ipFilter != "" {
		where = append(where, "ip = ?")
		args = append(args, ipFilter)
	}
	if typeFilter != "" {
		if typeFilter == "admin" {
			where = append(where, "attempt_type = 'admin_login'")
		} else if typeFilter == "xtream" {
			where = append(where, "attempt_type IN ('xtream_auth', 'stream_auth', 'short_url', 'stalker_auth')")
		} else if typeFilter == "api" || typeFilter == "api_token" {
			where = append(where, "attempt_type = 'api_token'")
		} else {
			where = append(where, "attempt_type = ?")
			args = append(args, typeFilter)
		}
	}

	whereClause := strings.Join(where, " AND ")
	query := fmt.Sprintf(`SELECT id, ip, attempt_type, username, success, reason, user_agent, created_at 
		FROM security_access_logs 
		WHERE %s 
		ORDER BY created_at DESC LIMIT ?`, whereClause)

	args = append(args, limit)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying security access logs: %w", err)
	}
	defer rows.Close()

	var logs []models.SecurityAccessLog
	for rows.Next() {
		var l models.SecurityAccessLog
		var username, reason, userAgent sql.NullString
		if err := rows.Scan(&l.ID, &l.IP, &l.AttemptType, &username, &l.Success, &reason, &userAgent, &l.CreatedAt); err != nil {
			continue
		}
		if username.Valid {
			l.Username = username.String
		}
		if reason.Valid {
			l.Reason = reason.String
		}
		if userAgent.Valid {
			l.UserAgent = userAgent.String
		}
		logs = append(logs, l)
	}

	return logs, rows.Err()
}

// GetStats returns aggregate counts for the security dashboard.
func (r *SecurityRepo) GetStats(ctx context.Context) (*models.SecurityStats, error) {
	now := time.Now()
	stats := &models.SecurityStats{}

	// Total currently blocked
	queryBlocked := `SELECT COUNT(*) FROM security_ip_bans WHERE is_blocked = 1 AND (expires_at IS NULL OR expires_at > ?)`
	_ = r.db.QueryRowContext(ctx, queryBlocked, now).Scan(&stats.TotalBlocked)

	// Total tracked
	queryTracked := `SELECT COUNT(*) FROM security_ip_bans`
	_ = r.db.QueryRowContext(ctx, queryTracked).Scan(&stats.TotalTracked)

	// Attempts in last 24h
	yesterday := now.Add(-24 * time.Hour)
	queryAttempts := `SELECT COUNT(*) FROM security_access_logs WHERE created_at >= ?`
	_ = r.db.QueryRowContext(ctx, queryAttempts, yesterday).Scan(&stats.AttemptsLast24h)

	queryAdminAttempts := `SELECT COUNT(*) FROM security_access_logs WHERE created_at >= ? AND attempt_type = 'admin_login'`
	_ = r.db.QueryRowContext(ctx, queryAdminAttempts, yesterday).Scan(&stats.AdminAttemptsLast24h)

	queryXtreamAttempts := `SELECT COUNT(*) FROM security_access_logs WHERE created_at >= ? AND attempt_type IN ('xtream_auth', 'stream_auth', 'short_url', 'stalker_auth')`
	_ = r.db.QueryRowContext(ctx, queryXtreamAttempts, yesterday).Scan(&stats.XtreamAttemptsLast24h)

	queryCompromised := `SELECT COUNT(*) FROM managed_users WHERE is_compromised = 1 OR is_suspended = 1`
	_ = r.db.QueryRowContext(ctx, queryCompromised).Scan(&stats.CompromisedUsersCount)

	return stats, nil
}

// CleanOldLogs deletes security access logs older than retentionDays days.
func (r *SecurityRepo) CleanOldLogs(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 7
	}
	query := `DELETE FROM security_access_logs WHERE created_at < NOW() - INTERVAL ? DAY`
	res, err := r.db.ExecContext(ctx, query, retentionDays)
	if err != nil {
		return 0, fmt.Errorf("failed deleting old security logs: %w", err)
	}
	return res.RowsAffected()
}

// FlushAllLogs empties all security access logs.
func (r *SecurityRepo) FlushAllLogs(ctx context.Context) (int64, error) {
	query := `DELETE FROM security_access_logs`
	res, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed flushing security logs: %w", err)
	}
	return res.RowsAffected()
}

// CleanOldBans deletes unblocked/expired IP ban entries older than retentionDays.
func (r *SecurityRepo) CleanOldBans(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 30
	}
	query := `DELETE FROM security_ip_bans WHERE is_blocked = 0 AND updated_at < NOW() - INTERVAL ? DAY`
	res, err := r.db.ExecContext(ctx, query, retentionDays)
	if err != nil {
		return 0, fmt.Errorf("failed deleting old unblocked ip bans: %w", err)
	}
	return res.RowsAffected()
}

// RecordMultiIPIncident inserts or updates a compromised account report and updates the user record if suspendUser is true.
func (r *SecurityRepo) RecordMultiIPIncident(ctx context.Context, inc *models.MultiIPIncident, suspendUser bool) error {
	subnetsJSON, err := json.Marshal(inc.SubnetsList)
	if err != nil {
		subnetsJSON = []byte("[]")
	}
	rawIPsJSON, err := json.Marshal(inc.RawIPs)
	if err != nil {
		rawIPsJSON = []byte("[]")
	}

	// Check if there is already an active (unresolved / suspended) incident for this user
	var existingID uint64
	checkQuery := `SELECT id FROM security_multi_ip_incidents WHERE username = ? AND status = 'suspended' ORDER BY id DESC LIMIT 1`
	err = r.db.QueryRowContext(ctx, checkQuery, inc.Username).Scan(&existingID)
	if err == nil && existingID > 0 {
		// Update existing incident with latest counts, subnets, and IPs
		updateQuery := `UPDATE security_multi_ip_incidents 
			SET subnets_count = ?, subnets_list = ?, raw_ips = ?, trigger_endpoint = ?, user_agent = ?, detected_at = NOW() 
			WHERE id = ?`
		_, err = r.db.ExecContext(ctx, updateQuery, inc.SubnetsCount, string(subnetsJSON), string(rawIPsJSON), inc.TriggerEndpoint, inc.UserAgent, existingID)
		if err != nil {
			return fmt.Errorf("failed updating existing multi-ip incident: %w", err)
		}
	} else {
		// Insert new incident
		query := `INSERT INTO security_multi_ip_incidents 
			(username, list_id, user_id, subnets_count, subnets_list, raw_ips, trigger_endpoint, user_agent, detected_at, status)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`
		_, err = r.db.ExecContext(ctx, query, inc.Username, inc.ListID, inc.UserID, inc.SubnetsCount, string(subnetsJSON), string(rawIPsJSON), inc.TriggerEndpoint, inc.UserAgent, inc.Status)
		if err != nil {
			return fmt.Errorf("failed inserting multi-ip incident: %w", err)
		}
	}

	if suspendUser {
		reason := fmt.Sprintf("Multi-IP leak detected: %d distinct subnets accessed via %s", inc.SubnetsCount, inc.TriggerEndpoint)
		uQuery := `UPDATE managed_users SET is_suspended = 1, is_compromised = 1, compromised_reason = ?, compromised_at = NOW() WHERE username = ?`
		if _, err := r.db.ExecContext(ctx, uQuery, reason, inc.Username); err != nil {
			log.Printf("[ERROR] Failed updating managed_users suspension for %s: %v", inc.Username, err)
		}
	}

	return nil
}

// GetMultiIPIncidents returns recorded multi-IP incidents with optional status filter.
func (r *SecurityRepo) GetMultiIPIncidents(ctx context.Context, limit int, statusFilter string) ([]models.MultiIPIncident, error) {
	if limit <= 0 {
		limit = 50
	}
	var args []interface{}
	where := ""
	if statusFilter != "" && statusFilter != "all" {
		where = " WHERE status = ?"
		args = append(args, statusFilter)
	}
	query := fmt.Sprintf(`SELECT id, username, list_id, user_id, subnets_count, subnets_list, raw_ips, trigger_endpoint, user_agent, detected_at, status, resolved_at, resolved_by
		FROM security_multi_ip_incidents%s ORDER BY detected_at DESC LIMIT ?`, where)
	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying multi-ip incidents: %w", err)
	}
	defer rows.Close()

	var list []models.MultiIPIncident
	for rows.Next() {
		var inc models.MultiIPIncident
		var rawSubnets, rawIPs sql.NullString
		var userAgent, resolvedBy sql.NullString
		var resolvedAt sql.NullTime
		if err := rows.Scan(&inc.ID, &inc.Username, &inc.ListID, &inc.UserID, &inc.SubnetsCount, &rawSubnets, &rawIPs, &inc.TriggerEndpoint, &userAgent, &inc.DetectedAt, &inc.Status, &resolvedAt, &resolvedBy); err != nil {
			continue
		}
		if userAgent.Valid {
			inc.UserAgent = userAgent.String
		}
		if resolvedBy.Valid {
			inc.ResolvedBy = &resolvedBy.String
		}
		if resolvedAt.Valid {
			inc.ResolvedAt = &resolvedAt.Time
		}
		if rawSubnets.Valid && rawSubnets.String != "" {
			_ = json.Unmarshal([]byte(rawSubnets.String), &inc.SubnetsList)
		}
		if inc.SubnetsList == nil {
			inc.SubnetsList = []string{}
		}
		if rawIPs.Valid && rawIPs.String != "" {
			_ = json.Unmarshal([]byte(rawIPs.String), &inc.RawIPs)
		}
		if inc.RawIPs == nil {
			inc.RawIPs = []string{}
		}
		list = append(list, inc)
	}
	return list, nil
}

// ResolveMultiIPIncident resolves an incident and unsuspends the associated user.
func (r *SecurityRepo) ResolveMultiIPIncident(ctx context.Context, incidentID uint64, resolvedBy string) error {
	var username string
	queryGet := `SELECT username FROM security_multi_ip_incidents WHERE id = ? LIMIT 1`
	if err := r.db.QueryRowContext(ctx, queryGet, incidentID).Scan(&username); err != nil {
		return fmt.Errorf("incident not found: %w", err)
	}

	queryUp := `UPDATE security_multi_ip_incidents SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE id = ?`
	if _, err := r.db.ExecContext(ctx, queryUp, resolvedBy, incidentID); err != nil {
		return fmt.Errorf("failed updating incident status: %w", err)
	}

	if username != "" {
		_ = r.UnsuspendUser(ctx, username)
	}
	return nil
}

// UnsuspendUser resets the compromised flag and restores user status in managed_users.
func (r *SecurityRepo) UnsuspendUser(ctx context.Context, username string) error {
	query := `UPDATE managed_users SET is_suspended = 0, is_compromised = 0, compromised_reason = NULL, compromised_at = NULL WHERE username = ?`
	_, err := r.db.ExecContext(ctx, query, username)
	if err != nil {
		return fmt.Errorf("failed unsuspending user %s: %w", username, err)
	}
	// Also mark open incidents for this user as resolved
	_, _ = r.db.ExecContext(ctx, `UPDATE security_multi_ip_incidents SET status = 'resolved', resolved_at = NOW(), resolved_by = 'admin' WHERE username = ? AND status != 'resolved'`, username)
	return nil
}

// GetCompromisedUsersCount returns the number of currently compromised or suspended users.
func (r *SecurityRepo) GetCompromisedUsersCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM managed_users WHERE is_compromised = 1 OR is_suspended = 1`
	var count int
	err := r.db.QueryRowContext(ctx, query).Scan(&count)
	return count, err
}

