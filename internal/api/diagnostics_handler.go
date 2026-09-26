package api

import (
	"archive/zip"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"time"

	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/logger"
	"playlistlabs_user_management_os/internal/repository"
)

var processStartTime = time.Now()

// DiagnosticsHandler manages diagnostic endpoints, health inspection, and diagnostic bundle generation.
type DiagnosticsHandler struct {
	db           *sql.DB
	cache        cache.Cache
	syncLogRepo  *repository.SyncLogRepo
	settingsRepo *repository.SettingsRepo
	securityRepo *repository.SecurityRepo
}

// NewDiagnosticsHandler initializes a DiagnosticsHandler.
func NewDiagnosticsHandler(
	db *sql.DB,
	c cache.Cache,
	syncLogRepo *repository.SyncLogRepo,
	settingsRepo *repository.SettingsRepo,
	securityRepo *repository.SecurityRepo,
) *DiagnosticsHandler {
	return &DiagnosticsHandler{
		db:           db,
		cache:        c,
		syncLogRepo:  syncLogRepo,
		settingsRepo: settingsRepo,
		securityRepo: securityRepo,
	}
}

// SystemInfo represents runtime, OS, memory, and database health metrics.
type SystemInfo struct {
	Hostname       string         `json:"hostname"`
	OS             string         `json:"os"`
	Arch           string         `json:"arch"`
	GoVersion      string         `json:"go_version"`
	NumCPU         int            `json:"num_cpu"`
	NumGoroutine   int            `json:"num_goroutine"`
	UptimeSeconds  int64          `json:"uptime_seconds"`
	ProcessStarted string         `json:"process_started"`
	CurrentTime    string         `json:"current_time"`
	LogLevel       string         `json:"log_level"`
	Memory         MemoryMetrics  `json:"memory"`
	Database       DatabaseStatus `json:"database"`
	Cache          CacheStatus    `json:"cache"`
}

type MemoryMetrics struct {
	AllocMB      float64 `json:"alloc_mb"`
	TotalAllocMB float64 `json:"total_alloc_mb"`
	SysMB        float64 `json:"sys_mb"`
	HeapAllocMB  float64 `json:"heap_alloc_mb"`
	HeapSysMB    float64 `json:"heap_sys_mb"`
	NumGC        uint32  `json:"num_gc"`
}

type DatabaseStatus struct {
	Connected       bool   `json:"connected"`
	LatencyMs       int64  `json:"latency_ms"`
	Version         string `json:"version,omitempty"`
	OpenConnections int    `json:"open_connections"`
	InUse           int    `json:"in_use"`
	Idle            int    `json:"idle"`
	WaitCount       int64  `json:"wait_count"`
	Error           string `json:"error,omitempty"`
}

type CacheStatus struct {
	Connected bool   `json:"connected"`
	LatencyMs int64  `json:"latency_ms,omitempty"`
	Type      string `json:"type"`
	Error     string `json:"error,omitempty"`
}

// collectSystemInfo gathers current host and runtime statistics.
func (h *DiagnosticsHandler) collectSystemInfo(ctx context.Context) SystemInfo {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	hostname, _ := os.Hostname()
	now := time.Now().UTC()

	info := SystemInfo{
		Hostname:       hostname,
		OS:             runtime.GOOS,
		Arch:           runtime.GOARCH,
		GoVersion:      runtime.Version(),
		NumCPU:         runtime.NumCPU(),
		NumGoroutine:   runtime.NumGoroutine(),
		UptimeSeconds:  int64(now.Sub(processStartTime).Seconds()),
		ProcessStarted: processStartTime.UTC().Format(time.RFC3339),
		CurrentTime:    now.Format(time.RFC3339),
		LogLevel:       logger.GetLevel(),
		Memory: MemoryMetrics{
			AllocMB:      float64(mem.Alloc) / (1024 * 1024),
			TotalAllocMB: float64(mem.TotalAlloc) / (1024 * 1024),
			SysMB:        float64(mem.Sys) / (1024 * 1024),
			HeapAllocMB:  float64(mem.HeapAlloc) / (1024 * 1024),
			HeapSysMB:    float64(mem.HeapSys) / (1024 * 1024),
			NumGC:        mem.NumGC,
		},
	}

	// Database Health Check
	if h.db != nil {
		start := time.Now()
		pingErr := h.db.PingContext(ctx)
		latency := time.Since(start).Milliseconds()

		stats := h.db.Stats()
		dbStatus := DatabaseStatus{
			Connected:       pingErr == nil,
			LatencyMs:       latency,
			OpenConnections: stats.OpenConnections,
			InUse:           stats.InUse,
			Idle:            stats.Idle,
			WaitCount:       stats.WaitCount,
		}

		if pingErr != nil {
			dbStatus.Error = pingErr.Error()
		} else {
			var ver string
			_ = h.db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&ver)
			dbStatus.Version = ver
		}
		info.Database = dbStatus
	}

	// Cache Health Check
	if h.cache != nil {
		available := h.cache.IsAvailable()
		cacheStatus := CacheStatus{
			Connected: available,
			Type:      "redis",
		}
		if available {
			keys, mem, _, _ := h.cache.GetStats(ctx)
			cacheStatus.LatencyMs = 0
			_ = keys
			_ = mem
		} else {
			cacheStatus.Error = "cache backend unreachable"
		}
		info.Cache = cacheStatus
	} else {
		info.Cache = CacheStatus{
			Connected: false,
			Type:      "disabled",
		}
	}

	return info
}

// GetSystemInfo handles GET /api/admin/diagnostics/system
func (h *DiagnosticsHandler) GetSystemInfo(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	info := h.collectSystemInfo(ctx)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(info)
}

// GetRecentLogs handles GET /api/admin/diagnostics/logs?limit=100
func (h *DiagnosticsHandler) GetRecentLogs(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 2000 {
		limit = 2000
	}

	entries := logger.GetRecentEntries(limit)
	lines := logger.GetRecentLogs(limit)

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"log_level": logger.GetLevel(),
		"count":     len(lines),
		"logs":      lines,
		"entries":   entries,
	})
}

// DownloadBundle handles GET /api/admin/diagnostics/bundle
// Generates a zip archive containing server metrics, DB status, sync logs, and application logs.
func (h *DiagnosticsHandler) DownloadBundle(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	timestamp := time.Now().UTC().Format("20060102-150405")
	filename := fmt.Sprintf("playlistlabs-diagnostics-%s.zip", timestamp)

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	zw := zip.NewWriter(w)
	defer zw.Close()

	// 1. system_info.json
	sysInfo := h.collectSystemInfo(ctx)
	if sysData, err := json.MarshalIndent(sysInfo, "", "  "); err == nil {
		if f, err := zw.Create("system_info.json"); err == nil {
			_, _ = f.Write(sysData)
		}
	}

	// 2. database_status.json (with table counts)
	if h.db != nil {
		counts := map[string]int{
			"managed_users":      countTableRows(ctx, h.db, "managed_users"),
			"playlists":          countTableRows(ctx, h.db, "playlists"),
			"playlist_sync_logs": countTableRows(ctx, h.db, "playlist_sync_logs"),
			"admin_users":        countTableRows(ctx, h.db, "admin_users"),
		}
		dbDetails := map[string]any{
			"status":       sysInfo.Database,
			"table_counts": counts,
		}
		if dbData, err := json.MarshalIndent(dbDetails, "", "  "); err == nil {
			if f, err := zw.Create("database_status.json"); err == nil {
				_, _ = f.Write(dbData)
			}
		}
	}

	// 3. recent_sync_logs.json (Last 50 sync logs)
	if h.syncLogRepo != nil {
		if syncLogs, err := h.syncLogRepo.GetAllLogs(ctx, nil, 50); err == nil {
			if logsData, err := json.MarshalIndent(syncLogs, "", "  "); err == nil {
				if f, err := zw.Create("recent_sync_logs.json"); err == nil {
					_, _ = f.Write(logsData)
				}
			}
		}
	}

	// 4. sanitized_config.json
	if h.settingsRepo != nil {
		if settings, err := h.settingsRepo.Get(ctx); err == nil && settings != nil {
			sanitized := sanitizeSettings(settings)
			if confData, err := json.MarshalIndent(sanitized, "", "  "); err == nil {
				if f, err := zw.Create("sanitized_config.json"); err == nil {
					_, _ = f.Write(confData)
				}
			}
		}
	}

	// 5. application.log (In-memory ring buffer logs)
	recentLogs := logger.GetRecentLogs(2000)
	if f, err := zw.Create("application.log"); err == nil {
		for _, line := range recentLogs {
			_, _ = f.Write([]byte(line + "\n"))
		}
	}
}

// countTableRows safely counts rows in a given table without throwing fatal errors.
func countTableRows(ctx context.Context, db *sql.DB, tableName string) int {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", tableName)
	err := db.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		return -1
	}
	return count
}

// sanitizeSettings removes passwords, private tokens, and API secrets.
func sanitizeSettings(s any) map[string]any {
	raw, err := json.Marshal(s)
	if err != nil {
		return map[string]any{}
	}

	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return map[string]any{}
	}

	sensitiveKeys := []string{
		"iptveditor_api_token",
		"iptveditor_api_password",
		"api_token",
		"api_password",
		"jwt_secret",
		"db_password",
		"tmdb_api_key",
		"captcha_secret_key",
	}

	for _, k := range sensitiveKeys {
		if _, exists := m[k]; exists {
			m[k] = "[REDACTED]"
		}
	}

	return m
}
