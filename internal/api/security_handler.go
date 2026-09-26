package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"playlistlabs_user_management_os/internal/cache"
	"playlistlabs_user_management_os/internal/models"
	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/security"
)

type SecurityHandler struct {
	svc   *security.Service
	repo  *repository.SecurityRepo
	cache cache.Cache
}

func NewSecurityHandler(svc *security.Service, repo *repository.SecurityRepo) *SecurityHandler {
	return &SecurityHandler{
		svc:   svc,
		repo:  repo,
		cache: cache.NewNoOp(),
	}
}

func (h *SecurityHandler) SetCache(c cache.Cache) {
	if c != nil {
		h.cache = c
	}
}

// GetStats returns aggregate security statistics.
func (h *SecurityHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.svc.GetStats(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_security_stats", "message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// GetTrackedIPs lists tracked/blocked IPs with filtering and pagination.
func (h *SecurityHandler) GetTrackedIPs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("search"))
	status := strings.TrimSpace(q.Get("status"))
	if status == "" {
		status = "all"
	}

	page, _ := strconv.Atoi(q.Get("page"))
	if page <= 0 {
		page = 1
	}

	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := (page - 1) * limit

	if h.repo == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"ips":   []interface{}{},
			"total": 0,
			"page":  page,
			"limit": limit,
		})
		return
	}

	ips, total, err := h.repo.GetTrackedIPs(r.Context(), search, status, limit, offset)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_tracked_ips", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ips":   ips,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// BlockIP manually bans an IP address.
func (h *SecurityHandler) BlockIP(w http.ResponseWriter, r *http.Request) {
	var req models.ManualBlockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	req.IP = strings.TrimSpace(req.IP)
	if req.IP == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_ip", "message": "IP address is required"})
		return
	}

	if req.Reason == "" {
		req.Reason = "Manual block by administrator"
	}
	if req.DurationHours < 0 {
		req.DurationHours = 24
	}

	if err := h.svc.ManualBlock(r.Context(), req.IP, req.Reason, req.DurationHours); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_blocking_ip", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":        "ip_blocked_successfully",
		"ip":             req.IP,
		"duration_hours": req.DurationHours,
	})
}

// UnblockIP unbans an IP address immediately.
func (h *SecurityHandler) UnblockIP(w http.ResponseWriter, r *http.Request) {
	var req models.UnblockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	req.IP = strings.TrimSpace(req.IP)
	if req.IP == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_ip", "message": "IP address is required"})
		return
	}

	if err := h.svc.Unblock(r.Context(), req.IP); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_unblocking_ip", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "ip_unblocked_successfully",
		"ip":      req.IP,
	})
}

// ResetAttempts resets failed attempts for an IP.
func (h *SecurityHandler) ResetAttempts(w http.ResponseWriter, r *http.Request) {
	var req models.ResetAttemptsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	req.IP = strings.TrimSpace(req.IP)
	if req.IP == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_ip", "message": "IP address is required"})
		return
	}

	if err := h.svc.ResetAttempts(r.Context(), req.IP); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_resetting_attempts", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "attempts_reset_successfully",
		"ip":      req.IP,
	})
}

// DeleteIP removes an IP record from the system.
func (h *SecurityHandler) DeleteIP(w http.ResponseWriter, r *http.Request) {
	ip := strings.TrimSpace(chi.URLParam(r, "ip"))
	if ip == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_ip", "message": "IP parameter is required"})
		return
	}

	if err := h.svc.DeleteIP(r.Context(), ip); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_deleting_ip", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "ip_deleted_successfully",
		"ip":      ip,
	})
}

// GetLogs returns recent security access logs.
func (h *SecurityHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	ipFilter := strings.TrimSpace(q.Get("ip"))
	typeFilter := strings.TrimSpace(q.Get("type"))
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	if h.repo == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"logs": []interface{}{},
		})
		return
	}

	logs, err := h.repo.GetRecentLogs(r.Context(), limit, ipFilter, typeFilter)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_security_logs", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
	})
}

// FlushLogs deletes old or all security logs.
func (h *SecurityHandler) FlushLogs(w http.ResponseWriter, r *http.Request) {
	flushAll := r.URL.Query().Get("all") == "true"
	var deleted int64
	var err error

	if h.repo == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message":      "logs_flushed_successfully",
			"deleted_rows": 0,
			"all":          flushAll,
		})
		return
	}

	if flushAll {
		deleted, err = h.repo.FlushAllLogs(r.Context())
	} else {
		retentionDays, _ := strconv.Atoi(r.URL.Query().Get("retention_days"))
		if retentionDays <= 0 {
			retentionDays = 7
		}
		deleted, err = h.repo.CleanOldLogs(r.Context(), retentionDays)
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_flushing_logs", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "logs_flushed_successfully",
		"deleted_rows": deleted,
		"all":          flushAll,
	})
}

// GetCompromisedUsers returns detected multi-IP incidents and compromised accounts.
func (h *SecurityHandler) GetCompromisedUsers(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	status := r.URL.Query().Get("status")

	incidents, err := h.svc.GetMultiIPIncidents(r.Context(), limit, status)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_fetching_compromised_incidents", "message": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"incidents": incidents,
	})
}

// ResolveIncident marks a compromised account incident as resolved and unsuspends the user.
func (h *SecurityHandler) ResolveIncident(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	incidentID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || incidentID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_incident_id"})
		return
	}

	resolvedBy := "admin"
	if username, ok := r.Context().Value("username").(string); ok && username != "" {
		resolvedBy = username
	}

	if err := h.svc.ResolveMultiIPIncident(r.Context(), incidentID, resolvedBy); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_resolving_incident", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.DeletePrefix(r.Context(), "cache:auth:user:")
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "incident_resolved_successfully",
		"id":      incidentID,
	})
}

// UnsuspendUser restores user status and resets multi-IP compromise flags.
func (h *SecurityHandler) UnsuspendUser(w http.ResponseWriter, r *http.Request) {
	username := strings.TrimSpace(chi.URLParam(r, "username"))
	if username == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_username"})
		return
	}

	if err := h.svc.UnsuspendUser(r.Context(), username); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed_unsuspending_user", "message": err.Error()})
		return
	}

	if h.cache != nil && h.cache.IsAvailable() {
		_ = h.cache.Delete(r.Context(), "cache:auth:user:"+username, "cache:auth:redirect:"+username)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":  "user_unsuspended_successfully",
		"username": username,
	})
}

