/**
 * Tests for the Seed Marketplace CLI Command
 *
 * Validates skill packaging, registry generation, and dry-run mode.
 *
 * @module cli/commands/seed-marketplace.test
 */

import path from 'path';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';

// Set up temp dir before os mock
const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), 'seed-mp-test-'));

// Mock homedir
jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return { ...actual, homedir: () => TEMP_ROOT };
});

// Mock chalk (ESM-only package)
jest.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    blue: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    gray: (s: string) => s,
  },
  red: (s: string) => s,
  blue: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  gray: (s: string) => s,
}));

import { seedMarketplaceCommand } from './seed-marketplace.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal valid skill directory */
function createSkillDir(parentDir: string, skillId: string): void {
  const skillDir = path.join(parentDir, skillId);
  mkdirSync(skillDir, { recursive: true });

  const skillJson = {
    id: skillId,
    name: `${skillId} Skill`,
    description: `Description for ${skillId}`,
    version: '1.0.0',
    category: 'development',
    assignableRoles: ['developer'],
    tags: ['test'],
    author: 'Crewly Team',
    license: 'MIT',
    execution: {
      type: 'script',
      script: { file: 'execute.sh', interpreter: 'bash', timeoutMs: 60000 },
    },
  };

  writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(skillJson));
  writeFileSync(path.join(skillDir, 'execute.sh'), '#!/bin/bash\necho "test"');
  writeFileSync(path.join(skillDir, 'instructions.md'), `# ${skillId}\nA test skill.`);
}

const MARKETPLACE_DIR = path.join(TEMP_ROOT, '.crewly', 'marketplace');
const LOCAL_REGISTRY = path.join(MARKETPLACE_DIR, 'local-registry.json');

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const skillsDir = path.join(TEMP_ROOT, 'skills');

beforeAll(() => {
  mkdirSync(skillsDir, { recursive: true });
  // Create some skills that match PUBLISHABLE_SKILLS list
  createSkillDir(skillsDir, 'check-quality-gates');
  createSkillDir(skillsDir, 'dep-updater');
  createSkillDir(skillsDir, 'test-runner');
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedMarketplaceCommand', () => {
  beforeEach(() => {
    // Clean registry between tests
    if (existsSync(LOCAL_REGISTRY)) {
      rmSync(LOCAL_REGISTRY);
    }
  });

  it('publishes skills to local registry', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir });

    consoleSpy.mockRestore();

    expect(existsSync(LOCAL_REGISTRY)).toBe(true);

    const registry = JSON.parse(readFileSync(LOCAL_REGISTRY, 'utf-8'));
    expect(registry.items.length).toBeGreaterThan(0);

    const ids = registry.items.map((i: { id: string }) => i.id);
    expect(ids).toContain('check-quality-gates');
    expect(ids).toContain('dep-updater');
    expect(ids).toContain('test-runner');
  });

  it('creates archives in assets directory', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir });

    consoleSpy.mockRestore();

    const assetsDir = path.join(MARKETPLACE_DIR, 'assets', 'skills');
    expect(existsSync(path.join(assetsDir, 'check-quality-gates'))).toBe(true);
    expect(existsSync(path.join(assetsDir, 'dep-updater'))).toBe(true);
  });

  it('skips already published skills with same version', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    // First run publishes
    await seedMarketplaceCommand({ skillsDir });

    consoleSpy.mockClear();

    // Second run should skip
    await seedMarketplaceCommand({ skillsDir });

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('already published');

    consoleSpy.mockRestore();
  });

  it('dry-run mode does not create registry', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir, dryRun: true });

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('would publish');

    // Registry should not exist
    expect(existsSync(LOCAL_REGISTRY)).toBe(false);

    consoleSpy.mockRestore();
  });

  it('generates valid registry entries', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir });

    consoleSpy.mockRestore();

    const registry = JSON.parse(readFileSync(LOCAL_REGISTRY, 'utf-8'));
    for (const item of registry.items) {
      expect(item.type).toBe('skill');
      expect(item.version).toBe('1.0.0');
      expect(item.assets.archive).toBeTruthy();
      expect(item.assets.checksum).toMatch(/^sha256:/);
      expect(item.assets.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('throws when skillsDir does not exist', async () => {
    await expect(
      seedMarketplaceCommand({ skillsDir: '/nonexistent/path/to/skills' }),
    ).rejects.toThrow('Skills directory not found');
  });

  it('handles skill validation failure', async () => {
    // Create an invalid skill (missing execute.sh)
    const invalidSkillDir = path.join(skillsDir, 'computer-use');
    mkdirSync(invalidSkillDir, { recursive: true });
    writeFileSync(
      path.join(invalidSkillDir, 'skill.json'),
      JSON.stringify({ id: 'computer-use', name: 'Computer Use', version: '1.0.0' }),
    );
    // Missing execute.sh and instructions.md → validation should fail

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir });

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('computer-use');
    expect(calls).toContain('validation failed');

    consoleSpy.mockRestore();

    // Cleanup invalid skill
    rmSync(invalidSkillDir, { recursive: true, force: true });
  });

  it('handles archive creation error', async () => {
    // Create a skill that passes validation but causes archive error
    // We'll mock createSkillArchive to throw for this test
    const archiveModule = await import('../utils/archive-creator.js');
    const originalCreate = archiveModule.createSkillArchive;
    (archiveModule as any).createSkillArchive = jest.fn().mockRejectedValue(new Error('archive failed'));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await seedMarketplaceCommand({ skillsDir });

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('archive failed');

    consoleSpy.mockRestore();
    (archiveModule as any).createSkillArchive = originalCreate;
  });
});
