/**
 * CLI Publish Command
 *
 * Validates, packages, and generates registry metadata for a skill package.
 * Produces a tar.gz archive and prints the registry entry JSON.
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

/** Options for the publish command */
interface PublishOptions {
  /** If true, only validate without creating archive */
  dryRun?: boolean;
  /** Output directory for the archive (defaults to cwd) */
  output?: string;
}

/**
 * Publishes a skill package by validating, archiving, and generating metadata.
 *
 * In dry-run mode, only validation is performed and results are printed.
 * In normal mode, creates a tar.gz archive and prints the registry entry JSON.
 *
 * @param skillPath - Path to the skill directory
 * @param options - Command options (--dry-run, --output)
 */
export async function publishCommand(skillPath?: string, options?: PublishOptions): Promise<void> {
  if (!skillPath) {
    console.log(chalk.red('Please specify the path to a skill directory.'));
    console.log(chalk.gray('Example: crewly publish config/skills/agent/my-skill'));
    console.log(chalk.gray('         crewly publish config/skills/agent/my-skill --dry-run'));
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

  console.log(chalk.green('\nDone!'));
}
