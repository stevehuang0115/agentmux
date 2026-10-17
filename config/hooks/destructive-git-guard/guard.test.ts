import { spawnSync } from 'child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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

function run(command: string, tool = 'Bash', env: NodeJS.ProcessEnv = {}) {
	const r = spawnSync('node', [HOOK], {
		env: { ...process.env, CREWLY_GUARD_BLOCK_MAIN_PUSH: '', ...env },
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

	it.each(['git push origin main', 'git push origin HEAD:master'])('blocks `%s` when main pushes are opted in', (cmd) => {
		expect(run(cmd, 'Bash', { CREWLY_GUARD_BLOCK_MAIN_PUSH: '1' }).status).toBe(2);
	});

	it('blocks a bare push while main is checked out when main pushes are opted in', () => {
		spawnSync('git', ['checkout', '-q', '-b', 'main'], { cwd });
		expect(run('git push', 'Bash', { CREWLY_GUARD_BLOCK_MAIN_PUSH: '1' }).status).toBe(2);
	});

	it.each(['git push origin main', 'git push origin HEAD:master'])('allows `%s` by default (some teams ship by pushing main)', (cmd) => {
		expect(run(cmd).status).toBe(0);
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

describe('gh pr merge (crewly#1369)', () => {
	const BASE_AT = '2026-10-17T10:00:00Z';
	const BEFORE = '2026-10-17T09:00:00Z';
	const AFTER = '2026-10-17T11:00:00Z';
	const green = (at: string) => [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: at }];

	/** A fake `gh` that answers from canned values; `fail` makes `pr view` fail. */
	function fakeGh(opts: { behind?: number; checks?: unknown[]; fail?: boolean }): string {
		const file = join(cwd, 'fake-gh.js');
		const pr = { number: 42, url: 'https://github.com/o/r/pull/42', baseRefName: 'main', headRefOid: 'abc', statusCheckRollup: opts.checks ?? green(AFTER) };
		writeFileSync(
			file,
			`#!/usr/bin/env node
const a = process.argv.slice(2);
if (${opts.fail ? 'true' : 'false'}) { process.stderr.write('auth'); process.exit(1); }
if (a[0] === 'pr' && a[1] === 'view') { process.stdout.write(${JSON.stringify(JSON.stringify(pr))}); process.exit(0); }
if (a[0] === 'api' && a[1].includes('/compare/main...abc')) { process.stdout.write('${opts.behind ?? 0}'); process.exit(0); }
if (a[0] === 'api' && a[1].endsWith('/commits/main')) { process.stdout.write('${BASE_AT}'); process.exit(0); }
process.exit(3);
`,
		);
		chmodSync(file, 0o755);
		return file;
	}

	const merge = (gh: string, cmd = 'gh pr merge 42 --squash', env: NodeJS.ProcessEnv = {}) => run(cmd, 'Bash', { CREWLY_GUARD_GH: gh, ...env });

	it('allows an up-to-date PR with green CI', () => {
		expect(merge(fakeGh({ behind: 0 })).status).toBe(0);
	});

	it('allows a PR a little behind when CI ran after the base head', () => {
		expect(merge(fakeGh({ behind: 2, checks: green(AFTER) })).status).toBe(0);
	});

	it('blocks a PR too far behind base and says to update the branch', () => {
		const r = merge(fakeGh({ behind: 12 }), 'gh pr merge 42 --squash --delete-branch');
		expect(r.status).toBe(2);
		expect(r.stderr).toContain('12 commits behind main');
		expect(r.stderr).toContain('gh pr update-branch');
	});

	it('honours CREWLY_GUARD_MERGE_MAX_BEHIND', () => {
		expect(merge(fakeGh({ behind: 2 }), undefined, { CREWLY_GUARD_MERGE_MAX_BEHIND: '1' }).status).toBe(2);
	});

	it('blocks when behind and the latest CI predates the base head', () => {
		const r = merge(fakeGh({ behind: 1, checks: green(BEFORE) }));
		expect(r.status).toBe(2);
		expect(r.stderr).toContain('predates the head of main');
	});

	it('blocks when CI is failing or still running', () => {
		expect(merge(fakeGh({ checks: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: AFTER }] })).stderr).toContain('CI is not green');
		expect(merge(fakeGh({ checks: [{ __typename: 'CheckRun', name: 'build', status: 'IN_PROGRESS', conclusion: '' }] })).status).toBe(2);
		expect(merge(fakeGh({ checks: [{ __typename: 'StatusContext', context: 'ci/x', state: 'PENDING' }] })).status).toBe(2);
	});

	it('blocks when gh cannot be asked (fail closed)', () => {
		const r = merge(fakeGh({ fail: true }));
		expect(r.status).toBe(2);
		expect(r.stderr).toContain('could not read the PR');
	});

	it('checks merges inside a chain and passes -R through', () => {
		expect(merge(fakeGh({ behind: 9 }), 'cd /tmp && gh pr merge -R o/r 42').status).toBe(2);
	});

	it('leaves other gh commands, --disable-auto and the off switch alone', () => {
		const gh = fakeGh({ behind: 50 });
		expect(merge(gh, 'gh pr view 42').status).toBe(0);
		expect(merge(gh, 'gh pr merge 42 --disable-auto').status).toBe(0);
		expect(merge(gh, undefined, { CREWLY_GUARD_MERGE_CHECK: '0' }).status).toBe(0);
	});
});
