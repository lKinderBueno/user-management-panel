package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"playlistlabs_user_management_os/internal/api"
	"playlistlabs_user_management_os/internal/backup"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/client"
	"playlistlabs_user_management_os/internal/config"
	"playlistlabs_user_management_os/internal/db"
	"playlistlabs_user_management_os/internal/logger"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/scheduler"
	"playlistlabs_user_management_os/internal/security"
	"playlistlabs_user_management_os/internal/throttler"
	"playlistlabs_user_management_os/internal/tmdb"
	"playlistlabs_user_management_os/internal/tracking"
	"playlistlabs_user_management_os/internal/usersyncer"
)

func main() {
	logger.Init(os.Getenv("LOG_LEVEL"))
	logger.Info("[INFO] Starting PlaylistLabs Management Dashboard Service...")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[FATAL] Failed loading configuration: %v", err)
	}
	if cfg.LogLevel != "" {
		logger.SetLevel(cfg.LogLevel)
	}

	database, err := db.NewDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("[FATAL] Failed connecting to MariaDB: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	adminRepo := repository.NewAdminRepo(database)
	playlistRepo := repository.NewPlaylistRepo(database)
	userRepo := repository.NewUserRepo(database)
	tokenRepo := repository.NewTokenRepo(database)

	connectionTracker := tracking.NewTracker(cfg)
	appCache := cache.New(cfg)

	dbPlaylistRepo := db.NewPlaylistRepo(database)
	syncLogRepo := repository.NewSyncLogRepo(database)
	apiClient := client.NewAPIClient(cfg.ApiURL, cfg.ApiToken, cfg.ApiPassword, cfg.HTTPTimeout)

	var syncerEngine models.PlaylistSyncer

	syncerURL := os.Getenv("SYNCER_URL")
	if syncerURL != "" {
		syncerEngine = client.NewRemoteSyncerClient(syncerURL)
		log.Printf("[INFO] Configured remote syncer engine at %s", syncerURL)
	} else {
		syncerEngine = client.NewRemoteSyncerClient("")
		log.Println("[INFO] Remote syncer URL not configured (SYNCER_URL is empty). Playlist sync triggers will report syncer disabled.")
	}

	if err := dbPlaylistRepo.EnsureSchema(ctx); err != nil {
		log.Printf("[WARN] Failed ensuring playlist database schema: %v", err)
	}

	if err := adminRepo.EnsureSchema(ctx); err != nil {
		log.Printf("[WARN] Failed ensuring database schema: %v", err)
	}

	adminCount, err := adminRepo.CountAdmins(ctx)
	if err == nil && adminCount == 0 {
		log.Println("[INFO] No administrators found in database. Initial setup wizard is enabled on the web interface.")
	}

	// Clean up any playlist sync logs older than 7 days on startup
	if deleted, err := syncLogRepo.CleanOldLogs(ctx, 7); err == nil && deleted > 0 {
		log.Printf("[INFO] Cleaned %d expired playlist sync logs (> 7 days)", deleted)
	}

	tmdbClient := tmdb.NewClient(cfg.TMDBApiKey)

	settingsRepo := repository.NewSettingsRepo(database)
	if err := settingsRepo.EnsureSchema(ctx); err != nil {
		log.Printf("[WARN] Failed ensuring system_settings database schema: %v", err)
	}
	if sysSettings, err := settingsRepo.Get(ctx); err == nil {
		if sysSettings.IPTVEditorAPIURL != "" {
			apiClient.SetBaseURL(sysSettings.IPTVEditorAPIURL)
			log.Printf("[INFO] Loaded custom PlaylistLabs URL from system settings: %s", sysSettings.IPTVEditorAPIURL)
		}
		if sysSettings.IPTVEditorAPIToken != "" {
			apiClient.SetAPIToken(sysSettings.IPTVEditorAPIToken)
			log.Println("[INFO] Loaded custom PlaylistLabs token from system settings")
		}
		if sysSettings.IPTVEditorAPIPassword != "" {
			apiClient.SetPassword(sysSettings.IPTVEditorAPIPassword)
			log.Println("[INFO] Loaded custom PlaylistLabs password from system settings")
		}
		if sysSettings.TMDBApiKey != "" {
			tmdbClient.SetAPIKey(sysSettings.TMDBApiKey)
			log.Println("[INFO] Loaded custom TMDB API key from system settings")
		}
		appCache.SetSettings(
			sysSettings.CacheEnabled,
			time.Duration(sysSettings.CacheAuthTTLMinutes)*time.Minute,
			time.Duration(sysSettings.CacheCategoriesTTLMinutes)*time.Minute,
			time.Duration(sysSettings.CacheStreamsTTLMinutes)*time.Minute,
		)
	}

	securityRepo := repository.NewSecurityRepo(database)
	if err := securityRepo.EnsureSchema(ctx); err != nil {
		log.Printf("[WARN] Failed ensuring security database schema: %v", err)
	}
	securityService := security.NewService(cfg, securityRepo)

	secRetentionDays := 7
	if sysSettings, err := settingsRepo.Get(ctx); err == nil {
		if sysSettings.SecurityLogRetentionDays > 0 {
			secRetentionDays = sysSettings.SecurityLogRetentionDays
		}
		securityService.SetSettings(
			sysSettings.AntiBruteForceEnabled,
			sysSettings.AntiBruteForceBanHours,
			sysSettings.AntiBruteForceMaxAttempts,
			sysSettings.AntiBruteForceWindowMinutes,
		)
		securityService.SetMultiIPSettings(
			sysSettings.MultiIPDetectionEnabled,
			sysSettings.MultiIPMaxSubnets,
			sysSettings.MultiIPWindowHours,
			sysSettings.MultiIPAutoSuspend,
		)
		securityService.SetRetentionDays(secRetentionDays)
	}
	if deleted, err := securityRepo.CleanOldLogs(ctx, secRetentionDays); err == nil && deleted > 0 {
		log.Printf("[INFO] Cleaned %d expired security access logs (> %d days)", deleted, secRetentionDays)
	}

	redisClient := cache.NewRedisClient(cfg)
	throttlerInstance := throttler.New(nil, redisClient)
	if sysSettings, err := settingsRepo.Get(ctx); err == nil {
		throttlerInstance.SetSettings(sysSettings)
	}
	defer throttlerInstance.Close()

	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "./backups"
	}
	backupService := backup.NewService(userRepo, playlistRepo, settingsRepo, adminRepo, backupDir)
	xtreamClient := usersyncer.NewXtreamClient(7 * time.Second)
	expirySyncer := usersyncer.NewCustomerExpirySyncer(userRepo, xtreamClient, 3)

	schedulerInstance := scheduler.NewScheduler(settingsRepo, syncerEngine, expirySyncer, backupService)
	schedulerCtx, schedulerCancel := context.WithCancel(context.Background())
	schedulerInstance.Start(schedulerCtx)

	// Periodic background maintenance (every 6 hours)
	go func() {
		ticker := time.NewTicker(6 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-schedulerCtx.Done():
				return
			case <-ticker.C:
				cleanCtx, cleanCancel := context.WithTimeout(context.Background(), 30*time.Second)
				if d, err := syncLogRepo.CleanOldLogs(cleanCtx, 7); err == nil && d > 0 {
					log.Printf("[INFO] Periodic retention: cleaned %d expired playlist sync logs", d)
				}

				secDays := 7
				if curSettings, err := settingsRepo.Get(cleanCtx); err == nil && curSettings.SecurityLogRetentionDays > 0 {
					secDays = curSettings.SecurityLogRetentionDays
				}
				if d, err := securityRepo.CleanOldLogs(cleanCtx, secDays); err == nil && d > 0 {
					log.Printf("[INFO] Periodic retention: cleaned %d expired security access logs (> %d days)", d, secDays)
				}
				cleanCancel()
			}
		}
	}()

	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "web/dist"
	}

	// Router initialized without XtreamRepo, StalkerRepo, RedirectService, or GeneratorRepo
	// to expose ONLY dashboard, administration, and static frontend endpoints.
	router := api.NewRouter(api.RouterConfig{
		DB:              database,
		AdminRepo:       adminRepo,
		PlaylistRepo:    playlistRepo,
		UserRepo:        userRepo,
		Syncer:          syncerEngine,
		SyncLogRepo:     syncLogRepo,
		SettingsRepo:    settingsRepo,
		Scheduler:       schedulerInstance,
		BackupService:   backupService,
		SecurityService: securityService,
		SecurityRepo:    securityRepo,
		StaticDir:       staticDir,
		XtreamClient:    xtreamClient,
		Tracker:         connectionTracker,
		Cache:           appCache,
		Throttler:       throttlerInstance,
		TokenRepo:       tokenRepo,
		TMDBClient:      tmdbClient,
		DefaultTMDBKey:  cfg.TMDBApiKey,
		APIClient:       apiClient,
	})

	port := os.Getenv("DASHBOARD_PORT")
	if port == "" {
		port = os.Getenv("PORT")
	}
	if port == "" {
		port = os.Getenv("SERVER_PORT")
	}
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[INFO] Dashboard Server listening on http://0.0.0.0:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[FATAL] Dashboard Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("[INFO] Shutting down Dashboard Server gracefully...")
	schedulerCancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("[FATAL] Forced shutdown: %v", err)
	}

	log.Println("[INFO] Dashboard Server exited successfully.")
}
