import React from 'react';
import { Trash2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import Alert from './Alert';

const ICONS = {
  danger: {
    icon: Trash2,
    badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
    buttonVariant: 'danger',
  },
  warning: {
    icon: AlertTriangle,
    badgeClass: 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    buttonVariant: 'warning',
  },
  info: {
    icon: Info,
    badgeClass: 'bg-blue-100 dark:bg-blue-950/60 text-[#3970e1] dark:text-blue-400',
    buttonVariant: 'primary',
  },
};

export default function ConfirmDialog({
  isOpen = true,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  alertText,
  error,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  size = 'md',
  icon,
}) {
  if (!isOpen) return null;

  const styleConfig = ICONS[variant] || ICONS.danger;
  const IconComponent = styleConfig.icon;

  const handleConfirm = async (e) => {
    e?.preventDefault();
    if (loading) return;
    await onConfirm?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) onClose?.();
      }}
      size={size}
      closeOnBackdropClick={!loading}
      closeOnEsc={!loading}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${styleConfig.badgeClass}`}
          >
            {icon || <IconComponent className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-[#32325d] dark:text-white">
              {title}
            </h3>
            {description && (
              <div className="text-xs text-[#8898aa] dark:text-slate-400 mt-1 leading-relaxed">
                {description}
              </div>
            )}
          </div>
        </div>

        {alertText && (
          <Alert variant={variant === 'danger' ? 'error' : variant}>
            {alertText}
          </Alert>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e9ecef] dark:border-slate-800">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant={styleConfig.buttonVariant}
            onClick={handleConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
