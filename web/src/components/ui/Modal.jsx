import React, { createContext, useContext } from 'react';
import { X } from 'lucide-react';
import ModalPortal from '../ModalPortal';

const ModalContext = createContext({ onClose: undefined });

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[95vw]',
};

export default function Modal({
  isOpen = true,
  onClose,
  children,
  size = 'md',
  className = '',
  backdropClassName = '',
  closeOnBackdropClick = true,
  closeOnEsc = true,
}) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <ModalPortal onClose={closeOnEsc ? onClose : undefined}>
      <ModalContext.Provider value={{ onClose }}>
        <div
          className={`fixed inset-0 !m-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto ${
            closeOnBackdropClick ? 'cursor-pointer' : ''
          } ${backdropClassName}`}
          onClick={handleBackdropClick}
        >
          <div
            role="dialog"
            aria-modal="true"
            className={`bg-white dark:bg-slate-900 border border-[#dee2e6] dark:border-slate-800 rounded-xl shadow-argon-dropdown dark:shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto cursor-default w-full ${sizeClass} ${className}`}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </ModalContext.Provider>
    </ModalPortal>
  );
}

function ModalHeader({
  icon,
  iconClassName = 'bg-[#eef2ff] dark:bg-blue-950/60 border border-[#3970e1]/20 dark:border-blue-800/40 text-[#3970e1] dark:text-blue-400',
  title,
  subtitle,
  children,
  onClose,
  actions,
  className = '',
  showClose = true,
}) {
  const context = useContext(ModalContext);
  const handleClose = onClose || context.onClose;

  return (
    <div
      className={`px-5 py-4 border-b border-[#e9ecef] dark:border-slate-800 flex items-center justify-between gap-3 bg-[#f8f9fe]/80 dark:bg-slate-800/60 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${iconClassName}`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="font-bold text-[#32325d] dark:text-white text-base leading-tight truncate">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-[#8898aa] dark:text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {showClose && handleClose && (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="p-1.5 text-[#8898aa] dark:text-slate-400 hover:text-[#32325d] dark:hover:text-white hover:bg-white dark:hover:bg-slate-700/80 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ModalBody({
  children,
  className = '',
  scrollable = true,
  maxHeight = 'max-h-[85vh]',
}) {
  return (
    <div
      className={`${scrollable ? `overflow-y-auto ${maxHeight}` : ''} p-6 ${className}`}
    >
      {children}
    </div>
  );
}

function ModalFooter({
  children,
  className = '',
  align = 'end', // 'start' | 'center' | 'end' | 'between'
}) {
  const alignClass =
    align === 'between'
      ? 'justify-between'
      : align === 'center'
      ? 'justify-center'
      : align === 'start'
      ? 'justify-start'
      : 'justify-end';

  return (
    <div
      className={`px-6 py-3.5 bg-slate-50/80 dark:bg-slate-800/80 border-t border-[#e9ecef] dark:border-slate-800 flex items-center gap-2.5 ${alignClass} ${className}`}
    >
      {children}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
