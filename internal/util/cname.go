package util

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"strings"
)

// NormalizeHost normalizes a hostname, URL, or host:port string into a clean, lowercased host.
// It removes any scheme (http://, https://), URL path, port numbers, trailing slashes, and dots.
func NormalizeHost(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	// Strip scheme if present
	if idx := strings.Index(raw, "://"); idx != -1 {
		raw = raw[idx+3:]
	}

	// Strip URL path if present
	if idx := strings.Index(raw, "/"); idx != -1 {
		raw = raw[:idx]
	}

	// Strip port if present
	if host, _, err := net.SplitHostPort(raw); err == nil {
		raw = host
	} else if strings.Count(raw, ":") == 1 {
		// Fallback for simple host:port if net.SplitHostPort errored
		parts := strings.Split(raw, ":")
		raw = parts[0]
	}

	raw = strings.TrimSpace(strings.ToLower(raw))
	raw = strings.TrimRight(raw, ".")
	return raw
}

// ExtractRequestHost extracts and normalizes the client request hostname.
// It prioritizes X-Forwarded-Host (for reverse proxy / CDN setups), then Host header, then r.Host.
func ExtractRequestHost(r *http.Request) string {
	if r == nil {
		return ""
	}

	if xfh := r.Header.Get("X-Forwarded-Host"); xfh != "" {
		parts := strings.Split(xfh, ",")
		if host := NormalizeHost(parts[0]); host != "" {
			return host
		}
	}

	if host := r.Header.Get("Host"); host != "" {
		if h := NormalizeHost(host); h != "" {
			return h
		}
	}

	return NormalizeHost(r.Host)
}

// NormalizeHostList splits a string containing one or multiple domains (separated by commas, semicolons, whitespace, or newlines)
// and returns a deduplicated slice of normalized hostnames.
func NormalizeHostList(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	// Replace separators with commas
	replacer := strings.NewReplacer(";", ",", "\n", ",", "\r", ",", "\t", ",", " ", ",")
	cleaned := replacer.Replace(raw)

	parts := strings.Split(cleaned, ",")
	seen := make(map[string]bool)
	var hosts []string

	for _, p := range parts {
		h := NormalizeHost(p)
		if h != "" && !seen[h] {
			seen[h] = true
			hosts = append(hosts, h)
		}
	}
	return hosts
}

// NormalizeCnameEntry normalizes a CNAME domain or domain:port entry.
// It removes any scheme (http://, https://), URL path, trailing slashes, and whitespace,
// while preserving custom non-standard ports (e.g. "dominio.com:8000" stays "dominio.com:8000").
func NormalizeCnameEntry(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	// Strip scheme if present
	if idx := strings.Index(raw, "://"); idx != -1 {
		raw = raw[idx+3:]
	}

	// Strip URL path if present
	if idx := strings.Index(raw, "/"); idx != -1 {
		raw = raw[:idx]
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	// Check if host contains a port
	if host, port, err := net.SplitHostPort(raw); err == nil {
		host = strings.TrimSpace(strings.ToLower(host))
		host = strings.TrimRight(host, ".")
		port = strings.TrimSpace(port)
		if host != "" && port != "" {
			return host + ":" + port
		}
		return host
	} else if strings.Count(raw, ":") == 1 && !strings.Contains(raw, "]") {
		parts := strings.Split(raw, ":")
		host := strings.TrimSpace(strings.ToLower(parts[0]))
		host = strings.TrimRight(host, ".")
		port := strings.TrimSpace(parts[1])
		if host != "" && port != "" {
			return host + ":" + port
		}
		return host
	}

	raw = strings.TrimSpace(strings.ToLower(raw))
	raw = strings.TrimRight(raw, ".")
	return raw
}

// NormalizeCnameList splits a string containing one or multiple domains/domain:ports
// (separated by commas, semicolons, whitespace, or newlines) and returns a deduplicated slice of normalized entries,
// preserving custom ports.
func NormalizeCnameList(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	replacer := strings.NewReplacer(";", ",", "\n", ",", "\r", ",", "\t", ",", " ", ",")
	cleaned := replacer.Replace(raw)

	parts := strings.Split(cleaned, ",")
	seen := make(map[string]bool)
	var entries []string

	for _, p := range parts {
		entry := NormalizeCnameEntry(p)
		if entry != "" && !seen[entry] {
			seen[entry] = true
			entries = append(entries, entry)
		}
	}
	return entries
}

// PrimaryHost returns the first normalized host from a raw host string (e.g. "domain1.com, domain2.com" -> "domain1.com").
func PrimaryHost(raw string) string {
	list := NormalizeHostList(raw)
	if len(list) > 0 {
		return list[0]
	}
	return ""
}

// HostMatchesList returns true if targetHost matches any host in the raw host list.
func HostMatchesList(targetHost, rawList string) bool {
	target := NormalizeHost(targetHost)
	if target == "" {
		return false
	}
	for _, h := range NormalizeHostList(rawList) {
		if h == target {
			return true
		}
	}
	return false
}

// ValidateCnameAccess checks whether the incoming request host is permitted for the user's playlist.
// 1. If userEnforceCname is true: The request host MUST match one of the user playlist's CNAMEs.
// 2. If the request host matches another playlist's CNAME:
//    That other playlist's CNAME cannot be accessed by this user if that other playlist has enforce_cname=true
//    or if user's playlist has enforce_cname=true.
func ValidateCnameAccess(ctx context.Context, db *sql.DB, userListID uint64, userCname *string, userEnforceCname bool, requestHost string) (bool, error) {
	cleanReqHost := NormalizeHost(requestHost)
	if cleanReqHost == "" {
		return !userEnforceCname, nil
	}

	var userHosts []string
	if userCname != nil {
		userHosts = NormalizeHostList(*userCname)
	}

	userMatches := false
	for _, h := range userHosts {
		if h == cleanReqHost {
			userMatches = true
			break
		}
	}

	// 1. If user's playlist enforces CNAME:
	if userEnforceCname {
		if len(userHosts) == 0 || !userMatches {
			return false, nil
		}
		return true, nil
	}

	// 2. Check if cleanReqHost matches the CNAME of ANY other playlist.
	if db == nil {
		return true, nil
	}

	query := `
		SELECT id, cname, COALESCE(enforce_cname, 0)
		FROM playlists
		WHERE id != ? AND cname IS NOT NULL AND cname != ''
	`
	rows, err := db.QueryContext(ctx, query, userListID)
	if err != nil {
		return false, fmt.Errorf("failed querying playlist cnames: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var otherID uint64
		var otherCname string
		var otherEnforce int
		if err := rows.Scan(&otherID, &otherCname, &otherEnforce); err != nil {
			continue
		}
		if HostMatchesList(cleanReqHost, otherCname) {
			if otherEnforce == 1 || userEnforceCname {
				return false, nil
			}
		}
	}

	return true, nil
}
