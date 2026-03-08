/**
 * Tests for AuthStatusIndicator
 *
 * @module components/Auth/AuthStatusIndicator.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AuthStatusIndicator } from './AuthStatusIndicator';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogout = vi.fn();
const mockAuthState = {
  isAuthenticated: false,
  user: null as { id: string; email: string; displayName: string; plan: 'free' | 'pro'; createdAt: string } | null,
  license: null as { plan: string; features: string[]; active: boolean } | null,
  isLoading: false,
  error: null as string | null,
  login: vi.fn(),
  register: vi.fn(),
  logout: mockLogout,
  getAccessToken: vi.fn(),
  hasFeature: vi.fn(),
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock CloudAuthModal to avoid testing modal internals here
vi.mock('./CloudAuthModal', () => ({
  CloudAuthModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="auth-modal">Auth Modal</div> : null,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
    mockAuthState.license = null;
    mockAuthState.isLoading = false;
    mockAuthState.error = null;
  });

  it('should show loading state', () => {
    mockAuthState.isLoading = true;

    render(<AuthStatusIndicator />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show connect button when not authenticated', () => {
    render(<AuthStatusIndicator />);

    expect(screen.getByText('Connect to Cloud')).toBeInTheDocument();
  });

  it('should open auth modal when connect button clicked', () => {
    render(<AuthStatusIndicator />);

    fireEvent.click(screen.getByText('Connect to Cloud'));

    expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
  });

  it('should show user info when authenticated', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      id: 'u1',
      email: 'test@example.com',
      displayName: 'Test User',
      plan: 'free',
      createdAt: '2026-01-01',
    };

    render(<AuthStatusIndicator />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('should show pro badge for pro users', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      id: 'u1',
      email: 'pro@example.com',
      displayName: 'Pro User',
      plan: 'pro',
      createdAt: '2026-01-01',
    };

    render(<AuthStatusIndicator />);

    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('should call logout when sign out clicked', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = {
      id: 'u1',
      email: 'test@example.com',
      displayName: 'Test User',
      plan: 'free',
      createdAt: '2026-01-01',
    };

    render(<AuthStatusIndicator />);

    fireEvent.click(screen.getByLabelText('Sign out of CrewlyAI Cloud'));

    expect(mockLogout).toHaveBeenCalled();
  });

  it('should hide labels when collapsed', () => {
    render(<AuthStatusIndicator isCollapsed />);

    expect(screen.queryByText('Connect to Cloud')).not.toBeInTheDocument();
  });
});
