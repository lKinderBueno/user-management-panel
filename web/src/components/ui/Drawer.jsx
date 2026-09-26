import React from 'react';
import ModalPortal from '../ModalPortal';

const DRAWER_SIZES = {
  sm: 'w-full sm:w-[380px] max-w-[90vw]',
  md: 'w-full sm:w-[540px] max-w-[90vw]',
  lg: 'w-full sm:w-[720px] max-w-[95vw]',
  xl: 'w-full sm:w-[840px] max-w-[95vw]',
  panel: 'w-full sm:w-[820px] lg:w-[940px] max-w-[95vw]',
  full: 'w-full max-w-[100vw]',
};

export default function Drawer({
  isOpen = true,
  onClose,
  children,
  size = 'panel',
  className = '',
  placement = 'right',
}) {
  if (!isOpen) return null;

  const sizeClass = DRAWER_SIZES[size] || DRAWER_SIZES.panel;
  const isRight = placement === 'right';

  return (
    <ModalPortal onClose={onClose}>
      <div
        className={`fixed inset-0 !m-0 z-50 overflow-hidden flex ${
          isRight ? 'justify-end' : 'justify-start'
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={onClose}
          className="fixed inset-0 !m-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
        />

        {/* Slide-over Drawer */}
        <div
          role="dialog"
          aria-modal="true"
          className={`relative ${sizeClass} bg-white dark:bg-slate-900 ${
            isRight
              ? 'border-l border-[#dee2e6] dark:border-slate-800 animate-in slide-in-from-right'
              : 'border-r border-[#dee2e6] dark:border-slate-800 animate-in slide-in-from-left'
          } shadow-2xl z-10 overflow-y-auto p-6 duration-200 cursor-default ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
