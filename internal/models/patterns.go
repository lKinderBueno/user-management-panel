package models

import "strings"

// PatternKey returns the normalized identifier key for a pattern item based strictly on its URL.
// Matching is strictly by URL: trimmed, lowercased, and without trailing slashes.
// If URL is empty, an empty string is returned (empty URLs do not match other patterns).
func PatternKey(p PatternItem) string {
	return strings.TrimRight(strings.ToLower(strings.TrimSpace(p.URL)), "/")
}

// MergePatterns merges playlist patterns and user patterns strictly matching by provider URL.
// Playlist patterns serve as the baseline, and any user pattern with a matching URL
// overwrites the playlist pattern. Any extra user patterns whose URL is not in the playlist
// are appended.
func MergePatterns(playlistPatterns, userPatterns []PatternItem) []PatternItem {
	if len(playlistPatterns) == 0 && len(userPatterns) == 0 {
		return nil
	}
	if len(userPatterns) == 0 {
		return playlistPatterns
	}

	userMap := make(map[string]PatternItem, len(userPatterns))
	for _, up := range userPatterns {
		k := PatternKey(up)
		if k != "" {
			userMap[k] = up
		}
	}

	usedUserKeys := make(map[string]bool, len(userPatterns))
	merged := make([]PatternItem, 0, len(playlistPatterns)+len(userPatterns))

	for _, pp := range playlistPatterns {
		k := PatternKey(pp)
		if k != "" {
			if up, found := userMap[k]; found {
				merged = append(merged, up)
				usedUserKeys[k] = true
				continue
			}
		}
		merged = append(merged, pp)
	}

	for _, up := range userPatterns {
		k := PatternKey(up)
		if k == "" || !usedUserKeys[k] {
			merged = append(merged, up)
			if k != "" {
				usedUserKeys[k] = true
			}
		}
	}

	return merged
}
