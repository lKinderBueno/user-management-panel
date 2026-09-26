package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/client"
)

// StreamRepo provides methods to persist categories and streams.
type StreamRepo struct {
	db *sql.DB
}

// NewStreamRepo creates a new StreamRepo.
func NewStreamRepo(db *sql.DB) *StreamRepo {
	return &StreamRepo{db: db}
}

// EnsureSchema idempotently guarantees last_seen_at columns and indexes exist on all content tables.
func (r *StreamRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE channels ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_channels_last_seen ON channels (list_id, last_seen_at)`,
		`ALTER TABLE vods ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_vods_last_seen ON vods (list_id, last_seen_at)`,
		`ALTER TABLE series ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_series_last_seen ON series (list_id, last_seen_at)`,
		`ALTER TABLE series_episodes ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_series_episodes_last_seen ON series_episodes (list_id, last_seen_at)`,
		`ALTER TABLE channels_categories ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_channels_cat_last_seen ON channels_categories (list_id, last_seen_at)`,
		`ALTER TABLE vods_categories ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_vods_cat_last_seen ON vods_categories (list_id, last_seen_at)`,
		`ALTER TABLE series_categories ADD COLUMN IF NOT EXISTS last_seen_at DATETIME(3) NULL`,
		`CREATE INDEX IF NOT EXISTS idx_series_cat_last_seen ON series_categories (list_id, last_seen_at)`,
	}
	for _, q := range queries {
		_, _ = r.db.ExecContext(ctx, q)
	}
	return nil
}

// SaveCategories inserts or updates categories for the given listID and table, tagging them with the sync timestamp.
func (r *StreamRepo) SaveCategories(ctx context.Context, listID uint64, tableName string, categories []client.Category, syncTime ...time.Time) error {
	if len(categories) == 0 {
		return nil
	}

	validTables := map[string]bool{
		"channels_categories": true,
		"vods_categories":     true,
		"series_categories":   true,
	}
	if !validTables[tableName] {
		return fmt.Errorf("invalid categories table name: %s", tableName)
	}

	seenAt := time.Now().UTC().Truncate(time.Millisecond)
	if len(syncTime) > 0 && !syncTime[0].IsZero() {
		seenAt = syncTime[0].Truncate(time.Millisecond)
	}

	const batchSize = 500
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(categories); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(categories) {
			end = len(categories)
		}
		chunk := categories[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*5)

		for _, cat := range chunk {
			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs, listID, cat.ID.Uint64(), cat.Name, cat.Position.Int(), seenAt)
		}

		query := fmt.Sprintf(`
			INSERT INTO %s (list_id, id, name, position, last_seen_at)
			VALUES %s
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				position = VALUES(position),
				last_seen_at = VALUES(last_seen_at)
		`, tableName, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving categories chunk into %s: %w", tableName, err)
		}

		if end < len(categories) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// SaveChannels inserts or updates live channels for the given playlist.
func (r *StreamRepo) SaveChannels(ctx context.Context, listID uint64, channels []client.Channel, syncTime ...time.Time) error {
	if len(channels) == 0 {
		return nil
	}

	seenAt := time.Now().UTC().Truncate(time.Millisecond)
	if len(syncTime) > 0 && !syncTime[0].IsZero() {
		seenAt = syncTime[0].Truncate(time.Millisecond)
	}

	const batchSize = 500
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(channels); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(channels) {
			end = len(channels)
		}
		chunk := channels[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*13)

		for _, ch := range chunk {
			var epgVal *string
			if ch.Epg != nil {
				trimmed := strings.TrimSpace(*ch.Epg)
				if trimmed != "" {
					epgVal = &trimmed
				}
			}

			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs,
				listID, ch.ID.Uint64(), ch.Category.Uint64(), ch.Name, ch.Position.Int(),
				epgVal, ch.Shift.Float64(), ch.Number.Int(), ch.Image, ch.Url,
				ch.Catchup.Int(), ch.IsTypeMoved.Bool(), seenAt,
			)
		}

		query := fmt.Sprintf(`
			INSERT INTO channels (
				list_id, id, category_id, name, position,
				epg, shift, number, image, url,
				catchup, is_type_moved, last_seen_at
			) VALUES %s
			ON DUPLICATE KEY UPDATE
				category_id = VALUES(category_id),
				name = VALUES(name),
				position = VALUES(position),
				epg = VALUES(epg),
				shift = VALUES(shift),
				number = VALUES(number),
				image = VALUES(image),
				url = VALUES(url),
				catchup = VALUES(catchup),
				is_type_moved = VALUES(is_type_moved),
				last_seen_at = VALUES(last_seen_at)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving channels chunk: %w", err)
		}

		if end < len(channels) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// SaveVods inserts or updates VOD streams for the given playlist.
func (r *StreamRepo) SaveVods(ctx context.Context, listID uint64, vods []client.Vod, syncTime ...time.Time) error {
	if len(vods) == 0 {
		return nil
	}

	seenAt := time.Now().UTC().Truncate(time.Millisecond)
	if len(syncTime) > 0 && !syncTime[0].IsZero() {
		seenAt = syncTime[0].Truncate(time.Millisecond)
	}

	const batchSize = 500
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(vods); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(vods) {
			end = len(vods)
		}
		chunk := vods[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*11)

		for _, v := range chunk {
			var tmdbVal *int
			if v.Tmdb != nil {
				n := v.Tmdb.Int()
				tmdbVal = &n
			}
			var ratingVal *float64
			if v.Rating != nil {
				n := v.Rating.Float64()
				ratingVal = &n
			}

			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs,
				listID, v.ID.Uint64(), v.Category.Uint64(), v.Name, v.Position.Int(),
				v.Image, tmdbVal, ratingVal, v.Url, v.IsTypeMoved.Bool(), seenAt,
			)
		}

		query := fmt.Sprintf(`
			INSERT INTO vods (
				list_id, id, category_id, name, position,
				image, tmdb, rating, url, is_type_moved,
				last_seen_at
			) VALUES %s
			ON DUPLICATE KEY UPDATE
				category_id = VALUES(category_id),
				name = VALUES(name),
				position = VALUES(position),
				image = VALUES(image),
				tmdb = VALUES(tmdb),
				rating = VALUES(rating),
				url = VALUES(url),
				is_type_moved = VALUES(is_type_moved),
				last_seen_at = VALUES(last_seen_at)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving vods chunk: %w", err)
		}

		if end < len(vods) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// SaveSeries inserts or updates TV series for the given playlist.
func (r *StreamRepo) SaveSeries(ctx context.Context, listID uint64, seriesList []client.Series, syncTime ...time.Time) error {
	if len(seriesList) == 0 {
		return nil
	}

	seenAt := time.Now().UTC().Truncate(time.Millisecond)
	if len(syncTime) > 0 && !syncTime[0].IsZero() {
		seenAt = syncTime[0].Truncate(time.Millisecond)
	}

	const batchSize = 400
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(seriesList); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(seriesList) {
			end = len(seriesList)
		}
		chunk := seriesList[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*18)

		for _, s := range chunk {
			var urlStr *string
			if len(s.Url) > 0 && string(s.Url) != "null" {
				str := string(s.Url)
				urlStr = &str
			}

			var tmdbVal *int
			if s.Tmdb != nil {
				n := s.Tmdb.Int()
				tmdbVal = &n
			}
			var ratingVal *float64
			if s.Rating != nil {
				n := s.Rating.Float64()
				ratingVal = &n
			}

			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs,
				listID, s.ID.Uint64(), s.Category.Uint64(), s.Name, s.Position.Int(),
				s.Image, tmdbVal, ratingVal, s.Cast, s.Director,
				s.Genre, s.ReleaseDate, s.YoutubeTrailer, s.EpisodeRunTime,
				s.Finished.Bool(), urlStr, s.EpisodeUpdated.ToTimePtr(), seenAt,
			)
		}

		query := fmt.Sprintf(`
			INSERT INTO series (
				list_id, id, category_id, name, position,
				image, tmdb, rating, cast, director,
				genre, release_date, youtube_trailer, episode_run_time,
				finished, url, episode_updated, last_seen_at
			) VALUES %s
			ON DUPLICATE KEY UPDATE
				category_id = VALUES(category_id),
				name = VALUES(name),
				position = VALUES(position),
				image = VALUES(image),
				tmdb = VALUES(tmdb),
				rating = VALUES(rating),
				cast = VALUES(cast),
				director = VALUES(director),
				genre = VALUES(genre),
				release_date = VALUES(release_date),
				youtube_trailer = VALUES(youtube_trailer),
				episode_run_time = VALUES(episode_run_time),
				finished = VALUES(finished),
				url = VALUES(url),
				episode_updated = VALUES(episode_updated),
				last_seen_at = VALUES(last_seen_at)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving series chunk: %w", err)
		}

		if end < len(seriesList) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// SaveSeriesEpisodes inserts or updates series episodes for the given playlist.
func (r *StreamRepo) SaveSeriesEpisodes(ctx context.Context, listID uint64, episodes []client.SeriesEpisode, syncTime ...time.Time) error {
	if len(episodes) == 0 {
		return nil
	}

	seenAt := time.Now().UTC().Truncate(time.Millisecond)
	if len(syncTime) > 0 && !syncTime[0].IsZero() {
		seenAt = syncTime[0].Truncate(time.Millisecond)
	}

	const batchSize = 500
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(episodes); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(episodes) {
			end = len(episodes)
		}
		chunk := episodes[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*8)

		for _, ep := range chunk {
			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs,
				listID, ep.ID.Uint64(), ep.Category.Uint64(), ep.Name, ep.Season.Int(),
				ep.Episode.Int(), ep.Url, seenAt,
			)
		}

		query := fmt.Sprintf(`
			INSERT INTO series_episodes (
				list_id, id, series_id, name, season,
				episode, url, last_seen_at
			) VALUES %s
			ON DUPLICATE KEY UPDATE
				series_id = VALUES(series_id),
				name = VALUES(name),
				season = VALUES(season),
				episode = VALUES(episode),
				url = VALUES(url),
				last_seen_at = VALUES(last_seen_at)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving series episodes chunk: %w", err)
		}

		if end < len(episodes) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// PruneObsoleteStreams deletes records for a playlist where last_seen_at is older than syncTime (or NULL) in batches.
// It throttles execution with a 10ms pause between batches to avoid lock contention and I/O spikes.
func (r *StreamRepo) PruneObsoleteStreams(ctx context.Context, listID uint64, tableName string, syncTime time.Time, batchSize ...int) (int64, error) {
	validTables := map[string]bool{
		"channels":            true,
		"vods":                true,
		"series":              true,
		"series_episodes":     true,
		"channels_categories": true,
		"vods_categories":     true,
		"series_categories":   true,
	}
	if !validTables[tableName] {
		return 0, fmt.Errorf("invalid streams table name for pruning: %s", tableName)
	}

	limit := 1000
	if len(batchSize) > 0 && batchSize[0] > 0 {
		limit = batchSize[0]
	}

	syncCutoff := syncTime.UTC().Truncate(time.Millisecond)

	query := fmt.Sprintf(`
		DELETE FROM %s
		WHERE list_id = ? AND (last_seen_at < ? OR last_seen_at IS NULL)
		LIMIT %d
	`, tableName, limit)

	var totalPruned int64
	for {
		select {
		case <-ctx.Done():
			return totalPruned, ctx.Err()
		default:
		}

		res, err := r.db.ExecContext(ctx, query, listID, syncCutoff)
		if err != nil {
			return totalPruned, fmt.Errorf("failed pruning obsolete batch from %s: %w", tableName, err)
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return totalPruned, err
		}

		totalPruned += affected
		if affected < int64(limit) {
			break
		}

		// Micro-pause between batches to prevent lock contention
		time.Sleep(10 * time.Millisecond)
	}

	return totalPruned, nil
}

// GetDistinctEpgIDsForPlaylists returns unique, non-empty EPG identifiers across the given playlists.
// If playlistIDs is empty, it returns distinct EPG identifiers across all channels in the database.
func (r *StreamRepo) GetDistinctEpgIDsForPlaylists(ctx context.Context, playlistIDs ...uint64) ([]string, error) {
	var query string
	var args []interface{}

	if len(playlistIDs) > 0 {
		placeholders := make([]string, len(playlistIDs))
		for i, pid := range playlistIDs {
			placeholders[i] = "?"
			args = append(args, pid)
		}
		query = fmt.Sprintf(`
			SELECT DISTINCT epg
			FROM channels
			WHERE list_id IN (%s) AND epg IS NOT NULL
			ORDER BY epg ASC
		`, strings.Join(placeholders, ","))
	} else {
		query = `
			SELECT DISTINCT epg
			FROM channels
			WHERE epg IS NOT NULL
			ORDER BY epg ASC
		`
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying distinct epg ids for playlists: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err == nil {
			id = strings.TrimSpace(id)
			if id != "" {
				ids = append(ids, id)
			}
		}
	}

	return ids, rows.Err()
}

// GetDistinctEpgIDs returns unique, non-empty EPG identifiers associated with channels of a playlist.
func (r *StreamRepo) GetDistinctEpgIDs(ctx context.Context, listID uint64) ([]string, error) {
	return r.GetDistinctEpgIDsForPlaylists(ctx, listID)
}

// GetAllDistinctEpgIDs returns unique, non-empty EPG identifiers across all channels of all playlists.
func (r *StreamRepo) GetAllDistinctEpgIDs(ctx context.Context) ([]string, error) {
	return r.GetDistinctEpgIDsForPlaylists(ctx)
}

// PurgeAllStreams deletes all channels, vods, series, episodes, and their categories.
func (r *StreamRepo) PurgeAllStreams(ctx context.Context) error {
	tables := []string{
		"series_episodes",
		"series",
		"series_categories",
		"vods",
		"vods_categories",
		"channels",
		"channels_categories",
	}
	for _, t := range tables {
		query := fmt.Sprintf("DELETE FROM %s", t)
		if _, err := r.db.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("failed to purge %s: %w", t, err)
		}
	}
	return nil
}


