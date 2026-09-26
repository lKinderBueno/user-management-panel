import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Shield,
  Users,
  UserPlus,
  Key,
  Trash2,
  Pencil,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  CheckSquare,
  Square,
  UserCheck,
  GitBranch,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  ChevronDown
} from 'lucide-react';
import { teamApi, userApi, getAdmin } from '../api/client';
import { Modal, ConfirmDialog, Button, Alert, PageHeader, Switch } from '../components/ui';

export default function TeamManagement({ playlists = [], currentAdmin: propCurrentAdmin }) {
  const navigate = useNavigate();
  const currentAdmin = propCurrentAdmin || getAdmin() || {};
  const isSuperAdmin = currentAdmin?.role === 'admin';
  const canCreateAdmins = currentAdmin?.role === 'admin' && !!currentAdmin?.can_create_admins;
  const canCreateCollaborators = !!currentAdmin?.can_create_collaborators;
  const canCreateAny = canCreateAdmins || canCreateCollaborators;
  const canManageApiTokens = isSuperAdmin || !!currentAdmin?.can_manage_api_tokens;

  // Team data
  const [teamMembers, setTeamMembers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Modals state
  const [modalMode, setModalMode] = React.useState(null); // 'create' | 'edit' | null
  const [selectedMember, setSelectedMember] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  // Form state
  const [formUsername, setFormUsername] = React.useState('');
  const [formPassword, setFormPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [formRole, setFormRole] = React.useState('collaborator'); // 'admin' | 'collaborator'
  const [formManageAllPlaylists, setFormManageAllPlaylists] = React.useState(true);
  const [formAllowedPlaylistIds, setFormAllowedPlaylistIds] = React.useState([]);
  const [formCanSeeAllUsers, setFormCanSeeAllUsers] = React.useState(true);
  const [formCanCreateCollaborators, setFormCanCreateCollaborators] = React.useState(false);
  const [formCanCreateAdmins, setFormCanCreateAdmins] = React.useState(false);
  const [formCanManageApiTokens, setFormCanManageApiTokens] = React.useState(false);
  const [formSearchPlaylist, setFormSearchPlaylist] = React.useState('');

  // Processing & feedback state
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [notification, setNotification] = React.useState(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all'); // 'all' | 'admin' | 'collaborator'

  // Sorting
  const [sortColumn, setSortColumn] = React.useState('username'); // 'username' | 'role' | 'created_at'
  const [sortDirection, setSortDirection] = React.useState('asc'); // 'asc' | 'desc'

  // Popover state for playlist details
  const [activePopoverMemberId, setActivePopoverMemberId] = React.useState(null);
  const popoverRef = React.useRef(null);

  // Copy username state
  const [copiedMemberId, setCopiedMemberId] = React.useState(null);

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const loadTeamMembers = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await teamApi.getTeamMembers();
      setTeamMembers(data || []);
    } catch (err) {
      showNotify(err.message || 'Error loading team members', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTeamMembers();
  }, [loadTeamMembers]);

  // Dismiss playlist popover when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setActivePopoverMemberId(null);
      }
    };
    if (activePopoverMemberId !== null) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activePopoverMemberId]);

  // Available playlists for assignment based on caller scope
  const availablePlaylists = React.useMemo(() => {
    if (isSuperAdmin || currentAdmin?.manage_all_playlists) {
      return playlists;
    }
    const allowed = currentAdmin?.allowed_playlist_ids || [];
    const allowedSet = new Set(allowed.map(String));
    return playlists.filter((p) => allowedSet.has(String(p.id)));
  }, [playlists, isSuperAdmin, currentAdmin]);

  // Playlist map for fast lookup
  const playlistMap = React.useMemo(() => {
    const map = new Map();
    playlists.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [playlists]);

  const openCreateModal = () => {
    setFormUsername('');
    setFormPassword('');
    setShowPassword(false);
    setFormRole(canCreateAdmins ? 'admin' : 'collaborator');
    setFormManageAllPlaylists(canCreateAdmins);
    setFormAllowedPlaylistIds([]);
    setFormCanSeeAllUsers(true);
    setFormCanCreateCollaborators(canCreateCollaborators);
    setFormCanCreateAdmins(canCreateAdmins);
    setFormCanManageApiTokens(canManageApiTokens);
    setFormSearchPlaylist('');
    setFormError('');
    setSelectedMember(null);
    setModalMode('create');
  };

  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormUsername(member.username);
    setFormPassword('');
    setShowPassword(false);
    setFormRole(member.role || 'collaborator');
    setFormManageAllPlaylists(member.manage_all_playlists);
    setFormAllowedPlaylistIds(member.allowed_playlist_ids ? member.allowed_playlist_ids.map(String) : []);
    setFormCanSeeAllUsers(member.can_see_all_users);
    setFormCanCreateCollaborators(!!member.can_create_collaborators);
    setFormCanCreateAdmins(!!member.can_create_admins);
    setFormCanManageApiTokens(member.role === 'admin' ? true : !!member.can_manage_api_tokens);
    setFormSearchPlaylist('');
    setFormError('');
    setModalMode('edit');
  };

  const handleGeneratePassword = async () => {
    try {
      const res = await userApi.generateRandom('password');
      if (res?.value) {
        setFormPassword(res.value);
        setShowPassword(true);
      }
    } catch {
      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
      let pass = '';
      for (let i = 0; i < 12; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setFormPassword(pass);
      setShowPassword(true);
    }
  };

  const handleTogglePlaylist = (pid) => {
    const idStr = String(pid);
    setFormAllowedPlaylistIds((prev) =>
      prev.includes(idStr) ? prev.filter((id) => id !== idStr) : [...prev, idStr]
    );
  };

  const handleSelectAllPlaylists = () => {
    const allIds = availablePlaylists.map((p) => String(p.id));
    setFormAllowedPlaylistIds(allIds);
  };

  const handleDeselectAllPlaylists = () => {
    setFormAllowedPlaylistIds([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formUsername.trim()) {
      setFormError('Username is required.');
      return;
    }

    if (modalMode === 'create' && (!formPassword || formPassword.length < 6)) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (modalMode === 'edit' && formPassword && formPassword.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    if (formRole === 'collaborator' && !formManageAllPlaylists && formAllowedPlaylistIds.length === 0) {
      setFormError('Please select at least one playlist or grant access to all playlists.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: formUsername.trim(),
        role: formRole,
        manage_all_playlists: formRole === 'admin' ? true : formManageAllPlaylists,
        allowed_playlist_ids: formRole === 'admin' || formManageAllPlaylists ? [] : formAllowedPlaylistIds,
        can_see_all_users: formRole === 'admin' ? true : formCanSeeAllUsers,
        can_create_collaborators: formCanCreateCollaborators,
        can_create_admins: formRole === 'admin' ? formCanCreateAdmins : false,
        can_manage_api_tokens: formRole === 'admin' ? true : formCanManageApiTokens,
      };

      if (formPassword) {
        payload.password = formPassword;
      }

      if (modalMode === 'create') {
        await teamApi.createTeamMember(payload);
        showNotify(`Team member "${payload.username}" created successfully.`);
      } else {
        await teamApi.updateTeamMember(selectedMember.id, payload);
        showNotify(`Team member "${payload.username}" updated successfully.`);
      }

      setModalMode(null);
      loadTeamMembers();
    } catch (err) {
      setFormError(err.message || 'Error saving team member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await teamApi.deleteTeamMember(deleteTarget.id);
      showNotify(`Team member "${deleteTarget.username}" deleted successfully.`);
      setDeleteTarget(null);
      loadTeamMembers();
    } catch (err) {
      showNotify(err.message || 'Error deleting team member.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUsername = (username, id) => {
    navigator.clipboard?.writeText(username);
    setCopiedMemberId(id);
    setTimeout(() => setCopiedMemberId(null), 2000);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Counts for tabs
  const counts = React.useMemo(() => {
    const total = teamMembers.length;
    const admins = teamMembers.filter((m) => m.role === 'admin').length;
    const collabs = teamMembers.filter((m) => m.role !== 'admin').length;
    return { total, admins, collabs };
  }, [teamMembers]);

  // Filtered & Sorted members list
  const filteredAndSortedMembers = React.useMemo(() => {
    const filtered = teamMembers.filter((m) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.username.toLowerCase().includes(q) ||
        (m.created_by_username && m.created_by_username.toLowerCase().includes(q));
      const matchRole = roleFilter === 'all' ? true : m.role === roleFilter;
      return matchSearch && matchRole;
    });

    return filtered.sort((a, b) => {
      let result = 0;
      if (sortColumn === 'username') {
        result = a.username.localeCompare(b.username);
      } else if (sortColumn === 'role') {
        result = a.role.localeCompare(b.role);
      } else if (sortColumn === 'created_at') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        result = timeA - timeB;
      }
      return sortDirection === 'asc' ? result : -result;
    });
  }, [teamMembers, searchTerm, roleFilter, sortColumn, sortDirection]);

  // Formatted date helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-xs font-semibold animate-in fade-in slide-in-from-bottom-5 duration-200 pointer-events-auto ${notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-900 dark:text-emerald-200'
            }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header Bar */}
        <PageHeader
          onBack={() => navigate('/playlists')}
          backTitle="Back to Playlists"
          icon={ShieldCheck}
          color="green"
          title="Team Management"
          description="Manage administrators and collaborators, configure playlist permissions, and control team hierarchies."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadTeamMembers}
                disabled={loading}
                className="p-2 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 rounded-[0.375rem] transition shadow-argon-sm active:scale-95 disabled:opacity-50"
                title="Refresh team"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3970e1]' : ''}`} />
              </button>
              {canCreateAny && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreateModal}
                  icon={<UserPlus className="w-4 h-4" />}
                >
                  New Member
                </Button>
              )}
            </div>
          }
        />

        {/* Toolbar: Search, Role Filter Tabs, and Counts */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm">
          {/* Role Filter Tabs with embedded counts */}
          <div className="flex rounded-lg border border-[#dee2e6] dark:border-slate-700 bg-[#f8f9fe] dark:bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => setRoleFilter('all')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${roleFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-[#32325d] dark:text-white shadow-xs'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
                }`}
            >
              <span>All</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-slate-200/80 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {counts.total}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('admin')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${roleFilter === 'admin'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
                }`}
            >
              <span>Admins</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                {counts.admins}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter('collaborator')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${roleFilter === 'collaborator'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
                }`}
            >
              <span>Collaborators</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                {counts.collabs}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by username or creator..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#f8f9fe] dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3970e1] focus:bg-white dark:focus:bg-slate-800 transition text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] dark:placeholder:text-slate-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Data Table (md+) */}
        <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm overflow-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f6f9fc] dark:bg-slate-800/80 border-b border-[#dee2e6] dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('username')}
                    className="flex items-center gap-1 hover:text-[#32325d] dark:hover:text-white transition"
                  >
                    <span>Member</span>
                    {sortColumn === 'username' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#3970e1]" /> : <ArrowDown className="w-3 h-3 text-[#3970e1]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('role')}
                    className="flex items-center gap-1 hover:text-[#32325d] dark:hover:text-white transition"
                  >
                    <span>Role</span>
                    {sortColumn === 'role' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#3970e1]" /> : <ArrowDown className="w-3 h-3 text-[#3970e1]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">Playlists</th>
                <th className="py-3 px-4">Scope & Permissions</th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('created_at')}
                    className="flex items-center gap-1 hover:text-[#32325d] dark:hover:text-white transition"
                  >
                    <span>Created</span>
                    {sortColumn === 'created_at' ? (
                      sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#3970e1]" /> : <ArrowDown className="w-3 h-3 text-[#3970e1]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#8898aa] dark:text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3970e1] mb-2" />
                    <span>Loading team members...</span>
                  </td>
                </tr>
              ) : filteredAndSortedMembers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-[#8898aa] dark:text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-[#adb5bd] dark:text-slate-600 mb-2 opacity-50" />
                    <p className="font-semibold text-sm text-[#525f7f] dark:text-slate-300">No team members found</p>
                    <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'Click "New Member" to add staff.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedMembers.map((member) => {
                  const isSelf = member.id === currentAdmin?.id;
                  const isAdmin = member.role === 'admin';
                  const isPopoverOpen = activePopoverMemberId === member.id;
                  const allowedIds = member.allowed_playlist_ids || [];

                  return (
                    <tr key={member.id} className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/40 transition">
                      {/* Member Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none ${isAdmin
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                          >
                            {member.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#32325d] dark:text-white">
                                {member.username}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded">
                                  You
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopyUsername(member.username, member.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                title="Copy username"
                              >
                                {copiedMemberId === member.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] text-[#8898aa] dark:text-slate-400 mt-0.5">
                              {member.created_by_username ? (
                                <span>Created by {member.created_by_username}</span>
                              ) : (
                                <span className="italic">System Administrator</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            <Shield className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <UserCheck className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                            Collaborator
                          </span>
                        )}
                      </td>

                      {/* Playlists Scope with Interactive Popover */}
                      <td className="py-3 px-4 relative">
                        {isAdmin || member.manage_all_playlists ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                            All Playlists
                          </span>
                        ) : (
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() =>
                                setActivePopoverMemberId(isPopoverOpen ? null : member.id)
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                            >
                              <span>{allowedIds.length} Playlists</span>
                              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isPopoverOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Assigned Playlists Popover */}
                            {isPopoverOpen && (
                              <div
                                ref={popoverRef}
                                className="absolute left-0 top-full mt-1.5 z-40 w-64 p-3 bg-white dark:bg-slate-900 rounded-xl border border-[#dee2e6] dark:border-slate-700 shadow-argon-dropdown text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150"
                              >
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800 font-semibold text-[#32325d] dark:text-white text-[11px]">
                                  <span>Assigned Playlists ({allowedIds.length})</span>
                                  <button
                                    type="button"
                                    onClick={() => setActivePopoverMemberId(null)}
                                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                  {allowedIds.length === 0 ? (
                                    <p className="text-slate-400 italic py-2 text-center text-[11px]">
                                      No playlists assigned
                                    </p>
                                  ) : (
                                    allowedIds.map((pid) => {
                                      const p = playlistMap.get(String(pid));
                                      return (
                                        <div key={pid} className="py-1.5 flex items-center justify-between text-[11px]">
                                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate pr-2">
                                            {p ? p.name : `Playlist #${pid}`}
                                          </span>
                                          {p?.managed_users_count !== undefined && (
                                            <span className="text-slate-400 font-mono text-[10px] shrink-0">
                                              {p.managed_users_count} users
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Scope & Permissions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* User Visibility */}
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700"
                            title={
                              isAdmin || member.can_see_all_users
                                ? 'Can see and manage all users on assigned playlists'
                                : 'Restricted strictly to own created users'
                            }
                          >
                            {isAdmin || member.can_see_all_users ? 'All Users' : 'Own Users Only'}
                          </span>

                          {/* Invite Staff */}
                          {(member.can_create_collaborators || member.can_create_admins) && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-indigo-50/60 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/50"
                              title={
                                member.can_create_admins
                                  ? 'Allowed to invite admins & collaborators'
                                  : 'Allowed to invite subordinate collaborators'
                              }
                            >
                              Can Invite
                            </span>
                          )}

                          {/* API Tokens */}
                          {(isAdmin || member.can_manage_api_tokens) && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-emerald-50/60 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/50"
                              title="Allowed to generate API tokens & third-party integrations"
                            >
                              API Tokens
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-[#525f7f] dark:text-slate-400 font-mono text-[11px]">
                        {formatDate(member.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                            title="Edit Member"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(member)}
                            disabled={isSelf}
                            className={`p-1.5 rounded-md transition ${isSelf
                                ? 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                                : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                              }`}
                            title={isSelf ? 'Cannot delete your own account' : 'Delete Member'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Mobile Card List (< md) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#8898aa] dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-[#dee2e6] dark:border-slate-800">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#3970e1] mb-2" />
              <span>Loading team members...</span>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <div className="py-12 text-center text-[#8898aa] dark:text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-[#dee2e6] dark:border-slate-800 p-6">
              <Users className="w-8 h-8 mx-auto text-[#adb5bd] dark:text-slate-600 mb-2 opacity-50" />
              <p className="font-semibold text-sm text-[#525f7f] dark:text-slate-300">No team members found</p>
              <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Click "New Member" to add staff.'}
              </p>
            </div>
          ) : (
            filteredAndSortedMembers.map((member) => {
              const isSelf = member.id === currentAdmin?.id;
              const isAdmin = member.role === 'admin';
              const allowedIds = member.allowed_playlist_ids || [];

              return (
                <div
                  key={member.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#dee2e6] dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs select-none ${isAdmin
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                      >
                        {member.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[#32325d] dark:text-white flex items-center gap-1.5 text-sm">
                          <span>{member.username}</span>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                          {member.created_by_username ? `Created by ${member.created_by_username}` : 'System Root'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(member)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#3970e1] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                        title="Edit Member"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(member)}
                        disabled={isSelf}
                        className={`p-1.5 rounded-md transition ${isSelf
                            ? 'text-slate-300 dark:text-slate-700 opacity-40 cursor-not-allowed'
                            : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                          }`}
                        title={isSelf ? 'Cannot delete your own account' : 'Delete Member'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {isAdmin ? 'Admin' : 'Collaborator'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {isAdmin || member.manage_all_playlists ? 'All Playlists' : `${allowedIds.length} Playlists`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {isAdmin || member.can_see_all_users ? 'All Users' : 'Own Users Only'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#8898aa] dark:text-slate-500 font-mono">
                      {formatDate(member.created_at)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Create or Edit Member */}
      {modalMode && (
        <Modal
          isOpen={Boolean(modalMode)}
          onClose={() => setModalMode(null)}
          size="lg"
        >
          <Modal.Header
            icon={modalMode === 'create' ? <UserPlus className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
            title={modalMode === 'create' ? 'Create Team Member' : `Edit Member: ${selectedMember?.username}`}
            subtitle="Configure credentials, role, and scoping permissions."
            onClose={() => setModalMode(null)}
          />

          <form onSubmit={handleSubmit} className="flex flex-col">
            <Modal.Body className="space-y-4 text-xs">
              {formError && <Alert variant="error">{formError}</Alert>}

              {/* 1. Account Credentials */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                  Account Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#525f7f] dark:text-slate-300 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      disabled={modalMode === 'edit'}
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="e.g. john_doe"
                      className="w-full px-3 py-2 text-xs border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3970e1] disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-500 bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-[#525f7f] dark:text-slate-300">
                        {modalMode === 'create' ? 'Password' : 'New Password'}{' '}
                        {modalMode === 'create' && <span className="text-rose-500">*</span>}
                      </label>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-[11px] font-semibold text-[#3970e1] dark:text-blue-400 hover:underline"
                      >
                        Generate
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={modalMode === 'create' ? 'Min. 6 characters' : 'Leave blank to keep'}
                        className="w-full px-3 py-2 pr-8 text-xs border border-[#dee2e6] dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3970e1] bg-white dark:bg-slate-800 text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Role Selector */}
              {isSuperAdmin && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block font-semibold text-[#525f7f] dark:text-slate-300">Member Role</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setFormRole('collaborator')}
                      className={`relative py-2 px-3 rounded-md font-medium flex items-center justify-center gap-2 transition-all ${formRole === 'collaborator'
                          ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-500/30 ring-2 ring-emerald-500/20 dark:ring-emerald-400/30 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <UserCheck className={`w-4 h-4 ${formRole === 'collaborator' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                      <span>Collaborator</span>
                      {formRole === 'collaborator' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateAdmins}
                      onClick={() => {
                        if (canCreateAdmins) setFormRole('admin');
                      }}
                      className={`relative py-2 px-3 rounded-md font-medium flex items-center justify-center gap-2 transition-all ${!canCreateAdmins
                          ? 'opacity-40 cursor-not-allowed text-slate-400'
                          : formRole === 'admin'
                            ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm border border-indigo-500/30 ring-2 ring-indigo-500/20 dark:ring-indigo-400/30 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <Shield className={`w-4 h-4 ${formRole === 'admin' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                      <span>Administrator</span>
                      {formRole === 'admin' && (
                        <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Role-specific Permissions Matrix */}
              {formRole === 'admin' ? (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-indigo-800 dark:text-indigo-300 text-[11px] leading-relaxed">
                    Administrators have unrestricted access to playlists, users, and security settings.
                  </div>

                  <div className="space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#32325d] dark:text-white">Allow Creating Administrators</div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">Can create and manage other administrator accounts.</div>
                      </div>
                      <Switch
                        checked={formCanCreateAdmins}
                        onCheckedChange={setFormCanCreateAdmins}
                        aria-label="Allow creating administrators"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#32325d] dark:text-white">Allow Creating Collaborators</div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">Can create and manage collaborator accounts.</div>
                      </div>
                      <Switch
                        checked={formCanCreateCollaborators}
                        onCheckedChange={setFormCanCreateCollaborators}
                        aria-label="Allow creating collaborators"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                    Collaborator Permissions
                  </h4>

                  <div className="space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800">
                    {/* User Visibility Scope */}
                    <div className="pt-1 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#32325d] dark:text-white">All Users Visibility</div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                          {formCanSeeAllUsers
                            ? 'Can view all users across assigned playlists.'
                            : 'Strictly restricted to users created by this collaborator.'}
                        </div>
                      </div>
                      <Switch
                        checked={formCanSeeAllUsers}
                        onCheckedChange={setFormCanSeeAllUsers}
                        aria-label="Allow viewing all users"
                      />
                    </div>

                    {/* Sub-Collaborators */}
                    <div className="pt-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#32325d] dark:text-white">Allow Inviting Collaborators</div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                          Enables inviting and managing subordinate collaborators.
                        </div>
                      </div>
                      <Switch
                        checked={formCanCreateCollaborators}
                        onCheckedChange={setFormCanCreateCollaborators}
                        aria-label="Allow inviting collaborators"
                      />
                    </div>

                    {/* API Tokens */}
                    <div className="pt-2.5 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#32325d] dark:text-white">Allow API Tokens</div>
                        <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                          Enables generating internal API tokens for third-party tools.
                        </div>
                      </div>
                      <Switch
                        checked={formCanManageApiTokens}
                        disabled={!canManageApiTokens}
                        onCheckedChange={setFormCanManageApiTokens}
                        aria-label="Allow API tokens"
                      />
                    </div>

                    {/* All Playlists Access (superadmin only) */}
                    {isSuperAdmin && (
                      <div className="pt-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-[#32325d] dark:text-white">All Playlists Access</div>
                          <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                            Grants access to all current and future playlists.
                          </div>
                        </div>
                        <Switch
                          checked={formManageAllPlaylists}
                          onCheckedChange={setFormManageAllPlaylists}
                          aria-label="Allow all playlists"
                        />
                      </div>
                    )}
                  </div>

                  {/* Playlist Selection Checklist */}
                  {!formManageAllPlaylists && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#525f7f] dark:text-slate-300">
                          Assigned Playlists ({formAllowedPlaylistIds.length} of {availablePlaylists.length})
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#3970e1] dark:text-blue-400">
                          <button type="button" onClick={handleSelectAllPlaylists} className="hover:underline">
                            Select All
                          </button>
                          <span>•</span>
                          <button type="button" onClick={handleDeselectAllPlaylists} className="hover:underline">
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="border border-[#dee2e6] dark:border-slate-700 rounded-lg p-2 bg-[#f8f9fe]/50 dark:bg-slate-800/40 space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] dark:text-slate-500" />
                          <input
                            type="text"
                            value={formSearchPlaylist}
                            onChange={(e) => setFormSearchPlaylist(e.target.value)}
                            placeholder="Filter playlists..."
                            className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-md focus:outline-none text-[#32325d] dark:text-slate-100 placeholder-[#8898aa]"
                          />
                        </div>

                        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                          {availablePlaylists
                            .filter((p) => p.name.toLowerCase().includes(formSearchPlaylist.toLowerCase()))
                            .map((p) => {
                              const idStr = String(p.id);
                              const isChecked = formAllowedPlaylistIds.includes(idStr);
                              return (
                                <div
                                  key={idStr}
                                  onClick={() => handleTogglePlaylist(idStr)}
                                  className="py-1.5 px-2 hover:bg-white dark:hover:bg-slate-700/60 rounded cursor-pointer flex items-center justify-between text-xs transition select-none"
                                >
                                  <div className="flex items-center gap-2">
                                    {isChecked ? (
                                      <CheckSquare className="w-4 h-4 text-[#3970e1] dark:text-blue-400 shrink-0" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                                    )}
                                    <span className="font-medium text-[#32325d] dark:text-slate-100">{p.name}</span>
                                  </div>
                                  <span className="text-[11px] text-[#8898aa] dark:text-slate-400 font-mono">
                                    {p.managed_users_count || 0} users
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModalMode(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={submitting}
              >
                {modalMode === 'create' ? 'Create Member' : 'Save Changes'}
              </Button>
            </Modal.Footer>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!submitting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        loading={submitting}
        title="Delete Team Member"
        description={
          deleteTarget ? (
            <>
              Are you sure you want to delete member <span className="font-bold text-[#32325d] dark:text-white">"{deleteTarget.username}"</span>?
            </>
          ) : null
        }
        alertText="Managed users created by this member will remain intact. Any subordinate collaborators will be reassigned up the hierarchy."
        confirmLabel="Delete Member"
        variant="danger"
      />
    </>
  );
}
