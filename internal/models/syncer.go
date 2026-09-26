package models

import "time"

// SyncStatus represents the current state of a sync operation.
type SyncStatus struct {
	IsRunning    bool       `json:"is_running"`
	JobID        string     `json:"job_id,omitempty"`
	PlaylistID   uint64     `json:"playlist_id,omitempty"` // 0 = all playlists
	PlaylistName string     `json:"playlist_name,omitempty"`
	Status       string     `json:"status"` // "idle", "running", "completed", "failed"
	Step         string     `json:"step,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	FinishedAt   *time.Time `json:"finished_at,omitempty"`
	Error        string     `json:"error,omitempty"`
}

// PlaylistSyncer defines the interface for triggering and inspecting playlist synchronizations.
// This interface decouples the web dashboard from the closed-source syncer engine,
// allowing the dashboard to talk to a local engine or a remote containerized worker.
type PlaylistSyncer interface {
	StartAsyncSync(playlistID uint64, force bool) (string, error)
	GetSyncStatus() SyncStatus
}
