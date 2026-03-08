/**
 * Tests for RegisterForm
 *
 * @module components/Auth/RegisterForm.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RegisterForm } from './RegisterForm';

describe('RegisterForm', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(undefined);
  });

  it('should render all input fields', () => {
    render(<RegisterForm onSubmit={mockSubmit} />);

    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 8 characters')).toBeInTheDocument();
  });

  it('should render create account button', () => {
    render(<RegisterForm onSubmit={mockSubmit} />);

    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('should disable submit when fields are empty', () => {
    render(<RegisterForm onSubmit={mockSubmit} />);

    expect(screen.getByRole('button', { name: 'Create Account' })).toBeDisabled();
  });

  it('should show error for short password', async () => {
    render(<RegisterForm onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    });

    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with all fields', async () => {
    render(<RegisterForm onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Min. 8 characters'), { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('test@test.com', 'password123', 'Test User');
    });
  });

  it('should display server error', () => {
    render(<RegisterForm onSubmit={mockSubmit} error="Email already registered" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
  });

  it('should show loading state', () => {
    render(<RegisterForm onSubmit={mockSubmit} isLoading />);

    expect(screen.getByText('Creating account...')).toBeInTheDocument();
  });

  it('should show switch to login link', () => {
    const onSwitch = vi.fn();
    render(<RegisterForm onSubmit={mockSubmit} onSwitchToLogin={onSwitch} />);

    fireEvent.click(screen.getByText('Sign in'));
    expect(onSwitch).toHaveBeenCalled();
  });
});
