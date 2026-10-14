import * as path from 'path';
import { DESTRUCTIVE_GIT_GUARD_CONSTANTS } from '../../constants.js';

/**
 * Destructive-git guard: keeps agents from destroying their own unmerged work
 * with force-push, push to main/master, `reset --hard`, `clean -f`,
 * `branch -D`, `checkout .` or `restore .`.
 *
 * The hook (`config/hooks/destructive-git-guard/guard.mjs`) rides in the
 * control-plane `--settings` file for Claude Code. Plain `git push` of a
 * feature branch stays allowed.
 *
 * Coverage gaps (documented, not hidden): Codex, Gemini CLI and Antigravity
 * get no destructive-git hook; an interpreter one-liner or a command built at
 * runtime is not seen by any runtime.
 */

const C = DESTRUCTIVE_GIT_GUARD_CONSTANTS;

/** Hook command and matcher for one session. */
export interface DestructiveGitGuard {
	hookCommand: string;
	matcher: string;
}

/**
 * Whether the guard is on for sessions launched by this backend.
 *
 * @param env - Environment to read (defaults to the backend's process.env)
 * @returns false only when `CREWLY_DESTRUCTIVE_GIT_GUARD=0`
 */
export function isDestructiveGitGuardEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return env[C.KILL_SWITCH_ENV] !== C.KILL_SWITCH_OFF_VALUE;
}

/**
 * Prepare the guard for a session.
 *
 * @param installRoot - Install root holding `config/hooks`
 * @param env - Environment holding the kill switch
 * @returns The hook description, or null when disabled
 */
export function prepareDestructiveGitGuard(installRoot: string, env: NodeJS.ProcessEnv = process.env): DestructiveGitGuard | null {
	if (!isDestructiveGitGuardEnabled(env)) return null;
	const script = path.join(installRoot, C.HOOK_SCRIPT);
	const q = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`;
	return { hookCommand: `${q(process.execPath)} ${q(script)}`, matcher: C.CLAUDE_MATCHER };
}
