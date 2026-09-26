package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/backup"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/captcha"
	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/db"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"

	"github.com/go-chi/chi/v5"

	"playlistlabs_user_management_os/internal/scheduler"
	"playlistlabs_user_management_os/internal/security"
	"playlistlabs_user_management_os/internal/throttler"
	"playlistlabs_user_management_os/internal/tmdb"
	"playlistlabs_user_management_os/internal/util"
)

type SettingsHandler struct {
	settingsRepo   *repository.SettingsRepo
	backupSvc      *backup.Service
	scheduler      *scheduler.Scheduler
	syncer         models.PlaylistSyncer
	apiClient      *client.APIClient
	cache          cache.Cache
	secSvc         *security.Service
	throttler      *throttler.Throttler
	userRepo       *repository.UserRepo
	playlistRepo   *repository.PlaylistRepo
	tmdbClient     *tmdb.Client
	defaultTMDBKey string
	hostFilter     *security.HostFilter
	licenseGuard   *security.LicenseGuard
}

func NewSettingsHandler(
	settingsRepo *repository.SettingsRepo,
	backupSvc *backup.Service,
	sched *scheduler.Scheduler,
	syncerEngine ...models.PlaylistSyncer,
) *SettingsHandler {
	var se models.PlaylistSyncer
	if len(syncerEngine) > 0 {
		se = syncerEngine[0]
	}
	return &SettingsHandler{
		settingsRepo: settingsRepo,
		backupSvc:    backupSvc,
		scheduler:    sched,
		syncer:       se,
	}
}

// SetUserRepo injects the user repository.
func (h *SettingsHandler) SetUserRepo(ur *repository.UserRepo) {
	h.userRepo = ur
}

// SetPlaylistRepo injects the playlist repository.
func (h *SettingsHandler) SetPlaylistRepo(pr *repository.PlaylistRepo) {
	h.playlistRepo = pr
}

// SetCache sets the cache implementation.
func (h *SettingsHandler) SetCache(c cache.Cache) {
	h.cache = c
}

// SetAPIClient injects the IPTVEditor API client into SettingsHandler.
func (h *SettingsHandler) SetAPIClient(c *client.APIClient) {
	h.apiClient = c
}

// SetSecurityService injects the security service.
func (h *SettingsHandler) SetSecurityService(secSvc *security.Service) {
	h.secSvc = secSvc
}

// SetThrottler injects the throttler into SettingsHandler.
func (h *SettingsHandler) SetThrottler(t *throttler.Throttler) {
	h.throttler = t
}

// SetTMDBClient injects the TMDB client and default fallback key into SettingsHandler.
func (h *SettingsHandler) SetTMDBClient(c *tmdb.Client, defaultKey string) {
	h.tmdbClient = c
	h.defaultTMDBKey = defaultKey
}

// SetHostFilter injects the host isolation filter service.
func (h *SettingsHandler) SetHostFilter(hf *security.HostFilter) {
	h.hostFilter = hf
}

// SetLicenseGuard injects the license guard service.
func (h *SettingsHandler) SetLicenseGuard(lg *security.LicenseGuard) {
	h.licenseGuard = lg
}

// GetSettings retrieves current configuration and real-time execution status.
func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	status, err := h.scheduler.GetStatus(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_fetching_settings",
			"message": err.Error(),
		})
		return
	}
	h.populateCacheStatus(r.Context(), status)
	writeJSON(w, http.StatusOK, status)
}

// UpdateSettings updates interval hours and enable flags.
func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	// 1. Fetch existing settings from DB to safely preserve any unprovided fields
	existing, err := h.settingsRepo.Get(r.Context())
	if err != nil || existing == nil {
		existing = &models.SystemSettings{ID: 1}
	}

	wasSetupCompleted := existing.SetupCompleted
	origURL := existing.IPTVEditorAPIURL
	origToken := existing.IPTVEditorAPIToken
	origPass := existing.IPTVEditorAPIPassword
	origCaptchaSecret := existing.CaptchaSecretKey

	// Inspect raw keys present in incoming request
	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(body, &rawMap); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	// Unmarshal directly onto existing struct so only provided fields are overwritten
	if err := json.Unmarshal(body, existing); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	// Always preserve setup completed status
	if wasSetupCompleted {
		existing.SetupCompleted = true
	}

	// Protect critical upstream API credentials if not explicitly supplied
	if _, ok := rawMap["iptveditor_api_url"]; !ok && origURL != "" {
		existing.IPTVEditorAPIURL = origURL
	}
	if _, ok := rawMap["iptveditor_api_token"]; !ok && origToken != "" {
		existing.IPTVEditorAPIToken = origToken
	}
	if _, ok := rawMap["iptveditor_api_password"]; !ok && origPass != "" {
		existing.IPTVEditorAPIPassword = origPass
	}
	if _, ok := rawMap["captcha_secret_key"]; !ok && origCaptchaSecret != "" {
		existing.CaptchaSecretKey = origCaptchaSecret
	}
	if strings.TrimSpace(existing.CaptchaProvider) == "" {
		existing.CaptchaProvider = "default"
	}

	s := *existing

	if s.PlaylistSyncIntervalHours < 1 {
		s.PlaylistSyncIntervalHours = 1
	}
	if s.ExpirySyncIntervalHours < 1 {
		s.ExpirySyncIntervalHours = 1
	}
	if s.BackupIntervalHours < 1 {
		s.BackupIntervalHours = 1
	}
	if s.BackupRetentionDays < 1 {
		s.BackupRetentionDays = 30
	}
	if s.SecurityLogRetentionDays < 1 {
		s.SecurityLogRetentionDays = 7
	}
	if s.AntiBruteForceMaxAttempts < 1 {
		s.AntiBruteForceMaxAttempts = 5
	}
	if s.AntiBruteForceWindowMinutes < 1 {
		s.AntiBruteForceWindowMinutes = 15
	}
	if s.AntiBruteForceBanHours < 1 {
		s.AntiBruteForceBanHours = 24
	}
	if s.CacheAuthTTLMinutes < 1 {
		s.CacheAuthTTLMinutes = 1
	}
	if s.CacheCategoriesTTLMinutes < 1 {
		s.CacheCategoriesTTLMinutes = 1
	}
	if s.CacheStreamsTTLMinutes < 1 {
		s.CacheStreamsTTLMinutes = 1
	}
	if s.TrackingTimeoutMinutes < 1 {
		s.TrackingTimeoutMinutes = 10
	}

	if s.ThrottleRouterLimit <= 0 {
		s.ThrottleRouterLimit = 30
	}
	if s.ThrottleRouterWindowSeconds <= 0 {
		s.ThrottleRouterWindowSeconds = 10
	}
	if s.ThrottleM3UEPGLimit <= 0 {
		s.ThrottleM3UEPGLimit = 18
	}
	if s.ThrottleM3UEPGWindowSeconds <= 0 {
		s.ThrottleM3UEPGWindowSeconds = 300
	}
	if s.ThrottleXtreamLimit <= 0 {
		s.ThrottleXtreamLimit = 40
	}
	if s.ThrottleXtreamWindowSeconds <= 0 {
		s.ThrottleXtreamWindowSeconds = 20
	}
	if s.ThrottleStalkerLimit <= 0 {
		s.ThrottleStalkerLimit = 60
	}
	if s.ThrottleStalkerWindowSeconds <= 0 {
		s.ThrottleStalkerWindowSeconds = 60
	}
	if s.EPGMaxDays < 1 {
		s.EPGMaxDays = 4
	}

	s.AdminHostname = util.NormalizeHost(s.AdminHostname)
	if s.AdminHostname == "" {
		s.RestrictAdminToAdminHost = false
	}

	if err := h.settingsRepo.Update(r.Context(), &s); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_updating_settings",
			"message": err.Error(),
		})
		return
	}

	// Update API client and syncer engine active API credentials live in runtime
	if h.apiClient != nil {
		if strings.TrimSpace(s.IPTVEditorAPIURL) != "" {
			h.apiClient.SetBaseURL(strings.TrimSpace(s.IPTVEditorAPIURL))
		}
		if s.IPTVEditorAPIToken != "" {
			h.apiClient.SetAPIToken(strings.TrimSpace(s.IPTVEditorAPIToken))
		}
		h.apiClient.SetPassword(strings.TrimSpace(s.IPTVEditorAPIPassword))
	}
	if h.syncer != nil {
		if strings.TrimSpace(s.IPTVEditorAPIURL) != "" {
			if su, ok := h.syncer.(interface{ SetBaseURL(string) }); ok {
				su.SetBaseURL(strings.TrimSpace(s.IPTVEditorAPIURL))
			}
		}
		if s.IPTVEditorAPIToken != "" {
			if st, ok := h.syncer.(interface{ SetAPIToken(string) }); ok {
				st.SetAPIToken(strings.TrimSpace(s.IPTVEditorAPIToken))
			}
		}
		if sp, ok := h.syncer.(interface{ SetPassword(string) }); ok {
			sp.SetPassword(strings.TrimSpace(s.IPTVEditorAPIPassword))
		}
	}

	// Update TMDB client active API key live in memory without restart
	if h.tmdbClient != nil {
		if strings.TrimSpace(s.TMDBApiKey) != "" {
			h.tmdbClient.SetAPIKey(s.TMDBApiKey)
		} else {
			h.tmdbClient.SetAPIKey(h.defaultTMDBKey)
		}
	}

	// Asynchronously prune any EPG programmes beyond newly updated max days
	if pruner, ok := h.syncer.(interface{ GetEpgRepo() *db.EpgRepo }); ok && pruner.GetEpgRepo() != nil && s.EPGMaxDays > 0 {
		go func(maxDays int) {
			_, _ = pruner.GetEpgRepo().PruneOldProgrammes(context.Background(), maxDays)
		}(s.EPGMaxDays)
	}

	// Update cache live in runtime
	if h.cache != nil {
		h.cache.SetSettings(
			s.CacheEnabled,
			time.Duration(s.CacheAuthTTLMinutes)*time.Minute,
			time.Duration(s.CacheCategoriesTTLMinutes)*time.Minute,
			time.Duration(s.CacheStreamsTTLMinutes)*time.Minute,
		)
	}

	// Update security engine live in runtime
	if h.secSvc != nil {
		h.secSvc.SetSettings(
			s.AntiBruteForceEnabled,
			s.AntiBruteForceBanHours,
			s.AntiBruteForceMaxAttempts,
			s.AntiBruteForceWindowMinutes,
		)
		h.secSvc.SetMultiIPSettings(
			s.MultiIPDetectionEnabled,
			s.MultiIPMaxSubnets,
			s.MultiIPWindowHours,
			s.MultiIPAutoSuspend,
		)
		h.secSvc.SetRetentionDays(s.SecurityLogRetentionDays)
	}

	// Update throttler live in runtime
	if h.throttler != nil {
		h.throttler.SetSettings(&s)
	}

	// Update host filter live in runtime
	if h.hostFilter != nil {
		h.hostFilter.SetSettings(&s)
	}

	status, err := h.scheduler.GetStatus(r.Context())
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":  true,
			"settings": s,
		})
		return
	}
	h.populateCacheStatus(r.Context(), status)
	writeJSON(w, http.StatusOK, status)
}

func (h *SettingsHandler) populateCacheStatus(ctx context.Context, resp *models.SettingsResponse) {
	if resp == nil {
		return
	}
	if h.cache == nil || !h.cache.IsAvailable() {
		resp.CacheStatus = models.CacheStatusSummary{
			IsConnected: false,
			Backend:     "standalone",
			KeysCount:   0,
			MemoryUsed:  "N/A",
			Uptime:      "N/A",
		}
		return
	}

	keysCount, memUsed, uptime, _ := h.cache.GetStats(ctx)
	resp.CacheStatus = models.CacheStatusSummary{
		IsConnected: true,
		Backend:     "redis",
		KeysCount:   keysCount,
		MemoryUsed:  memUsed,
		Uptime:      uptime,
	}
}

type ClearCacheRequest struct {
	Scope string `json:"scope"`
}

// ClearCache clears cached keys by scope ("all", "auth", "categories", "streams").
func (h *SettingsHandler) ClearCache(w http.ResponseWriter, r *http.Request) {
	var req ClearCacheRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if req.Scope == "" {
		req.Scope = "all"
	}

	if h.cache == nil || !h.cache.IsAvailable() {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"success":       true,
			"deleted_count": 0,
			"scope":         req.Scope,
			"message":       "Cache is running in standalone mode (no-op).",
		})
		return
	}

	count, err := h.cache.Flush(r.Context(), req.Scope)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "flush_failed",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"deleted_count": count,
		"scope":         req.Scope,
		"message":       fmt.Sprintf("Cache for scope '%s' cleared successfully (%d keys removed).", req.Scope, count),
	})
}

type TestTokenRequest struct {
	Token    string `json:"token"`
	Password string `json:"password,omitempty"`
}

// TestToken verifies whether a PlaylistLabs Access Token is valid against the upstream API.
func (h *SettingsHandler) TestToken(w http.ResponseWriter, r *http.Request) {
	var req TestTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": "Invalid request payload",
		})
		return
	}

	token := strings.TrimSpace(req.Token)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "empty_token",
			"message": "Token cannot be empty.",
		})
		return
	}

	apiClient := h.apiClient
	if apiClient == nil {
		if getter, ok := h.syncer.(interface{ GetAPIClient() *client.APIClient }); ok {
			apiClient = getter.GetAPIClient()
		}
	}
	if apiClient == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "api_client_unavailable",
			"message": "API client unavailable on server.",
		})
		return
	}

	pass := strings.TrimSpace(req.Password)
	count, err := apiClient.ValidateToken(r.Context(), token, pass)
	if err != nil {
		var upstreamErr *client.UpstreamAPIError
		if errors.As(err, &upstreamErr) {
			if upstreamErr.Code == "PLAN_UPGRADE_REQUIRED" {
				if h.settingsRepo != nil {
					now := time.Now().UTC()
					_ = h.settingsRepo.SetLicenseSuspension(r.Context(), true, &now, upstreamErr.UpgradeURL)
				}
				if h.licenseGuard != nil {
					h.licenseGuard.Invalidate()
				}
			}
			writeJSON(w, http.StatusBadRequest, map[string]interface{}{
				"valid":       false,
				"error":       upstreamErr.Error(),
				"message":     upstreamErr.Body,
				"title":       upstreamErr.Title,
				"body":        upstreamErr.Body,
				"code":        upstreamErr.Code,
				"upgrade_url": upstreamErr.UpgradeURL,
			})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   err.Error(),
			"message": fmt.Sprintf("Invalid token or not recognized by PlaylistLabs: %v", err),
		})
		return
	}

	// Auto-lift license suspension upon successful token validation
	if h.settingsRepo != nil {
		_ = h.settingsRepo.SetLicenseSuspension(r.Context(), false, nil)
	}
	if h.licenseGuard != nil {
		h.licenseGuard.Invalidate()
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":           true,
		"playlists_count": count,
		"message":         fmt.Sprintf("Valid token! Connection established successfully (found %d playlist(s)).", count),
	})
}

type TestTMDBKeyRequest struct {
	APIKey string `json:"api_key"`
}

// TestTMDBKey verifies whether a TMDB API key is valid against The Movie Database API.
func (h *SettingsHandler) TestTMDBKey(w http.ResponseWriter, r *http.Request) {
	var req TestTMDBKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": "Invalid request payload",
		})
		return
	}

	key := strings.TrimSpace(req.APIKey)
	if key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "empty_key",
			"message": "TMDB API key cannot be empty.",
		})
		return
	}

	client := h.tmdbClient
	if client == nil {
		client = tmdb.NewClient(key)
	}

	if err := client.ValidateKey(r.Context(), key); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   err.Error(),
			"message": fmt.Sprintf("Invalid TMDB key or verification failed: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":   true,
		"message": "Valid TMDB API key! Successfully authenticated with The Movie Database.",
	})
}

type TestCaptchaRequest struct {
	Provider  string `json:"provider"`
	SiteKey   string `json:"site_key"`
	SecretKey string `json:"secret_key"`
	Solution  string `json:"solution"`
}

// TestCaptcha verifies whether the provided captcha solution and keys are valid with the external provider.
func (h *SettingsHandler) TestCaptcha(w http.ResponseWriter, r *http.Request) {
	var req TestCaptchaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": "Invalid request payload",
		})
		return
	}

	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "" || provider == "default" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"valid":   true,
			"message": "Built-in SVG captcha is valid and operates locally without external keys.",
		})
		return
	}

	if provider == "disabled" {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"valid":   true,
			"message": "Captcha is disabled.",
		})
		return
	}

	secretKey := strings.TrimSpace(req.SecretKey)
	if secretKey == "" && h.settingsRepo != nil {
		if s, err := h.settingsRepo.Get(r.Context()); err == nil && s != nil {
			secretKey = s.CaptchaSecretKey
		}
	}

	if secretKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   "missing_secret_key",
			"message": "Secret key cannot be empty for external captcha providers.",
		})
		return
	}

	solution := strings.TrimSpace(req.Solution)
	if solution == "" {
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   "missing_solution",
			"message": "Captcha challenge solution / token is required. Please solve the challenge widget.",
		})
		return
	}

	clientIP := ""
	if h.secSvc != nil {
		clientIP = h.secSvc.ExtractClientIP(r)
	}

	valid, err := captcha.VerifyWithProvider(r.Context(), provider, secretKey, "", solution, clientIP)
	if err != nil || !valid {
		msg := "Captcha verification failed with the selected provider."
		if err != nil {
			msg = fmt.Sprintf("Verification failed: %v", err)
		}
		writeJSON(w, http.StatusBadRequest, map[string]interface{}{
			"valid":   false,
			"error":   "verification_failed",
			"message": msg,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":   true,
		"message": "Captcha verified successfully! Your settings are valid and safe to save.",
	})
}

// TriggerPlaylistSync starts manual playlist synchronization immediately.
func (h *SettingsHandler) TriggerPlaylistSync(w http.ResponseWriter, r *http.Request) {
	force := false
	if fStr := r.URL.Query().Get("force"); fStr != "" {
		force = fStr == "true" || fStr == "1"
	}

	var req struct {
		Force *bool `json:"force,omitempty"`
	}
	if r.Body != nil && r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err == nil && req.Force != nil {
			force = *req.Force
		}
	}

	err := h.scheduler.TriggerPlaylistSync(r.Context(), force)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":   "sync_failed",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"success": true,
		"force":   force,
		"message": "Playlist synchronization started in background",
	})
}

// TriggerExpirySync starts manual customer expiry synchronization immediately.
func (h *SettingsHandler) TriggerExpirySync(w http.ResponseWriter, r *http.Request) {
	all := r.URL.Query().Get("all") == "true" || r.URL.Query().Get("all") == "1"
	var daysRange int
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			daysRange = d
		}
	}
	err := h.scheduler.TriggerExpirySync(r.Context(), all, daysRange)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error":   "sync_failed",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"success": true,
		"message": "Customer expiration date synchronization started in background",
	})
}

// TriggerBackup generates an immediate backup snapshot on the server.
type TriggerBackupPayload struct {
	ListID       *uint64 `json:"list_id,omitempty"`
	Type         string  `json:"type,omitempty"`
	IncludeToken bool    `json:"include_token,omitempty"`
	IncludeTeam  bool    `json:"include_team,omitempty"`
}

// TriggerBackup generates an immediate backup snapshot on the server.
func (h *SettingsHandler) TriggerBackup(w http.ResponseWriter, r *http.Request) {
	var req TriggerBackupPayload
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	if req.Type == "" {
		req.Type = r.URL.Query().Get("type")
	}
	if !req.IncludeToken {
		req.IncludeToken = r.URL.Query().Get("include_token") == "true" || r.URL.Query().Get("include_token") == "1"
	}
	if !req.IncludeTeam {
		req.IncludeTeam = r.URL.Query().Get("include_team") == "true" || r.URL.Query().Get("include_team") == "1"
	}
	if req.ListID == nil {
		if qList := r.URL.Query().Get("list_id"); qList != "" {
			if id, err := strconv.ParseUint(qList, 10, 64); err == nil {
				req.ListID = &id
			}
		}
	}

	meta, err := h.scheduler.TriggerBackupScoped(r.Context(), req.ListID, req.Type, req.IncludeToken, req.IncludeTeam, false)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "backup_failed",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"backup":  meta,
		"message": fmt.Sprintf("Backup snapshot created successfully (%d users)", meta.TotalUsers),
	})
}

// ListBackups lists all stored server backups.
func (h *SettingsHandler) ListBackups(w http.ResponseWriter, r *http.Request) {
	backups, err := h.backupSvc.ListStoredBackups()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_listing_backups",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, backups)
}

// RestoreStoredBackup restores users and/or settings from a server-saved backup file.
func (h *SettingsHandler) RestoreStoredBackup(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	adminID := 1
	if claims != nil {
		adminID = claims.AdminID
	}

	var req models.RestoreStoredBackupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	if req.Filename == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_filename",
			"message": "Backup filename is required.",
		})
		return
	}

	restoreReq := models.RestoreRequest{
		SourceListID:       req.SourceListID,
		TargetListID:       req.TargetListID,
		Mode:               req.Mode,
		RestoreUsers:       req.RestoreUsers,
		RestoreSettings:    req.RestoreSettings,
		RestoreToken:       req.RestoreToken,
		RestorePlaylists:   req.RestorePlaylists,
		RestoreTeamMembers: req.RestoreTeamMembers,
		RestoreTeamScope:   req.RestoreTeamScope,
	}

	result, err := h.backupSvc.RestoreFromFile(r.Context(), req.Filename, restoreReq, adminID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "restore_failed",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, result)
}

// DownloadBackup streams a server-stored backup file to the client.
func (h *SettingsHandler) DownloadBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	filePath, err := h.backupSvc.GetBackupFilePath(filename)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_filename",
			"message": err.Error(),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filepath.Base(filePath)))
	http.ServeFile(w, r, filePath)
}

// DeleteBackup deletes a server-stored backup file.
func (h *SettingsHandler) DeleteBackup(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")
	if err := h.backupSvc.DeleteStoredBackup(filename); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "delete_failed",
			"message": err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Backup file deleted successfully",
	})
}

// ImportFromEditorRequest defines the payload to import managed users and welcome info from PlaylistLabs.
type ImportFromEditorRequest struct {
	PlaylistID        uint64 `json:"playlist_id"`
	Mode              string `json:"mode"`                // "skip" (default) or "overwrite"
	ImportWelcomeInfo bool   `json:"import_welcome_info"` // whether to import welcome_info (default true)
}

// ImportFromEditorResponse holds the outcome of importing from PlaylistLabs.
type ImportFromEditorResponse struct {
	Success            bool     `json:"success"`
	TotalProcessed     int      `json:"total_processed"`
	Imported           int      `json:"imported"`
	Updated            int      `json:"updated"`
	Skipped            int      `json:"skipped"`
	WelcomeInfoUpdated int      `json:"welcome_info_updated"`
	Errors             []string `json:"errors,omitempty"`
	Message            string   `json:"message"`
}

// ImportFromEditor fetches managed users and welcome info from PlaylistLabs and saves to MariaDB.
func (h *SettingsHandler) ImportFromEditor(w http.ResponseWriter, r *http.Request) {
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

	if req.Mode == "" {
		req.Mode = "skip"
	}

	apiClient := h.apiClient
	if apiClient == nil {
		if getter, ok := h.syncer.(interface{ GetAPIClient() *client.APIClient }); ok {
			apiClient = getter.GetAPIClient()
		}
	}
	if apiClient == nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "api_client_not_configured",
			"message": "PlaylistLabs client is not configured",
		})
		return
	}

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

	var targetPlaylists []client.Playlist
	if req.PlaylistID > 0 {
		for _, ep := range editorPlaylists {
			if ep.ID.Uint64() == req.PlaylistID {
				targetPlaylists = append(targetPlaylists, ep)
				break
			}
		}
		if len(targetPlaylists) == 0 {
			writeJSON(w, http.StatusNotFound, map[string]string{
				"error":   "playlist_not_found",
				"message": fmt.Sprintf("Playlist %d was not found in PlaylistLabs", req.PlaylistID),
			})
			return
		}
	} else {
		targetPlaylists = editorPlaylists
	}

	resp := ImportFromEditorResponse{
		Success: true,
	}

	for _, p := range targetPlaylists {
		pid := p.ID.Uint64()

		// 1. Update Welcome Info if requested
		if req.ImportWelcomeInfo && len(p.WelcomeInfo) > 0 && string(p.WelcomeInfo) != "null" && h.playlistRepo != nil {
			if err := h.playlistRepo.UpdateWelcomeInfo(ctx, pid, p.WelcomeInfo); err != nil {
				resp.Errors = append(resp.Errors, fmt.Sprintf("Playlist '%s' (%d): failed updating welcome info: %v", p.Name, pid, err))
			} else {
				resp.WelcomeInfoUpdated++
			}
		}

		// 2. Fetch and import users
		users, err := apiClient.GetAllUsers(ctx, pid)
		if err != nil {
			resp.Errors = append(resp.Errors, fmt.Sprintf("Playlist '%s' (%d): failed fetching users: %v", p.Name, pid, err))
			continue
		}

		if len(users) > 0 && h.userRepo != nil {
			res, impErr := h.userRepo.ImportUsers(ctx, pid, users, req.Mode)
			if impErr != nil {
				resp.Errors = append(resp.Errors, fmt.Sprintf("Playlist '%s' (%d): import error: %v", p.Name, pid, impErr))
			} else {
				resp.TotalProcessed += res.TotalProcessed
				resp.Imported += res.Imported
				resp.Updated += res.Updated
				resp.Skipped += res.Skipped
				resp.Errors = append(resp.Errors, res.Errors...)
			}
		}
	}

	resp.Message = fmt.Sprintf("Successfully processed %d users: %d imported, %d updated, %d skipped. Welcome info updated for %d playlist(s).",
		resp.TotalProcessed, resp.Imported, resp.Updated, resp.Skipped, resp.WelcomeInfoUpdated)

	writeJSON(w, http.StatusOK, resp)
}
