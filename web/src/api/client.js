const TOKEN_KEY = 'playlistlabs_token';
const ADMIN_KEY = 'playlistlabs_admin';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
};

export const getAdmin = () => {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setAdmin = (admin) => localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));

export const getServerOrigin = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL.replace(/\/+$/, '');
  }
  // In development (Vite on port 5173), point to Go backend on configured port (default 8080)
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    const devPort = import.meta.env.VITE_SERVER_PORT || import.meta.env.VITE_BACKEND_PORT || '8080';
    return `${window.location.protocol}//${window.location.hostname}:${devPort}`;
  }
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return '';
};

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    removeToken();
    if (!path.startsWith('/auth/me')) {
      window.location.reload();
    }
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errMsg = data?.message || data?.error || `Request failed with status ${res.status}`;
    const err = new Error(errMsg);
    err.data = data;
    err.status = res.status;
    throw err;
  }

  return data;
}

export const authApi = {
  getCaptcha: () => apiFetch('/auth/captcha'),
  login: (credentials) => apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  me: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

export const playlistApi = {
  getPlaylists: () => apiFetch('/playlists'),
  getPlaylist: (listId) => apiFetch(`/playlists/${listId}`),
  getCategories: (listId) => apiFetch(`/playlists/${listId}/categories`),
  refreshPlaylist: (listId, force = false) => {
    try {
      window.dispatchEvent(new CustomEvent('sync-started'));
    } catch {}
    return apiFetch(`/playlists/${listId}/refresh?force=${force}`, { method: 'POST' });
  },
  startSync: (listId, force = false) => {
    try {
      window.dispatchEvent(new CustomEvent('sync-started'));
    } catch {}
    return apiFetch(`/playlists/${listId}/sync?force=${force}`, { method: 'POST' });
  },
  startAllSync: (force = false) => {
    try {
      window.dispatchEvent(new CustomEvent('sync-started'));
    } catch {}
    return apiFetch(`/playlists/sync?force=${force}`, { method: 'POST' });
  },
  getSyncStatus: () => apiFetch('/playlists/sync/status'),
  getSyncLogs: (listId, includeGlobal = true) => 
    apiFetch(`/playlists/${listId}/sync-logs${includeGlobal ? '?include_global=true' : ''}`),
  getAllSyncLogs: () => apiFetch('/sync-logs'),
  deletePlaylist: (listId) => apiFetch(`/playlists/${listId}`, { method: 'DELETE' }),
  updatePlaylistSettings: (listId, payload) => apiFetch(`/playlists/${listId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  getWelcomeInfo: (listId) => apiFetch(`/playlists/${listId}/welcome-info`),
  saveWelcomeInfo: (listId, payload) => apiFetch(`/playlists/${listId}/welcome-info`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  getPortalBranding: (listId) => apiFetch(`/playlists/${listId}/portal-branding`),
  savePortalBranding: (listId, payload) => apiFetch(`/playlists/${listId}/portal-branding`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  importFromEditor: (listId, payload) => apiFetch(`/playlists/${listId}/import-from-editor`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

export const playlistsApi = playlistApi;

export const userApi = {
  getUsers: (listId) => apiFetch(`/playlists/${listId}/users`),
  getNextUserId: (listId) => apiFetch(`/playlists/${listId}/next-user-id`),
  createUser: (listId, user) => apiFetch(`/playlists/${listId}/users`, {
    method: 'POST',
    body: JSON.stringify(user),
  }),
  updateUser: (listId, id, user) => apiFetch(`/playlists/${listId}/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user),
  }),
  deleteUsers: (listId, ids) => apiFetch(`/playlists/${listId}/users`, {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  }),
  moveUsers: (listId, newListId, ids, patternMappings = []) => apiFetch(`/playlists/${listId}/users/move`, {
    method: 'POST',
    body: JSON.stringify({
      new_list_id: String(newListId),
      ids: ids.map((id) => Number(id)),
      ...(patternMappings && patternMappings.length > 0 ? { pattern_mappings: patternMappings } : {}),
    }),
  }),
  updateCredentials: (listId, id, credentials) => apiFetch(`/playlists/${listId}/users/${id}/credentials`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  checkUsername: (username, excludeListId, excludeId) => {
    let url = `/users/check-username?username=${encodeURIComponent(username)}`;
    if (excludeListId) url += `&exclude_list_id=${excludeListId}`;
    if (excludeId) url += `&exclude_id=${excludeId}`;
    return apiFetch(url);
  },
  checkShortUrl: (token, type, excludeListId, excludeId, otherToken) => {
    let url = `/users/check-short-url?token=${encodeURIComponent(token)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (excludeListId) url += `&exclude_list_id=${excludeListId}`;
    if (excludeId) url += `&exclude_id=${excludeId}`;
    if (otherToken) url += `&other_token=${encodeURIComponent(otherToken)}`;
    return apiFetch(url);
  },
  generateRandom: (type) => apiFetch(`/users/generate-random?type=${type}`),
  forceSync: (listId, id, payload) => apiFetch(`/playlists/${listId}/users/${id}/force-sync`, {
    method: 'POST',
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  }),
  bulkUpdateCategories: (listId, updates) => apiFetch(`/playlists/${listId}/users/bulk-categories`, {
    method: 'POST',
    body: JSON.stringify({ updates }),
  }),
  bulkUpdatePatterns: (listId, payload) => apiFetch(`/playlists/${listId}/users/bulk-patterns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getUserConnections: (listId, userId) => apiFetch(`/playlists/${listId}/users/${userId}/connections`),
  getPlaylistConnections: (listId) => apiFetch(`/playlists/${listId}/connections`),
  deleteConnection: (listId, userId, deviceKey) => apiFetch(`/playlists/${listId}/users/${userId}/connections/${encodeURIComponent(deviceKey)}`, {
    method: 'DELETE',
  }),
};

export const geoApi = {
  lookup: (ip) => apiFetch(`/geoip/lookup?ip=${encodeURIComponent(ip)}`),
};

export const teamApi = {
  getTeamMembers: () => apiFetch('/team'),
  getTeamMember: (id) => apiFetch(`/team/${id}`),
  createTeamMember: (member) => apiFetch('/team', {
    method: 'POST',
    body: JSON.stringify(member),
  }),
  updateTeamMember: (id, member) => apiFetch(`/team/${id}`, {
    method: 'PUT',
    body: JSON.stringify(member),
  }),
  deleteTeamMember: (id) => apiFetch(`/team/${id}`, {
    method: 'DELETE',
  }),
};

export const tokensApi = {
  getTokens: () => apiFetch('/tokens'),
  createToken: (payload) => apiFetch('/tokens', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  updateToken: (id, payload) => apiFetch(`/tokens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),
  deleteToken: (id) => apiFetch(`/tokens/${id}`, {
    method: 'DELETE',
  }),
  toggleToken: (id, isActive) => apiFetch(`/tokens/${id}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  }),
};

export const backupApi = {
  downloadBackup: async (listId = null, options = {}) => {
    const token = getToken();
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.include_token) params.append('include_token', 'true');
    if (options.include_team) params.append('include_team', 'true');
    if (listId) params.append('list_id', listId);

    const query = params.toString() ? `?${params.toString()}` : '';
    const url = listId ? `/api/playlists/${listId}/users/backup${query}` : `/api/admin/backup/users${query}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || data?.error || `Backup failed with status ${res.status}`);
    }

    const disposition = res.headers.get('Content-Disposition');
    let filename = listId ? `managed_users_backup_playlist_${listId}.json` : 'system_backup.json';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
  restoreUsers: (payload, listId = null) => {
    const cleanId = listId != null && String(listId).trim() !== '' ? String(listId).trim() : null;
    const path = cleanId ? `/playlists/${cleanId}/users/restore` : '/admin/restore/users';
    return apiFetch(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const settingsApi = {
  getSettings: () => apiFetch('/admin/settings'),
  updateSettings: (settings) => apiFetch('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
  testToken: (token, password = '') => apiFetch('/admin/settings/test-token', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }),
  testTMDBKey: (apiKey) => apiFetch('/admin/settings/test-tmdb', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey }),
  }),
  testCaptcha: (data) => apiFetch('/admin/settings/test-captcha', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  triggerPlaylistSync: (force = false) => {
    try {
      window.dispatchEvent(new CustomEvent('sync-started'));
    } catch {}
    return apiFetch(`/admin/settings/sync/playlists${force ? '?force=true' : ''}`, {
      method: 'POST',
    });
  },
  triggerExpirySync: (all = false, days = null) => {
    const params = new URLSearchParams();
    if (all) params.append('all', 'true');
    if (days && Number(days) > 0) params.append('days', days);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/admin/settings/sync/expiry${qs}`, {
      method: 'POST',
    });
  },
  triggerBackup: (options = {}) => apiFetch('/admin/settings/backup/run', {
    method: 'POST',
    body: JSON.stringify(options),
  }),
  getBackups: () => apiFetch('/admin/settings/backups'),
  restoreStoredBackup: (filename, options = {}) => {
    const payload = typeof options === 'string'
      ? { filename, mode: options }
      : { filename, ...options };
    return apiFetch('/admin/settings/backups/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  downloadStoredBackup: async (filename) => {
    const token = getToken();
    const res = await fetch(`/api/admin/settings/backups/download/${encodeURIComponent(filename)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }
    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
  deleteBackup: (filename) => apiFetch(`/admin/settings/backups/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  }),
  clearCache: (scope = 'all') => apiFetch('/admin/settings/cache/clear', {
    method: 'POST',
    body: JSON.stringify({ scope }),
  }),
  importFromEditor: (payload) => apiFetch('/admin/settings/import-editor', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
};

export const securityApi = {
  getStats: () => apiFetch('/admin/security/stats'),
  getTrackedIPs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', params.page);
    if (params.limit) q.set('limit', params.limit);
    return apiFetch(`/admin/security/ips?${q.toString()}`);
  },
  blockIP: (payload) => apiFetch('/admin/security/ips/block', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  unblockIP: (ip) => apiFetch('/admin/security/ips/unblock', {
    method: 'POST',
    body: JSON.stringify({ ip }),
  }),
  resetAttempts: (ip) => apiFetch('/admin/security/ips/reset', {
    method: 'POST',
    body: JSON.stringify({ ip }),
  }),
  deleteIP: (ip) => apiFetch(`/admin/security/ips/${encodeURIComponent(ip)}`, {
    method: 'DELETE',
  }),
  getLogs: (params = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit);
    if (params.ip) q.set('ip', params.ip);
    if (params.type) q.set('type', params.type);
    return apiFetch(`/admin/security/logs?${q.toString()}`);
  },
  flushLogs: (all = false, retentionDays = null) => {
    const q = new URLSearchParams();
    if (all) q.set('all', 'true');
    if (retentionDays) q.set('retention_days', retentionDays);
    return apiFetch(`/admin/security/logs/flush?${q.toString()}`, { method: 'POST' });
  },
  getCompromisedUsers: (params = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', params.limit);
    if (params.status) q.set('status', params.status);
    return apiFetch(`/admin/security/compromised?${q.toString()}`);
  },
  resolveCompromisedIncident: (id) => apiFetch(`/admin/security/incidents/${id}/resolve`, {
    method: 'POST',
  }),
  unsuspendUser: (username) => apiFetch(`/admin/security/users/${encodeURIComponent(username)}/unsuspend`, {
    method: 'POST',
  }),
  getSSLDomains: () => apiFetch('/admin/security/ssl-domains'),
  testDomainDNS: (domain) => apiFetch('/admin/security/test-domain', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  }),
};

export const userPortalApi = {
  getConfig: async () => {
    const res = await fetch('/api/user-dashboard/config');
    if (!res.ok) throw new Error('Failed to load user portal configuration');
    return res.json();
  },
  login: async (username, password) => {
    const params = new URLSearchParams({ username, password, portal: '1' });
    const res = await fetch(`/player_api.php?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to connect to server');
    const data = await res.json();
    if (!data || data.user_info?.auth === 0 || !data.user_info) {
      throw new Error(data?.user_info?.message || 'Invalid username or password');
    }
    return data;
  },
  getCategories: async (username, password, action) => {
    const params = new URLSearchParams({
      username,
      password,
      action,
      include_hidden: '1',
    });
    const res = await fetch(`/player_api.php?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },
  getSettings: async (username, password) => {
    const params = new URLSearchParams({
      username,
      password,
      action: 'get_settings',
    });
    const res = await fetch(`/player_api.php?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },
  saveSettings: async (username, password, settings) => {
    const params = new URLSearchParams({
      username,
      password,
      action: 'save_settings',
    });
    const res = await fetch(`/player_api.php?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json().catch(() => ({}));
  },
};

export const setupApi = {
  getStatus: () => apiFetch('/setup/status'),
  testConnection: (apiUrl, apiToken, apiPassword = '') =>
    apiFetch('/setup/test-connection', {
      method: 'POST',
      body: JSON.stringify({ api_url: apiUrl, api_token: apiToken, api_password: apiPassword }),
    }),
  initialize: (payload) =>
    apiFetch('/setup/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const diagnosticsApi = {
  getSystemInfo: () => apiFetch('/admin/diagnostics/system'),
  getLogs: (limit = 100) => apiFetch(`/admin/diagnostics/logs?limit=${limit}`),
  downloadBundle: async () => {
    const token = getToken();
    const res = await fetch('/api/admin/diagnostics/bundle', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.message || data?.error || `Failed to download diagnostic bundle (status: ${res.status})`);
    }

    const disposition = res.headers.get('Content-Disposition');
    let filename = 'playlistlabs-diagnostics.zip';
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};



