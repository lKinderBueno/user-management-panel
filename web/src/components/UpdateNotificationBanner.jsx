import React, { useState, useEffect } from 'react';
import { Sparkles, ExternalLink, X, ArrowUpCircle } from 'lucide-react';

const DISMISSED_KEY = 'playlistlabs_dismissed_update_version';

export default function UpdateNotificationBanner({ versionInfo }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (versionInfo?.latest_version) {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored === String(versionInfo.latest_version)) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    }
  }, [versionInfo?.latest_version]);

  if (!versionInfo?.update_available || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    if (versionInfo?.latest_version) {
      localStorage.setItem(DISMISSED_KEY, String(versionInfo.latest_version));
    }
    setDismissed(true);
  };

  const changelogUrl = versionInfo?.changelog_url || 'https://guide-ump.playlistlabs.io/changelog/';

  return (
    <div className="w-full bg-gradient-to-r from-blue-600/10 via-indigo-600/15 to-purple-600/10 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-b border-blue-500/25 dark:border-blue-500/20 px-4 py-2.5 text-slate-800 dark:text-slate-100 transition-all shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-blue-500/20 dark:bg-blue-500/30 text-blue-600 dark:text-blue-400 shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="font-bold text-slate-900 dark:text-white">
              New Dashboard Version Available:
            </span>
            <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60">
              v{versionInfo.latest_version}
            </span>
            <span className="text-slate-500 dark:text-slate-400 hidden md:inline">
              (Current: v{versionInfo.version})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <a
            href={changelogUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition active:scale-[0.98]"
          >
            <span>View Changelog</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            onClick={handleDismiss}
            title="Dismiss notification for this version"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
