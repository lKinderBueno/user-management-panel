import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

const RESERVED_USER_ROUTES = new Set([
  'new-user',
  'bulk-categories',
  'edit-providers',
  'edit-provider',
  'welcome-info',
  'import-editor',
  'import',
  'restore',
  'restore-users'
]);
import { 
  Users, 
  Trash2, 
  ArrowRightLeft, 
  Loader2, 
  AlertCircle, 
  Check,
  Layers,
  Download,
  RefreshCw,
  RotateCcw,
  Clock,
  Server,
  ChevronDown,
  Globe,
  Plus,
  Sliders,
  Sparkles,
  LayoutGrid,
  Columns2,
  CloudDownload,
  Database,
  FileSpreadsheet
} from 'lucide-react';
import { playlistApi, userApi, backupApi } from '../api/client';
import ManagedUserGrid from '../components/ManagedUserGrid';
import UserEditorPanel from '../components/UserEditorPanel';
import { getEffectiveUserPatterns, safeParsePatterns } from '../utils/patterns';
import { syncProviderData } from '../utils/providerSync';
import BulkUserEditorPanel from '../components/BulkUserEditorPanel';
import UserInfoModal from '../components/UserInfoModal';
import ChangeCredentialsModal from '../components/ChangeCredentialsModal';
import CustomizeM3uModal from '../components/CustomizeM3uModal';
import MoveUserModal from '../components/MoveUserModal';
import RestoreUsersModal from '../components/RestoreUsersModal';
import ImportFromEditorModal from '../components/ImportFromEditorModal';
import SyncStatusBadge from '../components/SyncStatusBadge';
import SyncLogsModal from '../components/SyncLogsModal';
import BulkPatternModal from '../components/BulkPatternModal';
import { ConfirmDialog } from '../components/ui';

export default function ResellerDashboard({ 
  currentPlaylist, 
  playlists = [], 
  onOpenWizard, 
  onExportCsv,
  onUserCountChange,
  onFilterStatsChange,
  admin,
  onRefreshPlaylists,
  search: propSearch,
  onSearchChange: propOnSearchChange,
  patternParam1: propPatternParam1,
  onPatternParam1Change: propOnPatternParam1Change,
  patternParam2: propPatternParam2,
  onPatternParam2Change: propOnPatternParam2Change,
  patternType: propPatternType,
  onPatternTypeChange: propOnPatternTypeChange,
  expiryPreset: propExpiryPreset,
  onExpiryPresetChange: propOnExpiryPresetChange,
  expiryBeforeDate: propExpiryBeforeDate,
  onExpiryBeforeDateChange: propOnExpiryBeforeDateChange,
  initialModal = null
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, userModal } = useParams();

  const isImportRoute = location.pathname.endsWith('/import-editor') || location.pathname.endsWith('/import') || initialModal === 'import-editor';
  const isRestoreRoute = location.pathname.endsWith('/restore') || location.pathname.endsWith('/restore-users') || initialModal === 'restore';

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const patternAction = params.get('patterns');
    if (patternAction && currentPlaylist?.id) {
      const action = ['rename', 'remove', 'add', 'custom_dns'].includes(patternAction) ? patternAction : 'rename';
      navigate(`/users/${currentPlaylist.id}/edit-providers?action=${action}`, { replace: true });
    }
  }, [location.search, currentPlaylist?.id, navigate]);

  // Data
  const [users, setUsers] = React.useState([]);
  const [categories, setCategories] = React.useState({ channels: [], vods: [], series: [] });
  const [loading, setLoading] = React.useState(true);

  // Active / Selected user for editing
  const [activeUser, setActiveUser] = React.useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // View mode: 'grid' (100% data grid + slide-over drawer) or 'split' (side-by-side)
  const [viewMode, setViewMode] = React.useState(
    () => localStorage.getItem('res-view-mode') || 'split'
  );
  const viewModeRef = React.useRef(viewMode);
  viewModeRef.current = viewMode;

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('res-view-mode', mode);
    if (mode === 'split') {
      if (!activeUser && users.length > 0 && selectedUserIds.length === 0) {
        setActiveUser(users[0]);
        setSelectedUserIds([users[0].id]);
      } else if (activeUser && selectedUserIds.length === 0) {
        setSelectedUserIds([activeUser.id]);
      } else if (!activeUser && selectedUserIds.length === 1) {
        const found = users.find((u) => String(u.id) === String(selectedUserIds[0]));
        if (found) setActiveUser(found);
      }
    }
  };

  // Filters state
  const [internalSearch, setInternalSearch] = React.useState('');
  const search = propSearch !== undefined ? propSearch : internalSearch;
  const setSearch = propOnSearchChange || setInternalSearch;

  const [internalPatternParam1, setInternalPatternParam1] = React.useState('');
  const patternParam1 = propPatternParam1 !== undefined ? propPatternParam1 : internalPatternParam1;
  const setPatternParam1 = propOnPatternParam1Change || setInternalPatternParam1;

  const [internalPatternParam2, setInternalPatternParam2] = React.useState('');
  const patternParam2 = propPatternParam2 !== undefined ? propPatternParam2 : internalPatternParam2;
  const setPatternParam2 = propOnPatternParam2Change || setInternalPatternParam2;

  const [internalPatternType, setInternalPatternType] = React.useState('');
  const patternType = propPatternType !== undefined ? propPatternType : internalPatternType;
  const setPatternType = propOnPatternTypeChange || setInternalPatternType;

  const [internalExpiryPreset, setInternalExpiryPreset] = React.useState('all');
  const expiryPreset = propExpiryPreset !== undefined ? propExpiryPreset : internalExpiryPreset;
  const setExpiryPreset = propOnExpiryPresetChange || setInternalExpiryPreset;

  const [internalExpiryBeforeDate, setInternalExpiryBeforeDate] = React.useState('');
  const expiryBeforeDate = propExpiryBeforeDate !== undefined ? propExpiryBeforeDate : internalExpiryBeforeDate;
  const setExpiryBeforeDate = propOnExpiryBeforeDateChange || setInternalExpiryBeforeDate;

  // Batch selection
  const [selectedUserIds, setSelectedUserIds] = React.useState([]);

  // Modals
  const [showInfoModal, setShowInfoModal] = React.useState(false);
  const [showCredsModal, setShowCredsModal] = React.useState(false);
  const [showM3uModal, setShowM3uModal] = React.useState(false);
  const [showMoveModal, setShowMoveModal] = React.useState(false);
  const [showRestoreModal, setShowRestoreModal] = React.useState(false);
  const [showImportEditorModal, setShowImportEditorModal] = React.useState(false);

  const isImportOpen = showImportEditorModal || isImportRoute;
  const isRestoreOpen = showRestoreModal || isRestoreRoute;

  const handleCloseImportModal = React.useCallback(() => {
    setShowImportEditorModal(false);
    if (location.pathname.endsWith('/import-editor') || location.pathname.endsWith('/import')) {
      navigate(`/users/${currentPlaylist?.id}`, { replace: true });
    }
  }, [location.pathname, currentPlaylist?.id, navigate]);

  const handleCloseRestoreModal = React.useCallback(() => {
    setShowRestoreModal(false);
    if (location.pathname.endsWith('/restore') || location.pathname.endsWith('/restore-users')) {
      navigate(`/users/${currentPlaylist?.id}`, { replace: true });
    }
  }, [location.pathname, currentPlaylist?.id, navigate]);

  // Dedicated Route Navigation for Managed User Modals
  const handleOpenInfoModal = React.useCallback((u) => {
    const target = u || activeUser;
    if (!target || !currentPlaylist?.id) return;
    setActiveUser(target);
    setShowInfoModal(true);
    setShowCredsModal(false);
    setShowM3uModal(false);
    navigate(`/users/${currentPlaylist.id}/${target.id}/info`);
  }, [activeUser, currentPlaylist?.id, navigate]);

  const handleOpenCredsModal = React.useCallback((u) => {
    const target = u || activeUser;
    if (!target || !currentPlaylist?.id) return;
    setActiveUser(target);
    setShowCredsModal(true);
    setShowInfoModal(false);
    setShowM3uModal(false);
    navigate(`/users/${currentPlaylist.id}/${target.id}/credentials`);
  }, [activeUser, currentPlaylist?.id, navigate]);

  const handleOpenM3uModal = React.useCallback((u) => {
    const target = u || activeUser;
    if (!target || !currentPlaylist?.id) return;
    setActiveUser(target);
    setShowM3uModal(true);
    setShowInfoModal(false);
    setShowCredsModal(false);
    navigate(`/users/${currentPlaylist.id}/${target.id}/m3u`);
  }, [activeUser, currentPlaylist?.id, navigate]);

  const handleOpenMoveModal = React.useCallback((u) => {
    const target = u || activeUser;
    if (!target || !currentPlaylist?.id) return;
    setActiveUser(target);
    setShowMoveModal(true);
    setShowInfoModal(false);
    setShowCredsModal(false);
    setShowM3uModal(false);
    navigate(`/users/${currentPlaylist.id}/${target.id}/move`);
  }, [activeUser, currentPlaylist?.id, navigate]);

  const handleCloseUserModal = React.useCallback(() => {
    setShowInfoModal(false);
    setShowCredsModal(false);
    setShowM3uModal(false);
    setShowMoveModal(false);
    if (userId && currentPlaylist?.id) {
      navigate(`/users/${currentPlaylist.id}`);
    }
  }, [userId, currentPlaylist?.id, navigate]);

  const handleCloseDrawer = React.useCallback(() => {
    setIsDrawerOpen(false);
    if (userId && !userModal && currentPlaylist?.id) {
      navigate(`/users/${currentPlaylist.id}`);
    }
  }, [userId, userModal, currentPlaylist?.id, navigate]);

  // Synchronize route parameters (/users/:listId/:userId/:userModal or /users/:listId/:userId) with modals and active user
  React.useEffect(() => {
    if (!userId || RESERVED_USER_ROUTES.has(userId)) {
      setShowInfoModal(false);
      setShowCredsModal(false);
      setShowM3uModal(false);
      setShowMoveModal(false);
      if (viewMode === 'grid') {
        setIsDrawerOpen(false);
      }
      return;
    }

    if (loading) return;

    const matched = users.find((u) => String(u.id) === String(userId));
    if (matched) {
      setActiveUser(matched);
      setSelectedUserIds([matched.id]);
      const modal = (userModal || '').toLowerCase();

      if (modal === 'info' || modal === 'links') {
        setShowInfoModal(true);
        setShowCredsModal(false);
        setShowM3uModal(false);
        setShowMoveModal(false);
      } else if (modal === 'credentials' || modal === 'creds') {
        setShowCredsModal(true);
        setShowInfoModal(false);
        setShowM3uModal(false);
        setShowMoveModal(false);
      } else if (modal === 'm3u') {
        setShowM3uModal(true);
        setShowInfoModal(false);
        setShowCredsModal(false);
        setShowMoveModal(false);
      } else if (modal === 'move') {
        setShowMoveModal(true);
        setShowInfoModal(false);
        setShowCredsModal(false);
        setShowM3uModal(false);
      } else if (!modal || modal === 'edit') {
        setShowInfoModal(false);
        setShowCredsModal(false);
        setShowM3uModal(false);
        setShowMoveModal(false);
        if (viewMode === 'grid') {
          setIsDrawerOpen(true);
        }
      } else {
        // Unknown modal action, fallback to user
        navigate(`/users/${currentPlaylist?.id}/${matched.id}`, { replace: true });
      }
    } else if (users.length > 0) {
      showNotify(`User #${userId} not found in this playlist`, 'error');
      navigate(`/users/${currentPlaylist?.id}`, { replace: true });
    }
  }, [userId, userModal, users, loading, currentPlaylist?.id, navigate, viewMode]);
  const [showSyncLogsModal, setShowSyncLogsModal] = React.useState(false);
  const [showPatternModal, setShowPatternModal] = React.useState(false);
  const [patternModalTab, setPatternModalTab] = React.useState('rename');
  const [patternMenuOpen, setPatternMenuOpen] = React.useState(false);
  const [dataMenuOpen, setDataMenuOpen] = React.useState(false);
  const [showDeletePlaylistModal, setShowDeletePlaylistModal] = React.useState(false);
  const [deletingPlaylist, setDeletingPlaylist] = React.useState(false);
  const [deletePlaylistError, setDeletePlaylistError] = React.useState('');
  const patternMenuRef = React.useRef(null);
  const dataMenuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (patternMenuRef.current && !patternMenuRef.current.contains(e.target)) {
        setPatternMenuOpen(false);
      }
      if (dataMenuRef.current && !dataMenuRef.current.contains(e.target)) {
        setDataMenuOpen(false);
      }
    };
    if (patternMenuOpen || dataMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [patternMenuOpen, dataMenuOpen]);

  const handleOpenPatternModal = (tab = 'rename') => {
    setPatternModalTab(tab);
    setShowPatternModal(true);
    setPatternMenuOpen(false);
  };

  // Save / Sync / Notification
  const [saving, setSaving] = React.useState(false);
  const [savingBulk, setSavingBulk] = React.useState(false);
  const [syncingUserId, setSyncingUserId] = React.useState(null);
  const [isSyncingPlaylist, setIsSyncingPlaylist] = React.useState(false);
  const [lastSyncTime, setLastSyncTime] = React.useState(currentPlaylist?.synced_at || null);
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [refreshingUsers, setRefreshingUsers] = React.useState(false);
  const [notification, setNotification] = React.useState(null);

  const showNotify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Fetch playlist sync time
  const fetchLatestSync = React.useCallback(async () => {
    if (!currentPlaylist?.id) return;
    try {
      const logs = await playlistApi.getSyncLogs(currentPlaylist.id);
      if (logs && logs.length > 0) {
        setLastSyncTime(logs[0].created_at);
      } else if (currentPlaylist?.synced_at) {
        setLastSyncTime(currentPlaylist.synced_at);
      } else {
        setLastSyncTime(null);
      }
    } catch {
      if (currentPlaylist?.synced_at) {
        setLastSyncTime(currentPlaylist.synced_at);
      }
    }
  }, [currentPlaylist?.id, currentPlaylist?.synced_at]);

  // Reset activeUser, selectedUserIds, and drawer when playlist changes
  React.useEffect(() => {
    setActiveUser(null);
    setSelectedUserIds([]);
    setIsDrawerOpen(false);
    window.scrollTo(0, 0);
  }, [currentPlaylist?.id]);

  const userIdRef = React.useRef(userId);
  userIdRef.current = userId;
  const userModalRef = React.useRef(userModal);
  userModalRef.current = userModal;

  // Fetch playlist users and categories
  const loadData = React.useCallback(async () => {
    if (!currentPlaylist?.id) return;
    setLoading(true);
    try {
      const [usersData, categoriesData] = await Promise.all([
        userApi.getUsers(currentPlaylist.id),
        playlistApi.getCategories(currentPlaylist.id),
      ]);
      const userList = usersData || [];
      setUsers(userList);
      setCategories(categoriesData || { channels: [], vods: [], series: [] });

      const currentUserId = userIdRef.current;
      const currentUserModal = userModalRef.current;

      let initialActive = null;
      if (currentUserId && !RESERVED_USER_ROUTES.has(currentUserId)) {
        initialActive = userList.find((u) => String(u.id) === String(currentUserId)) || null;
      }
      if (!initialActive && viewModeRef.current === 'split' && userList.length > 0) {
        initialActive = userList[0];
      }
      setActiveUser(initialActive);
      if (initialActive) {
        setSelectedUserIds([initialActive.id]);
        const modal = (currentUserModal || '').toLowerCase();
        if (modal === 'info' || modal === 'links') {
          setShowInfoModal(true);
        } else if (modal === 'credentials' || modal === 'creds') {
          setShowCredsModal(true);
        } else if (modal === 'm3u') {
          setShowM3uModal(true);
        } else if (modal === 'move') {
          setShowMoveModal(true);
        } else if (!modal || modal === 'edit') {
          if (viewModeRef.current === 'grid') {
            setIsDrawerOpen(true);
          }
        }
      } else {
        setSelectedUserIds([]);
      }

      onUserCountChange?.(userList.length);
      fetchLatestSync();
    } catch (err) {
      showNotify(err.message || 'Error loading dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPlaylist?.id, onUserCountChange, fetchLatestSync]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh users and connection statuses without reloading categories or full-screen loading flash
  const refreshUsers = React.useCallback(async () => {
    if (!currentPlaylist?.id || refreshingUsers) return;
    setRefreshingUsers(true);
    try {
      const usersData = await userApi.getUsers(currentPlaylist.id);
      const userList = usersData || [];
      setUsers(userList);
      if (activeUser) {
        const updatedActive = userList.find((u) => u.id === activeUser.id);
        if (updatedActive) {
          setActiveUser(updatedActive);
        }
      }
      onUserCountChange?.(userList.length);
      showNotify('User statuses and connection counts refreshed');
    } catch (err) {
      showNotify(err.message || 'Error refreshing users', 'error');
    } finally {
      setRefreshingUsers(false);
    }
  }, [currentPlaylist?.id, refreshingUsers, activeUser, onUserCountChange]);

  const formatRelativeSyncTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Trigger smart incremental sync for current playlist
  const handleSyncPlaylist = async () => {
    if (!currentPlaylist?.id) return;
    setIsSyncingPlaylist(true);
    try {
      await playlistApi.startSync(currentPlaylist.id, false);
      showNotify('Playlist synchronization started in background');
    } catch (err) {
      showNotify(err.message || 'Error starting playlist sync', 'error');
    } finally {
      setTimeout(() => setIsSyncingPlaylist(false), 2000);
    }
  };

  // Trigger backup for current playlist (Pure admin only)
  const handleBackupUsers = async () => {
    if (!currentPlaylist?.id) return;
    setIsBackingUp(true);
    try {
      await backupApi.downloadBackup(currentPlaylist.id);
      showNotify('Managed users backup downloaded successfully');
    } catch (err) {
      showNotify(err.message || 'Error downloading backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Compute available pattern types
  const availablePatternTypes = React.useMemo(() => {
    const set = new Set();
    users.forEach((u) => {
      const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
      const { patterns } = getEffectiveUserPatterns(u, pl);
      patterns.forEach((p) => {
        if (p.type) set.add(p.type);
      });
    });
    const cpPatterns = safeParsePatterns(currentPlaylist?.patterns);
    cpPatterns.forEach((p) => {
      if (p.type) set.add(p.type);
    });
    return Array.from(set);
  }, [users, playlists, currentPlaylist]);

  // Check if any filter is active
  const hasActiveFilters = Boolean(
    search || patternParam1 || patternParam2 || patternType || expiryPreset !== 'all' || expiryBeforeDate
  );

  const handleResetFilters = () => {
    setSearch('');
    setPatternParam1('');
    setPatternParam2('');
    setPatternType('');
    setExpiryPreset('all');
    setExpiryBeforeDate('');
  };

  // Filter users with combined search, pattern params, and expiry logic
  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const pl = (playlists && playlists.find((p) => String(p.id) === String(u.list_id))) || currentPlaylist;
      const { patterns } = getEffectiveUserPatterns(u, pl);

      // 1. Global Search (name, username, note, and pattern params/URL)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = u.name?.toLowerCase().includes(q);
        const userMatch = u.username?.toLowerCase().includes(q);
        const noteMatch = u.note?.toLowerCase().includes(q);
        const patternMatch = patterns.some((p) => 
          (p.param1 || '').toLowerCase().includes(q) ||
          (p.param2 || '').toLowerCase().includes(q) ||
          (p.cUrl || '').toLowerCase().includes(q) ||
          (p.url || '').toLowerCase().includes(q)
        );
        if (!nameMatch && !userMatch && !noteMatch && !patternMatch) return false;
      }

      // 2. Pattern Param 1 filter (provider username/key)
      if (patternParam1.trim()) {
        const p1 = patternParam1.toLowerCase().trim();
        const matches = patterns.some((p) => 
          (p.param1 || '').toLowerCase().includes(p1)
        );
        if (!matches) return false;
      }

      // 3. Pattern Param 2 filter (provider password/profile)
      if (patternParam2.trim()) {
        const p2 = patternParam2.toLowerCase().trim();
        const matches = patterns.some((p) => 
          (p.param2 || '').toLowerCase().includes(p2)
        );
        if (!matches) return false;
      }

      // 4. Pattern Provider Type
      if (patternType) {
        const matches = patterns.some((p) => 
          (p.type || '').toLowerCase() === patternType.toLowerCase()
        );
        if (!matches) return false;
      }

      // 5. Expiry & Online Presets
      const now = new Date();
      if (expiryPreset === 'online') {
        if (!u.is_online && (!u.active_connections || u.active_connections <= 0)) return false;
      } else if (expiryPreset === 'active') {
        if (u.expiry && new Date(u.expiry) < now) return false;
      } else if (expiryPreset === 'expired') {
        if (!u.expiry || new Date(u.expiry) >= now) return false;
      } else if (expiryPreset === 'expiring_7') {
        if (!u.expiry) return false;
        const d = new Date(u.expiry);
        const in7d = new Date();
        in7d.setDate(in7d.getDate() + 7);
        if (d < now || d > in7d) return false;
      } else if (expiryPreset === 'expiring_30') {
        if (!u.expiry) return false;
        const d = new Date(u.expiry);
        const in30d = new Date();
        in30d.setDate(in30d.getDate() + 30);
        if (d < now || d > in30d) return false;
      } else if (expiryPreset === 'unlimited') {
        if (u.expiry) return false;
      } else if (expiryPreset === 'custom' && expiryBeforeDate) {
        if (!u.expiry) return false;
        const targetDate = new Date(expiryBeforeDate + 'T23:59:59');
        if (new Date(u.expiry) > targetDate) return false;
      }

      return true;
    });
  }, [users, search, patternParam1, patternParam2, patternType, expiryPreset, expiryBeforeDate]);

  const onlineCount = React.useMemo(() => {
    return users.filter((u) => u.is_online || (u.active_connections && u.active_connections > 0)).length;
  }, [users]);

  React.useEffect(() => {
    onFilterStatsChange?.({ onlineCount, availablePatternTypes });
  }, [onlineCount, availablePatternTypes, onFilterStatsChange]);

  // Selection handlers
  const handleSelectAllVisible = (visibleList) => {
    if (!visibleList || visibleList.length === 0) {
      setSelectedUserIds([]);
      setActiveUser(null);
      return;
    }
    const currentSet = new Set(selectedUserIds.map(String));
    const allVisibleSelected = visibleList.every((u) => currentSet.has(String(u.id)));

    if (allVisibleSelected) {
      // Unselect only the visible ones
      const visibleSet = new Set(visibleList.map((u) => String(u.id)));
      setSelectedUserIds((prev) => {
        const next = prev.filter((id) => !visibleSet.has(String(id)));
        if (next.length === 1) {
          const single = users.find((u) => String(u.id) === String(next[0]));
          if (single) setActiveUser(single);
        } else if (next.length === 0) {
          setActiveUser(null);
        }
        return next;
      });
    } else {
      // Add all visible ones to selection
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        visibleList.forEach((u) => next.add(u.id));
        const nextArr = Array.from(next);
        if (nextArr.length === 1) {
          const single = users.find((u) => String(u.id) === String(nextArr[0]));
          if (single) setActiveUser(single);
        }
        return nextArr;
      });
    }
  };

  const handleToggleSelectId = (id, e, rangeIds) => {
    if (Array.isArray(rangeIds) && rangeIds.length > 0) {
      setSelectedUserIds((prev) => {
        const set = new Set(prev);
        rangeIds.forEach((rid) => set.add(rid));
        const next = Array.from(set);
        if (next.length === 1) {
          const single = users.find((u) => String(u.id) === String(next[0]));
          if (single) setActiveUser(single);
        }
        return next;
      });
      return;
    }
    setSelectedUserIds((prev) => {
      const next = prev.some((item) => String(item) === String(id))
        ? prev.filter((item) => String(item) !== String(id))
        : [...prev, id];
      if (next.length === 1) {
        const single = users.find((u) => String(u.id) === String(next[0]));
        if (single) setActiveUser(single);
      } else if (next.length === 0) {
        setActiveUser(null);
      }
      return next;
    });
  };

  const handleSelectUser = (user) => {
    setActiveUser({ ...user });
    if (user?.id != null) {
      setSelectedUserIds((prev) => (prev.length <= 1 ? [user.id] : prev));
    }
  };

  const handleSelectOnlyUser = (id) => {
    setSelectedUserIds([id]);
    const found = users.find((u) => String(u.id) === String(id));
    if (found) {
      setActiveUser({ ...found });
    }
  };

  const handleClearSelection = () => {
    setSelectedUserIds([]);
    setActiveUser(null);
  };

  const handleEditUser = (user) => {
    setActiveUser({ ...user });
    setSelectedUserIds([user.id]);
    if (viewMode === 'grid') {
      setIsDrawerOpen(true);
    }
    if (currentPlaylist?.id) {
      navigate(`/users/${currentPlaylist.id}/${user.id}`);
    }
  };

  // Save active user
  const handleSaveUser = async () => {
    if (!activeUser) return;
    setSaving(true);
    try {
      const updated = await userApi.updateUser(currentPlaylist.id, activeUser.id, activeUser);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setActiveUser(updated);
      showNotify('User settings saved successfully');
    } catch (err) {
      showNotify(err.message || 'Error saving user', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save bulk users with field-level opt-in
  const handleSaveBulkUsers = async (bulkChanges) => {
    const targetUsers = users.filter((u) => selectedUserIds.includes(u.id));
    if (targetUsers.length === 0) return;

    setSavingBulk(true);
    try {
      const updatedUsers = [];

      for (const u of targetUsers) {
        const updated = { ...u };

        if (bulkChanges.enableExpiry) {
          updated.expiry = bulkChanges.expiry;
        }
        if (bulkChanges.enableSyncExpiry) {
          updated.sync_expiry_date = bulkChanges.sync_expiry_date;
        }
        if (bulkChanges.enableMaxConnections) {
          updated.max_connections = bulkChanges.max_connections;
        }
        if (bulkChanges.enableNote) {
          if (bulkChanges.noteMode === 'append') {
            const existingNote = (u.note || '').trim();
            const newNote = (bulkChanges.note || '').trim();
            if (newNote) {
              updated.note = existingNote ? `${existingNote}\n${newNote}` : newNote;
            }
          } else {
            updated.note = (bulkChanges.note || '').trim();
          }
        }
        if (bulkChanges.enableStatus) {
          updated.is_suspended = bulkChanges.is_suspended;
          if (!bulkChanges.is_suspended) {
            updated.is_compromised = false;
            updated.compromised_reason = null;
          } else {
            updated.compromised_reason = bulkChanges.reason || 'Bulk manual suspension by admin';
          }
        }

        updatedUsers.push(updated);
      }

      const results = await Promise.all(
        updatedUsers.map((u) => userApi.updateUser(currentPlaylist.id, u.id, u))
      );

      const resultMap = new Map(results.map((r) => [r.id, r]));
      setUsers((prev) => prev.map((u) => resultMap.get(u.id) || u));

      if (activeUser && resultMap.has(activeUser.id)) {
        setActiveUser(resultMap.get(activeUser.id));
      }

      showNotify(`Successfully updated ${results.length} user(s)`);
      if (viewMode === 'grid') {
        setIsDrawerOpen(false);
      }
    } catch (err) {
      showNotify(err.message || 'Error updating users in bulk', 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  // 1-Click suspension toggle from grid row
  const handleToggleSuspension = async (u) => {
    const isSuspending = !u.is_suspended;
    const actionText = isSuspending ? 'suspend' : 'reactivate';
    if (!confirm(`Are you sure you want to ${actionText} account "${u.name}" (${u.username})?`)) return;

    try {
      const updatedData = {
        ...u,
        is_suspended: isSuspending,
        is_compromised: isSuspending ? u.is_compromised : false,
        compromised_reason: isSuspending ? (u.compromised_reason || 'Manual suspension by admin') : null
      };
      const res = await userApi.updateUser(currentPlaylist.id, u.id, updatedData);
      const finalUser = res || updatedData;
      setUsers((prev) => prev.map((x) => (x.id === u.id ? finalUser : x)));
      if (activeUser?.id === u.id) {
        setActiveUser(finalUser);
      }
      showNotify(`Account "${u.name}" ${isSuspending ? 'suspended' : 'reactivated'} successfully`);
    } catch (err) {
      showNotify(err.message || `Error attempting to ${actionText} user`, 'error');
    }
  };

  // Delete user(s)
  const handleDeleteUsers = async () => {
    const idsToDelete = selectedUserIds.length > 0 
      ? selectedUserIds 
      : (activeUser ? [activeUser.id] : []);

    if (idsToDelete.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${idsToDelete.length} user(s)?`)) return;

    try {
      await userApi.deleteUsers(currentPlaylist.id, idsToDelete);
      const remaining = users.filter((u) => !idsToDelete.includes(u.id));
      setUsers(remaining);
      const nextActive = viewMode === 'split' ? (remaining[0] || null) : null;
      setActiveUser(nextActive);
      setSelectedUserIds(nextActive && viewMode === 'split' ? [nextActive.id] : []);
      if (viewMode === 'grid') setIsDrawerOpen(false);
      onUserCountChange?.(remaining.length);
      showNotify(`${idsToDelete.length} user(s) deleted successfully`);
    } catch (err) {
      showNotify(err.message || 'Error deleting users', 'error');
    }
  };

  // Delete single user from row action
  const handleDeleteSingleUser = async (u) => {
    if (!confirm(`Are you sure you want to permanently delete "${u.name}" (${u.username})?`)) return;
    try {
      await userApi.deleteUsers(currentPlaylist.id, [u.id]);
      const remaining = users.filter((x) => x.id !== u.id);
      setUsers(remaining);
      setSelectedUserIds((prev) => prev.filter((id) => id !== u.id));
      if (activeUser?.id === u.id) {
        const nextActive = viewMode === 'split' ? (remaining[0] || null) : null;
        setActiveUser(nextActive);
        if (nextActive && viewMode === 'split') {
          setSelectedUserIds([nextActive.id]);
        }
        if (viewMode === 'grid') setIsDrawerOpen(false);
      }
      onUserCountChange?.(remaining.length);
      showNotify(`User "${u.name}" deleted successfully`);
    } catch (err) {
      showNotify(err.message || 'Error deleting user', 'error');
    }
  };

  // Force sync provider
  const handleForceSync = async (userToSync) => {
    const target = userToSync || activeUser;
    if (!target) return;
    setSyncingUserId(target.id);
    try {
      const res = await syncProviderData(target, currentPlaylist, { playlists });
      if (res && res.user) {
        setUsers((prev) => prev.map((u) => (u.id === target.id ? res.user : u)));
        if (activeUser && activeUser.id === target.id) {
          setActiveUser((prev) => (prev ? {
            ...prev,
            expiry: res.user.expiry,
            max_connections: res.user.max_connections,
            updatedAt: res.user.updatedAt,
          } : res.user));
        }
      }
      const expStr = res?.user?.expiry 
        ? new Date(res.user.expiry).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Updated';
      const sourceTag = res?.source === 'browser' ? ' (via browser)' : ' (via server)';
      showNotify(res?.message || `Provider sync completed for ${target.name} (expiry: ${expStr})${sourceTag}`);
    } catch (err) {
      showNotify(err.message || 'Sync error', 'error');
    } finally {
      setSyncingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-[#3970e1] animate-spin" />
        <span className="text-xs font-semibold text-[#8898aa]">Loading playlist data...</span>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification - Rendered outside page flow to avoid layout shift */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-argon-dropdown flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 border pointer-events-auto ${
          notification.type === 'error' 
            ? 'bg-[#feecee] border-[#f5365c]/30 text-[#f5365c]' 
            : 'bg-white border-[#2dce89]/30 text-[#2dce89]'
        }`}>
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-[#f5365c] flex-shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-[#2dce89] flex-shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-4 space-y-3.5">

      {/* Batch Actions & Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={refreshUsers}
            disabled={refreshingUsers || loading}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-[#3970e1] dark:text-blue-400 hover:text-[#285bc7] dark:hover:text-blue-300 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#eef2ff] dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 hover:border-[#3970e1]/30 dark:hover:border-blue-500/40 rounded-lg transition shadow-sm active:scale-95 disabled:opacity-50"
            title="Reload user accounts and live connection statuses from local database"
          >
            <RefreshCw className={`w-3 h-3 text-[#3970e1] dark:text-blue-400 ${refreshingUsers ? 'animate-spin' : ''}`} />
            <span>{refreshingUsers ? 'Refreshing...' : 'Refresh Users'}</span>
          </button>

          {/* View Mode Switcher: Full Data Grid vs Split Inspector */}
          <div className="flex items-center p-0.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg shadow-sm">
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 font-bold shadow-sm'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
              }`}
              title="Full width data grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewModeChange('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                viewMode === 'split'
                  ? 'bg-[#eef2ff] dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 font-bold shadow-sm'
                  : 'text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white'
              }`}
              title="Split view with quick editor side panel"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-[12px] font-semibold text-[#f5365c] dark:text-rose-400 hover:bg-[#feecee] dark:hover:bg-rose-950/50 px-2 py-1 rounded-md transition"
              title="Reset all active search and filter conditions"
            >
              <RotateCcw className="w-3 h-3 text-[#f5365c] dark:text-rose-400" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Action Buttons (Selection action buttons are rendered in top toolbar only in full Grid view; in Split view they are handled directly in the right-side Inspector panel) */}
        <div className="flex items-center gap-2">
          {viewMode === 'grid' && selectedUserIds.length > 0 && (
            <>
              {selectedUserIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#eef2ff] dark:bg-blue-950/60 hover:bg-[#dee7fc] dark:hover:bg-blue-900/60 text-[#3970e1] dark:text-blue-400 border border-[#3970e1]/30 dark:border-blue-700/40 rounded text-xs font-bold transition active:scale-[0.98] shadow-sm"
                  title="Bulk edit selected users"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Bulk Edit ({selectedUserIds.length})</span>
                </button>
              )}

              {playlists.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowMoveModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
                  title="Move selected users to another playlist"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Move ({selectedUserIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteUsers}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#feecee] dark:bg-rose-950/60 hover:bg-[#fdd8db] dark:hover:bg-rose-900/60 text-[#f5365c] dark:text-rose-400 border border-[#f5365c]/30 dark:border-rose-700/40 rounded text-xs font-semibold transition active:scale-[0.98]"
                title="Delete selected users"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete ({selectedUserIds.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => navigate(`/users/${currentPlaylist.id}/welcome-info`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
            title="Configure welcome information & channel banner"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Welcome Info</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(`/users/${currentPlaylist.id}/bulk-categories`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
            title="Bulk edit categories for users"
          >
            <Layers className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
            <span>Bulk Categories</span>
          </button>

          {/* Provider Menu Dropdown */}
          <div className="relative" ref={patternMenuRef}>
            <button
              type="button"
              onClick={() => setPatternMenuOpen(!patternMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#3970e1] dark:text-blue-400 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm"
              title="Bulk provider modifications (Rename URL, Remove provider, Add provider, Custom DNS)"
            >
              <Server className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
              <span>Edit Providers</span>
              <ChevronDown className="w-3 h-3 text-[#8898aa] dark:text-slate-400" />
            </button>

            {patternMenuOpen && (
              <div 
                className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-64 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg shadow-argon-dropdown dark:shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#32325d] dark:text-slate-100"
              >
                <div className="px-3.5 py-2 text-[12px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider border-b border-[#e9ecef] dark:border-slate-700 flex items-center justify-between">
                  <span>Provider Tools</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPatternMenuOpen(false);
                      navigate(`/users/${currentPlaylist.id}/edit-providers`);
                    }}
                    className="text-[13px] text-[#3970e1] dark:text-blue-400 hover:underline font-semibold"
                  >
                    Open Page
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPatternMenuOpen(false);
                    navigate(`/users/${currentPlaylist.id}/edit-providers?action=rename`);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                >
                  <Globe className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#32325d] dark:text-white">Rename / Replace URL</span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Replace DNS/URL across users</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPatternMenuOpen(false);
                    navigate(`/users/${currentPlaylist.id}/edit-providers?action=remove`);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#feecee] dark:hover:bg-rose-950/40 text-[#f5365c] dark:text-rose-400 transition group"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#f5365c] dark:text-rose-400 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#f5365c] dark:text-rose-400">Remove Provider</span>
                    <span className="text-[13px] text-[#f5365c]/70 dark:text-rose-400/70">Delete a provider from users</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPatternMenuOpen(false);
                    navigate(`/users/${currentPlaylist.id}/edit-providers?action=add`);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                >
                  <Plus className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#32325d] dark:text-white">Add New Provider</span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Add source provider to users</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPatternMenuOpen(false);
                    navigate(`/users/${currentPlaylist.id}/edit-providers?action=custom_dns`);
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                >
                  <Sliders className="w-3.5 h-3.5 text-[#fb6340] dark:text-amber-400 group-hover:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-[#32325d] dark:text-white">Set Custom DNS</span>
                    <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Configure custom stream DNS on providers</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Unified Playlist Sync & History Group */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold shadow-sm overflow-hidden divide-x divide-[#dee2e6] dark:divide-slate-700">
            {/* Sync Playlist Button */}
            <button
              type="button"
              onClick={handleSyncPlaylist}
              disabled={isSyncingPlaylist}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#2dce89] dark:text-emerald-400 hover:text-[#26af74] dark:hover:text-emerald-300 transition active:scale-[0.98] disabled:opacity-50"
              title="Sync playlist channels, VODs, series and EPG from PlaylistLabs (incremental)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400 ${isSyncingPlaylist ? 'animate-spin' : ''}`} />
              <span>{isSyncingPlaylist ? 'Syncing...' : 'Sync Playlist'}</span>
            </button>

            {/* Sync History & Logs */}
            <button
              type="button"
              onClick={() => setShowSyncLogsModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 hover:text-[#32325d] dark:hover:text-white transition active:scale-[0.98]"
              title={`View sync history logs (kept for 7 days) • Last synced: ${formatRelativeSyncTime(lastSyncTime)}`}
            >
              <Clock className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
              <span className="text-[13px] font-normal text-[#8898aa] dark:text-slate-400 hidden sm:inline">Last:</span>
              <span className="text-[13px] font-semibold text-[#32325d] dark:text-slate-200">{formatRelativeSyncTime(lastSyncTime)}</span>
              <span className="text-[12px] text-[#8898aa] dark:text-slate-300 bg-[#f6f9fc] dark:bg-slate-700 border border-[#dee2e6] dark:border-slate-600 px-1.5 py-0.5 rounded font-bold ml-0.5">
                Logs
              </span>
            </button>
          </div>

          {/* Backup & Import Menu (Pure Admin only) */}
          {admin?.role === 'admin' && (
            <div className="relative" ref={dataMenuRef}>
              <button
                type="button"
                onClick={() => setDataMenuOpen(!dataMenuOpen)}
                disabled={isBackingUp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold transition active:scale-[0.98] shadow-sm disabled:opacity-50"
                title="Data operations: Backup, Restore, and Re-import from PlaylistLabs"
              >
                {isBackingUp ? (
                  <Loader2 className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400" />
                )}
                <span>Backup & Import</span>
                <ChevronDown className="w-3 h-3 text-[#8898aa] dark:text-slate-400" />
              </button>

              {dataMenuOpen && (
                <div 
                  className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-lg shadow-argon-dropdown dark:shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-[#32325d] dark:text-slate-100"
                >
                  <div className="px-3.5 py-2 text-[12px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider border-b border-[#e9ecef] dark:border-slate-700">
                    <span>Data & Sync Tools</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDataMenuOpen(false);
                      if (currentPlaylist?.id) {
                        navigate(`/users/${currentPlaylist.id}/import-editor`);
                      } else {
                        setShowImportEditorModal(true);
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                  >
                    <CloudDownload className="w-3.5 h-3.5 text-[#3970e1] dark:text-blue-400 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#32325d] dark:text-white">Import from PlaylistLabs</span>
                      <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Fetch users & welcome info via API</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDataMenuOpen(false);
                      handleBackupUsers();
                    }}
                    disabled={isBackingUp}
                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group disabled:opacity-50"
                  >
                    {isBackingUp ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#2dce89] animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-[#2dce89] dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#32325d] dark:text-white">Backup Users (JSON)</span>
                      <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Download a local JSON backup file</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDataMenuOpen(false);
                      if (onExportCsv) {
                        onExportCsv();
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#11cdef] dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#32325d] dark:text-white">Export Users (CSV)</span>
                      <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Download users list as a spreadsheet</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDataMenuOpen(false);
                      if (currentPlaylist?.id) {
                        navigate(`/users/${currentPlaylist.id}/restore`);
                      } else {
                        setShowRestoreModal(true);
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs flex items-center gap-2.5 hover:bg-[#f6f9fc] dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 transition group"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#fb6340] dark:text-amber-400 group-hover:scale-110 transition-transform" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#32325d] dark:text-white">Restore Users</span>
                      <span className="text-[13px] text-[#8898aa] dark:text-slate-400">Restore users from a JSON backup</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orphaned / Out-of-scope Warning Banner */}
      {currentPlaylist?.is_orphaned && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-[0.375rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-argon-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Warning: This playlist is missing from PlaylistLabs or out of scope.
              </span>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
                This playlist was not returned by the PlaylistLabs server during synchronization. You can migrate users to another active playlist or permanently delete this playlist.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {users.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUserIds(users.map(u => u.id));
                  setShowMoveModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 rounded text-xs font-semibold transition active:scale-[0.98]"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span>Move All Users</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowDeletePlaylistModal(true);
                setDeletePlaylistError('');
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold shadow-argon-btn transition active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Playlist</span>
            </button>
          </div>
        </div>
      )}

      {/* View Mode Rendering: Grid vs Split View */}
      {viewMode === 'grid' ? (
        /* FULL WIDTH DATA GRID */
        <div>
          <ManagedUserGrid
            users={filteredUsers}
            currentPlaylist={currentPlaylist}
            playlists={playlists}
            selectedUserIds={selectedUserIds}
            onToggleSelectId={handleToggleSelectId}
            onSelectAllVisible={handleSelectAllVisible}
            activeUserId={activeUser?.id}
            onSelectUser={handleSelectUser}
            onSelectOnlyUser={handleSelectOnlyUser}
            onClearSelection={handleClearSelection}
            onEditUser={handleEditUser}
            onShowInfo={handleOpenInfoModal}
            onShowCreds={handleOpenCredsModal}
            onShowM3u={handleOpenM3uModal}
            onForceSync={handleForceSync}
            onDeleteUser={handleDeleteSingleUser}
            onToggleSuspension={handleToggleSuspension}
            syncingUserId={syncingUserId}
            compact={false}
          />

          {/* Slide-Over Inspector Sheet */}
          {isDrawerOpen && (
            selectedUserIds.length > 1 ? (
              <BulkUserEditorPanel
                selectedUsers={users.filter((u) => selectedUserIds.includes(u.id))}
                categories={categories}
                playlists={playlists}
                onSaveBulk={handleSaveBulkUsers}
                saving={savingBulk}
                onClearSelection={() => {
                  setSelectedUserIds([]);
                  setIsDrawerOpen(false);
                  setActiveUser(null);
                }}
                onDeselectUser={(id) => {
                  setSelectedUserIds((prev) => {
                    const next = prev.filter((x) => String(x) !== String(id));
                    if (next.length === 1) {
                      const single = users.find((u) => String(u.id) === String(next[0]));
                      if (single) setActiveUser(single);
                    } else if (next.length === 0) {
                      setActiveUser(null);
                      setIsDrawerOpen(false);
                    }
                    return next;
                  });
                }}
                onEditSingleUser={(u) => {
                  setSelectedUserIds([u.id]);
                  setActiveUser({ ...u });
                }}
                onDelete={handleDeleteUsers}
                onShowMove={() => setShowMoveModal(true)}
                onOpenBulkCategories={() => navigate(`/users/${currentPlaylist.id}/bulk-categories`)}
                onOpenBulkPatterns={() => handleOpenPatternModal('rename')}
                onClose={() => setIsDrawerOpen(false)}
                isDrawer={true}
              />
            ) : (
              activeUser && (
                <UserEditorPanel
                  user={activeUser}
                  onUserChange={setActiveUser}
                  categories={categories}
                  playlists={playlists}
                  currentPlaylist={currentPlaylist}
                  onSave={handleSaveUser}
                  saving={saving}
                  onShowInfo={() => handleOpenInfoModal(activeUser)}
                  onShowCreds={() => handleOpenCredsModal(activeUser)}
                  onShowM3u={() => handleOpenM3uModal(activeUser)}
                  onShowMove={() => handleOpenMoveModal(activeUser)}
                  onDelete={() => activeUser && handleDeleteSingleUser(activeUser)}
                  onForceSync={() => handleForceSync(activeUser)}
                  syncing={syncingUserId === activeUser.id}
                  onClose={handleCloseDrawer}
                  isDrawer={true}
                />
              )
            )
          )}
        </div>
      ) : (
        /* SPLIT MASTER-DETAIL VIEW - 0 horizontal scrollbar & wide editor */
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Left Column: Compact Master List */}
          <div className="w-full lg:w-[400px] xl:w-[450px] flex-shrink-0 space-y-3">
            <ManagedUserGrid
              users={filteredUsers}
              currentPlaylist={currentPlaylist}
              playlists={playlists}
              selectedUserIds={selectedUserIds}
              onToggleSelectId={handleToggleSelectId}
              onSelectAllVisible={handleSelectAllVisible}
              activeUserId={activeUser?.id}
              onSelectUser={(u) => {
                setActiveUser({ ...u });
                setSelectedUserIds((prev) => (prev.length <= 1 ? [u.id] : prev));
              }}
              onSelectOnlyUser={handleSelectOnlyUser}
              onClearSelection={handleClearSelection}
              onEditUser={(u) => {
                setActiveUser({ ...u });
                setSelectedUserIds([u.id]);
              }}
              compact={true}
              onToggleSuspension={handleToggleSuspension}
              syncingUserId={syncingUserId}
            />
          </div>

          {/* Right Column: Wide Inline Inspector Panel */}
          <div className="flex-1 min-w-0 w-full">
            {selectedUserIds.length > 1 ? (
              <BulkUserEditorPanel
                selectedUsers={users.filter((u) => selectedUserIds.includes(u.id))}
                categories={categories}
                playlists={playlists}
                onSaveBulk={handleSaveBulkUsers}
                saving={savingBulk}
                onClearSelection={() => {
                  setSelectedUserIds([]);
                  setActiveUser(null);
                }}
                onDeselectUser={(id) => {
                  setSelectedUserIds((prev) => {
                    const next = prev.filter((x) => String(x) !== String(id));
                    if (next.length === 1) {
                      const single = users.find((u) => String(u.id) === String(next[0]));
                      if (single) setActiveUser(single);
                    } else if (next.length === 0) {
                      setActiveUser(null);
                    }
                    return next;
                  });
                }}
                onEditSingleUser={(u) => {
                  setSelectedUserIds([u.id]);
                  setActiveUser({ ...u });
                }}
                onDelete={handleDeleteUsers}
                onShowMove={() => setShowMoveModal(true)}
                onOpenBulkCategories={() => navigate(`/users/${currentPlaylist.id}/bulk-categories`)}
                onOpenBulkPatterns={() => handleOpenPatternModal('rename')}
                isDrawer={false}
              />
            ) : (
              <UserEditorPanel
                user={activeUser}
                onUserChange={setActiveUser}
                categories={categories}
                playlists={playlists}
                currentPlaylist={currentPlaylist}
                onSave={handleSaveUser}
                saving={saving}
                onShowInfo={() => handleOpenInfoModal(activeUser)}
                onShowCreds={() => handleOpenCredsModal(activeUser)}
                onShowM3u={() => handleOpenM3uModal(activeUser)}
                onShowMove={() => handleOpenMoveModal(activeUser)}
                onDelete={() => activeUser && handleDeleteSingleUser(activeUser)}
                onForceSync={() => handleForceSync(activeUser)}
                syncing={syncingUserId === activeUser?.id}
                isDrawer={false}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating live sync progress badge */}
      <SyncStatusBadge
        onSyncCompleted={() => {
          loadData();
          onRefreshPlaylists?.();
          showNotify('Playlist synchronized with latest stream data');
        }}
      />
    </div>

    {/* Modal Dialogs */}
      {showInfoModal && activeUser && (
        <UserInfoModal
          user={activeUser}
          playlist={currentPlaylist}
          onClose={handleCloseUserModal}
          onCustomizeM3u={() => {
            setShowInfoModal(false);
            handleOpenM3uModal(activeUser);
          }}
          onCredentialsUpdated={(updatedUser) => {
            setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u)));
            setActiveUser((prev) => (prev?.id === updatedUser.id ? { ...prev, ...updatedUser } : prev));
            showNotify('Credentials updated successfully');
          }}
        />
      )}

      {showCredsModal && activeUser && (
        <ChangeCredentialsModal
          user={activeUser}
          playlistId={currentPlaylist.id}
          onClose={handleCloseUserModal}
          onSuccess={(updatedUser) => {
            setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
            setActiveUser(updatedUser);
            showNotify('Credentials updated successfully');
            handleCloseUserModal();
          }}
          onSaved={(updatedUser) => {
            setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
            setActiveUser(updatedUser);
            showNotify('Credentials updated successfully');
            handleCloseUserModal();
          }}
        />
      )}

      {showM3uModal && activeUser && (
        <CustomizeM3uModal
          user={activeUser}
          playlist={currentPlaylist}
          categories={categories}
          onClose={handleCloseUserModal}
          onSave={(newSettings) => {
            setActiveUser({ ...activeUser, user_settings: newSettings });
            handleCloseUserModal();
          }}
        />
      )}

      {showMoveModal && (
        <MoveUserModal
          playlists={playlists}
          currentPlaylist={currentPlaylist}
          currentPlaylistId={currentPlaylist?.id}
          selectedUsers={selectedUserIds.length > 0 
            ? users.filter((u) => selectedUserIds.includes(u.id)) 
            : (activeUser ? [activeUser] : [])}
          userCount={selectedUserIds.length > 0 ? selectedUserIds.length : (activeUser ? 1 : 0)}
          onClose={handleCloseUserModal}
          onConfirm={async (targetPlaylistId, patternMappings = []) => {
            const ids = selectedUserIds.length > 0 
              ? selectedUserIds 
              : (activeUser ? [activeUser.id] : []);

            if (!ids.length) {
              handleCloseUserModal();
              return;
            }

            try {
              await userApi.moveUsers(currentPlaylist.id, targetPlaylistId, ids, patternMappings);
              setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
              setSelectedUserIds([]);
              setActiveUser(null);
              if (viewMode === 'grid') setIsDrawerOpen(false);
              handleCloseUserModal();
              showNotify(ids.length === 1 ? 'User moved successfully' : `${ids.length} users moved successfully`);
              onRefreshPlaylists?.();
            } catch (err) {
              showNotify(err.message || 'Error moving users', 'error');
              throw err;
            }
          }}
        />
      )}

      {isRestoreOpen && (
        <RestoreUsersModal
          currentPlaylist={currentPlaylist}
          playlists={playlists}
          onClose={handleCloseRestoreModal}
          onSuccess={(result) => {
            loadData();
            onRefreshPlaylists?.();
            showNotify(`Users restored: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
            handleCloseRestoreModal();
          }}
        />
      )}

      {isImportOpen && (
        <ImportFromEditorModal
          currentPlaylist={currentPlaylist}
          playlists={playlists}
          onClose={handleCloseImportModal}
          onSuccess={(result) => {
            loadData();
            onRefreshPlaylists?.();
            showNotify(`Imported from PlaylistLabs: ${result.imported || 0} added, ${result.updated || 0} updated, ${result.skipped || 0} skipped`);
            handleCloseImportModal();
          }}
        />
      )}

      {/* Sync Logs Modal */}
      {showSyncLogsModal && (
        <SyncLogsModal
          playlist={currentPlaylist}
          onClose={() => setShowSyncLogsModal(false)}
          onSyncTriggered={() => {
            loadData();
            fetchLatestSync();
          }}
        />
      )}

      {/* Bulk Patterns Modal */}
      {showPatternModal && (
        <BulkPatternModal
          isOpen={showPatternModal}
          onClose={() => setShowPatternModal(false)}
          currentPlaylist={currentPlaylist}
          playlists={playlists}
          users={users}
          selectedUserIds={selectedUserIds}
          admin={admin}
          initialTab={patternModalTab}
          onSuccess={(res) => {
            loadData();
            onRefreshPlaylists?.();
            showNotify(res?.message || 'Provider modification completed successfully');
          }}
        />
      )}

      {/* Delete Playlist Confirmation Modal */}
      <ConfirmDialog
        isOpen={showDeletePlaylistModal}
        onClose={() => {
          if (!deletingPlaylist) {
            setShowDeletePlaylistModal(false);
            setDeletePlaylistError('');
          }
        }}
        onConfirm={async () => {
          setDeletingPlaylist(true);
          setDeletePlaylistError('');
          try {
            await playlistApi.deletePlaylist(currentPlaylist.id);
            setShowDeletePlaylistModal(false);
            onRefreshPlaylists?.();
            navigate('/playlists');
          } catch (err) {
            setDeletePlaylistError(err.message || 'Failed to delete playlist');
          } finally {
            setDeletingPlaylist(false);
          }
        }}
        loading={deletingPlaylist}
        title="Delete Playlist"
        description={
          currentPlaylist ? (
            <>
              Are you sure you want to permanently delete <strong className="text-[#32325d] dark:text-white">"{currentPlaylist.name}"</strong> (ID: {currentPlaylist.id})?
            </>
          ) : null
        }
        alertText={
          <div className="space-y-1">
            <p className="font-semibold">Warning: This action is permanent and cannot be undone.</p>
            <p className="text-[13px]">
              All channels, categories, VODs, series, and <strong className="font-bold">{users.length}</strong> managed user(s) will be permanently deleted from the database.
            </p>
          </div>
        }
        error={deletePlaylistError}
        confirmLabel="Yes, Delete Playlist"
        variant="danger"
      />
    </>
  );
}
