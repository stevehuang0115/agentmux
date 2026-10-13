/**
 * Worktree janitor — "has this work landed?" checks that do not depend on the
 * git host.
 *
 * A squash merge (Bitbucket, GitLab, GitHub "squash and merge") leaves the
 * branch tip out of the default branch's history, so `merge-base
 * --is-ancestor` says "not merged" forever. These checks look at CONTENT:
 *
 * 1. Tree containment: merging HEAD into `origin/<default>` changes nothing
 *    (`git merge-tree --write-tree` yields exactly the default branch's tree).
 *    Needs git >= 2.38; older git falls back to `git cherry`.
 * 2. Squash patch-equivalence: the combined diff `merge-base..HEAD` has the
 *    same patch-id as one commit that the default branch gained since — the
 *    squash commit. Also catches the case where the default branch has since
 *    changed the same files (check 1 then conflicts).
 *
 * Both are read-only (merge-tree writes loose objects only) and bounded by
 * the per-command timeout. Work that is in neither is NOT landed and stays.
 *
 * @module services/worktree/worktree-landed
 */

import { WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import type { CommandResult, RunCommandOptions } from './worktree-janitor.git.js';

/** Runs `git <args>` (the service binds the git binary). */
export type GitRunner = (args: string[], options?: RunCommandOptions) => Promise<CommandResult>;

/** Which content signal proved the work landed. */
export type LandedSignal = 'tree-contained' | 'squash-equivalent';

/** Per-repo memo so unsupported features are probed once. */
export interface LandedRepoState {
	/** False once `git merge-tree --write-tree` proved unsupported (git < 2.38) */
	mergeTreeSupported?: boolean;
	/** Tree object id of the default ref, resolved once per pass */
	defaultTree?: string | null;
}

/** First line of `git patch-id` output: `<patch-id> <commit-id>`. */
function patchIdOf(output: string): string | null {
	const first = output.split('\n').find((l) => l.trim() !== '');
	const id = first?.trim().split(/\s+/)[0];
	return id && /^[0-9a-f]{8,}$/i.test(id) ? id : null;
}

/**
 * Whether merging `head` into `defaultRef` would change nothing.
 *
 * @param git - git runner
 * @param repo - Main worktree of the repo
 * @param defaultRef - e.g. `origin/main`
 * @param head - Worktree HEAD commit
 * @param state - Per-repo memo (mutated)
 * @returns True when HEAD's changes are already in the default branch
 */
export async function isTreeContained(git: GitRunner, repo: string, defaultRef: string, head: string, state: LandedRepoState): Promise<boolean> {
	if (state.defaultTree === undefined) {
		const t = await git(['-C', repo, 'rev-parse', '--verify', '--quiet', `${defaultRef}^{tree}`]);
		state.defaultTree = t.code === 0 && t.stdout.trim() ? t.stdout.trim() : null;
	}
	if (!state.defaultTree) return false;

	if (state.mergeTreeSupported !== false) {
		const r = await git(['-C', repo, 'merge-tree', '--write-tree', '--no-messages', defaultRef, head]);
		if (r.code === 0) {
			state.mergeTreeSupported = true;
			return r.stdout.split('\n')[0]?.trim() === state.defaultTree;
		}
		// Exit 1 = conflicts: not contained.
		if (r.code === 1) {
			state.mergeTreeSupported = true;
			return false;
		}
		// Usage error = git < 2.38 (fall through to `git cherry`); a timeout or
		// other failure just means "not proven".
		if (!/usage|unknown option|not a git command|unrecognized/i.test(r.stderr)) return false;
		state.mergeTreeSupported = false;
	}

	// git < 2.38: every commit of HEAD has a patch-equivalent in the default branch.
	const cherry = await git(['-C', repo, 'cherry', defaultRef, head]);
	if (cherry.code !== 0) return false;
	const lines = cherry.stdout.split('\n').filter((l) => l.trim() !== '');
	return lines.every((l) => l.startsWith('-'));
}

/**
 * Whether the combined change of the branch (`merge-base..head`) equals one
 * commit the default branch gained since — a squash merge, possibly followed
 * by other changes to the same files.
 *
 * @param git - git runner
 * @param repo - Main worktree of the repo
 * @param defaultRef - e.g. `origin/main`
 * @param head - Worktree HEAD commit
 * @returns True when a squash-equivalent commit exists on the default branch
 */
export async function isSquashEquivalent(git: GitRunner, repo: string, defaultRef: string, head: string): Promise<boolean> {
	const mb = await git(['-C', repo, 'merge-base', defaultRef, head]);
	const base = mb.code === 0 ? mb.stdout.trim() : '';
	if (!base) return false;

	const diff = await git(['-C', repo, 'diff', '--binary', '--no-ext-diff', base, head]);
	if (diff.code !== 0 || diff.stdout.trim() === '') return false;
	const mine = await git(['-C', repo, 'patch-id', '--stable'], { input: diff.stdout });
	const wanted = mine.code === 0 ? patchIdOf(mine.stdout) : null;
	if (!wanted) return false;

	const log = await git([
		'-C', repo, 'log', '-p', '--binary', '--no-ext-diff', '--no-merges', '--format=commit %H',
		`--max-count=${WORKTREE_JANITOR_CONSTANTS.SQUASH_SEARCH_MAX_COMMITS}`, `${base}..${defaultRef}`,
	]);
	if (log.code !== 0 || log.stdout === '') return false;
	const theirs = await git(['-C', repo, 'patch-id', '--stable'], { input: log.stdout });
	if (theirs.code !== 0) return false;
	return theirs.stdout.split('\n').some((l) => l.trim().split(/\s+/)[0] === wanted);
}

/**
 * Run the content checks in order of cost.
 *
 * @param git - git runner
 * @param repo - Main worktree of the repo
 * @param defaultRef - e.g. `origin/main`
 * @param head - Worktree HEAD commit
 * @param state - Per-repo memo
 * @returns The signal that proved the work landed, or null
 */
export async function contentLandedSignal(git: GitRunner, repo: string, defaultRef: string, head: string, state: LandedRepoState): Promise<LandedSignal | null> {
	if (await isTreeContained(git, repo, defaultRef, head, state)) return 'tree-contained';
	if (await isSquashEquivalent(git, repo, defaultRef, head)) return 'squash-equivalent';
	return null;
}

/**
 * Whether a remote URL is clearly not GitHub (so `gh` cannot know its PRs).
 * Local paths and unknown shapes return false: gh is then still tried.
 *
 * @param url - `remote.origin.url` as configured (not rewritten by insteadOf)
 * @returns True for ssh/http(s) URLs whose host does not contain `github`
 */
export function isNonGithubRemote(url: string): boolean {
	const m = /^(?:[\w.+-]+@|(?:ssh|https?|git):\/\/(?:[^@/]+@)?)([^:/\s]+)/.exec(url.trim());
	return !!m && !/github/i.test(m[1]);
}
