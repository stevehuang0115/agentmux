/**
 * CLI Publish Command
 *
 * Validates, packages, and submits a skill package to the marketplace.
 * Produces a tar.gz archive, generates metadata, and optionally submits
 * to the local Crewly backend for review and publishing.
 *
 * @module cli/commands/publish
 */

import path from 'path';
import { mkdirSync } from 'fs';
import chalk from 'chalk';
import { validatePackage } from '../utils/package-validator.js';
import { createSkillArchive, generateChecksum, generateRegistryEntry } from '../utils/archive-creator.js';
import type { SkillManifest } from '../utils/package-validator.js';
import { readFileSync } from 'fs';

/** Default backend URL for submission */
const DEFAULT_BACKEND_URL = 'http://localhost:3000';

/** Options for the publish command */
interface PublishOptions {
  /** If true, only validate without creating archive */
  dryRun?: boolean;
  /** Output directory for the archive (defaults to cwd) */
  output?: string;
  /** If true, submit the archive to the marketplace for review */
  submit?: boolean;
  /** Backend URL for submission (defaults to localhost:3000) */
  url?: string;
}

/**
 * Publishes a skill package by validating, archiving, and optionally
 * submitting to the marketplace for review.
 *
 * Modes:
 * - `--dry-run`: Only validates, no archive created
 * - Default: Creates archive and prints registry entry JSON
 * - `--submit`: Creates archive and submits to the Crewly backend
 *
 * @param skillPath - Path to the skill directory
 * @param options - Command options (--dry-run, --output, --submit, --url)
 */
export async function publishCommand(skillPath?: string, options?: PublishOptions): Promise<void> {
  if (!skillPath) {
    console.log(chalk.red('Please specify the path to a skill directory.'));
    console.log(chalk.gray('Example: crewly publish config/skills/agent/my-skill'));
    console.log(chalk.gray('         crewly publish config/skills/agent/my-skill --dry-run'));
    console.log(chalk.gray('         crewly publish config/skills/agent/my-skill --submit'));
    process.exit(1);
  }

  const absPath = path.resolve(skillPath);
  console.log(chalk.blue(`Validating skill at ${absPath}...`));

  // Validate
  const result = validatePackage(absPath);

  // Print warnings
  for (const warn of result.warnings) {
    console.log(chalk.yellow(`  ! ${warn}`));
  }

  // Print errors
  for (const err of result.errors) {
    console.log(chalk.red(`  ✗ ${err}`));
  }

  if (!result.valid) {
    console.log(chalk.red('\nValidation failed. Fix the errors above before publishing.'));
    process.exit(1);
  }

  console.log(chalk.green('  ✓ Validation passed'));

  if (options?.dryRun) {
    console.log(chalk.blue('\nDry run — no archive created.'));
    return;
  }

  // Create archive
  const outputDir = path.resolve(options?.output || '.');
  mkdirSync(outputDir, { recursive: true });

  console.log(chalk.blue('\nCreating archive...'));
  const archivePath = await createSkillArchive(absPath, outputDir);
  console.log(chalk.green(`  ✓ Archive: ${archivePath}`));

  // Generate checksum
  const checksum = generateChecksum(archivePath);
  console.log(chalk.green(`  ✓ Checksum: ${checksum}`));

  // Generate registry entry
  const manifestRaw = readFileSync(path.join(absPath, 'skill.json'), 'utf-8');
  const manifest = JSON.parse(manifestRaw) as SkillManifest;
  const entry = generateRegistryEntry(manifest, archivePath, checksum);

  console.log(chalk.blue('\nRegistry entry:'));
  console.log(JSON.stringify(entry, null, 2));

  // Submit to marketplace if --submit flag is set
  if (options?.submit) {
    const backendUrl = options.url || DEFAULT_BACKEND_URL;
    console.log(chalk.blue(`\nSubmitting to marketplace at ${backendUrl}...`));

    try {
      const response = await fetch(`${backendUrl}/api/marketplace/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivePath }),
      });

      const data = await response.json() as { success: boolean; message: string; submission?: { id: string } };

      if (data.success) {
        console.log(chalk.green(`  ✓ ${data.message}`));
        if (data.submission) {
          console.log(chalk.gray(`  Submission ID: ${data.submission.id}`));
        }
      } else {
        console.log(chalk.red(`  ✗ ${data.message}`));
        process.exit(1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`  ✗ Failed to submit: ${msg}`));
      console.log(chalk.gray('  Make sure Crewly backend is running (crewly start)'));
      process.exit(1);
    }
  }

  console.log(chalk.green('\nDone!'));
}
