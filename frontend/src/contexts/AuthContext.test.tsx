/**
 * Tests for AuthContext (HTTP-based Cloud API)
 *
 * @module contexts/AuthContext.test
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { UserProfile, AuthTokenResponse, LicenseStatus } from '../types/auth.types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthLogin = vi.fn();
const mockAuthRegister = vi.fn();
const mockAuthRefresh = vi.fn();
const mockAuthGetProfile = vi.fn();
const mockAuthGetLicense = vi.fn();

vi.mock('../services/api.service', () => ({
  apiService: {
    authLogin: (...args: unknown[]) => mockAuthLogin(...args),
    authRegister: (...args: unknown[]) => mockAuthRegister(...args),
    authRefresh: (...args: unknown[]) => mockAuthRefresh(...args),
    authGetProfile: (...args: unknown[]) => mockAuthGetProfile(...args),
    authGetLicense: (...args: unknown[]) => mockAuthGetLicense(...args),
  },
}));

vi.mock('../services/supabase', () => {
  const store: Record<string, string> = {};
  return {
    getAccessToken: () => store['access'] ?? null,
    getRefreshToken: () => store['refresh'] ?? null,
    storeTokens: (access: string, refresh: string) => {
      store['access'] = access;
      store['refresh'] = refresh;
    },
    clearTokens: () => {
      delete store['access'];
      delete store['refresh'];
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake UserProfile. */
function fakeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    plan: 'free',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Create a fake AuthTokenResponse. */
function fakeAuthResponse(overrides: Partial<AuthTokenResponse> = {}): AuthTokenResponse {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresIn: 3600,
    user: fakeUser(),
    ...overrides,
  };
}

/** Create a fake LicenseStatus. */
function fakeLicense(overrides: Partial<LicenseStatus> = {}): LicenseStatus {
  return {
    plan: 'pro',
    features: ['cloud-relay'],
    active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { AuthProvider, useAuth } from './AuthContext';
import { storeTokens, clearTokens } from '../services/supabase';

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

describe('AuthContext (HTTP Cloud API)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokens();
  });

  it('should resolve to unauthenticated when no stored token exists', async () => {
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

  it('should restore session from stored token on mount', async () => {
    storeTokens('stored-access', 'stored-refresh');
    mockAuthGetProfile.mockResolvedValue(fakeUser());
    mockAuthGetLicense.mockResolvedValue(fakeLicense());

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
    expect(mockAuthGetProfile).toHaveBeenCalledWith('stored-access');
    expect(mockAuthGetLicense).toHaveBeenCalledWith('stored-access');
  });

  it('should try refresh when stored access token is invalid', async () => {
    storeTokens('expired-access', 'valid-refresh');
    mockAuthGetProfile.mockRejectedValue(new Error('Token expired'));
    mockAuthRefresh.mockResolvedValue(fakeAuthResponse());
    mockAuthGetLicense.mockResolvedValue(fakeLicense({ plan: 'free', features: [] }));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
    });

    expect(mockAuthRefresh).toHaveBeenCalledWith('valid-refresh');
  });

  it('should clear tokens when both access and refresh fail', async () => {
    storeTokens('bad-access', 'bad-refresh');
    mockAuthGetProfile.mockRejectedValue(new Error('Token expired'));
    mockAuthRefresh.mockRejectedValue(new Error('Refresh failed'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('should call apiService.authLogin on login', async () => {
    mockAuthLogin.mockResolvedValue(fakeAuthResponse());
    mockAuthGetLicense.mockResolvedValue(fakeLicense({ plan: 'free', features: [] }));

    const LoginTester: React.FC = () => {
      const { login } = useAuth();
      return <button onClick={() => login('a@b.com', 'pass1234')}>login</button>;
    };

    render(
      <AuthProvider>
        <LoginTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.queryByText('login')).toBeTruthy());

    await act(async () => {
      screen.getByText('login').click();
    });

    expect(mockAuthLogin).toHaveBeenCalledWith('a@b.com', 'pass1234');
  });

  it('should set error when login fails', async () => {
    mockAuthLogin.mockRejectedValue(new Error('Invalid credentials'));

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

    await waitFor(() => expect(screen.queryByText('login')).toBeTruthy());

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('err').textContent).toBe('Invalid credentials');
    });
  });

  it('should call apiService.authRegister on register', async () => {
    mockAuthRegister.mockResolvedValue(fakeAuthResponse());
    mockAuthGetLicense.mockResolvedValue(fakeLicense({ plan: 'free', features: [] }));

    const RegisterTester: React.FC = () => {
      const { register } = useAuth();
      return <button onClick={() => register('a@b.com', 'pass1234', 'New User')}>register</button>;
    };

    render(
      <AuthProvider>
        <RegisterTester />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.queryByText('register')).toBeTruthy());

    await act(async () => {
      screen.getByText('register').click();
    });

    expect(mockAuthRegister).toHaveBeenCalledWith('a@b.com', 'pass1234', 'New User');
  });

  it('should clear state and tokens on logout', async () => {
    storeTokens('stored-access', 'stored-refresh');
    mockAuthGetProfile.mockResolvedValue(fakeUser());
    mockAuthGetLicense.mockResolvedValue(fakeLicense());

    const LogoutTester: React.FC = () => {
      const { logout, isAuthenticated } = useAuth();
      return (
        <>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <button onClick={logout}>logout</button>
        </>
      );
    };

    render(
      <AuthProvider>
        <LogoutTester />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth').textContent).toBe('true');
    });

    await act(async () => {
      screen.getByText('logout').click();
    });

    expect(screen.getByTestId('auth').textContent).toBe('false');
  });

  it('should throw if useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });

  it('should handle license fetch failure gracefully', async () => {
    storeTokens('stored-access', 'stored-refresh');
    mockAuthGetProfile.mockResolvedValue(fakeUser());
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
