import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../../frontend/src/components/ErrorBoundary';
import { 
  LoadingSpinner, 
  LoadingOverlay, 
  Skeleton, 
  CardSkeleton, 
  LoadingState,
  useLoadingState 
} from '../../frontend/src/components/LoadingStates';

// Mock component that throws error
const ErrorComponent = () => {
  throw new Error('Test error');
};

// Component for testing useLoadingState hook
const TestLoadingStateComponent = () => {
  const { loading, error, startLoading, stopLoading, setErrorState, reset } = useLoadingState();
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="error">{error || 'null'}</div>
      <button onClick={startLoading}>Start Loading</button>
      <button onClick={stopLoading}>Stop Loading</button>
      <button onClick={() => setErrorState('Test error')}>Set Error</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
};

describe('Phase 6 UI Components', () => {
  describe('ErrorBoundary', () => {
    // Suppress console.error during tests
    const originalError = console.error;
    beforeAll(() => {
      console.error = jest.fn();
    });

    afterAll(() => {
      console.error = originalError;
    });

    test('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    test('should render default error fallback when error occurs', () => {
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

    test('should render custom fallback when provided', () => {
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

    test('should reset error when reset button is clicked', () => {
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
  });

  describe('LoadingSpinner', () => {
    test('should render with default props', () => {
      render(<LoadingSpinner />);
      
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('w-8', 'h-8');
    });

    test('should render with different sizes', () => {
      const { rerender } = render(<LoadingSpinner size="small" />);
      expect(document.querySelector('.loading-spinner')).toHaveClass('w-4', 'h-4');

      rerender(<LoadingSpinner size="large" />);
      expect(document.querySelector('.loading-spinner')).toHaveClass('w-12', 'h-12');
    });

    test('should apply custom color', () => {
      render(<LoadingSpinner color="#ff0000" />);
      
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).toHaveStyle({ borderColor: '#ff000020 #ff000020 #ff0000 #ff000020' });
    });
  });

  describe('LoadingOverlay', () => {
    test('should render with default message', () => {
      render(<LoadingOverlay />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(document.querySelector('.loading-overlay')).toBeInTheDocument();
    });

    test('should render with custom message', () => {
      render(<LoadingOverlay message="Custom loading message" />);
      
      expect(screen.getByText('Custom loading message')).toBeInTheDocument();
    });

    test('should render children', () => {
      render(
        <LoadingOverlay message="Loading...">
          <div>Additional content</div>
        </LoadingOverlay>
      );
      
      expect(screen.getByText('Additional content')).toBeInTheDocument();
    });
  });

  describe('Skeleton', () => {
    test('should render with default dimensions', () => {
      render(<Skeleton />);
      
      const skeleton = document.querySelector('.skeleton');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveStyle({ width: '100%', height: '1rem' });
    });

    test('should render with custom dimensions', () => {
      render(<Skeleton width="200px" height="50px" />);
      
      const skeleton = document.querySelector('.skeleton');
      expect(skeleton).toHaveStyle({ width: '200px', height: '50px' });
    });

    test('should apply custom className', () => {
      render(<Skeleton className="custom-skeleton" />);
      
      expect(document.querySelector('.skeleton')).toHaveClass('custom-skeleton');
    });
  });

  describe('CardSkeleton', () => {
    test('should render without image by default', () => {
      render(<CardSkeleton />);
      
      expect(document.querySelector('.skeleton-image')).not.toBeInTheDocument();
      expect(document.querySelector('.skeleton-title')).toBeInTheDocument();
      expect(document.querySelectorAll('.skeleton-line')).toHaveLength(3);
    });

    test('should render with image when showImage is true', () => {
      render(<CardSkeleton showImage />);
      
      expect(document.querySelector('.skeleton-image')).toBeInTheDocument();
    });

    test('should render custom number of lines', () => {
      render(<CardSkeleton lines={5} />);
      
      expect(document.querySelectorAll('.skeleton-line')).toHaveLength(5);
    });
  });

  describe('LoadingState', () => {
    test('should render children when not loading and no error', () => {
      render(
        <LoadingState loading={false} error={undefined}>
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('should render loading component when loading', () => {
      render(
        <LoadingState loading={true}>
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    test('should render custom loading component', () => {
      render(
        <LoadingState loading={true} loadingComponent={<div>Custom Loading</div>}>
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('Custom Loading')).toBeInTheDocument();
    });

    test('should render error state when error exists', () => {
      render(
        <LoadingState loading={false} error="Something went wrong">
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    test('should render custom error component', () => {
      render(
        <LoadingState 
          loading={false} 
          error="Error message"
          errorComponent={<div>Custom Error</div>}
        >
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('Custom Error')).toBeInTheDocument();
    });

    test('should render empty state when isEmpty is true', () => {
      render(
        <LoadingState 
          loading={false}
          isEmpty={true}
          emptyState={<div>No data available</div>}
        >
          <div>Content</div>
        </LoadingState>
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });
  });

  describe('useLoadingState hook', () => {
    test('should have correct initial state', () => {
      render(<TestLoadingStateComponent />);

      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });

    test('should start and stop loading', () => {
      render(<TestLoadingStateComponent />);

      fireEvent.click(screen.getByText('Start Loading'));
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('null');

      fireEvent.click(screen.getByText('Stop Loading'));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    test('should set error state', () => {
      render(<TestLoadingStateComponent />);

      fireEvent.click(screen.getByText('Set Error'));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    });

    test('should reset state', () => {
      render(<TestLoadingStateComponent />);

      fireEvent.click(screen.getByText('Start Loading'));
      fireEvent.click(screen.getByText('Set Error'));
      
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');

      fireEvent.click(screen.getByText('Reset'));
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });

    test('should clear error when starting loading', () => {
      render(<TestLoadingStateComponent />);

      fireEvent.click(screen.getByText('Set Error'));
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');

      fireEvent.click(screen.getByText('Start Loading'));
      expect(screen.getByTestId('loading')).toHaveTextContent('true');
      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  describe('Accessibility', () => {
    test('LoadingSpinner should have screen reader text', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByText('Loading...')).toHaveClass('sr-only');
    });

    test('Error state should be accessible', () => {
      render(
        <LoadingState loading={false} error="Network error">
          <div>Content</div>
        </LoadingState>
      );

      const errorHeading = screen.getByRole('heading', { level: 3 });
      expect(errorHeading).toHaveTextContent('Error Loading Data');

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      expect(retryButton).toBeInTheDocument();
    });

    test('ErrorBoundary should handle keyboard navigation', () => {
      render(
        <ErrorBoundary>
          <ErrorComponent />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByText('Try Again');
      const refreshButton = screen.getByText('Refresh Page');

      expect(tryAgainButton).toBeInTheDocument();
      expect(refreshButton).toBeInTheDocument();

      // Buttons should be focusable
      tryAgainButton.focus();
      expect(document.activeElement).toBe(tryAgainButton);
    });
  });
});