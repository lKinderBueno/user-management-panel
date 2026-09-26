package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/util"
)

type PlaylistRepo struct {
	db *sql.DB
}

func NewPlaylistRepo(db *sql.DB) *PlaylistRepo {
	repo := &PlaylistRepo{db: db}
	_ = repo.EnsureSchema(context.Background())
	return repo
}

// DB returns the underlying database handle.
func (r *PlaylistRepo) DB() *sql.DB {
	return r.db
}

// EnsureSchema idempotently guarantees playlist columns exist
func (r *PlaylistRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS portal_branding MEDIUMTEXT NULL`,
		`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS enforce_cname TINYINT(1) NOT NULL DEFAULT 0`,
	}
	for _, q := range queries {
		_, _ = r.db.ExecContext(ctx, q)
	}

	// Clean up legacy cname entries that contain http:// or https:// or trailing slashes
	rows, err := r.db.QueryContext(ctx, "SELECT id, cname FROM playlists WHERE cname LIKE '%://%' OR cname LIKE '%/%'")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id uint64
			var rawCname string
			if err := rows.Scan(&id, &rawCname); err == nil {
				hosts := util.NormalizeHostList(rawCname)
				var cleanVal *string
				if len(hosts) > 0 {
					s := strings.Join(hosts, ", ")
					cleanVal = &s
				}
				_, _ = r.db.ExecContext(ctx, "UPDATE playlists SET cname = ? WHERE id = ?", cleanVal, id)
			}
		}
	}

	return nil
}

func (r *PlaylistRepo) GetAll(ctx context.Context) ([]models.Playlist, error) {
	query := `
		SELECT 
			p.id, 
			p.name, 
			p.message, 
			p.language, 
			COALESCE(p.patterns, '[]'), 
			p.active_channels, 
			p.active_movies, 
			p.active_series,
			COALESCE(mu.total_users, 0) as managed_users_count,
			p.synced_at,
			p.last_updated_channel,
			p.last_updated_movie,
			p.last_updated_series,
			COALESCE(p.is_orphaned, 0) as is_orphaned,
			p.orphaned_at,
			COALESCE(p.allow_tracking, 0) as allow_tracking,
			COALESCE(p.limit_max_connections, 0) as limit_max_connections,
			COALESCE(p.max_connections, 1) as max_connections,
			COALESCE(p.tracking_timeout_minutes, 10) as tracking_timeout_minutes,
			COALESCE(p.welcome_info, '{}') as welcome_info,
			COALESCE(p.portal_branding, '{}') as portal_branding,
			COALESCE(p.cname, '') as cname,
			COALESCE(p.enforce_cname, 0) as enforce_cname,
			COALESCE(p.cname_ssl, 0) as cname_ssl
		FROM playlists p
		LEFT JOIN (
			SELECT list_id, COUNT(*) as total_users 
			FROM managed_users 
			GROUP BY list_id
		) mu ON p.id = mu.list_id
		ORDER BY p.position ASC, p.name ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query playlists: %w", err)
	}
	defer rows.Close()

	var playlists []models.Playlist
	for rows.Next() {
		var p models.Playlist
		var patternsStr, welcomeInfoStr, portalBrandingStr, cnameStr string
		var syncedAt, lastChan, lastMov, lastSer, orphanedAt sql.NullTime
		var isOrphaned, allowTracking, limitMaxConn, maxConn, trackingTimeout, enforceCname, cnameSSL int
		err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Message,
			&p.Language,
			&patternsStr,
			&p.ActiveChannels,
			&p.ActiveMovies,
			&p.ActiveSeries,
			&p.ManagedUsersCount,
			&syncedAt,
			&lastChan,
			&lastMov,
			&lastSer,
			&isOrphaned,
			&orphanedAt,
			&allowTracking,
			&limitMaxConn,
			&maxConn,
			&trackingTimeout,
			&welcomeInfoStr,
			&portalBrandingStr,
			&cnameStr,
			&enforceCname,
			&cnameSSL,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning playlist row: %w", err)
		}
		p.Patterns = []byte(patternsStr)
		if welcomeInfoStr != "" && welcomeInfoStr != "{}" && welcomeInfoStr != "null" {
			p.WelcomeInfo = []byte(welcomeInfoStr)
		}
		if portalBrandingStr != "" && portalBrandingStr != "{}" && portalBrandingStr != "null" {
			p.PortalBranding = []byte(portalBrandingStr)
		}
		p.CName = cnameStr
		p.EnforceCname = enforceCname != 0
		p.CnameSSL = cnameSSL != 0
		if syncedAt.Valid {
			p.SyncedAt = &syncedAt.Time
		}
		if lastChan.Valid {
			p.LastUpdatedChannel = &lastChan.Time
		}
		if lastMov.Valid {
			p.LastUpdatedMovie = &lastMov.Time
		}
		if lastSer.Valid {
			p.LastUpdatedSeries = &lastSer.Time
		}
		p.IsOrphaned = isOrphaned != 0
		if orphanedAt.Valid {
			p.OrphanedAt = &orphanedAt.Time
		}
		p.AllowTracking = allowTracking != 0
		p.LimitMaxConnections = limitMaxConn != 0
		p.MaxConnections = maxConn
		p.TrackingTimeoutMinutes = trackingTimeout
		playlists = append(playlists, p)
	}
	if playlists == nil {
		playlists = []models.Playlist{}
	}
	return playlists, nil
}

func (r *PlaylistRepo) GetForAdmin(ctx context.Context, admin *models.Admin) ([]models.Playlist, error) {
	if admin == nil || admin.Role == "admin" || (admin.ManageAllPlaylists && admin.CanSeeAllUsers) {
		return r.GetAll(ctx)
	}

	if !admin.ManageAllPlaylists && len(admin.AllowedPlaylistIDs) == 0 {
		return []models.Playlist{}, nil
	}

	var args []interface{}
	var userSubquery string
	if !admin.CanSeeAllUsers {
		userSubquery = `SELECT list_id, COUNT(*) as total_users FROM managed_users WHERE created_by_admin_id = ? GROUP BY list_id`
		args = append(args, admin.ID)
	} else {
		userSubquery = `SELECT list_id, COUNT(*) as total_users FROM managed_users GROUP BY list_id`
	}

	var playlistFilter string
	if !admin.ManageAllPlaylists {
		placeholders := make([]string, len(admin.AllowedPlaylistIDs))
		for i, pid := range admin.AllowedPlaylistIDs {
			placeholders[i] = "?"
			args = append(args, pid)
		}
		playlistFilter = fmt.Sprintf("WHERE p.id IN (%s)", strings.Join(placeholders, ","))
	}

	query := fmt.Sprintf(`
		SELECT 
			p.id, 
			p.name, 
			p.message, 
			p.language, 
			COALESCE(p.patterns, '[]'), 
			p.active_channels, 
			p.active_movies, 
			p.active_series,
			COALESCE(mu.total_users, 0) as managed_users_count,
			p.synced_at,
			p.last_updated_channel,
			p.last_updated_movie,
			p.last_updated_series,
			COALESCE(p.is_orphaned, 0) as is_orphaned,
			p.orphaned_at,
			COALESCE(p.allow_tracking, 0) as allow_tracking,
			COALESCE(p.limit_max_connections, 0) as limit_max_connections,
			COALESCE(p.max_connections, 1) as max_connections,
			COALESCE(p.tracking_timeout_minutes, 10) as tracking_timeout_minutes,
			COALESCE(p.welcome_info, '{}') as welcome_info,
			COALESCE(p.portal_branding, '{}') as portal_branding,
			COALESCE(p.cname, '') as cname,
			COALESCE(p.enforce_cname, 0) as enforce_cname,
			COALESCE(p.cname_ssl, 0) as cname_ssl
		FROM playlists p
		LEFT JOIN (%s) mu ON p.id = mu.list_id
		%s
		ORDER BY p.position ASC, p.name ASC
	`, userSubquery, playlistFilter)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query playlists for admin: %w", err)
	}
	defer rows.Close()

	var playlists []models.Playlist
	for rows.Next() {
		var p models.Playlist
		var patternsStr, welcomeInfoStr, portalBrandingStr, cnameStr string
		var syncedAt, lastChan, lastMov, lastSer, orphanedAt sql.NullTime
		var isOrphaned, allowTracking, limitMaxConn, maxConn, trackingTimeout, enforceCname, cnameSSL int
		err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Message,
			&p.Language,
			&patternsStr,
			&p.ActiveChannels,
			&p.ActiveMovies,
			&p.ActiveSeries,
			&p.ManagedUsersCount,
			&syncedAt,
			&lastChan,
			&lastMov,
			&lastSer,
			&isOrphaned,
			&orphanedAt,
			&allowTracking,
			&limitMaxConn,
			&maxConn,
			&trackingTimeout,
			&welcomeInfoStr,
			&portalBrandingStr,
			&cnameStr,
			&enforceCname,
			&cnameSSL,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning playlist row: %w", err)
		}
		p.Patterns = []byte(patternsStr)
		if welcomeInfoStr != "" && welcomeInfoStr != "{}" && welcomeInfoStr != "null" {
			p.WelcomeInfo = []byte(welcomeInfoStr)
		}
		if portalBrandingStr != "" && portalBrandingStr != "{}" && portalBrandingStr != "null" {
			p.PortalBranding = []byte(portalBrandingStr)
		}
		p.CName = cnameStr
		p.EnforceCname = enforceCname != 0
		p.CnameSSL = cnameSSL != 0
		if syncedAt.Valid {
			p.SyncedAt = &syncedAt.Time
		}
		if lastChan.Valid {
			p.LastUpdatedChannel = &lastChan.Time
		}
		if lastMov.Valid {
			p.LastUpdatedMovie = &lastMov.Time
		}
		if lastSer.Valid {
			p.LastUpdatedSeries = &lastSer.Time
		}
		p.IsOrphaned = isOrphaned != 0
		if orphanedAt.Valid {
			p.OrphanedAt = &orphanedAt.Time
		}
		p.AllowTracking = allowTracking != 0
		p.LimitMaxConnections = limitMaxConn != 0
		p.MaxConnections = maxConn
		p.TrackingTimeoutMinutes = trackingTimeout
		playlists = append(playlists, p)
	}
	if playlists == nil {
		playlists = []models.Playlist{}
	}
	return playlists, nil
}

func (r *PlaylistRepo) GetByIDForAdmin(ctx context.Context, listID uint64, admin *models.Admin) (*models.Playlist, error) {
	var userCountQuery string
	var args []interface{}
	if admin != nil && !admin.CanSeeAllUsers {
		userCountQuery = `(SELECT COUNT(*) FROM managed_users WHERE list_id = p.id AND created_by_admin_id = ?)`
		args = []interface{}{admin.ID, listID}
	} else {
		userCountQuery = `(SELECT COUNT(*) FROM managed_users WHERE list_id = p.id)`
		args = []interface{}{listID}
	}

	query := fmt.Sprintf(`
		SELECT 
			p.id, 
			p.name, 
			p.message, 
			p.language, 
			COALESCE(p.patterns, '[]'), 
			p.active_channels, 
			p.active_movies, 
			p.active_series, 
			%s as managed_users_count,
			p.synced_at,
			p.last_updated_channel,
			p.last_updated_movie,
			p.last_updated_series,
			COALESCE(p.is_orphaned, 0) as is_orphaned,
			p.orphaned_at,
			COALESCE(p.allow_tracking, 0) as allow_tracking,
			COALESCE(p.limit_max_connections, 0) as limit_max_connections,
			COALESCE(p.max_connections, 1) as max_connections,
			COALESCE(p.tracking_timeout_minutes, 10) as tracking_timeout_minutes,
			COALESCE(p.welcome_info, '{}') as welcome_info,
			COALESCE(p.portal_branding, '{}') as portal_branding,
			COALESCE(p.cname, '') as cname,
			COALESCE(p.enforce_cname, 0) as enforce_cname,
			COALESCE(p.cname_ssl, 0) as cname_ssl
		FROM playlists p
		WHERE p.id = ?
		LIMIT 1
	`, userCountQuery)

	row := r.db.QueryRowContext(ctx, query, args...)

	var p models.Playlist
	var patternsStr, welcomeInfoStr, portalBrandingStr, cnameStr string
	var syncedAt, lastChan, lastMov, lastSer, orphanedAt sql.NullTime
	var isOrphaned, allowTracking, limitMaxConn, maxConn, trackingTimeout, enforceCname, cnameSSL int
	err := row.Scan(
		&p.ID,
		&p.Name,
		&p.Message,
		&p.Language,
		&patternsStr,
		&p.ActiveChannels,
		&p.ActiveMovies,
		&p.ActiveSeries,
		&p.ManagedUsersCount,
		&syncedAt,
		&lastChan,
		&lastMov,
		&lastSer,
		&isOrphaned,
		&orphanedAt,
		&allowTracking,
		&limitMaxConn,
		&maxConn,
		&trackingTimeout,
		&welcomeInfoStr,
		&portalBrandingStr,
		&cnameStr,
		&enforceCname,
		&cnameSSL,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed querying playlist: %w", err)
	}
	p.Patterns = []byte(patternsStr)
	if welcomeInfoStr != "" && welcomeInfoStr != "{}" && welcomeInfoStr != "null" {
		p.WelcomeInfo = []byte(welcomeInfoStr)
	}
	if portalBrandingStr != "" && portalBrandingStr != "{}" && portalBrandingStr != "null" {
		p.PortalBranding = []byte(portalBrandingStr)
	}
	p.CName = cnameStr
	p.EnforceCname = enforceCname != 0
	p.CnameSSL = cnameSSL != 0
	if syncedAt.Valid {
		p.SyncedAt = &syncedAt.Time
	}
	if lastChan.Valid {
		p.LastUpdatedChannel = &lastChan.Time
	}
	if lastMov.Valid {
		p.LastUpdatedMovie = &lastMov.Time
	}
	if lastSer.Valid {
		p.LastUpdatedSeries = &lastSer.Time
	}
	p.IsOrphaned = isOrphaned != 0
	if orphanedAt.Valid {
		p.OrphanedAt = &orphanedAt.Time
	}
	p.AllowTracking = allowTracking != 0
	p.LimitMaxConnections = limitMaxConn != 0
	p.MaxConnections = maxConn
	p.TrackingTimeoutMinutes = trackingTimeout
	return &p, nil
}

func (r *PlaylistRepo) GetByID(ctx context.Context, listID uint64) (*models.Playlist, error) {
	query := `
		SELECT 
			p.id, 
			p.name, 
			p.message, 
			p.language, 
			COALESCE(p.patterns, '[]'), 
			p.active_channels, 
			p.active_movies, 
			p.active_series, 
			(SELECT COUNT(*) FROM managed_users WHERE list_id = p.id) as managed_users_count,
			p.synced_at,
			p.last_updated_channel,
			p.last_updated_movie,
			p.last_updated_series,
			COALESCE(p.is_orphaned, 0) as is_orphaned,
			p.orphaned_at,
			COALESCE(p.allow_tracking, 0) as allow_tracking,
			COALESCE(p.limit_max_connections, 0) as limit_max_connections,
			COALESCE(p.max_connections, 1) as max_connections,
			COALESCE(p.tracking_timeout_minutes, 10) as tracking_timeout_minutes,
			COALESCE(p.welcome_info, '{}') as welcome_info,
			COALESCE(p.portal_branding, '{}') as portal_branding,
			COALESCE(p.cname, '') as cname,
			COALESCE(p.enforce_cname, 0) as enforce_cname,
			COALESCE(p.cname_ssl, 0) as cname_ssl
		FROM playlists p
		WHERE p.id = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, listID)

	var p models.Playlist
	var patternsStr, welcomeInfoStr, portalBrandingStr, cnameStr string
	var syncedAt, lastChan, lastMov, lastSer, orphanedAt sql.NullTime
	var isOrphaned, allowTracking, limitMaxConn, maxConn, trackingTimeout, enforceCname, cnameSSL int
	err := row.Scan(
		&p.ID,
		&p.Name,
		&p.Message,
		&p.Language,
		&patternsStr,
		&p.ActiveChannels,
		&p.ActiveMovies,
		&p.ActiveSeries,
		&p.ManagedUsersCount,
		&syncedAt,
		&lastChan,
		&lastMov,
		&lastSer,
		&isOrphaned,
		&orphanedAt,
		&allowTracking,
		&limitMaxConn,
		&maxConn,
		&trackingTimeout,
		&welcomeInfoStr,
		&portalBrandingStr,
		&cnameStr,
		&enforceCname,
		&cnameSSL,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed querying playlist: %w", err)
	}
	p.Patterns = []byte(patternsStr)
	if welcomeInfoStr != "" && welcomeInfoStr != "{}" && welcomeInfoStr != "null" {
		p.WelcomeInfo = []byte(welcomeInfoStr)
	}
	if portalBrandingStr != "" && portalBrandingStr != "{}" && portalBrandingStr != "null" {
		p.PortalBranding = []byte(portalBrandingStr)
	}
	p.CName = cnameStr
	p.EnforceCname = enforceCname != 0
	p.CnameSSL = cnameSSL != 0
	if syncedAt.Valid {
		p.SyncedAt = &syncedAt.Time
	}
	if lastChan.Valid {
		p.LastUpdatedChannel = &lastChan.Time
	}
	if lastMov.Valid {
		p.LastUpdatedMovie = &lastMov.Time
	}
	if lastSer.Valid {
		p.LastUpdatedSeries = &lastSer.Time
	}
	p.IsOrphaned = isOrphaned != 0
	if orphanedAt.Valid {
		p.OrphanedAt = &orphanedAt.Time
	}
	p.AllowTracking = allowTracking != 0
	p.LimitMaxConnections = limitMaxConn != 0
	p.MaxConnections = maxConn
	p.TrackingTimeoutMinutes = trackingTimeout
	return &p, nil
}

// UpdatePortalBranding updates the portal_branding JSON for a playlist.
func (r *PlaylistRepo) UpdatePortalBranding(ctx context.Context, listID uint64, branding json.RawMessage) error {
	var val *string
	if len(branding) > 0 && string(branding) != "null" && string(branding) != "{}" {
		s := string(branding)
		val = &s
	}
	query := "UPDATE playlists SET portal_branding = ? WHERE id = ?"
	_, err := r.db.ExecContext(ctx, query, val, listID)
	return err
}

// UpdateWelcomeInfo updates the welcome_info JSON for a playlist.
func (r *PlaylistRepo) UpdateWelcomeInfo(ctx context.Context, listID uint64, welcomeInfo json.RawMessage) error {
	var val *string
	if len(welcomeInfo) > 0 && string(welcomeInfo) != "null" && string(welcomeInfo) != "{}" {
		s := string(welcomeInfo)
		val = &s
	}
	query := "UPDATE playlists SET welcome_info = ? WHERE id = ?"
	_, err := r.db.ExecContext(ctx, query, val, listID)
	return err
}

func (r *PlaylistRepo) GetCategories(ctx context.Context, listID uint64) (channels, vods, series []models.Category, err error) {
	// 1. Channels Categories
	cRows, err := r.db.QueryContext(ctx, "SELECT id, name, position FROM channels_categories WHERE list_id = ? ORDER BY position ASC, name ASC", listID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed querying channels categories: %w", err)
	}
	defer cRows.Close()
	for cRows.Next() {
		var c models.Category
		if err := cRows.Scan(&c.ID, &c.Name, &c.Position); err == nil {
			channels = append(channels, c)
		}
	}

	// 2. VODs Categories
	vRows, err := r.db.QueryContext(ctx, "SELECT id, name, position FROM vods_categories WHERE list_id = ? ORDER BY position ASC, name ASC", listID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed querying vods categories: %w", err)
	}
	defer vRows.Close()
	for vRows.Next() {
		var c models.Category
		if err := vRows.Scan(&c.ID, &c.Name, &c.Position); err == nil {
			vods = append(vods, c)
		}
	}

	// 3. Series Categories
	sRows, err := r.db.QueryContext(ctx, "SELECT id, name, position FROM series_categories WHERE list_id = ? ORDER BY position ASC, name ASC", listID)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed querying series categories: %w", err)
	}
	defer sRows.Close()
	for sRows.Next() {
		var c models.Category
		if err := sRows.Scan(&c.ID, &c.Name, &c.Position); err == nil {
			series = append(series, c)
		}
	}

	return channels, vods, series, nil
}

// UpdatePatterns updates the patterns JSON stored in playlists table.
func (r *PlaylistRepo) UpdatePatterns(ctx context.Context, listID uint64, patterns []byte) error {
	pStr := string(patterns)
	if pStr == "" {
		pStr = "[]"
	}
	_, err := r.db.ExecContext(ctx, "UPDATE playlists SET patterns = ? WHERE id = ?", pStr, listID)
	return err
}

// DeletePlaylist removes a playlist and all cascaded records from MariaDB.
func (r *PlaylistRepo) DeletePlaylist(ctx context.Context, listID uint64) error {
	query := `DELETE FROM playlists WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, listID)
	return err
}

// UpdateSettings updates tracking, connection limit, cname, enforcement, and ssl settings on a playlist.
func (r *PlaylistRepo) UpdateSettings(
	ctx context.Context,
	listID uint64,
	allowTracking *bool,
	limitMaxConnections *bool,
	maxConnections *int,
	trackingTimeoutMinutes *int,
	cname *string,
	enforceCname *bool,
	cnameSSL *bool,
) error {
	query := `
		UPDATE playlists
		SET 
			allow_tracking = COALESCE(?, allow_tracking),
			limit_max_connections = COALESCE(?, limit_max_connections),
			max_connections = COALESCE(?, max_connections),
			tracking_timeout_minutes = COALESCE(?, tracking_timeout_minutes),
			cname = CASE WHEN ? = 1 THEN ? ELSE cname END,
			enforce_cname = COALESCE(?, enforce_cname),
			cname_ssl = COALESCE(?, cname_ssl),
			updated_at = NOW()
		WHERE id = ?
	`
	var atVal, lmcVal, mcVal, ttmVal interface{}
	if allowTracking != nil {
		atVal = *allowTracking
	}
	if limitMaxConnections != nil {
		lmcVal = *limitMaxConnections
	}
	if maxConnections != nil {
		mcVal = *maxConnections
	}
	if trackingTimeoutMinutes != nil {
		ttmVal = *trackingTimeoutMinutes
	}

	cnameProvided := 0
	var cnameVal *string
	if cname != nil {
		cnameProvided = 1
		hosts := util.NormalizeCnameList(*cname)
		if len(hosts) > 0 {
			normalized := strings.Join(hosts, ", ")
			cnameVal = &normalized
		}
	}

	var enfVal interface{}
	if enforceCname != nil {
		if *enforceCname {
			enfVal = 1
		} else {
			enfVal = 0
		}
	}

	var sslVal interface{}
	if cnameSSL != nil {
		if *cnameSSL {
			sslVal = 1
		} else {
			sslVal = 0
		}
	}

	_, err := r.db.ExecContext(ctx, query, atVal, lmcVal, mcVal, ttmVal, cnameProvided, cnameVal, enfVal, sslVal, listID)
	if err != nil {
		return fmt.Errorf("failed updating playlist settings: %w", err)
	}
	return nil
}

