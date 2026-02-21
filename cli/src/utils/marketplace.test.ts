/**
 * Tests for CLI marketplace utilities.
 *
 * Validates registry fetching, manifest management, download/install flow,
 * and byte formatting.
 */

import path from 'path';
import { mkdtemp, rm, readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { tmpdir, homedir } from 'os';
import { mkdtempSync } from 'fs';
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

      // Mock registry with two skills and a model
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

      global.fetch = jest.fn()
        // First call: fetchRegistry
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: 1,
            lastUpdated: '2025-01-01',
            cdnBaseUrl: '',
            items: [
              makeFakeItem({ id: 'skill-a', name: 'Skill A' }),
              makeFakeItem({ id: 'skill-b', name: 'Skill B' }),
            ],
          }),
        })
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
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            schemaVersion: 1,
            lastUpdated: '2025-01-01',
            cdnBaseUrl: '',
            items: [makeFakeItem({ id: 'skill-fail', name: 'Fail Skill', assets: {} })],
          }),
        });

      const progress: string[] = [];
      const count = await installAllSkills((name) => { progress.push(name); });

      expect(count).toBe(0);
      expect(progress).toEqual(['Fail Skill']);
    });
  });
});
