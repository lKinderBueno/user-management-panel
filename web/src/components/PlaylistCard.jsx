import React from 'react';
import { 
  Tv, 
  Film, 
  Video, 
  Users, 
  ArrowRight, 
  Clock, 
  Settings, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle,
  Calendar,
  Lock,
  Globe,
  ShieldCheck
} from 'lucide-react';

export default function PlaylistCard({
  playlist,
  isSelected = false,
  onSelect,
  onOpenSettings,
  onOpenSyncLogs,
  onDelete,
  formatSyncDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const s = typeof dateStr === 'string' && !dateStr.includes('Z') && !/[+-]\d{2}(:\d{2})?$/.test(dateStr)
      ? dateStr.replace(' ', 'T') + 'Z'
      : dateStr;
    const d = new Date(s);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },
}) {
  const latestUpdatedAt = React.useMemo(() => {
    const parseUtcTime = (val) => {
      if (!val) return null;
      const s = typeof val === 'string' && !val.includes('Z') && !/[+-]\d{2}(:\d{2})?$/.test(val)
        ? val.replace(' ', 'T') + 'Z'
        : val;
      const t = new Date(s).getTime();
      return isNaN(t) ? null : t;
    };

    const times = [
      parseUtcTime(playlist.last_updated_channel),
      parseUtcTime(playlist.last_updated_movie || playlist.last_updated_movies),
      parseUtcTime(playlist.last_updated_series),
    ].filter((t) => t !== null);

    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [playlist.last_updated_channel, playlist.last_updated_movie, playlist.last_updated_movies, playlist.last_updated_series]);

  return (
    <div
      onClick={() => onSelect?.(playlist)}
      className={`group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-2xl cursor-pointer border ${
        playlist.is_orphaned
          ? 'border-amber-300/80 bg-amber-50/20 hover:border-amber-400/80'
          : isSelected
          ? 'border-[#3970e1]/70 bg-gradient-to-r from-blue-50/40 via-white to-white ring-1 ring-[#3970e1]/25 dark:border-[#3970e1]/80 dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900 dark:ring-[#3970e1]/30'
          : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-12 lg:items-center lg:gap-4">
        {/* Section 1: Selector & Main Title */}
        <div className="flex items-center gap-3 lg:col-span-4 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(playlist);
            }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
              isSelected
                ? 'bg-[#3970e1] text-white shadow-xs ring-2 ring-[#3970e1]/30'
                : 'border border-slate-200 bg-slate-100/80 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
            }`}
            title={isSelected ? 'Active playlist' : 'Click to set as active'}
          >
            <CheckCircle2 className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(playlist);
                }}
                className="cursor-pointer truncate text-base font-bold text-[#344767] transition-colors hover:text-[#3970e1] dark:text-white"
              >
                {playlist.name}
              </h4>
              {isSelected && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[12px] font-bold text-[#3970e1] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                  Active
                </span>
              )}
              {playlist.is_orphaned && (
                <span 
                  className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[12px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60 flex items-center gap-1 shrink-0"
                  title="This playlist was deleted or not found on PlaylistLabs server"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  <span>Missing</span>
                </span>
              )}
            </div>

            {/* Sub-row: ID, Language, Flags */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <span className="text-[13px] font-mono text-slate-400">
                ID: {playlist.id}
              </span>

              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                {playlist.language ? playlist.language.toUpperCase() : 'EN'}
              </span>

              {playlist.limit_max_connections && (
                <span 
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700"
                  title="Maximum connection limit strictly enforced on stream redirects"
                >
                  Limit Enforced
                </span>
              )}

              {playlist.allow_tracking && (
                <span 
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[12px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700"
                  title="Real-time connection tracking enabled"
                >
                  Tracking
                </span>
              )}

              {playlist.cname && (
                <span 
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-medium border font-mono ${
                    playlist.cname_ssl
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/70'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700'
                  }`}
                  title={`Custom domain: ${playlist.cname} (${playlist.cname_ssl ? 'SSL/HTTPS Active' : 'HTTP Only'})`}
                >
                  {playlist.cname_ssl ? (
                    <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                  <span>{playlist.cname}</span>
                  {playlist.cname_ssl && (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-1 py-0.2 rounded">
                      SSL
                    </span>
                  )}
                </span>
              )}

              {playlist.enforce_cname && (
                <span 
                  className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-[12px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60"
                  title="CNAME enforcement active: access is restricted strictly to this domain"
                >
                  CNAME Enforced
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Channels, Movies, Series Breakdown */}
        <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2 sm:gap-4 lg:gap-1 lg:col-span-2 min-w-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Tv className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-[#344767] dark:text-slate-100">
              {(playlist.active_channels || 0).toLocaleString()}
            </span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              Live Channels
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Film className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-[#344767] dark:text-slate-100">
              {(playlist.active_movies || 0).toLocaleString()}
            </span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              Movies
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Video className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-[#344767] dark:text-slate-100">
              {(playlist.active_series || 0).toLocaleString()}
            </span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              Series
            </span>
          </div>
        </div>

        {/* Section 3: Users Count */}
        <div className="lg:col-span-2 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-[#344767] dark:text-slate-200 truncate">
              {(playlist.managed_users_count || 0).toLocaleString()} Users
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            Managed Accounts
          </p>
        </div>

        {/* Section 4: Timestamps & Last Sync */}
        <div className="flex flex-row lg:flex-col gap-4 lg:gap-2 lg:col-span-2 min-w-0 py-1 sm:py-0">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                Last Sync
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSyncLogs?.(playlist);
                }}
                className={`text-xs font-bold truncate block transition text-left ${
                  playlist.synced_at
                    ? "text-[#344767] dark:text-slate-100 hover:text-[#3970e1]"
                    : "text-slate-400 italic"
                }`}
                title="View sync logs for this playlist"
              >
                {formatSyncDate(playlist.synced_at)}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs min-w-0">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                Updated At
              </span>
              <span
                className={`text-xs font-bold truncate block ${
                  latestUpdatedAt
                    ? "text-[#344767] dark:text-slate-100"
                    : "text-slate-400 italic"
                }`}
                title={latestUpdatedAt ? `Last content update: ${new Date(latestUpdatedAt).toLocaleString()}` : undefined}
              >
                {formatSyncDate(latestUpdatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Action Buttons */}
        <div className="flex items-center justify-end gap-1.5 lg:col-span-2 shrink-0">
          {playlist.is_orphaned && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(playlist);
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100/80 border border-rose-200/60 rounded-xl text-xs font-semibold transition active:scale-[0.98] shrink-0"
              title="Permanently delete this playlist"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">Delete</span>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings?.(playlist, e);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95"
            title="Playlist settings: tracking & max connections"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(playlist);
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 px-3.5 rounded-xl bg-[#3970e1] hover:bg-[#2d5cbe] text-white text-xs font-semibold transition-all active:scale-95 shadow-xs"
          >
            <span>Manage</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/90 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
