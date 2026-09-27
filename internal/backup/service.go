package backup

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/util"
)

type Service struct {
	userRepo     *repository.UserRepo
	playlistRepo *repository.PlaylistRepo
	settingsRepo *repository.SettingsRepo
	adminRepo    *repository.AdminRepo
	backupDir    string
}

func NewService(
	userRepo *repository.UserRepo,
	playlistRepo *repository.PlaylistRepo,
	settingsRepo *repository.SettingsRepo,
	adminRepo *repository.AdminRepo,
	backupDir string,
) *Service {
	if backupDir == "" {
		backupDir = "./backups"
	}
	_ = os.MkdirAll(backupDir, 0755)
	return &Service{
		userRepo:     userRepo,
		playlistRepo: playlistRepo,
		settingsRepo: settingsRepo,
		adminRepo:    adminRepo,
		backupDir:    backupDir,
	}
}

// CreateBackupPayload creates a standardized BackupPayload (v2.0) with optional users, system settings, welcome info, and team members.
func (s *Service) CreateBackupPayload(ctx context.Context, listID *uint64, backupType string, includeToken bool, includeTeam bool, exportedBy string) (*models.BackupPayload, error) {
	if backupType == "" {
		if listID != nil && *listID > 0 {
			backupType = "users"
		} else {
			backupType = "full"
		}
	}

	var playlistName string
	if listID != nil && *listID > 0 && s.playlistRepo != nil {
		p, err := s.playlistRepo.GetByID(ctx, *listID)
		if err != nil || p == nil {
			return nil, fmt.Errorf("playlist not found: %w", err)
		}
		playlistName = p.Name
	}

	// 1. Managed Users
	var users []models.ManagedUser
	if backupType == "full" || backupType == "users" {
		var err error
		if listID != nil && *listID > 0 {
			if s.userRepo != nil {
				users, err = s.userRepo.GetUsersByPlaylist(ctx, *listID, nil)
			}
		} else {
			if s.userRepo != nil {
				users, err = s.userRepo.GetAllUsers(ctx)
			}
		}
		if err != nil {
			return nil, fmt.Errorf("failed fetching users: %w", err)
		}
	}
	if users == nil {
		users = []models.ManagedUser{}
	}

	// 2. System Settings (Sync & Redis TTLs)
	var sysSettingsBackup *models.SystemSettingsBackup
	if (backupType == "full" || backupType == "settings") && s.settingsRepo != nil {
		sys, err := s.settingsRepo.Get(ctx)
		if err == nil && sys != nil {
			tokenIncluded := includeToken && strings.TrimSpace(sys.IPTVEditorAPIToken) != ""
			tmdbIncluded := includeToken && strings.TrimSpace(sys.TMDBApiKey) != ""
			sysSettingsBackup = &models.SystemSettingsBackup{
				HasToken:                  tokenIncluded || tmdbIncluded,
				PlaylistSyncIntervalHours: sys.PlaylistSyncIntervalHours,
				PlaylistSyncEnabled:       sys.PlaylistSyncEnabled,
				ExpirySyncIntervalHours:   sys.ExpirySyncIntervalHours,
				ExpirySyncEnabled:         sys.ExpirySyncEnabled,
				ExpirySyncAll:             sys.ExpirySyncAll,
				ExpirySyncDaysRange:       sys.ExpirySyncDaysRange,
				BackupIntervalHours:       sys.BackupIntervalHours,
				BackupEnabled:             sys.BackupEnabled,
				BackupRetentionDays:       sys.BackupRetentionDays,
				SecurityLogRetentionDays:  sys.SecurityLogRetentionDays,
				BackupDownloadMode:        sys.BackupDownloadMode,
				CacheEnabled:              sys.CacheEnabled,
				CacheAuthTTLMinutes:       sys.CacheAuthTTLMinutes,
				CacheCategoriesTTLMinutes: sys.CacheCategoriesTTLMinutes,
				CacheStreamsTTLMinutes:    sys.CacheStreamsTTLMinutes,
				TrackingTimeoutMinutes:    sys.TrackingTimeoutMinutes,
				ThrottleEnabled:              sys.ThrottleEnabled,
				ThrottleRouterEnabled:        sys.ThrottleRouterEnabled,
				ThrottleRouterLimit:          sys.ThrottleRouterLimit,
				ThrottleRouterWindowSeconds:  sys.ThrottleRouterWindowSeconds,
				ThrottleM3UEPGEnabled:        sys.ThrottleM3UEPGEnabled,
				ThrottleM3UEPGLimit:          sys.ThrottleM3UEPGLimit,
				ThrottleM3UEPGWindowSeconds:  sys.ThrottleM3UEPGWindowSeconds,
				ThrottleXtreamEnabled:        sys.ThrottleXtreamEnabled,
				ThrottleXtreamLimit:          sys.ThrottleXtreamLimit,
				ThrottleXtreamWindowSeconds:  sys.ThrottleXtreamWindowSeconds,
				ThrottleStalkerEnabled:       sys.ThrottleStalkerEnabled,
				ThrottleStalkerLimit:         sys.ThrottleStalkerLimit,
				ThrottleStalkerWindowSeconds: sys.ThrottleStalkerWindowSeconds,
				UserDashboardEnabled:             sys.UserDashboardEnabled,
				UserDashboardTitle:               sys.UserDashboardTitle,
				UserDashboardAllowHideCategories: sys.UserDashboardAllowHideCategories,
				UserDashboardHTML:                sys.UserDashboardHTML,
				UserDashboardLogo:                sys.UserDashboardLogo,
				UserDashboardPrimaryColor:        sys.UserDashboardPrimaryColor,
				UserDashboardSecondaryColor:      sys.UserDashboardSecondaryColor,
				UserDashboardAccentColor:         sys.UserDashboardAccentColor,
				UserDashboardBackgroundTheme:     sys.UserDashboardBackgroundTheme,
				AntiBruteForceEnabled:       sys.AntiBruteForceEnabled,
				AntiBruteForceMaxAttempts:   sys.AntiBruteForceMaxAttempts,
				AntiBruteForceWindowMinutes: sys.AntiBruteForceWindowMinutes,
				AntiBruteForceBanHours:      sys.AntiBruteForceBanHours,
				MultiIPDetectionEnabled:     sys.MultiIPDetectionEnabled,
				MultiIPMaxSubnets:           sys.MultiIPMaxSubnets,
				MultiIPWindowHours:          sys.MultiIPWindowHours,
				MultiIPAutoSuspend:          sys.MultiIPAutoSuspend,
				CaptchaProvider:             sys.CaptchaProvider,
				CaptchaSiteKey:              sys.CaptchaSiteKey,
				AdminHostname:               sys.AdminHostname,
				BlockStreamingOnAdminHost:   sys.BlockStreamingOnAdminHost,
				RestrictAdminToAdminHost:    sys.RestrictAdminToAdminHost,
				BlockDirectIPStreaming:      sys.BlockDirectIPStreaming,
				SSLOnDemandEnabled:          sys.SSLOnDemandEnabled,
				AdditionalSSLDomains:        sys.AdditionalSSLDomains,
				EPGMaxDays:                  sys.EPGMaxDays,
			}
			if tokenIncluded {
				sysSettingsBackup.IPTVEditorAPIToken = sys.IPTVEditorAPIToken
			}
			if tmdbIncluded {
				sysSettingsBackup.TMDBApiKey = sys.TMDBApiKey
			}
			if includeToken && sys.CaptchaSecretKey != "" {
				sysSettingsBackup.CaptchaSecretKey = sys.CaptchaSecretKey
			}
		}
	}

	// 3. Playlist Configurations & Welcome Info
	var playlistConfigs []models.PlaylistConfigBackup
	if (backupType == "full" || backupType == "settings") && s.playlistRepo != nil {
		if listID != nil && *listID > 0 {
			p, err := s.playlistRepo.GetByID(ctx, *listID)
			if err == nil && p != nil {
				playlistConfigs = append(playlistConfigs, models.PlaylistConfigBackup{
					ID:                     models.FlexUint64(p.ID),
					Name:                   p.Name,
					MaxConnections:         p.MaxConnections,
					LimitMaxConnections:    p.LimitMaxConnections,
					AllowTracking:          p.AllowTracking,
					TrackingTimeoutMinutes: p.TrackingTimeoutMinutes,
					CName:                  p.CName,
					EnforceCname:           p.EnforceCname,
					CnameSSL:               p.CnameSSL,
					Patterns:               p.Patterns,
					WelcomeInfo:            p.WelcomeInfo,
					PortalBranding:         p.PortalBranding,
				})
			}
		} else {
			allPlaylists, err := s.playlistRepo.GetAll(ctx)
			if err == nil {
				for _, p := range allPlaylists {
					playlistConfigs = append(playlistConfigs, models.PlaylistConfigBackup{
						ID:                     models.FlexUint64(p.ID),
						Name:                   p.Name,
						MaxConnections:         p.MaxConnections,
						LimitMaxConnections:    p.LimitMaxConnections,
						AllowTracking:          p.AllowTracking,
						TrackingTimeoutMinutes: p.TrackingTimeoutMinutes,
						CName:                  p.CName,
						EnforceCname:           p.EnforceCname,
						CnameSSL:               p.CnameSSL,
						Patterns:               p.Patterns,
						WelcomeInfo:            p.WelcomeInfo,
						PortalBranding:         p.PortalBranding,
					})
				}
			}
		}
	}

	// 4. Team Members (Admins & Collaborators)
	var teamMembers []models.TeamMemberBackup
	if (includeTeam || backupType == "full" || backupType == "team") && s.adminRepo != nil {
		members, err := s.adminRepo.GetAllTeamMembersForBackup(ctx)
		if err == nil && len(members) > 0 {
			teamMembers = members
		}
	}

	if exportedBy == "" {
		exportedBy = "system"
	}

	payload := &models.BackupPayload{
		Version:        "2.0",
		ExportedAt:     time.Now().UTC().Format(time.RFC3339),
		ExportedBy:     exportedBy,
		BackupType:     backupType,
		PlaylistID:     (*models.FlexUint64)(listID),
		PlaylistName:   playlistName,
		TotalUsers:     len(users),
		Users:          users,
		SystemSettings: sysSettingsBackup,
		Playlists:      playlistConfigs,
		TeamMembers:    teamMembers,
		HasTeamMembers: len(teamMembers) > 0,
	}
	return payload, nil
}

// SaveBackupToFile persists a backup payload into the server backups directory.
func (s *Service) SaveBackupToFile(payload *models.BackupPayload, isAuto bool) (string, error) {
	if err := os.MkdirAll(s.backupDir, 0755); err != nil {
		return "", fmt.Errorf("failed creating backup directory: %w", err)
	}

	now := time.Now().UTC()
	prefix := "manual"
	if isAuto {
		prefix = "auto"
	}

	bType := payload.BackupType
	if bType == "" {
		bType = "full"
	}

	var filename string
	if payload.PlaylistID != nil && *payload.PlaylistID > 0 {
		safeName := strings.ReplaceAll(payload.PlaylistName, " ", "_")
		safeName = strings.ReplaceAll(safeName, "/", "_")
		filename = fmt.Sprintf("backup_%s_playlist_%s_%d_%s.json", prefix, safeName, *payload.PlaylistID, now.Format("20060102_150405"))
	} else {
		filename = fmt.Sprintf("backup_%s_%s_%s.json", prefix, bType, now.Format("20060102_150405"))
	}

	filePath := filepath.Join(s.backupDir, filename)
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed marshaling backup payload: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("failed writing backup file: %w", err)
	}

	log.Printf("[BACKUP] Successfully saved %s backup to %s (%d users)", bType, filePath, len(payload.Users))
	return filename, nil
}

// ListStoredBackups returns list of saved backup files in backup directory.
func (s *Service) ListStoredBackups() ([]models.BackupFileMetadata, error) {
	if err := os.MkdirAll(s.backupDir, 0755); err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(s.backupDir)
	if err != nil {
		return nil, err
	}

	var backups []models.BackupFileMetadata
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		isAuto := strings.Contains(entry.Name(), "_auto_")
		totalUsers := 0
		backupType := "users"
		var listID *models.FlexUint64
		var listName string
		var hasSettings, hasPlaylists, hasToken, hasTeamMembers bool
		var totalTeam int

		// Read metadata preview from file
		fullPath := filepath.Join(s.backupDir, entry.Name())
		if data, err := os.ReadFile(fullPath); err == nil {
			var preview models.BackupPayload
			if err := json.Unmarshal(data, &preview); err == nil {
				totalUsers = preview.TotalUsers
				if totalUsers == 0 && len(preview.Users) > 0 {
					totalUsers = len(preview.Users)
				}
				if preview.BackupType != "" {
					backupType = preview.BackupType
				} else if preview.SystemSettings != nil {
					backupType = "full"
				}
				listID = preview.PlaylistID
				listName = preview.PlaylistName
				if preview.SystemSettings != nil {
					hasSettings = true
					if strings.TrimSpace(preview.SystemSettings.IPTVEditorAPIToken) != "" || strings.TrimSpace(preview.SystemSettings.TMDBApiKey) != "" {
						hasToken = true
					}
				}
				if len(preview.Playlists) > 0 {
					hasPlaylists = true
				}
				if len(preview.TeamMembers) > 0 {
					hasTeamMembers = true
					totalTeam = len(preview.TeamMembers)
				}
			} else {
				// Fallback: try raw array of ManagedUser
				var rawUsers []models.ManagedUser
				if errRaw := json.Unmarshal(data, &rawUsers); errRaw == nil {
					totalUsers = len(rawUsers)
				}
			}
		}

		backups = append(backups, models.BackupFileMetadata{
			Filename:       entry.Name(),
			SizeBytes:      info.Size(),
			TotalUsers:     totalUsers,
			CreatedAt:      info.ModTime().UTC(),
			IsAuto:         isAuto,
			BackupType:     backupType,
			PlaylistID:     listID,
			PlaylistName:   listName,
			HasSettings:    hasSettings,
			HasPlaylists:   hasPlaylists,
			HasToken:       hasToken,
			HasTeamMembers: hasTeamMembers,
			TotalTeam:      totalTeam,
		})
	}

	// Sort newest first
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	return backups, nil
}

// GetBackupFilePath validates and returns the safe absolute path for a filename.
func (s *Service) GetBackupFilePath(filename string) (string, error) {
	cleanName := filepath.Base(filename)
	if cleanName != filename || !strings.HasSuffix(cleanName, ".json") {
		return "", errors.New("invalid backup filename")
	}
	fullPath := filepath.Join(s.backupDir, cleanName)
	if _, err := os.Stat(fullPath); err != nil {
		return "", fmt.Errorf("backup file not found: %w", err)
	}
	return fullPath, nil
}

// DeleteStoredBackup removes a stored backup file safely.
func (s *Service) DeleteStoredBackup(filename string) error {
	path, err := s.GetBackupFilePath(filename)
	if err != nil {
		return err
	}
	return os.Remove(path)
}

// RestoreFromFile restores users and/or settings from a server-stored backup file.
func (s *Service) RestoreFromFile(ctx context.Context, filename string, req models.RestoreRequest, adminID int) (*models.RestoreResult, error) {
	path, err := s.GetBackupFilePath(filename)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed reading backup file: %w", err)
	}

	var payload models.BackupPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		// Fallback: try raw array of ManagedUser
		var rawUsers []models.ManagedUser
		if errRaw := json.Unmarshal(data, &rawUsers); errRaw == nil && len(rawUsers) > 0 {
			payload.Users = rawUsers
			payload.Version = "1.0"
		} else {
			return nil, fmt.Errorf("invalid backup file format: %w", err)
		}
	}

	return s.RestoreFromPayload(ctx, &payload, req, adminID)
}

// RestoreFromPayload implements the granular import logic for users, settings, and welcome info.
func (s *Service) RestoreFromPayload(ctx context.Context, payload *models.BackupPayload, req models.RestoreRequest, adminID int) (*models.RestoreResult, error) {
	if payload == nil {
		return nil, errors.New("empty backup payload")
	}

	if len(payload.Users) == 0 && payload.SystemSettings == nil && len(payload.Playlists) == 0 && len(payload.TeamMembers) == 0 {
		return nil, errors.New("no users, settings, playlists, or team members found in backup payload")
	}

	cleanMode := strings.ToLower(strings.TrimSpace(req.Mode))
	if cleanMode != "overwrite" {
		cleanMode = "skip"
	}

	var settingsRestored, tokenRestored bool
	var playlistsRestored int
	var errMessages []string

	// 1. Restore System Settings (Sync & Redis TTLs)
	if req.RestoreSettings && payload.SystemSettings != nil && s.settingsRepo != nil {
		cur, err := s.settingsRepo.Get(ctx)
		if err == nil && cur != nil {
			if payload.SystemSettings.PlaylistSyncIntervalHours > 0 {
				cur.PlaylistSyncIntervalHours = payload.SystemSettings.PlaylistSyncIntervalHours
			}
			cur.PlaylistSyncEnabled = payload.SystemSettings.PlaylistSyncEnabled
			if payload.SystemSettings.ExpirySyncIntervalHours > 0 {
				cur.ExpirySyncIntervalHours = payload.SystemSettings.ExpirySyncIntervalHours
			}
			cur.ExpirySyncEnabled = payload.SystemSettings.ExpirySyncEnabled
			cur.ExpirySyncAll = payload.SystemSettings.ExpirySyncAll
			if payload.SystemSettings.ExpirySyncDaysRange > 0 {
				cur.ExpirySyncDaysRange = payload.SystemSettings.ExpirySyncDaysRange
			}
			if payload.SystemSettings.BackupIntervalHours > 0 {
				cur.BackupIntervalHours = payload.SystemSettings.BackupIntervalHours
			}
			cur.BackupEnabled = payload.SystemSettings.BackupEnabled
			if payload.SystemSettings.BackupRetentionDays > 0 {
				cur.BackupRetentionDays = payload.SystemSettings.BackupRetentionDays
			}
			if payload.SystemSettings.SecurityLogRetentionDays > 0 {
				cur.SecurityLogRetentionDays = payload.SystemSettings.SecurityLogRetentionDays
			}
			if payload.SystemSettings.BackupDownloadMode != "" {
				cur.BackupDownloadMode = payload.SystemSettings.BackupDownloadMode
			}
			cur.CacheEnabled = payload.SystemSettings.CacheEnabled
			if payload.SystemSettings.CacheAuthTTLMinutes > 0 {
				cur.CacheAuthTTLMinutes = payload.SystemSettings.CacheAuthTTLMinutes
			}
			if payload.SystemSettings.CacheCategoriesTTLMinutes > 0 {
				cur.CacheCategoriesTTLMinutes = payload.SystemSettings.CacheCategoriesTTLMinutes
			}
			if payload.SystemSettings.CacheStreamsTTLMinutes > 0 {
				cur.CacheStreamsTTLMinutes = payload.SystemSettings.CacheStreamsTTLMinutes
			}
			if payload.SystemSettings.TrackingTimeoutMinutes > 0 {
				cur.TrackingTimeoutMinutes = payload.SystemSettings.TrackingTimeoutMinutes
			}

			// Restore portal studio / user dashboard customization if present in backup
			if payload.SystemSettings.UserDashboardTitle != "" {
				cur.UserDashboardTitle = payload.SystemSettings.UserDashboardTitle
				cur.UserDashboardEnabled = payload.SystemSettings.UserDashboardEnabled
				cur.UserDashboardAllowHideCategories = payload.SystemSettings.UserDashboardAllowHideCategories
				if payload.SystemSettings.UserDashboardHTML != "" {
					cur.UserDashboardHTML = payload.SystemSettings.UserDashboardHTML
				}
				if payload.SystemSettings.UserDashboardLogo != "" {
					cur.UserDashboardLogo = payload.SystemSettings.UserDashboardLogo
				}
				if payload.SystemSettings.UserDashboardPrimaryColor != "" {
					cur.UserDashboardPrimaryColor = payload.SystemSettings.UserDashboardPrimaryColor
				}
				if payload.SystemSettings.UserDashboardSecondaryColor != "" {
					cur.UserDashboardSecondaryColor = payload.SystemSettings.UserDashboardSecondaryColor
				}
				if payload.SystemSettings.UserDashboardAccentColor != "" {
					cur.UserDashboardAccentColor = payload.SystemSettings.UserDashboardAccentColor
				}
				if payload.SystemSettings.UserDashboardBackgroundTheme != "" {
					cur.UserDashboardBackgroundTheme = payload.SystemSettings.UserDashboardBackgroundTheme
				}
			}

			// Restore Throttling & Limits
			cur.ThrottleEnabled = payload.SystemSettings.ThrottleEnabled
			cur.ThrottleRouterEnabled = payload.SystemSettings.ThrottleRouterEnabled
			if payload.SystemSettings.ThrottleRouterLimit > 0 {
				cur.ThrottleRouterLimit = payload.SystemSettings.ThrottleRouterLimit
			}
			if payload.SystemSettings.ThrottleRouterWindowSeconds > 0 {
				cur.ThrottleRouterWindowSeconds = payload.SystemSettings.ThrottleRouterWindowSeconds
			}
			cur.ThrottleM3UEPGEnabled = payload.SystemSettings.ThrottleM3UEPGEnabled
			if payload.SystemSettings.ThrottleM3UEPGLimit > 0 {
				cur.ThrottleM3UEPGLimit = payload.SystemSettings.ThrottleM3UEPGLimit
			}
			if payload.SystemSettings.ThrottleM3UEPGWindowSeconds > 0 {
				cur.ThrottleM3UEPGWindowSeconds = payload.SystemSettings.ThrottleM3UEPGWindowSeconds
			}
			cur.ThrottleXtreamEnabled = payload.SystemSettings.ThrottleXtreamEnabled
			if payload.SystemSettings.ThrottleXtreamLimit > 0 {
				cur.ThrottleXtreamLimit = payload.SystemSettings.ThrottleXtreamLimit
			}
			if payload.SystemSettings.ThrottleXtreamWindowSeconds > 0 {
				cur.ThrottleXtreamWindowSeconds = payload.SystemSettings.ThrottleXtreamWindowSeconds
			}
			cur.ThrottleStalkerEnabled = payload.SystemSettings.ThrottleStalkerEnabled
			if payload.SystemSettings.ThrottleStalkerLimit > 0 {
				cur.ThrottleStalkerLimit = payload.SystemSettings.ThrottleStalkerLimit
			}
			if payload.SystemSettings.ThrottleStalkerWindowSeconds > 0 {
				cur.ThrottleStalkerWindowSeconds = payload.SystemSettings.ThrottleStalkerWindowSeconds
			}

			// Restore Anti-Brute Force & Multi-IP Protection
			cur.AntiBruteForceEnabled = payload.SystemSettings.AntiBruteForceEnabled
			if payload.SystemSettings.AntiBruteForceMaxAttempts > 0 {
				cur.AntiBruteForceMaxAttempts = payload.SystemSettings.AntiBruteForceMaxAttempts
			}
			if payload.SystemSettings.AntiBruteForceWindowMinutes > 0 {
				cur.AntiBruteForceWindowMinutes = payload.SystemSettings.AntiBruteForceWindowMinutes
			}
			if payload.SystemSettings.AntiBruteForceBanHours > 0 {
				cur.AntiBruteForceBanHours = payload.SystemSettings.AntiBruteForceBanHours
			}
			cur.MultiIPDetectionEnabled = payload.SystemSettings.MultiIPDetectionEnabled
			if payload.SystemSettings.MultiIPMaxSubnets > 0 {
				cur.MultiIPMaxSubnets = payload.SystemSettings.MultiIPMaxSubnets
			}
			if payload.SystemSettings.MultiIPWindowHours > 0 {
				cur.MultiIPWindowHours = payload.SystemSettings.MultiIPWindowHours
			}
			cur.MultiIPAutoSuspend = payload.SystemSettings.MultiIPAutoSuspend
			if payload.SystemSettings.CaptchaProvider != "" {
				cur.CaptchaProvider = payload.SystemSettings.CaptchaProvider
			}
			if payload.SystemSettings.CaptchaSiteKey != "" {
				cur.CaptchaSiteKey = payload.SystemSettings.CaptchaSiteKey
			}
			if req.RestoreToken && payload.SystemSettings.CaptchaSecretKey != "" {
				cur.CaptchaSecretKey = payload.SystemSettings.CaptchaSecretKey
			}

			// Restore Host & Domain Access Isolation & SSL
			if payload.SystemSettings.AdminHostname != "" {
				cur.AdminHostname = payload.SystemSettings.AdminHostname
			}
			cur.BlockStreamingOnAdminHost = payload.SystemSettings.BlockStreamingOnAdminHost
			cur.RestrictAdminToAdminHost = payload.SystemSettings.RestrictAdminToAdminHost
			cur.BlockDirectIPStreaming = payload.SystemSettings.BlockDirectIPStreaming
			cur.SSLOnDemandEnabled = payload.SystemSettings.SSLOnDemandEnabled
			if payload.SystemSettings.AdditionalSSLDomains != "" {
				cur.AdditionalSSLDomains = payload.SystemSettings.AdditionalSSLDomains
			}
			if payload.SystemSettings.EPGMaxDays > 0 {
				cur.EPGMaxDays = payload.SystemSettings.EPGMaxDays
			}

			// Restore token only if explicitly requested and token is present
			if req.RestoreToken && payload.SystemSettings.IPTVEditorAPIToken != "" {
				cur.IPTVEditorAPIToken = payload.SystemSettings.IPTVEditorAPIToken
				tokenRestored = true
			}
			if req.RestoreToken && payload.SystemSettings.TMDBApiKey != "" {
				cur.TMDBApiKey = payload.SystemSettings.TMDBApiKey
			}

			if err := s.settingsRepo.Update(ctx, cur); err != nil {
				errMessages = append(errMessages, fmt.Sprintf("Failed restoring system settings: %v", err))
			} else {
				settingsRestored = true
			}
		}
	}

	// 2. Restore Playlist Configurations & Welcome Info & Portal Branding
	if req.RestorePlaylists && len(payload.Playlists) > 0 && s.playlistRepo != nil {
		for _, p := range payload.Playlists {
			if p.ID == 0 {
				continue
			}

			targetPID := uint64(p.ID)
			if req.TargetListID != nil && *req.TargetListID > 0 {
				targetPID = uint64(*req.TargetListID)
			}

			existing, err := s.playlistRepo.GetByID(ctx, targetPID)
			if err != nil || existing == nil {
				continue
			}

			if len(p.WelcomeInfo) > 0 {
				_ = s.playlistRepo.UpdateWelcomeInfo(ctx, targetPID, p.WelcomeInfo)
			}
			if len(p.PortalBranding) > 0 && string(p.PortalBranding) != "null" && string(p.PortalBranding) != "{}" {
				_ = s.playlistRepo.UpdatePortalBranding(ctx, targetPID, p.PortalBranding)
			}
			_ = s.playlistRepo.UpdateSettings(ctx, targetPID, &p.AllowTracking, &p.LimitMaxConnections, &p.MaxConnections, &p.TrackingTimeoutMinutes, &p.CName, &p.EnforceCname, &p.CnameSSL)
			if len(p.Patterns) > 0 {
				_ = s.playlistRepo.UpdatePatterns(ctx, targetPID, p.Patterns)
			}
			playlistsRestored++
		}
	}

	// 3. Restore Managed Users
	shouldRestoreUsers := true
	if req.RestoreUsers != nil {
		shouldRestoreUsers = *req.RestoreUsers
	} else if (payload.BackupType == "settings" || payload.BackupType == "team") && len(payload.Users) == 0 {
		shouldRestoreUsers = false
	}

	var createdCount, updatedCount, skippedCount int

	if shouldRestoreUsers && len(payload.Users) > 0 && s.userRepo != nil {
		for i := range payload.Users {
			u := payload.Users[i]
			u.Username = strings.TrimSpace(u.Username)
			if u.Username == "" {
				skippedCount++
				errMessages = append(errMessages, fmt.Sprintf("User #%d skipped: empty username", i+1))
				continue
			}

			userOriginalListID := u.ListID
			if userOriginalListID == 0 && payload.PlaylistID != nil {
				userOriginalListID = uint64(*payload.PlaylistID)
			}

			// Filter by SourceListID if specified: only restore users belonging to that playlist
			if req.SourceListID != nil && *req.SourceListID > 0 {
				if userOriginalListID != uint64(*req.SourceListID) {
					continue
				}
			}

			userListID := userOriginalListID
			if req.TargetListID != nil && *req.TargetListID > 0 {
				userListID = uint64(*req.TargetListID)
			}

			if userListID == 0 {
				skippedCount++
				errMessages = append(errMessages, fmt.Sprintf("User '%s' skipped: no playlist specified", u.Username))
				continue
			}

			if s.playlistRepo != nil {
				targetPlaylist, err := s.playlistRepo.GetByID(ctx, userListID)
				if err != nil || targetPlaylist == nil {
					skippedCount++
					errMessages = append(errMessages, fmt.Sprintf("User '%s' skipped: playlist ID %d does not exist", u.Username, userListID))
					continue
				}
			}
			u.ListID = userListID

			// Check existing user
			existingUser, err := s.userRepo.GetUserByUsername(ctx, u.Username)
			if err != nil {
				errMessages = append(errMessages, fmt.Sprintf("User '%s' db error: %v", u.Username, err))
				continue
			}

			if existingUser != nil {
				if cleanMode == "skip" {
					skippedCount++
					continue
				}

				// Overwrite mode: update existing user and relocate to target/original playlist if moved
				targetListID := userListID
				targetID := existingUser.ID

				if existingUser.ListID != targetListID {
					// User was moved or assigned to another playlist: check if u.ID is available, otherwise get next available sequential ID
					if u.ID > 0 {
						taken, _ := s.userRepo.IsIDTaken(ctx, targetListID, u.ID)
						if !taken {
							targetID = u.ID
						} else {
							nextID, err := s.userRepo.GetNextID(ctx, targetListID)
							if err == nil {
								targetID = nextID
							}
						}
					} else {
						nextID, err := s.userRepo.GetNextID(ctx, targetListID)
						if err == nil {
							targetID = nextID
						}
					}
				}

				if u.Password == "" {
					u.Password = existingUser.Password
				}
				if u.M3U == "" {
					u.M3U = existingUser.M3U
				} else if taken, _ := s.userRepo.IsM3UTaken(ctx, u.M3U, existingUser.ListID, existingUser.ID); taken {
					u.M3U = existingUser.M3U
				}
				if u.EPG == "" {
					u.EPG = existingUser.EPG
				} else if taken, _ := s.userRepo.IsEPGTaken(ctx, u.EPG, existingUser.ListID, existingUser.ID); taken {
					u.EPG = existingUser.EPG
				}
				if u.Name == "" {
					u.Name = existingUser.Name
				}
				if u.Expiry == nil {
					u.Expiry = existingUser.Expiry
				}
				if u.MaxConnections <= 0 {
					u.MaxConnections = existingUser.MaxConnections
					if u.MaxConnections <= 0 {
						u.MaxConnections = 1
					}
				}
				if len(u.Patterns) == 0 {
					u.Patterns = existingUser.Patterns
					if len(u.Patterns) == 0 {
						u.Patterns = []byte("[]")
					}
				}
				if u.CreatedByAdminID == nil {
					u.CreatedByAdminID = existingUser.CreatedByAdminID
				}
				if u.CreatedByAdminID == nil {
					u.CreatedByAdminID = &adminID
				}

				if err := s.userRepo.RestoreOverwrite(ctx, existingUser.ListID, existingUser.ID, targetListID, targetID, &u); err != nil {
					errMessages = append(errMessages, fmt.Sprintf("User '%s' failed to update: %v", u.Username, err))
				} else {
					updatedCount++
				}
				continue
			}

			// New user: ensure safe unique tokens
			if u.M3U == "" {
				m3u, _ := util.GenerateUniqueM3U(ctx, s.userRepo)
				u.M3U = m3u
			} else if taken, _ := s.userRepo.IsM3UTaken(ctx, u.M3U, 0, 0); taken {
				m3u, _ := util.GenerateUniqueM3U(ctx, s.userRepo)
				u.M3U = m3u
			}

			if u.EPG == "" {
				epg, _ := util.GenerateUniqueEPG(ctx, s.userRepo)
				u.EPG = epg
			} else if taken, _ := s.userRepo.IsEPGTaken(ctx, u.EPG, 0, 0); taken {
				epg, _ := util.GenerateUniqueEPG(ctx, s.userRepo)
				u.EPG = epg
			}

			targetID := 0
			if u.ID > 0 {
				taken, _ := s.userRepo.IsIDTaken(ctx, userListID, u.ID)
				if !taken {
					targetID = u.ID
				}
			}
			if targetID == 0 {
				nextID, err := s.userRepo.GetNextID(ctx, userListID)
				if err != nil {
					errMessages = append(errMessages, fmt.Sprintf("User '%s' failed generating ID: %v", u.Username, err))
					continue
				}
				targetID = nextID
			}
			u.ID = targetID

			if u.Expiry == nil {
				defaultExp := time.Now().AddDate(1, 0, 0)
				u.Expiry = &defaultExp
			}

			u.CreatedByAdminID = &adminID

			if u.MaxConnections <= 0 {
				u.MaxConnections = 1
			}
			if len(u.Patterns) == 0 {
				u.Patterns = []byte("[]")
			}
			if u.Name == "" {
				u.Name = "User " + u.Username
			}

			if err := s.userRepo.Create(ctx, &u); err != nil {
				errMessages = append(errMessages, fmt.Sprintf("User '%s' failed to create: %v", u.Username, err))
			} else {
				createdCount++
			}
		}
	}

	// 4. Restore Team Members (Admins & Collaborators)
	var teamMembersRestored int
	if req.RestoreTeamMembers && len(payload.TeamMembers) > 0 && s.adminRepo != nil {
		onlyCollabs := req.RestoreTeamScope == "collaborators_only"
		overwrite := cleanMode == "overwrite"

		for _, m := range payload.TeamMembers {
			created, updated, _, err := s.adminRepo.RestoreTeamMember(ctx, m, overwrite, onlyCollabs)
			if err != nil {
				errMessages = append(errMessages, fmt.Sprintf("Team member '%s' restore error: %v", m.Username, err))
			} else if created || updated {
				teamMembersRestored++
			}
		}
	}

	var msgParts []string
	if shouldRestoreUsers {
		msgParts = append(msgParts, fmt.Sprintf("%d users created, %d updated, %d skipped", createdCount, updatedCount, skippedCount))
	}
	if settingsRestored {
		msgParts = append(msgParts, "system settings restored")
	}
	if tokenRestored {
		msgParts = append(msgParts, "API token updated")
	}
	if playlistsRestored > 0 {
		msgParts = append(msgParts, fmt.Sprintf("%d playlist configs/welcome info restored", playlistsRestored))
	}
	if teamMembersRestored > 0 {
		msgParts = append(msgParts, fmt.Sprintf("%d team accounts restored", teamMembersRestored))
	}
	if len(msgParts) == 0 {
		msgParts = append(msgParts, "No changes applied")
	}

	result := &models.RestoreResult{
		Success:             true,
		Mode:                cleanMode,
		TotalInFile:         len(payload.Users),
		Created:             createdCount,
		Updated:             updatedCount,
		Skipped:             skippedCount,
		SettingsRestored:    settingsRestored,
		TokenRestored:       tokenRestored,
		PlaylistsRestored:   playlistsRestored,
		TeamMembersRestored: teamMembersRestored,
		Errors:              errMessages,
		Message:             fmt.Sprintf("Restore completed: %s.", strings.Join(msgParts, ", ")),
	}
	return result, nil
}

// CleanOldBackups removes backup files older than retentionDays (keeping at least 5 newest backups).
func (s *Service) CleanOldBackups(retentionDays int) (int, error) {
	if retentionDays <= 0 {
		return 0, nil
	}

	backups, err := s.ListStoredBackups()
	if err != nil {
		return 0, err
	}

	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	deleted := 0

	for i, b := range backups {
		// Keep at least the 5 newest backups regardless of age
		if i < 5 {
			continue
		}
		if b.CreatedAt.Before(cutoff) {
			if err := s.DeleteStoredBackup(b.Filename); err == nil {
				deleted++
			}
		}
	}

	if deleted > 0 {
		log.Printf("[BACKUP] Cleaned %d expired backups older than %d days", deleted, retentionDays)
	}
	return deleted, nil
}

