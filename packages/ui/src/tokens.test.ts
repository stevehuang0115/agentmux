/**
 * The token files must agree, or the OSS frontend and the Cloud portal drift
 * apart again — the reason this package exists:
 * - tokens.css holds the values (CSS variables, dark theme);
 * - tailwind-preset.cjs (v3, OSS frontend) and theme.css (v4, Cloud portal)
 *   expose the same colour names.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const css = readFileSync(path.join(root, 'theme.css'), 'utf8');
const tokensCss = readFileSync(path.join(root, 'tokens.css'), 'utf8');
const preset = require(path.join(root, 'tailwind-preset.cjs')) as { theme: { extend: { colors: Record<string, string> } } };
const presetColors = preset.theme.extend.colors;

/** Text of the section that starts at the comment marker `/* ---------- <marker>` and ends at its closing brace. */
function section(marker: string): string {
  const start = tokensCss.indexOf(`/* ---------- ${marker}`);
  if (start < 0) throw new Error(`no section ${marker}`);
  return tokensCss.slice(start, tokensCss.indexOf('\n}\n', start));
}
const SHARED = 'Glass tokens that are not colour channels';
/** The shared glass block (unthemed + dark) is introduced by a comment, not a marker line. */
function sharedBlock(): string {
  const start = tokensCss.indexOf(SHARED);
  return tokensCss.slice(start, tokensCss.indexOf('\n}\n', start));
}
const block = (selector: string): string =>
  selector === ':root' ? section('no theme attribute') : selector === "[data-theme='dark']" ? section('dark:') : selector === "[data-theme='light']" ? section('light:') : sharedBlock();

/** `--c-name: 42 115 234;` -> { name: '#2a73ea' } within a block. */
function channelsOf(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/--c-([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) {
    out[m[1]] = '#' + [m[2], m[3], m[4]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }
  return out;
}

/** The unthemed (no data-theme) palette: the original dark one. */
const darkChannels = () => channelsOf(block(':root'));
const nightChannels = () => channelsOf(block("[data-theme='dark']"));
const lightChannels = () => channelsOf(block("[data-theme='light']"));

/** Token a preset colour points at (`rgb(var(--c-bg) / …)` → 'bg'). */
function presetToken(value: string): string | null {
  const m = value.match(/var\(--(?:c-)?([\w-]+)\)/);
  return m ? m[1] : null;
}

describe('design tokens', () => {
  it('tokens.css defines every channel the preset uses', () => {
    const channels = darkChannels();
    for (const [name, value] of Object.entries(presetColors)) {
      const token = presetToken(value);
      expect(token, name).not.toBeNull();
      if (value.includes('--c-')) expect(channels[token as string], `${name} → --c-${token}`).toBeDefined();
      else expect(tokensCss, `${name} → --${token}`).toContain(`--${token}:`);
    }
  });

  it('legacy names resolve through the variables (so a theme swap reaches them)', () => {
    const fromCss = Object.fromEntries(
      [...css.matchAll(/--color-([\w-]+):\s*rgb\(var\(--c-([\w-]+)\)\);/g)].map((m) => [m[1], m[2]]),
    );
    for (const name of ['primary', 'background-dark', 'surface-dark', 'text-primary-dark', 'text-secondary-dark', 'border-dark']) {
      expect(fromCss[name], name).toBeDefined();
      expect(presetToken(presetColors[name]), name).toBe(fromCss[name]);
    }
  });

  it('with no data-theme the legacy names still equal the original hex', () => {
    const channels = darkChannels();
    expect(channels).toMatchObject({ bg: '#111721', surface: '#1a222c', text: '#f6f7f8', 'text-2': '#9ab0d9', border: '#313a48', primary: '#2a73ea' });
  });

  it('theme.css and the Tailwind preset expose the same colour names', () => {
    const cssNames = [...css.matchAll(/--color-([\w-]+):/g)].map((m) => m[1]).sort();
    expect(cssNames).toEqual(Object.keys(presetColors).sort());
  });

  it('the unthemed palette keeps the original redesign values', () => {
    expect(darkChannels()).toMatchObject({
      bg: '#111721',
      surface: '#1a222c',
      'surface-2': '#212a36',
      'surface-hover': '#242e3b',
      border: '#313a48',
      'border-soft': '#262f3c',
      text: '#f6f7f8',
      'text-2': '#9ab0d9',
      'text-3': '#7488ab',
      primary: '#2a73ea',
      'primary-text': '#6ea2f5',
      attention: '#f0a33a',
      success: '#34c38f',
      danger: '#f06a6a',
      'muted-dot': '#5b6779',
    });
  });

  it('declares no Tailwind v4 theme variables (they would restyle the portal: rounded-lg, font-mono, …)', () => {
    const declared = [...tokensCss.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]);
    const v4Namespace = /^--(radius|font|shadow|inset-shadow|drop-shadow|spacing|breakpoint|container|leading|tracking|ease|animate|blur|perspective|aspect|default|color)(-|$)|^--text-(xs|sm|base|lg|xl|\dxl)$/;
    expect(declared.filter((v) => v4Namespace.test(v))).toEqual([]);
    expect(declared).toEqual(expect.arrayContaining(['--crewly-radius-sm', '--crewly-radius', '--crewly-radius-lg', '--crewly-font-mono']));
  });

  it('defines the same channels in all three palettes', () => {
    const names = Object.keys(darkChannels()).sort();
    expect(Object.keys(lightChannels()).sort()).toEqual(names);
    expect(Object.keys(nightChannels()).sort()).toEqual(names);
  });
});

// ---- design language v2 "Glass": themes, contrast, iOS 12 safety ----

function lum(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two #rrggbb colours. */
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Solid hex colours of `--name:` in a block (fallback surfaces). */
function hexVar(blockCss: string, name: string): string {
  const m = blockCss.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  if (!m) throw new Error(`--${name} not found`);
  return m[1].toLowerCase();
}
/** The linear-gradient stops of the wall: the colours text can land on. */
function wallStops(css: string): string[] {
  const wall = css.match(/--wall:([\s\S]*?);\n/)?.[1] ?? '';
  const linear = wall.slice(wall.indexOf('linear-gradient'));
  return [...linear.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase());
}

describe.each([
  ['light', "[data-theme='light']", lightChannels],
  ['dark', "[data-theme='dark']", nightChannels],
])('%s theme', (_name, selector, channels) => {
  const c = channels();
  // `--glass-*-fb` live in the shared night block for dark; read both and prefer this theme's.
  const own = block(selector);
  const glassFb = (n: string) => {
    try {
      return hexVar(own, n);
    } catch {
      return hexVar(sharedBlock(), n);
    }
  };
  const walls = wallStops(own.includes('--wall:') ? own : sharedBlock());

  it('has a wall with at least 3 stops', () => {
    expect(walls.length).toBeGreaterThanOrEqual(3);
  });

  it('body text meets WCAG AA on every surface it can sit on', () => {
    for (const bg of [c.surface, c['surface-2'], c.bg, glassFb('glass-fb'), glassFb('glass-strong-fb'), glassFb('glass-2-fb'), ...walls]) {
      expect(ratio(c.text, bg), `text on ${bg}`).toBeGreaterThanOrEqual(7);
      expect(ratio(c['text-2'], bg), `text-2 on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('hint text (text-3) meets AA on cards and glass fallbacks', () => {
    for (const bg of [c.surface, c['surface-2'], glassFb('glass-fb'), glassFb('glass-strong-fb')]) {
      expect(ratio(c['text-3'], bg), `text-3 on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('accent and state colours meet AA as text on cards and glass fallbacks', () => {
    for (const bg of [c.surface, glassFb('glass-fb'), glassFb('glass-strong-fb')]) {
      for (const name of ['primary-text', 'attention', 'success', 'danger']) {
        expect(ratio(c[name], bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(ratio(c['on-primary'], c.primary), 'on-primary on primary').toBeGreaterThanOrEqual(4.5);
  });

  it('step-kind chips are legible', () => {
    for (const kind of ['read', 'edit', 'run', 'find', 'browse', 'delegate', 'think']) {
      const fg = hexVar(own.includes(`--kind-${kind}:`) ? own : sharedBlock(), `kind-${kind}`);
      const bg = hexVar(own.includes(`--kind-${kind}-bg:`) ? own : sharedBlock(), `kind-${kind}-bg`);
      expect(ratio(fg, bg), `${kind} chip`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('glass.css (iOS 12 safe)', () => {
  const glass = readFileSync(path.join(root, 'glass.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('uses nothing iOS 12 lacks', () => {
    for (const bad of [/(^|[;{\s])gap\s*:/, /aspect-ratio/, /(^|[;{\s])inset\s*:/, /:is\(|:where\(/, /&\s*[.:#[>]/, /\bclamp\(|\bmin\(|\bmax\(/, /:focus-visible|:has\(/, /\b[dsl]vh\b/, /env\(/, /@container/]) {
      expect(glass).not.toMatch(bad);
    }
  });

  it('puts every backdrop-filter inside @supports, behind a solid fallback colour', () => {
    const outside = glass.replace(/@supports[^{]*\{[\s\S]*?\n  \}/g, '');
    expect(outside).not.toMatch(/backdrop-filter/);
    expect(glass).toMatch(/@supports \(\(-webkit-backdrop-filter: blur\(1px\)\) or \(backdrop-filter: blur\(1px\)\)\)/);
    for (const cls of ['cw-glass', 'cw-glass-2', 'cw-glass-strong', 'cw-glass-warn', 'cw-bar']) {
      expect(outside, cls).toMatch(new RegExp(`\\.${cls}\\s*\\{[^}]*background-color: var\\(--glass[\\w-]*-fb\\)`));
    }
    // each -webkit- twin sits beside its standard property
    expect((glass.match(/-webkit-backdrop-filter/g) ?? []).length).toBe((glass.match(/[^-]backdrop-filter:/g) ?? []).length);
  });
});
