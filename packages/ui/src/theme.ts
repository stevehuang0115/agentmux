/**
 * Theme switching for Crewly hosts: light (default look), dark, or follow the
 * system. The choice is stored per viewer in localStorage; the resolved theme
 * is written to `<html data-theme="light|dark">`, which tokens.css reads.
 *
 * Everything here tolerates a missing/blocked storage and an old `matchMedia`
 * (iOS 12 has `addListener` only), because a theme switch must never be the
 * reason a page fails to start.
 *
 * @module theme
 */

import { useCallback, useEffect, useState } from 'react';

/** What the viewer picked. `system` follows `prefers-color-scheme`. */
export type ThemeMode = 'system' | 'light' | 'dark';
/** What the page actually shows. */
export type ResolvedTheme = 'light' | 'dark';

import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from './theme-script';

export { THEME_INIT_SCRIPT, THEME_STORAGE_KEY };

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** True for the three valid modes. */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Read the stored mode.
 *
 * @param storage - Defaults to window.localStorage
 * @returns The stored mode, or 'system' when nothing valid is stored or storage throws
 */
export function readThemeMode(storage?: Pick<Storage, 'getItem'> | null): ThemeMode {
  try {
    const s = storage === undefined ? window.localStorage : storage;
    const value = s ? s.getItem(THEME_STORAGE_KEY) : null;
    return isThemeMode(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Persist the mode. Failures (private mode, blocked storage) are swallowed:
 * the theme still applies for this page view.
 */
export function writeThemeMode(mode: ThemeMode, storage?: Pick<Storage, 'setItem' | 'removeItem'> | null): void {
  try {
    const s = storage === undefined ? window.localStorage : storage;
    if (!s) return;
    if (mode === 'system') s.removeItem(THEME_STORAGE_KEY);
    else s.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Does the OS ask for a dark UI? False when it cannot be determined. */
export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** Mode + system preference -> the theme to show. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return prefersDark ? 'dark' : 'light';
}

/** Browser chrome colour per theme (iOS status bar, Android address bar). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#b6bfe6', dark: '#0e1430' };

/**
 * Apply a mode to the document: sets `data-theme` and the theme-color meta.
 *
 * @param mode - The viewer's choice
 * @param root - Defaults to document.documentElement
 * @returns The resolved theme that was applied
 */
export function applyTheme(mode: ThemeMode, root?: HTMLElement | null): ResolvedTheme {
  const resolved = resolveTheme(mode, systemPrefersDark());
  try {
    const el = root === undefined ? document.documentElement : root;
    if (el) el.setAttribute('data-theme', resolved);
    const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="theme-color"]') : null;
    if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
  } catch {
    /* ignore */
  }
  return resolved;
}

/** Stop theming a document (a host leaving the themed area goes back to its unthemed look). */
export function clearTheme(root?: HTMLElement | null): void {
  try {
    const el = root === undefined ? document.documentElement : root;
    if (el) el.removeAttribute('data-theme');
  } catch {
    /* ignore */
  }
}

/**
 * Call `onChange` when the OS colour scheme changes.
 *
 * @returns An unsubscribe function
 */
export function watchSystemTheme(onChange: () => void): () => void {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
    const mql = window.matchMedia(DARK_QUERY);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Safari < 14 only has the deprecated pair.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  } catch {
    return () => undefined;
  }
}

export interface UseTheme {
  /** The viewer's choice. */
  mode: ThemeMode;
  /** What is showing right now. */
  resolved: ResolvedTheme;
  /** Change and persist the choice. */
  setMode: (mode: ThemeMode) => void;
}

/**
 * React hook over the functions above. Applies the theme on mount, follows
 * the OS while the mode is `system`, and syncs other tabs through the
 * `storage` event.
 */
export function useTheme(): UseTheme {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('light');

  // Read on the client only so server and first client render agree.
  useEffect(() => {
    const stored = readThemeMode();
    setModeState(stored);
    setResolved(applyTheme(stored));
  }, []);

  useEffect(() => {
    if (mode !== 'system') return undefined;
    return watchSystemTheme(() => setResolved(applyTheme('system')));
  }, [mode]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readThemeMode();
      setModeState(next);
      setResolved(applyTheme(next));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    writeThemeMode(next);
    setModeState(next);
    setResolved(applyTheme(next));
  }, []);

  return { mode, resolved, setMode };
}
