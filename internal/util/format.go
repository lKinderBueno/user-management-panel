package util

import (
	"strconv"
	"strings"
)

// FormatNumber formats an integer with thousands comma separators (e.g. 600000 -> "600,000").
func FormatNumber(n int) string {
	if n < 0 {
		return "-" + FormatNumber(-n)
	}
	in := strconv.Itoa(n)
	if len(in) <= 3 {
		return in
	}
	var sb strings.Builder
	rem := len(in) % 3
	if rem > 0 {
		sb.WriteString(in[:rem])
	}
	for i := rem; i < len(in); i += 3 {
		if sb.Len() > 0 {
			sb.WriteByte(',')
		}
		sb.WriteString(in[i : i+3])
	}
	return sb.String()
}
