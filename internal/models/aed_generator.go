package models

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

func ptrString(s string) *string {
	return &s
}

func derefString(s *string) string {
	if s != nil {
		return *s
	}
	return ""
}

// AedRuleConfig represents playlist-level AED (Advanced EPG Dummy) configuration.
type AedRuleConfig struct {
	Sport                 string `json:"sport"`
	SourceTimezone        string `json:"sourceTimezone"`
	PreWindowMinutes      int    `json:"preWindowMinutes"`
	DurationMode          string `json:"durationMode"`
	CustomDurationMinutes int    `json:"customDurationMinutes"`
	PostWindowMinutes     int    `json:"postWindowMinutes"`
	Language              string `json:"language"`
	UpcomingTitleTemplate string `json:"upcomingTitleTemplate"`
	UpcomingDescTemplate  string `json:"upcomingDescTemplate"`
	LiveTitleTemplate     string `json:"liveTitleTemplate"`
	LiveDescTemplate      string `json:"liveDescTemplate"`
	EndedTitleTemplate    string `json:"endedTitleTemplate"`
	EndedDescTemplate     string `json:"endedDescTemplate"`
	FallbackTitleTemplate string `json:"fallbackTitleTemplate"`
	FallbackDescTemplate  string `json:"fallbackDescTemplate"`
	ChannelNameRegex      string `json:"channelNameRegex"`
	TitleRegex            string `json:"titleRegex"`
	SubtitleRegex         string `json:"subtitleRegex"`
	TeamDelimiters        string `json:"teamDelimiters"`
	TimeRegex             string `json:"timeRegex"`
	TimeFormat            string `json:"timeFormat"`
	DateRegex             string `json:"dateRegex"`
	DateFormat            string `json:"dateFormat"`
	AutoSyncOnUpdate      bool   `json:"autoSyncOnUpdate"`
	GenerateLogo          bool   `json:"generateLogo"`
	LogoStyle             string `json:"logoStyle"`
	LogoFallbackMode      string `json:"logoFallbackMode"`
	AutoHideEnded         bool   `json:"autoHideEnded"`
	AutoHideFallback      bool   `json:"autoHideFallback"`
}

// AedLogoRequestParams represents parameters for encoding a compact binary v1 /event/{token}.jpg logo URL.
type AedLogoRequestParams struct {
	Team1  string `json:"team1"`
	Team2  string `json:"team2,omitempty"`
	Sport  string `json:"sport,omitempty"`
	Style  string `json:"style,omitempty"`
	Title  string `json:"title,omitempty"`
	Date   string `json:"date,omitempty"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

// EpgCreatorEvent represents a single event in Custom EPG Studio.
type EpgCreatorEvent struct {
	ID       int     `json:"id"`
	T        string  `json:"t"` // Title
	D        *string `json:"d"` // Description
	Start    string  `json:"start"`
	Stop     string  `json:"stop"`
	R        int     `json:"r"` // 0: one-time, 1: dummy gap-filler, 2: daily, 3: weekly
	Live     bool    `json:"live,omitempty"`
	Fallback bool    `json:"fallback,omitempty"`
}

// EpgCreatorChannel represents a custom channel in EPG Studio.
type EpgCreatorChannel struct {
	ID         string            `json:"id" db:"id"`
	Name       string            `json:"name" db:"name"`
	Programmes []EpgCreatorEvent `json:"programmes"`
	OldID      string            `json:"old_id,omitempty"`
}

// EpgProgrammeItem matches the JSON schema of EPG programmes across externalapi and tokenapi.
type EpgProgrammeItem struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description *string   `json:"description"`
	SubTitle    *string   `json:"sub_title,omitempty"`
	Actors      *[]string `json:"actors,omitempty"`
	Directors   *[]string `json:"directors,omitempty"`
	Producers   *[]string `json:"producers,omitempty"`
	Writers     *[]string `json:"writers,omitempty"`
	Categories  *[]string `json:"categories,omitempty"`
	Icon        *string   `json:"icon,omitempty"`
	Episode     *int      `json:"episode,omitempty"`
	Season      *int      `json:"season,omitempty"`
	Rating      *string   `json:"rating,omitempty"`
	ReleaseDate *string   `json:"release_date,omitempty"`
	Live        bool      `json:"live"`
	New         bool      `json:"new"`
	IsFallback  bool      `json:"-"`
	Start       int64     `json:"start"`
	Stop        int64     `json:"stop"`
}

// StartTime returns Start as UTC time.Time.
func (p EpgProgrammeItem) StartTime() time.Time {
	return time.Unix(p.Start, 0).UTC()
}

// StopTime returns Stop as UTC time.Time.
func (p EpgProgrammeItem) StopTime() time.Time {
	return time.Unix(p.Stop, 0).UTC()
}

// DescriptionString returns dereferenced description or empty string.
func (p EpgProgrammeItem) DescriptionString() string {
	if p.Description != nil {
		return *p.Description
	}
	return ""
}

// AedSavePayload represents payload for POST /api/playlists/{id}/aed.
type AedSavePayload struct {
	Config   *AedRuleConfig      `json:"config,omitempty"`
	Channels []EpgCreatorChannel `json:"channels,omitempty"`
}

// AedEpgGenerator encapsulates the shared AED (Advanced EPG Dummy) parser, 3-stage EPG schedule generator, and binary v1 logo token encoder.
type AedEpgGenerator struct{}

// DefaultAedGenerator is the shared singleton instance of AedEpgGenerator.
var DefaultAedGenerator = NewAedEpgGenerator()

// NewAedEpgGenerator creates a new AedEpgGenerator instance.
func NewAedEpgGenerator() *AedEpgGenerator {
	return &AedEpgGenerator{}
}

// IsAedEpgID returns true when the EPG identifier uses the "event-" prefix followed by numeric digits.
func (g *AedEpgGenerator) IsAedEpgID(epgID string) bool {
	lower := strings.ToLower(strings.TrimSpace(epgID))
	if !strings.HasPrefix(lower, "event-") {
		return false
	}
	rest := lower[6:]
	if len(rest) == 0 {
		return false
	}
	for i := 0; i < len(rest); i++ {
		if rest[i] < '0' || rest[i] > '9' {
			return false
		}
	}
	return true
}

// IsAedEpgID is a package-level helper for DefaultAedGenerator.IsAedEpgID.
func IsAedEpgID(epgID string) bool {
	return DefaultAedGenerator.IsAedEpgID(epgID)
}

// DefaultConfig returns the default AedRuleConfig.
func (g *AedEpgGenerator) DefaultConfig() AedRuleConfig {
	return AedRuleConfig{
		Sport:                 "auto",
		SourceTimezone:        "America/New_York",
		PreWindowMinutes:      0,
		DurationMode:          "auto",
		CustomDurationMinutes: 180,
		PostWindowMinutes:     15,
		Language:              "en",
		UpcomingTitleTemplate: "Next Match: {event}",
		UpcomingDescTemplate:  "{sport} • Upcoming event: {event} ({date} {time})",
		LiveTitleTemplate:     "{event}",
		LiveDescTemplate:      "{sport} Live Broadcast — {event}",
		EndedTitleTemplate:    "The event has ended",
		EndedDescTemplate:     "Concluded event: {event}",
		FallbackTitleTemplate: "No scheduled event",
		FallbackDescTemplate:  "{channel} — Waiting for the next scheduled live broadcast",
		TeamDelimiters:        "vs., vs, versus, v., v, @, -",
		TimeFormat:            "auto",
		DateFormat:            "auto",
		AutoSyncOnUpdate:      true,
		GenerateLogo:          true,
		LogoStyle:             "split_vs",
		LogoFallbackMode:      "keep_existing",
	}
}

// DefaultAedRuleConfig is a package-level helper for DefaultAedGenerator.DefaultConfig.
func DefaultAedRuleConfig() AedRuleConfig {
	return DefaultAedGenerator.DefaultConfig()
}

// ParseConfig parses a playlist's raw aed_config JSON string into AedRuleConfig,
// falling back to DefaultConfig() if missing or invalid.
func (g *AedEpgGenerator) ParseConfig(rawConfig string) AedRuleConfig {
	def := g.DefaultConfig()
	if strings.TrimSpace(rawConfig) == "" {
		return def
	}
	cfg := def
	if err := json.Unmarshal([]byte(rawConfig), &cfg); err != nil {
		return def
	}
	if cfg.LogoStyle == "" {
		cfg.LogoStyle = def.LogoStyle
	}
	if cfg.LogoFallbackMode == "" {
		cfg.LogoFallbackMode = def.LogoFallbackMode
	}
	return cfg
}

// ParseConfigFromUserSettings extracts the "aed_config" object from a playlist's raw user_settings JSON string,
// falling back to DefaultConfig() if missing or invalid.
func (g *AedEpgGenerator) ParseConfigFromUserSettings(rawSettings string) AedRuleConfig {
	def := g.DefaultConfig()
	if strings.TrimSpace(rawSettings) == "" {
		return def
	}
	var settingsMap map[string]any
	if err := json.Unmarshal([]byte(rawSettings), &settingsMap); err != nil {
		return def
	}
	rawAed, ok := settingsMap["aed_config"]
	if !ok || rawAed == nil {
		return def
	}
	aedBytes, err := json.Marshal(rawAed)
	if err != nil {
		return def
	}
	cfg := def
	if err := json.Unmarshal(aedBytes, &cfg); err != nil {
		return def
	}
	if cfg.LogoStyle == "" {
		cfg.LogoStyle = def.LogoStyle
	}
	if cfg.LogoFallbackMode == "" {
		cfg.LogoFallbackMode = def.LogoFallbackMode
	}
	return cfg
}

const (
	aedVersion1 = 0x01

	aedFlagHasTeam2     = 1 << 0
	aedFlagHasSportStr  = 1 << 1
	aedFlagHasTitle     = 1 << 2
	aedFlagHasDate      = 1 << 3
	aedFlagHasCustomDim = 1 << 4
)

var aedStyleCodes = map[string]byte{
	"split_vs":       0,
	"broadcast":      0,
	"poster":         1,
	"square":         2,
	"icon":           2,
	"logo":           2,
	"showcase":       3,
	"sport":          3,
	"broadcast_card": 4,
}

var aedSportCodes = map[string]byte{
	"soccer":                1,
	"football":              1,
	"calcio":                1,
	"basketball":            2,
	"basket":                2,
	"formula 1":             3,
	"f1":                    3,
	"motogp":                4,
	"tennis":                5,
	"baseball":              6,
	"ice hockey":            7,
	"hockey":                7,
	"volleyball":            8,
	"volley":                8,
	"rugby":                 9,
	"combat":                10,
	"mma":                   10,
	"ufc":                   10,
	"boxing":                10,
	"superbike":             11,
	"wsbk":                  11,
	"sbk":                   11,
	"motorsport":            12,
	"racing":                12,
	"american football":     13,
	"serie a":               14,
	"serie b":               15,
	"serie c":               16,
	"champions league":      17,
	"ucl":                   17,
	"europa league":         18,
	"uel":                   18,
	"conference league":     19,
	"uecl":                  19,
	"uefa":                  20,
	"world cup":             21,
	"fifa world cup":        21,
	"premier league":        22,
	"epl":                   22,
	"la liga":               23,
	"laliga":                23,
	"bundesliga":            24,
	"ligue 1":               25,
	"ligue1":                25,
	"coppa italia":          26,
	"supercoppa italiana":   27,
	"fa cup":                28,
	"eredivisie":            29,
	"copa libertadores":     30,
	"libertadores":          30,
	"euroleague":            31,
	"nations league":        32,
	"uefa euro":             33,
	"euro 2024":             33,
	"euro 2028":             33,
	"wwe":                   34,
	"wrestling":             34,
	"ncaa":                  35,
	"college football":      35,
	"college basketball":    35,
	"pga tour":              36,
	"pga":                   36,
	"golf":                  36,
	"ipl":                   37,
	"cricket":               37,
	"six nations":           38,
	"6 nations":             38,
	"mls":                   39,
	"major league soccer":   39,
	"saudi pro league":      40,
	"roshn saudi league":    40,
	"liga portugal":         41,
	"primeira liga":         41,
	"scottish premiership":  42,
	"spfl":                  42,
	"indycar":               43,
	"liv golf":              44,
	"rugby world cup":       45,
	"olympics":                 46,
	"olympic":                  46,
	"olympic games":            46,
	"giochi olimpici":          46,
	"olimpiadi":                46,
	"youth olympic games":      46,
	"giochi olimpici giovanili": 46,
	"snooker":                  47,
	"world snooker tour":       47,
	"wst":                      47,
	"pool":                     47,
	"darts":                    48,
	"pdc":                      48,
	"cycling":                  49,
	"uci":                      49,
	"uci cycling":              49,
	"tour de france":           49,
	"giro d'italia":            49,
	"la vuelta":                49,
	"winter sports":            50,
	"fis":                      50,
	"fis world cup":            50,
	"alpine skiing":            50,
	"biathlon":                 50,
	"ski jumping":              50,
	"handball":                 51,
	"ehf":                      51,
	"padel":                    52,
	"premier padel":            52,
	"formula 2":                53,
	"f2":                       53,
	"formula 3":                54,
	"f3":                       54,
	"formula e":                55,
	"fe":                       55,
	"wnba":                     56,
	"nhl":                      57,
	"nba":                      58,
	"nfl":                      59,
	"mlb":                      60,
	"ufc_mma":                  61,
	"water polo":               62,
	"waterpolo":                62,
	"pallanuoto":               62,
	"beach volleyball":         63,
	"beach volley":             63,
	"table tennis":             64,
	"tennis tavolo":            64,
	"ping pong":                64,
	"wtt":                      64,
	"badminton":                65,
	"bwf":                      65,
	"futsal":                   66,
	"calcio a 5":               66,
}

func aedDefaultDimensions(style string) (int, int) {
	switch strings.ToLower(strings.TrimSpace(style)) {
	case "poster":
		return 306, 450
	case "square", "icon", "logo":
		return 450, 450
	default:
		return 450, 253
	}
}

func aedClampDimensions(style string, w, h int) (int, int) {
	defW, defH := aedDefaultDimensions(style)
	if w <= 0 && h <= 0 {
		return defW, defH
	}
	if w <= 0 {
		w = int(math.Round(float64(h) * float64(defW) / float64(defH)))
	} else if h <= 0 {
		h = int(math.Round(float64(w) * float64(defH) / float64(defW)))
	}
	if w > 450 {
		h = int(math.Round(float64(h) * 450.0 / float64(w)))
		w = 450
	}
	if h > 450 {
		w = int(math.Round(float64(w) * 450.0 / float64(h)))
		h = 450
	}
	if w < 64 {
		w = 64
	}
	if h < 64 {
		h = 64
	}
	return w, h
}

// EncodeAedLogoToken encodes AedLogoRequestParams into a compact binary v1 base64url token.
func (g *AedEpgGenerator) EncodeAedLogoToken(req AedLogoRequestParams) string {
	var buf bytes.Buffer

	style := strings.ToLower(strings.TrimSpace(req.Style))
	styleCode, ok := aedStyleCodes[style]
	if !ok {
		styleCode = 0
		style = "split_vs"
	}

	sportLower := strings.ToLower(strings.TrimSpace(req.Sport))
	sportCode, hasPredefinedSport := aedSportCodes[sportLower]
	if !hasPredefinedSport {
		sportCode = 0
	}

	t1 := strings.TrimSpace(req.Team1)
	t2 := strings.TrimSpace(req.Team2)
	sp := strings.TrimSpace(req.Sport)
	ti := strings.TrimSpace(req.Title)
	da := strings.TrimSpace(req.Date)

	var flags byte
	if t2 != "" {
		flags |= aedFlagHasTeam2
	}
	if !hasPredefinedSport && sp != "" {
		flags |= aedFlagHasSportStr
	}
	if ti != "" {
		flags |= aedFlagHasTitle
	}
	if da != "" {
		flags |= aedFlagHasDate
	}

	w, h := aedClampDimensions(style, req.Width, req.Height)
	defW, defH := aedDefaultDimensions(style)
	if (req.Width > 0 || req.Height > 0) && (w != defW || h != defH) {
		flags |= aedFlagHasCustomDim
	}

	buf.WriteByte(aedVersion1)
	buf.WriteByte(styleCode)
	buf.WriteByte(flags)
	buf.WriteByte(sportCode)

	writeStr := func(s string) {
		if len(s) > 255 {
			s = s[:255]
		}
		buf.WriteByte(byte(len(s)))
		buf.WriteString(s)
	}

	writeStr(t1)
	if flags&aedFlagHasTeam2 != 0 {
		writeStr(t2)
	}
	if flags&aedFlagHasSportStr != 0 {
		writeStr(sp)
	}
	if flags&aedFlagHasTitle != 0 {
		writeStr(ti)
	}
	if flags&aedFlagHasDate != 0 {
		writeStr(da)
	}
	if flags&aedFlagHasCustomDim != 0 {
		var dim [4]byte
		binary.BigEndian.PutUint16(dim[0:2], uint16(w))
		binary.BigEndian.PutUint16(dim[2:4], uint16(h))
		buf.Write(dim[:])
	}

	return base64.RawURLEncoding.EncodeToString(buf.Bytes())
}

// BuildAedLogoPath returns the relative "/event/{token}.jpg" path for the given request.
func (g *AedEpgGenerator) BuildAedLogoPath(req AedLogoRequestParams) string {
	return "/event/" + g.EncodeAedLogoToken(req) + ".jpg"
}

// GetAedLogoBaseURL returns the configured base URL for AED logos (defaults to "https://logo.m3uassets.com").
// Checks AED_LOGO_HOST first, then AED_LOGO_BASE_URL, and normalizes protocol/trailing slashes.
func (g *AedEpgGenerator) GetAedLogoBaseURL() string {
	raw := strings.TrimSpace(os.Getenv("AED_LOGO_HOST"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("AED_LOGO_BASE_URL"))
	}
	if raw == "" {
		return "https://logo.m3uassets.com"
	}
	raw = strings.TrimRight(raw, "/")
	if !strings.HasPrefix(raw, "http://") && !strings.HasPrefix(raw, "https://") {
		if strings.HasPrefix(raw, "localhost") || strings.HasPrefix(raw, "127.0.0.1") {
			raw = "http://" + raw
		} else {
			raw = "https://" + raw
		}
	}
	return raw
}

// BuildAedLogoURL returns the full "https://logo.m3uassets.com/event/{token}.jpg" URL.
func (g *AedEpgGenerator) BuildAedLogoURL(req AedLogoRequestParams) string {
	return g.GetAedLogoBaseURL() + g.BuildAedLogoPath(req)
}

type aedCreatorSlot struct {
	Start       time.Time
	Stop        time.Time
	Title       string
	Description string
	Index       int
	Live        bool
	Fallback    bool
}

var reAedLiveParen = regexp.MustCompile(`(?i)\s*\(live\)`)

// StripAedLiveTag removes hardcoded AED live tags ("ᴸᶦᵛᵉ" or "(live)") from a title
// so XMLTV / EPG user settings can apply or omit the live broadcast tag consistently.
func StripAedLiveTag(title string) string {
	s := strings.ReplaceAll(title, " \u1D38\u1DA6\u1D5B\u1D49", "")
	s = strings.ReplaceAll(s, "\u1D38\u1DA6\u1D5B\u1D49", "")
	s = reAedLiveParen.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

var (
	reNoEventGo     = regexp.MustCompile(`(?i)\b(?:no\s+event\s+streaming|no\s+event|no\s+stream|no\s+signal|offline|coming\s+soon)\b`)
	reTrailingColon = regexp.MustCompile(`[:|]\s*$`)
	reExplicitEndGo = regexp.MustCompile(`(?i)^\s*(?:\[[^\]]+\]\s*)?(?:ended|end)\s*[|:]`)
	reBracketedGo   = regexp.MustCompile(`^([A-Za-z0-9+|★▎._\s-]+?)\s*\[(.*)\]$`)
	reTrailingPipeC = regexp.MustCompile(`(?i)\|\s*(?:8K\s+EXCLUSIVE\s*\|\s*)?([A-Z]{2,6}:\s*[A-Za-z0-9+\s]+?\d+)\s*$`)
	reTrailingColC  = regexp.MustCompile(`:\s*([A-Za-z0-9+]+\s+\d{1,3})\s*$`)
	reLeadNextEndGo = regexp.MustCompile(`(?i)^\s*(?:next|ended|end)\s*(?:\|\s*|\s+)`)
	reLeadPrefGo    = regexp.MustCompile(`(?i)^(?:\|[A-Z]{2,4}\s*\|?\s*)?\|?([A-Za-z0-9+★▎._-]+(?:\s*(?:\([^)]+\)|[A-Za-z0-9+★▎._-]+)){0,5}?)\s*(?:Events\s+Only)?\s*[:|]\s*(.*)$`)
	reIsoDateTimeGo = regexp.MustCompile(`\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?\b`)
	reIsoDateGo     = regexp.MustCompile(`\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b`)
	reDmyDateGo     = regexp.MustCompile(`\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b`)
	reMonthDayGo    = regexp.MustCompile(`(?i)\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b`)
	reDayMonthGo    = regexp.MustCompile(`(?i)\b(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*(?:\s+(20\d{2}))?\b`)
	reHhmmTimeGo    = regexp.MustCompile(`(?i)\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?(?:\s*\(?\b(UTC|GMT|UK|BST|ET|EST|EDT|CT|CST|CDT|MT|PT|PST|PDT|CET|CEST)\b\)?(?:\s*\([A-Z]{2,4}\))?)?`)
	reCompactTimeGo = regexp.MustCompile(`(?i)\b(\d{1,2})\s*(am|pm)(?:\s*\(?\b(UTC|GMT|UK|BST|ET|EST|EDT|CT|PT|CET|CEST)\b\)?)?\b`)
	reQualityTagsGo = regexp.MustCompile(`(?i)\b(?:8K\s+EXCLUSIVE|4K|UHD|FHD|HD|SD|HEVC|RAW)\b`)
	reAudioTagsGo   = regexp.MustCompile(`(?i)(?:\((?:EN\s+AUDIO|ONLY\s+ON\s+LIVE|S|BACKUP|BKP|EN|ES|FR|DE|IT)\)|\s+(?:Arabic|English|Spanish|French|German|Italian|Portuguese|Turkish|Dutch)\s+(?:UEFA\s+Nations\s+League|Champions\s+League|Europa\s+League|Premier\s+League|La\s+Liga|Serie\s+A|Bundesliga|Ligue\s+1|World\s+Cup).*$)`)
	reArabicGo      = regexp.MustCompile(`[\x{0600}-\x{06FF}]+`)
	reDriverFeedGo    = regexp.MustCompile(`(?i)^(?:F1|MOTOGP)\s*[★▎-]\s*([A-Za-z\s]+?)\s*\|\s*([A-Za-z0-9\s]+?)(?:\s*\|\s*[A-Z]{3})?$`)
	rePipeHasTimeGo   = regexp.MustCompile(`(?i)\b\d{1,2}:\d{2}\b`)
	rePipeWeekdayGo   = regexp.MustCompile(`(?i)\b(?:mon|tue|wed|thu|fri|sat|sun)\b`)
	rePipeMonthGo     = regexp.MustCompile(`(?i)\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b`)
	rePipeQualEndGo   = regexp.MustCompile(`^(?i)(all|fhd|hd|uhd|4k|sd|hevc|raw|50fps|it|en|de|fr|es|us|uk)$`)
	rePipeQualPrevGo  = regexp.MustCompile(`^(?i)(all|fhd|hd|uhd|4k|sd|hevc|raw|50fps|it|en|de|fr|es|us|uk|hls|ts)$`)
	reTimePrefixGo    = regexp.MustCompile(`^\d{1,2}(?::\d{2})?$`)
	reLeadSportPrefGo = regexp.MustCompile(`(?i)^(?:(?:Tennis|Soccer|Football|F[úu]tbol\s*Americano(?:\s+NCAA)?|F[úu]tbol|Basketball|B[áa]squetbol(?:\s+femenino)?(?:\s+NCAA)?|NCAA|Baseball|Ice\s*Hockey|Hockey|Motorsport|Formula\s*1|F1|MotoGP|Boxing|MMA|UFC|Rugby|Cricket|Golf|Volleyball|Handball|Darts|Snooker|Olympics|Table\s*Tennis|Badminton|Waterpolo)\s*[-:]\s*)+`)
	reSegSplitGo      = regexp.MustCompile(`\s*[|•]\s*`)
	reSegHasMatchupGo = regexp.MustCompile(`(?i)\b(?:vs\.?|versus|v\.?)\b|ضد|\s@\s|\b[A-Za-z]{2,}\s+(?:at|x)\s+[A-Za-z]{2,}\b|\s-\s`)
	reNonTeamRhsGo    = regexp.MustCompile(`(?i)^(?:week|round|giornata|matchday|day|session|part|stage|semifinal|final|qualifying|fp\d|q\d|race|highlights|preview|review|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[iİ]spanya\s+laliga|tekrar|centre\s+court|center\s+court|court\s*\d*|main\s+card|prelims)\b`)
	reDigitsOnlyGo    = regexp.MustCompile(`^\d+$`)
	reNonTeamLhsGo    = regexp.MustCompile(`(?i)^(?:nfl\s*redzone|redzone|inside\s+the\s+ring|free\s+agent\s*frenzy|spanish\s+laliga|premier\s+league|la\s+liga|serie\s+[abc]|bundesliga|ligue\s+1|champions\s+league|europa\s+league|premier\s+padel|fip\s+world\s+cup)\b`)
	reColonSuffixGo   = regexp.MustCompile(`(?i)(?:\s*\([A-Z]{2,3}\)|\s*:\s*(?:(?:launch\s+)?press\s+conference|conferenza\s+stampa|rueda\s+de\s+prensa|weigh[- ]?in|pesaje|main\s+card|prelims|highlights|sintesi|anteprima|replica|replay|repetici[óo]n(?:\s+del\s+evento)?))\s*$`)
	reRankPrefixGo    = regexp.MustCompile(`^#\d+\s+`)
)

var goMonthMap = map[string]time.Month{
	"jan": time.January, "feb": time.February, "mar": time.March, "apr": time.April,
	"may": time.May, "jun": time.June, "jul": time.July, "aug": time.August,
	"sep": time.September, "oct": time.October, "nov": time.November, "dec": time.December,
}

var goTzOffsetMap = map[string]int{
	"UTC": 0, "GMT": 0, "UK": 0, "BST": 1, "CET": 1, "CEST": 2,
	"ET": -5, "EST": -5, "EDT": -4, "CT": -6, "CST": -6, "CDT": -5,
	"MT": -7, "PT": -8, "PST": -8, "PDT": -7,
	"AMERICA/NEW_YORK": -5, "EUROPE/LONDON": 0, "EUROPE/ROME": 1, "AMERICA/CHICAGO": -6, "AMERICA/LOS_ANGELES": -8,
}

func interpolateGoAed(tpl string, vars map[string]string) string {
	res := tpl
	for k, v := range vars {
		res = strings.ReplaceAll(res, "{"+k+"}", v)
	}
	res = strings.ReplaceAll(res, "()", "")
	for strings.Contains(res, "• •") {
		res = strings.ReplaceAll(res, "• •", "•")
	}
	res = strings.TrimSpace(res)
	res = strings.TrimPrefix(res, "•")
	res = strings.TrimSuffix(res, "•")
	return strings.TrimSpace(res)
}

func detectGoSportAndDuration(categoryName, channelName, team1, team2 string) (string, int) {
	combinedLower := strings.ToLower(categoryName + " " + channelName)
	switch {
	case strings.Contains(combinedLower, "serie c") || strings.Contains(combinedLower, "lega pro"):
		return "Serie C", 125
	case strings.Contains(combinedLower, "serie b"):
		return "Serie B", 125
	case strings.Contains(combinedLower, "serie a2") || strings.Contains(combinedLower, "credem banca"):
		return "Volleyball", 120
	case strings.Contains(combinedLower, "serie a"):
		return "Serie A", 125
	case strings.Contains(combinedLower, "afc champions league"):
		return "AFC Champions League", 125
	case strings.Contains(combinedLower, "champions league") || strings.Contains(combinedLower, " ucl"):
		return "Champions League", 125
	case strings.Contains(combinedLower, "europa league") || strings.Contains(combinedLower, " uel"):
		return "Europa League", 125
	case strings.Contains(combinedLower, "conference league") || strings.Contains(combinedLower, " uecl"):
		return "Conference League", 125
	case (strings.Contains(combinedLower, "premier league") && !strings.Contains(combinedLower, "sierra leone") && !strings.Contains(combinedLower, "ghana") && !strings.Contains(combinedLower, "nigeria") && !strings.Contains(combinedLower, "kenya") && !strings.Contains(combinedLower, "tanzania") && !strings.Contains(combinedLower, "uganda") && !strings.Contains(combinedLower, "jamaica") && !strings.Contains(combinedLower, "egypt") && !strings.Contains(combinedLower, "south africa") && !strings.Contains(combinedLower, "canada") && !strings.Contains(combinedLower, "singapore") && !strings.Contains(combinedLower, "malta") && !strings.Contains(combinedLower, "armenia") && !strings.Contains(combinedLower, "kazakhstan") && !strings.Contains(combinedLower, "azerbaijan") && !strings.Contains(combinedLower, "belarus") && !strings.Contains(combinedLower, "ukraine") && !strings.Contains(combinedLower, "russia") && !strings.Contains(combinedLower, "israel") && !strings.Contains(combinedLower, "bosnia") && !strings.Contains(combinedLower, "wales") && !strings.Contains(combinedLower, "northern ireland")) || strings.Contains(combinedLower, " epl") || strings.Contains(combinedLower, "pl+"):
		return "Premier League", 125
	case strings.Contains(combinedLower, "la liga") || strings.Contains(combinedLower, "laliga"):
		return "La Liga", 125
	case strings.Contains(combinedLower, "bundesliga"):
		return "Bundesliga", 125
	case strings.Contains(combinedLower, "ligue 1") && !strings.Contains(combinedLower, "burkina faso") && !strings.Contains(combinedLower, "guinea") && !strings.Contains(combinedLower, "mali") && !strings.Contains(combinedLower, "senegal") && !strings.Contains(combinedLower, "ivory coast") && !strings.Contains(combinedLower, "cote d'ivoire") && !strings.Contains(combinedLower, "cameroon") && !strings.Contains(combinedLower, "congo") && !strings.Contains(combinedLower, "algeria") && !strings.Contains(combinedLower, "tunisia") && !strings.Contains(combinedLower, "morocco") && !strings.Contains(combinedLower, "niger"):
		return "Ligue 1", 125
	case strings.Contains(combinedLower, "coppa italia"):
		return "Coppa Italia", 125
	case strings.Contains(combinedLower, "fa cup"):
		return "FA Cup", 125
	case strings.Contains(combinedLower, "eredivisie"):
		return "Eredivisie", 125
	case strings.Contains(combinedLower, "liga portugal") || strings.Contains(combinedLower, "primeira liga"):
		return "Liga Portugal", 125
	case strings.Contains(combinedLower, "scottish premiership") || strings.Contains(combinedLower, "spfl"):
		return "Scottish Premiership", 125
	case strings.Contains(combinedLower, "saudi pro league"):
		return "Saudi Pro League", 125
	case strings.Contains(combinedLower, "libertadores"):
		return "Copa Libertadores", 125
	case strings.Contains(combinedLower, "mls"):
		return "MLS", 125
	case strings.Contains(combinedLower, "nhl") || strings.Contains(combinedLower, "hockey"):
		return "Ice Hockey", 165
	case strings.Contains(combinedLower, "nfl") || strings.Contains(combinedLower, "redzone"):
		return "American Football", 210
	case strings.Contains(combinedLower, "wnba"):
		return "WNBA", 150
	case strings.Contains(combinedLower, "nba"):
		return "Basketball", 165
	case strings.Contains(combinedLower, "euroleague") || strings.Contains(combinedLower, "euro league"):
		return "EuroLeague", 135
	case strings.Contains(combinedLower, "mlb") || strings.Contains(combinedLower, "baseball") || strings.Contains(combinedLower, "superpesis"):
		return "Baseball", 185
	case strings.Contains(combinedLower, "giochi olimpici") || strings.Contains(combinedLower, "olympic") || strings.Contains(combinedLower, "olimpiadi") || strings.Contains(combinedLower, "dakar 2026"):
		return "Olympics", 180
	case strings.Contains(combinedLower, "table tennis") || strings.Contains(combinedLower, "mltt") || strings.Contains(combinedLower, "ping pong") || strings.Contains(combinedLower, "wtt"):
		return "Table Tennis", 120
	case strings.Contains(combinedLower, "padel") || strings.Contains(combinedLower, "premier padel"):
		return "Padel", 120
	case strings.Contains(combinedLower, "snooker") || strings.Contains(combinedLower, "world snooker tour"):
		return "Snooker", 180
	case strings.Contains(combinedLower, "darts") || strings.Contains(combinedLower, "pdc"):
		return "Darts", 150
	case strings.Contains(combinedLower, "cycling") || strings.Contains(combinedLower, "tour de france") || strings.Contains(combinedLower, "giro d'italia") || strings.Contains(combinedLower, "la vuelta"):
		return "Cycling", 240
	case strings.Contains(combinedLower, "winter sports") || strings.Contains(combinedLower, "alpine skiing") || strings.Contains(combinedLower, "biathlon") || strings.Contains(combinedLower, "ski jumping"):
		return "Winter Sports", 150
	case strings.Contains(combinedLower, "handball") || strings.Contains(combinedLower, "ehf"):
		return "Handball", 120
	case strings.Contains(combinedLower, "water polo") || strings.Contains(combinedLower, "waterpolo") || strings.Contains(combinedLower, "pallanuoto"):
		return "Water Polo", 90
	case strings.Contains(combinedLower, "beach volley"):
		return "Beach Volleyball", 90
	case strings.Contains(combinedLower, "badminton") || strings.Contains(combinedLower, "bwf"):
		return "Badminton", 120
	case strings.Contains(combinedLower, "futsal") || strings.Contains(combinedLower, "calcio a 5"):
		return "Futsal", 90
	case strings.Contains(combinedLower, "tennis") || strings.Contains(combinedLower, "atp") || strings.Contains(combinedLower, "wta") || (strings.Contains(team1, "/") && strings.Contains(team2, "/")) || ((strings.Contains(team1, "/") || strings.Contains(team2, "/")) && (strings.EqualFold(team1, "tbd") || strings.EqualFold(team2, "tbd") || strings.EqualFold(team1, "tba") || strings.EqualFold(team2, "tba"))):
		return "Tennis", 150
	case strings.Contains(combinedLower, "wwe") || strings.Contains(combinedLower, "wrestling"):
		return "WWE", 180
	case strings.Contains(combinedLower, "ufc") || strings.Contains(combinedLower, "boxing") || strings.Contains(combinedLower, "mma"):
		return "Combat", 240
	case strings.Contains(combinedLower, "superbike") || strings.Contains(combinedLower, "worldsbk") || strings.Contains(combinedLower, "wsbk"):
		return "Superbike", 120
	case strings.Contains(combinedLower, "motogp") || strings.Contains(combinedLower, "moto2") || strings.Contains(combinedLower, "moto3") || strings.Contains(combinedLower, "mxgp"):
		return "MotoGP", 120
	case strings.Contains(combinedLower, "formula 2") || strings.Contains(combinedLower, "f2"):
		return "Formula 2", 120
	case strings.Contains(combinedLower, "formula 3") || strings.Contains(combinedLower, "f3"):
		return "Formula 3", 120
	case strings.Contains(combinedLower, "formula e"):
		return "Formula E", 120
	case strings.Contains(combinedLower, "f1") || strings.Contains(combinedLower, "formula 1") || strings.Contains(combinedLower, "formule 1") || strings.Contains(combinedLower, "formula") || strings.Contains(combinedLower, "grand prix"):
		return "Formula 1", 135
	case strings.Contains(combinedLower, "indycar"):
		return "IndyCar", 150
	case strings.Contains(combinedLower, "nascar") || strings.Contains(combinedLower, "wrc") || strings.Contains(combinedLower, "rally"):
		return "Motorsport", 150
	case strings.Contains(combinedLower, "six nations") || strings.Contains(combinedLower, "6 nations"):
		return "Six Nations", 125
	case strings.Contains(combinedLower, "rugby"):
		return "Rugby", 125
	case strings.Contains(combinedLower, "dp world tour") || strings.Contains(combinedLower, "pga tour") || strings.Contains(combinedLower, "golf"):
		return "Golf", 240
	case strings.Contains(combinedLower, "ncaa"):
		return "NCAA", 150
	case strings.Contains(combinedLower, "soccer") || strings.Contains(combinedLower, "football") || strings.Contains(combinedLower, "calcio") || strings.Contains(combinedLower, "league") || strings.Contains(combinedLower, "liga") || strings.Contains(combinedLower, "ligue") || strings.Contains(combinedLower, "championnat"):
		return "Soccer", 125
	default:
		return "", 180
	}
}

// GenerateLogoURLForChannel parses a channel name and category using AedRuleConfig and returns the full dynamic logo URL
// (or empty string if GenerateLogo is false or when no event is scheduled and LogoFallbackMode == "keep_existing").
func (g *AedEpgGenerator) GenerateLogoURLForChannel(channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) string {
	if !cfg.GenerateLogo {
		return ""
	}
	style := strings.TrimSpace(cfg.LogoStyle)
	if style == "" {
		style = "split_vs"
	}
	fallbackMode := strings.TrimSpace(cfg.LogoFallbackMode)
	if fallbackMode == "" {
		fallbackMode = "sport_badge"
	}

	working := strings.TrimSpace(channelName)
	explicitNoEvent := reNoEventGo.MatchString(working) || reTrailingColon.MatchString(working)

	containerChannel := ""
	if m := reBracketedGo.FindStringSubmatch(working); len(m) > 2 {
		containerChannel = strings.TrimSpace(m[1])
		working = strings.TrimSpace(m[2])
	} else if m := reTrailingPipeC.FindStringSubmatchIndex(working); m != nil {
		containerChannel = strings.TrimSpace(working[m[2]:m[3]])
		working = strings.TrimSpace(working[:m[0]])
	} else if m := reTrailingColC.FindStringSubmatchIndex(working); m != nil {
		containerChannel = strings.TrimSpace(working[m[2]:m[3]])
		working = strings.TrimSpace(working[:m[0]])
	}

	working = reLeadNextEndGo.ReplaceAllString(working, "")

	if containerChannel == "" && strings.Contains(working, "|") {
		pipeParts := strings.Split(working, "|")
		var trimmed []string
		for _, p := range pipeParts {
			if t := strings.TrimSpace(p); t != "" {
				trimmed = append(trimmed, t)
			}
		}
		if len(trimmed) >= 2 {
			last := trimmed[len(trimmed)-1]
			lastLower := strings.ToLower(last)
			isDateOrTimeOrVs := strings.Contains(lastLower, "vs") ||
				strings.Contains(lastLower, " - ") ||
				strings.Contains(lastLower, " @ ") ||
				rePipeHasTimeGo.MatchString(last) ||
				rePipeWeekdayGo.MatchString(last) ||
				rePipeMonthGo.MatchString(last) ||
				rePipeQualEndGo.MatchString(last)
			if len(last) >= 2 && len(last) <= 35 && !isDateOrTimeOrVs {
				containerChannel = last
				trimmed = trimmed[:len(trimmed)-1]
				if len(trimmed) > 1 {
					prev := trimmed[len(trimmed)-1]
					if rePipeQualPrevGo.MatchString(prev) {
						trimmed = trimmed[:len(trimmed)-1]
					}
				}
				working = strings.Join(trimmed, " | ")
			}
		}
	}

	if containerChannel == "" {
		if m := reLeadPrefGo.FindStringSubmatch(working); m != nil {
			cand := strings.TrimSpace(m[1])
			rem := strings.TrimSpace(m[2])
			isTimePrefix := reTimePrefixGo.MatchString(cand)
			lowCand := strings.ToLower(cand)
			if !isTimePrefix && !strings.Contains(lowCand, " vs") && !strings.Contains(lowCand, " v ") && !strings.Contains(lowCand, " v. ") && !strings.Contains(cand, " @ ") && !strings.Contains(cand, " - ") {
				containerChannel = cand
				working = rem
			}
		}
	}
	if containerChannel == "" {
		containerChannel = strings.TrimSpace(channelName)
	}

	if m := reIsoDateTimeGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	} else if m := reIsoDateGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	} else if m := reDmyDateGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	} else if m := reDayMonthGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	} else if m := reMonthDayGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	}

	if m := reHhmmTimeGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	} else if m := reCompactTimeGo.FindStringSubmatch(working); m != nil {
		working = strings.Replace(working, m[0], " ", 1)
	}

	cleaned := reQualityTagsGo.ReplaceAllString(working, " ")
	cleaned = reAudioTagsGo.ReplaceAllString(cleaned, " ")
	cleaned = reArabicGo.ReplaceAllString(cleaned, " ")
	cleaned = strings.Trim(cleaned, " -=_*~•|/@()")
	cleaned = strings.Join(strings.Fields(cleaned), " ")

	// Split multi-segment titles (e.g. "Afghanistan - Marocco | Finale 3° posto...") so extra segments don't pollute team2
	var rawSegments []string
	for _, seg := range reSegSplitGo.Split(cleaned, -1) {
		if s := strings.TrimSpace(seg); s != "" {
			rawSegments = append(rawSegments, s)
		}
	}
	primarySegment := cleaned
	if len(rawSegments) > 1 {
		for _, seg := range rawSegments {
			if reSegHasMatchupGo.MatchString(seg) {
				primarySegment = seg
				break
			}
		}
	}

	cleanedWithoutSport := reLeadSportPrefGo.ReplaceAllString(primarySegment, "")

	team1, team2 := "", ""
	delimsRaw := cfg.TeamDelimiters
	if strings.TrimSpace(delimsRaw) == "" {
		delimsRaw = "vs., vs, versus, v., v, @, -"
	}
	for _, rawDelim := range strings.Split(delimsRaw, ",") {
		d := strings.TrimSpace(rawDelim)
		if d == "" {
			continue
		}
		sep := " " + d + " "
		idx := strings.Index(strings.ToLower(cleanedWithoutSport), strings.ToLower(sep))
		if idx > 0 {
			t1 := strings.TrimSpace(cleanedWithoutSport[:idx])
			t2 := strings.TrimSpace(cleanedWithoutSport[idx+len(sep):])
			if (strings.EqualFold(d, "v.") || strings.EqualFold(d, "v") || strings.EqualFold(d, "x")) &&
				len(t1) > 0 && strings.ContainsAny(t1[len(t1)-1:], "-/&@:|([") {
				continue
			}
			if d != "-" {
				if lastCol := strings.LastIndex(t1, ": "); lastCol >= 0 {
					t1 = strings.TrimSpace(t1[lastCol+2:])
				}
				if lastDash := strings.LastIndex(t1, " - "); lastDash >= 0 {
					t1 = strings.TrimSpace(t1[lastDash+3:])
				}
			} else {
				if dashParts := strings.Split(cleanedWithoutSport, " - "); len(dashParts) >= 3 {
					t1 = strings.TrimSpace(dashParts[len(dashParts)-2])
					t2 = strings.TrimSpace(dashParts[len(dashParts)-1])
				}
				isNonTeam := reNonTeamRhsGo.MatchString(t2) ||
					reDigitsOnlyGo.MatchString(t2) ||
					reNonTeamLhsGo.MatchString(t1)
				if isNonTeam {
					continue
				}
			}
			team1 = strings.TrimSpace(reRankPrefixGo.ReplaceAllString(reColonSuffixGo.ReplaceAllString(t1, ""), ""))
			team2 = strings.TrimSpace(reRankPrefixGo.ReplaceAllString(reColonSuffixGo.ReplaceAllString(t2, ""), ""))
			break
		}
	}

	sportName, _ := detectGoSportAndDuration(categoryName, channelName, team1, team2)
	dateBadge := ""
	lowSport := strings.ToLower(sportName)
	if style == "split_vs" && (lowSport == "tennis" || lowSport == "ufc" || lowSport == "boxing" || lowSport == "mma" || lowSport == "combat" || lowSport == "golf" || lowSport == "snooker" || lowSport == "darts") {
		style = "broadcast_card"
	}

	if explicitNoEvent || len(cleaned) < 3 {
		return ""
	}

	isCleanToken := func(s string) bool {
		return len(s) >= 2 && len(s) <= 48 && !strings.ContainsAny(s, "|[]") && len(strings.Fields(s)) <= 6
	}
	confidence := 0
	if team1 != "" && team2 != "" {
		confidence = 50
		if sportName != "" {
			confidence += 30
		}
		if isCleanToken(team1) && isCleanToken(team2) {
			confidence += 20
		}
	} else {
		ev := cleaned
		if team1 != "" {
			ev = team1
		}
		if ev != "" {
			confidence = 30
			if sportName != "" {
				confidence += 45
			}
			if isCleanToken(ev) {
				confidence += 25
			}
		}
	}
	if confidence < 70 {
		return ""
	}

	if team1 != "" && team2 != "" {
		return g.BuildAedLogoURL(AedLogoRequestParams{
			Team1: team1,
			Team2: team2,
			Sport: sportName,
			Style: style,
			Title: strings.ToUpper(sportName),
			Date:  dateBadge,
		})
	}

	eventTitle := cleaned
	if team1 != "" {
		eventTitle = team1
	}

	if eventTitle != "" && !explicitNoEvent {
		return g.BuildAedLogoURL(AedLogoRequestParams{
			Team1: eventTitle,
			Sport: sportName,
			Style: style,
			Title: strings.ToUpper(sportName),
			Date:  dateBadge,
		})
	}

	return ""
}

// GenerateEventsForChannel parses a PPV/event channel name and produces 3-stage EpgCreatorEvent entries
// (Upcoming -> Live -> Ended, or localized Fallback if no event is present).
func (g *AedEpgGenerator) GenerateEventsForChannel(channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) []EpgCreatorEvent {
	if cfg.UpcomingTitleTemplate == "" {
		def := g.DefaultConfig()
		if cfg.Sport == "" {
			cfg = def
		} else {
			cfg.UpcomingTitleTemplate = def.UpcomingTitleTemplate
			cfg.UpcomingDescTemplate = def.UpcomingDescTemplate
			cfg.LiveTitleTemplate = def.LiveTitleTemplate
			cfg.LiveDescTemplate = def.LiveDescTemplate
			cfg.EndedTitleTemplate = def.EndedTitleTemplate
			cfg.EndedDescTemplate = def.EndedDescTemplate
			cfg.FallbackTitleTemplate = def.FallbackTitleTemplate
			cfg.FallbackDescTemplate = def.FallbackDescTemplate
		}
	}

	working := strings.TrimSpace(channelName)
	explicitNoEvent := reNoEventGo.MatchString(working) || reTrailingColon.MatchString(working)
	explicitEnded := reExplicitEndGo.MatchString(working)

	containerChannel := ""
	if strings.TrimSpace(cfg.ChannelNameRegex) != "" {
		if customChRe, err := regexp.Compile(cfg.ChannelNameRegex); err == nil {
			if m := customChRe.FindStringSubmatchIndex(working); len(m) >= 4 && m[2] >= 0 && m[3] >= 0 {
				containerChannel = strings.TrimSpace(working[m[2]:m[3]])
				working = strings.TrimSpace(working[:m[0]] + " " + working[m[1]:])
			}
		}
	}

	if containerChannel == "" {
		if m := reBracketedGo.FindStringSubmatch(working); len(m) > 2 {
			containerChannel = strings.TrimSpace(m[1])
			working = strings.TrimSpace(m[2])
		} else if m := reTrailingPipeC.FindStringSubmatchIndex(working); m != nil {
			containerChannel = strings.TrimSpace(working[m[2]:m[3]])
			working = strings.TrimSpace(working[:m[0]])
		} else if m := reTrailingColC.FindStringSubmatchIndex(working); m != nil {
			containerChannel = strings.TrimSpace(working[m[2]:m[3]])
			working = strings.TrimSpace(working[:m[0]])
		}
	}

	working = reLeadNextEndGo.ReplaceAllString(working, "")

	if containerChannel == "" && strings.Contains(working, "|") {
		pipeParts := strings.Split(working, "|")
		var trimmed []string
		for _, p := range pipeParts {
			if t := strings.TrimSpace(p); t != "" {
				trimmed = append(trimmed, t)
			}
		}
		if len(trimmed) >= 2 {
			last := trimmed[len(trimmed)-1]
			lastLower := strings.ToLower(last)
			isDateOrTimeOrVs := strings.Contains(lastLower, "vs") ||
				strings.Contains(lastLower, " - ") ||
				strings.Contains(lastLower, " @ ") ||
				rePipeHasTimeGo.MatchString(last) ||
				rePipeWeekdayGo.MatchString(last) ||
				rePipeMonthGo.MatchString(last) ||
				rePipeQualEndGo.MatchString(last)
			if len(last) >= 2 && len(last) <= 35 && !isDateOrTimeOrVs {
				containerChannel = last
				trimmed = trimmed[:len(trimmed)-1]
				if len(trimmed) > 1 {
					prev := trimmed[len(trimmed)-1]
					if rePipeQualPrevGo.MatchString(prev) {
						trimmed = trimmed[:len(trimmed)-1]
					}
				}
				working = strings.Join(trimmed, " | ")
			}
		}
	}

	if containerChannel == "" {
		if m := reLeadPrefGo.FindStringSubmatch(working); m != nil {
			cand := strings.TrimSpace(m[1])
			rem := strings.TrimSpace(m[2])
			isTimePrefix := reTimePrefixGo.MatchString(cand)
			lowCand := strings.ToLower(cand)
			if !isTimePrefix && !strings.Contains(lowCand, " vs") && !strings.Contains(lowCand, " v ") && !strings.Contains(lowCand, " v. ") && !strings.Contains(cand, " @ ") && !strings.Contains(cand, " - ") {
				containerChannel = cand
				working = rem
			}
		}
	}
	if containerChannel == "" {
		containerChannel = strings.TrimSpace(channelName)
	}

	year, month, day := refNow.UTC().Date()
	dateStr := ""
	if strings.TrimSpace(cfg.DateRegex) != "" {
		if customDateRe, err := regexp.Compile(cfg.DateRegex); err == nil {
			if m := customDateRe.FindStringSubmatch(working); len(m) > 0 {
				dateStr = strings.TrimSpace(m[0])
				working = strings.Replace(working, m[0], " ", 1)
			}
		}
	}
	hasTime := false
	hours, minutes := 0, 0
	timeStr := ""
	tzStr := ""

	if dateStr == "" {
		if m := reIsoDateTimeGo.FindStringSubmatch(working); m != nil {
			year, _ = strconv.Atoi(m[1])
			mInt, _ := strconv.Atoi(m[2])
			month = time.Month(mInt)
			day, _ = strconv.Atoi(m[3])
			dateStr = m[1] + "-" + m[2] + "-" + m[3]
			hours, _ = strconv.Atoi(m[4])
			minutes, _ = strconv.Atoi(m[5])
			hasTime = true
			timeStr = m[4] + ":" + m[5]
			if strings.HasSuffix(strings.ToUpper(m[0]), "Z") {
				tzStr = "UTC"
			}
			working = strings.Replace(working, m[0], " ", 1)
		} else if m := reIsoDateGo.FindStringSubmatch(working); m != nil {
			year, _ = strconv.Atoi(m[1])
			mInt, _ := strconv.Atoi(m[2])
			month = time.Month(mInt)
			day, _ = strconv.Atoi(m[3])
			dateStr = m[0]
			working = strings.Replace(working, m[0], " ", 1)
		} else if m := reDmyDateGo.FindStringSubmatch(working); m != nil {
			day, _ = strconv.Atoi(m[1])
			mInt, _ := strconv.Atoi(m[2])
			month = time.Month(mInt)
			year, _ = strconv.Atoi(m[3])
			dateStr = m[0]
			working = strings.Replace(working, m[0], " ", 1)
		} else if m := reDayMonthGo.FindStringSubmatch(working); m != nil {
			day, _ = strconv.Atoi(m[1])
			if gm, ok := goMonthMap[strings.ToLower(m[2][:3])]; ok {
				month = gm
			}
			if m[3] != "" {
				year, _ = strconv.Atoi(m[3])
			}
			dateStr = strings.TrimSpace(m[0])
			working = strings.Replace(working, m[0], " ", 1)
		} else if m := reMonthDayGo.FindStringSubmatch(working); m != nil {
			if gm, ok := goMonthMap[strings.ToLower(m[1][:3])]; ok {
				month = gm
			}
			day, _ = strconv.Atoi(m[2])
			if m[3] != "" {
				year, _ = strconv.Atoi(m[3])
			}
			dateStr = strings.TrimSpace(m[0])
			working = strings.Replace(working, m[0], " ", 1)
		}
	}

	if strings.TrimSpace(cfg.TimeRegex) != "" {
		if customTimeRe, err := regexp.Compile(cfg.TimeRegex); err == nil {
			if m := customTimeRe.FindStringSubmatch(working); len(m) > 0 {
				if sub := reHhmmTimeGo.FindStringSubmatch(m[0]); sub != nil {
					h, _ := strconv.Atoi(sub[1])
					min, _ := strconv.Atoi(sub[2])
					mer := strings.ToLower(sub[4])
					if mer == "pm" && h < 12 {
						h += 12
					} else if mer == "am" && h == 12 {
						h = 0
					}
					hours, minutes, hasTime = h, min, true
					timeStr = strings.TrimSpace(m[0])
					tzStr = strings.ToUpper(sub[5])
					working = strings.Replace(working, m[0], " ", 1)
				}
			}
		}
	}

	if !hasTime {
		if m := reHhmmTimeGo.FindStringSubmatch(working); m != nil {
			h, _ := strconv.Atoi(m[1])
			min, _ := strconv.Atoi(m[2])
			mer := strings.ToLower(m[4])
			tz := strings.ToUpper(m[5])
			if min >= 0 && min < 60 && h >= 0 && h <= 23 {
				if mer == "pm" && h < 12 {
					h += 12
				}
				if mer == "am" && h == 12 {
					h = 0
				}
				hours, minutes, hasTime = h, min, true
				timeStr = m[1] + ":" + m[2]
				if mer != "" {
					timeStr += " " + strings.ToUpper(mer)
				}
				tzStr = tz
				working = strings.Replace(working, m[0], " ", 1)
			}
		} else if m := reCompactTimeGo.FindStringSubmatch(working); m != nil {
			h, _ := strconv.Atoi(m[1])
			mer := strings.ToLower(m[2])
			tz := strings.ToUpper(m[3])
			if h >= 1 && h <= 12 {
				if mer == "pm" && h < 12 {
					h += 12
				}
				if mer == "am" && h == 12 {
					h = 0
				}
				hours, minutes, hasTime = h, 0, true
				timeStr = m[1] + strings.ToUpper(mer)
				tzStr = tz
				working = strings.Replace(working, m[0], " ", 1)
			}
		}
	}

	cleaned := reQualityTagsGo.ReplaceAllString(working, " ")
	cleaned = reAudioTagsGo.ReplaceAllString(cleaned, " ")
	cleaned = reArabicGo.ReplaceAllString(cleaned, " ")
	cleaned = strings.Trim(cleaned, " -=_*~•|/@()")
	cleaned = strings.Join(strings.Fields(cleaned), " ")

	if dm := reDriverFeedGo.FindStringSubmatch(channelName); dm != nil {
		cleaned = fmt.Sprintf("%s (%s)", strings.TrimSpace(dm[1]), strings.TrimSpace(dm[2]))
	}

	if strings.TrimSpace(cfg.TitleRegex) != "" {
		if customTitleRe, err := regexp.Compile(cfg.TitleRegex); err == nil {
			if m := customTitleRe.FindStringSubmatch(cleaned); len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				cleaned = strings.TrimSpace(m[1])
			} else if len(m) > 0 && strings.TrimSpace(m[0]) != "" {
				cleaned = strings.TrimSpace(m[0])
			}
		}
	}

	// Split multi-segment titles (e.g. "Afghanistan - Marocco | Finale 3° posto...") so extra segments don't pollute team2
	var rawSegments []string
	for _, seg := range reSegSplitGo.Split(cleaned, -1) {
		if s := strings.TrimSpace(seg); s != "" {
			rawSegments = append(rawSegments, s)
		}
	}
	primarySegment := cleaned
	if len(rawSegments) > 1 {
		for _, seg := range rawSegments {
			if reSegHasMatchupGo.MatchString(seg) {
				primarySegment = seg
				break
			}
		}
	}

	cleanedWithoutSport := reLeadSportPrefGo.ReplaceAllString(primarySegment, "")

	team1, team2 := "", ""
	delimsRaw := cfg.TeamDelimiters
	if strings.TrimSpace(delimsRaw) == "" {
		delimsRaw = "vs., vs, versus, v., v, @, -"
	}
	for _, rawDelim := range strings.Split(delimsRaw, ",") {
		d := strings.TrimSpace(rawDelim)
		if d == "" {
			continue
		}
		sep := " " + d + " "
		idx := strings.Index(strings.ToLower(cleanedWithoutSport), strings.ToLower(sep))
		if idx > 0 {
			t1 := strings.TrimSpace(cleanedWithoutSport[:idx])
			t2 := strings.TrimSpace(cleanedWithoutSport[idx+len(sep):])
			if (strings.EqualFold(d, "v.") || strings.EqualFold(d, "v") || strings.EqualFold(d, "x")) &&
				len(t1) > 0 && strings.ContainsAny(t1[len(t1)-1:], "-/&@:|([") {
				continue
			}
			if d != "-" {
				if lastCol := strings.LastIndex(t1, ": "); lastCol >= 0 {
					t1 = strings.TrimSpace(t1[lastCol+2:])
				}
				if lastDash := strings.LastIndex(t1, " - "); lastDash >= 0 {
					t1 = strings.TrimSpace(t1[lastDash+3:])
				}
			} else {
				if dashParts := strings.Split(cleanedWithoutSport, " - "); len(dashParts) >= 3 {
					t1 = strings.TrimSpace(dashParts[len(dashParts)-2])
					t2 = strings.TrimSpace(dashParts[len(dashParts)-1])
				}
				isNonTeam := reNonTeamRhsGo.MatchString(t2) ||
					reDigitsOnlyGo.MatchString(t2) ||
					reNonTeamLhsGo.MatchString(t1)
				if isNonTeam {
					continue
				}
			}
			team1 = strings.TrimSpace(reRankPrefixGo.ReplaceAllString(reColonSuffixGo.ReplaceAllString(t1, ""), ""))
			team2 = strings.TrimSpace(reRankPrefixGo.ReplaceAllString(reColonSuffixGo.ReplaceAllString(t2, ""), ""))
			break
		}
	}

	subtitle := ""
	if strings.TrimSpace(cfg.SubtitleRegex) != "" {
		if customSubRe, err := regexp.Compile(cfg.SubtitleRegex); err == nil {
			if m := customSubRe.FindStringSubmatch(channelName); len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				subtitle = strings.TrimSpace(m[1])
			} else if len(m) > 0 && strings.TrimSpace(m[0]) != "" {
				subtitle = strings.TrimSpace(m[0])
			} else if m2 := customSubRe.FindStringSubmatch(cleaned); len(m2) > 1 && strings.TrimSpace(m2[1]) != "" {
				subtitle = strings.TrimSpace(m2[1])
			} else if len(m2) > 0 && strings.TrimSpace(m2[0]) != "" {
				subtitle = strings.TrimSpace(m2[0])
			}
		}
	}
	if subtitle == "" && team1 != "" && team2 != "" && len(rawSegments) > 1 {
		var extra []string
		for _, seg := range rawSegments {
			if seg != primarySegment {
				extra = append(extra, seg)
			}
		}
		if len(extra) > 0 {
			subtitle = strings.Join(extra, " • ")
		}
	}

	displayEvent := cleaned
	if team1 != "" && team2 != "" {
		displayEvent = cleanedWithoutSport
	}

	sportLabel, durMin := detectGoSportAndDuration(categoryName, channelName, team1, team2)
	if cfg.DurationMode == "custom" && cfg.CustomDurationMinutes > 0 {
		durMin = cfg.CustomDurationMinutes
	}

	vars := map[string]string{
		"event":      displayEvent,
		"subtitle":   subtitle,
		"team1":      team1,
		"team2":      team2,
		"team1_full": team1,
		"team2_full": team2,
		"sport":      sportLabel,
		"league":     sportLabel,
		"time":       timeStr,
		"date":       dateStr,
		"channel":    containerChannel,
		"category":   categoryName,
	}

	dayStart := time.Date(refNow.Year(), refNow.Month(), refNow.Day(), 0, 0, 0, 0, time.UTC).Add(-6 * time.Hour)
	dayEnd := dayStart.Add(96 * time.Hour)

	if explicitNoEvent || len(cleaned) < 3 {
		fbTitle := interpolateGoAed(cfg.FallbackTitleTemplate, vars)
		fbDesc := interpolateGoAed(cfg.FallbackDescTemplate, vars)
		return []EpgCreatorEvent{
			{
				ID:       1,
				T:        fbTitle,
				D:        ptrString(fbDesc),
				Start:    dayStart.Format(time.RFC3339),
				Stop:     dayStart.Add(2 * time.Hour).Format(time.RFC3339),
				R:        1,
				Fallback: true,
			},
		}
	}

	if explicitEnded {
		endTitle := interpolateGoAed(cfg.EndedTitleTemplate, vars)
		endDesc := interpolateGoAed(cfg.EndedDescTemplate, vars)
		return []EpgCreatorEvent{
			{
				ID:    1,
				T:     endTitle,
				D:     ptrString(endDesc),
				Start: dayStart.Format(time.RFC3339),
				Stop:  dayStart.Add(2 * time.Hour).Format(time.RFC3339),
				R:     1,
			},
		}
	}

	if !hasTime {
		liveTitle := interpolateGoAed(cfg.LiveTitleTemplate, vars)
		liveDesc := interpolateGoAed(cfg.LiveDescTemplate, vars)
		return []EpgCreatorEvent{
			{
				ID:    1,
				T:     liveTitle,
				D:     ptrString(liveDesc),
				Start: dayStart.Format(time.RFC3339),
				Stop:  dayStart.Add(2 * time.Hour).Format(time.RFC3339),
				R:     1,
				Live:  true,
			},
		}
	}

	offsetHours := -5
	if tzStr != "" {
		if off, ok := goTzOffsetMap[tzStr]; ok {
			offsetHours = off
		}
	} else if off, ok := goTzOffsetMap[strings.ToUpper(cfg.SourceTimezone)]; ok {
		offsetHours = off
	}

	matchStart := time.Date(year, month, day, hours, minutes, 0, 0, time.UTC).Add(-time.Duration(offsetHours) * time.Hour)
	liveStart := matchStart.Add(-time.Duration(cfg.PreWindowMinutes) * time.Minute)
	liveStop := matchStart.Add(time.Duration(durMin+cfg.PostWindowMinutes) * time.Minute)

	beforeTitle := interpolateGoAed(cfg.UpcomingTitleTemplate, vars)
	beforeDesc := interpolateGoAed(cfg.UpcomingDescTemplate, vars)
	liveTitle := interpolateGoAed(cfg.LiveTitleTemplate, vars)
	liveDesc := interpolateGoAed(cfg.LiveDescTemplate, vars)
	afterTitle := interpolateGoAed(cfg.EndedTitleTemplate, vars)
	afterDesc := interpolateGoAed(cfg.EndedDescTemplate, vars)

	var events []EpgCreatorEvent
	idCounter := 1

	cursor := dayStart
	if liveStart.Add(-12 * time.Hour).Before(cursor) {
		cursor = liveStart.Add(-12 * time.Hour)
	}
	for cursor.Before(liveStart) {
		nextStop := cursor.Add(2 * time.Hour)
		if nextStop.After(liveStart) {
			nextStop = liveStart
		}
		events = append(events, EpgCreatorEvent{
			ID:    idCounter,
			T:     beforeTitle,
			D:     ptrString(beforeDesc),
			Start: cursor.Format(time.RFC3339),
			Stop:  nextStop.Format(time.RFC3339),
			R:     0,
		})
		idCounter++
		cursor = nextStop
	}

	events = append(events, EpgCreatorEvent{
		ID:    idCounter,
		T:     liveTitle,
		D:     ptrString(liveDesc),
		Start: liveStart.Format(time.RFC3339),
		Stop:  liveStop.Format(time.RFC3339),
		R:     0,
		Live:  true,
	})
	idCounter++

	cursor = liveStop
	for cursor.Before(dayEnd) {
		nextStop := cursor.Add(3 * time.Hour)
		if nextStop.After(dayEnd) {
			nextStop = dayEnd
		}
		events = append(events, EpgCreatorEvent{
			ID:    idCounter,
			T:     afterTitle,
			D:     ptrString(afterDesc),
			Start: cursor.Format(time.RFC3339),
			Stop:  nextStop.Format(time.RFC3339),
			R:     0,
		})
		idCounter++
		cursor = nextStop
	}

	events = append(events, EpgCreatorEvent{
		ID:    idCounter,
		T:     afterTitle,
		D:     ptrString(afterDesc),
		Start: liveStop.Format(time.RFC3339),
		Stop:  liveStop.Add(2 * time.Hour).Format(time.RFC3339),
		R:     1,
	})

	return events
}

// GenerateAedEventsForChannel is a package-level helper for DefaultAedGenerator.GenerateEventsForChannel.
func GenerateAedEventsForChannel(channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) []EpgCreatorEvent {
	return DefaultAedGenerator.GenerateEventsForChannel(channelName, categoryName, cfg, refNow)
}

// ExpandCreatorProgrammes expands custom EPG creator or AED events (r=0,1,2,3) into an EpgProgrammeItem slice.
func (g *AedEpgGenerator) ExpandCreatorProgrammes(epgID string, rawEvents []EpgCreatorEvent, channelName string, now time.Time) []EpgProgrammeItem {
	dayBase := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -1)
	days := 7

	var slots []aedCreatorSlot

	parseISO := func(s string) (time.Time, bool) {
		s = strings.TrimSpace(s)
		if s == "" {
			return time.Time{}, false
		}
		for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02 15:04:05", "2006-01-02T15:04"} {
			if t, err := time.Parse(layout, s); err == nil {
				return t.UTC(), true
			}
		}
		return time.Time{}, false
	}

	// 1. One-time events (r == 0)
	for _, e := range rawEvents {
		if e.R != 0 {
			continue
		}
		st, ok1 := parseISO(e.Start)
		et, ok2 := parseISO(e.Stop)
		if ok1 && ok2 && et.After(st) {
			title := strings.TrimSpace(e.T)
			if title == "" {
				title = "Programme"
			}
			slots = append(slots, aedCreatorSlot{
				Start:       st,
				Stop:        et,
				Title:       title,
				Description: derefString(e.D),
				Index:       e.ID,
				Live:        e.Live,
			})
		}
	}

	// 2. Daily recurring events (r == 2)
	for _, e := range rawEvents {
		if e.R != 2 {
			continue
		}
		origStart, ok1 := parseISO(e.Start)
		origStop, ok2 := parseISO(e.Stop)
		if !ok1 || !ok2 {
			continue
		}
		dur := origStop.Sub(origStart)
		if dur < time.Minute {
			dur = time.Minute
		}
		title := strings.TrimSpace(e.T)
		if title == "" {
			title = "Programme"
		}
		for i := 0; i < days+2; i++ {
			d := dayBase.AddDate(0, 0, i)
			st := time.Date(d.Year(), d.Month(), d.Day(), origStart.Hour(), origStart.Minute(), origStart.Second(), 0, time.UTC)
			slots = append(slots, aedCreatorSlot{
				Start:       st,
				Stop:        st.Add(dur),
				Title:       title,
				Description: derefString(e.D),
				Index:       e.ID,
				Live:        e.Live,
			})
		}
	}

	// 3. Weekly recurring events (r == 3)
	for _, e := range rawEvents {
		if e.R != 3 {
			continue
		}
		origStart, ok1 := parseISO(e.Start)
		origStop, ok2 := parseISO(e.Stop)
		if !ok1 || !ok2 {
			continue
		}
		dur := origStop.Sub(origStart)
		if dur < time.Minute {
			dur = time.Minute
		}
		targetDay := origStart.Weekday()
		title := strings.TrimSpace(e.T)
		if title == "" {
			title = "Programme"
		}
		for i := 0; i < days+14; i++ {
			d := dayBase.AddDate(0, 0, i)
			if d.Weekday() == targetDay {
				st := time.Date(d.Year(), d.Month(), d.Day(), origStart.Hour(), origStart.Minute(), origStart.Second(), 0, time.UTC)
				slots = append(slots, aedCreatorSlot{
					Start:       st,
					Stop:        st.Add(dur),
					Title:       title,
					Description: derefString(e.D),
					Index:       e.ID,
					Live:        e.Live,
				})
			}
		}
	}

	// 4. Dummy gap filler (r == 1) or fallback if empty
	var dummyEvent *EpgCreatorEvent
	for i := range rawEvents {
		if rawEvents[i].R == 1 {
			dummyEvent = &rawEvents[i]
			break
		}
	}
	if dummyEvent == nil && len(slots) == 0 && strings.TrimSpace(channelName) != "" {
		dummyEvent = &EpgCreatorEvent{
			ID: 1,
			T:  strings.TrimSpace(channelName),
			D:  ptrString(""),
			R:  1,
		}
	}

	if dummyEvent != nil {
		dummyTitle := strings.TrimSpace(dummyEvent.T)
		if dummyTitle == "" {
			dummyTitle = "Programme"
		}
		cursor := dayBase
		end := dayBase.AddDate(0, 0, days)
		for cursor.Before(end) {
			stop := cursor.Add(2 * time.Hour)
			var near *aedCreatorSlot
			for i := range slots {
				if math.Abs(slots[i].Start.Sub(cursor).Seconds()) < 240 {
					near = &slots[i]
					break
				}
			}
			if near != nil {
				cursor = near.Stop
				continue
			}

			var overlap *aedCreatorSlot
			for i := range slots {
				if cursor.Before(slots[i].Start) && stop.After(slots[i].Start) {
					overlap = &slots[i]
					break
				}
			}
			if overlap != nil {
				stop = overlap.Start
				slots = append(slots, aedCreatorSlot{
					Start:       cursor,
					Stop:        stop,
					Title:       dummyTitle,
					Description: derefString(dummyEvent.D),
					Index:       dummyEvent.ID,
					Live:        dummyEvent.Live,
					Fallback:    dummyEvent.Fallback,
				})
				cursor = overlap.Stop
				continue
			}

			slots = append(slots, aedCreatorSlot{
				Start:       cursor,
				Stop:        stop,
				Title:       dummyTitle,
				Description: derefString(dummyEvent.D),
				Index:       dummyEvent.ID,
				Live:        dummyEvent.Live,
				Fallback:    dummyEvent.Fallback,
			})
			cursor = stop
		}
	}

	cutoff := now.Add(-18 * time.Hour)
	sort.Slice(slots, func(i, j int) bool {
		return slots[i].Start.Before(slots[j].Start)
	})

	var items []EpgProgrammeItem
	for _, s := range slots {
		if s.Stop.Before(cutoff) {
			continue
		}
		desc := s.Description
		isLive := s.Live || strings.Contains(s.Title, "ᴸᶦᵛᵉ") || strings.Contains(strings.ToLower(s.Title), "(live)")
		item := EpgProgrammeItem{
			ID:         epgID,
			Title:      s.Title,
			Start:      s.Start.Unix(),
			Stop:       s.Stop.Unix(),
			Live:       isLive,
			IsFallback: s.Fallback,
		}
		if desc != "" {
			item.Description = &desc
		}
		items = append(items, item)
	}
	return items
}

// ExpandCreatorProgrammes is a package-level helper for DefaultAedGenerator.ExpandCreatorProgrammes.
func ExpandCreatorProgrammes(epgID string, rawEvents []EpgCreatorEvent, channelName string, now time.Time) []EpgProgrammeItem {
	return DefaultAedGenerator.ExpandCreatorProgrammes(epgID, rawEvents, channelName, now)
}

// GenerateProgrammesForChannel parses the channel name and immediately expands its 3-stage AED schedule
// into a ready-to-serve slice of EpgProgrammeItem.
func (g *AedEpgGenerator) GenerateProgrammesForChannel(epgID, channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) []EpgProgrammeItem {
	events := g.GenerateEventsForChannel(channelName, categoryName, cfg, refNow)
	return g.ExpandCreatorProgrammes(epgID, events, channelName, refNow)
}

// GenerateProgrammePointersForChannel returns pointers to EpgProgrammeItem (useful for externalapi XMLTV / Player API).
func (g *AedEpgGenerator) GenerateProgrammePointersForChannel(epgID, channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) []*EpgProgrammeItem {
	items := g.GenerateProgrammesForChannel(epgID, channelName, categoryName, cfg, refNow)
	ptrs := make([]*EpgProgrammeItem, len(items))
	for i := range items {
		ptrs[i] = &items[i]
	}
	return ptrs
}

// AedVisibilityResult represents the evaluated visibility state of an AED-assigned channel.
type AedVisibilityResult struct {
	Status           string // "event_timed" | "event_untimed" | "ended_explicit" | "fallback"
	IsEnded          bool
	IsFallback       bool
	IsLiveOrUpcoming bool
	ShouldHide       *bool // nil = leave unchanged, true = hide, false = unhide
}

// EvaluateChannelVisibility evaluates whether an AED-assigned channel should be hidden, unhidden,
// or left unchanged based on its parsed event state and the playlist's auto-hide settings.
func (g *AedEpgGenerator) EvaluateChannelVisibility(channelName, categoryName string, cfg AedRuleConfig, refNow time.Time) AedVisibilityResult {
	events := g.GenerateEventsForChannel(channelName, categoryName, cfg, refNow)
	res := AedVisibilityResult{Status: "fallback"}

	if len(events) == 1 && events[0].Fallback {
		res.Status = "fallback"
		res.IsFallback = true
	} else if len(events) == 1 && events[0].R == 1 && !events[0].Live {
		res.Status = "ended_explicit"
		res.IsEnded = true
	} else if len(events) == 1 && events[0].R == 1 && events[0].Live {
		res.Status = "event_untimed"
		res.IsLiveOrUpcoming = true
	} else {
		res.Status = "event_timed"
		var liveStop time.Time
		hasLiveStop := false
		for _, ev := range events {
			if ev.Live {
				if parsedStop, err := time.Parse(time.RFC3339, ev.Stop); err == nil {
					liveStop = parsedStop
					hasLiveStop = true
				}
				break
			}
		}
		if hasLiveStop && refNow.After(liveStop) {
			res.IsEnded = true
		} else {
			res.IsLiveOrUpcoming = true
		}
	}

	if !cfg.AutoHideEnded && !cfg.AutoHideFallback {
		return res
	}

	if (cfg.AutoHideEnded && res.IsEnded) || (cfg.AutoHideFallback && res.IsFallback) {
		v := true
		res.ShouldHide = &v
		return res
	}

	if res.IsLiveOrUpcoming {
		v := false
		res.ShouldHide = &v
		return res
	}

	return res
}
