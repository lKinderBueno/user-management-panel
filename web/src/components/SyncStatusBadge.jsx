import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, X, Copy, Check } from 'lucide-react';
import { playlistApi } from '../api/client';

export default function SyncStatusBadge({ onSyncCompleted }) {
  const [status, setStatus] = React.useState(null);
  const [displayMode, setDisplayMode] = React.useState('hidden'); // 'hidden' | 'running' | 'completed' | 'failed'
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const wasRunningRef = React.useRef(false);
  const autoDismissTimerRef = React.useRef(null);

  React.useEffect(() => {
    let timer = null;
    let isMounted = true;

    const clearAutoDismiss = () => {
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const data = await playlistApi.getSyncStatus();
        if (!isMounted) return;

        const isRunning = Boolean(data?.is_running || data?.status === 'running');

        if (isRunning) {
          clearAutoDismiss();
          wasRunningRef.current = true;
          setStatus(data);
          setDisplayMode('running');
          timer = setTimeout(poll, 2500);
        } else {
          // Sync is not running
          if (wasRunningRef.current) {
            // It transitioned from running to finished during this session
            wasRunningRef.current = false;
            setStatus(data);

            if (data?.status === 'completed') {
              setDisplayMode('completed');
              onSyncCompleted?.();
              clearAutoDismiss();
              autoDismissTimerRef.current = setTimeout(() => {
                if (isMounted) setDisplayMode('hidden');
              }, 5000);
            } else if (data?.status === 'failed') {
              setDisplayMode('failed');
              clearAutoDismiss();
              autoDismissTimerRef.current = setTimeout(() => {
                if (isMounted) setDisplayMode('hidden');
              }, 20000);
            } else {
              setDisplayMode('hidden');
            }
          } else {
            // Sync was not observed running in this session (e.g. stale completed status from past sync).
            // Do not show any stale "Sync Completed" badge on page load.
          }

          timer = setTimeout(poll, 8000);
        }
      } catch {
        if (isMounted) {
          timer = setTimeout(poll, 10000);
        }
      }
    };

    const handleSyncStarted = () => {
      clearAutoDismiss();
      wasRunningRef.current = true;
      setStatus({ is_running: true, status: 'running', step: 'Starting synchronization...' });
      setDisplayMode('running');
      if (timer) clearTimeout(timer);
      poll();
    };

    window.addEventListener('sync-started', handleSyncStarted);
    poll();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      clearAutoDismiss();
      window.removeEventListener('sync-started', handleSyncStarted);
    };
  }, [onSyncCompleted]);

  const isRunning = displayMode === 'running';
  const isSuccess = displayMode === 'completed';
  const isFailed = displayMode === 'failed';

  const errorMessage = status?.error || status?.step || 'Synchronization failed';

  const handleCopyError = async () => {
    if (!errorMessage) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(errorMessage);
      } else {
        const el = document.createElement('textarea');
        el.value = errorMessage;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDismiss = () => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setDisplayMode('hidden');
    setExpanded(false);
  };

  if (displayMode === 'hidden' || !status) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-md sm:max-w-lg w-[calc(100vw-2.5rem)] sm:w-auto animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs bg-white dark:bg-slate-900 transition-all ${
          isRunning
            ? 'border-[#3970e1]/40 text-[#32325d] dark:text-slate-200'
            : isSuccess
            ? 'border-[#2dce89]/40 text-[#32325d] dark:text-slate-200'
            : 'border-rose-500/50 dark:border-rose-500/40 text-[#32325d] dark:text-slate-200 ring-1 ring-rose-500/10'
        }`}
      >
        <div className="mt-0.5 flex-shrink-0">
          {isRunning && <Loader2 className="w-4 h-4 text-[#3970e1] animate-spin" />}
          {isSuccess && <CheckCircle2 className="w-4 h-4 text-[#2dce89]" />}
          {isFailed && <AlertTriangle className="w-4 h-4 text-[#f5365c]" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-[12px] tracking-wide uppercase text-[#32325d] dark:text-white">
              {isRunning
                ? 'Playlist Synchronization'
                : isSuccess
                ? 'Sync Completed'
                : 'Sync Failed'}
            </span>
          </div>

          {isFailed ? (
            <div className="mt-1.5 space-y-2">
              <div
                className={`text-[12px] text-rose-700 dark:text-rose-300 font-mono bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 rounded-lg p-2.5 break-all select-all leading-relaxed ${
                  expanded ? 'max-h-60 overflow-y-auto' : 'line-clamp-3'
                }`}
                title={errorMessage}
              >
                {errorMessage}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleCopyError}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                  title="Copy error message"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copied ? 'Copied' : 'Copy error'}</span>
                </button>

                {errorMessage && errorMessage.length > 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (autoDismissTimerRef.current) {
                        clearTimeout(autoDismissTimerRef.current);
                        autoDismissTimerRef.current = null;
                      }
                      setExpanded(!expanded);
                    }}
                    className="text-[11px] font-medium text-[#3970e1] hover:underline dark:text-blue-400"
                  >
                    {expanded ? 'Show less' : 'Show full message'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-0.5 line-clamp-2 leading-tight font-mono font-medium break-all">
              {isRunning
                ? (status.step || 'Processing playlists...')
                : (status.step || 'Synchronization completed successfully')}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 -mr-1 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-slate-800 rounded transition flex-shrink-0"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
