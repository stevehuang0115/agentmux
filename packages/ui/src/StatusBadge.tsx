import React from 'react';

export type StatusType = 'active' | 'inactive' | 'stopped' | 'running' | 'paused' | 'completed' | 'blocked' | 'pending' | 'error' | 'suspended';

interface StatusBadgeProps {
  status: StatusType;
  children?: React.ReactNode;
  className?: string;
}

const GOOD = 'bg-success-soft text-success border-success/25';
const BAD = 'bg-danger-soft text-danger border-danger/25';
const WARN = 'bg-attention-soft text-attention border-attention/25';
const INFO = 'bg-primary-soft text-primary-text border-primary/25';
const QUIET = 'bg-surface-2 text-text-2 border-border-soft';

const statusStyles: Record<StatusType, string> = {
  active: GOOD,
  running: GOOD,
  stopped: BAD,
  inactive: QUIET,
  paused: WARN,
  completed: INFO,
  blocked: BAD,
  pending: QUIET,
  error: BAD,
  suspended: WARN,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  className = '',
  ...rest
}) => {
  const displayText = children || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      {...rest}
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${statusStyles[status]} ${className}`}
    >
      {displayText}
    </span>
  );
};