/**
 * StatusDot Component
 *
 * A small colored circle indicating entity status.
 * Consolidates the 4 competing status color maps
 * (StatusBadge, SecurityOverview, CloudTab, PtyIsolationMap)
 * into a single shared primitive.
 *
 * @module components/UI/StatusDot
 */

import React from 'react';

// =============================================================================
// Types
// =============================================================================

/** All recognized status values across the codebase */
export type DotStatus =
  | 'active'
  | 'inactive'
  | 'connecting'
  | 'paired'
  | 'waiting'
  | 'disconnected'
  | 'online'
  | 'offline'
  | 'error'
  | 'working'
  | 'warning';

export type DotSize = 'sm' | 'md' | 'lg';

export interface StatusDotProps {
  /** Current status — determines the dot color */
  status: DotStatus;
  /** Dot diameter */
  size?: DotSize;
  /** Whether to animate-pulse (defaults to true for active-like states) */
  pulse?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Overrides the default test id ("status-dot") */
  'data-testid'?: string;
}

// =============================================================================
// Mappings
// =============================================================================

/**
 * Status → Tailwind color class.
 *
 * Groups:
 *  - green  (emerald-400): active, online, paired
 *  - yellow (yellow-400):  waiting, connecting
 *  - muted  (secondary text): inactive, disconnected, offline
 *  - blue   (blue-400):    working
 *  - orange (orange-400):  warning
 *  - red    (rose-400):    error
 */
const STATUS_COLOR_MAP: Record<DotStatus, string> = {
  active: 'bg-success',
  online: 'bg-success',
  paired: 'bg-success',
  waiting: 'bg-attention',
  connecting: 'bg-attention',
  inactive: 'bg-muted-dot',
  disconnected: 'bg-muted-dot',
  offline: 'bg-muted-dot',
  error: 'bg-danger',
  working: 'bg-primary',
  warning: 'bg-attention',
};

/** Size → Tailwind dimension class */
const SIZE_CLASS_MAP: Record<DotSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

/** Statuses that pulse by default when pulse prop is omitted */
const DEFAULT_PULSE_STATUSES: ReadonlySet<DotStatus> = new Set([
  'active',
  'online',
  'connecting',
]);

// =============================================================================
// Component
// =============================================================================

/**
 * Small colored dot representing a status.
 *
 * @param props - {@link StatusDotProps}
 * @returns A `<span>` element styled as a round dot
 *
 * @example
 * ```tsx
 * <StatusDot status="active" />
 * <StatusDot status="error" size="lg" pulse={false} />
 * ```
 */
export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 'md',
  pulse,
  className = '',
  'data-testid': testId = 'status-dot',
}) => {
  const shouldPulse = pulse ?? DEFAULT_PULSE_STATUSES.has(status);
  const color = STATUS_COLOR_MAP[status] ?? 'bg-muted-dot';

  const combinedClassName = [
    'inline-block rounded-full',
    SIZE_CLASS_MAP[size],
    color,
    shouldPulse ? 'animate-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={combinedClassName}
      role="status"
      aria-label={status}
      data-testid={testId}
    />
  );
};

StatusDot.displayName = 'StatusDot';
