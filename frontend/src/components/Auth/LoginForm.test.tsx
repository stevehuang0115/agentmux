/**
 * Tests for LoginForm
 *
 * @module components/Auth/LoginForm.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  const mockSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue(undefined);
  });

  it('should render email and password inputs', () => {
    render(<LoginForm onSubmit={mockSubmit} />);

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('should render sign in button', () => {
    render(<LoginForm onSubmit={mockSubmit} />);

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should disable submit button when fields are empty', () => {
    render(<LoginForm onSubmit={mockSubmit} />);

    const button = screen.getByRole('button', { name: 'Sign In' });
    expect(button).toBeDisabled();
  });

  it('should call onSubmit with email and password', async () => {
    render(<LoginForm onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith('test@test.com', 'password123');
    });
  });

  it('should display error message', () => {
    render(<LoginForm onSubmit={mockSubmit} error="Invalid credentials" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
  });

  it('should show loading state', () => {
    render(<LoginForm onSubmit={mockSubmit} isLoading />);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });

  it('should show switch to register link', () => {
    const onSwitch = vi.fn();
    render(<LoginForm onSubmit={mockSubmit} onSwitchToRegister={onSwitch} />);

    fireEvent.click(screen.getByText('Create one'));
    expect(onSwitch).toHaveBeenCalled();
  });
});
