package repository

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/util"
)


type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) GetUsersByPlaylist(ctx context.Context, listID uint64, creatorAdminID *int) ([]models.ManagedUser, error) {
	creatorFilter := ""
	args := []interface{}{listID}
	if creatorAdminID != nil {
		creatorFilter = " AND mu.created_by_admin_id = ?"
		args = append(args, *creatorAdminID)
	}

	query := fmt.Sprintf(`
		SELECT 
			mu.list_id, mu.id, mu.name, mu.expiry, 
			mu.channels_categories, mu.vods_categories, mu.series_categories, 
			mu.m3u, mu.epg, mu.username, mu.password, mu.patterns, 
			mu.note, mu.language, mu.message, mu.max_connections, mu.sync_expiry_date, 
			mu.user_settings, mu.created_by_admin_id, a.username as created_by_username,
			COALESCE(mu.is_suspended, 0), COALESCE(mu.is_compromised, 0), mu.compromised_reason, mu.compromised_at,
			mu.createdAt, mu.updatedAt
		FROM managed_users mu
		LEFT JOIN admins a ON mu.created_by_admin_id = a.id
		WHERE mu.list_id = ? %s
		ORDER BY mu.id ASC
	`, creatorFilter)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying managed users: %w", err)
	}
	defer rows.Close()

	var users []models.ManagedUser
	for rows.Next() {
		var u models.ManagedUser
		var (
			chanCat, vodCat, serCat       sql.NullString
			patternsStr                   string
			userSettings                  sql.NullString
			syncExpiry                    sql.NullInt64
			maxConn                       sql.NullInt64
			createdByAdminID              sql.NullInt64
			createdByUsername             sql.NullString
			isSuspendedInt, isCompInt     int
			compReason                    sql.NullString
			compAt                        sql.NullTime
		)

		err := rows.Scan(
			&u.ListID,
			&u.ID,
			&u.Name,
			&u.Expiry,
			&chanCat,
			&vodCat,
			&serCat,
			&u.M3U,
			&u.EPG,
			&u.Username,
			&u.Password,
			&patternsStr,
			&u.Note,
			&u.Language,
			&u.Message,
			&maxConn,
			&syncExpiry,
			&userSettings,
			&createdByAdminID,
			&createdByUsername,
			&isSuspendedInt,
			&isCompInt,
			&compReason,
			&compAt,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning managed user: %w", err)
		}

		if chanCat.Valid {
			u.ChannelsCategories = []byte(chanCat.String)
		}
		if vodCat.Valid {
			u.VodsCategories = []byte(vodCat.String)
		}
		if serCat.Valid {
			u.SeriesCategories = []byte(serCat.String)
		}
		u.Patterns = []byte(patternsStr)
		if userSettings.Valid && userSettings.String != "" {
			u.UserSettings = util.UnwrapUserSettings([]byte(userSettings.String))
		}
		if maxConn.Valid {
			u.MaxConnections = int(maxConn.Int64)
		} else {
			u.MaxConnections = 1
		}
		if syncExpiry.Valid && syncExpiry.Int64 == 1 {
			u.SyncExpiryDate = true
		}
		if createdByAdminID.Valid {
			cid := int(createdByAdminID.Int64)
			u.CreatedByAdminID = &cid
		}
		if createdByUsername.Valid {
			u.CreatedByUsername = &createdByUsername.String
		}
		u.IsSuspended = isSuspendedInt == 1
		u.IsCompromised = isCompInt == 1
		if compReason.Valid {
			u.CompromisedReason = &compReason.String
		}
		if compAt.Valid {
			u.CompromisedAt = &compAt.Time
		}

		users = append(users, u)
	}
	if users == nil {
		users = []models.ManagedUser{}
	}
	return users, nil
}

func (r *UserRepo) GetUserByID(ctx context.Context, listID uint64, id int) (*models.ManagedUser, error) {
	query := `
		SELECT 
			mu.list_id, mu.id, mu.name, mu.expiry, 
			mu.channels_categories, mu.vods_categories, mu.series_categories, 
			mu.m3u, mu.epg, mu.username, mu.password, mu.patterns, 
			mu.note, mu.language, mu.message, mu.max_connections, mu.sync_expiry_date, 
			mu.user_settings, mu.created_by_admin_id, a.username as created_by_username,
			COALESCE(mu.is_suspended, 0), COALESCE(mu.is_compromised, 0), mu.compromised_reason, mu.compromised_at,
			mu.createdAt, mu.updatedAt
		FROM managed_users mu
		LEFT JOIN admins a ON mu.created_by_admin_id = a.id
		WHERE mu.list_id = ? AND mu.id = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, listID, id)

	var u models.ManagedUser
	var (
		chanCat, vodCat, serCat       sql.NullString
		patternsStr                   string
		userSettings                  sql.NullString
		syncExpiry                    sql.NullInt64
		maxConn                       sql.NullInt64
		createdByAdminID              sql.NullInt64
		createdByUsername             sql.NullString
		isSuspendedInt, isCompInt     int
		compReason                    sql.NullString
		compAt                        sql.NullTime
	)

	err := row.Scan(
		&u.ListID,
		&u.ID,
		&u.Name,
		&u.Expiry,
		&chanCat,
		&vodCat,
		&serCat,
		&u.M3U,
		&u.EPG,
		&u.Username,
		&u.Password,
		&patternsStr,
		&u.Note,
		&u.Language,
		&u.Message,
		&maxConn,
		&syncExpiry,
		&userSettings,
		&createdByAdminID,
		&createdByUsername,
		&isSuspendedInt,
		&isCompInt,
		&compReason,
		&compAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed scanning managed user: %w", err)
	}

	if chanCat.Valid {
		u.ChannelsCategories = []byte(chanCat.String)
	}
	if vodCat.Valid {
		u.VodsCategories = []byte(vodCat.String)
	}
	if serCat.Valid {
		u.SeriesCategories = []byte(serCat.String)
	}
	u.Patterns = []byte(patternsStr)
	if userSettings.Valid && userSettings.String != "" {
		u.UserSettings = util.UnwrapUserSettings([]byte(userSettings.String))
	}
	if maxConn.Valid {
		u.MaxConnections = int(maxConn.Int64)
	} else {
		u.MaxConnections = 1
	}
	if syncExpiry.Valid && syncExpiry.Int64 == 1 {
		u.SyncExpiryDate = true
	}
	if createdByAdminID.Valid {
		cid := int(createdByAdminID.Int64)
		u.CreatedByAdminID = &cid
	}
	if createdByUsername.Valid {
		u.CreatedByUsername = &createdByUsername.String
	}
	u.IsSuspended = isSuspendedInt == 1
	u.IsCompromised = isCompInt == 1
	if compReason.Valid {
		u.CompromisedReason = &compReason.String
	}
	if compAt.Valid {
		u.CompromisedAt = &compAt.Time
	}

	return &u, nil
}

func (r *UserRepo) GetAllUsers(ctx context.Context) ([]models.ManagedUser, error) {
	query := `
		SELECT 
			mu.list_id, mu.id, mu.name, mu.expiry, 
			mu.channels_categories, mu.vods_categories, mu.series_categories, 
			mu.m3u, mu.epg, mu.username, mu.password, mu.patterns, 
			mu.note, mu.language, mu.message, mu.max_connections, mu.sync_expiry_date, 
			mu.user_settings, mu.created_by_admin_id, a.username as created_by_username,
			COALESCE(mu.is_suspended, 0), COALESCE(mu.is_compromised, 0), mu.compromised_reason, mu.compromised_at,
			mu.createdAt, mu.updatedAt
		FROM managed_users mu
		LEFT JOIN admins a ON mu.created_by_admin_id = a.id
		ORDER BY mu.list_id ASC, mu.id ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed querying all managed users: %w", err)
	}
	defer rows.Close()

	var users []models.ManagedUser
	for rows.Next() {
		var u models.ManagedUser
		var (
			chanCat, vodCat, serCat       sql.NullString
			patternsStr                   string
			userSettings                  sql.NullString
			syncExpiry                    sql.NullInt64
			maxConn                       sql.NullInt64
			createdByAdminID              sql.NullInt64
			createdByUsername             sql.NullString
			isSuspendedInt, isCompInt     int
			compReason                    sql.NullString
			compAt                        sql.NullTime
		)

		err := rows.Scan(
			&u.ListID,
			&u.ID,
			&u.Name,
			&u.Expiry,
			&chanCat,
			&vodCat,
			&serCat,
			&u.M3U,
			&u.EPG,
			&u.Username,
			&u.Password,
			&patternsStr,
			&u.Note,
			&u.Language,
			&u.Message,
			&maxConn,
			&syncExpiry,
			&userSettings,
			&createdByAdminID,
			&createdByUsername,
			&isSuspendedInt,
			&isCompInt,
			&compReason,
			&compAt,
			&u.CreatedAt,
			&u.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning managed user: %w", err)
		}

		if chanCat.Valid {
			u.ChannelsCategories = []byte(chanCat.String)
		}
		if vodCat.Valid {
			u.VodsCategories = []byte(vodCat.String)
		}
		if serCat.Valid {
			u.SeriesCategories = []byte(serCat.String)
		}
		u.Patterns = []byte(patternsStr)
		if userSettings.Valid && userSettings.String != "" {
			u.UserSettings = util.UnwrapUserSettings([]byte(userSettings.String))
		}
		if maxConn.Valid {
			u.MaxConnections = int(maxConn.Int64)
		} else {
			u.MaxConnections = 1
		}
		if syncExpiry.Valid && syncExpiry.Int64 == 1 {
			u.SyncExpiryDate = true
		}
		if createdByAdminID.Valid {
			cid := int(createdByAdminID.Int64)
			u.CreatedByAdminID = &cid
		}
		if createdByUsername.Valid {
			u.CreatedByUsername = &createdByUsername.String
		}
		u.IsSuspended = isSuspendedInt == 1
		u.IsCompromised = isCompInt == 1
		if compReason.Valid {
			u.CompromisedReason = &compReason.String
		}
		if compAt.Valid {
			u.CompromisedAt = &compAt.Time
		}

		users = append(users, u)
	}
	if users == nil {
		users = []models.ManagedUser{}
	}
	return users, nil
}

func (r *UserRepo) GetUserByUsername(ctx context.Context, username string) (*models.ManagedUser, error) {
	query := `
		SELECT 
			mu.list_id, mu.id, mu.name, mu.expiry, 
			mu.channels_categories, mu.vods_categories, mu.series_categories, 
			mu.m3u, mu.epg, mu.username, mu.password, mu.patterns, 
			mu.note, mu.language, mu.message, mu.max_connections, mu.sync_expiry_date, 
			mu.user_settings, mu.created_by_admin_id, a.username as created_by_username,
			COALESCE(mu.is_suspended, 0), COALESCE(mu.is_compromised, 0), mu.compromised_reason, mu.compromised_at,
			mu.createdAt, mu.updatedAt
		FROM managed_users mu
		LEFT JOIN admins a ON mu.created_by_admin_id = a.id
		WHERE mu.username = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, username)

	var u models.ManagedUser
	var (
		chanCat, vodCat, serCat       sql.NullString
		patternsStr                   string
		userSettings                  sql.NullString
		syncExpiry                    sql.NullInt64
		maxConn                       sql.NullInt64
		createdByAdminID              sql.NullInt64
		createdByUsername             sql.NullString
		isSuspendedInt, isCompInt     int
		compReason                    sql.NullString
		compAt                        sql.NullTime
	)

	err := row.Scan(
		&u.ListID,
		&u.ID,
		&u.Name,
		&u.Expiry,
		&chanCat,
		&vodCat,
		&serCat,
		&u.M3U,
		&u.EPG,
		&u.Username,
		&u.Password,
		&patternsStr,
		&u.Note,
		&u.Language,
		&u.Message,
		&maxConn,
		&syncExpiry,
		&userSettings,
		&createdByAdminID,
		&createdByUsername,
		&isSuspendedInt,
		&isCompInt,
		&compReason,
		&compAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed scanning managed user: %w", err)
	}

	if chanCat.Valid {
		u.ChannelsCategories = []byte(chanCat.String)
	}
	if vodCat.Valid {
		u.VodsCategories = []byte(vodCat.String)
	}
	if serCat.Valid {
		u.SeriesCategories = []byte(serCat.String)
	}
	u.Patterns = []byte(patternsStr)
	if userSettings.Valid && userSettings.String != "" {
		u.UserSettings = util.UnwrapUserSettings([]byte(userSettings.String))
	}
	if maxConn.Valid {
		u.MaxConnections = int(maxConn.Int64)
	} else {
		u.MaxConnections = 1
	}
	if syncExpiry.Valid && syncExpiry.Int64 == 1 {
		u.SyncExpiryDate = true
	}
	if createdByAdminID.Valid {
		cid := int(createdByAdminID.Int64)
		u.CreatedByAdminID = &cid
	}
	if createdByUsername.Valid {
		u.CreatedByUsername = &createdByUsername.String
	}
	u.IsSuspended = isSuspendedInt == 1
	u.IsCompromised = isCompInt == 1
	if compReason.Valid {
		u.CompromisedReason = &compReason.String
	}
	if compAt.Valid {
		u.CompromisedAt = &compAt.Time
	}

	return &u, nil
}

func (r *UserRepo) IsUsernameTaken(ctx context.Context, username string, excludeListID uint64, excludeID int) (bool, error) {
	var count int
	var err error
	if excludeListID > 0 && excludeID > 0 {
		err = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE username = ? AND NOT (list_id = ? AND id = ?)", username, excludeListID, excludeID).Scan(&count)
	} else {
		err = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE username = ?", username).Scan(&count)
	}
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// IsTokenTaken checks if a short URL token is already in use as either M3U or EPG by any other user.
func (r *UserRepo) IsTokenTaken(ctx context.Context, token string, excludeListID uint64, excludeID int) (bool, error) {
	var count int
	var err error
	if excludeListID > 0 && excludeID > 0 {
		err = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE (m3u = ? OR epg = ?) AND NOT (list_id = ? AND id = ?)", token, token, excludeListID, excludeID).Scan(&count)
	} else {
		err = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE m3u = ? OR epg = ?", token, token).Scan(&count)
	}
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *UserRepo) IsM3UTaken(ctx context.Context, m3u string, excludeListID uint64, excludeID int) (bool, error) {
	return r.IsTokenTaken(ctx, m3u, excludeListID, excludeID)
}

func (r *UserRepo) IsEPGTaken(ctx context.Context, epg string, excludeListID uint64, excludeID int) (bool, error) {
	return r.IsTokenTaken(ctx, epg, excludeListID, excludeID)
}

func (r *UserRepo) IsIDTaken(ctx context.Context, listID uint64, id int) (bool, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE list_id = ? AND id = ?", listID, id).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *UserRepo) GetNextID(ctx context.Context, listID uint64) (int, error) {
	var nextID int
	err := r.db.QueryRowContext(ctx, "SELECT COALESCE(MAX(id), 0) + 1 FROM managed_users WHERE list_id = ?", listID).Scan(&nextID)
	if err != nil {
		return 1, err
	}
	return nextID, nil
}

// RestoreOverwrite updates an existing managed user and relocates them to targetListID with targetID, updating all fields and credentials.
func (r *UserRepo) RestoreOverwrite(ctx context.Context, existingListID uint64, existingID int, targetListID uint64, targetID int, u *models.ManagedUser) error {
	var chanCat, vodCat, serCat, userSettings *string
	if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
		s := string(u.ChannelsCategories)
		chanCat = &s
	}
	if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
		s := string(u.VodsCategories)
		vodCat = &s
	}
	if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
		s := string(u.SeriesCategories)
		serCat = &s
	}
	if len(u.UserSettings) > 0 {
		userSettings = util.NormalizeUserSettings(u.UserSettings)
		if userSettings != nil {
			u.UserSettings = []byte(*userSettings)
		}
	}

	patternsStr := string(u.Patterns)
	if patternsStr == "" {
		patternsStr = "[]"
	}

	syncExpiryInt := 0
	if u.SyncExpiryDate {
		syncExpiryInt = 1
	}

	query := `
		UPDATE managed_users SET 
			list_id = ?,
			id = ?,
			name = ?, 
			expiry = ?, 
			channels_categories = ?, 
			vods_categories = ?, 
			series_categories = ?, 
			m3u = ?,
			epg = ?,
			password = ?,
			patterns = ?, 
			note = ?, 
			language = ?, 
			message = ?, 
			max_connections = ?, 
			sync_expiry_date = ?, 
			user_settings = ?,
			created_by_admin_id = ?,
			updatedAt = NOW()
		WHERE list_id = ? AND id = ?
	`

	res, err := r.db.ExecContext(ctx, query,
		targetListID, targetID,
		u.Name, u.Expiry,
		chanCat, vodCat, serCat,
		u.M3U, u.EPG, u.Password,
		patternsStr,
		u.Note, u.Language, u.Message, u.MaxConnections, syncExpiryInt,
		userSettings,
		u.CreatedByAdminID,
		existingListID, existingID,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("user record not found to overwrite")
	}
	u.ListID = targetListID
	u.ID = targetID
	return nil
}

func (r *UserRepo) Create(ctx context.Context, u *models.ManagedUser) error {
	query := `
		INSERT INTO managed_users (
			list_id, id, name, expiry, 
			channels_categories, vods_categories, series_categories, 
			m3u, epg, username, password, patterns, 
			note, language, message, max_connections, sync_expiry_date, 
			user_settings, created_by_admin_id, createdAt, updatedAt
		) VALUES (
			?, ?, ?, ?, 
			?, ?, ?, 
			?, ?, ?, ?, ?, 
			?, ?, ?, ?, ?, 
			?, ?, NOW(), NOW()
		)
	`
	var chanCat, vodCat, serCat, userSettings *string
	if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
		s := string(u.ChannelsCategories)
		chanCat = &s
	}
	if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
		s := string(u.VodsCategories)
		vodCat = &s
	}
	if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
		s := string(u.SeriesCategories)
		serCat = &s
	}
	if len(u.UserSettings) > 0 {
		userSettings = util.NormalizeUserSettings(u.UserSettings)
		if userSettings != nil {
			u.UserSettings = []byte(*userSettings)
		}
	}

	patternsStr := string(u.Patterns)
	if patternsStr == "" {
		patternsStr = "[]"
	}

	syncExpiryInt := 0
	if u.SyncExpiryDate {
		syncExpiryInt = 1
	}

	_, err := r.db.ExecContext(ctx, query,
		u.ListID, u.ID, u.Name, u.Expiry,
		chanCat, vodCat, serCat,
		u.M3U, u.EPG, u.Username, u.Password, patternsStr,
		u.Note, u.Language, u.Message, u.MaxConnections, syncExpiryInt,
		userSettings, u.CreatedByAdminID,
	)
	return err
}

func (r *UserRepo) Update(ctx context.Context, u *models.ManagedUser, creatorAdminID *int) error {
	whereExtra := ""
	var args []interface{}

	var chanCat, vodCat, serCat, userSettings *string
	if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
		s := string(u.ChannelsCategories)
		chanCat = &s
	}
	if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
		s := string(u.VodsCategories)
		vodCat = &s
	}
	if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
		s := string(u.SeriesCategories)
		serCat = &s
	}
	if len(u.UserSettings) > 0 {
		userSettings = util.NormalizeUserSettings(u.UserSettings)
		if userSettings != nil {
			u.UserSettings = []byte(*userSettings)
		}
	}

	patternsStr := string(u.Patterns)
	if patternsStr == "" {
		patternsStr = "[]"
	}

	syncExpiryInt := 0
	if u.SyncExpiryDate {
		syncExpiryInt = 1
	}

	isSuspendedInt := 0
	if u.IsSuspended {
		isSuspendedInt = 1
	}
	isCompInt := 0
	if u.IsCompromised {
		isCompInt = 1
	}
	var compReason *string
	if u.CompromisedReason != nil && *u.CompromisedReason != "" {
		compReason = u.CompromisedReason
	}

	args = append(args,
		u.Name, u.Expiry,
		chanCat, vodCat, serCat,
		patternsStr,
		u.Note, u.Language, u.Message, u.MaxConnections, syncExpiryInt,
		userSettings,
		isSuspendedInt, isCompInt, compReason,
		u.ListID, u.ID,
	)

	if creatorAdminID != nil {
		whereExtra = " AND created_by_admin_id = ?"
		args = append(args, *creatorAdminID)
	}

	query := fmt.Sprintf(`
		UPDATE managed_users SET 
			name = ?, 
			expiry = ?, 
			channels_categories = ?, 
			vods_categories = ?, 
			series_categories = ?, 
			patterns = ?, 
			note = ?, 
			language = ?, 
			message = ?, 
			max_connections = ?, 
			sync_expiry_date = ?, 
			user_settings = ?,
			is_suspended = ?,
			is_compromised = ?,
			compromised_reason = ?,
			updatedAt = NOW()
		WHERE list_id = ? AND id = ? %s
	`, whereExtra)

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	if creatorAdminID != nil {
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return errors.New("user not found or unauthorized")
		}
	}
	return nil
}

func (r *UserRepo) UpdateCredentials(ctx context.Context, listID uint64, id int, username, password, m3u, epg string, creatorAdminID *int) error {
	whereExtra := ""
	args := []interface{}{username, password, m3u, epg, listID, id}
	if creatorAdminID != nil {
		whereExtra = " AND created_by_admin_id = ?"
		args = append(args, *creatorAdminID)
	}

	query := fmt.Sprintf(`
		UPDATE managed_users SET 
			username = COALESCE(NULLIF(?, ''), username),
			password = COALESCE(NULLIF(?, ''), password),
			m3u = COALESCE(NULLIF(?, ''), m3u),
			epg = COALESCE(NULLIF(?, ''), epg),
			updatedAt = NOW()
		WHERE list_id = ? AND id = ? %s
	`, whereExtra)

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	if creatorAdminID != nil {
		affected, _ := res.RowsAffected()
		if affected == 0 {
			return errors.New("user not found or unauthorized")
		}
	}
	return nil
}

func (r *UserRepo) DeleteUsers(ctx context.Context, listID uint64, ids []int, creatorAdminID *int) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+2)
	args = append(args, listID)
	for i, id := range ids {
		placeholders[i] = "?"
		args = append(args, id)
	}

	whereExtra := ""
	if creatorAdminID != nil {
		whereExtra = " AND created_by_admin_id = ?"
		args = append(args, *creatorAdminID)
	}

	query := fmt.Sprintf("DELETE FROM managed_users WHERE list_id = ? AND id IN (%s) %s", strings.Join(placeholders, ","), whereExtra)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *UserRepo) MoveUsers(ctx context.Context, fromListID, toListID uint64, ids []int, creatorAdminID *int, mappings []models.PatternMapping) error {
	if len(ids) == 0 {
		return nil
	}

	// Enforce 1:1 mapping: each destination provider URL can only be mapped to one source provider
	if len(mappings) > 0 {
		seenTargets := make(map[string]bool)
		for _, m := range mappings {
			if m.Action == "map" && m.TargetURL != "" {
				if seenTargets[m.TargetURL] {
					return errors.New("invalid pattern mapping: multiple source providers mapped to the same destination provider (1:1 required)")
				}
				seenTargets[m.TargetURL] = true
			}
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// If scoped to creator, verify all specified user IDs belong to this creator
	if creatorAdminID != nil {
		placeholders := make([]string, len(ids))
		checkArgs := make([]interface{}, 0, len(ids)+2)
		checkArgs = append(checkArgs, fromListID, *creatorAdminID)
		for i, id := range ids {
			placeholders[i] = "?"
			checkArgs = append(checkArgs, id)
		}
		checkQ := fmt.Sprintf("SELECT COUNT(*) FROM managed_users WHERE list_id = ? AND created_by_admin_id = ? AND id IN (%s)", strings.Join(placeholders, ","))
		var ownedCount int
		err = tx.QueryRowContext(ctx, checkQ, checkArgs...).Scan(&ownedCount)
		if err != nil {
			return err
		}
		if ownedCount != len(ids) {
			return errors.New("unauthorized: some users do not belong to you")
		}
	}

	// Fetch destination playlist's patterns
	var targetPatternsJSON string
	err = tx.QueryRowContext(ctx, "SELECT COALESCE(patterns, '[]') FROM playlists WHERE id = ?", toListID).Scan(&targetPatternsJSON)
	if err != nil {
		return err
	}
	var targetPatterns []models.PatternItem
	_ = json.Unmarshal([]byte(targetPatternsJSON), &targetPatterns)
	if targetPatterns == nil {
		targetPatterns = []models.PatternItem{}
	}

	// Get max ID in destination playlist
	var maxID int
	err = tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(id), 0) FROM managed_users WHERE list_id = ?", toListID).Scan(&maxID)
	if err != nil {
		return err
	}

	// For each user, update list_id, new sequential ID, and reconciled patterns
	for _, id := range ids {
		var userPatternsJSON string
		var username, password string
		err = tx.QueryRowContext(ctx, "SELECT COALESCE(patterns, '[]'), username, password FROM managed_users WHERE list_id = ? AND id = ?", fromListID, id).Scan(&userPatternsJSON, &username, &password)
		if err != nil {
			return err
		}
		var userPatterns []models.PatternItem
		_ = json.Unmarshal([]byte(userPatternsJSON), &userPatterns)

		var newUserPatterns []models.PatternItem
		if mappings != nil {
			newUserPatterns = make([]models.PatternItem, 0, len(targetPatterns))
			for _, targetP := range targetPatterns {
				newP := targetP
				var mappedSource *models.PatternMapping
				for i := range mappings {
					if mappings[i].Action == "map" && mappings[i].TargetURL == targetP.URL {
						mappedSource = &mappings[i]
						break
					}
				}

				if mappedSource != nil {
					for _, uP := range userPatterns {
						if uP.URL == mappedSource.SourceURL {
							newP.Param1 = uP.Param1
							newP.Param2 = uP.Param2
							if uP.CURL != "" {
								newP.CURL = uP.CURL
								newP.UseCURL = uP.UseCURL
							}
							break
						}
					}
				} else {
					// Fallback to user credentials if xtream pattern is unmapped
					if strings.EqualFold(newP.Type, "xtream") && newP.Param1 == "" && newP.Param2 == "" {
						newP.Param1 = username
						newP.Param2 = password
					}
				}
				newUserPatterns = append(newUserPatterns, newP)
			}
		} else {
			// Auto-reconcile fallback when no explicit mappings provided
			newUserPatterns = make([]models.PatternItem, 0, len(targetPatterns))
			for _, targetP := range targetPatterns {
				newP := targetP
				var matchedUserP *models.PatternItem
				for i := range userPatterns {
					if userPatterns[i].URL == targetP.URL {
						matchedUserP = &userPatterns[i]
						break
					}
				}
				if matchedUserP == nil {
					for i := range userPatterns {
						if strings.EqualFold(userPatterns[i].Type, targetP.Type) {
							matchedUserP = &userPatterns[i]
							break
						}
					}
				}
				if matchedUserP != nil {
					newP.Param1 = matchedUserP.Param1
					newP.Param2 = matchedUserP.Param2
					if matchedUserP.CURL != "" {
						newP.CURL = matchedUserP.CURL
						newP.UseCURL = matchedUserP.UseCURL
					}
				} else if strings.EqualFold(newP.Type, "xtream") && newP.Param1 == "" && newP.Param2 == "" {
					newP.Param1 = username
					newP.Param2 = password
				}
				newUserPatterns = append(newUserPatterns, newP)
			}
		}

		newUserPatternsBytes, err := json.Marshal(newUserPatterns)
		if err != nil {
			return err
		}

		maxID++
		_, err = tx.ExecContext(ctx, "UPDATE managed_users SET list_id = ?, id = ?, patterns = ?, updatedAt = NOW() WHERE list_id = ? AND id = ?", toListID, maxID, string(newUserPatternsBytes), fromListID, id)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

type CategoryUpdateItem struct {
	ID                 int             `json:"id"`
	ChannelsCategories json.RawMessage `json:"channels_categories"`
	VodsCategories     json.RawMessage `json:"vods_categories"`
	SeriesCategories   json.RawMessage `json:"series_categories"`
}

func (r *UserRepo) BulkUpdateCategories(ctx context.Context, listID uint64, items []CategoryUpdateItem, creatorAdminID *int) error {
	if len(items) == 0 {
		return nil
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	whereExtra := ""
	if creatorAdminID != nil {
		whereExtra = " AND created_by_admin_id = ?"
	}

	query := fmt.Sprintf(`
		UPDATE managed_users 
		SET channels_categories = ?, vods_categories = ?, series_categories = ?, updatedAt = NOW()
		WHERE list_id = ? AND id = ? %s
	`, whereExtra)

	stmt, err := tx.PrepareContext(ctx, query)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		var chanCat, vodCat, serCat *string
		if len(item.ChannelsCategories) > 0 && string(item.ChannelsCategories) != "null" {
			s := string(item.ChannelsCategories)
			chanCat = &s
		}
		if len(item.VodsCategories) > 0 && string(item.VodsCategories) != "null" {
			s := string(item.VodsCategories)
			vodCat = &s
		}
		if len(item.SeriesCategories) > 0 && string(item.SeriesCategories) != "null" {
			s := string(item.SeriesCategories)
			serCat = &s
		}

		var execErr error
		if creatorAdminID != nil {
			_, execErr = stmt.ExecContext(ctx, chanCat, vodCat, serCat, listID, item.ID, *creatorAdminID)
		} else {
			_, execErr = stmt.ExecContext(ctx, chanCat, vodCat, serCat, listID, item.ID)
		}
		if execErr != nil {
			return execErr
		}
	}

	return tx.Commit()
}

// GetUsersForExpirySync retrieves customers that need their expiration date synchronized.
func (r *UserRepo) GetUsersForExpirySync(ctx context.Context, all bool, daysRange ...int) ([]models.UserExpirySyncCandidate, error) {
	windowDays := 5
	if len(daysRange) > 0 && daysRange[0] > 0 {
		windowDays = daysRange[0]
	}

	var query string
	var rows *sql.Rows
	var err error

	if all {
		query = `
			SELECT u.list_id, u.id, u.name, u.expiry, u.patterns, COALESCE(p.patterns, '[]'), u.max_connections
			FROM managed_users u
			LEFT JOIN playlists p ON u.list_id = p.id
			WHERE u.sync_expiry_date = 1
			ORDER BY u.id ASC
		`
		rows, err = r.db.QueryContext(ctx, query)
	} else {
		query = `
			SELECT u.list_id, u.id, u.name, u.expiry, u.patterns, COALESCE(p.patterns, '[]'), u.max_connections
			FROM managed_users u
			LEFT JOIN playlists p ON u.list_id = p.id
			WHERE u.expiry < NOW() + INTERVAL ? DAY
			  AND u.expiry > NOW() - INTERVAL ? DAY
			  AND u.updatedAt < NOW() - INTERVAL 1 DAY
			  AND u.createdAt < NOW() - INTERVAL 2 DAY
			  AND u.sync_expiry_date = 1
			ORDER BY u.id ASC
		`
		rows, err = r.db.QueryContext(ctx, query, windowDays, windowDays)
	}
	if err != nil {
		return nil, fmt.Errorf("failed querying users for expiry sync: %w", err)
	}
	defer rows.Close()

	var candidates []models.UserExpirySyncCandidate
	for rows.Next() {
		var c models.UserExpirySyncCandidate
		var (
			patternsStr   string
			plPatternsStr string
			maxConn       sql.NullInt64
		)

		if err := rows.Scan(&c.ListID, &c.ID, &c.Name, &c.Expiry, &patternsStr, &plPatternsStr, &maxConn); err != nil {
			return nil, fmt.Errorf("failed scanning user for expiry sync: %w", err)
		}

		var userPatterns []models.PatternItem
		if patternsStr != "" && patternsStr != "[]" && patternsStr != "null" {
			_ = json.Unmarshal([]byte(patternsStr), &userPatterns)
		}
		var plPatterns []models.PatternItem
		if plPatternsStr != "" && plPatternsStr != "[]" && plPatternsStr != "null" {
			_ = json.Unmarshal([]byte(plPatternsStr), &plPatterns)
		}
		merged := models.MergePatterns(plPatterns, userPatterns)
		if mergedBytes, err := json.Marshal(merged); err == nil {
			c.Patterns = mergedBytes
		} else {
			c.Patterns = []byte(patternsStr)
		}

		if maxConn.Valid {
			c.MaxConnections = int(maxConn.Int64)
		} else {
			c.MaxConnections = 1
		}

		candidates = append(candidates, c)
	}

	return candidates, nil
}

// UpdateUserExpiryAndConnections updates the user's expiration date, max connections, and updatedAt.
func (r *UserRepo) UpdateUserExpiryAndConnections(ctx context.Context, listID uint64, id int, expiry time.Time, maxConnections int) error {
	query := `
		UPDATE managed_users
		SET expiry = ?, max_connections = COALESCE(NULLIF(?, 0), max_connections), updatedAt = NOW()
		WHERE list_id = ? AND id = ?
	`
	_, err := r.db.ExecContext(ctx, query, expiry, maxConnections, listID, id)
	return err
}

// TouchUserUpdatedAt updates the updatedAt column to prevent immediate repeated queries.
func (r *UserRepo) TouchUserUpdatedAt(ctx context.Context, listID uint64, id int) error {
	query := `UPDATE managed_users SET updatedAt = NOW() WHERE list_id = ? AND id = ?`
	_, err := r.db.ExecContext(ctx, query, listID, id)
	return err
}

// ApplyPatternAction applies a bulk modification rule on a slice of PatternItem.
// It returns the transformed slice, count of modified patterns, and a boolean indicating if changes occurred.
func ApplyPatternAction(patterns []models.PatternItem, req models.BulkPatternRequest) ([]models.PatternItem, int, bool) {
	var modifiedCount int
	changed := false

	switch req.Action {
	case "rename_url":
		oldURL := strings.TrimSpace(req.OldURL)
		newURL := strings.TrimSpace(req.NewURL)
		if oldURL == "" || newURL == "" {
			return patterns, 0, false
		}
		result := make([]models.PatternItem, len(patterns))
		for i, p := range patterns {
			item := p
			if req.TargetType != "" && req.TargetType != "all" && !strings.EqualFold(item.Type, req.TargetType) {
				result[i] = item
				continue
			}

			matched := false
			if req.ReplaceMode == "substring" {
				if strings.Contains(item.URL, oldURL) {
					item.URL = strings.ReplaceAll(item.URL, oldURL, newURL)
					matched = true
				}
				if req.UpdateCURL && strings.Contains(item.CURL, oldURL) {
					item.CURL = strings.ReplaceAll(item.CURL, oldURL, newURL)
					matched = true
				}
			} else {
				if strings.TrimSpace(item.URL) == oldURL {
					item.URL = newURL
					matched = true
				}
				if req.UpdateCURL && strings.TrimSpace(item.CURL) == oldURL {
					item.CURL = newURL
					matched = true
				}
			}

			if matched {
				changed = true
				modifiedCount++
			}
			result[i] = item
		}
		return result, modifiedCount, changed

	case "remove":
		oldURL := strings.TrimSpace(req.OldURL)
		targetType := strings.TrimSpace(req.TargetType)
		var result []models.PatternItem
		for _, p := range patterns {
			matchType := (targetType == "" || targetType == "all" || strings.EqualFold(p.Type, targetType))
			var matchURL bool
			if oldURL == "" {
				matchURL = true
			} else if req.ReplaceMode == "substring" {
				matchURL = strings.Contains(p.URL, oldURL)
			} else {
				matchURL = (strings.TrimSpace(p.URL) == oldURL)
			}

			if matchType && matchURL {
				changed = true
				modifiedCount++
			} else {
				result = append(result, p)
			}
		}
		if result == nil {
			result = []models.PatternItem{}
		}
		return result, modifiedCount, changed

	case "add":
		if req.NewPattern == nil || strings.TrimSpace(req.NewPattern.URL) == "" {
			return patterns, 0, false
		}
		targetURL := strings.TrimSpace(req.NewPattern.URL)
		targetType := strings.TrimSpace(req.NewPattern.Type)

		alreadyExists := false
		for _, p := range patterns {
			if strings.TrimSpace(p.URL) == targetURL && strings.EqualFold(p.Type, targetType) {
				alreadyExists = true
				break
			}
		}

		if !alreadyExists {
			result := append(patterns, *req.NewPattern)
			return result, 1, true
		}
		return patterns, 0, false

	case "update_curl":
		targetURL := strings.TrimSpace(req.OldURL)
		targetType := strings.TrimSpace(req.TargetType)
		result := make([]models.PatternItem, len(patterns))
		for i, p := range patterns {
			item := p
			matchType := (targetType == "" || targetType == "all" || strings.EqualFold(item.Type, targetType))
			matchURL := (targetURL == "" || strings.TrimSpace(item.URL) == targetURL)

			if matchType && matchURL {
				item.CURL = req.CURL
				if req.UseCURL != nil {
					item.UseCURL = *req.UseCURL
				}
				changed = true
				modifiedCount++
			}
			result[i] = item
		}
		return result, modifiedCount, changed
	}

	return patterns, 0, false
}

// BulkUpdatePatterns performs bulk modifications on customer patterns matching the criteria.
func (r *UserRepo) BulkUpdatePatterns(ctx context.Context, listID uint64, req models.BulkPatternRequest, creatorAdminID *int) (*models.BulkPatternResponse, error) {
	var whereClauses []string
	var args []interface{}

	if req.Scope == "all_playlists" {
		// All playlists
	} else {
		whereClauses = append(whereClauses, "list_id = ?")
		args = append(args, listID)
	}

	if req.Scope == "selected" && len(req.UserIDs) > 0 {
		placeholders := make([]string, len(req.UserIDs))
		for i, uid := range req.UserIDs {
			placeholders[i] = "?"
			args = append(args, uid)
		}
		whereClauses = append(whereClauses, fmt.Sprintf("id IN (%s)", strings.Join(placeholders, ",")))
	}

	if creatorAdminID != nil {
		whereClauses = append(whereClauses, "created_by_admin_id = ?")
		args = append(args, *creatorAdminID)
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf("SELECT list_id, id, patterns FROM managed_users%s", whereSQL)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed querying users for bulk patterns: %w", err)
	}
	defer rows.Close()

	type userUpdate struct {
		listID       uint64
		id           int
		patternsJSON []byte
	}

	var toUpdate []userUpdate
	totalModifiedPatterns := 0

	for rows.Next() {
		var uListID uint64
		var uID int
		var rawPatterns string

		if err := rows.Scan(&uListID, &uID, &rawPatterns); err != nil {
			return nil, fmt.Errorf("failed scanning user: %w", err)
		}

		var patterns []models.PatternItem
		if rawPatterns != "" && rawPatterns != "null" {
			_ = json.Unmarshal([]byte(rawPatterns), &patterns)
		}

		newPatterns, modCount, changed := ApplyPatternAction(patterns, req)
		if changed {
			updatedBytes, err := json.Marshal(newPatterns)
			if err != nil {
				continue
			}
			toUpdate = append(toUpdate, userUpdate{
				listID:       uListID,
				id:           uID,
				patternsJSON: updatedBytes,
			})
			totalModifiedPatterns += modCount
		}
	}

	// Begin transaction to save all changes
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed starting transaction: %w", err)
	}
	defer tx.Rollback()

	if len(toUpdate) > 0 {
		stmt, err := tx.PrepareContext(ctx, "UPDATE managed_users SET patterns = ?, updatedAt = NOW() WHERE list_id = ? AND id = ?")
		if err != nil {
			return nil, fmt.Errorf("failed preparing update statement: %w", err)
		}
		defer stmt.Close()

		for _, u := range toUpdate {
			if _, err := stmt.ExecContext(ctx, string(u.patternsJSON), u.listID, u.id); err != nil {
				return nil, fmt.Errorf("failed updating user %d: %w", u.id, err)
			}
		}
	}

	// Also update playlist default patterns if requested
	if req.UpdatePlaylist && listID > 0 {
		var plPatternsStr sql.NullString
		_ = tx.QueryRowContext(ctx, "SELECT patterns FROM playlists WHERE id = ?", listID).Scan(&plPatternsStr)
		if plPatternsStr.Valid && plPatternsStr.String != "" && plPatternsStr.String != "null" {
			var plPatterns []models.PatternItem
			if err := json.Unmarshal([]byte(plPatternsStr.String), &plPatterns); err == nil {
				newPlPatterns, _, plChanged := ApplyPatternAction(plPatterns, req)
				if plChanged {
					if plBytes, err := json.Marshal(newPlPatterns); err == nil {
						_, _ = tx.ExecContext(ctx, "UPDATE playlists SET patterns = ? WHERE id = ?", string(plBytes), listID)
					}
				}
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed committing bulk pattern transaction: %w", err)
	}

	return &models.BulkPatternResponse{
		Success:          true,
		AffectedUsers:    len(toUpdate),
		ModifiedPatterns: totalModifiedPatterns,
		Message:          fmt.Sprintf("Bulk pattern modification completed: %d users updated (%d patterns modified)", len(toUpdate), totalModifiedPatterns),
	}, nil
}

// UpdatePatternURLs replaces old pattern URLs with new ones for all managed users belonging to a playlist.
// Used when IPTVEditor playlist refresh detects oldUrl in patterns.
func (r *UserRepo) UpdatePatternURLs(ctx context.Context, listID uint64, replacements map[string]string) (int, error) {
	if len(replacements) == 0 {
		return 0, nil
	}

	cleanReplacements := make(map[string]string)
	for oldURL, newURL := range replacements {
		o := strings.TrimSpace(oldURL)
		n := strings.TrimSpace(newURL)
		if o != "" && n != "" && o != n {
			cleanReplacements[o] = n
		}
	}
	if len(cleanReplacements) == 0 {
		return 0, nil
	}

	query := "SELECT id, patterns FROM managed_users WHERE list_id = ?"
	rows, err := r.db.QueryContext(ctx, query, listID)
	if err != nil {
		return 0, fmt.Errorf("failed querying managed users: %w", err)
	}
	defer rows.Close()

	type userUpdate struct {
		id          int
		newPatterns []byte
	}
	var toUpdate []userUpdate

	for rows.Next() {
		var uID int
		var rawPatterns sql.NullString

		if err := rows.Scan(&uID, &rawPatterns); err != nil {
			return 0, fmt.Errorf("failed scanning managed user patterns: %w", err)
		}

		if !rawPatterns.Valid || rawPatterns.String == "" || rawPatterns.String == "null" || rawPatterns.String == "[]" {
			continue
		}

		var patterns []map[string]interface{}
		if err := json.Unmarshal([]byte(rawPatterns.String), &patterns); err != nil {
			continue
		}

		userChanged := false
		for _, p := range patterns {
			rawURL, ok := p["url"].(string)
			if !ok || rawURL == "" {
				continue
			}

			trimmedRaw := strings.TrimRight(strings.TrimSpace(rawURL), "/")
			for oldURL, newURL := range cleanReplacements {
				trimmedOld := strings.TrimRight(oldURL, "/")
				if rawURL == oldURL || (trimmedOld != "" && trimmedRaw == trimmedOld) {
					p["url"] = newURL
					delete(p, "oldUrl")
					delete(p, "_old")
					userChanged = true
					break
				}
			}
		}

		if userChanged {
			updatedBytes, err := json.Marshal(patterns)
			if err != nil {
				continue
			}
			toUpdate = append(toUpdate, userUpdate{
				id:          uID,
				newPatterns: updatedBytes,
			})
		}
	}

	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("error iterating managed users: %w", err)
	}

	if len(toUpdate) == 0 {
		return 0, nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("failed starting transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, "UPDATE managed_users SET patterns = ?, updatedAt = NOW() WHERE list_id = ? AND id = ?")
	if err != nil {
		return 0, fmt.Errorf("failed preparing update statement: %w", err)
	}
	defer stmt.Close()

	for _, u := range toUpdate {
		if _, err := stmt.ExecContext(ctx, string(u.newPatterns), listID, u.id); err != nil {
			return 0, fmt.Errorf("failed updating user %d patterns: %w", u.id, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed committing pattern updates: %w", err)
	}

	return len(toUpdate), nil
}

// SetUserSuspension updates suspension and compromised status for a user by username.
func (r *UserRepo) SetUserSuspension(ctx context.Context, username string, isSuspended, isCompromised bool, reason *string) error {
	var suspendedInt, compromisedInt int
	if isSuspended {
		suspendedInt = 1
	}
	if isCompromised {
		compromisedInt = 1
	}
	var compAt *time.Time
	if isCompromised {
		now := time.Now().UTC()
		compAt = &now
	}
	query := `UPDATE managed_users SET is_suspended = ?, is_compromised = ?, compromised_reason = ?, compromised_at = ?, updatedAt = NOW() WHERE username = ?`
	_, err := r.db.ExecContext(ctx, query, suspendedInt, compromisedInt, reason, compAt, username)
	return err
}

const userRepoCharset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz123456789"

func userRepoRandomText(baseLength int, variance int) string {
	length := baseLength
	if variance > 0 {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(variance)))
		if err == nil {
			length += int(n.Int64())
		}
	}

	result := make([]byte, length)
	charsetLen := big.NewInt(int64(len(userRepoCharset)))
	for i := 0; i < length; i++ {
		idx, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			result[i] = userRepoCharset[0]
		} else {
			result[i] = userRepoCharset[idx.Int64()]
		}
	}
	return string(result)
}

func (r *UserRepo) GenerateUniqueM3U(ctx context.Context) (string, error) {
	for {
		str := userRepoRandomText(11, 4)
		taken, err := r.IsM3UTaken(ctx, str, 0, 0)
		if err != nil {
			return "", err
		}
		if !taken {
			return str, nil
		}
	}
}

func (r *UserRepo) GenerateUniqueEPG(ctx context.Context) (string, error) {
	for {
		str := userRepoRandomText(14, 4)
		taken, err := r.IsEPGTaken(ctx, str, 0, 0)
		if err != nil {
			return "", err
		}
		if !taken {
			return str, nil
		}
	}
}

// ImportUsers imports managed users from IPTVEditor Token API with "skip" or "overwrite" mode.
func (r *UserRepo) ImportUsers(ctx context.Context, listID uint64, users []client.ClientManagedUser, mode string) (*models.ImportUsersResult, error) {
	cleanMode := strings.ToLower(strings.TrimSpace(mode))
	if cleanMode != "overwrite" {
		cleanMode = "skip"
	}

	res := &models.ImportUsersResult{
		TotalProcessed: len(users),
	}

	for i, u := range users {
		username := strings.TrimSpace(u.Username)
		if username == "" {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("User #%d skipped: empty username", i+1))
			continue
		}

		userID := u.ID.Int()
		if userID <= 0 {
			nextID, err := r.GetNextID(ctx, listID)
			if err != nil {
				res.Skipped++
				res.Errors = append(res.Errors, fmt.Sprintf("User '%s': failed generating ID: %v", username, err))
				continue
			}
			userID = nextID
		}

		existingByID, err := r.GetUserByID(ctx, listID, userID)
		if err != nil {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("User '%s': check by ID error: %v", username, err))
			continue
		}

		existingByUsername, err := r.GetUserByUsername(ctx, username)
		if err != nil {
			res.Skipped++
			res.Errors = append(res.Errors, fmt.Sprintf("User '%s': check by username error: %v", username, err))
			continue
		}

		userExists := existingByID != nil || existingByUsername != nil

		if cleanMode == "skip" {
			if userExists {
				res.Skipped++
				continue
			}

			// Insert new user
			m3u := strings.TrimSpace(u.M3U)
			if m3u == "" {
				if newM3U, err := r.GenerateUniqueM3U(ctx); err == nil {
					m3u = newM3U
				}
			} else if taken, _ := r.IsM3UTaken(ctx, m3u, 0, 0); taken {
				if newM3U, err := r.GenerateUniqueM3U(ctx); err == nil {
					m3u = newM3U
				}
			}

			epg := strings.TrimSpace(u.EPG)
			if epg == "" {
				if newEPG, err := r.GenerateUniqueEPG(ctx); err == nil {
					epg = newEPG
				}
			} else if taken, _ := r.IsEPGTaken(ctx, epg, 0, 0); taken {
				if newEPG, err := r.GenerateUniqueEPG(ctx); err == nil {
					epg = newEPG
				}
			}

			if idTaken, _ := r.IsIDTaken(ctx, listID, userID); idTaken {
				nextID, err := r.GetNextID(ctx, listID)
				if err == nil {
					userID = nextID
				}
			}

			maxConn := u.MaxConnections.Int()
			if maxConn <= 0 {
				maxConn = 1
			}

			var chanCat, vodCat, serCat, userSettings *string
			if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
				s := string(u.ChannelsCategories)
				chanCat = &s
			}
			if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
				s := string(u.VodsCategories)
				vodCat = &s
			}
			if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
				s := string(u.SeriesCategories)
				serCat = &s
			}
			if len(u.UserSettings) > 0 {
				userSettings = util.NormalizeUserSettings(u.UserSettings)
				if userSettings != nil {
					u.UserSettings = []byte(*userSettings)
				}
			}

			patternsStr := string(u.Patterns)
			if patternsStr == "" || patternsStr == "null" {
				patternsStr = "[]"
			}

			syncExpiryInt := 0
			if u.SyncExpiryDate.Bool() {
				syncExpiryInt = 1
			}

			insertQuery := `
				INSERT INTO managed_users (
					list_id, id, name, expiry,
					channels_categories, vods_categories, series_categories,
					m3u, epg, username, password, patterns,
					note, language, message, max_connections, sync_expiry_date,
					user_settings, createdAt, updatedAt
				) VALUES (
					?, ?, ?, ?,
					?, ?, ?,
					?, ?, ?, ?, ?,
					?, ?, ?, ?, ?,
					?, NOW(), NOW()
				)
			`
			_, err = r.db.ExecContext(ctx, insertQuery,
				listID, userID, u.Name, u.Expiry.ToTimePtr(),
				chanCat, vodCat, serCat,
				m3u, epg, username, u.Password, patternsStr,
				u.Note, u.Language, u.Message, maxConn, syncExpiryInt,
				userSettings,
			)
			if err != nil {
				res.Skipped++
				res.Errors = append(res.Errors, fmt.Sprintf("User '%s': insert failed: %v", username, err))
			} else {
				res.Imported++
			}

		} else {
			// Overwrite mode
			if userExists {
				targetListID := listID
				targetID := userID
				if existingByID != nil {
					targetID = existingByID.ID
				} else if existingByUsername != nil {
					targetListID = existingByUsername.ListID
					targetID = existingByUsername.ID
				}

				m3u := strings.TrimSpace(u.M3U)
				if m3u == "" {
					if existingByID != nil {
						m3u = existingByID.M3U
					} else if existingByUsername != nil {
						m3u = existingByUsername.M3U
					}
				} else if taken, _ := r.IsM3UTaken(ctx, m3u, targetListID, targetID); taken {
					if existingByID != nil {
						m3u = existingByID.M3U
					} else if existingByUsername != nil {
						m3u = existingByUsername.M3U
					}
				}

				epg := strings.TrimSpace(u.EPG)
				if epg == "" {
					if existingByID != nil {
						epg = existingByID.EPG
					} else if existingByUsername != nil {
						epg = existingByUsername.EPG
					}
				} else if taken, _ := r.IsEPGTaken(ctx, epg, targetListID, targetID); taken {
					if existingByID != nil {
						epg = existingByID.EPG
					} else if existingByUsername != nil {
						epg = existingByUsername.EPG
					}
				}

				maxConn := u.MaxConnections.Int()
				if maxConn <= 0 {
					if existingByID != nil && existingByID.MaxConnections > 0 {
						maxConn = existingByID.MaxConnections
					} else {
						maxConn = 1
					}
				}

				var chanCat, vodCat, serCat, userSettings *string
				if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
					s := string(u.ChannelsCategories)
					chanCat = &s
				}
				if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
					s := string(u.VodsCategories)
					vodCat = &s
				}
				if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
					s := string(u.SeriesCategories)
					serCat = &s
				}
				if len(u.UserSettings) > 0 {
					userSettings = util.NormalizeUserSettings(u.UserSettings)
					if userSettings != nil {
						u.UserSettings = []byte(*userSettings)
					}
				}

				patternsStr := string(u.Patterns)
				if patternsStr == "" || patternsStr == "null" {
					patternsStr = "[]"
				}

				syncExpiryInt := 0
				if u.SyncExpiryDate.Bool() {
					syncExpiryInt = 1
				}

				updateQuery := `
					UPDATE managed_users SET
						name = ?,
						expiry = ?,
						channels_categories = ?,
						vods_categories = ?,
						series_categories = ?,
						m3u = ?,
						epg = ?,
						username = ?,
						password = ?,
						patterns = ?,
						note = ?,
						language = ?,
						message = ?,
						max_connections = ?,
						sync_expiry_date = ?,
						user_settings = ?,
						updatedAt = NOW()
					WHERE list_id = ? AND id = ?
				`
				_, err = r.db.ExecContext(ctx, updateQuery,
					u.Name, u.Expiry.ToTimePtr(),
					chanCat, vodCat, serCat,
					m3u, epg, username, u.Password, patternsStr,
					u.Note, u.Language, u.Message, maxConn, syncExpiryInt,
					userSettings,
					targetListID, targetID,
				)
				if err != nil {
					res.Skipped++
					res.Errors = append(res.Errors, fmt.Sprintf("User '%s': update failed: %v", username, err))
				} else {
					res.Updated++
				}
			} else {
				// User does not exist, insert as new
				m3u := strings.TrimSpace(u.M3U)
				if m3u == "" {
					if newM3U, err := r.GenerateUniqueM3U(ctx); err == nil {
						m3u = newM3U
					}
				} else if taken, _ := r.IsM3UTaken(ctx, m3u, 0, 0); taken {
					if newM3U, err := r.GenerateUniqueM3U(ctx); err == nil {
						m3u = newM3U
					}
				}

				epg := strings.TrimSpace(u.EPG)
				if epg == "" {
					if newEPG, err := r.GenerateUniqueEPG(ctx); err == nil {
						epg = newEPG
					}
				} else if taken, _ := r.IsEPGTaken(ctx, epg, 0, 0); taken {
					if newEPG, err := r.GenerateUniqueEPG(ctx); err == nil {
						epg = newEPG
					}
				}

				if idTaken, _ := r.IsIDTaken(ctx, listID, userID); idTaken {
					nextID, err := r.GetNextID(ctx, listID)
					if err == nil {
						userID = nextID
					}
				}

				maxConn := u.MaxConnections.Int()
				if maxConn <= 0 {
					maxConn = 1
				}

				var chanCat, vodCat, serCat, userSettings *string
				if len(u.ChannelsCategories) > 0 && string(u.ChannelsCategories) != "null" {
					s := string(u.ChannelsCategories)
					chanCat = &s
				}
				if len(u.VodsCategories) > 0 && string(u.VodsCategories) != "null" {
					s := string(u.VodsCategories)
					vodCat = &s
				}
				if len(u.SeriesCategories) > 0 && string(u.SeriesCategories) != "null" {
					s := string(u.SeriesCategories)
					serCat = &s
				}
				if len(u.UserSettings) > 0 {
					userSettings = util.NormalizeUserSettings(u.UserSettings)
					if userSettings != nil {
						u.UserSettings = []byte(*userSettings)
					}
				}

				patternsStr := string(u.Patterns)
				if patternsStr == "" || patternsStr == "null" {
					patternsStr = "[]"
				}

				syncExpiryInt := 0
				if u.SyncExpiryDate.Bool() {
					syncExpiryInt = 1
				}

				insertQuery := `
					INSERT INTO managed_users (
						list_id, id, name, expiry,
						channels_categories, vods_categories, series_categories,
						m3u, epg, username, password, patterns,
						note, language, message, max_connections, sync_expiry_date,
						user_settings, createdAt, updatedAt
					) VALUES (
						?, ?, ?, ?,
						?, ?, ?,
						?, ?, ?, ?, ?,
						?, ?, ?, ?, ?,
						?, NOW(), NOW()
					)
				`
				_, err = r.db.ExecContext(ctx, insertQuery,
					listID, userID, u.Name, u.Expiry.ToTimePtr(),
					chanCat, vodCat, serCat,
					m3u, epg, username, u.Password, patternsStr,
					u.Note, u.Language, u.Message, maxConn, syncExpiryInt,
					userSettings,
				)
				if err != nil {
					res.Skipped++
					res.Errors = append(res.Errors, fmt.Sprintf("User '%s': insert failed: %v", username, err))
				} else {
					res.Imported++
				}
			}
		}
	}

	return res, nil
}


