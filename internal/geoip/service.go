package geoip

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/cache"
)

// Location holds the geolocation details for an IP address.
type Location struct {
	IP          string `json:"ip"`
	Country     string `json:"country"`
	CountryCode string `json:"country_code"`
	Region      string `json:"region"`
	City        string `json:"city"`
	Status      string `json:"status"` // "success" or "fail"
	Message     string `json:"message,omitempty"`
}

// Service handles resolving IP addresses to geographic locations with caching.
type Service struct {
	client     *http.Client
	cache      cache.Cache
	memCache   sync.Map
	apiBaseURL string
}

// NewService creates a new GeoIP service instance.
func NewService(c cache.Cache) *Service {
	return &Service{
		client: &http.Client{
			Timeout: 4 * time.Second,
		},
		cache:      c,
		apiBaseURL: "http://ip-api.com/json/",
	}
}

// SetBaseURL allows overriding the API base URL (primarily for testing).
func (s *Service) SetBaseURL(url string) {
	s.apiBaseURL = url
}

// isPrivateIP checks if an IP is a loopback, private, link-local, or unspecified address.
func isPrivateIP(parsedIP net.IP) bool {
	if parsedIP == nil {
		return false
	}
	return parsedIP.IsLoopback() ||
		parsedIP.IsPrivate() ||
		parsedIP.IsLinkLocalUnicast() ||
		parsedIP.IsLinkLocalMulticast() ||
		parsedIP.IsUnspecified()
}

type ipAPIResponse struct {
	Status      string `json:"status"`
	Message     string `json:"message"`
	Country     string `json:"country"`
	CountryCode string `json:"countryCode"`
	RegionName  string `json:"regionName"`
	City        string `json:"city"`
}

// Lookup resolves the city and country for the given IP address.
func (s *Service) Lookup(ctx context.Context, rawIP string) (*Location, error) {
	cleanIP := strings.TrimSpace(rawIP)
	if cleanIP == "" {
		return nil, fmt.Errorf("empty ip address")
	}

	parsedIP := net.ParseIP(cleanIP)
	if parsedIP == nil {
		return nil, fmt.Errorf("invalid ip address format: %s", cleanIP)
	}

	// Immediate evaluation for local, private, and RFC1918 addresses
	if isPrivateIP(parsedIP) {
		return &Location{
			IP:          cleanIP,
			Country:     "Private Network",
			CountryCode: "LAN",
			Region:      "Local",
			City:        "Local Network",
			Status:      "success",
		}, nil
	}

	cacheKey := fmt.Sprintf("geoip:%s", cleanIP)

	// 1. Check Redis cache if available
	if s.cache != nil && s.cache.IsAvailable() && s.cache.IsEnabled() {
		var cached Location
		found, err := s.cache.Get(ctx, cacheKey, &cached)
		if err == nil && found && cached.Status == "success" {
			return &cached, nil
		}
	}

	// 2. Check local in-memory fallback cache
	if val, ok := s.memCache.Load(cleanIP); ok {
		if loc, ok := val.(*Location); ok {
			return loc, nil
		}
	}

	// 3. Query external GeoIP API
	apiURL := fmt.Sprintf("%s%s?fields=status,message,country,countryCode,city,regionName", s.apiBaseURL, cleanIP)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed creating geoip request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("geoip api request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("geoip api returned http %d", resp.StatusCode)
	}

	var apiData ipAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiData); err != nil {
		return nil, fmt.Errorf("failed decoding geoip response: %w", err)
	}

	if apiData.Status != "success" {
		errMsg := apiData.Message
		if errMsg == "" {
			errMsg = "location resolution failed"
		}
		return &Location{
			IP:      cleanIP,
			Country: "Unknown",
			City:    "Unknown",
			Status:  "fail",
			Message: errMsg,
		}, nil
	}

	loc := &Location{
		IP:          cleanIP,
		Country:     apiData.Country,
		CountryCode: apiData.CountryCode,
		Region:      apiData.RegionName,
		City:        apiData.City,
		Status:      "success",
	}

	// Store in memory cache
	s.memCache.Store(cleanIP, loc)

	// Store in Redis cache (30 days TTL)
	if s.cache != nil && s.cache.IsAvailable() && s.cache.IsEnabled() {
		_ = s.cache.Set(ctx, cacheKey, loc, 30*24*time.Hour)
	}

	return loc, nil
}
