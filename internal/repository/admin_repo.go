package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
	"playlistlabs_user_management_os/internal/models"
)

type AdminRepo struct {
	db *sql.DB
}

type TeamRepo = AdminRepo

func NewAdminRepo(db *sql.DB) *AdminRepo {
	return &AdminRepo{db: db}
}

func NewTeamRepo(db *sql.DB) *TeamRepo {
	return NewAdminRepo(db)
}

// EnsureSchema applies schema migrations for team management safely.
func (r *AdminRepo) EnsureSchema(ctx context.Context) error {
	queries := []string{
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'collaborator'`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS manage_all_playlists TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS can_see_all_users TINYINT(1) NOT NULL DEFAULT 1`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS can_create_collaborators TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS can_create_admins TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS can_manage_api_tokens TINYINT(1) NOT NULL DEFAULT 0`,
		`ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by INT NULL`,
		`UPDATE admins SET role = 'collaborator' WHERE role = 'subadmin'`,
		`UPDATE admins SET role = 'admin', can_create_collaborators = 1, can_create_admins = 1, can_manage_api_tokens = 1 WHERE username = 'admin'`,
		`UPDATE admins SET can_create_collaborators = 1, can_create_admins = 1, can_manage_api_tokens = 1 WHERE role = 'admin' AND (created_by IS NULL OR id = 1)`,
		`CREATE TABLE IF NOT EXISTS team_playlists (
			admin_id INT NOT NULL,
			playlist_id BIGINT UNSIGNED NOT NULL,
			PRIMARY KEY (admin_id, playlist_id),
			CONSTRAINT fk_team_playlists_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
			CONSTRAINT fk_team_playlists_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE INDEX IF NOT EXISTS idx_team_playlists_playlist ON team_playlists (playlist_id)`,
		`CREATE TABLE IF NOT EXISTS admin_playlists (
			admin_id INT NOT NULL,
			playlist_id BIGINT UNSIGNED NOT NULL,
			PRIMARY KEY (admin_id, playlist_id),
			CONSTRAINT fk_admin_playlists_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE,
			CONSTRAINT fk_admin_playlists_playlist FOREIGN KEY (playlist_id) REFERENCES playlists (id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`INSERT IGNORE INTO team_playlists (admin_id, playlist_id) SELECT admin_id, playlist_id FROM admin_playlists`,
		`ALTER TABLE managed_users ADD COLUMN IF NOT EXISTS created_by_admin_id INT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_managed_users_created_by ON managed_users (created_by_admin_id)`,
		`CREATE TABLE IF NOT EXISTS api_tokens (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			admin_id INT NOT NULL,
			name VARCHAR(255) NOT NULL,
			token_hash VARCHAR(64) NOT NULL UNIQUE,
			token_prefix VARCHAR(64) NOT NULL,
			password_hash VARCHAR(255) NULL,
			has_password TINYINT(1) NOT NULL DEFAULT 0,
			allowed_ips TEXT NULL,
			allowed_playlist_ids TEXT NULL,
			last_used_at DATETIME NULL,
			expires_at DATETIME NULL,
			is_active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			CONSTRAINT fk_api_tokens_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`ALTER TABLE api_tokens MODIFY COLUMN token_prefix VARCHAR(64) NOT NULL`,
		`ALTER TABLE api_tokens MODIFY COLUMN name VARCHAR(255) NOT NULL`,
		`ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS allowed_ips TEXT NULL`,
		`ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS allowed_playlist_ids TEXT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_api_tokens_admin ON api_tokens (admin_id)`,
		`CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens (token_hash)`,
		`CREATE TABLE IF NOT EXISTS playlist_sync_logs (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			playlist_id BIGINT UNSIGNED NULL,
			playlist_name VARCHAR(255) NOT NULL DEFAULT '',
			sync_type VARCHAR(50) NOT NULL DEFAULT 'playlist',
			status VARCHAR(50) NOT NULL DEFAULT 'success',
			channels_count INT NOT NULL DEFAULT 0,
			movies_count INT NOT NULL DEFAULT 0,
			series_count INT NOT NULL DEFAULT 0,
			episodes_count INT NOT NULL DEFAULT 0,
			epg_count INT NOT NULL DEFAULT 0,
			message TEXT NULL,
			details LONGTEXT NULL,
			duration_ms INT NOT NULL DEFAULT 0,
			created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			PRIMARY KEY (id),
			KEY idx_sync_logs_playlist_created (playlist_id, created_at),
			KEY idx_sync_logs_created_at (created_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
	}

	for _, q := range queries {
		if _, err := r.db.ExecContext(ctx, q); err != nil {
			log.Printf("[WARN] EnsureSchema statement execution: %v (query: %s)", err, q)
		}
	}
	return nil
}

func (r *AdminRepo) EnsureDefaultAdmin(ctx context.Context) error {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admins WHERE id = 1").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count admins: %w", err)
	}

	if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed to hash default admin password: %w", err)
		}
		_, err = r.db.ExecContext(ctx, `
			INSERT INTO admins (id, username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins, can_manage_api_tokens) 
			VALUES (1, ?, ?, 'admin', 1, 1, 1, 1, 1)
			ON DUPLICATE KEY UPDATE username = 'admin'
		`, "admin", string(hash))
		if err != nil {
			return fmt.Errorf("failed to insert default admin: %w", err)
		}
		log.Println("[INFO] Created default admin account (username: admin, password: admin123)")
	}
	return nil
}

// UpsertInitialAdmin initializes or updates the master admin account during onboarding.
func (r *AdminRepo) UpsertInitialAdmin(ctx context.Context, username, plainPassword string) (*models.Admin, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed hashing password: %w", err)
	}

	var existingID int
	err = r.db.QueryRowContext(ctx, "SELECT id FROM admins ORDER BY id ASC LIMIT 1").Scan(&existingID)
	if err == sql.ErrNoRows {
		res, err := r.db.ExecContext(ctx, `
			INSERT INTO admins (username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins, can_manage_api_tokens) 
			VALUES (?, ?, 'admin', 1, 1, 1, 1, 1)
		`, username, string(hash))
		if err != nil {
			return nil, fmt.Errorf("failed creating initial admin: %w", err)
		}
		id, err := res.LastInsertId()
		if err != nil {
			return nil, err
		}
		return &models.Admin{
			ID:                     int(id),
			Username:               username,
			Role:                   "admin",
			ManageAllPlaylists:     true,
			CanSeeAllUsers:         true,
			CanCreateCollaborators: true,
			CanCreateAdmins:        true,
			CanManageAPITokens:     true,
		}, nil
	} else if err != nil {
		return nil, fmt.Errorf("failed checking existing admins: %w", err)
	}

	// Update existing admin record
	_, err = r.db.ExecContext(ctx, `
		UPDATE admins 
		SET username = ?, password_hash = ?, role = 'admin', manage_all_playlists = 1, can_see_all_users = 1, can_create_collaborators = 1, can_create_admins = 1, can_manage_api_tokens = 1, updated_at = NOW() 
		WHERE id = ?
	`, username, string(hash), existingID)
	if err != nil {
		return nil, fmt.Errorf("failed updating initial admin: %w", err)
	}

	// Remove any temporary unconfigured secondary admin accounts if any exist
	_, _ = r.db.ExecContext(ctx, "DELETE FROM admins WHERE id != ?", existingID)

	return &models.Admin{
		ID:                     existingID,
		Username:               username,
		Role:                   "admin",
		ManageAllPlaylists:     true,
		CanSeeAllUsers:         true,
		CanCreateCollaborators: true,
		CanCreateAdmins:        true,
		CanManageAPITokens:     true,
	}, nil
}

func (r *AdminRepo) CountAdmins(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admins WHERE role = 'admin'").Scan(&count)
	return count, err
}

func (r *AdminRepo) GetByUsername(ctx context.Context, username string) (*models.Admin, error) {
	query := `
		SELECT a.id, a.username, a.password_hash, COALESCE(a.role, 'admin'), 
		       COALESCE(a.manage_all_playlists, 1), COALESCE(a.can_see_all_users, 1), 
		       COALESCE(a.can_create_collaborators, 0), COALESCE(a.can_create_admins, 0),
		       COALESCE(a.can_manage_api_tokens, 0),
		       a.created_by, c.username, a.created_at, a.updated_at 
		FROM admins a
		LEFT JOIN admins c ON a.created_by = c.id
		WHERE a.username = ? 
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, username)

	var a models.Admin
	var manageAll, canSeeAll, canCreateCollabs, canCreateAdmins, canManageAPITokens int
	var creatorUser sql.NullString
	if err := row.Scan(&a.ID, &a.Username, &a.PasswordHash, &a.Role, &manageAll, &canSeeAll, &canCreateCollabs, &canCreateAdmins, &canManageAPITokens, &a.CreatedBy, &creatorUser, &a.CreatedAt, &a.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	a.ManageAllPlaylists = manageAll == 1
	a.CanSeeAllUsers = canSeeAll == 1
	a.CanCreateCollaborators = canCreateCollabs == 1
	a.CanCreateAdmins = canCreateAdmins == 1 && a.Role == "admin"
	a.CanManageAPITokens = canManageAPITokens == 1 || a.Role == "admin"
	if creatorUser.Valid {
		a.CreatedByUsername = &creatorUser.String
	}

	if !a.ManageAllPlaylists {
		allowed, err := r.GetAllowedPlaylistIDs(ctx, a.ID)
		if err != nil {
			return nil, err
		}
		a.AllowedPlaylistIDs = allowed
	} else {
		a.AllowedPlaylistIDs = models.Uint64Slice{}
	}

	return &a, nil
}

func (r *AdminRepo) GetByID(ctx context.Context, id int) (*models.Admin, error) {
	query := `
		SELECT a.id, a.username, a.password_hash, COALESCE(a.role, 'admin'), 
		       COALESCE(a.manage_all_playlists, 1), COALESCE(a.can_see_all_users, 1), 
		       COALESCE(a.can_create_collaborators, 0), COALESCE(a.can_create_admins, 0),
		       COALESCE(a.can_manage_api_tokens, 0),
		       a.created_by, c.username, a.created_at, a.updated_at 
		FROM admins a
		LEFT JOIN admins c ON a.created_by = c.id
		WHERE a.id = ? 
		LIMIT 1
	`
	row := r.db.QueryRowContext(ctx, query, id)

	var a models.Admin
	var manageAll, canSeeAll, canCreateCollabs, canCreateAdmins, canManageAPITokens int
	var creatorUser sql.NullString
	if err := row.Scan(&a.ID, &a.Username, &a.PasswordHash, &a.Role, &manageAll, &canSeeAll, &canCreateCollabs, &canCreateAdmins, &canManageAPITokens, &a.CreatedBy, &creatorUser, &a.CreatedAt, &a.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	a.ManageAllPlaylists = manageAll == 1
	a.CanSeeAllUsers = canSeeAll == 1
	a.CanCreateCollaborators = canCreateCollabs == 1
	a.CanCreateAdmins = canCreateAdmins == 1 && a.Role == "admin"
	a.CanManageAPITokens = canManageAPITokens == 1 || a.Role == "admin"
	if creatorUser.Valid {
		a.CreatedByUsername = &creatorUser.String
	}

	if !a.ManageAllPlaylists {
		allowed, err := r.GetAllowedPlaylistIDs(ctx, a.ID)
		if err != nil {
			return nil, err
		}
		a.AllowedPlaylistIDs = allowed
	} else {
		a.AllowedPlaylistIDs = models.Uint64Slice{}
	}

	return &a, nil
}

func (r *AdminRepo) GetAllowedPlaylistIDs(ctx context.Context, adminID int) (models.Uint64Slice, error) {
	query := `SELECT playlist_id FROM team_playlists WHERE admin_id = ? ORDER BY playlist_id ASC`
	rows, err := r.db.QueryContext(ctx, query, adminID)
	if err != nil {
		// Fallback to legacy admin_playlists
		query = `SELECT playlist_id FROM admin_playlists WHERE admin_id = ? ORDER BY playlist_id ASC`
		rows, err = r.db.QueryContext(ctx, query, adminID)
		if err != nil {
			return nil, fmt.Errorf("failed to query allowed playlists: %w", err)
		}
	}
	defer rows.Close()

	var ids models.Uint64Slice
	for rows.Next() {
		var pid uint64
		if err := rows.Scan(&pid); err != nil {
			return nil, err
		}
		ids = append(ids, pid)
	}
	if ids == nil {
		ids = models.Uint64Slice{}
	}
	return ids, nil
}

// GetTeamMembers returns team members.
// If requester is admin, returns the entire team hierarchy.
// If requester is a collaborator with can_create_collaborators, returns only their descendants.
func (r *AdminRepo) GetTeamMembers(ctx context.Context, requester *models.Admin) ([]models.Admin, error) {
	var query string
	var args []interface{}

	if requester == nil || requester.Role == "admin" {
		query = `
			SELECT a.id, a.username, a.role, 
			       COALESCE(a.manage_all_playlists, 1), 
			       COALESCE(a.can_see_all_users, 1), 
			       COALESCE(a.can_create_collaborators, 0),
			       COALESCE(a.can_create_admins, 0),
			       COALESCE(a.can_manage_api_tokens, 0),
			       a.created_by, c.username, a.created_at, a.updated_at 
			FROM admins a
			LEFT JOIN admins c ON a.created_by = c.id
			WHERE a.role IN ('admin', 'collaborator', 'subadmin') 
			ORDER BY a.id ASC
		`
	} else {
		// Scoped collaborator: use recursive CTE to get descendants only
		query = `
			WITH RECURSIVE team_hierarchy AS (
				SELECT id FROM admins WHERE id = ?
				UNION ALL
				SELECT a.id FROM admins a
				INNER JOIN team_hierarchy th ON a.created_by = th.id
			)
			SELECT a.id, a.username, a.role, 
			       COALESCE(a.manage_all_playlists, 1), 
			       COALESCE(a.can_see_all_users, 1), 
			       COALESCE(a.can_create_collaborators, 0),
			       COALESCE(a.can_create_admins, 0),
			       COALESCE(a.can_manage_api_tokens, 0),
			       a.created_by, c.username, a.created_at, a.updated_at 
			FROM admins a
			LEFT JOIN admins c ON a.created_by = c.id
			WHERE a.id IN (SELECT id FROM team_hierarchy WHERE id != ?)
			ORDER BY a.id ASC
		`
		args = append(args, requester.ID, requester.ID)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query team members: %w", err)
	}
	defer rows.Close()

	var members []models.Admin
	for rows.Next() {
		var a models.Admin
		var manageAll, canSeeAll, canCreateCollabs, canCreateAdmins, canManageAPITokens int
		var creatorUser sql.NullString
		err := rows.Scan(&a.ID, &a.Username, &a.Role, &manageAll, &canSeeAll, &canCreateCollabs, &canCreateAdmins, &canManageAPITokens, &a.CreatedBy, &creatorUser, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed scanning team row: %w", err)
		}
		if a.Role == "subadmin" {
			a.Role = "collaborator"
		}
		a.ManageAllPlaylists = manageAll == 1 || a.Role == "admin"
		a.CanSeeAllUsers = canSeeAll == 1 || a.Role == "admin"
		a.CanCreateCollaborators = canCreateCollabs == 1
		a.CanCreateAdmins = canCreateAdmins == 1 && a.Role == "admin"
		a.CanManageAPITokens = canManageAPITokens == 1 || a.Role == "admin"
		if creatorUser.Valid {
			a.CreatedByUsername = &creatorUser.String
		}

		if !a.ManageAllPlaylists && a.Role != "admin" {
			allowed, err := r.GetAllowedPlaylistIDs(ctx, a.ID)
			if err != nil {
				return nil, err
			}
			a.AllowedPlaylistIDs = allowed
		} else {
			a.AllowedPlaylistIDs = models.Uint64Slice{}
		}

		members = append(members, a)
	}

	if members == nil {
		members = []models.Admin{}
	}
	return members, nil
}

// CreateTeamMember creates a new admin or collaborator.
func (r *AdminRepo) CreateTeamMember(ctx context.Context, creator *models.Admin, m *models.Admin, plainPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed hashing password: %w", err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if creator != nil {
		m.CreatedBy = &creator.ID
		if creator.Role != "admin" {
			if !creator.CanCreateCollaborators {
				return errors.New("you do not have permission to create collaborators")
			}
			// Collaborators can ONLY create other collaborators
			m.Role = "collaborator"
			m.CanCreateAdmins = false
			if !creator.ManageAllPlaylists {
				m.ManageAllPlaylists = false
			}
			if !creator.CanManageAPITokens {
				m.CanManageAPITokens = false
			}
		} else {
			// Creator is an admin
			if m.Role == "admin" && !creator.CanCreateAdmins {
				return errors.New("you do not have permission to create administrators")
			}
			if m.Role == "collaborator" && !creator.CanCreateCollaborators {
				return errors.New("you do not have permission to create collaborators")
			}
		}
	}

	if m.Role == "" {
		m.Role = "collaborator"
	}

	if m.Role == "admin" {
		m.ManageAllPlaylists = true
		m.CanSeeAllUsers = true
		m.CanManageAPITokens = true
		m.AllowedPlaylistIDs = models.Uint64Slice{}

		// Creator cannot grant permissions greater than their own
		if creator != nil {
			if !creator.CanCreateAdmins {
				m.CanCreateAdmins = false
			}
			if !creator.CanCreateCollaborators {
				m.CanCreateCollaborators = false
			}
		}
	} else {
		m.CanCreateAdmins = false
	}

	manageAllInt := 0
	if m.ManageAllPlaylists {
		manageAllInt = 1
	}
	canSeeAllInt := 0
	if m.CanSeeAllUsers {
		canSeeAllInt = 1
	}
	canCreateCollabsInt := 0
	if m.CanCreateCollaborators {
		canCreateCollabsInt = 1
	}
	canCreateAdminsInt := 0
	if m.CanCreateAdmins {
		canCreateAdminsInt = 1
	}
	canManageAPITokensInt := 0
	if m.CanManageAPITokens {
		canManageAPITokensInt = 1
	}

	res, err := tx.ExecContext(ctx, `
		INSERT INTO admins (username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins, can_manage_api_tokens, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, m.Username, string(hash), m.Role, manageAllInt, canSeeAllInt, canCreateCollabsInt, canCreateAdminsInt, canManageAPITokensInt, m.CreatedBy)
	if err != nil {
		return fmt.Errorf("failed inserting team member: %w", err)
	}

	memberID, err := res.LastInsertId()
	if err != nil {
		return err
	}
	m.ID = int(memberID)

	if m.Role != "admin" && !m.ManageAllPlaylists && len(m.AllowedPlaylistIDs) > 0 {
		for _, pid := range m.AllowedPlaylistIDs {
			_, err = tx.ExecContext(ctx, `INSERT INTO team_playlists (admin_id, playlist_id) VALUES (?, ?)`, m.ID, pid)
			if err != nil {
				return fmt.Errorf("failed associating playlist %d: %w", pid, err)
			}
			// Also sync legacy table if exists
			_, _ = tx.ExecContext(ctx, `INSERT IGNORE INTO admin_playlists (admin_id, playlist_id) VALUES (?, ?)`, m.ID, pid)
		}
	}

	return tx.Commit()
}

// UpdateTeamMember updates an existing team member.
func (r *AdminRepo) UpdateTeamMember(ctx context.Context, updater *models.Admin, m *models.Admin, newPlainPassword string) error {
	existing, err := r.GetByID(ctx, m.ID)
	if err != nil || existing == nil {
		return errors.New("team member not found")
	}

	// Hierarchy check for non-admin updaters
	if updater != nil && updater.Role != "admin" {
		if existing.Role == "admin" {
			return errors.New("cannot edit an administrator")
		}
		if existing.CreatedBy == nil || *existing.CreatedBy != updater.ID {
			return errors.New("you can only edit collaborators you created")
		}
		// Non-admins cannot change role to admin
		m.Role = "collaborator"
		// Non-admins cannot grant can_manage_api_tokens if they don't have it
		if !updater.CanManageAPITokens {
			m.CanManageAPITokens = false
		}
	}

	// Anti-lockout: verify if demoting an admin
	if existing.Role == "admin" && m.Role == "collaborator" {
		if updater != nil && updater.ID == m.ID {
			return errors.New("you cannot demote your own administrator account")
		}
		var adminCount int
		_ = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admins WHERE role = 'admin'").Scan(&adminCount)
		if adminCount <= 1 {
			return errors.New("cannot demote the only remaining administrator")
		}
	}

	if m.Role == "" {
		m.Role = existing.Role
	}

	if m.Role == "admin" {
		if updater != nil && !updater.CanCreateAdmins && existing.Role != "admin" {
			return errors.New("you do not have permission to promote a member to administrator")
		}
		m.ManageAllPlaylists = true
		m.CanSeeAllUsers = true
		m.CanManageAPITokens = true
		m.AllowedPlaylistIDs = models.Uint64Slice{}

		if updater != nil {
			if !updater.CanCreateAdmins {
				m.CanCreateAdmins = false
			}
			if !updater.CanCreateCollaborators {
				m.CanCreateCollaborators = false
			}
		}
	} else {
		m.CanCreateAdmins = false
	}

	// Anti-lockout: verify we don't revoke can_create_admins from the last admin creator
	if existing.Role == "admin" && existing.CanCreateAdmins && !m.CanCreateAdmins {
		var activeAdminCreators int
		_ = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admins WHERE role = 'admin' AND can_create_admins = 1 AND id != ?", m.ID).Scan(&activeAdminCreators)
		if activeAdminCreators == 0 {
			return errors.New("cannot remove administrator creation permissions from the only remaining admin creator")
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	manageAllInt := 0
	if m.ManageAllPlaylists {
		manageAllInt = 1
	}
	canSeeAllInt := 0
	if m.CanSeeAllUsers {
		canSeeAllInt = 1
	}
	canCreateCollabsInt := 0
	if m.CanCreateCollaborators {
		canCreateCollabsInt = 1
	}
	canCreateAdminsInt := 0
	if m.CanCreateAdmins {
		canCreateAdminsInt = 1
	}
	canManageAPITokensInt := 0
	if m.CanManageAPITokens {
		canManageAPITokensInt = 1
	}

	// Cascade revocation to all descendant sub-collaborators if can_manage_api_tokens is revoked
	if existing.CanManageAPITokens && !m.CanManageAPITokens {
		_, err = tx.ExecContext(ctx, `
			WITH RECURSIVE team_hierarchy AS (
				SELECT id FROM admins WHERE id = ?
				UNION ALL
				SELECT a.id FROM admins a
				INNER JOIN team_hierarchy th ON a.created_by = th.id
			)
			UPDATE admins SET can_manage_api_tokens = 0 WHERE id IN (SELECT id FROM team_hierarchy WHERE id != ?)
		`, m.ID, m.ID)
		if err != nil {
			return fmt.Errorf("failed cascading api token permission revocation: %w", err)
		}
	}

	if newPlainPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(newPlainPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("failed hashing password: %w", err)
		}
		_, err = tx.ExecContext(ctx, `
			UPDATE admins 
			SET password_hash = ?, role = ?, manage_all_playlists = ?, can_see_all_users = ?, can_create_collaborators = ?, can_create_admins = ?, can_manage_api_tokens = ?, updated_at = NOW() 
			WHERE id = ?
		`, string(hash), m.Role, manageAllInt, canSeeAllInt, canCreateCollabsInt, canCreateAdminsInt, canManageAPITokensInt, m.ID)
		if err != nil {
			return fmt.Errorf("failed updating team member: %w", err)
		}
	} else {
		_, err = tx.ExecContext(ctx, `
			UPDATE admins 
			SET role = ?, manage_all_playlists = ?, can_see_all_users = ?, can_create_collaborators = ?, can_create_admins = ?, can_manage_api_tokens = ?, updated_at = NOW() 
			WHERE id = ?
		`, m.Role, manageAllInt, canSeeAllInt, canCreateCollabsInt, canCreateAdminsInt, canManageAPITokensInt, m.ID)
		if err != nil {
			return fmt.Errorf("failed updating team member: %w", err)
		}
	}

	// Sincronizza team_playlists
	_, _ = tx.ExecContext(ctx, `DELETE FROM team_playlists WHERE admin_id = ?`, m.ID)
	_, _ = tx.ExecContext(ctx, `DELETE FROM admin_playlists WHERE admin_id = ?`, m.ID)

	if m.Role != "admin" && !m.ManageAllPlaylists && len(m.AllowedPlaylistIDs) > 0 {
		for _, pid := range m.AllowedPlaylistIDs {
			_, err = tx.ExecContext(ctx, `INSERT INTO team_playlists (admin_id, playlist_id) VALUES (?, ?)`, m.ID, pid)
			if err != nil {
				return fmt.Errorf("failed associating playlist %d: %w", pid, err)
			}
			_, _ = tx.ExecContext(ctx, `INSERT IGNORE INTO admin_playlists (admin_id, playlist_id) VALUES (?, ?)`, m.ID, pid)
		}
	}

	return tx.Commit()
}

// DeleteTeamMember deletes a team member with anti-lockout and hierarchy protection.
func (r *AdminRepo) DeleteTeamMember(ctx context.Context, deleter *models.Admin, targetID int) error {
	if deleter != nil && deleter.ID == targetID {
		return errors.New("you cannot delete your own account")
	}

	target, err := r.GetByID(ctx, targetID)
	if err != nil || target == nil {
		return errors.New("team member not found")
	}

	if deleter != nil && deleter.Role != "admin" {
		if target.Role == "admin" {
			return errors.New("cannot delete an administrator")
		}
		if target.CreatedBy == nil || *target.CreatedBy != deleter.ID {
			return errors.New("you can only delete collaborators you created")
		}
	}

	if target.Role == "admin" {
		var adminCount int
		_ = r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM admins WHERE role = 'admin'").Scan(&adminCount)
		if adminCount <= 1 {
			return errors.New("cannot delete the only remaining administrator")
		}
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Preserva i clienti creati impostando created_by_admin_id a NULL
	_, _ = tx.ExecContext(ctx, `UPDATE managed_users SET created_by_admin_id = NULL WHERE created_by_admin_id = ?`, targetID)

	// Re-assegna i collaboratori creati da questo utente al padre del target (oppure al deleter)
	var reassignTo interface{}
	if target.CreatedBy != nil {
		reassignTo = *target.CreatedBy
	} else if deleter != nil {
		reassignTo = deleter.ID
	}
	if reassignTo != nil {
		_, _ = tx.ExecContext(ctx, `UPDATE admins SET created_by = ? WHERE created_by = ?`, reassignTo, targetID)
	} else {
		_, _ = tx.ExecContext(ctx, `UPDATE admins SET created_by = NULL WHERE created_by = ?`, targetID)
	}

	// Elimina associazioni playlist
	_, _ = tx.ExecContext(ctx, `DELETE FROM team_playlists WHERE admin_id = ?`, targetID)
	_, _ = tx.ExecContext(ctx, `DELETE FROM admin_playlists WHERE admin_id = ?`, targetID)

	// Elimina il membro
	res, err := tx.ExecContext(ctx, `DELETE FROM admins WHERE id = ?`, targetID)
	if err != nil {
		return fmt.Errorf("failed deleting team member: %w", err)
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return errors.New("team member not found")
	}

	return tx.Commit()
}

// Backward compatibility methods
func (r *AdminRepo) GetAllSubadmins(ctx context.Context) ([]models.Admin, error) {
	return r.GetTeamMembers(ctx, nil)
}

func (r *AdminRepo) GetAllCollaborators(ctx context.Context) ([]models.Admin, error) {
	return r.GetTeamMembers(ctx, nil)
}

func (r *AdminRepo) CreateSubadmin(ctx context.Context, a *models.Admin, plainPassword string) error {
	return r.CreateTeamMember(ctx, nil, a, plainPassword)
}

func (r *AdminRepo) CreateCollaborator(ctx context.Context, a *models.Admin, plainPassword string) error {
	return r.CreateTeamMember(ctx, nil, a, plainPassword)
}

func (r *AdminRepo) UpdateSubadmin(ctx context.Context, a *models.Admin, newPlainPassword string) error {
	return r.UpdateTeamMember(ctx, nil, a, newPlainPassword)
}

func (r *AdminRepo) UpdateCollaborator(ctx context.Context, a *models.Admin, newPlainPassword string) error {
	return r.UpdateTeamMember(ctx, nil, a, newPlainPassword)
}

func (r *AdminRepo) DeleteSubadmin(ctx context.Context, id int) error {
	return r.DeleteTeamMember(ctx, nil, id)
}

func (r *AdminRepo) DeleteCollaborator(ctx context.Context, id int) error {
	return r.DeleteTeamMember(ctx, nil, id)
}

func (r *AdminRepo) HasPlaylistAccess(ctx context.Context, admin *models.Admin, playlistID uint64) (bool, error) {
	if admin == nil {
		return false, nil
	}
	if admin.Role == "admin" || admin.ManageAllPlaylists {
		return true, nil
	}

	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM team_playlists WHERE admin_id = ? AND playlist_id = ?
	`, admin.ID, playlistID).Scan(&count)
	if err != nil {
		// Fallback to admin_playlists
		err = r.db.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM admin_playlists WHERE admin_id = ? AND playlist_id = ?
		`, admin.ID, playlistID).Scan(&count)
		if err != nil {
			return false, err
		}
	}
	return count > 0, nil
}

// GetAllTeamMembersForBackup returns all admin and collaborator accounts including password hashes and playlist permissions for backup export.
func (r *AdminRepo) GetAllTeamMembersForBackup(ctx context.Context) ([]models.TeamMemberBackup, error) {
	query := `
		SELECT a.id, a.username, a.password_hash, COALESCE(a.role, 'admin'), 
		       COALESCE(a.manage_all_playlists, 1), COALESCE(a.can_see_all_users, 1), 
		       COALESCE(a.can_create_collaborators, 0), COALESCE(a.can_create_admins, 0),
		       c.username
		FROM admins a
		LEFT JOIN admins c ON a.created_by = c.id
		WHERE a.role IN ('admin', 'collaborator', 'subadmin') 
		ORDER BY a.id ASC
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed querying team members for backup: %w", err)
	}
	defer rows.Close()

	var list []models.TeamMemberBackup
	for rows.Next() {
		var id int
		var username, passwordHash, role string
		var manageAll, canSeeAll, canCreateCollabs, canCreateAdmins int
		var creatorUser sql.NullString

		if err := rows.Scan(&id, &username, &passwordHash, &role, &manageAll, &canSeeAll, &canCreateCollabs, &canCreateAdmins, &creatorUser); err != nil {
			return nil, fmt.Errorf("failed scanning team member for backup: %w", err)
		}
		if role == "subadmin" {
			role = "collaborator"
		}

		tb := models.TeamMemberBackup{
			Username:               username,
			PasswordHash:           passwordHash,
			Role:                   role,
			ManageAllPlaylists:     manageAll == 1 || role == "admin",
			CanSeeAllUsers:         canSeeAll == 1 || role == "admin",
			CanCreateCollaborators: canCreateCollabs == 1,
			CanCreateAdmins:        canCreateAdmins == 1 && role == "admin",
		}
		if creatorUser.Valid {
			tb.CreatedByUsername = &creatorUser.String
		}

		if !tb.ManageAllPlaylists && tb.Role != "admin" {
			allowed, err := r.GetAllowedPlaylistIDs(ctx, id)
			if err != nil {
				return nil, err
			}
			tb.AllowedPlaylistIDs = allowed
		} else {
			tb.AllowedPlaylistIDs = models.Uint64Slice{}
		}

		list = append(list, tb)
	}

	if list == nil {
		list = []models.TeamMemberBackup{}
	}
	return list, nil
}

// RestoreTeamMember restores a team member (admin or collaborator) into the database.
// If onlyCollaborators is true, skip records with Role == "admin".
func (r *AdminRepo) RestoreTeamMember(ctx context.Context, m models.TeamMemberBackup, overwrite bool, onlyCollaborators bool) (created bool, updated bool, skipped bool, err error) {
	if m.Username == "" || m.PasswordHash == "" {
		return false, false, true, nil
	}
	role := m.Role
	if role == "" || role == "subadmin" {
		role = "collaborator"
	}
	if onlyCollaborators && role == "admin" {
		return false, false, true, nil
	}

	// Check if user already exists
	var existingID int
	var existingRole string
	err = r.db.QueryRowContext(ctx, "SELECT id, role FROM admins WHERE username = ?", m.Username).Scan(&existingID, &existingRole)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, false, false, fmt.Errorf("failed checking existing admin %s: %w", m.Username, err)
	}

	manageAllInt := 0
	if m.ManageAllPlaylists || role == "admin" {
		manageAllInt = 1
	}
	canSeeAllInt := 0
	if m.CanSeeAllUsers || role == "admin" {
		canSeeAllInt = 1
	}
	canCreateCollabsInt := 0
	if m.CanCreateCollaborators {
		canCreateCollabsInt = 1
	}
	canCreateAdminsInt := 0
	if m.CanCreateAdmins && role == "admin" {
		canCreateAdminsInt = 1
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, false, false, err
	}
	defer tx.Rollback()

	if errors.Is(err, sql.ErrNoRows) || existingID == 0 {
		// Does not exist -> INSERT
		res, err := tx.ExecContext(ctx, `
			INSERT INTO admins (username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, m.Username, m.PasswordHash, role, manageAllInt, canSeeAllInt, canCreateCollabsInt, canCreateAdminsInt)
		if err != nil {
			return false, false, false, fmt.Errorf("failed inserting team member %s: %w", m.Username, err)
		}
		newID, _ := res.LastInsertId()

		// If specific playlists are assigned, insert into team_playlists
		if !m.ManageAllPlaylists && role != "admin" && len(m.AllowedPlaylistIDs) > 0 {
			for _, pid := range m.AllowedPlaylistIDs {
				_, _ = tx.ExecContext(ctx, `
					INSERT IGNORE INTO team_playlists (admin_id, playlist_id) VALUES (?, ?)
				`, newID, pid)
			}
		}

		if err := tx.Commit(); err != nil {
			return false, false, false, err
		}
		return true, false, false, nil
	}

	// User already exists
	if !overwrite {
		return false, false, true, nil
	}

	// Overwrite existing user (preserve admin role if existing user is admin)
	targetRole := role
	if existingRole == "admin" && role != "admin" {
		targetRole = "admin"
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE admins 
		SET password_hash = ?, role = ?, manage_all_playlists = ?, can_see_all_users = ?, can_create_collaborators = ?, can_create_admins = ?
		WHERE id = ?
	`, m.PasswordHash, targetRole, manageAllInt, canSeeAllInt, canCreateCollabsInt, canCreateAdminsInt, existingID)
	if err != nil {
		return false, false, false, fmt.Errorf("failed updating team member %s: %w", m.Username, err)
	}

	// Update team_playlists
	_, _ = tx.ExecContext(ctx, "DELETE FROM team_playlists WHERE admin_id = ?", existingID)
	if !m.ManageAllPlaylists && targetRole != "admin" && len(m.AllowedPlaylistIDs) > 0 {
		for _, pid := range m.AllowedPlaylistIDs {
			_, _ = tx.ExecContext(ctx, `
				INSERT IGNORE INTO team_playlists (admin_id, playlist_id) VALUES (?, ?)
			`, existingID, pid)
		}
	}

	if err := tx.Commit(); err != nil {
		return false, false, false, err
	}
	return false, true, false, nil
}

