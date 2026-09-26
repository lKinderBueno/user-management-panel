import React from 'react';
import {
  RefreshCw,
  Clock,
  Calendar,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  CloudDownload,
  Film,
  ExternalLink,
  TriangleAlert,
} from 'lucide-react';
import { Switch, Button } from '../../../components/ui';

export default function SyncTab({
  form,
  setForm,
  pStatus = {},
  eStatus = {},
  tokenTestResult,
  setTokenTestResult,
  showToken,
  setShowToken,
  showApiPassword,
  setShowApiPassword,
  testingToken,
  handleTestToken,
  showTmdbKey,
  setShowTmdbKey,
  testingTmdbKey,
  tmdbTestResult,
  setTmdbTestResult,
  handleTestTMDBKey,
  actionLoading,
  handleTriggerPlaylistSync,
  handleTriggerExpirySync,
  setShowImportEditorModal,
  formatDate,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. PLAYLIST SYNCHRONIZATION SECTION                      */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#ebf2ff] dark:bg-blue-950/60 border border-[#dee2e6] dark:border-blue-700/40 flex items-center justify-center text-[#3970e1] dark:text-blue-400">
              <RefreshCw className={`w-4 h-4 ${pStatus.is_running ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Playlist Synchronization</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">Download and synchronize streams, EPG, and categories from PlaylistLabs</p>
            </div>
          </div>

          <Switch
            checked={form.playlist_sync_enabled}
            onCheckedChange={(checked) => setForm({ ...form, playlist_sync_enabled: checked })}
            aria-label="Enable playlist synchronization"
          />
        </div>

        {/* PlaylistLabs Access Token Field */}
        <div className="space-y-1.5 p-3 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>PlaylistLabs Access Token:</span>
            </label>
            {tokenTestResult && (
              <span className={`text-[13px] font-mono flex items-center gap-1 ${tokenTestResult.valid ? 'text-[#2dce89] dark:text-emerald-400' : 'text-[#f5365c] dark:text-rose-400'
                }`}>
                {tokenTestResult.valid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid ({tokenTestResult.playlists_count} playlists)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>Invalid</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={form.iptveditor_api_token}
                onChange={(e) => {
                  setForm({ ...form, iptveditor_api_token: e.target.value });
                  setTokenTestResult(null);
                }}
                placeholder="Enter or update PlaylistLabs token..."
                className="w-full pl-3 pr-9 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 transition"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestToken}
              disabled={testingToken || !form.iptveditor_api_token.trim()}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold flex items-center gap-1.5 shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
              title="Test connection with PlaylistLabs"
            >
              {testingToken ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3970e1] dark:text-blue-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              )}
              <span>Test</span>
            </button>
          </div>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
            Used to authenticate requests to PlaylistLabs to download channels, categories, and EPG.
          </p>

          {((tokenTestResult?.code === 'PLAN_UPGRADE_REQUIRED') || (!tokenTestResult && form?.license_suspended)) && (
            <div className="p-3.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <TriangleAlert className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-200">
                      {tokenTestResult?.title || 'Forbidden'}
                    </h5>
                  </div>
                  <p className="text-[13px] text-amber-700 dark:text-amber-300/90 mt-0.5">
                    {tokenTestResult?.body || tokenTestResult?.message || 'Access requires an upgraded subscription plan. Live streams and Xtream/M3U delivery are currently soft-locked.'}
                  </p>
                  {form?.license_suspended_at && (
                    <p className="text-[13px] text-amber-800/80 dark:text-amber-400/80 mt-1 font-mono">
                      Suspended since: {new Date(form.license_suspended_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {(tokenTestResult?.upgrade_url || form?.license_upgrade_url || 'https://playlistlabs.io') && (
                <div className="pt-2 border-t border-amber-500/20 flex justify-end">
                  <a
                    href={tokenTestResult?.upgrade_url || form?.license_upgrade_url || 'https://playlistlabs.io'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded shadow-sm transition active:scale-[0.98]"
                  >
                    <span>Upgrade Plan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Optional Token Password */}
          <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800/80">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>Token Password <span className="font-normal text-slate-400">(Optional):</span></span>
              </label>
              <span className="text-[11px] text-slate-400">
                Leave empty if unconfigured
              </span>
            </div>
            <div className="relative">
              <input
                type={showApiPassword ? 'text' : 'password'}
                value={form.iptveditor_api_password || ''}
                onChange={(e) => {
                  setForm({ ...form, iptveditor_api_password: e.target.value });
                  setTokenTestResult(null);
                }}
                placeholder="Enter token password (if required by your PlaylistLabs token)..."
                className="w-full pl-3 pr-9 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
              />
              <button
                type="button"
                onClick={() => setShowApiPassword(!showApiPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 transition"
                title={showApiPassword ? 'Hide password' : 'Show password'}
              >
                {showApiPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* TMDB (The Movie Database) API Key Field */}
        <div className="space-y-1.5 p-3 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>TMDB API Key (The Movie Database):</span>
            </label>
            {tmdbTestResult && (
              <span className={`text-[13px] font-mono flex items-center gap-1 ${tmdbTestResult.valid ? 'text-[#2dce89] dark:text-emerald-400' : 'text-[#f5365c] dark:text-rose-400'
                }`}>
                {tmdbTestResult.valid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" />
                    <span>Invalid</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showTmdbKey ? 'text' : 'password'}
                value={form.tmdb_api_key || ''}
                onChange={(e) => {
                  setForm({ ...form, tmdb_api_key: e.target.value });
                  setTmdbTestResult?.(null);
                }}
                placeholder="Enter or update TMDB API key..."
                className="w-full pl-3 pr-9 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
              />
              <button
                type="button"
                onClick={() => setShowTmdbKey?.(!showTmdbKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 transition"
                title={showTmdbKey ? 'Hide key' : 'Show key'}
              >
                {showTmdbKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestTMDBKey}
              disabled={testingTmdbKey || !(form.tmdb_api_key || '').trim()}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold flex items-center gap-1.5 shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 shrink-0"
              title="Test connection with TMDB API"
            >
              {testingTmdbKey ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3970e1] dark:text-blue-400" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              )}
              <span>Test</span>
            </button>
          </div>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
            Used to fetch posters, plots, ratings, and metadata for Movies (VOD) and TV Series.
          </p>
        </div>

        {/* Sync Interval */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
            <span>Sync interval:</span>
            <span className="text-[#3970e1] dark:text-blue-400 font-mono">Every {form.playlist_sync_interval_hours} hours</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 4, 6, 12, 24].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setForm({ ...form, playlist_sync_interval_hours: hrs })}
                className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${form.playlist_sync_interval_hours === hrs
                  ? 'bg-[#3970e1] text-white shadow-argon-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
              >
                {hrs}h
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="1"
                max="168"
                value={form.playlist_sync_interval_hours}
                onChange={(e) => setForm({ ...form, playlist_sync_interval_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">hours</span>
            </div>
          </div>
        </div>

        {/* Maximum EPG Days */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
            <span>Maximum EPG days:</span>
            <span className="text-[#3970e1] dark:text-blue-400 font-mono">{form.epg_max_days} {form.epg_max_days === 1 ? 'day' : 'days'}</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setForm({ ...form, epg_max_days: days })}
                className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${form.epg_max_days === days
                  ? 'bg-[#3970e1] text-white shadow-argon-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
              >
                {days}d
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="1"
                max="30"
                value={form.epg_max_days}
                onChange={(e) => setForm({ ...form, epg_max_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">days</span>
            </div>
          </div>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
            Limits the maximum number of future days of EPG schedule to download from PlaylistLabs, save in database, and generate in XMLTV files.
          </p>
        </div>

        {/* Force Full Refresh Option (One-time) */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="playlist_sync_force"
            checked={Boolean(form.playlist_sync_force)}
            onChange={(e) => setForm({ ...form, playlist_sync_force: e.target.checked })}
            className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="playlist_sync_force" className="text-xs text-[#525f7f] dark:text-slate-300 cursor-pointer select-none">
            Force <strong className="text-[#32325d] dark:text-white">full refresh</strong> on next sync (one-time: re-download channels, movies, series, and EPG even if unchanged)
          </label>
        </div>

        {/* Status Box */}
        <div className="p-3.5 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[#8898aa] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Last execution:
            </span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">{formatDate(pStatus.last_run)}</span>
          </div>
          <div className="flex items-center justify-between text-[#8898aa] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Next scheduled:
            </span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">
              {form.playlist_sync_enabled ? formatDate(pStatus.next_run) : 'Disabled'}
            </span>
          </div>
          {pStatus.step && (
            <div className="pt-1.5 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400 truncate">
              <span className="text-[#525f7f] dark:text-slate-300 font-semibold">Status:</span> {pStatus.step}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleTriggerPlaylistSync}
            disabled={actionLoading.playlistSync || pStatus.is_running}
            title={form.playlist_sync_force ? 'Force full synchronization of all playlists and EPG' : 'Synchronize all playlists from PlaylistLabs (incremental)'}
            className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 hover:text-[#2b5cc4] border border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1]/40 font-semibold rounded-[0.375rem] text-xs flex items-center justify-center gap-2 shadow-argon-sm transition active:scale-[0.99] disabled:opacity-50"
          >
            {actionLoading.playlistSync || pStatus.is_running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3970e1] dark:text-blue-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            )}
            <span>{pStatus.is_running ? 'Syncing...' : 'Sync Playlists'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportEditorModal(true)}
            className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#2dce89] dark:text-emerald-400 hover:text-[#28b97b] border border-[#dee2e6] dark:border-slate-700 hover:border-[#2dce89]/40 font-semibold rounded-[0.375rem] text-xs flex items-center justify-center gap-2 shadow-argon-sm transition active:scale-[0.99]"
            title="Re-import managed users and welcome info from PlaylistLabs"
          >
            <CloudDownload className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
            <span>Re-import from PlaylistLabs</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. EXPIRY DATE SYNCHRONIZATION SECTION                   */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-4 shadow-argon dark:shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[0.375rem] bg-[#8965e0]/10 dark:bg-purple-950/60 border border-[#8965e0]/20 dark:border-purple-700/40 flex items-center justify-center text-[#8965e0] dark:text-purple-400">
              <Clock className={`w-4 h-4 ${eStatus.is_running ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">User Expiry Synchronization</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">Query Xtream providers to update user expiration dates</p>
            </div>
          </div>

          <Switch
            checked={form.expiry_sync_enabled}
            onCheckedChange={(checked) => setForm({ ...form, expiry_sync_enabled: checked })}
            aria-label="Enable user expiry synchronization"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
            <span>Sync interval:</span>
            <span className="text-[#8965e0] dark:text-purple-400 font-mono">Every {form.expiry_sync_interval_hours} hours</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[2, 6, 12, 24, 48].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => setForm({ ...form, expiry_sync_interval_hours: hrs })}
                className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${form.expiry_sync_interval_hours === hrs
                  ? 'bg-[#8965e0] text-white shadow-argon-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
              >
                {hrs}h
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="1"
                max="168"
                value={form.expiry_sync_interval_hours}
                onChange={(e) => setForm({ ...form, expiry_sync_interval_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#8965e0]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">hours</span>
            </div>
          </div>
        </div>

        {/* Expiry Window (Days) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
            <span>Expiry sync window:</span>
            <span className="text-[#8965e0] dark:text-purple-400 font-mono">&plusmn;{form.expiry_sync_days_range || 5} {(form.expiry_sync_days_range || 5) === 1 ? 'day' : 'days'}</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {[1, 3, 5, 7, 15, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setForm({ ...form, expiry_sync_days_range: days })}
                className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${(form.expiry_sync_days_range || 5) === days
                  ? 'bg-[#8965e0] text-white shadow-argon-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
              >
                {days}d
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="number"
                min="1"
                max="90"
                value={form.expiry_sync_days_range || 5}
                onChange={(e) => setForm({ ...form, expiry_sync_days_range: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#8965e0]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">days</span>
            </div>
          </div>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
            Window around current date (&plusmn;days) to select expiring accounts for synchronization, protecting provider API rate limits.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="expiry_all"
            checked={form.expiry_sync_all}
            onChange={(e) => setForm({ ...form, expiry_sync_all: e.target.checked })}
            className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#8965e0] focus:ring-0 cursor-pointer"
          />
          <label htmlFor="expiry_all" className="text-xs text-[#525f7f] dark:text-slate-300 cursor-pointer select-none">
            Sync <strong className="text-[#32325d] dark:text-white">all</strong> users (including outside the &plusmn;{form.expiry_sync_days_range || 5} days window)
          </label>
        </div>

        {/* Status Box */}
        <div className="p-3.5 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[#8898aa] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Last execution:
            </span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">{formatDate(eStatus.last_run)}</span>
          </div>
          <div className="flex items-center justify-between text-[#8898aa] dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Next scheduled:
            </span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">
              {form.expiry_sync_enabled ? formatDate(eStatus.next_run) : 'Disabled'}
            </span>
          </div>
          {eStatus.step && (
            <div className="pt-1.5 border-t border-[#e9ecef] dark:border-slate-800 text-[13px] text-[#8898aa] dark:text-slate-400 truncate">
              <span className="text-[#525f7f] dark:text-slate-300 font-semibold">Status:</span> {eStatus.step}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleTriggerExpirySync}
          disabled={actionLoading.expirySync || eStatus.is_running}
          className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#8965e0] dark:text-purple-400 hover:text-[#734ec9] border border-[#dee2e6] dark:border-slate-700 hover:border-[#8965e0]/40 font-semibold rounded-[0.375rem] text-xs flex items-center justify-center gap-2 shadow-argon-sm transition active:scale-[0.99] disabled:opacity-50"
        >
          {actionLoading.expirySync || eStatus.is_running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8965e0] dark:text-purple-400" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#8965e0] dark:text-purple-400" />
          )}
          <span>{eStatus.is_running ? 'Syncing...' : 'Sync User Expirations Now'}</span>
        </button>
      </div>
    </div>
  );
}
