import React from 'react';
import { Link } from 'react-router-dom';

const colorStyles = {
  blue: {
    activeBg: 'bg-[#eef2ff] dark:bg-blue-950/60',
    activeText: 'text-[#3970e1] dark:text-blue-400',
    activeBorder: 'border-[#3970e1]/25 dark:border-blue-800/60',
    activeIconBg: 'bg-[#3970e1]',
    activeIconText: 'text-white',
    badge: 'bg-[#3970e1]/15 text-[#3970e1] dark:bg-blue-900/50 dark:text-blue-300',
  },
  green: {
    activeBg: 'bg-[#e8faf1] dark:bg-emerald-950/60',
    activeText: 'text-[#2dce89] dark:text-emerald-400',
    activeBorder: 'border-[#2dce89]/30 dark:border-emerald-800/60',
    activeIconBg: 'bg-[#2dce89]',
    activeIconText: 'text-white',
    badge: 'bg-[#2dce89]/20 text-[#26af74] dark:bg-emerald-900/50 dark:text-emerald-300',
  },
  orange: {
    activeBg: 'bg-[#fff5f2] dark:bg-orange-950/60',
    activeText: 'text-[#fb6340] dark:text-orange-400',
    activeBorder: 'border-[#fb6340]/25 dark:border-orange-800/60',
    activeIconBg: 'bg-[#fb6340]',
    activeIconText: 'text-white',
    badge: 'bg-[#fb6340]/20 text-[#fb6340] dark:bg-orange-900/50 dark:text-orange-300',
  },
  purple: {
    activeBg: 'bg-[#f3e8ff] dark:bg-purple-950/60',
    activeText: 'text-[#9333ea] dark:text-purple-400',
    activeBorder: 'border-[#9333ea]/25 dark:border-purple-800/60',
    activeIconBg: 'bg-[#9333ea]',
    activeIconText: 'text-white',
    badge: 'bg-[#9333ea]/20 text-[#9333ea] dark:bg-purple-900/50 dark:text-purple-300',
  },
  red: {
    activeBg: 'bg-[#feecee] dark:bg-rose-950/60',
    activeText: 'text-[#f5365c] dark:text-rose-400',
    activeBorder: 'border-[#f5365c]/25 dark:border-rose-800/60',
    activeIconBg: 'bg-[#f5365c]',
    activeIconText: 'text-white',
    badge: 'bg-[#f5365c]/20 text-[#f5365c] dark:bg-rose-900/50 dark:text-rose-300',
  },
};

export default function SidebarItem({
  icon,
  label,
  active = false,
  badge = null,
  color = 'blue',
  compact = false,
  to,
  onClick,
  title,
}) {
  const styles = colorStyles[color] || colorStyles.blue;
  const tooltipText = title || label;

  const handleAuxClick = (e) => {
    if (e.button === 1 && to) {
      e.preventDefault();
      window.open(to, '_blank');
    }
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  if (to) {
    if (compact) {
      return (
        <div className="relative group flex justify-center w-full my-0.5">
          <Link
            to={to}
            onClick={handleClick}
            onAuxClick={handleAuxClick}
            aria-label={label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 ${
              active
                ? `${styles.activeIconBg} ${styles.activeIconText} shadow-sm ring-2 ring-white/60 dark:ring-slate-800`
                : 'text-slate-500 hover:text-[#32325d] hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
            }`}
          >
            {React.cloneElement(icon, { className: 'w-4 h-4 shrink-0' })}
          </Link>

          {/* Hover Tooltip (Compact mode) */}
          <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#172b4d] dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 flex items-center gap-2">
            <span>{tooltipText}</span>
            {badge !== null && badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[12px] bg-white/20 text-white font-mono font-bold">
                {badge}
              </span>
            )}
            <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-[#172b4d] dark:border-r-slate-800" />
          </div>
        </div>
      );
    }

    return (
      <Link
        to={to}
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        className={`group w-full h-10 px-2.5 my-0.5 flex items-center gap-2.5 rounded-xl text-[13px] transition-all duration-150 text-left select-none active:scale-[0.99] border ${
          active
            ? `${styles.activeBg} ${styles.activeText} ${styles.activeBorder} font-bold shadow-sm`
            : 'border-transparent text-[#525f7f] hover:text-[#32325d] hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 font-medium'
        }`}
        title={tooltipText}
      >
        {/* Icon */}
        <div
          className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
            active
              ? `${styles.activeIconBg} ${styles.activeIconText} shadow-xs`
              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-200'
          }`}
        >
          {React.cloneElement(icon, { className: 'w-3.5 h-3.5' })}
        </div>

        {/* Label */}
        <span className="flex-1 min-w-0 truncate">{label}</span>

        {/* Badge */}
        {badge !== null && badge !== undefined && (
          <span
            className={`shrink-0 px-2 py-0.5 text-[12px] font-mono font-bold rounded-full transition-colors ${
              active ? styles.badge : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  }

  if (compact) {
    return (
      <div className="relative group flex justify-center w-full my-0.5">
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 ${
            active
              ? `${styles.activeIconBg} ${styles.activeIconText} shadow-sm ring-2 ring-white/60 dark:ring-slate-800`
              : 'text-slate-500 hover:text-[#32325d] hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
          }`}
        >
          {React.cloneElement(icon, { className: 'w-4 h-4 shrink-0' })}
        </button>

        {/* Hover Tooltip (Compact mode) */}
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#172b4d] dark:bg-slate-800 dark:border dark:border-slate-700 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 flex items-center gap-2">
          <span>{tooltipText}</span>
          {badge !== null && badge !== undefined && (
            <span className="px-1.5 py-0.2 rounded-full text-[12px] bg-white/20 text-white font-mono font-bold">
              {badge}
            </span>
          )}
          <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-[#172b4d] dark:border-r-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full h-10 px-2.5 my-0.5 flex items-center gap-2.5 rounded-xl text-[13px] transition-all duration-150 text-left select-none active:scale-[0.99] border ${
        active
          ? `${styles.activeBg} ${styles.activeText} ${styles.activeBorder} font-bold shadow-sm`
          : 'border-transparent text-[#525f7f] hover:text-[#32325d] hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60 font-medium'
      }`}
      title={tooltipText}
    >
      {/* Icon */}
      <div
        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
          active
            ? `${styles.activeIconBg} ${styles.activeIconText} shadow-xs`
            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-200'
        }`}
      >
        {React.cloneElement(icon, { className: 'w-3.5 h-3.5' })}
      </div>

      {/* Label */}
      <span className="flex-1 min-w-0 truncate">{label}</span>

      {/* Badge */}
      {badge !== null && badge !== undefined && (
        <span
          className={`shrink-0 px-2 py-0.5 text-[12px] font-mono font-bold rounded-full transition-colors ${
            active ? styles.badge : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
