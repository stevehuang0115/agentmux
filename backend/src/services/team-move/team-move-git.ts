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

import { execFile, spawn } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import type { PackageRepo, RepoFileStatus } from './team-move.types.js';

const execFileAsync = promisify(execFile);

/** Git probes are quick; a hung one must not stall the export. */
const PROBE_TIMEOUT_MS = 20_000;

/**
 * Never prompt: a missing credential must fail, not hang. There is no
 * terminal on a backend, so any prompt (git's own, a credential manager's
 * dialog, ssh's passphrase) would wait forever.
 */
export const NON_INTERACTIVE_ENV: NodeJS.ProcessEnv = {
  GIT_TERMINAL_PROMPT: '0',
  GCM_INTERACTIVE: 'never',
  // Empty (not unset) so git neither asks a helper nor falls back to SSH_ASKPASS: the credential lookup fails.
  GIT_ASKPASS: '',
  SSH_ASKPASS: '',
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

/**
 * Run git and return stdout untouched (bytes), for output where leading
 * whitespace or binary content matters (porcelain status, patches).
 *
 * @param cwd - Working directory
 * @param args - Git arguments
 * @param maxBytes - Fail when the output is larger than this
 * @returns Raw stdout
 * @throws Error with git's stderr, or `output too large`
 */
export async function gitBuffer(cwd: string, args: string[], maxBytes: number = 16 * 1024 * 1024): Promise<Buffer> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
      timeout: PROBE_TIMEOUT_MS * 3,
      env: { ...process.env, ...NON_INTERACTIVE_ENV },
      maxBuffer: maxBytes,
      encoding: 'buffer',
    });
    return stdout;
  } catch (error) {
    const e = error as { stderr?: Buffer | string; message?: string; code?: string };
    if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') throw new Error('output too large');
    const stderr = Buffer.isBuffer(e.stderr) ? e.stderr.toString('utf8') : (e.stderr ?? '');
    throw new Error((stderr.trim() || e.message || 'git failed').split('\n').slice(0, 3).join(' | '));
  }
}

/** What a running clone/fetch has done so far (parsed from git's progress lines). */
export interface GitProgress {
  /** "Receiving objects", "Resolving deltas", "Compressing objects", ... */
  phase: string;
  /** 0-100 of the phase. */
  percent: number;
  /** Objects done / total of the phase. */
  objectsDone: number;
  objectsTotal: number;
  /** Bytes received so far (only the receiving phase reports it). */
  bytes: number | null;
  /** Transfer speed as git prints it ("5.00 MiB/s"), when known. */
  rate: string | null;
}

const UNIT_BYTES: Record<string, number> = { bytes: 1, B: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 };

/**
 * Parse one git progress line such as
 * `Receiving objects:  45% (123/456), 120.50 MiB | 5.00 MiB/s`.
 *
 * @param line - A stderr line (a leading `remote: ` is ignored)
 * @returns The progress, or null when the line is not a progress line
 */
export function parseGitProgress(line: string): GitProgress | null {
  const m = /^(?:remote:\s+)?([A-Za-z][A-Za-z ]*?):\s+(\d+)%\s+\((\d+)\/(\d+)\)(?:,\s+([\d.]+)\s+(bytes|B|KiB|MiB|GiB|TiB)(?:\s+\|\s+([\d.]+\s+\S+\/s))?)?/.exec(line.trim());
  if (!m) return null;
  const unit = m[6] ? UNIT_BYTES[m[6]] : undefined;
  return {
    phase: m[1]!,
    percent: Number(m[2]),
    objectsDone: Number(m[3]),
    objectsTotal: Number(m[4]),
    bytes: m[5] && unit ? Math.round(Number(m[5]) * unit) : null,
    rate: m[7] ?? null,
  };
}

/** Limits and hooks of one git network call. */
export interface GitNetworkOptions {
  /** Wall-clock limit; default scales with {@link GitNetworkOptions.sizeBytes}. */
  timeoutMs?: number;
  /** Kill the call when git printed nothing for this long. */
  stallMs?: number;
  /** Expected size of the repository (bytes), to scale the wall-clock limit. */
  sizeBytes?: number | null;
  /** Called for every progress line git prints. */
  onProgress?: (progress: GitProgress) => void;
}

/**
 * Wall-clock limit for a git network call: grows with the repository, never
 * below {@link TEAM_MOVE_CONSTANTS.GIT_TIMEOUT_MS} nor above the maximum. The
 * stall check is what catches a call that hangs; this only bounds a slow one.
 *
 * @param sizeBytes - Expected repository size, when known
 * @returns Milliseconds
 */
export function gitTimeoutFor(sizeBytes?: number | null): number {
  const C = TEAM_MOVE_CONSTANTS;
  if (!sizeBytes || sizeBytes <= 0) return C.GIT_TIMEOUT_MS;
  const scaled = C.GIT_TIMEOUT_MS + (sizeBytes / C.GIT_ASSUMED_BYTES_PER_SEC) * 1000;
  return Math.min(C.GIT_MAX_TIMEOUT_MS, Math.max(C.GIT_TIMEOUT_MS, Math.round(scaled)));
}

/**
 * Turn git's network error into a sentence the owner can act on.
 *
 * @param message - Error text from git
 * @returns The same text, prefixed with the likely cause when it is a sign-in problem
 */
export function explainGitFailure(message: string): string {
  if (/could not read (username|password)|terminal prompts disabled|authentication failed|permission denied \(publickey|repository not found|invalid username or password|access denied|fatal: could not read from remote repository/i.test(message)) {
    return `this machine has no git credentials for the remote (sign in to it first): ${message}`;
  }
  return message;
}

/**
 * Run a git command that talks to a remote. Never prompts, prints progress,
 * and is killed when it stalls (no output for `stallMs`) or runs past the
 * wall-clock limit, so a blocked credential helper or a dead network cannot
 * hang the caller.
 *
 * @param cwd - Working directory
 * @param args - Git arguments (`--progress` is added for fetch/clone)
 * @param options - Limits and the progress hook
 * @returns Trimmed stdout
 * @throws Error with git's message (without progress noise)
 */
export function gitNetwork(cwd: string, args: string[], options: GitNetworkOptions = {}): Promise<string> {
  const stallMs = options.stallMs ?? TEAM_MOVE_CONSTANTS.GIT_STALL_MS;
  const timeoutMs = options.timeoutMs ?? gitTimeoutFor(options.sizeBytes);
  return new Promise<string>((resolve, reject) => {
    const child = spawn('git', ['-C', cwd, ...args], {
      env: { ...process.env, ...NON_INTERACTIVE_ENV },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    const tail: string[] = [];
    let partial = '';
    let lastActivity = Date.now();
    let settled = false;
    const kill = (): void => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    };
    const finish = (error: Error | null, out = ''): void => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      clearTimeout(wall);
      if (error) reject(error);
      else resolve(out);
    };
    const stderrText = (): string => tail.slice(-3).join(' | ');
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity < stallMs) return;
      kill();
      finish(new Error(`git made no progress for ${Math.round(stallMs / 1000)} s and was stopped${stderrText() ? `: ${stderrText()}` : ''}`));
    }, Math.max(20, Math.min(5_000, Math.floor(stallMs / 4))));
    watchdog.unref?.();
    const wall = setTimeout(() => {
      kill();
      finish(new Error(`git did not finish within ${timeoutMs >= 120_000 ? `${Math.round(timeoutMs / 60_000)} min` : `${Math.round(timeoutMs / 1000)} s`} and was stopped${stderrText() ? `: ${stderrText()}` : ''}`));
    }, timeoutMs);
    wall.unref?.();

    child.stdout!.on('data', (d: Buffer) => {
      lastActivity = Date.now();
      if (stdout.length < 1_000_000) stdout += d.toString('utf8');
    });
    child.stderr!.on('data', (d: Buffer) => {
      lastActivity = Date.now();
      const lines = (partial + d.toString('utf8')).split(/[\r\n]+/);
      partial = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const progress = parseGitProgress(line);
        if (progress) options.onProgress?.(progress);
        else {
          tail.push(line.trim());
          if (tail.length > 20) tail.shift();
        }
      }
    });
    child.on('error', (error) => finish(error));
    child.on('close', (code) => {
      if (partial.trim() && !parseGitProgress(partial)) tail.push(partial.trim());
      if (code === 0) finish(null, stdout.trim());
      else finish(new Error(explainGitFailure((stderrText() || `git exited with code ${code}`).slice(0, 600))));
    });
  });
}

/** Result of {@link checkRemoteAccess}. */
export interface RemoteAccess {
  ok: boolean;
  error?: string;
}

/**
 * Whether this machine can read a remote, tested the way a clone would read
 * it (`git ls-remote`, never prompting). A private repository without
 * credentials fails here in seconds instead of hanging the import.
 *
 * @param remoteUrl - Remote URL as the source configured it
 * @param timeoutMs - Give up after this long
 * @returns ok, or the reason it failed (never throws)
 */
export async function checkRemoteAccess(remoteUrl: string, timeoutMs: number = TEAM_MOVE_CONSTANTS.GIT_LS_REMOTE_TIMEOUT_MS): Promise<RemoteAccess> {
  try {
    await gitNetwork(os.tmpdir(), ['ls-remote', '--quiet', '--heads', remoteUrl], { timeoutMs, stallMs: timeoutMs });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: sanitizeRemote(error instanceof Error ? error.message : String(error)).slice(0, 300) };
  }
}

/**
 * Remove credentials from a URL (`https://user:token@host/x` -> `https://host/x`).
 * Used before a remote is compared, logged or sent anywhere.
 *
 * @param text - A URL, or text that contains URLs
 * @returns The text without `user:password@`
 */
export function sanitizeRemote(text: string): string {
  return text.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, '$1');
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
  if (!top) return { ...base, note: 'not a git repository — its files travel in the package' };

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
    if (problems.length > 0 && r.carryError) problems.push(`could not be carried instead: ${r.carryError}`);
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
 * @param options - Limits of the fetch (stall detection, size-scaled timeout) and the progress hook
 * @returns Result (never throws)
 */
export async function restoreRepo(
  dest: string,
  repo: Pick<PackageRepo, 'remoteUrl' | 'branch' | 'headSha'> & { sizeBytes?: number | null },
  options: GitNetworkOptions = {},
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

    await gitNetwork(dest, ['fetch', '--progress', '--tags', '--prune', 'origin'], { sizeBytes: repo.sizeBytes, ...options });

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

/** One changed file of a repository. */
export interface RepoChange {
  path: string;
  status: RepoFileStatus;
}

/** Uncommitted changes of a repository. */
export interface RepoChanges {
  modified: number;
  untracked: number;
  /** All changed files, modified before untracked, each group in git's order. */
  files: RepoChange[];
}

/** Longest changed-file list read from one repository. */
const MAX_CHANGE_ENTRIES = 20_000;

/**
 * Read a repository's uncommitted changes (`.crewly/` is ignored, like in
 * {@link inspectRepo}).
 *
 * @param repoPath - Repository folder
 * @returns Counts and the changed files; empty when git cannot say
 */
export async function readRepoChanges(repoPath: string): Promise<RepoChanges> {
  let out: Buffer;
  try {
    out = await gitBuffer(repoPath, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.', ':(exclude).crewly']);
  } catch {
    return { modified: 0, untracked: 0, files: [] };
  }
  const parts = out.toString('utf8').split('\0');
  const tracked: RepoChange[] = [];
  const untracked: RepoChange[] = [];
  for (let i = 0; i < parts.length && tracked.length + untracked.length < MAX_CHANGE_ENTRIES; i++) {
    const entry = parts[i]!;
    if (entry.length < 4) continue;
    const x = entry[0]!;
    const y = entry[1]!;
    const file = entry.slice(3);
    if (x === 'R' || x === 'C') i += 1; // the next field is the origin of the rename/copy
    if (x === '?' && y === '?') {
      untracked.push({ path: file, status: 'untracked' });
      continue;
    }
    let status: RepoFileStatus = 'modified';
    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) status = 'conflict';
    else if (x === 'D' || y === 'D') status = 'deleted';
    else if (x === 'R' || x === 'C') status = 'renamed';
    else if (x === 'A') status = 'added';
    tracked.push({ path: file, status });
  }
  return { modified: tracked.length, untracked: untracked.length, files: [...tracked, ...untracked] };
}

/**
 * `host/owner/repo` of a remote URL for display: no credentials, no scheme.
 *
 * @param url - Remote URL or path as configured
 * @returns Display form, or null for an empty URL
 */
export function displayRemote(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const scp = /^[^@/\s]+@([^:/\s]+):(.+)$/.exec(trimmed);
  if (scp) return `${scp[1]}/${scp[2]}`;
  try {
    const u = new URL(trimmed);
    if (u.hostname) return `${u.hostname}${u.pathname}`;
  } catch {
    /* a local path */
  }
  return trimmed.split('/').filter(Boolean).slice(-2).join('/');
}
