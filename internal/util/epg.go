package util

import "strings"

// IsDummyStreamID checks if an EPG ID matches the dummy stream pattern: "dummy-" followed by digits
// (e.g. "dummy-12", "dummy-5001"), used by IPTVEditor to generate dummy EPG using the stream name.
func IsDummyStreamID(epgID string) bool {
	lower := strings.ToLower(strings.TrimSpace(epgID))
	if !strings.HasPrefix(lower, "dummy-") {
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
