/**
 * "Carry the repository": move a git repository inside the encrypted package as
 * a `git bundle`, for repositories the target cannot fetch.
 *
 * Two modes:
 * - `full`     the repository has no remote. `git bundle create --all` holds
 *              every branch, tag and commit; the target builds a repository
 *              from it (no remote is configured there either).
 * - `unpushed` the repository has a remote but local commits the remote lacks.
 *              The bundle holds only those commits (it has the remote's commits
 *              as prerequisites); the target clones the remote first and then
 *              fetches the bundle on top.
 *
 * Bundles can be large (hundreds of MB): `git` writes them straight into the
 * staging directory and every later step (hashing, tar, encryption, chunked
 * upload, extraction) streams. Nothing here reads a bundle into memory.
 *
 * @module services/team-move/team-move-bundle
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { git } from './team-move-git.js';
import type { RestoreRepoResult } from './team-move-git.js';

const execFileAsync = promisify(execFile);
const C = TEAM_MOVE_CONSTANTS;

/** How a repository travels. */
export type BundleMode = 'full' | 'unpushed';

/** Size caps of bundles. */
export interface BundleLimits {
  /** One repository's bundle. */
  repoBytes: number;
  /** All bundles of one move. */
  totalBytes: number;
}

/**
 * The bundle caps: constants, overridable in megabytes by
 * `CREWLY_TEAM_MOVE_BUNDLE_MAX_MB` (one repository) and
 * `CREWLY_TEAM_MOVE_BUNDLES_MAX_MB` (all together).
 *
 * @param env - Environment to read overrides from
 * @returns The caps in bytes
 */
export function resolveBundleLimits(env: NodeJS.ProcessEnv = process.env): BundleLimits {
  const mb = (name: string, fallback: number): number => {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n * 1024 * 1024) : fallback;
  };
  return { repoBytes: mb(C.BUNDLE_REPO_MAX_MB_ENV, C.BUNDLE_REPO_MAX_BYTES), totalBytes: mb(C.BUNDLES_MAX_MB_ENV, C.BUNDLES_MAX_BYTES) };
}

/**
 * Human size for owner-facing text.
 *
 * @param bytes - Size in bytes
 * @returns `842 MB`, `1.2 GB`, ...
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Upper-bound estimate of a full bundle: the repository's object store
 * (loose objects plus packs, `git count-objects -v`). A bundle holds the same
 * objects in one pack, usually a bit smaller.
 *
 * @param repoPath - Repository folder
 * @returns Bytes, or null when git cannot say
 */
export async function estimateRepoBytes(repoPath: string): Promise<number | null> {
  try {
    const out = await git(repoPath, ['count-objects', '-v']);
    let kib = 0;
    for (const line of out.split('\n')) {
      const m = /^(size|size-pack):\s*(\d+)/.exec(line.trim());
      if (m) kib += Number(m[2]);
    }
    return kib * 1024;
  } catch {
    return null;
  }
}

/** Result of {@link createBundle}. */
export type CreateBundleResult = { ok: true; bytes: number; refs: number } | { ok: false; reason: string };

/**
 * Write a bundle straight to `outFile`.
 *
 * @param repoPath - Repository folder
 * @param outFile - Destination (its folder is created); removed again on failure
 * @param mode - `full` (everything) or `unpushed` (HEAD and branches not on any remote)
 * @param maxBytes - Refuse (and remove the file) when the bundle is larger
 * @returns Size and number of refs, or why it failed (never throws)
 */
export async function createBundle(repoPath: string, outFile: string, mode: BundleMode, maxBytes: number): Promise<CreateBundleResult> {
  try {
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    const refs = mode === 'full' ? ['--all'] : ['HEAD', '--branches', '--not', '--remotes'];
    await execFileAsync('git', ['-C', repoPath, 'bundle', 'create', '-q', outFile, ...refs], {
      timeout: C.BUNDLE_TIMEOUT_MS,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      maxBuffer: 4 * 1024 * 1024,
    });
    const bytes = (await fs.stat(outFile)).size;
    if (bytes > maxBytes) {
      await fs.rm(outFile, { force: true });
      return { ok: false, reason: `the repository bundle is ${formatBytes(bytes)}, over the ${formatBytes(maxBytes)} limit (raise ${C.BUNDLE_REPO_MAX_MB_ENV} / ${C.BUNDLES_MAX_MB_ENV} to allow it)` };
    }
    const heads = await git(repoPath, ['bundle', 'list-heads', outFile]).catch(() => '');
    return { ok: true, bytes, refs: heads.split('\n').filter(Boolean).length };
  } catch (error) {
    await fs.rm(outFile, { force: true }).catch(() => undefined);
    const e = error as { stderr?: string; message?: string };
    const text = (e.stderr?.trim() || e.message || 'git bundle failed').split('\n').slice(0, 2).join(' | ');
    return { ok: false, reason: /empty bundle/i.test(text) ? 'the repository has no commits to carry' : text };
  }
}

/**
 * Fetch a bundle's branches and tags into a repository and put the recorded
 * branch at the recorded commit. Never prompts and never leaves the bundle's
 * path configured as a remote.
 *
 * @param dest - Repository folder on the target (must be a git repository)
 * @param bundleFile - The bundle
 * @param repo - Recorded branch and head
 * @param timeoutMs - Per git call
 * @returns Result (never throws)
 */
export async function applyBundle(
  dest: string,
  bundleFile: string,
  repo: { branch: string | null; headSha: string | null },
  timeoutMs: number = C.GIT_TIMEOUT_MS,
): Promise<RestoreRepoResult> {
  const warnings: string[] = [];
  try {
    await git(dest, ['fetch', '-q', '--update-head-ok', bundleFile, '+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*'], timeoutMs);
    const has = async (rev: string): Promise<boolean> => git(dest, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).then(() => true, () => false);
    const headOk = repo.headSha ? await has(repo.headSha) : false;
    if (repo.headSha && !headOk) warnings.push(`recorded commit ${repo.headSha.slice(0, 8)} is not in the bundle`);
    if (repo.branch && (await has(`refs/heads/${repo.branch}`))) {
      await git(dest, ['checkout', '-q', '-f', '-B', repo.branch, headOk ? repo.headSha! : `refs/heads/${repo.branch}`]);
    } else if (headOk) {
      await git(dest, ['checkout', '-q', '-f', '--detach', repo.headSha!]);
      if (repo.branch) warnings.push(`branch ${repo.branch} is not in the bundle; checked out the recorded commit`);
    } else {
      warnings.push('no branch or commit could be checked out from the bundle');
    }
    const branch = await git(dest, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '');
    return { ok: true, branch: branch || null, headSha: await git(dest, ['rev-parse', 'HEAD']).catch(() => '') || null, warnings };
  } catch (error) {
    return { ok: false, branch: null, headSha: null, warnings, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Build a repository from a `full` bundle in a folder that may already hold
 * Crewly's `.crewly/` data (the equivalent of `git clone <bundle>`, but into a
 * non-empty folder and keeping every branch as a local branch). The bundle is
 * not removed here.
 *
 * @param dest - Project folder on the target (created when missing)
 * @param bundleFile - The bundle
 * @param repo - Recorded branch and head
 * @param timeoutMs - Per git call
 * @returns Result (never throws)
 */
export async function restoreFromBundle(
  dest: string,
  bundleFile: string,
  repo: { branch: string | null; headSha: string | null },
  timeoutMs: number = C.GIT_TIMEOUT_MS,
): Promise<RestoreRepoResult> {
  try {
    await fs.mkdir(dest, { recursive: true });
    const hasGit = await fs.stat(path.join(dest, '.git')).then(() => true, () => false);
    if (!hasGit) await git(dest, ['init', '-q']);
  } catch (error) {
    return { ok: false, branch: null, headSha: null, warnings: [], error: error instanceof Error ? error.message : String(error) };
  }
  return applyBundle(dest, bundleFile, repo, timeoutMs);
}
