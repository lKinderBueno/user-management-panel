import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Search,
  ArrowLeft,
  Clock,
  Activity,
  Eye,
  Server,
  Zap,
  Plus,
  X,
  Loader2,
  RotateCcw,
  Check,
  AlertCircle,
  Sliders,
  Play,
  Filter,
  Users,
  UserX,
  Copy,
  ExternalLink,
  ChevronRight,
  Info,
  MoreVertical,
} from 'lucide-react';
import { securityApi, settingsApi } from '../api/client';
import { Modal, Button, PageHeader, Drawer, Switch } from '../components/ui';
import {
  getAttemptTypeInfo,
  getSecurityReasonInfo,
  formatDisplayBlockedReason,
} from '../utils/securityReasons';

// Custom hook for debouncing input values
function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SecurityManagement() {
  const navigate = useNavigate();

  // Primary Data State
  const [stats, setStats] = React.useState(null);
  const [secSettings, setSecSettings] = React.useState(null);
  const [trackedIPs, setTrackedIPs] = React.useState([]);
  const [totalIPs, setTotalIPs] = React.useState(0);
  const [adminLogs, setAdminLogs] = React.useState([]);
  const [xtreamLogs, setXtreamLogs] = React.useState([]);
  const [apiLogs, setApiLogs] = React.useState([]);
  const [compromisedIncidents, setCompromisedIncidents] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Active Tab: 'ips' | 'compromised' | 'logs'
  const [activeTab, setActiveTab] = React.useState('ips');

  // Tracked IPs Tab Filters
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [isSearchingIPs, setIsSearchingIPs] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('all'); // 'all' | 'blocked' | 'active'
  const [page, setPage] = React.useState(1);
  const limit = 25;

  // Unified Logs Tab Filters & Segmented Controls
  const [logSearch, setLogSearch] = React.useState('');
  const debouncedLogSearch = useDebounce(logSearch, 300);
  const [logSourceFilter, setLogSourceFilter] = React.useState('all'); // 'all' | 'admin' | 'xtream' | 'api'
  const [logOutcomeFilter, setLogOutcomeFilter] = React.useState('all'); // 'all' | 'failed' | 'expired' | 'success'
  const [logEndpointFilter, setLogEndpointFilter] = React.useState('all'); // 'all' | 'api_token' | 'admin_login' | 'stream_auth' | 'xtream_auth' | 'stalker_auth' | 'short_url'

  const handleSelectSourceFilter = (newSource) => {
    setLogSourceFilter(newSource);
    if (newSource === 'admin' && logOutcomeFilter === 'expired') {
      setLogOutcomeFilter('all');
    } else if (newSource === 'xtream' && logOutcomeFilter === 'success') {
      setLogOutcomeFilter('all');
    } else if (newSource === 'api' && logOutcomeFilter === 'expired') {
      setLogOutcomeFilter('all');
    }
  };

  // Compromised Accounts Filters & Actions
  const [compromisedSearch, setCompromisedSearch] = React.useState('');
  const debouncedCompromisedSearch = useDebounce(compromisedSearch, 300);
  const [compromisedStatusFilter, setCompromisedStatusFilter] = React.useState('all'); // 'all' | 'suspended' | 'resolved'
  const [resolvingId, setResolvingId] = React.useState(null);
  const [unsuspendingUser, setUnsuspendingUser] = React.useState(null);

  // Modals & Drawers
  const [blockModalOpen, setBlockModalOpen] = React.useState(false);
  const [blockIPInput, setBlockIPInput] = React.useState('');
  const [blockReasonInput, setBlockReasonInput] = React.useState('');
  const [blockDurationInput, setBlockDurationInput] = React.useState(24);
  const [submittingBlock, setSubmittingBlock] = React.useState(false);

  const [settingsModalOpen, setSettingsModalOpen] = React.useState(false);
  const [settingsForm, setSettingsForm] = React.useState({
    antibruteforce_enabled: true,
    antibruteforce_ban_hours: 24,
    antibruteforce_max_attempts: 5,
    antibruteforce_window_minutes: 15,
    security_log_retention_days: 7,
    multi_ip_detection_enabled: true,
    multi_ip_max_subnets: 10,
    multi_ip_window_hours: 2,
    multi_ip_auto_suspend: true,
  });
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [flushingLogs, setFlushingLogs] = React.useState(false);

  // Inspector & Context Menu State
  const [selectedLog, setSelectedLog] = React.useState(null);
  const [activeIPMenu, setActiveIPMenu] = React.useState(null); // { ip, isBlocked }
  const [copiedText, setCopiedText] = React.useState(null);

  // Notification Toast
  const [notification, setNotification] = React.useState(null);

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const copyToClipboard = (text, label = 'IP') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    notify(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Load tracked IPs with pagination and search
  const loadTrackedIPs = React.useCallback(async () => {
    setIsSearchingIPs(true);
    try {
      const ipsRes = await securityApi.getTrackedIPs({
        search: debouncedSearch.trim(),
        status: statusFilter,
        page,
        limit,
      });
      setTrackedIPs(ipsRes?.ips || []);
      setTotalIPs(ipsRes?.total || 0);
    } catch (err) {
      notify(err.message || 'Failed to search tracked IPs', 'error');
    } finally {
      setIsSearchingIPs(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  // Load all security datasets
  const loadData = React.useCallback(async (silent = false) => {
    try {
      const [statsRes, ipsRes, adminLogsRes, xtreamLogsRes, apiLogsRes, compromisedRes, settingsRes] = await Promise.all([
        securityApi.getStats(),
        securityApi.getTrackedIPs({
          search: debouncedSearch.trim(),
          status: statusFilter,
          page,
          limit,
        }),
        securityApi.getLogs({ limit: 150, type: 'admin' }),
        securityApi.getLogs({ limit: 150, type: 'xtream' }),
        securityApi.getLogs({ limit: 150, type: 'api' }),
        securityApi.getCompromisedUsers({ limit: 100 }).catch(() => ({ incidents: [] })),
        settingsApi.getSettings().catch(() => null),
      ]);

      setStats(statsRes);
      setTrackedIPs(ipsRes?.ips || []);
      setTotalIPs(ipsRes?.total || 0);
      setAdminLogs(adminLogsRes?.logs || []);
      setXtreamLogs(xtreamLogsRes?.logs || []);
      setApiLogs(apiLogsRes?.logs || []);
      setCompromisedIncidents(compromisedRes?.incidents || []);

      if (settingsRes?.settings) {
        setSecSettings(settingsRes.settings);
        setSettingsForm({
          antibruteforce_enabled: settingsRes.settings.antibruteforce_enabled !== undefined ? Boolean(settingsRes.settings.antibruteforce_enabled) : true,
          antibruteforce_ban_hours: settingsRes.settings.antibruteforce_ban_hours || 24,
          antibruteforce_max_attempts: settingsRes.settings.antibruteforce_max_attempts || 5,
          antibruteforce_window_minutes: settingsRes.settings.antibruteforce_window_minutes || 15,
          security_log_retention_days: settingsRes.settings.security_log_retention_days || 7,
          multi_ip_detection_enabled: settingsRes.settings.multi_ip_detection_enabled !== undefined ? Boolean(settingsRes.settings.multi_ip_detection_enabled) : true,
          multi_ip_max_subnets: settingsRes.settings.multi_ip_max_subnets || 10,
          multi_ip_window_hours: settingsRes.settings.multi_ip_window_hours || 2,
          multi_ip_auto_suspend: settingsRes.settings.multi_ip_auto_suspend !== undefined ? Boolean(settingsRes.settings.multi_ip_auto_suspend) : true,
        });
      }
    } catch (err) {
      if (!silent) notify(err.message || 'Failed to load security data', 'error');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  const loadDataRef = React.useRef(loadData);
  loadDataRef.current = loadData;

  React.useEffect(() => {
    loadData();
    const timer = setInterval(() => {
      if (loadDataRef.current) {
        loadDataRef.current(true);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadTrackedIPs();
  }, [loadTrackedIPs]);

  // Actions
  const handleUnsuspendUser = async (username) => {
    if (!confirm(`Are you sure you want to reactivate access for line user "${username}"?`)) return;
    setUnsuspendingUser(username);
    try {
      await securityApi.unsuspendUser(username);
      notify(`User "${username}" access restored!`);
      loadData();
    } catch (err) {
      notify(err.message || `Failed to unsuspend user ${username}`, 'error');
    } finally {
      setUnsuspendingUser(null);
    }
  };

  const handleResolveIncident = async (id) => {
    setResolvingId(id);
    try {
      await securityApi.resolveCompromisedIncident(id);
      notify(`Incident #${id} resolved.`);
      loadData();
    } catch (err) {
      notify(err.message || `Failed to resolve incident #${id}`, 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleUnblock = async (ip) => {
    try {
      await securityApi.unblockIP(ip);
      notify(`IP ${ip} unblocked successfully.`);
      loadData();
    } catch (err) {
      notify(err.message || `Failed to unblock IP ${ip}`, 'error');
    }
  };

  const handleReset = async (ip) => {
    try {
      await securityApi.resetAttempts(ip);
      notify(`Failed attempts reset for ${ip}.`);
      loadData();
    } catch (err) {
      notify(err.message || 'Failed to reset attempts', 'error');
    }
  };

  const handleDelete = async (ip) => {
    if (!confirm(`Are you sure you want to delete tracking record for IP ${ip}?`)) return;
    try {
      await securityApi.deleteIP(ip);
      notify(`Record for ${ip} deleted.`);
      loadData();
    } catch (err) {
      notify(err.message || `Failed to delete IP ${ip}`, 'error');
    }
  };

  const handleManualBlockSubmit = async (e) => {
    e.preventDefault();
    const ip = blockIPInput.trim();
    if (!ip) {
      notify('Please enter a valid IP address', 'error');
      return;
    }

    setSubmittingBlock(true);
    try {
      await securityApi.blockIP({
        ip,
        reason: blockReasonInput.trim() || 'Manual administrator block',
        duration_hours: parseInt(blockDurationInput, 10) || 24,
      });
      notify(`IP ${ip} blocked successfully.`);
      setBlockModalOpen(false);
      setBlockIPInput('');
      setBlockReasonInput('');
      loadData();
    } catch (err) {
      notify(err.message || 'Failed to block IP', 'error');
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleSaveSecuritySettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload = {
        ...(secSettings || {}),
        antibruteforce_enabled: Boolean(settingsForm.antibruteforce_enabled),
        antibruteforce_ban_hours: Math.max(1, parseInt(settingsForm.antibruteforce_ban_hours, 10) || 24),
        antibruteforce_max_attempts: Math.max(1, parseInt(settingsForm.antibruteforce_max_attempts, 10) || 5),
        antibruteforce_window_minutes: Math.max(1, parseInt(settingsForm.antibruteforce_window_minutes, 10) || 15),
        security_log_retention_days: Math.max(1, parseInt(settingsForm.security_log_retention_days, 10) || 7),
        multi_ip_detection_enabled: Boolean(settingsForm.multi_ip_detection_enabled),
        multi_ip_max_subnets: Math.max(2, parseInt(settingsForm.multi_ip_max_subnets, 10) || 10),
        multi_ip_window_hours: Math.max(1, parseInt(settingsForm.multi_ip_window_hours, 10) || 2),
        multi_ip_auto_suspend: Boolean(settingsForm.multi_ip_auto_suspend),
      };
      const res = await settingsApi.updateSettings(payload);
      setSecSettings(res?.settings || payload);
      notify('Security configuration updated.');
      setSettingsModalOpen(false);
      loadData();
    } catch (err) {
      notify(err.message || 'Failed to update security settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFlushOldLogs = async () => {
    const days = secSettings?.security_log_retention_days || 7;
    if (!confirm(`Delete security logs older than ${days} days?`)) return;
    setFlushingLogs(true);
    try {
      const res = await securityApi.flushLogs(false, days);
      notify(`Deleted ${res.deleted_rows || 0} expired logs.`);
      loadData();
    } catch (err) {
      notify(err.message || 'Failed to flush logs', 'error');
    } finally {
      setFlushingLogs(false);
    }
  };

  const handleFlushAllLogs = async () => {
    if (!confirm('CAUTION: Are you sure you want to delete ALL security access logs?')) return;
    setFlushingLogs(true);
    try {
      const res = await securityApi.flushLogs(true);
      notify(`Purged ${res.deleted_rows || 0} access logs.`);
      loadData();
    } catch (err) {
      notify(err.message || 'Failed to purge logs', 'error');
    } finally {
      setFlushingLogs(false);
    }
  };

  // Quick action: Filter logs by IP
  const handleFilterLogsByIP = (ip) => {
    setLogSearch(ip);
    setActiveTab('logs');
    setActiveIPMenu(null);
  };

  // Quick action: Open block modal for IP
  const handleOpenBlockModalForIP = (ip, defaultReason = 'Suspicious traffic detected') => {
    setBlockIPInput(ip);
    setBlockReasonInput(defaultReason);
    setBlockDurationInput(24);
    setBlockModalOpen(true);
    setActiveIPMenu(null);
  };

  // Format Helpers
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const formatExpiry = (expiresAt, isBlocked) => {
    if (!isBlocked) return <span className="text-[#8898aa] text-xs">Clear</span>;
    if (!expiresAt) return <span className="text-[#f5365c] font-semibold text-xs">Permanent</span>;
    try {
      const exp = new Date(expiresAt);
      const now = new Date();
      if (exp <= now) return <span className="text-gray-400 text-xs">Expired</span>;
      const diffMs = exp.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return (
        <span className="text-[#f5365c] font-semibold text-xs font-mono">
          {diffHours > 0 ? `${diffHours}h ${diffMinutes}m left` : `${diffMinutes}m left`}
        </span>
      );
    } catch {
      return '-';
    }
  };

  // Unified Chronological Logs Dataset
  const unifiedLogs = React.useMemo(() => {
    let list = [];
    if (logSourceFilter === 'all') {
      list = [...adminLogs, ...xtreamLogs, ...apiLogs];
    } else if (logSourceFilter === 'admin') {
      list = [...adminLogs];
    } else if (logSourceFilter === 'api') {
      list = [...apiLogs];
    } else {
      list = [...xtreamLogs];
    }

    // Sort descending by created_at
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Filter
    return list.filter((log) => {
      const q = debouncedLogSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        (log.ip && log.ip.toLowerCase().includes(q)) ||
        (log.username && log.username.toLowerCase().includes(q)) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        (log.user_agent && log.user_agent.toLowerCase().includes(q));
      if (!matchesSearch) return false;

      // Endpoint sub-filter (for xtream / api / all)
      if (logEndpointFilter !== 'all' && log.attempt_type !== logEndpointFilter) return false;

      // Outcome sub-filter
      if (logOutcomeFilter === 'success' && !log.success) return false;
      if (logOutcomeFilter === 'expired') {
        const isExp = !log.success && log.reason && log.reason.toLowerCase().includes('expired');
        if (!isExp) return false;
      }
      if (logOutcomeFilter === 'failed') {
        if (log.success) return false;
        const isExp = log.reason && log.reason.toLowerCase().includes('expired');
        if (isExp) return false;
      }

      return true;
    });
  }, [adminLogs, xtreamLogs, apiLogs, logSourceFilter, debouncedLogSearch, logEndpointFilter, logOutcomeFilter]);

  // Filtered Compromised Incidents
  const filteredCompromisedIncidents = React.useMemo(() => {
    return compromisedIncidents.filter((inc) => {
      const q = debouncedCompromisedSearch.toLowerCase().trim();
      const subnetsStr = Array.isArray(inc.subnets_list) ? inc.subnets_list.join(' ') : (inc.subnets_json || '');
      const rawIPsStr = Array.isArray(inc.raw_ips) ? inc.raw_ips.join(' ') : '';
      const endpointStr = inc.trigger_endpoint || inc.endpoint || '';
      const isResolved = inc.status === 'resolved' || inc.is_resolved;

      const matchesSearch = !q ||
        (inc.username && inc.username.toLowerCase().includes(q)) ||
        endpointStr.toLowerCase().includes(q) ||
        (inc.user_agent && inc.user_agent.toLowerCase().includes(q)) ||
        subnetsStr.toLowerCase().includes(q) ||
        rawIPsStr.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (compromisedStatusFilter === 'suspended' && isResolved) return false;
      if (compromisedStatusFilter === 'resolved' && !isResolved) return false;
      return true;
    });
  }, [compromisedIncidents, debouncedCompromisedSearch, compromisedStatusFilter]);

  if (loading && !stats) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-[#3970e1] animate-spin" />
        <span className="text-xs text-[#8898aa]">Loading security console...</span>
      </div>
    );
  }

  const banHours = secSettings?.antibruteforce_ban_hours || 24;
  const maxAttempts = secSettings?.antibruteforce_max_attempts || 5;
  const isEngineActive = secSettings?.antibruteforce_enabled !== false;
  const blockedCount = stats?.total_blocked ?? 0;
  const compromisedCount = stats?.compromised_users_count ?? 0;
  const adminAttempts24h = stats?.admin_attempts_last_24h ?? 0;
  const xtreamAttempts24h = stats?.xtream_attempts_last_24h ?? 0;
  const totalAttempts24h = stats?.attempts_last_24h ?? (adminAttempts24h + xtreamAttempts24h);

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-[0.375rem] shadow-argon-dropdown flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-3 duration-200 border pointer-events-auto ${
            notification.type === 'error'
              ? 'bg-[#f5365c] text-white border-[#f5365c]'
              : 'bg-[#2dce89] text-white border-[#2dce89]'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 text-white shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header Bar */}
        <PageHeader
          onBack={() => navigate(-1)}
          backTitle="Go back"
          icon={ShieldAlert}
          color="red"
          title="Security Center"
          description="Real-time IP threat monitoring, brute-force mitigation, and compromised account detection."
          actions={
            <>
              <button
                type="button"
                onClick={loadData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold text-[#525f7f] dark:text-slate-300 shadow-argon-sm transition active:scale-[0.98]"
                title="Refresh datasets"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#8898aa]" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-semibold text-[#525f7f] dark:text-slate-300 shadow-argon-sm transition active:scale-[0.98]"
                title="Security settings and thresholds"
              >
                <Sliders className="w-3.5 h-3.5 text-[#525f7f] dark:text-slate-300" />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBlockIPInput('');
                  setBlockReasonInput('');
                  setBlockModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5365c] hover:bg-[#ec1b44] text-white rounded-[0.375rem] text-xs font-semibold shadow-argon-btn transition active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Block IP</span>
              </button>
            </>
          }
        />

        {/* Security Overview Bar (Replacing the 5 bento stat cards) */}
        <div className="bg-white dark:bg-slate-900 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 shadow-argon-sm divide-y md:divide-y-0 md:divide-x divide-[#dee2e6] dark:divide-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {/* Col 1: Engine Status */}
          <div className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
              Protection Engine
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${isEngineActive ? 'bg-[#2dce89]' : 'bg-[#f5365c]'}`} />
              <span className="text-sm font-bold text-[#32325d] dark:text-white">
                {isEngineActive ? 'Active' : 'Disabled'}
              </span>
            </div>
            <span className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-1 font-mono">
              Threshold: {maxAttempts} tries • {banHours}h ban
            </span>
          </div>

          {/* Col 2: Blocked IPs */}
          <div className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
              Active Blocked IPs
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-xl font-bold font-mono ${blockedCount > 0 ? 'text-[#f5365c]' : 'text-[#32325d] dark:text-slate-200'}`}>
                {blockedCount}
              </span>
              <span className="text-xs text-[#8898aa] dark:text-slate-400">banned</span>
            </div>
            <span className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-1">
              {totalIPs} IPs currently tracked
            </span>
          </div>

          {/* Col 3: Compromised Accounts */}
          <div className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
              Compromised Lines
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-xl font-bold font-mono ${compromisedCount > 0 ? 'text-[#fb6340]' : 'text-[#32325d] dark:text-slate-200'}`}>
                {compromisedCount}
              </span>
              <span className="text-xs text-[#8898aa] dark:text-slate-400">
                {compromisedCount === 1 ? 'account flagged' : 'accounts flagged'}
              </span>
            </div>
            <span className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-1">
              Multi-IP concurrent access
            </span>
          </div>

          {/* Col 4: Traffic Activity 24h */}
          <div className="p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
              24h Traffic Requests
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-[#32325d] dark:text-white">
                {totalAttempts24h}
              </span>
              <span className="text-xs text-[#8898aa] dark:text-slate-400">total checks</span>
            </div>
            <span className="text-[12px] text-[#8898aa] dark:text-slate-400 mt-1">
              {adminAttempts24h} Dashboard • {xtreamAttempts24h} API
            </span>
          </div>
        </div>

        {/* Unified Tab Bar */}
        <div className="flex items-center gap-1 border-b border-[#dee2e6] dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('ips')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'ips'
                ? 'border-[#3970e1] text-[#3970e1] dark:text-blue-400'
                : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Blocked & Tracked IPs</span>
            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300">
              {totalIPs}
            </span>
            {blockedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#fce8e6] dark:bg-rose-950/70 text-[#f5365c] dark:text-rose-300 font-mono font-bold">
                {blockedCount} banned
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compromised')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'compromised'
                ? 'border-[#f5365c] text-[#f5365c] dark:text-rose-400'
                : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Compromised Lines</span>
            {compromisedCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[11px] bg-[#feecee] dark:bg-rose-950/70 text-[#f5365c] dark:text-rose-300 font-mono font-bold">
                {compromisedCount}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-[#8898aa]">
                0
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 text-xs font-bold transition border-b-2 flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-[#3970e1] text-[#3970e1] dark:text-blue-400'
                : 'border-transparent text-[#8898aa] dark:text-slate-400 hover:text-[#525f7f] dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit & Access Logs</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* Tab 1: Blocked & Tracked IPs                              */}
        {/* ========================================================= */}
        {activeTab === 'ips' && (
          <div className="bg-white dark:bg-slate-900 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 shadow-argon-sm">
            {/* Toolbar */}
            <div className="p-3.5 border-b border-[#dee2e6] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fe] dark:bg-slate-800/70">
              {/* Search */}
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8898aa]" />
                <input
                  type="text"
                  placeholder="Filter by IP address or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] focus:outline-none focus:border-[#3970e1]"
                />
                {(isSearchingIPs || search !== debouncedSearch) && (
                  <Loader2 className="w-3.5 h-3.5 absolute right-7 top-1/2 -translate-y-1/2 text-[#3970e1] animate-spin" />
                )}
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#525f7f] p-0.5 transition"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Segmented Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    statusFilter === 'all'
                      ? 'bg-[#3970e1] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                  }`}
                >
                  All ({totalIPs})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('blocked');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    statusFilter === 'blocked'
                      ? 'bg-[#f5365c] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                  }`}
                >
                  Blocked Only ({blockedCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('active');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    statusFilter === 'active'
                      ? 'bg-[#3970e1] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                  }`}
                >
                  Under Observation
                </button>
              </div>
            </div>

            {/* High-density Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#525f7f] dark:text-slate-300 border-collapse">
                <thead className="bg-[#f6f9fc] dark:bg-slate-800/80 border-b border-[#e9ecef] dark:border-slate-800 text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Failed Attempts</th>
                    <th className="px-4 py-3">Block Reason</th>
                    <th className="px-4 py-3">Expires In</th>
                    <th className="px-4 py-3">Last Attempt</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
                  {trackedIPs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-[#8898aa] dark:text-slate-400">
                        No IP addresses matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    trackedIPs.map((row) => (
                      <tr key={row.id} className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/50 transition">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[#32325d] dark:text-white">
                              {row.ip}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(row.ip, 'IP')}
                              className="p-1 rounded text-[#8898aa] hover:text-[#3970e1] hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              title="Copy IP"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {row.is_blocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#feecee] dark:bg-rose-950/60 text-[#f5365c] dark:text-rose-300 border border-[#f5365c]/30">
                              <Lock className="w-2.5 h-2.5" />
                              Blocked (403)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300">
                              Watching
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.failed_attempts >= maxAttempts
                              ? 'bg-[#f5365c] text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-[#525f7f] dark:text-slate-300'
                          }`}>
                            {row.failed_attempts}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#525f7f] dark:text-slate-300 max-w-[280px] truncate" title={formatDisplayBlockedReason(row)}>
                          {formatDisplayBlockedReason(row)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {formatExpiry(row.expires_at, row.is_blocked)}
                        </td>
                        <td className="px-4 py-2.5 text-[#8898aa] dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                          {formatDate(row.last_attempt_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {row.is_blocked ? (
                              <button
                                type="button"
                                onClick={() => handleUnblock(row.ip)}
                                className="px-2.5 py-1 bg-[#2dce89] hover:bg-[#24a46d] text-white font-semibold rounded text-xs shadow-xs flex items-center gap-1 transition active:scale-95"
                                title="Immediately unblock"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Unblock</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenBlockModalForIP(row.ip)}
                                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[#f5365c] border border-rose-200 dark:border-rose-900/60 font-semibold rounded text-xs flex items-center gap-1 transition"
                                title="Manually ban this IP"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Block</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleFilterLogsByIP(row.ip)}
                              className="p-1.5 rounded text-[#8898aa] hover:text-[#3970e1] hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                              title="View access logs for this IP"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>

                            {row.failed_attempts > 0 && (
                              <button
                                type="button"
                                onClick={() => handleReset(row.ip)}
                                className="p-1.5 rounded text-[#8898aa] hover:text-[#525f7f] hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                title="Reset failed attempts count"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(row.ip)}
                              className="p-1.5 rounded text-[#8898aa] hover:text-[#f5365c] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                              title="Delete tracking record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalIPs > limit && (
              <div className="p-3 border-t border-[#dee2e6] dark:border-slate-800 flex items-center justify-between text-xs text-[#8898aa] dark:text-slate-400">
                <span>Showing {trackedIPs.length} of {totalIPs} IPs</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 border border-[#dee2e6] dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-bold text-[#525f7f] dark:text-slate-200">Page {page}</span>
                  <button
                    type="button"
                    disabled={page * limit >= totalIPs}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 border border-[#dee2e6] dark:border-slate-700 rounded bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 2: Compromised Accounts                               */}
        {/* ========================================================= */}
        {activeTab === 'compromised' && (
          <div className="bg-white dark:bg-slate-900 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 shadow-argon-sm">
            {/* Toolbar */}
            <div className="p-3.5 border-b border-[#dee2e6] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fe] dark:bg-slate-800/70">
              <div className="relative w-full max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8898aa]" />
                <input
                  type="text"
                  placeholder="Filter by username, endpoint or IP..."
                  value={compromisedSearch}
                  onChange={(e) => setCompromisedSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] focus:outline-none focus:border-[#3970e1]"
                />
                {compromisedSearch && (
                  <button
                    type="button"
                    onClick={() => setCompromisedSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#525f7f] p-0.5 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setCompromisedStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    compromisedStatusFilter === 'all'
                      ? 'bg-[#3970e1] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300'
                  }`}
                >
                  All ({compromisedIncidents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCompromisedStatusFilter('suspended')}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    compromisedStatusFilter === 'suspended'
                      ? 'bg-[#f5365c] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300'
                  }`}
                >
                  Suspended
                </button>
                <button
                  type="button"
                  onClick={() => setCompromisedStatusFilter('resolved')}
                  className={`px-2.5 py-1 rounded-[0.25rem] font-semibold transition ${
                    compromisedStatusFilter === 'resolved'
                      ? 'bg-[#2dce89] text-white shadow-xs'
                      : 'text-[#525f7f] dark:text-slate-300'
                  }`}
                >
                  Resolved
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#525f7f] dark:text-slate-300 border-collapse">
                <thead className="bg-[#f6f9fc] dark:bg-slate-800/80 border-b border-[#e9ecef] dark:border-slate-800 text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Incident</th>
                    <th className="px-4 py-3">Line User</th>
                    <th className="px-4 py-3">Detected Origin IPs</th>
                    <th className="px-4 py-3">Trigger Endpoint</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
                  {filteredCompromisedIncidents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-[#8898aa] dark:text-slate-400">
                        No compromised account incidents found.
                      </td>
                    </tr>
                  ) : (
                    filteredCompromisedIncidents.map((inc) => {
                      const displayIPs = (Array.isArray(inc.raw_ips) && inc.raw_ips.length > 0)
                        ? inc.raw_ips
                        : (Array.isArray(inc.subnets_list) && inc.subnets_list.length > 0
                            ? inc.subnets_list.map((s) => s.replace(/\/(24|64)$/, ''))
                            : []);
                      const ipCount = inc.subnets_count || displayIPs.length || 0;
                      const isResolved = inc.status === 'resolved' || inc.is_resolved;

                      return (
                        <tr key={inc.id} className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/50 transition">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-[#32325d] dark:text-white">
                              #{inc.id}
                            </span>
                            <div className="font-mono text-[11px] text-[#8898aa] dark:text-slate-400">
                              {formatDate(inc.detected_at)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-[#32325d] dark:text-white font-mono">
                              {inc.username}
                            </div>
                            <div className="text-[11px] text-[#8898aa] dark:text-slate-400">
                              User #{inc.user_id} • List #{inc.list_id}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1 max-w-[320px]">
                              <span className="text-xs font-bold font-mono text-[#f5365c]">
                                {ipCount} Concurrent IPs
                              </span>
                              {displayIPs.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {displayIPs.slice(0, 3).map((ip, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => copyToClipboard(ip, 'IP')}
                                      className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-[#32325d] dark:text-slate-200 hover:text-[#3970e1]"
                                      title="Click to copy"
                                    >
                                      {ip}
                                    </button>
                                  ))}
                                  {displayIPs.length > 3 && (
                                    <span className="px-1.5 py-0.5 rounded text-[11px] font-mono text-[#8898aa]" title={displayIPs.join(', ')}>
                                      +{displayIPs.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 max-w-[200px]">
                            <div className="font-mono text-xs text-[#32325d] dark:text-slate-200 truncate" title={inc.trigger_endpoint || inc.endpoint}>
                              {inc.trigger_endpoint || inc.endpoint || '-'}
                            </div>
                            <div className="text-[11px] text-[#8898aa] dark:text-slate-400 truncate" title={inc.user_agent}>
                              {inc.user_agent || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {isResolved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                                <Check className="w-3 h-3" />
                                Resolved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-[#f5365c] border border-rose-200 dark:border-rose-900/50">
                                <AlertCircle className="w-3 h-3" />
                                Suspended
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isResolved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleUnsuspendUser(inc.username)}
                                    disabled={unsuspendingUser === inc.username}
                                    className="px-2.5 py-1 bg-[#2dce89] hover:bg-[#26af74] text-white rounded text-xs font-semibold shadow-xs transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1"
                                    title="Reactivate line user"
                                  >
                                    {unsuspendingUser === inc.username ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                                    <span>Reactivate</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResolveIncident(inc.id)}
                                    disabled={resolvingId === inc.id}
                                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold shadow-xs transition active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-1"
                                    title="Mark resolved"
                                  >
                                    {resolvingId === inc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    <span>Resolve</span>
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-[#2dce89] font-semibold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Restored</span>
                                </span>
                              )}
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
        )}

        {/* ========================================================= */}
        {/* Tab 3: Unified Audit & Access Logs                        */}
        {/* ========================================================= */}
        {activeTab === 'logs' && (
          <div className="bg-white dark:bg-slate-900 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-800 shadow-argon-sm">
            {/* Top Toolbar: Source Segmented Control & Search */}
            <div className="p-3.5 border-b border-[#dee2e6] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fe] dark:bg-slate-800/70">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Source Segmented Control */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSelectSourceFilter('all')}
                    className={`px-3 py-1 rounded-[0.25rem] font-semibold transition ${
                      logSourceFilter === 'all'
                        ? 'bg-[#3970e1] text-white shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                    }`}
                  >
                    All Logs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSourceFilter('admin')}
                    className={`px-3 py-1 rounded-[0.25rem] font-semibold transition ${
                      logSourceFilter === 'admin'
                        ? 'bg-[#3970e1] text-white shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                    }`}
                  >
                    Dashboard Logins
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSourceFilter('xtream')}
                    className={`px-3 py-1 rounded-[0.25rem] font-semibold transition ${
                      logSourceFilter === 'xtream'
                        ? 'bg-[#3970e1] text-white shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                    }`}
                  >
                    Xtream & Streams
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSourceFilter('api')}
                    className={`px-3 py-1 rounded-[0.25rem] font-semibold transition ${
                      logSourceFilter === 'api'
                        ? 'bg-[#3970e1] text-white shadow-xs'
                        : 'text-[#525f7f] dark:text-slate-300 hover:text-[#32325d]'
                    }`}
                  >
                    API Tokens
                  </button>
                </div>

                {/* Outcome Quick Filter */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setLogOutcomeFilter('all')}
                    className={`px-2 py-1 rounded-[0.25rem] font-semibold transition ${
                      logOutcomeFilter === 'all' ? 'bg-slate-200 dark:bg-slate-700 text-[#32325d] dark:text-white' : 'text-[#8898aa]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogOutcomeFilter('failed')}
                    className={`px-2 py-1 rounded-[0.25rem] font-semibold transition ${
                      logOutcomeFilter === 'failed' ? 'bg-[#feecee] text-[#f5365c] dark:bg-rose-950/70' : 'text-[#8898aa]'
                    }`}
                  >
                    Failed
                  </button>
                  {logSourceFilter !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => setLogOutcomeFilter('expired')}
                      className={`px-2 py-1 rounded-[0.25rem] font-semibold transition ${
                        logOutcomeFilter === 'expired' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300' : 'text-[#8898aa]'
                      }`}
                    >
                      Expired
                    </button>
                  )}
                  {logSourceFilter !== 'xtream' && (
                    <button
                      type="button"
                      onClick={() => setLogOutcomeFilter('success')}
                      className={`px-2 py-1 rounded-[0.25rem] font-semibold transition ${
                        logOutcomeFilter === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300' : 'text-[#8898aa]'
                      }`}
                    >
                      Success
                    </button>
                  )}
                </div>

                {/* Channel Filter */}
                <select
                  value={logEndpointFilter}
                  onChange={(e) => setLogEndpointFilter(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs text-[#525f7f] dark:text-slate-300 focus:outline-none"
                >
                  <option value="all">All Channels</option>
                  <option value="api_token">REST API Token</option>
                  <option value="admin_login">Admin Portal Login</option>
                  <option value="stream_auth">Stream Line Auth</option>
                  <option value="xtream_auth">Xtream Codes API</option>
                  <option value="stalker_auth">Stalker Portal</option>
                  <option value="short_url">Short URLs</option>
                </select>
              </div>

              {/* Search Box */}
              <div className="relative w-full max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8898aa]" />
                <input
                  type="text"
                  placeholder="Filter by IP, username or UA..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] text-xs font-mono text-[#32325d] dark:text-slate-100 placeholder-[#8898aa] focus:outline-none focus:border-[#3970e1]"
                />
                {logSearch && (
                  <button
                    type="button"
                    onClick={() => setLogSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8898aa] hover:text-[#525f7f] p-0.5 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#525f7f] dark:text-slate-300 border-collapse">
                <thead className="bg-[#f6f9fc] dark:bg-slate-800/80 border-b border-[#e9ecef] dark:border-slate-800 text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Origin IP</th>
                    <th className="px-4 py-3">Channel / Type</th>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Reason / Details</th>
                    <th className="px-4 py-3">Player / Agent</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e9ecef] dark:divide-slate-800">
                  {unifiedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-[#8898aa] dark:text-slate-400">
                        No audit logs found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    unifiedLogs.map((log) => {
                      const isExpired = !log.success && log.reason && log.reason.toLowerCase().includes('expired');
                      const isFailed = !log.success && !isExpired;

                      return (
                        <tr
                          key={`${log.attempt_type}-${log.id}`}
                          className="hover:bg-[#f8f9fe] dark:hover:bg-slate-800/50 transition cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="px-4 py-2 font-mono text-[11px] text-[#8898aa] dark:text-slate-400 whitespace-nowrap">
                            {formatDate(log.created_at)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <span
                                className="font-mono font-bold text-xs text-[#32325d] dark:text-white hover:underline hover:text-[#3970e1]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFilterLogsByIP(log.ip);
                                }}
                                title="Click to filter logs by this IP"
                              >
                                {log.ip}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(log.ip, 'IP');
                                }}
                                className="p-0.5 rounded text-[#8898aa] hover:text-[#3970e1] transition"
                                title="Copy IP"
                              >
                                <Copy className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {(() => {
                              const typeInfo = getAttemptTypeInfo(log.attempt_type);
                              return (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium ${typeInfo.badgeClass}`}
                                  title={typeInfo.description}
                                >
                                  {typeInfo.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2 font-mono font-medium text-[#32325d] dark:text-slate-200 whitespace-nowrap">
                            {log.username || '-'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {log.success ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Success
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#f5365c] font-semibold text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#f5365c]" />
                                Denied (403)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-[#525f7f] dark:text-slate-300 max-w-[220px] truncate" title={getSecurityReasonInfo(log.reason).description || log.reason}>
                            <span className="font-medium">{getSecurityReasonInfo(log.reason).label}</span>
                          </td>
                          <td className="px-4 py-2 text-[#8898aa] dark:text-slate-400 max-w-[200px] truncate font-mono text-[11px]" title={log.user_agent}>
                            {log.user_agent || '-'}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="px-2 py-0.5 rounded text-xs text-[#3970e1] hover:bg-blue-50 dark:hover:bg-blue-950/50 font-semibold transition"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* Log Detail Drawer (Inspection)                            */}
      {/* ========================================================= */}
      <Drawer
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        size="md"
      >
        {selectedLog && (
          <div className="space-y-5 text-xs text-[#525f7f] dark:text-slate-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#dee2e6] dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3970e1]" />
                <h3 className="text-sm font-bold text-[#32325d] dark:text-white">
                  Audit Log Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded text-[#8898aa] hover:text-[#525f7f] dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Status Pill */}
            {(() => {
              const typeInfo = getAttemptTypeInfo(selectedLog.attempt_type);
              const reasonInfo = getSecurityReasonInfo(selectedLog.reason);
              return (
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-[#8898aa] block">Authentication Outcome</span>
                      <span className={`text-sm font-bold ${selectedLog.success ? 'text-emerald-600' : 'text-[#f5365c]'}`}>
                        {selectedLog.success ? 'Authenticated (Success)' : reasonInfo.label}
                      </span>
                      {!selectedLog.success && reasonInfo.description && (
                        <p className="text-[11px] text-[#8898aa] mt-0.5">{reasonInfo.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] uppercase font-bold text-[#8898aa] block">Channel</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${typeInfo.badgeClass}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                  </div>
                  {typeInfo.description && (
                    <div className="px-3 py-2 bg-blue-50/60 dark:bg-blue-950/30 rounded-[0.375rem] border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300">
                      <span className="font-semibold">{typeInfo.label}: </span>
                      {typeInfo.description}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Fields List */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8898aa] mb-1">
                  Origin IP Address
                </label>
                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem]">
                  <span className="font-mono font-bold text-sm text-[#32325d] dark:text-white">
                    {selectedLog.ip}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.ip, 'IP')}
                      className="px-2 py-1 rounded border border-[#dee2e6] dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenBlockModalForIP(selectedLog.ip, `Blocked from audit log: ${selectedLog.reason || 'denied attempt'}`)}
                      className="px-2 py-1 bg-rose-50 dark:bg-rose-950/60 text-[#f5365c] border border-rose-200 dark:border-rose-900/60 rounded text-xs font-semibold hover:bg-rose-100 flex items-center gap-1"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Block IP</span>
                    </button>
                  </div>
                </div>
              </div>

              {selectedLog.username && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] mb-1">
                    Submitted Username
                  </label>
                  <div className="p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] font-mono text-xs font-bold text-[#32325d] dark:text-white">
                    {selectedLog.username}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8898aa] mb-1">
                  Timestamp (Local & ISO)
                </label>
                <div className="p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] font-mono text-xs text-[#525f7f] dark:text-slate-300">
                  {formatDate(selectedLog.created_at)} ({new Date(selectedLog.created_at).toISOString()})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-[#8898aa] mb-1">
                  Full User Agent / Player Client
                </label>
                <div className="p-2.5 bg-white dark:bg-slate-800 border border-[#dee2e6] dark:border-slate-700 rounded-[0.375rem] font-mono text-xs text-[#525f7f] dark:text-slate-300 break-all select-all">
                  {selectedLog.user_agent || 'Not provided'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#dee2e6] dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleFilterLogsByIP(selectedLog.ip)}
                className="px-3 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-[#525f7f] dark:text-slate-200"
              >
                Filter All Logs by This IP
              </button>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 bg-[#3970e1] text-white rounded text-xs font-semibold hover:bg-[#2b5cc4]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ========================================================= */}
      {/* Security Settings Modal                                   */}
      {/* ========================================================= */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        size="lg"
      >
        <Modal.Header
          title="Security & Anti-Brute Force Configuration"
          icon={<Sliders className="w-4 h-4" />}
          onClose={() => setSettingsModalOpen(false)}
        />

        <form onSubmit={handleSaveSecuritySettings}>
          <Modal.Body className="space-y-4">
            {/* Section 1: Brute Force Engine */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">
                    Anti-Brute Force Protection
                  </span>
                  <span className="text-[11px] text-[#8898aa] dark:text-slate-400">
                    Bans IP addresses exceeding maximum distinct failed attempt threshold
                  </span>
                </div>
                <Switch
                  checked={settingsForm.antibruteforce_enabled}
                  onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, antibruteforce_enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Ban Duration (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    required
                    value={settingsForm.antibruteforce_ban_hours}
                    onChange={(e) => setSettingsForm({ ...settingsForm, antibruteforce_ban_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Default: 24h</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Max Failed Attempts
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={settingsForm.antibruteforce_max_attempts}
                    onChange={(e) => setSettingsForm({ ...settingsForm, antibruteforce_max_attempts: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Default: 5 tries</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Window (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    required
                    value={settingsForm.antibruteforce_window_minutes}
                    onChange={(e) => setSettingsForm({ ...settingsForm, antibruteforce_window_minutes: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Default: 15m</span>
                </div>
              </div>

              <p className="text-[11px] text-[#8898aa] dark:text-slate-400 pt-1">
                Note: Repeated identical player retries are de-duplicated and do not increment brute-force counters.
              </p>
            </div>

            {/* Section 2: Multi-IP Leak Detection */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">
                    Multi-IP Access Detection (Account Leak Protection)
                  </span>
                  <span className="text-[11px] text-[#8898aa] dark:text-slate-400">
                    Flags and suspends lines accessed concurrently from multiple network locations
                  </span>
                </div>
                <Switch
                  checked={settingsForm.multi_ip_detection_enabled}
                  onCheckedChange={(checked) => setSettingsForm({ ...settingsForm, multi_ip_detection_enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Max Allowed Subnets
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="100"
                    required
                    value={settingsForm.multi_ip_max_subnets}
                    onChange={(e) => setSettingsForm({ ...settingsForm, multi_ip_max_subnets: Math.max(2, parseInt(e.target.value, 10) || 2) })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Default: 10 (/24, /64)</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Window (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    required
                    value={settingsForm.multi_ip_window_hours}
                    onChange={(e) => setSettingsForm({ ...settingsForm, multi_ip_window_hours: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  />
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Default: 2h</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                    Compromised Action
                  </label>
                  <select
                    value={settingsForm.multi_ip_auto_suspend ? '1' : '0'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, multi_ip_auto_suspend: e.target.value === '1' })}
                    className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                  >
                    <option value="1">Auto-Suspend Line</option>
                    <option value="0">Audit Log Only</option>
                  </select>
                  <span className="text-[11px] text-[#8898aa] mt-0.5 block">Action on breach</span>
                </div>
              </div>
            </div>

            {/* Section 3: Log Retention & Purge Actions */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-[0.375rem] border border-[#dee2e6] dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-[#32325d] dark:text-white block">
                    Audit Log Retention & Cleanup
                  </span>
                  <span className="text-[11px] text-[#8898aa] dark:text-slate-400">
                    Control database storage retention for security access logs
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFlushOldLogs}
                    disabled={flushingLogs}
                    className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-semibold text-[#525f7f] dark:text-slate-300 transition"
                  >
                    Flush Expired Logs
                  </button>
                  <button
                    type="button"
                    onClick={handleFlushAllLogs}
                    disabled={flushingLogs}
                    className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/60 text-[#f5365c] rounded text-xs font-semibold transition"
                  >
                    Purge All
                  </button>
                </div>
              </div>

              <div className="max-w-xs">
                <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                  Retention Period (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={settingsForm.security_log_retention_days}
                  onChange={(e) => setSettingsForm({ ...settingsForm, security_log_retention_days: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-2.5 py-1.5 border border-[#dee2e6] dark:border-slate-700 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:border-[#3970e1]"
                />
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSettingsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingSettings}
              icon={<Check className="w-3.5 h-3.5" />}
            >
              Save Configuration
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* Manual Block IP Modal                                     */}
      {/* ========================================================= */}
      <Modal
        isOpen={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        size="md"
      >
        <Modal.Header
          title="Manual IP Block"
          icon={<Lock className="w-4 h-4" />}
          iconClassName="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/40 text-[#f5365c]"
          onClose={() => setBlockModalOpen(false)}
        />

        <form onSubmit={handleManualBlockSubmit}>
          <Modal.Body className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                Target IP Address *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 198.51.100.25"
                value={blockIPInput}
                onChange={(e) => setBlockIPInput(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-xs font-mono text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#f5365c]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                Reason
              </label>
              <input
                type="text"
                placeholder="e.g. Malicious scanning / credential spraying"
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-xs text-[#32325d] dark:text-slate-100 focus:outline-none focus:border-[#f5365c]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#8898aa] dark:text-slate-400 mb-1">
                Ban Duration
              </label>
              <select
                value={blockDurationInput}
                onChange={(e) => setBlockDurationInput(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#dee2e6] dark:border-slate-700 bg-white dark:bg-slate-800 rounded text-xs text-[#525f7f] dark:text-slate-200 focus:outline-none focus:border-[#f5365c]"
              >
                <option value={24}>24 Hours (Standard)</option>
                <option value={48}>48 Hours</option>
                <option value={168}>7 Days</option>
                <option value={720}>30 Days</option>
                <option value={0}>Permanent (Until unblocked)</option>
              </select>
            </div>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBlockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              loading={submittingBlock}
              icon={<Lock className="w-3.5 h-3.5" />}
            >
              Confirm Block
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  );
}
