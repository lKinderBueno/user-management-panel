package usersyncer

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// XtreamCustomerInfo holds extracted details from Xtream player_api.php.
type XtreamCustomerInfo struct {
	Expiry         time.Time
	MaxConnections int
	Updated        bool
}

// XtreamClient provides minimal, robust Xtream Codes API querying.
type XtreamClient struct {
	httpClient *http.Client
	timeout    time.Duration
}

// NewXtreamClient creates a client with the specified request timeout.
func NewXtreamClient(timeout time.Duration) *XtreamClient {
	if timeout <= 0 {
		timeout = 7 * time.Second
	}
	return &XtreamClient{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		timeout: timeout,
	}
}

// CleanXtreamURL normalizes a provider URL:
// - trims whitespace and trailing slashes
// - guarantees http:// or https:// scheme
// - strips redundant :80 / :443 ports
func CleanXtreamURL(rawURL string) string {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return ""
	}
	trimmed = strings.TrimRight(trimmed, "/")

	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		trimmed = "http://" + trimmed
	}

	u, err := url.Parse(trimmed)
	if err == nil {
		host := u.Hostname()
		port := u.Port()
		if (port == "80" && u.Scheme == "http") || (port == "443" && u.Scheme == "https") {
			u.Host = host
			trimmed = strings.TrimRight(u.String(), "/")
		}
	}

	return trimmed
}

type xtreamRawResponse struct {
	UserInfo struct {
		Auth           any `json:"auth"`
		ExpDate        any `json:"exp_date"`
		MaxConnections any `json:"max_connections"`
		Status         any `json:"status"`
	} `json:"user_info"`
	ServerInfo struct {
		TimeNow any `json:"time_now"`
	} `json:"server_info"`
}

// ParseXtreamResponse parses raw JSON bytes from player_api.php and extracts expiration date & max connections.
func ParseXtreamResponse(body []byte) (*XtreamCustomerInfo, error) {
	var raw xtreamRawResponse
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("invalid json response from provider: %w", err)
	}

	if !isAuthSuccessful(raw.UserInfo.Auth) {
		return nil, fmt.Errorf("authentication failed (auth=%v)", raw.UserInfo.Auth)
	}

	expiry := parseExpiry(raw.UserInfo.ExpDate)
	maxConn := parseMaxConnections(raw.UserInfo.MaxConnections)

	return &XtreamCustomerInfo{
		Expiry:         expiry,
		MaxConnections: maxConn,
		Updated:        true,
	}, nil
}

// FetchUserInfo calls player_api.php and extracts expiration date & max connections.
func (c *XtreamClient) FetchUserInfo(ctx context.Context, baseURL, username, password string) (*XtreamCustomerInfo, error) {
	cleanURL := CleanXtreamURL(baseURL)
	if cleanURL == "" {
		return nil, fmt.Errorf("empty or invalid provider URL")
	}

	endpoint := fmt.Sprintf("%s/player_api.php?username=%s&password=%s",
		cleanURL,
		url.QueryEscape(username),
		url.QueryEscape(password),
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed creating HTTP request: %w", err)
	}
	req.Header.Set("User-Agent", "IPTVSync/1.0 (Mozilla/5.0 compatible)")
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error status %d", resp.StatusCode)
	}

	// Limit reading to 2MB to guard against rogue responses
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed reading response body: %w", err)
	}

	return ParseXtreamResponse(body)
}

// isAuthSuccessful checks if auth represents 1 (number, string, or boolean)
func isAuthSuccessful(val any) bool {
	if val == nil {
		return false
	}
	switch v := val.(type) {
	case float64:
		return int(v) == 1
	case int:
		return v == 1
	case int64:
		return v == 1
	case string:
		vTrim := strings.TrimSpace(v)
		return vTrim == "1" || strings.EqualFold(vTrim, "true")
	case bool:
		return v
	default:
		return false
	}
}

// parseExpiry parses exp_date unix timestamp. If null, 0, or invalid, falls back to 1 year from now.
func parseExpiry(val any) time.Time {
	fallback := time.Now().AddDate(1, 0, 0).UTC().Truncate(time.Second)

	if val == nil {
		return fallback
	}

	var sec int64
	switch v := val.(type) {
	case float64:
		sec = int64(v)
	case int:
		sec = int64(v)
	case int64:
		sec = v
	case string:
		vTrim := strings.TrimSpace(v)
		if vTrim == "" || strings.EqualFold(vTrim, "null") || vTrim == "0" {
			return fallback
		}
		parsed, err := strconv.ParseInt(vTrim, 10, 64)
		if err != nil || parsed <= 0 {
			return fallback
		}
		sec = parsed
	default:
		return fallback
	}

	if sec <= 0 {
		return fallback
	}

	return time.Unix(sec, 0).UTC()
}

// parseMaxConnections extracts max_connections, defaulting to 1
func parseMaxConnections(val any) int {
	if val == nil {
		return 1
	}

	switch v := val.(type) {
	case float64:
		if int(v) > 0 {
			return int(v)
		}
	case int:
		if v > 0 {
			return v
		}
	case int64:
		if v > 0 {
			return int(v)
		}
	case string:
		vTrim := strings.TrimSpace(v)
		if parsed, err := strconv.Atoi(vTrim); err == nil && parsed > 0 {
			return parsed
		}
	}
	return 1
}
