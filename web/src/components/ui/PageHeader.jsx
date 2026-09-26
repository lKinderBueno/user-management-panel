import React from 'react';
import { ArrowLeft } from 'lucide-react';

const COLOR_MAP = {
  blue: 'bg-[#eef2ff] dark:bg-blue-950/60 border-[#3970e1]/30 dark:border-blue-800/50 text-[#3970e1] dark:text-blue-400',
  purple: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/60 text-purple-600 dark:text-purple-400',
  red: 'bg-[#feecee] dark:bg-rose-950/60 border-[#f5365c]/30 dark:border-rose-800/50 text-[#f5365c] dark:text-rose-400',
  green: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400',
  orange: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400',
  amber: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-600 dark:text-amber-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400',
  slate: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
};

export default function PageHeader({
  onBack,
  backTitle = 'Go back',
  icon: IconComponent,
  iconColor = 'blue',
  color,
  title,
  badge,
  badges,
  description,
  actions,
  children,
  className = '',
}) {
  const chosenColor = color || iconColor || 'blue';
  const colorClasses = COLOR_MAP[chosenColor] || COLOR_MAP.blue;
  const renderedBadge = badge || badges;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dee2e6] dark:border-slate-800 ${className}`}
    >
      {/* Left side: Back Button + Icon + Title/Badges/Description */}
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-[0.375rem] bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-[#dee2e6] dark:border-slate-700 text-[#525f7f] dark:text-slate-300 shadow-argon-sm transition active:scale-[0.98] shrink-0 mt-0.5 sm:mt-0"
            title={backTitle}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {IconComponent && (
          <div
            className={`w-9 h-9 shrink-0 aspect-square rounded-[0.375rem] border flex items-center justify-center shadow-2xs mt-0.5 sm:mt-0 ${colorClasses}`}
          >
            <IconComponent className="w-5 h-5 shrink-0" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {typeof title === 'string' ? (
              <h1 className="text-lg font-bold text-[#32325d] dark:text-white leading-tight">
                {title}
              </h1>
            ) : (
              title
            )}

            {renderedBadge && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {renderedBadge}
              </div>
            )}
          </div>

          {description && (
            <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}

          {children}
        </div>
      </div>

      {/* Right side: Actions / Steppers */}
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
