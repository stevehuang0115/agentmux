/**
 * Login Form
 *
 * Email/password login form for CrewlyAI Cloud authentication.
 * Handles form validation and submits to the auth context.
 *
 * @module components/Auth/LoginForm
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '../UI';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for LoginForm. */
export interface LoginFormProps {
  /** Called when login is submitted */
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Whether a login request is in flight */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Called when user wants to switch to register */
  onSwitchToRegister?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Login form with email and password fields.
 *
 * @param props - LoginForm props
 * @returns LoginForm component
 */
export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  isLoading = false,
  error = null,
  onSwitchToRegister,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    await onSubmit(email.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        autoFocus
        disabled={isLoading}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        disabled={isLoading}
      />

      {error && (
        <p className="text-sm text-red-400" role="alert">{error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading || !email.trim() || !password.trim()}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="animate-spin mr-1.5" size={14} />
            Signing in...
          </>
        ) : (
          'Sign In'
        )}
      </Button>

      {onSwitchToRegister && (
        <p className="text-center text-sm text-text-secondary-dark">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="text-primary hover:underline font-medium"
          >
            Create one
          </button>
        </p>
      )}
    </form>
  );
};

LoginForm.displayName = 'LoginForm';
