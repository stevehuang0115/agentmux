/**
 * Tests for CLI marketplace utilities.
 *
 * Validates registry fetching, manifest management, download/install flow,
 * and byte formatting.
 */

import path from 'path';
import { mkdtemp, rm, readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { mkdtempSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import * as tar from 'tar';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// Initialize tempDir before module import (os.homedir is called lazily, so this works)
let tempDir: string = mkdtempSync(path.join(tmpdir(), 'mp-cli-init-'));

// Mock os.homedir to use temp dir for marketplace paths
jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return {
    ...actual,
    homedir: () => tempDir,
  };
});

import {
  fetchRegistry,
  loadManifest,
  saveManifest,
  downloadAndInstall,
  getInstallPath,
  formatBytes,
  checkSkillsInstalled,
  installAllSkills,
  countBundledSkills,
  type MarketplaceItem,
} from './marketplace.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTarGz(files: Record<string, string>): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tar-src-'));
  const innerDir = path.join(dir, 'skill');
  await mkdir(innerDir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(innerDir, name);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }

  const archivePath = path.join(dir, 'archive.tar.gz');
  await tar.c({ gzip: true, file: archivePath, cwd: dir }, ['skill']);
  return readFile(archivePath);
}

/**
 * Converts a text string to a proper ArrayBuffer for fetch mocking.
 * This ensures we don't have shared buffer issues.
 */
function textToArrayBuffer(text: string): ArrayBuffer {
  const buf = Buffer.from(text);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Creates a mock fetch response that returns a JSON registry.
 * Used as a default mock for tests that call fetchRegistry() internally.
 */
function makeRegistryResponse(items: MarketplaceItem[]) {
  return {
    ok: true,
    json: () => Promise.resolve({
      schemaVersion: 1,
      lastUpdated: '2025-01-01',
      cdnBaseUrl: '',
      items,
    }),
  };
}

function makeFakeItem(overrides: Partial<MarketplaceItem> = {}): MarketplaceItem {
  return {
    id: 'skill-test',
    type: 'skill',
    name: 'Test Skill',
    description: 'A test skill',
    author: 'test',
    version: '1.0.0',
    category: 'development',
    tags: ['test'],
    license: 'MIT',
    downloads: 0,
    rating: 5,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    assets: {
      archive: 'skills/skill-test/skill-test-1.0.0.tar.gz',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cli/utils/marketplace', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'mp-cli-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  describe('fetchRegistry', () => {
    it('returns the registry from the API', async () => {
      const fakeRegistry = {
        schemaVersion: 1,
        lastUpdated: '2025-01-01',
        cdnBaseUrl: 'https://crewly.stevesprompt.com',
        items: [makeFakeItem()],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeRegistry),
      });

      const result = await fetchRegistry();
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('skill-test');
    });

    it('throws on fetch failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(fetchRegistry()).rejects.toThrow('Failed to fetch registry');
    });

    it('merges registries with premium items taking priority', async () => {
      global.fetch = jest.fn()
        // First call: public registry (fetched in parallel)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: 1,
            lastUpdated: '2025-01-01',
            cdnBaseUrl: '',
            items: [
              makeFakeItem({ id: 'skill-public', name: 'Public Skill', version: '1.0.0' }),
              makeFakeItem({ id: 'skill-shared', name: 'Public Version', version: '1.0.0' }),
            ],
          }),
        })
        // Second call: premium registry (fetched in parallel)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: 1,
            lastUpdated: '2025-01-01',
            cdnBaseUrl: '',
            items: [
              makeFakeItem({ id: 'skill-premium', name: 'Premium Skill', version: '2.0.0' }),
              makeFakeItem({ id: 'skill-shared', name: 'Premium Version', version: '2.0.0' }),
            ],
          }),
        });

      const result = await fetchRegistry();

      // Should have 3 total items (1 public, 1 premium, 1 shared)
      expect(result.items.length).toBe(3);

      // Premium version of shared skill should override public
      const sharedSkill = result.items.find(i => i.id === 'skill-shared');
      expect(sharedSkill?.name).toBe('Premium Version');
      expect(sharedSkill?.version).toBe('2.0.0');

      // Other skills should be present
      expect(result.items.find(i => i.id === 'skill-public')).toBeDefined();
      expect(result.items.find(i => i.id === 'skill-premium')).toBeDefined();
    });

    it('succeeds when only one source is available', async () => {
      global.fetch = jest.fn()
        // Public registry fails
        .mockRejectedValueOnce(new Error('network error'))
        // Premium registry succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: 1,
            lastUpdated: '2025-01-01',
            cdnBaseUrl: '',
            items: [makeFakeItem({ id: 'premium-only', name: 'Premium Only' })],
          }),
        });

      const result = await fetchRegistry();
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('premium-only');
    });
  });

  describe('manifest management', () => {
    it('returns empty manifest when none exists', async () => {
      const manifest = await loadManifest();
      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.items).toEqual([]);
    });

    it('saves and loads manifest', async () => {
      const manifest = {
        schemaVersion: 1,
        items: [{ id: 'test', type: 'skill', name: 'Test', version: '1.0.0', installedAt: '', installPath: '' }],
      };
      await saveManifest(manifest);
      const loaded = await loadManifest();
      expect(loaded.items.length).toBe(1);
      expect(loaded.items[0].id).toBe('test');
    });
  });

  describe('getInstallPath', () => {
    it('maps skill type to skills directory', () => {
      const p = getInstallPath('skill', 'my-skill');
      expect(p).toContain(path.join('marketplace', 'skills', 'my-skill'));
    });

    it('maps model type to models directory', () => {
      const p = getInstallPath('model', 'my-model');
      expect(p).toContain(path.join('marketplace', 'models', 'my-model'));
    });

    it('throws on path traversal attempt', () => {
      expect(() => getInstallPath('skill', '../etc/passwd')).toThrow('Invalid marketplace item ID');
    });

    it('throws on IDs with special characters', () => {
      expect(() => getInstallPath('skill', 'my skill')).toThrow('Invalid marketplace item ID');
      expect(() => getInstallPath('skill', 'UPPERCASE')).toThrow('Invalid marketplace item ID');
      expect(() => getInstallPath('skill', '-starts-with-hyphen')).toThrow('Invalid marketplace item ID');
    });

    it('accepts valid IDs with hyphens and numbers', () => {
      expect(() => getInstallPath('skill', 'my-skill-2')).not.toThrow();
      expect(() => getInstallPath('skill', 'a')).not.toThrow();
      expect(() => getInstallPath('skill', '1-test')).not.toThrow();
    });
  });

  describe('downloadAndInstall', () => {
    it('extracts tar.gz and updates manifest', async () => {
      const archiveBuffer = await createTarGz({
        'execute.sh': '#!/bin/bash\necho hello',
        'skill.json': '{"id":"skill-test"}',
      });

      const checksum = 'sha256:' + createHash('sha256').update(archiveBuffer).digest('hex');
      const item = makeFakeItem({
        assets: { archive: 'skills/skill-test/skill-test-1.0.0.tar.gz', checksum },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          archiveBuffer.buffer.slice(archiveBuffer.byteOffset, archiveBuffer.byteOffset + archiveBuffer.byteLength)
        ),
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(true);

      // Verify files extracted
      const installDir = getInstallPath('skill', 'skill-test');
      const files = await readdir(installDir);
      expect(files).toContain('execute.sh');
      expect(files).toContain('skill.json');

      // Verify manifest updated
      const manifest = await loadManifest();
      expect(manifest.items.length).toBe(1);
      expect(manifest.items[0].id).toBe('skill-test');
    });

    it('returns error on checksum mismatch', async () => {
      const archiveBuffer = await createTarGz({ 'execute.sh': 'echo hi' });
      const item = makeFakeItem({
        assets: {
          archive: 'skills/skill-test/skill-test-1.0.0.tar.gz',
          checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          archiveBuffer.buffer.slice(archiveBuffer.byteOffset, archiveBuffer.byteOffset + archiveBuffer.byteLength)
        ),
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Checksum mismatch');
    });

    it('returns error for invalid checksum format', async () => {
      const archiveBuffer = await createTarGz({ 'execute.sh': 'echo hi' });
      const item = makeFakeItem({
        assets: {
          archive: 'skills/skill-test/skill-test-1.0.0.tar.gz',
          checksum: 'nocolonhere',
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          archiveBuffer.buffer.slice(archiveBuffer.byteOffset, archiveBuffer.byteOffset + archiveBuffer.byteLength)
        ),
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid checksum format');
    });

    it('returns error for unsupported checksum algorithm', async () => {
      const archiveBuffer = await createTarGz({ 'execute.sh': 'echo hi' });
      const item = makeFakeItem({
        assets: {
          archive: 'skills/skill-test/skill-test-1.0.0.tar.gz',
          checksum: 'md5:abc123',
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(
          archiveBuffer.buffer.slice(archiveBuffer.byteOffset, archiveBuffer.byteOffset + archiveBuffer.byteLength)
        ),
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unsupported checksum algorithm');
      expect(result.message).toContain('md5');
    });

    it('cleans up install directory on download failure', async () => {
      const item = makeFakeItem({
        assets: {
          archive: 'skills/skill-test/skill-test-1.0.0.tar.gz',
        },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });

      const installDir = getInstallPath('skill', 'skill-test');
      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);

      // Install directory should be cleaned up
      expect(existsSync(installDir)).toBe(false);
    });

    it('installs GitHub-sourced skill by downloading individual files', async () => {
      const item = makeFakeItem({
        id: 'github-skill',
        assets: { archive: 'config/skills/agent/core/github-skill' }, // GitHub path, no .tar.gz
      });

      const mockFiles: Record<string, string> = {
        'skill.json': '{"id":"github-skill"}',
        'execute.sh': '#!/bin/bash\necho github',
        'instructions.md': '# Instructions',
      };

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        const filename = url.split('/').pop();
        if (filename && mockFiles[filename]) {
          return {
            ok: true,
            arrayBuffer: () => Promise.resolve(textToArrayBuffer(mockFiles[filename])),
          };
        }
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(true);

      // Verify all files were written
      const installDir = getInstallPath('skill', 'github-skill');
      const files = await readdir(installDir);
      expect(files).toContain('skill.json');
      expect(files).toContain('execute.sh');
      expect(files).toContain('instructions.md');

      const skillJsonContent = await readFile(path.join(installDir, 'skill.json'), 'utf-8');
      expect(skillJsonContent).toBe('{"id":"github-skill"}');
    });

    it('skips instructions.md on 404 for GitHub-sourced skills', async () => {
      const item = makeFakeItem({
        id: 'github-skill-no-docs',
        assets: { archive: 'config/skills/agent/core/github-skill-no-docs' },
      });

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        const filename = url.split('/').pop();
        if (filename === 'skill.json') {
          return {
            ok: true,
            arrayBuffer: () => Promise.resolve(textToArrayBuffer('{"id":"test"}')),
          };
        }
        if (filename === 'execute.sh') {
          return {
            ok: true,
            arrayBuffer: () => Promise.resolve(textToArrayBuffer('#!/bin/bash')),
          };
        }
        // instructions.md returns 404
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(true); // Should succeed even without instructions.md

      const installDir = getInstallPath('skill', 'github-skill-no-docs');
      const files = await readdir(installDir);
      expect(files).toContain('skill.json');
      expect(files).toContain('execute.sh');
      expect(files).not.toContain('instructions.md');
    });

    it('succeeds when execute.sh returns 404 for GitHub-sourced skills (MCP/prompt-only skills)', async () => {
      const item = makeFakeItem({
        id: 'github-skill-no-exec',
        assets: { archive: 'config/skills/agent/core/github-skill-no-exec' },
      });

      global.fetch = jest.fn().mockImplementation(async (url: string) => {
        const filename = url.split('/').pop();
        if (filename === 'skill.json') {
          return {
            ok: true,
            arrayBuffer: () => Promise.resolve(textToArrayBuffer('{"id":"test"}')),
          };
        }
        // execute.sh and instructions.md return 404 — only skill.json is required
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(true);
    });

    it('fails if skill.json returns 404 for GitHub-sourced skills', async () => {
      const item = makeFakeItem({
        id: 'github-skill-missing',
        assets: { archive: 'config/skills/agent/core/github-skill-missing' },
      });

      global.fetch = jest.fn().mockImplementation(async () => {
        return { ok: false, status: 404, statusText: 'Not Found' };
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Download failed for skill.json');
      expect(result.message).toContain('404');
    });

    it('returns error for items with no downloadable asset', async () => {
      const item = makeFakeItem({
        id: 'no-asset-skill',
        assets: {}, // No archive, no model
      });

      const result = await downloadAndInstall(item);
      expect(result.success).toBe(false);
      expect(result.message).toBe('No downloadable asset for no-asset-skill');
    });
  });

  describe('formatBytes', () => {
    it('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatBytes(18841)).toBe('18.4 KB');
    });

    it('formats megabytes', () => {
      expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });

  describe('checkSkillsInstalled', () => {
    it('returns correct installed and total counts', async () => {
      // Save a manifest with one installed skill
      await saveManifest({
        schemaVersion: 1,
        items: [
          { id: 'skill-a', type: 'skill', name: 'A', version: '1.0.0', installedAt: '', installPath: '' },
        ],
      });

      // Mock registry with two skills and a model (both parallel fetches return same data)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          schemaVersion: 1,
          lastUpdated: '2025-01-01',
          cdnBaseUrl: '',
          items: [
            makeFakeItem({ id: 'skill-a', name: 'Skill A' }),
            makeFakeItem({ id: 'skill-b', name: 'Skill B' }),
            makeFakeItem({ id: 'model-c', type: 'model', name: 'Model C' }),
          ],
        }),
      });

      const result = await checkSkillsInstalled();
      expect(result.installed).toBe(1);
      expect(result.total).toBe(2); // Only skills, not models
    });

    it('returns zero when no manifest exists', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          schemaVersion: 1,
          lastUpdated: '2025-01-01',
          cdnBaseUrl: '',
          items: [makeFakeItem()],
        }),
      });

      const result = await checkSkillsInstalled();
      expect(result.installed).toBe(0);
      expect(result.total).toBe(1);
    });
  });

  describe('installAllSkills', () => {
    it('installs all skills and returns count', async () => {
      const archiveBuffer = await createTarGz({
        'execute.sh': '#!/bin/bash\necho hello',
      });

      const registryResponse = makeRegistryResponse([
        makeFakeItem({ id: 'skill-a', name: 'Skill A' }),
        makeFakeItem({ id: 'skill-b', name: 'Skill B' }),
      ]);

      global.fetch = jest.fn()
        // First two calls: parallel fetchRegistry (public + premium)
        .mockResolvedValueOnce(registryResponse)
        .mockResolvedValueOnce(registryResponse)
        // Subsequent calls: downloadAndInstall fetch
        .mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(
            archiveBuffer.buffer.slice(archiveBuffer.byteOffset, archiveBuffer.byteOffset + archiveBuffer.byteLength),
          ),
        });

      const progress: Array<{ name: string; index: number; total: number }> = [];
      const count = await installAllSkills((name, index, total) => {
        progress.push({ name, index, total });
      });

      expect(count).toBe(2);
      expect(progress).toHaveLength(2);
      expect(progress[0]).toEqual({ name: 'Skill A', index: 1, total: 2 });
      expect(progress[1]).toEqual({ name: 'Skill B', index: 2, total: 2 });
    });

    it('calls onProgress even when install fails', async () => {
      const registryResponse = makeRegistryResponse([
        makeFakeItem({ id: 'skill-fail', name: 'Fail Skill', assets: {} }),
      ]);

      global.fetch = jest.fn()
        // Both parallel fetchRegistry calls
        .mockResolvedValueOnce(registryResponse)
        .mockResolvedValueOnce(registryResponse);

      const progress: string[] = [];
      const count = await installAllSkills((name) => { progress.push(name); });

      expect(count).toBe(0);
      expect(progress).toEqual(['Fail Skill']);
    });
  });

  describe('countBundledSkills', () => {
    it('returns a number >= 0', () => {
      const count = countBundledSkills();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
