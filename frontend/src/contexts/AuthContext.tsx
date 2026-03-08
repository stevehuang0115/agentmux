/**
 * Auth Context
 *
 * React context that manages CrewlyAI Cloud authentication state
 * using the Supabase JS client. Session persistence, token refresh,
 * and auth-state changes are handled by the Supabase SDK.
 *
 * License / feature checks still go through the backend API
 * (which validates the Supabase JWT).
 *
 * @module contexts/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { apiService } from '../services/api.service';
import type { UserProfile, LicenseStatus, AuthState } from '../types/auth.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Supabase User to our UserProfile shape.
 *
 * @param user - Supabase user object
 * @returns Mapped UserProfile
 */
function mapUser(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email ?? '',
    displayName:
      (user.user_metadata?.['display_name'] as string) ??
      (user.user_metadata?.['displayName'] as string) ??
      user.email ??
      '',
    plan: (user.user_metadata?.['plan'] as 'free' | 'pro') ?? 'free',
    createdAt: user.created_at,
  };
}

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

/** Actions and state exposed by the Auth context. */
export interface AuthContextType extends AuthState {
  /** Register a new account */
  register: (email: string, password: string, displayName: string) => Promise<void>;
  /** Log in with email and password */
  login: (email: string, password: string) => Promise<void>;
  /** Log out and clear stored tokens */
  logout: () => void;
  /** Get the current access token (for manual API calls) */
  getAccessToken: () => string | null;
  /** Check whether user has a specific pro feature */
  hasFeature: (feature: string) => boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Props for AuthProvider. */
export interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Provides auth state and actions to the component tree.
 *
 * Subscribes to Supabase's onAuthStateChange for reactive session
 * management. Token refresh is handled automatically by the SDK.
 *
 * @param props - Provider props
 * @returns AuthProvider component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  /** Fetch license status from the backend using the Supabase access token. */
  const fetchLicense = useCallback(async (accessToken: string) => {
    try {
      const status = await apiService.authGetLicense(accessToken);
      setLicense(status);
    } catch {
      // Non-critical — license check failure is OK
    }
  }, []);

  /**
   * Handle a session change (sign-in, sign-out, token refresh).
   * Updates local state and fetches license when signed in.
   */
  const handleSession = useCallback(
    async (session: Session | null) => {
      sessionRef.current = session;

      if (session?.user) {
        setUser(mapUser(session.user));
        await fetchLicense(session.access_token);
      } else {
        setUser(null);
        setLicense(null);
      }
    },
    [fetchLicense],
  );

  // -----------------------------------------------------------------------
  // Subscribe to auth state changes
  // -----------------------------------------------------------------------

  useEffect(() => {
    // 1. Get the current session on mount
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        handleSession(session).finally(() => setIsLoading(false));
      }
    });

    // 2. Listen for future changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!cancelled) {
          handleSession(session);
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (signUpError) {
      setError(signUpError.message);
      throw signUpError;
    }
    // onAuthStateChange will fire and update state
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
    // onAuthStateChange will fire and update state
  }, []);

  const logout = useCallback(() => {
    setError(null);
    supabase.auth.signOut();
    // onAuthStateChange will fire and clear state
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return sessionRef.current?.access_token ?? null;
  }, []);

  const hasFeature = useCallback((feature: string): boolean => {
    if (!license) return false;
    return license.features.includes(feature);
  }, [license]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const value: AuthContextType = {
    isAuthenticated: user !== null,
    user,
    license,
    isLoading,
    error,
    register,
    login,
    logout,
    getAccessToken,
    hasFeature,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing auth state and actions.
 *
 * Must be used within an AuthProvider.
 *
 * @returns Auth context value
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```typescript
 * const { isAuthenticated, user, login, logout } = useAuth();
 * ```
 */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
