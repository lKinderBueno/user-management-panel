import React from 'react';
import {
  X,
  CloudDownload,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Sparkles,
  Info,
  ShieldAlert
} from 'lucide-react';
import { playlistApi, settingsApi } from '../api/client';
import { Modal, Button, Alert } from './ui';

export default function ImportFromEditorModal({
  currentPlaylist = null,
  playlists = [],
  isGlobal = false,
  onClose,
  onSuccess
}) {
  const [selectedListId, setSelectedListId] = React.useState(
    currentPlaylist?.id ? String(currentPlaylist.id) : (isGlobal ? 'all' : (playlists[0]?.id ? String(playlists[0].id) : 'all'))
  );
  const [mode, setMode] = React.useState('skip');
  const [importWelcomeInfo, setImportWelcomeInfo] = React.useState(true);
  const [confirmOverwrite, setConfirmOverwrite] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState(null);

  const handleImport = async () => {
    setError('');
    setLoading(true);
    try {
      let res;
      if (isGlobal || !currentPlaylist) {
        const payload = {
          playlist_id: selectedListId === 'all' ? 0 : parseInt(selectedListId, 10),
          mode,
          import_welcome_info: importWelcomeInfo,
        };
        res = await settingsApi.importFromEditor(payload);
      } else {
        const listId = currentPlaylist.id;
        const payload = {
          mode,
          import_welcome_info: importWelcomeInfo,
        };
        res = await playlistApi.importFromEditor(listId, payload);
      }

      setResult(res);
      if (onSuccess) {
        onSuccess(res);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to import data from PlaylistLabs');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = mode !== 'overwrite' || confirmOverwrite;

  return (
    <Modal
      isOpen={true}
      onClose={() => { if (!loading) onClose?.(); }}
      size="lg"
    >
      <Modal.Header
        title="Import from PlaylistLabs"
        subtitle="Re-import managed users and welcome info via API token"
        icon={<CloudDownload className="w-5 h-5" />}
        onClose={() => { if (!loading) onClose?.(); }}
        showClose={!loading}
      />

      <Modal.Body className="space-y-5">
        {/* Error Notification */}
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

            {/* Results Display */}
            {result ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Import Completed Successfully
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    The requested data has been imported into your playlist database.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                    <span className="text-[#8898aa] dark:text-slate-400 block text-[13px]">New Users Added</span>
                    <span className="text-base font-bold text-[#2dce89] font-mono">
                      +{result.imported ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                    <span className="text-[#8898aa] dark:text-slate-400 block text-[13px]">Existing Users Updated</span>
                    <span className="text-base font-bold text-[#3970e1] font-mono">
                      {result.updated ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                    <span className="text-[#8898aa] dark:text-slate-400 block text-[13px]">Skipped (Unchanged)</span>
                    <span className="text-base font-bold text-[#8898aa] font-mono">
                      {result.skipped ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg">
                    <span className="text-[#8898aa] dark:text-slate-400 block text-[13px]">Welcome Info Updated</span>
                    <span className="text-base font-bold text-[#8965e0] font-mono">
                      {result.welcome_info_updated ?? 0}
                    </span>
                  </div>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg space-y-1">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Warnings & Notices:
                    </span>
                    <ul className="text-[13px] text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5">
                      {result.errors.map((errItem, idx) => (
                        <li key={idx}>{errItem}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Playlist Selection (if applicable) */}
                {(isGlobal || !currentPlaylist) ? (
                  <div>
                    <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Playlist
                    </label>
                    <select
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                      disabled={loading}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1] shadow-sm"
                    >
                      <option value="all">All Playlists (Fetch and import for each playlist)</option>
                      {playlists.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (ID: {p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-[#8898aa] dark:text-slate-400 font-medium">Target Playlist:</span>
                    <span className="font-bold text-[#32325d] dark:text-white">
                      {currentPlaylist.name} <span className="font-mono text-[13px] text-[#8898aa]">({currentPlaylist.id})</span>
                    </span>
                  </div>
                )}

                {/* Conflict Resolution Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-2">
                    User Import Strategy
                  </label>
                  <div className="space-y-2 text-xs">
                    {/* Mode: Skip (Default) */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      mode === 'skip'
                        ? 'border-[#3970e1] bg-[#ebf2ff] dark:bg-blue-950/30'
                        : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#f8f9fe] dark:hover:bg-slate-700/50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        value="skip"
                        checked={mode === 'skip'}
                        onChange={() => setMode('skip')}
                        disabled={loading}
                        className="mt-0.5 text-[#3970e1] focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-[#32325d] dark:text-white block">
                          Only add new users (Recommended)
                        </span>
                        <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                          Safely skips existing accounts matching by ID or Username. Protects current local credentials, passwords, and custom categories.
                        </p>
                      </div>
                    </label>

                    {/* Mode: Overwrite */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      mode === 'overwrite'
                        ? 'border-[#fb6340] bg-orange-50 dark:bg-orange-950/20'
                        : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#f8f9fe] dark:hover:bg-slate-700/50'
                    }`}>
                      <input
                        type="radio"
                        name="importMode"
                        value="overwrite"
                        checked={mode === 'overwrite'}
                        onChange={() => setMode('overwrite')}
                        disabled={loading}
                        className="mt-0.5 text-[#fb6340] focus:ring-0"
                      />
                      <div>
                        <span className="font-bold text-[#32325d] dark:text-white block">
                          Overwrite existing users
                        </span>
                        <p className="text-[13px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                          Updates existing users with data from PlaylistLabs. Credentials and M3U/EPG links are preserved, but user categories, notes, and settings will be overwritten.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Overwrite Confirmation Alert */}
                {mode === 'overwrite' && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-lg space-y-2.5">
                    <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Caution: Data Overwrite Requested</span>
                        <p className="text-[13px] text-amber-800 dark:text-amber-300 mt-0.5">
                          Existing user customizations and category assignments in the target playlist will be replaced with the values currently configured in PlaylistLabs.
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={confirmOverwrite}
                        onChange={(e) => setConfirmOverwrite(e.target.checked)}
                        disabled={loading}
                        className="rounded border-amber-400 text-[#fb6340] focus:ring-0"
                      />
                      <span>I understand that existing user data will be overwritten.</span>
                    </label>
                  </div>
                )}

                {/* Welcome Info Toggle */}
                <div className="p-3.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#32325d] dark:text-white block">
                      Import Welcome Information
                    </span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400">
                      Update announcements, welcome streams, and category headers from PlaylistLabs
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={importWelcomeInfo}
                      onChange={(e) => setImportWelcomeInfo(e.target.checked)}
                      disabled={loading}
                    />
                    <div className="w-9 h-5 bg-[#dee2e6] dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3970e1]"></div>
                  </label>
                </div>
              </>
            )}
      </Modal.Body>

      <Modal.Footer>
        {result ? (
          <Button
            type="button"
            variant="primary"
            onClick={onClose}
          >
            Done
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={mode === 'overwrite' ? 'warning' : 'primary'}
              onClick={handleImport}
              loading={loading}
              disabled={!isFormValid}
              icon={<CloudDownload className="w-3.5 h-3.5" />}
            >
              {mode === 'overwrite' ? 'Confirm & Overwrite' : 'Import New Users'}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}
