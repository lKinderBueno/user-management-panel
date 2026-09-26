package auth

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const AdminContextKey contextKey = "admin_claims"

type Claims struct {
	AdminID                 int      `json:"admin_id"`
	Username                string   `json:"username"`
	Role                    string   `json:"role"`
	CanCreateCollaborators  bool     `json:"can_create_collaborators"`
	CanCreateAdmins         bool     `json:"can_create_admins"`
	CanManageAPITokens      bool     `json:"can_manage_api_tokens"`
	IsAPIToken              bool     `json:"is_api_token,omitempty"`
	TokenID                 uint64   `json:"token_id,omitempty"`
	TokenAllowedPlaylistIDs []uint64 `json:"token_allowed_playlist_ids,omitempty"`
	TokenHasPlaylistScope   bool     `json:"token_has_playlist_scope,omitempty"`
	jwt.RegisteredClaims
}

// HasTokenPlaylistAccess checks whether an API token with scoped playlists is authorized for listID.
// If the request is not an API token or has no restricted playlists, it returns true.
func (c *Claims) HasTokenPlaylistAccess(listID uint64) bool {
	if c == nil || !c.IsAPIToken || !c.TokenHasPlaylistScope {
		return true
	}
	for _, pid := range c.TokenAllowedPlaylistIDs {
		if pid == listID {
			return true
		}
	}
	return false
}

func getJWTSecret() []byte {
	if secretFile := os.Getenv("JWT_SECRET_FILE"); secretFile != "" {
		if content, err := os.ReadFile(secretFile); err == nil {
			if trimmed := strings.TrimSpace(string(content)); trimmed != "" {
				return []byte(trimmed)
			}
		}
	}
	if content, err := os.ReadFile("/run/secrets/jwt_secret"); err == nil {
		if trimmed := strings.TrimSpace(string(content)); trimmed != "" {
			return []byte(trimmed)
		}
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "playlistlabs_os_super_secret_jwt_key_2026"
	}
	return []byte(secret)
}

func GenerateToken(adminID int, username, role string, perms ...bool) (string, error) {
	if role == "" {
		role = "admin"
	}
	canCreateCollabs := role == "admin"
	canCreateAdmins := role == "admin"
	canManageAPITokens := role == "admin"

	if len(perms) > 0 {
		canCreateCollabs = perms[0]
	}
	if len(perms) > 1 {
		canCreateAdmins = perms[1]
	}
	if len(perms) > 2 {
		canManageAPITokens = perms[2]
	}

	// Collaborators can never create administrators
	if role != "admin" {
		canCreateAdmins = false
	}

	claims := &Claims{
		AdminID:                adminID,
		Username:               username,
		Role:                   role,
		CanCreateCollaborators: canCreateCollabs,
		CanCreateAdmins:        canCreateAdmins,
		CanManageAPITokens:     canManageAPITokens,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return getJWTSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

var (
	ErrTokenNotFound          = errors.New("invalid api token")
	ErrTokenDeactivated       = errors.New("api token is deactivated")
	ErrTokenExpired           = errors.New("api token has expired")
	ErrMissingPassword        = errors.New("missing token password in X-Token-Password header")
	ErrInvalidPassword        = errors.New("invalid token password")
	ErrTokenPermissionRevoked = errors.New("api token access has been disabled for this account")
	ErrTokenIPNotAllowed      = errors.New("this API token is not allowed from your IP address")
)

// APITokenValidator validates an internal API token and optional password.
type APITokenValidator interface {
	ValidateAPIToken(ctx context.Context, tokenStr, passwordStr, clientIP string) (*Claims, error)
}

// SecurityRecorder records brute-force attempts and checks IP blocks.
type SecurityRecorder interface {
	ExtractClientIP(r *http.Request) string
	IsBlocked(ctx context.Context, ip string) bool
	RecordFailure(ctx context.Context, ip, attemptType, username, password, reason string, r *http.Request) (bool, error)
	RecordSuccess(ctx context.Context, ip, attemptType, username string, r *http.Request)
}

// Authenticator handles combined JWT and API Token authentication with anti-brute-force protection.
type Authenticator struct {
	validator APITokenValidator
	secSvc    SecurityRecorder
}

func NewAuthenticator(validator APITokenValidator, secSvc SecurityRecorder) *Authenticator {
	return &Authenticator{
		validator: validator,
		secSvc:    secSvc,
	}
}

var defaultAuthenticator = &Authenticator{}

func SetDefaultAuthenticator(a *Authenticator) {
	if a != nil {
		defaultAuthenticator = a
	}
}

func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var clientIP string
		if a.secSvc != nil {
			clientIP = a.secSvc.ExtractClientIP(r)
			if clientIP != "" && a.secSvc.IsBlocked(r.Context(), clientIP) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`{"error":"forbidden","message":"Your IP address has been blocked due to repeated security violations."}`))
				return
			}
		}
		if clientIP == "" {
			remote := strings.TrimSpace(r.RemoteAddr)
			if host, _, err := net.SplitHostPort(remote); err == nil {
				clientIP = host
			} else {
				clientIP = remote
			}
		}

		// 1. Extract Token strictly:
		// API tokens must be passed via the canonical header "X-API-Token"
		// Web dashboard JWT sessions are passed via "Authorization: Bearer <jwt>"
		var (
			tokenStr   string
			isAPIToken bool
		)

		if h := r.Header.Get("X-API-Token"); h != "" {
			tokenStr = strings.TrimSpace(h)
			isAPIToken = true
		} else if authHeader := r.Header.Get("Authorization"); authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				tokenStr = strings.TrimSpace(parts[1])
				if strings.HasPrefix(tokenStr, "plt_") {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusUnauthorized)
					_, _ = w.Write([]byte(`{"error":"unauthorized","message":"API tokens must be provided via the X-API-Token header"}`))
					return
				}
				isAPIToken = false
			}
		}

		if tokenStr == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized","message":"missing authorization header"}`))
			return
		}

		// Extract optional password strictly from X-Token-Password
		passwordStr := r.Header.Get("X-Token-Password")

		// 2. Validate API Token if provided via X-API-Token
		if isAPIToken && a.validator != nil {
			tokenPrefix := tokenStr
			if len(tokenPrefix) > 24 {
				tokenPrefix = tokenPrefix[:12] + "..." + tokenPrefix[len(tokenPrefix)-6:]
			}

			claims, err := a.validator.ValidateAPIToken(r.Context(), tokenStr, passwordStr, clientIP)
			if err != nil {
				if a.secSvc != nil && clientIP != "" {
					reason := "invalid_api_token"
					if errors.Is(err, ErrMissingPassword) {
						reason = "missing_token_password"
					} else if errors.Is(err, ErrInvalidPassword) {
						reason = "invalid_token_password"
					} else if errors.Is(err, ErrTokenExpired) {
						reason = "api_token_expired"
					} else if errors.Is(err, ErrTokenDeactivated) {
						reason = "api_token_disabled"
					} else if errors.Is(err, ErrTokenIPNotAllowed) {
						reason = "token_ip_not_allowed"
					}
					_, _ = a.secSvc.RecordFailure(r.Context(), clientIP, "api_token", tokenPrefix, passwordStr, reason, r)
				}

				status := http.StatusUnauthorized
				if errors.Is(err, ErrTokenPermissionRevoked) || errors.Is(err, ErrTokenIPNotAllowed) {
					status = http.StatusForbidden
				}

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				msg := err.Error()
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized", "message": msg})
				return
			}

			if a.secSvc != nil && clientIP != "" {
				a.secSvc.RecordSuccess(r.Context(), clientIP, "api_token", tokenPrefix, r)
			}

			ctx := context.WithValue(r.Context(), AdminContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// 3. Try standard JWT token
		claims, err := ValidateToken(tokenStr)
		if err == nil && claims != nil {
			ctx := context.WithValue(r.Context(), AdminContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Failure: invalid or expired token
		if a.secSvc != nil && clientIP != "" {
			tokenDisplay := tokenStr
			if len(tokenDisplay) > 24 {
				tokenDisplay = tokenDisplay[:12] + "..." + tokenDisplay[len(tokenDisplay)-6:]
			}
			_, _ = a.secSvc.RecordFailure(r.Context(), clientIP, "api_token", tokenDisplay, passwordStr, "invalid_or_expired_token", r)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized","message":"invalid or expired token"}`))
	})
}

func Middleware(next http.Handler) http.Handler {
	return defaultAuthenticator.Middleware(next)
}

// RequireAdminRole ensures that only users with role == 'admin' can access the route.
func RequireAdminRole(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(AdminContextKey).(*Claims)
		if !ok || claims == nil {
			http.Error(w, `{"error":"unauthorized","message":"missing authorization claims"}`, http.StatusUnauthorized)
			return
		}

		role := claims.Role
		if role == "" {
			// Backward compatibility: tokens generated before role claims were introduced belong to the main admin
			role = "admin"
		}

		if role != "admin" {
			http.Error(w, `{"error":"forbidden","message":"only administrators can access this resource"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// RequireTeamAccessRole ensures that only administrators or collaborators with team creation permissions can access team management.
func RequireTeamAccessRole(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(AdminContextKey).(*Claims)
		if !ok || claims == nil {
			http.Error(w, `{"error":"unauthorized","message":"missing authorization claims"}`, http.StatusUnauthorized)
			return
		}

		if claims.CanCreateAdmins || claims.CanCreateCollaborators {
			next.ServeHTTP(w, r)
			return
		}

		http.Error(w, `{"error":"forbidden","message":"you do not have permission to manage team members"}`, http.StatusForbidden)
	})
}
