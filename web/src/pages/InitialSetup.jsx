import React, { useState } from 'react';
import {
  Shield,
  Key,
  Server,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sliders,
  Lock,
  RefreshCw,
  Globe,
  HardDrive,
  Cpu,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Tv,
  Film,
  Clapperboard,
  Terminal,
  Clock,
  ExternalLink,
  Sparkles,
  Sun,
  Moon,
  TriangleAlert,
} from 'lucide-react';
import { setupApi, playlistApi, setToken, setAdmin } from '../api/client';
import { Switch } from '../components/ui';
import { useTheme } from '../context/ThemeContext';

export default function InitialSetup({ onSetupComplete }) {
  const { isDark, toggleDark } = useTheme();
  const [step, setStep] = useState(1); // 1: Admin, 2: Connection, 3: Settings

  // Step 1: Admin Credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Connection (Mandatory)
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [apiPassword, setApiPassword] = useState('');
  const [showApiToken, setShowApiToken] = useState(false);
  const [showApiPassword, setShowApiPassword] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [upgradeInfo, setUpgradeInfo] = useState(null);

  // Step 3: Setup Mode ('quick' | 'advanced')
  const [setupMode, setSetupMode] = useState('quick');
  const [openSections, setOpenSections] = useState({
    sync: true,
    security: false,
    cache: false,
    backup: false,
    captcha: false,
    isolation: false,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allSectionsOpen = Object.values(openSections).every(Boolean);
  const toggleAllSections = () => {
    const nextState = !allSectionsOpen;
    setOpenSections({
      sync: nextState,
      security: nextState,
      cache: nextState,
      backup: nextState,
      captcha: nextState,
      isolation: nextState,
    });
  };

  // Advanced Configurations
  const [captchaProvider, setCaptchaProvider] = useState('default');
  const [captchaSiteKey, setCaptchaSiteKey] = useState('');
  const [captchaSecretKey, setCaptchaSecretKey] = useState('');

  const [playlistSyncInterval, setPlaylistSyncInterval] = useState(6);
  const [expirySyncInterval, setExpirySyncInterval] = useState(12);

  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheAuthTTL, setCacheAuthTTL] = useState(15);
  const [cacheCategoriesTTL, setCacheCategoriesTTL] = useState(60);
  const [cacheStreamsTTL, setCacheStreamsTTL] = useState(15);

  const [antiBruteForceEnabled, setAntiBruteForceEnabled] = useState(true);
  const [antiBruteForceAttempts, setAntiBruteForceAttempts] = useState(5);
  const [antiBruteForceWindow, setAntiBruteForceWindow] = useState(15);
  const [antiBruteForceBanHours, setAntiBruteForceBanHours] = useState(24);
  const [multiIPDetection, setMultiIPDetection] = useState(true);
  const [throttleEnabled] = useState(true);

  const [backupEnabled, setBackupEnabled] = useState(true);
  const [backupInterval, setBackupInterval] = useState(24);
  const [backupRetentionDays, setBackupRetentionDays] = useState(30);

  const [adminHostname, setAdminHostname] = useState('');
  const [blockStreamingOnAdminHost, setBlockStreamingOnAdminHost] = useState(true);
  const [restrictAdminToAdminHost, setRestrictAdminToAdminHost] = useState(false);
  const [blockDirectIPStreaming] = useState(false);

  const [tmdbApiKey] = useState('');
  const [userDashboardTitle] = useState('Client Portal');

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Post-Setup Live Synchronization State
  const [isPostSetupSyncing, setIsPostSetupSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncEvents, setSyncEvents] = useState([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savedAdmin, setSavedAdmin] = useState(null);
  const [isSyncFinished, setIsSyncFinished] = useState(false);
  const logContainerRef = React.useRef(null);
  const setupStartTimeRef = React.useRef(Date.now());
  const isAutoScrollEnabledRef = React.useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);

  React.useEffect(() => {
    setupApi.getStatus().then((res) => {
      if (res?.default_api_url) {
        setApiUrl((prev) => (prev ? prev : res.default_api_url));
      }
    }).catch(() => { });
  }, []);

  // Trigger polling when in post-setup sync phase
  React.useEffect(() => {
    if (!isPostSetupSyncing) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    let pollAttempts = 0;
    let hasStarted = false;

    const poll = async () => {
      try {
        const [status, logs] = await Promise.all([
          playlistApi.getSyncStatus().catch(() => null),
          playlistApi.getAllSyncLogs().catch(() => []),
        ]);

        pollAttempts++;

        if (status) {
          setSyncStatus(status);
          if (status.is_running) {
            hasStarted = true;
          }

          if (status.step) {
            setSyncEvents((prev) => {
              if (prev.length === 0 || prev[prev.length - 1].text !== status.step) {
                const now = new Date();
                const timeStr = now.toTimeString().split(' ')[0];
                return [...prev, { time: timeStr, text: status.step }];
              }
              return prev;
            });
          }

          if (status.status === 'completed' || status.status === 'failed' || (hasStarted && !status.is_running)) {
            setIsSyncFinished(true);
          }
        }

        if (Array.isArray(logs)) {
          setSyncLogs(logs);
        }

        if (pollAttempts >= 1 && !hasStarted && (!status || (!status.is_running && status.status !== 'completed'))) {
          hasStarted = true;
          playlistApi.startAllSync(true).catch(() => { });
        }
      } catch (err) {
        console.warn('Sync polling error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(interval);
    };
  }, [isPostSetupSyncing]);

  const handleLogScroll = () => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight <= 45;
    isAutoScrollEnabledRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      isAutoScrollEnabledRef.current = true;
      setIsNearBottom(true);
    }
  };

  React.useEffect(() => {
    if (logContainerRef.current && isAutoScrollEnabledRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [syncEvents, syncLogs]);

  // Form Validations
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordTooShort = password && password.length < 6;
  const canContinueStep1 = username.trim().length > 0 && passwordsMatch && !passwordTooShort;

  // Live test connection
  const handleTestConnection = async () => {
    if (!apiUrl.trim() || !apiToken.trim()) {
      setConnectionError('Both Endpoint Base URL and Access Token are required to test the connection.');
      setUpgradeInfo(null);
      return;
    }

    setTestingConnection(true);
    setConnectionTested(false);
    setConnectionSuccess(false);
    setConnectionMessage('');
    setConnectionError('');
    setUpgradeInfo(null);

    try {
      const res = await setupApi.testConnection(apiUrl.trim(), apiToken.trim(), apiPassword.trim());
      if (res.success) {
        setConnectionTested(true);
        setConnectionSuccess(true);
        setConnectionMessage(res.message || `Successfully connected! Found ${res.playlists_count ?? 0} playlist(s).`);
      } else {
        setConnectionTested(true);
        setConnectionSuccess(false);
        if (res.code === 'PLAN_UPGRADE_REQUIRED') {
          setUpgradeInfo({
            title: res.title || 'Forbidden',
            body: res.body || 'Access requires an upgraded subscription plan.',
            code: res.code,
            upgrade_url: res.upgrade_url,
          });
        } else {
          setConnectionError(res.error || 'Connection failed. Please verify the URL and credentials.');
        }
      }
    } catch (err) {
      setConnectionTested(true);
      setConnectionSuccess(false);
      const errData = err.data || {};
      if (errData.code === 'PLAN_UPGRADE_REQUIRED') {
        setUpgradeInfo({
          title: errData.title || 'Forbidden',
          body: errData.body || 'Access requires an upgraded subscription plan.',
          code: errData.code,
          upgrade_url: errData.upgrade_url,
        });
      } else {
        setConnectionError(err.message || 'Network error while attempting to reach the API.');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  // Final submission
  const handleCompleteSetup = async (e) => {
    if (e) e.preventDefault();
    setSubmitError('');

    if (!passwordsMatch) {
      setSubmitError('Passwords do not match. Please verify your master administrator password.');
      setStep(1);
      return;
    }

    if (!connectionSuccess) {
      setSubmitError('Please verify your connection before finishing setup.');
      setStep(2);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      username: username.trim(),
      password,
      confirm_password: confirmPassword,
      api_url: apiUrl.trim(),
      api_token: apiToken.trim(),
      api_password: apiPassword.trim(),
      setup_mode: setupMode,

      captcha_provider: captchaProvider,
      captcha_site_key: captchaSiteKey.trim(),
      captcha_secret_key: captchaSecretKey.trim(),

      playlist_sync_interval_hours: Number(playlistSyncInterval) || 6,
      expiry_sync_interval_hours: Number(expirySyncInterval) || 12,

      cache_enabled: cacheEnabled,
      cache_auth_ttl_minutes: Number(cacheAuthTTL) || 15,
      cache_categories_ttl_minutes: Number(cacheCategoriesTTL) || 60,
      cache_streams_ttl_minutes: Number(cacheStreamsTTL) || 15,

      antibruteforce_enabled: antiBruteForceEnabled,
      antibruteforce_max_attempts: Number(antiBruteForceAttempts) || 5,
      antibruteforce_window_minutes: Number(antiBruteForceWindow) || 15,
      antibruteforce_ban_hours: Number(antiBruteForceBanHours) || 24,
      multi_ip_detection_enabled: multiIPDetection,
      throttle_enabled: throttleEnabled,

      backup_enabled: backupEnabled,
      backup_interval_hours: Number(backupInterval) || 24,
      backup_retention_days: Number(backupRetentionDays) || 30,

      tmdb_api_key: tmdbApiKey.trim(),
      user_dashboard_title: userDashboardTitle.trim(),

      admin_hostname: adminHostname.trim(),
      block_streaming_on_admin_host: blockStreamingOnAdminHost,
      restrict_admin_to_admin_host: restrictAdminToAdminHost,
      block_direct_ip_streaming: blockDirectIPStreaming,
    };

    try {
      setupStartTimeRef.current = Date.now();
      const data = await setupApi.initialize(payload);
      if (data.token) {
        setToken(data.token);
      }
      if (data.admin) {
        setAdmin(data.admin);
      }
      setSavedAdmin(data.admin);
      setIsPostSetupSyncing(true);
    } catch (err) {
      setSubmitError(err.message || 'Setup initialization failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPostSetupSyncing) {
    const isCompleted = isSyncFinished && syncStatus?.status !== 'failed';
    const isFailed = syncStatus?.status === 'failed';
    // Filter to only actual playlist logs created during this setup session
    const playlistLogs = syncLogs.filter((l) => {
      const logTime = new Date(l.created_at).getTime();
      if (logTime < setupStartTimeRef.current - 15000) return false;
      return l.sync_type === 'playlist' || (l.playlist_id != null && l.playlist_id > 0);
    });

    const totalChannels = playlistLogs.reduce((acc, l) => acc + (Number(l.channels_count) || 0), 0);
    const totalMovies = playlistLogs.reduce((acc, l) => acc + (Number(l.movies_count) || 0), 0);
    const totalSeries = playlistLogs.reduce((acc, l) => acc + (Number(l.series_count) || 0), 0);
    const totalPlaylists = playlistLogs.length;

    return (
      <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0f172a] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 text-[#525f7f] dark:text-slate-300 font-sans relative transition-colors duration-200">
        {/* Theme Toggle Button */}
        <div className="absolute top-4 right-4">
          <button
            type="button"
            onClick={toggleDark}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
        </div>

        <div className="max-w-3xl w-full space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl border mb-2 ${isCompleted
              ? 'bg-emerald-500/10 border-emerald-500/30 text-[#2dce89] dark:text-emerald-400'
              : isFailed
                ? 'bg-rose-500/10 border-rose-500/30 text-[#f5365c] dark:text-rose-400'
                : 'bg-blue-500/10 border-blue-500/30 text-[#3970e1] dark:text-blue-400'
              }`}>
              {isCompleted ? (
                <CheckCircle2 className="w-8 h-8" />
              ) : isFailed ? (
                <AlertCircle className="w-8 h-8" />
              ) : (
                <RefreshCw className="w-8 h-8 animate-spin" />
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#32325d] dark:text-white">
              {isCompleted
                ? 'Playlists Synchronized Successfully'
                : isFailed
                  ? 'Synchronization Encountered an Issue'
                  : 'Synchronizing Playlists from PlaylistLabs'}
            </h1>
            <p className="text-sm text-[#8898aa] dark:text-slate-400 max-w-lg mx-auto">
              {isCompleted
                ? 'Your administrator account has been created and all initial playlist libraries are ready.'
                : isFailed
                  ? (syncStatus?.error || 'Failed to download playlist contents. You can retry or proceed to the dashboard.')
                  : 'Please wait while the server downloads channels, VODs, series, and EPG schedules...'}
            </p>
          </div>

          {/* Current Step Banner & Elapsed Time */}
          <div className="bg-white dark:bg-slate-900/80 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCompleted ? 'bg-[#2dce89] dark:bg-emerald-400' : isFailed ? 'bg-[#f5365c] dark:bg-rose-400' : 'bg-[#3970e1] dark:bg-blue-400 animate-ping'
                }`} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8898aa] dark:text-slate-400">
                  {isCompleted ? 'Status' : isFailed ? 'Alert' : 'Current Step'}
                </div>
                <div className="text-sm font-medium text-[#32325d] dark:text-white truncate">
                  {isCompleted
                    ? 'All playlists up to date'
                    : isFailed
                      ? (syncStatus?.error || 'Sync stopped with error')
                      : (syncStatus?.step || 'Initializing background syncer...')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 px-3 py-1.5 rounded-lg text-xs font-mono text-[#525f7f] dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-[#8898aa] dark:text-slate-400" />
              <span>{elapsedSeconds}s elapsed</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900/60 border border-[#dee2e6] dark:border-slate-800/80 rounded-xl p-3.5 text-center shadow-xs">
              <div className="text-xs text-[#8898aa] dark:text-slate-400 mb-1">Playlists</div>
              <div className="text-xl font-bold text-[#32325d] dark:text-white font-mono">{totalPlaylists}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/60 border border-[#dee2e6] dark:border-slate-800/80 rounded-xl p-3.5 text-center shadow-xs">
              <div className="text-xs text-[#8898aa] dark:text-slate-400 mb-1 flex items-center justify-center gap-1">
                <Tv className="w-3.5 h-3.5 text-[#32325d] dark:text-white" /> Channels
              </div>
              <div className="text-xl font-bold text-[#32325d] dark:text-white font-mono">{totalChannels.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/60 border border-[#dee2e6] dark:border-slate-800/80 rounded-xl p-3.5 text-center shadow-xs">
              <div className="text-xs text-[#8898aa] dark:text-slate-400 mb-1 flex items-center justify-center gap-1">
                <Film className="w-3.5 h-3.5 text-[#32325d] dark:text-white" /> Movies (VOD)
              </div>
              <div className="text-xl font-bold text-[#32325d] dark:text-white font-mono">{totalMovies.toLocaleString()}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/60 border border-[#dee2e6] dark:border-slate-800/80 rounded-xl p-3.5 text-center shadow-xs">
              <div className="text-xs text-[#8898aa] dark:text-slate-400 mb-1 flex items-center justify-center gap-1">
                <Clapperboard className="w-3.5 h-3.5 text-[#32325d] dark:text-white" /> Series
              </div>
              <div className="text-xl font-bold text-[#32325d] dark:text-white font-mono">{totalSeries.toLocaleString()}</div>
            </div>
          </div>

          {/* Terminal-Style Real-time Sync Output */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <span className="text-xs font-mono text-slate-400 ml-2 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  sync_activity.log
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {syncEvents.length + syncLogs.length} events
              </div>
            </div>

            <div
              ref={logContainerRef}
              onScroll={handleLogScroll}
              className="p-4 font-mono text-xs max-h-72 min-h-[160px] overflow-y-auto space-y-2 bg-slate-950/80 text-slate-300 select-text"
            >
              {syncEvents.length === 0 && syncLogs.length === 0 && (
                <div className="text-slate-400 italic">Waiting for initial sync job to dispatch...</div>
              )}

              {syncEvents.map((evt, idx) => (
                <div key={`evt-${idx}`} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-400 shrink-0 select-none">[{evt.time}]</span>
                  <span className="text-blue-400 shrink-0">ℹ</span>
                  <span className="text-slate-200">{evt.text}</span>
                </div>
              ))}

              {playlistLogs.map((log, idx) => (
                <div key={`log-${idx}`} className="flex items-start gap-2 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800/60 my-1">
                  <span className="text-slate-400 shrink-0 select-none">
                    [{new Date(log.created_at || Date.now()).toLocaleTimeString()}]
                  </span>
                  <span className={log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                    {log.status === 'success' ? '✓' : '✗'}
                  </span>
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white">
                      {log.playlist_name || `Playlist #${log.playlist_id}`} — {log.status.toUpperCase()}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {log.channels_count} channels • {log.movies_count} movies • {log.series_count} series • {log.episodes_count} episodes • {log.epg_count} EPG programmes ({log.duration_ms}ms)
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Jump to bottom button when scrolled up */}
            {!isNearBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-medium rounded-full shadow-lg backdrop-blur border border-indigo-400/30 transition-all animate-bounce"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Jump to bottom</span>
              </button>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-xs text-[#8898aa] dark:text-slate-400 text-center sm:text-left">
              {isCompleted ? (
                <span className="text-[#2dce89] dark:text-emerald-400 font-medium">Ready to enter your management dashboard.</span>
              ) : isFailed ? (
                <span className="text-[#f5365c] dark:text-rose-400 font-medium">You can proceed now and re-trigger sync later in Settings.</span>
              ) : (
                <span>Downloading playlist contents in real time. You may enter now or wait for completion.</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSyncFinished(false);
                    playlistApi.startAllSync(true).catch(() => { });
                  }}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-[#525f7f] dark:text-slate-200 transition shadow-xs"
                >
                  Retry Sync
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (onSetupComplete) {
                    onSetupComplete(savedAdmin);
                  }
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition shadow-lg ${isCompleted
                  ? 'bg-[#2dce89] hover:bg-[#28b97b] text-white shadow-emerald-600/20'
                  : 'bg-[#3970e1] hover:bg-[#285bc7] text-white shadow-argon-btn'
                  }`}
              >
                <span>{isCompleted ? 'Enter Dashboard' : 'Continue to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fe] dark:bg-[#0f172a] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 text-[#525f7f] dark:text-slate-300 font-sans relative transition-colors duration-200">
      {/* Theme Toggle Button */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleDark}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      <div className="max-w-2xl w-full space-y-6">

        {/* Clean Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-[#3970e1] dark:text-blue-400 mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#32325d] dark:text-white">
            Initial Setup Wizard
          </h1>
          <p className="text-sm text-[#8898aa] dark:text-slate-400 max-w-md mx-auto">
            Complete this one-time configuration to secure and initialize your management instance.
          </p>
        </div>

        {/* Step Progress Tracker */}
        <nav aria-label="Progress" className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
          <ol className="grid grid-cols-3 gap-2">
            {[
              { num: 1, label: 'Admin Account', icon: Key },
              { num: 2, label: 'Connection', icon: Server },
              { num: 3, label: 'Configuration', icon: Sliders },
            ].map((s) => {
              const IconComponent = s.icon;
              const isPassed = step > s.num;
              const isCurrent = step === s.num;
              const isAccessible = s.num === 1 || (s.num === 2 && canContinueStep1) || (s.num === 3 && canContinueStep1 && connectionSuccess);

              return (
                <li key={s.num} className="flex items-center">
                  <button
                    type="button"
                    disabled={!isAccessible}
                    onClick={() => setStep(s.num)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition text-left ${isCurrent
                      ? 'bg-[#eef2ff] dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400 font-semibold'
                      : isPassed
                        ? 'text-[#2dce89] dark:text-emerald-400 hover:bg-[#f6f9fc] dark:hover:bg-slate-800/60 cursor-pointer'
                        : 'text-[#8898aa] dark:text-slate-500 opacity-60 cursor-not-allowed'
                      }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold shrink-0 transition ${isCurrent
                        ? 'bg-[#3970e1] text-white'
                        : isPassed
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-[#2dce89] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-[#8898aa] dark:text-slate-400'
                        }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <div className="hidden sm:block min-w-0">
                      <p className="text-xs text-[#8898aa] dark:text-slate-400 font-medium">Step {s.num}</p>
                      <p className="text-xs font-semibold truncate text-[#32325d] dark:text-white">{s.label}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Global Error Alert */}
        {submitError && (
          <div className="p-4 bg-[#fdf2f2] dark:bg-rose-950/50 border border-[#f5365c]/30 dark:border-rose-800/80 rounded-xl flex items-start gap-3 text-[#f5365c] dark:text-rose-200 text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-[#f5365c] dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#f5365c] dark:text-rose-300">Setup failed</p>
              <p className="mt-0.5 text-xs text-[#f5365c]/90 dark:text-rose-200/90">{submitError}</p>
            </div>
          </div>
        )}

        {/* Main Step Container */}
        <div className="bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl p-6 sm:p-8 shadow-sm">

          {/* STEP 1: MASTER ADMIN ACCOUNT */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-lg font-semibold text-[#32325d] dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#3970e1] dark:text-blue-400" />
                  1. Create Master Administrator
                </h2>
                <p className="text-sm text-[#8898aa] dark:text-slate-400 mt-1">
                  Define your primary administrator credentials. This account will have full administrative access to manage team members, playlists, and settings.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                    Admin Username <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full h-10 bg-white dark:bg-slate-950 border border-[#dee2e6] dark:border-slate-800 rounded-lg px-3.5 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 transition shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className={`w-full h-10 bg-white dark:bg-slate-950 border rounded-lg pl-3.5 pr-10 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none transition shadow-xs ${passwordTooShort
                          ? 'border-amber-500/80 focus:border-amber-500'
                          : 'border-[#dee2e6] dark:border-slate-800 focus:border-[#3970e1] dark:focus:border-blue-500'
                          }`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {passwordTooShort && (
                      <p className="text-xs text-amber-500 dark:text-amber-400 mt-1.5">
                        Password must be at least 6 characters long
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                      Confirm Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type password"
                        className={`w-full h-10 bg-white dark:bg-slate-950 border rounded-lg pl-3.5 pr-10 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-500 focus:outline-none transition shadow-xs ${confirmPassword && !passwordsMatch
                          ? 'border-rose-500 focus:border-rose-500'
                          : confirmPassword && passwordsMatch
                            ? 'border-[#2dce89] dark:border-emerald-500/80 focus:border-[#2dce89] dark:focus:border-emerald-500'
                            : 'border-[#dee2e6] dark:border-slate-800 focus:border-[#3970e1] dark:focus:border-blue-500'
                          }`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {confirmPassword && !passwordsMatch && (
                      <p className="text-xs text-rose-500 dark:text-rose-400 mt-1.5">
                        Passwords do not match
                      </p>
                    )}
                    {confirmPassword && passwordsMatch && (
                      <p className="text-xs text-[#2dce89] dark:text-emerald-400 mt-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end border-t border-[#dee2e6] dark:border-slate-800/80">
                <button
                  type="button"
                  disabled={!canContinueStep1}
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-[#3970e1] hover:bg-[#285bc7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition flex items-center gap-2 shadow-argon-btn"
                >
                  Continue to Connection
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONNECTION (MANDATORY) */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-lg font-semibold text-[#32325d] dark:text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-[#3970e1] dark:text-blue-400" />
                  2. PlaylistLabs Account Configuration
                </h2>
                <p className="text-sm text-[#8898aa] dark:text-slate-400 mt-1">
                  Connect your instance to the upstream PlaylistLabs account. A successful connection test is required to proceed.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                    Base Endpoint URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={apiUrl}
                    onChange={(e) => {
                      setApiUrl(e.target.value);
                      setConnectionSuccess(false);
                      setConnectionTested(false);
                    }}
                    placeholder="https://api.playlistlabs.io"
                    className="w-full h-10 bg-white dark:bg-slate-950 border border-[#dee2e6] dark:border-slate-800 rounded-lg px-3.5 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-600 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono transition shadow-xs"
                  />
                  <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                    Enter the base URL including protocol (e.g. <span className="font-mono text-[#525f7f] dark:text-slate-400">https://api.playlistlabs.io</span>).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                    Access Token <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showApiToken ? 'text' : 'password'}
                      required
                      value={apiToken}
                      onChange={(e) => {
                        setApiToken(e.target.value);
                        setConnectionSuccess(false);
                        setConnectionTested(false);
                      }}
                      placeholder="Paste your Access Token"
                      className="w-full h-10 bg-white dark:bg-slate-950 border border-[#dee2e6] dark:border-slate-800 rounded-lg pl-3.5 pr-10 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-600 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono transition shadow-xs"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowApiToken(!showApiToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-[#32325d] dark:text-slate-300">
                      Token Password <span className="text-[#8898aa] dark:text-slate-500 text-xs font-normal">(Optional)</span>
                    </label>
                    <span className="text-xs text-[#8898aa] dark:text-slate-500">
                      Only required if your token has password protection
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showApiPassword ? 'text' : 'password'}
                      value={apiPassword}
                      onChange={(e) => {
                        setApiPassword(e.target.value);
                        setConnectionSuccess(false);
                        setConnectionTested(false);
                      }}
                      placeholder="Enter token password (if required)"
                      className="w-full h-10 bg-white dark:bg-slate-950 border border-[#dee2e6] dark:border-slate-800 rounded-lg pl-3.5 pr-10 text-sm text-[#495057] dark:text-white placeholder-[#8898aa] dark:placeholder-slate-600 focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono transition shadow-xs"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowApiPassword(!showApiPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      {showApiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Connection Test Action & Result */}
                <div className="pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={testingConnection || !apiUrl.trim() || !apiToken.trim()}
                      onClick={handleTestConnection}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[#32325d] dark:text-white text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-2"
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#3970e1] dark:text-blue-400" />
                          Testing Connection...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 text-[#3970e1] dark:text-blue-400" />
                          Test Connection
                        </>
                      )}
                    </button>
                    {!connectionSuccess && (
                      <span className="text-xs text-[#8898aa] dark:text-slate-400">
                        Verification is required before proceeding.
                      </span>
                    )}
                  </div>

                  {connectionTested && connectionSuccess && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-lg flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-sm animate-in fade-in">
                      <CheckCircle2 className="w-5 h-5 text-[#2dce89] dark:text-emerald-400 shrink-0" />
                      <span>{connectionMessage}</span>
                    </div>
                  )}

                  {connectionTested && !connectionSuccess && upgradeInfo && (
                    <div className="mt-3 p-4 bg-gradient-to-r from-amber-50 via-purple-50/50 to-amber-50 dark:from-amber-950/40 dark:via-purple-950/30 dark:to-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-xl space-y-3 animate-in fade-in shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                          <TriangleAlert className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                              {upgradeInfo.title || 'Forbidden'}
                            </h4>
                          </div>
                          <p className="text-sm text-[#525f7f] dark:text-slate-300 mt-1 leading-relaxed">
                            {upgradeInfo.body}
                          </p>
                        </div>
                      </div>

                      {upgradeInfo.upgrade_url && (
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-500/20 flex justify-end">
                          <a
                            href={upgradeInfo.upgrade_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg shadow-sm transition active:scale-[0.98]"
                          >
                            <span>Upgrade Plan</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {connectionTested && !connectionSuccess && !upgradeInfo && (
                    <div className="mt-3 p-3 bg-[#fdf2f2] dark:bg-rose-950/40 border border-[#f5365c]/30 dark:border-rose-800/80 rounded-lg flex items-center gap-2.5 text-[#f5365c] dark:text-rose-300 text-sm animate-in fade-in">
                      <AlertCircle className="w-5 h-5 text-[#f5365c] dark:text-rose-400 shrink-0" />
                      <span>{connectionError}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-[#dee2e6] dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 font-medium text-sm rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  type="button"
                  disabled={!connectionSuccess}
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 bg-[#3970e1] hover:bg-[#285bc7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition flex items-center gap-2 shadow-argon-btn"
                >
                  Continue to Configuration
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIGURATION (QUICK VS ADVANCED) */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-lg font-semibold text-[#32325d] dark:text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-[#3970e1] dark:text-blue-400" />
                  3. System Configuration
                </h2>
                <p className="text-sm text-[#8898aa] dark:text-slate-400 mt-1">
                  Choose between recommended zero-configuration setup or customize advanced system parameters.
                </p>
              </div>

              {/* Mode Selection Toggle Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSetupMode('quick')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-2.5 ${setupMode === 'quick'
                    ? 'bg-blue-50/80 dark:bg-blue-600/10 border-[#3970e1] dark:border-blue-500 text-[#32325d] dark:text-white shadow-xs'
                    : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-[#525f7f] dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#32325d] dark:text-white">Quick Setup (Recommended)</span>
                    {setupMode === 'quick' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 dark:bg-blue-500/20 text-[#3970e1] dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8898aa] dark:text-slate-400 leading-relaxed">
                    Applies secure production defaults: 6h sync, anti-brute-force protection, daily backups, and built-in SVG captcha.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSetupMode('advanced')}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-2.5 ${setupMode === 'advanced'
                    ? 'bg-blue-50/80 dark:bg-blue-600/10 border-[#3970e1] dark:border-blue-500 text-[#32325d] dark:text-white shadow-xs'
                    : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-[#525f7f] dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#32325d] dark:text-white">Advanced Setup</span>
                    {setupMode === 'advanced' && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 dark:bg-blue-500/20 text-[#3970e1] dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8898aa] dark:text-slate-400 leading-relaxed">
                    Manually configure sync schedules, cache TTLs, external captcha keys, and hostname isolation rules.
                  </p>
                </button>
              </div>

              {/* QUICK SETUP SUMMARY */}
              {setupMode === 'quick' && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-semibold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider">
                    Included Production Defaults
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#525f7f] dark:text-slate-300">
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#2dce89] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-[#32325d] dark:text-white">Built-in SVG Captcha</span>
                        <p className="text-[#8898aa] dark:text-slate-400">Zero external API keys required.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#2dce89] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-[#32325d] dark:text-white">Automated Daily Backups</span>
                        <p className="text-[#8898aa] dark:text-slate-400">Scheduled every 24h with 30-day retention.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#2dce89] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-[#32325d] dark:text-white">Security & Throttling</span>
                        <p className="text-[#8898aa] dark:text-slate-400">5 failed attempts trigger a 24h IP block.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#2dce89] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-[#32325d] dark:text-white">High Performance Cache</span>
                        <p className="text-[#8898aa] dark:text-slate-400">Accelerates streaming authentication.</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-[#8898aa] dark:text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    All parameters can be modified at any time in the Admin Settings dashboard.
                  </p>
                </div>
              )}

              {/* ADVANCED SETUP VERTICAL ACCORDION */}
              {setupMode === 'advanced' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold text-[#8898aa] dark:text-slate-400 uppercase tracking-wider">
                      Advanced Parameters
                    </span>
                    <button
                      type="button"
                      onClick={toggleAllSections}
                      className="text-xs text-[#3970e1] dark:text-blue-400 hover:text-[#285bc7] dark:hover:text-blue-300 font-medium transition"
                    >
                      {allSectionsOpen ? 'Collapse All' : 'Expand All'}
                    </button>
                  </div>

                  {/* 1. Synchronization */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('sync')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.sync ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <RefreshCw className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Synchronization Schedules</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">Intervals for updating remote streams and user expirations</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {`Every ${playlistSyncInterval}h / ${expirySyncInterval}h`}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.sync ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.sync && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                              Playlist Synchronization Interval
                            </label>
                            <select
                              value={playlistSyncInterval}
                              onChange={(e) => setPlaylistSyncInterval(Number(e.target.value))}
                              className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                            >
                              <option value={1}>Every 1 hour</option>
                              <option value={2}>Every 2 hours</option>
                              <option value={4}>Every 4 hours</option>
                              <option value={6}>Every 6 hours (Recommended)</option>
                              <option value={12}>Every 12 hours</option>
                              <option value={24}>Every 24 hours</option>
                            </select>
                            <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                              Frequency of syncing remote streams and categories.
                            </p>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                              User Expiration Sync Interval
                            </label>
                            <select
                              value={expirySyncInterval}
                              onChange={(e) => setExpirySyncInterval(Number(e.target.value))}
                              className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                            >
                              <option value={6}>Every 6 hours</option>
                              <option value={12}>Every 12 hours (Recommended)</option>
                              <option value={24}>Every 24 hours</option>
                            </select>
                            <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                              Frequency of verifying customer expiration dates upstream.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Security & Anti-Brute-Force */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('security')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.security ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Security & Anti-Brute-Force</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">Failed login protection and account sharing detection</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {antiBruteForceEnabled ? `${antiBruteForceAttempts} att / ${antiBruteForceBanHours}h ban` : 'Disabled'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.security ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.security && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-[#32325d] dark:text-white">Anti-Brute-Force Protection</p>
                            <p className="text-xs text-[#8898aa] dark:text-slate-400">Automatically block IP addresses after repeated failed logins.</p>
                          </div>
                          <Switch
                            checked={antiBruteForceEnabled}
                            onCheckedChange={setAntiBruteForceEnabled}
                            aria-label="Anti-Brute-Force Protection"
                          />
                        </div>

                        {antiBruteForceEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Max Attempts</label>
                              <input
                                type="number"
                                min={3}
                                max={20}
                                value={antiBruteForceAttempts}
                                onChange={(e) => setAntiBruteForceAttempts(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Time Window (Min)</label>
                              <input
                                type="number"
                                min={5}
                                max={60}
                                value={antiBruteForceWindow}
                                onChange={(e) => setAntiBruteForceWindow(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Ban Duration (Hours)</label>
                              <input
                                type="number"
                                min={1}
                                max={168}
                                value={antiBruteForceBanHours}
                                onChange={(e) => setAntiBruteForceBanHours(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-[#32325d] dark:text-white">Multi-IP Subnet Detection</p>
                            <p className="text-xs text-[#8898aa] dark:text-slate-400">Detect and flag account sharing across disparate networks.</p>
                          </div>
                          <Switch
                            checked={multiIPDetection}
                            onCheckedChange={setMultiIPDetection}
                            aria-label="Multi-IP Subnet Detection"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Cache & Memory */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('cache')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.cache ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Cache & Memory</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">In-memory caching for player auth, categories and streams</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {cacheEnabled ? 'Active' : 'Disabled'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.cache ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.cache && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-[#32325d] dark:text-white">Enable In-Memory Caching</p>
                            <p className="text-xs text-[#8898aa] dark:text-slate-400">Accelerates streaming authentication and channel category loading.</p>
                          </div>
                          <Switch
                            checked={cacheEnabled}
                            onCheckedChange={setCacheEnabled}
                            aria-label="Enable In-Memory Caching"
                          />
                        </div>

                        {cacheEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Auth TTL (Min)</label>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={cacheAuthTTL}
                                onChange={(e) => setCacheAuthTTL(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Categories TTL (Min)</label>
                              <input
                                type="number"
                                min={5}
                                max={1440}
                                value={cacheCategoriesTTL}
                                onChange={(e) => setCacheCategoriesTTL(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Streams TTL (Min)</label>
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={cacheStreamsTTL}
                                onChange={(e) => setCacheStreamsTTL(e.target.value)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 4. Automated Backups */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('backup')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.backup ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Automated Backups</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">Regular snapshots of database configuration and user accounts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {backupEnabled ? `Every ${backupInterval}h (${backupRetentionDays}d)` : 'Disabled'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.backup ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.backup && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-[#32325d] dark:text-white">Automated Database Backups</p>
                            <p className="text-xs text-[#8898aa] dark:text-slate-400">Regularly export user data and system configurations.</p>
                          </div>
                          <Switch
                            checked={backupEnabled}
                            onCheckedChange={setBackupEnabled}
                            aria-label="Automated Database Backups"
                          />
                        </div>

                        {backupEnabled && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Backup Interval (Hours)</label>
                              <input
                                type="number"
                                min={1}
                                max={168}
                                value={backupInterval}
                                onChange={(e) => setBackupInterval(Number(e.target.value) || 24)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">Retention Window (Days)</label>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={backupRetentionDays}
                                onChange={(e) => setBackupRetentionDays(Number(e.target.value) || 30)}
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 5. Captcha Verification */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('captcha')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.captcha ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Captcha Verification</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">Anti-bot protection for client and admin login forms</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {captchaProvider === 'default' ? 'Built-in SVG' : captchaProvider === 'disabled' ? 'Disabled' : captchaProvider}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.captcha ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.captcha && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1.5">
                            Captcha Verification Service
                          </label>
                          <select
                            value={captchaProvider}
                            onChange={(e) => setCaptchaProvider(e.target.value)}
                            className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 shadow-xs"
                          >
                            <option value="default">Default Built-in SVG (Zero configuration required)</option>
                            <option value="turnstile">Cloudflare Turnstile</option>
                            <option value="recaptcha_v2">Google reCAPTCHA v2</option>
                            <option value="recaptcha_v3">Google reCAPTCHA v3</option>
                            <option value="hcaptcha">hCaptcha</option>
                            <option value="disabled">Disabled (Not Recommended)</option>
                          </select>
                        </div>

                        {captchaProvider !== 'default' && captchaProvider !== 'disabled' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">
                                Site Key <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={captchaSiteKey}
                                onChange={(e) => setCaptchaSiteKey(e.target.value)}
                                placeholder="Public Site Key"
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono shadow-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">
                                Secret Key <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="password"
                                value={captchaSecretKey}
                                onChange={(e) => setCaptchaSecretKey(e.target.value)}
                                placeholder="Private Secret Key"
                                className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono shadow-xs"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 6. Host Isolation */}
                  <div className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/70 rounded-xl overflow-hidden transition">
                    <button
                      type="button"
                      onClick={() => toggleSection('isolation')}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-900/50 transition text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg ${openSections.isolation ? 'bg-blue-100 dark:bg-blue-600/10 text-[#3970e1] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'}`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-[#32325d] dark:text-white">Domain & Hostname Isolation</h4>
                          <p className="text-xs text-[#8898aa] dark:text-slate-400">Dedicated management hostname routing and restrictions</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-white dark:bg-slate-900 text-[#525f7f] dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                          {adminHostname ? adminHostname : 'Disabled'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${openSections.isolation ? 'rotate-180 text-[#3970e1] dark:text-blue-400' : ''}`} />
                      </div>
                    </button>

                    {openSections.isolation && (
                      <div className="px-4 pb-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 animate-in fade-in space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-[#32325d] dark:text-slate-300 mb-1">
                            Dedicated Management Hostname (Optional)
                          </label>
                          <input
                            type="text"
                            value={adminHostname}
                            onChange={(e) => setAdminHostname(e.target.value)}
                            placeholder="e.g. panel.example.com"
                            className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 text-sm text-[#495057] dark:text-white focus:outline-none focus:border-[#3970e1] dark:focus:border-blue-500 font-mono shadow-xs"
                          />
                          <p className="text-xs text-[#8898aa] dark:text-slate-500 mt-1">
                            Only set this if your DNS and reverse proxy are already directed to this server.
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#32325d] dark:text-white">Block Streams on Admin Host</p>
                              <p className="text-xs text-[#8898aa] dark:text-slate-400">Refuse playback requests routed through the management domain.</p>
                            </div>
                            <Switch
                              checked={blockStreamingOnAdminHost}
                              onCheckedChange={setBlockStreamingOnAdminHost}
                              aria-label="Block Streams on Admin Host"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-[#32325d] dark:text-white">Strict Admin Hostname Access</p>
                              <p className="text-xs text-[#8898aa] dark:text-slate-400">Restrict access to the admin dashboard exclusively to this domain.</p>
                            </div>
                            <Switch
                              checked={restrictAdminToAdminHost}
                              onCheckedChange={setRestrictAdminToAdminHost}
                              aria-label="Strict Admin Hostname Access"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Final Step Navigation */}
              <div className="pt-4 flex justify-between items-center border-t border-[#dee2e6] dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-300 font-medium text-sm rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleCompleteSetup}
                  className="px-6 py-2.5 bg-[#2dce89] hover:bg-[#28b97b] disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition flex items-center gap-2 shadow-argon-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing Panel...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Setup & Launch
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
