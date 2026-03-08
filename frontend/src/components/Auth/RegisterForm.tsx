/**
 * Register Form
 *
 * User registration form for CrewlyAI Cloud accounts.
 * Validates email, password length, and display name before submission.
 *
 * @module components/Auth/RegisterForm
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '../UI';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum password length matching backend validation. */
const MIN_PASSWORD_LENGTH = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for RegisterForm. */
export interface RegisterFormProps {
  /** Called when registration is submitted */
  onSubmit: (email: string, password: string, displayName: string) => Promise<void>;
  /** Whether a registration request is in flight */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Called when user wants to switch to login */
  onSwitchToLogin?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Registration form with email, password, and display name fields.
 *
 * @param props - RegisterForm props
 * @returns RegisterForm component
 */
export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  isLoading = false,
  error = null,
  onSwitchToLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim() || !displayName.trim()) {
      setLocalError('All fields are required');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    await onSubmit(email.trim(), password, displayName.trim());
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Display Name"
        type="text"
        placeholder="Your name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        fullWidth
        autoFocus
        disabled={isLoading}
      />
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        disabled={isLoading}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        disabled={isLoading}
      />

      {displayError && (
        <p className="text-sm text-red-400" role="alert">{displayError}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading || !email.trim() || !password.trim() || !displayName.trim()}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin mr-1.5" size={14} />
            Creating account...
          </>
        ) : (
          'Create Account'
        )}
      </Button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-text-secondary-dark">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  );
};

RegisterForm.displayName = 'RegisterForm';
