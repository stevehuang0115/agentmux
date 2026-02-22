/**
 * Tests for the Marketplace Submission Service.
 *
 * Validates submission workflow: skill submission, listing, review
 * (approve/reject), and local registry management.
 */

import path from 'path';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import * as tar from 'tar';

// ---------------------------------------------------------------------------
// We need tempDir before the os mock factory runs.
// Use a fixed temp root that we set up synchronously.
// ---------------------------------------------------------------------------

import { mkdtempSync, rmSync, mkdirSync } from 'fs';

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), 'mp-submit-test-'));

// Mock homedir to our temp root
jest.mock('os', () => {
  const actual = jest.requireActual('os');
  return { ...actual, homedir: () => TEMP_ROOT };
});

// Mock the marketplace service fetchRegistry
jest.mock('./marketplace.service.js', () => ({
  fetchRegistry: jest.fn(async () => ({
    schemaVersion: 1,
    lastUpdated: new Date().toISOString(),
    cdnBaseUrl: 'https://example.com',
    items: [],
  })),
}));

// Import after mocks
import {
  submitSkill,
  listSubmissions,
  getSubmission,
  reviewSubmission,
  loadSubmissionsManifest,
  saveSubmissionsManifest,
} from './marketplace-submission.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUBMISSIONS_DIR = path.join(TEMP_ROOT, '.crewly', 'marketplace', 'submissions');
const SUBMISSIONS_MANIFEST = path.join(SUBMISSIONS_DIR, 'manifest.json');

/** Creates a minimal valid skill tar.gz archive */
async function createSkillArchive(
  overrides: Record<string, unknown> = {},
  archiveName = 'test-skill-1.0.0.tar.gz'
): Promise<string> {
  const skillJson = {
    id: 'test-skill',
    name: 'Test Skill',
    description: 'A test skill for testing',
    version: '1.0.0',
    category: 'development',
    assignableRoles: ['developer'],
    tags: ['test'],
    author: 'Test Author',
    license: 'MIT',
    ...overrides,
  };

  const srcDir = path.join(TEMP_ROOT, `skill-src-${Date.now()}`);
  const skillDirName = (skillJson.id as string) || 'test-skill';
  const skillDir = path.join(srcDir, skillDirName);
  await mkdir(skillDir, { recursive: true });

  await writeFile(path.join(skillDir, 'skill.json'), JSON.stringify(skillJson));
  await writeFile(path.join(skillDir, 'execute.sh'), '#!/bin/bash\necho "test"');
  await writeFile(path.join(skillDir, 'instructions.md'), '# Test Skill');

  const archivePath = path.join(TEMP_ROOT, archiveName);
  await tar.c(
    { gzip: true, file: archivePath, cwd: srcDir },
    [skillDirName]
  );

  return archivePath;
}

/** Clears submissions manifest and directory between tests */
async function clearSubmissions(): Promise<void> {
  if (existsSync(SUBMISSIONS_DIR)) {
    await rm(SUBMISSIONS_DIR, { recursive: true, force: true });
  }
  await mkdir(SUBMISSIONS_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearSubmissions();
});

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('loadSubmissionsManifest', () => {
  it('returns empty manifest when file does not exist', async () => {
    const manifest = await loadSubmissionsManifest();
    expect(manifest).toEqual({ schemaVersion: 1, submissions: [] });
  });

  it('loads existing manifest from disk', async () => {
    const existing = {
      schemaVersion: 1,
      submissions: [{ id: 'test', skillId: 'x', status: 'pending' }],
    };
    await writeFile(SUBMISSIONS_MANIFEST, JSON.stringify(existing));

    const manifest = await loadSubmissionsManifest();
    expect(manifest.submissions).toHaveLength(1);
    expect(manifest.submissions[0].skillId).toBe('x');
  });
});

describe('saveSubmissionsManifest', () => {
  it('writes manifest to disk', async () => {
    const manifest = { schemaVersion: 1, submissions: [] };
    await saveSubmissionsManifest(manifest);
    expect(existsSync(SUBMISSIONS_MANIFEST)).toBe(true);

    const data = JSON.parse(await readFile(SUBMISSIONS_MANIFEST, 'utf-8'));
    expect(data.schemaVersion).toBe(1);
  });
});

describe('submitSkill', () => {
  it('successfully submits a valid skill archive', async () => {
    const archivePath = await createSkillArchive();
    const result = await submitSkill(archivePath);

    expect(result.success).toBe(true);
    expect(result.message).toContain('submitted for review');
    expect(result.submission).toBeDefined();
    expect(result.submission?.skillId).toBe('test-skill');
    expect(result.submission?.status).toBe('pending');
    expect(result.submission?.name).toBe('Test Skill');
    expect(result.submission?.author).toBe('Test Author');
  });

  it('rejects non-existent archive', async () => {
    const result = await submitSkill('/nonexistent/path.tar.gz');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects non-tar.gz file', async () => {
    const fakePath = path.join(TEMP_ROOT, 'not-a-tarball.zip');
    await writeFile(fakePath, 'not a tarball');

    const result = await submitSkill(fakePath);
    expect(result.success).toBe(false);
    expect(result.message).toContain('.tar.gz');
  });

  it('rejects archive with invalid skill ID', async () => {
    const archivePath = await createSkillArchive(
      { id: 'INVALID_ID' },
      'invalid-id-1.0.0.tar.gz'
    );
    const result = await submitSkill(archivePath);

    expect(result.success).toBe(false);
    expect(result.message).toContain('kebab-case');
  });

  it('rejects archive missing required fields', async () => {
    // Create a minimal archive without version, assignableRoles, tags
    const srcDir = path.join(TEMP_ROOT, `bad-skill-${Date.now()}`);
    const skillDir = path.join(srcDir, 'bad-skill');
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, 'skill.json'), JSON.stringify({
      id: 'bad-skill',
      name: 'Bad',
    }));
    await writeFile(path.join(skillDir, 'execute.sh'), '#!/bin/bash');
    await writeFile(path.join(skillDir, 'instructions.md'), '# Bad');

    const archivePath = path.join(TEMP_ROOT, 'bad-skill-1.0.0.tar.gz');
    await tar.c({ gzip: true, file: archivePath, cwd: srcDir }, ['bad-skill']);

    const result = await submitSkill(archivePath);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Validation failed');
  });

  it('rejects duplicate pending submission', async () => {
    const archivePath = await createSkillArchive({}, 'dup1.tar.gz');
    await submitSkill(archivePath);

    const archivePath2 = await createSkillArchive({}, 'dup2.tar.gz');
    const result = await submitSkill(archivePath2);

    expect(result.success).toBe(false);
    expect(result.message).toContain('already has a pending submission');
  });

  it('stores archive copy in submissions directory', async () => {
    const archivePath = await createSkillArchive();
    await submitSkill(archivePath);

    const storedPath = path.join(SUBMISSIONS_DIR, 'test-skill-1.0.0.tar.gz');
    expect(existsSync(storedPath)).toBe(true);
  });
});

describe('listSubmissions', () => {
  it('returns all submissions', async () => {
    const archivePath = await createSkillArchive();
    await submitSkill(archivePath);

    const submissions = await listSubmissions();
    expect(submissions).toHaveLength(1);
  });

  it('filters by status', async () => {
    const archivePath = await createSkillArchive();
    await submitSkill(archivePath);

    const pending = await listSubmissions('pending');
    expect(pending).toHaveLength(1);

    const approved = await listSubmissions('approved');
    expect(approved).toHaveLength(0);
  });
});

describe('getSubmission', () => {
  it('returns submission by ID', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    const submission = await getSubmission(id);
    expect(submission).not.toBeNull();
    expect(submission?.skillId).toBe('test-skill');
  });

  it('returns null for non-existent ID', async () => {
    const submission = await getSubmission('nonexistent');
    expect(submission).toBeNull();
  });
});

describe('reviewSubmission', () => {
  it('approves a pending submission', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    const result = await reviewSubmission(id, 'approve');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Approved');

    const submission = await getSubmission(id);
    expect(submission?.status).toBe('approved');
    expect(submission?.reviewedAt).toBeDefined();
  });

  it('rejects a pending submission with notes', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    const result = await reviewSubmission(id, 'reject', 'Needs tests');
    expect(result.success).toBe(true);
    expect(result.message).toContain('Rejected');

    const submission = await getSubmission(id);
    expect(submission?.status).toBe('rejected');
    expect(submission?.reviewNotes).toBe('Needs tests');
  });

  it('fails for non-existent submission', async () => {
    const result = await reviewSubmission('nonexistent', 'approve');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('fails for already-reviewed submission', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    await reviewSubmission(id, 'approve');
    const result = await reviewSubmission(id, 'reject');
    expect(result.success).toBe(false);
    expect(result.message).toContain('already');
  });

  it('creates local registry entry on approval', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    await reviewSubmission(id, 'approve');

    const localRegistryPath = path.join(TEMP_ROOT, '.crewly', 'marketplace', 'local-registry.json');
    expect(existsSync(localRegistryPath)).toBe(true);

    const registry = JSON.parse(await readFile(localRegistryPath, 'utf-8'));
    expect(registry.items).toHaveLength(1);
    expect(registry.items[0].id).toBe('test-skill');
    expect(registry.items[0].type).toBe('skill');
    expect(registry.items[0].name).toBe('Test Skill');
  });

  it('copies archive to assets directory on approval', async () => {
    const archivePath = await createSkillArchive();
    const submitResult = await submitSkill(archivePath);
    const id = submitResult.submission!.id;

    await reviewSubmission(id, 'approve');

    const assetsPath = path.join(
      TEMP_ROOT, '.crewly', 'marketplace', 'assets', 'skills', 'test-skill', 'test-skill-1.0.0.tar.gz'
    );
    expect(existsSync(assetsPath)).toBe(true);
  });
});
