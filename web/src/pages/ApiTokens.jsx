import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Shield,
  Loader2,
  Calendar,
  Lock,
  Unlock,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Terminal,
  FileText,
  CheckCircle2,
  Power,
  Search,
  Globe,
  X,
  Edit2,
  Layers,
  Filter,
  ArrowUpDown,
  Code2,
  RefreshCw,
  Info,
  ShieldAlert
} from 'lucide-react';
import { tokensApi, playlistsApi, getAdmin } from '../api/client';
import { Modal, ConfirmDialog, Button, Alert, PageHeader } from '../components/ui';

function formatRelativeTime(dateString) {
  if (!dateString) return 'Never used';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Never used';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getExpirationPreview(daysStr) {
  const days = parseInt(daysStr, 10);
  if (!days || days <= 0) return 'Never expires (Permanent token)';
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `Expires on ${date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })}`;
}

export default function ApiTokens({ currentAdmin: propCurrentAdmin }) {
  const navigate = useNavigate();
  const currentAdmin = propCurrentAdmin || getAdmin() || {};

  // Data state
  const [tokens, setTokens] = React.useState([]);
  const [playlists, setPlaylists] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all'); // 'all' | 'active' | 'disabled' | 'expired'
  const [sortBy, setSortBy] = React.useState('created_desc'); // 'created_desc' | 'created_asc' | 'last_used' | 'expires_soonest' | 'name'

  // Modals
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [detailsTarget, setDetailsTarget] = React.useState(null);
  const [revealTokenData, setRevealTokenData] = React.useState(null);

  // Create form state
  const [formName, setFormName] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [showFormPassword, setShowFormPassword] = React.useState(false);
  const [formAllowedIPs, setFormAllowedIPs] = React.useState('');
  const [formAllowedPlaylists, setFormAllowedPlaylists] = React.useState([]);
  const [formExpiryDays, setFormExpiryDays] = React.useState('0');
  const [formPlaylistSearch, setFormPlaylistSearch] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  // Edit form state
  const [editName, setEditName] = React.useState('');
  const [editPassword, setEditPassword] = React.useState('');
  const [editRemovePassword, setEditRemovePassword] = React.useState(false);
  const [showEditPassword, setShowEditPassword] = React.useState(false);
  const [editAllowedIPs, setEditAllowedIPs] = React.useState('');
  const [editAllowedPlaylists, setEditAllowedPlaylists] = React.useState([]);
  const [editPlaylistSearch, setEditPlaylistSearch] = React.useState('');
  const [editError, setEditError] = React.useState('');

  // Reveal Modal Snippet Tabs
  const [activeSnippetTab, setActiveSnippetTab] = React.useState('curl'); // 'curl' | 'js' | 'python'
  const [copiedToken, setCopiedToken] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState(false);
  const [copiedPrefixId, setCopiedPrefixId] = React.useState(null);

  // Toast Notifications
  const [notification, setNotification] = React.useState(null);

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      return true;
    } catch {
      return false;
    }
  };

  const loadTokens = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await tokensApi.getTokens();
      setTokens(data || []);
    } catch (err) {
      showNotify(err.message || 'Error loading API tokens', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlaylists = React.useCallback(async () => {
    try {
      const data = await playlistsApi.getPlaylists();
      setPlaylists(data || []);
    } catch (err) {
      console.error('Failed loading playlists:', err);
    }
  }, []);

  React.useEffect(() => {
    loadTokens();
    loadPlaylists();
  }, [loadTokens, loadPlaylists]);

  // Statistics calculation
  const stats = React.useMemo(() => {
    const total = tokens.length;
    const now = new Date();
    const active = tokens.filter((t) => t.is_active && (!t.expires_at || new Date(t.expires_at) > now)).length;
    const restricted = tokens.filter(
      (t) =>
        (t.allowed_ips && t.allowed_ips.trim().length > 0) ||
        (t.allowed_playlist_ids && t.allowed_playlist_ids.length > 0) ||
        t.has_password
    ).length;
    const inactiveOrExpired = tokens.filter(
      (t) => !t.is_active || (t.expires_at && new Date(t.expires_at) <= now)
    ).length;
    return { total, active, restricted, inactiveOrExpired };
  }, [tokens]);

  // Filtering and Sorting
  const filteredAndSortedTokens = React.useMemo(() => {
    const now = new Date();
    let result = [...tokens];

    // Status filter
    if (statusFilter === 'active') {
      result = result.filter((t) => t.is_active && (!t.expires_at || new Date(t.expires_at) > now));
    } else if (statusFilter === 'disabled') {
      result = result.filter((t) => !t.is_active);
    } else if (statusFilter === 'expired') {
      result = result.filter((t) => t.expires_at && new Date(t.expires_at) <= now);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.token_prefix || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'created_asc') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === 'last_used') {
        const timeA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const timeB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'expires_soonest') {
        if (!a.expires_at && !b.expires_at) return 0;
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at) - new Date(b.expires_at);
      }
      // default: created_desc
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

    return result;
  }, [tokens, searchTerm, statusFilter, sortBy]);

  // Handlers
  const handleOpenCreateModal = () => {
    setFormName('');
    setFormPassword('');
    setShowFormPassword(false);
    setFormAllowedIPs('');
    setFormAllowedPlaylists([]);
    setFormExpiryDays('0');
    setFormPlaylistSearch('');
    setFormError('');
    setCreateModalOpen(true);
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Token name or description is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        expires_in_days: parseInt(formExpiryDays, 10) || 0,
      };
      if (formPassword.trim()) {
        payload.password = formPassword.trim();
      }
      if (formAllowedIPs.trim()) {
        payload.allowed_ips = formAllowedIPs.trim();
      }
      if (formAllowedPlaylists.length > 0) {
        payload.allowed_playlist_ids = formAllowedPlaylists;
      }

      const res = await tokensApi.createToken(payload);
      setCreateModalOpen(false);
      setRevealTokenData({
        token: res.token,
        name: res.name || formName.trim(),
        has_password: !!res.has_password,
        password: formPassword.trim(),
        allowed_ips: res.allowed_ips || formAllowedIPs.trim(),
        allowed_playlist_ids: res.allowed_playlist_ids || formAllowedPlaylists,
        expires_at: res.expires_at,
      });
      loadTokens();
    } catch (err) {
      setFormError(err.message || 'Failed to create API token.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (tokenItem) => {
    setEditTarget(tokenItem);
    setEditName(tokenItem.name || '');
    setEditAllowedIPs(tokenItem.allowed_ips || '');
    setEditAllowedPlaylists(
      Array.isArray(tokenItem.allowed_playlist_ids) ? [...tokenItem.allowed_playlist_ids] : []
    );
    setEditPassword('');
    setEditRemovePassword(false);
    setShowEditPassword(false);
    setEditPlaylistSearch('');
    setEditError('');
    setEditModalOpen(true);
  };

  const handleUpdateToken = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editName.trim()) {
      setEditError('Token name or description is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: editName.trim(),
        allowed_ips: editAllowedIPs.trim(),
        allowed_playlist_ids: editAllowedPlaylists,
      };
      if (editRemovePassword) {
        payload.remove_password = true;
      } else if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      await tokensApi.updateToken(editTarget.id, payload);
      setEditModalOpen(false);
      showNotify(`Token "${editName.trim()}" updated successfully.`);
      loadTokens();
    } catch (err) {
      setEditError(err.message || 'Failed to update API token.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (tokenItem) => {
    try {
      const newStatus = !tokenItem.is_active;
      await tokensApi.toggleToken(tokenItem.id, newStatus);
      setTokens((prev) =>
        prev.map((t) => (t.id === tokenItem.id ? { ...t, is_active: newStatus } : t))
      );
      showNotify(`Token "${tokenItem.name}" ${newStatus ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      showNotify(err.message || 'Failed to toggle token status.', 'error');
    }
  };

  const handleDeleteToken = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await tokensApi.deleteToken(deleteTarget.id);
      showNotify(`Token "${deleteTarget.name}" permanently revoked.`);
      setDeleteTarget(null);
      setTokens((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (detailsTarget?.id === deleteTarget.id) {
        setDetailsTarget(null);
      }
    } catch (err) {
      showNotify(err.message || 'Failed to revoke token.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPrefix = async (tokenItem) => {
    const success = await copyToClipboard(tokenItem.token_prefix);
    if (success) {
      setCopiedPrefixId(tokenItem.id);
      setTimeout(() => setCopiedPrefixId(null), 1500);
    }
  };

  // Filtered playlist lists for modals
  const filteredFormPlaylists = React.useMemo(() => {
    if (!formPlaylistSearch.trim()) return playlists;
    const q = formPlaylistSearch.toLowerCase().trim();
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q)
    );
  }, [playlists, formPlaylistSearch]);

  const filteredEditPlaylists = React.useMemo(() => {
    if (!editPlaylistSearch.trim()) return playlists;
    const q = editPlaylistSearch.toLowerCase().trim();
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.id).includes(q)
    );
  }, [playlists, editPlaylistSearch]);

  // Code snippets generator for reveal modal
  const getCodeSnippet = () => {
    if (!revealTokenData) return '';
    const origin = window.location.origin;
    const token = revealTokenData.token;
    const pwd = revealTokenData.password;

    if (activeSnippetTab === 'curl') {
      return `curl -X GET "${origin}/api/playlists" \\\n  -H "X-API-Token: ${token}"${pwd ? ` \\\n  -H "X-Token-Password: ${pwd}"` : ''
        }`;
    }

    if (activeSnippetTab === 'js') {
      const headersObj = [`    'X-API-Token': '${token}'`];
      if (pwd) headersObj.push(`    'X-Token-Password': '${pwd}'`);
      return `const response = await fetch('${origin}/api/playlists', {\n  method: 'GET',\n  headers: {\n${headersObj.join(',\n')}\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
    }

    if (activeSnippetTab === 'python') {
      const headersPy = [`    "X-API-Token": "${token}"`];
      if (pwd) headersPy.push(`    "X-Token-Password": "${pwd}"`);
      return `import requests\n\nurl = "${origin}/api/playlists"\nheaders = {\n${headersPy.join(',\n')}\n}\n\nresponse = requests.get(url, headers=headers)\nprint(response.json())`;
    }

    return '';
  };

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all duration-300 ${notification.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            : 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Standardized Header Bar */}
        <PageHeader
          onBack={() => navigate(-1)}
          backTitle="Go back"
          icon={Key}
          color="blue"
          title="API Tokens & Integrations"
          description="Manage internal credentials to allow external services, automations, and custom scripts to interface securely with the platform."
          actions={
            <>
              <button
                type="button"
                onClick={loadTokens}
                disabled={loading}
                className="p-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 rounded-[0.375rem] transition shadow-argon-sm active:scale-95 disabled:opacity-50"
                title="Refresh tokens"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3970e1]' : ''}`} />
              </button>

              <a
                href="/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#525f7f] dark:text-slate-200 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 transition shadow-argon-sm"
              >
                <FileText className="w-3.5 h-3.5 text-[#3970e1]" />
                <span>OpenAPI Docs</span>
                <ExternalLink className="w-3 h-3 text-[#8898aa] dark:text-slate-400" />
              </a>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-[0.375rem] bg-[#3970e1] hover:bg-[#2c5ec2] text-white transition shadow-argon-btn active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Token</span>
              </button>
            </>
          }
        />

        {/* KPI Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                Total Tokens
              </div>
              <div className="text-2xl font-bold text-[#32325d] dark:text-white mt-1 font-mono">
                {stats.total}
              </div>
              <div className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                Generated credentials
              </div>
            </div>
            <div className="w-10 h-10 shrink-0 aspect-square rounded-lg bg-[#3970e1]/10 dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 flex items-center justify-center">
              <Key className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                Active Tokens
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                {stats.active}
              </div>
              <div className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                Ready for API calls
              </div>
            </div>
            <div className="w-10 h-10 shrink-0 aspect-square rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                Restricted Scope
              </div>
              <div className="text-2xl font-bold text-[#32325d] dark:text-white mt-1 font-mono">
                {stats.restricted}
              </div>
              <div className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                IP or playlist bounded
              </div>
            </div>
            <div className="w-10 h-10 shrink-0 aspect-square rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center">
              <Shield className="w-5 h-5 shrink-0" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                Inactive / Expired
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
                {stats.inactiveOrExpired}
              </div>
              <div className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                Disabled or past validity
              </div>
            </div>
            <div className="w-10 h-10 shrink-0 aspect-square rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 flex items-center justify-center">
              <Clock className="w-5 h-5 shrink-0" />
            </div>
          </div>
        </div>

        {/* Toolbar: Filter Pills, Search, and Sort */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Tokens', count: stats.total },
              { id: 'active', label: 'Active', count: stats.active },
              { id: 'disabled', label: 'Disabled', count: tokens.filter((t) => !t.is_active).length },
              {
                id: 'expired',
                label: 'Expired',
                count: tokens.filter((t) => t.expires_at && new Date(t.expires_at) <= new Date()).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[0.375rem] transition whitespace-nowrap ${statusFilter === tab.id
                  ? 'bg-[#3970e1] text-white shadow-argon-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${statusFilter === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Right Toolbar: Search & Sort */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tokens by name or prefix..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-200 placeholder-[#8898aa] dark:placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-2.5 pr-7 py-1.5 text-xs bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] focus:outline-none focus:border-[#3970e1] text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
              >
                <option value="created_desc">Newest Created</option>
                <option value="created_asc">Oldest Created</option>
                <option value="last_used">Recently Used</option>
                <option value="expires_soonest">Expires Soonest</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tokens Table Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f6f9fc] dark:bg-slate-800/80 border-b border-[#dee2e6] dark:border-slate-800 text-[12px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                  <th className="py-3.5 px-4 min-w-[240px]">Token & Prefix</th>
                  <th className="py-3.5 px-4 min-w-[170px]">Access Scope</th>
                  <th className="py-3.5 px-4 min-w-[140px]">Security</th>
                  <th className="py-3.5 px-4 min-w-[110px]">Status</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Last Used</th>
                  <th className="py-3.5 px-4 min-w-[130px]">Expires</th>
                  <th className="py-3.5 px-4 text-right min-w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-[#8898aa] dark:text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3970e1] mb-2" />
                      <span>Loading API tokens...</span>
                    </td>
                  </tr>
                ) : filteredAndSortedTokens.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-14 text-center text-[#8898aa] dark:text-slate-400">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-500 dark:text-slate-400">
                        <Key className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-[#32325d] dark:text-white">
                        {searchTerm || statusFilter !== 'all' ? 'No Matching Tokens Found' : 'No API Tokens Generated Yet'}
                      </p>
                      <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-1 max-w-sm mx-auto">
                        {searchTerm || statusFilter !== 'all'
                          ? 'Try modifying your search filter or clear active filters to see all tokens.'
                          : 'Generate an API token to integrate third-party applications, automated scripts, or monitoring systems.'}
                      </p>
                      {searchTerm || statusFilter !== 'all' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('all');
                          }}
                          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[0.375rem] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[0.375rem] bg-[#3970e1] hover:bg-[#2c5ec2] text-white transition shadow-argon-btn active:scale-[0.98]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Generate Your First Token</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedTokens.map((item) => {
                    const isExpired = item.expires_at && new Date(item.expires_at) <= new Date();
                    const ipCount = item.allowed_ips
                      ? item.allowed_ips.split(/[\s,;]+/).filter(Boolean).length
                      : 0;
                    const playlistCount = Array.isArray(item.allowed_playlist_ids)
                      ? item.allowed_playlist_ids.length
                      : 0;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* Token Name & Prefix */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/50 text-[#3970e1] dark:text-blue-400 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                              <Key className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setDetailsTarget(item)}
                                className="font-bold text-[#32325d] dark:text-white hover:text-[#3970e1] dark:hover:text-blue-400 transition text-left truncate block max-w-[200px] sm:max-w-xs"
                                title={item.name}
                              >
                                {item.name}
                              </button>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[12px] text-[#8898aa] dark:text-slate-400">
                                  {item.token_prefix || 'plt_live_...'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyPrefix(item)}
                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
                                  title="Copy token prefix"
                                >
                                  {copiedPrefixId === item.id ? (
                                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Access Scope (IPs & Playlists) */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            {/* Playlists Scope */}
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {playlistCount > 0 ? (
                                <span
                                  className="font-semibold text-slate-700 dark:text-slate-200 cursor-help"
                                  title={item.allowed_playlist_ids
                                    .map(
                                      (id) =>
                                        playlists.find((p) => String(p.id) === String(id))?.name || `#${id}`
                                    )
                                    .join(', ')}
                                >
                                  {playlistCount === 1
                                    ? playlists.find((p) => String(p.id) === String(item.allowed_playlist_ids[0]))?.name ||
                                    `Playlist #${item.allowed_playlist_ids[0]}`
                                    : `${playlistCount} Playlists`}
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">All playlists</span>
                              )}
                            </div>

                            {/* IP Whitelist Scope */}
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {ipCount > 0 ? (
                                <span
                                  className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-200 cursor-help truncate max-w-[140px]"
                                  title={item.allowed_ips}
                                >
                                  {ipCount === 1 ? item.allowed_ips.trim() : `${ipCount} IP subnets`}
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">Any IP</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Security Level */}
                        <td className="py-3.5 px-4">
                          {item.has_password ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[0.375rem] text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                              <Lock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              <span>Password Protected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[0.375rem] text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <Unlock className="w-3 h-3 text-slate-400" />
                              <span>Standard</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[0.375rem] text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>Expired</span>
                            </span>
                          ) : item.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[0.375rem] text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[0.375rem] text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Disabled</span>
                            </span>
                          )}
                        </td>

                        {/* Last Used */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span title={item.last_used_at ? new Date(item.last_used_at).toLocaleString() : ''}>
                              {formatRelativeTime(item.last_used_at)}
                            </span>
                          </div>
                        </td>

                        {/* Expires */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {item.expires_at ? (
                            <div
                              className={`flex items-center gap-1.5 ${isExpired ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
                                }`}
                            >
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(item.expires_at).toLocaleDateString()}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">Never</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailsTarget(item)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[0.375rem] transition"
                              title="View Token Details"
                            >
                              <Info className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 text-[#3970e1] hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-[0.375rem] transition"
                              title="Edit Token Scope"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleActive(item)}
                              className={`p-1.5 rounded-[0.375rem] transition ${item.is_active
                                ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                }`}
                              title={item.is_active ? 'Disable Token' : 'Enable Token'}
                            >
                              <Power className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[0.375rem] transition"
                              title="Revoke Token"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: Generate New Token                                    */}
      {/* ============================================================ */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        size="md"
      >
        <Modal.Header
          title="Generate API Token"
          subtitle="Create a secret key for external integrations and automated scripts"
          icon={<Key className="w-4 h-4" />}
          iconClassName="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-[#3970e1] dark:text-blue-400"
          onClose={() => setCreateModalOpen(false)}
        />

        <form onSubmit={handleCreateToken}>
          <Modal.Body className="space-y-4 text-xs">
            {formError && <Alert variant="error">{formError}</Alert>}

            {/* Token Name */}
            <div className="space-y-1">
              <label className="font-semibold text-[#525f7f] dark:text-slate-300">
                Token Name or Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. WHMCS Billing, Home Assistant, Backup Automation"
                className="w-full px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500"
              />
            </div>

            {/* Expiration Dropdown */}
            <div className="space-y-1">
              <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Token Expiration</span>
              </label>
              <select
                value={formExpiryDays}
                onChange={(e) => setFormExpiryDays(e.target.value)}
                className="w-full px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100"
              >
                <option value="0">Never expires (Permanent)</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year (365 days)</option>
              </select>
              <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
                {getExpirationPreview(formExpiryDays)}
              </p>
            </div>

            {/* Allowed Playlists Restriction */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#3970e1]" />
                  <span>Playlist Access Scope</span>
                </label>
                <span className="text-[12px] text-[#8898aa] dark:text-slate-400">
                  {formAllowedPlaylists.length === 0
                    ? 'All accessible playlists'
                    : `${formAllowedPlaylists.length} selected`}
                </span>
              </div>

              {playlists.length > 5 && (
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formPlaylistSearch}
                    onChange={(e) => setFormPlaylistSearch(e.target.value)}
                    placeholder="Filter playlists..."
                    className="w-full pl-7 pr-3 py-1 text-xs bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-md focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>
              )}

              <div className="max-h-36 overflow-y-auto p-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-1">
                {playlists.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-500 py-1 text-center italic text-[12px]">
                    No playlists found
                  </div>
                ) : (
                  filteredFormPlaylists.map((pl) => {
                    const checked = formAllowedPlaylists.includes(pl.id);
                    return (
                      <label
                        key={pl.id}
                        className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition select-none ${checked
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormAllowedPlaylists([...formAllowedPlaylists, pl.id]);
                            } else {
                              setFormAllowedPlaylists(formAllowedPlaylists.filter((id) => id !== pl.id));
                            }
                          }}
                          className="rounded text-[#3970e1] focus:ring-[#3970e1] w-3.5 h-3.5"
                        />
                        <span className="truncate flex-1 text-xs">{pl.name}</span>
                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          #{pl.id}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between text-[12px] text-[#8898aa] dark:text-slate-400">
                <span>Uncheck all to grant access across all authorized playlists.</span>
                {formAllowedPlaylists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormAllowedPlaylists([])}
                    className="text-[#3970e1] dark:text-blue-400 hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            {/* Allowed IPs Restriction */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#3970e1]" />
                  <span>IP Whitelist Restrictions (Optional)</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={formAllowedIPs}
                onChange={(e) => setFormAllowedIPs(e.target.value)}
                placeholder="e.g. 192.168.1.50, 10.0.0.0/24 (Leave blank for any IP)"
                className="w-full px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500 font-mono text-xs"
              />
              <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
                Comma-separated IPv4, IPv6 addresses or CIDR blocks. Leave blank to allow requests from any IP.
              </p>
            </div>

            {/* Optional Token Password */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Secondary Token Password (Optional)</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Leave empty for standard token"
                  className="w-full pl-3 pr-9 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword(!showFormPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
                If configured, client requests must pass this password in the{' '}
                <code className="font-mono text-[#3970e1] dark:text-blue-400">X-Token-Password</code> header.
              </p>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              icon={<Plus className="w-3.5 h-3.5" />}
              className="bg-[#3970e1] hover:bg-[#2c5ec2] active:bg-[#2552ab]"
            >
              Generate Token
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: Reveal Newly Created Plaintext Token                  */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(revealTokenData)}
        onClose={() => setRevealTokenData(null)}
        size="lg"
      >
        <Modal.Header
          title="API Token Generated"
          subtitle="Copy your secret key now. It will not be shown again."
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          iconClassName="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center"
          onClose={() => setRevealTokenData(null)}
        />

        <Modal.Body className="space-y-4 text-xs">
          {/* Security Alert */}
          <Alert variant="warning">
            <span className="font-bold">Important: </span>
            This secret key is hashed in the database and cannot be retrieved again after closing this window. Please save it in your password manager or secrets vault.
          </Alert>

          {/* Token Display & Copy */}
          {revealTokenData && (
            <>
              <div className="space-y-1.5">
                <label className="font-bold text-[#32325d] dark:text-white">API Secret Key</label>
                <div className="flex items-center gap-2 p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs">
                  <span className="truncate select-all flex-1 text-slate-800 dark:text-slate-100 font-bold">
                    {revealTokenData.token}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      const ok = await copyToClipboard(revealTokenData.token);
                      if (ok) {
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }
                    }}
                    icon={copiedToken ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    className="bg-[#3970e1] hover:bg-[#2c5ec2] active:bg-[#2552ab] shrink-0"
                  >
                    {copiedToken ? 'Copied!' : 'Copy Key'}
                  </Button>
                </div>
              </div>

              {/* Scope & Restrictions Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Secondary Password
                  </div>
                  <div className="font-medium mt-0.5">
                    {revealTokenData.has_password ? (
                      <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                        {revealTokenData.password || '(configured)'}
                      </span>
                    ) : (
                      'None'
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    IP Whitelist
                  </div>
                  <div className="font-medium mt-0.5 truncate" title={revealTokenData.allowed_ips || 'Any IP'}>
                    {revealTokenData.allowed_ips || 'Any IP permitted'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Playlists Scope
                  </div>
                  <div className="font-medium mt-0.5">
                    {revealTokenData.allowed_playlist_ids && revealTokenData.allowed_playlist_ids.length > 0
                      ? `${revealTokenData.allowed_playlist_ids.length} playlist(s)`
                      : 'All accessible playlists'}
                  </div>
                </div>
              </div>

              {/* Ready-to-Use Code Snippets */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-bold text-[#32325d] dark:text-white">Integration Example</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveSnippetTab('curl')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${activeSnippetTab === 'curl'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                      cURL
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSnippetTab('js')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${activeSnippetTab === 'js'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                      JavaScript
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSnippetTab('python')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${activeSnippetTab === 'python'
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                      Python
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const snippet = getCodeSnippet();
                        const ok = await copyToClipboard(snippet);
                        if (ok) {
                          setCopiedSnippet(true);
                          setTimeout(() => setCopiedSnippet(false), 2000);
                        }
                      }}
                      className="ml-2 text-[12px] font-semibold text-[#3970e1] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Snippet</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[12px] overflow-x-auto leading-relaxed border border-slate-800">
                  <code>{getCodeSnippet()}</code>
                </pre>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRevealTokenData(null)}
          >
            I have stored my key safely
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: Token Details Inspector                               */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(detailsTarget)}
        onClose={() => setDetailsTarget(null)}
        size="md"
      >
        <Modal.Header
          title={detailsTarget?.name || 'Token Details'}
          subtitle={detailsTarget?.token_prefix || 'plt_live_...'}
          icon={<Key className="w-4 h-4" />}
          iconClassName="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-[#3970e1] dark:text-blue-400"
          onClose={() => setDetailsTarget(null)}
        />

        <Modal.Body className="space-y-4 text-xs">
          {detailsTarget && (
            <>
              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Status
                  </div>
                  <div className="mt-1">
                    {detailsTarget.expires_at && new Date(detailsTarget.expires_at) <= new Date() ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
                        Expired
                      </span>
                    ) : detailsTarget.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Authentication
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-200 font-medium">
                    {detailsTarget.has_password ? 'Password Protected' : 'Standard Key'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Created At
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-200 font-medium">
                    {detailsTarget.created_at ? new Date(detailsTarget.created_at).toLocaleString() : '-'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Last Used
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-200 font-medium">
                    {detailsTarget.last_used_at ? new Date(detailsTarget.last_used_at).toLocaleString() : 'Never'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Expiration
                  </div>
                  <div className="mt-1 text-slate-700 dark:text-slate-200 font-medium">
                    {detailsTarget.expires_at ? new Date(detailsTarget.expires_at).toLocaleDateString() : 'Never expires'}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Token Prefix
                  </div>
                  <div className="mt-1 font-mono text-[12px] text-slate-700 dark:text-slate-200">
                    {detailsTarget.token_prefix}
                  </div>
                </div>
              </div>

              {/* IP Whitelist Details */}
              <div className="space-y-1">
                <div className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Allowed IP Addresses</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-[12px] text-slate-700 dark:text-slate-200">
                  {detailsTarget.allowed_ips ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailsTarget.allowed_ips.split(/[\s,;]+/).filter(Boolean).map((ip, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded">
                          {ip}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic font-sans text-xs">All IP addresses permitted (No whitelist)</span>
                  )}
                </div>
              </div>

              {/* Allowed Playlists Details */}
              <div className="space-y-1">
                <div className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Allowed Playlists Scope</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                  {detailsTarget.allowed_playlist_ids && detailsTarget.allowed_playlist_ids.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {detailsTarget.allowed_playlist_ids.map((id) => {
                        const pl = playlists.find((p) => String(p.id) === String(id));
                        return (
                          <span
                            key={id}
                            className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded flex items-center gap-1"
                          >
                            <span>{pl ? pl.name : `Playlist #${id}`}</span>
                            <span className="text-slate-400 font-mono text-[11px]">#{id}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">All accessible playlists permitted</span>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDetailsTarget(null)}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              const target = detailsTarget;
              setDetailsTarget(null);
              handleOpenEditModal(target);
            }}
            icon={<Edit2 className="w-3.5 h-3.5" />}
            className="bg-[#3970e1] hover:bg-[#2c5ec2]"
          >
            Edit Settings
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: Edit API Token                                        */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(editModalOpen && editTarget)}
        onClose={() => setEditModalOpen(false)}
        size="md"
      >
        <Modal.Header
          title="Edit Token Scope"
          subtitle={editTarget?.token_prefix || 'plt_live_...'}
          icon={<Edit2 className="w-4 h-4" />}
          iconClassName="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-[#3970e1] dark:text-blue-400"
          onClose={() => setEditModalOpen(false)}
        />

        <form onSubmit={handleUpdateToken}>
          <Modal.Body className="space-y-4 text-xs">
            {editError && <Alert variant="error">{editError}</Alert>}

            {/* Token Name */}
            <div className="space-y-1">
              <label className="font-semibold text-[#525f7f] dark:text-slate-300">
                Token Name or Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. WHMCS Billing Plugin"
                className="w-full px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500"
              />
            </div>

            {/* Password Configuration */}
            {editTarget && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Secondary Token Password</span>
                  </label>
                  <span className="text-[12px] text-[#8898aa] dark:text-slate-400">
                    {editTarget.has_password ? 'Currently protected' : 'No password set'}
                  </span>
                </div>

                {editTarget.has_password && (
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editRemovePassword}
                      onChange={(e) => {
                        setEditRemovePassword(e.target.checked);
                        if (e.target.checked) setEditPassword('');
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                    />
                    <span className="text-[12px] font-medium">Remove password protection</span>
                  </label>
                )}

                {!editRemovePassword && (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder={
                          editTarget.has_password
                            ? 'Leave blank to keep existing password'
                            : 'Enter a password to require X-Token-Password'
                        }
                        className="w-full pl-3 pr-9 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Allowed IPs Restriction */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#3970e1]" />
                  <span>Allowed IP Addresses</span>
                </label>
                <span className="text-[12px] text-[#8898aa] dark:text-slate-400">IP Whitelist</span>
              </div>
              <textarea
                rows={2}
                value={editAllowedIPs}
                onChange={(e) => setEditAllowedIPs(e.target.value)}
                placeholder="e.g. 192.168.1.50, 10.0.0.0/24 (Leave blank for any IP)"
                className="w-full px-3 py-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-[#adb5bd] dark:placeholder:text-slate-500 font-mono text-xs"
              />
              <p className="text-[12px] text-[#8898aa] dark:text-slate-400">
                Comma-separated IP addresses or CIDR subnets. Leave blank to allow requests from any IP.
              </p>
            </div>

            {/* Allowed Playlists Restriction */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#525f7f] dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#3970e1]" />
                  <span>Allowed Playlists Scope</span>
                </label>
                <span className="text-[12px] text-[#8898aa] dark:text-slate-400">
                  {editAllowedPlaylists.length === 0
                    ? 'All accessible playlists'
                    : `${editAllowedPlaylists.length} selected`}
                </span>
              </div>

              {playlists.length > 5 && (
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={editPlaylistSearch}
                    onChange={(e) => setEditPlaylistSearch(e.target.value)}
                    placeholder="Filter playlists..."
                    className="w-full pl-7 pr-3 py-1 text-xs bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-md focus:outline-none focus:border-[#3970e1] text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />
                </div>
              )}

              <div className="max-h-36 overflow-y-auto p-2 bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg space-y-1">
                {playlists.length === 0 ? (
                  <div className="text-slate-400 dark:text-slate-500 py-1 text-center italic text-[12px]">
                    No playlists found
                  </div>
                ) : (
                  filteredEditPlaylists.map((pl) => {
                    const checked = editAllowedPlaylists.includes(pl.id);
                    return (
                      <label
                        key={pl.id}
                        className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition select-none ${checked
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 font-semibold'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditAllowedPlaylists([...editAllowedPlaylists, pl.id]);
                            } else {
                              setEditAllowedPlaylists(editAllowedPlaylists.filter((id) => id !== pl.id));
                            }
                          }}
                          className="rounded text-[#3970e1] focus:ring-[#3970e1] w-3.5 h-3.5"
                        />
                        <span className="truncate flex-1 text-xs">{pl.name}</span>
                        <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          #{pl.id}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between text-[12px] text-[#8898aa] dark:text-slate-400">
                <span>Uncheck all to grant access across all authorized playlists.</span>
                {editAllowedPlaylists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditAllowedPlaylists([])}
                    className="text-[#3970e1] dark:text-blue-400 hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              icon={<Check className="w-3.5 h-3.5" />}
              className="bg-[#3970e1] hover:bg-[#2c5ec2] active:bg-[#2552ab]"
            >
              Save Changes
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL: Revoke Token Confirmation                             */}
      {/* ============================================================ */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!submitting) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteToken}
        loading={submitting}
        title="Revoke API Token"
        description={
          deleteTarget ? (
            <>
              Are you sure you want to permanently revoke the token{' '}
              <strong className="text-slate-700 dark:text-slate-200">"{deleteTarget.name}"</strong>? Any
              external client, script, or automation currently authenticating with this token will immediately
              receive <code className="font-mono text-rose-600 dark:text-rose-400">401 Unauthorized</code> responses.
            </>
          ) : null
        }
        confirmLabel="Revoke Token"
        variant="danger"
      />
    </>
  );
}
