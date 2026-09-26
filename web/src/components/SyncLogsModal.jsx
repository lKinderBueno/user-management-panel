import React from 'react';
import { 
  X, 
  RefreshCw, 
  Tv, 
  Film, 
  Clapperboard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Info, 
  Clock, 
  Loader2,
  Check,
  ShieldAlert,
  Play,
  Trash2
} from 'lucide-react';
import { playlistApi } from '../api/client';
import { Modal, Button } from './ui';

export default function SyncLogsModal({ playlist, onClose, onSyncTriggered }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [syncing, setSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState(null);
  const [scope, setScope] = React.useState(playlist?.id ? 'playlist' : 'all'); // 'playlist' | 'all'

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data;
      if (playlist?.id && scope === 'playlist') {
        data = await playlistApi.getSyncLogs(playlist.id, true);
      } else {
        data = await playlistApi.getAllSyncLogs();
      }
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Error loading sync logs');
    } finally {
      setLoading(false);
    }
  }, [playlist?.id, scope]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handle Manual Sync
  const handleTriggerSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMessage({ text: 'Starting synchronization...', type: 'info' });

    try {
      if (playlist?.id && scope === 'playlist') {
        await playlistApi.startSync(playlist.id, false);
      } else {
        await playlistApi.startAllSync(false);
      }
      setSyncMessage({ text: 'Synchronization started in background...', type: 'info' });

      // Poll sync status until completed
      const interval = setInterval(async () => {
        try {
          const status = await playlistApi.getSyncStatus();
          if (!status.is_running) {
            clearInterval(interval);
            setSyncing(false);
            if (status.status === 'completed') {
              setSyncMessage({ text: 'Synchronization completed successfully!', type: 'success' });
            } else if (status.status === 'failed') {
              setSyncMessage({ text: `Synchronization failed: ${status.error || 'Unknown error'}`, type: 'error' });
            } else {
              setSyncMessage(null);
            }
            setTimeout(() => {
              fetchLogs();
              onSyncTriggered?.();
            }, 300);
          } else {
            setSyncMessage({ text: status.step || 'Sync in progress...', type: 'info' });
          }
        } catch {
          clearInterval(interval);
          setSyncing(false);
          fetchLogs();
        }
      }, 1500);

      // Safety timeout after 5 minutes
      setTimeout(() => clearInterval(interval), 300000);
    } catch (err) {
      setSyncing(false);
      setSyncMessage({ text: err.message || 'Error starting synchronization', type: 'error' });
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const formatDuration = (ms) => {
    if (!ms && ms !== 0) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="3xl">
      <Modal.Header
        icon={<RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />}
        title={
          <div className="flex items-center gap-2">
            <span className="truncate">Sync History & Logs</span>
            {playlist?.name && (
              <span className="text-[12px] px-2 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/30 dark:border-blue-800/40 font-semibold truncate">
                {playlist.name}
              </span>
            )}
          </div>
        }
        subtitle={
          <span className="flex items-center gap-1.5 mt-0.5 font-medium">
            <Clock className="w-3 h-3 text-[#adb5bd] dark:text-slate-500 flex-shrink-0" />
            <span>Retained for up to <strong className="text-[#32325d] dark:text-slate-200">7 days</strong> from execution.</span>
          </span>
        }
        actions={
          <Button
            variant="success"
            size="sm"
            onClick={handleTriggerSync}
            loading={syncing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Now
          </Button>
        }
        onClose={onClose}
      />

        {/* Scope Tabs if opened in the context of a playlist */}
        {playlist?.id && (
          <div className="px-5 py-2 border-b border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe] dark:bg-slate-800/80 flex items-center gap-2 text-xs">
            <span className="text-[#8898aa] dark:text-slate-400 text-[13px] font-semibold mr-1">Scope:</span>
            <button
              type="button"
              onClick={() => setScope('playlist')}
              className={`px-2.5 py-1 rounded text-[12px] font-semibold transition ${
                scope === 'playlist'
                  ? 'bg-white dark:bg-slate-700 text-[#3970e1] dark:text-blue-300 shadow-sm border border-[#dee2e6] dark:border-slate-600'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-slate-200'
              }`}
            >
              This Playlist & Global
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`px-2.5 py-1 rounded text-[12px] font-semibold transition ${
                scope === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#3970e1] dark:text-blue-300 shadow-sm border border-[#dee2e6] dark:border-slate-600'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-slate-200'
              }`}
            >
              All Playlists History
            </button>
          </div>
        )}

        {/* Sync in-progress banner */}
        {syncMessage && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 border-b ${
            syncMessage.type === 'error'
              ? 'bg-[#feecee] dark:bg-rose-950/40 border-[#f5365c]/30 dark:border-rose-800/40 text-[#f5365c] dark:text-rose-300'
              : syncMessage.type === 'success'
              ? 'bg-[#e8faf1] dark:bg-emerald-950/40 border-[#2dce89]/30 dark:border-emerald-800/40 text-[#2dce89] dark:text-emerald-300'
              : 'bg-[#eef2ff] dark:bg-blue-950/40 border-[#3970e1]/30 dark:border-blue-800/40 text-[#3970e1] dark:text-blue-300'
          }`}>
            {syncMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : syncMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            )}
            <span className="truncate">{syncMessage.text}</span>
          </div>
        )}

        {/* Content Body */}
        <Modal.Body className="p-5 space-y-3.5">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-[#3970e1] animate-spin" />
              <span className="text-xs font-semibold text-[#8898aa] dark:text-slate-400">Loading synchronization logs...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-[#feecee] dark:bg-rose-950/40 border border-[#f5365c]/30 dark:border-rose-800/40 rounded text-xs text-[#f5365c] dark:text-rose-300 font-semibold flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-[#f8f9fe] dark:bg-slate-800/50 border border-[#dee2e6] dark:border-slate-700 rounded-lg max-w-md mx-auto space-y-2">
              <Clock className="w-8 h-8 text-[#adb5bd] dark:text-slate-500 mx-auto stroke-[1.5]" />
              <p className="text-[#32325d] dark:text-white text-xs font-bold">No sync logs in the last 7 days</p>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 max-w-xs mx-auto">
                No sync events have been recorded in the past week. You can trigger a new sync by clicking &quot;Sync Now&quot;.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isSuccess = log.status === 'success';
                const isSkipped = log.status === 'skipped';
                const isError = log.status === 'error' || log.status === 'failed';
                const isWarning = log.status === 'warning';
                const isDeleted = log.status === 'deleted';

                return (
                  <div
                    key={log.id}
                    className={`border rounded-lg p-3.5 transition flex flex-col gap-2.5 text-xs shadow-sm ${
                      isError
                        ? 'bg-[#fff8f8] dark:bg-rose-950/30 border-[#f5365c]/30 dark:border-rose-800/40 hover:border-[#f5365c]/50'
                        : isWarning
                        ? 'bg-[#fffdf5] dark:bg-amber-950/30 border-amber-300/50 dark:border-amber-800/40 hover:border-amber-400'
                        : 'bg-[#f8f9fe] dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border-[#dee2e6] dark:border-slate-700'
                    }`}
                  >
                    {/* Top row: Status, playlist name, timestamp, duration */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isSuccess && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#e8faf1] dark:bg-emerald-950/50 text-[#2dce89] dark:text-emerald-400 border border-[#2dce89]/30 dark:border-emerald-800/40 text-[12px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        )}
                        {isSkipped && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-slate-700 text-zinc-600 dark:text-slate-300 border border-zinc-300 dark:border-slate-600 text-[12px] font-bold">
                            <Info className="w-3 h-3 text-zinc-500 dark:text-slate-400" />
                            <span>No Changes</span>
                          </span>
                        )}
                        {isError && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#feecee] dark:bg-rose-950/50 text-[#f5365c] dark:text-rose-400 border border-[#f5365c]/30 dark:border-rose-800/40 text-[12px] font-bold">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}
                        {isWarning && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/40 text-[12px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Warning</span>
                          </span>
                        )}
                        {isDeleted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-slate-700 text-zinc-700 dark:text-slate-300 border border-zinc-300 dark:border-slate-600 text-[12px] font-bold">
                            <Trash2 className="w-3 h-3 text-zinc-500 dark:text-slate-400" />
                            <span>Deleted</span>
                          </span>
                        )}

                        {/* Global Sync Indicator */}
                        {log.sync_type === 'all' && (
                          <span className="text-[12px] px-1.5 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/30 dark:border-blue-800/40 font-semibold">
                            Global Sync
                          </span>
                        )}

                        {/* Playlist Name if present */}
                        {log.playlist_name && log.sync_type !== 'all' && (
                          <span className="font-bold text-[#32325d] dark:text-slate-100 text-xs">
                            {log.playlist_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[13px] text-[#8898aa] dark:text-slate-400">
                        <span className="font-mono text-[#525f7f] dark:text-slate-300">
                          {formatTimestamp(log.created_at)}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-[#525f7f] dark:text-slate-300">
                          {formatRelativeTime(log.created_at)}
                        </span>
                        {log.duration_ms > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[#525f7f] dark:text-slate-200 bg-white dark:bg-slate-700 border border-[#dee2e6] dark:border-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              {formatDuration(log.duration_ms)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Middle row: Counts / Stats */}
                    {(log.channels_count > 0 || log.movies_count > 0 || log.series_count > 0 || log.episodes_count > 0 || log.epg_count > 0) && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 py-2 border-y border-[#e9ecef] dark:border-slate-700 text-[13px]">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-[#dee2e6] dark:border-slate-700 shadow-sm">
                          <Tv className="w-3 h-3 text-[#3970e1] dark:text-blue-400" />
                          <span className="text-[#8898aa] dark:text-slate-400">Channels:</span>
                          <strong className="font-mono text-[#32325d] dark:text-slate-100">{log.channels_count}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-[#dee2e6] dark:border-slate-700 shadow-sm">
                          <Film className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                          <span className="text-[#8898aa] dark:text-slate-400">Movies:</span>
                          <strong className="font-mono text-[#32325d] dark:text-slate-100">{log.movies_count}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-[#dee2e6] dark:border-slate-700 shadow-sm">
                          <Clapperboard className="w-3 h-3 text-[#fb6340] dark:text-orange-400" />
                          <span className="text-[#8898aa] dark:text-slate-400">Series:</span>
                          <strong className="font-mono text-[#32325d] dark:text-slate-100">{log.series_count}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-[#dee2e6] dark:border-slate-700 shadow-sm">
                          <Play className="w-3 h-3 text-[#2dce89] dark:text-emerald-400" />
                          <span className="text-[#8898aa] dark:text-slate-400">Episodes:</span>
                          <strong className="font-mono text-[#32325d] dark:text-slate-100">{log.episodes_count}</strong>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded border border-[#dee2e6] dark:border-slate-700 shadow-sm">
                          <Calendar className="w-3 h-3 text-[#11cdef] dark:text-cyan-400" />
                          <span className="text-[#8898aa] dark:text-slate-400">EPG:</span>
                          <strong className="font-mono text-[#32325d] dark:text-slate-100">{log.epg_count}</strong>
                        </div>
                      </div>
                    )}

                    {/* Message / Error Details */}
                    {log.message && (
                      <p
                        className={`text-[13px] leading-relaxed break-words ${
                          isError
                            ? 'text-[#f5365c] dark:text-rose-300 font-mono bg-[#feecee] dark:bg-rose-950/50 p-2.5 rounded border border-[#f5365c]/20 dark:border-rose-800/50'
                            : isWarning
                            ? 'text-amber-800 dark:text-amber-300 font-mono bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded border border-amber-300/40 dark:border-amber-800/50'
                            : 'text-[#525f7f] dark:text-slate-300'
                        }`}
                      >
                        {log.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal.Body>

        {/* Footer */}
        <Modal.Footer align="between" className="text-xs text-[#8898aa] dark:text-slate-400 font-medium">
          <span>Total available logs: <strong className="text-[#32325d] dark:text-white font-bold">{logs.length}</strong></span>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            icon={<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh list
          </Button>
        </Modal.Footer>
    </Modal>
  );
}
