import React from 'react';
import { Download, Clock, ShieldAlert, Database } from 'lucide-react';
import { Modal, Button, Alert } from './ui';

export default function BackupReminderModal({
  isOpen,
  backup,
  onDownload,
  onSnooze,
  isDownloading = false,
}) {
  if (!isOpen || !backup) return null;

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown';
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onSnooze} size="lg">
      {/* Header */}
      <Modal.Header
        icon={<ShieldAlert className="w-5 h-5 text-white" />}
        iconClassName="bg-white/20 border border-white/30 text-white"
        title="Backup Download Reminder"
        subtitle="A new server backup is available for download"
        onClose={onSnooze}
        className="bg-gradient-to-r from-blue-600 to-indigo-600 !text-white border-transparent"
      />

      {/* Content */}
      <Modal.Body className="space-y-5 text-slate-700 dark:text-slate-300 text-xs">
        {/* Security alert message */}
        <Alert
          variant="warning"
          title="Protect Your Data Offline"
          icon={<Database className="w-4 h-4" />}
        >
          A recent system backup snapshot is ready on the server. To ensure disaster recovery and prevent data loss, it is strongly recommended to store a local copy on your computer.
        </Alert>

        {/* Backup metadata card */}
        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs font-sans">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Backup File:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white break-all text-[13px] text-right">
              {backup.filename}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Generated At:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {formatDate(backup.created_at)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Included Users:</span>
            <span className="font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-2 py-0.5 rounded text-[12px]">
              {backup.total_users || 0} managed users
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">File Size:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">
              {formatFileSize(backup.size_bytes)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Snapshot Type:</span>
            <span className={`text-[12px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
              backup.is_auto
                ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
                : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
            }`}>
              {backup.is_auto ? 'Scheduled Auto' : 'Manual Snapshot'}
            </span>
          </div>
        </div>

        <p className="text-[13px] text-slate-500 dark:text-slate-400 italic">
          Note: This insistent reminder will periodically reappear until you download this backup snapshot.
        </p>
      </Modal.Body>

      {/* Footer Actions */}
      <Modal.Footer align="between">
        <Button
          variant="secondary"
          onClick={onSnooze}
          disabled={isDownloading}
          icon={<Clock className="w-3.5 h-3.5" />}
        >
          Remind Me Later (10 min)
        </Button>

        <Button
          variant="success"
          onClick={onDownload}
          loading={isDownloading}
          icon={<Download className="w-4 h-4" />}
        >
          Download Backup Now
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
