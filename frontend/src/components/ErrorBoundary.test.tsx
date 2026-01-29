import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeAll, afterAll } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Mock component that throws error
const ErrorComponent = () => {
  throw new Error('Test error');
};

// Component that can conditionally throw
const ConditionalErrorComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Conditional error');
  }
  return <div>Working content</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error during tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render default error fallback when error occurs', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We encountered an unexpected error. Please try refreshing the page.')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Refresh Page')).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const CustomFallback = ({ error, resetError }: { error?: Error; resetError: () => void }) => (
      <div>
        <p>Custom error: {error?.message}</p>
        <button onClick={resetError}>Custom Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error: Test error')).toBeInTheDocument();
    expect(screen.getByText('Custom Reset')).toBeInTheDocument();
  });

  it('should reset error when reset button is clicked', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Try Again'));

    // After reset, should show the error again since ErrorComponent always throws
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have accessible buttons', () => {
    render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
    const refreshButton = screen.getByRole('button', { name: 'Refresh Page' });

    expect(tryAgainButton).toBeInTheDocument();
    expect(refreshButton).toBeInTheDocument();

    // Buttons should be focusable
    tryAgainButton.focus();
    expect(document.activeElement).toBe(tryAgainButton);
  });

  it('should render error boundary container with proper class', () => {
    const { container } = render(
      <ErrorBoundary>
        <ErrorComponent />
      </ErrorBoundary>
    );

    expect(container.querySelector('.error-boundary')).toBeInTheDocument();
  });
});
