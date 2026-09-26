package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/security"
)

type SetupHandler struct {
	adminRepo    *repository.AdminRepo
	settingsRepo *repository.SettingsRepo
	apiClient    *client.APIClient
	appCache     cache.Cache
	secSvc       *security.Service
	syncerEngine models.PlaylistSyncer
	mu           sync.Mutex
}

func NewSetupHandler(
	adminRepo *repository.AdminRepo,
	settingsRepo *repository.SettingsRepo,
	apiClient *client.APIClient,
	appCache cache.Cache,
	secSvc *security.Service,
	syncerEngine ...models.PlaylistSyncer,
) *SetupHandler {
	var se models.PlaylistSyncer
	if len(syncerEngine) > 0 {
		se = syncerEngine[0]
	}
	return &SetupHandler{
		adminRepo:    adminRepo,
		settingsRepo: settingsRepo,
		apiClient:    apiClient,
		appCache:     appCache,
		secSvc:       secSvc,
		syncerEngine: se,
	}
}

type SetupStatusResponse struct {
	IsSetupNeeded bool   `json:"is_setup_needed"`
	DefaultAPIURL string `json:"default_api_url,omitempty"`
}

func (h *SetupHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	count, err := h.adminRepo.CountAdmins(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_checking_setup_status"})
		return
	}

	isNeeded := count == 0
	if !isNeeded && h.settingsRepo != nil {
		if s, err := h.settingsRepo.Get(r.Context()); err == nil && s != nil {
			if !s.SetupCompleted {
				isNeeded = true
			}
		}
	}

	defaultURL := "https://api.playlistlabs.io"
	if h.apiClient != nil && h.apiClient.GetBaseURL() != "" && !strings.Contains(h.apiClient.GetBaseURL(), "localhost") {
		defaultURL = h.apiClient.GetBaseURL()
	}

	writeJSON(w, http.StatusOK, SetupStatusResponse{
		IsSetupNeeded: isNeeded,
		DefaultAPIURL: defaultURL,
	})
}

type TestConnectionRequest struct {
	APIURL      string `json:"api_url"`
	APIToken    string `json:"api_token"`
	APIPassword string `json:"api_password,omitempty"`
}

type TestConnectionResponse struct {
	Success        bool   `json:"success"`
	PlaylistsCount int    `json:"playlists_count,omitempty"`
	Message        string `json:"message,omitempty"`
	Error          string `json:"error,omitempty"`
	Code           string `json:"code,omitempty"`
	Title          string `json:"title,omitempty"`
	Body           string `json:"body,omitempty"`
	UpgradeURL     string `json:"upgrade_url,omitempty"`
}

func (h *SetupHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, TestConnectionResponse{
			Success: false,
			Error:   "Invalid JSON request body",
		})
		return
	}

	req.APIURL = strings.TrimSpace(req.APIURL)
	req.APIToken = strings.TrimSpace(req.APIToken)
	req.APIPassword = strings.TrimSpace(req.APIPassword)

	if req.APIURL == "" {
		writeJSON(w, http.StatusBadRequest, TestConnectionResponse{
			Success: false,
			Error:   "Endpoint Base URL is required",
		})
		return
	}

	parsed, err := url.ParseRequestURI(req.APIURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		writeJSON(w, http.StatusBadRequest, TestConnectionResponse{
			Success: false,
			Error:   "Endpoint Base URL must be a valid HTTP or HTTPS address",
		})
		return
	}

	if req.APIToken == "" {
		writeJSON(w, http.StatusBadRequest, TestConnectionResponse{
			Success: false,
			Error:   "Access Token is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	count, err := h.apiClient.ValidateConnectionWithPassword(ctx, req.APIURL, req.APIToken, req.APIPassword)
	if err != nil {
		var upErr *client.UpstreamAPIError
		if errors.As(err, &upErr) {
			writeJSON(w, http.StatusOK, TestConnectionResponse{
				Success:    false,
				Error:      upErr.Error(),
				Code:       upErr.Code,
				Title:      upErr.Title,
				Body:       upErr.Body,
				UpgradeURL: upErr.UpgradeURL,
			})
			return
		}
		writeJSON(w, http.StatusBadRequest, TestConnectionResponse{
			Success: false,
			Error:   fmt.Sprintf("Connection failed: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, TestConnectionResponse{
		Success:        true,
		PlaylistsCount: count,
		Message:        fmt.Sprintf("Connection successful! Found %d playlist(s).", count),
	})
}

type InitializeSetupRequest struct {
	Username        string `json:"username"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirm_password"`
	APIURL          string `json:"api_url"`
	APIToken        string `json:"api_token"`
	APIPassword     string `json:"api_password,omitempty"`
	SetupMode       string `json:"setup_mode"` // "quick" or "advanced"

	// Captcha settings
	CaptchaProvider  string `json:"captcha_provider"` // "default", "turnstile", "recaptcha_v2", "recaptcha_v3", "hcaptcha", "disabled"
	CaptchaSiteKey   string `json:"captcha_site_key"`
	CaptchaSecretKey string `json:"captcha_secret_key"`

	// Sync frequencies (in hours)
	PlaylistSyncIntervalHours int `json:"playlist_sync_interval_hours"`
	ExpirySyncIntervalHours   int `json:"expiry_sync_interval_hours"`

	// Cache settings
	CacheEnabled              bool `json:"cache_enabled"`
	CacheAuthTTLMinutes       int  `json:"cache_auth_ttl_minutes"`
	CacheCategoriesTTLMinutes int  `json:"cache_categories_ttl_minutes"`
	CacheStreamsTTLMinutes    int  `json:"cache_streams_ttl_minutes"`

	// Security & Anti-Brute-Force
	AntiBruteForceEnabled     bool `json:"antibruteforce_enabled"`
	AntiBruteForceMaxAttempts int  `json:"antibruteforce_max_attempts"`
	AntiBruteForceWindowMins  int  `json:"antibruteforce_window_minutes"`
	AntiBruteForceBanHours    int  `json:"antibruteforce_ban_hours"`
	MultiIPDetectionEnabled   bool `json:"multi_ip_detection_enabled"`
	ThrottleEnabled           bool `json:"throttle_enabled"`

	// Backup settings
	BackupEnabled       bool `json:"backup_enabled"`
	BackupIntervalHours int  `json:"backup_interval_hours"`
	BackupRetentionDays int  `json:"backup_retention_days"`

	// Integrations & Portal
	TMDBApiKey         string `json:"tmdb_api_key"`
	UserDashboardTitle string `json:"user_dashboard_title"`

	// Domain Isolation (Advanced only)
	AdminHostname             string `json:"admin_hostname"`
	BlockStreamingOnAdminHost bool   `json:"block_streaming_on_admin_host"`
	RestrictAdminToAdminHost  bool   `json:"restrict_admin_to_admin_host"`
	BlockDirectIPStreaming    bool   `json:"block_direct_ip_streaming"`
}

func (h *SetupHandler) Initialize(w http.ResponseWriter, r *http.Request) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// 1. Guard against re-initialization if setup is already completed
	count, err := h.adminRepo.CountAdmins(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "database_query_error"})
		return
	}
	if count > 0 {
		isCompleted := true
		if h.settingsRepo != nil {
			if s, err := h.settingsRepo.Get(r.Context()); err == nil && s != nil {
				if !s.SetupCompleted {
					isCompleted = false
				}
			}
		}
		if isCompleted {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error":   "setup_already_completed",
				"message": "Initial setup has already been completed. Setup endpoints are locked.",
			})
			return
		}
	}

	var req InitializeSetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	// 2. Validate Admin Credentials
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || len(req.Username) < 3 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_username",
			"message": "Username must be at least 3 characters long.",
		})
		return
	}

	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "weak_password",
			"message": "Password must be at least 6 characters long.",
		})
		return
	}

	if req.Password != req.ConfirmPassword {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "password_mismatch",
			"message": "Passwords do not match. Please verify your password entry.",
		})
		return
	}

	// 3. Validate Mandatory API Connection
	req.APIURL = strings.TrimRight(strings.TrimSpace(req.APIURL), "/")
	req.APIToken = strings.TrimSpace(req.APIToken)

	if req.APIURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_api_url",
			"message": "Endpoint Base URL is required.",
		})
		return
	}
	if req.APIToken == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_api_token",
			"message": "Access Token is required.",
		})
		return
	}

	parsed, err := url.ParseRequestURI(req.APIURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_api_url",
			"message": "Endpoint Base URL must be a valid HTTP or HTTPS address.",
		})
		return
	}

	req.APIPassword = strings.TrimSpace(req.APIPassword)

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	_, err = h.apiClient.ValidateConnectionWithPassword(ctx, req.APIURL, req.APIToken, req.APIPassword)
	if err != nil {
		var upErr *client.UpstreamAPIError
		if errors.As(err, &upErr) {
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"error":       upErr.Error(),
				"code":        upErr.Code,
				"title":       upErr.Title,
				"body":        upErr.Body,
				"upgrade_url": upErr.UpgradeURL,
				"message":     upErr.Error(),
			})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "api_connection_failed",
			"message": fmt.Sprintf("Failed to connect to PlaylistLabs API: %v. Please verify your URL, Token, and Password.", err),
		})
		return
	}

	// 4. Create or Update Master Admin
	adminUser, err := h.adminRepo.UpsertInitialAdmin(r.Context(), req.Username, req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_creating_admin",
			"message": fmt.Sprintf("Could not configure administrator account: %v", err),
		})
		return
	}

	// 5. Apply System Settings (Defaults vs Advanced)
	sysSettings, err := h.settingsRepo.Get(r.Context())
	if err != nil || sysSettings == nil {
		sysSettings = &models.SystemSettings{ID: 1}
	}

	sysSettings.IPTVEditorAPIURL = req.APIURL
	sysSettings.IPTVEditorAPIToken = req.APIToken
	sysSettings.IPTVEditorAPIPassword = req.APIPassword
	sysSettings.SetupCompleted = true

	// Captcha selection
	if req.CaptchaProvider != "" {
		sysSettings.CaptchaProvider = req.CaptchaProvider
		sysSettings.CaptchaSiteKey = req.CaptchaSiteKey
		sysSettings.CaptchaSecretKey = req.CaptchaSecretKey
	} else {
		sysSettings.CaptchaProvider = "default"
	}

	// Refresh intervals
	if req.PlaylistSyncIntervalHours > 0 {
		sysSettings.PlaylistSyncIntervalHours = req.PlaylistSyncIntervalHours
	} else {
		sysSettings.PlaylistSyncIntervalHours = 6
	}
	sysSettings.PlaylistSyncEnabled = true

	if req.ExpirySyncIntervalHours > 0 {
		sysSettings.ExpirySyncIntervalHours = req.ExpirySyncIntervalHours
	} else {
		sysSettings.ExpirySyncIntervalHours = 12
	}
	sysSettings.ExpirySyncEnabled = true

	// Cache settings (Enabled by default)
	if req.SetupMode == "advanced" {
		sysSettings.CacheEnabled = req.CacheEnabled
		if req.CacheAuthTTLMinutes > 0 {
			sysSettings.CacheAuthTTLMinutes = req.CacheAuthTTLMinutes
		}
		if req.CacheCategoriesTTLMinutes > 0 {
			sysSettings.CacheCategoriesTTLMinutes = req.CacheCategoriesTTLMinutes
		}
		if req.CacheStreamsTTLMinutes > 0 {
			sysSettings.CacheStreamsTTLMinutes = req.CacheStreamsTTLMinutes
		}
	} else {
		sysSettings.CacheEnabled = true
		sysSettings.CacheAuthTTLMinutes = 15
		sysSettings.CacheCategoriesTTLMinutes = 60
		sysSettings.CacheStreamsTTLMinutes = 15
	}

	// Security settings (Enabled by default)
	if req.SetupMode == "advanced" {
		sysSettings.AntiBruteForceEnabled = req.AntiBruteForceEnabled
		if req.AntiBruteForceMaxAttempts > 0 {
			sysSettings.AntiBruteForceMaxAttempts = req.AntiBruteForceMaxAttempts
		}
		if req.AntiBruteForceWindowMins > 0 {
			sysSettings.AntiBruteForceWindowMinutes = req.AntiBruteForceWindowMins
		}
		if req.AntiBruteForceBanHours > 0 {
			sysSettings.AntiBruteForceBanHours = req.AntiBruteForceBanHours
		}
		sysSettings.MultiIPDetectionEnabled = req.MultiIPDetectionEnabled
		sysSettings.ThrottleEnabled = req.ThrottleEnabled
	} else {
		sysSettings.AntiBruteForceEnabled = true
		sysSettings.AntiBruteForceMaxAttempts = 5
		sysSettings.AntiBruteForceWindowMinutes = 15
		sysSettings.AntiBruteForceBanHours = 24
		sysSettings.MultiIPDetectionEnabled = true
		sysSettings.ThrottleEnabled = true
	}

	// Daily Automated Backups (Enabled by default: every 24h, 30d retention)
	if req.SetupMode == "advanced" && req.BackupIntervalHours > 0 {
		sysSettings.BackupEnabled = req.BackupEnabled
		sysSettings.BackupIntervalHours = req.BackupIntervalHours
		sysSettings.BackupRetentionDays = req.BackupRetentionDays
	} else {
		sysSettings.BackupEnabled = true
		sysSettings.BackupIntervalHours = 24
		sysSettings.BackupRetentionDays = 30
	}

	// Integrations & Portal
	if req.TMDBApiKey != "" {
		sysSettings.TMDBApiKey = req.TMDBApiKey
	}
	if req.UserDashboardTitle != "" {
		sysSettings.UserDashboardTitle = req.UserDashboardTitle
	}

	// Domain Isolation (Advanced only)
	if req.SetupMode == "advanced" && req.AdminHostname != "" {
		sysSettings.AdminHostname = strings.TrimSpace(req.AdminHostname)
		sysSettings.BlockStreamingOnAdminHost = req.BlockStreamingOnAdminHost
		sysSettings.RestrictAdminToAdminHost = req.RestrictAdminToAdminHost
		sysSettings.BlockDirectIPStreaming = req.BlockDirectIPStreaming
	}

	if err := h.settingsRepo.Update(r.Context(), sysSettings); err != nil {
		log.Printf("[WARN] Failed saving initial system settings: %v", err)
	}

	// 6. Update Live Runtime Services
	h.apiClient.SetBaseURL(req.APIURL)
	h.apiClient.SetAPIToken(req.APIToken)
	h.apiClient.SetPassword(req.APIPassword)
	if h.appCache != nil {
		h.appCache.SetSettings(
			sysSettings.CacheEnabled,
			time.Duration(sysSettings.CacheAuthTTLMinutes)*time.Minute,
			time.Duration(sysSettings.CacheCategoriesTTLMinutes)*time.Minute,
			time.Duration(sysSettings.CacheStreamsTTLMinutes)*time.Minute,
		)
	}
	if h.secSvc != nil {
		h.secSvc.SetSettings(
			sysSettings.AntiBruteForceEnabled,
			sysSettings.AntiBruteForceBanHours,
			sysSettings.AntiBruteForceMaxAttempts,
			sysSettings.AntiBruteForceWindowMinutes,
		)
	}

	// Trigger asynchronous initial sync if syncerEngine is configured
	if h.syncerEngine != nil {
		log.Println("[INFO] Triggering post-setup initial sync...")
		_, _ = h.syncerEngine.StartAsyncSync(0, true)
	}

	// 7. Issue JWT and log user in immediately
	token, err := auth.GenerateToken(adminUser.ID, adminUser.Username, adminUser.Role, adminUser.CanCreateCollaborators, adminUser.CanCreateAdmins, adminUser.CanManageAPITokens)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_issuing_token"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"token":   token,
		"admin": map[string]interface{}{
			"id":                       adminUser.ID,
			"username":                 adminUser.Username,
			"role":                     adminUser.Role,
			"manage_all_playlists":     adminUser.ManageAllPlaylists,
			"can_see_all_users":        adminUser.CanSeeAllUsers,
			"can_create_collaborators": adminUser.CanCreateCollaborators,
			"can_create_admins":        adminUser.CanCreateAdmins,
			"can_manage_api_tokens":    adminUser.CanManageAPITokens,
		},
	})
}
