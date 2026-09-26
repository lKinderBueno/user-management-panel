import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Info,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Terminal,
  Tv,
  Radio,
  Share2,
  Monitor,
  Sliders,
  Layers,
  Globe,
  Dices,
  KeyRound,
  Loader2,
  Edit3,
  X,
  Save,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  MapPin,
  Flame,
  FileCode,
  Sparkles
} from 'lucide-react';
import { userApi, geoApi, settingsApi, userPortalApi, getServerOrigin } from '../api/client';
import { Modal, Button, CopyableField } from './ui';
import { copyTextToClipboard } from '../utils/clipboard';
import { resolveStbUrl, resolveWebPlayerUrl, resolveProtocolHost } from '../utils/streamingUrls';

export const sanitizeToken = (val) => {
  let clean = String(val || '').trim();
  if (clean.includes('://')) {
    clean = clean.split('://')[1];
    const slashIdx = clean.indexOf('/');
    clean = slashIdx !== -1 ? clean.slice(slashIdx + 1) : '';
  }
  if (clean.includes('?')) {
    clean = clean.split('?')[0];
  }
  clean = clean.replace(/^\/+|\/+$/g, '');
  clean = clean.replace(/\.(m3u|xml|xml\.gz)$/i, '');
  return clean.trim();
};

/**
 * Generates random alphanumeric strings for username and password
 */
export function generateRandomCredential(isUsername = false) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz123456789';
  const length = isUsername ? 8 + Math.floor(Math.random() * 4) : 10 + Math.floor(Math.random() * 4);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode === 'LAN') return '📍';
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '📍';
  return String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ${diffMin % 60}m ago`;
}

/**
 * Master Info Dialog replicating PlaylistInfoDialog from playlistlabs5.
 * Supports both managed users (User Info) and playlists (Playlist Info).
 */
export default function PlaylistInfoDialog({
  user = null,
  playlist = null,
  open = true,
  onClose,
  onCustomizeM3u,
  onCredentialsUpdated,
}) {
  const [activeTab, setActiveTab] = useState('credentials');
  const [copiedKey, setCopiedKey] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Effective entity references
  const effectiveUsername = user?.username || playlist?.username || '';
  const effectivePassword = user?.password || playlist?.password || '';
  const listId = user?.list_id || playlist?.id;
  const titleName = user?.name || playlist?.name || 'Streaming Info';
  const playlistId = playlist?.id || user?.list_id || '';

  // Local credentials state for real-time reactivity
  const [localUsername, setLocalUsername] = useState(effectiveUsername);
  const [localPassword, setLocalPassword] = useState(effectivePassword);
  const [localM3u, setLocalM3u] = useState(user?.m3u || '');
  const [localEpg, setLocalEpg] = useState(user?.epg || '');

  useEffect(() => {
    setLocalUsername(user?.username || playlist?.username || '');
    setLocalPassword(user?.password || playlist?.password || '');
    setLocalM3u(user?.m3u || '');
    setLocalEpg(user?.epg || '');
  }, [user?.username, user?.password, user?.m3u, user?.epg, playlist?.username, playlist?.password]);

  // Inline Credential Editing state
  const [isEditingCredentials, setIsEditingCredentials] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editM3u, setEditM3u] = useState('');
  const [editEpg, setEditEpg] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [usernameError, setUsernameError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [m3uStatus, setM3uStatus] = useState({ checking: false, available: true, message: '' });
  const [epgStatus, setEpgStatus] = useState({ checking: false, available: true, message: '' });
  const [isValidatingUser, setIsValidatingUser] = useState(false);
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [credentialSuccessMsg, setCredentialSuccessMsg] = useState(null);

  // M3U & EPG Filters & Customization
  const [showFilters, setShowFilters] = useState(false);
  const [excludeChannels, setExcludeChannels] = useState(false);
  const [excludeMovies, setExcludeMovies] = useState(false);
  const [excludeSeries, setExcludeSeries] = useState(false);
  const [useGzip, setUseGzip] = useState(Boolean(playlist?.gzip));

  // Live Connections state (for managed users)
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(false);
  const [connError, setConnError] = useState(null);
  const [clearingKey, setClearingKey] = useState(null);
  const [geoInfo, setGeoInfo] = useState({});
  const [loadingGeo, setLoadingGeo] = useState({});
  const [geoError, setGeoError] = useState({});

  // Export checklist options
  const [exportOptions, setExportOptions] = useState({
    m3u: true,
    shortUrl: Boolean(user?.m3u),
    xtream: true,
    webPlayer: true,
    stalker: true,
    enigma: true,
    dreambox: true,
  });

  // Host isolation & system settings
  const [systemSettings, setSystemSettings] = useState(null);

  useEffect(() => {
    if (open) {
      settingsApi.getSettings()
        .then((res) => {
          setSystemSettings(res?.settings || res || {});
        })
        .catch(() => {
          userPortalApi.getConfig()
            .then((cfg) => setSystemSettings(cfg || {}))
            .catch(() => setSystemSettings({}));
        });
    }
  }, [open]);

  // Sync state when props change
  useEffect(() => {
    setLocalUsername(effectiveUsername);
    setLocalPassword(effectivePassword);
    setIsEditingCredentials(false);
    setUsernameError(null);
    setPasswordError(null);
    setCredentialSuccessMsg(null);
    if (playlist?.gzip) setUseGzip(Boolean(playlist.gzip));
  }, [effectiveUsername, effectivePassword, playlist?.gzip]);

  // Fetch active streaming connections for managed users
  const fetchConnections = useCallback(async () => {
    if (!listId || !user?.id) return;
    setLoadingConns(true);
    setConnError(null);
    try {
      const data = await userApi.getUserConnections(listId, user.id);
      setConnections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load user connections:', err);
      setConnError('Could not fetch active streaming connections');
    } finally {
      setLoadingConns(false);
    }
  }, [listId, user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchConnections();
    }
  }, [user?.id, fetchConnections]);

  const handleClearSession = async (deviceKey) => {
    if (!listId || !user?.id || !deviceKey) return;
    setClearingKey(deviceKey);
    try {
      await userApi.deleteConnection(listId, user.id, deviceKey);
      setConnections((prev) => prev.filter((c) => c.device_key !== deviceKey));
    } catch (err) {
      console.error('Failed to clear session:', err);
      alert('Failed to clear session record. Please try again.');
    } finally {
      setClearingKey(null);
    }
  };

  const handleLookupGeo = async (ip) => {
    if (!ip || loadingGeo[ip]) return;
    setLoadingGeo((prev) => ({ ...prev, [ip]: true }));
    setGeoError((prev) => ({ ...prev, [ip]: null }));
    try {
      const data = await geoApi.lookup(ip);
      if (data && (data.status === 'success' || data.country)) {
        const flag = getFlagEmoji(data.country_code);
        setGeoInfo((prev) => ({ ...prev, [ip]: { ...data, flag } }));
      } else {
        setGeoError((prev) => ({ ...prev, [ip]: data?.message || 'Lookup failed' }));
      }
    } catch (err) {
      console.error('Failed to lookup GeoIP:', err);
      setGeoError((prev) => ({ ...prev, [ip]: 'Lookup failed' }));
    } finally {
      setLoadingGeo((prev) => ({ ...prev, [ip]: false }));
    }
  };

  const handleCopy = async (text, key) => {
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  // --- Domain and Origin Resolution ---
  const rawCname = (playlist?.cname || '').trim();
  const primaryDomain = rawCname.split(/[\s,;]+/)[0] || '';
  const cnameClean = primaryDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const hasCname = cnameClean.length > 0;
  const isCnameSSL = Boolean(playlist?.cname_ssl || rawCname.startsWith('https://'));

  const protocolHost = useMemo(() => {
    return resolveProtocolHost({
      cname: playlist?.cname,
      cnameSSL: playlist?.cname_ssl,
    });
  }, [playlist?.cname, playlist?.cname_ssl]);

  // Query parameters for customized M3U / EPG
  const m3uQueryParams = [];
  if (excludeChannels) m3uQueryParams.push('channels=false');
  if (excludeMovies) m3uQueryParams.push('movies=false');
  if (excludeSeries) m3uQueryParams.push('series=false');
  const m3uQueryStr = m3uQueryParams.length > 0 ? `&${m3uQueryParams.join('&')}` : '';

  const epgQueryParams = [];
  if (useGzip) epgQueryParams.push('gzip=1');
  const epgQueryStr = epgQueryParams.length > 0 ? `&${epgQueryParams.join('&')}` : '';

  // Direct URLs
  const directM3uUrl = `${protocolHost}/get.php?username=${encodeURIComponent(localUsername)}&password=${encodeURIComponent(localPassword)}&type=m3u_plus${m3uQueryStr}`;
  const currentM3u = localM3u || user?.m3u;
  const shortM3uUrl = currentM3u ? `${protocolHost}/${currentM3u}${m3uQueryStr ? `?${m3uQueryParams.join('&')}` : ''}` : null;

  const directEpgUrl = `${protocolHost}/xmltv.php?username=${encodeURIComponent(localUsername)}&password=${encodeURIComponent(localPassword)}${epgQueryStr}`;
  const currentEpg = localEpg || user?.epg;
  const shortEpgUrl = currentEpg ? `${protocolHost}/${currentEpg}${epgQueryStr ? `?${epgQueryParams.join('&')}` : ''}` : null;

  // Enigma2 Telnet/SSH Auto-Install Script
  const enigmaScript = `wget -O /etc/enigma2/iptv.sh "${protocolHost}/get.php?username=${encodeURIComponent(localUsername)}&password=${encodeURIComponent(localPassword)}&type=enigma22_script&output=mpegts" && chmod 777 /etc/enigma2/iptv.sh && /etc/enigma2/iptv.sh`;

  // Dreambox Direct Bouquet URL
  const dreamboxUrl = `${protocolHost}/get.php?username=${encodeURIComponent(localUsername)}&password=${encodeURIComponent(localPassword)}&type=dreambox&output=ts`;

  // STB / Web Streaming Player URL resolution (stb.<hostname> or error if IP / locked)
  const effectiveCname = playlist?.cname || user?.cname || '';
  const effectiveCnameSSL = Boolean(playlist?.cname_ssl || user?.cname_ssl || isCnameSSL);

  const webPlayerResolution = useMemo(() => {
    return resolveWebPlayerUrl({
      cname: effectiveCname,
      cnameSSL: effectiveCnameSSL,
      username: localUsername,
      password: localPassword,
      settings: systemSettings,
      currentHostname: window.location.hostname,
      currentProtocol: window.location.protocol,
      currentPort: window.location.port,
    });
  }, [effectiveCname, effectiveCnameSSL, localUsername, localPassword, systemSettings]);

  const stbResolution = useMemo(() => {
    return resolveStbUrl({
      cname: effectiveCname,
      cnameSSL: effectiveCnameSSL,
      username: localUsername,
      password: localPassword,
      settings: systemSettings,
      currentHostname: window.location.hostname,
      currentProtocol: window.location.protocol,
      currentPort: window.location.port,
    });
  }, [effectiveCname, effectiveCnameSSL, localUsername, localPassword, systemSettings]);

  const webPlayerUrl = webPlayerResolution.url;
  const stalkerPortalUrl = stbResolution.url;
  const hasWebPlayerError = webPlayerResolution.isError;
  const hasStbError = stbResolution.isError;

  // --- Inline Credential Editing Handlers ---
  const handleStartEdit = () => {
    setEditUsername(localUsername);
    setEditPassword(localPassword);
    setEditM3u(localM3u || user?.m3u || '');
    setEditEpg(localEpg || user?.epg || '');
    setUsernameError(null);
    setPasswordError(null);
    setM3uStatus({ checking: false, available: true, message: 'Current' });
    setEpgStatus({ checking: false, available: true, message: 'Current' });
    setShowEditPassword(false);
    setIsEditingCredentials(true);
  };

  const handleCancelEdit = () => {
    setIsEditingCredentials(false);
    setUsernameError(null);
    setPasswordError(null);
  };

  // Debounced Short M3U URL check
  useEffect(() => {
    if (!isEditingCredentials || !user?.id) return;
    const clean = sanitizeToken(editM3u);
    if (!clean) {
      setM3uStatus({ checking: false, available: false, message: 'Short M3U URL is required' });
      return;
    }
    const cleanSibling = sanitizeToken(editEpg);
    if (cleanSibling && clean === cleanSibling) {
      setM3uStatus({ checking: false, available: false, message: 'Cannot match Short EPG URL' });
      return;
    }
    if (clean === (localM3u || user.m3u)) {
      setM3uStatus({ checking: false, available: true, message: 'Current' });
      return;
    }

    setM3uStatus({ checking: true, available: false, message: 'Checking...' });
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkShortUrl(clean, 'm3u', listId, user.id, cleanSibling);
        if (res.available) {
          setM3uStatus({ checking: false, available: true, message: res.message || 'Available' });
        } else {
          setM3uStatus({ checking: false, available: false, message: res.message || 'Already taken' });
        }
      } catch {
        setM3uStatus({ checking: false, available: false, message: 'Verification error' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [editM3u, editEpg, isEditingCredentials, listId, user?.id, localM3u, user?.m3u]);

  // Debounced Short EPG URL check
  useEffect(() => {
    if (!isEditingCredentials || !user?.id) return;
    const clean = sanitizeToken(editEpg);
    if (!clean) {
      setEpgStatus({ checking: false, available: false, message: 'Short EPG URL is required' });
      return;
    }
    const cleanSibling = sanitizeToken(editM3u);
    if (cleanSibling && clean === cleanSibling) {
      setEpgStatus({ checking: false, available: false, message: 'Cannot match Short M3U URL' });
      return;
    }
    if (clean === (localEpg || user.epg)) {
      setEpgStatus({ checking: false, available: true, message: 'Current' });
      return;
    }

    setEpgStatus({ checking: true, available: false, message: 'Checking...' });
    const timer = setTimeout(async () => {
      try {
        const res = await userApi.checkShortUrl(clean, 'epg', listId, user.id, cleanSibling);
        if (res.available) {
          setEpgStatus({ checking: false, available: true, message: res.message || 'Available' });
        } else {
          setEpgStatus({ checking: false, available: false, message: res.message || 'Already taken' });
        }
      } catch {
        setEpgStatus({ checking: false, available: false, message: 'Verification error' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [editEpg, editM3u, isEditingCredentials, listId, user?.id, localEpg, user?.epg]);

  const handleGenerateRandomUser = async () => {
    const randomUser = generateRandomCredential(true);
    setEditUsername(randomUser);
    setUsernameError(null);
    if (!listId || !user?.id) return;

    setIsValidatingUser(true);
    try {
      const res = await userApi.checkUsername(randomUser, listId, user.id);
      if (!res.available) {
        setUsernameError(res.message || 'Username already taken');
      }
    } catch {
      // ignore
    } finally {
      setIsValidatingUser(false);
    }
  };

  const handleGenerateRandomPass = () => {
    const randomPass = generateRandomCredential(false);
    setEditPassword(randomPass);
    setPasswordError(null);
    setShowEditPassword(true);
  };

  const handleGenerateRandomM3u = async () => {
    try {
      const res = await userApi.generateRandom('m3u');
      if (res?.value) setEditM3u(res.value);
    } catch {
      // ignore
    }
  };

  const handleGenerateRandomEpg = async () => {
    try {
      const res = await userApi.generateRandom('epg');
      if (res?.value) setEditEpg(res.value);
    } catch {
      // ignore
    }
  };

  const handleUsernameChange = (val) => {
    const clean = val.trim();
    setEditUsername(clean);
    if (clean.length < 3) {
      setUsernameError('Username must have at least 3 characters');
    } else {
      setUsernameError(null);
    }
  };

  const handleUsernameBlur = async () => {
    const clean = editUsername.trim();
    if (clean.length >= 3 && clean !== localUsername && listId && user?.id) {
      setIsValidatingUser(true);
      try {
        const res = await userApi.checkUsername(clean, listId, user.id);
        if (!res.available) {
          setUsernameError(res.message || 'Username already taken');
        } else {
          setUsernameError(null);
        }
      } catch {
        // ignore
      } finally {
        setIsValidatingUser(false);
      }
    }
  };

  const handlePasswordChange = (val) => {
    const clean = val.trim();
    setEditPassword(clean);
    if (clean.length < 3) {
      setPasswordError('Password must have at least 3 characters');
    } else {
      setPasswordError(null);
    }
  };

  const isFormValid =
    editUsername.trim().length >= 3 &&
    editPassword.trim().length >= 3 &&
    (!user ? true : (
      sanitizeToken(editM3u).length >= 3 &&
      sanitizeToken(editEpg).length >= 3 &&
      sanitizeToken(editM3u) !== sanitizeToken(editEpg) &&
      m3uStatus.available &&
      epgStatus.available &&
      !m3uStatus.checking &&
      !epgStatus.checking
    )) &&
    !usernameError &&
    !passwordError &&
    !isValidatingUser;

  const handleSaveCredentials = async (e) => {
    if (e) e.preventDefault();
    if (!isFormValid || isSavingCredentials) return;

    if (!listId || !user?.id) {
      // Local state update only if no backend user ID
      setLocalUsername(editUsername.trim());
      setLocalPassword(editPassword.trim());
      setIsEditingCredentials(false);
      return;
    }

    setIsSavingCredentials(true);
    try {
      const cleanM3u = sanitizeToken(editM3u);
      const cleanEpg = sanitizeToken(editEpg);
      const updated = await userApi.updateCredentials(listId, user.id, {
        username: editUsername.trim(),
        password: editPassword.trim(),
        m3u: cleanM3u,
        epg: cleanEpg,
      });
      setLocalUsername(editUsername.trim());
      setLocalPassword(editPassword.trim());
      setLocalM3u(cleanM3u);
      setLocalEpg(cleanEpg);
      if (user) {
        user.username = editUsername.trim();
        user.password = editPassword.trim();
        user.m3u = cleanM3u;
        user.epg = cleanEpg;
      }
      onCredentialsUpdated?.(updated || {
        ...user,
        id: user.id,
        username: editUsername.trim(),
        password: editPassword.trim(),
        m3u: cleanM3u,
        epg: cleanEpg,
      });
      setIsEditingCredentials(false);
      setCredentialSuccessMsg('Credentials saved successfully!');
      setTimeout(() => setCredentialSuccessMsg(null), 3500);
    } catch (err) {
      setUsernameError(err?.message || 'Failed to update credentials');
    } finally {
      setIsSavingCredentials(false);
    }
  };

  // --- Formatted Customer Export Text Generator ---
  const generateExportText = () => {
    const lines = [];
    lines.push(`=== ${titleName} ===\n`);

    if (exportOptions.xtream) {
      lines.push(`Xtream Codes Server: ${protocolHost}`);
      lines.push(`Username: ${localUsername}`);
      lines.push(`Password: ${localPassword}\n`);
    }

    if (exportOptions.m3u) {
      if (exportOptions.shortUrl && shortM3uUrl) {
        lines.push(`M3U URL: ${shortM3uUrl}`);
        lines.push(`EPG URL: ${shortEpgUrl || directEpgUrl}\n`);
      } else {
        lines.push(`M3U URL: ${directM3uUrl}`);
        lines.push(`EPG URL: ${directEpgUrl}\n`);
      }
    }

    if (exportOptions.webPlayer) {
      lines.push(`Web Player: ${webPlayerUrl}`);
      if (!exportOptions.xtream) {
        lines.push(`Username: ${localUsername}`);
        lines.push(`Password: ${localPassword}`);
      }
      lines.push('');
    }

    if (exportOptions.stalker) {
      lines.push(`MAG / Stalker STB Portal: ${stalkerPortalUrl}`);
      lines.push(`Username: ${localUsername}`);
      lines.push(`Password: ${localPassword}\n`);
    }

    if (exportOptions.enigma) {
      lines.push(`Enigma2 Script:\n${enigmaScript}\n`);
    }

    if (exportOptions.dreambox) {
      lines.push(`Dreambox Bouquet:\n${dreamboxUrl}\n`);
    }

    return lines.join('\n').trim();
  };

  const exportText = generateExportText();

  // Sidebar Tabs definition
  const tabs = [
    {
      id: 'credentials',
      label: 'Credentials & URLs',
      desc: 'Xtream, M3U, EPG & Dreambox',
      icon: <KeyRound className="h-4 w-4" />,
    },
    {
      id: 'player',
      label: 'Web Player & STB',
      desc: 'Browser player & MAG Portal',
      icon: <Monitor className="h-4 w-4" />,
    },
    {
      id: 'export',
      label: 'Share & Export',
      desc: 'Formatted text for customers',
      icon: <Share2 className="h-4 w-4" />,
    },
    ...(user
      ? [
        {
          id: 'connections',
          label: 'Live Sessions',
          desc: `${connections.length} active connection${connections.length === 1 ? '' : 's'}`,
          icon: <Flame className="h-4 w-4" />,
          badge: connections.length > 0 ? connections.length : null,
        },
      ]
      : []),
  ];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="5xl"
      className="!w-[95vw] h-[90vh] max-h-[840px] min-h-[520px] flex flex-col !p-0 !rounded-2xl"
    >
      {/* Pinned Top Header */}
      <div className="shrink-0 border-b border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#3970e1] to-[#5e72e4] text-white shadow-xs">
            <Info className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[#344767] dark:text-white truncate">
                {titleName}
              </h3>
              {user && (
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[12px] font-bold text-[#3970e1] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                  ID: #{user.id}
                </span>
              )}
              {hasCname && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[12px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  CNAME: {cnameClean}
                </span>
              )}
              {hasCname && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[12px] font-bold border ${playlist?.enforce_cname
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  title={
                    playlist?.enforce_cname
                      ? 'Enforced: Only connections via this CNAME are permitted'
                      : 'Not enforced: Direct server connections are also permitted'
                  }
                >
                  Enforce CNAME: {playlist?.enforce_cname ? 'Active' : 'Disabled'}
                </span>
              )}
              {user?.created_by_username && (
                <span className="text-[12px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                  By: {user.created_by_username}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              Access credentials, streaming links, STB portal, and client export.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <div className="w-56 sm:w-64 shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3 flex flex-col gap-1.5 overflow-y-auto">
          <div className="px-2 py-1 text-[12px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Sections
          </div>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-left text-xs transition-all border outline-none ${isActive
                  ? 'bg-white dark:bg-slate-800 text-[#3970e1] dark:text-[#63b3ed] font-bold shadow-xs border-slate-200/80 dark:border-slate-700'
                  : 'border-transparent text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isActive
                      ? 'bg-[#3970e1]/10 text-[#3970e1] dark:bg-blue-500/20 dark:text-[#63b3ed]'
                      : 'bg-slate-200/60 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold leading-tight">{tab.label}</div>
                    <div className="truncate text-[13px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
                      {tab.desc}
                    </div>
                  </div>
                </div>

                {tab.badge != null && (
                  <span className="flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-[12px] shrink-0 ml-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Main Content Panel */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto min-h-0 bg-white dark:bg-slate-900 space-y-5">
          {/* ========================================================================= */}
          {/* TAB 1: CREDENTIALS & URLS */}
          {/* ========================================================================= */}
          {activeTab === 'credentials' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Success Banner */}
              {credentialSuccessMsg && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{credentialSuccessMsg}</span>
                </div>
              )}

              {/* 1. Server Access & Xtream Codes Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-[#3970e1]" />
                    <h4 className="text-xs font-bold text-[#344767] dark:text-white uppercase tracking-wider">
                      Server & Xtream Codes API
                    </h4>
                  </div>
                  {!isEditingCredentials && user && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="h-7 text-xs font-semibold px-2.5 rounded-lg flex items-center gap-1.5 transition text-[#3970e1] hover:text-[#2d5ec7] bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:text-white dark:border-blue-700/50 dark:hover:bg-blue-900/60"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Credentials</span>
                    </button>
                  )}
                </div>

                {/* Server Host URL */}
                <CopyableField
                  label="Server Address / DNS"
                  rightLabel={
                    hasCname ? (
                      <span>
                        Custom CNAME {playlist?.enforce_cname ? '(Enforced)' : '(Direct also allowed)'}
                      </span>
                    ) : null
                  }
                  value={protocolHost}
                  variant="admin"
                />

                {/* Username & Password */}
                {!isEditingCredentials ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Username Readonly */}
                    <CopyableField
                      label="Username"
                      value={localUsername}
                      inputClassName="font-semibold"
                      variant="admin"
                    />

                    {/* Password Readonly */}
                    <CopyableField
                      label="Password"
                      rightLabel={
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs flex items-center gap-1 transition"
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{showPassword ? 'Hide' : 'Show'}</span>
                        </button>
                      }
                      type={showPassword ? 'text' : 'password'}
                      value={localPassword}
                      inputClassName="font-semibold"
                      variant="admin"
                    />
                  </div>
                ) : (
                  /* Inline Editing Mode */
                  <form
                    onSubmit={handleSaveCredentials}
                    className="rounded-xl border border-[#3970e1]/30 bg-white p-3.5 dark:border-[#3970e1]/40 dark:bg-slate-900/90 space-y-3 shadow-xs animate-in fade-in-50"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-[#3970e1] flex items-center gap-1.5">
                        <Edit3 className="h-3.5 w-3.5" />
                        Modify Credentials
                      </span>
                      <span className="text-[13px] text-slate-400">Min. 3 characters</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Username Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between h-5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Username
                          </label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editUsername}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            onBlur={handleUsernameBlur}
                            placeholder="Username"
                            required
                            className={`font-mono text-xs h-9 flex-1 px-3 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none ${usernameError
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                              : 'border-slate-200 dark:border-slate-700'
                              }`}
                          />
                          <button
                            type="button"
                            onClick={handleGenerateRandomUser}
                            title="Generate random username"
                            className="h-9 px-2.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                          >
                            <Dices className="h-4 w-4 text-[#3970e1] dark:text-blue-400" />
                          </button>
                        </div>
                        {isValidatingUser && (
                          <p className="text-[13px] text-slate-400 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking availability...
                          </p>
                        )}
                        {usernameError && (
                          <p className="text-[13px] text-red-500 font-medium">{usernameError}</p>
                        )}
                      </div>

                      {/* Password Input */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between h-5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowEditPassword(!showEditPassword)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs flex items-center gap-1 transition"
                          >
                            {showEditPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            <span>{showEditPassword ? 'Hide' : 'Show'}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type={showEditPassword ? 'text' : 'password'}
                            value={editPassword}
                            onChange={(e) => handlePasswordChange(e.target.value)}
                            placeholder="Password"
                            required
                            className={`font-mono text-xs h-9 flex-1 px-3 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none ${passwordError
                              ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                              : 'border-slate-200 dark:border-slate-700'
                              }`}
                          />
                          <button
                            type="button"
                            onClick={handleGenerateRandomPass}
                            title="Generate random password"
                            className="h-9 px-2.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                          >
                            <Dices className="h-4 w-4 text-[#3970e1]" />
                          </button>
                        </div>
                        {passwordError && (
                          <p className="text-[13px] text-red-500 font-medium">{passwordError}</p>
                        )}
                      </div>

                      {/* Short M3U URL Input */}
                      {user && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Radio className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Short M3U URL</span>
                            </label>
                            <div className="flex items-center gap-1 text-[13px] font-semibold">
                              {m3uStatus.checking ? (
                                <span className="text-[#8898aa] dark:text-slate-400 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                                </span>
                              ) : m3uStatus.available ? (
                                <span className="text-[#2dce89] flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> {m3uStatus.message}
                                </span>
                              ) : (
                                <span className="text-[#f5365c] flex items-center gap-0.5" title={m3uStatus.message}>
                                  <AlertCircle className="w-3 h-3" /> {m3uStatus.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              value={editM3u}
                              onChange={(e) => setEditM3u(e.target.value)}
                              placeholder="Short M3U token or URL"
                              required
                              className={`font-mono text-xs h-9 flex-1 px-3 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none ${!m3uStatus.available && !m3uStatus.checking
                                ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                                : 'border-slate-200 dark:border-slate-700'
                                }`}
                            />
                            <button
                              type="button"
                              onClick={handleGenerateRandomM3u}
                              title="Generate random Short M3U token"
                              className="h-9 px-2.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                            >
                              <Dices className="h-4 w-4 text-[#3970e1]" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Short EPG URL Input */}
                      {user && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between h-5">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <Tv className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Short EPG URL</span>
                            </label>
                            <div className="flex items-center gap-1 text-[13px] font-semibold">
                              {epgStatus.checking ? (
                                <span className="text-[#8898aa] dark:text-slate-400 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                                </span>
                              ) : epgStatus.available ? (
                                <span className="text-[#2dce89] flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> {epgStatus.message}
                                </span>
                              ) : (
                                <span className="text-[#f5365c] flex items-center gap-0.5" title={epgStatus.message}>
                                  <AlertCircle className="w-3 h-3" /> {epgStatus.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              value={editEpg}
                              onChange={(e) => setEditEpg(e.target.value)}
                              placeholder="Short EPG token or URL"
                              required
                              className={`font-mono text-xs h-9 flex-1 px-3 rounded-lg border bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none ${!epgStatus.available && !epgStatus.checking
                                ? 'border-red-500 focus:ring-1 focus:ring-red-500'
                                : 'border-slate-200 dark:border-slate-700'
                                }`}
                            />
                            <button
                              type="button"
                              onClick={handleGenerateRandomEpg}
                              title="Generate random Short EPG token"
                              className="h-9 px-2.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                            >
                              <Dices className="h-4 w-4 text-[#3970e1]" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSavingCredentials}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!isFormValid || isSavingCredentials}
                        className="px-4 py-1.5 rounded-lg bg-[#3970e1] hover:bg-[#2d5ec7] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                      >
                        {isSavingCredentials ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* 2. Direct M3U & EPG URLs Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-indigo-500" />
                    <h4 className="text-xs font-bold text-[#344767] dark:text-white uppercase tracking-wider">
                      Direct M3U & EPG URLs
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    className="h-7 text-xs font-semibold px-2.5 rounded-lg flex items-center gap-1.5 transition text-[#3970e1] hover:text-[#2d5ec7] bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:text-white dark:border-blue-700/50 dark:hover:bg-blue-900/60"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    <span>{showFilters ? 'Hide Filters' : 'Customize Filters & EPG'}</span>
                  </button>
                </div>

                {/* M3U Direct URL */}
                <CopyableField
                  label="M3U Plus URL"
                  value={directM3uUrl}
                  variant="admin"
                  actionButton={
                    <button
                      type="button"
                      onClick={() => window.open(directM3uUrl, '_blank')}
                      title="Download M3U Playlist file"
                      className="h-9 px-3 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>.m3u</span>
                    </button>
                  }
                />

                {/* Short M3U URL (if present) */}
                {shortM3uUrl && (
                  <CopyableField
                    label="Short M3U URL"
                    value={shortM3uUrl}
                    variant="admin"
                  />
                )}

                {/* EPG XMLTV Direct URL */}
                <CopyableField
                  label="EPG XMLTV URL"
                  value={directEpgUrl}
                  variant="admin"
                />

                {/* Short EPG URL (if present) */}
                {shortEpgUrl && (
                  <CopyableField
                    label="Short EPG URL"
                    value={shortEpgUrl}
                    variant="admin"
                  />
                )}

                {/* Expandable M3U & EPG Filter Options */}
                {showFilters && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-2.5 text-xs animate-in fade-in-50">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">
                      Stream & EPG Output Customization
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition">
                        <input
                          type="checkbox"
                          checked={excludeChannels}
                          onChange={(e) => setExcludeChannels(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-[#3970e1]"
                        />
                        <span>Exclude Live Channels</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition">
                        <input
                          type="checkbox"
                          checked={excludeMovies}
                          onChange={(e) => setExcludeMovies(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-[#3970e1]"
                        />
                        <span>Exclude Movies (VOD)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition">
                        <input
                          type="checkbox"
                          checked={excludeSeries}
                          onChange={(e) => setExcludeSeries(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-[#3970e1]"
                        />
                        <span>Exclude Series</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer select-none hover:text-slate-900 dark:hover:text-white transition">
                        <input
                          type="checkbox"
                          checked={useGzip}
                          onChange={(e) => setUseGzip(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#3970e1] focus:ring-[#3970e1]"
                        />
                        <span>Gzip Compression (.xml.gz)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Enigma2 Auto-Install Script */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <label className="text-xs font-bold text-[#344767] dark:text-slate-200 uppercase tracking-wider">
                    Enigma2 Auto-Install Script (Telnet / SSH)
                  </label>
                </div>
                <CopyableField
                  value={enigmaScript}
                  variant="admin"
                />
                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                  Paste this one-line command into Putty / Terminal to automatically configure Enigma2 bouquets.
                </p>
              </div>

              {/* 4. Dreambox Direct Bouquet Download */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-indigo-500" />
                  <label className="text-xs font-bold text-[#344767] dark:text-slate-200 uppercase tracking-wider">
                    Dreambox Direct Bouquet URL
                  </label>
                </div>
                <CopyableField
                  value={dreamboxUrl}
                  variant="admin"
                  actionButton={
                    <button
                      type="button"
                      onClick={() => window.open(dreamboxUrl, '_blank')}
                      title="Download Dreambox bouquet"
                      className="h-9 px-3 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Bouquet</span>
                    </button>
                  }
                />
              </div>

              {/* 5. Domain / CNAME Status Footer Banner */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#3970e1]" />
                  <span>
                    {hasCname
                      ? `Active CNAME Domain: ${cnameClean}`
                      : 'Standard server domain active. Configure a custom CNAME in Settings if needed.'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[12px] font-semibold ${hasCname
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                >
                  {hasCname ? 'Custom Domain' : 'Default Host'}
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: WEB PLAYER & STB */}
          {/* ========================================================================= */}
          {activeTab === 'player' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              {/* Web Player Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-800/40 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#3970e1] to-[#5e72e4] text-white shadow-xs">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Web Streaming Player
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Stream directly in any modern browser without installing external software.
                    </p>
                  </div>
                </div>

                <CopyableField
                  value={webPlayerUrl}
                  variant="admin"
                  actionButton={
                    <button
                      type="button"
                      disabled={hasWebPlayerError}
                      onClick={() => !hasWebPlayerError && window.open(webPlayerUrl, '_blank')}
                      className={`h-9 px-4 shrink-0 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs ${hasWebPlayerError
                        ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                        : 'bg-[#3970e1] hover:bg-[#2d5ec7] active:scale-98'
                        }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open Player</span>
                    </button>
                  }
                />
                {hasWebPlayerError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{webPlayerResolution.errorMessage}</span>
                  </div>
                )}
              </div>

              {/* MAG / Stalker Portal Card */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-800/40 space-y-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                    <Tv className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      MAG / Stalker STB Portal
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Portal URL for dedicated STB set-top boxes (MAG 250/254/322, TVIP) and portal emulators (STB Emu).
                    </p>
                  </div>
                </div>

                <CopyableField
                  value={stalkerPortalUrl}
                  variant="admin"
                />
                {hasStbError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{stbResolution.errorMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: SHARE & EXPORT */}
          {/* ========================================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Share & Export Credentials
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select which link details to include to generate a formatted text message ready for customer delivery.
                </p>
              </div>

              {/* Checklist Customizer */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.xtream}
                    onChange={(e) => setExportOptions({ ...exportOptions, xtream: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">Xtream Codes API</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.m3u}
                    onChange={(e) => setExportOptions({ ...exportOptions, m3u: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">M3U & EPG</span>
                </label>

                {exportOptions.m3u && user?.m3u && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-500 select-none">
                    <input
                      type="checkbox"
                      checked={exportOptions.shortUrl}
                      onChange={(e) => setExportOptions({ ...exportOptions, shortUrl: e.target.checked })}
                      className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                    />
                    <span>Short URLs</span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.webPlayer}
                    onChange={(e) => setExportOptions({ ...exportOptions, webPlayer: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">Web Player</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.stalker}
                    onChange={(e) => setExportOptions({ ...exportOptions, stalker: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">MAG / Stalker</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.enigma}
                    onChange={(e) => setExportOptions({ ...exportOptions, enigma: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">Enigma2</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportOptions.dreambox}
                    onChange={(e) => setExportOptions({ ...exportOptions, dreambox: e.target.checked })}
                    className="rounded border-slate-300 text-[#3970e1] focus:ring-[#3970e1]"
                  />
                  <span className="font-semibold text-xs">Dreambox</span>
                </label>
              </div>

              {/* Formatted Output Preview */}
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 dark:border-slate-800 dark:bg-slate-950 shadow-inner">
                  <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {exportText}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(exportText, 'export-all')}
                  className="w-full h-10 rounded-xl bg-[#3970e1] hover:bg-[#2d5ec7] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
                >
                  {copiedKey === 'export-all' ? (
                    <Check className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span>
                    {copiedKey === 'export-all'
                      ? 'Copied to Clipboard!'
                      : 'Copy Formatted Credentials'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: LIVE SESSIONS (FOR MANAGED USERS) */}
          {/* ========================================================================= */}
          {activeTab === 'connections' && user && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Live Streaming Sessions
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time active streams and connected client devices.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchConnections}
                  disabled={loadingConns}
                  title="Refresh active sessions"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  <RotateCcw className={`w-4 h-4 ${loadingConns ? 'animate-spin text-[#3970e1]' : ''}`} />
                </button>
              </div>

              {/* Header Status Bar */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    {connections.length > 0 && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connections.length > 0 ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                    ></span>
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Active Connections: {connections.length} / {user.max_connections || 1}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {playlist?.limit_max_connections && (
                    <span className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[12px] font-semibold px-2 py-0.5 rounded">
                      Limit Enforced
                    </span>
                  )}
                  {connections.length > (user.max_connections || 1) && (
                    <span className="bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-[12px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Over Limit
                    </span>
                  )}
                </div>
              </div>

              {/* Connections List */}
              {loadingConns && connections.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Checking active streaming connections...
                </div>
              ) : connections.length > 0 ? (
                <div className="space-y-2.5">
                  {connections.map((conn) => (
                    <div
                      key={conn.device_key}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[420px]">
                              {conn.stream_name || `Stream #${conn.stream_id}`}
                            </span>
                            <span className="text-[12px] font-bold uppercase px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400 rounded border border-blue-200/50 dark:border-blue-800/40">
                              {conn.stream_type || 'live'}{conn.container_extension ? ` · .${conn.container_extension}` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearSession(conn.device_key)}
                          disabled={clearingKey === conn.device_key}
                          className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-rose-800/60 rounded-lg transition flex items-center gap-1 shrink-0 disabled:opacity-50"
                          title="Clear active session record (releases connection slot if stuck)"
                        >
                          {clearingKey === conn.device_key ? (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                          <span>Clear</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-800 dark:text-slate-200 truncate select-all">
                            {conn.ip}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(conn.ip, `ip_${conn.device_key}`)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Copy IP"
                          >
                            {copiedKey === `ip_${conn.device_key}` ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Started:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {formatTimeAgo(conn.stream_started_at || conn.connected_at)}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {geoInfo[conn.ip] ? (
                            <span
                              className="truncate text-slate-800 dark:text-slate-200 font-medium"
                              title={
                                geoInfo[conn.ip].region
                                  ? `${geoInfo[conn.ip].city}, ${geoInfo[conn.ip].region}, ${geoInfo[conn.ip].country}`
                                  : undefined
                              }
                            >
                              <span className="mr-1">{geoInfo[conn.ip].flag}</span>
                              {geoInfo[conn.ip].city ? `${geoInfo[conn.ip].city}, ` : ''}
                              {geoInfo[conn.ip].country}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleLookupGeo(conn.ip)}
                                disabled={loadingGeo[conn.ip]}
                                className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3970e1] dark:text-blue-400 hover:underline disabled:opacity-50"
                                title="Lookup city and country for this IP"
                              >
                                {loadingGeo[conn.ip] ? (
                                  <>
                                    <RotateCcw className="w-3 h-3 animate-spin text-[#3970e1]" />
                                    <span>Locating...</span>
                                  </>
                                ) : (
                                  <span>Lookup Location</span>
                                )}
                              </button>
                              {geoError[conn.ip] && (
                                <span className="text-[13px] text-red-500 font-semibold" title={geoError[conn.ip]}>
                                  (Failed)
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-[13px] text-slate-500 dark:text-slate-400" title={conn.user_agent}>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Player: </span>
                            {conn.user_agent || 'Unknown player / device'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-500 text-center text-xs space-y-1">
                  <div>No active streaming connections at this moment.</div>
                  {playlist && playlist.allow_tracking === false && (
                    <div className="text-[13px] text-amber-600 dark:text-amber-400">
                      (Connection tracking is currently disabled for this playlist)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Bottom Footer */}
      <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 dark:bg-slate-900/80 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{user ? 'User' : 'Playlist'} ID:</span>
          <strong className="font-mono text-slate-700 dark:text-slate-300">
            {user?.id || playlistId}
          </strong>
          {localUsername && (
            <>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>
                Username: <strong className="font-mono text-slate-700 dark:text-slate-300">{localUsername}</strong>
              </span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
    </Modal>
  );
}
