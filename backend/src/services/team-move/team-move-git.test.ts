import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describeBlockingRepos, git, inspectRepo, restoreRepo } from './team-move-git.js';

const run = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' }).trim();

describe('team-move-git', () => {
  let root: string;
  let remote: string;
  let work: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'move-git-'));
    remote = path.join(root, 'remote.git');
    work = path.join(root, 'work');
    await fs.mkdir(remote);
    run(remote, 'init', '--bare', '-q', '-b', 'main');
    await fs.mkdir(work);
    run(work, 'init', '-q', '-b', 'main');
    await fs.writeFile(path.join(work, 'a.txt'), 'a');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'one');
    run(work, 'remote', 'add', 'origin', remote);
    run(work, 'push', '-q', '-u', 'origin', 'main');
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reads a clean, pushed repository', async () => {
    const r = await inspectRepo({ id: 'p', name: 'P', path: work });
    expect(r).toMatchObject({ remoteUrl: remote, branch: 'main', dirty: false, unpushed: 0 });
    expect(r.headSha).toBe(run(work, 'rev-parse', 'HEAD'));
    expect(describeBlockingRepos([r])).toEqual([]);
  });

  it('ignores .crewly when judging dirty, but not other changes', async () => {
    await fs.mkdir(path.join(work, '.crewly'));
    await fs.writeFile(path.join(work, '.crewly', 'x.md'), 'x');
    expect((await inspectRepo({ id: 'p', name: 'P', path: work })).dirty).toBe(false);
    await fs.writeFile(path.join(work, 'new.txt'), 'n');
    expect((await inspectRepo({ id: 'p', name: 'P', path: work })).dirty).toBe(true);
  });

  it('counts commits the remote does not have and names them for the owner', async () => {
    await fs.writeFile(path.join(work, 'b.txt'), 'b');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'two');
    await fs.writeFile(path.join(work, 'c.txt'), 'c');
    const r = await inspectRepo({ id: 'p', name: 'P', path: work });
    expect(r.unpushed).toBe(1);
    expect(describeBlockingRepos([r])[0]).toBe(`P (${work}): uncommitted changes (commit and push them), 1 commit not pushed on main`);
  });

  it('handles folders that are not repositories, have no remote, or do not exist', async () => {
    const plain = path.join(root, 'plain');
    await fs.mkdir(plain);
    expect((await inspectRepo({ id: 'p', name: 'P', path: plain })).note).toMatch(/not a git repository/);
    const noRemote = path.join(root, 'nr');
    await fs.mkdir(noRemote);
    run(noRemote, 'init', '-q');
    expect((await inspectRepo({ id: 'p', name: 'P', path: noRemote })).note).toMatch(/no git remote/);
    expect((await inspectRepo({ id: 'p', name: 'P', path: path.join(root, 'gone') })).note).toMatch(/does not exist/);
  });

  it('puts an empty or .crewly-only folder at the recorded branch and commit', async () => {
    const dest = path.join(root, 'dest');
    await fs.mkdir(path.join(dest, '.crewly'), { recursive: true });
    await fs.writeFile(path.join(dest, '.crewly', 'keep.md'), 'keep');
    const sha = run(work, 'rev-parse', 'HEAD');
    const result = await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: sha });
    expect(result).toMatchObject({ ok: true, branch: 'main', headSha: sha });
    expect(await fs.readFile(path.join(dest, 'a.txt'), 'utf8')).toBe('a');
    expect(await fs.readFile(path.join(dest, '.crewly', 'keep.md'), 'utf8')).toBe('keep');
    // Again: nothing breaks.
    expect((await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: sha })).ok).toBe(true);
  });

  it('checks out the recorded commit, not the newest one', async () => {
    const first = run(work, 'rev-parse', 'HEAD');
    await fs.writeFile(path.join(work, 'b.txt'), 'b');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'two');
    run(work, 'push', '-q');
    const dest = path.join(root, 'dest2');
    const result = await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: first });
    expect(result.headSha).toBe(first);
  });

  it('warns when the recorded commit is not on the remote and uses the branch tip', async () => {
    const dest = path.join(root, 'dest3');
    const result = await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: 'f'.repeat(40) });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/not on the remote/);
    expect(result.headSha).toBe(run(work, 'rev-parse', 'HEAD'));
  });

  it('restores a detached head and reports a missing branch', async () => {
    const sha = run(work, 'rev-parse', 'HEAD');
    const detached = await restoreRepo(path.join(root, 'd4'), { remoteUrl: remote, branch: null, headSha: sha });
    expect(detached).toMatchObject({ ok: true, headSha: sha, branch: null });
    const missing = await restoreRepo(path.join(root, 'd5'), { remoteUrl: remote, branch: 'nope', headSha: null });
    expect(missing.warnings.join(' ')).toMatch(/branch nope is not on the remote/);
  });

  it('fails clearly without a remote or with an unreachable one', async () => {
    expect((await restoreRepo(path.join(root, 'd6'), { remoteUrl: null, branch: null, headSha: null })).error).toMatch(/no remote/);
    const bad = await restoreRepo(path.join(root, 'd7'), { remoteUrl: path.join(root, 'missing.git'), branch: 'main', headSha: null }, 20_000);
    expect(bad.ok).toBe(false);
    expect(bad.error).toBeTruthy();
  });

  it('leaves local changes in an existing clone alone', async () => {
    const dest = path.join(root, 'd8');
    await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: null });
    await fs.writeFile(path.join(dest, 'a.txt'), 'edited');
    const again = await restoreRepo(dest, { remoteUrl: remote, branch: 'main', headSha: null });
    expect(again.warnings.join(' ')).toMatch(/local changes/);
    expect(await fs.readFile(path.join(dest, 'a.txt'), 'utf8')).toBe('edited');
  });

  it('reports git errors with git\'s own words', async () => {
    await expect(git(root, ['rev-parse', 'HEAD'])).rejects.toThrow(/not a git repository/i);
  });
});
