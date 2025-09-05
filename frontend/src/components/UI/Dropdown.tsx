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
    <div className={`dropdown-wrapper ${className}`}>
      <div className={`dropdown-container ${error ? 'dropdown-container--error' : ''} ${loading ? 'dropdown-container--loading' : ''}`}>
        <select
          className={`dropdown-select ${error ? 'dropdown-select--error' : ''}`}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled || loading}
          {...props}
        >
          <option value="" disabled>
            {loading ? 'Loading...' : placeholder}
          </option>
          {options.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="dropdown-icon">
          <ChevronDown size={16} />
        </div>
      </div>
      {loading && (
        <div className="dropdown-loading-indicator" />
      )}
    </div>
  );
};