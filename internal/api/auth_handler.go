package api

import (
	"encoding/json"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"
	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/captcha"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/security"
)

type AuthHandler struct {
	adminRepo    *repository.AdminRepo
	secSvc       *security.Service
	settingsRepo *repository.SettingsRepo
}

func NewAuthHandler(adminRepo *repository.AdminRepo, secSvc ...*security.Service) *AuthHandler {
	var s *security.Service
	if len(secSvc) > 0 {
		s = secSvc[0]
	}
	return &AuthHandler{adminRepo: adminRepo, secSvc: s}
}

func (h *AuthHandler) SetSettingsRepo(repo *repository.SettingsRepo) {
	h.settingsRepo = repo
}

type LoginRequest struct {
	Username      string `json:"username"`
	Password      string `json:"password"`
	CaptchaID     string `json:"captcha_id"`
	CaptchaAnswer string `json:"captcha_answer"`
}

type LoginResponse struct {
	Token string      `json:"token"`
	Admin interface{} `json:"admin"`
}

func (h *AuthHandler) GetCaptcha(w http.ResponseWriter, r *http.Request) {
	provider := "default"
	siteKey := ""
	if h.settingsRepo != nil {
		if s, err := h.settingsRepo.Get(r.Context()); err == nil && s != nil {
			if s.CaptchaProvider != "" {
				provider = s.CaptchaProvider
			}
			siteKey = s.CaptchaSiteKey
		}
	}

	if provider == "disabled" {
		writeJSON(w, http.StatusOK, map[string]string{
			"provider": "disabled",
		})
		return
	}

	if provider != "default" {
		writeJSON(w, http.StatusOK, map[string]string{
			"provider": provider,
			"site_key": siteKey,
		})
		return
	}

	id, svg, err := captcha.Generate()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_generating_captcha"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"provider": "default",
		"id":       id,
		"svg":      svg,
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_credentials", "message": "Username and password are required"})
		return
	}

	provider := "default"
	secretKey := ""
	if h.settingsRepo != nil {
		if s, err := h.settingsRepo.Get(r.Context()); err == nil && s != nil {
			if s.CaptchaProvider != "" {
				provider = s.CaptchaProvider
			}
			secretKey = s.CaptchaSecretKey
		}
	}

	clientIP := ""
	if h.secSvc != nil {
		clientIP = h.secSvc.ExtractClientIP(r)
	}

	// 1. Verify Captcha
	valid, _ := captcha.VerifyWithProvider(r.Context(), provider, secretKey, req.CaptchaID, req.CaptchaAnswer, clientIP)
	if !valid {
		if h.secSvc != nil {
			_, _ = h.secSvc.RecordFailure(r.Context(), clientIP, "admin_login", req.Username, req.Password, "invalid_captcha", r)
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_captcha",
			"message": "Incorrect or expired captcha verification. Please try again.",
		})
		return
	}

	// 2. Fetch Admin
	admin, err := h.adminRepo.GetByUsername(r.Context(), req.Username)
	if err != nil || admin == nil {
		if h.secSvc != nil {
			clientIP := h.secSvc.ExtractClientIP(r)
			_, _ = h.secSvc.RecordFailure(r.Context(), clientIP, "admin_login", req.Username, req.Password, "invalid_credentials", r)
		}
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "invalid_credentials",
			"message": "Invalid username or password.",
		})
		return
	}

	// 3. Compare Password
	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		if h.secSvc != nil {
			clientIP := h.secSvc.ExtractClientIP(r)
			_, _ = h.secSvc.RecordFailure(r.Context(), clientIP, "admin_login", req.Username, req.Password, "invalid_credentials", r)
		}
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "invalid_credentials",
			"message": "Invalid username or password.",
		})
		return
	}

	// Record success and clear any transient failure counters
	if h.secSvc != nil {
		clientIP := h.secSvc.ExtractClientIP(r)
		h.secSvc.RecordSuccess(r.Context(), clientIP, "admin_login", req.Username, r)
	}

	// 4. Issue JWT
	token, err := auth.GenerateToken(admin.ID, admin.Username, admin.Role, admin.CanCreateCollaborators, admin.CanCreateAdmins, admin.CanManageAPITokens)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token_generation_failed"})
		return
	}

	licenseSuspended := false
	var licenseSuspendedAt *time.Time
	var licenseUpgradeURL string
	if h.settingsRepo != nil {
		if s, sErr := h.settingsRepo.Get(r.Context()); sErr == nil && s != nil {
			licenseSuspended = s.LicenseSuspended
			licenseSuspendedAt = s.LicenseSuspendedAt
			licenseUpgradeURL = s.LicenseUpgradeURL
		}
	}

	writeJSON(w, http.StatusOK, LoginResponse{
		Token: token,
		Admin: map[string]interface{}{
			"id":                       admin.ID,
			"username":                 admin.Username,
			"role":                     admin.Role,
			"manage_all_playlists":     admin.ManageAllPlaylists,
			"can_see_all_users":        admin.CanSeeAllUsers,
			"can_create_collaborators": admin.CanCreateCollaborators,
			"can_create_admins":        admin.CanCreateAdmins,
			"can_manage_api_tokens":    admin.CanManageAPITokens,
			"allowed_playlist_ids":     admin.AllowedPlaylistIDs,
			"license_suspended":        licenseSuspended,
			"license_suspended_at":     licenseSuspendedAt,
			"license_upgrade_url":      licenseUpgradeURL,
		},
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if !ok || claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	admin, err := h.adminRepo.GetByID(r.Context(), claims.AdminID)
	if err != nil || admin == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "admin_not_found"})
		return
	}

	// Generate fresh token with latest DB permissions to ensure client stays synced
	freshToken, _ := auth.GenerateToken(admin.ID, admin.Username, admin.Role, admin.CanCreateCollaborators, admin.CanCreateAdmins, admin.CanManageAPITokens)

	licenseSuspended := false
	var licenseSuspendedAt *time.Time
	var licenseUpgradeURL string
	if h.settingsRepo != nil {
		if s, sErr := h.settingsRepo.Get(r.Context()); sErr == nil && s != nil {
			licenseSuspended = s.LicenseSuspended
			licenseSuspendedAt = s.LicenseSuspendedAt
			licenseUpgradeURL = s.LicenseUpgradeURL
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token":                    freshToken,
		"id":                       admin.ID,
		"username":                 admin.Username,
		"role":                     admin.Role,
		"manage_all_playlists":     admin.ManageAllPlaylists,
		"can_see_all_users":        admin.CanSeeAllUsers,
		"can_create_collaborators": admin.CanCreateCollaborators,
		"can_create_admins":        admin.CanCreateAdmins,
		"can_manage_api_tokens":    admin.CanManageAPITokens,
		"allowed_playlist_ids":     admin.AllowedPlaylistIDs,
		"license_suspended":        licenseSuspended,
		"license_suspended_at":     licenseSuspendedAt,
		"license_upgrade_url":      licenseUpgradeURL,
	})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "logged_out"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
