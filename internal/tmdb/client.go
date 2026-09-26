package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Client handles HTTP interactions with The Movie Database (TMDB) API.
type Client struct {
	mu         sync.RWMutex
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new TMDB client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:  strings.TrimSpace(apiKey),
		baseURL: "https://api.themoviedb.org/3",
		httpClient: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

// SetAPIKey dynamically updates the TMDB API key in memory in a thread-safe manner.
func (c *Client) SetAPIKey(apiKey string) {
	if c == nil {
		return
	}
	c.mu.Lock()
	c.apiKey = strings.TrimSpace(apiKey)
	c.mu.Unlock()
}

// GetAPIKey returns the currently configured TMDB API key in a thread-safe manner.
func (c *Client) GetAPIKey() string {
	if c == nil {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.apiKey
}

// HasAPIKey returns true if a non-empty API key is configured.
func (c *Client) HasAPIKey() bool {
	return c != nil && c.GetAPIKey() != ""
}

// ValidateKey verifies whether the given key (or the configured one if empty) is valid on TMDB.
func (c *Client) ValidateKey(ctx context.Context, apiKey string) error {
	key := strings.TrimSpace(apiKey)
	if key == "" {
		key = c.GetAPIKey()
	}
	if key == "" {
		return errors.New("TMDB API key cannot be empty")
	}

	baseURL := "https://api.themoviedb.org/3"
	if c != nil && c.baseURL != "" {
		baseURL = c.baseURL
	}

	endpoint := fmt.Sprintf("%s/authentication?api_key=%s", baseURL, url.QueryEscape(key))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}

	client := http.DefaultClient
	if c != nil && c.httpClient != nil {
		client = c.httpClient
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("network error verifying TMDB key: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}

	var errResp struct {
		StatusCode    int    `json:"status_code"`
		StatusMessage string `json:"status_message"`
		Success       bool   `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil && errResp.StatusMessage != "" {
		return fmt.Errorf("TMDB authentication failed: %s (status code %d)", errResp.StatusMessage, errResp.StatusCode)
	}

	return fmt.Errorf("TMDB authentication failed with HTTP %d", resp.StatusCode)
}

// SetBaseURL overrides the default TMDB API base URL (useful for testing).
func (c *Client) SetBaseURL(u string) {
	if c != nil {
		c.baseURL = u
	}
}

// GetMovie fetches detailed movie data including images, credits, videos, and translations.
func (c *Client) GetMovie(ctx context.Context, tmdbID int, lang string) (*MovieResponse, error) {
	if !c.HasAPIKey() {
		return nil, errors.New("TMDB API key not configured")
	}
	if tmdbID <= 0 {
		return nil, errors.New("invalid TMDB ID")
	}

	langCode := "en"
	if lang != "" {
		langCode = strings.ToLower(strings.Split(lang, "-")[0])
	}
	imgLang := fmt.Sprintf("%s,en,null", langCode)

	endpoint := fmt.Sprintf("%s/movie/%d?api_key=%s&include_image_language=%s&append_to_response=images,credits,videos,translations",
		c.baseURL, tmdbID, c.GetAPIKey(), imgLang)
	if lang != "" {
		endpoint += fmt.Sprintf("&language=%s", url.QueryEscape(strings.ToLower(lang)))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed TMDB movie request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("TMDB movie returned status %d", resp.StatusCode)
	}

	var movie MovieResponse
	if err := json.NewDecoder(resp.Body).Decode(&movie); err != nil {
		return nil, fmt.Errorf("failed decoding TMDB movie response: %w", err)
	}

	if movie.Success != nil && !*movie.Success {
		return nil, fmt.Errorf("TMDB movie failed: %v", movie.StatusMessage)
	}

	return &movie, nil
}

// SearchMovie searches for a movie by name and optional year. Returns the best matching TMDB ID.
func (c *Client) SearchMovie(ctx context.Context, query string, year string, lang string) (int, error) {
	if !c.HasAPIKey() {
		return 0, errors.New("TMDB API key not configured")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return 0, errors.New("empty search query")
	}

	endpoint := fmt.Sprintf("%s/search/movie?api_key=%s&query=%s&include_adult=true",
		c.baseURL, c.GetAPIKey(), url.QueryEscape(query))
	if year != "" {
		endpoint += fmt.Sprintf("&year=%s", url.QueryEscape(year))
	}
	if lang != "" {
		endpoint += fmt.Sprintf("&language=%s", url.QueryEscape(strings.ToLower(lang)))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed TMDB search request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("TMDB search returned status %d", resp.StatusCode)
	}

	var searchResp SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return 0, fmt.Errorf("failed decoding TMDB search response: %w", err)
	}

	if len(searchResp.Results) == 0 {
		return 0, errors.New("no TMDB results found")
	}

	return searchResp.Results[0].ID, nil
}

// GetTV fetches detailed TV show data and its seasons in chunks of up to 16 seasons.
func (c *Client) GetTV(ctx context.Context, tmdbID int, lang string, seasons []int) (*TVResponse, map[int]*TVSeason, error) {
	if !c.HasAPIKey() {
		return nil, nil, errors.New("TMDB API key not configured")
	}
	if tmdbID <= 0 {
		return nil, nil, errors.New("invalid TMDB ID")
	}

	langCode := "en"
	if lang != "" {
		langCode = strings.ToLower(strings.Split(lang, "-")[0])
	}
	imgLang := fmt.Sprintf("%s,en,null", langCode)

	var mainTV *TVResponse
	seasonsMap := make(map[int]*TVSeason)

	// If no seasons requested, perform a single base call
	if len(seasons) == 0 {
		endpoint := fmt.Sprintf("%s/tv/%d?api_key=%s&include_image_language=%s&append_to_response=images,credits,videos,translations",
			c.baseURL, tmdbID, c.GetAPIKey(), imgLang)
		if lang != "" {
			endpoint += fmt.Sprintf("&language=%s", url.QueryEscape(strings.ToLower(lang)))
		}

		tv, rawMap, err := c.fetchTVEndpoint(ctx, endpoint)
		if err != nil {
			return nil, nil, err
		}
		c.parseSeasons(rawMap, seasonsMap)
		return tv, seasonsMap, nil
	}

	// Chunk seasons in batches of 16 (TMDB limit on append_to_response)
	for i := 0; i < len(seasons); i += 16 {
		end := i + 16
		if end > len(seasons) {
			end = len(seasons)
		}
		chunk := seasons[i:end]

		seasonAppends := make([]string, len(chunk))
		for idx, s := range chunk {
			seasonAppends[idx] = fmt.Sprintf("season/%d", s)
		}
		appendStr := "images,credits,videos,translations," + strings.Join(seasonAppends, ",")

		endpoint := fmt.Sprintf("%s/tv/%d?api_key=%s&include_image_language=%s&append_to_response=%s",
			c.baseURL, tmdbID, c.GetAPIKey(), imgLang, appendStr)
		if lang != "" {
			endpoint += fmt.Sprintf("&language=%s", url.QueryEscape(strings.ToLower(lang)))
		}

		tv, rawMap, err := c.fetchTVEndpoint(ctx, endpoint)
		if err != nil {
			if mainTV != nil {
				// We already have main TV data from previous chunk, continue with what we have
				continue
			}
			return nil, nil, err
		}

		if mainTV == nil {
			mainTV = tv
		}
		c.parseSeasons(rawMap, seasonsMap)
	}

	return mainTV, seasonsMap, nil
}

func (c *Client) fetchTVEndpoint(ctx context.Context, endpoint string) (*TVResponse, map[string]json.RawMessage, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("failed TMDB TV request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("TMDB TV returned status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed reading TMDB TV body: %w", err)
	}

	var tv TVResponse
	if err := json.Unmarshal(bodyBytes, &tv); err != nil {
		return nil, nil, fmt.Errorf("failed unmarshaling TMDB TV response: %w", err)
	}

	if tv.Success != nil && !*tv.Success {
		return nil, nil, fmt.Errorf("TMDB TV failed: %v", tv.StatusMessage)
	}

	var rawMap map[string]json.RawMessage
	_ = json.Unmarshal(bodyBytes, &rawMap)

	return &tv, rawMap, nil
}

func (c *Client) parseSeasons(rawMap map[string]json.RawMessage, seasonsMap map[int]*TVSeason) {
	for k, v := range rawMap {
		if strings.HasPrefix(k, "season/") {
			numStr := strings.TrimPrefix(k, "season/")
			if sNum, err := strconv.Atoi(numStr); err == nil {
				var s TVSeason
				if err := json.Unmarshal(v, &s); err == nil {
					seasonsMap[sNum] = &s
				}
			}
		}
	}
}

// SearchTV searches for a TV show by name. Returns the best matching TMDB ID.
func (c *Client) SearchTV(ctx context.Context, query string, lang string) (int, error) {
	if !c.HasAPIKey() {
		return 0, errors.New("TMDB API key not configured")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return 0, errors.New("empty TV search query")
	}

	endpoint := fmt.Sprintf("%s/search/tv?api_key=%s&query=%s&include_adult=true",
		c.baseURL, c.GetAPIKey(), url.QueryEscape(query))
	if lang != "" {
		endpoint += fmt.Sprintf("&language=%s", url.QueryEscape(strings.ToLower(lang)))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed TMDB TV search request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("TMDB TV search returned status %d", resp.StatusCode)
	}

	var searchResp SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return 0, fmt.Errorf("failed decoding TMDB TV search response: %w", err)
	}

	if len(searchResp.Results) == 0 {
		return 0, errors.New("no TMDB TV results found")
	}

	return searchResp.Results[0].ID, nil
}
