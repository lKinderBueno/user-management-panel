import { userApi } from '../api/client';
import { getEffectiveUserPatterns } from './patterns';

/**
 * Normalizes an Xtream base URL by:
 * - trimming whitespace and trailing slashes
 * - ensuring http:// or https:// protocol
 * - removing default :80 / :443 ports
 */
export function cleanXtreamUrl(rawUrl) {
  let trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'http://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const port = parsed.port;
    if ((port === '80' && parsed.protocol === 'http:') || (port === '443' && parsed.protocol === 'https:')) {
      parsed.port = '';
      trimmed = parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    // If URL parsing fails, continue with trimmed string
  }

  return trimmed;
}

/**
 * Resolves the active Xtream provider target and credentials for a given managed user.
 */
export function resolveXtreamTarget(user, playlist, playlists = []) {
  if (!user) return null;

  const effectivePlaylist =
    (playlists && playlists.find((p) => String(p.id) === String(user.list_id))) || playlist;

  const { patterns } = getEffectiveUserPatterns(user, effectivePlaylist);
  const xtreamPattern = (patterns || []).find(
    (p) => (!p.type || p.type.toLowerCase() === 'xtream') && (p.url || p.curl)
  );

  if (!xtreamPattern) return null;

  const targetUrl = (xtreamPattern.use_curl && xtreamPattern.curl?.trim())
    ? xtreamPattern.curl.trim()
    : (xtreamPattern.url || '').trim();

  if (!targetUrl) return null;

  const cleanUrl = cleanXtreamUrl(targetUrl);
  const username = (xtreamPattern.param1 && xtreamPattern.param1.trim()) || (user.username && user.username.trim()) || '';
  const password = (xtreamPattern.param2 && xtreamPattern.param2.trim()) || (user.password && user.password.trim()) || '';

  return {
    playlistId: effectivePlaylist?.id || user.list_id,
    targetUrl,
    cleanUrl,
    username,
    password,
  };
}

/**
 * Syncs provider data for a user by attempting a direct browser fetch first
 * to avoid overloading or blocking the server's IP address.
 *
 * If the current site is HTTPS while the provider is HTTP (mixed content),
 * or if the client IP is blocked, CORS is restricted, or a network error occurs,
 * it seamlessly falls back to the server to perform the sync.
 */
export async function syncProviderData(user, playlist, options = {}) {
  const timeoutMs = options.timeoutMs || 7000;
  const playlists = options.playlists || [];
  const targetInfo = resolveXtreamTarget(user, playlist, playlists);

  const playlistId = targetInfo?.playlistId || playlist?.id || user?.list_id;
  const userId = user?.id;

  if (!playlistId || !userId) {
    throw new Error('Missing playlist ID or user ID');
  }

  // Fallback payload with in-memory user patterns/credentials if available
  const fallbackPayload = {
    patterns: user?.patterns,
    username: targetInfo?.username || user?.username,
    password: targetInfo?.password || user?.password,
  };

  // If no Xtream configuration or missing credentials, fallback directly to server
  if (!targetInfo || !targetInfo.cleanUrl || !targetInfo.username || !targetInfo.password) {
    return await userApi.forceSync(playlistId, userId, fallbackPayload);
  }

  const { cleanUrl, username, password } = targetInfo;

  // 1. Mixed Content check:
  // If the web app is served over HTTPS and provider URL is HTTP,
  // browsers will block client-side fetch due to Mixed Content security rules.
  // In this case, immediately fallback to server.
  const isPageHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isProviderHttp = /^http:\/\//i.test(cleanUrl);

  if (isPageHttps && isProviderHttp) {
    console.info('[providerSync] Mixed content detected (HTTPS app requesting HTTP provider); falling back to server sync.');
    return await userApi.forceSync(playlistId, userId, fallbackPayload);
  }

  // 2. Client-side fetch from browser
  let clientData = null;
  const endpoint = `${cleanUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`Provider returned HTTP status ${resp.status}`);
    }

    const json = await resp.json();
    if (!json || typeof json !== 'object' || !json.user_info) {
      throw new Error('Provider response did not contain user_info');
    }

    const auth = json.user_info.auth;
    const isAuthOk = auth === 1 || auth === '1' || auth === true || String(auth).toLowerCase() === 'true';
    if (!isAuthOk) {
      throw new Error(`Provider authentication failed (auth=${auth})`);
    }

    clientData = json;
  } catch (err) {
    // If client fetch fails for any reason (CORS, network error, timeout, local IP blocked, auth issue),
    // smoothly fallback to server sync
    console.warn('[providerSync] Client-side fetch failed, falling back to server:', err?.message || err);
  }

  // 3. Persist data
  if (clientData) {
    try {
      return await userApi.forceSync(playlistId, userId, {
        raw_response: clientData,
        ...fallbackPayload,
      });
    } catch (saveErr) {
      console.warn('[providerSync] Server failed to persist client data, attempting fallback server sync:', saveErr?.message || saveErr);
      return await userApi.forceSync(playlistId, userId, fallbackPayload);
    }
  }

  // Fallback to server sync
  return await userApi.forceSync(playlistId, userId, fallbackPayload);
}
