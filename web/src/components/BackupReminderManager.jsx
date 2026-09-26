import React from 'react';
import { settingsApi } from '../api/client';
import BackupReminderModal from './BackupReminderModal';
import { Download, AlertTriangle, X, CheckCircle2 } from 'lucide-react';

const STORAGE_LAST_DOWNLOADED_KEY = 'playlistlabs_last_downloaded_backup';
const STORAGE_SNOOZE_KEY = 'playlistlabs_backup_reminder_snoozed_until';

export default function BackupReminderManager({ admin }) {
  const [latestBackup, setLatestBackup] = React.useState(null);
  const [downloadMode, setDownloadMode] = React.useState('disabled');
  const [modalOpen, setModalOpen] = React.useState(false);
  const [bannerVisible, setBannerVisible] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [notification, setNotification] = React.useState(null);

  const isAdmin = admin?.role === 'admin';
  const latestBackupRef = React.useRef(latestBackup);
  latestBackupRef.current = latestBackup;
  const isEvaluatingRef = React.useRef(false);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Check and evaluate backup status
  const evaluateBackup = React.useCallback(async () => {
    if (!isAdmin || isEvaluatingRef.current) return;
    isEvaluatingRef.current = true;

    try {
      const res = await settingsApi.getSettings();
      if (!res) return;

      const mode = res.settings?.backup_download_mode || 'disabled';
      setDownloadMode(mode);

      // Latest backup from server
      const newest = res.latest_backup || null;
      setLatestBackup((prev) => {
        if (!prev && !newest) return null;
        if (
          prev &&
          newest &&
          prev.filename === newest.filename &&
          prev.created_at === newest.created_at &&
          prev.file_size === newest.file_size
        ) {
          return prev;
        }
        return newest;
      });

      if (!newest || !newest.filename) {
        setModalOpen(false);
        setBannerVisible(false);
        return;
      }

      const lastDownloaded = localStorage.getItem(STORAGE_LAST_DOWNLOADED_KEY);
      const isDownloaded = lastDownloaded === newest.filename;

      if (isDownloaded) {
        setModalOpen(false);
        setBannerVisible(false);
        return;
      }

      // If mode is disabled, do nothing
      if (mode === 'disabled') {
        setModalOpen(false);
        setBannerVisible(false);
        return;
      }

      // If mode is AUTO, trigger auto-download immediately
      if (mode === 'auto') {
        setModalOpen(false);
        setBannerVisible(false);
        setIsDownloading(true);
        try {
          await settingsApi.downloadStoredBackup(newest.filename);
          localStorage.setItem(STORAGE_LAST_DOWNLOADED_KEY, newest.filename);
          notify(`Backup ${newest.filename} downloaded automatically.`, 'success');
        } catch (err) {
          console.error('Auto-download backup failed:', err);
          // Fallback to banner/prompt if auto-download blocked by browser
          setBannerVisible(true);
          setModalOpen(true);
          notify(`Automatic backup download failed: ${err.message}`, 'error');
        } finally {
          setIsDownloading(false);
        }
        return;
      }

      // If mode is PROMPT (insistent reminder)
      if (mode === 'prompt') {
        const snoozedUntilStr = localStorage.getItem(STORAGE_SNOOZE_KEY);
        const snoozedUntil = snoozedUntilStr ? parseInt(snoozedUntilStr, 10) : 0;
        const now = Date.now();

        if (now < snoozedUntil) {
          // Snoozed: keep modal hidden, but maintain insistent top banner
          setModalOpen(false);
          setBannerVisible(true);
        } else {
          // Not snoozed: show both insistent modal and top banner
          setModalOpen(true);
          setBannerVisible(true);
        }
      }
    } catch (err) {
      console.warn('BackupReminderManager: error evaluating backup state:', err);
    } finally {
      isEvaluatingRef.current = false;
    }
  }, [isAdmin]);

  // Initial load and periodic poll (every 30 seconds)
  React.useEffect(() => {
    if (!isAdmin) return;

    evaluateBackup();
    const interval = setInterval(evaluateBackup, 30000);

    // Listen for custom global events
    const handleBackupDownloaded = (e) => {
      const filename = e?.detail?.filename || latestBackupRef.current?.filename;
      if (filename) {
        localStorage.setItem(STORAGE_LAST_DOWNLOADED_KEY, filename);
      }
      setModalOpen(false);
      setBannerVisible(false);
    };

    const handleSettingsUpdated = () => {
      evaluateBackup();
    };

    window.addEventListener('backup-downloaded', handleBackupDownloaded);
    window.addEventListener('settings-updated', handleSettingsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('backup-downloaded', handleBackupDownloaded);
      window.removeEventListener('settings-updated', handleSettingsUpdated);
    };
  }, [isAdmin, evaluateBackup]);

  // Handle manual download action (from modal or banner)
  const handleDownload = async () => {
    if (!latestBackup?.filename) return;
    setIsDownloading(true);
    try {
      await settingsApi.downloadStoredBackup(latestBackup.filename);
      localStorage.setItem(STORAGE_LAST_DOWNLOADED_KEY, latestBackup.filename);
      setModalOpen(false);
      setBannerVisible(false);
      notify(`Backup ${latestBackup.filename} downloaded successfully!`, 'success');
      try {
        window.dispatchEvent(new CustomEvent('backup-downloaded', { detail: { filename: latestBackup.filename } }));
      } catch {}
    } catch (err) {
      notify(`Error downloading backup: ${err.message}`, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle snooze action (postpones modal by 10 minutes, retains insistent banner)
  const handleSnooze = () => {
    const snoozeDuration = 10 * 60 * 1000; // 10 minutes
    const snoozedUntil = Date.now() + snoozeDuration;
    localStorage.setItem(STORAGE_SNOOZE_KEY, snoozedUntil.toString());
    setModalOpen(false);
    setBannerVisible(true);
    notify('Backup reminder snoozed for 10 minutes. Persistent alert remains active.', 'info');
  };

  if (!isAdmin) return null;

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold border ${
              notification.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : notification.type === 'info'
                ? 'bg-blue-50 text-blue-800 border-blue-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="flex-1">{notification.msg}</span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent Top Reminder Banner for Insistent Mode */}
      {bannerVisible && latestBackup && downloadMode === 'prompt' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-950 px-4 py-2 text-xs transition-all animate-in slide-in-from-top duration-200">
          <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <div>
                <span className="font-bold">Pending Backup Download:</span>{' '}
                <span>
                  Backup file <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded font-semibold text-amber-900">{latestBackup.filename}</code> ({latestBackup.total_users || 0} users) has not been downloaded to your computer yet.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-2.5 py-1 text-xs font-semibold text-amber-900 hover:text-amber-950 hover:bg-amber-100 rounded transition"
              >
                View Details
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-bold rounded shadow-sm transition disabled:opacity-50"
              >
                {isDownloading ? (
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insistent Modal Dialog */}
      <BackupReminderModal
        isOpen={modalOpen}
        backup={latestBackup}
        onDownload={handleDownload}
        onSnooze={handleSnooze}
        isDownloading={isDownloading}
      />
    </>
  );
}
