/**
 * Jest config for CI (.github/workflows/ci.yml): the regular jest.config.js
 * minus the test files listed in scripts/ci/jest-quarantine.json.
 *
 * The quarantine holds test files that were already failing on main when CI
 * was introduced, so the gate can start green without hiding them: CI runs
 * them in a separate, non-blocking job. Fix a file, then delete its entry.
 */
import { readFileSync } from 'fs';
import base from './jest.config.js';

const { files } = JSON.parse(readFileSync(new URL('./scripts/ci/jest-quarantine.json', import.meta.url), 'utf8'));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default {
  ...base,
  testPathIgnorePatterns: [...(base.testPathIgnorePatterns ?? []), ...files.map((f) => `${escape(f)}$`)],
};
