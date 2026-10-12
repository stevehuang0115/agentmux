/**
 * Badge Component
 *
 * Compact label for status, categories, or tags.
 * Supports multiple color variants for different contexts.
 *
 * @module components/UI/Badge
 */

import React from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Color variant of the badge */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Badge content */
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 border border-border-soft text-text-2',
  primary: 'bg-primary-soft text-primary-text border border-primary/25',
  success: 'bg-success-soft text-success border border-success/25',
  warning: 'bg-attention-soft text-attention border border-attention/25',
  error: 'bg-danger-soft text-danger border border-danger/25',
  info: 'bg-primary-soft text-primary-text border border-primary/25',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

/**
 * Badge component for displaying labels, status, or tags
 *
 * @param variant - Color variant: 'default', 'primary', 'success', 'warning', 'error', or 'info'
 * @param size - Size: 'sm' or 'md'
 * @param children - Badge content
 * @param className - Additional CSS classes
 * @returns Badge component
 *
 * @example
 * ```tsx
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning" size="md">Pending</Badge>
 * ```
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
  ...rest
}) => {
  const combinedClassName = [
    'inline-flex items-center',
    'rounded-full font-medium',
    variantClasses[variant],
    sizeClasses[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={combinedClassName} {...rest}>{children}</span>;
};

Badge.displayName = 'Badge';
