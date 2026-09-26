package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/client"
)

// EpgRepo provides methods to persist EPG data.
type EpgRepo struct {
	db *sql.DB
}

// NewEpgRepo creates a new EpgRepo.
func NewEpgRepo(db *sql.DB) *EpgRepo {
	return &EpgRepo{db: db}
}

// GetChannelsMaxStop returns the precalculated max stop timestamp for all tracked EPG channels.
func (r *EpgRepo) GetChannelsMaxStop(ctx context.Context) (map[string]time.Time, error) {
	query := "SELECT id, max_stop FROM epg_channels"
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed querying epg_channels max_stop: %w", err)
	}
	defer rows.Close()

	res := make(map[string]time.Time)
	for rows.Next() {
		var id string
		var maxStop sql.NullTime
		if err := rows.Scan(&id, &maxStop); err == nil {
			if maxStop.Valid {
				res[id] = maxStop.Time
			}
		}
	}
	return res, rows.Err()
}

// UpdateChannelsMaxStop updates the max stop timestamp for given EPG channel IDs in epg_channels.
func (r *EpgRepo) UpdateChannelsMaxStop(ctx context.Context, maxStops map[string]time.Time) error {
	if len(maxStops) == 0 {
		return nil
	}

	entries := make([]struct {
		id      string
		maxStop time.Time
	}, 0, len(maxStops))
	for id, stop := range maxStops {
		if id != "" && !stop.IsZero() {
			entries = append(entries, struct {
				id      string
				maxStop time.Time
			}{id: id, maxStop: stop})
		}
	}

	if len(entries) == 0 {
		return nil
	}

	const batchSize = 500
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(entries); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}
		chunk := entries[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*2)
		for _, item := range chunk {
			valueStrings = append(valueStrings, "(?, ?)")
			valueArgs = append(valueArgs, item.id, item.maxStop)
		}

		query := fmt.Sprintf(`
			INSERT INTO epg_channels (id, max_stop)
			VALUES %s
			ON DUPLICATE KEY UPDATE
				max_stop = CASE WHEN max_stop IS NULL THEN VALUES(max_stop) ELSE GREATEST(max_stop, VALUES(max_stop)) END,
				updated_at = CURRENT_TIMESTAMP(3)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed updating epg_channels chunk: %w", err)
		}

		if end < len(entries) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// SaveEpgChannelsMeta persists canonical channel names and language codes into epg_channels.
func (r *EpgRepo) SaveEpgChannelsMeta(ctx context.Context, channels []client.EpgChannelMeta) error {
	if len(channels) == 0 {
		return nil
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
		valueArgs := make([]interface{}, 0, len(chunk)*3)
		for _, ch := range chunk {
			if ch.ID == "" {
				continue
			}
			valueStrings = append(valueStrings, "(?, ?, ?)")
			var lang *string
			if ch.Lang != nil && *ch.Lang != "" {
				lang = ch.Lang
			}
			valueArgs = append(valueArgs, ch.ID, ch.Name, lang)
		}

		if len(valueStrings) == 0 {
			continue
		}

		query := fmt.Sprintf(`
			INSERT INTO epg_channels (id, name, lang)
			VALUES %s
			ON DUPLICATE KEY UPDATE
				name = VALUES(name),
				lang = VALUES(lang)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving epg_channels meta chunk: %w", err)
		}

		if end < len(channels) {
			time.Sleep(batchDelay)
		}
	}

	return nil
}

// PruneOldProgrammes deletes past EPG events based on catchup configuration:
// - If channels have catchup > 0, events are kept up to NOW() - (MAX(catchup) + 2) days.
// - All other events are deleted if older than 2 days (stop < NOW() - 2 days).
// If maxFutureDays is passed and > 0, it also deletes events starting beyond NOW() + maxFutureDays.
func (r *EpgRepo) PruneOldProgrammes(ctx context.Context, maxFutureDays ...int) (int64, error) {
	query := `
		DELETE p
		FROM epg_programmes p
		LEFT JOIN (
			SELECT epg, MAX(catchup) AS max_catchup
			FROM channels
			WHERE epg IS NOT NULL AND catchup > 0
			GROUP BY epg
		) c ON p.id = c.epg
		WHERE p.stop < NOW() - INTERVAL (COALESCE(c.max_catchup, 0) + 2) DAY
	`
	res, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("failed pruning old epg programmes: %w", err)
	}

	totalPruned, _ := res.RowsAffected()

	if len(maxFutureDays) > 0 && maxFutureDays[0] > 0 {
		futureQuery := `DELETE FROM epg_programmes WHERE start > DATE_ADD(NOW(), INTERVAL ? DAY)`
		if fRes, fErr := r.db.ExecContext(ctx, futureQuery, maxFutureDays[0]); fErr == nil {
			fCount, _ := fRes.RowsAffected()
			totalPruned += fCount
		}
	}

	return totalPruned, nil
}

// SaveEpgProgrammes inserts or updates EPG programme records in MariaDB,
// and precalculates/updates the max stop in epg_channels.
// If maxFutureDays is passed and > 0, events starting beyond time.Now().UTC() + maxFutureDays are discarded.
func (r *EpgRepo) SaveEpgProgrammes(ctx context.Context, programmes []client.EpgProgramme, maxFutureDays ...int) error {
	if len(programmes) == 0 {
		return nil
	}

	var maxFutureCutoff time.Time
	if len(maxFutureDays) > 0 && maxFutureDays[0] > 0 {
		maxFutureCutoff = time.Now().UTC().AddDate(0, 0, maxFutureDays[0])
	}

	maxStops := make(map[string]time.Time)

	const batchSize = 300
	const batchDelay = 15 * time.Millisecond
	for i := 0; i < len(programmes); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(programmes) {
			end = len(programmes)
		}
		chunk := programmes[i:end]

		valueStrings := make([]string, 0, len(chunk))
		valueArgs := make([]interface{}, 0, len(chunk)*17)

		for _, p := range chunk {
			if !p.Start.Valid || !p.Stop.Valid || p.ID == "" {
				continue
			}

			if !maxFutureCutoff.IsZero() && p.Start.Time.After(maxFutureCutoff) {
				continue
			}

			if currMax, exists := maxStops[p.ID]; !exists || p.Stop.Time.After(currMax) {
				maxStops[p.ID] = p.Stop.Time
			}

			catStr := rawJSONToString(p.Categories)
			actStr := rawJSONToString(p.Actors)
			dirStr := rawJSONToString(p.Directors)
			prodStr := rawJSONToString(p.Producers)
			writStr := rawJSONToString(p.Writers)

			valueStrings = append(valueStrings, "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
			valueArgs = append(valueArgs,
				p.ID, p.Start.Time, p.Stop.Time, p.Title, p.Description,
				p.SubTitle, p.Icon, catStr, actStr, dirStr,
				prodStr, writStr, p.Season, p.Episode, p.Rating,
				p.Live, p.New, p.ReleaseDate,
			)
		}

		if len(valueStrings) == 0 {
			continue
		}

		query := fmt.Sprintf(`
			INSERT INTO epg_programmes (
				id, start, stop, title, description,
				sub_title, icon, categories, actors, directors,
				producers, writers, season, episode, rating,
				live, new, release_date
			) VALUES %s
			ON DUPLICATE KEY UPDATE
				stop = VALUES(stop),
				title = VALUES(title),
				description = VALUES(description),
				sub_title = VALUES(sub_title),
				icon = VALUES(icon),
				categories = VALUES(categories),
				actors = VALUES(actors),
				directors = VALUES(directors),
				producers = VALUES(producers),
				writers = VALUES(writers),
				season = VALUES(season),
				episode = VALUES(episode),
				rating = VALUES(rating),
				live = VALUES(live),
				new = VALUES(new),
				release_date = VALUES(release_date)
		`, strings.Join(valueStrings, ","))

		if _, err := r.db.ExecContext(ctx, query, valueArgs...); err != nil {
			return fmt.Errorf("failed saving epg chunk: %w", err)
		}

		if end < len(programmes) {
			time.Sleep(batchDelay)
		}
	}

	// Update epg_channels table with the max stops found in this batch
	if len(maxStops) > 0 {
		if err := r.UpdateChannelsMaxStop(ctx, maxStops); err != nil {
			log.Printf("[EPG-REPO-WARN] Failed updating epg_channels max_stop: %v", err)
		}
	}

	return nil
}

func rawJSONToString(raw []byte) *string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	s := string(raw)
	return &s
}

// GetEpgSettingsHash retrieves the stored hash of epg_user_settings from epg_sync_state.
func (r *EpgRepo) GetEpgSettingsHash(ctx context.Context) (string, error) {
	var hash sql.NullString
	query := "SELECT settings_hash FROM epg_sync_state WHERE id = 1"
	err := r.db.QueryRowContext(ctx, query).Scan(&hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("failed querying epg_sync_state: %w", err)
	}
	if hash.Valid {
		return hash.String, nil
	}
	return "", nil
}

// SaveEpgSettingsHash updates the stored hash of epg_user_settings in epg_sync_state.
func (r *EpgRepo) SaveEpgSettingsHash(ctx context.Context, hash string) error {
	query := `
		INSERT INTO epg_sync_state (id, settings_hash)
		VALUES (1, ?)
		ON DUPLICATE KEY UPDATE settings_hash = VALUES(settings_hash), updated_at = NOW()
	`
	_, err := r.db.ExecContext(ctx, query, hash)
	if err != nil {
		return fmt.Errorf("failed saving epg settings hash: %w", err)
	}
	return nil
}

// PurgeAllEPG deletes all epg programmes, channels, and resets sync state.
func (r *EpgRepo) PurgeAllEPG(ctx context.Context) error {
	for _, t := range []string{"epg_programmes", "epg_channels"} {
		query := fmt.Sprintf("DELETE FROM %s", t)
		if _, err := r.db.ExecContext(ctx, query); err != nil {
			return fmt.Errorf("failed to purge %s: %w", t, err)
		}
	}
	_, _ = r.db.ExecContext(ctx, "UPDATE epg_sync_state SET settings_hash = NULL WHERE id = 1")
	return nil
}

