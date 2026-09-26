/**
 * Security Attempt Types and Failure Reasons Dictionary
 * Maps technical identifiers to user-friendly English descriptions.
 */

export const ATTEMPT_TYPES = {
  api_token: {
    label: 'REST API Token',
    description: 'Authentication via REST API secret token (X-API-Token header).',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60',
  },
  admin_login: {
    label: 'Admin Portal Login',
    description: 'Web management dashboard administrator login form.',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
  },
  stream_auth: {
    label: 'Stream Line Auth',
    description: 'media player streaming link playback authentication.',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
  },
  xtream_auth: {
    label: 'Xtream Codes API',
    description: 'Xtream-compatible media player API requests (/player_api.php).',
    badgeClass: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60',
  },
  stalker_auth: {
    label: 'Stalker Portal',
    description: 'Stalker middleware player handshake authentication.',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60',
  },
  short_url: {
    label: 'Short URL / Playlist',
    description: 'Shortened M3U / playlist download URL access.',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60',
  },
};

export const SECURITY_REASONS = {
  invalid_credentials: {
    label: 'Invalid Credentials',
    description: 'The supplied username or password is incorrect.',
  },
  invalid_or_expired_token: {
    label: 'Invalid / Expired API Token',
    description: 'The provided API Token is invalid, revoked, or has expired.',
  },
  invalid_token_password: {
    label: 'Invalid Token Password',
    description: 'The API Token requires a password and the supplied password was incorrect.',
  },
  api_token_expired: {
    label: 'API Token Expired',
    description: 'The API Token validity period has lapsed.',
  },
  api_token_disabled: {
    label: 'API Token Deactivated',
    description: 'The API Token was deactivated by an administrator.',
  },
  token_ip_not_allowed: {
    label: 'IP Not Allowed',
    description: 'The client IP is not included in the token’s allowed IP whitelist.',
  },
  token_not_found: {
    label: 'Token / Link Not Found',
    description: 'The requested API token or short URL does not exist.',
  },
  cname_enforcement_failed: {
    label: 'Domain Mismatch (CNAME)',
    description: 'The request Host domain does not match the configured custom domain / CNAME enforcement for this playlist.',
  },
  account_expired: {
    label: 'Account Expired',
    description: 'The user account subscription or trial period has ended.',
  },
  missing_credentials: {
    label: 'Missing Credentials',
    description: 'The request did not supply required credentials (username or password).',
  },
  invalid_captcha: {
    label: 'Invalid CAPTCHA',
    description: 'Security CAPTCHA verification failed or timed out.',
  },
  bad_pass: {
    label: 'Incorrect Password',
    description: 'Password does not match account credentials.',
  },
  user_disabled: {
    label: 'Account Disabled',
    description: 'The user account is locked or suspended.',
  },
  max_connections_reached: {
    label: 'Max Connections Exceeded',
    description: 'Maximum allowed concurrent active streams reached.',
  },
  country_not_allowed: {
    label: 'Geo-Restricted Country',
    description: 'Client connection from this country is blocked by geoblocking policy.',
  },
  user_agent_blocked: {
    label: 'Blocked User-Agent',
    description: 'Client User-Agent is blacklisted by security policy.',
  },
  rate_limit_exceeded: {
    label: 'Rate Limit Exceeded',
    description: 'Too many requests sent in a short time frame.',
  },
};

/**
 * Returns descriptive info for an attempt type.
 */
export function getAttemptTypeInfo(type) {
  if (!type) {
    return {
      label: 'Unknown Channel',
      description: 'Unspecified authentication channel.',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    };
  }
  if (ATTEMPT_TYPES[type]) {
    return ATTEMPT_TYPES[type];
  }
  return {
    label: type,
    description: `Authentication channel: ${type}`,
    badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
  };
}

/**
 * Returns descriptive info for a failure reason code.
 */
export function getSecurityReasonInfo(reason) {
  if (!reason) {
    return {
      label: '-',
      description: '',
    };
  }
  if (SECURITY_REASONS[reason]) {
    return SECURITY_REASONS[reason];
  }

  // If reason is already human readable or contains spaces
  if (reason.includes(' ') || reason.includes(':')) {
    return {
      label: reason,
      description: reason,
    };
  }

  // Format snake_case to Title Case as fallback
  const fallbackLabel = reason
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    label: fallbackLabel,
    description: `Failure code: ${reason}`,
  };
}

/**
 * Formats the blocked reason string for display in the IP Bans table.
 * Strips legacy alarmist text like "Brute force:" and provides clear context.
 */
export function formatDisplayBlockedReason(row) {
  if (!row) return '-';

  // If IP is NOT blocked
  if (!row.is_blocked) {
    if (!row.failed_attempts || row.failed_attempts <= 0) {
      return '-';
    }
    return `Observing (${row.failed_attempts} failed attempt${row.failed_attempts === 1 ? '' : 's'})`;
  }

  // If IP IS blocked
  const reason = row.blocked_reason || '';
  if (!reason) {
    return 'Blocked by security policy';
  }

  // Sanitize legacy "Brute force:" entries from DB
  if (reason.startsWith('Brute force:')) {
    const cleaned = reason
      .replace(/^Brute force:\s*/i, 'Exceeded attempts: ')
      .replace(/on api_token/g, 'on REST API Token')
      .replace(/on admin_login/g, 'on Admin Portal Login')
      .replace(/on stream_auth/g, 'on Stream Line Auth')
      .replace(/on xtream_auth/g, 'on Xtream Codes API')
      .replace(/on stalker_auth/g, 'on Stalker Portal')
      .replace(/on short_url/g, 'on Short URL Link');
    return cleaned;
  }

  return reason;
}
