
import React from 'react';
// FIX: Corrected import path for Icon to resolve casing conflicts.
import { Icon } from '../UI/Icon';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost';
type ButtonSize = 'default' | 'sm' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: React.ReactNode;
  icon?: string;
  iconClassName?: string;
}

const baseClasses = "font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary: "bg-surface-dark border border-border-dark hover:bg-border-dark",
  danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
  ghost: "text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark",
  'danger-ghost': "text-text-secondary-dark hover:text-red-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 rounded-lg text-sm",
  sm: "h-9 px-3 rounded-lg text-sm",
  icon: "h-10 w-10 rounded-lg",
};


export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', icon, iconClassName, children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {icon && <Icon name={icon} className={`text-base ${iconClassName}`} />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';