package security

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/repository"
)

// LicenseGuard enforces soft lock on streaming routes when PlaylistLabs license is suspended.
type LicenseGuard struct {
	repo         *repository.SettingsRepo
	mu           sync.RWMutex
	suspended    bool
	suspendedAt  *time.Time
	lastSync     time.Time
	syncInterval time.Duration
}

// NewLicenseGuard initializes a LicenseGuard instance.
func NewLicenseGuard(repo *repository.SettingsRepo) *LicenseGuard {
	return &LicenseGuard{
		repo:         repo,
		syncInterval: 3 * time.Second,
	}
}

// IsSuspended returns whether the license is currently soft-locked.
func (g *LicenseGuard) IsSuspended(ctx context.Context) bool {
	g.mu.RLock()
	if time.Since(g.lastSync) < g.syncInterval {
		s := g.suspended
		g.mu.RUnlock()
		return s
	}
	g.mu.RUnlock()

	g.mu.Lock()
	defer g.mu.Unlock()
	if time.Since(g.lastSync) < g.syncInterval {
		return g.suspended
	}

	if g.repo != nil {
		settings, err := g.repo.Get(ctx)
		if err == nil && settings != nil {
			g.suspended = settings.LicenseSuspended
			g.suspendedAt = settings.LicenseSuspendedAt
		}
	}
	g.lastSync = time.Now()
	return g.suspended
}

// Invalidate forces an immediate refresh on the next request.
func (g *LicenseGuard) Invalidate() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.lastSync = time.Time{}
}

// Middleware blocks streaming routes when license is suspended.
func (g *LicenseGuard) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if IsStreamingRoute(path) && g.IsSuspended(r.Context()) {
			p := strings.ToLower(path)

			// Xtream API response
			if strings.HasPrefix(p, "/player_api.php") || strings.HasPrefix(p, "/panel_api.php") {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"user_info":{"auth":0,"status":"Disabled","message":"Service suspended: Plan upgrade required"}}`))
				return
			}

			// M3U Playlist response
			if p == "/get.php" || strings.HasPrefix(p, "/get.php?") || strings.HasSuffix(p, ".m3u") || strings.HasSuffix(p, ".m3u8") {
				w.Header().Set("Content-Type", "text/plain; charset=utf-8")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte("#EXTM3U\n# Service Suspended: Plan upgrade required\n"))
				return
			}

			// XMLTV EPG response
			if p == "/xmltv.php" || strings.HasPrefix(p, "/xmltv.php?") {
				w.Header().Set("Content-Type", "application/xml; charset=utf-8")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(`<?xml version="1.0" encoding="utf-8"?><tv></tv>`))
				return
			}

			// Direct video stream playback (/live/, /movie/, /series/, /stalker)
			http.Error(w, "Service suspended: Plan upgrade required.", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
