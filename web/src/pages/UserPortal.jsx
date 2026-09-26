import React from 'react';
import {
  Tv,
  Film,
  Clapperboard,
  Eye,
  EyeOff,
  Search,
  Save,
  LogOut,
  User,
  Key,
  Calendar,
  Layers,
  Check,
  Copy,
  AlertCircle,
  CheckCircle2,
  Clock,
  Shield,
  Loader2,
  Sparkles,
  Info,
  Download,
  ExternalLink,
  Terminal,
  Monitor,
  Radio,
  FileCode,
  Sliders,
  Share2,
  Globe,
  MonitorPlay,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { userPortalApi } from '../api/client';
import { CopyableField } from '../components/ui';
import { copyTextToClipboard } from '../utils/clipboard';
import { resolveStbUrl, resolveWebPlayerUrl, resolveProtocolHost } from '../utils/streamingUrls';

const PORTAL_THEMES = {
  slate: {
    bg: 'bg-[#0b1120]',
    style: { background: 'radial-gradient(ellipse at 50% -10%, #1e293b 0%, #0f172a 45%, #020617 100%)' },
    card: 'bg-[#0f172a]/85 backdrop-blur-xl',
    border: 'border-slate-700/70',
    subCard: 'bg-[#0b1120]/80 backdrop-blur-md border-slate-700/50',
    text: 'text-slate-100',
    muted: 'text-slate-400',
    inputBg: 'bg-[#0b1120]/90',
    headerBg: 'bg-[#0f172a]/80 backdrop-blur-xl',
  },
  midnight: {
    bg: 'bg-[#020814]',
    style: { background: 'radial-gradient(ellipse at 50% -10%, #1d3557 0%, #0a193d 40%, #020817 80%, #01040d 100%)' },
    card: 'bg-[#0a1835]/85 backdrop-blur-xl',
    border: 'border-blue-800/60',
    subCard: 'bg-[#050e21]/80 backdrop-blur-md border-blue-900/50',
    text: 'text-blue-50',
    muted: 'text-blue-300/70',
    inputBg: 'bg-[#050e21]/90',
    headerBg: 'bg-[#0a1835]/80 backdrop-blur-xl',
  },
  zinc: {
    bg: 'bg-[#09090b]',
    style: { background: 'radial-gradient(ellipse at 50% -10%, #27272a 0%, #18181b 40%, #09090b 80%, #000000 100%)' },
    card: 'bg-[#141416]/85 backdrop-blur-xl',
    border: 'border-zinc-800',
    subCard: 'bg-[#0a0a0c]/80 backdrop-blur-md border-zinc-800/80',
    text: 'text-zinc-100',
    muted: 'text-zinc-400',
    inputBg: 'bg-[#0a0a0c]/90',
    headerBg: 'bg-[#141416]/80 backdrop-blur-xl',
  },
  emerald: {
    bg: 'bg-[#01140e]',
    style: { background: 'radial-gradient(ellipse at 50% -10%, #065f46 0%, #064e3b 35%, #02261a 70%, #01140e 100%)' },
    card: 'bg-[#062e20]/85 backdrop-blur-xl',
    border: 'border-emerald-700/60',
    subCard: 'bg-[#021811]/80 backdrop-blur-md border-emerald-800/50',
    text: 'text-emerald-50',
    muted: 'text-emerald-300/70',
    inputBg: 'bg-[#021811]/90',
    headerBg: 'bg-[#062e20]/80 backdrop-blur-xl',
  },
  violet: {
    bg: 'bg-[#090214]',
    style: { background: 'radial-gradient(ellipse at 50% -10%, #581c87 0%, #3b0764 35%, #1c0633 70%, #090214 100%)' },
    card: 'bg-[#1e0a38]/85 backdrop-blur-xl',
    border: 'border-purple-700/60',
    subCard: 'bg-[#0e031c]/80 backdrop-blur-md border-purple-800/50',
    text: 'text-purple-50',
    muted: 'text-purple-300/70',
    inputBg: 'bg-[#0e031c]/90',
    headerBg: 'bg-[#1e0a38]/80 backdrop-blur-xl',
  },
};

export default function UserPortal() {
  // Config & Server state
  const [portalConfig, setPortalConfig] = React.useState({
    enabled: true,
    title: 'User Portal',
    allow_hide_categories: true,
    html: '',
    logo: '',
    primary_color: '#3b82f6',
    secondary_color: '#6366f1',
    accent_color: '#10b981',
    background_theme: 'slate',
    admin_hostname: '',
    block_streaming_on_admin_host: true,
    restrict_admin_to_admin_host: false,
  });
  const [configLoaded, setConfigLoaded] = React.useState(false);

  // Auth state
  const [username, setUsername] = React.useState(() => sessionStorage.getItem('user_portal_username') || '');
  const [password, setPassword] = React.useState(() => sessionStorage.getItem('user_portal_password') || '');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [loggingIn, setLoggingIn] = React.useState(false);
  const [loginError, setLoginError] = React.useState('');

  // User data
  const [userInfo, setUserInfo] = React.useState(null);
  const [serverInfo, setServerInfo] = React.useState(null);

  // Settings & Categories state
  const [userSettings, setUserSettings] = React.useState({
    c: { hc: [] },
    m: { hc: [] },
    s: { hc: [] }
  });
  const [initialSettings, setInitialSettings] = React.useState(null);

  // Loaded categories per section
  const [categories, setCategories] = React.useState({
    channels: [],
    vods: [],
    series: []
  });
  const [loadingCategories, setLoadingCategories] = React.useState(false);

  // UI state
  const [activeTab, setActiveTab] = React.useState('channels'); // 'channels' | 'vods' | 'series'
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterHiddenOnly, setFilterHiddenOnly] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [copiedLink, setCopiedLink] = React.useState('');

  // Device & Connection Tabs UI state
  const [deviceTab, setDeviceTab] = React.useState('urls'); // 'urls' | 'player' | 'enigma' | 'export'
  const [showPortalPassword, setShowPortalPassword] = React.useState(false);

  // M3U & EPG stream filters
  const [showFilters, setShowFilters] = React.useState(false);
  const [excludeChannels, setExcludeChannels] = React.useState(false);
  const [excludeMovies, setExcludeMovies] = React.useState(false);
  const [excludeSeries, setExcludeSeries] = React.useState(false);
  const [useGzip, setUseGzip] = React.useState(false);

  // Export checklist options
  const [exportOptions, setExportOptions] = React.useState({
    xtream: true,
    m3u: true,
    shortUrl: true,
    webPlayer: true,
    stalker: true,
    enigma: true,
    dreambox: true,
  });

  const defaultPortalConfigRef = React.useRef(null);

  // 1. Fetch public portal config
  React.useEffect(() => {
    userPortalApi.getConfig()
      .then((cfg) => {
        if (cfg) {
          const configObj = {
            enabled: cfg.user_dashboard_enabled !== undefined ? Boolean(cfg.user_dashboard_enabled) : true,
            title: cfg.user_dashboard_title || 'User Portal',
            allow_hide_categories: cfg.user_dashboard_allow_hide_categories !== undefined ? Boolean(cfg.user_dashboard_allow_hide_categories) : true,
            html: cfg.user_dashboard_html || '',
            logo: cfg.user_dashboard_logo || '',
            primary_color: cfg.user_dashboard_primary_color || '#3b82f6',
            secondary_color: cfg.user_dashboard_secondary_color || '#6366f1',
            accent_color: cfg.user_dashboard_accent_color || '#10b981',
            background_theme: cfg.user_dashboard_background_theme || 'slate',
          };
          defaultPortalConfigRef.current = configObj;
          setPortalConfig(configObj);
        }
      })
      .catch(() => {
        // Fallback to default
      })
      .finally(() => {
        setConfigLoaded(true);
      });
  }, []);

  // 2. Auto-login if session credentials exist
  React.useEffect(() => {
    const savedUser = sessionStorage.getItem('user_portal_username');
    const savedPass = sessionStorage.getItem('user_portal_password');
    if (savedUser && savedPass) {
      handleLogin(savedUser, savedPass);
    }
  }, []);

  const handleLogin = async (loginUser, loginPass) => {
    const u = (loginUser || username).trim();
    const p = loginPass !== undefined ? loginPass : password;
    if (!u || !p) {
      setLoginError('Please enter both username and password');
      return;
    }

    setLoggingIn(true);
    setLoginError('');

    try {
      const data = await userPortalApi.login(u, p);
      setUserInfo(data.user_info);
      setServerInfo(data.server_info);
      setIsLoggedIn(true);

      // Dynamically apply per-playlist portal branding if enabled
      const branding = data.server_info?.portal_branding;
      if (branding && branding.enabled) {
        setPortalConfig((prev) => ({
          ...prev,
          title: branding.title || prev.title,
          logo: branding.logo !== undefined && branding.logo !== '' ? branding.logo : prev.logo,
          html: branding.html !== undefined && branding.html !== '' ? branding.html : prev.html,
          primary_color: branding.primary_color || prev.primary_color,
          secondary_color: branding.secondary_color || prev.secondary_color,
          accent_color: branding.accent_color || prev.accent_color,
          background_theme: branding.background_theme || prev.background_theme,
        }));
      }

      sessionStorage.setItem('user_portal_username', u);
      sessionStorage.setItem('user_portal_password', p);

      // Fetch user settings and categories in parallel
      await Promise.all([
        fetchUserSettings(u, p),
        fetchAllCategories(u, p)
      ]);
    } catch (err) {
      setLoginError(err.message || 'Authentication failed. Please check your credentials.');
      sessionStorage.removeItem('user_portal_username');
      sessionStorage.removeItem('user_portal_password');
      setIsLoggedIn(false);
    } finally {
      setLoggingIn(false);
    }
  };

  const fetchUserSettings = async (u, p) => {
    try {
      const raw = await userPortalApi.getSettings(u, p);
      let parsed = raw;
      if (typeof raw === 'string') {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = {};
        }
      }
      if (!parsed || typeof parsed !== 'object') {
        parsed = {};
      }
      const safe = {
        ...parsed,
        c: { ...(parsed.c || {}), hc: Array.isArray(parsed.c?.hc) ? parsed.c.hc : [] },
        m: { ...(parsed.m || {}), hc: Array.isArray(parsed.m?.hc) ? parsed.m.hc : [] },
        s: { ...(parsed.s || {}), hc: Array.isArray(parsed.s?.hc) ? parsed.s.hc : [] }
      };
      setUserSettings(safe);
      setInitialSettings(JSON.parse(JSON.stringify(safe)));
    } catch {
      // Fallback
    }
  };

  const fetchAllCategories = async (u, p) => {
    setLoadingCategories(true);
    try {
      const [liveCats, vodCats, seriesCats] = await Promise.all([
        userPortalApi.getCategories(u, p, 'get_live_categories').catch(() => []),
        userPortalApi.getCategories(u, p, 'get_vod_categories').catch(() => []),
        userPortalApi.getCategories(u, p, 'get_series_categories').catch(() => [])
      ]);

      setCategories({
        channels: Array.isArray(liveCats) ? liveCats : [],
        vods: Array.isArray(vodCats) ? vodCats : [],
        series: Array.isArray(seriesCats) ? seriesCats : []
      });
    } catch {
      // Ignore
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('user_portal_username');
    sessionStorage.removeItem('user_portal_password');
    setIsLoggedIn(false);
    setUserInfo(null);
    setServerInfo(null);
    setUserSettings({ c: { hc: [] }, m: { hc: [] }, s: { hc: [] } });
    setInitialSettings(null);
    setCategories({ channels: [], vods: [], series: [] });
    setPassword('');
    if (defaultPortalConfigRef.current) {
      setPortalConfig(defaultPortalConfigRef.current);
    } else {
      userPortalApi.getConfig().then((cfg) => {
        if (cfg) {
          setPortalConfig({
            enabled: cfg.user_dashboard_enabled !== undefined ? Boolean(cfg.user_dashboard_enabled) : true,
            title: cfg.user_dashboard_title || 'User Portal',
            allow_hide_categories: cfg.user_dashboard_allow_hide_categories !== undefined ? Boolean(cfg.user_dashboard_allow_hide_categories) : true,
            html: cfg.user_dashboard_html || '',
            logo: cfg.user_dashboard_logo || '',
            primary_color: cfg.user_dashboard_primary_color || '#3b82f6',
            secondary_color: cfg.user_dashboard_secondary_color || '#6366f1',
            accent_color: cfg.user_dashboard_accent_color || '#10b981',
            background_theme: cfg.user_dashboard_background_theme || 'slate',
          });
        }
      }).catch(() => { });
    }
  };

  // Check if category is currently hidden
  const isCategoryHidden = (typeKey, catId) => {
    const numId = Number(catId);
    const hiddenList = userSettings[typeKey]?.hc || [];
    return hiddenList.some((id) => Number(id) === numId);
  };

  // Toggle category hidden state
  const toggleCategory = (typeKey, catId) => {
    const numId = Number(catId);
    setUserSettings((prev) => {
      const currentList = prev[typeKey]?.hc || [];
      const isHidden = currentList.some((id) => Number(id) === numId);
      const updatedList = isHidden
        ? currentList.filter((id) => Number(id) !== numId)
        : [...currentList, numId];

      return {
        ...prev,
        [typeKey]: {
          ...(prev[typeKey] || {}),
          hc: updatedList
        }
      };
    });
  };


  // Save settings
  const handleSave = async () => {
    setSavingSettings(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const currentU = sessionStorage.getItem('user_portal_username') || username;
      const currentP = sessionStorage.getItem('user_portal_password') || password;

      await userPortalApi.saveSettings(currentU, currentP, userSettings);
      setInitialSettings(JSON.parse(JSON.stringify(userSettings)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const hasUnsavedChanges = React.useMemo(() => {
    if (!initialSettings) return false;
    return JSON.stringify(userSettings) !== JSON.stringify(initialSettings);
  }, [userSettings, initialSettings]);

  // Copy helper
  const copyToClipboard = async (text, label) => {
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedLink(label);
      setTimeout(() => setCopiedLink(''), 2500);
    }
  };

  // Get current active tab section config
  const currentTabConfig = React.useMemo(() => {
    switch (activeTab) {
      case 'vods':
        return {
          key: 'm',
          title: 'Movies & VOD',
          icon: Film,
          items: categories.vods
        };
      case 'series':
        return {
          key: 's',
          title: 'TV Series',
          icon: Clapperboard,
          items: categories.series
        };
      default:
        return {
          key: 'c',
          title: 'Live Channels Channels',
          icon: Tv,
          items: categories.channels
        };
    }
  }, [activeTab, categories]);

  // Filtered categories
  const filteredCategories = React.useMemo(() => {
    const list = currentTabConfig.items || [];
    const query = searchQuery.trim().toLowerCase();

    return list.filter((cat) => {
      const matchesQuery = !query || (cat.category_name && cat.category_name.toLowerCase().includes(query));
      if (!matchesQuery) return false;

      if (filterHiddenOnly) {
        return isCategoryHidden(currentTabConfig.key, cat.category_id);
      }
      return true;
    });
  }, [currentTabConfig, searchQuery, filterHiddenOnly, userSettings]);

  const isFiltered = Boolean(searchQuery.trim() || filterHiddenOnly);

  // Bulk toggle for current tab (targets only filtered categories)
  const handleBulkToggle = (typeKey, makeAllVisible) => {
    const targetIds = new Set(filteredCategories.map((c) => Number(c.category_id)));
    setUserSettings((prev) => {
      const currentList = prev[typeKey]?.hc || [];
      let nextList;
      if (makeAllVisible) {
        // Unhide only the filtered categories
        nextList = currentList.filter((id) => !targetIds.has(Number(id)));
      } else {
        // Hide only the filtered categories (union with existing hidden)
        const combined = new Set(currentList.map((id) => Number(id)));
        targetIds.forEach((id) => combined.add(id));
        nextList = Array.from(combined);
      }

      return {
        ...prev,
        [typeKey]: {
          ...(prev[typeKey] || {}),
          hc: nextList
        }
      };
    });
  };

  // Format expiration timestamp
  const expirationFormatted = React.useMemo(() => {
    if (!userInfo || !userInfo.exp_date) return 'Unlimited / No Expiration';
    const timestamp = parseInt(userInfo.exp_date, 10);
    if (!timestamp || isNaN(timestamp)) return 'Unlimited';
    const date = new Date(timestamp * 1000);

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let relative = '';
    if (diffDays < 0) {
      relative = `(Expired ${Math.abs(diffDays)} days ago)`;
    } else if (diffDays === 0) {
      relative = '(Expires today)';
    } else if (diffDays === 1) {
      relative = '(Expires tomorrow)';
    } else {
      relative = `(in ${diffDays} days)`;
    }

    return `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ${relative}`;
  }, [userInfo]);

  const isExpired = React.useMemo(() => {
    if (!userInfo || !userInfo.exp_date) return false;
    const timestamp = parseInt(userInfo.exp_date, 10);
    if (!timestamp || isNaN(timestamp)) return false;
    return new Date(timestamp * 1000) < new Date();
  }, [userInfo]);

  // Domain and host resolution
  const rawCname = (userInfo?.cname || '').trim();
  const primaryDomain = rawCname.split(/[\s,;]+/)[0] || '';
  const cnameClean = primaryDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const hasCname = cnameClean.length > 0;
  const isCnameSSL = Boolean(userInfo?.cname_ssl || rawCname.startsWith('https://'));

  const protocolHost = React.useMemo(() => {
    return resolveProtocolHost({
      cname: userInfo?.cname,
      cnameSSL: userInfo?.cname_ssl,
    });
  }, [userInfo?.cname, userInfo?.cname_ssl]);

  // Query parameters for customized M3U / EPG
  const m3uQueryParams = React.useMemo(() => {
    const params = [];
    if (excludeChannels) params.push('channels=false');
    if (excludeMovies) params.push('movies=false');
    if (excludeSeries) params.push('series=false');
    return params;
  }, [excludeChannels, excludeMovies, excludeSeries]);

  const m3uQueryStr = m3uQueryParams.length > 0 ? `&${m3uQueryParams.join('&')}` : '';

  const epgQueryParams = React.useMemo(() => {
    const params = [];
    if (useGzip) params.push('gzip=1');
    return params;
  }, [useGzip]);

  const epgQueryStr = epgQueryParams.length > 0 ? `&${epgQueryParams.join('&')}` : '';

  // Direct & Short URLs
  const directM3uUrl = `${protocolHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=ts${m3uQueryStr}`;
  const shortM3uUrl = userInfo?.m3u ? `${protocolHost}/${userInfo.m3u}${m3uQueryParams.length > 0 ? `?${m3uQueryParams.join('&')}` : ''}` : null;

  const directEpgUrl = `${protocolHost}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${epgQueryStr}`;
  const shortEpgUrl = userInfo?.epg ? `${protocolHost}/${userInfo.epg}${epgQueryParams.length > 0 ? `?${epgQueryParams.join('&')}` : ''}` : null;

  // STB / Web Streaming Player URL resolution (stb.<hostname> or error if IP / locked)
  const effectiveCname = userInfo?.cname || '';
  const effectiveCnameSSL = Boolean(userInfo?.cname_ssl || isCnameSSL);

  const webPlayerResolution = React.useMemo(() => {
    return resolveWebPlayerUrl({
      cname: effectiveCname,
      cnameSSL: effectiveCnameSSL,
      username,
      password,
      settings: portalConfig,
      currentHostname: window.location.hostname,
      currentProtocol: window.location.protocol,
      currentPort: window.location.port,
    });
  }, [effectiveCname, effectiveCnameSSL, username, password, portalConfig]);

  const stbResolution = React.useMemo(() => {
    return resolveStbUrl({
      cname: effectiveCname,
      cnameSSL: effectiveCnameSSL,
      username,
      password,
      settings: portalConfig,
      currentHostname: window.location.hostname,
      currentProtocol: window.location.protocol,
      currentPort: window.location.port,
    });
  }, [effectiveCname, effectiveCnameSSL, username, password, portalConfig]);

  const webPlayerUrl = webPlayerResolution.url;
  const stalkerPortalUrl = stbResolution.url;
  const hasWebPlayerError = webPlayerResolution.isError;
  const hasStbError = stbResolution.isError;

  // Enigma2 Auto-Install Script (Telnet / SSH)
  const enigmaScript = `wget -O /etc/enigma2/iptv.sh "${protocolHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=enigma22_script&output=mpegts" && chmod 777 /etc/enigma2/iptv.sh && /etc/enigma2/iptv.sh`;

  // Dreambox Direct Bouquet URL
  const dreamboxUrl = `${protocolHost}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=dreambox&output=ts`;

  // Formatted Customer Export Text Generator
  const exportText = React.useMemo(() => {
    const lines = [];
    const displayName = userInfo?.name || userInfo?.username || username || 'Streaming Access';
    lines.push(`=== ${displayName} ===\n`);

    if (exportOptions.xtream) {
      lines.push(`Xtream Codes Server: ${protocolHost}`);
      lines.push(`Username: ${username}`);
      lines.push(`Password: ${password}\n`);
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
        lines.push(`Username: ${username}`);
        lines.push(`Password: ${password}`);
      }
      lines.push('');
    }

    if (exportOptions.stalker) {
      lines.push(`MAG / Stalker STB Portal: ${stalkerPortalUrl}`);
      lines.push(`Username: ${username}`);
      lines.push(`Password: ${password}\n`);
    }

    if (exportOptions.enigma) {
      lines.push(`Enigma2 Script:\n${enigmaScript}\n`);
    }

    if (exportOptions.dreambox) {
      lines.push(`Dreambox Bouquet:\n${dreamboxUrl}\n`);
    }

    return lines.join('\n').trim();
  }, [
    userInfo, username, password, exportOptions, protocolHost,
    shortM3uUrl, directM3uUrl, shortEpgUrl, directEpgUrl,
    webPlayerUrl, stalkerPortalUrl, enigmaScript, dreamboxUrl
  ]);

  // Backward-compatibility alias for announcement tags
  const m3uUrl = shortM3uUrl || directM3uUrl;
  const epgUrl = shortEpgUrl || directEpgUrl;

  // Interpolate dynamic welcome info tags into the custom announcement HTML
  const renderedAnnouncementHtml = React.useMemo(() => {
    if (!portalConfig.html) return '';
    let text = portalConfig.html;

    const uName = userInfo?.name || userInfo?.username || username || '';
    const uUser = userInfo?.username || username || '';
    const uPass = password || userInfo?.password || '';
    const uMessage = userInfo?.message || '';
    const uMaxCon = String(userInfo?.max_connections || 1);
    const uExpiry = expirationFormatted || 'Unlimited';
    const uStatus = userInfo?.status || (userInfo?.auth === 1 ? 'Active' : 'Unknown');

    const tagReplacements = [
      { patterns: [/%name%/g, /{name}/g], value: uName },
      { patterns: [/%user%/g, /{user}/g, /%username%/g, /{username}/g], value: uUser },
      { patterns: [/%pass%/g, /{pass}/g, /%password%/g, /{password}/g], value: uPass },
      { patterns: [/%expiry%/g, /{expiry}/g, /%exp_date%/g, /{exp_date}/g], value: uExpiry },
      { patterns: [/%message%/g, /{message}/g], value: uMessage },
      { patterns: [/%max_con%/g, /{max_con}/g, /%max_connections%/g, /{max_connections}/g], value: uMaxCon },
      { patterns: [/%m3u_url%/g, /{m3u_url}/g], value: m3uUrl },
      { patterns: [/%epg_url%/g, /{epg_url}/g], value: epgUrl },
      { patterns: [/%status%/g, /{status}/g], value: uStatus },
    ];

    for (const item of tagReplacements) {
      for (const pattern of item.patterns) {
        text = text.replace(pattern, item.value);
      }
    }

    return text;
  }, [portalConfig.html, userInfo, username, password, expirationFormatted, m3uUrl, epgUrl]);

  const theme = PORTAL_THEMES[portalConfig.background_theme] || PORTAL_THEMES.slate;

  // Dedicated Atmospheric Background Mesh (Fixed across scrolling, identical to Admin Live Preview)
  const renderAtmosphere = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Dynamic Theme Gradient Base */}
      <div className="absolute inset-0" style={theme.style} />

      {/* Primary Brand Ambient Glow Orb */}
      <div
        className="absolute -top-32 left-1/4 w-[650px] h-[650px] rounded-full blur-[140px] opacity-25 mix-blend-screen transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: portalConfig.primary_color }}
      />

      {/* Secondary Brand Ambient Glow Orb */}
      <div
        className="absolute top-1/3 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] opacity-20 mix-blend-screen transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: portalConfig.secondary_color }}
      />

      {/* Accent Ambient Glow Orb */}
      <div
        className="absolute -bottom-32 left-10 w-[550px] h-[550px] rounded-full blur-[150px] opacity-15 mix-blend-screen transition-all duration-700 pointer-events-none"
        style={{ backgroundColor: portalConfig.accent_color }}
      />

      {/* Micro-dot grid texture to eliminate any flat appearance */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.6) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );

  if (!configLoaded) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col items-center justify-center p-4 relative`}>
        {renderAtmosphere()}
        <div className="relative z-10 flex flex-col items-center">
          <Loader2
            className="w-8 h-8 animate-spin mb-3"
            style={{ color: portalConfig.primary_color }}
          />
          <p className={`text-xs ${theme.muted}`}>Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!portalConfig.enabled) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col items-center justify-center p-4 relative`}>
        {renderAtmosphere()}
        <div className={`relative z-10 max-w-md w-full ${theme.card} border ${theme.border} rounded-2xl p-8 text-center space-y-4 shadow-2xl`}>
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Client Portal Disabled</h2>
          <p className={`text-xs ${theme.muted} leading-relaxed`}>
            The self-service dashboard is currently disabled by the system administrator. Please contact your provider for assistance.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // LOGIN VIEW
  // ==========================================
  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative`}>
        {renderAtmosphere()}

        <div className="relative z-10 w-full max-w-md space-y-6">
          {/* Header Branding */}
          <div className="text-center space-y-2">
            {portalConfig.logo ? (
              <div className="flex justify-center mb-3">
                <img
                  src={portalConfig.logo}
                  alt={portalConfig.title || 'User Portal'}
                  className="max-h-16 max-w-[220px] object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white shadow-lg mb-1"
                style={{
                  background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                  boxShadow: `0 10px 25px -5px ${portalConfig.primary_color}40`,
                }}
              >
                <Tv className="w-7 h-7" />
              </div>
            )}
            <h1 className="text-2xl font-black tracking-tight text-white">
              {portalConfig.title || 'User Portal'}
            </h1>
            <p className={`text-xs ${theme.muted}`}>
              Sign in with your Xtream Codes credentials to manage your playlist
            </p>
          </div>

          {/* Login Card */}
          <div className={`${theme.card} backdrop-blur-xl border ${theme.border} rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5`}>
            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your account username"
                    className={`w-full pl-10 pr-3.5 py-2.5 ${theme.inputBg} border ${theme.border} rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition`}
                    style={{
                      '--tw-ring-color': `${portalConfig.primary_color}40`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className={`w-full pl-10 pr-10 py-2.5 ${theme.inputBg} border ${theme.border} rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 px-4 text-white rounded-xl text-xs font-bold shadow-lg transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                style={{
                  background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                  boxShadow: `0 4px 14px -3px ${portalConfig.primary_color}50`,
                }}
              >
                {loggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Access Dashboard</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD VIEW (LOGGED IN)
  // ==========================================
  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col selection:bg-blue-600 selection:text-white pb-24 relative`}>
      {renderAtmosphere()}

      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-8 py-6 space-y-5 flex-1 relative z-10">
        {/* Top Header Bar (Floating rounded card matching live preview 1:1) */}
        <header className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl ${theme.card} border ${theme.border} shadow-lg backdrop-blur-xl`}>
          <div className="flex items-center gap-3">
            {portalConfig.logo ? (
              <img
                src={portalConfig.logo}
                alt={portalConfig.title || 'User Portal'}
                className="max-h-8 max-w-[130px] sm:max-h-9 sm:max-w-[150px] object-contain rounded-lg"
              />
            ) : (
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-white flex items-center justify-center shadow-md shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                  boxShadow: `0 4px 12px -2px ${portalConfig.primary_color}40`,
                }}
              >
                <Tv className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white leading-tight">
                {portalConfig.title || 'User Portal'}
              </h1>
              <span className={`text-[13px] sm:text-[13px] font-mono ${theme.muted} block`}>
                {userInfo?.username}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active Status Badge matching preview */}
            <span className="px-2.5 py-0.5 rounded-full text-[12px] sm:text-xs font-bold bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Active</span>
            </span>

            {portalConfig.allow_hide_categories && hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleSave}
                disabled={savingSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Save Changes</span>
                <span className="sm:hidden">Save</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[12px] sm:text-xs font-semibold transition active:scale-95 shadow-sm"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>
        {/* Notifications */}
        {saveSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Category preferences saved successfully! Please reload your playlist or streaming app to apply changes.</span>
            </div>
          </div>
        )}
        {saveError && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{saveError}</span>
            </div>
          </div>
        )}

        {/* Custom Admin Announcement / HTML (if configured) */}
        {renderedAnnouncementHtml && (
          <div
            className={`border ${theme.border} rounded-2xl p-5 shadow-lg relative overflow-hidden`}
            style={{
              background: `linear-gradient(135deg, ${portalConfig.primary_color}18, ${portalConfig.secondary_color}10)`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  backgroundColor: `${portalConfig.primary_color}20`,
                  border: `1px solid ${portalConfig.primary_color}40`,
                  color: portalConfig.primary_color,
                }}
              >
                <Info className="w-4 h-4" />
              </div>
              <div
                className="text-xs text-slate-200 leading-relaxed prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderedAnnouncementHtml }}
              />
            </div>
          </div>
        )}

        {/* Top Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Account Status Card */}
          <div className={`${theme.card} border ${theme.border} rounded-2xl p-5 shadow-xl space-y-4`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Account Status
              </span>
              {isExpired ? (
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-rose-950 border border-rose-800 text-rose-300">
                  Expired
                </span>
              ) : userInfo?.status === 'Active' || userInfo?.auth === 1 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-amber-950 border border-amber-800 text-amber-300">
                  {userInfo?.status || 'Unknown'}
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className={`flex items-center justify-between py-1 border-b ${theme.border}`}>
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Expiration
                </span>
                <span className={`font-medium ${isExpired ? 'text-rose-400' : 'text-slate-200'}`}>
                  {expirationFormatted}
                </span>
              </div>

              <div className={`flex items-center justify-between py-1 border-b ${theme.border}`}>
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Tv className="w-3.5 h-3.5 text-slate-500" />
                  Max Connections
                </span>
                <span className="font-medium text-slate-200">
                  {userInfo?.max_connections || 1} Device(s)
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Server Time
                </span>
                <span className="font-mono text-slate-300 text-[13px]">
                  {serverInfo?.time_now ? new Date(serverInfo.time_now).toLocaleTimeString() : 'Online'}
                </span>
              </div>
            </div>
          </div>

          {/* Connection, Player & Device Setup Card */}
          <div className={`${theme.card} border ${theme.border} rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2`}>
            {/* Header & Device Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4" style={{ color: portalConfig.primary_color }} />
                  Device & Player Access
                </span>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  Connect via Xtream Codes, M3U playlist, Web Player, STB or Enigma2
                </p>
              </div>

              {/* Tab Navigation buttons */}
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setDeviceTab('urls')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${deviceTab === 'urls'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                  <Key className="w-3.5 h-3.5" style={{ color: portalConfig.primary_color }} />
                  <span>Credentials & URLs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceTab('player')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${deviceTab === 'player'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                  <Monitor className="w-3.5 h-3.5 text-sky-400" />
                  <span>Web Player & STB</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceTab('enigma')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${deviceTab === 'enigma'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enigma2 & Dreambox</span>
                </button>
              </div>
            </div>

            {/* TAB 1: CREDENTIALS & URLS */}
            {deviceTab === 'urls' && (
              <div className="space-y-4">
                {/* Xtream Codes Connection Box */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" style={{ color: portalConfig.primary_color }} />
                      Xtream Codes API Connection
                    </span>
                  </div>

                  {/* Server Host */}
                  <CopyableField
                    label="Server URL / Host"
                    value={protocolHost}
                    variant="portal"
                  />

                  {/* Username & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Username */}
                    <CopyableField
                      label="Username"
                      value={username}
                      inputClassName="font-semibold"
                      variant="portal"
                    />

                    {/* Password */}
                    <CopyableField
                      label="Password"
                      rightLabel={
                        <button
                          type="button"
                          onClick={() => setShowPortalPassword(!showPortalPassword)}
                          className="text-slate-400 hover:text-slate-200 text-[13px] flex items-center gap-1 transition"
                        >
                          {showPortalPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showPortalPassword ? 'Hide' : 'Show'}</span>
                        </button>
                      }
                      type={showPortalPassword ? 'text' : 'password'}
                      value={password}
                      inputClassName="font-semibold"
                      variant="portal"
                    />
                  </div>
                </div>

                {/* Direct & Short Playlist URLs Box */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-indigo-400" />
                      Direct & Short Playlist Links
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      className="px-2 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-300 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition border border-slate-700/60"
                    >
                      <Sliders className="w-3 h-3 text-slate-400" />
                      <span>{showFilters ? 'Hide Filters' : 'Customize Filters & EPG'}</span>
                    </button>
                  </div>

                  {/* Expandable Output Filters */}
                  {showFilters && (
                    <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-2.5 text-xs animate-in fade-in-50">
                      <div className="font-semibold text-slate-300 text-[13px]">
                        Stream & EPG Output Customization (Updates links in real-time)
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-slate-300 text-xs">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={excludeChannels}
                            onChange={(e) => setExcludeChannels(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Exclude Live Channels</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={excludeMovies}
                            onChange={(e) => setExcludeMovies(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Exclude Movies</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={excludeSeries}
                            onChange={(e) => setExcludeSeries(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Exclude Series</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none hover:text-white transition">
                          <input
                            type="checkbox"
                            checked={useGzip}
                            onChange={(e) => setUseGzip(e.target.checked)}
                            className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Gzip (.xml.gz)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Direct M3U Plus URL */}
                  <CopyableField
                    label="Direct M3U Plus URL"
                    value={directM3uUrl}
                    variant="portal"
                    actionButton={
                      <button
                        type="button"
                        onClick={() => window.open(directM3uUrl, '_blank')}
                        title="Download M3U Playlist file"
                        className="h-8 px-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        <span>.m3u</span>
                      </button>
                    }
                  />

                  {/* Short M3U URL (if present) */}
                  {shortM3uUrl && (
                    <CopyableField
                      label={
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Short M3U URL
                        </span>
                      }
                      value={shortM3uUrl}
                      variant="portal"
                    />
                  )}

                  {/* Direct XMLTV EPG URL */}
                  <CopyableField
                    label="Direct XMLTV EPG URL"
                    value={directEpgUrl}
                    variant="portal"
                  />

                  {/* Short EPG URL (if present) */}
                  {shortEpgUrl && (
                    <CopyableField
                      label={
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Short EPG URL
                        </span>
                      }
                      value={shortEpgUrl}
                      variant="portal"
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: WEB PLAYER & STB */}
            {deviceTab === 'player' && (
              <div className="space-y-4 animate-in fade-in-50">
                {/* Web Streaming Player Card */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <MonitorPlay className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">Web Streaming Player</h4>
                        <p className="text-[13px] text-slate-400">
                          Watch live channels and on-demand titles directly in your browser
                        </p>
                      </div>
                    </div>
                  </div>

                  <CopyableField
                    value={webPlayerUrl}
                    variant="portal"
                    actionButton={
                      <button
                        type="button"
                        disabled={hasWebPlayerError}
                        onClick={() => !hasWebPlayerError && window.open(webPlayerUrl, '_blank')}
                        className={`h-8 sm:h-9 px-3.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs ${hasWebPlayerError
                          ? 'bg-slate-700 cursor-not-allowed opacity-60'
                          : 'active:scale-95'
                          }`}
                        style={{ backgroundColor: hasWebPlayerError ? undefined : portalConfig.primary_color }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Player</span>
                      </button>
                    }
                  />
                  {hasWebPlayerError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{webPlayerResolution.errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* MAG / Stalker STB Portal Card */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-3`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Tv className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">MAG / Stalker STB Portal</h4>
                      <p className="text-[13px] text-slate-400">
                        For hardware STB boxes (MAG 250/254/322/420, TVIP) and emulators (Smart STB, STB Emu)
                      </p>
                    </div>
                  </div>

                  <CopyableField
                    value={stalkerPortalUrl}
                    variant="portal"
                  />
                  {hasStbError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{stbResolution.errorMessage}</span>
                    </div>
                  )}

                  <div className="rounded-lg bg-slate-950/70 border border-slate-800/80 p-3 text-xs text-slate-300 space-y-1">
                    <div className="font-semibold text-slate-200 text-[13px]">How to configure your STB device:</div>
                    <ol className="list-decimal list-inside space-y-0.5 text-[13px] text-slate-400">
                      <li>Go to <strong>System Settings &rarr; Servers &rarr; Portals</strong> on your STB device.</li>
                      <li>Enter the Portal URL above into <strong>Portal 1 URL</strong>.</li>
                      <li>Save and restart your portal to load channels.</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ENIGMA2 & DREAMBOX */}
            {deviceTab === 'enigma' && (
              <div className="space-y-4 animate-in fade-in-50">
                {/* Enigma2 Auto-Install Script */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Enigma2 Auto-Install Script (Telnet / SSH)</h4>
                      <p className="text-[13px] text-slate-400">
                        Automatically generate channel bouquets on OpenATV, BlackHole, Pure2, OpenPLi
                      </p>
                    </div>
                  </div>

                  <CopyableField
                    value={enigmaScript}
                    variant="portal"
                  />
                  <p className="text-[13px] text-slate-400">
                    Connect to your Enigma2 box via SSH / PuTTY as root, paste the command above and press Enter.
                  </p>
                </div>

                {/* Dreambox Direct Bouquet Download */}
                <div className={`p-4 rounded-xl ${theme.subCard} space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Dreambox Direct Bouquet URL</h4>
                      <p className="text-[13px] text-slate-400">
                        Download raw userbouquet file for Dreambox satellite receivers
                      </p>
                    </div>
                  </div>

                  <CopyableField
                    value={dreamboxUrl}
                    variant="portal"
                    actionButton={
                      <button
                        type="button"
                        onClick={() => window.open(dreamboxUrl, '_blank')}
                        title="Download Dreambox Bouquet file"
                        className="h-8 sm:h-9 px-3 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-400" />
                        <span>Bouquet</span>
                      </button>
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Management Section */}
        {portalConfig.allow_hide_categories ? (
          <div className={`${theme.card} border ${theme.border} rounded-2xl p-5 sm:p-6 shadow-xl space-y-5`}>
            <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${theme.border}`}>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4" style={{ color: portalConfig.primary_color }} />
                  Manage Category Visibility
                </h2>
                <p className={`text-xs ${theme.muted} mt-0.5`}>
                  Toggle off categories you do not wish to see on your devices. Hidden categories are excluded from your M3U and player apps.
                </p>
              </div>

              {hasUnsavedChanges && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Unsaved changes
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={savingSettings}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
                  >
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Changes</span>
                  </button>
                </div>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setActiveTab('channels'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === 'channels'
                  ? 'text-white'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                style={
                  activeTab === 'channels'
                    ? {
                      background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                      boxShadow: `0 4px 14px -2px ${portalConfig.primary_color}40`,
                    }
                    : {}
                }
              >
                <Tv className="w-4 h-4" />
                <span>Live Channels</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[12px] font-mono"
                  style={
                    activeTab === 'channels'
                      ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                      : { backgroundColor: 'rgba(0,0,0,0.3)', color: '#94a3b8' }
                  }
                >
                  {categories.channels.length}
                </span>
                {userSettings.c?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-500 text-slate-950">
                    {userSettings.c.hc.length} hidden
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('vods'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === 'vods'
                  ? 'text-white'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                style={
                  activeTab === 'vods'
                    ? {
                      background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                      boxShadow: `0 4px 14px -2px ${portalConfig.primary_color}40`,
                    }
                    : {}
                }
              >
                <Film className="w-4 h-4" />
                <span>Movies / VOD</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[12px] font-mono"
                  style={
                    activeTab === 'vods'
                      ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                      : { backgroundColor: 'rgba(0,0,0,0.3)', color: '#94a3b8' }
                  }
                >
                  {categories.vods.length}
                </span>
                {userSettings.m?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-500 text-slate-950">
                    {userSettings.m.hc.length} hidden
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('series'); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === 'series'
                  ? 'text-white'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                  }`}
                style={
                  activeTab === 'series'
                    ? {
                      background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                      boxShadow: `0 4px 14px -2px ${portalConfig.primary_color}40`,
                    }
                    : {}
                }
              >
                <Clapperboard className="w-4 h-4" />
                <span>TV Series</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[12px] font-mono"
                  style={
                    activeTab === 'series'
                      ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }
                      : { backgroundColor: 'rgba(0,0,0,0.3)', color: '#94a3b8' }
                  }
                >
                  {categories.series.length}
                </span>
                {userSettings.s?.hc?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[12px] font-bold bg-amber-500 text-slate-950">
                    {userSettings.s.hc.length} hidden
                  </span>
                )}
              </button>
            </div>

            {/* Filter / Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${currentTabConfig.title}...`}
                  className={`w-full pl-9 pr-4 py-2 ${theme.inputBg} border ${theme.border} rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none`}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterHiddenOnly(!filterHiddenOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${filterHiddenOnly
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                >
                  {filterHiddenOnly ? 'Showing Hidden Only' : 'Filter: Hidden Only'}
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkToggle(currentTabConfig.key, true)}
                  disabled={filteredCategories.length === 0}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  title={isFiltered ? `Unhide ${filteredCategories.length} filtered categories` : 'Unhide all categories'}
                >
                  {isFiltered ? 'Unhide Filtered' : 'Unhide All'}
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkToggle(currentTabConfig.key, false)}
                  disabled={filteredCategories.length === 0}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                  title={isFiltered ? `Hide ${filteredCategories.length} filtered categories` : 'Hide all categories'}
                >
                  {isFiltered ? 'Hide Filtered' : 'Hide All'}
                </button>
              </div>
            </div>

            {/* Categories List */}
            {loadingCategories ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: portalConfig.primary_color }} />
                <span className="text-xs">Loading categories...</span>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className={`py-12 text-center ${theme.muted} text-xs ${theme.subCard} rounded-xl border`}>
                No categories found matching your filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredCategories.map((cat) => {
                  const isHidden = isCategoryHidden(currentTabConfig.key, cat.category_id);

                  return (
                    <div
                      key={cat.category_id}
                      onClick={() => toggleCategory(currentTabConfig.key, cat.category_id)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition select-none ${isHidden
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-80'
                        : `${theme.subCard} hover:border-slate-700`
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isHidden ? 'bg-slate-600' : 'bg-emerald-400'}`} />
                        <span className={`text-xs font-medium truncate ${isHidden ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                          {cat.category_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${isHidden
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                          }`}>
                          {isHidden ? 'Hidden' : 'Visible'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className={`${theme.card} border ${theme.border} rounded-2xl p-6 text-center space-y-2 shadow-xl`}>
            <Shield className="w-8 h-8 mx-auto text-slate-500 mb-1" />
            <h3 className="text-sm font-bold text-slate-300">Category Customization Disabled</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              The administrator has disabled custom category visibility settings. All assigned categories are currently visible.
            </p>
          </div>
        )}
      </main>

      {/* Floating Save Banner (when changes exist) */}
      {portalConfig.allow_hide_categories && hasUnsavedChanges && (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-8 sm:w-96 z-40 animate-slideUp">
          <div
            className={`${theme.card} border rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 backdrop-blur-xl`}
            style={{ borderColor: `${portalConfig.primary_color}80` }}
          >
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-white block">You have unsaved changes</span>
              <span className={`text-[13px] ${theme.muted} block`}>Click save to update your devices</span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={savingSettings}
              className="px-4 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              style={{
                background: `linear-gradient(135deg, ${portalConfig.primary_color}, ${portalConfig.secondary_color})`,
                boxShadow: `0 4px 14px -3px ${portalConfig.primary_color}50`,
              }}
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Now</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
