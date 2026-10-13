#!/usr/bin/env node
// Crewly destructive-git guard — a PreToolUse hook for the Bash tool that stops
// an agent from running git commands that destroy its own unmerged work.
//
// Blocked: push --force / -f / --force-with-lease / +refspec (any branch), any
// push to main or master (named, or a bare push while main/master is checked out),
// reset --hard, clean -f (any form that is not a dry run), branch -D (or -d -f),
// checkout . / checkout -- ., restore . (unless --staged only).
// Allowed: a normal `git push origin feat/x`, stash, branch -d, everything read-only.
//
// Usage (wired by the backend through `claude --settings <file>`): the hook reads
// PreToolUse JSON on stdin; no arguments.
// Exit: 0 allowed (stdout says how many commands were checked), 2 blocked (stderr is
// fed back to the agent), 1 could not check (never a silent pass).
//
// Coverage limits: an interpreter one-liner (python -c, node -e), a command built at
// runtime ($VAR, base64, a script the agent writes then runs) and `$(...)` inside
// double quotes are NOT seen. A speed bump, not a boundary (same as control-plane-guard).

import { execFileSync } from 'node:child_process';

const PREFIX = 'destructive-git-guard:';
const PROTECTED_BRANCHES = new Set(['main', 'master']);
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
