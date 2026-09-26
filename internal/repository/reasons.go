package repository

import "fmt"

// FormatAttemptType maps internal attempt type codes to clear human-friendly English descriptions.
func FormatAttemptType(attemptType string) string {
	switch attemptType {
	case "api_token":
		return "REST API Token"
	case "admin_login":
		return "Admin Panel Login"
	case "stream_auth":
		return "Stream Line Auth"
	case "xtream_auth":
		return "Xtream Codes API"
	case "stalker_auth":
		return "Stalker Portal"
	case "short_url":
		return "Short Link / Playlist URL"
	default:
		if attemptType == "" {
			return "Unknown Auth Channel"
		}
		return attemptType
	}
}

// FormatReason maps internal error codes to clear human-friendly English descriptions.
func FormatReason(reason string) string {
	switch reason {
	case "invalid_credentials":
		return "Invalid username or password"
	case "invalid_or_expired_token":
		return "Invalid or expired API token"
	case "invalid_token_password":
		return "Incorrect API token password"
	case "api_token_expired":
		return "API token has expired"
	case "api_token_disabled":
		return "API token is disabled"
	case "token_ip_not_allowed":
		return "Client IP address not whitelisted"
	case "token_not_found":
		return "API token or link not found"
	case "account_expired":
		return "User account subscription has expired"
	case "cname_enforcement_failed":
		return "Domain mismatch (CNAME enforcement failed)"
	case "missing_credentials":
		return "Missing username or password"
	case "invalid_captcha":
		return "Invalid or expired CAPTCHA challenge"
	case "bad_pass":
		return "Incorrect password"
	case "user_disabled":
		return "User account is suspended or disabled"
	case "max_connections_reached":
		return "Maximum concurrent active streams exceeded"
	case "country_not_allowed":
		return "Geo-restriction: country not permitted"
	case "user_agent_blocked":
		return "Player User-Agent is blocked by security policy"
	case "rate_limit_exceeded":
		return "Rate limit exceeded"
	default:
		if reason == "" {
			return "Authentication failed"
		}
		return reason
	}
}

// BuildBlockedReason generates a clear, professional ban explanation without alarmist phrasing.
func BuildBlockedReason(attempts int, attemptType, reason string) string {
	attemptWord := "attempts"
	if attempts == 1 {
		attemptWord = "attempt"
	}
	typeLabel := FormatAttemptType(attemptType)

	if reason != "" {
		reasonLabel := FormatReason(reason)
		return fmt.Sprintf("Exceeded failed attempts limit (%d %s) on %s: %s", attempts, attemptWord, typeLabel, reasonLabel)
	}
	return fmt.Sprintf("Exceeded failed attempts limit (%d %s) on %s", attempts, attemptWord, typeLabel)
}
