import React from 'react';
import {
  Search,
  Radio,
  Loader2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Trash2,
  Settings,
  Activity,
  ShieldCheck,
  Check,
  X,
  Layers,
  Globe,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { playlistApi } from '../api/client';
import PlaylistCard from '../components/PlaylistCard';
import PlaylistSettingsModal from '../components/PlaylistSettingsModal';
import SyncStatusBadge from '../components/SyncStatusBadge';
import SyncLogsModal from '../components/SyncLogsModal';
import { Modal, ConfirmDialog, Button, Alert, PageHeader } from '../components/ui';

export default function PlaylistSelect({ onSelectPlaylist, admin, onPlaylistsRefreshed, currentPlaylist }) {
  const [playlists, setPlaylists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [syncingAll, setSyncingAll] = React.useState(false);
  const [selectedSyncPlaylist, setSelectedSyncPlaylist] = React.useState(null);
  const [showAllSyncLogs, setShowAllSyncLogs] = React.useState(false);
  const [playlistToDelete, setPlaylistToDelete] = React.useState(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');

  // Active Playlist ID tracking
  const activePlaylistId = React.useMemo(() => {
    if (currentPlaylist?.id) return String(currentPlaylist.id);
    return sessionStorage.getItem('playlistlabs_selected_playlist_id') || '';
  }, [currentPlaylist]);

  // Playlist Settings Modal state
  const [settingsPlaylist, setSettingsPlaylist] = React.useState(null);

  const fetchPlaylists = React.useCallback(async () => {
    try {
      const data = await playlistApi.getPlaylists();
      setPlaylists(data || []);
      onPlaylistsRefreshed?.();
    } catch (err) {
      setError(err.message || 'Error loading playlists from database');
    } finally {
      setLoading(false);
    }
  }, [onPlaylistsRefreshed]);

  React.useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await playlistApi.startAllSync(false);
    } catch (err) {
      setError(err.message || 'Error starting global playlists sync');
    } finally {
      setTimeout(() => setSyncingAll(false), 2500);
    }
  };

  const filteredPlaylists = React.useMemo(() => {
    if (!search.trim()) return playlists;
    const q = search.toLowerCase();
    return playlists.filter((p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q));
  }, [playlists, search]);

  const orphanedPlaylists = React.useMemo(() => {
    return (playlists || []).filter((p) => p.is_orphaned);
  }, [playlists]);

  const formatSyncDate = (dateStr) => {
    if (!dateStr) return 'Never';
    // Ensure string dates without explicit timezone are parsed as UTC
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
  };

  const handleOpenSettings = (playlist, e) => {
    e?.stopPropagation?.();
    setSettingsPlaylist(playlist);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-[#3970e1] animate-spin" />
        <span className="text-xs text-[#8898aa]">Loading playlists...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Standardized Header Bar */}
      <PageHeader
        icon={Layers}
        color="blue"
        title="Playlists"
        badge={
          <span className="text-xs font-semibold px-2 py-0.5 rounded-[0.375rem] bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 text-[#3970e1] dark:text-blue-400">
            {playlists.length} {playlists.length === 1 ? 'Playlist' : 'Playlists'}
          </span>
        }
        description="Choose a playlist to manage user accounts, stream credentials, and category visibility filters."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAllSyncLogs(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-95"
              title="View global sync logs (last 7 days)"
            >
              <Clock className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
              <span>Logs (7d)</span>
            </button>

            {(!admin || admin.role === 'admin') && (
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-95 disabled:opacity-50"
                title="Synchronize all playlists from PlaylistLabs in background (incremental)"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400 ${syncingAll ? 'animate-spin' : ''}`} />
                <span>{syncingAll ? 'Syncing...' : 'Sync All'}</span>
              </button>
            )}
          </div>
        }
      />

      {/* Search Bar */}
      <div>
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlists by name or ID..."
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs text-[#344767] dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-[#3970e1]/70 focus:ring-1 focus:ring-[#3970e1]/25 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Orphaned / Out-of-scope Playlists Warning Banner */}
      {orphanedPlaylists.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 rounded-xl flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold text-amber-900 dark:text-amber-100">
              Attention: {orphanedPlaylists.length} playlist{orphanedPlaylists.length > 1 ? 's are' : ' is'} no longer available on the PlaylistLabs server or out of scope.
            </span>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              These playlists were not returned during synchronization but have connected managed users. You can review and migrate their users, or delete them manually below.
            </p>
          </div>
        </div>
      )}

      {/* Playlists List Container */}
      {filteredPlaylists.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800/90 border border-[#dee2e6] dark:border-slate-700/80 rounded-xl shadow-argon-sm max-w-md mx-auto">
          <Radio className="w-8 h-8 text-[#8898aa] dark:text-slate-400 mx-auto mb-2 stroke-[1.5]" />
          <p className="text-[#32325d] dark:text-white text-xs font-semibold">
            {search ? `No playlists matching "${search}"` : 'No playlists found'}
          </p>
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-1">
            {search ? 'Try a different search term or clear the filter.' : 'Make sure playlists are synchronized in the database.'}
          </p>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-3 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[#525f7f] dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredPlaylists.map((p) => (
            <PlaylistCard
              key={p.id}
              playlist={p}
              isSelected={String(p.id) === activePlaylistId}
              onSelect={onSelectPlaylist}
              onOpenSettings={handleOpenSettings}
              onOpenSyncLogs={setSelectedSyncPlaylist}
              onDelete={(target) => {
                setPlaylistToDelete(target);
                setDeleteError('');
              }}
              formatSyncDate={formatSyncDate}
            />
          ))}
        </div>
      )}

      {/* Floating live sync progress badge */}
      <SyncStatusBadge onSyncCompleted={fetchPlaylists} />

      {/* Sync Logs Modal */}
      {(showAllSyncLogs || selectedSyncPlaylist) && (
        <SyncLogsModal
          playlist={selectedSyncPlaylist}
          onClose={() => {
            setShowAllSyncLogs(false);
            setSelectedSyncPlaylist(null);
          }}
          onSyncTriggered={fetchPlaylists}
        />
      )}

      {/* Delete Playlist Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(playlistToDelete)}
        onClose={() => {
          if (!deleting) {
            setPlaylistToDelete(null);
            setDeleteError('');
          }
        }}
        onConfirm={async () => {
          setDeleting(true);
          setDeleteError('');
          try {
            await playlistApi.deletePlaylist(playlistToDelete.id);
            setPlaylistToDelete(null);
            await fetchPlaylists();
          } catch (err) {
            setDeleteError(err.message || 'Failed to delete playlist');
          } finally {
            setDeleting(false);
          }
        }}
        loading={deleting}
        title="Delete Playlist"
        description={
          playlistToDelete ? (
            <>
              Are you sure you want to permanently delete <strong className="text-[#32325d] dark:text-white">"{playlistToDelete.name}"</strong> (ID: {playlistToDelete.id})?
            </>
          ) : null
        }
        alertText={
          playlistToDelete ? (
            <div className="space-y-1">
              <p className="font-semibold">Warning: This action is permanent and irreversible.</p>
              <p className="text-[13px]">
                All channels, categories, VODs, series, and <strong className="font-bold">{playlistToDelete.managed_users_count || 0}</strong> connected managed user(s) will be permanently deleted from the database.
              </p>
            </div>
          ) : null
        }
        error={deleteError}
        confirmLabel="Yes, Delete Playlist"
        variant="danger"
      />

      {/* Playlist Settings Modal */}
      <PlaylistSettingsModal
        isOpen={Boolean(settingsPlaylist)}
        playlist={settingsPlaylist}
        onClose={() => setSettingsPlaylist(null)}
        onSaved={(updated) => {
          setPlaylists((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
          onPlaylistsRefreshed?.();
        }}
      />
    </div>
  );
}
