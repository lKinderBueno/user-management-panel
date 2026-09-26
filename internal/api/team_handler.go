package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
)

type TeamHandler struct {
	adminRepo    *repository.AdminRepo
	playlistRepo *repository.PlaylistRepo
}

func NewTeamHandler(adminRepo *repository.AdminRepo, playlistRepo *repository.PlaylistRepo) *TeamHandler {
	return &TeamHandler{
		adminRepo:    adminRepo,
		playlistRepo: playlistRepo,
	}
}

// RequireTeamAccess ensures that only administrators or collaborators with can_create_collaborators can access team management.
// It checks JWT claims first for performance, and falls back to live DB lookup to handle dynamically updated permissions or stale tokens.
func (h *TeamHandler) RequireTeamAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
		if !ok || claims == nil {
			http.Error(w, `{"error":"unauthorized","message":"missing authorization claims"}`, http.StatusUnauthorized)
			return
		}

		// Fast path: Token claims say can_create_admins or can_create_collaborators
		if claims.CanCreateAdmins || claims.CanCreateCollaborators {
			next.ServeHTTP(w, r)
			return
		}

		// Fallback: Check live database for recent permission grant or stale token
		if h.adminRepo != nil {
			admin, err := h.adminRepo.GetByID(r.Context(), claims.AdminID)
			if err == nil && admin != nil {
				if admin.CanCreateAdmins || admin.CanCreateCollaborators {
					// Update claims in context so downstream handlers see live permissions
					claims.Role = admin.Role
					claims.CanCreateAdmins = admin.CanCreateAdmins
					claims.CanCreateCollaborators = admin.CanCreateCollaborators
					next.ServeHTTP(w, r)
					return
				}
			}
		}

		http.Error(w, `{"error":"forbidden","message":"you do not have permission to manage team members"}`, http.StatusForbidden)
	})
}

type CreateTeamMemberRequest struct {
	Username               string             `json:"username"`
	Password               string             `json:"password"`
	Role                   string             `json:"role"` // "admin" or "collaborator"
	ManageAllPlaylists     bool               `json:"manage_all_playlists"`
	AllowedPlaylistIDs     models.Uint64Slice `json:"allowed_playlist_ids"`
	CanSeeAllUsers         bool               `json:"can_see_all_users"`
	CanCreateCollaborators bool               `json:"can_create_collaborators"`
	CanCreateAdmins        bool               `json:"can_create_admins"`
	CanManageAPITokens     bool               `json:"can_manage_api_tokens"`
}

type UpdateTeamMemberRequest struct {
	Password               string             `json:"password,omitempty"`
	Role                   string             `json:"role,omitempty"`
	ManageAllPlaylists     bool               `json:"manage_all_playlists"`
	AllowedPlaylistIDs     models.Uint64Slice `json:"allowed_playlist_ids"`
	CanSeeAllUsers         bool               `json:"can_see_all_users"`
	CanCreateCollaborators bool               `json:"can_create_collaborators"`
	CanCreateAdmins        bool               `json:"can_create_admins"`
	CanManageAPITokens     bool               `json:"can_manage_api_tokens"`
}

// GetTeamMembers lists team members according to the caller's hierarchy.
func (h *TeamHandler) GetTeamMembers(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var requester *models.Admin
	if claims != nil {
		requester, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	members, err := h.adminRepo.GetTeamMembers(r.Context(), requester)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_fetching_team_members",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, members)
}

// CreateTeamMember creates a new admin or collaborator.
func (h *TeamHandler) CreateTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var requester *models.Admin
	if claims != nil {
		requester, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	var req CreateTeamMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	req.Role = strings.TrimSpace(req.Role)

	if req.Role == "" {
		req.Role = "collaborator"
	}

	if req.Username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_username",
			"message": "Username is required",
		})
		return
	}

	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_password",
			"message": "Password must be at least 6 characters long",
		})
		return
	}

	// Hierarchy authorization checks
	if requester != nil {
		if req.Role == "admin" {
			if requester.Role != "admin" || !requester.CanCreateAdmins {
				writeJSON(w, http.StatusForbidden, map[string]string{
					"error":   "forbidden",
					"message": "You do not have permission to create administrators",
				})
				return
			}
		} else if req.Role == "collaborator" {
			if !requester.CanCreateCollaborators {
				writeJSON(w, http.StatusForbidden, map[string]string{
					"error":   "forbidden",
					"message": "You do not have permission to invite or create collaborators",
				})
				return
			}
		}
	}

	// Check if username is already taken
	existing, err := h.adminRepo.GetByUsername(r.Context(), req.Username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "db_error",
			"message": err.Error(),
		})
		return
	}
	if existing != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "username_taken",
			"message": "A user with this username already exists",
		})
		return
	}

	// Validation for collaborator role
	if req.Role == "collaborator" {
		if !req.ManageAllPlaylists && len(req.AllowedPlaylistIDs) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "missing_playlists",
				"message": "Please select at least one playlist or enable all playlists",
			})
			return
		}

		// If requester is a restricted collaborator, ensure child playlist IDs are within parent's allowed IDs
		if requester != nil && requester.Role != "admin" && !requester.ManageAllPlaylists {
			req.ManageAllPlaylists = false
			parentAllowedMap := make(map[uint64]bool)
			for _, pid := range requester.AllowedPlaylistIDs {
				parentAllowedMap[pid] = true
			}
			var filteredIDs models.Uint64Slice
			for _, pid := range req.AllowedPlaylistIDs {
				if parentAllowedMap[pid] {
					filteredIDs = append(filteredIDs, pid)
				}
			}
			if len(filteredIDs) == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error":   "invalid_playlists",
					"message": "You can only assign playlists that you have permission to manage",
				})
				return
			}
			req.AllowedPlaylistIDs = filteredIDs
		}
	}

	member := &models.Admin{
		Username:               req.Username,
		Role:                   req.Role,
		ManageAllPlaylists:     req.ManageAllPlaylists,
		CanSeeAllUsers:         req.CanSeeAllUsers,
		CanCreateCollaborators: req.CanCreateCollaborators,
		CanCreateAdmins:        req.CanCreateAdmins,
		CanManageAPITokens:     req.CanManageAPITokens,
		AllowedPlaylistIDs:     req.AllowedPlaylistIDs,
	}

	if err := h.adminRepo.CreateTeamMember(r.Context(), requester, member, req.Password); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_creating_team_member",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusCreated, member)
}

// GetTeamMember retrieves a single team member.
func (h *TeamHandler) GetTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	member, err := h.adminRepo.GetByID(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "db_error",
			"message": err.Error(),
		})
		return
	}
	if member == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "team_member_not_found"})
		return
	}

	// If requester is collaborator, ensure member is created by requester
	if claims != nil && claims.Role != "admin" {
		if member.CreatedBy == nil || *member.CreatedBy != claims.AdminID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
	}

	writeJSON(w, http.StatusOK, member)
}

// UpdateTeamMember updates an existing team member.
func (h *TeamHandler) UpdateTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var requester *models.Admin
	if claims != nil {
		requester, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	existing, err := h.adminRepo.GetByID(r.Context(), id)
	if err != nil || existing == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "team_member_not_found"})
		return
	}

	var req UpdateTeamMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	req.Password = strings.TrimSpace(req.Password)
	if req.Password != "" && len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_password",
			"message": "Password must be at least 6 characters long",
		})
		return
	}

	role := existing.Role
	if req.Role != "" {
		role = req.Role
	}

	if role == "collaborator" && !req.ManageAllPlaylists && len(req.AllowedPlaylistIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_playlists",
			"message": "Please select at least one playlist or enable all playlists",
		})
		return
	}

	member := &models.Admin{
		ID:                     id,
		Role:                   role,
		ManageAllPlaylists:     req.ManageAllPlaylists,
		CanSeeAllUsers:         req.CanSeeAllUsers,
		CanCreateCollaborators: req.CanCreateCollaborators,
		CanCreateAdmins:        req.CanCreateAdmins,
		CanManageAPITokens:     req.CanManageAPITokens,
		AllowedPlaylistIDs:     req.AllowedPlaylistIDs,
	}

	if err := h.adminRepo.UpdateTeamMember(r.Context(), requester, member, req.Password); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "failed_updating_team_member",
			"message": err.Error(),
		})
		return
	}

	updated, _ := h.adminRepo.GetByID(r.Context(), id)
	writeJSON(w, http.StatusOK, updated)
}

// DeleteTeamMember deletes a team member.
func (h *TeamHandler) DeleteTeamMember(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var requester *models.Admin
	if claims != nil {
		requester, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	if claims != nil && claims.AdminID == id {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "cannot_delete_self",
			"message": "You cannot delete your own account",
		})
		return
	}

	if err := h.adminRepo.DeleteTeamMember(r.Context(), requester, id); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "failed_deleting_team_member",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Team member deleted successfully",
	})
}
