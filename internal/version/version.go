package version

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// Version is injected during compilation via -ldflags:
	// -ldflags="-s -w -X 'playlistlabs_user_management_os/internal/version.Version=1.0.6'"
	Version = "1.0.6"

	// BuildDate is optionally injected at build time.
	BuildDate = ""

	// GitCommit is optionally injected at build time.
	GitCommit = ""
)

const (
	ChangelogURL          = "https://guide-ump.playlistlabs.io/changelog/"
	DefaultContainerImage = "lkinderbueno/user-management-dashboard"
	DefaultPackageOwner   = "lKinderBueno"
	DefaultPackageName    = "user-management-dashboard"
	DefaultRepo           = "lkinderbueno/playlistlabs_user_management_oss_dev"
	DefaultTimeout        = 5 * time.Second
	CacheTTL              = 1 * time.Hour
)

// Info holds version details, update status, and changelog link.
type Info struct {
	Version         string    `json:"version"`
	LatestVersion   string    `json:"latest_version"`
	UpdateAvailable bool      `json:"update_available"`
	ChangelogURL    string    `json:"changelog_url"`
	BuildDate       string    `json:"build_date,omitempty"`
	GitCommit       string    `json:"git_commit,omitempty"`
	CheckedAt       time.Time `json:"checked_at"`
}

// GetVersion returns the effective version, prioritizing the APP_VERSION environment variable if set and not "latest".
func GetVersion() string {
	if envVer := os.Getenv("APP_VERSION"); strings.TrimSpace(envVer) != "" && !strings.EqualFold(strings.TrimSpace(envVer), "latest") {
		return cleanVersion(envVer)
	}
	if Version != "" && !strings.EqualFold(strings.TrimSpace(Version), "latest") {
		return cleanVersion(Version)
	}
	return "1.0.6"
}

func cleanVersion(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	return v
}

// IsNewer reports whether remoteVersion is strictly newer than currentVersion.
func IsNewer(currentVersion, remoteVersion string) bool {
	if strings.TrimSpace(currentVersion) == "" || strings.TrimSpace(remoteVersion) == "" {
		return false
	}
	if strings.EqualFold(strings.TrimSpace(currentVersion), "latest") {
		return false
	}
	cParts, cPre := parseSemver(currentVersion)
	rParts, rPre := parseSemver(remoteVersion)

	if len(cParts) == 0 || len(rParts) == 0 {
		return false
	}

	maxLen := len(cParts)
	if len(rParts) > maxLen {
		maxLen = len(rParts)
	}

	for i := 0; i < maxLen; i++ {
		cVal, rVal := 0, 0
		if i < len(cParts) {
			cVal = cParts[i]
		}
		if i < len(rParts) {
			rVal = rParts[i]
		}
		if rVal > cVal {
			return true
		}
		if rVal < cVal {
			return false
		}
	}

	// If numeric parts are identical, a release without prerelease is newer than one with prerelease.
	if cPre != "" && rPre == "" {
		return true
	}

	return false
}

func parseSemver(v string) ([]int, string) {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")

	if strings.EqualFold(v, "dev") {
		return []int{0, 0, 0}, "dev"
	}
	if v == "" || strings.EqualFold(v, "latest") {
		return nil, ""
	}

	var pre string
	if idx := strings.Index(v, "-"); idx != -1 {
		pre = v[idx+1:]
		v = v[:idx]
	}

	parts := strings.Split(v, ".")
	if len(parts) < 2 {
		return nil, ""
	}

	nums := make([]int, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil, ""
		}
		nums = append(nums, n)
	}

	for len(nums) < 3 {
		nums = append(nums, 0)
	}
	return nums, pre
}

func findHighestSemver(tags []string) string {
	var highest string
	for _, tag := range tags {
		tag = cleanVersion(tag)
		parts, _ := parseSemver(tag)
		if len(parts) == 0 {
			continue
		}
		if highest == "" || IsNewer(highest, tag) {
			highest = tag
		}
	}
	return highest
}

// Checker manages cached checks for new dashboard releases.
type Checker struct {
	mu         sync.RWMutex
	cachedInfo Info
	lastCheck  time.Time
	httpClient *http.Client
	repo       string
	customURL  string
}

// NewChecker creates a new update Checker.
func NewChecker(repo string) *Checker {
	return &Checker{
		httpClient: &http.Client{Timeout: DefaultTimeout},
		repo:       repo,
	}
}

// SetCustomURL overrides the update endpoint (useful for tests or custom mirror).
func (c *Checker) SetCustomURL(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.customURL = url
}

// GetInfo returns the currently known version info without blocking for network checks.
func (c *Checker) GetInfo() Info {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cur := GetVersion()
	if c.cachedInfo.Version == "" {
		return Info{
			Version:         cur,
			LatestVersion:   cur,
			UpdateAvailable: false,
			ChangelogURL:    ChangelogURL,
			BuildDate:       BuildDate,
			GitCommit:       GitCommit,
			CheckedAt:       time.Now().UTC(),
		}
	}
	info := c.cachedInfo
	info.Version = cur
	info.UpdateAvailable = IsNewer(cur, info.LatestVersion)
	return info
}

// Check checks for available updates. When force is false, it returns cached info if within CacheTTL.
func (c *Checker) Check(ctx context.Context, force bool) Info {
	cur := GetVersion()

	// 1. Environment variable override (handy for testing or air-gapped environments)
	if testOverride := os.Getenv("UPDATE_LATEST_VERSION"); strings.TrimSpace(testOverride) != "" {
		latest := cleanVersion(testOverride)
		return Info{
			Version:         cur,
			LatestVersion:   latest,
			UpdateAvailable: IsNewer(cur, latest),
			ChangelogURL:    ChangelogURL,
			BuildDate:       BuildDate,
			GitCommit:       GitCommit,
			CheckedAt:       time.Now().UTC(),
		}
	}

	c.mu.RLock()
	if !force && time.Since(c.lastCheck) < CacheTTL && c.cachedInfo.LatestVersion != "" {
		info := c.cachedInfo
		c.mu.RUnlock()
		info.Version = cur
		info.UpdateAvailable = IsNewer(cur, info.LatestVersion)
		return info
	}
	c.mu.RUnlock()

	// 2. Fetch latest version from remote repository
	latestVer, err := c.fetchRemoteVersion(ctx)
	now := time.Now().UTC()

	c.mu.Lock()
	defer c.mu.Unlock()

	if err != nil || latestVer == "" {
		// If fetch failed, return existing cached info if available, otherwise fallback
		if c.cachedInfo.LatestVersion != "" {
			info := c.cachedInfo
			info.Version = cur
			info.UpdateAvailable = IsNewer(cur, info.LatestVersion)
			return info
		}
		c.cachedInfo = Info{
			Version:         cur,
			LatestVersion:   cur,
			UpdateAvailable: false,
			ChangelogURL:    ChangelogURL,
			BuildDate:       BuildDate,
			GitCommit:       GitCommit,
			CheckedAt:       now,
		}
		c.lastCheck = now
		return c.cachedInfo
	}

	cleanLatest := cleanVersion(latestVer)
	c.cachedInfo = Info{
		Version:         cur,
		LatestVersion:   cleanLatest,
		UpdateAvailable: IsNewer(cur, cleanLatest),
		ChangelogURL:    ChangelogURL,
		BuildDate:       BuildDate,
		GitCommit:       GitCommit,
		CheckedAt:       now,
	}
	c.lastCheck = now
	return c.cachedInfo
}

func (c *Checker) fetchRemoteVersion(ctx context.Context) (string, error) {
	// 1. Check custom endpoint first if specified
	targetURL := c.customURL
	if targetURL == "" {
		targetURL = os.Getenv("UPDATE_CHECK_URL")
	}

	if targetURL != "" {
		return c.fetchFromURL(ctx, targetURL)
	}

	// 2. Fetch from GHCR (GitHub Container Registry) tags
	image := os.Getenv("GHCR_IMAGE")
	if image == "" {
		image = os.Getenv("CONTAINER_IMAGE")
	}
	if image == "" {
		image = DefaultContainerImage
	}
	if ver, err := c.fetchFromGHCR(ctx, image); err == nil && ver != "" {
		return ver, nil
	}

	// 3. Fallback to GitHub Package web page
	if ver, err := c.fetchFromPackagePage(ctx, DefaultPackageOwner, DefaultPackageName); err == nil && ver != "" {
		return ver, nil
	}

	// 4. Fallback to GitHub Releases/Tags API
	repo := c.repo
	if repo == "" {
		repo = DefaultRepo
	}

	releaseURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)
	ver, err := c.fetchFromGitHubRelease(ctx, releaseURL)
	if err == nil && ver != "" {
		return ver, nil
	}

	tagsURL := fmt.Sprintf("https://api.github.com/repos/%s/tags?per_page=1", repo)
	return c.fetchFromGitHubTags(ctx, tagsURL)
}

type ghcrTokenResponse struct {
	Token string `json:"token"`
}

type ghcrTagsResponse struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

func (c *Checker) fetchFromGHCR(ctx context.Context, image string) (string, error) {
	if image == "" {
		image = DefaultContainerImage
	}

	tokenURL := fmt.Sprintf("https://ghcr.io/token?service=ghcr.io&scope=repository:%s:pull", image)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, tokenURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ghcr token endpoint returned %d", resp.StatusCode)
	}

	var tokenData ghcrTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenData); err != nil {
		return "", err
	}
	if tokenData.Token == "" {
		return "", fmt.Errorf("no token in ghcr response")
	}

	tagsURL := fmt.Sprintf("https://ghcr.io/v2/%s/tags/list", image)
	tagsReq, err := http.NewRequestWithContext(ctx, http.MethodGet, tagsURL, nil)
	if err != nil {
		return "", err
	}
	tagsReq.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))
	tagsReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", tokenData.Token))

	tagsResp, err := c.httpClient.Do(tagsReq)
	if err != nil {
		return "", err
	}
	defer tagsResp.Body.Close()

	if tagsResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ghcr tags endpoint returned %d", tagsResp.StatusCode)
	}

	var tagsData ghcrTagsResponse
	if err := json.NewDecoder(tagsResp.Body).Decode(&tagsData); err != nil {
		return "", err
	}

	highest := findHighestSemver(tagsData.Tags)
	if highest == "" {
		return "", fmt.Errorf("no valid semver tags found in ghcr")
	}
	return highest, nil
}

func (c *Checker) fetchFromPackagePage(ctx context.Context, owner, pkg string) (string, error) {
	if owner == "" {
		owner = DefaultPackageOwner
	}
	if pkg == "" {
		pkg = DefaultPackageName
	}

	pageURL := fmt.Sprintf("https://github.com/users/%s/packages/container/package/%s", owner, pkg)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pageURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("package page returned status %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	if err != nil {
		return "", err
	}
	htmlStr := string(bodyBytes)

	re := regexp.MustCompile(`docker pull ghcr\.io/[^:]+:([0-9]+\.[0-9]+(?:\.[0-9]+)?)`)
	matches := re.FindStringSubmatch(htmlStr)
	if len(matches) > 1 {
		return matches[1], nil
	}

	reTag := regexp.MustCompile(`tag=([0-9]+\.[0-9]+(?:\.[0-9]+)?)`)
	tagMatches := reTag.FindStringSubmatch(htmlStr)
	if len(tagMatches) > 1 {
		return tagMatches[1], nil
	}

	return "", fmt.Errorf("could not extract version from package page")
}

func (c *Checker) fetchFromGitHubRelease(ctx context.Context, apiURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var data struct {
		TagName string `json:"tag_name"`
		Name    string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return "", err
	}

	if data.TagName != "" {
		return data.TagName, nil
	}
	return data.Name, nil
}

func (c *Checker) fetchFromGitHubTags(ctx context.Context, apiURL string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var tags []struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tags); err != nil {
		return "", err
	}

	if len(tags) > 0 && tags[0].Name != "" {
		return tags[0].Name, nil
	}
	return "", fmt.Errorf("no tags found")
}

func (c *Checker) fetchFromURL(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", fmt.Sprintf("PlaylistLabs-UMP/%s", GetVersion()))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	var data struct {
		Version string `json:"version"`
		TagName string `json:"tag_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
		if data.Version != "" {
			return data.Version, nil
		}
		if data.TagName != "" {
			return data.TagName, nil
		}
	}
	return "", fmt.Errorf("failed parsing version payload")
}

var defaultChecker = NewChecker(DefaultRepo)

// CheckUpdate checks for available updates using the default checker.
func CheckUpdate(ctx context.Context, force bool) Info {
	return defaultChecker.Check(ctx, force)
}

// GetInfo returns the currently known version info without blocking for network calls.
func GetInfo() Info {
	return defaultChecker.GetInfo()
}
