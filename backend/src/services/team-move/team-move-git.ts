/**
 * Git side of the team move: read a repository's state on the source, and put
 * a repository back at a recorded branch and commit on the target.
 *
 * Code never travels in the package. The source records where each project's
 * repository lives (remote, branch, head, dirty) and refuses to move while
 * work exists only on that machine; the target fetches the code itself with
 * its own git credentials.
 *
 * @module services/team-move/team-move-git
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import type { PackageRepo } from './team-move.types.js';

const execFileAsync = promisify(execFile);

/** Git probes are quick; a hung one must not stall the export. */
const PROBE_TIMEOUT_MS = 20_000;

/** Never prompt: a missing credential must fail, not hang. */
const NON_INTERACTIVE_ENV: NodeJS.ProcessEnv = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new',
};

/**
 * Run git in a directory.
 *
 * @param cwd - Working directory
 * @param args - Git arguments
 * @param timeoutMs - Kill after this long
 * @returns Trimmed stdout
 * @throws Error with git's stderr
 */
export async function git(cwd: string, args: string[], timeoutMs: number = PROBE_TIMEOUT_MS): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      timeout: timeoutMs,
      env: { ...process.env, ...NON_INTERACTIVE_ENV },
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const e = error as { stderr?: string; message?: string };
    throw new Error((e.stderr?.trim() || e.message || 'git failed').split('\n').slice(0, 3).join(' | '));
  }
}

/** Like {@link git} but null on failure. */
async function gitOrNull(cwd: string, args: string[]): Promise<string | null> {
  try {
    const out = await git(cwd, args);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Read the state of the repository a project lives in.
 *
 * `.crewly/` is ignored when judging "dirty": Crewly's own data goes through
 * the package, so it must not block a move. The remote is read as configured
 * (`git config`), not through `url.*.insteadOf` rewrites, which are local to
 * this machine.
 *
 * @param project - Project identity
 * @param project.id - Project id
 * @param project.name - Project name
 * @param project.path - Absolute project path
 * @returns Repo record (never throws)
 */
export async function inspectRepo(project: { id: string; name: string; path: string }): Promise<PackageRepo> {
  const base: PackageRepo = {
    projectId: project.id,
    projectName: project.name,
    path: project.path,
    remoteUrl: null,
    branch: null,
    headSha: null,
    dirty: false,
    unpushed: 0,
  };
  const exists = await fs.stat(project.path).then((s) => s.isDirectory(), () => false);
  if (!exists) return { ...base, note: 'project folder does not exist on this machine' };
  const top = await gitOrNull(project.path, ['rev-parse', '--show-toplevel']);
  if (!top) return { ...base, note: 'not a git repository — files are not moved, only Crewly data' };

  const [remoteUrl, branch, headSha, status] = await Promise.all([
    gitOrNull(project.path, ['config', '--get', 'remote.origin.url']),
    gitOrNull(project.path, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    gitOrNull(project.path, ['rev-parse', 'HEAD']),
    gitOrNull(project.path, ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude).crewly']),
  ]);
  // Commits that no remote-tracking branch has: work that exists only here.
  const unpushedRaw = headSha ? await gitOrNull(project.path, ['rev-list', '--count', 'HEAD', '--not', '--remotes']) : null;
  const unpushed = unpushedRaw ? Number.parseInt(unpushedRaw, 10) || 0 : 0;
  return {
    ...base,
    remoteUrl,
    branch,
    headSha,
    dirty: status !== null,
    unpushed,
    ...(remoteUrl ? {} : { note: 'no git remote — the target cannot fetch this code' }),
  };
}

/**
 * Describe what the owner has to push or commit before a move.
 *
 * @param repos - Repos from {@link inspectRepo}
 * @returns One line per repo that blocks the move (empty when none)
 */
export function describeBlockingRepos(repos: readonly PackageRepo[]): string[] {
  const lines: string[] = [];
  for (const r of repos) {
    const problems: string[] = [];
    if (r.dirty) problems.push('uncommitted changes (commit and push them)');
    if (r.unpushed > 0) problems.push(`${r.unpushed} commit${r.unpushed === 1 ? '' : 's'} not pushed${r.branch ? ` on ${r.branch}` : ''}`);
    if (problems.length > 0) lines.push(`${r.projectName} (${r.path}): ${problems.join(', ')}`);
  }
  return lines;
}

/** Outcome of {@link restoreRepo}. */
export interface RestoreRepoResult {
  ok: boolean;
  branch: string | null;
  headSha: string | null;
  /** Non-fatal notes (e.g. the recorded commit is not on the remote). */
  warnings: string[];
  error?: string;
}

/**
 * Put a repository at the recorded remote, branch and commit. Works for an
 * empty folder, a folder that only holds `.crewly/` and an existing clone.
 * Never discards local changes and never prompts for credentials.
 *
 * @param dest - Target folder (created when missing)
 * @param repo - Recorded state from the source
 * @param timeoutMs - Per git network call
 * @returns Result (never throws)
 */
export async function restoreRepo(
  dest: string,
  repo: Pick<PackageRepo, 'remoteUrl' | 'branch' | 'headSha'>,
  timeoutMs: number = TEAM_MOVE_CONSTANTS.GIT_TIMEOUT_MS,
): Promise<RestoreRepoResult> {
  const warnings: string[] = [];
  if (!repo.remoteUrl) return { ok: false, branch: null, headSha: null, warnings, error: 'the source repository has no remote' };
  try {
    await fs.mkdir(dest, { recursive: true });
    const hasGit = await fs.stat(path.join(dest, '.git')).then(() => true, () => false);
    if (!hasGit) await git(dest, ['init', '-q']);
    const currentRemote = await gitOrNull(dest, ['config', '--get', 'remote.origin.url']);
    if (!currentRemote) await git(dest, ['remote', 'add', 'origin', repo.remoteUrl]);
    else if (currentRemote !== repo.remoteUrl) warnings.push(`origin is ${currentRemote}, expected ${repo.remoteUrl}; kept as is`);

    await git(dest, ['fetch', '--tags', '--prune', 'origin'], timeoutMs);

    const dirty = (await gitOrNull(dest, ['status', '--porcelain', '--untracked-files=no'])) !== null;
    const head = await gitOrNull(dest, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    if (dirty) {
      warnings.push('the folder already has local changes; the checkout was left alone');
    } else if (repo.branch) {
      const remoteBranch = `origin/${repo.branch}`;
      const remoteHas = await gitOrNull(dest, ['rev-parse', '--verify', '--quiet', `${remoteBranch}^{commit}`]);
      if (!remoteHas) {
        warnings.push(`branch ${repo.branch} is not on the remote`);
      } else {
        let target = remoteBranch;
        if (repo.headSha) {
          const sha = await gitOrNull(dest, ['rev-parse', '--verify', '--quiet', `${repo.headSha}^{commit}`]);
          if (sha) target = sha;
          else warnings.push(`recorded commit ${repo.headSha.slice(0, 8)} is not on the remote; using the tip of ${repo.branch}`);
        }
        // `-B` moves the branch to the recorded commit; untracked files (.crewly) stay.
        await git(dest, ['checkout', '-q', '-B', repo.branch, target]);
        await gitOrNull(dest, ['branch', '--set-upstream-to', remoteBranch, repo.branch]);
      }
    } else if (repo.headSha) {
      const sha = await gitOrNull(dest, ['rev-parse', '--verify', '--quiet', `${repo.headSha}^{commit}`]);
      if (sha) await git(dest, ['checkout', '-q', '--detach', sha]);
      else warnings.push(`recorded commit ${repo.headSha.slice(0, 8)} is not on the remote`);
    } else if (!head) {
      warnings.push('no branch or commit was recorded; nothing was checked out');
    }
    return {
      ok: true,
      branch: await gitOrNull(dest, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
      headSha: await gitOrNull(dest, ['rev-parse', 'HEAD']),
      warnings,
    };
  } catch (error) {
    return { ok: false, branch: null, headSha: null, warnings, error: error instanceof Error ? error.message : String(error) };
  }
}
