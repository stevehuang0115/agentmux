/**
 * Git network calls of the team move: never prompt, scale the time limit to
 * the repository, stop a call that makes no progress, and test a remote's
 * access with `git ls-remote`.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { NON_INTERACTIVE_ENV, checkRemoteAccess, explainGitFailure, gitNetwork, gitTimeoutFor, parseGitProgress, restoreRepo, sanitizeRemote, type GitProgress } from './team-move-git.js';
import { checkGitAccess, runPreflight } from './team-move-preflight.js';

describe('parseGitProgress', () => {
  it('reads objects, bytes and speed from a receiving line', () => {
    expect(parseGitProgress('Receiving objects:  45% (123/456), 120.50 MiB | 5.00 MiB/s')).toEqual({
      phase: 'Receiving objects',
      percent: 45,
      objectsDone: 123,
      objectsTotal: 456,
      bytes: Math.round(120.5 * 1024 * 1024),
      rate: '5.00 MiB/s',
    });
  });

  it('reads lines without bytes, with a remote prefix, and ignores other output', () => {
    expect(parseGitProgress('remote: Counting objects:  10% (1/10)')).toMatchObject({ phase: 'Counting objects', percent: 10, bytes: null, rate: null });
    expect(parseGitProgress('Resolving deltas: 100% (5/5), done.')).toMatchObject({ phase: 'Resolving deltas', objectsDone: 5, objectsTotal: 5 });
    expect(parseGitProgress("fatal: could not read Username for 'https://github.com'")).toBeNull();
  });
});

describe('gitTimeoutFor', () => {
  it('is the floor for small or unknown repositories and grows with size up to the cap', () => {
    const C = TEAM_MOVE_CONSTANTS;
    expect(gitTimeoutFor(null)).toBe(C.GIT_TIMEOUT_MS);
    expect(gitTimeoutFor(10 * 1024 * 1024)).toBe(C.GIT_TIMEOUT_MS + Math.round((10 * 1024 * 1024 / C.GIT_ASSUMED_BYTES_PER_SEC) * 1000));
    const big = gitTimeoutFor(1.6 * 1024 ** 3);
    expect(big).toBeGreaterThan(45 * 60 * 1000);
    expect(big).toBeLessThanOrEqual(C.GIT_MAX_TIMEOUT_MS);
    expect(gitTimeoutFor(1024 ** 5)).toBe(C.GIT_MAX_TIMEOUT_MS);
  });
});

describe('explainGitFailure / sanitizeRemote', () => {
  it('says what is missing when git could not ask for a credential', () => {
    expect(explainGitFailure("fatal: could not read Username for 'https://github.com': terminal prompts disabled")).toMatch(/no git credentials/);
    expect(explainGitFailure('fatal: unable to access: Could not resolve host')).toBe('fatal: unable to access: Could not resolve host');
  });

  it('strips credentials from URLs', () => {
    expect(sanitizeRemote('https://user:tok@github.com/o/r.git')).toBe('https://github.com/o/r.git');
    expect(sanitizeRemote('git@github.com:o/r.git')).toBe('git@github.com:o/r.git');
  });
});

describe('gitNetwork with a stand-in git', () => {
  let dir: string;
  let oldPath: string | undefined;

  /** Put a `git` script first on PATH. */
  async function fakeGit(script: string): Promise<void> {
    await fs.writeFile(path.join(dir, 'git'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env['PATH'] = `${dir}${path.delimiter}${oldPath}`;
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'move-fakegit-'));
    oldPath = process.env['PATH'];
  });
  afterEach(async () => {
    process.env['PATH'] = oldPath;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('runs with every prompt switched off', async () => {
    await fakeGit('echo "$GIT_TERMINAL_PROMPT|$GCM_INTERACTIVE|[$GIT_ASKPASS]|[$SSH_ASKPASS]|$GIT_SSH_COMMAND"');
    const out = await gitNetwork(os.tmpdir(), ['fetch']);
    expect(out).toBe(`0|never|[]|[]|${NON_INTERACTIVE_ENV['GIT_SSH_COMMAND']}`);
    expect(NON_INTERACTIVE_ENV['GIT_SSH_COMMAND']).toContain('BatchMode=yes');
  });

  it('passes progress lines to the hook and keeps them out of the error', async () => {
    await fakeGit('printf "Receiving objects:  50%% (1/2), 1.00 MiB | 1.00 MiB/s\\r" >&2; echo "fatal: boom" >&2; exit 128');
    const seen: GitProgress[] = [];
    await expect(gitNetwork(os.tmpdir(), ['fetch'], { onProgress: (p) => seen.push(p) })).rejects.toThrow(/^fatal: boom$/);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ phase: 'Receiving objects', percent: 50, bytes: 1024 * 1024 });
  });

  it('stops a call that prints nothing (a hidden credential prompt) instead of hanging', async () => {
    await fakeGit('sleep 30');
    const started = Date.now();
    await expect(gitNetwork(os.tmpdir(), ['fetch'], { stallMs: 300 })).rejects.toThrow(/made no progress for/);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('does not stop a slow call that keeps making progress, but stops it at the wall-clock limit', async () => {
    await fakeGit('i=0; while [ $i -lt 40 ]; do echo "Receiving objects:  1% (1/100)" >&2; i=$((i+1)); sleep 0.1; done');
    await expect(gitNetwork(os.tmpdir(), ['fetch'], { stallMs: 500, timeoutMs: 1000 })).rejects.toThrow(/did not finish within/);
  });

  it('turns a denied credential into a sign-in message', async () => {
    await fakeGit(`echo "fatal: could not read Username for 'https://github.com': terminal prompts disabled" >&2; exit 128`);
    const res = await checkRemoteAccess('https://github.com/o/private.git');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no git credentials/);
  });

  it('restoreRepo fails with a clear message when the fetch is denied, and leaves no hang behind', async () => {
    await fakeGit(`case "$*" in *fetch*) echo "fatal: could not read Username for 'https://github.com': terminal prompts disabled" >&2; exit 128;; *) exec /usr/bin/git "$@";; esac`);
    const dest = path.join(dir, 'clone');
    const res = await restoreRepo(dest, { remoteUrl: 'https://github.com/o/private.git', branch: 'main', headSha: null });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/no git credentials/);
  });
});

describe('checkRemoteAccess with real git', () => {
  it('accepts a readable repository and rejects a missing one fast', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-lsremote-'));
    try {
      const bare = path.join(root, 'r.git');
      execFileSync('git', ['init', '-q', '--bare', bare]);
      expect((await checkRemoteAccess(bare)).ok).toBe(true);
      const missing = await checkRemoteAccess(path.join(root, 'nope.git'));
      expect(missing.ok).toBe(false);
      expect(missing.error).toBeTruthy();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

describe('target preflight git access', () => {
  it('tests each distinct remote once and reports which cannot be read, without credentials', async () => {
    const calls: string[] = [];
    const res = await checkGitAccess(['https://tok@github.com/o/private.git', 'https://github.com/o/private.git', 'https://github.com/o/public.git'], async (url) => {
      calls.push(url);
      return url.includes('private') ? { ok: false, error: 'no git credentials' } : { ok: true };
    });
    expect(calls).toEqual(['https://github.com/o/private.git', 'https://github.com/o/public.git']);
    expect(res).toEqual([
      { remote: 'https://github.com/o/private.git', ok: false, error: 'no git credentials' },
      { remote: 'https://github.com/o/public.git', ok: true },
    ]);
  });

  it('adds gitAccess to the preflight only when remotes are given', async () => {
    const deps = { crewlyVersion: '1', diskPath: '/x', freeDisk: async () => 1, hasCommand: () => true, runtimeLogins: async () => ({}), checkRemote: async () => ({ ok: false, error: 'denied' }) };
    expect((await runPreflight(deps, [])).gitAccess).toBeUndefined();
    expect((await runPreflight(deps, [], ['git@github.com:o/r.git'])).gitAccess).toEqual([{ remote: 'git@github.com:o/r.git', ok: false, error: 'denied' }]);
  });
});
