/** Tests for the dirty-status filter, the remote-host check and old-git fallback. */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { dirtyStatusLines, isRegenerablePath, reclaimRegenerableDirs } from './worktree-dirty.js';
import { isNonGithubRemote, isTreeContained, type GitRunner } from './worktree-landed.js';

describe('isRegenerablePath', () => {
	it.each(['node_modules', 'web-visa/node_modules/', 'a/b/.next/', 'dist/', 'debug.log', 'x/y/npm-debug.log', '"web visa/node_modules/"'])('%s is regenerable', (p) => {
		expect(isRegenerablePath(p)).toBe(true);
	});
	it.each(['src/index.ts', 'notes/todo.md', 'web-visa/', 'node_modules_backup/', 'catalog.txt'])('%s is real', (p) => {
		expect(isRegenerablePath(p)).toBe(false);
	});
});

describe('dirtyStatusLines', () => {
	it('drops untracked regenerable output only', () => {
		const out = ['?? web/node_modules/', '?? web/.next/', '?? run.log', ' M src/a.ts', '?? src/new.ts', 'A  b.ts', ''].join('\n');
		expect(dirtyStatusLines(out)).toEqual([' M src/a.ts', '?? src/new.ts', 'A  b.ts']);
	});
	it('never hides a tracked change inside a regenerable-looking dir', () => {
		expect(dirtyStatusLines(' M build/script.sh\n')).toEqual([' M build/script.sh']);
	});
});

describe('isNonGithubRemote', () => {
	it.each(['git@bitbucket.org:ccedev/ce-core.git', 'https://user@bitbucket.org/x/y.git', 'ssh://git@gitlab.com/a/b.git'])('%s -> true', (u) => {
		expect(isNonGithubRemote(u)).toBe(true);
	});
	it.each(['git@github.com:a/b.git', 'https://github.com/a/b', 'git@github.acme.com:a/b.git', '/tmp/origin.git', ''])('%s -> false', (u) => {
		expect(isNonGithubRemote(u)).toBe(false);
	});
});

describe('isTreeContained on git < 2.38', () => {
	const mk = (cherry: string): GitRunner => async (args) => {
		if (args.includes('rev-parse')) return { code: 0, stdout: 'tree1\n', stderr: '' };
		if (args.includes('merge-tree')) return { code: 129, stdout: '', stderr: 'usage: git merge-tree <base-tree> <branch1> <branch2>' };
		if (args.includes('cherry')) return { code: 0, stdout: cherry, stderr: '' };
		return { code: 1, stdout: '', stderr: '' };
	};
	it('falls back to git cherry: all patch-equivalent means contained', async () => {
		const state = {};
		expect(await isTreeContained(mk('- abc\n- def\n'), '/r', 'origin/main', 'h', state)).toBe(true);
		expect(await isTreeContained(mk('- abc\n+ def\n'), '/r', 'origin/main', 'h', state)).toBe(false);
	});
});

describe('reclaimRegenerableDirs options (crewly#1354)', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'reclaim-'));
		fs.mkdirSync(path.join(root, 'node_modules', 'a'), { recursive: true });
		fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
		fs.writeFileSync(path.join(root, 'dist', 'index.js'), 'x');
		fs.mkdirSync(path.join(root, 'shared'), { recursive: true });
		fs.symlinkSync(path.join(root, 'shared'), path.join(root, '.cache'), 'dir');
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('never deletes a directory git tracks and counts dry-run sizes', async () => {
		const sizeOf = async (p: string) => (p.endsWith('node_modules') ? 1000 : 10);
		const isTracked = async (dir: string) => (dir.endsWith('dist') ? true : dir.endsWith('.cache') ? null : false);
		const dry = await reclaimRegenerableDirs(root, sizeOf, true, { isTracked });
		expect(dry.dirs.map((d) => path.basename(d))).toEqual(['node_modules']);
		expect(dry.freedBytes).toBe(1000);
		expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(true);

		const real = await reclaimRegenerableDirs(root, sizeOf, false, { isTracked });
		expect(real.dirs.map((d) => path.basename(d))).toEqual(['node_modules']);
		expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'dist', 'index.js'))).toBe(true);
		expect(fs.lstatSync(path.join(root, '.cache')).isSymbolicLink()).toBe(true);
	});

	it('keepSymlinks leaves shared symlinks in place but removes real dirs', async () => {
		const r = await reclaimRegenerableDirs(root, async () => 5, false, { keepSymlinks: true });
		expect(r.dirs.map((d) => path.basename(d)).sort()).toEqual(['dist', 'node_modules']);
		expect(fs.lstatSync(path.join(root, '.cache')).isSymbolicLink()).toBe(true);
		expect(fs.existsSync(path.join(root, 'shared'))).toBe(true);
	});

	it('without keepSymlinks a symlink is removed as a link, its target untouched', async () => {
		const r = await reclaimRegenerableDirs(root, async () => 5, false);
		expect(r.dirs).toHaveLength(3);
		expect(fs.existsSync(path.join(root, '.cache'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'shared'))).toBe(true);
	});
});
