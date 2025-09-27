import React from 'react';
import { Button } from './UI';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium',
  color = '#3b82f6' 
}) => {
  const sizeClass = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8', 
    large: 'w-12 h-12'
  }[size];

  return (
    <div className={`loading-spinner ${sizeClass}`} style={{ borderColor: `${color}20 ${color}20 ${color} ${color}20` }}>
      <div className="sr-only">Loading...</div>
    </div>
  );
};

interface LoadingOverlayProps {
  message?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  message = 'Loading...',
  children 
}) => {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <LoadingSpinner size="large" />
        <p className="loading-message">{message}</p>
        {children}
      </div>
    </div>
  );
};

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '1rem',
  className = ''
}) => {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ width, height }}
    >
      <div className="skeleton-shimmer"></div>
    </div>
  );
};

interface CardSkeletonProps {
  showImage?: boolean;
  lines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ 
  showImage = false, 
  lines = 3 
}) => {
  return (
    <div className="card-skeleton">
      {showImage && <Skeleton height="200px" className="skeleton-image" />}
      <div className="skeleton-content">
        <Skeleton width="70%" height="1.5rem" className="skeleton-title" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i}
            width={i === lines - 1 ? '50%' : '100%'} 
            height="1rem" 
            className="skeleton-line"
          />
        ))}
      </div>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <div className="table-skeleton">
      {/* Header */}
      <div className="skeleton-row skeleton-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="80%" height="1.25rem" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              width={colIndex === 0 ? '90%' : '70%'} 
              height="1rem" 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface LoadingStateProps {
  loading: boolean;
  error?: string;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  emptyState?: React.ReactNode;
  isEmpty?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  error,
  children,
  loadingComponent,
  errorComponent,
  emptyState,
  isEmpty = false
}) => {
  if (loading) {
    return <>{loadingComponent || <LoadingOverlay />}</>;
  }

  if (error) {
    return (
      <>
        {errorComponent || (
          <div className="error-state">
            <div className="error-icon">❌</div>
            <h3>Error Loading Data</h3>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Retry
            </Button>
          </div>
        )}
      </>
    );
  }

  if (isEmpty && emptyState) {
    return <>{emptyState}</>;
  }

  return <>{children}</>;
};

// Hook for managing loading states
export const useLoadingState = (initialLoading = false) => {
  const [loading, setLoading] = React.useState(initialLoading);
  const [error, setError] = React.useState<string | null>(null);

  const startLoading = () => {
    setLoading(true);
    setError(null);
  };

  const stopLoading = () => {
    setLoading(false);
  };

  const setErrorState = (errorMessage: string) => {
    setLoading(false);
    setError(errorMessage);
  };

  const reset = () => {
    setLoading(false);
    setError(null);
  };

  return {
    loading,
    error,
    startLoading,
    stopLoading,
    setErrorState,
    reset
  };
};

// Higher-order component for adding loading states
export const withLoadingState = <P extends object>(
  Component: React.ComponentType<P>,
  loadingComponent?: React.ReactNode
) => {
  return React.forwardRef<any, P & { loading?: boolean; error?: string }>((props, ref) => {
    const { loading, error, ...componentProps } = props;

    return (
      <LoadingState
        loading={loading || false}
        error={error}
        loadingComponent={loadingComponent}
      >
        <Component {...(componentProps as P)} ref={ref} />
      </LoadingState>
    );
  });
};
