package security

import (
	"context"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/util"
)

var (
	legacyStreamPathRegex = regexp.MustCompile(`^/[a-zA-Z0-9_\.\-]+/[a-zA-Z0-9_\.\-]+/[0-9]+(\.[a-zA-Z0-9]+)?$`)
	redirectorStreamRegex = regexp.MustCompile(`(?i)^/(?:live|movie|series|timeshift)/[^/]+/[^/]+/[^/]+/?$`)
)

// HostFilter provides thread-safe, nanosecond-latency host and domain isolation between
// admin management dashboard traffic and public Xtream/stream redirect traffic.
type HostFilter struct {
	repo *repository.SettingsRepo

	mu                        sync.RWMutex
	adminHostname             string
	blockStreamingOnAdminHost bool
	restrictAdminToAdminHost  bool
	blockDirectIPStreaming    bool
	emergencyBypass           bool
	lastSync                  time.Time
	syncInterval              time.Duration
}

// NewHostFilter initializes a new HostFilter instance.
func NewHostFilter(repo *repository.SettingsRepo) *HostFilter {
	bypass := os.Getenv("DISABLE_HOST_RESTRICTIONS")
	isBypass := strings.EqualFold(bypass, "true") || bypass == "1"

	hf := &HostFilter{
		repo:                      repo,
		syncInterval:              5 * time.Second,
		emergencyBypass:           isBypass,
		blockStreamingOnAdminHost: true,
	}

	// Initial load if repo is available
	if repo != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if s, err := repo.Get(ctx); err == nil && s != nil {
			hf.applySettings(s)
		}
	}

	return hf
}

func (hf *HostFilter) applySettings(s *models.SystemSettings) {
	hf.adminHostname = util.NormalizeHost(s.AdminHostname)
	hf.blockStreamingOnAdminHost = s.BlockStreamingOnAdminHost
	hf.restrictAdminToAdminHost = s.RestrictAdminToAdminHost
	hf.blockDirectIPStreaming = s.BlockDirectIPStreaming
	hf.lastSync = time.Now()
}

// SetSettings updates the filter settings in-memory immediately.
func (hf *HostFilter) SetSettings(s *models.SystemSettings) {
	if s == nil {
		return
	}
	hf.mu.Lock()
	defer hf.mu.Unlock()
	hf.applySettings(s)
}

// RefreshIfNeeded periodically checks for database settings changes if running in a separate process.
func (hf *HostFilter) RefreshIfNeeded(ctx context.Context) {
	if hf.repo == nil {
		return
	}

	hf.mu.RLock()
	needsRefresh := time.Since(hf.lastSync) > hf.syncInterval
	hf.mu.RUnlock()

	if !needsRefresh {
		return
	}

	hf.mu.Lock()
	defer hf.mu.Unlock()
	if time.Since(hf.lastSync) <= hf.syncInterval {
		return
	}

	if s, err := hf.repo.Get(ctx); err == nil && s != nil {
		hf.applySettings(s)
	} else {
		hf.lastSync = time.Now()
	}
}

// IsLoopbackOrPrivate returns true if the host is localhost, 127.0.0.1, ::1, or an RFC1918 private network IP.
func IsLoopbackOrPrivate(host string) bool {
	clean := util.NormalizeHost(host)
	if clean == "" || clean == "localhost" || clean == "127.0.0.1" || clean == "::1" {
		return true
	}
	ip := net.ParseIP(clean)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast()
}

// isRemoteAddrLoopbackOrPrivate checks if the connecting client RemoteAddr is loopback or private network.
func isRemoteAddrLoopbackOrPrivate(r *http.Request) bool {
	if r == nil || r.RemoteAddr == "" {
		return false
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return IsLoopbackOrPrivate(host)
}

// IsIPAddress returns true if the normalized host string is a valid IPv4 or IPv6 address.
func IsIPAddress(host string) bool {
	clean := util.NormalizeHost(host)
	return net.ParseIP(clean) != nil
}

// IsStreamingRoute identifies whether an HTTP request path corresponds to Xtream API,
// M3U/EPG generator, Stalker portal, or Stream Redirect playback.
func IsStreamingRoute(path string) bool {
	p := strings.ToLower(strings.TrimSpace(path))

	// Exact script names
	if p == "/player_api.php" || p == "/panel_api.php" || p == "/my_player" ||
		p == "/get.php" || p == "/xmltv.php" || p == "/timeshift.php" {
		return true
	}

	// Prefixes
	if strings.HasPrefix(p, "/player_api.php?") || strings.HasPrefix(p, "/panel_api.php?") ||
		strings.HasPrefix(p, "/get.php?") || strings.HasPrefix(p, "/xmltv.php?") {
		return true
	}

	if strings.HasPrefix(p, "/stalker") || strings.HasPrefix(p, "/sub/") {
		return true
	}

	if strings.HasPrefix(p, "/live/") || strings.HasPrefix(p, "/movie/") ||
		strings.HasPrefix(p, "/series/") || strings.HasPrefix(p, "/timeshift/") ||
		strings.HasPrefix(p, "/streaming/") {
		return true
	}

	if redirectorStreamRegex.MatchString(p) || legacyStreamPathRegex.MatchString(p) {
		return true
	}

	return false
}

// IsAdminRoute identifies whether an HTTP request path corresponds to the management dashboard SPA,
// administration REST APIs, authentication endpoints, or documentation.
// Note: Public client portal routes (/portal, /api/user-dashboard/config) return false.
func IsAdminRoute(path string) bool {
	p := strings.TrimSpace(path)

	// Public client portal routes are NOT admin routes
	if strings.HasPrefix(p, "/portal") || p == "/api/user-dashboard/config" {
		return false
	}

	// Administration & Protected APIs
	if strings.HasPrefix(p, "/api/admin") ||
		strings.HasPrefix(p, "/api/auth") ||
		strings.HasPrefix(p, "/api/team") ||
		strings.HasPrefix(p, "/token/s") ||
		strings.HasPrefix(p, "/api/playlists") ||
		strings.HasPrefix(p, "/api/users") ||
		strings.HasPrefix(p, "/api/security") ||
		strings.HasPrefix(p, "/api/geoip") ||
		strings.HasPrefix(p, "/api/sync-logs") {
		return true
	}

	// OpenAPI & Interactive API Documentation
	if strings.HasPrefix(p, "/docs") || p == "/api/openapi.json" || p == "/api/openapi.yaml" {
		return true
	}

	// Dashboard static files and root SPA
	if p == "/" || p == "/index.html" || strings.HasPrefix(p, "/assets/") || p == "/vite.svg" {
		return true
	}

	return false
}

// Middleware returns an HTTP middleware that enforces hostname isolation between admin and streaming traffic.
func (hf *HostFilter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 0. Emergency bypass via environment variable
		if hf.emergencyBypass {
			next.ServeHTTP(w, r)
			return
		}

		// 1. Sync settings if cached TTL expired
		hf.RefreshIfNeeded(r.Context())

		hf.mu.RLock()
		adminHost := hf.adminHostname
		blockStreamingOnAdmin := hf.blockStreamingOnAdminHost
		restrictAdminToAdmin := hf.restrictAdminToAdminHost
		blockDirectIP := hf.blockDirectIPStreaming
		hf.mu.RUnlock()

		reqHost := util.ExtractRequestHost(r)
		path := r.URL.Path

		// 2. Rule: Block Xtream API & Stream Redirector on Admin Hostname
		if adminHost != "" && blockStreamingOnAdmin {
			if reqHost == adminHost && IsStreamingRoute(path) {
				http.NotFound(w, r)
				return
			}
		}

		// 3. Rule: Block Direct IP Streaming
		if blockDirectIP && IsStreamingRoute(path) {
			if IsIPAddress(reqHost) && !IsLoopbackOrPrivate(reqHost) {
				http.NotFound(w, r)
				return
			}
		}

		// 4. Rule: Restrict Admin Dashboard to Admin Hostname
		if adminHost != "" && restrictAdminToAdmin {
			if IsAdminRoute(path) {
				// Anti-Lockout: Localhost, 127.0.0.1, and private LAN subnets are always permitted (by Host or RemoteAddr)
				if reqHost != adminHost && !IsLoopbackOrPrivate(reqHost) && !isRemoteAddrLoopbackOrPrivate(r) {
					http.NotFound(w, r)
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}
