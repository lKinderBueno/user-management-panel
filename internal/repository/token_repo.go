package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

type TokenRepo struct {
	db *sql.DB
}

func NewTokenRepo(db *sql.DB) *TokenRepo {
	return &TokenRepo{db: db}
}

// CreateToken inserts a new API token into the database.
func (r *TokenRepo) CreateToken(ctx context.Context, adminID int, name, tokenHash, tokenPrefix, passwordHash, allowedIPs string, allowedPlaylistIDs models.Uint64Slice, expiresAt *time.Time) (*models.APIToken, error) {
	hasPassword := 0
	var pwdHashVal interface{}
	if passwordHash != "" {
		hasPassword = 1
		pwdHashVal = passwordHash
	}

	var allowedIPsVal interface{}
	allowedIPs = strings.TrimSpace(allowedIPs)
	if allowedIPs != "" {
		allowedIPsVal = allowedIPs
	}

	var allowedPlaylistsVal interface{}
	if len(allowedPlaylistIDs) > 0 {
		if b, err := json.Marshal(allowedPlaylistIDs); err == nil {
			allowedPlaylistsVal = string(b)
		}
	}

	query := `
		INSERT INTO api_tokens (admin_id, name, token_hash, token_prefix, password_hash, has_password, allowed_ips, allowed_playlist_ids, expires_at, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
	`
	res, err := r.db.ExecContext(ctx, query, adminID, name, tokenHash, tokenPrefix, pwdHashVal, hasPassword, allowedIPsVal, allowedPlaylistsVal, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("failed creating api token: %w", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	token := &models.APIToken{
		ID:                 uint64(id),
		AdminID:            adminID,
		Name:               name,
		TokenPrefix:        tokenPrefix,
		HasPassword:        hasPassword == 1,
		AllowedIPs:         allowedIPs,
		AllowedPlaylistIDs: allowedPlaylistIDs,
		ExpiresAt:          expiresAt,
		IsActive:           true,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	return token, nil
}

// GetTokensByAdminID retrieves all API tokens belonging to the specified admin/collaborator.
func (r *TokenRepo) GetTokensByAdminID(ctx context.Context, adminID int) ([]models.APIToken, error) {
	query := `
		SELECT id, admin_id, name, token_prefix, has_password, COALESCE(allowed_ips, ''), COALESCE(allowed_playlist_ids, ''), last_used_at, expires_at, is_active, created_at, updated_at
		FROM api_tokens
		WHERE admin_id = ?
		ORDER BY id DESC
	`
	rows, err := r.db.QueryContext(ctx, query, adminID)
	if err != nil {
		return nil, fmt.Errorf("failed fetching api tokens: %w", err)
	}
	defer rows.Close()

	var tokens []models.APIToken
	for rows.Next() {
		var t models.APIToken
		var hasPasswordInt, isActiveInt int
		var allowedPlaylistsStr string
		err := rows.Scan(
			&t.ID, &t.AdminID, &t.Name, &t.TokenPrefix, &hasPasswordInt, &t.AllowedIPs,
			&allowedPlaylistsStr,
			&t.LastUsedAt, &t.ExpiresAt, &isActiveInt, &t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed scanning api token: %w", err)
		}
		t.HasPassword = hasPasswordInt == 1
		t.IsActive = isActiveInt == 1
		if strings.TrimSpace(allowedPlaylistsStr) != "" {
			_ = json.Unmarshal([]byte(allowedPlaylistsStr), &t.AllowedPlaylistIDs)
		}
		tokens = append(tokens, t)
	}

	if tokens == nil {
		tokens = []models.APIToken{}
	}
	return tokens, nil
}

// GetTokenByID retrieves a single API token by its primary key ID.
func (r *TokenRepo) GetTokenByID(ctx context.Context, tokenID uint64) (*models.APIToken, string, error) {
	query := `
		SELECT id, admin_id, name, token_prefix, COALESCE(password_hash, ''), has_password, 
		       COALESCE(allowed_ips, ''), COALESCE(allowed_playlist_ids, ''), 
		       last_used_at, expires_at, is_active, created_at, updated_at
		FROM api_tokens
		WHERE id = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, tokenID)
	var t models.APIToken
	var pwdHash string
	var hasPasswordInt, isActiveInt int
	var allowedPlaylistsStr string

	err := row.Scan(
		&t.ID, &t.AdminID, &t.Name, &t.TokenPrefix, &pwdHash, &hasPasswordInt,
		&t.AllowedIPs, &allowedPlaylistsStr,
		&t.LastUsedAt, &t.ExpiresAt, &isActiveInt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", nil
		}
		return nil, "", err
	}
	t.HasPassword = hasPasswordInt == 1
	t.IsActive = isActiveInt == 1
	if strings.TrimSpace(allowedPlaylistsStr) != "" {
		_ = json.Unmarshal([]byte(allowedPlaylistsStr), &t.AllowedPlaylistIDs)
	}
	return &t, pwdHash, nil
}

// UpdateToken updates parameters of an existing API token.
func (r *TokenRepo) UpdateToken(ctx context.Context, tokenID uint64, adminID int, isSuperAdmin bool, name string, allowedIPs string, allowedPlaylistIDs models.Uint64Slice, passwordHash *string, removePassword bool) (*models.APIToken, error) {
	existing, _, err := r.GetTokenByID(ctx, tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed fetching token: %w", err)
	}
	if existing == nil {
		return nil, errors.New("token not found")
	}
	if !isSuperAdmin && existing.AdminID != adminID {
		return nil, errors.New("not authorized to edit this token")
	}

	setClauses := []string{"name = ?", "allowed_ips = ?", "allowed_playlist_ids = ?", "updated_at = NOW()"}
	var allowedIPsVal interface{}
	allowedIPs = strings.TrimSpace(allowedIPs)
	if allowedIPs != "" {
		allowedIPsVal = allowedIPs
	}

	var allowedPlaylistsVal interface{}
	if len(allowedPlaylistIDs) > 0 {
		if b, err := json.Marshal(allowedPlaylistIDs); err == nil {
			allowedPlaylistsVal = string(b)
		}
	}

	args := []interface{}{name, allowedIPsVal, allowedPlaylistsVal}

	if removePassword {
		setClauses = append(setClauses, "password_hash = NULL", "has_password = 0")
	} else if passwordHash != nil && *passwordHash != "" {
		setClauses = append(setClauses, "password_hash = ?", "has_password = 1")
		args = append(args, *passwordHash)
	}

	whereClause := "WHERE id = ?"
	args = append(args, tokenID)
	if !isSuperAdmin {
		whereClause += " AND admin_id = ?"
		args = append(args, adminID)
	}

	query := fmt.Sprintf("UPDATE api_tokens SET %s %s", strings.Join(setClauses, ", "), whereClause)
	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed updating token: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if rows == 0 {
		return existing, nil
	}

	updated, _, err := r.GetTokenByID(ctx, tokenID)
	return updated, err
}

// GetTokenByHash looks up an active token by its SHA-256 hash and retrieves the token, password hash, and the associated admin.
func (r *TokenRepo) GetTokenByHash(ctx context.Context, tokenHash string) (*models.APIToken, string, *models.Admin, error) {
	query := `
		SELECT 
			t.id, t.admin_id, t.name, t.token_prefix, COALESCE(t.password_hash, ''), t.has_password, 
			COALESCE(t.allowed_ips, ''), COALESCE(t.allowed_playlist_ids, ''),
			t.last_used_at, t.expires_at, t.is_active, t.created_at, t.updated_at,
			a.id, a.username, COALESCE(a.role, 'collaborator'), 
			COALESCE(a.manage_all_playlists, 1), COALESCE(a.can_see_all_users, 1),
			COALESCE(a.can_create_collaborators, 0), COALESCE(a.can_create_admins, 0),
			COALESCE(a.can_manage_api_tokens, 0), a.created_by
		FROM api_tokens t
		INNER JOIN admins a ON t.admin_id = a.id
		WHERE t.token_hash = ?
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, tokenHash)

	var t models.APIToken
	var a models.Admin
	var pwdHash string
	var hasPasswordInt, isActiveInt int
	var allowedPlaylistsStr string
	var manageAll, canSeeAll, canCreateCollabs, canCreateAdmins, canManageAPITokens int

	err := row.Scan(
		&t.ID, &t.AdminID, &t.Name, &t.TokenPrefix, &pwdHash, &hasPasswordInt,
		&t.AllowedIPs, &allowedPlaylistsStr,
		&t.LastUsedAt, &t.ExpiresAt, &isActiveInt, &t.CreatedAt, &t.UpdatedAt,
		&a.ID, &a.Username, &a.Role,
		&manageAll, &canSeeAll,
		&canCreateCollabs, &canCreateAdmins,
		&canManageAPITokens, &a.CreatedBy,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", nil, nil
		}
		return nil, "", nil, fmt.Errorf("failed looking up api token: %w", err)
	}

	t.HasPassword = hasPasswordInt == 1
	t.IsActive = isActiveInt == 1
	if strings.TrimSpace(allowedPlaylistsStr) != "" {
		_ = json.Unmarshal([]byte(allowedPlaylistsStr), &t.AllowedPlaylistIDs)
	}

	a.ManageAllPlaylists = manageAll == 1 || a.Role == "admin"
	a.CanSeeAllUsers = canSeeAll == 1 || a.Role == "admin"
	a.CanCreateCollaborators = canCreateCollabs == 1
	a.CanCreateAdmins = canCreateAdmins == 1 && a.Role == "admin"
	a.CanManageAPITokens = canManageAPITokens == 1 || a.Role == "admin"

	return &t, pwdHash, &a, nil
}

// UpdateLastUsed updates the last_used_at timestamp for a token.
func (r *TokenRepo) UpdateLastUsed(ctx context.Context, tokenID uint64) error {
	_, err := r.db.ExecContext(ctx, "UPDATE api_tokens SET last_used_at = NOW() WHERE id = ?", tokenID)
	return err
}

// DeleteToken revokes and permanently deletes an API token.
func (r *TokenRepo) DeleteToken(ctx context.Context, tokenID uint64, adminID int, isSuperAdmin bool) error {
	var query string
	var args []interface{}
	if isSuperAdmin {
		query = "DELETE FROM api_tokens WHERE id = ?"
		args = []interface{}{tokenID}
	} else {
		query = "DELETE FROM api_tokens WHERE id = ? AND admin_id = ?"
		args = []interface{}{tokenID, adminID}
	}

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed deleting api token: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("token not found or not authorized to delete")
	}
	return nil
}

// ToggleToken activates or deactivates an API token.
func (r *TokenRepo) ToggleToken(ctx context.Context, tokenID uint64, adminID int, isActive bool, isSuperAdmin bool) error {
	activeInt := 0
	if isActive {
		activeInt = 1
	}

	var query string
	var args []interface{}
	if isSuperAdmin {
		query = "UPDATE api_tokens SET is_active = ?, updated_at = NOW() WHERE id = ?"
		args = []interface{}{activeInt, tokenID}
	} else {
		query = "UPDATE api_tokens SET is_active = ?, updated_at = NOW() WHERE id = ? AND admin_id = ?"
		args = []interface{}{activeInt, tokenID, adminID}
	}

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed toggling api token: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.New("token not found or not authorized to modify")
	}
	return nil
}
