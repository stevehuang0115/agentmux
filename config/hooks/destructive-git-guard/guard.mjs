#!/usr/bin/env node
// Crewly destructive-git guard — a PreToolUse hook for the Bash tool that stops
// an agent from running git commands that destroy its own unmerged work.
//
// Blocked: push --force / -f / --force-with-lease / +refspec (any branch),
// push to main or master only when CREWLY_GUARD_BLOCK_MAIN_PUSH=1 (named, or a bare
// push while main/master is checked out; off by default because some teams ship by
// pushing main, e.g. CE and Bitbucket projects),
// reset --hard, clean -f (any form that is not a dry run), branch -D (or -d -f),
// checkout . / checkout -- ., restore . (unless --staged only).
// Allowed: a normal `git push origin feat/x`, stash, branch -d, everything read-only.
//
// Usage (wired by the backend through `claude --settings <file>`): the hook reads
// PreToolUse JSON on stdin; no arguments.
// Exit: 0 allowed (stdout says how many commands were checked), 2 blocked (stderr is
// fed back to the agent), 1 could not check (never a silent pass).
//
// Also blocked (crewly#1369): `gh pr merge` of a PR that is not verified against its base —
// its head is more than CREWLY_GUARD_MERGE_MAX_BEHIND (default 5) commits behind the base
// branch, its CI is not green, or (when behind at all) its latest CI run predates the base
// branch's head. The agent must `gh pr update-branch` and wait for fresh green CI first.
// The check asks GitHub through `gh` (CREWLY_GUARD_GH overrides the binary); when it cannot
// ask, the merge is blocked. CREWLY_GUARD_MERGE_CHECK=0 turns it off.
//
// Coverage limits: an interpreter one-liner (python -c, node -e), a command built at
// runtime ($VAR, base64, a script the agent writes then runs) and `$(...)` inside
// double quotes are NOT seen. A speed bump, not a boundary (same as control-plane-guard).

import { execFileSync } from 'node:child_process';

const PREFIX = 'destructive-git-guard:';
const PROTECTED_BRANCHES = new Set(['main', 'master']);
/** Pushing main/master is blocked only on opt-in: some teams ship by pushing main. */
const BLOCK_MAIN_PUSH = process.env.CREWLY_GUARD_BLOCK_MAIN_PUSH === '1';
const WRAPPERS = new Set(['sudo', 'command', 'nohup', 'time', 'exec', 'env', 'nice', 'builtin', 'stdbuf', 'timeout']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

/** Split a command line into simple commands (arrays of words). Quotes and backslashes are honoured. */
function parseCommands(src) {
	const cmds = [];
	let words = [];
	let cur = '';
	let has = false;
	const pushWord = () => {
		if (has) words.push(cur);
		cur = '';
		has = false;
	};
	const endCmd = () => {
		pushWord();
		if (words.length) cmds.push(words);
		words = [];
	};
	for (let i = 0; i < src.length; i += 1) {
		const c = src[i];
		if (c === "'") {
			const j = src.indexOf("'", i + 1);
			const end = j === -1 ? src.length : j;
			cur += src.slice(i + 1, end);
			has = true;
			i = end;
		} else if (c === '"') {
			let j = i + 1;
			while (j < src.length && src[j] !== '"') {
				if (src[j] === '\\' && j + 1 < src.length && '"\\$`'.includes(src[j + 1])) j += 1;
				cur += src[j];
				j += 1;
			}
			has = true;
			i = j;
		} else if (c === '\\') {
			if (i + 1 < src.length && src[i + 1] !== '\n') {
				cur += src[i + 1];
				has = true;
			}
			i += 1;
		} else if (c === '$' && src[i + 1] === '(') {
			endCmd();
			i += 1;
		} else if (';\n()`{}&|'.includes(c)) {
			endCmd();
		} else if (/\s/.test(c)) {
			pushWord();
		} else {
			cur += c;
			has = true;
		}
	}
	endCmd();
	return cmds;
}

/** Drop leading VAR=value words and wrappers (sudo, env, ...). */
function stripWrappers(words) {
	let i = 0;
	for (;;) {
		const w = words[i];
		if (w === undefined) break;
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) i += 1;
		else if (WRAPPERS.has(w.split('/').pop())) {
			const wrapper = w.split('/').pop();
			i += 1;
			while (words[i] !== undefined && words[i].startsWith('-')) i += 1;
			if (wrapper === 'timeout') i += 1;
		} else break;
	}
	return words.slice(i);
}

/** Current branch of `cwd`, or '' when it cannot be read. */
function currentBranch(cwd, dir) {
	try {
		return execFileSync('git', ['-C', dir ?? cwd, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
	} catch {
		return '';
	}
}

const hasShort = (flags, letter) => flags.some((f) => /^-[A-Za-z]+$/.test(f) && f.includes(letter));

/** @returns {string|null} why `git <sub> <rest>` is destructive, or null. */
function judgeGit(sub, rest, cwd, dir) {
	const flags = rest.filter((a) => a.startsWith('-'));
	const pos = rest.filter((a) => !a.startsWith('-'));
	switch (sub) {
		case 'push': {
			if (hasShort(flags, 'f') || flags.some((f) => f === '--force' || f.startsWith('--force-with-lease') || f === '--force-if-includes' || f === '--mirror')) {
				return 'force-push rewrites remote history';
			}
			const refs = pos.slice(1); // pos[0] is the remote
			if (refs.some((r) => r.startsWith('+'))) return 'a +refspec is a force-push';
			const target = (r) => r.replace(/^\+/, '').split(':').pop().replace(/^refs\/heads\//, '');
			if (!BLOCK_MAIN_PUSH) return null;
			if (refs.some((r) => PROTECTED_BRANCHES.has(target(r)))) return 'pushing to main/master directly';
			if (refs.length === 0 && PROTECTED_BRANCHES.has(currentBranch(cwd, dir))) return 'pushing main/master directly';
			return null;
		}
		case 'reset':
			return flags.includes('--hard') ? 'reset --hard discards uncommitted and unpushed work' : null;
		case 'clean':
			if (flags.includes('--dry-run') || hasShort(flags, 'n')) return null;
			return hasShort(flags, 'f') || flags.includes('--force') ? 'clean -f deletes untracked files for good' : null;
		case 'branch':
			if (hasShort(flags, 'D')) return 'branch -D deletes a branch even when it is unmerged';
			if (flags.includes('--delete') && (flags.includes('--force') || hasShort(flags, 'f'))) return 'forced branch delete';
			if (hasShort(flags, 'd') && hasShort(flags, 'f')) return 'forced branch delete';
			return null;
		case 'checkout':
			return rest.includes('.') && !flags.some((f) => f === '-b' || f === '-B') ? 'checkout . discards every uncommitted change' : null;
		case 'restore':
			if (pos.includes('.') && !(flags.includes('--staged') && !flags.includes('--worktree') && !hasShort(flags, 'W'))) {
				return 'restore . discards every uncommitted change';
			}
			return null;
		default:
			return null;
	}
}

/** Max commits a PR head may be behind its base when an agent merges it. */
const MERGE_MAX_BEHIND = (() => {
	const n = Number(process.env.CREWLY_GUARD_MERGE_MAX_BEHIND);
	return Number.isFinite(n) && n >= 0 ? n : 5;
})();
const MERGE_CHECK_ON = process.env.CREWLY_GUARD_MERGE_CHECK !== '0';
const GH_BIN = process.env.CREWLY_GUARD_GH || 'gh';
const GH_TIMEOUT_MS = 20000;
/** `gh pr merge` flags that take a value. */
const GH_MERGE_VALUE_FLAGS = new Set(['-R', '--repo', '-t', '--subject', '-b', '--body', '-F', '--body-file', '-A', '--author-email', '--match-head-commit']);
/** Check results that count as green. */
const GREEN = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** Run gh and return stdout (throws on failure). */
function gh(args, dir) {
	return execFileSync(GH_BIN, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: GH_TIMEOUT_MS }).trim();
}

/** Name and verdict of one statusCheckRollup entry (CheckRun or StatusContext). */
function checkState(c) {
	const name = c.name || c.context || 'check';
	if (c.__typename === 'StatusContext' || (c.state && !c.status)) return { name, green: GREEN.has(String(c.state).toUpperCase()), at: c.startedAt || c.createdAt };
	const done = String(c.status || '').toUpperCase() === 'COMPLETED';
	return { name, green: done && GREEN.has(String(c.conclusion || '').toUpperCase()), at: c.completedAt || c.startedAt };
}

/** @returns {string|null} why `gh pr merge <rest>` is not a verified merge, or null. */
function judgePrMerge(rest, dir) {
	if (!MERGE_CHECK_ON || rest.includes('--disable-auto')) return null;
	let repo = null;
	let sel = null;
	for (let i = 0; i < rest.length; i += 1) {
		const a = rest[i];
		if (a === '-R' || a === '--repo') repo = rest[i + 1] ?? null;
		if (a.startsWith('--repo=')) repo = a.slice('--repo='.length);
		if (GH_MERGE_VALUE_FLAGS.has(a)) i += 1;
		else if (!a.startsWith('-') && sel === null) sel = a;
	}
	const repoArgs = repo ? ['-R', repo] : [];
	let pr;
	try {
		pr = JSON.parse(gh(['pr', 'view', ...(sel ? [sel] : []), ...repoArgs, '--json', 'number,url,baseRefName,headRefOid,statusCheckRollup'], dir));
	} catch {
		return 'could not read the PR with gh to check it is up to date with its base and has fresh green CI (fix gh auth / network and retry)';
	}
	const m = /github\.com\/([^/]+)\/([^/]+)\/pull\//.exec(String(pr.url || ''));
	if (!m) return `could not tell which GitHub repo PR ${pr.number ?? sel ?? ''} is in`;
	const api = `repos/${m[1]}/${m[2]}`;
	const base = String(pr.baseRefName || 'main');
	let behind;
	let baseAt;
	try {
		behind = Number(gh(['api', `${api}/compare/${encodeURIComponent(base)}...${pr.headRefOid}`, '--jq', '.behind_by'], dir));
		baseAt = Date.parse(gh(['api', `${api}/commits/${encodeURIComponent(base)}`, '--jq', '.commit.committer.date'], dir));
	} catch {
		return `could not compare PR #${pr.number} with ${base} on GitHub (fix gh auth / network and retry)`;
	}
	if (!Number.isFinite(behind)) return `could not compare PR #${pr.number} with ${base} on GitHub`;
	const n = pr.number;
	if (behind > MERGE_MAX_BEHIND) return `PR #${n} is ${behind} commits behind ${base} (more than ${MERGE_MAX_BEHIND}); its CI did not run on what the merge would produce`;
	const checks = (Array.isArray(pr.statusCheckRollup) ? pr.statusCheckRollup : []).map(checkState);
	const notGreen = checks.filter((c) => !c.green).map((c) => c.name);
	if (notGreen.length > 0) return `CI is not green on PR #${n} (${notGreen.slice(0, 5).join(', ')})`;
	if (behind > 0) {
		if (checks.length === 0) return `PR #${n} is ${behind} commit(s) behind ${base} and has no CI run to show the merge result works`;
		const latest = Math.max(...checks.map((c) => Date.parse(c.at || '')).filter((t) => Number.isFinite(t)));
		if (!Number.isFinite(latest) || (Number.isFinite(baseAt) && latest < baseAt)) {
			return `PR #${n}'s latest CI run predates the head of ${base} (the PR is ${behind} commit(s) behind)`;
		}
	}
	return null;
}

let checked = 0;

function analyze(command, cwd, depth = 0) {
	for (const raw of parseCommands(command)) {
		const words = stripWrappers(raw);
		if (!words.length) continue;
		checked += 1;
		const verb = words[0].split('/').pop();
		if (SHELLS.has(verb)) {
			const ci = words.findIndex((a, i) => i > 0 && /^-[a-z]*c$/.test(a));
			if (ci !== -1 && words[ci + 1] !== undefined && depth < 4) analyze(words[ci + 1], cwd, depth + 1);
			continue;
		}
		if (verb === 'gh') {
			if (words[1] === 'pr' && words[2] === 'merge') {
				const reason = judgePrMerge(words.slice(3), cwd);
				if (reason) denyMerge(`\`gh ${words.slice(1).join(' ')}\` — ${reason}`);
			}
			continue;
		}
		if (verb !== 'git') continue;
		let i = 1;
		let dir = null;
		while (i < words.length && words[i].startsWith('-')) {
			if (words[i] === '-C') {
				dir = words[i + 1] ?? dir;
				i += 2;
			} else if (words[i] === '-c' || words[i] === '--git-dir' || words[i] === '--work-tree' || words[i] === '--namespace') i += 2;
			else i += 1;
		}
		const reason = judgeGit(words[i] ?? '', words.slice(i + 1), cwd, dir);
		if (reason) deny(`\`git ${words.slice(i).join(' ')}\` — ${reason}`);
	}
}

function deny(what) {
	process.stderr.write(
		`${PREFIX} BLOCKED — ${what}.\n` +
			`${PREFIX} You do not have authority to run this. Safer: stash first (git stash -u), delete a merged branch with -d, ` +
			'push your feature branch normally (no force) and open a PR, or ask your team lead if it is really needed.\n',
	);
	process.exit(2);
}

function denyMerge(what) {
	process.stderr.write(
		`${PREFIX} BLOCKED — ${what}.\n` +
			`${PREFIX} A merge on stale or missing CI is not a verified merge. Run \`gh pr update-branch <PR>\`, wait for CI to pass on the updated branch ` +
			'(`gh pr checks <PR> --watch`), then merge. If the update conflicts, resolve it on the branch and push; do not merge around it.\n',
	);
	process.exit(2);
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
	let input;
	try {
		input = JSON.parse(raw);
	} catch {
		process.stderr.write(`${PREFIX} unparsable hook input — 0 command(s) checked\n`);
		process.exit(1);
	}
	const command = input?.tool_input?.command;
	if (String(input?.tool_name ?? '') !== 'Bash' || typeof command !== 'string') {
		process.stdout.write(`${PREFIX} allowed — not a Bash call, 0 command(s) checked\n`);
		process.exit(0);
	}
	const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
	analyze(command, cwd);
	process.stdout.write(`${PREFIX} allowed — ${checked} command(s) checked\n`);
	process.exit(0);
});
