/**
 * The OSS dashboard themes itself before first paint with an inline script in
 * index.html. It cannot import anything, so it is a copy of
 * THEME_INIT_SCRIPT (packages/ui/src/theme-script.ts): this test keeps the
 * two identical, and checks the document starts out themed.
 *
 * @module theme-init.test
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT } from '@crewly/ui';

const html = readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('index.html theme bootstrap', () => {
  it('inlines exactly THEME_INIT_SCRIPT', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts).toContain(THEME_INIT_SCRIPT);
  });

  it('starts with a data-theme so there is no unthemed frame', () => {
    expect(html).toMatch(/<html[^>]*data-theme="(light|dark)"/);
  });

  it('declares both colour schemes and a theme-color for the script to update', () => {
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9a-f]{6}" \/>/i);
  });
});
