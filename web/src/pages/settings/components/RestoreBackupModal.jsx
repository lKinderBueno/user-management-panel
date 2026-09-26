import React from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Check,
  Users,
  Sliders,
  Sparkles,
  ShieldCheck,
  Key,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Modal, Button, Alert } from '../../../components/ui';

export default function RestoreBackupModal({
  restoreTarget,
  onClose,
  onExecuteRestore,
  restoring = false,
  restoreResult = null,
  restoreMode = 'skip',
  setRestoreMode,
  restoreScopeMode = 'all',
  setRestoreScopeMode,
  restoreSelectedListId = '',
  setRestoreSelectedListId,
  restoreUsers = true,
  setRestoreUsers,
  restoreSettings = true,
  setRestoreSettings,
  restoreToken = false,
  setRestoreToken,
  restorePlaylists = true,
  setRestorePlaylists,
  restoreTeamMembers = true,
  setRestoreTeamMembers,
  restoreTeamScope = 'collaborators_only',
  setRestoreTeamScope,
  availableRestorePlaylists = [],
  formatDate,
}) {
  if (!restoreTarget) return null;

  return (
    <Modal
      isOpen={Boolean(restoreTarget)}
      onClose={() => { if (!restoring) onClose(); }}
      size="lg"
    >
      {restoreResult ? (
        <>
          <Modal.Body className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#f8f9fe] dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700 text-[#2dce89] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#32325d] dark:text-white">Restore Completed</h3>
              <p className="text-xs text-[#525f7f] dark:text-slate-300">{restoreResult.message}</p>
            </div>

            {/* Users stats */}
            {(restoreUsers || (restoreResult.created > 0 || restoreResult.updated > 0 || restoreResult.skipped > 0)) && (
              <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-700 rounded-[0.375rem] p-3 space-y-2">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400 flex items-center justify-between">
                  <span>Managed Users</span>
                  <span className="font-mono text-[#525f7f] dark:text-slate-300 font-semibold">
                    Total: {(restoreResult.created || 0) + (restoreResult.updated || 0) + (restoreResult.skipped || 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white dark:bg-slate-800 py-2 px-2.5 rounded-[0.375rem] border border-[#e9ecef] dark:border-slate-700">
                    <span className="text-[12px] uppercase font-semibold text-[#8898aa] dark:text-slate-400 block">Created</span>
                    <span className="text-sm font-bold text-[#32325d] dark:text-white font-mono">{restoreResult.created}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 py-2 px-2.5 rounded-[0.375rem] border border-[#e9ecef] dark:border-slate-700">
                    <span className="text-[12px] uppercase font-semibold text-[#8898aa] dark:text-slate-400 block">Updated</span>
                    <span className="text-sm font-bold text-[#32325d] dark:text-white font-mono">{restoreResult.updated}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 py-2 px-2.5 rounded-[0.375rem] border border-[#e9ecef] dark:border-slate-700">
                    <span className="text-[12px] uppercase font-semibold text-[#8898aa] dark:text-slate-400 block">Skipped</span>
                    <span className="text-sm font-bold text-[#8898aa] dark:text-slate-400 font-mono">{restoreResult.skipped}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Restored Components List */}
            {(restoreResult.settings_restored || restoreResult.playlists_restored > 0 || restoreResult.team_members_restored > 0 || restoreResult.token_restored) && (
              <div className="bg-white dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700 rounded-[0.375rem] divide-y divide-[#e9ecef] dark:divide-slate-700 text-xs">
                {restoreResult.settings_restored && (
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#32325d] dark:text-white">
                      <Check className="w-3.5 h-3.5 text-[#2dce89] shrink-0" />
                      <span>System Settings & Cache configuration</span>
                    </div>
                    <span className="text-[13px] font-medium text-[#8898aa] dark:text-slate-400">Applied</span>
                  </div>
                )}
                {restoreResult.playlists_restored > 0 && (
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#32325d] dark:text-white">
                      <Check className="w-3.5 h-3.5 text-[#2dce89] shrink-0" />
                      <span>Playlist configurations & Welcome info</span>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-[#525f7f] dark:text-slate-300 bg-[#f8f9fe] dark:bg-slate-700 border border-[#e9ecef] dark:border-slate-600 px-2 py-0.5 rounded">
                      {restoreResult.playlists_restored} updated
                    </span>
                  </div>
                )}
                {restoreResult.team_members_restored > 0 && (
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#32325d] dark:text-white">
                      <Check className="w-3.5 h-3.5 text-[#2dce89] shrink-0" />
                      <span>Team accounts (Admins & Collaborators)</span>
                    </div>
                    <span className="font-mono text-[12px] font-semibold text-[#525f7f] dark:text-slate-300 bg-[#f8f9fe] dark:bg-slate-700 border border-[#e9ecef] dark:border-slate-600 px-2 py-0.5 rounded">
                      {restoreResult.team_members_restored} restored
                    </span>
                  </div>
                )}
                {restoreResult.token_restored && (
                  <div className="px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#32325d] dark:text-white">
                      <Check className="w-3.5 h-3.5 text-[#2dce89] shrink-0" />
                      <span>PlaylistLabs Access Token</span>
                    </div>
                    <span className="text-[13px] font-medium text-[#8898aa] dark:text-slate-400">Updated</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[13px] text-[#8898aa] dark:text-slate-400 text-center pt-1">
              All requested items have been restored and live playlist counters have been updated.
            </p>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
              className="w-full"
              icon={<Check className="w-4 h-4" />}
            >
              Done — Close Window
            </Button>
          </Modal.Footer>
        </>
      ) : (
        <>
          <Modal.Header
            title="Selective Backup Restore"
            subtitle={restoreTarget.isLocalFile ? `Local File: ${restoreTarget.filename}` : `Server Snapshot: ${restoreTarget.filename}`}
            icon={<RotateCcw className="w-5 h-5" />}
            onClose={() => { if (!restoring) onClose(); }}
            showClose={!restoring}
          />

          <Modal.Body className="space-y-4">

            {/* Snapshot Metadata Box */}
            <div className="space-y-1.5 text-xs bg-[#f8f9fe] dark:bg-slate-800/60 p-3 rounded-[0.375rem] border border-[#e9ecef] dark:border-slate-700">
              <div className="flex justify-between text-[#8898aa] dark:text-slate-400">
                <span>Scope / Type:</span>
                <span className="font-semibold text-[#32325d] dark:text-white">
                  {restoreTarget.playlist_name
                    ? `Playlist: ${restoreTarget.playlist_name}`
                    : restoreTarget.backup_type === 'settings'
                      ? 'Settings Only'
                      : restoreTarget.backup_type === 'users'
                        ? 'Users Only'
                        : 'Full System Snapshot'}
                </span>
              </div>
              <div className="flex justify-between text-[#8898aa] dark:text-slate-400">
                <span>Users in snapshot:</span>
                <span className="font-mono text-[#32325d] dark:text-white font-bold">
                  {restoreTarget.backup_type === 'settings' ? 'N/A' : (restoreTarget.total_users ?? 'All')}
                </span>
              </div>
              <div className="flex justify-between text-[#8898aa] dark:text-slate-400">
                <span>Creation date:</span>
                <span className="font-mono text-[#32325d] dark:text-white">{formatDate ? formatDate(restoreTarget.created_at) : restoreTarget.created_at}</span>
              </div>
              <div className="flex justify-between text-[#8898aa] dark:text-slate-400">
                <span>Team accounts in snapshot:</span>
                <span className="font-semibold text-[#32325d] dark:text-white">
                  {restoreTarget.has_team_members || restoreTarget.total_team > 0
                    ? `${restoreTarget.total_team || 'Present'} accounts`
                    : 'None'}
                </span>
              </div>
              <div className="flex justify-between text-[#8898aa] dark:text-slate-400">
                <span>API Token in backup:</span>
                <span className={`font-semibold ${restoreTarget.has_token ? 'text-[#fb6340]' : 'text-[#2dce89]'}`}>
                  {restoreTarget.has_token ? 'Yes (Stored)' : 'No (Excluded)'}
                </span>
              </div>
            </div>

            {/* Selective Components to Restore */}
            <div className="space-y-3 pt-1">
              <label className="text-xs font-bold text-[#32325d] dark:text-white uppercase tracking-wider block">
                Select Components to Restore:
              </label>

              {/* Component 1: Users */}
              <div className={`p-3 rounded-[0.375rem] border transition ${restoreUsers ? 'bg-white dark:bg-slate-800 border-[#3970e1]' : 'bg-gray-50 dark:bg-slate-800/40 border-[#dee2e6] dark:border-slate-700 opacity-70'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreUsers}
                    onChange={(e) => setRestoreUsers(e.target.checked)}
                    disabled={restoreTarget.backup_type === 'settings' || restoreTarget.backup_type === 'team' || (restoreTarget.total_users === 0 && (!restoreTarget.filePayload?.users || restoreTarget.filePayload.users.length === 0))}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#3970e1]" />
                      <span>Managed Users</span>
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                      Restore user accounts, credentials, expirations, and playlist associations
                    </span>
                  </div>
                </label>

                {restoreUsers && (
                  <div className="mt-3 pt-3 border-t border-[#f0f3f6] dark:border-slate-700 space-y-3 text-xs pl-6">
                    {/* Conflict Mode */}
                    <div>
                      <span className="font-semibold text-[#525f7f] dark:text-slate-300 block mb-1">Conflict Resolution:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <label
                          className={`p-2 rounded border cursor-pointer text-xs ${restoreMode === 'skip'
                            ? 'bg-[#ebf2ff] dark:bg-blue-950/40 border-[#3970e1] text-[#3970e1] font-semibold'
                            : 'bg-white dark:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="restore_mode"
                            value="skip"
                            checked={restoreMode === 'skip'}
                            onChange={() => setRestoreMode('skip')}
                            className="sr-only"
                          />
                          Skip existing users
                        </label>
                        <label
                          className={`p-2 rounded border cursor-pointer text-xs ${restoreMode === 'overwrite'
                            ? 'bg-[#fff8e6] dark:bg-orange-950/40 border-[#fb6340] text-[#fb6340] font-semibold'
                            : 'bg-white dark:bg-slate-800 border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="restore_mode"
                            value="overwrite"
                            checked={restoreMode === 'overwrite'}
                            onChange={() => setRestoreMode('overwrite')}
                            className="sr-only"
                          />
                          Overwrite existing users
                        </label>
                      </div>
                    </div>

                    {/* Scope / Remapping */}
                    <div className="space-y-1.5">
                      <span className="font-semibold text-[#525f7f] dark:text-slate-300 block">Playlist Target Scope:</span>
                      <div className="space-y-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="restore_scope"
                            value="all"
                            checked={restoreScopeMode === 'all'}
                            onChange={() => {
                              setRestoreScopeMode('all');
                              setRestoreSelectedListId('');
                            }}
                            className="text-[#3970e1] focus:ring-0"
                          />
                          <span className="text-[#32325d] dark:text-slate-200">Restore users to their original playlist(s)</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="restore_scope"
                            value="filter_source"
                            checked={restoreScopeMode === 'filter_source'}
                            onChange={() => setRestoreScopeMode('filter_source')}
                            className="text-[#3970e1] focus:ring-0"
                          />
                          <span className="text-[#32325d] dark:text-slate-200">Only restore users from specific playlist</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="restore_scope"
                            value="remap_target"
                            checked={restoreScopeMode === 'remap_target'}
                            onChange={() => setRestoreScopeMode('remap_target')}
                            className="text-[#3970e1] focus:ring-0"
                          />
                          <span className="text-[#32325d] dark:text-slate-200">Remap all restored users into a target playlist</span>
                        </label>
                      </div>

                      {restoreScopeMode !== 'all' && (
                        <select
                          value={restoreSelectedListId}
                          onChange={(e) => setRestoreSelectedListId(e.target.value)}
                          className="w-full mt-1.5 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#495057] dark:text-slate-200 focus:outline-none focus:border-[#3970e1]"
                        >
                          <option value="">-- Select Playlist --</option>
                          {availableRestorePlaylists.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (ID: {p.id})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Component 2: System Settings */}
              <div className={`p-3 rounded-[0.375rem] border transition ${restoreSettings ? 'bg-white dark:bg-slate-800 border-[#3970e1]' : 'bg-gray-50 dark:bg-slate-800/40 border-[#dee2e6] dark:border-slate-700 opacity-70'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreSettings}
                    onChange={(e) => setRestoreSettings(e.target.checked)}
                    disabled={!restoreTarget.has_settings && restoreTarget.backup_type !== 'full' && restoreTarget.backup_type !== 'settings'}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#3970e1]" />
                      <span>System Settings & Sync Schedules</span>
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                      Restore sync intervals, auto backup schedules, retention policies, and cache TTL settings
                    </span>
                  </div>
                </label>
              </div>

              {/* Component 3: Playlist Configurations & Welcome Info */}
              <div className={`p-3 rounded-[0.375rem] border transition ${restorePlaylists ? 'bg-white dark:bg-slate-800 border-[#3970e1]' : 'bg-gray-50 dark:bg-slate-800/40 border-[#dee2e6] dark:border-slate-700 opacity-70'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restorePlaylists}
                    onChange={(e) => setRestorePlaylists(e.target.checked)}
                    disabled={!restoreTarget.has_playlists && restoreTarget.backup_type !== 'full'}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#3970e1]" />
                      <span>Playlist Configs & Welcome Info</span>
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                      Restore Welcome Messages, provider connection limits, tracking timeouts, and provider pattern rules
                    </span>
                  </div>
                </label>
              </div>

              {/* Component 4: Admins & Collaborators (Team Accounts) */}
              <div className={`p-3 rounded-[0.375rem] border transition ${restoreTeamMembers ? 'bg-white dark:bg-slate-800 border-[#3970e1]' : 'bg-gray-50 dark:bg-slate-800/40 border-[#dee2e6] dark:border-slate-700 opacity-70'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreTeamMembers}
                    onChange={(e) => setRestoreTeamMembers(e.target.checked)}
                    disabled={!restoreTarget.has_team_members && restoreTarget.total_team === 0 && restoreTarget.backup_type !== 'team' && restoreTarget.backup_type !== 'full'}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#32325d] dark:text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#3970e1]" />
                      <span>Admins & Collaborators (Team Accounts)</span>
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                      Restore dashboard team accounts, roles, hashed passwords, and assigned playlist permissions
                    </span>
                  </div>
                </label>

                {restoreTeamMembers && (
                  <div className="mt-3 pt-3 border-t border-[#f0f3f6] dark:border-slate-700 space-y-2 text-xs pl-6">
                    <span className="font-semibold text-[#525f7f] dark:text-slate-300 block">Team Scope:</span>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="restore_team_scope"
                          value="collaborators_only"
                          checked={restoreTeamScope === 'collaborators_only'}
                          onChange={() => setRestoreTeamScope('collaborators_only')}
                          className="text-[#3970e1] focus:ring-0"
                        />
                        <span className="text-[#32325d] dark:text-slate-200">Collaborators only (Recommended &mdash; Preserve root admin)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="restore_team_scope"
                          value="all"
                          checked={restoreTeamScope === 'all'}
                          onChange={() => setRestoreTeamScope('all')}
                          className="text-[#3970e1] focus:ring-0"
                        />
                        <span className="text-[#32325d] dark:text-slate-200">All Team Accounts (Admins & Collaborators)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Component 5: API Token */}
              <div className={`p-3 rounded-[0.375rem] border transition ${restoreToken ? 'bg-[#fff5f2] dark:bg-orange-950/20 border-[#fb6340]' : 'bg-gray-50 dark:bg-slate-800/40 border-[#dee2e6] dark:border-slate-700 opacity-70'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreToken}
                    onChange={(e) => setRestoreToken(e.target.checked)}
                    disabled={!restoreTarget.has_token}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#fb6340] focus:ring-0 cursor-pointer"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-[#fb6340] flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      <span>PlaylistLabs Access Token</span>
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400 block">
                      {restoreTarget.has_token
                        ? 'Overwrite current PlaylistLabs token with the token saved inside this backup'
                        : 'This backup does not contain an API Token'}
                    </span>
                  </div>
                </label>
                {restoreToken && (
                  <Alert variant="warning" className="mt-2">
                    Warning: Your current PlaylistLabs Access Token will be replaced.
                  </Alert>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={restoring}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onExecuteRestore}
              loading={restoring}
              disabled={!restoreUsers && !restoreSettings && !restorePlaylists && !restoreToken && !restoreTeamMembers}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              {restoring ? 'Restoring...' : 'Confirm & Restore'}
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
