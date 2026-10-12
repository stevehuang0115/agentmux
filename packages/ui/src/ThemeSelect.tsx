import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { useTheme, type ThemeMode } from './theme';

export interface ThemeSelectProps {
  /** Visible names; defaults to System / Light / Dark. Pass translations here. */
  labels?: Partial<Record<ThemeMode, string>>;
  /** Accessible name of the group; defaults to "Theme". */
  'aria-label'?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The Theme setting: System / Light / Dark. Persists the choice for this
 * viewer and applies it at once (see `useTheme`).
 *
 * @example
 * ```tsx
 * <ThemeSelect labels={{ system: t('system'), light: t('light'), dark: t('dark') }} />
 * ```
 */
export const ThemeSelect: React.FC<ThemeSelectProps> = ({ labels, size = 'md', className, ...rest }) => {
  const { mode, setMode } = useTheme();
  return (
    <SegmentedControl<ThemeMode>
      aria-label={rest['aria-label'] ?? 'Theme'}
      size={size}
      className={className}
      value={mode}
      onChange={setMode}
      options={[
        { value: 'system', label: labels?.system ?? 'System', icon: Monitor, 'data-testid': 'theme-system' },
        { value: 'light', label: labels?.light ?? 'Light', icon: Sun, 'data-testid': 'theme-light' },
        { value: 'dark', label: labels?.dark ?? 'Dark', icon: Moon, 'data-testid': 'theme-dark' },
      ]}
    />
  );
};

ThemeSelect.displayName = 'ThemeSelect';
