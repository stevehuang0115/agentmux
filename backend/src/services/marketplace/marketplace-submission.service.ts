/**
 * Marketplace Submission Service
 *
 * Handles skill submissions to the marketplace, including validation,
 * archive storage, and review workflow management.
 *
 * Submissions are stored locally in ~/.crewly/marketplace/submissions/
 * with a manifest.json tracking all submissions and their status.
 *
 * @module services/marketplace/marketplace-submission.service
 */

import path from 'path';
import { homedir } from 'os';
import { mkdir, readFile, writeFile, copyFile, rm } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import { randomUUID } from 'crypto';
import type {
  MarketplaceSubmission,
  SubmissionsManifest,
  SubmissionStatus,
  MarketplaceItem,
  MarketplaceOperationResult,
} from '../../types/marketplace.types.js';
import { fetchRegistry } from './marketplace.service.js';

const MARKETPLACE_DIR = path.join(homedir(), '.crewly', 'marketplace');
const SUBMISSIONS_DIR = path.join(MARKETPLACE_DIR, 'submissions');
const SUBMISSIONS_MANIFEST_PATH = path.join(SUBMISSIONS_DIR, 'manifest.json');

/** Required files in a submitted skill package */
const REQUIRED_SKILL_FILES = ['skill.json', 'execute.sh', 'instructions.md'];

/** Kebab-case pattern for skill IDs */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Semver pattern (major.minor.patch) */
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Loads the submissions manifest from disk.
 *
 * Returns an empty manifest if the file does not exist or is unparsable.
 *
 * @returns The submissions manifest
 */
export async function loadSubmissionsManifest(): Promise<SubmissionsManifest> {
  try {
    const data = await readFile(SUBMISSIONS_MANIFEST_PATH, 'utf-8');
    return JSON.parse(data) as SubmissionsManifest;
  } catch {
    return { schemaVersion: 1, submissions: [] };
  }
}

/**
 * Saves the submissions manifest to disk.
 *
 * Creates the submissions directory if it does not exist.
 *
 * @param manifest - The manifest to persist
 */
export async function saveSubmissionsManifest(manifest: SubmissionsManifest): Promise<void> {
  await mkdir(SUBMISSIONS_DIR, { recursive: true });
  await writeFile(SUBMISSIONS_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Validates a skill.json manifest from a submitted archive.
 *
 * @param manifest - Parsed skill.json content
 * @returns Array of validation error messages (empty if valid)
 */
function validateSkillManifest(manifest: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('skill.json missing required field: id');
  } else if (!KEBAB_CASE_RE.test(manifest.id as string)) {
    errors.push(`skill.json id must be kebab-case: "${manifest.id}"`);
  }

  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('skill.json missing required field: name');
  }

  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('skill.json missing required field: description');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('skill.json missing required field: version');
  } else if (!SEMVER_RE.test(manifest.version as string)) {
    errors.push(`skill.json version must be semver (x.y.z): "${manifest.version}"`);
  }

  if (!manifest.category || typeof manifest.category !== 'string') {
    errors.push('skill.json missing required field: category');
  }

  if (!Array.isArray(manifest.assignableRoles) || (manifest.assignableRoles as unknown[]).length === 0) {
    errors.push('skill.json must have a non-empty assignableRoles array');
  }

  if (!Array.isArray(manifest.tags) || (manifest.tags as unknown[]).length === 0) {
    errors.push('skill.json must have a non-empty tags array');
  }

  return errors;
}

/**
 * Submits a skill package (tar.gz archive) to the marketplace for review.
 *
 * Performs the following steps:
 * 1. Verifies the archive exists and is a tar.gz
 * 2. Extracts and validates skill.json from the archive
 * 3. Checks for duplicate submissions
 * 4. Stores the archive in the submissions directory
 * 5. Creates a submission record in the manifest
 *
 * @param archivePath - Path to the tar.gz archive to submit
 * @returns Operation result with the submission record
 */
export async function submitSkill(archivePath: string): Promise<MarketplaceOperationResult & { submission?: MarketplaceSubmission }> {
  try {
    if (!existsSync(archivePath)) {
      return { success: false, message: `Archive not found: ${archivePath}` };
    }

    if (!archivePath.endsWith('.tar.gz')) {
      return { success: false, message: 'Archive must be a .tar.gz file' };
    }

    // Extract and validate skill.json from the archive
    const archiveData = await readFile(archivePath);

    // Compute checksum
    const hash = createHash('sha256').update(archiveData).digest('hex');
    const checksum = `sha256:${hash}`;

    // Extract skill.json from the archive to validate
    let skillManifest: Record<string, unknown>;
    try {
      skillManifest = await extractSkillJson(archivePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Invalid skill archive: ${msg}` };
    }

    // Validate skill.json
    const validationErrors = validateSkillManifest(skillManifest);
    if (validationErrors.length > 0) {
      return { success: false, message: `Validation failed: ${validationErrors.join('; ')}` };
    }

    const skillId = skillManifest.id as string;

    // Check for duplicate submissions
    const manifest = await loadSubmissionsManifest();
    const existing = manifest.submissions.find(
      (s) => s.skillId === skillId && s.status === 'pending'
    );
    if (existing) {
      return { success: false, message: `Skill "${skillId}" already has a pending submission` };
    }

    // Store the archive
    await mkdir(SUBMISSIONS_DIR, { recursive: true });
    const storedArchiveName = `${skillId}-${skillManifest.version as string}.tar.gz`;
    const storedArchivePath = path.join(SUBMISSIONS_DIR, storedArchiveName);
    await copyFile(archivePath, storedArchivePath);

    // Create submission record
    const submission: MarketplaceSubmission = {
      id: randomUUID(),
      skillId,
      name: skillManifest.name as string,
      description: skillManifest.description as string,
      author: (skillManifest.author as string) || 'Community',
      version: skillManifest.version as string,
      category: skillManifest.category as string,
      tags: skillManifest.tags as string[],
      license: (skillManifest.license as string) || 'MIT',
      status: 'pending',
      archivePath: storedArchivePath,
      checksum,
      sizeBytes: archiveData.length,
      metadata: {
        assignableRoles: skillManifest.assignableRoles,
        triggers: skillManifest.triggers || [],
      },
      submittedAt: new Date().toISOString(),
    };

    manifest.submissions.push(submission);
    await saveSubmissionsManifest(manifest);

    return {
      success: true,
      message: `Skill "${submission.name}" submitted for review`,
      submission,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Submission failed: ${msg}` };
  }
}

/**
 * Lists all submissions, optionally filtered by status.
 *
 * @param status - Optional status filter
 * @returns Array of submissions
 */
export async function listSubmissions(status?: SubmissionStatus): Promise<MarketplaceSubmission[]> {
  const manifest = await loadSubmissionsManifest();
  if (status) {
    return manifest.submissions.filter((s) => s.status === status);
  }
  return manifest.submissions;
}

/**
 * Gets a single submission by ID.
 *
 * @param id - Submission ID
 * @returns The submission, or null if not found
 */
export async function getSubmission(id: string): Promise<MarketplaceSubmission | null> {
  const manifest = await loadSubmissionsManifest();
  return manifest.submissions.find((s) => s.id === id) || null;
}

/**
 * Reviews a submission — approving or rejecting it.
 *
 * When approved, the skill is added to the local registry and becomes
 * available for installation. When rejected, the archive is removed.
 *
 * @param id - Submission ID
 * @param action - 'approve' or 'reject'
 * @param notes - Optional review notes
 * @returns Operation result
 */
export async function reviewSubmission(
  id: string,
  action: 'approve' | 'reject',
  notes?: string
): Promise<MarketplaceOperationResult> {
  const manifest = await loadSubmissionsManifest();
  const submission = manifest.submissions.find((s) => s.id === id);

  if (!submission) {
    return { success: false, message: `Submission not found: ${id}` };
  }

  if (submission.status !== 'pending') {
    return { success: false, message: `Submission already ${submission.status}` };
  }

  const newStatus: SubmissionStatus = action === 'approve' ? 'approved' : 'rejected';
  submission.status = newStatus;
  submission.reviewedAt = new Date().toISOString();
  submission.reviewNotes = notes;

  if (action === 'approve') {
    // Add to local registry by creating the item in the assets directory
    const assetsDir = path.join(MARKETPLACE_DIR, 'assets', 'skills', submission.skillId);
    await mkdir(assetsDir, { recursive: true });
    const assetArchiveName = `${submission.skillId}-${submission.version}.tar.gz`;
    const assetPath = path.join(assetsDir, assetArchiveName);

    if (existsSync(submission.archivePath)) {
      await copyFile(submission.archivePath, assetPath);
    }

    // Add to local registry file
    await addToLocalRegistry(submission, assetArchiveName);
  } else {
    // Remove archive for rejected submissions
    if (existsSync(submission.archivePath)) {
      await rm(submission.archivePath, { force: true });
    }
  }

  await saveSubmissionsManifest(manifest);

  return {
    success: true,
    message: action === 'approve'
      ? `Approved "${submission.name}" — now available in marketplace`
      : `Rejected "${submission.name}"`,
  };
}

/**
 * Adds an approved submission to the local registry file.
 *
 * The local registry augments the remote registry so that locally
 * published skills appear in the marketplace alongside remote ones.
 *
 * @param submission - The approved submission
 * @param archiveFilename - Name of the archive file in assets/
 */
async function addToLocalRegistry(
  submission: MarketplaceSubmission,
  archiveFilename: string
): Promise<void> {
  const localRegistryPath = path.join(MARKETPLACE_DIR, 'local-registry.json');

  let registry: { items: MarketplaceItem[] };
  try {
    const data = await readFile(localRegistryPath, 'utf-8');
    registry = JSON.parse(data) as { items: MarketplaceItem[] };
  } catch {
    registry = { items: [] };
  }

  // Remove any existing entry for this skill
  registry.items = registry.items.filter((i) => i.id !== submission.skillId);

  // Add the new entry
  const item: MarketplaceItem = {
    id: submission.skillId,
    type: 'skill',
    name: submission.name,
    description: submission.description,
    author: submission.author,
    version: submission.version,
    category: submission.category as MarketplaceItem['category'],
    tags: submission.tags,
    license: submission.license,
    downloads: 0,
    rating: 0,
    createdAt: submission.submittedAt,
    updatedAt: submission.reviewedAt || submission.submittedAt,
    assets: {
      archive: `skills/${submission.skillId}/${archiveFilename}`,
      checksum: submission.checksum,
      sizeBytes: submission.sizeBytes,
    },
    metadata: submission.metadata,
  };

  registry.items.push(item);
  await writeFile(localRegistryPath, JSON.stringify(registry, null, 2) + '\n');
}

/**
 * Extracts and parses skill.json from a tar.gz archive.
 *
 * Handles archives with various prefix structures (skill-id/skill.json,
 * skill-name/skill.json, or flat skill.json).
 *
 * @param archivePath - Path to the tar.gz archive
 * @returns Parsed skill.json content
 * @throws Error if skill.json is not found or invalid
 */
async function extractSkillJson(archivePath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let found = false;
    const chunks: Buffer[] = [];

    const extract = tar.t({
      file: archivePath,
      onReadEntry: (entry) => {
        const entryPath = entry.path;
        // Match skill.json at any level
        if (entryPath.endsWith('skill.json') && !found) {
          found = true;
          entry.on('data', (chunk: Buffer) => chunks.push(chunk));
          entry.on('end', () => {
            try {
              const content = Buffer.concat(chunks).toString('utf-8');
              resolve(JSON.parse(content) as Record<string, unknown>);
            } catch (err) {
              reject(new Error(`Invalid JSON in skill.json: ${err instanceof Error ? err.message : String(err)}`));
            }
          });
        }
      },
    });

    extract.then(() => {
      if (!found) {
        reject(new Error('skill.json not found in archive'));
      }
    }).catch(reject);
  });
}
