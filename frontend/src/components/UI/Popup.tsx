import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button, IconButton } from './Button';

export interface PopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  className?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAlign?: 'left' | 'center' | 'right' | 'space-between';
  loading?: boolean;
}

export const Popup: React.FC<PopupProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  closable = true,
  className = '',
  children,
  footer,
  footerAlign = 'right',
  loading = false
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closable) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closable]);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0] as HTMLElement;
      if (firstFocusable) {
        firstFocusable.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closable && !loading) {
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div 
        ref={modalRef}
        className={`modal-content modal-${size} ${loading ? 'modal-loading' : ''} ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        {(title || subtitle || closable) && (
          <div className="modal-header">
            <div className="modal-header-content">
              {title && <h2 className="modal-title">{title}</h2>}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            {closable && (
              <IconButton
                icon={X}
                onClick={onClose}
                variant="ghost"
                size="sm"
                aria-label="Close modal"
                className="modal-close-btn"
                disabled={loading}
              />
            )}
          </div>
        )}
        
        {/* Modal Body */}
        <div className="modal-body">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className={`modal-footer modal-footer--${footerAlign}`}>
            {footer}
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="modal-loading-overlay">
            <div className="modal-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};

// Convenience component for standard form popups
export interface FormPopupProps extends Omit<PopupProps, 'footer'> {
  onSubmit?: (e: React.FormEvent) => void;
  submitText?: string;
  cancelText?: string;
  submitVariant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  submitDisabled?: boolean;
  showCancel?: boolean;
}

export const FormPopup: React.FC<FormPopupProps> = ({
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  submitVariant = 'primary',
  submitDisabled = false,
  showCancel = true,
  loading = false,
  onClose,
  children,
  ...popupProps
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && !loading && !submitDisabled) {
      onSubmit(e);
    }
  };

  const footer = (
    <>
      {showCancel && (
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </Button>
      )}
      <Button
        type="submit"
        variant={submitVariant}
        loading={loading}
        disabled={submitDisabled || loading}
        onClick={(e) => {
          // For submit buttons, let the form handle the submission
          if (!loading && !submitDisabled) {
            const form = e.currentTarget.closest('form');
            if (form) {
              form.requestSubmit();
            } else {
              // If no form found, trigger submit manually
              const syntheticEvent = new Event('submit', { bubbles: true, cancelable: true }) as any;
              syntheticEvent.preventDefault = () => {};
              handleSubmit(syntheticEvent);
            }
          }
        }}
      >
        {submitText}
      </Button>
    </>
  );

  return (
    <Popup
      {...popupProps}
      onClose={onClose}
      footer={footer}
      loading={loading}
    >
      <form onSubmit={handleSubmit}>
        {children}
      </form>
    </Popup>
  );
};

// Convenience component for confirmation popups
export interface ConfirmPopupProps extends Omit<PopupProps, 'footer' | 'children'> {
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  onConfirm: () => void;
}

export const ConfirmPopup: React.FC<ConfirmPopupProps> = ({
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onClose,
  loading = false,
  ...popupProps
}) => {
  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  const footer = (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={loading}
      >
        {cancelText}
      </Button>
      <Button
        type="button"
        variant={confirmVariant}
        onClick={handleConfirm}
        loading={loading}
        disabled={loading}
      >
        {confirmText}
      </Button>
    </>
  );

  return (
    <Popup
      {...popupProps}
      onClose={onClose}
      footer={footer}
      loading={loading}
    >
      <div className="popup-message">
        {message}
      </div>
    </Popup>
  );
};