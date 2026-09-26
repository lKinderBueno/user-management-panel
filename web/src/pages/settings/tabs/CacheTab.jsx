import React from 'react';
import {
  Zap,
  Trash2,
  Loader2,
  Save,
} from 'lucide-react';
import { Switch, Button } from '../../../components/ui';

export default function CacheTab({
  form,
  setForm,
  cacheStatus = {},
  clearingCacheScope = null,
  handleClearCache,
  handleSaveSettings,
  saving = false,
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* CACHE & IN-MEMORY ACCELERATION (REDIS)                    */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#f5365c]/10 dark:bg-rose-950/60 border border-[#f5365c]/20 dark:border-rose-700/40 flex items-center justify-center text-[#f5365c] dark:text-rose-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Cache & In-Memory Acceleration (Redis)</h2>
                {cacheStatus?.backend === 'redis' ? (
                  <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono bg-[#e8fbf8] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/20 dark:border-emerald-800/40 font-semibold">
                    Redis Connected
                  </span>
                ) : (
                  <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono bg-[#f8f9fe] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400 border border-[#dee2e6] dark:border-slate-700 font-semibold">
                    Standalone (No-Op)
                  </span>
                )}
                <span className={`text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono font-semibold ${
                  form.cache_enabled
                    ? 'bg-[#ebf2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/20 dark:border-blue-700/40'
                    : 'bg-[#fff4e5] dark:bg-amber-950/60 text-[#fb6340] dark:text-amber-400 border border-[#fb6340]/20 dark:border-amber-700/40'
                }`}>
                  {form.cache_enabled ? 'Cache Active' : 'Cache Disabled'}
                </span>
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                Accelerate high-concurrency requests by caching Xtream Codes authentications, category lists, and stream resolution in the Redirector.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#525f7f] dark:text-slate-300 font-semibold">Enable Caching:</span>
              <Switch
                checked={form.cache_enabled}
                onCheckedChange={(checked) => setForm({ ...form, cache_enabled: checked })}
                aria-label="Enable Caching"
              />
            </div>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">Backend</div>
            <div className="text-sm font-bold text-[#32325d] dark:text-white font-mono mt-0.5">
              {cacheStatus?.backend ? cacheStatus.backend.toUpperCase() : 'STANDALONE'}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">Cached Keys</div>
            <div className="text-sm font-bold text-[#3970e1] dark:text-blue-400 font-mono mt-0.5">
              {cacheStatus?.keys_count ?? 0}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">RAM Usage</div>
            <div className="text-sm font-bold text-[#2dce89] dark:text-emerald-400 font-mono mt-0.5">
              {cacheStatus?.memory_used || 'N/A'}
            </div>
          </div>

          <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-800 rounded-[0.375rem]">
            <div className="text-[12px] uppercase tracking-wider text-[#8898aa] dark:text-slate-400 font-semibold">Redis Uptime</div>
            <div className="text-sm font-bold text-[#525f7f] dark:text-slate-300 font-mono mt-0.5 truncate" title={cacheStatus?.uptime || 'N/A'}>
              {cacheStatus?.uptime || 'N/A'}
            </div>
          </div>
        </div>

        {/* TTL Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* 1. Auth TTL */}
          <div className="p-3.5 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#32325d] dark:text-white">Xtream Authentication</span>
              <span className="text-xs font-mono font-semibold text-[#3970e1] dark:text-blue-400">{form.cache_auth_ttl_minutes} min</span>
            </div>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Caches user credentials and profile for frequent Xtream API calls.
            </p>
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {[1, 3, 5, 10, 15].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, cache_auth_ttl_minutes: m })}
                  className={`px-2 py-0.5 rounded-[0.25rem] text-[12px] font-semibold transition ${
                    form.cache_auth_ttl_minutes === m
                      ? 'bg-[#3970e1] text-white shadow-argon-sm'
                      : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* 2. Categories TTL */}
          <div className="p-3.5 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#32325d] dark:text-white">Channel / VOD Categories</span>
              <span className="text-xs font-mono font-semibold text-[#8965e0] dark:text-purple-400">{form.cache_categories_ttl_minutes} min</span>
            </div>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Caches Live, VOD, and Series category lists for players like TiviMate or Smarters.
            </p>
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {[30, 60, 120, 240, 360].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, cache_categories_ttl_minutes: m })}
                  className={`px-2 py-0.5 rounded-[0.25rem] text-[12px] font-semibold transition ${
                    form.cache_categories_ttl_minutes === m
                      ? 'bg-[#8965e0] text-white shadow-argon-sm'
                      : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  {m >= 60 ? `${m / 60}h` : `${m}m`}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Stream Redirect TTL */}
          <div className="p-3.5 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#32325d] dark:text-white">Stream Redirector</span>
              <span className="text-xs font-mono font-semibold text-[#2dce89] dark:text-emerald-400">{form.cache_streams_ttl_minutes} min</span>
            </div>
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Caches resolved stream URLs and rewrite rules for high-throughput streaming.
            </p>
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {[3, 5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, cache_streams_ttl_minutes: m })}
                  className={`px-2 py-0.5 rounded-[0.25rem] text-[12px] font-semibold transition ${
                    form.cache_streams_ttl_minutes === m
                      ? 'bg-[#2dce89] text-white shadow-argon-sm'
                      : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Manual Flush / Invalidation Actions */}
        <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[#32325d] dark:text-white">Manual Cache Invalidation</div>
            <div className="text-[13px] text-[#8898aa] dark:text-slate-400">
              Immediately flush cached keys from memory (automatic invalidation also occurs on playlist sync or user edits).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleClearCache('auth')}
              disabled={clearingCacheScope !== null}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {clearingCacheScope === 'auth' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-[#3970e1] dark:text-blue-400" />}
              <span>Flush Auth</span>
            </button>

            <button
              type="button"
              onClick={() => handleClearCache('categories')}
              disabled={clearingCacheScope !== null}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {clearingCacheScope === 'categories' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-[#8965e0] dark:text-purple-400" />}
              <span>Flush Categories</span>
            </button>

            <button
              type="button"
              onClick={() => handleClearCache('streams')}
              disabled={clearingCacheScope !== null}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {clearingCacheScope === 'streams' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-[#2dce89] dark:text-emerald-400" />}
              <span>Flush Streams</span>
            </button>

            <button
              type="button"
              onClick={() => handleClearCache('all')}
              disabled={clearingCacheScope !== null}
              className="px-3 py-1.5 bg-[#f5365c] hover:bg-[#d63031] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {clearingCacheScope === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 text-white" />}
              <span>Flush Entire Cache</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2 border-t border-[#e9ecef] dark:border-slate-800">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3970e1] hover:bg-[#2b5cc4] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>Save Cache TTLs</span>
          </button>
        </div>
      </div>
    </div>
  );
}
