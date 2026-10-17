/**
 * Tests for the tmp / log janitor — a fake CREWLY_HOME/tmp and logs dir under
 * os.tmpdir(), a fake clock.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { capDirectoryBytes, shallowBytes, sweepTmp } from './tmp-janitor.js';
import { WORKTREE_JANITOR_CONSTANTS as C } from '../../constants.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

/** Create a file (dirs made) and set its and its parents' mtime to `ageMs` ago. */
function touch(file: string, ageMs: number, content = 'x'): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, content);
	const at = new Date(NOW - ageMs);
	fs.utimesSync(file, at, at);
}

/** Set the mtime of a dir and everything in it (depth 3) to `ageMs` ago. */
function age(p: string, ageMs: number): void {
	const at = new Date(NOW - ageMs);
	const walk = (q: string, level: number): void => {
		fs.utimesSync(q, at, at);
		if (level >= 3 || !fs.lstatSync(q).isDirectory()) return;
		for (const n of fs.readdirSync(q)) walk(path.join(q, n), level + 1);
	};
	walk(p, 0);
}

describe('sweepTmp', () => {
	let root: string;

	beforeEach(() => {
		root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-janitor-')));
		touch(path.join(root, 'old-preview', 'index.html'), 10 * DAY);
		age(path.join(root, 'old-preview'), 10 * DAY);
		touch(path.join(root, 'fresh-preview', 'index.html'), DAY);
		age(path.join(root, 'fresh-preview'), DAY);
		touch(path.join(root, 'old-file.png'), 9 * DAY);
		touch(path.join(root, 'slack-files', 'b.pdf'), 40 * DAY);
		age(path.join(root, 'slack-files'), 40 * DAY);
		touch(path.join(root, 'slack-files', 'a.pdf'), 20 * DAY);
		touch(path.join(root, 'crewly-web-release', '1.0.145', 'dist.js'), 3 * DAY);
		age(path.join(root, 'crewly-web-release', '1.0.145'), 3 * DAY);
		touch(path.join(root, 'crewly-web-release', '1.0.147', 'dist.js'), HOUR);
		age(path.join(root, 'crewly-web-release', '1.0.147'), HOUR);
		touch(path.join(root, 'skill-output', 'r1.md'), 8 * DAY);
		touch(path.join(root, 'leo-wt', '.git'), 30 * DAY, 'gitdir: /somewhere/.git/worktrees/leo-wt');
		touch(path.join(root, 'leo-wt', 'src.ts'), 30 * DAY);
		age(path.join(root, 'leo-wt'), 30 * DAY);
		touch(path.join(root, 'busy-dir', 'work.txt'), 30 * DAY);
		age(path.join(root, 'busy-dir'), 30 * DAY);
		fs.symlinkSync(path.join(root, 'old-preview'), path.join(root, 'link'));
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('dry run plans by age and policy, keeps git checkouts, busy dirs and symlinks', async () => {
		const s = await sweepTmp({ root, busy: [{ cwd: path.join(root, 'busy-dir', 'sub'), source: 'process' }], now: NOW, dryRun: true });
		const would = s.entries.filter((e) => e.decision === 'remove').map((e) => path.relative(root, e.path)).sort();
		expect(would).toEqual(['crewly-web-release/1.0.145', 'old-file.png', 'old-preview', 'skill-output/r1.md', 'slack-files/b.pdf'].sort());
		expect(s.wouldRemove).toBe(5);
		expect(s.wouldFreeBytes).toBeGreaterThan(0);
		expect(s.removed).toBe(0);
		expect(s.keptReasons).toMatchObject({ 'contains-git': 1, 'process-inside': 1, symlink: 1 });
		expect(s.keptReasons.recent).toBeGreaterThanOrEqual(3);
		expect(fs.existsSync(path.join(root, 'old-preview'))).toBe(true);
	});

	it('a real pass removes exactly the planned entries', async () => {
		const s = await sweepTmp({ root, busy: [], now: NOW, dryRun: false });
		expect(s.removed).toBe(6); // busy-dir is no longer busy
		expect(fs.existsSync(path.join(root, 'old-preview'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'old-file.png'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'slack-files', 'b.pdf'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'slack-files', 'a.pdf'))).toBe(true);
		expect(fs.existsSync(path.join(root, 'slack-files'))).toBe(true);
		expect(fs.existsSync(path.join(root, 'crewly-web-release', '1.0.145'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'crewly-web-release', '1.0.147'))).toBe(true);
		expect(fs.existsSync(path.join(root, 'skill-output', 'r1.md'))).toBe(false);
		expect(fs.existsSync(path.join(root, 'leo-wt', 'src.ts'))).toBe(true);
		expect(fs.existsSync(path.join(root, 'fresh-preview'))).toBe(true);
		expect(fs.lstatSync(path.join(root, 'link')).isSymbolicLink()).toBe(true);
	});

	it('keeps everything when the cwd probe failed, and a missing root is fine', async () => {
		const s = await sweepTmp({ root, busy: null, now: NOW, dryRun: false });
		expect(s.removed).toBe(0);
		expect(s.keptReasons['cwd-probe-failed']).toBeGreaterThan(0);
		expect(await sweepTmp({ root: path.join(root, 'nope'), busy: [], now: NOW, dryRun: false })).toMatchObject({ removed: 0, kept: 0 });
		expect(C.TMP_MAX_AGE_MS).toBe(7 * DAY);
		expect(C.TMP_CHILD_POLICIES['slack-files']).toBe(30 * DAY);
		expect(C.TMP_CHILD_POLICIES['crewly-web-release']).toBe(2 * DAY);
	});
});

describe('capDirectoryBytes', () => {
	let dir: string;

	beforeEach(() => {
		dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
		touch(path.join(dir, 'a-oldest.gz'), 10 * DAY, 'a'.repeat(400));
		touch(path.join(dir, 'b.gz'), 5 * DAY, 'b'.repeat(400));
		touch(path.join(dir, 'live.log'), 3 * DAY, 'c'.repeat(400));
		touch(path.join(dir, 'fresh.log'), 10 * 60 * 1000, 'd'.repeat(400));
		fs.mkdirSync(path.join(dir, 'subdir'));
	});

	afterEach(() => {
		fs.rmSync(dir, { recursive: true, force: true });
	});

	it('deletes the oldest files until under the cap, skipping protected and fresh ones', async () => {
		const dry = await capDirectoryBytes({ dir, capBytes: 900, now: NOW, dryRun: true, protect: (n) => n === 'live.log' });
		expect(dry).toMatchObject({ totalBytes: 1600, wouldDelete: ['a-oldest.gz', 'b.gz'], wouldFreeBytes: 800, deleted: [], overCapBytes: 0 });
		const real = await capDirectoryBytes({ dir, capBytes: 900, now: NOW, dryRun: false, protect: (n) => n === 'live.log' });
		expect(real.deleted).toEqual(['a-oldest.gz', 'b.gz']);
		expect(fs.existsSync(path.join(dir, 'live.log'))).toBe(true);
		expect(fs.existsSync(path.join(dir, 'fresh.log'))).toBe(true);
		// Only protected / fresh files left: what remains over the cap is reported.
		const again = await capDirectoryBytes({ dir, capBytes: 100, now: NOW, dryRun: false, protect: (n) => n === 'live.log' });
		expect(again.deleted).toEqual([]);
		expect(again.overCapBytes).toBe(700);
		expect(await shallowBytes(dir)).toBeGreaterThanOrEqual(800);
		expect(C.LOG_ARCHIVE_CAP_BYTES).toBe(300 * 1024 ** 2);
		expect(C.LOG_SESSIONS_CAP_BYTES).toBe(100 * 1024 ** 2);
	});
});
