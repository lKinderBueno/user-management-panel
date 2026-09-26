/**
 * Safely parses patterns from an array, string, or undefined/null.
 * @param {any} patterns
 * @returns {Array<Object>}
 */
export function safeParsePatterns(patterns) {
  if (!patterns) return [];
  if (Array.isArray(patterns)) return patterns;
  if (typeof patterns === 'string') {
    try {
      const parsed = JSON.parse(patterns);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Returns the normalized identifier key for a pattern item based strictly on its URL.
 * Matching is strictly by URL: trimmed, lowercased, and without trailing slashes.
 * @param {Object} pattern
 * @returns {string}
 */
export function getPatternKey(pattern) {
  if (!pattern || typeof pattern.url !== 'string') return '';
  return pattern.url.trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Returns the effective patterns for a managed user by intelligently merging playlist
 * default patterns with user custom overrides.
 * Matching is strictly by provider URL:
 * - Playlist patterns serve as the baseline.
 * - If the user has a pattern with matching URL, the user's pattern overwrites it (marked isInherited: false).
 * - If the user doesn't have a pattern for that URL, the playlist pattern is inherited (marked isInherited: true).
 * - Extra user patterns not present in the playlist are appended.
 *
 * @param {Object} user - Managed user object
 * @param {Object} playlist - Relative playlist object
 * @returns {{ patterns: Array<Object>, isInherited: boolean, hasInherited: boolean, hasCustom: boolean }}
 */
export function getEffectiveUserPatterns(user, playlist) {
  const userPatterns = safeParsePatterns(user?.patterns);
  const playlistPatterns = safeParsePatterns(playlist?.patterns);

  if (playlistPatterns.length === 0) {
    const hasCustom = userPatterns.length > 0;
    const seen = new Set();
    const deduped = [];
    for (const p of userPatterns) {
      const k = getPatternKey(p);
      if (!k || !seen.has(k)) {
        deduped.push({ ...p, isInherited: false });
        if (k) seen.add(k);
      }
    }
    return {
      patterns: deduped,
      isInherited: false,
      hasInherited: false,
      hasCustom,
    };
  }

  if (userPatterns.length === 0) {
    return {
      patterns: playlistPatterns.map((p) => ({ ...p, isInherited: true })),
      isInherited: true,
      hasInherited: true,
      hasCustom: false,
    };
  }

  const userMap = new Map();
  userPatterns.forEach((p) => {
    const key = getPatternKey(p);
    if (key) {
      userMap.set(key, p);
    }
  });

  const merged = [];
  const usedKeys = new Set();
  let hasInherited = false;
  let hasCustom = false;

  for (const plPat of playlistPatterns) {
    const key = getPatternKey(plPat);
    if (key && userMap.has(key)) {
      merged.push({ ...userMap.get(key), isInherited: false });
      usedKeys.add(key);
      hasCustom = true;
    } else {
      merged.push({ ...plPat, isInherited: true });
      hasInherited = true;
    }
  }

  for (const uPat of userPatterns) {
    const key = getPatternKey(uPat);
    if (!key || !usedKeys.has(key)) {
      merged.push({ ...uPat, isInherited: false });
      if (key) usedKeys.add(key);
      hasCustom = true;
    }
  }

  return {
    patterns: merged,
    isInherited: !hasCustom && hasInherited,
    hasInherited,
    hasCustom,
  };
}
