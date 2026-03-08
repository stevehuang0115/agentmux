/**
 * Tests for AuthContext (Supabase)
 *
 * @module contexts/AuthContext.test
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Captured onAuthStateChange callback so tests can trigger it. */
let authChangeCallback: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;

const mockGetSession = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockUnsubscribe = vi.fn();
const mockAuthGetLicense = vi.fn();

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (cb: (event: AuthChangeEvent, session: Session | null) => void) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

vi.mock('../services/api.service', () => ({
  apiService: {
    authGetLicense: (...args: unknown[]) => mockAuthGetLicense(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake Supabase User. */
function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { display_name: 'Test User' },
    created_at: '2026-01-01T00:00:00Z',
    app_metadata: {},
    aud: 'authenticated',
    ...overrides,
  } as User;
}

/** Create a fake Supabase Session. */
function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'sb-access-token',
    refresh_token: 'sb-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: fakeUser(),
    ...overrides,
  } as Session;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { AuthProvider, useAuth } from './AuthContext';

/** Test consumer component that renders auth state. */
const TestConsumer: React.FC = () => {
  const { isAuthenticated, user, isLoading, error, license } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="displayName">{user ? user.displayName : 'none'}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="plan">{license?.plan || 'none'}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthContext (Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeCallback = null;
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('should resolve to unauthenticated when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('should restore session from Supabase on mount', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue({ data: { session } });
    mockAuthGetLicense.mockResolvedValue({
      plan: 'pro',
      features: ['cloud-relay'],
      active: true,
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
    expect(screen.getByTestId('displayName').textContent).toBe('Test User');
    expect(screen.getByTestId('plan').textContent).toBe('pro');
    expect(mockAuthGetLicense).toHaveBeenCalledWith('sb-access-token');
  });

  it('should update state when onAuthStateChange fires SIGNED_IN', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockAuthGetLicense.mockResolvedValue({ plan: 'free', features: [], active: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');

    // Simulate sign-in event
    await act(async () => {
      authChangeCallback?.('SIGNED_IN', fakeSession());
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(screen.getByTestId('user').textContent).toBe('test@example.com');
  });

  it('should clear state when onAuthStateChange fires SIGNED_OUT', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue({ data: { session } });
    mockAuthGetLicense.mockResolvedValue({ plan: 'free', features: [], active: true });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    // Simulate sign-out event
    await act(async () => {
      authChangeCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('plan').textContent).toBe('none');
  });

  it('should call supabase.auth.signInWithPassword on login', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithPassword.mockResolvedValue({ data: { session: fakeSession() }, error: null });

    const LoginTester: React.FC = () => {
      const { login } = useAuth();
      return <button onClick={() => login('a@b.com', 'pass1234')}>login</button>;
    };

    render(
      <AuthProvider>
        <LoginTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass1234',
    });
  });

  it('should set error and throw when login fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid credentials', status: 400 },
    });

    const LoginTester: React.FC = () => {
      const { login, error } = useAuth();
      const handleLogin = async () => {
        try { await login('a@b.com', 'wrong'); } catch { /* expected */ }
      };
      return (
        <>
          <button onClick={handleLogin}>login</button>
          <span data-testid="err">{error || 'none'}</span>
        </>
      );
    };

    render(
      <AuthProvider>
        <LoginTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('err').textContent).toBe('Invalid credentials');
    });
  });

  it('should call supabase.auth.signUp on register', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignUp.mockResolvedValue({ data: { session: fakeSession() }, error: null });

    const RegisterTester: React.FC = () => {
      const { register } = useAuth();
      return <button onClick={() => register('a@b.com', 'pass1234', 'New User')}>register</button>;
    };

    render(
      <AuthProvider>
        <RegisterTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

    await act(async () => {
      screen.getByText('register').click();
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass1234',
      options: { data: { display_name: 'New User' } },
    });
  });

  it('should call supabase.auth.signOut on logout', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue({ data: { session } });
    mockAuthGetLicense.mockResolvedValue({ plan: 'free', features: [], active: true });

    const LogoutTester: React.FC = () => {
      const { logout } = useAuth();
      return <button onClick={logout}>logout</button>;
    };

    render(
      <AuthProvider>
        <LogoutTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should unsubscribe from auth state changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const { unmount } = render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should throw if useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('should handle license fetch failure gracefully', async () => {
    const session = fakeSession();
    mockGetSession.mockResolvedValue({ data: { session } });
    mockAuthGetLicense.mockRejectedValue(new Error('Network error'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    // User is still authenticated even if license fetch fails
    expect(screen.getByTestId('plan').textContent).toBe('none');
  });
});
