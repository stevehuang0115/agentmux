# Task 71: Create Atomic UI Component System

## Priority: High

## Problem

The application has inconsistent UI styling because:
1. **Multiple theming approaches**: Tailwind classes vs CSS variables with different values
2. **Light theme fallbacks**: Chat/Settings components use CSS variables with light theme defaults
3. **No centralized design tokens**: Colors, spacing, typography defined in multiple places
4. **Components not reusable**: Higher-level components build plain HTML instead of composing atomic components

### Current State
- Tailwind config: `background-dark: #111721`, `surface-dark: #1a222c`
- Chat CSS: `--sidebar-bg: #f8f9fa` (light gray fallback)
- Settings CSS: `--bg-primary`, `--text-primary` (undefined or mismatched)

## Solution: Atomic Design System

Build UI from the ground up using atomic, reusable components with consistent theming.

## Implementation

### 1. Design Tokens (CSS Variables)

**New File:** `frontend/src/styles/tokens.css`

```css
:root {
  /* === Color Tokens === */

  /* Primary palette */
  --color-primary: #2a73ea;
  --color-primary-hover: #1e5fc7;
  --color-primary-light: rgba(42, 115, 234, 0.1);

  /* Background colors */
  --color-bg-primary: #111721;
  --color-bg-secondary: #1a222c;
  --color-bg-tertiary: #232d3b;
  --color-bg-hover: rgba(255, 255, 255, 0.05);

  /* Surface colors (cards, panels) */
  --color-surface: #1a222c;
  --color-surface-hover: #232d3b;

  /* Border colors */
  --color-border: #313a48;
  --color-border-light: #3d4654;
  --color-border-focus: #2a73ea;

  /* Text colors */
  --color-text-primary: #f6f7f8;
  --color-text-secondary: #9ab0d9;
  --color-text-muted: #6b7a94;
  --color-text-inverse: #111721;

  /* Status colors */
  --color-success: #22c55e;
  --color-success-light: rgba(34, 197, 94, 0.1);
  --color-warning: #f59e0b;
  --color-warning-light: rgba(245, 158, 11, 0.1);
  --color-error: #ef4444;
  --color-error-light: rgba(239, 68, 68, 0.1);
  --color-info: #3b82f6;
  --color-info-light: rgba(59, 130, 246, 0.1);

  /* === Spacing Tokens === */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --space-3xl: 48px;

  /* === Typography Tokens === */
  --font-family-base: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SFMono-Regular', Menlo, Monaco, Consolas, monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 1.875rem; /* 30px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* === Border Radius === */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* === Shadows === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);

  /* === Transitions === */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;

  /* === Z-Index Scale === */
  --z-dropdown: 100;
  --z-modal: 200;
  --z-tooltip: 300;
  --z-toast: 400;

  /* === Legacy variable mappings (for backward compatibility) === */
  --bg-primary: var(--color-bg-primary);
  --bg-secondary: var(--color-bg-secondary);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --border-primary: var(--color-border);
  --primary: var(--color-primary);
  --bg-hover: var(--color-bg-hover);
  --danger: var(--color-error);

  /* Chat-specific legacy mappings */
  --sidebar-bg: var(--color-bg-secondary);
  --border-color: var(--color-border);
  --hover-bg: var(--color-bg-hover);
  --active-bg: var(--color-primary-light);
  --text-muted: var(--color-text-muted);
  --primary-color: var(--color-primary);
  --primary-hover: var(--color-primary-hover);
  --error-color: var(--color-error);
  --error-bg: var(--color-error-light);
}
```

### 2. Import Tokens in index.css

**Update:** `frontend/src/index.css`

```css
@import './styles/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

/* ... rest of existing styles */
```

### 3. Atomic Components

#### Card Component

**New File:** `frontend/src/components/UI/Card.tsx`

```typescript
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  children: React.ReactNode;
}

const variantClasses = {
  default: 'bg-surface-dark border border-border-dark',
  outlined: 'border border-border-dark bg-transparent',
  elevated: 'bg-surface-dark border border-border-dark shadow-md',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({
    variant = 'default',
    padding = 'md',
    interactive = false,
    className = '',
    children,
    ...props
  }, ref) => {
    const interactiveClass = interactive
      ? 'cursor-pointer hover:border-primary/50 transition-colors'
      : '';

    return (
      <div
        ref={ref}
        className={`
          rounded-lg
          ${variantClasses[variant]}
          ${paddingClasses[padding]}
          ${interactiveClass}
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
```

#### Input Component

**New File:** `frontend/src/components/UI/Input.tsx`

```typescript
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, fullWidth = false, className = '', ...props }, ref) => {
    const inputId = props.id || props.name;

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm text-text-secondary-dark mb-2"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2
            bg-background-dark
            border border-border-dark
            rounded-lg
            text-text-primary-dark text-sm
            placeholder:text-text-secondary-dark/50
            focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
            ${className}
          `.trim()}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-xs text-text-secondary-dark">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

#### Badge Component

**New File:** `frontend/src/components/UI/Badge.tsx`

```typescript
import React from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-background-dark border border-border-dark text-text-secondary-dark',
  primary: 'bg-primary/10 text-primary border border-primary/20',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  error: 'bg-red-500/10 text-red-400 border border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center
        rounded-full font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  );
};
```

#### Tabs Component

**New File:** `frontend/src/components/UI/Tabs.tsx`

```typescript
import React, { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ defaultValue, children, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export const TabList: React.FC<TabListProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`
        flex gap-1 border-b border-border-dark pb-0 mb-6
        ${className}
      `.trim()}
      role="tablist"
    >
      {children}
    </div>
  );
};

export interface TabTriggerProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const TabTrigger: React.FC<TabTriggerProps> = ({ value, children, icon }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabTrigger must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      className={`
        flex items-center gap-2
        px-4 py-3
        text-sm font-medium
        border-b-2 -mb-px
        transition-colors
        ${isActive
          ? 'text-primary border-primary'
          : 'text-text-secondary-dark border-transparent hover:text-text-primary-dark hover:bg-background-dark/50'
        }
      `.trim()}
      onClick={() => setActiveTab(value)}
      role="tab"
      aria-selected={isActive}
    >
      {icon}
      {children}
    </button>
  );
};

export interface TabContentProps {
  value: string;
  children: React.ReactNode;
}

export const TabContent: React.FC<TabContentProps> = ({ value, children }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return <div role="tabpanel">{children}</div>;
};
```

#### Alert Component

**New File:** `frontend/src/components/UI/Alert.tsx`

```typescript
import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

const variantConfig: Record<AlertVariant, {
  classes: string;
  icon: React.FC<{ className?: string }>;
}> = {
  info: {
    classes: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    icon: Info,
  },
  success: {
    classes: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    icon: CheckCircle,
  },
  warning: {
    classes: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    icon: AlertTriangle,
  },
  error: {
    classes: 'bg-red-500/10 border-red-500/20 text-red-400',
    icon: AlertCircle,
  },
};

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}) => {
  const { classes, icon: Icon } = variantConfig[variant];

  return (
    <div
      className={`
        flex items-start gap-3
        p-4 rounded-lg border
        ${classes}
        ${className}
      `.trim()}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div className="text-sm">{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
```

### 4. Update UI Component Index

**Update:** `frontend/src/components/UI/index.ts`

```typescript
export * from './Button';
export * from './Card';
export * from './Input';
export * from './Badge';
export * from './Tabs';
export * from './Alert';
export * from './Modal';
export * from './Dialog';
export * from './Dropdown';
export * from './Toggle';
export * from './StatusBadge';
```

## Files to Create

1. `frontend/src/styles/tokens.css` - Design tokens
2. `frontend/src/components/UI/Card.tsx` + test
3. `frontend/src/components/UI/Input.tsx` + test
4. `frontend/src/components/UI/Badge.tsx` + test
5. `frontend/src/components/UI/Tabs.tsx` + test
6. `frontend/src/components/UI/Alert.tsx` + test
7. `frontend/src/components/UI/index.ts` - Update exports

## Files to Modify

1. `frontend/src/index.css` - Import tokens.css

## Testing Requirements

1. All atomic components render correctly
2. Components use consistent dark theme
3. Components are accessible (ARIA attributes)
4. Variants and sizes work as expected
5. Interactive states (hover, focus, disabled) work

## Acceptance Criteria

- [ ] Design tokens CSS file created with all color/spacing/typography values
- [ ] Tokens imported in index.css
- [ ] Card component created with variants
- [ ] Input component created with label/error support
- [ ] Badge component created with status variants
- [ ] Tabs component created matching app style
- [ ] Alert component created for notifications
- [ ] All components use Tailwind classes mapped to design tokens
- [ ] Legacy CSS variables mapped to new tokens for backward compatibility
