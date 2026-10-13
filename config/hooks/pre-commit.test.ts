import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** Tests for the debug-tag scan in the pre-commit hook (debugging SOP). */
const HOOK = join(__dirname, 'pre-commit');
const TAG = '[DEBUG-' + 'a4f2]'; // built at runtime so this file is not itself flagged

let repo: string;
const git = (...args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf-8' });
const hook = () =>
	spawnSync('bash', [HOOK], {
		cwd: repo,
		encoding: 'utf-8',
		// Unreachable API: the hook degrades gracefully, so only the tag scan decides.
		env: { ...process.env, CREWLY_PORT: '1', CREWLY_TIMEOUT: '1' },
	});

beforeEach(() => {
	repo = mkdtempSync(join(tmpdir(), 'pc-'));
	git('init', '-q');
	git('config', 'user.email', 't@t');
	git('config', 'user.name', 't');
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('pre-commit debug-tag scan', () => {
	it('rejects a staged tagged debug log and reports the scan count', () => {
		writeFileSync(join(repo, 'a.ts'), `console.log('${TAG} x');\n`);
		writeFileSync(join(repo, 'b.ts'), 'export const b = 1;\n');
		git('add', '.');
		const r = hook();
		expect(r.status).toBe(1);
		expect(r.stdout).toContain('2 file(s) scanned');
		expect(r.stdout).toContain('a.ts');
	});

	it('passes clean files and reports the count', () => {
		writeFileSync(join(repo, 'b.ts'), 'export const b = 1;\n');
		git('add', '.');
		const r = hook();
		expect(r.status).toBe(0);
		expect(r.stdout).toContain('1 file(s) scanned');
	});

	it('ignores the tag in markdown docs', () => {
		writeFileSync(join(repo, 'doc.md'), `use ${TAG}\n`);
		git('add', '.');
		expect(hook().status).toBe(0);
	});

	it('fails when the staged list cannot be read', () => {
		const r = spawnSync('bash', [HOOK], { cwd: tmpdir(), encoding: 'utf-8', env: { ...process.env, GIT_DIR: join(repo, 'nope') } });
		expect(r.status).toBe(1);
		expect(r.stdout).toContain('could not read the staged file list');
	});
});
