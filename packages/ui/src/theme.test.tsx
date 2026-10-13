import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyTheme,
  clearTheme,
  readThemeMode,
  resolveTheme,
  systemPrefersDark,
  useTheme,
  watchSystemTheme,
  writeThemeMode,
} from './theme';
import { ThemeSelect } from './ThemeSelect';

type Listener = () => void;

/** Install a controllable matchMedia. Returns a switch for the OS preference. */
function mockMatchMedia(initialDark: boolean, legacy = false) {
  let dark = initialDark;
  const listeners = new Set<Listener>();
  window.matchMedia = ((query: string) => {
    const mql: Record<string, unknown> = {
      get matches() {
        return query.includes('dark') ? dark : false;
      },
      media: query,
      addListener: (l: Listener) => listeners.add(l),
      removeListener: (l: Listener) => listeners.delete(l),
    };
    if (!legacy) {
      mql.addEventListener = (_: string, l: Listener) => listeners.add(l);
      mql.removeEventListener = (_: string, l: Listener) => listeners.delete(l);
    }
    return mql as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
  return {
    set(next: boolean) {
      dark = next;
      listeners.forEach((l) => l());
    },
    count: () => listeners.size,
  };
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  mockMatchMedia(false);
});
afterEach(() => vi.restoreAllMocks());

describe('theme functions', () => {
  it('resolves system by the OS preference and lets an explicit mode win', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('defaults to system and ignores garbage in storage', () => {
    expect(readThemeMode()).toBe('system');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemeMode()).toBe('system');
  });

  it('persists a choice, and system clears it', () => {
    writeThemeMode('dark');
    expect(readThemeMode()).toBe('dark');
    writeThemeMode('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('survives storage that throws (private mode)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(readThemeMode(throwing)).toBe('system');
    expect(() => writeThemeMode('dark', throwing)).not.toThrow();
  });

  it('survives a missing or throwing matchMedia', () => {
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(systemPrefersDark()).toBe(false);
    window.matchMedia = (() => {
      throw new Error('nope');
    }) as unknown as typeof window.matchMedia;
    expect(systemPrefersDark()).toBe(false);
    expect(applyTheme('system')).toBe('light');
  });

  it('applyTheme sets data-theme on <html>; clearTheme removes it', () => {
    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    clearTheme();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('updates the theme-color meta', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000');
    document.head.appendChild(meta);
    applyTheme('dark');
    expect(meta.getAttribute('content')).toBe('#0e1430');
    applyTheme('light');
    expect(meta.getAttribute('content')).toBe('#b6bfe6');
    meta.remove();
  });

  it('watchSystemTheme works with the modern and the iOS 12 listener API', () => {
    for (const legacy of [false, true]) {
      const mm = mockMatchMedia(false, legacy);
      const fn = vi.fn();
      const off = watchSystemTheme(fn);
      mm.set(true);
      expect(fn).toHaveBeenCalledTimes(1);
      off();
      expect(mm.count()).toBe(0);
    }
  });
});

describe('THEME_INIT_SCRIPT', () => {
  function run() {
    new Function(THEME_INIT_SCRIPT)();
    return document.documentElement.getAttribute('data-theme');
  }

  it('is ES5 (no arrow functions, let/const, template strings)', () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });

  it('follows the OS by default', () => {
    expect(run()).toBe('light');
    mockMatchMedia(true);
    expect(run()).toBe('dark');
  });

  it('lets the stored choice override the OS', () => {
    mockMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(run()).toBe('light');
  });

  it('still themes the page when storage and matchMedia both fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    window.matchMedia = undefined as unknown as typeof window.matchMedia;
    expect(run()).toBe('light');
  });
});

describe('useTheme', () => {
  it('applies the OS theme on mount and follows it while mode is system', () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');
    act(() => mm.set(true));
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('a manual choice persists and stops following the OS', () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('light'));
    act(() => mm.set(true));
    expect(result.current.resolved).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a stored choice and syncs another tab', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    act(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }));
    });
    expect(result.current.mode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});

describe('ThemeSelect', () => {
  it('offers System / Light / Dark and applies the pick', async () => {
    render(<ThemeSelect labels={{ system: 'Auto' }} />);
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
  });
});
