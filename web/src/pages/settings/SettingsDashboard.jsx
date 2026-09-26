import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  ShieldCheck,
  Activity,
  Zap,
  Palette,
  Database,
  Loader2,
  AlertCircle,
  Check,
  Terminal,
} from 'lucide-react';
import { settingsApi, backupApi, playlistApi } from '../../api/client';
import SettingsHeader from './components/SettingsHeader';
import SettingsNav from './components/SettingsNav';
import RestoreBackupModal from './components/RestoreBackupModal';
import ImportFromEditorModal from '../../components/ImportFromEditorModal';

// Tabs
import SyncTab from './tabs/SyncTab';
import SecurityTab from './tabs/SecurityTab';
import TrafficTab from './tabs/TrafficTab';
import CacheTab from './tabs/CacheTab';
import PortalTab from './tabs/PortalTab';
import BackupTab from './tabs/BackupTab';
import DiagnosticsTab from './tabs/DiagnosticsTab';

const DEFAULT_FORM_STATE = {
  iptveditor_api_url: '',
  iptveditor_api_token: '',
  iptveditor_api_password: '',
  tmdb_api_key: '',
  playlist_sync_interval_hours: 6,
  playlist_sync_enabled: true,
  playlist_sync_force: false,
  epg_max_days: 4,
  expiry_sync_interval_hours: 12,
  expiry_sync_enabled: true,
  expiry_sync_all: false,
  expiry_sync_days_range: 5,
  backup_interval_hours: 24,
  backup_enabled: true,
  backup_retention_days: 30,
  security_log_retention_days: 7,
  antibruteforce_enabled: true,
  antibruteforce_ban_hours: 24,
  antibruteforce_max_attempts: 5,
  antibruteforce_window_minutes: 15,
  multi_ip_detection_enabled: true,
  multi_ip_max_subnets: 10,
  multi_ip_window_hours: 2,
  multi_ip_auto_suspend: true,
  backup_download_mode: 'disabled',
  cache_enabled: true,
  cache_auth_ttl_minutes: 3,
  cache_categories_ttl_minutes: 120,
  cache_streams_ttl_minutes: 10,
  tracking_timeout_minutes: 10,
  throttle_enabled: true,
  throttle_router_enabled: true,
  throttle_router_limit: 30,
  throttle_router_window_seconds: 10,
  throttle_m3u_epg_enabled: true,
  throttle_m3u_epg_limit: 18,
  throttle_m3u_epg_window_seconds: 300,
  throttle_xtream_enabled: true,
  throttle_xtream_limit: 40,
  throttle_xtream_window_seconds: 20,
  throttle_stalker_enabled: false,
  throttle_stalker_limit: 60,
  throttle_stalker_window_seconds: 60,
  user_dashboard_enabled: true,
  user_dashboard_title: 'User Portal',
  user_dashboard_allow_hide_categories: true,
  user_dashboard_html: '',
  user_dashboard_logo: '',
  user_dashboard_primary_color: '#3b82f6',
  user_dashboard_secondary_color: '#6366f1',
  user_dashboard_accent_color: '#10b981',
  user_dashboard_background_theme: 'slate',
  admin_hostname: '',
  block_streaming_on_admin_host: true,
  restrict_admin_to_admin_host: false,
  block_direct_ip_streaming: false,
  ssl_on_demand_enabled: false,
  additional_ssl_domains: '',
  captcha_provider: 'default',
  captcha_site_key: '',
  captcha_secret_key: '',
};

export default function SettingsDashboard({ playlists = [], onPlaylistsRefreshed }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from URL search params (?tab=...)
  const validTabs = ['sync', 'security', 'traffic', 'cache', 'portal', 'backups', 'diagnostics'];
  const tabFromUrl = searchParams.get('tab');
  const activeTab = validTabs.includes(tabFromUrl) ? tabFromUrl : 'sync';

  const handleSelectTab = (tabId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tabId);
      return next;
    });
  };

  // Settings State
  const [data, setData] = React.useState(null);
  const [backups, setBackups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [clearingCacheScope, setClearingCacheScope] = React.useState(null);
  const [searchFilter, setSearchFilter] = React.useState('');

  // Form State
  const [form, setForm] = React.useState(DEFAULT_FORM_STATE);
  const cleanFormRef = React.useRef(null);
  const formLoadedRef = React.useRef(false);

  // Notifications
  const [notification, setNotification] = React.useState(null);
  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Token testing state
  const [showToken, setShowToken] = React.useState(false);
  const [showApiPassword, setShowApiPassword] = React.useState(false);
  const [testingToken, setTestingToken] = React.useState(false);
  const [tokenTestResult, setTokenTestResult] = React.useState(null);
  const [showImportEditorModal, setShowImportEditorModal] = React.useState(false);

  // TMDB testing state
  const [showTmdbKey, setShowTmdbKey] = React.useState(false);
  const [testingTmdbKey, setTestingTmdbKey] = React.useState(false);
  const [tmdbTestResult, setTmdbTestResult] = React.useState(null);

  // Action states
  const [actionLoading, setActionLoading] = React.useState({
    playlistSync: false,
    expirySync: false,
    backupRun: false,
    downloadBackup: false,
  });

  // Backup Creation Options
  const [backupScope, setBackupScope] = React.useState('full');
  const [backupPlaylistId, setBackupPlaylistId] = React.useState('');
  const [backupIncludeToken, setBackupIncludeToken] = React.useState(false);

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = React.useState(null);
  const [restoreMode, setRestoreMode] = React.useState('skip');
  const [restoreScopeMode, setRestoreScopeMode] = React.useState('all');
  const [restoreSelectedListId, setRestoreSelectedListId] = React.useState('');
  const [restoreUsers, setRestoreUsers] = React.useState(true);
  const [restoreSettings, setRestoreSettings] = React.useState(true);
  const [restoreToken, setRestoreToken] = React.useState(false);
  const [restorePlaylists, setRestorePlaylists] = React.useState(true);
  const [restoreTeamMembers, setRestoreTeamMembers] = React.useState(true);
  const [restoreTeamScope, setRestoreTeamScope] = React.useState('collaborators_only');
  const [restoring, setRestoring] = React.useState(false);
  const [restoreResult, setRestoreResult] = React.useState(null);

  // Playlist tracking settings state
  const [localPlaylists, setLocalPlaylists] = React.useState(playlists);
  const [playlistSettings, setPlaylistSettings] = React.useState({});
  const [savingPlaylistId, setSavingPlaylistId] = React.useState(null);
  const [savingTimeout, setSavingTimeout] = React.useState(false);

  React.useEffect(() => {
    if (playlists && playlists.length > 0) {
      setLocalPlaylists(playlists);
      setPlaylistSettings((prev) => {
        const initial = { ...prev };
        playlists.forEach((p) => {
          if (!initial[p.id]) {
            initial[p.id] = {
              allow_tracking: Boolean(p.allow_tracking),
              limit_max_connections: Boolean(p.limit_max_connections),
              max_connections: p.max_connections || 1,
            };
          }
        });
        return initial;
      });
    }
  }, [playlists]);

  const displayedPlaylists = localPlaylists && localPlaylists.length > 0 ? localPlaylists : playlists;

  // Check if form has unsaved modifications
  const isDirty = React.useMemo(() => {
    if (!cleanFormRef.current) return false;
    return JSON.stringify(form) !== JSON.stringify(cleanFormRef.current);
  }, [form]);

  // Load settings, backups, and live playlists
  const loadAll = React.useCallback(async (isBackground = false, forceReloadForm = false) => {
    try {
      const [settingsRes, backupsRes, playlistsRes] = await Promise.all([
        settingsApi.getSettings(),
        settingsApi.getBackups(),
        playlistApi.getPlaylists().catch(() => null),
      ]);

      setData(settingsRes);
      setBackups(backupsRes || []);

      if (playlistsRes && Array.isArray(playlistsRes)) {
        setLocalPlaylists(playlistsRes);
        setPlaylistSettings((prev) => {
          const next = { ...prev };
          playlistsRes.forEach((p) => {
            if (savingPlaylistId !== p.id) {
              next[p.id] = {
                allow_tracking: Boolean(p.allow_tracking),
                limit_max_connections: Boolean(p.limit_max_connections),
                max_connections: p.max_connections || 1,
              };
            }
          });
          return next;
        });
      }

      if (settingsRes?.settings && (!formLoadedRef.current || forceReloadForm)) {
        formLoadedRef.current = true;
        const loadedForm = {
          iptveditor_api_url: settingsRes.settings.iptveditor_api_url || '',
          iptveditor_api_token: settingsRes.settings.iptveditor_api_token || '',
          iptveditor_api_password: settingsRes.settings.iptveditor_api_password || '',
          tmdb_api_key: settingsRes.settings.tmdb_api_key || '',
          playlist_sync_interval_hours: settingsRes.settings.playlist_sync_interval_hours || 6,
          playlist_sync_enabled: Boolean(settingsRes.settings.playlist_sync_enabled),
          playlist_sync_force: false,
          epg_max_days: settingsRes.settings.epg_max_days !== undefined ? settingsRes.settings.epg_max_days : 4,
          expiry_sync_interval_hours: settingsRes.settings.expiry_sync_interval_hours || 12,
          expiry_sync_enabled: Boolean(settingsRes.settings.expiry_sync_enabled),
          expiry_sync_all: Boolean(settingsRes.settings.expiry_sync_all),
          backup_interval_hours: settingsRes.settings.backup_interval_hours || 24,
          backup_enabled: Boolean(settingsRes.settings.backup_enabled),
          backup_retention_days: settingsRes.settings.backup_retention_days || 30,
          security_log_retention_days: settingsRes.settings.security_log_retention_days || 7,
          antibruteforce_enabled: settingsRes.settings.antibruteforce_enabled !== undefined ? Boolean(settingsRes.settings.antibruteforce_enabled) : true,
          antibruteforce_ban_hours: settingsRes.settings.antibruteforce_ban_hours || 24,
          antibruteforce_max_attempts: settingsRes.settings.antibruteforce_max_attempts || 5,
          antibruteforce_window_minutes: settingsRes.settings.antibruteforce_window_minutes || 15,
          multi_ip_detection_enabled: settingsRes.settings.multi_ip_detection_enabled !== undefined ? Boolean(settingsRes.settings.multi_ip_detection_enabled) : true,
          multi_ip_max_subnets: settingsRes.settings.multi_ip_max_subnets || 10,
          multi_ip_window_hours: settingsRes.settings.multi_ip_window_hours || 2,
          multi_ip_auto_suspend: settingsRes.settings.multi_ip_auto_suspend !== undefined ? Boolean(settingsRes.settings.multi_ip_auto_suspend) : true,
          backup_download_mode: settingsRes.settings.backup_download_mode || 'disabled',
          cache_enabled: settingsRes.settings.cache_enabled !== undefined ? Boolean(settingsRes.settings.cache_enabled) : true,
          cache_auth_ttl_minutes: settingsRes.settings.cache_auth_ttl_minutes || 3,
          cache_categories_ttl_minutes: settingsRes.settings.cache_categories_ttl_minutes || 120,
          cache_streams_ttl_minutes: settingsRes.settings.cache_streams_ttl_minutes || 10,
          tracking_timeout_minutes: settingsRes.settings.tracking_timeout_minutes || 10,
          throttle_enabled: settingsRes.settings.throttle_enabled !== undefined ? Boolean(settingsRes.settings.throttle_enabled) : true,
          throttle_router_enabled: settingsRes.settings.throttle_router_enabled !== undefined ? Boolean(settingsRes.settings.throttle_router_enabled) : true,
          throttle_router_limit: settingsRes.settings.throttle_router_limit || 30,
          throttle_router_window_seconds: settingsRes.settings.throttle_router_window_seconds || 10,
          throttle_m3u_epg_enabled: settingsRes.settings.throttle_m3u_epg_enabled !== undefined ? Boolean(settingsRes.settings.throttle_m3u_epg_enabled) : true,
          throttle_m3u_epg_limit: settingsRes.settings.throttle_m3u_epg_limit || 18,
          throttle_m3u_epg_window_seconds: settingsRes.settings.throttle_m3u_epg_window_seconds || 300,
          throttle_xtream_enabled: settingsRes.settings.throttle_xtream_enabled !== undefined ? Boolean(settingsRes.settings.throttle_xtream_enabled) : true,
          throttle_xtream_limit: settingsRes.settings.throttle_xtream_limit || 40,
          throttle_xtream_window_seconds: settingsRes.settings.throttle_xtream_window_seconds || 20,
          throttle_stalker_enabled: settingsRes.settings.throttle_stalker_enabled !== undefined ? Boolean(settingsRes.settings.throttle_stalker_enabled) : false,
          throttle_stalker_limit: settingsRes.settings.throttle_stalker_limit || 60,
          throttle_stalker_window_seconds: settingsRes.settings.throttle_stalker_window_seconds || 60,
          user_dashboard_enabled: settingsRes.settings.user_dashboard_enabled !== undefined ? Boolean(settingsRes.settings.user_dashboard_enabled) : true,
          user_dashboard_title: settingsRes.settings.user_dashboard_title || 'User Portal',
          user_dashboard_allow_hide_categories: settingsRes.settings.user_dashboard_allow_hide_categories !== undefined ? Boolean(settingsRes.settings.user_dashboard_allow_hide_categories) : true,
          user_dashboard_html: settingsRes.settings.user_dashboard_html || '',
          user_dashboard_logo: settingsRes.settings.user_dashboard_logo || '',
          user_dashboard_primary_color: settingsRes.settings.user_dashboard_primary_color || '#3b82f6',
          user_dashboard_secondary_color: settingsRes.settings.user_dashboard_secondary_color || '#6366f1',
          user_dashboard_accent_color: settingsRes.settings.user_dashboard_accent_color || '#10b981',
          user_dashboard_background_theme: settingsRes.settings.user_dashboard_background_theme || 'slate',
          admin_hostname: settingsRes.settings.admin_hostname || '',
          block_streaming_on_admin_host: settingsRes.settings.block_streaming_on_admin_host !== undefined ? Boolean(settingsRes.settings.block_streaming_on_admin_host) : true,
          restrict_admin_to_admin_host: settingsRes.settings.restrict_admin_to_admin_host !== undefined ? Boolean(settingsRes.settings.restrict_admin_to_admin_host) : false,
          block_direct_ip_streaming: settingsRes.settings.block_direct_ip_streaming !== undefined ? Boolean(settingsRes.settings.block_direct_ip_streaming) : false,
          ssl_on_demand_enabled: settingsRes.settings.ssl_on_demand_enabled !== undefined ? Boolean(settingsRes.settings.ssl_on_demand_enabled) : false,
          additional_ssl_domains: settingsRes.settings.additional_ssl_domains || '',
          captcha_provider: settingsRes.settings.captcha_provider || 'default',
          captcha_site_key: settingsRes.settings.captcha_site_key || '',
          captcha_secret_key: settingsRes.settings.captcha_secret_key || '',
          license_suspended: Boolean(settingsRes.settings.license_suspended),
          license_suspended_at: settingsRes.settings.license_suspended_at || null,
          license_upgrade_url: settingsRes.settings.license_upgrade_url || '',
        };
        setForm(loadedForm);
        cleanFormRef.current = loadedForm;
      }
    } catch (err) {
      if (!isBackground) {
        notify(err.message || 'Error loading dashboard settings', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [savingPlaylistId]);

  React.useEffect(() => {
    loadAll(false, false);
    const interval = setInterval(() => {
      loadAll(true, false);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadAll]);

  // Test PlaylistLabs Token
  const handleTestToken = async () => {
    const token = form.iptveditor_api_token.trim();
    const password = (form.iptveditor_api_password || '').trim();
    if (!token) {
      notify('Please enter a token before testing', 'error');
      return;
    }
    setTestingToken(true);
    setTokenTestResult(null);
    try {
      const res = await settingsApi.testToken(token, password);
      setTokenTestResult(res);
      notify(res.message || 'Valid token!', 'success');
      window.dispatchEvent(new CustomEvent('settings-updated'));
    } catch (err) {
      const errData = err.data || {};
      setTokenTestResult({
        valid: false,
        message: err.message,
        code: errData.code,
        title: errData.title,
        body: errData.body,
        upgrade_url: errData.upgrade_url,
      });
      if (errData.code === 'PLAN_UPGRADE_REQUIRED') {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      }
      notify(err.message || 'Token verification failed', 'error');
    } finally {
      setTestingToken(false);
    }
  };

  // Test TMDB API Key
  const handleTestTMDBKey = async () => {
    const key = (form.tmdb_api_key || '').trim();
    if (!key) {
      notify('Please enter a TMDB API key before testing', 'error');
      return;
    }
    setTestingTmdbKey(true);
    setTmdbTestResult(null);
    try {
      const res = await settingsApi.testTMDBKey(key);
      setTmdbTestResult(res);
      notify(res.message || 'Valid TMDB key!', 'success');
    } catch (err) {
      setTmdbTestResult({ valid: false, message: err.message });
      notify(err.message || 'TMDB key verification failed', 'error');
    } finally {
      setTestingTmdbKey(false);
    }
  };

  const [captchaVerified, setCaptchaVerified] = React.useState(true);

  // Save Settings
  const handleSaveSettings = async () => {
    const isExternalCaptcha = form.captcha_provider !== 'default' && form.captcha_provider !== 'disabled';
    if (isExternalCaptcha) {
      if (!form.captcha_site_key?.trim() || !form.captcha_secret_key?.trim()) {
        notify('Both Site Key and Secret Key are required for external captcha providers.', 'error');
        return;
      }
      if (!captchaVerified) {
        notify('Please complete the captcha verification test before saving to prevent administrator lockout.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await settingsApi.updateSettings({
        ...form,
        tmdb_api_key: (form.tmdb_api_key || '').trim(),
        playlist_sync_interval_hours: parseInt(form.playlist_sync_interval_hours, 10) || 1,
        playlist_sync_enabled: Boolean(form.playlist_sync_enabled),
        epg_max_days: parseInt(form.epg_max_days, 10) || 4,
        expiry_sync_interval_hours: parseInt(form.expiry_sync_interval_hours, 10) || 1,
        backup_interval_hours: parseInt(form.backup_interval_hours, 10) || 1,
        backup_retention_days: parseInt(form.backup_retention_days, 10) || 30,
        security_log_retention_days: parseInt(form.security_log_retention_days, 10) || 7,
        antibruteforce_enabled: Boolean(form.antibruteforce_enabled),
        antibruteforce_ban_hours: parseInt(form.antibruteforce_ban_hours, 10) || 24,
        antibruteforce_max_attempts: parseInt(form.antibruteforce_max_attempts, 10) || 5,
        antibruteforce_window_minutes: parseInt(form.antibruteforce_window_minutes, 10) || 15,
        multi_ip_detection_enabled: Boolean(form.multi_ip_detection_enabled),
        multi_ip_max_subnets: parseInt(form.multi_ip_max_subnets, 10) || 10,
        multi_ip_window_hours: parseInt(form.multi_ip_window_hours, 10) || 2,
        multi_ip_auto_suspend: Boolean(form.multi_ip_auto_suspend),
        backup_download_mode: form.backup_download_mode || 'disabled',
        cache_enabled: Boolean(form.cache_enabled),
        cache_auth_ttl_minutes: parseInt(form.cache_auth_ttl_minutes, 10) || 3,
        cache_categories_ttl_minutes: parseInt(form.cache_categories_ttl_minutes, 10) || 120,
        cache_streams_ttl_minutes: parseInt(form.cache_streams_ttl_minutes, 10) || 10,
        tracking_timeout_minutes: parseInt(form.tracking_timeout_minutes, 10) || 10,
        throttle_enabled: Boolean(form.throttle_enabled),
        throttle_router_enabled: Boolean(form.throttle_router_enabled),
        throttle_router_limit: parseInt(form.throttle_router_limit, 10) || 30,
        throttle_router_window_seconds: parseInt(form.throttle_router_window_seconds, 10) || 10,
        throttle_m3u_epg_enabled: Boolean(form.throttle_m3u_epg_enabled),
        throttle_m3u_epg_limit: parseInt(form.throttle_m3u_epg_limit, 10) || 18,
        throttle_m3u_epg_window_seconds: parseInt(form.throttle_m3u_epg_window_seconds, 10) || 300,
        throttle_xtream_enabled: Boolean(form.throttle_xtream_enabled),
        throttle_xtream_limit: parseInt(form.throttle_xtream_limit, 10) || 40,
        throttle_xtream_window_seconds: parseInt(form.throttle_xtream_window_seconds, 10) || 20,
        throttle_stalker_enabled: Boolean(form.throttle_stalker_enabled),
        throttle_stalker_limit: parseInt(form.throttle_stalker_limit, 10) || 60,
        throttle_stalker_window_seconds: parseInt(form.throttle_stalker_window_seconds, 10) || 60,
        user_dashboard_enabled: Boolean(form.user_dashboard_enabled),
        user_dashboard_title: form.user_dashboard_title || 'User Portal',
        user_dashboard_allow_hide_categories: Boolean(form.user_dashboard_allow_hide_categories),
        user_dashboard_html: form.user_dashboard_html || '',
        user_dashboard_logo: form.user_dashboard_logo || '',
        user_dashboard_primary_color: form.user_dashboard_primary_color || '#3b82f6',
        user_dashboard_secondary_color: form.user_dashboard_secondary_color || '#6366f1',
        user_dashboard_accent_color: form.user_dashboard_accent_color || '#10b981',
        user_dashboard_background_theme: form.user_dashboard_background_theme || 'slate',
        captcha_provider: form.captcha_provider || 'default',
        captcha_site_key: (form.captcha_site_key || '').trim(),
        captcha_secret_key: (form.captcha_secret_key || '').trim(),
      });
      setData(updated);
      if (updated?.settings) {
        const nextClean = {
          ...form,
          ...updated.settings,
          backup_download_mode: updated.settings.backup_download_mode || 'disabled',
        };
        setForm(nextClean);
        cleanFormRef.current = nextClean;
      }
      notify('Settings saved successfully!');
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
    } catch (err) {
      notify(err.message || 'Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Clear Cache
  const handleClearCache = async (scope = 'all') => {
    setClearingCacheScope(scope);
    try {
      const res = await settingsApi.clearCache(scope);
      notify(res.message || `Cache '${scope}' cleared successfully!`, 'success');
      loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error clearing cache', 'error');
    } finally {
      setClearingCacheScope(null);
    }
  };

  // Trigger Playlist Sync
  const handleTriggerPlaylistSync = async () => {
    setActionLoading((prev) => ({ ...prev, playlistSync: true }));
    const shouldForce = Boolean(form.playlist_sync_force);
    if (shouldForce) {
      setForm((prev) => ({ ...prev, playlist_sync_force: false }));
    }
    try {
      await settingsApi.triggerPlaylistSync(shouldForce);
      notify(
        shouldForce
          ? 'Forced full playlist synchronization started in background'
          : 'Playlist synchronization started in background'
      );
      loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error starting playlist sync', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, playlistSync: false }));
    }
  };

  // Trigger Expiry Sync
  const handleTriggerExpirySync = async () => {
    setActionLoading((prev) => ({ ...prev, expirySync: true }));
    try {
      await settingsApi.triggerExpirySync(form.expiry_sync_all, form.expiry_sync_days_range);
      notify('Expiration dates synchronization started in background');
      loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error starting expiry sync', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, expirySync: false }));
    }
  };

  // Trigger Instant Server Backup Snapshot
  const handleTriggerBackup = async () => {
    setActionLoading((prev) => ({ ...prev, backupRun: true }));
    try {
      let bType = backupScope;
      let pId = null;
      let incTeam = backupScope === 'full' || backupScope === 'team';

      if (backupScope === 'playlist') {
        bType = 'users';
        pId = backupPlaylistId ? parseInt(backupPlaylistId, 10) : null;
        incTeam = false;
      } else if (backupScope === 'users_all') {
        bType = 'users';
        incTeam = false;
      } else if (backupScope === 'settings') {
        bType = 'settings';
        incTeam = false;
      }

      const res = await settingsApi.triggerBackup({
        type: bType,
        list_id: pId,
        include_token: backupIncludeToken,
        include_team: incTeam,
      });
      notify(res?.message || 'Backup snapshot created successfully on server!');
      loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error creating backup', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, backupRun: false }));
    }
  };

  // Download Local Backup File
  const handleDownloadDirectBackup = async () => {
    setActionLoading((prev) => ({ ...prev, downloadBackup: true }));
    try {
      let bType = backupScope;
      let pId = null;
      let incTeam = backupScope === 'full' || backupScope === 'team';

      if (backupScope === 'playlist') {
        bType = 'users';
        pId = backupPlaylistId ? parseInt(backupPlaylistId, 10) : null;
        incTeam = false;
      } else if (backupScope === 'users_all') {
        bType = 'users';
        incTeam = false;
      } else if (backupScope === 'settings') {
        bType = 'settings';
        incTeam = false;
      }

      await backupApi.downloadBackup(pId, {
        type: bType,
        include_token: backupIncludeToken,
        include_team: incTeam,
      });
      notify('Backup download started!');
    } catch (err) {
      notify(err.message || 'Error downloading backup', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, downloadBackup: false }));
    }
  };

  // Delete Backup File from Server
  const handleDeleteBackup = async (filename) => {
    if (!confirm(`Are you sure you want to permanently delete backup "${filename}"?`)) return;
    try {
      await settingsApi.deleteBackup(filename);
      notify('Backup file deleted from server');
      loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error deleting backup', 'error');
    }
  };

  // Execute Restore from Server Stored Backup or Local File
  const handleExecuteRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setRestoreResult(null);
    try {
      let sourceId = null;
      let targetId = null;

      if (restoreScopeMode === 'filter_source' && restoreSelectedListId) {
        sourceId = String(restoreSelectedListId).trim();
      } else if (restoreScopeMode === 'remap_target' && restoreSelectedListId) {
        targetId = String(restoreSelectedListId).trim();
      }

      let res;
      if (restoreTarget.isLocalFile) {
        const payload = restoreTarget.filePayload;
        res = await backupApi.restoreUsers(
          {
            users: payload.users || (Array.isArray(payload) ? payload : []),
            file_content: payload,
            source_list_id: sourceId || undefined,
            target_list_id: targetId || undefined,
            mode: restoreMode,
            restore_users: restoreUsers,
            restore_settings: restoreSettings,
            restore_token: restoreToken,
            restore_playlists: restorePlaylists,
            restore_team_members: restoreTeamMembers,
            restore_team_scope: restoreTeamScope,
          },
          targetId
        );
      } else {
        res = await settingsApi.restoreStoredBackup(restoreTarget.filename, {
          mode: restoreMode,
          source_list_id: sourceId,
          target_list_id: targetId,
          restore_users: restoreUsers,
          restore_settings: restoreSettings,
          restore_token: restoreToken,
          restore_playlists: restorePlaylists,
          restore_team_members: restoreTeamMembers,
          restore_team_scope: restoreTeamScope,
        });
      }

      setRestoreResult(res);
      notify(res.message || `Restore completed: ${res.created} created, ${res.updated} updated.`);
      onPlaylistsRefreshed?.();
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
      await loadAll(true, false);
    } catch (err) {
      notify(err.message || 'Error restoring backup', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Inspect and Open Restore Modal for Local Uploaded File
  const handleFileSelectForRestore = async (selectedFile) => {
    if (!selectedFile) return;
    try {
      const text = await selectedFile.text();
      let payload;
      try {
        const sanitized = text.replace(/"(id|playlist_id|source_list_id|target_list_id|list_id)"\s*:\s*(\d{10,})/g, '"$1":"$2"');
        payload = JSON.parse(sanitized);
      } catch {
        payload = JSON.parse(text);
      }

      let users = [];
      let loadedPlaylists = [];
      let settings = null;
      let teamMembers = [];
      let hasToken = false;
      let bType = 'full';
      let pName = null;
      let pId = null;
      let createdAt = null;

      if (Array.isArray(payload)) {
        users = payload;
        bType = 'users';
      } else if (payload && typeof payload === 'object') {
        users = payload.users || [];
        loadedPlaylists = payload.playlists || [];
        settings = payload.system_settings || null;
        teamMembers = payload.team_members || [];
        hasToken = Boolean(payload.system_settings?.iptveditor_api_token || payload.system_settings?.has_token);
        bType = payload.backup_type || (settings ? 'full' : 'users');
        pName = payload.playlist_name || null;
        pId = payload.playlist_id != null ? String(payload.playlist_id).trim() : null;
        createdAt = payload.generated_at || payload.exported_at || null;
      }

      const hasUsers = users.length > 0;
      const hasSettings = settings !== null && Object.keys(settings).length > 0;
      const hasPlaylists = loadedPlaylists.length > 0;
      const hasTeam = teamMembers.length > 0;

      if (!hasUsers && !hasSettings && !hasPlaylists && !hasTeam) {
        throw new Error('Backup file contains no user records, settings, playlists, or team accounts.');
      }

      setRestoreUsers(hasUsers);
      setRestoreSettings(hasSettings);
      setRestorePlaylists(hasPlaylists);
      setRestoreTeamMembers(hasTeam);
      setRestoreTeamScope('collaborators_only');
      setRestoreToken(false);
      setRestoreMode('skip');
      setRestoreScopeMode(pId ? 'filter_source' : 'all');
      setRestoreSelectedListId(pId ? String(pId) : '');
      setRestoreResult(null);

      setRestoreTarget({
        isLocalFile: true,
        filename: selectedFile.name,
        size_bytes: selectedFile.size,
        filePayload: payload,
        backup_type: bType,
        playlist_name: pName,
        playlist_id: pId,
        total_users: users.length,
        has_settings: hasSettings,
        has_playlists: hasPlaylists,
        has_team_members: hasTeam,
        total_team: teamMembers.length,
        has_token: hasToken,
        created_at: createdAt || new Date().toISOString(),
      });
    } catch (err) {
      notify(err.message || 'Invalid JSON backup file', 'error');
    }
  };

  // Merge server playlists and playlists embedded in backup files for granular restore filtering
  const availableRestorePlaylists = React.useMemo(() => {
    const map = new Map();
    (displayedPlaylists || []).forEach((p) => {
      const sId = p.id != null ? String(p.id).trim() : '';
      if (sId) {
        map.set(sId, { id: sId, name: p.name });
      }
    });
    if (restoreTarget?.filePayload?.playlists && Array.isArray(restoreTarget.filePayload.playlists)) {
      restoreTarget.filePayload.playlists.forEach((p) => {
        const sId = p.id != null ? String(p.id).trim() : '';
        if (sId && !map.has(sId)) {
          map.set(sId, { id: sId, name: `${p.name || 'Playlist'} (from file)` });
        }
      });
    }
    if (restoreTarget?.playlist_id) {
      const sId = String(restoreTarget.playlist_id).trim();
      if (sId && !map.has(sId)) {
        map.set(sId, {
          id: sId,
          name: `${restoreTarget.playlist_name || 'Playlist'} (from file)`,
        });
      }
    }
    if (restoreTarget?.filePayload?.users && Array.isArray(restoreTarget.filePayload.users)) {
      restoreTarget.filePayload.users.forEach((u) => {
        const sId = u.list_id != null ? String(u.list_id).trim() : '';
        if (sId && !map.has(sId)) {
          map.set(sId, { id: sId, name: `Playlist ID ${sId} (from file)` });
        }
      });
    }
    return Array.from(map.values());
  }, [displayedPlaylists, restoreTarget]);

  // Playlist Tracking Handlers
  const handleUpdatePlaylistField = (listId, field, val) => {
    setPlaylistSettings((prev) => ({
      ...prev,
      [listId]: {
        ...(prev[listId] || {}),
        [field]: val,
      },
    }));
  };

  const handleTogglePlaylistSwitch = async (listId, field, val) => {
    const current = playlistSettings[listId] || {};
    const updated = {
      ...current,
      [field]: val,
    };

    setPlaylistSettings((prev) => ({
      ...prev,
      [listId]: updated,
    }));

    setSavingPlaylistId(listId);
    try {
      await playlistApi.updatePlaylistSettings(listId, {
        allow_tracking: updated.allow_tracking,
        limit_max_connections: updated.limit_max_connections,
        max_connections: parseInt(updated.max_connections, 10) || 1,
      });
      setLocalPlaylists((prev) =>
        prev.map((p) => (p.id === listId ? { ...p, [field]: val } : p))
      );
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
      onPlaylistsRefreshed?.();
      const label = field === 'allow_tracking' ? 'Connection tracking' : 'Connection limit enforcement';
      notify(`${label} ${val ? 'enabled' : 'disabled'}!`);
    } catch (err) {
      setPlaylistSettings((prev) => ({
        ...prev,
        [listId]: current,
      }));
      notify(err.message || 'Failed to update playlist setting', 'error');
    } finally {
      setSavingPlaylistId(null);
    }
  };

  const handleSavePlaylistTracking = async (listId) => {
    const s = playlistSettings[listId];
    if (!s) return;
    setSavingPlaylistId(listId);
    try {
      await playlistApi.updatePlaylistSettings(listId, {
        allow_tracking: s.allow_tracking,
        limit_max_connections: s.limit_max_connections,
        max_connections: parseInt(s.max_connections, 10) || 1,
      });
      setLocalPlaylists((prev) =>
        prev.map((p) => (p.id === listId ? { ...p, ...s } : p))
      );
      notify('Playlist tracking settings updated successfully!');
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
      onPlaylistsRefreshed?.();
    } catch (err) {
      notify(err.message || 'Failed updating playlist settings', 'error');
    } finally {
      setSavingPlaylistId(null);
    }
  };

  const handleBulkSetTracking = async (enabled) => {
    const targetLists = localPlaylists && localPlaylists.length > 0 ? localPlaylists : playlists;
    if (!targetLists || targetLists.length === 0) return;
    const actionName = enabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${actionName} tracking for all ${targetLists.length} playlists?`)) return;
    try {
      for (const p of targetLists) {
        const cur = playlistSettings[p.id] || {};
        await playlistApi.updatePlaylistSettings(p.id, {
          allow_tracking: enabled,
          limit_max_connections: cur.limit_max_connections,
          max_connections: parseInt(cur.max_connections, 10) || 1,
        });
      }
      setPlaylistSettings((prev) => {
        const next = { ...prev };
        targetLists.forEach((p) => {
          if (next[p.id]) {
            next[p.id].allow_tracking = enabled;
          }
        });
        return next;
      });
      setLocalPlaylists((prev) =>
        prev.map((p) => ({ ...p, allow_tracking: enabled }))
      );
      notify(`Tracking ${enabled ? 'enabled' : 'disabled'} for all playlists!`);
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
      onPlaylistsRefreshed?.();
    } catch (err) {
      notify(err.message || 'Bulk update failed', 'error');
    }
  };

  const handleSaveGlobalTimeout = async () => {
    setSavingTimeout(true);
    try {
      const minutes = parseInt(form.tracking_timeout_minutes, 10) || 10;
      const updated = await settingsApi.updateSettings({
        ...form,
        tracking_timeout_minutes: minutes,
      });
      setData(updated);
      notify(`Global tracking timeout updated to ${minutes} minutes!`);
      try {
        window.dispatchEvent(new CustomEvent('settings-updated'));
      } catch { }
    } catch (err) {
      notify(err.message || 'Failed saving tracking timeout', 'error');
    } finally {
      setSavingTimeout(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Never';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Never';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const pStatus = data?.playlist_sync || {};
  const eStatus = data?.expiry_sync || {};
  const bStatus = data?.backup || {};

  // Definition of the 6 categories
  const categories = [
    {
      id: 'sync',
      name: 'Synchronization',
      subtitle: 'PlaylistLabs Schedules',
      desc: 'Configure automated synchronization intervals for playlists, channels, EPG schedule, and user expiration dates.',
      icon: RefreshCw,
      //badge: pStatus.is_running || eStatus.is_running ? 'Syncing' : (form.playlist_sync_enabled ? 'Active' : null),
      badgeColor: pStatus.is_running || eStatus.is_running ? 'bg-amber-100 dark:bg-amber-950 text-amber-600' : 'bg-blue-100 dark:bg-blue-950 text-blue-600',
    },
    {
      id: 'security',
      name: 'Security & Access',
      subtitle: 'Anti-Brute Force & Multi-IP',
      desc: 'Protect against credential spraying, brute force attacks, and concurrent unauthorized IP access.',
      icon: ShieldCheck,
      //badge: form.antibruteforce_enabled ? 'Protected' : 'Disabled',
      badgeColor: form.antibruteforce_enabled ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600' : 'bg-gray-100 text-gray-500',
    },
    {
      id: 'traffic',
      name: 'Traffic & Limits',
      subtitle: 'Connections & Throttling',
      desc: 'Manage active stream tracking, per-playlist concurrent device limits, and API request rate limits.',
      icon: Activity,
      //badge: form.throttle_enabled ? 'Enforced' : null,
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600',
    },
    {
      id: 'cache',
      name: 'Cache & Acceleration',
      subtitle: 'Redis In-Memory TTLs',
      desc: 'In-memory acceleration for high-traffic streaming redirects, authentication cache, and category listings.',
      icon: Zap,
      //badge: form.cache_enabled ? 'Redis Active' : null,
      badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600',
    },
    {
      id: 'portal',
      name: 'Portal Studio & Branding',
      subtitle: 'Login Screen & Per-Playlist Style',
      desc: 'Configure the shared public login screen and customize post-login dashboard experiences per playlist.',
      icon: Palette,
      badge: null,
      badgeColor: null,
    },
    {
      id: 'backups',
      name: 'Backups & Recovery',
      subtitle: 'Snapshots & Disaster Recovery',
      desc: 'Automated database backups, manual server archives, JSON export, and granular selective restore.',
      icon: Database,
      //badge: `${backups.length} snapshots`,
      badgeColor: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    },
    {
      id: 'diagnostics',
      name: 'Diagnostics & Logs',
      subtitle: 'System Health & Support Bundle',
      desc: 'Inspect live host metrics, process memory, database pool status, runtime logs, and export a diagnostic bundle.',
      icon: Terminal,
      badgeColor: 'bg-amber-100 dark:bg-amber-950 text-amber-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#3970e1] animate-spin" />
        <span className="text-xs text-[#8898aa]">Loading dashboard settings...</span>
      </div>
    );
  }

  return (
    <>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[0.375rem] shadow-argon-dropdown flex items-center gap-2 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200 border pointer-events-auto ${notification.type === 'error'
            ? 'bg-[#f5365c] text-white border-[#f5365c]'
            : 'bg-[#2dce89] text-white border-[#2dce89]'
            }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-white shrink-0" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sticky Header */}
        <SettingsHeader
          onBack={() => navigate(-1)}
          activeTab={activeTab}
          tabs={categories}
          onReload={() => loadAll(false, true)}
          onSave={handleSaveSettings}
          saving={saving}
          isDirty={isDirty}
          searchQuery={searchFilter}
          onSearchChange={setSearchFilter}
        />

        {/* 2-Column Responsive Category Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Category Navigation (Vertical Sidebar on Desktop, Horizontal Pills on Mobile) */}
          <SettingsNav
            tabs={categories}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
          />

          {/* Right Main Content Area */}
          <main className="flex-1 w-full min-w-0">
            {activeTab === 'sync' && (
              <SyncTab
                form={form}
                setForm={setForm}
                pStatus={pStatus}
                eStatus={eStatus}
                tokenTestResult={tokenTestResult}
                setTokenTestResult={setTokenTestResult}
                showToken={showToken}
                setShowToken={setShowToken}
                showApiPassword={showApiPassword}
                setShowApiPassword={setShowApiPassword}
                testingToken={testingToken}
                handleTestToken={handleTestToken}
                showTmdbKey={showTmdbKey}
                setShowTmdbKey={setShowTmdbKey}
                testingTmdbKey={testingTmdbKey}
                tmdbTestResult={tmdbTestResult}
                setTmdbTestResult={setTmdbTestResult}
                handleTestTMDBKey={handleTestTMDBKey}
                actionLoading={actionLoading}
                handleTriggerPlaylistSync={handleTriggerPlaylistSync}
                handleTriggerExpirySync={handleTriggerExpirySync}
                setShowImportEditorModal={setShowImportEditorModal}
                formatDate={formatDate}
              />
            )}

            {activeTab === 'security' && (
              <SecurityTab
                form={form}
                setForm={setForm}
                cleanForm={cleanFormRef.current}
                captchaVerified={captchaVerified}
                setCaptchaVerified={setCaptchaVerified}
                handleSaveSettings={handleSaveSettings}
                saving={saving}
                onOpenSecurityCenter={() => navigate('/security')}
              />
            )}

            {activeTab === 'traffic' && (
              <TrafficTab
                form={form}
                setForm={setForm}
                displayedPlaylists={displayedPlaylists}
                playlistSettings={playlistSettings}
                savingPlaylistId={savingPlaylistId}
                savingTimeout={savingTimeout}
                saving={saving}
                handleBulkSetTracking={handleBulkSetTracking}
                handleSaveGlobalTimeout={handleSaveGlobalTimeout}
                handleTogglePlaylistSwitch={handleTogglePlaylistSwitch}
                handleUpdatePlaylistField={handleUpdatePlaylistField}
                handleSavePlaylistTracking={handleSavePlaylistTracking}
                handleSaveSettings={handleSaveSettings}
              />
            )}

            {activeTab === 'cache' && (
              <CacheTab
                form={form}
                setForm={setForm}
                cacheStatus={data?.cache_status}
                clearingCacheScope={clearingCacheScope}
                handleClearCache={handleClearCache}
                handleSaveSettings={handleSaveSettings}
                saving={saving}
              />
            )}

            {activeTab === 'portal' && (
              <PortalTab
                form={form}
                setForm={setForm}
                playlists={playlists}
                handleSaveSettings={handleSaveSettings}
                saving={saving}
                notify={notify}
              />
            )}

            {activeTab === 'backups' && (
              <BackupTab
                form={form}
                setForm={setForm}
                bStatus={bStatus}
                backups={backups}
                backupScope={backupScope}
                setBackupScope={setBackupScope}
                backupPlaylistId={backupPlaylistId}
                setBackupPlaylistId={setBackupPlaylistId}
                backupIncludeToken={backupIncludeToken}
                setBackupIncludeToken={setBackupIncludeToken}
                displayedPlaylists={displayedPlaylists}
                actionLoading={actionLoading}
                handleTriggerBackup={handleTriggerBackup}
                handleDownloadDirectBackup={handleDownloadDirectBackup}
                handleDeleteBackup={handleDeleteBackup}
                handleFileSelectForRestore={handleFileSelectForRestore}
                setRestoreTarget={setRestoreTarget}
                setRestoreMode={setRestoreMode}
                setRestoreResult={setRestoreResult}
                setRestoreUsers={setRestoreUsers}
                setRestoreSettings={setRestoreSettings}
                setRestoreToken={setRestoreToken}
                setRestorePlaylists={setRestorePlaylists}
                setRestoreTeamMembers={setRestoreTeamMembers}
                setRestoreTeamScope={setRestoreTeamScope}
                setRestoreScopeMode={setRestoreScopeMode}
                setRestoreSelectedListId={setRestoreSelectedListId}
                handleSaveSettings={handleSaveSettings}
                saving={saving}
                data={data}
                formatDate={formatDate}
                formatFileSize={formatFileSize}
              />
            )}

            {activeTab === 'diagnostics' && (
              <DiagnosticsTab notify={notify} />
            )}
          </main>
        </div>
      </div>

      {/* Snapshot Restore Modal */}
      {restoreTarget && (
        <RestoreBackupModal
          restoreTarget={restoreTarget}
          onClose={() => {
            if (restoreResult) {
              onPlaylistsRefreshed?.();
              try {
                window.dispatchEvent(new CustomEvent('settings-updated'));
              } catch { }
            }
            setRestoreTarget(null);
            setRestoreResult(null);
          }}
          onExecuteRestore={handleExecuteRestore}
          restoring={restoring}
          restoreResult={restoreResult}
          restoreMode={restoreMode}
          setRestoreMode={setRestoreMode}
          restoreScopeMode={restoreScopeMode}
          setRestoreScopeMode={setRestoreScopeMode}
          restoreSelectedListId={restoreSelectedListId}
          setRestoreSelectedListId={setRestoreSelectedListId}
          restoreUsers={restoreUsers}
          setRestoreUsers={setRestoreUsers}
          restoreSettings={restoreSettings}
          setRestoreSettings={setRestoreSettings}
          restoreToken={restoreToken}
          setRestoreToken={setRestoreToken}
          restorePlaylists={restorePlaylists}
          setRestorePlaylists={setRestorePlaylists}
          restoreTeamMembers={restoreTeamMembers}
          setRestoreTeamMembers={setRestoreTeamMembers}
          restoreTeamScope={restoreTeamScope}
          setRestoreTeamScope={setRestoreTeamScope}
          availableRestorePlaylists={availableRestorePlaylists}
          formatDate={formatDate}
        />
      )}

      {/* Import from Editor Modal */}
      {showImportEditorModal && (
        <ImportFromEditorModal
          isGlobal={true}
          playlists={playlists}
          onClose={() => setShowImportEditorModal(false)}
          onSuccess={(result) => {
            loadAll(true, false);
            onPlaylistsRefreshed?.();
            notify(`Imported from PlaylistLabs: ${result.imported || 0} added, ${result.updated || 0} updated, ${result.skipped || 0} skipped`);
          }}
        />
      )}
    </>
  );
}
