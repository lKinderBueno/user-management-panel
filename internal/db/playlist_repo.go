package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/util"
)

// PlaylistTimestamps holds the update timestamps of a playlist from the database.
type PlaylistTimestamps struct {
	ID                 uint64
	LastUpdatedChannel *time.Time
	LastUpdatedMovie   *time.Time
	LastUpdatedSeries  *time.Time
}

// PlaylistRepo provides access to playlist database operations.
type PlaylistRepo struct {
	db *sql.DB
}

// NewPlaylistRepo creates a new PlaylistRepo.
func NewPlaylistRepo(db *sql.DB) *PlaylistRepo {
	return &PlaylistRepo{db: db}
}

// GetPlaylistTimestamps retrieves the last updated timestamps for a playlist by ID.
// If the playlist does not exist, returns nil, nil.
func (r *PlaylistRepo) GetPlaylistTimestamps(ctx context.Context, id uint64) (*PlaylistTimestamps, error) {
	query := `
		SELECT id, last_updated_channel, last_updated_movie, last_updated_series
		FROM playlists
		WHERE id = ?
	`
	row := r.db.QueryRowContext(ctx, query, id)

	var res PlaylistTimestamps
	var lastChannel, lastMovie, lastSeries sql.NullTime

	if err := row.Scan(&res.ID, &lastChannel, &lastMovie, &lastSeries); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if lastChannel.Valid {
		res.LastUpdatedChannel = &lastChannel.Time
	}
	if lastMovie.Valid {
		res.LastUpdatedMovie = &lastMovie.Time
	}
	if lastSeries.Valid {
		res.LastUpdatedSeries = &lastSeries.Time
	}

	return &res, nil
}

// UpsertPlaylist inserts or updates a playlist record in MariaDB without overwriting content timestamps.
// The content timestamps (last_updated_channel, last_updated_movie, last_updated_series) are updated
// only after the corresponding streams have been completely and successfully downloaded.
func (r *PlaylistRepo) UpsertPlaylist(ctx context.Context, p client.Playlist) error {
	query := `
		INSERT INTO playlists (
			id, name, position, message, language, use_provider_movie_info,
			epg_days, tvg_id, gzip, epg_dummy, max_connections, limit_max_connections,
			allow_tracking, time_shift, patterns, welcome_info, cname, expiry,
			logo, color, last_updated_channel, last_updated_movie, last_updated_series,
			active_channels, active_movies, active_series,
			synced_at
		) VALUES (
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?,
			?
		)
		ON DUPLICATE KEY UPDATE
			name = VALUES(name),
			position = VALUES(position),
			message = VALUES(message),
			language = VALUES(language),
			use_provider_movie_info = VALUES(use_provider_movie_info),
			epg_days = VALUES(epg_days),
			tvg_id = VALUES(tvg_id),
			gzip = VALUES(gzip),
			epg_dummy = VALUES(epg_dummy),
			max_connections = VALUES(max_connections),
			time_shift = VALUES(time_shift),
			patterns = VALUES(patterns),
			expiry = VALUES(expiry),
			logo = VALUES(logo),
			color = VALUES(color),
			active_channels = VALUES(active_channels),
			active_movies = VALUES(active_movies),
			active_series = VALUES(active_series),
			synced_at = VALUES(synced_at),
			is_orphaned = 0,
			orphaned_at = NULL
	`

	var patternsStr *string
	if len(p.Patterns) > 0 && string(p.Patterns) != "null" {
		s := string(p.Patterns)
		patternsStr = &s
	}

	var welcomeStr *string
	if len(p.WelcomeInfo) > 0 && string(p.WelcomeInfo) != "null" {
		s := string(p.WelcomeInfo)
		welcomeStr = &s
	}

	var cleanCname *string
	if p.Cname != nil {
		hosts := util.NormalizeCnameList(*p.Cname)
		if len(hosts) > 0 {
			s := strings.Join(hosts, ", ")
			cleanCname = &s
		}
	}

	now := time.Now()

	_, err := r.db.ExecContext(ctx, query,
		p.ID.Uint64(), p.Name, p.Position.Int(), p.Message, p.Language, p.UseProviderMovieInfo.Bool(),
		p.EpgDays.Int(), p.TvgID.Bool(), p.Gzip.Bool(), p.EpgDummy, p.MaxConnections.Int(), p.LimitMaxConnections.Bool(),
		p.AllowTracking.Bool(), p.TimeShift.Float64(), patternsStr, welcomeStr, cleanCname, p.Expiry.ToTimePtr(),
		p.Logo, p.Color, nil, nil, nil,
		p.ActiveChannels.Int(), p.GetActiveMovies(), p.ActiveSeries.Int(),
		now,
	)

	return err
}

// UpdateChannelTimestamp updates last_updated_channel for a playlist after successful channel sync.
func (r *PlaylistRepo) UpdateChannelTimestamp(ctx context.Context, listID uint64, t time.Time) error {
	query := `UPDATE playlists SET last_updated_channel = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, t, listID)
	return err
}

// UpdateMovieTimestamp updates last_updated_movie for a playlist after successful VOD sync.
func (r *PlaylistRepo) UpdateMovieTimestamp(ctx context.Context, listID uint64, t time.Time) error {
	query := `UPDATE playlists SET last_updated_movie = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, t, listID)
	return err
}

// UpdateSeriesTimestamp updates last_updated_series for a playlist after successful series sync.
func (r *PlaylistRepo) UpdateSeriesTimestamp(ctx context.Context, listID uint64, t time.Time) error {
	query := `UPDATE playlists SET last_updated_series = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, t, listID)
	return err
}

// EnsureSchema applies schema migrations for orphaned playlists safely.
func (r *PlaylistRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS is_orphaned TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS orphaned_at DATETIME(3) NULL`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS tracking_timeout_minutes INT NOT NULL DEFAULT 10`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS portal_branding MEDIUMTEXT NULL`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS enforce_cname TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS cname_ssl TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE playlists MODIFY COLUMN cname TEXT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_playlists_is_orphaned ON playlists (is_orphaned)`,
	}
	for _, q := range queries {
		_, _ = r.db.ExecContext(ctx, q)
	}
	return nil
}

// PlaylistSummary contains summary info for syncer orphaned detection.
type PlaylistSummary struct {
	ID                uint64
	Name              string
	ManagedUsersCount int
	IsOrphaned        bool
}

// GetAllPlaylistsWithUserCount returns all playlists currently in DB with their managed users count.
func (r *PlaylistRepo) GetAllPlaylistsWithUserCount(ctx context.Context) ([]PlaylistSummary, error) {
	query := `
		SELECT 
			p.id, 
			p.name, 
			COALESCE(mu.total_users, 0) as managed_users_count,
			COALESCE(p.is_orphaned, 0) as is_orphaned
		FROM playlists p
		LEFT JOIN (
			SELECT list_id, COUNT(*) as total_users 
			FROM managed_users 
			GROUP BY list_id
		) mu ON p.id = mu.list_id
		ORDER BY p.id ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []PlaylistSummary
	for rows.Next() {
		var s PlaylistSummary
		var isOrphaned int
		if err := rows.Scan(&s.ID, &s.Name, &s.ManagedUsersCount, &isOrphaned); err != nil {
			return nil, err
		}
		s.IsOrphaned = isOrphaned != 0
		list = append(list, s)
	}
	return list, nil
}

// GetPlaylistSummary returns summary info for a single playlist by ID.
func (r *PlaylistRepo) GetPlaylistSummary(ctx context.Context, id uint64) (*PlaylistSummary, error) {
	query := `
		SELECT 
			p.id, 
			p.name, 
			(SELECT COUNT(*) FROM managed_users WHERE list_id = p.id) as managed_users_count,
			COALESCE(p.is_orphaned, 0) as is_orphaned
		FROM playlists p
		WHERE p.id = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, id)
	var s PlaylistSummary
	var isOrphaned int
	if err := row.Scan(&s.ID, &s.Name, &s.ManagedUsersCount, &isOrphaned); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	s.IsOrphaned = isOrphaned != 0
	return &s, nil
}

// MarkOrphaned updates the is_orphaned flag and timestamp for a playlist.
func (r *PlaylistRepo) MarkOrphaned(ctx context.Context, id uint64, orphaned bool) error {
	orphanedVal := 0
	if orphaned {
		orphanedVal = 1
	}
	query := `
		UPDATE playlists 
		SET is_orphaned = ?, orphaned_at = CASE WHEN ? = 1 THEN NOW(3) ELSE NULL END 
		WHERE id = ?
	`
	_, err := r.db.ExecContext(ctx, query, orphanedVal, orphanedVal, id)
	return err
}

// DeletePlaylist removes a playlist and all cascaded child records from MariaDB.
func (r *PlaylistRepo) DeletePlaylist(ctx context.Context, id uint64) error {
	query := `DELETE FROM playlists WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// ResetAllTimestamps resets last_updated_channel, last_updated_movie, and last_updated_series to NULL for all playlists.
func (r *PlaylistRepo) ResetAllTimestamps(ctx context.Context) error {
	query := `UPDATE playlists SET last_updated_channel = NULL, last_updated_movie = NULL, last_updated_series = NULL`
	_, err := r.db.ExecContext(ctx, query)
	return err
}

