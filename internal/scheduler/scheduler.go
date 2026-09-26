package scheduler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/backup"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/usersyncer"
)

type Scheduler struct {
	settingsRepo *repository.SettingsRepo
	syncer       models.PlaylistSyncer
	expirySyncer *usersyncer.CustomerExpirySyncer
	backupSvc    *backup.Service

	mu           sync.RWMutex
	pSyncStatus  models.TaskStatusSummary
	eSyncStatus  models.TaskStatusSummary
	backupStatus models.TaskStatusSummary
}

func NewScheduler(
	settingsRepo *repository.SettingsRepo,
	syncerEngine models.PlaylistSyncer,
	expirySyncer *usersyncer.CustomerExpirySyncer,
	backupSvc *backup.Service,
) *Scheduler {
	return &Scheduler{
		settingsRepo: settingsRepo,
		syncer:       syncerEngine,
		expirySyncer: expirySyncer,
		backupSvc:    backupSvc,
		pSyncStatus: models.TaskStatusSummary{
			Status: "idle",
		},
		eSyncStatus: models.TaskStatusSummary{
			Status: "idle",
		},
		backupStatus: models.TaskStatusSummary{
			Status: "idle",
		},
	}
}

// Start runs the periodic check loop in the background until ctx is cancelled.
func (s *Scheduler) Start(ctx context.Context) {
	log.Println("[SCHEDULER] Background scheduler started")

	// Run initial evaluation shortly after startup (after 5 seconds)
	go func() {
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
			s.CheckAndRun(ctx)
		}
	}()

	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				log.Println("[SCHEDULER] Background scheduler stopped")
				return
			case <-ticker.C:
				s.CheckAndRun(ctx)
			}
		}
	}()
}

// CheckAndRun inspects configured intervals and triggers tasks whose interval has elapsed.
func (s *Scheduler) CheckAndRun(ctx context.Context) {
	settings, err := s.settingsRepo.Get(ctx)
	if err != nil {
		log.Printf("[SCHEDULER-WARN] Failed fetching settings: %v", err)
		return
	}
	if !settings.SetupCompleted {
		// Do not trigger background automated sync until initial setup is completed
		return
	}

	now := time.Now().UTC()

	// 1. Check Playlist Sync
	if settings.PlaylistSyncEnabled && settings.PlaylistSyncIntervalHours > 0 && s.syncer != nil {
		interval := time.Duration(settings.PlaylistSyncIntervalHours) * time.Hour
		needsRun := settings.LastPlaylistSync == nil || now.Sub(*settings.LastPlaylistSync) >= interval
		if needsRun {
			s.mu.RLock()
			running := s.pSyncStatus.IsRunning
			s.mu.RUnlock()

			if !running {
				log.Printf("[SCHEDULER] Triggering automated playlist sync (interval=%dh)...", settings.PlaylistSyncIntervalHours)
				go func() {
					_ = s.TriggerPlaylistSync(context.Background(), false)
				}()
			}
		}
	}

	// 2. Check Customer Expiry Sync
	if settings.ExpirySyncEnabled && settings.ExpirySyncIntervalHours > 0 && s.expirySyncer != nil {
		interval := time.Duration(settings.ExpirySyncIntervalHours) * time.Hour
		needsRun := settings.LastExpirySync == nil || now.Sub(*settings.LastExpirySync) >= interval
		if needsRun {
			s.mu.RLock()
			running := s.eSyncStatus.IsRunning
			s.mu.RUnlock()

			if !running {
				daysRange := settings.ExpirySyncDaysRange
				if daysRange <= 0 {
					daysRange = 5
				}
				log.Printf("[SCHEDULER] Triggering automated customer expiry sync (interval=%dh, days=%d)...", settings.ExpirySyncIntervalHours, daysRange)
				go func() {
					_ = s.TriggerExpirySync(context.Background(), settings.ExpirySyncAll, daysRange)
				}()
			}
		}
	}

	// 3. Check Automatic Backup
	if settings.BackupEnabled && settings.BackupIntervalHours > 0 && s.backupSvc != nil {
		interval := time.Duration(settings.BackupIntervalHours) * time.Hour
		needsRun := settings.LastBackup == nil || now.Sub(*settings.LastBackup) >= interval
		if needsRun {
			s.mu.RLock()
			running := s.backupStatus.IsRunning
			s.mu.RUnlock()

			if !running {
				log.Printf("[SCHEDULER] Triggering automated backup (interval=%dh)...", settings.BackupIntervalHours)
				go func() {
					_, _ = s.TriggerBackup(context.Background(), true)
				}()
			}
		}
	}
}

// TriggerPlaylistSync starts synchronization of all playlists.
func (s *Scheduler) TriggerPlaylistSync(ctx context.Context, force bool) error {
	if s.syncer == nil {
		return fmt.Errorf("playlist syncer engine is not available")
	}

	s.mu.Lock()
	if s.pSyncStatus.IsRunning {
		s.mu.Unlock()
		return fmt.Errorf("playlist synchronization is already running")
	}
	now := time.Now().UTC()
	s.pSyncStatus.IsRunning = true
	s.pSyncStatus.Status = "running"
	s.pSyncStatus.Step = "Starting playlist synchronization..."
	s.pSyncStatus.LastRun = &now
	s.pSyncStatus.LastError = ""
	s.mu.Unlock()

	_, err := s.syncer.StartAsyncSync(0, force)
	if err != nil {
		s.mu.Lock()
		s.pSyncStatus.IsRunning = false
		s.pSyncStatus.Status = "failed"
		s.pSyncStatus.LastError = err.Error()
		s.mu.Unlock()
		return err
	}

	// Monitor syncer in goroutine
	go func() {
		for {
			time.Sleep(2 * time.Second)
			syncerState := s.syncer.GetSyncStatus()
			s.mu.Lock()
			s.pSyncStatus.IsRunning = syncerState.IsRunning
			s.pSyncStatus.Status = syncerState.Status
			s.pSyncStatus.Step = syncerState.Step
			if syncerState.Error != "" {
				s.pSyncStatus.LastError = syncerState.Error
			}
			s.mu.Unlock()

			if !syncerState.IsRunning {
				finishTime := time.Now().UTC()
				_ = s.settingsRepo.UpdateLastPlaylistSync(context.Background(), finishTime)
				break
			}
		}
	}()

	return nil
}

// TriggerExpirySync runs customer expiry synchronization.
func (s *Scheduler) TriggerExpirySync(ctx context.Context, all bool, daysRange ...int) error {
	if s.expirySyncer == nil {
		return fmt.Errorf("customer expiry syncer is not available")
	}

	windowDays := 5
	if len(daysRange) > 0 && daysRange[0] > 0 {
		windowDays = daysRange[0]
	} else if s.settingsRepo != nil {
		settings, err := s.settingsRepo.Get(ctx)
		if err == nil && settings != nil && settings.ExpirySyncDaysRange > 0 {
			windowDays = settings.ExpirySyncDaysRange
		}
	}

	s.mu.Lock()
	if s.eSyncStatus.IsRunning {
		s.mu.Unlock()
		return fmt.Errorf("customer expiry synchronization is already in progress")
	}
	now := time.Now().UTC()
	s.eSyncStatus.IsRunning = true
	s.eSyncStatus.Status = "running"
	s.eSyncStatus.Step = "Synchronizing customer expirations with providers..."
	s.eSyncStatus.LastRun = &now
	s.eSyncStatus.LastError = ""
	s.mu.Unlock()

	go func() {
		syncCtx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
		defer cancel()

		err := s.expirySyncer.SyncAll(syncCtx, all, windowDays)

		finishTime := time.Now().UTC()
		s.mu.Lock()
		s.eSyncStatus.IsRunning = false
		if err != nil {
			s.eSyncStatus.Status = "failed"
			s.eSyncStatus.LastError = err.Error()
			s.eSyncStatus.Step = "Completed with errors"
		} else {
			s.eSyncStatus.Status = "completed"
			s.eSyncStatus.Step = "Customer expiration sync finished successfully"
		}
		s.mu.Unlock()

		_ = s.settingsRepo.UpdateLastExpirySync(context.Background(), finishTime)
	}()

	return nil
}

// TriggerBackup generates a backup snapshot and saves it to disk (backward-compatible).
func (s *Scheduler) TriggerBackup(ctx context.Context, isAuto bool) (*models.BackupFileMetadata, error) {
	return s.TriggerBackupScoped(ctx, nil, "full", false, true, isAuto)
}

// TriggerBackupScoped generates a backup snapshot with specific scope, token, and team options.
func (s *Scheduler) TriggerBackupScoped(ctx context.Context, listID *uint64, backupType string, includeToken bool, includeTeam bool, isAuto bool) (*models.BackupFileMetadata, error) {
	if s.backupSvc == nil {
		return nil, fmt.Errorf("backup service is not available")
	}

	if backupType == "" {
		if listID != nil && *listID > 0 {
			backupType = "users"
		} else {
			backupType = "full"
		}
	}

	s.mu.Lock()
	if s.backupStatus.IsRunning {
		s.mu.Unlock()
		return nil, fmt.Errorf("a backup is already running")
	}
	now := time.Now().UTC()
	s.backupStatus.IsRunning = true
	s.backupStatus.Status = "running"
	s.backupStatus.Step = "Creating backup snapshot..."
	s.backupStatus.LastRun = &now
	s.backupStatus.LastError = ""
	s.mu.Unlock()

	exportedBy := "system-scheduler"
	if !isAuto {
		exportedBy = "admin-manual"
	}

	payload, err := s.backupSvc.CreateBackupPayload(ctx, listID, backupType, includeToken, includeTeam, exportedBy)
	if err != nil {
		s.mu.Lock()
		s.backupStatus.IsRunning = false
		s.backupStatus.Status = "failed"
		s.backupStatus.LastError = err.Error()
		s.mu.Unlock()
		return nil, err
	}

	filename, err := s.backupSvc.SaveBackupToFile(payload, isAuto)
	if err != nil {
		s.mu.Lock()
		s.backupStatus.IsRunning = false
		s.backupStatus.Status = "failed"
		s.backupStatus.LastError = err.Error()
		s.mu.Unlock()
		return nil, err
	}

	// Update DB last_backup timestamp
	_ = s.settingsRepo.UpdateLastBackup(ctx, now)

	// Clean older backups beyond retention
	settings, _ := s.settingsRepo.Get(ctx)
	retention := 30
	if settings != nil && settings.BackupRetentionDays > 0 {
		retention = settings.BackupRetentionDays
	}
	_, _ = s.backupSvc.CleanOldBackups(retention)

	s.mu.Lock()
	s.backupStatus.IsRunning = false
	s.backupStatus.Status = "completed"
	s.backupStatus.Step = fmt.Sprintf("Saved backup %s (%d users)", filename, len(payload.Users))
	s.backupStatus.UsersCount = len(payload.Users)
	s.mu.Unlock()

	return &models.BackupFileMetadata{
		Filename:       filename,
		TotalUsers:     len(payload.Users),
		CreatedAt:      now,
		IsAuto:         isAuto,
		BackupType:     backupType,
		PlaylistID:     payload.PlaylistID,
		PlaylistName:   payload.PlaylistName,
		HasSettings:    payload.SystemSettings != nil,
		HasPlaylists:   len(payload.Playlists) > 0,
		HasToken:       payload.SystemSettings != nil && (payload.SystemSettings.HasToken || payload.SystemSettings.IPTVEditorAPIToken != ""),
		HasTeamMembers: len(payload.TeamMembers) > 0,
		TotalTeam:      len(payload.TeamMembers),
	}, nil
}

// GetStatus compiles the live settings and task statuses with calculated next run times.
func (s *Scheduler) GetStatus(ctx context.Context) (*models.SettingsResponse, error) {
	settings, err := s.settingsRepo.Get(ctx)
	if err != nil {
		return nil, err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now().UTC()
	resp := &models.SettingsResponse{
		Settings:     *settings,
		PlaylistSync: s.pSyncStatus,
		ExpirySync:   s.eSyncStatus,
		Backup:       s.backupStatus,
	}

	// If PlaylistSyncer is running in the background engine, update status
	if s.syncer != nil {
		st := s.syncer.GetSyncStatus()
		if st.IsRunning {
			resp.PlaylistSync.IsRunning = true
			resp.PlaylistSync.Status = st.Status
			resp.PlaylistSync.Step = st.Step
		}
	}

	// Calculate NextRun for Playlist Sync
	if settings.PlaylistSyncEnabled && settings.PlaylistSyncIntervalHours > 0 {
		if settings.LastPlaylistSync != nil {
			next := settings.LastPlaylistSync.Add(time.Duration(settings.PlaylistSyncIntervalHours) * time.Hour)
			resp.PlaylistSync.NextRun = &next
		} else {
			resp.PlaylistSync.NextRun = &now
		}
	}
	if settings.LastPlaylistSync != nil {
		resp.PlaylistSync.LastRun = settings.LastPlaylistSync
	}

	// Calculate NextRun for Expiry Sync
	if settings.ExpirySyncEnabled && settings.ExpirySyncIntervalHours > 0 {
		if settings.LastExpirySync != nil {
			next := settings.LastExpirySync.Add(time.Duration(settings.ExpirySyncIntervalHours) * time.Hour)
			resp.ExpirySync.NextRun = &next
		} else {
			resp.ExpirySync.NextRun = &now
		}
	}
	if settings.LastExpirySync != nil {
		resp.ExpirySync.LastRun = settings.LastExpirySync
	}

	// Calculate NextRun for Backup
	if settings.BackupEnabled && settings.BackupIntervalHours > 0 {
		if settings.LastBackup != nil {
			next := settings.LastBackup.Add(time.Duration(settings.BackupIntervalHours) * time.Hour)
			resp.Backup.NextRun = &next
		} else {
			resp.Backup.NextRun = &now
		}
	}
	if settings.LastBackup != nil {
		resp.Backup.LastRun = settings.LastBackup
	}

	if s.backupSvc != nil {
		if storedBackups, err := s.backupSvc.ListStoredBackups(); err == nil && len(storedBackups) > 0 {
			resp.LatestBackup = &storedBackups[0]
		}
	}

	return resp, nil
}
