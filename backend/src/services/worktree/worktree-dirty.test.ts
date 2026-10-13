/** Tests for the dirty-status filter, the remote-host check and old-git fallback. */

import { dirtyStatusLines, isRegenerablePath } from './worktree-dirty.js';
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
