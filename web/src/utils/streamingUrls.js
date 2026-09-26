import { getServerOrigin } from '../api/client';

/**
 * Checks if a hostname or host string is an IP address, localhost, or loopback.
 * @param {string} host
 * @returns {boolean}
 */
export function isIPAddress(host) {
  if (!host) return false;
  const clean = host
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .replace(/^\[/, '')
    .replace(/\](?::\d+)?$/, '')
    .split(':')[0]
    .trim()
    .toLowerCase();

  if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') {
    return true;
  }
  // IPv4 regex (4 octets 0-255)
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(clean)) {
    return true;
  }
  // IPv6 check (contains colon)
  if (clean.includes(':')) {
    return true;
  }
  return false;
}

/**
 * Splits a host string into hostname and port.
 * Handles IPv6 bracket notation, standard host:port, or plain hostname.
 * @param {string} raw
 * @returns {[string, string]} [host, port]
 */
export function splitHostAndPort(raw) {
  if (!raw) return ['', ''];
  const clean = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

  // Check IPv6 bracket notation e.g. [::1]:8000 or [::1]
  const ipv6Match = clean.match(/^(\[[0-9a-fA-F:]+\])(?::(\d+))?$/);
  if (ipv6Match) {
    return [ipv6Match[1], ipv6Match[2] || ''];
  }

  // Check IPv4 or standard hostname with port e.g. domain.com:8000
  const parts = clean.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return [parts[0], parts[1]];
  }

  return [clean, ''];
}

/**
 * Returns the effective port used by the website / server.
 * Ignores default ports 80 and 443. In Vite dev mode (5173), checks VITE_SERVER_PORT / VITE_BACKEND_PORT.
 * @returns {string}
 */
export function getSitePort() {
  if (typeof window === 'undefined') return '';
  if (window.location.port === '5173') {
    return import.meta.env.VITE_SERVER_PORT || import.meta.env.VITE_BACKEND_PORT || '8080';
  }
  return window.location.port || '';
}

/**
 * Strips leading protocols, trailing slashes, and redundant known subdomains (stb., player., web.).
 * @param {string} host
 * @returns {string}
 */
export function cleanBaseHost(host) {
  if (!host) return '';
  return host
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim()
    .replace(/^(?:stb|player|web)\./i, '');
}

/**
 * Determines whether the dashboard domain is locked to administrative traffic only.
 * @param {Object} settings
 * @returns {boolean}
 */
export function isDashboardLocked(settings) {
  if (!settings) return false;
  const adminHost = (settings.admin_hostname || '').trim().toLowerCase();
  const blockStreaming = settings.block_streaming_on_admin_host !== undefined
    ? Boolean(settings.block_streaming_on_admin_host)
    : true;
  const restrictAdmin = Boolean(settings.restrict_admin_to_admin_host);

  // If administration is restricted to the admin hostname
  if (restrictAdmin) return true;

  // If a dedicated admin hostname is configured and streaming on it is blocked
  if (adminHost && blockStreaming) return true;

  return false;
}

/**
 * Resolves the base protocol + host for streaming links (M3U, EPG, Xtream Codes, etc.).
 *
 * Rules:
 * 1. If CNAME is configured:
 *    - If CNAME has an explicit port (e.g. domain.com:8000), that port is used.
 *    - If CNAME has no port and is not SSL, it automatically inherits the site's port (e.g. :8000).
 *    - If CNAME is SSL, it uses standard HTTPS (443) unless the dashboard itself is HTTPS on a non-standard port.
 * 2. If CNAME is not configured:
 *    - Falls back to getServerOrigin() (which preserves the site's origin and port).
 *
 * @param {Object} [options]
 * @param {string} [options.cname] - Configured playlist CNAME domain(s)
 * @param {boolean} [options.cnameSSL] - Whether CNAME SSL is enabled
 * @param {string} [options.currentHostname] - Current window or server hostname
 * @param {string} [options.currentProtocol] - Current window or server protocol
 * @param {string} [options.currentPort] - Current window or server port
 * @returns {string} Base URL without trailing slash (e.g. "http://domain.com:8000")
 */
export function resolveProtocolHost({
  cname = '',
  cnameSSL = false,
  currentHostname = (typeof window !== 'undefined' ? window.location.hostname : ''),
  currentProtocol = (typeof window !== 'undefined' ? window.location.protocol : 'http:'),
  currentPort = (typeof window !== 'undefined' ? window.location.port : ''),
} = {}) {
  const rawCname = (cname || '').trim();
  const primaryEntry = rawCname.split(/[\s,;]+/)[0] || '';
  const cleanEntry = primaryEntry.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  const hasCname = cleanEntry.length > 0;
  const isCnameSSL = Boolean(cnameSSL || rawCname.startsWith('https://'));

  if (hasCname) {
    const [host, explicitPort] = splitHostAndPort(cleanEntry);
    const sitePort = currentPort !== undefined && currentPort !== '' ? currentPort : getSitePort();

    let portToUse = '';
    if (explicitPort) {
      portToUse = explicitPort;
    } else if (isCnameSSL) {
      if (currentProtocol === 'https:' && sitePort && sitePort !== '443' && sitePort !== '80') {
        portToUse = sitePort;
      }
    } else {
      if (sitePort && sitePort !== '80' && sitePort !== '443') {
        portToUse = sitePort;
      }
    }

    const scheme = isCnameSSL ? 'https' : 'http';
    const hostWithPort = portToUse ? `${host}:${portToUse}` : host;
    return `${scheme}://${hostWithPort}`;
  }

  return getServerOrigin();
}

/**
 * Resolves streaming player or STB portal URLs.
 * Supports subdomain customization ('player' for Web Player, 'stb' for MAG / Stalker Portal).
 *
 * @param {Object} options
 * @param {string} [options.subdomain='stb'] - 'player' or 'stb'
 * @param {string} [options.cname] - Playlist CNAME if configured
 * @param {boolean} [options.cnameSSL] - Whether CNAME uses SSL
 * @param {string} [options.username] - Username for path authentication
 * @param {string} [options.password] - Password for path authentication
 * @param {Object} [options.settings] - System settings or public dashboard config
 * @param {string} [options.currentHostname] - Current window or server hostname
 * @param {string} [options.currentProtocol] - Current window or server protocol
 * @param {string} [options.currentPort] - Current window or server port
 * @returns {{ url: string, isError: boolean, errorMessage: string | null, baseHost: string }}
 */
export function resolveStreamingPlayerUrl({
  subdomain = 'stb',
  cname = '',
  cnameSSL = false,
  username = '',
  password = '',
  settings = null,
  currentHostname = (typeof window !== 'undefined' ? window.location.hostname : ''),
  currentProtocol = (typeof window !== 'undefined' ? window.location.protocol : 'http:'),
  currentPort = (typeof window !== 'undefined' ? window.location.port : ''),
  includeAuth = (subdomain !== 'player'),
} = {}) {
  const rawCname = (cname || '').trim();
  const primaryEntry = rawCname.split(/[\s,;]+/)[0] || '';
  const cleanEntry = primaryEntry.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
  const hasCname = cleanEntry.length > 0;
  const isCnameSSL = Boolean(cnameSSL || rawCname.startsWith('https://'));

  const authPath = (includeAuth && (username || password))
    ? `/${encodeURIComponent(username)}/${encodeURIComponent(password)}`
    : '';

  const sitePort = currentPort !== undefined && currentPort !== '' ? currentPort : getSitePort();

  if (hasCname) {
    const [host, explicitPort] = splitHostAndPort(cleanEntry);
    const baseHost = cleanBaseHost(host);

    let portToUse = '';
    if (explicitPort) {
      portToUse = explicitPort;
    } else if (isCnameSSL) {
      if (currentProtocol === 'https:' && sitePort && sitePort !== '443' && sitePort !== '80') {
        portToUse = sitePort;
      }
    } else {
      if (sitePort && sitePort !== '80' && sitePort !== '443') {
        portToUse = sitePort;
      }
    }

    const hostWithPort = portToUse ? `${baseHost}:${portToUse}` : baseHost;
    return {
      url: `http://${subdomain}.${hostWithPort}${authPath}`,
      isError: false,
      errorMessage: null,
      baseHost,
    };
  }

  // CNAME is not configured: check current dashboard host
  const hostIsIP = isIPAddress(currentHostname);
  const lockedToDashboard = isDashboardLocked(settings);

  if (hostIsIP) {
    const msg = 'Error: CNAME not set (dashboard is running on an IP address)';
    return {
      url: msg,
      isError: true,
      errorMessage: msg,
      baseHost: '',
    };
  }

  if (lockedToDashboard) {
    const msg = 'Error: CNAME not set (dashboard domain is locked to dashboard only)';
    return {
      url: msg,
      isError: true,
      errorMessage: msg,
      baseHost: '',
    };
  }

  // Dashboard has a regular domain that is not locked to dashboard only
  const [host, explicitPort] = splitHostAndPort(currentHostname);
  const baseHost = cleanBaseHost(host);
  const portToUse = explicitPort || (sitePort && sitePort !== '80' && sitePort !== '443' ? sitePort : '');
  const hostWithPort = portToUse ? `${baseHost}:${portToUse}` : baseHost;

  return {
    url: `http://${subdomain}.${hostWithPort}${authPath}`,
    isError: false,
    errorMessage: null,
    baseHost,
  };
}

/**
 * Resolves Web Streaming Player URL ("player.<hostname>[:<port>]").
 * @param {Object} options
 * @returns {{ url: string, isError: boolean, errorMessage: string | null, baseHost: string }}
 */
export function resolveWebPlayerUrl(options = {}) {
  return resolveStreamingPlayerUrl({ ...options, subdomain: 'player', includeAuth: false });
}

/**
 * Resolves MAG / Stalker STB Portal URL ("stb.<hostname>[:<port>]").
 * @param {Object} options
 * @returns {{ url: string, isError: boolean, errorMessage: string | null, baseHost: string }}
 */
export function resolveStbUrl(options = {}) {
  return resolveStreamingPlayerUrl({ ...options, subdomain: 'stb' });
}


