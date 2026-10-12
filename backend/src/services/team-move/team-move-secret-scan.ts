/**
 * Secret scan of a package before it leaves the machine.
 *
 * Runs the same detectors as the session-log redactor (token shapes such as
 * Slack, OpenAI/Anthropic, GitHub, Google keys, JWTs, bearer headers, private
 * key blocks, connection strings and `SECRET_NAME=value` assignments) plus the
 * exact secret values this machine holds in its environment and settings. It
 * reports file paths and pattern counts only, never a matched value.
 *
 * @module services/team-move/team-move-secret-scan
 */

import * as fs from 'node:fs/promises';
import { redactSecretsWithCount } from '../../utils/secret-redactor.js';
import type { SecretEnvValue } from '../../utils/secret-env.js';
import { looksLikeText } from './team-move-fs.js';
import type { PackageFileEntry } from './team-move.types.js';
import type { StagingArea } from './team-move-fs.js';

/** Window read at a time (text is scanned in overlapping windows). */
const WINDOW_BYTES = 1024 * 1024;
/** Overlap between windows so a secret cut by a boundary is still seen. */
const OVERLAP_BYTES = 1024;

/** One file that holds secrets. */
export interface SecretFinding {
  /** Package path. */
  path: string;
  /** Number of secret matches (values are never returned). */
  matches: number;
}

/** Result of a scan. */
export interface SecretScanResult {
  filesScanned: number;
  findings: SecretFinding[];
}

/** Thrown when a package would carry secrets. */
export class TeamMoveSecretScanError extends Error {
  constructor(readonly findings: SecretFinding[]) {
    super(
      `The secret scan found credentials in ${findings.length} file${findings.length === 1 ? '' : 's'}; nothing was sent. ` +
        `Remove them from: ${findings.slice(0, 10).map((f) => f.path).join(', ')}${findings.length > 10 ? ', ...' : ''}`,
    );
    this.name = 'TeamMoveSecretScanError';
  }
}

/**
 * Count secrets in one file.
 *
 * @param abs - Absolute file path
 * @param known - Exact secret values to look for
 * @returns Number of matches, 0 for binary files
 */
async function scanFile(abs: string, known: readonly SecretEnvValue[]): Promise<{ matches: number; scanned: boolean }> {
  const handle = await fs.open(abs, 'r');
  try {
    const stat = await handle.stat();
    const head = Buffer.alloc(Math.min(8192, stat.size));
    await handle.read(head, 0, head.length, 0);
    if (!looksLikeText(head)) return { matches: 0, scanned: false };
    let matches = 0;
    let position = 0;
    const buf = Buffer.alloc(WINDOW_BYTES + OVERLAP_BYTES);
    // Matches inside the overlap are seen by two windows; counting the first
    // window's tail once is enough, we only need "any", so double counts are fine.
    while (position < stat.size) {
      const { bytesRead } = await handle.read(buf, 0, buf.length, position);
      if (bytesRead === 0) break;
      matches += redactSecretsWithCount(buf.subarray(0, bytesRead).toString('utf8'), known).count;
      position += WINDOW_BYTES;
    }
    return { matches, scanned: true };
  } finally {
    await handle.close();
  }
}

/**
 * Scan every file of a staging area.
 *
 * @param staging - The package being built
 * @param files - Its files
 * @param known - Exact secret values (env, settings) to look for
 * @returns Files scanned and the findings
 */
export async function scanStaging(staging: StagingArea, files: readonly PackageFileEntry[], known: readonly SecretEnvValue[] = []): Promise<SecretScanResult> {
  const findings: SecretFinding[] = [];
  let filesScanned = 0;
  for (const f of files) {
    const { matches, scanned } = await scanFile(staging.abs(f.path), known);
    if (scanned) filesScanned += 1;
    if (matches > 0) findings.push({ path: f.path, matches });
  }
  return { filesScanned, findings };
}

/**
 * Whether a flagged file may be left out of the package instead of aborting.
 * Core records (the team config, task pool, decisions, chat records) can never
 * be skipped; free-form notes and project files can.
 *
 * @param packagePath - Package path of the flagged file
 * @returns True when skipping is allowed
 */
export function isSkippableFinding(packagePath: string): boolean {
  return (
    packagePath.startsWith('projects/') ||
    packagePath.startsWith('handover/') ||
    /^agents\/[^/]+\/sessions\//.test(packagePath) ||
    /^team\/(wiki|norms|sops)\//.test(packagePath)
  );
}
