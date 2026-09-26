import React from 'react';
import { AlertTriangle, Sparkles, ExternalLink, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LicenseSuspendedBanner({ admin, licenseInfo, onRefresh }) {
  // Determine suspension status either from licenseInfo or admin object
  const isSuspended = Boolean(licenseInfo?.license_suspended ?? admin?.license_suspended);
  const suspendedAt = licenseInfo?.license_suspended_at || admin?.license_suspended_at;
  const upgradeUrl = licenseInfo?.license_upgrade_url || admin?.license_upgrade_url || 'https://playlistlabs.io';

  if (!isSuspended) {
    return null;
  }

  // Calculate days remaining before the 7-day hard purge
  let daysLeft = 7;
  let isPurged = false;
  if (suspendedAt) {
    const elapsedMs = Math.max(0, Date.now() - new Date(suspendedAt).getTime());
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    daysLeft = Math.max(0, 7 - elapsedDays);
    isPurged = elapsedDays >= 7;
  }

  return (
    <div className="w-full bg-gradient-to-r from-amber-500/15 via-red-500/15 to-amber-500/15 dark:from-amber-950/40 dark:via-red-950/40 dark:to-amber-950/40 border-b border-amber-500/30 dark:border-amber-500/20 px-4 py-3 text-slate-800 dark:text-slate-100 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Service Suspended: Plan Upgrade Required
              </h4>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Access requires an upgraded subscription plan.
            </p>

          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {admin?.role === 'admin' && (
            <Link
              to="/settings"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              <span>Manage Settings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}

          <a
            href={upgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-sm transition active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade Plan</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
