import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-[#3970e1] hover:bg-[#285ec4] active:bg-[#1f4da7] text-white shadow-xs hover:shadow border border-transparent',
  secondary:
    'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700',
  danger:
    'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs hover:shadow border border-transparent',
  success:
    'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs hover:shadow border border-transparent',
  warning:
    'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs hover:shadow border border-transparent',
  outline:
    'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-[#525f7f] dark:text-slate-200 border border-[#dee2e6] dark:border-slate-700',
  ghost:
    'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-transparent',
};

const SIZES = {
  xs: 'px-2.5 py-1 text-[12px] gap-1 rounded-md font-semibold',
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg font-semibold',
  md: 'px-4 py-2 text-xs gap-2 rounded-lg font-bold',
  lg: 'px-5 py-2.5 text-sm gap-2.5 rounded-xl font-bold',
};

export default function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  className = '',
  children,
  onClick,
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </button>
  );
}
