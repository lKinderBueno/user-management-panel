import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders modal content directly into document.body to ensure it is completely isolated
 * from any parent layout styling (such as Tailwind space-y-*, overflow, transform, or stacking contexts).
 * Also locks background body scroll while the modal is mounted and supports ESC key dismissal.
 */
export default function ModalPortal({ children, onClose }) {
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    if (onClose) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (onClose) {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
