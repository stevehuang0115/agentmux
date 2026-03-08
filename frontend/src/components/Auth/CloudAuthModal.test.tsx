/**
 * Tests for CloudAuthModal
 *
 * @module components/Auth/CloudAuthModal.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CloudAuthModal } from './CloudAuthModal';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogin = vi.fn();
const mockRegister = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    isAuthenticated: false,
    user: null,
    license: null,
    isLoading: false,
    error: null,
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    hasFeature: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CloudAuthModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
    mockRegister.mockResolvedValue(undefined);
  });

  it('should not render when closed', () => {
    render(<CloudAuthModal isOpen={false} onClose={onClose} />);

    expect(screen.queryByText('Sign in to CrewlyAI Cloud')).not.toBeInTheDocument();
  });

  it('should render login form by default', () => {
    render(<CloudAuthModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('Sign in to CrewlyAI Cloud')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should render register form when initialTab is register', () => {
    render(<CloudAuthModal isOpen={true} onClose={onClose} initialTab="register" />);

    expect(screen.getByText('Create CrewlyAI Cloud Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('should switch from login to register', () => {
    render(<CloudAuthModal isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByText('Create one'));

    expect(screen.getByText('Create CrewlyAI Cloud Account')).toBeInTheDocument();
  });

  it('should call login and close on success', async () => {
    render(<CloudAuthModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should show error when login fails', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));

    render(<CloudAuthModal isOpen={true} onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'wrong' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
