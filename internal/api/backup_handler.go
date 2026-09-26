package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/backup"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
)

type BackupHandler struct {
	userRepo     *repository.UserRepo
	playlistRepo *repository.PlaylistRepo
	adminRepo    *repository.AdminRepo
	settingsRepo *repository.SettingsRepo
	service      *backup.Service
}

func NewBackupHandler(
	userRepo *repository.UserRepo,
	playlistRepo *repository.PlaylistRepo,
	adminRepo *repository.AdminRepo,
	settingsRepo *repository.SettingsRepo,
	service ...*backup.Service,
) *BackupHandler {
	var svc *backup.Service
	if len(service) > 0 && service[0] != nil {
		svc = service[0]
	} else {
		backupDir := os.Getenv("BACKUP_DIR")
		if backupDir == "" {
			backupDir = "./backups"
		}
		svc = backup.NewService(userRepo, playlistRepo, settingsRepo, adminRepo, backupDir)
	}
	return &BackupHandler{
		userRepo:     userRepo,
		playlistRepo: playlistRepo,
		adminRepo:    adminRepo,
		settingsRepo: settingsRepo,
		service:      svc,
	}
}

// GetService returns the underlying backup service.
func (h *BackupHandler) GetService() *backup.Service {
	return h.service
}

type BackupPayload = models.BackupPayload
type RestoreRequest = models.RestoreRequest

// BackupUsers exports managed users and/or system configuration to a structured JSON file. Strictly restricted to pure admin.
func (h *BackupHandler) BackupUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil || claims.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "Only pure administrators can perform backup operations.",
		})
		return
	}

	var listID *uint64
	listIDParam := chi.URLParam(r, "listId")
	if listIDParam == "" {
		listIDParam = r.URL.Query().Get("list_id")
	}

	if listIDParam != "" {
		id, err := strconv.ParseUint(listIDParam, 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_list_id"})
			return
		}
		listID = &id
	}

	backupType := strings.TrimSpace(r.URL.Query().Get("type"))
	if backupType == "" {
		if listID != nil && *listID > 0 {
			backupType = "users"
		} else {
			backupType = "full"
		}
	}

	includeToken := r.URL.Query().Get("include_token") == "true" || r.URL.Query().Get("include_token") == "1"
	includeTeam := r.URL.Query().Get("include_team") == "true" || r.URL.Query().Get("include_team") == "1"

	payload, err := h.service.CreateBackupPayload(r.Context(), listID, backupType, includeToken, includeTeam, claims.Username)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "backup_failed",
			"message": err.Error(),
		})
		return
	}

	now := time.Now().UTC()
	var filename string
	if listID != nil && payload.PlaylistName != "" {
		safeName := strings.ReplaceAll(payload.PlaylistName, " ", "_")
		safeName = strings.ReplaceAll(safeName, "/", "_")
		filename = fmt.Sprintf("managed_users_backup_%s_%d_%s.json", safeName, *listID, now.Format("20060102_150405"))
	} else if backupType == "settings" {
		filename = fmt.Sprintf("system_settings_backup_%s.json", now.Format("20060102_150405"))
	} else if backupType == "users" {
		filename = fmt.Sprintf("managed_users_backup_all_%s.json", now.Format("20060102_150405"))
	} else {
		filename = fmt.Sprintf("system_full_backup_%s.json", now.Format("20060102_150405"))
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}

// RestoreUsers imports managed users, system settings, and/or welcome info. Strictly restricted to pure admin.
func (h *BackupHandler) RestoreUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil || claims.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "Only pure administrators can perform restore operations.",
		})
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed_reading_body"})
		return
	}

	var req RestoreRequest
	var backupPayload models.BackupPayload
	var parsedSuccessfully bool

	// 1. Try unmarshaling as structured RestoreRequest
	if err := json.Unmarshal(bodyBytes, &req); err == nil {
		if req.FileContent != nil {
			backupPayload = *req.FileContent
			parsedSuccessfully = true
		} else if len(req.Users) > 0 {
			backupPayload.Users = req.Users
			parsedSuccessfully = true
		}
	}

	// 2. Try unmarshaling directly as BackupPayload
	if !parsedSuccessfully {
		if errPayload := json.Unmarshal(bodyBytes, &backupPayload); errPayload == nil {
			if len(backupPayload.Users) > 0 || backupPayload.SystemSettings != nil || len(backupPayload.Playlists) > 0 || len(backupPayload.TeamMembers) > 0 {
				parsedSuccessfully = true
			}
		}
	}

	// 3. Try unmarshaling as raw array of users
	if !parsedSuccessfully {
		var rawUsers []models.ManagedUser
		if errRaw := json.Unmarshal(bodyBytes, &rawUsers); errRaw == nil && len(rawUsers) > 0 {
			backupPayload.Users = rawUsers
			backupPayload.Version = "1.0"
			parsedSuccessfully = true
		}
	}

	if !parsedSuccessfully {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "empty_backup",
			"message": "No users, settings, playlists, or team accounts found in the uploaded backup file.",
		})
		return
	}

	// Check URL param override for listId
	listIDParam := chi.URLParam(r, "listId")
	if listIDParam != "" {
		if id, err := strconv.ParseUint(listIDParam, 10, 64); err == nil {
			fid := models.FlexUint64(id)
			req.TargetListID = &fid
		}
	}

	// Check query params overrides
	if qTarget := r.URL.Query().Get("target_list_id"); qTarget != "" {
		if id, err := strconv.ParseUint(qTarget, 10, 64); err == nil {
			fid := models.FlexUint64(id)
			req.TargetListID = &fid
		}
	}
	if qSource := r.URL.Query().Get("source_list_id"); qSource != "" {
		if id, err := strconv.ParseUint(qSource, 10, 64); err == nil {
			fid := models.FlexUint64(id)
			req.SourceListID = &fid
		}
	}
	if qTeam := r.URL.Query().Get("restore_team_members"); qTeam == "true" || qTeam == "1" {
		req.RestoreTeamMembers = true
	}
	if qTeamScope := r.URL.Query().Get("restore_team_scope"); qTeamScope != "" {
		req.RestoreTeamScope = qTeamScope
	}
	if qUsers := r.URL.Query().Get("restore_users"); qUsers != "" {
		val := qUsers == "true" || qUsers == "1"
		req.RestoreUsers = &val
	}
	if qSettings := r.URL.Query().Get("restore_settings"); qSettings != "" {
		req.RestoreSettings = qSettings == "true" || qSettings == "1"
	}
	if qPlaylists := r.URL.Query().Get("restore_playlists"); qPlaylists != "" {
		req.RestorePlaylists = qPlaylists == "true" || qPlaylists == "1"
	}
	if qToken := r.URL.Query().Get("restore_token"); qToken != "" {
		req.RestoreToken = qToken == "true" || qToken == "1"
	}
	if req.Mode == "" {
		req.Mode = r.URL.Query().Get("mode")
	}

	result, err := h.service.RestoreFromPayload(r.Context(), &backupPayload, req, claims.AdminID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "restore_failed",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, result)
}
