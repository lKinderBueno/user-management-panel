// Settings search index and registry for global and per-tab settings filtering

export const SETTINGS_SECTIONS = [
  // 1. Synchronization
  {
    id: 'sync-playlists',
    categoryId: 'sync',
    categoryName: 'Synchronization',
    title: 'Playlist Synchronization',
    description: 'Download and synchronize streams, EPG schedule, and categories from PlaylistLabs.',
    keywords: [
      'sync',
      'playlist',
      'schedule',
      'cron',
      'interval',
      'hours',
      'epg',
      'channels',
      'streams',
      'categories',
      'token',
      'api token',
      'playlistlabs',
      'password',
      'tmdb',
      'metadata',
      'poster',
      'movies',
      'series',
      'full refresh',
      're-import',
      'editor',
    ],
  },
  {
    id: 'sync-expiry',
    categoryId: 'sync',
    categoryName: 'Synchronization',
    title: 'User Expiry Synchronization',
    description: 'Query Xtream providers to update user account expiration dates.',
    keywords: [
      'expiry',
      'expiration',
      'user expiry',
      'schedule',
      'cron',
      'interval',
      'hours',
      'sync window',
      'days',
      'all users',
      'xtream',
      'provider',
    ],
  },

  // 2. Security & Access
  {
    id: 'security-bruteforce',
    categoryId: 'security',
    categoryName: 'Security & Access',
    title: 'Anti-Brute Force & IP Protection',
    description: 'Intelligent credential-aware protection for Web Dashboard, Xtream API, and Stream Redirects.',
    keywords: [
      'security',
      'anti-brute force',
      'brute force',
      'ip ban',
      'ban duration',
      'max attempts',
      'attempts',
      'detection window',
      'log retention',
      'audit',
      'hours',
      'security center',
      'credentials',
    ],
  },
  {
    id: 'security-multi-ip',
    categoryId: 'security',
    categoryName: 'Security & Access',
    title: 'Multi-IP Access Detection',
    description: 'Flags and suspends accounts accessed from multiple distinct subnets concurrently.',
    keywords: [
      'multi-ip',
      'subnets',
      'sliding window',
      'auto-suspend',
      'compromised',
      'account suspension',
      'ipv4',
      'ipv6',
      'concurrent ip',
      'sharing',
    ],
  },
  {
    id: 'security-captcha',
    categoryId: 'security',
    categoryName: 'Security & Access',
    title: 'Captcha & Anti-Bot Protection',
    description: 'Configure Cloudflare Turnstile, hCaptcha, or Google reCAPTCHA v2 / v3 on public login.',
    keywords: [
      'captcha',
      'turnstile',
      'cloudflare',
      'hcaptcha',
      'recaptcha',
      'site key',
      'secret key',
      'anti-bot',
      'bot protection',
      'login protection',
    ],
  },
  {
    id: 'security-hostname',
    categoryId: 'security',
    categoryName: 'Security & Access',
    title: 'Domain & Hostname Isolation',
    description: 'Isolate Admin Dashboard from public Xtream Codes API and stream playback traffic.',
    keywords: [
      'admin hostname',
      'domain isolation',
      'dedicated host',
      'block streaming on admin host',
      'restrict dashboard to admin host',
      'block direct ip streaming',
      'anti-lockout',
      'subdomain',
      'hostname',
    ],
  },
  {
    id: 'security-ssl',
    categoryId: 'security',
    categoryName: 'Security & Access',
    title: 'SSL / HTTPS & Custom Domains',
    description: 'Automatic Let\'s Encrypt certificates for Admin Hostname and authorized playlist CNAMEs.',
    keywords: [
      'ssl',
      'https',
      'tls',
      'certificates',
      'let\'s encrypt',
      'cname',
      'custom domains',
      'on-demand ssl',
      'additional ssl domains',
      'encryption',
    ],
  },

  // 3. Traffic & Limits
  {
    id: 'traffic-tracking',
    categoryId: 'traffic',
    categoryName: 'Traffic & Limits',
    title: 'User Connection Tracking & Limits',
    description: 'Enable or disable real-time stream tracking and maximum connection limits per playlist.',
    keywords: [
      'traffic',
      'connections',
      'connection tracking',
      'max connections',
      'limits',
      'devices',
      'concurrent streams',
      'active streams',
      'bulk tracking',
      'playlist limits',
    ],
  },
  {
    id: 'traffic-throttling',
    categoryId: 'traffic',
    categoryName: 'Traffic & Limits',
    title: 'Request Throttling & Rate Limiting',
    description: 'Protect against flood attacks, aggressive scraping, and high-frequency player requests.',
    keywords: [
      'throttle',
      'rate limit',
      'throttling',
      'master switch',
      'stream router',
      'playback redirects',
      'xtream api',
      'player_api',
      'xmltv',
      'client portal',
      'web player',
      'stalker portal',
      'mag',
      'stb',
      'http 429',
      'flood protection',
    ],
  },
  {
    id: 'traffic-buffer',
    categoryId: 'traffic',
    categoryName: 'Traffic & Limits',
    title: 'Stream Buffer Timeout',
    description: 'Configure stream keep-alive buffer timeout and idle disconnection intervals.',
    keywords: [
      'buffer timeout',
      'timeout',
      'keepalive',
      'stream timeout',
      'seconds',
      'idle',
      'disconnection',
    ],
  },

  // 4. Cache & Acceleration
  {
    id: 'cache-redis',
    categoryId: 'cache',
    categoryName: 'Cache & Acceleration',
    title: 'Cache & In-Memory Acceleration (Redis)',
    description: 'Accelerate high-concurrency requests by caching Xtream authentications and stream resolution in Redis.',
    keywords: [
      'cache',
      'redis',
      'in-memory',
      'acceleration',
      'backend',
      'cached keys',
      'hit rate',
      'memory',
      'enable caching',
      'standalone',
    ],
  },
  {
    id: 'cache-ttls',
    categoryId: 'cache',
    categoryName: 'Cache & Acceleration',
    title: 'Cache Expiration & TTL Configuration',
    description: 'Configure cache time-to-live intervals for channels, categories, EPG, stream redirects, and auth tokens.',
    keywords: [
      'ttl',
      'cache expiration',
      'time to live',
      'channels ttl',
      'categories ttl',
      'epg ttl',
      'streams ttl',
      'auth ttl',
      'minutes',
    ],
  },
  {
    id: 'cache-purge',
    categoryId: 'cache',
    categoryName: 'Cache & Acceleration',
    title: 'Selective Cache Purge & Invalidation',
    description: 'Immediately purge specific cache stores (channels, categories, EPG, redirects) or flush all keys.',
    keywords: [
      'purge',
      'clear cache',
      'flush cache',
      'invalidation',
      'reset cache',
      'delete cached keys',
    ],
  },

  // 5. Portal Studio & Branding
  {
    id: 'portal-login',
    categoryId: 'portal',
    categoryName: 'Portal Studio & Branding',
    title: 'Portal Login Screen Branding',
    description: 'Configure public login screen branding, custom logos, wallpaper backgrounds, and login messages.',
    keywords: [
      'portal',
      'branding',
      'login screen',
      'logo',
      'background',
      'theme',
      'colors',
      'login message',
      'announcement',
      'title',
    ],
  },
  {
    id: 'portal-dashboard',
    categoryId: 'portal',
    categoryName: 'Portal Studio & Branding',
    title: 'User Dashboard & Web Player Styling',
    description: 'Customize post-login dashboard experiences, allow category hiding, M3U/EPG downloads, and custom CSS.',
    keywords: [
      'dashboard',
      'web player',
      'custom css',
      'hide categories',
      'm3u download',
      'epg download',
      'playlist branding',
      'client portal',
    ],
  },

  // 6. Backups & Recovery
  {
    id: 'backup-automated',
    categoryId: 'backups',
    categoryName: 'Backups & Recovery',
    title: 'Automated Backups & Schedules',
    description: 'Configure background automated database snapshots, backup intervals, and retention policies.',
    keywords: [
      'backup',
      'automated backup',
      'schedule',
      'cron',
      'retention',
      'max backups',
      'snapshots',
      'database backup',
    ],
  },
  {
    id: 'backup-instant',
    categoryId: 'backups',
    categoryName: 'Backups & Recovery',
    title: 'Snapshot Archives & Instant Server Backup',
    description: 'Trigger immediate full server snapshots, selective playlist archives, or download direct backup files.',
    keywords: [
      'backup now',
      'instant backup',
      'direct download',
      'export backup',
      'backup scope',
      'include token',
      'download snapshot',
    ],
  },
  {
    id: 'backup-restore',
    categoryId: 'backups',
    categoryName: 'Backups & Recovery',
    title: 'Snapshot Management & Restore',
    description: 'Inspect existing backup snapshots, selectively restore playlists, users, settings, or delete archives.',
    keywords: [
      'restore',
      'rollback',
      'selective restore',
      'delete snapshot',
      'upload backup',
      'disaster recovery',
      'snapshot list',
    ],
  },

  // 7. Diagnostics & Logs
  {
    id: 'diagnostics-health',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'Live Host & Process Health',
    description: 'Inspect live CPU usage, memory consumption, active goroutines, and system uptime.',
    keywords: [
      'diagnostics',
      'health',
      'cpu',
      'ram',
      'memory',
      'goroutines',
      'uptime',
      'metrics',
      'system load',
    ],
  },
  {
    id: 'diagnostics-database',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'Database Pool Status',
    description: 'Monitor active SQLite / DB connections, idle pool connections, wait counts, and database latency.',
    keywords: [
      'database',
      'db pool',
      'sqlite',
      'active connections',
      'idle connections',
      'db latency',
    ],
  },
  {
    id: 'diagnostics-specs',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'System Info & Server Specs',
    description: 'Inspect host OS version, Go runtime, server architecture, and environment configuration.',
    keywords: [
      'server specs',
      'system info',
      'os version',
      'go runtime',
      'architecture',
      'environment',
    ],
  },
  {
    id: 'diagnostics-version',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'Dashboard Version & Updates',
    description: 'Inspect current installed dashboard version, check for updates, and view release changelog.',
    keywords: [
      'version',
      'update',
      'updates',
      'changelog',
      'release',
      'upgrade',
      'latest version',
      'panel version',
      'docker compose pull',
    ],
  },
  {
    id: 'diagnostics-logs',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'Live Runtime Logs',
    description: 'Inspect and search real-time server runtime logs and operational events.',
    keywords: [
      'logs',
      'runtime logs',
      'errors',
      'system events',
      'console',
      'filter logs',
      'event stream',
    ],
  },
  {
    id: 'diagnostics-bundle',
    categoryId: 'diagnostics',
    categoryName: 'Diagnostics & Logs',
    title: 'Support Diagnostics Bundle',
    description: 'Export sanitized system diagnostic archive for support and external troubleshooting.',
    keywords: [
      'support bundle',
      'diagnostic bundle',
      'export zip',
      'download bundle',
      'sanitized export',
    ],
  },
];

/**
 * Searches the settings index given a query string.
 * Supports multi-word matching where all query tokens must match.
 */
export function searchSettings(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: '',
      isFiltering: false,
      totalMatches: 0,
      matchingSections: [],
      categoryMatchCounts: {},
      categoriesWithMatches: [],
    };
  }

  const cleanQuery = query.trim().toLowerCase();
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);

  const matchingSections = SETTINGS_SECTIONS.filter((section) => {
    const haystack = [
      section.title,
      section.description,
      section.categoryName,
      section.categoryId,
      ...(section.keywords || []),
    ]
      .join(' ')
      .toLowerCase();

    // Every token must be found in haystack
    return tokens.every((token) => haystack.includes(token));
  });

  const categoryMatchCounts = {};
  matchingSections.forEach((section) => {
    categoryMatchCounts[section.categoryId] = (categoryMatchCounts[section.categoryId] || 0) + 1;
  });

  const categoriesWithMatches = Object.keys(categoryMatchCounts).map((catId) => {
    const sample = matchingSections.find((s) => s.categoryId === catId);
    return {
      id: catId,
      name: sample?.categoryName || catId,
      count: categoryMatchCounts[catId],
    };
  });

  return {
    query: cleanQuery,
    isFiltering: true,
    totalMatches: matchingSections.length,
    matchingSections,
    categoryMatchCounts,
    categoriesWithMatches,
  };
}

/**
 * Checks whether a specific section ID matches the active search query.
 * Always returns true if query is empty.
 */
export function isSectionMatching(sectionId, query) {
  if (!query || typeof query !== 'string' || !query.trim()) return true;
  const result = searchSettings(query);
  return result.matchingSections.some((s) => s.id === sectionId);
}
