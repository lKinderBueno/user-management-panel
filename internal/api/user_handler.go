package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/security"
	"playlistlabs_user_management_os/internal/tracking"
	"playlistlabs_user_management_os/internal/usersyncer"
	"playlistlabs_user_management_os/internal/util"
)

type UserHandler struct {
	userRepo     *repository.UserRepo
	playlistRepo *repository.PlaylistRepo
	adminRepo    *repository.AdminRepo
	xtreamClient usersyncer.XtreamInfoFetcher
	tracker      tracking.Tracker
	cache        cache.Cache
	secSvc       *security.Service
}

func NewUserHandler(userRepo *repository.UserRepo, playlistRepo *repository.PlaylistRepo, adminRepo *repository.AdminRepo, xtreamClient ...usersyncer.XtreamInfoFetcher) *UserHandler {
	var xc usersyncer.XtreamInfoFetcher
	if len(xtreamClient) > 0 && xtreamClient[0] != nil {
		xc = xtreamClient[0]
	} else {
		xc = usersyncer.NewXtreamClient(7 * time.Second)
	}
	return &UserHandler{
		userRepo:     userRepo,
		playlistRepo: playlistRepo,
		adminRepo:    adminRepo,
		xtreamClient: xc,
		cache:        cache.NewNoOp(),
	}
}

func (h *UserHandler) SetTracker(t tracking.Tracker) {
	h.tracker = t
}

func (h *UserHandler) SetCache(c cache.Cache) {
	if c != nil {
		h.cache = c
	}
}

func (h *UserHandler) SetSecurityService(s *security.Service) {
	h.secSvc = s
}

func (h *UserHandler) invalidateUserCache(ctx context.Context, username string) {
	if h.cache != nil && h.cache.IsAvailable() && username != "" {
		_ = h.cache.Delete(ctx, "cache:auth:user:"+username, "cache:auth:redirect:"+username)
	}
}

func (h *UserHandler) getScopedAdmin(r *http.Request, listID uint64) (*models.Admin, *int, int, error) {
	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil {
		return nil, nil, http.StatusUnauthorized, errors.New("unauthorized")
	}

	if !claims.HasTokenPlaylistAccess(listID) {
		return nil, nil, http.StatusForbidden, errors.New("this API token is not authorized for this playlist")
	}

	if h.adminRepo == nil {
		return nil, nil, http.StatusOK, nil
	}

	admin, err := h.adminRepo.GetByID(r.Context(), claims.AdminID)
	if err != nil || admin == nil {
		return nil, nil, http.StatusUnauthorized, errors.New("admin_not_found")
	}

	if admin.Role != "admin" && !admin.ManageAllPlaylists {
		hasAccess, err := h.adminRepo.HasPlaylistAccess(r.Context(), admin, listID)
		if err != nil || !hasAccess {
			return nil, nil, http.StatusForbidden, errors.New("you do not have access to this playlist")
		}
	}

	var creatorID *int
	if admin.Role != "admin" && !admin.CanSeeAllUsers {
		cid := admin.ID
		creatorID = &cid
	}

	return admin, creatorID, http.StatusOK, nil
}

func (h *UserHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	users, err := h.userRepo.GetUsersByPlaylist(r.Context(), listID, creatorID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_users", "message": err.Error()})
		return
	}

	if users == nil {
		users = []models.ManagedUser{}
	}

	if h.tracker != nil && len(users) > 0 {
		onlineCounts, err := h.tracker.GetPlaylistOnlineUserCounts(r.Context(), listID)
		if err == nil && len(onlineCounts) > 0 {
			for i := range users {
				if count, ok := onlineCounts[users[i].ID]; ok && count > 0 {
					users[i].ActiveConnections = count
					users[i].IsOnline = true
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, users)
}

func (h *UserHandler) GetNextUserID(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, _, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	nextID, err := h.userRepo.GetNextID(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_getting_next_id", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"next_id": nextID})
}

func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	_, _, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	var u models.ManagedUser
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body", "message": err.Error()})
		return
	}

	u.ListID = listID
	u.Username = strings.TrimSpace(u.Username)
	u.Password = strings.TrimSpace(u.Password)
	u.Name = strings.TrimSpace(u.Name)

	if u.Username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_username", "message": "Username is required"})
		return
	}
	if u.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_password", "message": "Password is required"})
		return
	}

	// 1. Check Username uniqueness
	taken, err := h.userRepo.IsUsernameTaken(r.Context(), u.Username, 0, 0)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error", "message": err.Error()})
		return
	}
	if taken {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username_taken", "message": "Username already taken by another user"})
		return
	}

	// 2. M3U token
	u.M3U = cleanTokenInput(u.M3U)
	if u.M3U == "" {
		m3u, err := util.GenerateUniqueM3U(r.Context(), h.userRepo)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token_gen_error"})
			return
		}
		u.M3U = m3u
	} else {
		m3uTaken, _ := h.userRepo.IsTokenTaken(r.Context(), u.M3U, 0, 0)
		if m3uTaken {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "m3u_taken", "message": "Short M3U URL token already in use by another user as M3U or EPG"})
			return
		}
	}

	// 3. EPG token
	u.EPG = cleanTokenInput(u.EPG)
	if u.EPG == "" {
		epg, err := util.GenerateUniqueEPG(r.Context(), h.userRepo)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token_gen_error"})
			return
		}
		for epg == u.M3U {
			epg, err = util.GenerateUniqueEPG(r.Context(), h.userRepo)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token_gen_error"})
				return
			}
		}
		u.EPG = epg
	} else {
		if u.EPG == u.M3U {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "tokens_identical", "message": "Short M3U and Short EPG tokens cannot be identical"})
			return
		}
		epgTaken, _ := h.userRepo.IsTokenTaken(r.Context(), u.EPG, 0, 0)
		if epgTaken {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "epg_taken", "message": "Short EPG URL token already in use by another user as M3U or EPG"})
			return
		}
	}

	// 4. Expiry
	if u.Expiry == nil {
		exp := time.Now().AddDate(1, 0, 0) // default 1 year
		u.Expiry = &exp
	}

	// 5. Next ID
	nextID, err := h.userRepo.GetNextID(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error", "message": err.Error()})
		return
	}
	u.ID = nextID
	if u.Name == "" {
		u.Name = fmt.Sprintf("User #%d", nextID)
	}

	if u.MaxConnections <= 0 {
		u.MaxConnections = 1
	}

	if len(u.Patterns) == 0 {
		u.Patterns = []byte("[]")
	}

	// Set creator ID
	creatorID := claims.AdminID
	u.CreatedByAdminID = &creatorID

	// 6. Save in DB
	if err := h.userRepo.Create(r.Context(), &u); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_creating_user", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, u)
}

func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_user_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	var u models.ManagedUser
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body", "message": err.Error()})
		return
	}

	u.ListID = listID
	u.ID = id

	oldUser, _ := h.userRepo.GetUserByID(r.Context(), listID, id)
	if oldUser == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user_not_found", "message": "User not found"})
		return
	}
	if creatorID != nil && (oldUser.CreatedByAdminID == nil || *oldUser.CreatedByAdminID != *creatorID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "You can only modify your own managed users"})
		return
	}
	h.invalidateUserCache(r.Context(), oldUser.Username)

	if err := h.userRepo.Update(r.Context(), &u, creatorID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "failed_updating_user", "message": err.Error()})
		return
	}

	// If user was suspended and is now unsuspended, clear open security incidents and memory tracker
	if oldUser != nil && oldUser.IsSuspended && !u.IsSuspended {
		if h.secSvc != nil {
			_ = h.secSvc.UnsuspendUser(r.Context(), oldUser.Username)
		}
	}

	updatedUser, _ := h.userRepo.GetUserByID(r.Context(), listID, id)
	if updatedUser != nil {
		h.invalidateUserCache(r.Context(), updatedUser.Username)
	}
	writeJSON(w, http.StatusOK, updatedUser)
}

type DeleteRequest struct {
	IDs []int `json:"ids"`
}

func (h *UserHandler) DeleteUsers(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	var req DeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	for _, uid := range req.IDs {
		if du, _ := h.userRepo.GetUserByID(r.Context(), listID, uid); du != nil {
			h.invalidateUserCache(r.Context(), du.Username)
		}
	}

	if err := h.userRepo.DeleteUsers(r.Context(), listID, req.IDs, creatorID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_deleting_users", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "deleted_count": len(req.IDs)})
}

type MoveRequest struct {
	NewListID       any                     `json:"new_list_id"`
	IDs             []int                   `json:"ids"`
	PatternMappings []models.PatternMapping `json:"pattern_mappings,omitempty"`
}

func (h *UserHandler) MoveUsers(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	fromListID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	var req MoveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	var toListID uint64
	switch v := req.NewListID.(type) {
	case string:
		var err error
		toListID, err = strconv.ParseUint(v, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_destination_list_id"})
			return
		}
	case float64:
		if v < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_destination_list_id"})
			return
		}
		toListID = uint64(v)
	case int:
		if v < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_destination_list_id"})
			return
		}
		toListID = uint64(v)
	case json.Number:
		n, err := v.Int64()
		if err != nil || n < 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_destination_list_id"})
			return
		}
		toListID = uint64(n)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_destination_list_id"})
		return
	}

	if fromListID == toListID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "same_playlist", "message": "Destination must be different from source playlist"})
		return
	}

	admin, creatorID, status, err := h.getScopedAdmin(r, fromListID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	if admin != nil && admin.Role != "admin" && !admin.ManageAllPlaylists {
		hasDestAccess, err := h.adminRepo.HasPlaylistAccess(r.Context(), admin, toListID)
		if err != nil || !hasDestAccess {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "You do not have access to destination playlist"})
			return
		}
	}

	for _, uid := range req.IDs {
		if mu, _ := h.userRepo.GetUserByID(r.Context(), fromListID, uid); mu != nil {
			h.invalidateUserCache(r.Context(), mu.Username)
		}
	}

	if err := h.userRepo.MoveUsers(r.Context(), fromListID, toListID, req.IDs, creatorID, req.PatternMappings); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "failed_moving_users", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "moved_count": len(req.IDs)})
}

type BulkCategoriesRequest struct {
	Updates []repository.CategoryUpdateItem `json:"updates"`
}

func (h *UserHandler) BulkUpdateCategories(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	var req BulkCategoriesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body", "message": err.Error()})
		return
	}

	if err := h.userRepo.BulkUpdateCategories(r.Context(), listID, req.Updates, creatorID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "failed_bulk_updating_categories", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(r.Context(), "cache:auth:user:")
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "updated_count": len(req.Updates)})
}

func (h *UserHandler) BulkUpdatePatterns(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	admin, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	var req models.BulkPatternRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body", "message": err.Error()})
		return
	}

	req.Action = strings.TrimSpace(req.Action)
	if req.Action == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_action", "message": "Action is required"})
		return
	}

	// Permission checks for scope="all_playlists"
	if req.Scope == "all_playlists" {
		if admin != nil && admin.Role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "Only admins can modify patterns across all playlists"})
			return
		}
	}

	// Validation per action
	switch req.Action {
	case "rename_url":
		if strings.TrimSpace(req.OldURL) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_old_url", "message": "Old URL is required for rename_url"})
			return
		}
		if strings.TrimSpace(req.NewURL) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_new_url", "message": "New URL is required for rename_url"})
			return
		}
	case "remove":
		if strings.TrimSpace(req.OldURL) == "" && strings.TrimSpace(req.TargetType) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_criteria", "message": "Either Old URL or Target Type must be specified for remove"})
			return
		}
	case "add":
		if req.NewPattern == nil || strings.TrimSpace(req.NewPattern.URL) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_pattern_url", "message": "Pattern URL is required for add"})
			return
		}
	case "update_curl":
		if strings.TrimSpace(req.CURL) == "" && req.UseCURL == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_curl_data", "message": "Custom DNS URL or Use Custom DNS flag must be specified"})
			return
		}
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_action", "message": "Action must be rename_url, remove, add, or update_curl"})
		return
	}

	res, err := h.userRepo.BulkUpdatePatterns(r.Context(), listID, req, creatorID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_bulk_updating_patterns", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(r.Context(), "cache:auth:user:")
	}

	writeJSON(w, http.StatusOK, res)
}

type CredentialsRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	M3U      string `json:"m3u"`
	EPG      string `json:"epg"`
}

func cleanTokenInput(token string) string {
	token = strings.TrimSpace(token)
	if idx := strings.Index(token, "://"); idx != -1 {
		token = token[idx+3:]
		if slashIdx := strings.Index(token, "/"); slashIdx != -1 {
			token = token[slashIdx+1:]
		} else {
			token = ""
		}
	}
	if qIdx := strings.Index(token, "?"); qIdx != -1 {
		token = token[:qIdx]
	}
	token = strings.Trim(token, "/")
	token = strings.TrimSuffix(token, ".m3u")
	token = strings.TrimSuffix(token, ".xml.gz")
	token = strings.TrimSuffix(token, ".xml")
	return strings.TrimSpace(token)
}

func (h *UserHandler) UpdateCredentials(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_user_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	oldUser, _ := h.userRepo.GetUserByID(r.Context(), listID, id)
	if oldUser == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user_not_found", "message": "User not found"})
		return
	}
	if creatorID != nil && (oldUser.CreatedByAdminID == nil || *oldUser.CreatedByAdminID != *creatorID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "You can only modify your own managed users"})
		return
	}

	var req CredentialsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)
	req.M3U = cleanTokenInput(req.M3U)
	req.EPG = cleanTokenInput(req.EPG)

	targetM3U := oldUser.M3U
	if req.M3U != "" {
		targetM3U = req.M3U
	}
	targetEPG := oldUser.EPG
	if req.EPG != "" {
		targetEPG = req.EPG
	}

	if targetM3U == targetEPG {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "tokens_identical",
			"message": "Short M3U and Short EPG tokens cannot be identical",
		})
		return
	}

	if req.Username != "" && req.Username != oldUser.Username {
		taken, err := h.userRepo.IsUsernameTaken(r.Context(), req.Username, listID, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error"})
			return
		}
		if taken {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username_taken", "message": "Username already taken by another user"})
			return
		}
	}

	if req.M3U != "" && req.M3U != oldUser.M3U {
		taken, err := h.userRepo.IsTokenTaken(r.Context(), req.M3U, listID, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error"})
			return
		}
		if taken {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "m3u_taken", "message": "Short M3U URL token already in use by another user as M3U or EPG"})
			return
		}
	}

	if req.EPG != "" && req.EPG != oldUser.EPG {
		taken, err := h.userRepo.IsTokenTaken(r.Context(), req.EPG, listID, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error"})
			return
		}
		if taken {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "epg_taken", "message": "Short EPG URL token already in use by another user as M3U or EPG"})
			return
		}
	}

	h.invalidateUserCache(r.Context(), oldUser.Username)

	if err := h.userRepo.UpdateCredentials(r.Context(), listID, id, req.Username, req.Password, req.M3U, req.EPG, creatorID); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "failed_updating_credentials", "message": err.Error()})
		return
	}

	updatedUser, _ := h.userRepo.GetUserByID(r.Context(), listID, id)
	if updatedUser != nil {
		h.invalidateUserCache(r.Context(), updatedUser.Username)
	}
	writeJSON(w, http.StatusOK, updatedUser)
}

func (h *UserHandler) CheckShortURL(w http.ResponseWriter, r *http.Request) {
	rawToken := strings.TrimSpace(r.URL.Query().Get("token"))
	if rawToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"available": false, "message": "Token is required"})
		return
	}

	token := cleanTokenInput(rawToken)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{"available": false, "message": "Token is required"})
		return
	}

	tokenType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type"))) // "m3u" or "epg"
	otherToken := cleanTokenInput(strings.TrimSpace(r.URL.Query().Get("other_token")))

	if otherToken != "" && token == otherToken {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"available": false,
			"message":   "Cannot match the other Short URL token",
		})
		return
	}

	var excludeListID uint64
	var excludeID int
	if el := r.URL.Query().Get("exclude_list_id"); el != "" {
		excludeListID, _ = strconv.ParseUint(el, 10, 64)
	}
	if ei := r.URL.Query().Get("exclude_id"); ei != "" {
		excludeID, _ = strconv.Atoi(ei)
	}

	if excludeListID > 0 && excludeID > 0 {
		user, err := h.userRepo.GetUserByID(r.Context(), excludeListID, excludeID)
		if err == nil && user != nil {
			if tokenType == "m3u" {
				if token == user.M3U {
					writeJSON(w, http.StatusOK, map[string]interface{}{"available": true, "message": "Current"})
					return
				}
				if otherToken == "" && token == user.EPG {
					writeJSON(w, http.StatusOK, map[string]interface{}{"available": false, "message": "Cannot match this user's Short EPG URL"})
					return
				}
			} else if tokenType == "epg" {
				if token == user.EPG {
					writeJSON(w, http.StatusOK, map[string]interface{}{"available": true, "message": "Current"})
					return
				}
				if otherToken == "" && token == user.M3U {
					writeJSON(w, http.StatusOK, map[string]interface{}{"available": false, "message": "Cannot match this user's Short M3U URL"})
					return
				}
			}
		}
	}

	taken, err := h.userRepo.IsTokenTaken(r.Context(), token, excludeListID, excludeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error", "message": err.Error()})
		return
	}

	if taken {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"available": false,
			"message":   "Already taken by another user as M3U or EPG URL",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"available": true,
		"message":   "Available",
	})
}

func (h *UserHandler) CheckUsername(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(r.URL.Query().Get("username"))
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username_required"})
		return
	}

	var excludeListID uint64
	var excludeID int
	if el := r.URL.Query().Get("exclude_list_id"); el != "" {
		excludeListID, _ = strconv.ParseUint(el, 10, 64)
	}
	if ei := r.URL.Query().Get("exclude_id"); ei != "" {
		excludeID, _ = strconv.Atoi(ei)
	}

	taken, err := h.userRepo.IsUsernameTaken(r.Context(), username, excludeListID, excludeID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "db_error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"available": !taken})
}

func (h *UserHandler) GenerateRandom(w http.ResponseWriter, r *http.Request) {
	t := r.URL.Query().Get("type")
	var val string
	var err error

	switch t {
	case "username":
		val, err = util.GenerateUniqueUsername(r.Context(), h.userRepo)
	case "password":
		val = util.GenerateRandomPassword()
	case "m3u":
		val, err = util.GenerateUniqueM3U(r.Context(), h.userRepo)
	case "epg":
		val, err = util.GenerateUniqueEPG(r.Context(), h.userRepo)
	default:
		val = util.RandomText(10, 2)
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "generation_error", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"value": val})
}

type ForceSyncRequest struct {
	RawResponse json.RawMessage `json:"raw_response,omitempty"`
	Patterns    json.RawMessage `json:"patterns,omitempty"`
	Username    string          `json:"username,omitempty"`
	Password    string          `json:"password,omitempty"`
}

func (h *UserHandler) ForceSync(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id", "message": "Invalid playlist ID"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_user_id", "message": "Invalid user ID"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	user, err := h.userRepo.GetUserByID(r.Context(), listID, id)
	if err != nil || user == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user_not_found", "message": "User not found"})
		return
	}

	if creatorID != nil && (user.CreatedByAdminID == nil || *user.CreatedByAdminID != *creatorID) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "Unauthorized access to this user"})
		return
	}

	var syncReq ForceSyncRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&syncReq)
	}

	var (
		info       *usersyncer.XtreamCustomerInfo
		syncSource = "server"
	)

	// If client provided raw_response from browser-side fetch, parse it directly
	rawBytes := bytes.TrimSpace(syncReq.RawResponse)
	if len(rawBytes) > 0 {
		if rawBytes[0] == '"' {
			var unquoted string
			if err := json.Unmarshal(rawBytes, &unquoted); err == nil {
				rawBytes = []byte(unquoted)
			}
		}
		if parsedInfo, parseErr := usersyncer.ParseXtreamResponse(rawBytes); parseErr == nil && parsedInfo != nil && parsedInfo.Updated {
			info = parsedInfo
			syncSource = "browser"
		}
	}

	// Fallback to server query if client didn't supply or failed to parse raw_response
	if info == nil {
		// 1. Resolve patterns: merge playlist patterns and user patterns
		var userPatterns []models.PatternItem
		patternsJSON := user.Patterns
		if len(syncReq.Patterns) > 0 && string(syncReq.Patterns) != "[]" && string(syncReq.Patterns) != "null" {
			patternsJSON = syncReq.Patterns
		}
		if len(patternsJSON) > 0 && string(patternsJSON) != "[]" && string(patternsJSON) != "null" {
			_ = json.Unmarshal(patternsJSON, &userPatterns)
		}

		var playlistPatterns []models.PatternItem
		if playlist, err := h.playlistRepo.GetByID(r.Context(), listID); err == nil && playlist != nil {
			if len(playlist.Patterns) > 0 && string(playlist.Patterns) != "[]" && string(playlist.Patterns) != "null" {
				_ = json.Unmarshal(playlist.Patterns, &playlistPatterns)
			}
		}
		patterns := models.MergePatterns(playlistPatterns, userPatterns)

		// 2. Find Xtream pattern
		var xtreamPattern *models.PatternItem
		for i := range patterns {
			if strings.EqualFold(patterns[i].Type, "xtream") {
				xtreamPattern = &patterns[i]
				break
			}
		}

		if xtreamPattern == nil || strings.TrimSpace(xtreamPattern.URL) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "no_xtream_provider",
				"message": "No Xtream provider URL found for this user or playlist",
			})
			return
		}

		targetURL := xtreamPattern.URL
		if xtreamPattern.UseCURL && strings.TrimSpace(xtreamPattern.CURL) != "" {
			targetURL = xtreamPattern.CURL
		}

		providerUser := strings.TrimSpace(xtreamPattern.Param1)
		if providerUser == "" {
			if syncReq.Username != "" {
				providerUser = strings.TrimSpace(syncReq.Username)
			} else {
				providerUser = strings.TrimSpace(user.Username)
			}
		}

		providerPass := strings.TrimSpace(xtreamPattern.Param2)
		if providerPass == "" {
			if syncReq.Password != "" {
				providerPass = strings.TrimSpace(syncReq.Password)
			} else {
				providerPass = strings.TrimSpace(user.Password)
			}
		}

		if providerUser == "" || providerPass == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "missing_credentials",
				"message": "Provider username and password are required to sync provider data",
			})
			return
		}

		// 3. Query provider API
		syncCtx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		var fetchErr error
		info, fetchErr = h.xtreamClient.FetchUserInfo(syncCtx, targetURL, providerUser, providerPass)
		if fetchErr != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "provider_sync_failed",
				"message": fmt.Sprintf("Provider sync failed: %v", fetchErr),
			})
			return
		}

		if info == nil || !info.Updated {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "no_data_returned",
				"message": "Provider did not return account info",
			})
			return
		}
		syncSource = "server"
	}

	// 4. Update expiry & max_connections in DB
	if err := h.userRepo.UpdateUserExpiryAndConnections(r.Context(), listID, id, info.Expiry, info.MaxConnections); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "db_update_failed",
			"message": err.Error(),
		})
		return
	}

	updatedUser, _ := h.userRepo.GetUserByID(r.Context(), listID, id)
	if updatedUser == nil {
		updatedUser = user
	}
	h.invalidateUserCache(r.Context(), updatedUser.Username)

	sourceLabel := "via client"
	if syncSource == "server" {
		sourceLabel = "via server"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"source":  syncSource,
		"message": fmt.Sprintf("Expiry updated to %s (max connections: %d, %s)", info.Expiry.Format("2006-01-02 15:04"), info.MaxConnections, sourceLabel),
		"user":    updatedUser,
	})
}

// GetUserConnections returns all active streaming connections for a specific user.
func (h *UserHandler) GetUserConnections(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_user_id"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	if creatorID != nil {
		targetUser, err := h.userRepo.GetUserByID(r.Context(), listID, userID)
		if err != nil || targetUser == nil || targetUser.CreatedByAdminID == nil || *targetUser.CreatedByAdminID != *creatorID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "Unauthorized access to this user"})
			return
		}
	}

	if h.tracker == nil {
		writeJSON(w, http.StatusOK, []tracking.ConnectionSession{})
		return
	}

	conns, err := h.tracker.GetUserConnections(r.Context(), listID, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_connections", "message": err.Error()})
		return
	}
	if conns == nil {
		conns = []tracking.ConnectionSession{}
	}

	writeJSON(w, http.StatusOK, conns)
}

// GetPlaylistConnections returns all active streaming connections across an entire playlist.
func (h *UserHandler) GetPlaylistConnections(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, _, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	if h.tracker == nil {
		writeJSON(w, http.StatusOK, []tracking.ConnectionSession{})
		return
	}

	conns, err := h.tracker.GetPlaylistConnections(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_playlist_connections", "message": err.Error()})
		return
	}
	if conns == nil {
		conns = []tracking.ConnectionSession{}
	}

	writeJSON(w, http.StatusOK, conns)
}

// DeleteConnection terminates an active connection session.
func (h *UserHandler) DeleteConnection(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_user_id"})
		return
	}

	deviceKey := chi.URLParam(r, "deviceKey")
	if deviceKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_device_key"})
		return
	}

	_, creatorID, status, err := h.getScopedAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error(), "message": err.Error()})
		return
	}

	if creatorID != nil {
		targetUser, err := h.userRepo.GetUserByID(r.Context(), listID, userID)
		if err != nil || targetUser == nil || targetUser.CreatedByAdminID == nil || *targetUser.CreatedByAdminID != *creatorID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden", "message": "Unauthorized access to this user"})
			return
		}
	}

	if h.tracker != nil {
		_ = h.tracker.CloseConnection(r.Context(), listID, userID, deviceKey)
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "connection_closed"})
}
