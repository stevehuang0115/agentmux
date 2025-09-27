import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: DropdownOption[];
  placeholder?: string;
  error?: boolean;
  loading?: boolean;
  onChange?: (value: string) => void;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  placeholder = 'Select an option...',
  error = false,
  loading = false,
  onChange,
  className = '',
  value,
  disabled,
  ...props
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <select
        className={`w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none cursor-pointer ${
          error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
        } ${loading || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        {...props}
      >
        <option value="" disabled className="text-text-secondary-dark">
          {loading ? 'Loading...' : placeholder}
        </option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="text-text-primary-dark bg-surface-dark"
          >
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <ChevronDown className={`h-4 w-4 ${error ? 'text-red-500' : 'text-text-secondary-dark'}`} />
      </div>
    </div>
  );
};