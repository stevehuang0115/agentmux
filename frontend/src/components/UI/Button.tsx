import React from 'react';
import { LucideIcon } from 'lucide-react';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'ghost' 
  | 'outline';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full-width',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || loading;

  return (
    <button
      className={baseClasses}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <span className="btn-spinner" />
      )}
      
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="btn-icon btn-icon-left" />
      )}
      
      <span className={loading ? 'btn-text-loading' : 'btn-text'}>
        {children}
      </span>
      
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="btn-icon btn-icon-right" />
      )}
    </button>
  );
};

// Icon-only button variant
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconPosition'> {
  icon: LucideIcon;
  'aria-label': string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      icon={Icon}
      className={`btn-icon-only ${className}`}
      {...props}
    >
      {/* Empty children for icon-only button */}
      {''}
    </Button>
  );
};