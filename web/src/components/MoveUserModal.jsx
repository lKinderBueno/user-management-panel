import React from 'react';
import { 
  ArrowRightLeft, 
  ArrowRight, 
  Server, 
  Check, 
  AlertTriangle, 
  Users, 
  CheckCircle2 
} from 'lucide-react';
import { userApi } from '../api/client';
import { Modal, Button, Alert } from './ui';

const safeParsePatterns = (patterns) => {
  if (!patterns) return [];
  if (Array.isArray(patterns)) return patterns;
  if (typeof patterns === 'string') {
    try {
      const parsed = JSON.parse(patterns);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const formatExpiryInBrowserTz = (expiry) => {
  if (!expiry) return null;
  let dateStr = String(expiry).trim();
  if (!dateStr || dateStr.toLowerCase() === 'unlimited' || dateStr.toLowerCase() === 'null') {
    return 'Unlimited';
  }
  // Convert standard SQL datetime 'YYYY-MM-DD HH:mm:ss' to ISO UTC if no timezone is attached
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    dateStr = dateStr.replace(' ', 'T') + 'Z';
  } else if (/^\d+$/.test(dateStr)) {
    const num = Number(dateStr);
    dateStr = num < 1e11 ? num * 1000 : num;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(expiry);

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function MoveUserModal({ 
  currentPlaylist, 
  currentPlaylistId, 
  playlists = [], 
  selectedUsers = [], 
  userCount, 
  onClose, 
  onConfirm, 
  onMoved 
}) {
  const currentId = currentPlaylist?.id ?? currentPlaylistId;
  const availablePlaylists = playlists.filter(
    (p) => p && currentId != null && String(p.id) !== String(currentId)
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState(
    availablePlaylists[0]?.id != null ? String(availablePlaylists[0].id) : ''
  );
  const [moving, setMoving] = React.useState(false);
  const [error, setError] = React.useState('');

  const count = userCount ?? (Array.isArray(selectedUsers) ? selectedUsers.length : 0);
  const isSingleUser = count === 1 && Array.isArray(selectedUsers) && selectedUsers.length === 1;
  const singleUser = isSingleUser ? selectedUsers[0] : null;

  // Selected target playlist object
  const selectedTargetPlaylist = React.useMemo(() => {
    return availablePlaylists.find((p) => String(p.id) === String(selectedPlaylistId));
  }, [availablePlaylists, selectedPlaylistId]);

  // Extract source patterns from selected users or fallback to current playlist patterns
  const sourcePatterns = React.useMemo(() => {
    const list = [];
    const seenUrls = new Set();

    if (Array.isArray(selectedUsers) && selectedUsers.length > 0) {
      for (const u of selectedUsers) {
        const uPatterns = safeParsePatterns(u.patterns);
        for (const p of uPatterns) {
          if (p && p.url && !seenUrls.has(p.url)) {
            seenUrls.add(p.url);
            list.push(p);
          }
        }
      }
    }

    if (list.length === 0 && currentPlaylist?.patterns) {
      const cpPatterns = safeParsePatterns(currentPlaylist.patterns);
      for (const p of cpPatterns) {
        if (p && p.url && !seenUrls.has(p.url)) {
          seenUrls.add(p.url);
          list.push(p);
        }
      }
    }

    return list;
  }, [selectedUsers, currentPlaylist]);

  // Target playlist patterns
  const targetPatterns = React.useMemo(() => {
    return safeParsePatterns(selectedTargetPlaylist?.patterns);
  }, [selectedTargetPlaylist]);

  // Mappings state: { [sourceUrl]: { action: 'map' | 'discard', targetUrl: string } }
  const [mappings, setMappings] = React.useState({});

  // Auto-initialize mappings with strict 1:1 relationship
  React.useEffect(() => {
    const initial = {};
    const usedTargetUrls = new Set();

    // Pass 1: exact URL matches first (1:1)
    for (const sp of sourcePatterns) {
      const exactMatch = targetPatterns.find((tp) => tp.url === sp.url && !usedTargetUrls.has(tp.url));
      if (exactMatch) {
        initial[sp.url] = { action: 'map', targetUrl: exactMatch.url };
        usedTargetUrls.add(exactMatch.url);
      }
    }

    // Pass 2: matching type (e.g. both xtream) for remaining unmapped source patterns (1:1)
    for (const sp of sourcePatterns) {
      if (initial[sp.url]) continue;
      const spType = (sp.type || 'xtream').toLowerCase();
      const typeMatch = targetPatterns.find(
        (tp) => (tp.type || 'xtream').toLowerCase() === spType && !usedTargetUrls.has(tp.url)
      );
      if (typeMatch) {
        initial[sp.url] = { action: 'map', targetUrl: typeMatch.url };
        usedTargetUrls.add(typeMatch.url);
      } else {
        initial[sp.url] = { action: 'discard', targetUrl: '' };
      }
    }

    setMappings(initial);
  }, [sourcePatterns, targetPatterns]);

  // Check if patterns are identical between source and destination
  const isIdentical = React.useMemo(() => {
    if (sourcePatterns.length === 0 && targetPatterns.length === 0) return true;
    if (sourcePatterns.length !== targetPatterns.length) return false;
    return sourcePatterns.every((sp) =>
      targetPatterns.some(
        (tp) => tp.url === sp.url && (tp.type || 'xtream').toLowerCase() === (sp.type || 'xtream').toLowerCase()
      )
    );
  }, [sourcePatterns, targetPatterns]);

  // Find target patterns that are not mapped from any source pattern
  const unmappedTargetPatterns = React.useMemo(() => {
    return targetPatterns.filter((tp) => {
      return !Object.values(mappings).some((m) => m.action === 'map' && m.targetUrl === tp.url);
    });
  }, [targetPatterns, mappings]);

  React.useEffect(() => {
    if (!selectedPlaylistId && availablePlaylists.length > 0) {
      setSelectedPlaylistId(String(availablePlaylists[0].id));
    }
  }, [availablePlaylists, selectedPlaylistId]);

  const handleMappingChange = (sourceUrl, targetUrl) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (targetUrl === '__discard__') {
        next[sourceUrl] = { action: 'discard', targetUrl: '' };
      } else {
        // Enforce strict 1:1 relationship:
        for (const [sUrl, m] of Object.entries(next)) {
          if (sUrl !== sourceUrl && m.action === 'map' && m.targetUrl === targetUrl) {
            next[sUrl] = { action: 'discard', targetUrl: '' };
          }
        }
        next[sourceUrl] = { action: 'map', targetUrl };
      }
      return next;
    });
  };

  const handleMove = async () => {
    if (!selectedPlaylistId) return;
    setMoving(true);
    setError('');

    // Validate 1:1 mapping uniqueness before submitting
    const seenTargets = new Set();
    for (const [sUrl, m] of Object.entries(mappings)) {
      if (m.action === 'map' && m.targetUrl) {
        if (seenTargets.has(m.targetUrl)) {
          setError('A destination provider URL can only be mapped to one source provider (1:1 relationship).');
          setMoving(false);
          return;
        }
        seenTargets.add(m.targetUrl);
      }
    }

    // Format pattern mappings
    const patternMappings = sourcePatterns.map((sp) => {
      const m = mappings[sp.url];
      if (!m || m.action === 'discard') {
        return {
          source_url: sp.url,
          target_url: '',
          action: 'discard',
        };
      }
      return {
        source_url: sp.url,
        target_url: m.targetUrl,
        action: 'map',
      };
    });

    try {
      if (onConfirm) {
        await onConfirm(selectedPlaylistId, patternMappings);
      } else {
        const userIds = (selectedUsers || []).map((u) => 
          typeof u === 'object' && u !== null ? u.id : u
        );
        await userApi.moveUsers(currentId, selectedPlaylistId, userIds, patternMappings);
        onMoved?.(userIds);
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'Error transferring users');
    } finally {
      setMoving(false);
    }
  };

  const displayName = singleUser 
    ? (singleUser.name?.trim() || singleUser.username || `User #${singleUser.id}`)
    : '';

  const expiryFormatted = singleUser 
    ? formatExpiryInBrowserTz(singleUser.expiry || singleUser.exp_date) 
    : null;

  return (
    <Modal
      isOpen={true}
      onClose={() => {
        if (!moving) onClose?.();
      }}
      size="2xl"
      closeOnBackdropClick={!moving}
      closeOnEsc={!moving}
    >
      <Modal.Header
        icon={<ArrowRightLeft className="w-5 h-5 text-[#3970e1]" />}
        title={count === 1 ? 'Move User' : `Move ${count} Users`}
        subtitle={count === 1 ? 'Transfer user to another playlist' : `Transfer ${count} selected users to another playlist`}
        onClose={onClose}
      />

      <Modal.Body className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        {/* User Context Preview */}
        {isSingleUser && singleUser ? (
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-[#dee2e6] dark:border-slate-700">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-[#3970e1]/10 text-[#3970e1] dark:bg-[#3970e1]/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {(displayName || 'U')[0].toUpperCase()}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="font-semibold text-sm text-[#32325d] dark:text-white truncate">
                  {displayName}
                </div>
                <div className="text-xs text-[#525f7f] dark:text-slate-300 font-mono truncate">
                  <span>ID: #{singleUser.id}</span>
                  {singleUser.username && singleUser.username !== displayName && (
                    <span> • {singleUser.username}</span>
                  )}
                  {expiryFormatted && (
                    <span> • Expires: {expiryFormatted}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-3">
              <span className="text-xs uppercase font-bold text-[#8898aa] dark:text-slate-400 block mb-0.5">
                From Playlist
              </span>
              <span className="font-semibold text-sm text-[#32325d] dark:text-slate-200">
                {currentPlaylist?.name || 'Current'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-[#dee2e6] dark:border-slate-700">
            <div className="flex items-center gap-2 text-[#32325d] dark:text-white font-semibold text-sm">
              <Users className="w-4 h-4 text-[#3970e1]" />
              <span>{count} user{count === 1 ? '' : 's'} selected</span>
            </div>
            <div className="text-right text-xs">
              <span className="text-[#8898aa] dark:text-slate-400">From playlist: </span>
              <span className="font-semibold text-sm text-[#32325d] dark:text-slate-200">
                {currentPlaylist?.name || 'Current'}
              </span>
            </div>
          </div>
        )}

        {/* Destination Playlist Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider">
            Destination Playlist
          </label>
          {availablePlaylists.length === 0 ? (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              No other playlists available to transfer users to.
            </div>
          ) : (
            <select
              value={selectedPlaylistId}
              onChange={(e) => setSelectedPlaylistId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-sm text-[#32325d] dark:text-white focus:outline-none focus:border-[#3970e1] shadow-sm font-medium"
            >
              {availablePlaylists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.managed_users_count || 0} active users)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Provider Mapping Section */}
        {availablePlaylists.length > 0 && selectedTargetPlaylist && (
          isIdentical ? (
            <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-sm text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="leading-snug">
                <span className="font-semibold">Identical server configuration: </span>
                <span>Provider URLs and user credentials will be transferred unchanged.</span>
              </div>
            </div>
          ) : (
            <div className="border border-[#dee2e6] dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              <div className="bg-[#f8f9fe] dark:bg-slate-800/80 px-3.5 py-2.5 border-b border-[#dee2e6] dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#3970e1]" />
                  <span className="text-sm font-semibold text-[#32325d] dark:text-white">Provider Mapping</span>
                </div>
                <span className="text-xs text-[#525f7f] dark:text-slate-300">
                  Reassign servers for the destination playlist
                </span>
              </div>

              {sourcePatterns.length > 0 ? (
                <div className="divide-y divide-[#dee2e6] dark:divide-slate-700">
                  {sourcePatterns.map((sp, idx) => {
                    const m = mappings[sp.url] || { action: 'discard', targetUrl: '' };
                    const isMapped = m.action === 'map';
                    const isUrlChanged = isMapped && m.targetUrl !== sp.url;

                    return (
                      <div key={idx} className="p-4 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Source */}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525f7f] dark:text-slate-300 block mb-1.5">
                              Current Server
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/50 text-[#3970e1] border border-[#3970e1]/20 uppercase flex-shrink-0">
                                {sp.type || 'xtream'}
                              </span>
                              <span className="font-mono text-xs text-[#32325d] dark:text-slate-200 truncate" title={sp.url}>
                                {sp.url}
                              </span>
                            </div>
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="hidden sm:block w-5 h-5 text-[#8898aa] dark:text-slate-500 flex-shrink-0 self-center mt-5" />

                          {/* Destination select */}
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525f7f] dark:text-slate-300 block mb-1.5">
                              Destination Server
                            </span>
                            <select
                              value={isMapped ? m.targetUrl : '__discard__'}
                              onChange={(e) => handleMappingChange(sp.url, e.target.value)}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-sm text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                            >
                              {targetPatterns.map((tp, tIdx) => {
                                const isMappedToOther = Object.entries(mappings).some(
                                  ([sUrl, mapped]) => sUrl !== sp.url && mapped.action === 'map' && mapped.targetUrl === tp.url
                                );
                                return (
                                  <option key={tIdx} value={tp.url}>
                                    {tp.url} ({(tp.type || 'xtream').toUpperCase()}){isMappedToOther ? ' (reassigns)' : ''}
                                  </option>
                                );
                              })}
                              <option value="__discard__">Do not migrate (Discard)</option>
                            </select>
                          </div>
                        </div>

                        {/* Status feedback */}
                        <div className="text-xs pt-0.5">
                          {isMapped && isUrlChanged && (
                            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                              Updates server URL while preserving account credentials
                            </span>
                          )}
                          {isMapped && !isUrlChanged && (
                            <span className="text-[#3970e1] dark:text-blue-400 flex items-center gap-1 font-medium">
                              <Check className="w-3.5 h-3.5 flex-shrink-0" />
                              Same URL: configuration kept unchanged
                            </span>
                          )}
                          {!isMapped && (
                            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              Will be removed from user account
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3.5 text-xs text-[#8898aa] dark:text-slate-400">
                  No custom providers configured on selected user(s).
                </div>
              )}

              {unmappedTargetPatterns.length > 0 && (
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-[#dee2e6] dark:border-slate-700 text-xs text-[#525f7f] dark:text-slate-300">
                  <span className="font-semibold text-[#32325d] dark:text-white">
                    + Additional destination server{unmappedTargetPatterns.length > 1 ? 's' : ''}:{' '}
                  </span>
                  {unmappedTargetPatterns.map((tp) => tp.url).join(', ')} (will be initialized with account credentials)
                </div>
              )}
            </div>
          )
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={moving}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleMove}
          loading={moving}
          disabled={!selectedPlaylistId || availablePlaylists.length === 0}
        >
          {moving ? 'Transferring...' : (count === 1 ? 'Transfer User' : `Transfer ${count} Users`)}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
