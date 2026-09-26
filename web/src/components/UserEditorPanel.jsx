import React from 'react';
import {
  Users,
  Save,
  Key,
  Info,
  Sliders,
  ArrowRightLeft,
  Trash2,
  FileText,
  Loader2,
  X,
  RefreshCw,
  Lock,
  Unlock,
  ShieldAlert,
  EyeOff
} from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import MultiCategorySelect from './MultiCategorySelect';
import ProviderEditor from './ProviderEditor';
import { Drawer } from './ui';
import UserHiddenCategoriesModal from './UserHiddenCategoriesModal';
import { safeParsePatterns, getEffectiveUserPatterns, getPatternKey } from '../utils/patterns';

export default function UserEditorPanel({
  user,
  onUserChange,
  categories = { channels: [], vods: [], series: [] },
  playlists = [],
  currentPlaylist = null,
  onSave,
  saving = false,
  onShowInfo,
  onShowCreds,
  onShowM3u,
  onShowMove,
  onDelete,
  onForceSync,
  syncing = false,
  onClose,
  isDrawer = false
}) {
  React.useEffect(() => {
    if (!isDrawer || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawer, onClose]);

  const [showHiddenCategoriesModal, setShowHiddenCategoriesModal] = React.useState(false);

  const hiddenCategoriesCount = React.useMemo(() => {
    if (!user || !user.user_settings) return 0;
    try {
      let s = user.user_settings;
      while (typeof s === 'string') {
        s = JSON.parse(s);
      }
      return (s?.c?.hc?.length || 0) + (s?.m?.hc?.length || 0) + (s?.s?.hc?.length || 0);
    } catch {
      return 0;
    }
  }, [user?.user_settings]);

  const userPlaylist = React.useMemo(() => {
    return (playlists && playlists.find((p) => String(p.id) === String(user?.list_id))) || currentPlaylist;
  }, [playlists, user?.list_id, currentPlaylist]);

  const { effectivePatterns, isInherited, hasCustom } = React.useMemo(() => {
    const res = getEffectiveUserPatterns(user, userPlaylist);
    return {
      effectivePatterns: res.patterns,
      isInherited: res.isInherited,
      hasCustom: res.hasCustom,
    };
  }, [user, userPlaylist]);

  const handleResetCurrentProvider = React.useCallback(
    (targetUrl) => {
      const uPats = safeParsePatterns(user?.patterns);
      const normTarget = (targetUrl || '').trim().toLowerCase().replace(/\/+$/, '');
      const filtered = uPats.filter((p) => getPatternKey(p) !== normTarget);
      onUserChange({ ...user, patterns: filtered });
    },
    [user, onUserChange]
  );

  const handlePatternsChange = React.useCallback(
    (newPatterns) => {
      const customOnly = (newPatterns || [])
        .filter((p) => !p.isInherited)
        .map(({ isInherited, ...rest }) => rest);
      onUserChange({ ...user, patterns: customOnly });
    },
    [user, onUserChange]
  );

  if (!user) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e9ecef] dark:border-slate-800 p-8 shadow-argon text-center text-[#8898aa] dark:text-slate-400 space-y-3">
        <Users className="w-10 h-10 mx-auto text-[#adb5bd] stroke-[1.5]" />
        <h4 className="text-sm font-bold text-[#32325d] dark:text-white">No User Selected</h4>
        <p className="text-xs text-[#8898aa] dark:text-slate-400 max-w-sm mx-auto">
          Select a user from the data grid to inspect and edit settings.
        </p>
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Top Bar with Name, Expiration and Action Buttons */}
      <div className="pb-3 border-b border-[#e9ecef] dark:border-slate-800 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div>
              <div className="flex items-center justify-between mb-1 min-h-[16px]">
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider leading-4">
                  Name
                </label>
                {user.username && (
                  <span className="text-xs text-[#8898aa] dark:text-slate-400 font-mono truncate leading-4" title={`Username: ${user.username}`}>
                    {user.username}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={user.name || ''}
                onChange={(e) => onUserChange({ ...user, name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                placeholder="Name..."
              />
            </div>

            <div>
              <CalendarPicker
                label="Expiration Date"
                value={user.expiry}
                onChange={(exp) => onUserChange({ ...user, expiry: exp })}
              />
            </div>
          </div>

          <div className="flex items-stretch gap-1.5 sm:self-end flex-shrink-0">
            <button
              type="button"
              onClick={onShowInfo}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold shadow-xs transition active:scale-[0.98]"
              title="Streaming links, credentials, M3U and STB portal info"
            >
              <Info className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>Info & Links</span>
            </button>

            {isDrawer && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-2 flex items-center justify-center text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-slate-800 rounded transition ml-1"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Auto-sync expiry checkbox */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#525f7f] dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!user.sync_expiry_date}
              onChange={(e) => onUserChange({ ...user, sync_expiry_date: e.target.checked })}
              className="rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span>Auto sync expiration date with source provider</span>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 space-y-2">
        <span className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
          Category Access
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MultiCategorySelect
            title="Live Channels"
            type="channels"
            categories={categories.channels || []}
            value={user.channels_categories}
            onChange={(val) => onUserChange({ ...user, channels_categories: val })}
          />

          <MultiCategorySelect
            title="Movies / VOD"
            type="movies"
            categories={categories.vods || []}
            value={user.vods_categories}
            onChange={(val) => onUserChange({ ...user, vods_categories: val })}
          />

          <MultiCategorySelect
            title="TV Series"
            type="series"
            categories={categories.series || []}
            value={user.series_categories}
            onChange={(val) => onUserChange({ ...user, series_categories: val })}
            align="right"
          />
        </div>

        {/* User Hidden Categories (Client Portal) */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700/60 mt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <EyeOff className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#32325d] dark:text-white">
                User Hidden Categories
              </div>
              <div className="text-[13px] text-[#8898aa] dark:text-slate-400">
                {hiddenCategoriesCount > 0
                  ? `${hiddenCategoriesCount} categories hidden by this user`
                  : 'No categories hidden by this user'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHiddenCategoriesModal(true)}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold shadow-sm transition"
          >
            Manage Hidden
          </button>
        </div>
      </div>

      {/* Provider / Patterns */}
      <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 space-y-2">
        <span className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
          Source Provider
        </span>
        <ProviderEditor
          patterns={effectivePatterns}
          isInherited={isInherited}
          playlistName={userPlaylist?.name}
          onResetToPlaylist={hasCustom ? () => onUserChange({ ...user, patterns: [] }) : null}
          onResetCurrentProvider={handleResetCurrentProvider}
          onChange={handlePatternsChange}
          onForceSync={onForceSync}
          syncing={syncing}
        />
      </div>

      {/* Notes & Max Connections */}
      <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8">
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
            <span>Internal Notes</span>
          </label>
          <textarea
            rows={2}
            value={user.note || ''}
            onChange={(e) => onUserChange({ ...user, note: e.target.value })}
            placeholder="Internal notes for this user..."
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm resize-none"
          />
        </div>

        <div className="sm:col-span-4">
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
            Max Connections
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={user.max_connections || 1}
            onChange={(e) => onUserChange({ ...user, max_connections: Number(e.target.value) || 1 })}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
          />
        </div>
      </div>

      {/* Account Status & Security */}
      <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
            Account Status & Security
          </span>
          {user.is_compromised ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold bg-[#feecee] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-300 border border-[#f5365c]/30 animate-pulse">
              Flagged as Compromised
            </span>
          ) : user.is_suspended ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold bg-[#feecee] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-300 border border-[#f5365c]/30">
              Suspended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold bg-[#e8f5e9] dark:bg-emerald-950/60 text-[#2dce89] dark:text-emerald-300 border border-[#2dce89]/20">
              Active
            </span>
          )}
        </div>

        <div className="bg-[#f8f9fe] dark:bg-slate-800/60 p-3 rounded border border-[#dee2e6] dark:border-slate-700/60 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[#32325d] dark:text-white block">
                {user.is_suspended ? 'Account is Suspended' : 'Account is Active'}
              </span>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                {user.is_suspended
                  ? 'Access to playlists and stream playback is completely blocked for this user.'
                  : 'User has active streaming and playlist download permissions.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newSuspended = !user.is_suspended;
                  onUserChange({
                    ...user,
                    is_suspended: newSuspended,
                    is_compromised: newSuspended ? user.is_compromised : false,
                    compromised_reason: newSuspended ? (user.compromised_reason || 'Manual suspension by admin') : null
                  });
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition flex items-center gap-1.5 active:scale-95 ${user.is_suspended
                    ? 'bg-[#2dce89] hover:bg-[#26af74] text-white'
                    : 'bg-[#f5365c]/10 hover:bg-[#f5365c] text-[#f5365c] hover:text-white border border-[#f5365c]/30'
                  }`}
              >
                {user.is_suspended ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Reactivate Account</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Suspend Account</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {user.is_suspended && (
            <div>
              <label className="block text-[12px] font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                Suspension Reason
              </label>
              <input
                type="text"
                value={user.compromised_reason || ''}
                onChange={(e) => onUserChange({ ...user, compromised_reason: e.target.value })}
                placeholder="Reason for suspension (e.g. Non-payment, manual block, leaked account)..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="pt-4 border-t border-[#e9ecef] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2dce89] hover:bg-[#26af74] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Changes</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {playlists.length > 1 && (
            <button
              type="button"
              onClick={onShowMove}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98]"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Move</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#f5365c] hover:bg-[#ec0c38] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete user</span>
          </button>
        </div>
      </div>

      <UserHiddenCategoriesModal
        isOpen={showHiddenCategoriesModal}
        onClose={() => setShowHiddenCategoriesModal(false)}
        user={user}
        categories={categories}
        onSave={(newSettings) => {
          onUserChange({ ...user, user_settings: newSettings });
        }}
      />
    </div>
  );

  if (isDrawer) {
    return (
      <Drawer isOpen={true} onClose={onClose} size="panel">
        {content}
      </Drawer>
    );
  }

  // Inline Split View panel
  return (
    <div className="bg-white dark:bg-slate-900 border border-[#e9ecef] dark:border-slate-800 rounded-lg p-6 shadow-argon space-y-4 min-w-0">
      {content}
    </div>
  );
}
