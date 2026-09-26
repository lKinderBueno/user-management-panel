package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

// RemoteSyncerClient communicates with a standalone closed-source Syncer service
// over an internal HTTP API, satisfying models.PlaylistSyncer.
type RemoteSyncerClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewRemoteSyncerClient creates a new remote syncer client.
func NewRemoteSyncerClient(baseURL string, timeout ...time.Duration) *RemoteSyncerClient {
	t := 10 * time.Second
	if len(timeout) > 0 && timeout[0] > 0 {
		t = timeout[0]
	}

	cleanURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	return &RemoteSyncerClient{
		baseURL: cleanURL,
		httpClient: &http.Client{
			Timeout: t,
		},
	}
}

// StartAsyncSync triggers a playlist sync on the remote syncer daemon.
func (c *RemoteSyncerClient) StartAsyncSync(playlistID uint64, force bool) (string, error) {
	if c.baseURL == "" {
		return "", fmt.Errorf("remote syncer URL is not configured")
	}

	payload := map[string]interface{}{
		"playlist_id": playlistID,
		"force":       force,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to encode sync request: %w", err)
	}

	resp, err := c.httpClient.Post(c.baseURL+"/api/sync", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("remote syncer connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusConflict {
		var conflictResp struct {
			Error   string `json:"error"`
			Message string `json:"message"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&conflictResp)
		if conflictResp.Message != "" {
			return "", fmt.Errorf("%s", conflictResp.Message)
		}
		return "", fmt.Errorf("sync is already in progress on remote worker")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("remote syncer returned HTTP %d", resp.StatusCode)
	}

	var result struct {
		JobID string `json:"job_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed parsing syncer response: %w", err)
	}

	return result.JobID, nil
}

// GetSyncStatus queries current synchronization status from the remote syncer daemon.
func (c *RemoteSyncerClient) GetSyncStatus() models.SyncStatus {
	if c.baseURL == "" {
		return models.SyncStatus{
			IsRunning: false,
			Status:    "disabled",
			Step:      "Remote syncer URL not configured",
		}
	}

	resp, err := c.httpClient.Get(c.baseURL + "/api/status")
	if err != nil {
		return models.SyncStatus{
			IsRunning: false,
			Status:    "offline",
			Step:      "Unreachable",
			Error:     err.Error(),
		}
	}
	defer resp.Body.Close()

	var st models.SyncStatus
	if err := json.NewDecoder(resp.Body).Decode(&st); err != nil {
		return models.SyncStatus{
			IsRunning: false,
			Status:    "error",
			Error:     fmt.Sprintf("invalid status response: %v", err),
		}
	}

	return st
}
