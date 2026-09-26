import React from 'react';
import {
  Database,
  Server,
  Download,
  Key,
  BellRing,
  BellOff,
  HardDrive,
  Layers,
  Sliders,
  Users,
  RotateCcw,
  Trash2,
  Upload,
  Loader2,
  Save,
} from 'lucide-react';
import { settingsApi } from '../../../api/client';
import { Switch, Button } from '../../../components/ui';

export default function BackupTab({
  form,
  setForm,
  bStatus = {},
  backups = [],
  backupScope = 'full',
  setBackupScope,
  backupPlaylistId = '',
  setBackupPlaylistId,
  backupIncludeToken = false,
  setBackupIncludeToken,
  displayedPlaylists = [],
  actionLoading = {},
  handleTriggerBackup,
  handleDownloadDirectBackup,
  handleDeleteBackup,
  handleFileSelectForRestore,
  setRestoreTarget,
  setRestoreMode,
  setRestoreResult,
  setRestoreUsers,
  setRestoreSettings,
  setRestoreToken,
  setRestorePlaylists,
  setRestoreTeamMembers,
  setRestoreTeamScope,
  setRestoreScopeMode,
  setRestoreSelectedListId,
  handleSaveSettings,
  saving = false,
  data = null,
  formatDate,
  formatFileSize,
}) {
  const localFileInputRef = React.useRef(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* AUTOMATIC BACKUP & SERVER ARCHIVE SECTION                 */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] p-5 space-y-5 shadow-argon dark:shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#e9ecef] dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[0.375rem] bg-[#2dce89]/10 border border-[#2dce89]/20 flex items-center justify-center text-[#2dce89]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#32325d] dark:text-white">Automatic Backups & Restore</h2>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400">Periodic backups of all managed users and instant restore</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#525f7f] dark:text-slate-300 font-semibold">Automatic backup:</span>
              <Switch
                checked={form.backup_enabled}
                onCheckedChange={(checked) => setForm({ ...form, backup_enabled: checked })}
                aria-label="Enable Automatic Backups"
              />
            </div>
          </div>
        </div>

        {/* Backup Scope & Options Toolbar */}
        <div className="p-4 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#32325d] dark:text-white block">Create Backup Snapshot or Download</span>
              <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Configure scope and options for immediate download or server storage</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTriggerBackup}
                disabled={actionLoading.backupRun || bStatus.is_running}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50"
              >
                {actionLoading.backupRun || bStatus.is_running ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Server className="w-3.5 h-3.5" />
                )}
                <span>Create Server Snapshot</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadDirectBackup}
                disabled={actionLoading.downloadBackup}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-[#3970e1]" />
                <span>Download Local JSON</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="text-[12px] font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block mb-1">
                Backup Scope
              </label>
              <select
                value={backupScope}
                onChange={(e) => setBackupScope(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#32325d] dark:text-white focus:outline-none focus:border-[#2dce89] shadow-sm font-medium"
              >
                <option value="full">Full Backup (Users, Settings, Team)</option>
                <option value="users_all">All Managed Users Only</option>
                <option value="playlist">Single Playlist Users Only</option>
                <option value="team">Team Only (Admins & Collabs)</option>
                <option value="settings">Settings & Welcome Info Only</option>
              </select>
            </div>

            {backupScope === 'playlist' ? (
              <div>
                <label className="text-[12px] font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block mb-1">
                  Select Playlist
                </label>
                <select
                  value={backupPlaylistId}
                  onChange={(e) => setBackupPlaylistId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#32325d] dark:text-white focus:outline-none focus:border-[#2dce89] shadow-sm font-medium"
                >
                  <option value="">-- Choose Playlist --</option>
                  {displayedPlaylists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Users: {p.managed_users_count || 0})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex flex-col justify-end">
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">
                  {backupScope === 'full' && 'Includes all users, settings, Redis TTLs, playlists, and team accounts.'}
                  {backupScope === 'users_all' && 'Includes all managed user accounts across all synchronized playlists.'}
                  {backupScope === 'team' && 'Includes all Administrator and Collaborator accounts and permissions.'}
                  {backupScope === 'settings' && 'Includes sync intervals, Redis TTLs, and Welcome Info without user lines.'}
                </span>
              </div>
            )}

            <div className="flex items-center">
              <label className="flex items-center gap-2 p-2 rounded-[0.375rem] bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60 cursor-pointer w-full shadow-sm">
                <input
                  type="checkbox"
                  checked={backupIncludeToken}
                  onChange={(e) => setBackupIncludeToken(e.target.checked)}
                  className="text-[#f5365c] focus:ring-0 rounded"
                />
                <div>
                  <span className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-[#f5365c]" />
                    <span>Include Token</span>
                  </span>
                  <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                    {backupIncludeToken ? 'Token saved (Sensitive)' : 'Token excluded (Safe)'}
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Backup Intervals & Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Automatic backup interval:</span>
              <span className="text-[#2dce89] font-mono font-semibold">Every {form.backup_interval_hours} hours</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[6, 12, 24, 48, 72].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setForm({ ...form, backup_interval_hours: hrs })}
                  className={`px-3 py-1 rounded-[0.375rem] text-xs font-semibold transition ${form.backup_interval_hours === hrs
                      ? 'bg-[#2dce89] text-white shadow-argon-sm'
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
                  max="720"
                  value={form.backup_interval_hours}
                  onChange={(e) => setForm({ ...form, backup_interval_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-16 px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-center text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#2dce89]"
                />
                <span className="text-xs text-[#8898aa] dark:text-slate-400">hours</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#32325d] dark:text-white flex items-center justify-between">
              <span>Snapshot retention:</span>
              <span className="text-[#525f7f] dark:text-slate-300 font-mono font-semibold">{form.backup_retention_days} days</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="365"
                value={form.backup_retention_days}
                onChange={(e) => setForm({ ...form, backup_retention_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-24 px-2.5 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#2dce89]"
              />
              <span className="text-xs text-[#8898aa] dark:text-slate-400">
                (Backups older than {form.backup_retention_days} days will be automatically deleted)
              </span>
            </div>
          </div>
        </div>

        {/* Backup Download Reminder & Automation Mode */}
        <div className="p-4 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#3970e1]/10 text-[#3970e1] flex items-center justify-center">
                <BellRing className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#32325d] dark:text-white">
                Backup Download Reminder & Automation
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {form.backup_download_mode !== (data?.settings?.backup_download_mode || 'disabled') && (
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2dce89] hover:bg-[#26af74] text-white rounded-[0.25rem] text-xs font-semibold shadow-argon-sm transition active:scale-[0.98] disabled:opacity-50"
                  title="Save backup download mode"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  <span>Save Mode</span>
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-[#525f7f] dark:text-slate-300 leading-relaxed">
            Choose whether to receive an insistent download reminder prompt when a backup is ready, or have your browser automatically download new backups.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Option 1: Disabled */}
            <div
              onClick={() => setForm({ ...form, backup_download_mode: 'disabled' })}
              className={`p-3.5 rounded-[0.375rem] border cursor-pointer transition flex flex-col justify-between gap-2.5 ${form.backup_download_mode === 'disabled'
                  ? 'bg-white dark:bg-slate-800 border-[#3970e1] shadow-argon-sm ring-1 ring-[#3970e1]'
                  : 'bg-white/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-[0.25rem] flex items-center justify-center ${form.backup_download_mode === 'disabled'
                      ? 'bg-[#3970e1]/10 text-[#3970e1]'
                      : 'bg-gray-100 dark:bg-slate-700 text-[#8898aa] dark:text-slate-400'
                    }`}>
                    <BellOff className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white">Disabled</span>
                </div>
                <input
                  type="radio"
                  name="backup_download_mode"
                  checked={form.backup_download_mode === 'disabled'}
                  onChange={() => setForm({ ...form, backup_download_mode: 'disabled' })}
                  className="text-[#3970e1] focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Default. No reminders or automatic downloads. Backups remain stored on the server only.
              </p>
            </div>

            {/* Option 2: Insistent Prompt */}
            <div
              onClick={() => setForm({ ...form, backup_download_mode: 'prompt' })}
              className={`p-3.5 rounded-[0.375rem] border cursor-pointer transition flex flex-col justify-between gap-2.5 ${form.backup_download_mode === 'prompt'
                  ? 'bg-white dark:bg-slate-800 border-[#8965e0] shadow-argon-sm ring-1 ring-[#8965e0]'
                  : 'bg-white/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-[0.25rem] flex items-center justify-center ${form.backup_download_mode === 'prompt'
                      ? 'bg-[#8965e0]/10 text-[#8965e0]'
                      : 'bg-gray-100 dark:bg-slate-700 text-[#8898aa] dark:text-slate-400'
                    }`}>
                    <BellRing className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#32325d] dark:text-white block">Insistent Prompt</span>
                    <span className="text-[12px] font-semibold text-[#8965e0] bg-[#8965e0]/10 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="backup_download_mode"
                  checked={form.backup_download_mode === 'prompt'}
                  onChange={() => setForm({ ...form, backup_download_mode: 'prompt' })}
                  className="text-[#8965e0] focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Shows an insistent modal and persistent alert banner whenever a new backup snapshot is available until you download it.
              </p>
            </div>

            {/* Option 3: Auto-Download */}
            <div
              onClick={() => setForm({ ...form, backup_download_mode: 'auto' })}
              className={`p-3.5 rounded-[0.375rem] border cursor-pointer transition flex flex-col justify-between gap-2.5 ${form.backup_download_mode === 'auto'
                  ? 'bg-white dark:bg-slate-800 border-[#2dce89] shadow-argon-sm ring-1 ring-[#2dce89]'
                  : 'bg-white/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-[0.25rem] flex items-center justify-center ${form.backup_download_mode === 'auto'
                      ? 'bg-[#2dce89]/10 text-[#2dce89]'
                      : 'bg-gray-100 dark:bg-slate-700 text-[#8898aa] dark:text-slate-400'
                    }`}>
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white">Auto-Download</span>
                </div>
                <input
                  type="radio"
                  name="backup_download_mode"
                  checked={form.backup_download_mode === 'auto'}
                  onChange={() => setForm({ ...form, backup_download_mode: 'auto' })}
                  className="text-[#2dce89] focus:ring-0 cursor-pointer"
                />
              </div>
              <p className="text-[13px] text-[#8898aa] dark:text-slate-400 leading-relaxed">
                Automatically triggers a download in your browser as soon as a new server backup snapshot is created.
              </p>
            </div>
          </div>
        </div>

        {/* Snapshot Status Card */}
        <div className="p-3.5 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[#8898aa] dark:text-slate-400 block mb-0.5">Last backup created:</span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">{formatDate(bStatus.last_run)}</span>
          </div>
          <div>
            <span className="text-[#8898aa] dark:text-slate-400 block mb-0.5">Next scheduled:</span>
            <span className="text-[#32325d] dark:text-white font-mono font-semibold">
              {form.backup_enabled ? formatDate(bStatus.next_run) : 'Disabled'}
            </span>
          </div>
          <div>
            <span className="text-[#8898aa] dark:text-slate-400 block mb-0.5">Available snapshots on server:</span>
            <span className="text-[#2dce89] font-mono font-semibold">{backups.length} files available</span>
          </div>
        </div>

        {/* Server Backups Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-[#2dce89]" />
              <span>Available Snapshots on Server ({backups.length})</span>
            </h3>
            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Server location: ./backups/</span>
          </div>

          {backups.length === 0 ? (
            <div className="p-8 text-center bg-[#f8f9fe] dark:bg-slate-800/40 rounded-[0.375rem] border border-dashed border-[#dee2e6] dark:border-slate-700 text-xs text-[#8898aa] dark:text-slate-400">
              No backups stored on server. Click "Create Server Snapshot" to generate one now.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#dee2e6] dark:border-slate-800 rounded-[0.375rem] bg-white dark:bg-slate-900 shadow-argon-sm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e9ecef] dark:border-slate-800 text-[#8898aa] dark:text-slate-400 bg-[#f6f9fc] dark:bg-slate-800/80 uppercase text-[12px] tracking-wider font-semibold">
                    <th className="py-2.5 px-3">File Name</th>
                    <th className="py-2.5 px-3">Created At</th>
                    <th className="py-2.5 px-3">Trigger</th>
                    <th className="py-2.5 px-3">Scope & Content</th>
                    <th className="py-2.5 px-3">Users</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800 text-[#525f7f] dark:text-slate-300">
                  {backups.map((b) => (
                    <tr key={b.filename} className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 font-mono text-[#32325d] dark:text-white font-semibold">{b.filename}</td>
                      <td className="py-2.5 px-3 font-mono text-[#8898aa] dark:text-slate-400">{formatDate(b.created_at)}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-[0.25rem] font-mono font-semibold ${b.is_auto
                              ? 'bg-[#8965e0]/10 text-[#8965e0] border border-[#8965e0]/20'
                              : 'bg-[#2dce89]/10 text-[#2dce89] border border-[#2dce89]/20'
                            }`}
                        >
                          {b.is_auto ? 'Automatic' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {b.playlist_name || b.playlist_id ? (
                            <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-medium bg-[#ebf2ff] dark:bg-blue-950/40 text-[#3970e1] border border-[#3970e1]/20 flex items-center gap-1">
                              <Layers className="w-2.5 h-2.5" />
                              <span>{b.playlist_name || `Playlist #${b.playlist_id}`}</span>
                            </span>
                          ) : b.backup_type === 'settings' ? (
                            <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-medium bg-[#fff8e6] dark:bg-orange-950/30 text-[#fb6340] border border-[#fb6340]/20 flex items-center gap-1">
                              <Sliders className="w-2.5 h-2.5" />
                              <span>Settings Only</span>
                            </span>
                          ) : b.backup_type === 'team' ? (
                            <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-medium bg-[#e6fffa] dark:bg-emerald-950/30 text-[#2dce89] border border-[#2dce89]/20 flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              <span>Team Only</span>
                            </span>
                          ) : b.backup_type === 'users' ? (
                            <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-medium bg-[#f0f3f6] dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              <span>Users Only</span>
                            </span>
                          ) : (
                            <span className="text-[12px] px-2 py-0.5 rounded-[0.25rem] font-medium bg-[#2dce89]/10 text-[#2dce89] border border-[#2dce89]/20 flex items-center gap-1">
                              <span>Full Snapshot</span>
                            </span>
                          )}

                          {b.has_settings && (
                            <span className="text-[12px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 border border-gray-200 dark:border-slate-700" title="Includes system settings">
                              Settings
                            </span>
                          )}
                          {b.has_playlists && (
                            <span className="text-[12px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50" title="Includes playlists & welcome info">
                              Welcome Info
                            </span>
                          )}
                          {(b.has_team_members || b.total_team > 0) && (
                            <span className="text-[12px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50" title={`Includes ${b.total_team || ''} Team Account(s)`}>
                              Team ({b.total_team || '✓'})
                            </span>
                          )}
                          {b.has_token && (
                            <span className="text-[12px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50" title="Includes PlaylistLabs Access Token">
                              Token
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#32325d] dark:text-white font-semibold">
                        {b.backup_type === 'settings' || b.backup_type === 'team' ? 'N/A' : (b.total_users ?? '-')}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#8898aa] dark:text-slate-400">{formatFileSize(b.size_bytes)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setRestoreTarget(b);
                              setRestoreMode('skip');
                              setRestoreResult(null);
                              const isSettingsOnly = b.backup_type === 'settings';
                              const isTeamOnly = b.backup_type === 'team';
                              setRestoreUsers(!isSettingsOnly && !isTeamOnly);
                              setRestoreSettings(Boolean(b.has_settings || b.backup_type === 'settings' || b.backup_type === 'full' || (!b.backup_type && b.has_settings)));
                              setRestoreToken(false);
                              setRestorePlaylists(Boolean(b.has_playlists || b.backup_type === 'full'));
                              setRestoreTeamMembers(Boolean(b.has_team_members || b.total_team > 0 || b.backup_type === 'team' || b.backup_type === 'full'));
                              setRestoreTeamScope('collaborators_only');
                              if (b.playlist_id) {
                                setRestoreScopeMode('filter_source');
                                setRestoreSelectedListId(String(b.playlist_id));
                              } else {
                                setRestoreScopeMode('all');
                                setRestoreSelectedListId('');
                              }
                            }}
                            className="px-2.5 py-1 rounded-[0.25rem] bg-[#ebf2ff] dark:bg-blue-950/40 hover:bg-[#d8e6ff] dark:hover:bg-blue-900/50 text-[#3970e1] border border-[#3970e1]/30 font-semibold transition active:scale-[0.98] flex items-center gap-1 shadow-argon-sm"
                            title="Restore backup"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restore</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              settingsApi.downloadStoredBackup(b.filename);
                              try {
                                window.dispatchEvent(new CustomEvent('backup-downloaded', { detail: { filename: b.filename } }));
                              } catch { }
                            }}
                            className="p-1 rounded-[0.25rem] bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 transition shadow-argon-sm"
                            title="Download backup file"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteBackup(b.filename)}
                            className="p-1 rounded-[0.25rem] bg-[#fdf2f2] dark:bg-red-950/30 hover:bg-[#fde8e8] dark:hover:bg-red-900/40 text-[#f5365c] border border-[#f5365c]/30 transition shadow-argon-sm"
                            title="Delete backup"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Local File Upload Restore Area */}
        <div className="pt-4 border-t border-[#e9ecef] dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#3970e1]" />
            <h3 className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
              Restore from Local File (.json)
            </h3>
          </div>

          <div className="p-4 rounded-[0.375rem] bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-700">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelectForRestore(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => localFileInputRef.current?.click()}
              className="border-2 border-dashed border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1] bg-white dark:bg-slate-900 rounded-lg p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 shadow-sm"
            >
              <input
                ref={localFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelectForRestore(f);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <div className="w-10 h-10 shrink-0 aspect-square rounded-full bg-[#ebf2ff] dark:bg-blue-950/40 flex items-center justify-center text-[#3970e1]">
                <Upload className="w-5 h-5 shrink-0" />
              </div>

              <div>
                <p className="text-xs font-bold text-[#32325d] dark:text-white">
                  Click to select or drag & drop a backup file (.json)
                </p>
                <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                  Opens the granular restore configuration to select which playlist users, team accounts, or settings to import
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
