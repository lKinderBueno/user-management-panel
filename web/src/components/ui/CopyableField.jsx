import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyTextToClipboard } from '../../utils/clipboard';

/**
 * CopyableField - Shared input component for credentials, URLs, and scripts
 *
 * Supports:
 * - Single-click or focus full-text auto-selection
 * - Automatic copy to clipboard with transient feedback
 * - Optional action buttons (Download, Open in new tab, etc.)
 * - Optional password toggle (via type="password" or custom controls)
 * - Admin or Portal visual variants
 */
export default function CopyableField({
  label,
  rightLabel,
  value = '',
  type = 'text',
  placeholder = '',
  variant = 'admin', // 'admin' | 'portal'
  actionButton = null,
  className = '',
  inputClassName = '',
  buttonClassName = '',
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  onCopySuccess = null,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    const ok = await copyTextToClipboard(value);
    if (ok) {
      setCopied(true);
      if (onCopySuccess) onCopySuccess();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPortal = variant === 'portal';

  const defaultInputClass = isPortal
    ? 'font-mono text-xs h-8 sm:h-9 flex-1 px-3 rounded-lg border border-slate-800 bg-slate-900/90 text-slate-200 focus:outline-none cursor-text selection:bg-blue-600 selection:text-white'
    : 'font-mono text-xs h-9 flex-1 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none cursor-text selection:bg-blue-600 selection:text-white';

  const defaultButtonClass = isPortal
    ? 'h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition active:scale-95'
    : 'h-9 px-3 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 transition active:scale-98';

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || rightLabel) && (
        <div className="flex items-center justify-between text-[13px]">
          {label && (
            <div className={isPortal ? 'text-slate-400' : 'text-xs font-bold text-slate-600 dark:text-slate-400'}>
              {label}
            </div>
          )}
          {rightLabel && (
            <div className={isPortal ? 'text-slate-400' : 'text-[11px] font-semibold text-slate-500 dark:text-slate-400'}>
              {rightLabel}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        <input
          type={type}
          readOnly
          value={value}
          placeholder={placeholder}
          className={`${defaultInputClass} ${inputClassName}`}
        />

        <button
          type="button"
          onClick={handleCopy}
          title={copied ? copiedLabel : copyLabel}
          className={`${defaultButtonClass} ${buttonClassName}`}
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span>{copied ? copiedLabel : copyLabel}</span>
        </button>

        {actionButton}
      </div>
    </div>
  );
}
