package api

import (
	"net/http"
	"strings"

	"playlistlabs_user_management_os/internal/geoip"
)

// GeoIPHandler exposes HTTP endpoints for on-demand IP geolocation.
type GeoIPHandler struct {
	service *geoip.Service
}

// NewGeoIPHandler constructs a new GeoIPHandler.
func NewGeoIPHandler(service *geoip.Service) *GeoIPHandler {
	return &GeoIPHandler{service: service}
}

// Lookup handles GET /api/v1/geoip/lookup?ip=...
func (h *GeoIPHandler) Lookup(w http.ResponseWriter, r *http.Request) {
	if h.service == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "service_unavailable",
			"message": "GeoIP service is not initialized",
		})
		return
	}

	ip := strings.TrimSpace(r.URL.Query().Get("ip"))
	if ip == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_ip",
			"message": "The 'ip' query parameter is required",
		})
		return
	}

	loc, err := h.service.Lookup(r.Context(), ip)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_ip",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, loc)
}
