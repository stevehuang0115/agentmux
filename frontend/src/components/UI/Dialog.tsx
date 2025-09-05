import React, { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

// Alert Dialog Component
export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK'
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Info;
    }
  };

  const Icon = getIcon();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      className="dialog-modal"
    >
      <div className="dialog-content">
        <div className={`dialog-icon dialog-icon-${type}`}>
          <Icon size={48} />
        </div>
        <div className="dialog-message">
          {message}
        </div>
      </div>
      
      <ModalFooter>
        <Button
          variant="primary"
          onClick={onClose}
          fullWidth
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

// Confirm Dialog Component
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return AlertTriangle;
    }
  };

  const Icon = getIcon();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      className="dialog-modal"
      closable={!loading}
    >
      <div className="dialog-content">
        <div className={`dialog-icon dialog-icon-${type}`}>
          <Icon size={48} />
        </div>
        <div className="dialog-message">
          {message}
        </div>
      </div>
      
      <ModalFooter>
        <div className="dialog-actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={type === 'error' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

// Hook for programmatic alerts
export const useAlert = () => {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: AlertType;
    confirmText?: string;
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const showAlert = (
    message: string, 
    type: AlertType = 'info', 
    title?: string,
    confirmText?: string
  ) => {
    setAlertState({
      isOpen: true,
      message,
      type,
      title,
      confirmText
    });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, isOpen: false }));
  };

  const AlertComponent = () => (
    <AlertDialog
      isOpen={alertState.isOpen}
      onClose={closeAlert}
      title={alertState.title}
      message={alertState.message}
      type={alertState.type}
      confirmText={alertState.confirmText}
    />
  );

  return {
    showAlert,
    AlertComponent,
    // Convenience methods
    showSuccess: (message: string, title?: string) => showAlert(message, 'success', title),
    showError: (message: string, title?: string) => showAlert(message, 'error', title),
    showWarning: (message: string, title?: string) => showAlert(message, 'warning', title),
    showInfo: (message: string, title?: string) => showAlert(message, 'info', title),
  };
};

// Hook for programmatic confirms
export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: AlertType;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    loading: boolean;
  }>({
    isOpen: false,
    message: '',
    type: 'warning',
    onConfirm: () => {},
    loading: false
  });

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    {
      type = 'warning',
      title,
      confirmText,
      cancelText
    }: {
      type?: AlertType;
      title?: string;
      confirmText?: string;
      cancelText?: string;
    } = {}
  ) => {
    setConfirmState({
      isOpen: true,
      message,
      type,
      title,
      confirmText,
      cancelText,
      onConfirm,
      loading: false
    });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = async () => {
    setConfirmState(prev => ({ ...prev, loading: true }));
    try {
      await confirmState.onConfirm();
      closeConfirm();
    } catch (error) {
      setConfirmState(prev => ({ ...prev, loading: false }));
      // Error handling could be added here
    }
  };

  const ConfirmComponent = () => (
    <ConfirmDialog
      isOpen={confirmState.isOpen}
      onConfirm={handleConfirm}
      onCancel={closeConfirm}
      title={confirmState.title}
      message={confirmState.message}
      type={confirmState.type}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      loading={confirmState.loading}
    />
  );

  return {
    showConfirm,
    ConfirmComponent,
    // Convenience methods
    showDeleteConfirm: (itemName: string, onConfirm: () => void) => 
      showConfirm(
        `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
        onConfirm,
        { type: 'error', title: 'Confirm Deletion', confirmText: 'Delete' }
      ),
  };
};