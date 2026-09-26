package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"

	"github.com/go-chi/chi/v5"
)

type PlaylistHandler struct {
	playlistRepo *repository.PlaylistRepo
	adminRepo    *repository.AdminRepo
	syncer       models.PlaylistSyncer
	syncLogRepo  *repository.SyncLogRepo
	cache        cache.Cache
	userRepo     *repository.UserRepo
	apiClient    *client.APIClient
}

func NewPlaylistHandler(
	playlistRepo *repository.PlaylistRepo,
	adminRepo *repository.AdminRepo,
	syncerEngine models.PlaylistSyncer,
	syncLogRepo ...*repository.SyncLogRepo,
) *PlaylistHandler {
	var slr *repository.SyncLogRepo
	if len(syncLogRepo) > 0 {
		slr = syncLogRepo[0]
	}
	return &PlaylistHandler{
		playlistRepo: playlistRepo,
		adminRepo:    adminRepo,
		syncer:       syncerEngine,
		syncLogRepo:  slr,
		cache:        cache.NewNoOp(),
	}
}

// SetAPIClient injects the IPTVEditor API client.
func (h *PlaylistHandler) SetAPIClient(c *client.APIClient) {
	h.apiClient = c
}

// SetCache sets or overrides the cache instance.
func (h *PlaylistHandler) SetCache(c cache.Cache) {
	if c != nil {
		h.cache = c
	}
}

// SetUserRepo injects the user repository.
func (h *PlaylistHandler) SetUserRepo(userRepo *repository.UserRepo) {
	h.userRepo = userRepo
}

func (h *PlaylistHandler) getScopedPlaylistAdmin(r *http.Request, listID uint64) (*models.Admin, int, error) {
	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil {
		return nil, http.StatusUnauthorized, errors.New("unauthorized")
	}

	if !claims.HasTokenPlaylistAccess(listID) {
		return nil, http.StatusForbidden, errors.New("this API token is not authorized for this playlist")
	}

	if h.adminRepo == nil {
		return nil, http.StatusOK, nil
	}

	admin, err := h.adminRepo.GetByID(r.Context(), claims.AdminID)
	if err != nil || admin == nil {
		return nil, http.StatusUnauthorized, errors.New("admin_not_found")
	}

	if admin.Role != "admin" && !admin.ManageAllPlaylists {
		hasAccess, err := h.adminRepo.HasPlaylistAccess(r.Context(), admin, listID)
		if err != nil || !hasAccess {
			return nil, http.StatusForbidden, errors.New("you do not have access to this playlist")
		}
	}

	return admin, http.StatusOK, nil
}

func (h *PlaylistHandler) GetPlaylists(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var admin *models.Admin
	if claims != nil && h.adminRepo != nil {
		admin, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	playlists, err := h.playlistRepo.GetForAdmin(r.Context(), admin)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_playlists", "message": err.Error()})
		return
	}

	if claims != nil && claims.IsAPIToken && claims.TokenHasPlaylistScope {
		filtered := make([]models.Playlist, 0, len(playlists))
		for _, p := range playlists {
			if claims.HasTokenPlaylistAccess(p.ID) {
				filtered = append(filtered, p)
			}
		}
		playlists = filtered
	}

	writeJSON(w, http.StatusOK, playlists)
}

func (h *PlaylistHandler) GetPlaylist(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	admin, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	p, err := h.playlistRepo.GetByIDForAdmin(r.Context(), listID, admin)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_playlist", "message": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "playlist_not_found"})
		return
	}

	writeJSON(w, http.StatusOK, p)
}

type UpdatePlaylistSettingsRequest struct {
	AllowTracking          *bool   `json:"allow_tracking"`
	LimitMaxConnections    *bool   `json:"limit_max_connections"`
	MaxConnections         *int    `json:"max_connections"`
	TrackingTimeoutMinutes *int    `json:"tracking_timeout_minutes"`
	Cname                  *string `json:"cname"`
	EnforceCname           *bool   `json:"enforce_cname"`
	CnameSSL               *bool   `json:"cname_ssl"`
}

func (h *PlaylistHandler) UpdatePlaylistSettings(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	admin, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	var req UpdatePlaylistSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body", "message": err.Error()})
		return
	}

	if err := h.playlistRepo.UpdateSettings(r.Context(), listID, req.AllowTracking, req.LimitMaxConnections, req.MaxConnections, req.TrackingTimeoutMinutes, req.Cname, req.EnforceCname, req.CnameSSL); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_updating_settings", "message": err.Error()})
		return
	}

	updated, err := h.playlistRepo.GetByIDForAdmin(r.Context(), listID, admin)
	if err != nil || updated == nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (h *PlaylistHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	channels, vods, series, err := h.playlistRepo.GetCategories(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_categories", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"channels": channels,
		"vods":     vods,
		"series":   series,
	})
}

type SyncRequest struct {
	Force *bool `json:"force,omitempty"`
}

func (h *PlaylistHandler) StartPlaylistSync(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	if h.syncer == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "syncer_unavailable",
			"message": "Playlist synchronization engine is not available on this server.",
		})
		return
	}

	force := false
	if fStr := r.URL.Query().Get("force"); fStr != "" {
		force = fStr == "true" || fStr == "1"
	}
	var req SyncRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Force != nil {
			force = *req.Force
		}
	}

	jobID, err := h.syncer.StartAsyncSync(listID, force)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"error":   "sync_in_progress",
			"message": err.Error(),
			"status":  h.syncer.GetSyncStatus(),
		})
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"success":     true,
		"job_id":      jobID,
		"playlist_id": listID,
		"message":     "Playlist synchronization started in background",
		"status":      h.syncer.GetSyncStatus(),
	})
}

func (h *PlaylistHandler) StartAllPlaylistsSync(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil || claims.Role != "admin" || (claims.IsAPIToken && claims.TokenHasPlaylistScope) {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "Only pure administrators without playlist restrictions can synchronize all playlists.",
		})
		return
	}

	if h.syncer == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "syncer_unavailable",
			"message": "Playlist synchronization engine is not available on this server.",
		})
		return
	}

	force := false
	if fStr := r.URL.Query().Get("force"); fStr != "" {
		force = fStr == "true" || fStr == "1"
	}
	var req SyncRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Force != nil {
			force = *req.Force
		}
	}

	jobID, err := h.syncer.StartAsyncSync(0, force)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]interface{}{
			"error":   "sync_in_progress",
			"message": err.Error(),
			"status":  h.syncer.GetSyncStatus(),
		})
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"success": true,
		"job_id":  jobID,
		"message": "All playlists synchronization started in background",
		"status":  h.syncer.GetSyncStatus(),
	})
}

func (h *PlaylistHandler) GetSyncStatus(w http.ResponseWriter, r *http.Request) {
	if h.syncer == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"is_running": false,
			"status":     "disabled",
			"step":       "Syncer engine not configured",
		})
		return
	}

	writeJSON(w, http.StatusOK, h.syncer.GetSyncStatus())
}

// GetPlaylistSyncLogs returns recent sync logs (last 7 days) for a specific playlist.
func (h *PlaylistHandler) GetPlaylistSyncLogs(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	if h.syncLogRepo == nil {
		writeJSON(w, http.StatusOK, []models.SyncLog{})
		return
	}

	limit := 50
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	includeGlobal := r.URL.Query().Get("include_global") == "true" || r.URL.Query().Get("include_global") == "1"
	logs, err := h.syncLogRepo.GetLogsForPlaylist(r.Context(), listID, limit, includeGlobal)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_sync_logs", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, logs)
}

// GetAllSyncLogs returns recent sync logs (last 7 days) across all accessible playlists.
func (h *PlaylistHandler) GetAllSyncLogs(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	var admin *models.Admin
	if claims != nil && h.adminRepo != nil {
		admin, _ = h.adminRepo.GetByID(r.Context(), claims.AdminID)
	}

	if h.syncLogRepo == nil {
		writeJSON(w, http.StatusOK, []models.SyncLog{})
		return
	}

	limit := 100
	if lStr := r.URL.Query().Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil && l > 0 && l <= 200 {
			limit = l
		}
	}

	logs, err := h.syncLogRepo.GetAllLogs(r.Context(), admin, limit)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_sync_logs", "message": err.Error()})
		return
	}

	if claims != nil && claims.IsAPIToken && claims.TokenHasPlaylistScope {
		filtered := make([]models.SyncLog, 0, len(logs))
		for _, l := range logs {
			if l.PlaylistID != nil && claims.HasTokenPlaylistAccess(*l.PlaylistID) {
				filtered = append(filtered, l)
			}
		}
		logs = filtered
	}

	writeJSON(w, http.StatusOK, logs)
}

// DeletePlaylist deletes a playlist, its cascaded child data, and cached EPG files.
func (h *PlaylistHandler) DeletePlaylist(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	// Fetch playlist name for logging prior to deletion
	var playlistName string
	if p, err := h.playlistRepo.GetByID(r.Context(), listID); err == nil && p != nil {
		playlistName = p.Name
	}
	if playlistName == "" {
		playlistName = fmt.Sprintf("Playlist %d", listID)
	}

	if err := h.playlistRepo.DeletePlaylist(r.Context(), listID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_deleting_playlist",
			"message": err.Error(),
		})
		return
	}

	// Remove static XMLTV cache files if they exist
	epgCacheDir := os.Getenv("EPG_CACHE_DIR")
	if epgCacheDir == "" {
		epgCacheDir = filepath.Join("data", "epg")
	}
	_ = os.Remove(filepath.Join(epgCacheDir, fmt.Sprintf("%d.xml", listID)))
	_ = os.Remove(filepath.Join(epgCacheDir, fmt.Sprintf("%d.xml.gz", listID)))

	if h.syncLogRepo != nil {
		adminUser := "admin"
		if claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims); claims != nil && claims.Username != "" {
			adminUser = claims.Username
		}
		pid := listID
		_ = h.syncLogRepo.CreateSyncLog(r.Context(), &models.SyncLog{
			PlaylistID:   &pid,
			PlaylistName: playlistName,
			SyncType:     "playlist",
			Status:       "deleted",
			Message:      fmt.Sprintf("Playlist '%s' (ID %d) manually deleted from dashboard by administrator '%s'", playlistName, listID, adminUser),
			DurationMs:   0,
			CreatedAt:    time.Now(),
		})
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Playlist '%s' (ID %d) was successfully deleted", playlistName, listID),
	})
}

// GetWelcomeInfo returns the welcome_info configured for a playlist.
func (h *PlaylistHandler) GetWelcomeInfo(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	p, err := h.playlistRepo.GetByID(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_playlist", "message": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "playlist_not_found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"welcome_info": p.WelcomeInfo,
		"message":      p.Message,
	})
}

// UpdateWelcomeInfo updates the welcome_info for a playlist.
func (h *PlaylistHandler) UpdateWelcomeInfo(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	var rawBody json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json_body", "message": err.Error()})
		return
	}

	trimmed := strings.TrimSpace(string(rawBody))
	if trimmed != "" && trimmed != "{}" && trimmed != "null" {
		var info struct {
			Category   string              `json:"category"`
			Tags       []string            `json:"tags"`
			Stream     string              `json:"stream"`
			Image      string              `json:"image"`
			Where      models.WelcomeWhere `json:"where"`
			DisableAll bool                `json:"disableAll"`
		}
		if err := json.Unmarshal(rawBody, &info); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_welcome_info_format", "message": err.Error()})
			return
		}

		if info.DisableAll {
			rawBody = json.RawMessage("{}")
		} else {
			if strings.TrimSpace(info.Category) == "" {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_category", "message": "Category name cannot be empty"})
				return
			}
			if len(info.Tags) == 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_tags", "message": "Tags cannot be empty"})
				return
			}
			if len(info.Tags) > 10 {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "too_many_tags", "message": "Tags cannot exceed 10 lines"})
				return
			}
			if !info.Where.Channels && !info.Where.Vods && !info.Where.Series {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_where", "message": "Select at least one destination (Channels or Movies)"})
				return
			}
		}
	}

	if err := h.playlistRepo.UpdateWelcomeInfo(r.Context(), listID, rawBody); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_updating_welcome_info", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(r.Context(), "cache:auth:user:")
		_ = h.cache.DeletePrefix(r.Context(), fmt.Sprintf("cache:cat:%d:", listID))
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"message":      "Welcome information updated successfully",
		"welcome_info": rawBody,
	})
}

// GetPortalBranding returns the portal_branding configured for a playlist.
func (h *PlaylistHandler) GetPortalBranding(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	p, err := h.playlistRepo.GetByID(r.Context(), listID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_playlist", "message": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "playlist_not_found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"portal_branding": p.PortalBranding,
	})
}

// UpdatePortalBranding updates the portal_branding for a playlist.
func (h *PlaylistHandler) UpdatePortalBranding(w http.ResponseWriter, r *http.Request) {
	listIDStr := chi.URLParam(r, "listId")
	listID, err := strconv.ParseUint(listIDStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	var rawBody json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&rawBody); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json_body", "message": err.Error()})
		return
	}

	if len(rawBody) > 0 && string(rawBody) != "null" && string(rawBody) != "{}" {
		var branding models.PlaylistPortalBranding
		if err := json.Unmarshal(rawBody, &branding); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_portal_branding_format", "message": err.Error()})
			return
		}
	}

	if err := h.playlistRepo.UpdatePortalBranding(r.Context(), listID, rawBody); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_updating_portal_branding", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(r.Context(), "cache:auth:user:")
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":         true,
		"message":         "Portal branding updated successfully",
		"portal_branding": rawBody,
	})
}

// ImportFromEditor imports managed users and welcome info from PlaylistLabs for this specific playlist.
func (h *PlaylistHandler) ImportFromEditor(w http.ResponseWriter, r *http.Request) {
	listID, err := strconv.ParseUint(chi.URLParam(r, "listId"), 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_playlist_id", "message": "Playlist ID must be numeric"})
		return
	}

	_, status, err := h.getScopedPlaylistAdmin(r, listID)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "forbidden", "message": err.Error()})
		return
	}

	var req ImportFromEditorRequest
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "invalid_request_body",
				"message": err.Error(),
			})
			return
		}
	}
	req.PlaylistID = listID
	if req.Mode == "" {
		req.Mode = "skip"
	}

	if h.apiClient == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "api_client_not_configured",
			"message": "PlaylistLabs client is not configured",
		})
		return
	}

	apiClient := h.apiClient
	if apiClient.GetAPIToken() == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "api_token_missing",
			"message": "PlaylistLabs Access Token is not configured in settings",
		})
		return
	}

	ctx := r.Context()
	editorPlaylists, err := apiClient.GetPlaylists(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error":   "editor_api_error",
			"message": fmt.Sprintf("Failed fetching playlists from PlaylistLabs: %v", err),
		})
		return
	}

	var target *client.Playlist
	for i := range editorPlaylists {
		if editorPlaylists[i].ID.Uint64() == listID {
			target = &editorPlaylists[i]
			break
		}
	}
	if target == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error":   "playlist_not_found",
			"message": fmt.Sprintf("Playlist %d was not found in PlaylistLabs", listID),
		})
		return
	}

	resp := ImportFromEditorResponse{
		Success: true,
	}

	// 1. Update Welcome Info if requested
	if req.ImportWelcomeInfo && len(target.WelcomeInfo) > 0 && string(target.WelcomeInfo) != "null" && h.playlistRepo != nil {
		if err := h.playlistRepo.UpdateWelcomeInfo(ctx, listID, target.WelcomeInfo); err != nil {
			resp.Errors = append(resp.Errors, fmt.Sprintf("Failed updating welcome info: %v", err))
		} else {
			resp.WelcomeInfoUpdated = 1
		}
	}

	// 2. Fetch and import users
	users, err := apiClient.GetAllUsers(ctx, listID)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error":   "failed_fetching_users",
			"message": fmt.Sprintf("Failed fetching users from PlaylistLabs: %v", err),
		})
		return
	}

	if len(users) > 0 && h.userRepo != nil {
		res, impErr := h.userRepo.ImportUsers(ctx, listID, users, req.Mode)
		if impErr != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "import_failed",
				"message": impErr.Error(),
			})
			return
		}
		resp.TotalProcessed = res.TotalProcessed
		resp.Imported = res.Imported
		resp.Updated = res.Updated
		resp.Skipped = res.Skipped
		resp.Errors = append(resp.Errors, res.Errors...)
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(ctx, "cache:auth:user:")
		_ = h.cache.DeletePrefix(ctx, fmt.Sprintf("cache:cat:%d:", listID))
	}

	resp.Message = fmt.Sprintf("Successfully processed %d users: %d imported, %d updated, %d skipped.",
		resp.TotalProcessed, resp.Imported, resp.Updated, resp.Skipped)

	writeJSON(w, http.StatusOK, resp)
}
