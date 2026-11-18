package models

import (
	"fmt"
	"strings"
	"time"
)

// Standard content type constants for granular synchronization.
const (
	SyncTypeAll    = "all"
	SyncTypeLive   = "live"
	SyncTypeVod    = "vod"
	SyncTypeSeries = "series"
	SyncTypeEPG    = "epg"
)

// SyncStatus represents the current state of a sync operation.
type SyncStatus struct {
	IsRunning    bool       `json:"is_running"`
	JobID        string     `json:"job_id,omitempty"`
	PlaylistID   uint64     `json:"playlist_id,omitempty"` // 0 = all playlists
	PlaylistName string     `json:"playlist_name,omitempty"`
	SyncType     string     `json:"sync_type,omitempty"`
	Status       string     `json:"status"` // "idle", "running", "completed", "failed"
	Step         string     `json:"step,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	Error        string     `json:"error,omitempty"`
}

// SyncOptions specifies options for triggering synchronization.
type SyncOptions struct {
	Force   bool
	RawType string
	Types   map[string]bool // nil or empty indicates all content types are permitted
}

// AllowsLive returns true if live channels & categories should be synchronized.
func (o SyncOptions) AllowsLive() bool {
	return len(o.Types) == 0 || o.Types[SyncTypeLive]
}

// AllowsVod returns true if VODs (movies) & categories should be synchronized.
func (o SyncOptions) AllowsVod() bool {
	return len(o.Types) == 0 || o.Types[SyncTypeVod]
}

// AllowsSeries returns true if series, series episodes & categories should be synchronized.
func (o SyncOptions) AllowsSeries() bool {
	return len(o.Types) == 0 || o.Types[SyncTypeSeries]
}

// AllowsEPG returns true if EPG programmes and static XMLTV files should be synchronized.
func (o SyncOptions) AllowsEPG() bool {
	return len(o.Types) == 0 || o.Types[SyncTypeEPG]
}

// IsFullSync returns true if all content types are being synchronized.
func (o SyncOptions) IsFullSync() bool {
	return len(o.Types) == 0
}

// NormalizeSyncType validates and canonicalizes a single sync type string.
// Supported inputs (case-insensitive):
// - "live", "channels", "channel" -> "live"
// - "vod", "vods", "movie", "movies" -> "vod"
// - "series", "tv", "shows" -> "series"
// - "epg", "xmltv" -> "epg"
// - "", "all" -> "all"
func NormalizeSyncType(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	switch trimmed {
	case "", "all":
		return SyncTypeAll, nil
	case "live", "channels", "channel":
		return SyncTypeLive, nil
	case "vod", "vods", "movie", "movies":
		return SyncTypeVod, nil
	case "series", "tv", "shows":
		return SyncTypeSeries, nil
	case "epg", "xmltv":
		return SyncTypeEPG, nil
	default:
		return "", fmt.Errorf("invalid sync type %q (allowed: live, vod, series, epg, all)", raw)
	}
}

// ParseSyncTypes parses a single or comma-separated sync type string into a map of allowed types.
// Returns an empty/nil map if empty or "all", which indicates all types are allowed.
func ParseSyncTypes(raw string) (map[string]bool, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || strings.EqualFold(trimmed, "all") {
		return nil, nil
	}

	parts := strings.Split(trimmed, ",")
	result := make(map[string]bool, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		canonical, err := NormalizeSyncType(p)
		if err != nil {
			return nil, err
		}
		if canonical == SyncTypeAll {
			return nil, nil // "all" takes precedence
		}
		result[canonical] = true
	}
	if len(result) == 0 {
		return nil, nil
	}
	return result, nil
}

// ParseSyncOptions constructs a SyncOptions struct from force flag and optional type string(s).
func ParseSyncOptions(force bool, syncTypes ...string) (SyncOptions, error) {
	raw := ""
	if len(syncTypes) > 0 {
		raw = strings.TrimSpace(syncTypes[0])
	}
	typesMap, err := ParseSyncTypes(raw)
	if err != nil {
		return SyncOptions{Force: force, RawType: raw}, err
	}
	return SyncOptions{
		Force:   force,
		RawType: raw,
		Types:   typesMap,
	}, nil
}

// PlaylistSyncer defines the interface for triggering and inspecting playlist synchronizations.
// This interface decouples the web dashboard from the closed-source syncer engine,
// allowing the dashboard to talk to a local engine or a remote containerized worker.
type PlaylistSyncer interface {
	StartAsyncSync(playlistID uint64, force bool, syncTypes ...string) (string, error)
	GetSyncStatus() SyncStatus
}
