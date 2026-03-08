/**
 * Cloud Auth Modal
 *
 * Modal dialog for CrewlyAI Cloud login and registration.
 * Wraps LoginForm and RegisterForm with tab switching.
 *
 * @module components/Auth/CloudAuthModal
 */

import React, { useState } from 'react';
import { Modal } from '../UI';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for CloudAuthModal. */
export interface CloudAuthModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Initial tab to show */
  initialTab?: 'login' | 'register';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal with login/register tabs for CrewlyAI Cloud authentication.
 *
 * @param props - CloudAuthModal props
 * @returns CloudAuthModal component
 */
export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'login',
}) => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await login(email, password);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (email: string, password: string, displayName: string) => {
    setIsSubmitting(true);
    setFormError(null);
    try {
      await register(email, password, displayName);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setFormError(null);
  };

  const title = activeTab === 'login' ? 'Sign in to CrewlyAI Cloud' : 'Create CrewlyAI Cloud Account';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary-dark">
          {activeTab === 'login'
            ? 'Sign in to access premium templates, cloud relay, and more.'
            : 'Create a free account to get started with CrewlyAI Cloud.'}
        </p>

        {activeTab === 'login' ? (
          <LoginForm
            onSubmit={handleLogin}
            isLoading={isSubmitting}
            error={formError}
            onSwitchToRegister={() => switchTab('register')}
          />
        ) : (
          <RegisterForm
            onSubmit={handleRegister}
            isLoading={isSubmitting}
            error={formError}
            onSwitchToLogin={() => switchTab('login')}
          />
        )}
      </div>
    </Modal>
  );
};

CloudAuthModal.displayName = 'CloudAuthModal';
