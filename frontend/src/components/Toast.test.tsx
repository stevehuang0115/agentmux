/**
 * Toast Component Tests
 *
 * Tests for the ToastContainer component including rendering,
 * dismiss interaction, and accessibility.
 *
 * @module components/Toast.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import ToastContainer from './Toast';
import type { Toast } from '../hooks/useToast';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="x-icon" />,
}));

describe('ToastContainer', () => {
  const mockDismiss = vi.fn();

  it('should return null when there are no toasts', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onDismiss={mockDismiss} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render a success toast', () => {
    const toasts: Toast[] = [{ id: '1', message: 'Installed!', type: 'success' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByText('Installed!')).toBeInTheDocument();
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
  });

  it('should render an error toast', () => {
    const toasts: Toast[] = [{ id: '1', message: 'Failed!', type: 'error' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByText('Failed!')).toBeInTheDocument();
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
  });

  it('should render an info toast', () => {
    const toasts: Toast[] = [{ id: '1', message: 'Note', type: 'info' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    const toasts: Toast[] = [
      { id: '1', message: 'First', type: 'success' },
      { id: '2', message: 'Second', type: 'error' },
    ];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const toasts: Toast[] = [{ id: 'toast-42', message: 'Dismiss me', type: 'info' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    fireEvent.click(screen.getByLabelText('Dismiss notification'));

    expect(mockDismiss).toHaveBeenCalledWith('toast-42');
  });

  it('should have accessible log role', () => {
    const toasts: Toast[] = [{ id: '1', message: 'Accessible', type: 'info' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('should have aria-live polite for screen readers', () => {
    const toasts: Toast[] = [{ id: '1', message: 'Live', type: 'success' }];

    render(<ToastContainer toasts={toasts} onDismiss={mockDismiss} />);

    expect(screen.getByRole('log')).toHaveAttribute('aria-live', 'polite');
  });
});
