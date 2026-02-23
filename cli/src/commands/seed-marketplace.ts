/**
 * CLI Seed Marketplace Command
 *
 * Packages selected built-in skills and adds them to the local marketplace
 * registry so they appear as installable items in the marketplace UI.
 *
 * This creates tar.gz archives, stores them in the local assets directory,
 * and adds registry entries for each skill.
 *
 * @module cli/commands/seed-marketplace
 */

import path from 'path';
import { homedir } from 'os';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, mkdir, copyFile, rm } from 'fs/promises';
import chalk from 'chalk';
import { createSkillArchive, generateChecksum, generateRegistryEntry } from '../utils/archive-creator.js';
import { validatePackage } from '../utils/package-validator.js';
import type { SkillManifest } from '../utils/package-validator.js';
import type { RegistryEntry } from '../utils/archive-creator.js';
import { MARKETPLACE_CONSTANTS } from '../../../config/constants.js';

/** Marketplace directory path */
const MARKETPLACE_DIR = path.join(homedir(), '.crewly', MARKETPLACE_CONSTANTS.DIR_NAME);
const LOCAL_REGISTRY_PATH = path.join(MARKETPLACE_DIR, MARKETPLACE_CONSTANTS.LOCAL_REGISTRY_FILE);
const ASSETS_DIR = path.join(MARKETPLACE_DIR, 'assets');

/**
 * Built-in skills suitable for marketplace publishing.
 *
 * These are general-purpose skills that would be useful to other
 * Crewly users and are not tightly coupled to internal orchestration.
 */
const PUBLISHABLE_SKILLS = [
  'bug-triage',
  'chrome-browser',
  'code-review',
  'computer-use',
  'daily-standup-report',
  'dep-updater',
  'email-responder',
  'env-setup-checker',
  'feedback-analyzer',
  'git-commit-helper',
  'marketplace-publish',
  'nano-banana-image',
  'playwright-chrome-browser',
  'readme-generator',
  'rednote-reader',
  'send-pdf-to-slack',
  'seo-blog-writer',
  'social-media-post',
  'test-runner',
];

/** Options for the seed command */
interface SeedOptions {
  /** Only validate, don't package */
  dryRun?: boolean;
  /** Skills directory to package from (defaults to config/skills/agent) */
  skillsDir?: string;
}

/**
 * Seeds the marketplace with built-in skills by packaging them and
 * adding registry entries.
 *
 * @param options - Command options
 * @throws Error if the skills directory does not exist
 */
export async function seedMarketplaceCommand(options?: SeedOptions): Promise<void> {
  const projectRoot = process.cwd();
  const skillsDir = options?.skillsDir || path.join(projectRoot, 'config', 'skills', 'agent', 'marketplace');

  if (!existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }

  console.log(chalk.blue('Seeding marketplace with built-in skills...\n'));

  // Load existing local registry
  let registry: { items: RegistryEntry[] };
  try {
    const data = readFileSync(LOCAL_REGISTRY_PATH, 'utf-8');
    registry = JSON.parse(data) as { items: RegistryEntry[] };
  } catch {
    registry = { items: [] };
  }

  const tmpDir = path.join(MARKETPLACE_DIR, 'tmp-seed');
  mkdirSync(tmpDir, { recursive: true });

  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const skillName of PUBLISHABLE_SKILLS) {
    const skillPath = path.join(skillsDir, skillName);

    if (!existsSync(skillPath)) {
      console.log(chalk.gray(`  - ${skillName}: not found, skipping`));
      skipped++;
      continue;
    }

    // Validate
    const validation = validatePackage(skillPath);
    if (!validation.valid) {
      console.log(chalk.yellow(`  ! ${skillName}: validation failed`));
      for (const err of validation.errors) {
        console.log(chalk.red(`      ${err}`));
      }
      failed++;
      continue;
    }

    // Check if already in registry
    const manifestRaw = readFileSync(path.join(skillPath, 'skill.json'), 'utf-8');
    const manifest = JSON.parse(manifestRaw) as SkillManifest;
    const existingEntry = registry.items.find((i) => i.id === manifest.id);

    if (existingEntry && existingEntry.version === manifest.version) {
      console.log(chalk.gray(`  - ${manifest.name} v${manifest.version}: already published`));
      skipped++;
      continue;
    }

    if (options?.dryRun) {
      console.log(chalk.green(`  + ${manifest.name} v${manifest.version}: would publish`));
      published++;
      continue;
    }

    // Create archive
    try {
      const archivePath = await createSkillArchive(skillPath, tmpDir);
      const checksum = generateChecksum(archivePath);
      const entry = generateRegistryEntry(manifest, archivePath, checksum);

      // Move archive to assets directory
      const assetDir = path.join(ASSETS_DIR, 'skills', manifest.id);
      await mkdir(assetDir, { recursive: true });

      const archiveName = path.basename(archivePath);
      const assetPath = path.join(assetDir, archiveName);
      await copyFile(archivePath, assetPath);

      // Update entry to use local asset path
      entry.assets.archive = `skills/${manifest.id}/${archiveName}`;

      // Remove existing entry and add new one
      registry.items = registry.items.filter((i) => i.id !== manifest.id);
      registry.items.push(entry);

      console.log(chalk.green(`  + ${manifest.name} v${manifest.version}: published`));
      published++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`  x ${manifest.name}: ${msg}`));
      failed++;
    }
  }

  if (!options?.dryRun && published > 0) {
    // Write updated registry
    await mkdir(MARKETPLACE_DIR, { recursive: true });
    await writeFile(LOCAL_REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  }

  // Cleanup tmp
  await rm(tmpDir, { recursive: true, force: true });

  console.log(chalk.blue(`\nSummary: ${published} published, ${skipped} skipped, ${failed} failed`));

  if (published > 0 && !options?.dryRun) {
    console.log(chalk.green(`\nLocal registry updated at ${LOCAL_REGISTRY_PATH}`));
    console.log(chalk.gray('Skills will appear in the marketplace on next refresh.'));
  }
}
