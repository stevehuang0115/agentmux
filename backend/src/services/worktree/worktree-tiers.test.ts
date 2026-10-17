/**
 * Tests for the worktree age tiers: pure decisions with a fake clock, and the
 * archive patch writer against a real temporary git repo.
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	archiveKeepRef,
	archivePatchPath,
	buildArchiveNotice,
	buildStripNotice,
	normalizeTierState,
	pruneTierState,
	tierFor,
	tierIdleMs,
	writeArchivePatch,
} from './worktree-tiers.js';
import { runCommand } from './worktree-janitor.git.js';
import { WORKTREE_JANITOR_CONSTANTS as C } from '../../constants.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const T0 = 1_800_000_000_000;

const GIT_ENV: Record<string, string> = {
	...(Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string')) as Record<string, string>),
	GIT_CONFIG_GLOBAL: '/dev/null',
	GIT_CONFIG_NOSYSTEM: '1',
	GIT_AUTHOR_NAME: 'Test',
	GIT_AUTHOR_EMAIL: 'test@example.com',
	GIT_COMMITTER_NAME: 'Test',
	GIT_COMMITTER_EMAIL: 'test@example.com',
	GIT_TERMINAL_PROMPT: '0',
};

function git(cwd: string, ...args: string[]): string {
	return execFileSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

describe('tier decisions', () => {
	it('tierFor: 3 days to strip, 1 day under low disk or after a finished WorkItem, 14 days to archive', () => {
		expect(tierFor({ idleMs: null, lowDisk: true })).toBeNull();
		expect(tierFor({ idleMs: 2 * DAY, lowDisk: false })).toBeNull();
		expect(tierFor({ idleMs: 3 * DAY, lowDisk: false })).toBe('strip');
		expect(tierFor({ idleMs: 23 * HOUR, lowDisk: true })).toBeNull();
		expect(tierFor({ idleMs: DAY, lowDisk: true })).toBe('strip');
		expect(tierFor({ idleMs: DAY, lowDisk: false, finishedAt: T0 })).toBe('strip');
		expect(tierFor({ idleMs: 14 * DAY - 1, lowDisk: false })).toBe('strip');
		expect(tierFor({ idleMs: 14 * DAY, lowDisk: false })).toBe('archive');
		expect(C.STRIP_MIN_IDLE_MS).toBe(3 * DAY);
		expect(C.STRIP_MIN_IDLE_LOW_DISK_MS).toBe(DAY);
		expect(C.ARCHIVE_MIN_IDLE_MS).toBe(14 * DAY);
	});

	it('tierIdleMs takes the newest known signal (a commit newer than any file counts as a touch)', () => {
		expect(tierIdleMs({ now: T0, treeMtimeMs: null, gitMtimeMs: null, newestCommitMs: null })).toBeNull();
		expect(tierIdleMs({ now: T0, treeMtimeMs: T0 - 5 * DAY, gitMtimeMs: T0 - 4 * DAY, newestCommitMs: T0 - HOUR })).toBe(HOUR);
		expect(tierIdleMs({ now: T0, treeMtimeMs: T0 - 5 * DAY, gitMtimeMs: null, newestCommitMs: null })).toBe(5 * DAY);
		expect(tierIdleMs({ now: T0, treeMtimeMs: T0 + HOUR, gitMtimeMs: null, newestCommitMs: null })).toBe(0);
	});

	it('normalizeTierState tolerates garbage and pruneTierState drops vanished / old records', () => {
		expect(normalizeTierState(null)).toEqual({ stripped: {}, archived: {}, finished: {} });
		expect(normalizeTierState({ stripped: { '/a': 1, '/b': 'x' }, finished: 3 })).toEqual({ stripped: { '/a': 1 }, archived: {}, finished: {} });
		const state = { stripped: { '/gone': T0, '/here': T0 }, archived: { '/old': T0 - 31 * DAY, '/new': T0 - DAY }, finished: { '/here': T0 - 31 * DAY, '/also': T0 } };
		expect(pruneTierState(state, T0, new Set(['/here', '/also']))).toEqual({ stripped: { '/here': T0 }, archived: { '/new': T0 - DAY }, finished: { '/also': T0 } });
	});

	it('archivePatchPath names the patch by repo, worktree and date and never overwrites', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
		try {
			const p = archivePatchPath(root, '/repos/crewly', '/repos/crewly/.claude/worktrees/max-fix', T0);
			expect(p).toBe(path.join(root, 'crewly', `max-fix-${new Date(T0).toISOString().slice(0, 10)}.patch`));
			fs.mkdirSync(path.dirname(p), { recursive: true });
			fs.writeFileSync(p, '');
			expect(archivePatchPath(root, '/repos/crewly', '/repos/crewly/.claude/worktrees/max-fix', T0)).toBe(p.replace(/\.patch$/, '-2.patch'));
			expect(archiveKeepRef('/x/wt one', T0)).toBe(`${C.ARCHIVE_REF_PREFIX}wt-one-${new Date(T0).toISOString().slice(0, 10)}`);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('notices are plain English with the facts a lead needs', () => {
		const strip = buildStripNotice({ path: '/r/wt', reason: 'not-merged', idleMs: 4 * DAY, dirs: ['/r/wt/node_modules', '/r/wt/web/.next'], freedBytes: 2.5 * 1024 ** 3 });
		expect(strip).toContain('/r/wt has work that is not merged');
		expect(strip).toContain('4 days');
		expect(strip).toContain('node_modules, web/.next; 2.5 GB');
		expect(strip).toContain('npm install');
		const archive = buildArchiveNotice({
			path: '/r/wt',
			branch: 'feat/x',
			patch: { file: '/h/worktree-archive/r/wt-2026-10-17.patch', bytes: 2048, trackedChanges: true, untrackedFiles: 2, skippedUntracked: [{ path: 'big.bin', bytes: 1 }] },
			idleMs: 15 * DAY,
			commitsNotOnDefault: 3,
		});
		expect(archive).toContain('untouched for 15 days');
		expect(archive).toContain('uncommitted changes to tracked files and 2 untracked files are saved in /h/worktree-archive/r/wt-2026-10-17.patch (2 KB)');
		expect(archive).toContain('3 unmerged commit(s) are still on branch feat/x');
		expect(archive).toContain('1 file(s) were too large');
		expect(archive).toContain('git apply --3way');
	});
});

describe('writeArchivePatch', () => {
	let root: string;
	let repo: string;
	let wt: string;

	beforeEach(() => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-git-')));
		repo = path.join(root, 'repo');
		git(root, 'init', '--quiet', '-b', 'main', repo);
		fs.writeFileSync(path.join(repo, 'README.md'), 'hello\n');
		fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
		git(repo, 'add', '.');
		git(repo, 'commit', '--quiet', '-m', 'init');
		wt = path.join(root, 'wt');
		git(repo, 'worktree', 'add', '--quiet', '-b', 'feat/a', wt, 'main');
		fs.writeFileSync(path.join(wt, 'README.md'), 'hello\nchanged\n');
		fs.mkdirSync(path.join(wt, 'src'));
		fs.writeFileSync(path.join(wt, 'src', 'new.ts'), 'export const x = 1;\n');
		fs.mkdirSync(path.join(wt, 'node_modules', 'dep'), { recursive: true });
		fs.writeFileSync(path.join(wt, 'node_modules', 'dep', 'index.js'), 'ignored');
		fs.mkdirSync(path.join(wt, 'web', 'dist'), { recursive: true });
		fs.writeFileSync(path.join(wt, 'web', 'dist', 'bundle.js'), 'not ignored but regenerable');
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('saves tracked changes and untracked source (not regenerable output) in one patch that git apply restores', async () => {
		const file = path.join(root, 'archive', 'repo', 'wt-2026-10-17.patch');
		const res = await writeArchivePatch(
			(args, options) => runCommand('git', args, { ...options, env: GIT_ENV }),
			{ repoMain: repo, worktreePath: wt, branch: 'feat/a', head: git(wt, 'rev-parse', 'HEAD'), defaultRef: 'main', commitsNotOnDefault: 0 },
			file,
			T0,
		);
		expect(res).toMatchObject({ file, trackedChanges: true, untrackedFiles: 1, skippedUntracked: [] });
		const text = fs.readFileSync(file, 'utf-8');
		expect(text.startsWith('# Crewly worktree archive')).toBe(true);
		expect(text).toContain(`# worktree: ${wt}`);
		expect(text).toContain('+changed');
		expect(text).toContain('src/new.ts');
		expect(text).not.toContain('bundle.js');
		expect(text).not.toContain('node_modules');
		expect(res.bytes).toBe(Buffer.byteLength(text));

		// Restore on a fresh worktree of the same HEAD.
		const fresh = path.join(root, 'fresh');
		git(repo, 'worktree', 'add', '--quiet', '--detach', fresh, 'feat/a');
		git(fresh, 'apply', file);
		expect(fs.readFileSync(path.join(fresh, 'README.md'), 'utf-8')).toBe('hello\nchanged\n');
		expect(fs.readFileSync(path.join(fresh, 'src', 'new.ts'), 'utf-8')).toBe('export const x = 1;\n');
	});

	it('refuses to overwrite an existing patch and reports a failing git', async () => {
		const file = path.join(root, 'x.patch');
		fs.writeFileSync(file, 'old');
		const runner = (args: string[]) => runCommand('git', args, { env: GIT_ENV });
		await expect(writeArchivePatch(runner, { repoMain: repo, worktreePath: wt, branch: null, head: null, defaultRef: null, commitsNotOnDefault: null }, file, T0)).rejects.toThrow();
		expect(fs.readFileSync(file, 'utf-8')).toBe('old');
		await expect(
			writeArchivePatch(runner, { repoMain: repo, worktreePath: path.join(root, 'nope'), branch: null, head: null, defaultRef: null, commitsNotOnDefault: null }, path.join(root, 'y.patch'), T0),
		).rejects.toThrow(/git diff failed/);
	});
});
