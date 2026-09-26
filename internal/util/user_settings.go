package util

import (
	"encoding/json"
	"strconv"
	"strings"
)

// UnwrapUserSettings unwraps double or multiple JSON-encoded strings into raw JSON object/bytes.
// If raw is empty or represents "null", it returns nil.
// If raw is a JSON string literal (e.g. `"{\"c\": ...}"`), it unmarshals the string iteratively
// until it reaches the inner JSON object/array/value.
func UnwrapUserSettings(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return nil
	}

	current := []byte(trimmed)
	for {
		var s string
		if err := json.Unmarshal(current, &s); err == nil {
			s = strings.TrimSpace(s)
			if s == "" || s == "null" {
				return nil
			}
			current = []byte(s)
		} else {
			break
		}
	}
	return current
}

// NormalizeUserSettings validates and unwraps user settings JSON to ensure it is stored
// as a clean bare JSON object (e.g. {"c":...}), returning nil if empty or invalid.
func NormalizeUserSettings(raw json.RawMessage) *string {
	unwrapped := UnwrapUserSettings(raw)
	if len(unwrapped) == 0 {
		return nil
	}
	trimmed := strings.TrimSpace(string(unwrapped))
	if !strings.HasPrefix(trimmed, "{") || !strings.HasSuffix(trimmed, "}") {
		return nil
	}
	if !json.Valid([]byte(trimmed)) {
		return nil
	}
	return &trimmed
}

// ParseUserSettingsHiddenCategories extracts hidden category IDs from user_settings JSON.
// Returns hiddenLive, hiddenVods, hiddenSeries.
func ParseUserSettingsHiddenCategories(raw json.RawMessage) ([]uint64, []uint64, []uint64) {
	unwrapped := UnwrapUserSettings(raw)
	if len(unwrapped) == 0 {
		return nil, nil, nil
	}

	var root map[string]any
	if err := json.Unmarshal(unwrapped, &root); err != nil {
		return nil, nil, nil
	}

	parseHC := func(key string) []uint64 {
		sub, ok := root[key].(map[string]any)
		if !ok || sub == nil {
			return nil
		}
		rawHC, ok := sub["hc"].([]any)
		if !ok || len(rawHC) == 0 {
			return nil
		}
		ids := make([]uint64, 0, len(rawHC))
		for _, item := range rawHC {
			switch val := item.(type) {
			case float64:
				if val > 0 {
					ids = append(ids, uint64(val))
				}
			case int:
				if val > 0 {
					ids = append(ids, uint64(val))
				}
			case int64:
				if val > 0 {
					ids = append(ids, uint64(val))
				}
			case string:
				if id, err := strconv.ParseUint(val, 10, 64); err == nil && id > 0 {
					ids = append(ids, id)
				}
			case json.Number:
				if id, err := strconv.ParseUint(string(val), 10, 64); err == nil && id > 0 {
					ids = append(ids, id)
				}
			}
		}
		return ids
	}

	return parseHC("c"), parseHC("m"), parseHC("s")
}

// UpdateUserSettingsHiddenCategories updates or creates user_settings JSON with new hidden categories,
// preserving all other fields in c, m, s, d, etc.
func UpdateUserSettingsHiddenCategories(existing json.RawMessage, hiddenLive, hiddenVods, hiddenSeries []uint64) ([]byte, error) {
	unwrapped := UnwrapUserSettings(existing)
	var root map[string]any
	if len(unwrapped) > 0 {
		if err := json.Unmarshal(unwrapped, &root); err != nil {
			root = nil
		}
	}
	if root == nil {
		root = make(map[string]any)
	}

	updateSection := func(key string, hidden []uint64) {
		sub, ok := root[key].(map[string]any)
		if !ok || sub == nil {
			sub = map[string]any{
				"cw": map[string]any{},
				"fs": []any{},
				"sc": "Default",
				"sl": nil,
				"ss": "Default",
			}
			if key == "c" {
				sub["lpc"] = 6
			}
			root[key] = sub
		}
		if hidden == nil {
			sub["hc"] = []uint64{}
		} else {
			sub["hc"] = hidden
		}
	}

	updateSection("c", hiddenLive)
	updateSection("m", hiddenVods)
	updateSection("s", hiddenSeries)

	if _, ok := root["d"]; !ok {
		root["d"] = 0
	}

	return json.Marshal(root)
}

// ContainsCategoryID checks if a category ID is present in a slice of IDs.
func ContainsCategoryID(list []uint64, id uint64) bool {
	for _, item := range list {
		if item == id {
			return true
		}
	}
	return false
}
