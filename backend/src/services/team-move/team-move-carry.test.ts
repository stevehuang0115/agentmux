import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { applyCarry, collectCarry, describeLeft, findCarryBase, isSafeRepoPath, type CollectedCarry } from './team-move-carry.js';
import { restoreRepo } from './team-move-git.js';
import type { CarryIndex } from './team-move.types.js';

const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();

/** A PNG-like blob with NUL bytes. */
const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 0, 255, 254, 0, 9, 9, 9]);

/** Write a collected carry into a folder the way the exporter lays it out in a package. */
async function lay(carry: CollectedCarry, dir: string): Promise<CarryIndex> {
  const index: CarryIndex = { version: 1, baseSha: carry.baseSha, branch: carry.branch, flattenedCommits: carry.flattenedCommits, patches: [], untracked: [], leftBehind: [] };
  for (const [n, p] of carry.patches.entries()) {
    await fs.mkdir(path.join(dir, 'patches'), { recursive: true });
    await fs.writeFile(path.join(dir, 'patches', `${n}.patch`), p.data);
    index.patches.push({ path: p.path, file: `patches/${n}.patch`, deleted: p.deleted });
  }
  for (const u of carry.untracked) {
    await fs.mkdir(path.dirname(path.join(dir, 'files', u.path)), { recursive: true });
    await fs.copyFile(u.abs, path.join(dir, 'files', u.path));
    index.untracked.push({ path: u.path, file: `files/${u.path}`, executable: u.executable });
  }
  return index;
}

describe('team-move-carry', () => {
  let root: string;
  let remote: string;
  let work: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-carry-'));
    remote = path.join(root, 'remote.git');
    work = path.join(root, 'work');
    await fs.mkdir(remote);
    run(remote, 'init', '--bare', '-q', '-b', 'main');
    await fs.mkdir(path.join(work, 'src'), { recursive: true });
    run(work, 'init', '-q', '-b', 'main');
    await fs.writeFile(path.join(work, 'src', 'a.ts'), 'export const a = 1;\n');
    await fs.writeFile(path.join(work, 'gone.txt'), 'will be deleted\n');
    await fs.writeFile(path.join(work, 'logo.png'), BINARY);
    await fs.writeFile(path.join(work, '.gitignore'), 'out/\n.crewly/\n');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'one');
    run(work, 'remote', 'add', 'origin', remote);
    run(work, 'push', '-q', '-u', 'origin', 'main');
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  /** Make the working tree dirty in every way a real one is. */
  async function dirty(): Promise<void> {
    await fs.writeFile(path.join(work, 'src', 'a.ts'), 'export const a = 2;\nexport const b = 3;\n');
    await fs.rm(path.join(work, 'gone.txt'));
    await fs.writeFile(path.join(work, 'logo.png'), Buffer.concat([BINARY, Buffer.from([7, 0, 7])]));
    await fs.writeFile(path.join(work, 'src', 'new.ts'), 'export const n = 1;\n');
    await fs.writeFile(path.join(work, 'blob.bin'), BINARY);
    await fs.writeFile(path.join(work, 'run.sh'), '#!/bin/sh\necho hi\n', { mode: 0o755 });
    await fs.mkdir(path.join(work, 'out'), { recursive: true });
    await fs.writeFile(path.join(work, 'out', 'build.js'), 'ignored');
    await fs.mkdir(path.join(work, '.crewly'), { recursive: true });
    await fs.writeFile(path.join(work, '.crewly', 'x.md'), 'crewly data');
  }

  it('finds the base: HEAD when pushed, the newest remote commit under local-only work otherwise', async () => {
    const head = run(work, 'rev-parse', 'HEAD');
    expect(await findCarryBase(work)).toEqual({ baseSha: head, flattenedCommits: 0 });
    await fs.writeFile(path.join(work, 'two.txt'), '2');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'two');
    await fs.writeFile(path.join(work, 'three.txt'), '3');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'three');
    expect(await findCarryBase(work)).toEqual({ baseSha: head, flattenedCommits: 2 });
  });

  it('collects edits, deletions, binary changes and untracked files, but not ignored files or .crewly', async () => {
    await dirty();
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    const c = res.carry;
    expect(c.left).toEqual([]);
    expect(c.patches.map((p) => p.path).sort()).toEqual(['gone.txt', 'logo.png', 'src/a.ts']);
    expect(c.patches.find((p) => p.path === 'gone.txt')!.deleted).toBe(true);
    expect(c.untracked.map((u) => u.path).sort()).toEqual(['blob.bin', 'run.sh', 'src/new.ts']);
    expect(c.untracked.find((u) => u.path === 'run.sh')!.executable).toBe(true);
    expect(c.bytes).toBeGreaterThan(0);
    // The source is left exactly as it was.
    expect(run(work, 'status', '--porcelain').split('\n')).toHaveLength(6);
    expect(run(work, 'rev-list', '--count', 'HEAD')).toBe('1');
  });

  it('carries the content of local commits the remote lacks as part of the patches', async () => {
    await fs.writeFile(path.join(work, 'src', 'a.ts'), 'export const a = 10;\n');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'local');
    await fs.writeFile(path.join(work, 'src', 'a.ts'), 'export const a = 11;\n');
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    expect(res.carry.flattenedCommits).toBe(1);
    expect(res.carry.baseSha).not.toBe(run(work, 'rev-parse', 'HEAD'));
    expect(res.carry.patches.map((p) => p.path)).toEqual(['src/a.ts']);
  });

  it('applies on a fresh clone at the base and reproduces the working tree byte for byte', async () => {
    await dirty();
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    const dir = path.join(root, 'carry');
    const index = await lay(res.carry, dir);

    const dest = path.join(root, 'target');
    const restored = await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: res.carry.baseSha });
    expect(restored.ok).toBe(true);
    const applied = await applyCarry(dest, dir, index);
    expect(applied).toEqual({ applied: 3, untracked: 3, failed: [] });

    for (const rel of ['src/a.ts', 'logo.png', 'src/new.ts', 'blob.bin', 'run.sh']) {
      expect((await fs.readFile(path.join(dest, rel))).equals(await fs.readFile(path.join(work, rel)))).toBe(true);
    }
    await expect(fs.stat(path.join(dest, 'gone.txt'))).rejects.toThrow();
    expect((await fs.stat(path.join(dest, 'run.sh'))).mode & 0o111).not.toBe(0);
    expect(run(dest, 'status', '--porcelain').split('\n').map((l) => l.slice(3)).sort()).toEqual(run(work, 'status', '--porcelain').split('\n').map((l) => l.slice(3)).sort());
    // Nothing was committed or pushed on either side.
    expect(run(dest, 'rev-parse', 'HEAD')).toBe(res.carry.baseSha);
    expect(run(remote, 'rev-list', '--count', 'main')).toBe('1');
  });

  it('applies local commits as uncommitted changes on top of the remote commit', async () => {
    await fs.writeFile(path.join(work, 'src', 'a.ts'), 'export const a = 10;\n');
    await fs.writeFile(path.join(work, 'added.txt'), 'added in a local commit\n');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'local');
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    const dir = path.join(root, 'carry');
    const index = await lay(res.carry, dir);
    const dest = path.join(root, 'target');
    await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: res.carry.baseSha });
    const applied = await applyCarry(dest, dir, index);
    expect(applied.failed).toEqual([]);
    expect(await fs.readFile(path.join(dest, 'added.txt'), 'utf8')).toBe('added in a local commit\n');
    expect(await fs.readFile(path.join(dest, 'src', 'a.ts'), 'utf8')).toBe('export const a = 10;\n');
  });

  it('is safe to apply twice (a rerun after a crash)', async () => {
    await dirty();
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    const dir = path.join(root, 'carry');
    const index = await lay(res.carry, dir);
    const dest = path.join(root, 'target');
    await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: res.carry.baseSha });
    await applyCarry(dest, dir, index);
    const again = await applyCarry(dest, dir, index);
    expect(again.failed).toEqual([]);
    expect(again.applied).toBe(3);
  });

  it('reports a patch that does not apply, keeps it, and still applies the rest', async () => {
    await dirty();
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    const dir = path.join(root, 'carry');
    const index = await lay(res.carry, dir);
    const dest = path.join(root, 'target');
    await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: res.carry.baseSha });
    // The target already has other content where the patch expects the original.
    await fs.writeFile(path.join(dest, 'src', 'a.ts'), 'export const a = 999;\n');
    await fs.writeFile(path.join(dest, 'blob.bin'), 'a different file');
    const applied = await applyCarry(dest, dir, index);
    expect(applied.failed.map((f) => f.path).sort()).toEqual(['blob.bin', 'src/a.ts']);
    expect(applied.applied).toBe(2);
    expect(await fs.readFile(path.join(dest, 'src', 'a.ts'), 'utf8')).toBe('export const a = 999;\n');
    expect((await fs.readdir(path.join(dest, '.crewly', 'move-carry-failed'))).length).toBe(2);
  });

  it('refuses unsafe paths', async () => {
    expect(['src/a.ts', 'a b/c.txt'].every(isSafeRepoPath)).toBe(true);
    expect(['', '/etc/passwd', '../x', 'a/../b', 'a/.git/hooks/pre-commit', '.GIT/config', 'a\\b', 'a//b'].some(isSafeRepoPath)).toBe(false);
    const dest = path.join(root, 'target');
    await fs.mkdir(dest);
    const dir = path.join(root, 'carry');
    await fs.mkdir(path.join(dir, 'files'), { recursive: true });
    await fs.writeFile(path.join(dir, 'files', 'x'), 'x');
    const out = await applyCarry(dest, dir, { version: 1, baseSha: 'x', branch: null, flattenedCommits: 0, patches: [], untracked: [{ path: '../escape.txt', file: 'files/x', executable: false }], leftBehind: [] });
    expect(out.failed).toEqual([{ path: '../escape.txt', reason: 'unsafe path' }]);
    await expect(fs.stat(path.join(root, 'escape.txt'))).rejects.toThrow();
  });

  it('leaves what does not fit behind and says why', async () => {
    await dirty();
    const small = await collectCarry(work, { totalBytes: 1024 * 1024, fileBytes: 20, maxFiles: 2000 });
    if (!small.ok) throw new Error(small.reason);
    expect(small.carry.left.length).toBeGreaterThan(0);
    expect(small.carry.left.every((l) => l.reason === 'too_large')).toBe(true);
    expect(describeLeft(small.carry.left)).toMatch(/too large/);

    const few = await collectCarry(work, { totalBytes: 1024 * 1024, fileBytes: 1024 * 1024, maxFiles: 2 });
    if (!few.ok) throw new Error(few.reason);
    expect(few.carry.left.some((l) => l.reason === 'too_many')).toBe(true);
    expect(describeLeft(few.carry.left)).toMatch(/file limit/);
  });

  it('does not carry symbolic links', async () => {
    await fs.symlink('/etc/hosts', path.join(work, 'link'));
    const res = await collectCarry(work);
    if (!res.ok) throw new Error(res.reason);
    expect(res.carry.left).toEqual([{ path: 'link', bytes: 0, reason: 'symlink' }]);
  });

  it('cannot carry without a commit on the remote', async () => {
    const lone = path.join(root, 'lone');
    await fs.mkdir(lone);
    run(lone, 'init', '-q', '-b', 'main');
    expect(await collectCarry(lone)).toEqual({ ok: false, reason: 'the repository has no commits yet' });
    await fs.writeFile(path.join(lone, 'a'), 'a');
    run(lone, 'add', '-A');
    run(lone, 'commit', '-q', '-m', 'x');
    expect(await collectCarry(lone)).toEqual({ ok: false, reason: 'no commit of this repository is on the remote' });
  });
});
