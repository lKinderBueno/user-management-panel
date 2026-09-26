import React from 'react';
import { 
  Users, 
  Save, 
  Trash2, 
  ArrowRightLeft, 
  FileText, 
  Loader2, 
  X, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Server,
  Lock,
  Unlock
} from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import { Drawer } from './ui';

export default function BulkUserEditorPanel({
  selectedUsers = [],
  categories = { channels: [], vods: [], series: [] },
  playlists = [],
  onSaveBulk,
  saving = false,
  onClearSelection,
  onDeselectUser,
  onEditSingleUser,
  onDelete,
  onShowMove,
  onOpenBulkCategories,
  onOpenBulkPatterns,
  onClose,
  isDrawer = false
}) {
  // Field-level activation toggles
  const [enableExpiry, setEnableExpiry] = React.useState(false);
  const [bulkExpiry, setBulkExpiry] = React.useState(null);

  const [enableSyncExpiry, setEnableSyncExpiry] = React.useState(false);
  const [bulkSyncExpiry, setBulkSyncExpiry] = React.useState(false);

  const [enableMaxConnections, setEnableMaxConnections] = React.useState(false);
  const [bulkMaxConnections, setBulkMaxConnections] = React.useState(1);

  const [enableNote, setEnableNote] = React.useState(false);
  const [noteMode, setNoteMode] = React.useState('append'); // 'append' | 'replace'
  const [bulkNote, setBulkNote] = React.useState('');

  const [enableStatus, setEnableStatus] = React.useState(false);
  const [bulkIsSuspended, setBulkIsSuspended] = React.useState(false);
  const [bulkReason, setBulkReason] = React.useState('');

  // Handle escape key to close drawer
  React.useEffect(() => {
    if (!isDrawer || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawer, onClose]);

  const hasAnyChangeEnabled = enableExpiry || enableSyncExpiry || enableMaxConnections || enableNote || enableStatus;

  // Compute active changes summary
  const activeChangesList = React.useMemo(() => {
    const list = [];
    if (enableExpiry) {
      const formatted = bulkExpiry
        ? new Date(bulkExpiry).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Unlimited (No Expiration)';
      list.push(`Expiration Date → ${formatted}`);
    }
    if (enableSyncExpiry) {
      list.push(`Provider Expiry Auto-Sync → ${bulkSyncExpiry ? 'Enabled' : 'Disabled'}`);
    }
    if (enableMaxConnections) {
      list.push(`Max Connections → ${bulkMaxConnections} stream(s)`);
    }
    if (enableNote) {
      list.push(`Internal Notes → ${noteMode === 'append' ? 'Append text' : 'Replace text'}`);
    }
    if (enableStatus) {
      list.push(`Account Status → ${bulkIsSuspended ? 'Suspended' : 'Active'}`);
    }
    return list;
  }, [enableExpiry, bulkExpiry, enableSyncExpiry, bulkSyncExpiry, enableMaxConnections, bulkMaxConnections, enableNote, noteMode, enableStatus, bulkIsSuspended]);

  const handleApply = () => {
    if (!hasAnyChangeEnabled) return;

    onSaveBulk({
      enableExpiry,
      expiry: bulkExpiry,
      enableSyncExpiry,
      sync_expiry_date: bulkSyncExpiry,
      enableMaxConnections,
      max_connections: bulkMaxConnections,
      enableNote,
      noteMode,
      note: bulkNote,
      enableStatus,
      is_suspended: bulkIsSuspended,
      reason: bulkReason
    });
  };

  if (selectedUsers.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#e9ecef] dark:border-slate-800 p-8 shadow-argon text-center text-[#8898aa] dark:text-slate-400 space-y-3">
        <Users className="w-10 h-10 mx-auto text-[#adb5bd] dark:text-slate-500 stroke-[1.5]" />
        <h4 className="text-sm font-bold text-[#32325d] dark:text-white">No Users Selected</h4>
        <p className="text-xs text-[#8898aa] dark:text-slate-400 max-w-sm mx-auto">
          Select two or more users from the table to perform bulk updates.
        </p>
      </div>
    );
  }

  const content = (
    <div className="space-y-4">
      {/* Header with Selection Summary */}
      <div className="pb-3 border-b border-[#e9ecef] dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/30 dark:border-blue-700/40 flex items-center justify-center text-[#3970e1] dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#32325d] dark:text-white text-base">
                  Bulk Edit
                </h3>
                <span className="text-[12px] font-extrabold px-2 py-0.5 rounded bg-[#3970e1] text-white shadow-xs">
                  {selectedUsers.length} users selected
                </span>
              </div>
              <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-0.5">
                Apply synchronized updates to all selected accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearSelection}
              className="px-2.5 py-1 text-xs font-semibold text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-slate-800 rounded border border-[#dee2e6] dark:border-slate-700 transition shadow-xs"
              title="Deselect all selected users"
            >
              Clear Selection
            </button>

            {isDrawer && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-[#f6f9fc] dark:hover:bg-slate-800 rounded transition"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selected Users Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto py-1 pr-1">
          {selectedUsers.slice(0, 30).map((u) => {
            const displayName = u.name?.trim() || u.username || `User #${u.id}`;
            return (
              <div
                key={u.id}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#f8f9fe] dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 rounded text-[12px] font-medium text-[#32325d] dark:text-slate-200 transition group shadow-2xs"
                title={`User #${u.id}: ${displayName}${u.username && u.username !== displayName ? ` (@${u.username})` : ''} - Click to edit individually`}
              >
                <button
                  type="button"
                  onClick={() => onEditSingleUser?.(u)}
                  className="hover:underline flex items-center gap-1 text-left"
                >
                  <span className="font-mono text-[#3970e1] dark:text-blue-400 font-bold">#{u.id}</span>
                  <span className="font-semibold text-[#32325d] dark:text-slate-200 max-w-[130px] truncate">{displayName}</span>
                </button>
                {onDeselectUser && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeselectUser(u.id);
                    }}
                    className="text-[#adb5bd] dark:text-slate-500 hover:text-[#f5365c] dark:hover:text-red-400 transition p-0.5 rounded hover:bg-white dark:hover:bg-slate-600"
                    title={`Remove #${u.id} from selection`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {selectedUsers.length > 30 && (
            <span className="text-[12px] font-semibold text-[#8898aa] dark:text-slate-400 px-2 py-0.5 bg-[#f6f9fc] dark:bg-slate-800 rounded border border-[#dee2e6] dark:border-slate-700">
              +{selectedUsers.length - 30} more
            </span>
          )}
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3 bg-[#eef2ff] dark:bg-blue-950/40 border border-[#3970e1]/20 dark:border-blue-800/40 rounded-lg flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-[#3970e1] dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#525f7f] dark:text-slate-300 leading-relaxed">
          <strong className="text-[#32325d] dark:text-white font-semibold">Field-level opt-in:</strong>{' '}
          Only the fields you explicitly check below will be modified. All unchecked fields (names, unique passwords, notes, categories, and credentials) will remain completely untouched.
        </div>
      </div>

      {/* Section 1: Expiration Date */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        enableExpiry ? 'bg-white dark:bg-slate-900 border-[#3970e1] shadow-xs' : 'bg-[#fcfdfe] dark:bg-slate-800/50 border-[#e9ecef] dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableExpiry}
              onChange={(e) => setEnableExpiry(e.target.checked)}
              className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-[#32325d] dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              Update Expiration Date
            </span>
          </label>
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
            enableExpiry ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400' : 'bg-[#f6f9fc] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
          }`}>
            {enableExpiry ? 'Active' : 'Unchanged'}
          </span>
        </div>

        {enableExpiry ? (
          <div className="mt-3 pl-6 space-y-3 animate-in fade-in duration-150">
            <CalendarPicker
              label="New Expiration Date for all selected users"
              value={bulkExpiry}
              onChange={setBulkExpiry}
            />

            {/* Quick Helper Presets */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[13px]">
              <span className="text-[#8898aa] dark:text-slate-400 font-medium text-[12px] uppercase tracking-wider">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 1);
                  d.setHours(23, 59, 59, 999);
                  setBulkExpiry(d.toISOString());
                }}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition shadow-2xs"
              >
                +1 Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 3);
                  d.setHours(23, 59, 59, 999);
                  setBulkExpiry(d.toISOString());
                }}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition shadow-2xs"
              >
                +3 Months
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + 6);
                  d.setHours(23, 59, 59, 999);
                  setBulkExpiry(d.toISOString());
                }}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition shadow-2xs"
              >
                +6 Months
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() + 1);
                  d.setHours(23, 59, 59, 999);
                  setBulkExpiry(d.toISOString());
                }}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition shadow-2xs"
              >
                +1 Year
              </button>
              <button
                type="button"
                onClick={() => setBulkExpiry(null)}
                className="px-2 py-0.5 bg-white dark:bg-slate-800 hover:bg-[#feecee] dark:hover:bg-red-950/40 text-[#f5365c] border border-[#dee2e6] dark:border-slate-700 rounded font-semibold transition shadow-2xs"
              >
                Unlimited
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-6">
            Existing expiration dates will stay unchanged for all selected users.
          </p>
        )}
      </div>

      {/* Section 2: Provider Auto-Sync Expiration */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        enableSyncExpiry ? 'bg-white dark:bg-slate-900 border-[#3970e1] shadow-xs' : 'bg-[#fcfdfe] dark:bg-slate-800/50 border-[#e9ecef] dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableSyncExpiry}
              onChange={(e) => setEnableSyncExpiry(e.target.checked)}
              className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-[#32325d] dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              Update Provider Auto-Sync Setting
            </span>
          </label>
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
            enableSyncExpiry ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400' : 'bg-[#f6f9fc] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
          }`}>
            {enableSyncExpiry ? 'Active' : 'Unchanged'}
          </span>
        </div>

        {enableSyncExpiry ? (
          <div className="mt-2.5 pl-6 animate-in fade-in duration-150">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#525f7f] dark:text-slate-300">
              <input
                type="checkbox"
                checked={bulkSyncExpiry}
                onChange={(e) => setBulkSyncExpiry(e.target.checked)}
                className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
              />
              <span>Enable auto sync expiration date with source provider</span>
            </label>
          </div>
        ) : (
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-6">
            Auto-sync settings will remain untouched.
          </p>
        )}
      </div>

      {/* Section 3: Max Connections */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        enableMaxConnections ? 'bg-white dark:bg-slate-900 border-[#3970e1] shadow-xs' : 'bg-[#fcfdfe] dark:bg-slate-800/50 border-[#e9ecef] dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableMaxConnections}
              onChange={(e) => setEnableMaxConnections(e.target.checked)}
              className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-[#32325d] dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              Update Max Connections
            </span>
          </label>
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
            enableMaxConnections ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400' : 'bg-[#f6f9fc] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
          }`}>
            {enableMaxConnections ? 'Active' : 'Unchanged'}
          </span>
        </div>

        {enableMaxConnections ? (
          <div className="mt-2.5 pl-6 flex items-center gap-3 animate-in fade-in duration-150">
            <div className="w-36">
              <input
                type="number"
                min="1"
                max="10"
                value={bulkMaxConnections}
                onChange={(e) => setBulkMaxConnections(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 font-bold focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-xs"
              />
            </div>
            <span className="text-xs text-[#8898aa] dark:text-slate-400">
              concurrent streaming connection(s) allowed
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-6">
            Max connections values will remain untouched.
          </p>
        )}
      </div>

      {/* Section 4: Internal Notes */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        enableNote ? 'bg-white dark:bg-slate-900 border-[#3970e1] shadow-xs' : 'bg-[#fcfdfe] dark:bg-slate-800/50 border-[#e9ecef] dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableNote}
              onChange={(e) => setEnableNote(e.target.checked)}
              className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-[#32325d] dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#3970e1]" />
              Update Internal Notes
            </span>
          </label>
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
            enableNote ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400' : 'bg-[#f6f9fc] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
          }`}>
            {enableNote ? 'Active' : 'Unchanged'}
          </span>
        </div>

        {enableNote ? (
          <div className="mt-2.5 pl-6 space-y-2.5 animate-in fade-in duration-150">
            {/* Mode: Append vs Replace */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#525f7f] dark:text-slate-300">
                <input
                  type="radio"
                  name="bulkNoteMode"
                  value="append"
                  checked={noteMode === 'append'}
                  onChange={() => setNoteMode('append')}
                  className="text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Append to existing note</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#525f7f] dark:text-slate-300">
                <input
                  type="radio"
                  name="bulkNoteMode"
                  value="replace"
                  checked={noteMode === 'replace'}
                  onChange={() => setNoteMode('replace')}
                  className="text-[#3970e1] focus:ring-0 cursor-pointer"
                />
                <span>Overwrite existing note</span>
              </label>
            </div>

            <textarea
              rows={2}
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder={noteMode === 'append' ? 'Note text to append on a new line...' : 'New note replacing current notes...'}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-xs resize-none"
            />
          </div>
        ) : (
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-6">
            Existing internal notes will remain untouched.
          </p>
        )}
      </div>

      {/* Section 5: Account Status (Active / Suspended) */}
      <div className={`p-3.5 rounded-lg border transition-all ${
        enableStatus ? 'bg-white dark:bg-slate-900 border-[#3970e1] shadow-xs' : 'bg-[#fcfdfe] dark:bg-slate-800/50 border-[#e9ecef] dark:border-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableStatus}
              onChange={(e) => setEnableStatus(e.target.checked)}
              className="w-4 h-4 rounded border-[#dee2e6] dark:border-slate-700 dark:bg-slate-800 text-[#3970e1] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-bold text-[#32325d] dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#3970e1]" />
              Update Account Status
            </span>
          </label>
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${
            enableStatus ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400' : 'bg-[#f6f9fc] dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
          }`}>
            {enableStatus ? 'Active' : 'Unchanged'}
          </span>
        </div>

        {enableStatus ? (
          <div className="mt-2.5 pl-6 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#525f7f] dark:text-slate-300">
                <input
                  type="radio"
                  name="bulkStatusRadio"
                  checked={!bulkIsSuspended}
                  onChange={() => setBulkIsSuspended(false)}
                  className="text-[#2dce89] focus:ring-0 cursor-pointer"
                />
                <span className="inline-flex items-center gap-1 font-semibold text-[#2dce89]">
                  <Unlock className="w-3.5 h-3.5" />
                  Set Active (Reactivate)
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[#525f7f] dark:text-slate-300">
                <input
                  type="radio"
                  name="bulkStatusRadio"
                  checked={bulkIsSuspended}
                  onChange={() => setBulkIsSuspended(true)}
                  className="text-[#f5365c] focus:ring-0 cursor-pointer"
                />
                <span className="inline-flex items-center gap-1 font-semibold text-[#f5365c]">
                  <Lock className="w-3.5 h-3.5" />
                  Set Suspended
                </span>
              </label>
            </div>

            {bulkIsSuspended && (
              <div>
                <input
                  type="text"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Optional suspension reason (e.g. Bulk suspension)..."
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1]"
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-[#8898aa] dark:text-slate-400 pl-6">
            Account status and suspension flags will remain untouched.
          </p>
        )}
      </div>

      {/* Section 6: Other Bulk Operations (Categories & Patterns) */}
      <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-800 space-y-2">
        <span className="text-xs font-bold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider block">
          Advanced Bulk Tools for Selected Users
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenBulkCategories}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-750 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-left transition group shadow-2xs"
          >
            <div className="p-1.5 bg-[#eef2ff] dark:bg-blue-950/60 rounded text-[#3970e1] dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#32325d] dark:text-white">Bulk Categories</div>
              <div className="text-[13px] text-[#8898aa] dark:text-slate-400">Add, remove or replace channels & VOD</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenBulkPatterns}
            className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-750 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-left transition group shadow-2xs"
          >
            <div className="p-1.5 bg-[#fbf1ee] dark:bg-orange-950/60 rounded text-[#fb6340] dark:text-orange-400 group-hover:scale-110 transition-transform">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#32325d] dark:text-white">Edit Providers</div>
              <div className="text-[13px] text-[#8898aa] dark:text-slate-400">Replace DNS / provider streams</div>
            </div>
          </button>
        </div>
      </div>

      {/* Review & Impact Summary Box */}
      <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-800 rounded-lg space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#32325d] dark:text-white">
          <CheckCircle2 className="w-4 h-4 text-[#2dce89] dark:text-emerald-400" />
          <span>Execution Summary:</span>
        </div>
        {hasAnyChangeEnabled ? (
          <ul className="text-xs text-[#525f7f] dark:text-slate-300 space-y-1 pl-5 list-disc">
            {activeChangesList.map((item, idx) => (
              <li key={idx} className="font-medium">
                {item}
              </li>
            ))}
            <li className="text-[#8898aa] dark:text-slate-400 text-[13px] italic list-none -ml-5 pt-0.5">
              Target: {selectedUsers.length} user record(s). All non-listed fields will remain untouched.
            </li>
          </ul>
        ) : (
          <p className="text-xs text-[#8898aa] dark:text-slate-400">
            No fields selected for modification yet. Check at least one option above to apply changes.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-3 border-t border-[#e9ecef] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleApply}
            disabled={saving || !hasAnyChangeEnabled}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2dce89] hover:bg-[#26af74] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Apply to {selectedUsers.length} Users</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {playlists.length > 1 && onShowMove && (
            <button
              type="button"
              onClick={onShowMove}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#3970e1] hover:bg-[#2c5ec2] text-white font-semibold rounded text-xs shadow-argon-btn transition active:scale-[0.98]"
              title="Move selected users to another playlist"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Move ({selectedUsers.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#feecee] dark:bg-red-950/40 hover:bg-[#fdd8db] dark:hover:bg-red-900/50 text-[#f5365c] dark:text-red-400 border border-[#f5365c]/30 dark:border-red-800/40 rounded text-xs font-semibold transition active:scale-[0.98]"
            title="Delete all selected users"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete ({selectedUsers.length})</span>
          </button>
        </div>
      </div>
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
