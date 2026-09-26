package models

import (
	"encoding/json"
	"net"
	"strconv"
	"strings"
	"time"
)

// Uint64Slice is a slice of uint64 that marshals as a JSON array of strings,
// preventing JavaScript 64-bit integer precision loss (which truncates integers > 2^53 - 1).
// It unmarshals from either JSON string arrays or JSON number arrays.
type Uint64Slice []uint64

func (s Uint64Slice) MarshalJSON() ([]byte, error) {
	if s == nil {
		return []byte("[]"), nil
	}
	strs := make([]string, len(s))
	for i, v := range s {
		strs[i] = strconv.FormatUint(v, 10)
	}
	return json.Marshal(strs)
}

func (s *Uint64Slice) UnmarshalJSON(data []byte) error {
	var rawItems []json.RawMessage
	if err := json.Unmarshal(data, &rawItems); err != nil {
		return err
	}
	res := make([]uint64, 0, len(rawItems))
	for _, item := range rawItems {
		var strVal string
		if err := json.Unmarshal(item, &strVal); err == nil {
			strVal = strings.TrimSpace(strVal)
			if strVal != "" {
				u, err := strconv.ParseUint(strVal, 10, 64)
				if err != nil {
					return err
				}
				res = append(res, u)
			}
			continue
		}
		var numVal uint64
		if err := json.Unmarshal(item, &numVal); err == nil {
			res = append(res, numVal)
			continue
		}
	}
	*s = res
	return nil
}

// FlexUint64 is a uint64 that marshals as a JSON string to prevent JavaScript 64-bit precision loss,
// and unmarshals flexibly from either a JSON string, a JSON number, or empty/null.
type FlexUint64 uint64

func (f FlexUint64) Uint64() uint64 {
	return uint64(f)
}

func (f FlexUint64) MarshalJSON() ([]byte, error) {
	return json.Marshal(strconv.FormatUint(uint64(f), 10))
}

func (f *FlexUint64) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" || trimmed == `""` {
		*f = 0
		return nil
	}
	var strVal string
	if err := json.Unmarshal(data, &strVal); err == nil {
		strVal = strings.TrimSpace(strVal)
		if strVal == "" || strVal == "0" {
			*f = 0
			return nil
		}
		val, err := strconv.ParseUint(strVal, 10, 64)
		if err != nil {
			return err
		}
		*f = FlexUint64(val)
		return nil
	}
	var numVal uint64
	if err := json.Unmarshal(data, &numVal); err == nil {
		*f = FlexUint64(numVal)
		return nil
	}
	return nil
}

// ManagedUser represents a customer/user managed for a playlist.
type ManagedUser struct {
	ListID             uint64          `json:"list_id,string"`
	ID                 int             `json:"id"`
	Name               string          `json:"name"`
	Expiry             *time.Time      `json:"expiry"`
	ChannelsCategories json.RawMessage `json:"channels_categories"` // null or JSON array
	VodsCategories     json.RawMessage `json:"vods_categories"`     // null or JSON array
	SeriesCategories   json.RawMessage `json:"series_categories"`   // null or JSON array
	M3U                string          `json:"m3u"`
	EPG                string          `json:"epg"`
	Username           string          `json:"username"`
	Password           string          `json:"password"`
	Patterns           json.RawMessage `json:"patterns"` // JSON array of provider patterns
	Note               *string         `json:"note"`
	Language           *string         `json:"language"`
	Message            *string         `json:"message"`
	MaxConnections     int             `json:"max_connections"`
	ActiveConnections  int             `json:"active_connections"`
	IsOnline           bool            `json:"is_online"`
	SyncExpiryDate     bool            `json:"sync_expiry_date"`
	UserSettings       json.RawMessage `json:"user_settings"`
	IsSuspended        bool            `json:"is_suspended"`
	IsCompromised      bool            `json:"is_compromised"`
	CompromisedReason  *string         `json:"compromised_reason,omitempty"`
	CompromisedAt      *time.Time      `json:"compromised_at,omitempty"`
	CreatedByAdminID   *int            `json:"created_by_admin_id,omitempty"`
	CreatedByUsername  *string         `json:"created_by_username,omitempty"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}

// Admin represents an administrator or collaborator account (Team Member).
type Admin struct {
	ID                     int         `json:"id"`
	Username               string      `json:"username"`
	PasswordHash           string      `json:"-"`
	Role                   string      `json:"role"` // "admin" or "collaborator"
	ManageAllPlaylists     bool        `json:"manage_all_playlists"`
	CanSeeAllUsers         bool        `json:"can_see_all_users"`
	CanCreateCollaborators bool        `json:"can_create_collaborators"`
	CanCreateAdmins        bool        `json:"can_create_admins"`
	CanManageAPITokens     bool        `json:"can_manage_api_tokens"`
	CreatedBy              *int        `json:"created_by,omitempty"`
	CreatedByUsername      *string     `json:"created_by_username,omitempty"`
	AllowedPlaylistIDs     Uint64Slice `json:"allowed_playlist_ids"`
	CreatedAt              time.Time   `json:"created_at"`
	UpdatedAt              time.Time   `json:"updated_at"`
}

// TeamMember is an alias for Admin representing team accounts
type TeamMember = Admin

// Playlist represents a PlaylistLabs playlist with counters.
type Playlist struct {
	ID                uint64          `json:"id,string"`
	Name              string          `json:"name"`
	Message           *string         `json:"message"`
	Language          *string         `json:"language"`
	Patterns          json.RawMessage `json:"patterns"`
	ActiveChannels    int             `json:"active_channels"`
	ActiveMovies      int             `json:"active_movies"`
	ActiveSeries      int             `json:"active_series"`
	ManagedUsersCount int             `json:"managed_users_count"`
	SyncedAt          *time.Time      `json:"synced_at"`
	LastUpdatedChannel *time.Time     `json:"last_updated_channel,omitempty"`
	LastUpdatedMovie   *time.Time     `json:"last_updated_movie,omitempty"`
	LastUpdatedSeries  *time.Time     `json:"last_updated_series,omitempty"`
	IsOrphaned        bool            `json:"is_orphaned"`
	OrphanedAt        *time.Time      `json:"orphaned_at,omitempty"`
	AllowTracking          bool            `json:"allow_tracking"`
	LimitMaxConnections    bool            `json:"limit_max_connections"`
	MaxConnections         int             `json:"max_connections"`
	TrackingTimeoutMinutes int             `json:"tracking_timeout_minutes"`
	CName                  string          `json:"cname,omitempty"`
	EnforceCname           bool            `json:"enforce_cname"`
	CnameSSL               bool            `json:"cname_ssl"`
	WelcomeInfo            json.RawMessage `json:"welcome_info,omitempty"`
	PortalBranding         json.RawMessage `json:"portal_branding,omitempty"`
}

// PlaylistPortalBranding represents per-playlist branding configuration for the user portal.
type PlaylistPortalBranding struct {
	Enabled         bool   `json:"enabled"`
	Title           string `json:"title,omitempty"`
	Logo            string `json:"logo,omitempty"`
	HTML            string `json:"html,omitempty"`
	PrimaryColor    string `json:"primary_color,omitempty"`
	SecondaryColor  string `json:"secondary_color,omitempty"`
	AccentColor     string `json:"accent_color,omitempty"`
	BackgroundTheme string `json:"background_theme,omitempty"`
}

// WelcomeWhere indicates where welcome info is displayed.
type WelcomeWhere struct {
	Channels bool `json:"channels"`
	Vods     bool `json:"vods"`
	Series   bool `json:"series"`
}

// WelcomeInfo represents the welcome info configuration.
type WelcomeInfo struct {
	Category string       `json:"category"`
	Tags     []string     `json:"tags"`
	Stream   string       `json:"stream"`
	Image    string       `json:"image"`
	Where    WelcomeWhere `json:"where"`
}

// SyncLog represents a playlist synchronization event record.
// Retention: logs are kept for maximum 1 week (7 days) from created_at.
type SyncLog struct {
	ID            uint64     `json:"id"`
	PlaylistID    *uint64    `json:"playlist_id"`
	PlaylistName  string     `json:"playlist_name"`
	SyncType      string     `json:"sync_type"` // "playlist", "all"
	Status        string     `json:"status"`    // "success", "skipped", "error"
	ChannelsCount int        `json:"channels_count"`
	MoviesCount   int        `json:"movies_count"`
	SeriesCount   int        `json:"series_count"`
	EpisodesCount int        `json:"episodes_count"`
	EpgCount      int        `json:"epg_count"`
	Message       string     `json:"message"`
	Details       string     `json:"details,omitempty"`
	DurationMs    int64      `json:"duration_ms"`
	CreatedAt     time.Time  `json:"created_at"`
}

// Category represents a channel, VOD, or series category.
type Category struct {
	ID       uint64 `json:"id"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}

// PatternItem represents an Xtream or custom provider pattern.
type PatternItem struct {
	Type    string `json:"type"`
	URL     string `json:"url"`
	OldURL  string `json:"oldUrl,omitempty"`
	CURL    string `json:"cUrl,omitempty"`
	UseCURL bool   `json:"useCUrl,omitempty"`
	Param1  string `json:"param1,omitempty"`
	Param2  string `json:"param2,omitempty"`
}

// PatternMapping defines a mapping between a source provider pattern and destination provider pattern during a user move.
type PatternMapping struct {
	SourceURL string `json:"source_url"`
	TargetURL string `json:"target_url"`
	Action    string `json:"action"` // "map" or "discard"
}

// UserExpirySyncCandidate represents a customer queued for expiry synchronization.
type UserExpirySyncCandidate struct {
	ListID         uint64          `json:"list_id"`
	ID             int             `json:"id"`
	Name           string          `json:"name"`
	Expiry         *time.Time      `json:"expiry"`
	MaxConnections int             `json:"max_connections"`
	Patterns       json.RawMessage `json:"patterns"`
}

// BulkPatternRequest defines parameters for bulk modifications on customer patterns.
type BulkPatternRequest struct {
	Action         string       `json:"action"`          // "rename_url", "remove", "add", "update_curl"
	Scope          string       `json:"scope"`           // "playlist", "selected", "all_playlists"
	UserIDs        []int        `json:"user_ids"`        // optional list of user IDs for scope="selected"
	OldURL         string       `json:"old_url"`         // used in rename_url and remove
	NewURL         string       `json:"new_url"`         // used in rename_url
	ReplaceMode    string       `json:"replace_mode"`    // "exact" (default) or "substring"
	TargetType     string       `json:"target_type"`     // optional pattern type filter (e.g. "xtream", "apollo")
	UpdatePlaylist bool         `json:"update_playlist"` // also apply changes to playlist.patterns
	UpdateCURL     bool         `json:"update_curl"`     // whether to update or replace cUrl
	CURL           string       `json:"curl"`            // for update_curl
	UseCURL        *bool        `json:"use_curl"`        // for update_curl
	NewPattern     *PatternItem `json:"new_pattern"`     // for add
}

// BulkPatternResponse holds results of bulk pattern updates.
type BulkPatternResponse struct {
	Success          bool   `json:"success"`
	AffectedUsers    int    `json:"affected_users"`
	ModifiedPatterns int    `json:"modified_patterns"`
	Message          string `json:"message"`
}

// ImportUsersResult holds metrics from importing managed users from PlaylistLabs.
type ImportUsersResult struct {
	TotalProcessed int      `json:"total_processed"`
	Imported       int      `json:"imported"`
	Updated        int      `json:"updated"`
	Skipped        int      `json:"skipped"`
	Errors         []string `json:"errors,omitempty"`
}

// APIToken represents an internal API access token for third-party application integration.
type APIToken struct {
	ID           uint64     `json:"id"`
	AdminID      int        `json:"admin_id"`
	Name         string     `json:"name"`
	TokenPrefix  string     `json:"token_prefix"`
	Token        string     `json:"token,omitempty"` // Plaintext token returned only upon creation
	HasPassword  bool       `json:"has_password"`
	PasswordHash string     `json:"-"`
	AllowedIPs         string      `json:"allowed_ips,omitempty"`          // Optional comma-separated allowed IPs or CIDRs
	AllowedPlaylistIDs Uint64Slice `json:"allowed_playlist_ids,omitempty"` // Optional restricted playlist IDs
	LastUsedAt         *time.Time  `json:"last_used_at"`
	ExpiresAt          *time.Time  `json:"expires_at"`
	IsActive           bool        `json:"is_active"`
	CreatedAt          time.Time   `json:"created_at"`
	UpdatedAt          time.Time   `json:"updated_at"`
}

// HasPlaylistAccess checks if a token is authorized to operate on a given playlist.
// If AllowedPlaylistIDs is empty, the token has not restricted playlists (scope relies on owner).
func (t *APIToken) HasPlaylistAccess(listID uint64) bool {
	if t == nil || len(t.AllowedPlaylistIDs) == 0 {
		return true
	}
	for _, pid := range t.AllowedPlaylistIDs {
		if pid == listID {
			return true
		}
	}
	return false
}

// IsIPAllowed checks if a given IP address is allowed to use this token.
// If AllowedIPs is empty or whitespace, access is permitted from any IP.
func (t *APIToken) IsIPAllowed(clientIP string) bool {
	if t == nil || strings.TrimSpace(t.AllowedIPs) == "" {
		return true
	}
	cleanIP := strings.TrimSpace(clientIP)
	if cleanIP == "" {
		return false
	}
	parsedClientIP := net.ParseIP(cleanIP)
	if parsedClientIP == nil {
		return false
	}

	tokens := strings.FieldsFunc(t.AllowedIPs, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r' || r == ' ' || r == '\t'
	})

	for _, token := range tokens {
		item := strings.TrimSpace(token)
		if item == "" {
			continue
		}
		// 1. Check CIDR block
		if strings.Contains(item, "/") {
			_, ipNet, err := net.ParseCIDR(item)
			if err == nil && ipNet != nil && ipNet.Contains(parsedClientIP) {
				return true
			}
			continue
		}
		// 2. Exact IP check
		ruleIP := net.ParseIP(item)
		if ruleIP != nil && ruleIP.Equal(parsedClientIP) {
			return true
		}
	}

	return false
}




