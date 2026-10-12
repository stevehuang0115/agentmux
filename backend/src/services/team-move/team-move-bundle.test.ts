import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyBundle, createBundle, estimateRepoBytes, formatBytes, resolveBundleLimits, restoreFromBundle } from './team-move-bundle.js';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();

describe('team-move-bundle', () => {
  let root: string;
  let work: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-bundle-'));
    work = path.join(root, 'work');
    await fs.mkdir(work, { recursive: true });
    git(work, 'init', '-q', '-b', 'main');
    await fs.writeFile(path.join(work, 'a.txt'), 'one\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'first');
    git(work, 'checkout', '-q', '-b', 'feature');
    await fs.writeFile(path.join(work, 'b.txt'), 'two\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'second');
    git(work, 'tag', 'v1');
    git(work, 'checkout', '-q', 'main');
  });

  afterEach(() => fs.rm(root, { recursive: true, force: true }));

  describe('resolveBundleLimits / formatBytes', () => {
    it('defaults to 2 GB per repository and 3 GB together', () => {
      expect(resolveBundleLimits({})).toEqual({ repoBytes: 2 * 1024 ** 3, totalBytes: 3 * 1024 ** 3 });
    });

    it('is overridable in megabytes, ignoring junk', () => {
      const env = { [TEAM_MOVE_CONSTANTS.BUNDLE_REPO_MAX_MB_ENV]: '512', [TEAM_MOVE_CONSTANTS.BUNDLES_MAX_MB_ENV]: 'lots' };
      expect(resolveBundleLimits(env)).toEqual({ repoBytes: 512 * 1024 ** 2, totalBytes: 3 * 1024 ** 3 });
    });

    it('formats sizes for the owner', () => {
      expect(formatBytes(900 * 1024 ** 2)).toBe('900 MB');
      expect(formatBytes(Math.round(1.5 * 1024 ** 3))).toBe('1.5 GB');
      expect(formatBytes(2048)).toBe('2 KB');
    });
  });

  it('estimates the object store size', async () => {
    expect(await estimateRepoBytes(work)).toBeGreaterThan(0);
    expect(await estimateRepoBytes(path.join(root, 'missing'))).toBeNull();
  });

  describe('full bundle round trip', () => {
    it('rebuilds every branch, the tag and the checked-out commit in a folder that already holds .crewly', async () => {
      const file = path.join(root, 'out', 'repo.bundle');
      const made = await createBundle(work, file, 'full', 1024 ** 3);
      expect(made).toMatchObject({ ok: true });
      expect(made.ok && made.bytes).toBeGreaterThan(0);
      expect(made.ok && made.refs).toBeGreaterThanOrEqual(3);

      const dest = path.join(root, 'dest');
      await fs.mkdir(path.join(dest, '.crewly'), { recursive: true });
      await fs.writeFile(path.join(dest, '.crewly', 'keep.md'), 'keep');
      const res = await restoreFromBundle(dest, file, { branch: 'main', headSha: git(work, 'rev-parse', 'HEAD') });

      expect(res).toMatchObject({ ok: true, branch: 'main' });
      expect(git(dest, 'rev-parse', 'HEAD')).toBe(git(work, 'rev-parse', 'HEAD'));
      expect(git(dest, 'branch', '--format=%(refname:short)').split('\n').sort()).toEqual(['feature', 'main']);
      expect(git(dest, 'tag')).toBe('v1');
      expect(git(dest, 'remote')).toBe('');
      expect(await fs.readFile(path.join(dest, 'a.txt'), 'utf8')).toBe('one\n');
      expect(await fs.readFile(path.join(dest, '.crewly', 'keep.md'), 'utf8')).toBe('keep');
    });

    it('checks out a detached recorded commit when the branch is unknown', async () => {
      const file = path.join(root, 'repo.bundle');
      await createBundle(work, file, 'full', 1024 ** 3);
      const dest = path.join(root, 'dest');
      const featureSha = git(work, 'rev-parse', 'feature');
      const res = await restoreFromBundle(dest, file, { branch: 'gone', headSha: featureSha });
      expect(res.ok).toBe(true);
      expect(res.branch).toBeNull();
      expect(res.warnings.join(' ')).toMatch(/branch gone is not in the bundle/);
      expect(git(dest, 'rev-parse', 'HEAD')).toBe(featureSha);
    });

    it('fails with a reason on a corrupt bundle and leaves nothing claiming success', async () => {
      const file = path.join(root, 'bad.bundle');
      await fs.writeFile(file, 'not a bundle');
      const res = await restoreFromBundle(path.join(root, 'dest'), file, { branch: 'main', headSha: null });
      expect(res.ok).toBe(false);
      expect(res.error).toBeTruthy();
    });
  });

  describe('caps', () => {
    it('refuses and removes a bundle over the cap, naming the env vars', async () => {
      const file = path.join(root, 'repo.bundle');
      const made = await createBundle(work, file, 'full', 10);
      expect(made.ok).toBe(false);
      expect(!made.ok && made.reason).toMatch(/over the 10 KB limit|over the 1 KB limit/);
      expect(!made.ok && made.reason).toContain('CREWLY_TEAM_MOVE_BUNDLE_MAX_MB');
      await expect(fs.stat(file)).rejects.toThrow();
    });

    it('says so when there is nothing to bundle', async () => {
      const empty = path.join(root, 'empty');
      await fs.mkdir(empty);
      git(empty, 'init', '-q');
      const made = await createBundle(empty, path.join(root, 'e.bundle'), 'full', 1024 ** 3);
      expect(made).toEqual({ ok: false, reason: expect.stringMatching(/no commits|bundle/i) });
    });
  });

  describe('unpushed bundle', () => {
    it('carries only the commits the remote lacks, applied on top of a clone of the remote', async () => {
      const remote = path.join(root, 'remote.git');
      git(root, 'init', '--bare', '-q', '-b', 'main', remote);
      git(work, 'remote', 'add', 'origin', remote);
      git(work, 'push', '-q', 'origin', 'main');
      await fs.writeFile(path.join(work, 'c.txt'), 'local only\n');
      git(work, 'add', '-A');
      git(work, 'commit', '-q', '-m', 'unpushed');
      git(work, 'fetch', '-q', 'origin');

      const full = await createBundle(work, path.join(root, 'full.bundle'), 'full', 1024 ** 3);
      const small = await createBundle(work, path.join(root, 'small.bundle'), 'unpushed', 1024 ** 3);
      expect(small.ok && full.ok && small.bytes).toBeLessThanOrEqual(full.ok ? full.bytes : 0);

      const dest = path.join(root, 'dest');
      git(root, 'clone', '-q', remote, dest);
      const res = await applyBundle(dest, path.join(root, 'small.bundle'), { branch: 'main', headSha: git(work, 'rev-parse', 'HEAD') });
      expect(res).toMatchObject({ ok: true, branch: 'main' });
      expect(git(dest, 'rev-parse', 'HEAD')).toBe(git(work, 'rev-parse', 'HEAD'));
      expect(await fs.readFile(path.join(dest, 'c.txt'), 'utf8')).toBe('local only\n');
      expect(git(remote, 'rev-list', '--count', 'main')).toBe('1'); // the remote is untouched
    });

    it('fails when the remote lacks the commits the bundle builds on', async () => {
      const remote = path.join(root, 'remote.git');
      git(root, 'init', '--bare', '-q', '-b', 'main', remote);
      git(work, 'remote', 'add', 'origin', remote);
      git(work, 'push', '-q', 'origin', 'main');
      await fs.writeFile(path.join(work, 'c.txt'), 'x\n');
      git(work, 'add', '-A');
      git(work, 'commit', '-q', '-m', 'unpushed');
      git(work, 'fetch', '-q', 'origin');
      await createBundle(work, path.join(root, 'u.bundle'), 'unpushed', 1024 ** 3);

      const emptyDest = path.join(root, 'empty-dest');
      await fs.mkdir(emptyDest);
      git(emptyDest, 'init', '-q');
      const res = await applyBundle(emptyDest, path.join(root, 'u.bundle'), { branch: 'main', headSha: null });
      expect(res.ok).toBe(false);
    });
  });
});
