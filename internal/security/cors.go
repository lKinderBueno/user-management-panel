package security

import (
	"net/http"
	"strings"
)

// CORSMiddleware provides comprehensive, high-performance Cross-Origin Resource Sharing (CORS)
// open to all hosts, origins, methods, and headers.
//
// Key capabilities:
// 1. Immediately handles preflight OPTIONS requests with HTTP 200 and full CORS allowance.
// 2. If an Origin header is present (and not "null"), it dynamically reflects the origin and enables
//    Access-Control-Allow-Credentials to support authenticated requests (e.g. fetch with credentials: 'include').
// 3. If no Origin is present (e.g. curl, native players, media elements) or Origin is "null", it sets "*" wildcard.
// 4. Exposes critical streaming headers (Location, Content-Length, Content-Range, Accept-Ranges) so browser
//    web players (HLS.js, Video.js, Shaka Player, etc.) can inspect stream metadata and follow 302 redirects.
// 5. Supports all standard HTTP methods including HEAD for stream probe requests.
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// 1. Set Access-Control-Allow-Origin & Credentials
		if origin != "" && origin != "null" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		// 2. Allowed Methods (must include HEAD for video players & probes)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH")

		// 3. Allowed Headers: mirror requested headers or permit wildcard
		reqHeaders := r.Header.Get("Access-Control-Request-Headers")
		if reqHeaders != "" {
			w.Header().Set("Access-Control-Allow-Headers", reqHeaders)
		} else {
			w.Header().Set("Access-Control-Allow-Headers", "*")
		}

		// 4. Exposed Headers: crucial for web players reading stream sizes, byte-ranges, and redirect targets
		w.Header().Set("Access-Control-Expose-Headers", "*, Content-Length, Content-Range, Accept-Ranges, Location, Date, Server, Content-Type")

		// 5. Cache Preflight responses for 24 hours (86400s)
		w.Header().Set("Access-Control-Max-Age", "86400")

		// 6. Vary header to ensure intermediate caches/CDNs cache per-origin
		w.Header().Add("Vary", "Origin")

		// 7. Handle OPTIONS Preflight requests directly
		if strings.EqualFold(r.Method, http.MethodOptions) {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
