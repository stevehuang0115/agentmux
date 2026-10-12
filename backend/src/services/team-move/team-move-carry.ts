/**
 * "Carry uncommitted changes": move a repository's unpushed work inside the
 * encrypted package instead of asking the owner to commit and push it.
 *
 * Collecting (source): the changes are expressed against a commit the remote
 * has (`baseSha`), so the target can fetch that commit itself. Tracked files
 * (edits, deletions, mode changes and binary files, including the content of
 * local commits the remote lacks) become one `git apply` patch per file;
 * untracked files that are not ignored travel as they are. Nothing is pushed,
 * committed or modified on the source.
 *
 * Applying (target): after the clone is put at `baseSha`, each patch is
 * applied to the working tree and untracked files are written next to it. The
 * result is the same working tree the source had, uncommitted.
 *
 * @module services/team-move/team-move-carry
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { git, gitBuffer } from './team-move-git.js';
import { writeFileAtomic } from './team-move-fs.js';
import type { CarryIndex } from './team-move.types.js';

const C = TEAM_MOVE_CONSTANTS;

/** Caps of one repository's carried changes. */
export interface CarryLimits {
  totalBytes: number;
  fileBytes: number;
  maxFiles: number;
}

/** Default caps (constants). */
export const DEFAULT_CARRY_LIMITS: CarryLimits = {
  totalBytes: C.CARRY_MAX_BYTES,
  fileBytes: C.CARRY_FILE_MAX_BYTES,
  maxFiles: C.CARRY_MAX_FILES,
};

/** Never part of carried work: Crewly's own data folder. */
const EXCLUDE_CREWLY = ':(exclude).crewly';

/** A change left on the source and why. */
export interface LeftChange {
  path: string;
  bytes: number;
  reason: 'too_large' | 'size_cap' | 'too_many' | 'unreadable' | 'symlink';
}

/** The changes of a repository, ready to be written into a package. */
export interface CollectedCarry {
  baseSha: string;
  branch: string | null;
  flattenedCommits: number;
  patches: Array<{ path: string; data: Buffer; deleted: boolean }>;
  untracked: Array<{ path: string; abs: string; size: number; executable: boolean }>;
  /** Total bytes of patches and untracked files. */
  bytes: number;
  /** Changes that could not be taken along (the repository cannot be carried while this is non-empty). */
  left: LeftChange[];
}

/** Outcome of {@link collectCarry}. */
export type CollectCarryResult = { ok: true; carry: CollectedCarry } | { ok: false; reason: string };

/**
 * The commit the remote has that the changes are expressed against: HEAD when
 * everything is pushed, otherwise the newest commit below the local-only ones.
 *
 * @param repoPath - Repository folder
 * @returns Base commit and the number of local-only commits
 * @throws Error when the repository has no commit or no remote branch to build on
 */
export async function findCarryBase(repoPath: string): Promise<{ baseSha: string; flattenedCommits: number }> {
  const head = (await git(repoPath, ['rev-parse', '--verify', 'HEAD']).catch(() => '')).trim();
  if (!head) throw new Error('the repository has no commits yet');
  const lines = (await git(repoPath, ['rev-list', '--boundary', 'HEAD', '--not', '--remotes']).catch(() => ''))
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const local = lines.filter((l) => !l.startsWith('-'));
  const boundary = lines.filter((l) => l.startsWith('-')).map((l) => l.slice(1));
  if (local.length === 0) return { baseSha: head, flattenedCommits: 0 };
  if (boundary.length === 0) throw new Error('no commit of this repository is on the remote');
  return { baseSha: boundary[0]!, flattenedCommits: local.length };
}

/**
 * Collect a repository's uncommitted and unpushed work.
 *
 * @param repoPath - Repository folder
 * @param limits - Size caps
 * @returns The changes, or why they cannot be carried (never throws)
 */
export async function collectCarry(repoPath: string, limits: CarryLimits = DEFAULT_CARRY_LIMITS): Promise<CollectCarryResult> {
  let base: { baseSha: string; flattenedCommits: number };
  try {
    base = await findCarryBase(repoPath);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  const branch = (await git(repoPath, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')) || null;
  const carry: CollectedCarry = { baseSha: base.baseSha, branch, flattenedCommits: base.flattenedCommits, patches: [], untracked: [], bytes: 0, left: [] };
  let files = 0;

  try {
    // Tracked files that differ from the base (staged or not), renames as delete + add.
    const names = (await gitBuffer(repoPath, ['diff', '--name-status', '-z', '--no-renames', base.baseSha, '--', '.', EXCLUDE_CREWLY]))
      .toString('utf8')
      .split('\0');
    for (let i = 0; i + 1 < names.length; i += 2) {
      const status = names[i]!;
      const file = names[i + 1]!;
      if (!status || !file) continue;
      if (files >= limits.maxFiles) {
        carry.left.push({ path: file, bytes: 0, reason: 'too_many' });
        continue;
      }
      let data: Buffer;
      try {
        data = await gitBuffer(repoPath, ['diff', '--binary', '--no-ext-diff', '--no-color', '--no-renames', base.baseSha, '--', `:(literal)${file}`], limits.fileBytes + 1024 * 1024);
      } catch (error) {
        const tooBig = error instanceof Error && error.message === 'output too large';
        carry.left.push({ path: file, bytes: 0, reason: tooBig ? 'too_large' : 'unreadable' });
        continue;
      }
      if (data.length > limits.fileBytes) carry.left.push({ path: file, bytes: data.length, reason: 'too_large' });
      else if (carry.bytes + data.length > limits.totalBytes) carry.left.push({ path: file, bytes: data.length, reason: 'size_cap' });
      else {
        carry.patches.push({ path: file, data, deleted: status.startsWith('D') });
        carry.bytes += data.length;
        files += 1;
      }
    }

    // Untracked files that are not ignored.
    const others = (await gitBuffer(repoPath, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', EXCLUDE_CREWLY])).toString('utf8').split('\0').filter(Boolean);
    for (const rel of others) {
      const abs = path.join(repoPath, ...rel.split('/'));
      const st = await fs.lstat(abs).catch(() => null);
      if (!st) continue;
      if (st.isSymbolicLink()) {
        carry.left.push({ path: rel, bytes: 0, reason: 'symlink' });
        continue;
      }
      if (!st.isFile()) continue;
      if (files >= limits.maxFiles) carry.left.push({ path: rel, bytes: st.size, reason: 'too_many' });
      else if (st.size > limits.fileBytes) carry.left.push({ path: rel, bytes: st.size, reason: 'too_large' });
      else if (carry.bytes + st.size > limits.totalBytes) carry.left.push({ path: rel, bytes: st.size, reason: 'size_cap' });
      else {
        carry.untracked.push({ path: rel, abs, size: st.size, executable: (st.mode & 0o111) !== 0 });
        carry.bytes += st.size;
        files += 1;
      }
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, carry };
}

/**
 * One line for the owner about why changes could not be carried.
 *
 * @param left - Changes that did not fit
 * @returns Sentence fragment
 */
export function describeLeft(left: readonly LeftChange[]): string {
  const count = (reason: LeftChange['reason']): number => left.filter((l) => l.reason === reason).length;
  const parts: string[] = [];
  if (count('too_large')) parts.push(`${count('too_large')} file${count('too_large') === 1 ? ' is' : 's are'} too large`);
  if (count('size_cap')) parts.push(`${count('size_cap')} more would exceed the size limit`);
  if (count('too_many')) parts.push(`${count('too_many')} more would exceed the file limit`);
  if (count('symlink')) parts.push(`${count('symlink')} symbolic link${count('symlink') === 1 ? '' : 's'}`);
  if (count('unreadable')) parts.push(`${count('unreadable')} could not be read`);
  return parts.join(', ');
}

/** Whether a repository-relative path may be written below a repository folder. */
export function isSafeRepoPath(rel: string): boolean {
  if (!rel || rel.startsWith('/') || rel.includes('\\') || rel.includes('\0')) return false;
  const segments = rel.split('/');
  return segments.every((s) => s !== '' && s !== '.' && s !== '..' && s.toLowerCase() !== '.git');
}

/** Outcome of {@link applyCarry}. */
export interface ApplyCarryResult {
  /** Patches applied. */
  applied: number;
  /** Untracked files written. */
  untracked: number;
  failed: Array<{ path: string; reason: string }>;
}

/**
 * Apply carried changes to a repository that is checked out at the base.
 *
 * Each file is independent: a patch that does not apply, or an untracked file
 * that already exists with other content, is reported and kept (patches under
 * `.crewly/move-carry-failed/`) so nothing is lost. Existing files are never
 * overwritten.
 *
 * @param repoPath - Repository folder on the target
 * @param carryDir - Folder holding `carry.json`, `patches/` and `files/`
 * @param index - The parsed `carry.json`
 * @returns What was applied and what failed
 */
export async function applyCarry(repoPath: string, carryDir: string, index: CarryIndex): Promise<ApplyCarryResult> {
  const result: ApplyCarryResult = { applied: 0, untracked: 0, failed: [] };
  const keepFailed = async (file: string, name: string): Promise<void> => {
    const keep = path.join(repoPath, '.crewly', 'move-carry-failed');
    await fs.mkdir(keep, { recursive: true }).catch(() => undefined);
    await fs.copyFile(file, path.join(keep, name)).catch(() => undefined);
  };

  for (const patch of index.patches) {
    const file = path.join(carryDir, ...patch.file.split('/'));
    if (!isSafeRepoPath(patch.path)) {
      result.failed.push({ path: patch.path, reason: 'unsafe path' });
      continue;
    }
    try {
      await git(repoPath, ['apply', '--binary', '--whitespace=nowarn', file], 120_000);
      result.applied += 1;
    } catch (error) {
      // A rerun after a crash: the patch is already in the working tree.
      if (await git(repoPath, ['apply', '--reverse', '--check', '--binary', file]).then(() => true, () => false)) {
        result.applied += 1;
        continue;
      }
      result.failed.push({ path: patch.path, reason: `does not apply (${error instanceof Error ? error.message : String(error)})`.slice(0, 200) });
      await keepFailed(file, `${path.basename(patch.file)}`);
    }
  }

  for (const item of index.untracked) {
    const src = path.join(carryDir, ...item.file.split('/'));
    if (!isSafeRepoPath(item.path)) {
      result.failed.push({ path: item.path, reason: 'unsafe path' });
      continue;
    }
    const dest = path.join(repoPath, ...item.path.split('/'));
    try {
      const content = await fs.readFile(src);
      const existing = await fs.readFile(dest).catch(() => null);
      if (existing) {
        if (!existing.equals(content)) {
          result.failed.push({ path: item.path, reason: 'a different file is already there' });
          await keepFailed(src, `untracked-${item.path.replace(/[\\/]/g, '__')}`);
        }
        continue;
      }
      await writeFileAtomic(dest, content);
      if (item.executable) await fs.chmod(dest, 0o755).catch(() => undefined);
      result.untracked += 1;
    } catch (error) {
      result.failed.push({ path: item.path, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
