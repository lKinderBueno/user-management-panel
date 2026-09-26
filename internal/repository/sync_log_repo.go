package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

// SyncLogRepo manages persistence and querying of playlist sync logs,
// with a strict 7-day retention policy.
type SyncLogRepo struct {
	db *sql.DB
}

func NewSyncLogRepo(db *sql.DB) *SyncLogRepo {
	return &SyncLogRepo{db: db}
}

// CreateSyncLog inserts a new sync log entry and optionally updates the playlist's synced_at timestamp.
func (r *SyncLogRepo) CreateSyncLog(ctx context.Context, l *models.SyncLog) error {
	query := `
		INSERT INTO playlist_sync_logs (
			playlist_id, playlist_name, sync_type, status,
			channels_count, movies_count, series_count, episodes_count, epg_count,
			message, details, duration_ms, created_at
		) VALUES (
			?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?
		)
	`

	createdAt := l.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now()
	}

	res, err := r.db.ExecContext(ctx, query,
		l.PlaylistID, l.PlaylistName, l.SyncType, l.Status,
		l.ChannelsCount, l.MoviesCount, l.SeriesCount, l.EpisodesCount, l.EpgCount,
		l.Message, l.Details, l.DurationMs, createdAt,
	)
	if err != nil {
		return fmt.Errorf("failed inserting sync log: %w", err)
	}

	id, err := res.LastInsertId()
	if err == nil {
		l.ID = uint64(id)
	}
	l.CreatedAt = createdAt

	// If linked to a specific playlist and sync was successful, touch synced_at in the playlists table
	if l.PlaylistID != nil && *l.PlaylistID > 0 && (l.Status == "success" || l.Status == "skipped") {
		_, _ = r.db.ExecContext(ctx, `UPDATE playlists SET synced_at = ? WHERE id = ?`, createdAt, *l.PlaylistID)
	}

	return nil
}

// GetLogsForPlaylist retrieves sync logs for a specific playlist within the last 7 days.
// Optionally includes global sync failures/events that affect all playlists.
func (r *SyncLogRepo) GetLogsForPlaylist(ctx context.Context, playlistID uint64, limit int, includeGlobal ...bool) ([]models.SyncLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	whereClause := "playlist_id = ?"
	if len(includeGlobal) > 0 && includeGlobal[0] {
		whereClause = "(playlist_id = ? OR (playlist_id IS NULL AND sync_type = 'all'))"
	}

	query := fmt.Sprintf(`
		SELECT id, playlist_id, playlist_name, sync_type, status,
		       channels_count, movies_count, series_count, episodes_count, epg_count,
		       COALESCE(message, ''), COALESCE(details, ''), duration_ms, created_at
		FROM playlist_sync_logs
		WHERE %s AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
		ORDER BY created_at DESC
		LIMIT ?
	`, whereClause)

	rows, err := r.db.QueryContext(ctx, query, playlistID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed querying sync logs for playlist %d: %w", playlistID, err)
	}
	defer rows.Close()

	return r.scanLogs(rows)
}

// GetAllLogs retrieves all sync logs within the last 7 days, scoped by admin permissions if subadmin.
func (r *SyncLogRepo) GetAllLogs(ctx context.Context, admin *models.Admin, limit int) ([]models.SyncLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var args []interface{}
	var whereClause string

	if admin != nil && admin.Role != "admin" && !admin.ManageAllPlaylists {
		if len(admin.AllowedPlaylistIDs) == 0 {
			return []models.SyncLog{}, nil
		}
		placeholders := make([]string, len(admin.AllowedPlaylistIDs))
		for i, pid := range admin.AllowedPlaylistIDs {
			placeholders[i] = "?"
			args = append(args, pid)
		}
		whereClause = fmt.Sprintf("AND (playlist_id IN (%s) OR playlist_id IS NULL)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`
		SELECT id, playlist_id, playlist_name, sync_type, status,
		       channels_count, movies_count, series_count, episodes_count, epg_count,
		       COALESCE(message, ''), COALESCE(details, ''), duration_ms, created_at
		FROM playlist_sync_logs
		WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) %s
		ORDER BY created_at DESC
		LIMIT ?
	`, whereClause)

	args = append(args, limit)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying all sync logs: %w", err)
	}
	defer rows.Close()

	return r.scanLogs(rows)
}

// GetLatestLogForPlaylist retrieves the most recent sync log within the last 7 days for a playlist.
func (r *SyncLogRepo) GetLatestLogForPlaylist(ctx context.Context, playlistID uint64) (*models.SyncLog, error) {
	logs, err := r.GetLogsForPlaylist(ctx, playlistID, 1)
	if err != nil {
		return nil, err
	}
	if len(logs) == 0 {
		return nil, nil
	}
	return &logs[0], nil
}

// CleanOldLogs deletes sync logs older than the given retention period (default 7 days).
func (r *SyncLogRepo) CleanOldLogs(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 7
	}

	query := `DELETE FROM playlist_sync_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`
	res, err := r.db.ExecContext(ctx, query, retentionDays)
	if err != nil {
		return 0, fmt.Errorf("failed cleaning old sync logs: %w", err)
	}

	affected, _ := res.RowsAffected()
	return affected, nil
}

func (r *SyncLogRepo) scanLogs(rows *sql.Rows) ([]models.SyncLog, error) {
	var logs []models.SyncLog
	for rows.Next() {
		var l models.SyncLog
		var pidStr sql.NullString
		err := rows.Scan(
			&l.ID,
			&pidStr,
			&l.PlaylistName,
			&l.SyncType,
			&l.Status,
			&l.ChannelsCount,
			&l.MoviesCount,
			&l.SeriesCount,
			&l.EpisodesCount,
			&l.EpgCount,
			&l.Message,
			&l.Details,
			&l.DurationMs,
			&l.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning sync log row: %w", err)
		}
		if pidStr.Valid && pidStr.String != "" {
			if u, err := strconv.ParseUint(pidStr.String, 10, 64); err == nil {
				l.PlaylistID = &u
			}
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []models.SyncLog{}
	}
	return logs, nil
}
