#!/usr/bin/env node
/**
 * iOS 12 lint for hand-written (non-PostCSS-processed) CSS: glass.css and
 * hosts' canvas-style files.
 *
 *   node scripts/lint-ios12.mjs [file.css ...]     (default: glass.css)
 *
 * Fails on syntax iOS 12 Safari drops, and on any backdrop-filter that is not
 * inside an @supports block (the solid fallback colour must be what old
 * browsers paint). Exit code 1 on any finding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const files = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(here, '..', 'glass.css')];

const BAD = [
  [/(^|[;{\s])gap\s*:/, 'gap (use margins)'],
  [/grid-gap|row-gap|column-gap/, 'grid/row/column gap'],
  [/aspect-ratio/, 'aspect-ratio'],
  [/(^|[;{\s])inset\s*:/, 'inset'],
  [/:is\(|:where\(/, ':is/:where'],
  [/&\s*[.:#[>]/, 'CSS nesting'],
  [/\bclamp\(|\bmin\(|\bmax\(/, 'min/max/clamp'],
  [/:focus-visible|:has\(/, ':focus-visible/:has'],
  [/\b[dsl]vh\b/, 'dvh/svh/lvh'],
  [/env\(/, 'env()'],
  [/@container/, '@container'],
];

let failed = 0;
for (const file of files) {
  const css = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [re, name] of BAD) {
    if (re.test(css)) {
      console.log(`${file}: FAIL ${name}`);
      failed++;
    }
  }
  // Blank out balanced @supports blocks, then no backdrop-filter may remain.
  let outside = css;
  for (;;) {
    const at = outside.search(/@supports[^{]*\{/);
    if (at < 0) break;
    let depth = 0;
    let i = outside.indexOf('{', at);
    for (; i < outside.length; i++) {
      if (outside[i] === '{') depth++;
      else if (outside[i] === '}' && --depth === 0) break;
    }
    outside = outside.slice(0, at) + outside.slice(i + 1);
  }
  const loose = (outside.match(/backdrop-filter\s*:/g) || []).length;
  console.log(`${file}: backdrop-filter outside @supports: ${loose} ${loose ? 'FAIL' : 'OK'}`);
  if (loose) failed++;
}
console.log(failed ? 'LINT FAILED' : 'LINT OK');
process.exit(failed ? 1 : 0);
