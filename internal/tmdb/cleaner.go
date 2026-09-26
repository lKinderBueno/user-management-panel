package tmdb

import (
	"regexp"
	"strings"
)

var (
	yearRegex         = regexp.MustCompile(`\b(19\d\d|20\d\d)\b`)
	bracketsRegex     = regexp.MustCompile(`\([^\)]*\)|\[[^\]]*\]`)
	prefixRegex       = regexp.MustCompile(`(?i)^\s*([a-z0-9]{1,6}(?:[-_][a-z0-9]{1,6})*\s*[-:|_]+\s*|[a-z]{2,3}\s+)`)
	qualityRegex      = regexp.MustCompile(`(?i)\b(4k|uhd|fhd|superhd|hd|sd|hevc|h264|h265|x264|x265|bluray|dvd|1080p|720p|480p|web-dl|web|remux|dtt|60fps|raw|nf)\b`)
	specialCharsRegex = regexp.MustCompile(`[-:_|*#~]`)
	multiSpaceRegex   = regexp.MustCompile(`\s{2,}`)
)

// CleanVodName cleans a title for TMDB searching, returning the cleaned query and year (if found).
func CleanVodName(name string) (cleanName string, year string) {
	// 1. Extract year
	if match := yearRegex.FindString(name); match != "" {
		year = match
		// remove year from name
		name = strings.Replace(name, match, " ", 1)
	}

	// 2. Remove prefix tags like "IT -", "4K-NF -", "US | "
	name = prefixRegex.ReplaceAllString(name, " ")

	// 3. Remove brackets like "(2024)", "[ITA]"
	name = bracketsRegex.ReplaceAllString(name, " ")

	// 4. Remove quality tags
	name = qualityRegex.ReplaceAllString(name, " ")

	// 5. Remove special separators
	name = specialCharsRegex.ReplaceAllString(name, " ")

	// 6. Collapse spaces and trim
	cleanName = multiSpaceRegex.ReplaceAllString(name, " ")
	cleanName = strings.TrimSpace(cleanName)

	return cleanName, year
}
