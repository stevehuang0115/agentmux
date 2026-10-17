/**
 * Tests for the shared vault walker (#1345: the rotated-log archive is skipped).
 *
 * @module services/wiki/wiki-vault-walk.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { LOG_ARCHIVE_DIR_NAME, isLogArchivePath, isSeedFile, walkCuratedPages } from './wiki-vault-walk.js';

describe('wiki-vault-walk', () => {
  let vault: string;

  beforeEach(async () => {
    vault = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-walk-test-'));
    await fs.mkdir(path.join(vault, 'llm-curated/decisions'), { recursive: true });
    await fs.mkdir(path.join(vault, 'llm-curated/log-archive'), { recursive: true });
    await fs.mkdir(path.join(vault, 'llm-curated/_proposed'), { recursive: true });
    await fs.writeFile(path.join(vault, 'llm-curated/decisions/a.md'), '# A', 'utf8');
    await fs.writeFile(path.join(vault, 'llm-curated/log.md'), '# Activity log', 'utf8');
    await fs.writeFile(path.join(vault, 'llm-curated/log-archive/log-2026-10-01.md'), '# old', 'utf8');
    await fs.writeFile(path.join(vault, 'llm-curated/_proposed/p.md'), '# P', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(vault, { recursive: true, force: true });
  });

  it('lists pages and the log but never the archive; proposals only on request', async () => {
    const pages = (await walkCuratedPages(vault)).map((p) => p.relativePath);
    expect(pages).toEqual(['llm-curated/decisions/a.md', 'llm-curated/log.md']);
    const withProposed = (await walkCuratedPages(vault, { includeProposed: true })).map((p) => p.relativePath);
    expect(withProposed).toContain('llm-curated/_proposed/p.md');
    expect(withProposed.some((p) => p.includes('log-archive'))).toBe(false);
  });

  it('identifies seed files and archive paths', () => {
    expect(isSeedFile('llm-curated/log.md')).toBe(true);
    expect(isSeedFile('llm-curated/index.md')).toBe(true);
    expect(isSeedFile('llm-curated/decisions/a.md')).toBe(false);
    expect(isLogArchivePath('llm-curated/log-archive/log-2026-10-01.md')).toBe(true);
    expect(isLogArchivePath('llm-curated/log-archive')).toBe(true);
    expect(isLogArchivePath('llm-curated/log.md')).toBe(false);
    expect(LOG_ARCHIVE_DIR_NAME).toBe('log-archive');
  });
});
