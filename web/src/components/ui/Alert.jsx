import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const VARIANTS = {
  error: {
    container: 'bg-[#feecee] dark:bg-rose-950/40 border-[#f5365c]/30 dark:border-rose-800/40 text-[#f5365c] dark:text-rose-300',
    iconColor: 'text-[#f5365c] dark:text-rose-400',
    defaultIcon: AlertCircle,
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200',
    iconColor: 'text-amber-600 dark:text-amber-400',
    defaultIcon: AlertTriangle,
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200',
    iconColor: 'text-[#3970e1] dark:text-blue-400',
    defaultIcon: Info,
  },
  success: {
    container: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    defaultIcon: CheckCircle2,
  },
};

export default function Alert({
  variant = 'error',
  title,
  children,
  icon,
  onClose,
  className = '',
}) {
  const config = VARIANTS[variant] || VARIANTS.error;
  const IconComponent = config.defaultIcon;

  return (
    <div
      role="alert"
      className={`p-3.5 border rounded-lg text-xs flex items-start gap-2.5 transition animate-in fade-in duration-150 ${config.container} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${config.iconColor}`}>
        {icon || <IconComponent className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0 space-y-0.5 leading-relaxed">
        {title && <strong className="font-bold block">{title}</strong>}
        {children && <div>{children}</div>}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 p-0.5 rounded opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
