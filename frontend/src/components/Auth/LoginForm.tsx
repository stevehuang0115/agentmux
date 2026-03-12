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

      {/* Google OAuth divider + button */}
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-dark" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface-dark px-2 text-text-secondary-dark">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { window.location.href = '/api/auth/google'; }}
        disabled={isLoading}
        className="w-full py-2 px-4 border border-border-dark rounded-lg text-sm font-medium text-text-primary-dark hover:bg-surface-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        data-testid="google-login-btn"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>

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
