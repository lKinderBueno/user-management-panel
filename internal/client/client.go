package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ErrDataUnchanged is returned when the remote server reports 429 Data Unchanged (within 120s cooldown on offset=0).
var ErrDataUnchanged = errors.New("data unchanged")

// RateLimitError represents an HTTP 429 rate limit error with retry instructions.
type RateLimitError struct {
	RetryAfter  time.Duration
	Message     string
	IsUnchanged bool
}

func (e *RateLimitError) Error() string {
	if e.IsUnchanged {
		return fmt.Sprintf("data unchanged: %s", e.Message)
	}
	return fmt.Sprintf("rate limit exceeded (retry after %v): %s", e.RetryAfter, e.Message)
}

// Is supports errors.Is(err, ErrDataUnchanged).
func (e *RateLimitError) Is(target error) bool {
	if target == ErrDataUnchanged {
		return e.IsUnchanged
	}
	return false
}

// UpstreamAPIError represents a structured error returned by the remote PlaylistLabs.
type UpstreamAPIError struct {
	StatusCode int    `json:"status_code"`
	Title      string `json:"title,omitempty"`
	Body       string `json:"body,omitempty"`
	Code       string `json:"code,omitempty"`
	UpgradeURL string `json:"upgrade_url,omitempty"`
	Raw        string `json:"raw,omitempty"`
}

func (e *UpstreamAPIError) Error() string {
	if e.Body != "" {
		return e.Body
	}
	if e.Title != "" {
		return e.Title
	}
	return fmt.Sprintf("api error status %d: %s", e.StatusCode, e.Raw)
}

// APIClient defines methods to communicate with PlaylistLabs Token API.
type APIClient struct {
	baseURL           string
	apiToken          string
	password          string
	httpClient        *http.Client
	epgPacingDelay    time.Duration
	streamPacingDelay time.Duration
	clientName        string
	clientVersion     string
	clientSource      string
	mu                sync.RWMutex
}

// NewAPIClient creates a new PlaylistLabs Token API client.
func NewAPIClient(baseURL, apiToken, password string, timeout time.Duration) *APIClient {
	if timeout <= 0 {
		timeout = 60 * time.Second
	}
	return &APIClient{
		baseURL:       baseURL,
		apiToken:      apiToken,
		password:      password,
		httpClient:    &http.Client{Timeout: timeout},
		clientName:    "playlistlabs-user-panel",
		clientVersion: "1.0.0",
		clientSource:  "panel",
	}
}

// SetAPIToken updates the active API token in runtime thread-safely.
func (c *APIClient) SetAPIToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.apiToken = token
}

// GetAPIToken returns the current API token.
func (c *APIClient) GetAPIToken() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.apiToken
}

// SetBaseURL updates the base URL in runtime thread-safely.
func (c *APIClient) SetBaseURL(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.baseURL = strings.TrimRight(url, "/")
}

// GetBaseURL returns the current base URL.
func (c *APIClient) GetBaseURL() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.baseURL
}

// SetPassword updates the active token password thread-safely.
func (c *APIClient) SetPassword(password string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.password = password
}

// GetPassword returns the current active token password.
func (c *APIClient) GetPassword() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.password
}

// SetEpgPacingDelay overrides the pacing delay between EPG chunk requests (default: 3s to guarantee <= 20 req/min).
func (c *APIClient) SetEpgPacingDelay(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.epgPacingDelay = d
}

// GetEpgPacingDelay returns the current EPG chunk pacing delay (defaults to 3s if not set).
func (c *APIClient) GetEpgPacingDelay() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.epgPacingDelay <= 0 {
		return 3000 * time.Millisecond
	}
	return c.epgPacingDelay
}

// SetStreamPacingDelay overrides the pacing delay between stream pagination requests (default: 50ms to respect 120 req/min).
func (c *APIClient) SetStreamPacingDelay(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.streamPacingDelay = d
}

// GetStreamPacingDelay returns the current stream pagination pacing delay (defaults to 50ms if not set).
func (c *APIClient) GetStreamPacingDelay() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.streamPacingDelay <= 0 {
		return 50 * time.Millisecond
	}
	return c.streamPacingDelay
}

// ValidateToken verifies whether the provided token (and optional password) is valid by querying IPTVEditor API.
func (c *APIClient) ValidateToken(ctx context.Context, testToken string, testPassword ...string) (int, error) {
	c.mu.RLock()
	currentURL := c.baseURL
	pass := c.password
	c.mu.RUnlock()
	if len(testPassword) > 0 {
		pass = testPassword[0]
	}
	return c.ValidateConnectionWithPassword(ctx, currentURL, testToken, pass)
}

// ValidateConnection verifies whether the provided token and URL can successfully reach the API using the client's current password.
func (c *APIClient) ValidateConnection(ctx context.Context, testURL, testToken string) (int, error) {
	c.mu.RLock()
	pass := c.password
	c.mu.RUnlock()
	return c.ValidateConnectionWithPassword(ctx, testURL, testToken, pass)
}

// SetClientSource sets the client source identifier (e.g., "panel" or "syncer").
func (c *APIClient) SetClientSource(source string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.clientSource = source
}

// GetClientSource returns the current client source identifier.
func (c *APIClient) GetClientSource() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.clientSource == "" {
		return "panel"
	}
	return c.clientSource
}

func (c *APIClient) applyHeaders(req *http.Request, token, password string) {
	c.mu.RLock()
	clientName := c.clientName
	if clientName == "" {
		clientName = "playlistlabs-user-panel"
	}
	clientVersion := c.clientVersion
	if clientVersion == "" {
		clientVersion = "1.0.0"
	}
	clientSource := c.clientSource
	if clientSource == "" {
		clientSource = "panel"
	}
	c.mu.RUnlock()

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-api-token", token)
	if password != "" {
		req.Header.Set("x-token-password", password)
	}
	req.Header.Set("x-client-name", clientName)
	req.Header.Set("x-client-version", clientVersion)
	req.Header.Set("x-client-source", clientSource)
}

// ValidateConnectionWithPassword verifies whether the provided token, optional password, and URL can reach the API.
func (c *APIClient) ValidateConnectionWithPassword(ctx context.Context, testURL, testToken, testPassword string) (int, error) {
	cleanedURL := strings.TrimRight(strings.TrimSpace(testURL), "/")
	if cleanedURL == "" {
		return 0, errors.New("Endpoint Base URL cannot be empty")
	}
	if strings.TrimSpace(testToken) == "" {
		return 0, errors.New("API token cannot be empty")
	}

	endpoint := fmt.Sprintf("%s/token/playlists", cleanedURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	c.applyHeaders(req, testToken, testPassword)

	var playlists []Playlist
	if err := c.do(req, &playlists); err != nil {
		return 0, err
	}
	return len(playlists), nil
}

func (c *APIClient) newRequest(ctx context.Context, method, endpoint string, body io.Reader) (*http.Request, error) {
	u := fmt.Sprintf("%s%s", c.baseURL, endpoint)
	req, err := http.NewRequestWithContext(ctx, method, u, body)
	if err != nil {
		return nil, err
	}

	c.mu.RLock()
	token := c.apiToken
	password := c.password
	c.mu.RUnlock()

	c.applyHeaders(req, token, password)

	return req, nil
}

func (c *APIClient) do(req *http.Request, target interface{}) error {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		b, _ := io.ReadAll(resp.Body)
		bodyStr := string(b)
		statusStr := resp.Status

		isUnchanged := strings.Contains(strings.ToLower(bodyStr), "unchanged") ||
			strings.Contains(strings.ToLower(statusStr), "unchanged")

		retrySec := 2
		if h := resp.Header.Get("Retry-After"); h != "" {
			if s, err := strconv.Atoi(h); err == nil && s > 0 {
				retrySec = s
			}
		} else {
			// Try to parse JSON { "retry_after": ... }
			var jsonErr struct {
				RetryAfter int `json:"retry_after"`
			}
			if err := json.Unmarshal(b, &jsonErr); err == nil && jsonErr.RetryAfter > 0 {
				retrySec = jsonErr.RetryAfter
			}
		}
		return &RateLimitError{
			RetryAfter:  time.Duration(retrySec) * time.Second,
			Message:     bodyStr,
			IsUnchanged: isUnchanged,
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		var apiErr UpstreamAPIError
		if err := json.Unmarshal(b, &apiErr); err == nil && (apiErr.Code != "" || apiErr.UpgradeURL != "" || apiErr.Title != "" || apiErr.Body != "") {
			apiErr.StatusCode = resp.StatusCode
			apiErr.Raw = string(b)
			return &apiErr
		}
		return fmt.Errorf("api error status %d: %s", resp.StatusCode, string(b))
	}

	if target == nil {
		return nil
	}

	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		return fmt.Errorf("failed to decode response json: %w", err)
	}

	return nil
}

// doGetWithRetry executes a GET request with automatic retry on transient HTTP 429 (rate limits & concurrency limits).
// If the server returns 429 Data Unchanged, it immediately returns ErrDataUnchanged without retrying.
func (c *APIClient) doGetWithRetry(ctx context.Context, endpoint string, target interface{}) error {
	maxRetries := 3
	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := c.newRequest(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}

		err = c.do(req, target)
		if err == nil {
			return nil
		}

		// If remote reported data unchanged, do not retry! Return ErrDataUnchanged directly.
		if errors.Is(err, ErrDataUnchanged) {
			return ErrDataUnchanged
		}

		var rle *RateLimitError
		if errors.As(err, &rle) {
			if rle.IsUnchanged {
				return ErrDataUnchanged
			}
			if attempt == maxRetries {
				return fmt.Errorf("rate limit/concurrency retries exhausted for %s: %w", endpoint, err)
			}
			waitDuration := rle.RetryAfter
			if waitDuration <= 0 {
				waitDuration = 2 * time.Second
			}
			log.Printf("[CLIENT] Request to %s hit concurrency/rate limit (HTTP 429). Waiting %v before retry (attempt %d/%d)...\n",
				endpoint, waitDuration, attempt+1, maxRetries)

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(waitDuration):
				continue
			}
		}

		return err
	}
	return fmt.Errorf("retries exhausted for %s", endpoint)
}

// GetPlaylists returns all playlists accessible by the configured token.
func (c *APIClient) GetPlaylists(ctx context.Context) ([]Playlist, error) {
	var playlists []Playlist
	if err := c.doGetWithRetry(ctx, "/token/playlists", &playlists); err != nil {
		return nil, err
	}
	return playlists, nil
}

// GetCategories returns categories for a playlist (streamType: "live", "vods", "series").
func (c *APIClient) GetCategories(ctx context.Context, playlistID uint64, streamType string) ([]Category, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("type", streamType)

	var categories []Category
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/categories?%s", params.Encode()), &categories); err != nil {
		return nil, err
	}
	return categories, nil
}

// GetChannels fetches a single batch of channels starting at offset.
func (c *APIClient) GetChannels(ctx context.Context, playlistID uint64, offset int) ([]Channel, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("offset", strconv.Itoa(offset))

	var channels []Channel
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/channels?%s", params.Encode()), &channels); err != nil {
		return nil, err
	}
	return channels, nil
}

// GetAllChannels paginates through all channels for the given playlist.
func (c *APIClient) GetAllChannels(ctx context.Context, playlistID uint64, batchSize int) ([]Channel, error) {
	if batchSize <= 0 {
		batchSize = 5000
	}
	var allChannels []Channel
	offset := 0
	pacing := c.GetStreamPacingDelay()

	for {
		if offset > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		batch, err := c.GetChannels(ctx, playlistID, offset)
		if err != nil {
			if errors.Is(err, ErrDataUnchanged) {
				return nil, ErrDataUnchanged
			}
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		allChannels = append(allChannels, batch...)
		if len(batch) < batchSize {
			break
		}
		offset += len(batch)
	}

	return allChannels, nil
}

// GetVods fetches a single batch of VODs starting at offset.
func (c *APIClient) GetVods(ctx context.Context, playlistID uint64, offset int) ([]Vod, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("offset", strconv.Itoa(offset))

	var vods []Vod
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/vods?%s", params.Encode()), &vods); err != nil {
		return nil, err
	}
	return vods, nil
}

// GetAllVods paginates through all VODs for the given playlist.
func (c *APIClient) GetAllVods(ctx context.Context, playlistID uint64, batchSize int) ([]Vod, error) {
	if batchSize <= 0 {
		batchSize = 5000
	}
	var allVods []Vod
	offset := 0
	pacing := c.GetStreamPacingDelay()

	for {
		if offset > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		batch, err := c.GetVods(ctx, playlistID, offset)
		if err != nil {
			if errors.Is(err, ErrDataUnchanged) {
				return nil, ErrDataUnchanged
			}
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		allVods = append(allVods, batch...)
		if len(batch) < batchSize {
			break
		}
		offset += len(batch)
	}

	return allVods, nil
}

// GetSeries fetches a single batch of series starting at offset.
func (c *APIClient) GetSeries(ctx context.Context, playlistID uint64, offset int) ([]Series, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("offset", strconv.Itoa(offset))

	var seriesList []Series
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/series?%s", params.Encode()), &seriesList); err != nil {
		return nil, err
	}
	return seriesList, nil
}

// GetAllSeries paginates through all series for the given playlist.
func (c *APIClient) GetAllSeries(ctx context.Context, playlistID uint64, batchSize int) ([]Series, error) {
	if batchSize <= 0 {
		batchSize = 5000
	}
	var allSeries []Series
	offset := 0
	pacing := c.GetStreamPacingDelay()

	for {
		if offset > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		batch, err := c.GetSeries(ctx, playlistID, offset)
		if err != nil {
			if errors.Is(err, ErrDataUnchanged) {
				return nil, ErrDataUnchanged
			}
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		allSeries = append(allSeries, batch...)
		if len(batch) < batchSize {
			break
		}
		offset += len(batch)
	}

	return allSeries, nil
}

// GetSeriesEpisodes fetches a single batch of series episodes starting at offset.
func (c *APIClient) GetSeriesEpisodes(ctx context.Context, playlistID uint64, offset int) ([]SeriesEpisode, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("offset", strconv.Itoa(offset))

	var episodes []SeriesEpisode
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/series-episodes?%s", params.Encode()), &episodes); err != nil {
		return nil, err
	}
	return episodes, nil
}

// GetAllSeriesEpisodes paginates through all series episodes for the given playlist.
func (c *APIClient) GetAllSeriesEpisodes(ctx context.Context, playlistID uint64, batchSize int) ([]SeriesEpisode, error) {
	if batchSize <= 0 {
		batchSize = 5000
	}
	var allEpisodes []SeriesEpisode
	offset := 0
	pacing := c.GetStreamPacingDelay()

	for {
		if offset > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		batch, err := c.GetSeriesEpisodes(ctx, playlistID, offset)
		if err != nil {
			if errors.Is(err, ErrDataUnchanged) {
				return nil, ErrDataUnchanged
			}
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		allEpisodes = append(allEpisodes, batch...)
		if len(batch) < batchSize {
			break
		}
		offset += len(batch)
	}

	return allEpisodes, nil
}

// GetEPG calls POST /token/epg for the given slice of epg identifiers.
func (c *APIClient) GetEPG(ctx context.Context, epgReq EpgRequest) ([]EpgProgramme, error) {
	if len(epgReq.EpgIDs) == 0 {
		return nil, nil
	}

	payloadBytes, err := json.Marshal(epgReq)
	if err != nil {
		return nil, err
	}

	req, err := c.newRequest(ctx, http.MethodPost, "/token/epg", bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, err
	}

	var programmes []EpgProgramme
	if err := c.do(req, &programmes); err != nil {
		return nil, err
	}

	return programmes, nil
}

// GetEPGInChunks chunks the epgIDs into batches of max 100 IDs and calls GetEPG for each chunk.
// It handles rate limits (HTTP 429) automatically by waiting the requested Retry-After duration,
// and enforces a pacing delay between chunks (default 3,000ms) to strictly respect the max 20 req/min limit on /epg.
func (c *APIClient) GetEPGInChunks(ctx context.Context, epgIDs []string, days int) ([]EpgProgramme, error) {
	const chunkSize = 100
	var allProgrammes []EpgProgramme
	pacing := c.GetEpgPacingDelay()

	for i := 0; i < len(epgIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(epgIDs) {
			end = len(epgIDs)
		}

		chunk := epgIDs[i:end]
		req := EpgRequest{
			EpgIDs: chunk,
			Days:   days,
		}

		// Pacing delay to strictly respect the max 20 req/min limit on /epg (60s / 20 = 3000ms)
		if i > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		maxRetries := 3
		for attempt := 0; attempt <= maxRetries; attempt++ {
			programmes, err := c.GetEPG(ctx, req)
			if err == nil {
				allProgrammes = append(allProgrammes, programmes...)
				break
			}

			var rle *RateLimitError
			if errors.As(err, &rle) {
				if attempt == maxRetries {
					log.Printf("[CLIENT-WARN] EPG rate limit retries exhausted for chunk [%d:%d]\n", i, end)
					break
				}
				waitDuration := rle.RetryAfter
				if waitDuration <= 0 {
					waitDuration = 2 * time.Second
				}
				waitDuration += 1 * time.Second
				log.Printf("[CLIENT] EPG rate limit reached (HTTP 429). Waiting %v before retry (attempt %d/%d)...\n",
					waitDuration, attempt+1, maxRetries)

				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(waitDuration):
					continue
				}
			}

			return nil, fmt.Errorf("error fetching epg chunk [%d:%d]: %w", i, end, err)
		}
	}

	return allProgrammes, nil
}

// GetEPGStatus calls POST /token/epg/status in batches of 100 IDs.
// It returns a map of epg_id -> max available stop unix timestamp.
func (c *APIClient) GetEPGStatus(ctx context.Context, epgIDs []string) (map[string]int64, error) {
	if len(epgIDs) == 0 {
		return make(map[string]int64), nil
	}

	const chunkSize = 100
	allStatus := make(map[string]int64, len(epgIDs))

	for i := 0; i < len(epgIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(epgIDs) {
			end = len(epgIDs)
		}

		chunk := epgIDs[i:end]
		reqPayload := EpgRequest{
			EpgIDs: chunk,
		}

		payloadBytes, err := json.Marshal(reqPayload)
		if err != nil {
			return nil, err
		}

		if i > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(200 * time.Millisecond):
			}
		}

		maxRetries := 3
		for attempt := 0; attempt <= maxRetries; attempt++ {
			req, err := c.newRequest(ctx, http.MethodPost, "/token/epg/status", bytes.NewReader(payloadBytes))
			if err != nil {
				return nil, err
			}

			var chunkStatus map[string]int64
			err = c.do(req, &chunkStatus)
			if err == nil {
				for k, v := range chunkStatus {
					allStatus[k] = v
				}
				break
			}

			var rle *RateLimitError
			if errors.As(err, &rle) {
				if attempt == maxRetries {
					log.Printf("[CLIENT-WARN] EPG status rate limit retries exhausted for chunk [%d:%d]\n", i, end)
					break
				}
				waitDuration := rle.RetryAfter
				if waitDuration <= 0 {
					waitDuration = 2 * time.Second
				}
				waitDuration += 1 * time.Second
				log.Printf("[CLIENT] EPG status rate limit reached (HTTP 429). Waiting %v before retry (attempt %d/%d)...\n",
					waitDuration, attempt+1, maxRetries)

				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(waitDuration):
					continue
				}
			}

			log.Printf("[CLIENT-WARN] Failed fetching epg status chunk [%d:%d]: %v\n", i, end, err)
			return nil, err
		}
	}

	return allStatus, nil
}

// GetEpgChannels calls POST /token/epg/channels for the given slice of epg identifiers in chunks.
func (c *APIClient) GetEpgChannels(ctx context.Context, epgIDs []string) ([]EpgChannelMeta, error) {
	if len(epgIDs) == 0 {
		return nil, nil
	}

	const chunkSize = 200
	var allMeta []EpgChannelMeta

	for i := 0; i < len(epgIDs); i += chunkSize {
		end := i + chunkSize
		if end > len(epgIDs) {
			end = len(epgIDs)
		}

		chunk := epgIDs[i:end]
		payload := map[string][]string{"epg_ids": chunk}
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		if i > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(100 * time.Millisecond):
			}
		}

		maxRetries := 3
		for attempt := 0; attempt <= maxRetries; attempt++ {
			req, err := c.newRequest(ctx, http.MethodPost, "/token/epg/channels", bytes.NewReader(payloadBytes))
			if err != nil {
				return nil, err
			}

			var chunkMeta []EpgChannelMeta
			err = c.do(req, &chunkMeta)
			if err == nil {
				allMeta = append(allMeta, chunkMeta...)
				break
			}

			var rle *RateLimitError
			if errors.As(err, &rle) {
				if attempt == maxRetries {
					log.Printf("[CLIENT-WARN] EPG channels rate limit retries exhausted for chunk [%d:%d]\n", i, end)
					break
				}
				waitDuration := rle.RetryAfter
				if waitDuration <= 0 {
					waitDuration = 2 * time.Second
				}
				waitDuration += 1 * time.Second
				log.Printf("[CLIENT] EPG channels rate limit reached (HTTP 429). Waiting %v before retry (attempt %d/%d)...\n",
					waitDuration, attempt+1, maxRetries)

				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(waitDuration):
					continue
				}
			}

			log.Printf("[CLIENT-WARN] Failed fetching epg channels chunk [%d:%d]: %v\n", i, end, err)
			return nil, err
		}
	}

	return allMeta, nil
}

// GetEPGSettings calls GET /token/epg/settings and returns the hash and settings payload.
func (c *APIClient) GetEPGSettings(ctx context.Context) (*EpgSettingsResponse, error) {
	var resp EpgSettingsResponse
	if err := c.doGetWithRetry(ctx, "/token/epg/settings", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetUsers fetches a single batch of managed users starting at offset for a playlist.
func (c *APIClient) GetUsers(ctx context.Context, playlistID uint64, offset int) ([]ClientManagedUser, error) {
	params := url.Values{}
	params.Set("playlist_id", strconv.FormatUint(playlistID, 10))
	params.Set("offset", strconv.Itoa(offset))

	var users []ClientManagedUser
	if err := c.doGetWithRetry(ctx, fmt.Sprintf("/token/users?%s", params.Encode()), &users); err != nil {
		return nil, err
	}
	return users, nil
}

// GetAllUsers paginates through all managed users for the given playlist.
func (c *APIClient) GetAllUsers(ctx context.Context, playlistID uint64, batchSize ...int) ([]ClientManagedUser, error) {
	bSize := 5000
	if len(batchSize) > 0 && batchSize[0] > 0 {
		bSize = batchSize[0]
	}
	var allUsers []ClientManagedUser
	offset := 0
	pacing := c.GetStreamPacingDelay()

	for {
		if offset > 0 && pacing > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(pacing):
			}
		}

		batch, err := c.GetUsers(ctx, playlistID, offset)
		if err != nil {
			if errors.Is(err, ErrDataUnchanged) {
				return nil, ErrDataUnchanged
			}
			return nil, err
		}
		if len(batch) == 0 {
			break
		}

		allUsers = append(allUsers, batch...)
		if len(batch) < bSize {
			break
		}
		offset += len(batch)
	}

	return allUsers, nil
}
