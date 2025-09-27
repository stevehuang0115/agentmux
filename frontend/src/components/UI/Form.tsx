import React from 'react';

// Form Container
export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export const Form: React.FC<FormProps> = ({ children, className = '', ...props }) => (
  <form className={`form ${className}`} {...props}>
    {children}
  </form>
);

// Form Group
export interface FormGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({ children, className = '' }) => (
  <div className={`form-group ${className}`}>
    {children}
  </div>
);

// Form Row (for horizontal layouts)
export interface FormRowProps {
  children: React.ReactNode;
  className?: string;
}

export const FormRow: React.FC<FormRowProps> = ({ children, className = '' }) => (
  <div className={`form-row ${className}`}>
    {children}
  </div>
);

// Form Label
export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export const FormLabel: React.FC<FormLabelProps> = ({ 
  children, 
  required = false, 
  className = '', 
  ...props 
}) => (
  <label className={`form-label ${className}`} {...props}>
    {children}
    {required && <span className="form-required">*</span>}
  </label>
);

// Form Help Text
export interface FormHelpProps {
  children: React.ReactNode;
  className?: string;
}

export const FormHelp: React.FC<FormHelpProps> = ({ children, className = '' }) => (
  <small className={`form-help ${className}`}>
    {children}
  </small>
);

// Form Error Message
export interface FormErrorProps {
  children: React.ReactNode;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ children, className = '' }) => (
  <div className={`form-error ${className}`}>
    {children}
  </div>
);

// Form Input
export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  error = false,
  className = '',
  ...props
}) => (
  <input
    className={`w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-text-primary-dark placeholder:text-text-secondary-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
    {...props}
  />
);

// Form Textarea
export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  error = false,
  className = '',
  ...props
}) => (
  <textarea
    className={`w-full bg-surface-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-text-primary-dark placeholder:text-text-secondary-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-vertical ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
    {...props}
  />
);

// Form Section (for grouping related form elements)
export interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormSection: React.FC<FormSectionProps> = ({ 
  title, 
  description, 
  children, 
  className = '' 
}) => (
  <div className={`form-section ${className}`}>
    {(title || description) && (
      <div className="form-section-header">
        {title && <h3 className="form-section-title">{title}</h3>}
        {description && <p className="form-section-description">{description}</p>}
      </div>
    )}
    <div className="form-section-content">
      {children}
    </div>
  </div>
);