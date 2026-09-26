import React from 'react';
import {
  Activity,
  Clock,
  Save,
  Loader2,
  Sliders,
  Play,
  FileText,
  Server,
  Layers,
} from 'lucide-react';
import { Switch, Button } from '../../../components/ui';

export default function TrafficTab({
  form,
  setForm,
  displayedPlaylists = [],
  playlistSettings = {},
  savingPlaylistId = null,
  savingTimeout = false,
  saving = false,
  handleBulkSetTracking,
  handleSaveGlobalTimeout,
  handleTogglePlaylistSwitch,
  handleUpdatePlaylistField,
  handleSavePlaylistTracking,
  handleSaveSettings,
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. USER CONNECTION TRACKING & LIMITS                     */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#11cdef]/10 dark:bg-cyan-950/60 border border-[#11cdef]/20 dark:border-cyan-700/40 flex items-center justify-center text-[#11cdef] dark:text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#32325d] dark:text-white">User Connection Tracking & Limits</h2>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Enable or disable real-time stream tracking and maximum connection limits per playlist. Initial settings are imported once; dashboard settings prevail and are never overwritten by resyncs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkSetTracking(true)}
              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-[0.375rem] text-xs font-semibold transition active:scale-[0.98]"
            >
              Enable All Tracking
            </button>
            <button
              type="button"
              onClick={() => handleBulkSetTracking(false)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold transition active:scale-[0.98]"
            >
              Disable All Tracking
            </button>
          </div>
        </div>

        {/* Global Inactivity Timeout Configuration */}
        <div className="p-4 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[0.375rem] bg-[#11cdef]/10 dark:bg-cyan-950/60 border border-[#11cdef]/20 dark:border-cyan-700/40 flex items-center justify-center text-[#11cdef] dark:text-cyan-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white flex items-center gap-2">
                  <span>Global Session Inactivity Timeout</span>
                </h3>
                <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                  Applies globally to all playlists and streaming clients redirected by this server.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveGlobalTimeout}
              disabled={savingTimeout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#11cdef] hover:bg-[#0fb5d4] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {savingTimeout ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Timeout</span>
            </button>
          </div>

          <p className="text-xs text-[#525f7f] dark:text-slate-300 leading-relaxed">
            The stream redirector captures client IP and User-Agent upon redirect. Streaming clients that do not make new requests within this inactivity window are automatically purged from Redis, freeing max-connection slots and marking the user offline in the dashboard.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#e9ecef] dark:border-slate-800">
            <span className="text-xs font-semibold text-[#32325d] dark:text-white">Quick Presets:</span>
            {[5, 10, 15, 30, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setForm({ ...form, tracking_timeout_minutes: mins })}
                className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${(form.tracking_timeout_minutes || 10) === mins
                  ? 'bg-[#11cdef] text-white shadow-argon-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
              >
                {mins}m
              </button>
            ))}

            <div className="flex items-center gap-1.5 ml-auto">
              <label htmlFor="custom_tracking_timeout" className="text-xs text-[#8898aa] dark:text-slate-400">Custom duration:</label>
              <input
                id="custom_tracking_timeout"
                type="number"
                min="1"
                max="1440"
                value={form.tracking_timeout_minutes || 10}
                onChange={(e) => setForm({ ...form, tracking_timeout_minutes: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-20 px-2.5 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#11cdef]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">minutes</span>
            </div>
          </div>
        </div>

        {/* Playlists Table */}
        {(!displayedPlaylists || displayedPlaylists.length === 0) ? (
          <div className="p-8 text-center bg-[#f8f9fe] dark:bg-slate-800/60 rounded-[0.375rem] border border-dashed border-[#dee2e6] dark:border-slate-800 text-xs text-[#8898aa] dark:text-slate-400">
            No playlists found. Please ensure at least one playlist has been synchronized from PlaylistLabs.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] bg-white dark:bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#e9ecef] dark:border-slate-800 text-[#8898aa] dark:text-slate-400 bg-[#f6f9fc] dark:bg-slate-800/80 uppercase text-[12px] tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Playlist</th>
                  <th className="py-2.5 px-3">Connection Tracking</th>
                  <th className="py-2.5 px-3">Limit Enforcement</th>
                  <th className="py-2.5 px-3">Default Max Conns</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
                {displayedPlaylists.map((p) => {
                  const s = playlistSettings[p.id] || {
                    allow_tracking: Boolean(p.allow_tracking),
                    limit_max_connections: Boolean(p.limit_max_connections),
                    max_connections: p.max_connections || 1,
                  };
                  const isSaving = savingPlaylistId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#32325d] dark:text-white text-xs">{p.name}</div>
                        <div className="text-[13px] text-[#8898aa] dark:text-slate-400 font-mono">ID: {p.id} &bull; {p.managed_users_count || 0} users</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-2.5">
                          <Switch
                            checked={s.allow_tracking}
                            disabled={isSaving}
                            onCheckedChange={(checked) => handleTogglePlaylistSwitch(p.id, 'allow_tracking', checked)}
                            aria-label={`Allow tracking for ${p.name}`}
                          />
                          <span className={`text-xs font-semibold ${s.allow_tracking ? 'text-[#2dce89] dark:text-emerald-400' : 'text-[#8898aa] dark:text-slate-400'}`}>
                            {s.allow_tracking ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-2.5">
                          <Switch
                            checked={s.limit_max_connections}
                            disabled={isSaving}
                            onCheckedChange={(checked) => handleTogglePlaylistSwitch(p.id, 'limit_max_connections', checked)}
                            aria-label={`Enforce limit for ${p.name}`}
                          />
                          <span className={`text-xs font-semibold ${s.limit_max_connections ? 'text-[#5e72e4] dark:text-indigo-400' : 'text-[#8898aa] dark:text-slate-400'}`}>
                            {s.limit_max_connections ? 'Enforced' : 'No Limit'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={s.max_connections}
                            onChange={(e) => handleUpdatePlaylistField(p.id, 'max_connections', Math.max(1, parseInt(e.target.value, 10) || 1))}
                            onBlur={() => handleSavePlaylistTracking(p.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.target.blur();
                              }
                            }}
                            className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
                          />
                          <span className="text-[13px] text-[#8898aa] dark:text-slate-400">devices</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSavePlaylistTracking(p.id)}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.375rem] text-xs font-semibold transition active:scale-[0.98] shadow-argon-btn disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          <span>Save</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. REQUEST THROTTLING & RATE LIMITING SECTION             */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#5e72e4]/10 border border-[#5e72e4]/20 flex items-center justify-center text-[#5e72e4] dark:text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Request Throttling & Rate Limiting</h2>
                <span className={`px-2 py-0.5 text-[12px] font-semibold rounded-full ${form.throttle_enabled
                  ? 'bg-[#2dce89]/10 text-[#2dce89] border border-[#2dce89]/20'
                  : 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-slate-800 dark:border-slate-700'
                  }`}>
                  {form.throttle_enabled ? 'System Active' : 'System Disabled'}
                </span>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">Protect the server against flood attacks, aggressive scraping, and high-frequency player requests with per-IP thresholds</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-[#525f7f] dark:text-slate-300 font-medium">Master Switch:</span>
            <Switch
              checked={form.throttle_enabled}
              onCheckedChange={(checked) => setForm({ ...form, throttle_enabled: checked })}
              aria-label="Master switch for request throttling"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Stream Router */}
          <div className={`p-4 rounded-[0.375rem] border transition ${form.throttle_router_enabled && form.throttle_enabled
            ? 'bg-white dark:bg-slate-900 border-[#dee2e6] dark:border-slate-700'
            : 'bg-[#f8f9fe] dark:bg-slate-800/40 border-dashed border-[#dee2e6] dark:border-slate-800 opacity-80'
            }`}>
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#3970e1]/10 text-[#3970e1] dark:text-blue-400 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">Stream Router (Playback & Redirects)</span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 font-mono">/live/*, /movie/*, /series/*, /timeshift/*</span>
                </div>
              </div>
              <Switch
                disabled={!form.throttle_enabled}
                checked={form.throttle_router_enabled}
                onCheckedChange={(checked) => setForm({ ...form, throttle_router_enabled: checked })}
                aria-label="Enable Stream Router throttling"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Max Requests:</span>
                  <span className="text-[#3970e1] dark:text-blue-400 font-mono font-semibold">{form.throttle_router_limit}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  disabled={!form.throttle_enabled || !form.throttle_router_enabled}
                  value={form.throttle_router_limit}
                  onChange={(e) => setForm({ ...form, throttle_router_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 30 requests</span>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Window (seconds):</span>
                  <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.throttle_router_window_seconds}s</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  disabled={!form.throttle_enabled || !form.throttle_router_enabled}
                  value={form.throttle_router_window_seconds}
                  onChange={(e) => setForm({ ...form, throttle_router_window_seconds: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 10s (e.g. fast zapping limit)</span>
              </div>
            </div>
          </div>

          {/* 2. M3U & EPG Downloads */}
          <div className={`p-4 rounded-[0.375rem] border transition ${form.throttle_m3u_epg_enabled && form.throttle_enabled
            ? 'bg-white dark:bg-slate-900 border-[#dee2e6] dark:border-slate-700'
            : 'bg-[#f8f9fe] dark:bg-slate-800/40 border-dashed border-[#dee2e6] dark:border-slate-800 opacity-80'
            }`}>
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#2dce89]/10 text-[#2dce89] flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">M3U & EPG Downloads</span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 font-mono">/get.php, /xmltv.php, /:urlId</span>
                </div>
              </div>
              <Switch
                disabled={!form.throttle_enabled}
                checked={form.throttle_m3u_epg_enabled}
                onCheckedChange={(checked) => setForm({ ...form, throttle_m3u_epg_enabled: checked })}
                aria-label="Enable M3U & EPG throttling"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Max Requests:</span>
                  <span className="text-[#2dce89] font-mono font-semibold">{form.throttle_m3u_epg_limit}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  disabled={!form.throttle_enabled || !form.throttle_m3u_epg_enabled}
                  value={form.throttle_m3u_epg_limit}
                  onChange={(e) => setForm({ ...form, throttle_m3u_epg_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 18 requests</span>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Window (seconds):</span>
                  <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.throttle_m3u_epg_window_seconds}s</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="86400"
                  disabled={!form.throttle_enabled || !form.throttle_m3u_epg_enabled}
                  value={form.throttle_m3u_epg_window_seconds}
                  onChange={(e) => setForm({ ...form, throttle_m3u_epg_window_seconds: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 300s (5 minutes)</span>
              </div>
            </div>
          </div>

          {/* 3. Xtream Codes API */}
          <div className={`p-4 rounded-[0.375rem] border transition ${form.throttle_xtream_enabled && form.throttle_enabled
            ? 'bg-white dark:bg-slate-900 border-[#dee2e6] dark:border-slate-700'
            : 'bg-[#f8f9fe] dark:bg-slate-800/40 border-dashed border-[#dee2e6] dark:border-slate-800 opacity-80'
            }`}>
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#fb6340]/10 text-[#fb6340] flex items-center justify-center">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">Xtream Codes API</span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 font-mono">/player_api.php, /panel_api.php, /my_player</span>
                </div>
              </div>
              <Switch
                disabled={!form.throttle_enabled}
                checked={form.throttle_xtream_enabled}
                onCheckedChange={(checked) => setForm({ ...form, throttle_xtream_enabled: checked })}
                aria-label="Enable Xtream Codes API throttling"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Max Requests:</span>
                  <span className="text-[#fb6340] font-mono font-semibold">{form.throttle_xtream_limit}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  disabled={!form.throttle_enabled || !form.throttle_xtream_enabled}
                  value={form.throttle_xtream_limit}
                  onChange={(e) => setForm({ ...form, throttle_xtream_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 40 requests</span>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Window (seconds):</span>
                  <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.throttle_xtream_window_seconds}s</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  disabled={!form.throttle_enabled || !form.throttle_xtream_enabled}
                  value={form.throttle_xtream_window_seconds}
                  onChange={(e) => setForm({ ...form, throttle_xtream_window_seconds: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 20 seconds</span>
              </div>
            </div>
          </div>

          {/* 4. Stalker Portal API */}
          <div className={`p-4 rounded-[0.375rem] border transition ${form.throttle_stalker_enabled && form.throttle_enabled
            ? 'bg-white dark:bg-slate-900 border-[#dee2e6] dark:border-slate-700'
            : 'bg-[#f8f9fe] dark:bg-slate-800/40 border-dashed border-[#dee2e6] dark:border-slate-800 opacity-80'
            }`}>
            <div className="flex items-center justify-between pb-2 border-b border-[#e9ecef] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#8965e0]/10 text-[#8965e0] dark:text-purple-400 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">Stalker Portal (MAG / STB)</span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 font-mono">/stalker, /stalker/*</span>
                </div>
              </div>
              <Switch
                disabled={!form.throttle_enabled}
                checked={form.throttle_stalker_enabled}
                onCheckedChange={(checked) => setForm({ ...form, throttle_stalker_enabled: checked })}
                aria-label="Enable Stalker Portal throttling"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Max Requests:</span>
                  <span className="text-[#8965e0] dark:text-purple-400 font-mono font-semibold">{form.throttle_stalker_limit}</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  disabled={!form.throttle_enabled || !form.throttle_stalker_enabled}
                  value={form.throttle_stalker_limit}
                  onChange={(e) => setForm({ ...form, throttle_stalker_limit: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 60 requests</span>
              </div>
              <div>
                <label className="text-[13px] font-semibold text-[#32325d] dark:text-white flex items-center justify-between mb-1">
                  <span>Window (seconds):</span>
                  <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.throttle_stalker_window_seconds}s</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="3600"
                  disabled={!form.throttle_enabled || !form.throttle_stalker_enabled}
                  value={form.throttle_stalker_window_seconds}
                  onChange={(e) => setForm({ ...form, throttle_stalker_window_seconds: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1] disabled:opacity-50"
                />
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Default: 60 seconds (Disabled by default)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400">
          <span>
            Requests exceeding quota return <strong>HTTP 429</strong> with <code>Retry-After</code> headers. Admin dashboard routes (<code>/api/*</code>) and static web assets are always exempt.
          </span>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>Save Throttling Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
}
