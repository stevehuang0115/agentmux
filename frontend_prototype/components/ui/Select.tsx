
import React from 'react';
// FIX: Corrected import path for Icon to resolve casing conflicts.
import { Icon } from '../UI/Icon';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative w-full">
      <select
        className={`w-full appearance-none bg-background-dark border border-border-dark rounded-lg shadow-sm focus:ring-1 focus:ring-primary focus:border-primary py-2 pl-3 pr-8 text-sm ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-secondary-dark">
        <Icon name="expand_more" className="text-base" />
      </div>
    </div>
  );
});
Select.displayName = 'Select';

export { Select };