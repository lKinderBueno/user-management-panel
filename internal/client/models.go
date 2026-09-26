package client

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// FlexibleID parses unsigned 64-bit integers (e.g. snowflake IDs up to 2^64-1) from both numbers and strings.
// If the value is negative (like "-1" for default category), it returns 0.
type FlexibleID uint64

func (f *FlexibleID) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	if strings.HasPrefix(s, "-") {
		*f = 0
		return nil
	}
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return err
	}
	*f = FlexibleID(n)
	return nil
}

func (f FlexibleID) Uint64() uint64 {
	return uint64(f)
}

// FlexibleInt parses int from both JSON numbers and JSON strings.
type FlexibleInt int

func (f *FlexibleInt) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return err
	}
	*f = FlexibleInt(n)
	return nil
}

func (f FlexibleInt) Int() int {
	return int(f)
}

// FlexibleFloat64 parses float64 from both JSON numbers and JSON strings.
type FlexibleFloat64 float64

func (f *FlexibleFloat64) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	val, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return err
	}
	*f = FlexibleFloat64(val)
	return nil
}

func (f FlexibleFloat64) Float64() float64 {
	return float64(f)
}

// FlexibleBool parses boolean from true/false, "true"/"false", 1/0, "1"/"0".
type FlexibleBool bool

func (f *FlexibleBool) UnmarshalJSON(b []byte) error {
	s := strings.ToLower(strings.Trim(string(b), `"`))
	if s == "1" || s == "true" {
		*f = true
		return nil
	}
	*f = false
	return nil
}

func (f FlexibleBool) Bool() bool {
	return bool(f)
}

// FlexibleTime handles time parsing from multiple JSON formats (RFC3339, YYYY-MM-DD HH:MM:SS, Unix timestamp).
type FlexibleTime struct {
	time.Time
	Valid bool
}

func (ft *FlexibleTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		ft.Valid = false
		return nil
	}

	// Try parsing numeric unix timestamp (e.g. 1715342400 or 1715342400.0)
	if sec, err := strconv.ParseFloat(s, 64); err == nil && len(s) > 8 {
		ft.Time = time.Unix(int64(sec), int64((sec-float64(int64(sec)))*1e9))
		ft.Valid = true
		return nil
	}

	formats := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02T15:04:05.000Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, layout := range formats {
		if t, err := time.Parse(layout, s); err == nil {
			ft.Time = t
			ft.Valid = true
			return nil
		}
	}

	return fmt.Errorf("cannot parse time: %s", s)
}

func (ft FlexibleTime) MarshalJSON() ([]byte, error) {
	if !ft.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ft.Time.Format(time.RFC3339))
}

// ToTimePtr returns a pointer to time.Time if Valid, otherwise nil.
func (ft FlexibleTime) ToTimePtr() *time.Time {
	if !ft.Valid {
		return nil
	}
	return &ft.Time
}

// Playlist represents a playlist returned by /token/playlists
type Playlist struct {
	ID                   FlexibleID      `json:"id"`
	Name                 string          `json:"name"`
	Position             FlexibleInt     `json:"position"`
	Message              *string         `json:"message"`
	Language             *string         `json:"language"`
	UseProviderMovieInfo FlexibleBool    `json:"use_provider_movie_info"`
	EpgDays              FlexibleInt     `json:"epg_days"`
	TvgID                FlexibleBool    `json:"tvg_id"`
	Gzip                 FlexibleBool    `json:"gzip"`
	EpgDummy             *string         `json:"epg_dummy"`
	MaxConnections       FlexibleInt     `json:"max_connections"`
	LimitMaxConnections  FlexibleBool    `json:"limit_max_connections"`
	AllowTracking        FlexibleBool    `json:"allow_tracking"`
	TimeShift            FlexibleFloat64 `json:"time_shift"`
	Patterns             json.RawMessage `json:"patterns"`
	WelcomeInfo          json.RawMessage `json:"welcome_info"`
	Cname                *string         `json:"cname"`
	Expiry               FlexibleTime    `json:"expiry"`
	Logo                 *string         `json:"logo"`
	Color                *string         `json:"color"`
	LastUpdatedChannel   FlexibleTime    `json:"last_updated_channel"`
	LastUpdatedMovie     FlexibleTime    `json:"last_updated_movie"`
	LastUpdatedSeries    FlexibleTime    `json:"last_updated_series"`
	ActiveChannels       FlexibleInt     `json:"active_channels"`
	ActiveMovies         FlexibleInt     `json:"active_movies"`
	ActiveVod            FlexibleInt     `json:"active_vod"`
	ActiveSeries         FlexibleInt     `json:"active_series"`
}

// GetActiveMovies returns ActiveMovies or falls back to ActiveVod.
func (p Playlist) GetActiveMovies() int {
	if p.ActiveMovies.Int() > 0 {
		return p.ActiveMovies.Int()
	}
	return p.ActiveVod.Int()
}

// Category represents a category returned by /token/categories
type Category struct {
	ID       FlexibleID  `json:"id"`
	Position FlexibleInt `json:"position"`
	Name     string      `json:"name"`
}

// Channel represents a live channel stream returned by /token/channels
type Channel struct {
	ID          FlexibleID      `json:"id"`
	Position    FlexibleInt     `json:"position"`
	Name        string          `json:"name"`
	Epg         *string         `json:"epg"`
	Shift       FlexibleFloat64 `json:"shift"`
	Number      FlexibleInt     `json:"number"`
	Image       *string         `json:"image"`
	Category    FlexibleID      `json:"category"`
	Url         string          `json:"url"`
	Catchup     FlexibleInt     `json:"catchup"`
	IsTypeMoved FlexibleBool    `json:"is_type_moved"`
}

// Vod represents a video-on-demand stream returned by /token/vods
type Vod struct {
	ID          FlexibleID       `json:"id"`
	Position    FlexibleInt      `json:"position"`
	Name        string           `json:"name"`
	Image       *string          `json:"image"`
	Tmdb        *FlexibleInt     `json:"tmdb"`
	Rating      *FlexibleFloat64 `json:"rating"`
	Category    FlexibleID       `json:"category"`
	IsTypeMoved FlexibleBool     `json:"is_type_moved"`
	Url         string           `json:"url"`
}

// Series represents a TV series returned by /token/series
type Series struct {
	ID             FlexibleID       `json:"id"`
	Position       FlexibleInt      `json:"position"`
	Name           string           `json:"name"`
	Image          *string          `json:"image"`
	Tmdb           *FlexibleInt     `json:"tmdb"`
	Rating         *FlexibleFloat64 `json:"rating"`
	Cast           *string          `json:"cast"`
	Director       *string          `json:"director"`
	Genre          *string          `json:"genre"`
	ReleaseDate    *string          `json:"releaseDate"`
	YoutubeTrailer *string          `json:"youtube_trailer"`
	EpisodeRunTime *string          `json:"episode_run_time"`
	Finished       FlexibleBool     `json:"finished"`
	Url            json.RawMessage  `json:"url"`
	Category       FlexibleID       `json:"category"`
	EpisodeUpdated FlexibleTime     `json:"episodeUpdated"`
}

// SeriesEpisode represents an episode of a series returned by /token/series-episodes
type SeriesEpisode struct {
	ID       FlexibleID  `json:"id"`
	Name     string      `json:"name"`
	Category FlexibleID  `json:"category"` // series id
	Season   FlexibleInt `json:"season"`
	Episode  FlexibleInt `json:"episode"`
	Url      string      `json:"url"`
}

// EpgProgramme represents a program schedule returned by /token/epg
type EpgProgramme struct {
	ID          string          `json:"id"`
	Start       FlexibleTime    `json:"start"`
	Stop        FlexibleTime    `json:"stop"`
	Title       *string         `json:"title"`
	Description *string         `json:"description"`
	SubTitle    *string         `json:"sub_title"`
	Icon        *string         `json:"icon"`
	Categories  json.RawMessage `json:"categories"`
	Actors      json.RawMessage `json:"actors"`
	Directors   json.RawMessage `json:"directors"`
	Producers   json.RawMessage `json:"producers"`
	Writers     json.RawMessage `json:"writers"`
	Season      *FlexibleInt    `json:"season"`
	Episode     *FlexibleInt    `json:"episode"`
	Rating      *string         `json:"rating"`
	Live        FlexibleBool    `json:"live"`
	New         FlexibleBool    `json:"new"`
	ReleaseDate *string         `json:"release_date"`
}

// EpgRequest is the payload sent to POST /token/epg
type EpgRequest struct {
	EpgIDs []string `json:"epg_ids"`
	Date   int64    `json:"date,omitempty"`
	Days   int      `json:"days,omitempty"`
	Full   bool     `json:"full,omitempty"`
}

// EpgChannelMeta represents channel metadata (canonical name and lang) returned by /token/epg/channels
type EpgChannelMeta struct {
	ID   string  `json:"id"`
	Name string  `json:"name"`
	Lang *string `json:"lang"`
}

// EpgSettingsResponse represents the response returned by /token/epg/settings
type EpgSettingsResponse struct {
	Hash     string                 `json:"hash"`
	Settings map[string]interface{} `json:"settings"`
}

// ClientManagedUser represents a customer/managed user returned by /token/users
type ClientManagedUser struct {
	ListID             FlexibleID      `json:"list_id"`
	ID                 FlexibleInt     `json:"id"`
	Name               string          `json:"name"`
	Expiry             FlexibleTime    `json:"expiry"`
	ChannelsCategories json.RawMessage `json:"channels_categories"`
	VodsCategories     json.RawMessage `json:"vods_categories"`
	SeriesCategories   json.RawMessage `json:"series_categories"`
	M3U                string          `json:"m3u"`
	EPG                string          `json:"epg"`
	Username           string          `json:"username"`
	Password           string          `json:"password"`
	Patterns           json.RawMessage `json:"patterns"`
	Note               *string         `json:"note"`
	Language           *string         `json:"language"`
	Message            *string         `json:"message"`
	MaxConnections     FlexibleInt     `json:"max_connections"`
	SyncExpiryDate     FlexibleBool    `json:"sync_expiry_date"`
	UserSettings       json.RawMessage `json:"user_settings"`
	CreatedAt          FlexibleTime    `json:"createdAt"`
	UpdatedAt          FlexibleTime    `json:"updatedAt"`
}
