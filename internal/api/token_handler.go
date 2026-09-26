package api

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
)


type TokenHandler struct {
	tokenRepo *repository.TokenRepo
	adminRepo *repository.AdminRepo
}

func NewTokenHandler(tokenRepo *repository.TokenRepo, adminRepo *repository.AdminRepo) *TokenHandler {
	return &TokenHandler{
		tokenRepo: tokenRepo,
		adminRepo: adminRepo,
	}
}

// ValidateAPIToken implements auth.APITokenValidator for validating internal API tokens.
func (h *TokenHandler) ValidateAPIToken(ctx context.Context, tokenStr, passwordStr, clientIP string) (*auth.Claims, error) {
	if h.tokenRepo == nil {
		return nil, auth.ErrTokenNotFound
	}

	trimmed := strings.TrimSpace(tokenStr)
	if trimmed == "" {
		return nil, auth.ErrTokenNotFound
	}

	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(trimmed)))
	token, pwdHash, admin, err := h.tokenRepo.GetTokenByHash(ctx, hash)
	if err != nil || token == nil {
		return nil, auth.ErrTokenNotFound
	}

	if !token.IsActive {
		return nil, auth.ErrTokenDeactivated
	}

	if token.ExpiresAt != nil && time.Now().After(*token.ExpiresAt) {
		return nil, auth.ErrTokenExpired
	}

	if token.HasPassword {
		if strings.TrimSpace(passwordStr) == "" {
			return nil, auth.ErrMissingPassword
		}
		if err := bcrypt.CompareHashAndPassword([]byte(pwdHash), []byte(passwordStr)); err != nil {
			return nil, auth.ErrInvalidPassword
		}
	}

	// Check IP restrictions
	if !token.IsIPAllowed(clientIP) {
		return nil, auth.ErrTokenIPNotAllowed
	}

	if admin == nil || (!admin.CanManageAPITokens && admin.Role != "admin") {
		return nil, auth.ErrTokenPermissionRevoked
	}

	// Update last used timestamp asynchronously
	go func(tID uint64) {
		ctxTimeout, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = h.tokenRepo.UpdateLastUsed(ctxTimeout, tID)
	}(token.ID)

	claims := &auth.Claims{
		AdminID:                 admin.ID,
		Username:                admin.Username,
		Role:                    admin.Role,
		CanCreateCollaborators:  admin.CanCreateCollaborators,
		CanCreateAdmins:         admin.CanCreateAdmins,
		CanManageAPITokens:      admin.CanManageAPITokens,
		IsAPIToken:              true,
		TokenID:                 token.ID,
		TokenAllowedPlaylistIDs: token.AllowedPlaylistIDs,
		TokenHasPlaylistScope:   len(token.AllowedPlaylistIDs) > 0,
	}

	return claims, nil
}

// RequireTokenAccess ensures that only admins or collaborators with can_manage_api_tokens can access token endpoints.
func (h *TokenHandler) RequireTokenAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
		if !ok || claims == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error":   "unauthorized",
				"message": "missing authorization claims",
			})
			return
		}

		if claims.Role == "admin" || claims.CanManageAPITokens {
			next.ServeHTTP(w, r)
			return
		}

		// Check live DB in case permissions were updated recently
		if h.adminRepo != nil {
			admin, err := h.adminRepo.GetByID(r.Context(), claims.AdminID)
			if err == nil && admin != nil && (admin.Role == "admin" || admin.CanManageAPITokens) {
				claims.Role = admin.Role
				claims.CanManageAPITokens = admin.CanManageAPITokens
				next.ServeHTTP(w, r)
				return
			}
		}

		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "you do not have permission to manage API tokens",
		})
	})
}

// GetTokens lists API tokens for the caller.
func (h *TokenHandler) GetTokens(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	tokens, err := h.tokenRepo.GetTokensByAdminID(r.Context(), claims.AdminID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_fetching_tokens",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}

// validateAndCleanAllowedIPs validates and formats comma/space/newline separated IPs and CIDRs.
func validateAndCleanAllowedIPs(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	tokens := strings.FieldsFunc(trimmed, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == ' ' || r == '\t'
	})
	var validEntries []string
	for _, item := range tokens {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if strings.Contains(item, "/") {
			if _, _, err := net.ParseCIDR(item); err != nil {
				return "", fmt.Errorf("invalid CIDR notation: %s", item)
			}
			validEntries = append(validEntries, item)
		} else {
			if parsed := net.ParseIP(item); parsed == nil {
				return "", fmt.Errorf("invalid IP address: %s", item)
			}
			validEntries = append(validEntries, item)
		}
	}
	return strings.Join(validEntries, ", "), nil
}

// validatePlaylistAccess verifies that the caller has permission to manage all specified playlist IDs.
func (h *TokenHandler) validatePlaylistAccess(ctx context.Context, claims *auth.Claims, playlistIDs []uint64) error {
	if len(playlistIDs) == 0 || claims.Role == "admin" || h.adminRepo == nil {
		return nil
	}
	admin, err := h.adminRepo.GetByID(ctx, claims.AdminID)
	if err != nil || admin == nil {
		return errors.New("admin not found")
	}
	if admin.ManageAllPlaylists {
		return nil
	}
	for _, pid := range playlistIDs {
		hasAccess, err := h.adminRepo.HasPlaylistAccess(ctx, admin, pid)
		if err != nil || !hasAccess {
			return fmt.Errorf("you do not have permission to manage playlist %d", pid)
		}
	}
	return nil
}

type CreateTokenRequest struct {
	Name               string              `json:"name"`
	Password           string              `json:"password,omitempty"`
	AllowedIPs         string              `json:"allowed_ips,omitempty"` // optional comma-separated list of allowed IPs or CIDRs
	AllowedPlaylistIDs models.Uint64Slice  `json:"allowed_playlist_ids,omitempty"` // optional restricted playlist IDs
	ExpiresInDays      int                 `json:"expires_in_days,omitempty"` // 0 = never
}

// CreateToken creates a new API token with optional password protection and scope.
func (h *TokenHandler) CreateToken(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	var req CreateTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_name",
			"message": "Token name is required",
		})
		return
	}
	if len(req.Name) > 100 {
		req.Name = req.Name[:100]
	}

	// Validate playlist access (cannot grant access to playlists caller cannot manage)
	if err := h.validatePlaylistAccess(r.Context(), claims, req.AllowedPlaylistIDs); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": err.Error(),
		})
		return
	}

	// Optional password hash
	var passwordHash string
	req.Password = strings.TrimSpace(req.Password)
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "password_hashing_failed",
				"message": err.Error(),
			})
			return
		}
		passwordHash = string(hash)
	}

	// Optional Allowed IPs validation and normalization
	cleanAllowedIPs, err := validateAndCleanAllowedIPs(req.AllowedIPs)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_allowed_ips",
			"message": err.Error(),
		})
		return
	}

	// Expiration calculation
	var expiresAt *time.Time
	if req.ExpiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, req.ExpiresInDays)
		expiresAt = &exp
	}

	// Generate 32 bytes of cryptographic randomness for token secret
	rawBytes := make([]byte, 24)
	if _, err := rand.Read(rawBytes); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "token_generation_failed",
			"message": "failed generating random bytes",
		})
		return
	}

	tokenHex := hex.EncodeToString(rawBytes)
	plaintextToken := "plt_live_" + tokenHex
	tokenHash := fmt.Sprintf("%x", sha256.Sum256([]byte(plaintextToken)))
	tokenPrefix := plaintextToken[:12] + "..." + plaintextToken[len(plaintextToken)-4:]
	if len(tokenPrefix) > 64 {
		tokenPrefix = tokenPrefix[:64]
	}

	token, err := h.tokenRepo.CreateToken(r.Context(), claims.AdminID, req.Name, tokenHash, tokenPrefix, passwordHash, cleanAllowedIPs, req.AllowedPlaylistIDs, expiresAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "failed_creating_token",
			"message": err.Error(),
		})
		return
	}

	// Return plaintext token only once
	token.Token = plaintextToken
	writeJSON(w, http.StatusCreated, token)
}

type UpdateTokenRequest struct {
	Name               string              `json:"name"`
	Password           string              `json:"password,omitempty"`
	RemovePassword     bool                `json:"remove_password,omitempty"`
	AllowedIPs         string              `json:"allowed_ips,omitempty"`
	AllowedPlaylistIDs models.Uint64Slice  `json:"allowed_playlist_ids"`
}

// UpdateToken modifies parameters of an existing API token.
func (h *TokenHandler) UpdateToken(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	var req UpdateTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_name",
			"message": "Token name is required",
		})
		return
	}
	if len(req.Name) > 100 {
		req.Name = req.Name[:100]
	}

	cleanAllowedIPs, err := validateAndCleanAllowedIPs(req.AllowedIPs)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_allowed_ips",
			"message": err.Error(),
		})
		return
	}

	if err := h.validatePlaylistAccess(r.Context(), claims, req.AllowedPlaylistIDs); err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": err.Error(),
		})
		return
	}

	var pwdHashPtr *string
	req.Password = strings.TrimSpace(req.Password)
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error":   "password_hashing_failed",
				"message": err.Error(),
			})
			return
		}
		hStr := string(hash)
		pwdHashPtr = &hStr
	}

	isSuperAdmin := claims.Role == "admin"
	updated, err := h.tokenRepo.UpdateToken(r.Context(), id, claims.AdminID, isSuperAdmin, req.Name, cleanAllowedIPs, req.AllowedPlaylistIDs, pwdHashPtr, req.RemovePassword)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "failed_updating_token",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// DeleteToken revokes an API token.
func (h *TokenHandler) DeleteToken(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	isSuperAdmin := claims.Role == "admin"
	if err := h.tokenRepo.DeleteToken(r.Context(), id, claims.AdminID, isSuperAdmin); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "failed_deleting_token",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "API token revoked successfully",
	})
}

type ToggleTokenRequest struct {
	IsActive bool `json:"is_active"`
}

// ToggleToken activates or deactivates an API token.
func (h *TokenHandler) ToggleToken(w http.ResponseWriter, r *http.Request) {
	claims, _ := r.Context().Value(auth.AdminContextKey).(*auth.Claims)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	var req ToggleTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_request_body",
			"message": err.Error(),
		})
		return
	}

	isSuperAdmin := claims.Role == "admin"
	if err := h.tokenRepo.ToggleToken(r.Context(), id, claims.AdminID, req.IsActive, isSuperAdmin); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "failed_updating_token",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"is_active": req.IsActive,
	})
}
