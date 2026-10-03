/**
 * Version check utility to ensure client SPA is in sync with the deployed build.
 * If a newer static build is detected on the server, a forced reload is performed.
 */

export async function checkBuildVersion() {
  try {
    if (import.meta.env.DEV) {
      return;
    }

    const localTimestamp = typeof __BUILD_TIMESTAMP__ !== 'undefined'
      ? parseInt(__BUILD_TIMESTAMP__, 10)
      : 0;

    if (!localTimestamp) {
      return;
    }

    const response = await fetch(`/build?t=${Date.now()}`, { cache: 'no-cache' });
    if (!response.ok) {
      return;
    }

    let remoteTimestampStr = (await response.text()).trim();
    let remoteTimestamp = parseInt(remoteTimestampStr, 10);

    // Fallback if timestamp was base64 encoded
    if (isNaN(remoteTimestamp)) {
      try {
        const decoded = window.atob(remoteTimestampStr);
        remoteTimestamp = parseInt(decoded.trim(), 10);
      } catch {
        // Ignore decoding error
      }
    }

    if (!isNaN(remoteTimestamp) && remoteTimestamp > localTimestamp) {
      const lastReloadedBuild = sessionStorage.getItem('last_reloaded_build');
      if (lastReloadedBuild !== String(remoteTimestamp)) {
        sessionStorage.setItem('last_reloaded_build', String(remoteTimestamp));
        console.log(`[VersionCheck] New build detected (Local: ${localTimestamp}, Remote: ${remoteTimestamp}). Force reloading...`);
        window.location.reload();
      }
    }
  } catch (err) {
    // Silently ignore network or offline errors during version check
    console.debug('[VersionCheck] Version check error:', err);
  }
}
