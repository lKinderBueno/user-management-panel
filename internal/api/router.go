package api

import (
	"database/sql"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/auth"
	"playlistlabs_user_management_os/internal/backup"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/geoip"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/scheduler"
	"playlistlabs_user_management_os/internal/security"
	"playlistlabs_user_management_os/internal/throttler"
	"playlistlabs_user_management_os/internal/tmdb"
	"playlistlabs_user_management_os/internal/tracking"
	"playlistlabs_user_management_os/internal/usersyncer"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

type RouterConfig struct {
	DB              *sql.DB
	AdminRepo       *repository.AdminRepo
	PlaylistRepo    *repository.PlaylistRepo
	UserRepo        *repository.UserRepo
	Syncer          models.PlaylistSyncer
	SyncLogRepo     *repository.SyncLogRepo
	SettingsRepo    *repository.SettingsRepo
	Scheduler       *scheduler.Scheduler
	BackupService   *backup.Service
	SecurityService *security.Service
	SecurityRepo    *repository.SecurityRepo
	StaticDir       string
	XtreamClient    usersyncer.XtreamInfoFetcher
	Tracker         tracking.Tracker
	Cache           cache.Cache
	GeoIPService    *geoip.Service
	Throttler       *throttler.Throttler
	TokenRepo       *repository.TokenRepo
	TMDBClient      *tmdb.Client
	DefaultTMDBKey  string
	APIClient       *client.APIClient
	HostFilter      *security.HostFilter
	LicenseGuard    *security.LicenseGuard
	ExtraRoutes     []func(r chi.Router)
}

func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// 1. Basic Middlewares & Global CORS
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(security.CORSMiddleware)

	if cfg.SecurityService != nil {
		r.Use(cfg.SecurityService.IPBlockerMiddleware)
	}

	hostFilter := cfg.HostFilter
	if hostFilter == nil && cfg.SettingsRepo != nil {
		hostFilter = security.NewHostFilter(cfg.SettingsRepo)
	}
	if hostFilter != nil {
		r.Use(hostFilter.Middleware)
	}

	licenseGuard := cfg.LicenseGuard
	if licenseGuard == nil && cfg.SettingsRepo != nil {
		licenseGuard = security.NewLicenseGuard(cfg.SettingsRepo)
	}
	if licenseGuard != nil {
		r.Use(licenseGuard.Middleware)
	}

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Inject Cache if provided
	if cfg.Cache != nil {
		if cfg.Syncer != nil {
			if sc, ok := cfg.Syncer.(interface{ SetCache(cache.Cache) }); ok {
				sc.SetCache(cfg.Cache)
			}
		}
	}

	// Mount any optional custom or streaming routes (e.g. unified all-in-one server)
	for _, mount := range cfg.ExtraRoutes {
		if mount != nil {
			mount(r)
		}
	}

	authHandler := NewAuthHandler(cfg.AdminRepo, cfg.SecurityService)
	if cfg.SettingsRepo != nil {
		authHandler.SetSettingsRepo(cfg.SettingsRepo)
	}

	var setupHandler *SetupHandler
	if cfg.AdminRepo != nil && cfg.SettingsRepo != nil && cfg.APIClient != nil {
		setupHandler = NewSetupHandler(cfg.AdminRepo, cfg.SettingsRepo, cfg.APIClient, cfg.Cache, cfg.SecurityService, cfg.Syncer)
	}

	playlistHandler := NewPlaylistHandler(cfg.PlaylistRepo, cfg.AdminRepo, cfg.Syncer, cfg.SyncLogRepo)
	if cfg.APIClient != nil {
		playlistHandler.SetAPIClient(cfg.APIClient)
	}

	var dbHandle = cfg.DB
	if dbHandle == nil && cfg.PlaylistRepo != nil {
		dbHandle = cfg.PlaylistRepo.DB()
	}
	caddyHandler := NewCaddyHandler(dbHandle, cfg.SettingsRepo, cfg.PlaylistRepo)
	r.Get("/api/caddy/check-domain", caddyHandler.CheckCaddyDomain)
	userHandler := NewUserHandler(cfg.UserRepo, cfg.PlaylistRepo, cfg.AdminRepo, cfg.XtreamClient)
	if cfg.Tracker != nil {
		userHandler.SetTracker(cfg.Tracker)
	}
	if cfg.SecurityService != nil {
		userHandler.SetSecurityService(cfg.SecurityService)
	}
	if cfg.Cache != nil {
		userHandler.SetCache(cfg.Cache)
		playlistHandler.SetCache(cfg.Cache)
	}
	if cfg.UserRepo != nil {
		playlistHandler.SetUserRepo(cfg.UserRepo)
	}
	teamHandler := NewTeamHandler(cfg.AdminRepo, cfg.PlaylistRepo)
	tokenHandler := NewTokenHandler(cfg.TokenRepo, cfg.AdminRepo)
	var secRecorder auth.SecurityRecorder
	if cfg.SecurityService != nil {
		secRecorder = cfg.SecurityService
	}
	authenticator := auth.NewAuthenticator(tokenHandler, secRecorder)
	auth.SetDefaultAuthenticator(authenticator)

	// Public Documentation Viewer
	r.Get("/docs", HandleDocs)
	r.Get("/docs/", HandleDocs)

	geoService := cfg.GeoIPService
	if geoService == nil {
		geoService = geoip.NewService(cfg.Cache)
	}
	geoipHandler := NewGeoIPHandler(geoService)
	backupHandler := NewBackupHandler(cfg.UserRepo, cfg.PlaylistRepo, cfg.AdminRepo, cfg.SettingsRepo, cfg.BackupService)

	// 3. API Routes
	r.Route("/api", func(r chi.Router) {
		// Public Auth
		r.Get("/auth/captcha", authHandler.GetCaptcha)
		r.Post("/auth/login", authHandler.Login)

		// First-Boot Setup Endpoints
		if setupHandler != nil {
			r.Get("/setup/status", setupHandler.GetStatus)
			r.Post("/setup/test-connection", setupHandler.TestConnection)
			r.Post("/setup/initialize", setupHandler.Initialize)
		}

		// Public OpenAPI Specification & Interactive Documentation
		r.Get("/openapi.json", HandleOpenAPIJSON)
		r.Get("/openapi.yaml", HandleOpenAPIYAML)
		r.Get("/docs", HandleDocs)

		// Public User Portal / Dashboard Config
		r.Get("/user-dashboard/config", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			if cfg.SettingsRepo == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"user_dashboard_enabled":               true,
					"user_dashboard_title":                 "Client Portal",
					"user_dashboard_allow_hide_categories": true,
					"user_dashboard_html":                  "",
					"user_dashboard_logo":                  "",
					"user_dashboard_primary_color":         "#3b82f6",
					"user_dashboard_secondary_color":       "#6366f1",
					"user_dashboard_accent_color":          "#10b981",
					"user_dashboard_background_theme":       "slate",
					"admin_hostname":                      "",
					"block_streaming_on_admin_host":        true,
					"restrict_admin_to_admin_host":         false,
				})
				return
			}
			settings, err := cfg.SettingsRepo.Get(r.Context())
			if err != nil || settings == nil {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"user_dashboard_enabled":               true,
					"user_dashboard_title":                 "Client Portal",
					"user_dashboard_allow_hide_categories": true,
					"user_dashboard_html":                  "",
					"user_dashboard_logo":                  "",
					"user_dashboard_primary_color":         "#3b82f6",
					"user_dashboard_secondary_color":       "#6366f1",
					"user_dashboard_accent_color":          "#10b981",
					"user_dashboard_background_theme":       "slate",
					"admin_hostname":                      "",
					"block_streaming_on_admin_host":        true,
					"restrict_admin_to_admin_host":         false,
				})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"user_dashboard_enabled":               settings.UserDashboardEnabled,
				"user_dashboard_title":                 settings.UserDashboardTitle,
				"user_dashboard_allow_hide_categories": settings.UserDashboardAllowHideCategories,
				"user_dashboard_html":                  settings.UserDashboardHTML,
				"user_dashboard_logo":                  settings.UserDashboardLogo,
				"user_dashboard_primary_color":         settings.UserDashboardPrimaryColor,
				"user_dashboard_secondary_color":       settings.UserDashboardSecondaryColor,
				"user_dashboard_accent_color":          settings.UserDashboardAccentColor,
				"user_dashboard_background_theme":      settings.UserDashboardBackgroundTheme,
				"admin_hostname":                      settings.AdminHostname,
				"block_streaming_on_admin_host":        settings.BlockStreamingOnAdminHost,
				"restrict_admin_to_admin_host":         settings.RestrictAdminToAdminHost,
			})
		})

		// Protected Routes
		r.Group(func(r chi.Router) {
			r.Use(authenticator.Middleware)

			// Admin Auth
			r.Get("/auth/me", authHandler.Me)
			r.Post("/auth/logout", authHandler.Logout)

			// Team Management (Admins & Collaborators with can_create_collaborators)
			r.Group(func(teamSub chi.Router) {
				teamSub.Use(teamHandler.RequireTeamAccess)
				teamSub.Get("/team", teamHandler.GetTeamMembers)
				teamSub.Get("/team/", teamHandler.GetTeamMembers)
				teamSub.Post("/team", teamHandler.CreateTeamMember)
				teamSub.Post("/team/", teamHandler.CreateTeamMember)
				teamSub.Get("/team/{id}", teamHandler.GetTeamMember)
				teamSub.Put("/team/{id}", teamHandler.UpdateTeamMember)
				teamSub.Delete("/team/{id}", teamHandler.DeleteTeamMember)
			})

			// Internal API Token Management (Admins & Collaborators with can_manage_api_tokens)
			r.Group(func(tokenSub chi.Router) {
				tokenSub.Use(tokenHandler.RequireTokenAccess)
				tokenSub.Get("/tokens", tokenHandler.GetTokens)
				tokenSub.Get("/tokens/", tokenHandler.GetTokens)
				tokenSub.Post("/tokens", tokenHandler.CreateToken)
				tokenSub.Post("/tokens/", tokenHandler.CreateToken)
				tokenSub.Delete("/tokens/{id}", tokenHandler.DeleteToken)
				tokenSub.Put("/tokens/{id}", tokenHandler.UpdateToken)
				tokenSub.Put("/tokens/{id}/toggle", tokenHandler.ToggleToken)
			})

			// Pure Admin Only: Backup/Restore & Security Management
			r.Group(func(adminSub chi.Router) {
				adminSub.Use(auth.RequireAdminRole)

				// Managed Users Backup & Restore (Pure admin only)
				adminSub.Get("/admin/backup/users", backupHandler.BackupUsers)
				adminSub.Post("/admin/restore/users", backupHandler.RestoreUsers)
				adminSub.Get("/playlists/{listId}/users/backup", backupHandler.BackupUsers)
				adminSub.Post("/playlists/{listId}/users/restore", backupHandler.RestoreUsers)

				// Anti-Brute-Force & IP Security Management (Pure admin only)
				if cfg.SecurityService != nil {
					securityHandler := NewSecurityHandler(cfg.SecurityService, cfg.SecurityRepo)
					if cfg.Cache != nil {
						securityHandler.SetCache(cfg.Cache)
					}
					// Standard /api/admin/security/* endpoints
					adminSub.Get("/admin/security/stats", securityHandler.GetStats)
					adminSub.Get("/admin/security/ips", securityHandler.GetTrackedIPs)
					adminSub.Post("/admin/security/ips/block", securityHandler.BlockIP)
					adminSub.Post("/admin/security/ips/unblock", securityHandler.UnblockIP)
					adminSub.Post("/admin/security/ips/reset", securityHandler.ResetAttempts)
					adminSub.Delete("/admin/security/ips/{ip}", securityHandler.DeleteIP)
					adminSub.Get("/admin/security/logs", securityHandler.GetLogs)
					adminSub.Post("/admin/security/logs/flush", securityHandler.FlushLogs)
					adminSub.Get("/admin/security/compromised", securityHandler.GetCompromisedUsers)
					adminSub.Post("/admin/security/incidents/{id}/resolve", securityHandler.ResolveIncident)
					adminSub.Post("/admin/security/users/{username}/unsuspend", securityHandler.UnsuspendUser)

					// Convenient /api/security/* aliases
					adminSub.Get("/security/stats", securityHandler.GetStats)
					adminSub.Get("/security/ips", securityHandler.GetTrackedIPs)
					adminSub.Post("/security/ips/block", securityHandler.BlockIP)
					adminSub.Post("/security/ips/unblock", securityHandler.UnblockIP)
					adminSub.Post("/security/ips/reset", securityHandler.ResetAttempts)
					adminSub.Delete("/security/ips/{ip}", securityHandler.DeleteIP)
					adminSub.Get("/security/logs", securityHandler.GetLogs)
					adminSub.Post("/security/logs/flush", securityHandler.FlushLogs)
					adminSub.Get("/security/compromised", securityHandler.GetCompromisedUsers)
					adminSub.Post("/security/incidents/{id}/resolve", securityHandler.ResolveIncident)
					adminSub.Post("/security/users/{username}/unsuspend", securityHandler.UnsuspendUser)
				}

				adminSub.Get("/security/ssl-domains", caddyHandler.GetSSLDomains)
				adminSub.Post("/security/test-domain", caddyHandler.TestDomainDNS)

				// Automation & Dashboard Settings (Pure admin only)
				if cfg.SettingsRepo != nil && cfg.Scheduler != nil && cfg.BackupService != nil {
					settingsHandler := NewSettingsHandler(cfg.SettingsRepo, cfg.BackupService, cfg.Scheduler, cfg.Syncer)
					if cfg.Cache != nil {
						settingsHandler.SetCache(cfg.Cache)
					}
					if cfg.SecurityService != nil {
						settingsHandler.SetSecurityService(cfg.SecurityService)
					}
					if cfg.UserRepo != nil {
						settingsHandler.SetUserRepo(cfg.UserRepo)
					}
					if cfg.PlaylistRepo != nil {
						settingsHandler.SetPlaylistRepo(cfg.PlaylistRepo)
					}
					if cfg.Throttler != nil {
						settingsHandler.SetThrottler(cfg.Throttler)
					}
					if cfg.TMDBClient != nil {
						settingsHandler.SetTMDBClient(cfg.TMDBClient, cfg.DefaultTMDBKey)
					}
					if cfg.APIClient != nil {
						settingsHandler.SetAPIClient(cfg.APIClient)
					}
					if hostFilter != nil {
						settingsHandler.SetHostFilter(hostFilter)
					}
					if licenseGuard != nil {
						settingsHandler.SetLicenseGuard(licenseGuard)
					}
					adminSub.Get("/admin/settings", settingsHandler.GetSettings)
					adminSub.Put("/admin/settings", settingsHandler.UpdateSettings)
					adminSub.Post("/admin/settings/cache/clear", settingsHandler.ClearCache)
					adminSub.Post("/admin/settings/test-token", settingsHandler.TestToken)
					adminSub.Post("/admin/settings/test-tmdb", settingsHandler.TestTMDBKey)
					adminSub.Post("/admin/settings/test-captcha", settingsHandler.TestCaptcha)
					adminSub.Post("/admin/settings/sync/playlists", settingsHandler.TriggerPlaylistSync)
					adminSub.Post("/admin/settings/sync/expiry", settingsHandler.TriggerExpirySync)
					adminSub.Post("/admin/settings/backup/run", settingsHandler.TriggerBackup)
					adminSub.Get("/admin/settings/backups", settingsHandler.ListBackups)
					adminSub.Post("/admin/settings/backups/restore", settingsHandler.RestoreStoredBackup)
					adminSub.Get("/admin/settings/backups/download/{filename}", settingsHandler.DownloadBackup)
					adminSub.Delete("/admin/settings/backups/{filename}", settingsHandler.DeleteBackup)
					adminSub.Post("/admin/settings/import-editor", settingsHandler.ImportFromEditor)
				}

				// System Diagnostics & Diagnostic Bundle (Pure admin only)
				diagHandler := NewDiagnosticsHandler(dbHandle, cfg.Cache, cfg.SyncLogRepo, cfg.SettingsRepo, cfg.SecurityRepo)
				adminSub.Get("/admin/diagnostics/system", diagHandler.GetSystemInfo)
				adminSub.Get("/admin/diagnostics/logs", diagHandler.GetRecentLogs)
				adminSub.Get("/admin/diagnostics/bundle", diagHandler.DownloadBundle)
			})

			// Playlists & Sync Engine
			r.Get("/playlists/sync/status", playlistHandler.GetSyncStatus)
			r.Post("/playlists/sync", playlistHandler.StartAllPlaylistsSync)
			r.Post("/playlists/refresh", playlistHandler.StartAllPlaylistsSync)
			r.Post("/playlists/{listId}/sync", playlistHandler.StartPlaylistSync)
			r.Post("/playlists/{listId}/refresh", playlistHandler.StartPlaylistSync)
			r.Post("/playlists/{listId}/import-from-editor", playlistHandler.ImportFromEditor)
			r.Get("/playlists/{listId}/sync-logs", playlistHandler.GetPlaylistSyncLogs)
			r.Get("/sync-logs", playlistHandler.GetAllSyncLogs)


			r.Get("/playlists", playlistHandler.GetPlaylists)
			r.Get("/playlists/{listId}", playlistHandler.GetPlaylist)
			r.Put("/playlists/{listId}/settings", playlistHandler.UpdatePlaylistSettings)
			r.Delete("/playlists/{listId}", playlistHandler.DeletePlaylist)
			r.Get("/playlists/{listId}/categories", playlistHandler.GetCategories)
			r.Get("/playlists/{listId}/welcome-info", playlistHandler.GetWelcomeInfo)
			r.Put("/playlists/{listId}/welcome-info", playlistHandler.UpdateWelcomeInfo)
			r.Get("/playlists/{listId}/portal-branding", playlistHandler.GetPortalBranding)
			r.Put("/playlists/{listId}/portal-branding", playlistHandler.UpdatePortalBranding)

			// Managed Users & Active Connections
			r.Get("/playlists/{listId}/users", userHandler.GetUsers)
			r.Get("/playlists/{listId}/next-user-id", userHandler.GetNextUserID)
			r.Get("/playlists/{listId}/connections", userHandler.GetPlaylistConnections)
			r.Get("/playlists/{listId}/users/{id}/connections", userHandler.GetUserConnections)
			r.Delete("/playlists/{listId}/users/{id}/connections/{deviceKey}", userHandler.DeleteConnection)
			r.Post("/playlists/{listId}/users", userHandler.CreateUser)
			r.Delete("/playlists/{listId}/users", userHandler.DeleteUsers)
			r.Post("/playlists/{listId}/users/move", userHandler.MoveUsers)
			r.Post("/playlists/{listId}/users/bulk-categories", userHandler.BulkUpdateCategories)
			r.Post("/playlists/{listId}/users/bulk-patterns", userHandler.BulkUpdatePatterns)
			//
			r.Put("/playlists/{listId}/users/{id}", userHandler.UpdateUser)
			r.Post("/playlists/{listId}/users/{id}/credentials", userHandler.UpdateCredentials)
			r.Post("/playlists/{listId}/users/{id}/force-sync", userHandler.ForceSync)

			// Helpers
			r.Get("/users/check-username", userHandler.CheckUsername)
			r.Get("/users/check-short-url", userHandler.CheckShortURL)
			r.Get("/users/generate-random", userHandler.GenerateRandom)
			r.Get("/geoip/lookup", geoipHandler.Lookup)
		})
	})

	// 4. Frontend Serving: Reverse Proxy to Vite Dev Server (in development) with Fallback to Static Files
	viteDevURL := os.Getenv("VITE_DEV_URL")
	if viteDevURL == "" {
		// Auto-detect if Vite is running locally on default port 5173
		conn, err := net.DialTimeout("tcp", "127.0.0.1:5173", 60*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			viteDevURL = "http://127.0.0.1:5173"
		}
	}

	serveStatic := func(w http.ResponseWriter, r *http.Request) {
		if cfg.StaticDir == "" {
			http.NotFound(w, r)
			return
		}
		path := filepath.Join(cfg.StaticDir, r.URL.Path)
		info, err := os.Stat(path)
		if os.IsNotExist(err) || (err == nil && info.IsDir()) {
			http.ServeFile(w, r, filepath.Join(cfg.StaticDir, "index.html"))
			return
		}
		http.FileServer(http.Dir(cfg.StaticDir)).ServeHTTP(w, r)
	}

	if viteDevURL != "" {
		if parsedURL, err := url.Parse(viteDevURL); err == nil {
			log.Printf("[INFO] Frontend dev proxy active -> proxying non-API traffic to Vite at %s", viteDevURL)
			proxy := httputil.NewSingleHostReverseProxy(parsedURL)
			proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, proxyErr error) {
				// Fallback to static build if Vite is unexpectedly unreachable
				serveStatic(w, r)
			}

			r.HandleFunc("/*", func(w http.ResponseWriter, r *http.Request) {
				if strings.HasPrefix(r.URL.Path, "/api") {
					http.NotFound(w, r)
					return
				}
				r.Host = parsedURL.Host
				proxy.ServeHTTP(w, r)
			})
			return r
		}
	}

	if cfg.StaticDir != "" {
		if _, err := os.Stat(cfg.StaticDir); err == nil {
			r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
				if strings.HasPrefix(r.URL.Path, "/api") {
					http.NotFound(w, r)
					return
				}
				serveStatic(w, r)
			})
		}
	}

	return r
}
