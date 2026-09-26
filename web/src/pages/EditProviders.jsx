import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Server,
  Globe,
  Trash2,
  Plus,
  Sliders,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Users,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { userApi } from '../api/client';
import { getPanelType } from '../components/PatternForm';
import { PageHeader } from '../components/ui';
import { getEffectiveUserPatterns, safeParsePatterns } from '../utils/patterns';

export default function EditProviders({ currentPlaylist, playlists = [], admin, onProvidersUpdated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Active playlist ID from props or URL
  const listId = currentPlaylist?.id || params.listId;

  // Read query params for initial action/tab or scope
  const searchParams = React.useMemo(() => new URLSearchParams(location.search), [location.search]);
  const actionParam = searchParams.get('action');
  const scopeParam = searchParams.get('scope');

  const initialTab = ['rename', 'remove', 'add', 'custom_dns'].includes(actionParam) ? actionParam : 'rename';
  const [activeTab, setActiveTab] = React.useState(initialTab);

  React.useEffect(() => {
    if (actionParam && ['rename', 'remove', 'add', 'custom_dns'].includes(actionParam)) {
      setActiveTab(actionParam);
    }
  }, [actionParam]);

  // Scope: 'playlist' (all users) or 'selected'
  const [scope, setScope] = React.useState(scopeParam === 'selected' ? 'selected' : 'playlist');

  // Users data for the playlist
  const [users, setUsers] = React.useState([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState([]);
  const [loadingUsers, setLoadingUsers] = React.useState(true);

  // Form states for Rename URL
  const [oldUrl, setOldUrl] = React.useState('');
  const [newUrl, setNewUrl] = React.useState('');
  const [replaceMode, setReplaceMode] = React.useState('exact'); // 'exact' | 'substring'
  const [updateCUrl, setUpdateCUrl] = React.useState(true);

  // Form states for Remove Provider
  const [removeUrl, setRemoveUrl] = React.useState('');
  const [removeType, setRemoveType] = React.useState('all');
  const [removeReplaceMode, setRemoveReplaceMode] = React.useState('exact');

  // Form states for Add Provider
  const [newPatternType, setNewPatternType] = React.useState('xtream');
  const [newPatternUrl, setNewPatternUrl] = React.useState('');
  const [newPatternParam1, setNewPatternParam1] = React.useState('');
  const [newPatternParam2, setNewPatternParam2] = React.useState('');
  const [newPatternUseCUrl, setNewPatternUseCUrl] = React.useState(false);
  const [newPatternCUrl, setNewPatternCUrl] = React.useState('');

  // Form states for Custom DNS
  const [dnsTargetUrl, setDnsTargetUrl] = React.useState('');
  const [dnsCUrl, setDnsCUrl] = React.useState('');
  const [dnsUseCUrl, setDnsUseCUrl] = React.useState(true);

  // Common options
  const [updatePlaylist, setUpdatePlaylist] = React.useState(true);

  // Execution states
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  // Load users when playlist id changes
  React.useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      if (!listId) return;
      setLoadingUsers(true);
      try {
        const data = await userApi.getUsers(listId);
        if (isMounted) {
          setUsers(data || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error loading playlist users');
        }
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [listId]);

  // Target users depending on scope
  const targetUsers = React.useMemo(() => {
    if (scope === 'selected' && selectedUserIds.length > 0) {
      return users.filter((u) => selectedUserIds.includes(u.id));
    }
    return users;
  }, [users, selectedUserIds, scope]);

  // Detected existing patterns from target users
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

  // Set default URL when patterns are detected
  React.useEffect(() => {
    if (detectedPatterns.length > 0) {
      if (!oldUrl) setOldUrl(detectedPatterns[0].url);
      if (!removeUrl) setRemoveUrl(detectedPatterns[0].url);
      if (!dnsTargetUrl) setDnsTargetUrl(detectedPatterns[0].url);
    }
  }, [detectedPatterns]);

  // Live preview counts
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
    dnsTargetUrl,
  ]);

  // Sample transformation preview
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
          const afterUrl =
            replaceMode === 'substring' ? beforeUrl.replaceAll(query, target || '<new-url>') : target || '<new-url>';
          return {
            user: u,
            type: p.type || 'xtream',
            before: beforeUrl,
            after: afterUrl,
            action: 'rename',
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
            action: 'remove',
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
            action: 'add',
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
            after: dnsUseCUrl ? dnsCUrl || '<custom-dns>' : 'Custom DNS disabled',
            action: 'custom_dns',
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
    currentPlaylist,
  ]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!listId) {
      setError('No active playlist identified');
      return;
    }

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
      const res = await userApi.bulkUpdatePatterns(listId, payload);
      setSuccessMsg(`Provider updates applied successfully to ${res?.updated_count || previewAffectedCount.users} user(s)!`);
      onProvidersUpdated?.(res);
      // Refresh user list
      const freshUsers = await userApi.getUsers(listId);
      setUsers(freshUsers || []);
    } catch (err) {
      setError(err.message || 'Error executing bulk provider update');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/users/${listId}`);
  };

  const newPatternConfig = getPanelType(newPatternType);

  if (loadingUsers) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#3970e1] animate-spin" />
        <span className="text-xs font-semibold text-[#8898aa] dark:text-slate-400">Loading provider editor...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Standardized Header Bar */}
      <PageHeader
        onBack={handleBack}
        backTitle="Back to Users"
        icon={Server}
        color="blue"
        title="Edit Providers"
        badge={
          <span className="text-xs font-semibold text-[#3970e1] dark:text-blue-400 bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-700/40 px-2 py-0.5 rounded-[0.375rem]">
            {currentPlaylist?.name || listId}
          </span>
        }
        description={`Manage and update stream provider URLs across ${users.length} managed users.`}
      />

      <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-argon dark:shadow-2xl overflow-hidden">

        {/* Action Tabs */}
        <div className="flex border-b border-[#e9ecef] dark:border-slate-800 bg-[#f8f9fe]/50 dark:bg-slate-800/50 px-6 pt-2 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('rename');
              setError('');
              setSuccessMsg('');
            }}
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
            onClick={() => {
              setActiveTab('remove');
              setError('');
              setSuccessMsg('');
            }}
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
            onClick={() => {
              setActiveTab('add');
              setError('');
              setSuccessMsg('');
            }}
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
            onClick={() => {
              setActiveTab('custom_dns');
              setError('');
              setSuccessMsg('');
            }}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-[#feecee] dark:bg-rose-950/60 border border-[#f5365c]/30 dark:border-rose-700/40 rounded-lg text-xs text-[#f5365c] dark:text-rose-400 font-semibold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between gap-2.5 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleBack}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition shadow-xs"
              >
                Go to Users
              </button>
            </div>
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
                  <span>All Users in Playlist ({users.length})</span>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs">
                <span className="text-[#32325d] dark:text-slate-100 font-semibold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400" />
                  <span>All {users.length} user(s) in playlist</span>
                </span>
                <span className="text-[13px] text-[#8898aa] dark:text-slate-400">
                  Modifications will be processed across all users of "{currentPlaylist?.name || 'playlist'}"
                </span>
              </div>
            )}
          </div>

          {/* Detected Provider URLs quick selector */}
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
                        className={`text-[12px] px-1 py-0.2 rounded font-sans ${isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-300'
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
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
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#2dce89] focus:ring-1 focus:ring-[#2dce89]/30 transition shadow-sm"
                  />
                </div>
              </div>

              {/* Mode Options */}
              <div className="p-3.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2">
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
                      className="rounded text-[#3970e1] focus:ring-0 cursor-pointer"
                    />
                    <span>Also update Custom Stream DNS when matching</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Remove Provider */}
          {activeTab === 'remove' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-[#f5365c] dark:text-rose-400" />
                  <span>Target URL / DNS to Remove</span>
                </label>
                <input
                  type="text"
                  value={removeUrl}
                  onChange={(e) => setRemoveUrl(e.target.value)}
                  placeholder="http://old-provider.com:8080 (Leave blank to remove all matching type)"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#f5365c] focus:ring-1 focus:ring-[#f5365c]/30 transition shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Provider Type Filter
                  </label>
                  <select
                    value={removeType}
                    onChange={(e) => setRemoveType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                  >
                    <option value="all">All Types</option>
                    <option value="xtream">Xtream Codes Only</option>
                    <option value="stalker">Stalker Portal Only</option>
                    <option value="m3u">M3U / Direct Stream Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    URL Match Mode
                  </label>
                  <select
                    value={removeReplaceMode}
                    onChange={(e) => setRemoveReplaceMode(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                  >
                    <option value="exact">Exact Match (Full URL)</option>
                    <option value="substring">Substring / Domain contains</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Add Provider */}
          {activeTab === 'add' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    Provider Type
                  </label>
                  <select
                    value={newPatternType}
                    onChange={(e) => setNewPatternType(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                  >
                    <option value="xtream">Xtream Codes</option>
                    <option value="stalker">Stalker Portal</option>
                    <option value="m3u">M3U / Direct Stream</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                    {newPatternConfig.urlLabel}
                  </label>
                  <input
                    type="text"
                    value={newPatternUrl}
                    onChange={(e) => setNewPatternUrl(e.target.value)}
                    placeholder="http://provider-dns.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#2dce89]"
                  />
                </div>
              </div>

              {newPatternConfig.param1Label && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                      {newPatternConfig.param1Label}
                    </label>
                    <input
                      type="text"
                      value={newPatternParam1}
                      onChange={(e) => setNewPatternParam1(e.target.value)}
                      placeholder={newPatternConfig.param1Help || 'Leave empty to inherit user value'}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                    />
                  </div>

                  {newPatternConfig.param2Label && (
                    <div>
                      <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                        {newPatternConfig.param2Label}
                      </label>
                      <input
                        type="text"
                        value={newPatternParam2}
                        onChange={(e) => setNewPatternParam2(e.target.value)}
                        placeholder="Leave empty to inherit user value"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="p-3.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#525f7f] dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newPatternUseCUrl}
                    onChange={(e) => setNewPatternUseCUrl(e.target.checked)}
                    className="rounded text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <span>Configure Custom Stream DNS (cUrl) for this new provider</span>
                </label>
                {newPatternUseCUrl && (
                  <input
                    type="text"
                    value={newPatternCUrl}
                    onChange={(e) => setNewPatternCUrl(e.target.value)}
                    placeholder="http://custom-stream-dns.com:8080"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#3970e1]"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Custom DNS */}
          {activeTab === 'custom_dns' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                  <span>Target Provider URL (Leave blank to match all providers)</span>
                </label>
                <input
                  type="text"
                  value={dnsTargetUrl}
                  onChange={(e) => setDnsTargetUrl(e.target.value)}
                  placeholder="http://target-provider.com:8080"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] focus:ring-1 focus:ring-[#3970e1]/30 transition shadow-sm"
                />
              </div>

              <div className="p-3.5 bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#525f7f] dark:text-slate-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={dnsUseCUrl}
                    onChange={(e) => setDnsUseCUrl(e.target.checked)}
                    className="rounded text-[#3970e1] focus:ring-0 cursor-pointer"
                  />
                  <span>Enable Custom Stream DNS</span>
                </label>

                {dnsUseCUrl && (
                  <div>
                    <label className="block text-xs font-bold text-[#525f7f] dark:text-slate-300 uppercase tracking-wider mb-1">
                      Custom Stream DNS URL (cUrl)
                    </label>
                    <input
                      type="text"
                      value={dnsCUrl}
                      onChange={(e) => setDnsCUrl(e.target.value)}
                      placeholder="http://stream-proxy.mydomain.com:8080"
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder-slate-500 focus:outline-none focus:border-[#fb6340] focus:ring-1 focus:ring-[#fb6340]/30 transition shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync to PlaylistLabs playlist setting */}
          <div className="pt-2 border-t border-[#e9ecef] dark:border-slate-700">
            <label className="flex items-center gap-2 text-xs text-[#525f7f] dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={updatePlaylist}
                onChange={(e) => setUpdatePlaylist(e.target.checked)}
                className="rounded text-[#3970e1] focus:ring-0 cursor-pointer"
              />
              <span>
                Also update this provider URL in the primary Playlist configuration (PlaylistLabs synchronization)
              </span>
            </label>
          </div>

          {/* Live Impact Preview Card */}
          <div className="bg-[#f8f9fe] dark:bg-slate-800/60 border border-[#dee2e6] dark:border-slate-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#32325d] dark:text-white uppercase tracking-wider">
                  Live Impact Preview:
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#525f7f] dark:text-slate-300">
                  Affected Users:{' '}
                  <strong className="text-[#3970e1] dark:text-blue-400 font-mono text-sm">
                    {previewAffectedCount.users}
                  </strong>{' '}
                  / {targetUsers.length}
                </span>
                <span className="text-[#525f7f] dark:text-slate-300">
                  Matching Patterns:{' '}
                  <strong className="text-[#2dce89] dark:text-emerald-400 font-mono text-sm">
                    {previewAffectedCount.patterns}
                  </strong>
                </span>
              </div>
            </div>

            {sampleAffected && (
              <div className="p-3 bg-white dark:bg-slate-800 border border-[#e9ecef] dark:border-slate-700 rounded-lg text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between text-[13px] text-[#8898aa] dark:text-slate-400">
                  <span>
                    Sample transformation preview on user:{' '}
                    <strong className="text-[#32325d] dark:text-white font-mono">
                      {sampleAffected.user.username || sampleAffected.user.name || sampleAffected.user.id}
                    </strong>
                  </span>
                  <span className="uppercase text-[12px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {sampleAffected.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[13px] overflow-x-auto py-1">
                  <span className="text-[#f5365c] dark:text-rose-400 bg-[#feecee] dark:bg-rose-950/60 px-2 py-0.5 rounded truncate max-w-[45%]">
                    {sampleAffected.before}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[#2dce89] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded truncate max-w-[45%]">
                    {sampleAffected.after}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#e9ecef] dark:border-slate-700">
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300 rounded-lg text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || (activeTab !== 'add' && previewAffectedCount.users === 0)}
              className="flex items-center gap-2 px-5 py-2 bg-[#3970e1] hover:bg-[#2b5cc4] text-white text-xs font-semibold rounded-lg transition shadow-argon-btn active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Apply Provider Changes ({previewAffectedCount.users} Users)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
