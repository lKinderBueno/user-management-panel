import React from 'react';
import { 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Users, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { backupApi } from '../api/client';
import { Modal, Button, Alert } from './ui';

export default function RestoreUsersModal({ 
  currentPlaylist, 
  playlists = [], 
  onClose, 
  onSuccess 
}) {
  const fileInputRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [parsedData, setParsedData] = React.useState(null);
  const [parseError, setParseError] = React.useState('');
  
  // Destination: 'current' (force current playlist), 'source_only' (only restore users belonging to this playlist), or 'custom'
  const [targetMode, setTargetMode] = React.useState('current');
  const [customListId, setCustomListId] = React.useState(currentPlaylist?.id || '');

  // Conflict mode: 'skip' or 'overwrite'
  const [conflictMode, setConflictMode] = React.useState('skip');
  const [restoreUsers, setRestoreUsers] = React.useState(true);
  const [restoreWelcomeInfo, setRestoreWelcomeInfo] = React.useState(true);
  const [restoreTeamMembers, setRestoreTeamMembers] = React.useState(false);
  const [restoreTeamScope, setRestoreTeamScope] = React.useState('collaborators_only');

  // Execution state
  const [restoring, setRestoring] = React.useState(false);
  const [restoreError, setRestoreError] = React.useState('');
  const [restoreResult, setRestoreResult] = React.useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setParseError('');
    setRestoreResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawText = event.target.result;
        let json;
        try {
          const sanitized = rawText.replace(/"(id|playlist_id|source_list_id|target_list_id|list_id)"\s*:\s*(\d{10,})/g, '"$1":"$2"');
          json = JSON.parse(sanitized);
        } catch {
          json = JSON.parse(rawText);
        }
        let users = [];
        let metadata = {};
        let hasWelcomeInfo = false;

        let teamMembers = [];
        if (Array.isArray(json)) {
          users = json;
        } else if (json && (Array.isArray(json.users) || json.system_settings || Array.isArray(json.playlists) || Array.isArray(json.team_members))) {
          users = json.users || [];
          teamMembers = json.team_members || [];
          if (Array.isArray(json.playlists) && json.playlists.some((p) => p.welcome_info && Object.keys(p.welcome_info).length > 0)) {
            hasWelcomeInfo = true;
          }
          metadata = {
            version: json.version,
            exportedAt: json.exported_at,
            exportedBy: json.exported_by,
            backupType: json.backup_type,
            playlistId: json.playlist_id != null ? String(json.playlist_id) : null,
            playlistName: json.playlist_name,
            hasWelcomeInfo,
            playlistsCount: json.playlists?.length || 0,
            hasTeamMembers: teamMembers.length > 0,
            teamMembersCount: teamMembers.length,
          };
        } else {
          throw new Error('Unrecognized format. Expected JSON array of users or a valid Backup v1/v2 payload.');
        }

        if (users.length === 0 && !hasWelcomeInfo && teamMembers.length === 0) {
          throw new Error('Backup file contains 0 user records, no team members, and no playlist settings.');
        }

        setRestoreUsers(users.length > 0);
        if (teamMembers.length > 0) {
          setRestoreTeamMembers(true);
        }

        setParsedData({
          users,
          metadata,
          rawJson: json,
        });
      } catch (err) {
        setParseError(err.message || 'Invalid JSON backup file');
        setParsedData(null);
      }
    };
    reader.readAsText(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (!dropped.name.endsWith('.json')) {
        setParseError('Please upload a valid .json file.');
        return;
      }
      const fakeEvent = { target: { files: [dropped] } };
      handleFileChange(fakeEvent);
    }
  };

  const handleExecuteRestore = async () => {
    if (!parsedData) return;
    setRestoring(true);
    setRestoreError('');

    try {
      let targetId = null;
      let sourceId = null;

      if (restoreUsers) {
        if (targetMode === 'current') {
          targetId = currentPlaylist?.id ? String(currentPlaylist.id).trim() : null;
        } else if (targetMode === 'source_only') {
          sourceId = currentPlaylist?.id ? String(currentPlaylist.id).trim() : null;
          targetId = currentPlaylist?.id ? String(currentPlaylist.id).trim() : null;
        } else if (targetMode === 'custom') {
          targetId = customListId ? String(customListId).trim() : null;
        }
      }

      const payload = {
        users: parsedData.users,
        file_content: parsedData.rawJson,
        target_list_id: targetId || undefined,
        source_list_id: sourceId || undefined,
        mode: conflictMode,
        restore_users: restoreUsers && parsedData.users.length > 0,
        restore_playlists: restoreWelcomeInfo && Boolean(parsedData.metadata?.hasWelcomeInfo),
        restore_team_members: restoreTeamMembers && Boolean(parsedData.metadata?.hasTeamMembers),
        restore_team_scope: restoreTeamScope,
      };

      const result = await backupApi.restoreUsers(payload, targetId);
      setRestoreResult(result);
      onSuccess?.(result);
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch {}
    } catch (err) {
      setRestoreError(err.message || 'Error executing restore procedure');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!restoring) onClose?.();
      }}
      size="lg"
      closeOnBackdropClick={!restoring}
      closeOnEsc={!restoring}
    >
      <Modal.Header
        icon={<RotateCcw className="w-4 h-4 text-[#fb6340]" />}
        iconClassName="bg-[#fff5f2] dark:bg-orange-950/40 border border-[#fb6340]/30"
        title="Restore Managed Users"
        subtitle="Import managed users from a JSON backup file"
        onClose={onClose}
      />

      <Modal.Body className="space-y-4">
        {/* Error Message */}
        {(parseError || restoreError) && (
          <Alert variant="error">{parseError || restoreError}</Alert>
        )}

          {/* Success Banner */}
          {restoreResult && (
            <div className="p-4 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-700 rounded-lg space-y-3 text-xs">
              <div className="flex items-center gap-2 text-[#32325d] dark:text-white font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-[#2dce89]" />
                <span>Restore Completed Successfully</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-[#e9ecef] dark:border-slate-700 shadow-xs">
                  <span className="text-[#8898aa] dark:text-slate-400 text-[12px] uppercase font-bold block">Created</span>
                  <span className="text-sm font-bold text-[#32325d] dark:text-white">{restoreResult.created}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-[#e9ecef] dark:border-slate-700 shadow-xs">
                  <span className="text-[#8898aa] dark:text-slate-400 text-[12px] uppercase font-bold block">Updated</span>
                  <span className="text-sm font-bold text-[#32325d] dark:text-white">{restoreResult.updated}</span>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2 rounded border border-[#e9ecef] dark:border-slate-700 shadow-xs">
                  <span className="text-[#8898aa] dark:text-slate-400 text-[12px] uppercase font-bold block">Skipped</span>
                  <span className="text-sm font-bold text-[#8898aa] dark:text-slate-400">{restoreResult.skipped}</span>
                </div>
              </div>
              {restoreResult.team_members_restored > 0 && (
                <div className="p-2.5 bg-white dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700 rounded text-[#32325d] dark:text-slate-200 text-[13px] font-medium flex items-center justify-between">
                  <span>Team Accounts Restored:</span>
                  <span className="font-mono font-bold text-[#525f7f] dark:text-slate-300 bg-[#f8f9fe] dark:bg-slate-700 border border-[#e9ecef] dark:border-slate-600 px-2 py-0.5 rounded">
                    {restoreResult.team_members_restored}
                  </span>
                </div>
              )}
              {restoreResult.playlists_restored > 0 && (
                <div className="p-2.5 bg-white dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700 rounded text-[#32325d] dark:text-slate-200 text-[13px] font-medium flex items-center justify-between">
                  <span>Playlist Welcome Info Restored:</span>
                  <span className="font-mono font-bold text-[#525f7f] dark:text-slate-300 bg-[#f8f9fe] dark:bg-slate-700 border border-[#e9ecef] dark:border-slate-600 px-2 py-0.5 rounded">
                    {restoreResult.playlists_restored}
                  </span>
                </div>
              )}
              {restoreResult.message && (
                <div className="p-2.5 bg-white dark:bg-slate-800 rounded border border-[#e9ecef] dark:border-slate-700 text-[13px] text-[#525f7f] dark:text-slate-300">
                  {restoreResult.message}
                </div>
              )}
            </div>
          )}

          {/* File Upload Zone */}
          {!restoreResult && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                  parsedData 
                    ? 'border-[#2dce89] bg-[#e8faf1] dark:bg-emerald-950/20' 
                    : 'border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1] bg-[#f8f9fe] dark:bg-slate-800/40'
                }`}
              >
                <div className="w-10 h-10 rounded bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 flex items-center justify-center text-[#525f7f] dark:text-slate-300 shadow-sm">
                  {parsedData ? (
                    <CheckCircle2 className="w-5 h-5 text-[#2dce89]" />
                  ) : (
                    <Upload className="w-5 h-5 text-[#3970e1]" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-[#32325d] dark:text-white">
                    {file ? file.name : 'Click to upload or drag & drop JSON backup'}
                  </p>
                  <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                    JSON backup file exported from PlaylistLabs
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Metadata Preview */}
          {parsedData && !restoreResult && (
            <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8898aa] dark:text-slate-400 font-medium">Total Users in File:</span>
                <span className="font-mono font-bold text-[#32325d] dark:text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#3970e1]" />
                  {parsedData.users.length}
                </span>
              </div>

              {parsedData.metadata?.playlistName && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400 font-medium">Source Playlist:</span>
                  <span className="font-semibold text-[#32325d] dark:text-slate-200">
                    {parsedData.metadata.playlistName} (ID: {parsedData.metadata.playlistId})
                  </span>
                </div>
              )}

              {parsedData.metadata?.hasTeamMembers && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400 font-medium">Team Accounts:</span>
                  <span className="font-mono font-bold text-[#825ee4] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#825ee4]" />
                    {parsedData.metadata.teamMembersCount}
                  </span>
                </div>
              )}

              {parsedData.metadata?.exportedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-[#8898aa] dark:text-slate-400 font-medium">Backup Date:</span>
                  <span className="text-[#8898aa] dark:text-slate-400 font-mono text-[13px]">
                    {new Date(parsedData.metadata.exportedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Options: Target Playlist & Conflict Resolution */}
          {parsedData && !restoreResult && (
            <div className="space-y-4 pt-1">
              {/* Managed Users Component Toggle */}
              {parsedData.users.length > 0 && (
                <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#32325d] dark:text-white block">
                        Managed Users ({parsedData.users.length})
                      </span>
                      <span className="text-[13px] text-[#525f7f] dark:text-slate-300">
                        Import managed user accounts into playlist
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={restoreUsers}
                        onChange={(e) => setRestoreUsers(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3970e1]"></div>
                    </label>
                  </div>
                </div>
              )}

              {/* Destination Playlist (shown only when restoreUsers is true) */}
              {restoreUsers && parsedData.users.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target Destination
                  </label>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition">
                      <input
                        type="radio"
                        name="targetMode"
                        value="current"
                        checked={targetMode === 'current'}
                        onChange={() => setTargetMode('current')}
                        className="text-[#3970e1] focus:ring-0"
                      />
                      <div>
                        <span className="text-[#32325d] dark:text-white font-semibold">Import all file users into &quot;{currentPlaylist?.name}&quot;</span>
                        <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                          All user records in the backup will be remapped to this playlist
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition">
                      <input
                        type="radio"
                        name="targetMode"
                        value="source_only"
                        checked={targetMode === 'source_only'}
                        onChange={() => setTargetMode('source_only')}
                        className="text-[#3970e1] focus:ring-0"
                      />
                      <div>
                        <span className="text-[#32325d] dark:text-white font-semibold">Restore ONLY users of &quot;{currentPlaylist?.name}&quot;</span>
                        <p className="text-[13px] text-[#8898aa] dark:text-slate-400">
                          Filters the backup file and only restores users whose original playlist ID matches ({currentPlaylist?.id})
                        </p>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition">
                      <input
                        type="radio"
                        name="targetMode"
                        value="custom"
                        checked={targetMode === 'custom'}
                        onChange={() => setTargetMode('custom')}
                        className="text-[#3970e1] focus:ring-0"
                      />
                      <div className="flex-1">
                        <span className="text-[#32325d] dark:text-white font-semibold">Select different destination playlist</span>
                        {targetMode === 'custom' && (
                          <select
                            value={customListId}
                            onChange={(e) => setCustomListId(e.target.value)}
                            className="mt-1.5 w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
                          >
                            {playlists.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Users: {p.managed_users_count || 0})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Welcome Info & Settings Restore Toggle */}
              {parsedData.metadata?.hasWelcomeInfo && (
                <div className="p-3 bg-[#ebf2ff] dark:bg-blue-950/30 border border-[#3970e1]/30 dark:border-blue-800/50 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#32325d] dark:text-white block">Welcome Info & Stream Settings detected</span>
                    <span className="text-[13px] text-[#525f7f] dark:text-slate-300">Apply Welcome Info configured in backup file to this playlist</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={restoreWelcomeInfo}
                      onChange={(e) => setRestoreWelcomeInfo(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3970e1]"></div>
                  </label>
                </div>
              )}

              {/* Team Accounts Restore Toggle & Scope */}
              {parsedData.metadata?.hasTeamMembers && (
                <div className="p-3 bg-[#f8f5ff] dark:bg-purple-950/30 border border-[#825ee4]/30 dark:border-purple-800/50 rounded-lg space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#32325d] dark:text-white block">
                        Team Accounts ({parsedData.metadata.teamMembersCount})
                      </span>
                      <span className="text-[13px] text-[#525f7f] dark:text-slate-300">
                        Restore administrator and collaborator accounts
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-3">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={restoreTeamMembers}
                        onChange={(e) => setRestoreTeamMembers(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#825ee4]"></div>
                    </label>
                  </div>

                  {restoreTeamMembers && (
                    <div className="pt-2 border-t border-[#825ee4]/20 dark:border-purple-800/40 space-y-1.5">
                      <span className="font-semibold text-[#525f7f] dark:text-slate-300 block text-[13px]">Scope:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center gap-2 p-2 rounded border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-[#825ee4] transition">
                          <input
                            type="radio"
                            name="modalRestoreTeamScope"
                            value="collaborators_only"
                            checked={restoreTeamScope === 'collaborators_only'}
                            onChange={() => setRestoreTeamScope('collaborators_only')}
                            className="text-[#825ee4] focus:ring-0"
                          />
                          <div>
                            <span className="text-[#32325d] dark:text-white font-semibold block text-[13px]">Collaborators Only</span>
                            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Safe, skip admin</span>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 p-2 rounded border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-[#825ee4] transition">
                          <input
                            type="radio"
                            name="modalRestoreTeamScope"
                            value="all"
                            checked={restoreTeamScope === 'all'}
                            onChange={() => setRestoreTeamScope('all')}
                            className="text-[#825ee4] focus:ring-0"
                          />
                          <div>
                            <span className="text-[#32325d] dark:text-white font-semibold block text-[13px]">All Accounts</span>
                            <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Includes admin</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conflict Mode (shown only when restoreUsers is true) */}
              {restoreUsers && parsedData.users.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Username Conflict Resolution
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition">
                      <input
                        type="radio"
                        name="conflictMode"
                        value="skip"
                        checked={conflictMode === 'skip'}
                        onChange={() => setConflictMode('skip')}
                        className="text-[#3970e1] focus:ring-0"
                      />
                      <div>
                        <span className="text-[#32325d] dark:text-white font-semibold block">Skip duplicates</span>
                        <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Keep existing record</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition">
                      <input
                        type="radio"
                        name="conflictMode"
                        value="overwrite"
                        checked={conflictMode === 'overwrite'}
                        onChange={() => setConflictMode('overwrite')}
                        className="text-[#3970e1] focus:ring-0"
                      />
                      <div>
                        <span className="text-[#32325d] dark:text-white font-semibold block">Overwrite</span>
                        <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Update matching record</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
      </Modal.Body>

      <Modal.Footer align="between">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={restoring}
        >
          {restoreResult ? 'Done' : 'Cancel'}
        </Button>

        {!restoreResult && (
          <Button
            variant="warning"
            onClick={handleExecuteRestore}
            loading={restoring}
            disabled={!parsedData || (!restoreUsers && !restoreWelcomeInfo && !restoreTeamMembers)}
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
          >
            Execute Restore
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
