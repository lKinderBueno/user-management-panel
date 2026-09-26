import React from 'react';
import {
  X,
  Server,
  Globe,
  Trash2,
  Plus,
  Sliders,
  AlertCircle,
  Check,
  Loader2,
  Users,
  ShieldAlert,
  Info,
  User,
  ArrowRight
} from 'lucide-react';
import { userApi } from '../api/client';
import { getPanelType } from './PatternForm';
import { Modal, Button, Alert } from './ui';
import { getEffectiveUserPatterns, safeParsePatterns } from '../utils/patterns';

export default function BulkPatternModal({
  isOpen,
  onClose,
  currentPlaylist,
  playlists = [],
  users = [],
  selectedUserIds = [],
  admin,
  initialTab = 'rename',
  onSuccess
}) {
  const [activeTab, setActiveTab] = React.useState(initialTab || 'rename');
  const [scope, setScope] = React.useState(() => {
    return selectedUserIds.length > 0 ? 'selected' : 'playlist';
  });

  // State for Rename URL
  const [oldUrl, setOldUrl] = React.useState('');
  const [newUrl, setNewUrl] = React.useState('');
  const [replaceMode, setReplaceMode] = React.useState('exact'); // 'exact' | 'substring'
  const [updateCUrl, setUpdateCUrl] = React.useState(true);

  // State for Remove Pattern
  const [removeUrl, setRemoveUrl] = React.useState('');
  const [removeType, setRemoveType] = React.useState('all');
  const [removeReplaceMode, setRemoveReplaceMode] = React.useState('exact');

  // State for Add Pattern
  const [newPatternType, setNewPatternType] = React.useState('xtream');
  const [newPatternUrl, setNewPatternUrl] = React.useState('');
  const [newPatternParam1, setNewPatternParam1] = React.useState('');
  const [newPatternParam2, setNewPatternParam2] = React.useState('');
  const [newPatternUseCUrl, setNewPatternUseCUrl] = React.useState(false);
  const [newPatternCUrl, setNewPatternCUrl] = React.useState('');

  // State for Custom DNS
  const [dnsTargetUrl, setDnsTargetUrl] = React.useState('');
  const [dnsCUrl, setDnsCUrl] = React.useState('');
  const [dnsUseCUrl, setDnsUseCUrl] = React.useState(true);

  // Common option
  const [updatePlaylist, setUpdatePlaylist] = React.useState(true);

  // Execution state
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Extract detected pattern URLs from current scope users
  const targetUsers = React.useMemo(() => {
    if (scope === 'selected' && selectedUserIds.length > 0) {
      return users.filter((u) => selectedUserIds.includes(u.id));
    }
    return users;
  }, [users, selectedUserIds, scope]);

  const detectedPatterns = React.useMemo(() => {
    const map = new Map();
    targetUsers.forEach((u) => {
      const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
      const { patterns: pList } = getEffectiveUserPatterns(u, pl);
      pList.forEach((p) => {
        if (p && p.url) {
          const key = p.url.trim();
          if (!map.has(key)) {
            map.set(key, { url: key, type: p.type || 'xtream', count: 0 });
          }
          map.get(key).count++;
        }
      });
    });
    const cpPatterns = safeParsePatterns(currentPlaylist?.patterns);
    cpPatterns.forEach((p) => {
      if (p && p.url) {
        const key = p.url.trim();
        if (!map.has(key)) {
          map.set(key, { url: key, type: p.type || 'xtream', count: 0 });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [targetUsers, playlists, currentPlaylist]);

  // Set initial default URL if available
  React.useEffect(() => {
    if (detectedPatterns.length > 0) {
      if (!oldUrl) setOldUrl(detectedPatterns[0].url);
      if (!removeUrl) setRemoveUrl(detectedPatterns[0].url);
      if (!dnsTargetUrl) setDnsTargetUrl(detectedPatterns[0].url);
    }
  }, [detectedPatterns]);

  // Calculate live preview count of affected users/patterns
  const previewAffectedCount = React.useMemo(() => {
    let affectedUsersCount = 0;
    let matchingPatternsCount = 0;

    targetUsers.forEach((u) => {
      const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
      const { patterns: pList } = getEffectiveUserPatterns(u, pl);

      let userMatches = false;

      if (activeTab === 'rename') {
        const query = (oldUrl || '').trim();
        if (!query) return;
        pList.forEach((p) => {
          const uUrl = (p.url || '').trim();
          if (replaceMode === 'substring') {
            if (uUrl.includes(query)) {
              userMatches = true;
              matchingPatternsCount++;
            }
          } else {
            if (uUrl === query) {
              userMatches = true;
              matchingPatternsCount++;
            }
          }
        });
      } else if (activeTab === 'remove') {
        const query = (removeUrl || '').trim();
        pList.forEach((p) => {
          const uUrl = (p.url || '').trim();
          const matchType = removeType === 'all' || (p.type || '').toLowerCase() === removeType.toLowerCase();
          let matchUrl = true;
          if (query) {
            matchUrl = removeReplaceMode === 'substring' ? uUrl.includes(query) : uUrl === query;
          }
          if (matchType && matchUrl) {
            userMatches = true;
            matchingPatternsCount++;
          }
        });
      } else if (activeTab === 'add') {
        const targetUrl = (newPatternUrl || '').trim();
        if (!targetUrl) return;
        const alreadyHas = pList.some(
          (p) => (p.url || '').trim() === targetUrl && (p.type || '').toLowerCase() === newPatternType.toLowerCase()
        );
        if (!alreadyHas) {
          userMatches = true;
          matchingPatternsCount++;
        }
      } else if (activeTab === 'custom_dns') {
        const query = (dnsTargetUrl || '').trim();
        pList.forEach((p) => {
          const uUrl = (p.url || '').trim();
          if (!query || uUrl === query) {
            userMatches = true;
            matchingPatternsCount++;
          }
        });
      }

      if (userMatches) affectedUsersCount++;
    });

    return { users: affectedUsersCount, patterns: matchingPatternsCount };
  }, [
    targetUsers,
    activeTab,
    oldUrl,
    replaceMode,
    removeUrl,
    removeType,
    removeReplaceMode,
    newPatternUrl,
    newPatternType,
    dnsTargetUrl
  ]);

  // Compute a concrete example of how an affected user will be transformed
  const sampleAffected = React.useMemo(() => {
    for (const u of targetUsers) {
      const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
      const { patterns: pList } = getEffectiveUserPatterns(u, pl);

      if (activeTab === 'rename') {
        const query = (oldUrl || '').trim();
        const target = (newUrl || '').trim();
        if (!query) continue;
        const p = pList.find((item) => {
          const uUrl = (item.url || '').trim();
          return replaceMode === 'substring' ? uUrl.includes(query) : uUrl === query;
        });
        if (p) {
          const beforeUrl = p.url || '';
          const afterUrl = replaceMode === 'substring'
            ? beforeUrl.replaceAll(query, target || '<new-url>')
            : (target || '<new-url>');
          return {
            user: u,
            type: p.type || 'xtream',
            before: beforeUrl,
            after: afterUrl,
            action: 'rename'
          };
        }
      } else if (activeTab === 'remove') {
        const query = (removeUrl || '').trim();
        const p = pList.find((item) => {
          const matchType = removeType === 'all' || (item.type || '').toLowerCase() === removeType.toLowerCase();
          let matchUrl = true;
          if (query) {
            const uUrl = (item.url || '').trim();
            matchUrl = removeReplaceMode === 'substring' ? uUrl.includes(query) : uUrl === query;
          }
          return matchType && matchUrl;
        });
        if (p) {
          return {
            user: u,
            type: p.type || 'xtream',
            before: p.url || `Provider (${p.type})`,
            after: 'Provider removed from user',
            action: 'remove'
          };
        }
      } else if (activeTab === 'add') {
        const targetUrl = (newPatternUrl || '').trim();
        if (!targetUrl) continue;
        const alreadyHas = pList.some(
          (p) => (p.url || '').trim() === targetUrl && (p.type || '').toLowerCase() === newPatternType.toLowerCase()
        );
        if (!alreadyHas) {
          return {
            user: u,
            type: newPatternType,
            before: `${pList.length} existing provider(s)`,
            after: `+ ${targetUrl} (${newPatternType.toUpperCase()})`,
            action: 'add'
          };
        }
      } else if (activeTab === 'custom_dns') {
        const query = (dnsTargetUrl || '').trim();
        const p = pList.find((item) => {
          const uUrl = (item.url || '').trim();
          return !query || uUrl === query;
        });
        if (p) {
          return {
            user: u,
            type: p.type || 'xtream',
            before: p.cUrl || 'Default DNS (no custom cUrl)',
            after: dnsUseCUrl ? (dnsCUrl || '<custom-dns>') : 'Custom DNS disabled',
            action: 'custom_dns'
          };
        }
      }
    }
    return null;
  }, [
    targetUsers,
    activeTab,
    oldUrl,
    newUrl,
    replaceMode,
    removeUrl,
    removeType,
    removeReplaceMode,
    newPatternUrl,
    newPatternType,
    dnsTargetUrl,
    dnsCUrl,
    dnsUseCUrl,
    playlists,
    currentPlaylist
  ]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    const payload = {
      scope,
      user_ids: scope === 'selected' ? selectedUserIds : [],
      update_playlist: updatePlaylist,
    };

    if (activeTab === 'rename') {
      if (!oldUrl.trim()) {
        setError('Please specify the URL or DNS to search');
        return;
      }
      if (!newUrl.trim()) {
        setError('Please specify the new destination URL or DNS');
        return;
      }
      payload.action = 'rename_url';
      payload.old_url = oldUrl.trim();
      payload.new_url = newUrl.trim();
      payload.replace_mode = replaceMode;
      payload.update_curl = updateCUrl;
    } else if (activeTab === 'remove') {
      if (!removeUrl.trim() && removeType === 'all') {
        setError('Please specify the URL to remove or select a provider type');
        return;
      }
      payload.action = 'remove';
      payload.old_url = removeUrl.trim();
      payload.target_type = removeType === 'all' ? '' : removeType;
      payload.replace_mode = removeReplaceMode;
    } else if (activeTab === 'add') {
      if (!newPatternUrl.trim()) {
        setError('Please enter the provider URL to add');
        return;
      }
      payload.action = 'add';
      payload.new_pattern = {
        type: newPatternType,
        url: newPatternUrl.trim(),
        param1: newPatternParam1.trim(),
        param2: newPatternParam2.trim(),
        useCUrl: newPatternUseCUrl,
        cUrl: newPatternCUrl.trim(),
      };
    } else if (activeTab === 'custom_dns') {
      if (!dnsCUrl.trim() && !dnsUseCUrl) {
        setError('Please specify the Custom DNS URL');
        return;
      }
      payload.action = 'update_curl';
      payload.old_url = dnsTargetUrl.trim();
      payload.curl = dnsCUrl.trim();
      payload.use_curl = dnsUseCUrl;
    }

    setLoading(true);
    try {
      const res = await userApi.bulkUpdatePatterns(currentPlaylist.id, payload);
      onSuccess?.(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Error during bulk provider modification');
    } finally {
      setLoading(false);
    }
  };

  const newPatternConfig = getPanelType(newPatternType);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!loading) onClose?.(); }}
      size="2xl"
    >
      <Modal.Header
        title="Source Providers Bulk Manager"
        subtitle={`Playlist: ${currentPlaylist?.name || ''} (${users.length} total users)`}
        icon={<Server className="w-5 h-5" />}
        onClose={() => { if (!loading) onClose?.(); }}
        showClose={!loading}
      />

      {/* Action Tabs */}
      <div className="flex border-b border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe]/50 dark:bg-slate-800/50 px-6 pt-2 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setActiveTab('rename'); setError(''); }}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 ${activeTab === 'rename'
            ? 'border-[#3970e1] dark:border-blue-400 text-[#3970e1] dark:text-blue-400 bg-white dark:bg-slate-900 shadow-xs'
            : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Rename / Replace URL</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('remove'); setError(''); }}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 ${activeTab === 'remove'
            ? 'border-[#f5365c] dark:border-rose-400 text-[#f5365c] dark:text-rose-400 bg-white dark:bg-slate-900 shadow-xs'
            : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Provider</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('add'); setError(''); }}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 ${activeTab === 'add'
            ? 'border-[#2dce89] dark:border-emerald-400 text-[#2dce89] dark:text-emerald-400 bg-white dark:bg-slate-900 shadow-xs'
            : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Provider</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('custom_dns'); setError(''); }}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 ${activeTab === 'custom_dns'
            ? 'border-[#fb6340] dark:border-amber-400 text-[#fb6340] dark:text-amber-400 bg-white dark:bg-slate-900 shadow-xs'
            : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Custom DNS</span>
        </button>
      </div>

      {/* Content Body */}
      <form onSubmit={handleSubmit}>
        <Modal.Body className="space-y-5">
          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          {/* Target Users Selector */}
          <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg p-3.5 space-y-2">
            <label className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>Apply to Users:</span>
            </label>

            {selectedUserIds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition ${scope === 'selected'
                    ? 'border-[#3970e1] dark:border-blue-600 bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300 font-bold shadow-xs'
                    : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="selected"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="text-[#3970e1] dark:border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span>Selected Users Only ({selectedUserIds.length})</span>
                </label>

                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition ${scope === 'playlist'
                    ? 'border-[#3970e1] dark:border-blue-600 bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300 font-bold shadow-xs'
                    : 'border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="playlist"
                    checked={scope === 'playlist'}
                    onChange={() => setScope('playlist')}
                    className="text-[#3970e1] dark:border-slate-700 focus:ring-0 cursor-pointer"
                  />
                  <span>All Users in Table ({users.length})</span>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs">
                <span className="text-[#32325d] dark:text-slate-100 font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
                  <span>All {users.length} user(s)</span>
                </span>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">
                  (To apply only to specific users, select them with checkboxes in the table first)
                </span>
              </div>
            )}
          </div>

          {/* 2. Detected Provider URLs quick helper */}
          {detectedPatterns.length > 0 && activeTab !== 'add' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider text-[12px]">
                  Detected providers in users ({detectedPatterns.length}):
                </span>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Click to select</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#e9ecef] dark:border-slate-700 rounded-lg">
                {detectedPatterns.map((dp, idx) => {
                  const isSelected =
                    (activeTab === 'rename' && oldUrl === dp.url) ||
                    (activeTab === 'remove' && removeUrl === dp.url) ||
                    (activeTab === 'custom_dns' && dnsTargetUrl === dp.url);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (activeTab === 'rename') setOldUrl(dp.url);
                        else if (activeTab === 'remove') setRemoveUrl(dp.url);
                        else if (activeTab === 'custom_dns') setDnsTargetUrl(dp.url);
                      }}
                      className={`text-[12px] px-2.5 py-1 rounded font-mono flex items-center gap-1.5 border transition ${isSelected
                        ? 'bg-[#3970e1] text-white border-[#3970e1] shadow-xs font-bold'
                        : 'bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1]/50 dark:hover:border-blue-400'
                        }`}
                    >
                      <span>{dp.url}</span>
                      <span
                        className={`text-[12px] px-1 py-0.2 rounded font-sans ${isSelected ? 'bg-white/25 text-white' : 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300'
                          }`}
                      >
                        {dp.count} users
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 1: Rename URL */}
          {activeTab === 'rename' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                    <span>URL / DNS to Replace (Old URL)</span>
                  </label>
                  <input
                    type="text"
                    value={oldUrl}
                    onChange={(e) => setOldUrl(e.target.value)}
                    placeholder="http://old-provider.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
                    <span>New URL / DNS</span>
                  </label>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="http://new-provider.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] focus:ring-1 focus:ring-[#2dce89]/30 transition shadow-sm"
                  />
                </div>
              </div>

              {/* Mode Options */}
              <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2">
                <span className="text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider block">
                  Replacement Mode
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-[#525f7f] dark:text-slate-300">
                    <input
                      type="radio"
                      name="replaceMode"
                      value="exact"
                      checked={replaceMode === 'exact'}
                      onChange={() => setReplaceMode('exact')}
                      className="text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                    <span>Exact URL (Full match)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#525f7f] dark:text-slate-300">
                    <input
                      type="radio"
                      name="replaceMode"
                      value="substring"
                      checked={replaceMode === 'substring'}
                      onChange={() => setReplaceMode('substring')}
                      className="text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                    <span>Partial / Domain replacement (Substring)</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-700 flex flex-wrap gap-4 text-xs text-[#525f7f] dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateCUrl}
                      onChange={(e) => setUpdateCUrl(e.target.checked)}
                      className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                    <span>Also update Custom DNS if present</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updatePlaylist}
                      onChange={(e) => setUpdatePlaylist(e.target.checked)}
                      className="rounded border-[#dee2e6] dark:border-slate-700 text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                    <span>Also update default provider template for new users</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Remove Provider */}
          {activeTab === 'remove' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#feecee]/60 dark:bg-rose-950/40 border border-[#f5365c]/20 dark:border-rose-800/40 rounded-lg text-xs text-[#f5365c] dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0 text-[#f5365c]" />
                <span>
                  Matching providers will be removed from all users in the selected scope.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    URL to Remove
                  </label>
                  <input
                    type="text"
                    value={removeUrl}
                    onChange={(e) => setRemoveUrl(e.target.value)}
                    placeholder="http://provider-to-remove.com:8080 (optional if type selected)"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#f5365c] focus:ring-1 focus:ring-[#f5365c]/30 transition shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Provider Type
                  </label>
                  <select
                    value={removeType}
                    onChange={(e) => setRemoveType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#f5365c] shadow-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="xtream">Xtream Codes</option>
                    <option value="apollo">API Stream Auth</option>
                    <option value="auth">Auth</option>
                    <option value="watch">Watch</option>
                    <option value="xui_mac">XUI MAC</option>
                    <option value="token">Token</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-[#525f7f] dark:text-slate-300 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeReplaceMode === 'substring'}
                    onChange={(e) => setRemoveReplaceMode(e.target.checked ? 'substring' : 'exact')}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#f5365c] focus:ring-0 cursor-pointer"
                  />
                  <span>Partial URL match (Substring)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updatePlaylist}
                    onChange={(e) => setUpdatePlaylist(e.target.checked)}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#f5365c] focus:ring-0 cursor-pointer"
                  />
                  <span>Also remove from default provider template for new users</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Add Provider */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Provider Type
                  </label>
                  <select
                    value={newPatternType}
                    onChange={(e) => setNewPatternType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#2dce89] shadow-sm"
                  >
                    <option value="xtream">Xtream Codes</option>
                    <option value="apollo">API Stream Auth</option>
                    <option value="auth">Auth</option>
                    <option value="watch">Watch</option>
                    <option value="xui_mac">XUI MAC</option>
                    <option value="token">Token</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Provider DNS / URL
                  </label>
                  <input
                    type="text"
                    value={newPatternUrl}
                    onChange={(e) => setNewPatternUrl(e.target.value)}
                    placeholder="http://new-provider.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] shadow-sm"
                  />
                </div>
              </div>

              {/* Params */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    {newPatternConfig.param1 || 'Param 1 (e.g. Username)'}
                  </label>
                  <input
                    type="text"
                    value={newPatternParam1}
                    onChange={(e) => setNewPatternParam1(e.target.value)}
                    placeholder={`Enter ${newPatternConfig.param1 || 'Username'}`}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] shadow-sm"
                  />
                </div>

                {newPatternConfig.param2 && (
                  <div>
                    <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                      {newPatternConfig.param2 || 'Param 2 (e.g. Password)'}
                    </label>
                    <input
                      type="text"
                      value={newPatternParam2}
                      onChange={(e) => setNewPatternParam2(e.target.value)}
                      placeholder={`Enter ${newPatternConfig.param2 || 'Password'}`}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Custom DNS */}
              <div className="p-3 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#525f7f] dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newPatternUseCUrl}
                    onChange={(e) => setNewPatternUseCUrl(e.target.checked)}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#2dce89] focus:ring-0 cursor-pointer"
                  />
                  <span>Set Custom DNS for this provider</span>
                </label>

                {newPatternUseCUrl && (
                  <input
                    type="text"
                    value={newPatternCUrl}
                    onChange={(e) => setNewPatternCUrl(e.target.value)}
                    placeholder="http://custom-dns.domain.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] shadow-sm"
                  />
                )}

                <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#525f7f] dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={updatePlaylist}
                      onChange={(e) => setUpdatePlaylist(e.target.checked)}
                      className="rounded border-[#dee2e6] dark:border-slate-700 text-[#2dce89] focus:ring-0 cursor-pointer"
                    />
                    <span>Also add to default provider template for new users</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Custom DNS */}
          {activeTab === 'custom_dns' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                  Target Provider URL
                </label>
                <input
                  type="text"
                  value={dnsTargetUrl}
                  onChange={(e) => setDnsTargetUrl(e.target.value)}
                  placeholder="http://source-provider.com:8080 (leave empty for all providers)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#fb6340] shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Custom DNS
                </label>
                <input
                  type="text"
                  value={dnsCUrl}
                  onChange={(e) => setDnsCUrl(e.target.value)}
                  placeholder="http://custom-dns.domain.com:8080"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#fb6340] shadow-sm"
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-[#525f7f] dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dnsUseCUrl}
                    onChange={(e) => setDnsUseCUrl(e.target.checked)}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#fb6340] focus:ring-0 cursor-pointer"
                  />
                  <span>Enable Custom DNS (useCUrl = true)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updatePlaylist}
                    onChange={(e) => setUpdatePlaylist(e.target.checked)}
                    className="rounded border-[#dee2e6] dark:border-slate-700 text-[#fb6340] focus:ring-0 cursor-pointer"
                  />
                  <span>Also update default provider template for new users</span>
                </label>
              </div>
            </div>
          )}

          {/* Live Preview Indicator & User Impact Example */}
          <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#525f7f] dark:text-slate-300">
                <Info className="w-4 h-4 text-[#3970e1] dark:text-blue-400 shrink-0" />
                <span>
                  Estimated impact: <strong className="text-[#32325d] dark:text-white font-bold">{previewAffectedCount.users}</strong> of{' '}
                  <span className="text-[#8898aa] dark:text-slate-400">{targetUsers.length}</span> users (
                  <strong className="text-[#32325d] dark:text-white">{previewAffectedCount.patterns}</strong> matching providers)
                </span>
              </div>
              {scope === 'selected' ? (
                <span className="text-[12px] font-bold px-2 py-0.5 rounded bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300 border border-[#3970e1]/20 dark:border-blue-700/40 shrink-0">
                  Selected Users Only ({targetUsers.length})
                </span>
              ) : (
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-[#8898aa] dark:text-slate-400 border border-[#dee2e6] dark:border-slate-700 shrink-0">
                  All Users ({targetUsers.length})
                </span>
              )}
            </div>

            {/* Live Concrete Impact Example */}
            <div className="pt-2.5 border-t border-[#e9ecef] dark:border-slate-700">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400 mb-2 flex items-center justify-between">
                <span>Example of User Impact</span>
                {sampleAffected && (
                  <span className="text-[#3970e1] dark:text-blue-400 font-medium normal-case flex items-center gap-1.5 text-[13px]">
                    <User className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                    <span>User:</span>
                    <strong className="text-[#32325d] dark:text-white">
                      #{sampleAffected.user.id} {sampleAffected.user.name || sampleAffected.user.username}
                    </strong>
                    {sampleAffected.user.username && sampleAffected.user.name && (
                      <span className="text-[#8898aa] dark:text-slate-400">({sampleAffected.user.username})</span>
                    )}
                  </span>
                )}
              </div>

              {sampleAffected ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Before Box */}
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#f8f9fe] dark:bg-slate-700 text-[#8898aa] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-600">
                        Current (Before)
                      </span>
                      <span className="text-[12px] font-bold text-[#8898aa] dark:text-slate-400 uppercase">
                        {sampleAffected.type}
                      </span>
                    </div>
                    <div className="font-mono text-[13px] text-[#525f7f] dark:text-slate-300 break-all">
                      {sampleAffected.before}
                    </div>
                  </div>

                  {/* After Box */}
                  <div
                    className={`p-2.5 rounded-lg shadow-xs border ${sampleAffected.action === 'remove'
                      ? 'bg-[#fff5f7] dark:bg-rose-950/40 border-[#f5365c]/30 dark:border-rose-800/40'
                      : 'bg-[#f4fbf7] dark:bg-emerald-950/40 border-[#2dce89]/30 dark:border-emerald-800/40'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[12px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sampleAffected.action === 'remove'
                          ? 'bg-[#fdd1da] dark:bg-rose-900/60 text-[#f5365c] dark:text-rose-300'
                          : 'bg-[#c7f3e0] dark:bg-emerald-900/60 text-[#2dce89] dark:text-emerald-300'
                          }`}
                      >
                        Result (After)
                      </span>
                      <span className="text-[12px] font-bold text-[#8898aa] dark:text-slate-400 uppercase">
                        {sampleAffected.action === 'remove' ? 'Removed' : sampleAffected.type}
                      </span>
                    </div>
                    <div
                      className={`font-mono text-[13px] break-all ${sampleAffected.action === 'remove'
                        ? 'text-[#f5365c] dark:text-rose-400 line-through font-semibold'
                        : 'text-[#2dce89] dark:text-emerald-400 font-bold'
                        }`}
                    >
                      {sampleAffected.after}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-dashed border-[#dee2e6] dark:border-slate-700 text-[#8898aa] dark:text-slate-400 text-xs flex items-center justify-between">
                  <span>
                    {targetUsers.length === 0
                      ? 'No users available in the current playlist.'
                      : activeTab === 'rename' && !oldUrl.trim()
                        ? 'Type a URL or DNS above to view a live user transformation example.'
                        : activeTab === 'add' && !newPatternUrl.trim()
                          ? 'Enter a Server URL above to view how this provider will be added to users.'
                          : activeTab === 'remove' && !removeUrl.trim() && removeType === 'all'
                            ? 'Specify a URL or provider type above to preview the removal effect.'
                            : activeTab === 'custom_dns' && !dnsCUrl.trim() && dnsUseCUrl
                              ? 'Enter a Custom DNS host above to preview the cUrl transformation.'
                              : 'No users in current scope match the specified criteria.'}
                  </span>
                </div>
              )}
            </div>
          </div>

        </Modal.Body>

        {/* Footer Actions */}
        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant={
              activeTab === 'remove'
                ? 'danger'
                : activeTab === 'add'
                  ? 'success'
                  : activeTab === 'custom_dns'
                    ? 'warning'
                    : 'primary'
            }
            loading={loading}
            icon={<Check className="w-3.5 h-3.5" />}
          >
            {activeTab === 'remove'
              ? 'Confirm & Remove Provider'
              : activeTab === 'rename'
                ? 'Apply URL Replacement'
                : activeTab === 'add'
                  ? 'Add Provider to Users'
                  : 'Apply Custom DNS'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
