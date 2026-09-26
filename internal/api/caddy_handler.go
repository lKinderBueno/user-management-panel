package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/repository"
	"playlistlabs_user_management_os/internal/security"
	"playlistlabs_user_management_os/internal/util"
)

// CaddyHandler handles On-Demand TLS verification queries from Caddy reverse proxy
// and provides domain SSL diagnostics for administrators.
type CaddyHandler struct {
	db           *sql.DB
	settingsRepo *repository.SettingsRepo
	playlistRepo *repository.PlaylistRepo
}

// NewCaddyHandler creates a new CaddyHandler instance.
func NewCaddyHandler(db *sql.DB, sRepo *repository.SettingsRepo, pRepo *repository.PlaylistRepo) *CaddyHandler {
	return &CaddyHandler{
		db:           db,
		settingsRepo: sRepo,
		playlistRepo: pRepo,
	}
}

// CheckCaddyDomain is called by Caddy via `on_demand_tls { ask ... }`.
// Returns 200 OK if the domain is authorized to obtain a Let's Encrypt certificate,
// or 403 Forbidden if the domain is unauthorized/unknown.
func (h *CaddyHandler) CheckCaddyDomain(w http.ResponseWriter, r *http.Request) {
	rawDomain := r.URL.Query().Get("domain")
	cleanDomain := util.NormalizeHost(rawDomain)
	if cleanDomain == "" {
		http.Error(w, "invalid domain parameter", http.StatusBadRequest)
		return
	}

	// 1. Always permit loopback / local hosts
	if security.IsLoopbackOrPrivate(cleanDomain) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	// 2. Permit server's primary public domain
	if envDomain := util.NormalizeHost(os.Getenv("DOMAIN")); envDomain != "" && cleanDomain == envDomain {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	// 3. Check System Settings (Admin Hostname & Master SSL switch)
	var adminHost string
	var sslMasterEnabled bool
	var additionalDomains string

	if h.settingsRepo != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		if s, err := h.settingsRepo.Get(ctx); err == nil && s != nil {
			adminHost = util.NormalizeHost(s.AdminHostname)
			sslMasterEnabled = s.SSLOnDemandEnabled
			additionalDomains = s.AdditionalSSLDomains
		}
	}

	// Admin hostname is always authorized for certificates
	if adminHost != "" && cleanDomain == adminHost {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	// 4. Check Playlist CNAMEs
	// If an admin explicitly enabled SSL (cname_ssl = 1) on a playlist, authorize it for certificates.
	// Strip known subdomains (stb., player., web.) to find base CNAME
	baseDomain := cleanDomain
	for _, prefix := range []string{"stb.", "player.", "web."} {
		if strings.HasPrefix(cleanDomain, prefix) {
			baseDomain = strings.TrimPrefix(cleanDomain, prefix)
			break
		}
	}

	if h.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		query := `
			SELECT cname
			FROM playlists
			WHERE is_orphaned = 0
			  AND cname_ssl = 1
			  AND cname IS NOT NULL
			  AND cname != ''
		`
		rows, err := h.db.QueryContext(ctx, query)
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var cnameStr string
				if err := rows.Scan(&cnameStr); err == nil {
					if util.HostMatchesList(cleanDomain, cnameStr) || util.HostMatchesList(baseDomain, cnameStr) {
						w.WriteHeader(http.StatusOK)
						_, _ = w.Write([]byte("OK"))
						return
					}
				}
			}
		}
	}

	// 5. Check Additional Standalone SSL Domains (requires master SSL toggle enabled)
	if sslMasterEnabled && additionalDomains != "" && util.HostMatchesList(cleanDomain, additionalDomains) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}

	// Unauthorized domain: Caddy must NOT request a certificate for this domain
	http.Error(w, "domain not authorized for ssl", http.StatusForbidden)
}

// SSLDomainItem describes a domain and its current SSL authorization status.
type SSLDomainItem struct {
	Domain       string `json:"domain"`
	Source       string `json:"source"` // "dashboard", "playlist", "additional"
	PlaylistID   uint64 `json:"playlist_id,omitempty"`
	PlaylistName string `json:"playlist_name,omitempty"`
	SSLEnabled   bool   `json:"ssl_enabled"`
	IsPrimary    bool   `json:"is_primary"`
}

// GetSSLDomainsResponse contains the full list of domains eligible or configured for SSL.
type GetSSLDomainsResponse struct {
	SSLOnDemandEnabled bool            `json:"ssl_on_demand_enabled"`
	Domains            []SSLDomainItem `json:"domains"`
}

// GetSSLDomains returns all domains configured in the system and their SSL status.
func (h *CaddyHandler) GetSSLDomains(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var resp GetSSLDomainsResponse

	var adminHost string
	if h.settingsRepo != nil {
		if s, err := h.settingsRepo.Get(ctx); err == nil && s != nil {
			resp.SSLOnDemandEnabled = s.SSLOnDemandEnabled
			adminHost = util.NormalizeHost(s.AdminHostname)

			if s.AdditionalSSLDomains != "" {
				for _, d := range util.NormalizeHostList(s.AdditionalSSLDomains) {
					resp.Domains = append(resp.Domains, SSLDomainItem{
						Domain:     d,
						Source:     "additional",
						SSLEnabled: s.SSLOnDemandEnabled,
					})
				}
			}
		}
	}

	// Primary server domain
	if envDomain := util.NormalizeHost(os.Getenv("DOMAIN")); envDomain != "" {
		resp.Domains = append(resp.Domains, SSLDomainItem{
			Domain:     envDomain,
			Source:     "server_primary",
			SSLEnabled: true,
			IsPrimary:  true,
		})
	}

	// Admin hostname
	if adminHost != "" && adminHost != util.NormalizeHost(os.Getenv("DOMAIN")) {
		resp.Domains = append(resp.Domains, SSLDomainItem{
			Domain:     adminHost,
			Source:     "admin_hostname",
			SSLEnabled: true,
			IsPrimary:  true,
		})
	}

	// Playlist CNAMEs
	if h.playlistRepo != nil {
		if playlists, err := h.playlistRepo.GetAll(ctx); err == nil {
			for _, p := range playlists {
				if strings.TrimSpace(p.CName) == "" {
					continue
				}
				hosts := util.NormalizeHostList(p.CName)
				for i, h := range hosts {
					resp.Domains = append(resp.Domains, SSLDomainItem{
						Domain:       h,
						Source:       "playlist",
						PlaylistID:   p.ID,
						PlaylistName: p.Name,
						SSLEnabled:   p.CnameSSL,
						IsPrimary:    i == 0,
					})
				}
			}
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// TestDomainDNSRequest contains parameters for pre-flight DNS verification.
type TestDomainDNSRequest struct {
	Domain string `json:"domain"`
}

// TestDomainDNSResponse returns the results of a DNS lookup.
type TestDomainDNSResponse struct {
	Domain     string   `json:"domain"`
	Resolves   bool     `json:"resolves"`
	IPs        []string `json:"ips"`
	Error      string   `json:"error,omitempty"`
}

// TestDomainDNS verifies whether a domain resolves via DNS before requesting SSL.
func (h *CaddyHandler) TestDomainDNS(w http.ResponseWriter, r *http.Request) {
	var req TestDomainDNSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_request_body"})
		return
	}

	cleanDomain := util.NormalizeHost(req.Domain)
	if cleanDomain == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_domain"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	resolver := net.DefaultResolver
	ips, err := resolver.LookupHost(ctx, cleanDomain)

	resp := TestDomainDNSResponse{
		Domain:   cleanDomain,
		Resolves: err == nil && len(ips) > 0,
		IPs:      ips,
	}
	if err != nil {
		resp.Error = err.Error()
	}

	writeJSON(w, http.StatusOK, resp)
}
