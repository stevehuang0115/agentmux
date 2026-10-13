import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Tests for the destructive-git guard hook. Each test runs the real script with a
 * PreToolUse payload on stdin. Exit: 0 allowed, 2 blocked, 1 could not check.
 */
const HOOK = join(__dirname, 'guard.mjs');

let cwd: string;
beforeEach(() => {
	cwd = mkdtempSync(join(tmpdir(), 'dgg-'));
	spawnSync('git', ['init', '-q', '-b', 'feat/x'], { cwd });
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

function run(command: string, tool = 'Bash') {
	const r = spawnSync('node', [HOOK], {
		input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command }, cwd }),
		encoding: 'utf-8',
	});
	return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('blocked forms', () => {
	const blocked = [
		'git push --force origin feat/x',
		'git push -f origin feat/x',
		'git push origin feat/x --force-with-lease',
		'git push --force-with-lease=feat/x origin feat/x',
		'git push origin +feat/x',
		'git push origin main',
		'git push origin HEAD:master',
		'git reset --hard',
		'git reset --hard HEAD~1',
		'git clean -f',
		'git clean -fd',
		'git clean -xdf',
		'git clean --force',
		'git branch -D old',
		'git branch --delete --force old',
		'git checkout .',
		'git checkout -- .',
		'git restore .',
		'git -C /tmp/x reset --hard',
		'cd repo && git reset --hard',
		'sudo git push -f origin x',
		'FOO=1 git clean -fd',
		'bash -c "git reset --hard"',
		'echo hi; git branch -D old',
	];
	it.each(blocked)('blocks `%s`', (cmd) => {
		const r = run(cmd);
		expect(r.status).toBe(2);
		expect(r.stderr).toContain('destructive-git-guard: BLOCKED');
		expect(r.stderr).toContain('stash');
	});

	it('blocks a bare push while main is checked out', () => {
		spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd });
		expect(run('git push').status).toBe(2);
	});
});

describe('allowed forms', () => {
	const allowed = [
		'git push origin feat/x',
		'git push -u origin feat/x',
		'git push',
		'git reset --soft HEAD~1',
		'git reset HEAD file.ts',
		'git clean -n',
		'git clean -nfd',
		'git branch -d merged',
		'git branch --list',
		'git checkout -b new-branch',
		'git checkout feat/y',
		'git checkout -- src/file.ts',
		'git restore --staged .',
		'git restore src/file.ts',
		'git stash -u',
		'git status && git diff',
		'ls -la',
	];
	it.each(allowed)('allows `%s`', (cmd) => {
		const r = run(cmd);
		expect(r.status).toBe(0);
		expect(r.stdout).toMatch(/\d+ command\(s\) checked/);
	});

	it('ignores non-Bash tools and says nothing was checked', () => {
		const r = run('git reset --hard', 'Read');
		expect(r.status).toBe(0);
		expect(r.stdout).toContain('0 command(s) checked');
	});
});

describe('could not check', () => {
	it('exits 1 on unparsable input', () => {
		const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf-8' });
		expect(r.status).toBe(1);
		expect(r.stderr).toContain('0 command(s) checked');
	});
});
