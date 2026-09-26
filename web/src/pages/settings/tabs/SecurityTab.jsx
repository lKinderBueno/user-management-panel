import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Eye,
  Users,
  Loader2,
  Save,
  Globe,
  Server,
  Lock,
} from 'lucide-react';
import { Switch, Button } from '../../../components/ui';
import { securityApi } from '../../../api/client';
import CaptchaSettingsSection from '../components/CaptchaSettingsSection';

export default function SecurityTab({
  form,
  setForm,
  cleanForm,
  captchaVerified,
  setCaptchaVerified,
  handleSaveSettings,
  saving = false,
  onOpenSecurityCenter,
}) {
  const [sslDomains, setSslDomains] = React.useState([]);

  React.useEffect(() => {
    securityApi
      .getSSLDomains()
      .then((res) => setSslDomains(res?.domains || []))
      .catch((err) => console.error('Failed to load SSL domains', err));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* ANTI-BRUTE FORCE & IP SECURITY SECTION                    */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#fce8e6] dark:bg-rose-950/60 border border-[#f5365c]/20 dark:border-rose-700/40 flex items-center justify-center text-[#f5365c] dark:text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Anti-Brute Force & IP Protection</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">Intelligent credential-aware protection for Web Dashboard, Xtream API, and Stream Redirects</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenSecurityCenter && (
              <button
                type="button"
                onClick={onOpenSecurityCenter}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Open Security Center</span>
              </button>
            )}

            <Switch
              checked={form.antibruteforce_enabled}
              onCheckedChange={(checked) => setForm({ ...form, antibruteforce_enabled: checked })}
              aria-label="Enable Anti-Brute Force Protection"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {/* Ban Duration */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>IP Ban Duration:</span>
              <span className="text-[#f5365c] dark:text-rose-400 font-mono font-semibold">{form.antibruteforce_ban_hours}h</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="8760"
                value={form.antibruteforce_ban_hours}
                onChange={(e) => setForm({ ...form, antibruteforce_ban_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 24h</span>
          </div>

          {/* Max Attempts */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Max Distinct Attempts:</span>
              <span className="text-[#3970e1] dark:text-blue-400 font-mono font-semibold">{form.antibruteforce_max_attempts}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={form.antibruteforce_max_attempts}
                onChange={(e) => setForm({ ...form, antibruteforce_max_attempts: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 5 tries</span>
          </div>

          {/* Window Minutes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Detection Window:</span>
              <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.antibruteforce_window_minutes}m</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1440"
                value={form.antibruteforce_window_minutes}
                onChange={(e) => setForm({ ...form, antibruteforce_window_minutes: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 15 min</span>
          </div>

          {/* Audit Retention Days */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Log Retention:</span>
              <span className="text-[#2dce89] dark:text-emerald-400 font-mono font-semibold">{form.security_log_retention_days}d</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={form.security_log_retention_days}
                onChange={(e) => setForm({ ...form, security_log_retention_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 7 days</span>
          </div>
        </div>

        {/* Multi-IP Access Detection & Auto-Suspension */}
        <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#fb6340] dark:text-orange-400" />
              <div>
                <span className="text-xs font-bold text-[#32325d] dark:text-white block">Multi-IP Access Detection (Compromised Account Suspension)</span>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Flags & suspends accounts accessed from multiple distinct subnets concurrently</span>
              </div>
            </div>
            <Switch
              checked={form.multi_ip_detection_enabled}
              onCheckedChange={(checked) => setForm({ ...form, multi_ip_detection_enabled: checked })}
              aria-label="Enable Multi-IP Access Detection"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Max Distinct Subnets */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
                <span>Max Distinct Subnets:</span>
                <span className="text-[#fb6340] dark:text-orange-400 font-mono font-semibold">{form.multi_ip_max_subnets} subnets</span>
              </label>
              <input
                type="number"
                min="2"
                max="100"
                value={form.multi_ip_max_subnets}
                onChange={(e) => setForm({ ...form, multi_ip_max_subnets: Math.max(2, parseInt(e.target.value, 10) || 2) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 10 (/24 IPv4, /64 IPv6)</span>
            </div>

            {/* Sliding Window */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
                <span>Sliding Window:</span>
                <span className="text-[#3970e1] dark:text-blue-400 font-mono font-semibold">{form.multi_ip_window_hours}h</span>
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={form.multi_ip_window_hours}
                onChange={(e) => setForm({ ...form, multi_ip_window_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 2 hours</span>
            </div>

            {/* Auto-Suspend Account */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
                <span>Auto-Suspend Account:</span>
                <span className={`font-mono font-semibold ${form.multi_ip_auto_suspend ? 'text-[#f5365c] dark:text-rose-400' : 'text-[#8898aa]'}`}>
                  {form.multi_ip_auto_suspend ? 'Auto-Suspend' : 'Log Only'}
                </span>
              </label>
              <label className="flex items-center gap-2 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.multi_ip_auto_suspend}
                  onChange={(e) => setForm({ ...form, multi_ip_auto_suspend: e.target.checked })}
                  className="rounded border-[#dee2e6] dark:border-slate-700 text-[#f5365c] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs text-[#525f7f] dark:text-slate-300">Suspend account immediately</span>
              </label>
              <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Blocks Xtream API & stream redirects</span>
            </div>
          </div>

          <div className="p-2.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-[13px] text-[#8898aa] dark:text-slate-400">
            IP addresses are normalized to network subnets (<strong>/24</strong> for IPv4 and <strong>/64</strong> for IPv6) to prevent mobile carrier IP rotation from creating false positives. If access is detected across {form.multi_ip_max_subnets} subnets within {form.multi_ip_window_hours} hours, the account is flagged as compromised.
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400">
          <span>
            Repeated requests with identical credentials from media players do not trigger bans. A ban is enacted only when varied credentials (spraying or brute force) exceed {form.antibruteforce_max_attempts} distinct attempts.
          </span>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>Save Security Rules</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CAPTCHA & ANTI-BOT PROTECTION SECTION                     */}
      {/* ========================================================= */}
      <CaptchaSettingsSection
        form={form}
        setForm={setForm}
        cleanForm={cleanForm}
        captchaVerified={captchaVerified}
        setCaptchaVerified={setCaptchaVerified}
        handleSaveSettings={handleSaveSettings}
        saving={saving}
      />

      {/* ========================================================= */}
      {/* DOMAIN & HOSTNAME ACCESS ISOLATION SECTION               */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#11cdef]/10 dark:bg-cyan-950/60 border border-[#11cdef]/20 dark:border-cyan-700/40 flex items-center justify-center text-[#11cdef] dark:text-cyan-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Domain & Hostname Isolation</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Isolate your Admin Management Dashboard from public Xtream Codes API and stream playback traffic
              </p>
            </div>
          </div>
        </div>

        {/* Dedicated Admin Hostname */}
        <div className="p-4 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[#3970e1]" />
              <span>Dedicated Admin Hostname</span>
            </label>
            <span className="text-[12px] text-[#8898aa] dark:text-slate-400 font-mono">
              {form.admin_hostname ? `Active: ${form.admin_hostname}` : 'No dedicated host configured (all hosts allowed)'}
            </span>
          </div>
          <p className="text-[13px] text-[#525f7f] dark:text-slate-300">
            Designate a specific domain or subdomain for accessing the administrator dashboard (e.g., <code className="text-xs bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-[#dee2e6] dark:border-slate-700 font-mono">admin.yourdomain.com</code>).
          </p>
          <div className="pt-1">
            <input
              type="text"
              placeholder="e.g. admin.yourdomain.com"
              value={form.admin_hostname || ''}
              onChange={(e) => setForm({ ...form, admin_hostname: e.target.value.trim() })}
              className="w-full sm:w-96 px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
            />
          </div>
        </div>

        {/* Isolation Rules Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rule 1: Block Xtream API & Redirector on Admin Host */}
          <div className="p-4 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#f5365c] dark:text-rose-400" />
                <span className="text-xs font-bold text-[#32325d] dark:text-white">Block Streaming on Admin Host</span>
              </div>
              <Switch
                disabled={!form.admin_hostname}
                checked={form.block_streaming_on_admin_host}
                onCheckedChange={(checked) => setForm({ ...form, block_streaming_on_admin_host: checked })}
                aria-label="Block Streaming on Admin Host"
              />
            </div>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
              When enabled, any requests to Xtream API (<code className="text-[11px] font-mono">/player_api.php</code>, <code className="text-[11px] font-mono">/get.php</code>, <code className="text-[11px] font-mono">/xmltv.php</code>) or Stream Redirector (<code className="text-[11px] font-mono">/live/*</code>, <code className="text-[11px] font-mono">/movie/*</code>) arriving on the admin hostname return <strong>404 Not Found</strong>.
            </p>
          </div>

          {/* Rule 2: Restrict Admin Dashboard to Admin Host */}
          <div className="p-4 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#fb6340] dark:text-orange-400" />
                <span className="text-xs font-bold text-[#32325d] dark:text-white">Restrict Dashboard to Admin Host</span>
              </div>
              <Switch
                disabled={!form.admin_hostname}
                checked={form.restrict_admin_to_admin_host}
                onCheckedChange={(checked) => setForm({ ...form, restrict_admin_to_admin_host: checked })}
                aria-label="Restrict Dashboard to Admin Host"
              />
            </div>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
              Only allow access to the web admin panel and administration APIs from the designated Admin Hostname. Requests via streaming domains or server IP return <strong>404 Not Found</strong>.
            </p>
            <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded text-[12px] text-emerald-800 dark:text-emerald-300">
              <strong>Anti-Lockout Safeguard:</strong> Direct local connections (<code className="font-mono">localhost</code>, <code className="font-mono">127.0.0.1</code>, LAN subnets) are always permitted.
            </div>
          </div>
        </div>

        {/* Rule 3: Block Direct IP Access for Streaming */}
        <div className="p-4 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
              <div>
                <span className="text-xs font-bold text-[#32325d] dark:text-white block">Block Direct IP Streaming</span>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Protect server from IP port scanners and unauthenticated scrapers</span>
              </div>
            </div>
            <Switch
              checked={form.block_direct_ip_streaming}
              onCheckedChange={(checked) => setForm({ ...form, block_direct_ip_streaming: checked })}
              aria-label="Block Direct IP Streaming"
            />
          </div>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
            Blocks Xtream API and stream playback requests made directly to the server's public IP address (e.g., <code className="text-[11px] font-mono">http://1.2.3.4:8000/player_api.php</code>), requiring player devices to use your configured domains or playlist CNAMEs.
          </p>
        </div>

        {/* Footer & Save Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400">
          <span>
            Host isolation rules take effect immediately across all services and reverse proxies without requiring a server reboot.
          </span>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>Save Host Isolation</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SSL / HTTPS & CUSTOM DOMAINS                              */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#e8fbf3] dark:bg-emerald-950/60 border border-[#2dce89]/20 dark:border-emerald-700/40 flex items-center justify-center text-[#2dce89] dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">SSL / HTTPS & Custom Domains</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Automatic Let's Encrypt certificates for Admin Hostname and authorized playlist CNAMEs
              </p>
            </div>
          </div>
          <Switch
            checked={Boolean(form.ssl_on_demand_enabled)}
            onCheckedChange={(checked) => setForm({ ...form, ssl_on_demand_enabled: checked })}
            aria-label="Enable On-Demand SSL"
          />
        </div>

        {/* Standalone Extra Domains Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#32325d] dark:text-white">
            Additional SSL Domains
          </label>
          <input
            type="text"
            placeholder="e.g. backup.domain.com, cdn.myserver.tv"
            value={form.additional_ssl_domains || ''}
            onChange={(e) => setForm({ ...form, additional_ssl_domains: e.target.value })}
            className="w-full sm:w-96 px-3 py-1.5 ml-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#2dce89]"
          />
          <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
            Optional comma-separated list of extra standalone domains to authorize for SSL.
          </p>
        </div>

        {/* Clean Active Domains Overview */}
        {Boolean(form.ssl_on_demand_enabled) && sslDomains.length > 0 && (
          <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-[#32325d] dark:text-white block">
              Configured Domains ({sslDomains.filter((d) => d.ssl_enabled).length} SSL active)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sslDomains.map((item, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border ${item.ssl_enabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}
                  title={item.ssl_enabled ? `Authorized via ${item.source}` : 'SSL disabled (HTTP only)'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${item.ssl_enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                  />
                  {item.domain}
                  <span className="text-[10px] text-[#8898aa] font-sans">
                    {item.source === 'admin_hostname'
                      ? '(Admin)'
                      : item.source === 'playlist'
                        ? `(${item.playlist_name || 'Playlist'})`
                        : '(Extra)'}
                  </span>
                  {!item.ssl_enabled && (
                    <span className="text-[10px] text-[#8898aa] font-sans">
                      (HTTP)
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Minimal Footer & Save */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#e9ecef] dark:border-slate-800 text-[12px] text-[#8898aa] dark:text-slate-400">
          <span>
            Certificates are cached and renewed automatically. Ensure DNS points to this server before connecting via HTTPS.
          </span>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>Save SSL Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
