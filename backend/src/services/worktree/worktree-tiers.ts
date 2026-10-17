/**
 * Worktree age tiers — what the janitor does with a worktree it must keep
 * (unmerged or dirty) once nobody has touched it for days (crewly#1354).
 *
 * The 1.20.159 janitor removes only worktrees whose work has landed. Every
 * other one stayed forever with a full `node_modules` (2–3 GB each; one Mac
 * kept 21 of them, ~15 GB). Two tiers now apply to a kept worktree that is
 * untouched — no file, no index write, no commit newer — and has no process
 * inside:
 *
 * - **strip** (idle ≥ 3 days; 1 day under low disk or once its WorkItem
 *   finished): delete its regenerable dirs (`node_modules`, `.next`, `dist`,
 *   `.turbo`, `.cache`) — never a directory git tracks anything under, never
 *   source. Reversible with `npm install` / a rebuild.
 * - **archive** (idle ≥ 14 days): save its tracked changes (`git diff HEAD
 *   --binary`) and its untracked, non-regenerable files as one patch under
 *   `<CREWLY_HOME>/worktree-archive/<repo>/<name>-<date>.patch` (size-capped),
 *   keep its branch (its commits stay in the repo; a detached HEAD gets a
 *   `refs/crewly-archive/...` ref), then remove the worktree.
 *
 * The lead of the owning team is told once per worktree per tier. This file
 * holds the decisions, the patch writer and the wording; the service wires
 * them into its pass.
 *
 * @module services/worktree/worktree-tiers
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import { formatBytes, type CommandResult, type RunCommandOptions } from './worktree-janitor.git.js';
import { isRegenerablePath } from './worktree-dirty.js';

/** git runner: `args` as for `git`, options as for the janitor's runCommand. */
export type TierGitRunner = (args: string[], options?: RunCommandOptions) => Promise<CommandResult>;

/** Which tier applies. */
export type WorktreeTier = 'strip' | 'archive';

/** Per-worktree timestamps the tiers remember (persisted under CREWLY_HOME). */
export interface TierState {
	/** Worktree path -> when its regenerable dirs were stripped (ms epoch) */
	stripped: Record<string, number>;
	/** Worktree path -> when it was archived and removed (ms epoch) */
	archived: Record<string, number>;
	/** Worktree path -> when the WorkItem working in it reached a terminal state (ms epoch) */
	finished: Record<string, number>;
}

/** An empty tier state. */
export function emptyTierState(): TierState {
	return { stripped: {}, archived: {}, finished: {} };
}

/**
 * Normalise whatever was read from disk into a {@link TierState}.
 *
 * @param raw - Parsed JSON, or null
 * @returns A complete state (missing maps are empty)
 */
export function normalizeTierState(raw: unknown): TierState {
	const out = emptyTierState();
	if (!raw || typeof raw !== 'object') return out;
	const r = raw as Partial<Record<keyof TierState, unknown>>;
	for (const key of ['stripped', 'archived', 'finished'] as const) {
		const m = r[key];
		if (!m || typeof m !== 'object') continue;
		for (const [p, at] of Object.entries(m as Record<string, unknown>)) {
			if (typeof at === 'number' && Number.isFinite(at)) out[key][p] = at;
		}
	}
	return out;
}

/**
 * Drop entries too old to matter so the state file does not grow forever.
 * Stripped / archived records of worktrees that no longer exist are dropped
 * too (the caller passes the paths it still sees).
 *
 * @param state - Tier state
 * @param now - Current epoch ms
 * @param existing - Worktree paths that still exist (others' strip records go)
 * @returns A pruned copy
 */
export function pruneTierState(state: TierState, now: number, existing: ReadonlySet<string>): TierState {
	const maxAge = WORKTREE_JANITOR_CONSTANTS.TIER_STATE_MAX_AGE_MS;
	const out = emptyTierState();
	for (const [p, at] of Object.entries(state.stripped)) if (existing.has(p)) out.stripped[p] = at;
	for (const [p, at] of Object.entries(state.archived)) if (now - at < maxAge) out.archived[p] = at;
	for (const [p, at] of Object.entries(state.finished)) if (now - at < maxAge && existing.has(p)) out.finished[p] = at;
	return out;
}

/**
 * How long a worktree has been untouched, for the tier decision: the newest
 * of its shallow tree mtime, its git-dir mtime (index / HEAD / reflog) and
 * its newest commit. Unknown parts are ignored; all unknown = null.
 *
 * @param input - Current time and the three "last touched" signals (ms epoch or null)
 * @returns Idle ms, or null when nothing is known
 */
export function tierIdleMs(input: { now: number; treeMtimeMs: number | null; gitMtimeMs: number | null; newestCommitMs: number | null }): number | null {
	const known = [input.treeMtimeMs, input.gitMtimeMs, input.newestCommitMs].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
	if (known.length === 0) return null;
	return Math.max(0, input.now - Math.max(...known));
}

/**
 * Which tier a kept worktree has reached.
 *
 * @param input - Idle ms (null = unknown → none), low-disk mode, when its WorkItem finished (ms epoch or undefined)
 * @returns `archive` at 14 days, `strip` at 3 days (1 day under low disk or after a finished WorkItem), else null
 *
 * @example
 * ```typescript
 * tierFor({ idleMs: 4 * DAY, lowDisk: false });                     // 'strip'
 * tierFor({ idleMs: 30 * HOUR, lowDisk: true });                    // 'strip'
 * tierFor({ idleMs: 30 * HOUR, lowDisk: false, finishedAt: t });    // 'strip'
 * tierFor({ idleMs: 15 * DAY, lowDisk: false });                    // 'archive'
 * ```
 */
export function tierFor(input: { idleMs: number | null; lowDisk: boolean; finishedAt?: number }): WorktreeTier | null {
	if (input.idleMs === null) return null;
	if (input.idleMs >= WORKTREE_JANITOR_CONSTANTS.ARCHIVE_MIN_IDLE_MS) return 'archive';
	const stripAfter =
		input.lowDisk || input.finishedAt !== undefined
			? WORKTREE_JANITOR_CONSTANTS.STRIP_MIN_IDLE_LOW_DISK_MS
			: WORKTREE_JANITOR_CONSTANTS.STRIP_MIN_IDLE_MS;
	return input.idleMs >= stripAfter ? 'strip' : null;
}

/** Date part of an ISO timestamp (`2026-10-17`). */
function dateStamp(now: number): string {
	return new Date(now).toISOString().slice(0, 10);
}

/**
 * Where a worktree's archive patch goes:
 * `<archiveRoot>/<repo basename>/<worktree basename>-<date>.patch`, with a
 * numeric suffix when that file already exists.
 *
 * @param archiveRoot - `<CREWLY_HOME>/worktree-archive`
 * @param repoMain - Main worktree of the repo
 * @param worktreePath - The worktree
 * @param now - Current epoch ms (for the date)
 * @returns Absolute patch path (not created)
 */
export function archivePatchPath(archiveRoot: string, repoMain: string, worktreePath: string, now: number): string {
	const dir = path.join(archiveRoot, path.basename(repoMain));
	const base = `${path.basename(worktreePath)}-${dateStamp(now)}`;
	let candidate = path.join(dir, `${base}.patch`);
	for (let i = 2; fs.existsSync(candidate) && i < 100; i++) candidate = path.join(dir, `${base}-${i}.patch`);
	return candidate;
}

/** What {@link writeArchivePatch} saved. */
export interface ArchivePatchResult {
	/** Patch file written */
	file: string;
	/** Bytes written */
	bytes: number;
	/** True when `git diff HEAD` had tracked changes */
	trackedChanges: boolean;
	/** Untracked, non-regenerable files written into the patch */
	untrackedFiles: number;
	/** Untracked files left out (over the size or count cap), with sizes */
	skippedUntracked: Array<{ path: string; bytes: number }>;
}

/** Facts needed in the patch header. */
export interface ArchiveHeaderFacts {
	repoMain: string;
	worktreePath: string;
	branch: string | null;
	head: string | null;
	defaultRef: string | null;
	commitsNotOnDefault: number | null;
	/** Ref created to keep a detached worktree's commits alive, if any */
	keepRef?: string | null;
}

/**
 * Write a worktree's uncommitted work as one patch file: a `#` header (repo,
 * worktree, branch, HEAD, how to apply), `git diff HEAD --binary` (tracked
 * changes, staged or not), then one `git diff --no-index` hunk per untracked,
 * non-regenerable file. The patch is capped at ARCHIVE_PATCH_MAX_BYTES and
 * ARCHIVE_MAX_UNTRACKED_FILES; files that would push it over are listed in
 * the trailer instead. `git apply --3way <file>` restores it on a checkout
 * of the same HEAD. Throws when the tracked diff alone is over the cap or the
 * file cannot be written (the caller then keeps the worktree).
 *
 * @param git - git runner
 * @param facts - Header facts
 * @param file - Destination (its directory is created)
 * @param now - Current epoch ms
 * @returns What was written
 * @throws When git cannot read the worktree, the tracked diff exceeds the cap, or the write fails
 */
export async function writeArchivePatch(git: TierGitRunner, facts: ArchiveHeaderFacts, file: string, now: number): Promise<ArchivePatchResult> {
	const cap = WORKTREE_JANITOR_CONSTANTS.ARCHIVE_PATCH_MAX_BYTES;
	const wt = facts.worktreePath;
	const tracked = await git(['-C', wt, 'diff', '--binary', 'HEAD']);
	if (tracked.code !== 0) throw new Error(`git diff failed: ${tracked.stderr.trim().slice(0, 200)}`);
	if (Buffer.byteLength(tracked.stdout) > cap) throw new Error(`tracked changes exceed the ${formatBytes(cap)} archive cap`);

	const others = await git(['-C', wt, 'ls-files', '--others', '--exclude-standard', '-z']);
	if (others.code !== 0) throw new Error(`git ls-files failed: ${others.stderr.trim().slice(0, 200)}`);
	const untracked = others.stdout.split('\0').filter((p) => p !== '' && !isRegenerablePath(p));

	const header = [
		'# Crewly worktree archive (crewly#1354)',
		`# repo: ${facts.repoMain}`,
		`# worktree: ${wt}`,
		`# branch: ${facts.branch ?? 'detached HEAD'}`,
		`# head: ${facts.head ?? 'unknown'}`,
		`# default: ${facts.defaultRef ?? 'none'}${facts.commitsNotOnDefault !== null ? ` (${facts.commitsNotOnDefault} commit(s) of this worktree are not on it; ${facts.branch ? 'the branch was kept' : facts.keepRef ? `kept under ${facts.keepRef}` : 'none to keep'})` : ''}`,
		`# archived: ${new Date(now).toISOString()}`,
		`# apply: git worktree add <dir> ${facts.head ?? '<head>'} && git -C <dir> apply --3way ${path.basename(file)}`,
		'',
	].join('\n');

	const parts: string[] = [header];
	let bytes = Buffer.byteLength(header) + Buffer.byteLength(tracked.stdout);
	if (tracked.stdout.trim() !== '') parts.push(tracked.stdout.endsWith('\n') ? tracked.stdout : `${tracked.stdout}\n`);

	const skipped: Array<{ path: string; bytes: number }> = [];
	let written = 0;
	for (const rel of untracked) {
		const full = path.join(wt, rel);
		let size = 0;
		try {
			const st = await fs.promises.lstat(full);
			if (!st.isFile()) continue;
			size = st.size;
		} catch {
			continue;
		}
		if (written >= WORKTREE_JANITOR_CONSTANTS.ARCHIVE_MAX_UNTRACKED_FILES || bytes + size > cap) {
			skipped.push({ path: rel, bytes: size });
			continue;
		}
		const d = await git(['-C', wt, 'diff', '--no-index', '--binary', '--', '/dev/null', rel]);
		// `--no-index` exits 1 when the files differ, which they always do here.
		if (d.code !== 0 && d.code !== 1) {
			skipped.push({ path: rel, bytes: size });
			continue;
		}
		const hunk = d.stdout.endsWith('\n') ? d.stdout : `${d.stdout}\n`;
		const hunkBytes = Buffer.byteLength(hunk);
		if (bytes + hunkBytes > cap) {
			skipped.push({ path: rel, bytes: size });
			continue;
		}
		parts.push(hunk);
		bytes += hunkBytes;
		written += 1;
	}
	if (skipped.length > 0) {
		const trailer = ['', '# not included (over the archive cap):', ...skipped.map((s) => `#   ${s.path} (${formatBytes(s.bytes)})`), ''].join('\n');
		parts.push(trailer);
		bytes += Buffer.byteLength(trailer);
	}
	await fs.promises.mkdir(path.dirname(file), { recursive: true });
	await fs.promises.writeFile(file, parts.join(''), { flag: 'wx' });
	return { file, bytes, trackedChanges: tracked.stdout.trim() !== '', untrackedFiles: written, skippedUntracked: skipped };
}

/**
 * Name of the ref that keeps an archived detached worktree's commits alive.
 *
 * @param worktreePath - The worktree
 * @param now - Current epoch ms
 * @returns `refs/crewly-archive/<name>-<date>`
 */
export function archiveKeepRef(worktreePath: string, now: number): string {
	const name = path.basename(worktreePath).replace(/[^A-Za-z0-9._-]+/g, '-');
	return `${WORKTREE_JANITOR_CONSTANTS.ARCHIVE_REF_PREFIX}${name}-${dateStamp(now)}`;
}

/**
 * The message to a lead when a worktree's regenerable dirs were stripped.
 *
 * @param f - Path, reason the worktree is kept, idle days, dirs, bytes
 * @returns Message text
 */
export function buildStripNotice(f: { path: string; reason: string; idleMs: number; dirs: string[]; freedBytes: number }): string {
	const days = Math.floor(f.idleMs / (24 * 60 * 60 * 1000));
	const why = f.reason === 'dirty' ? 'has uncommitted changes' : 'has work that is not merged';
	return (
		`Worktree ${f.path} ${why} and nobody touched it for ${days} day${days === 1 ? '' : 's'}, so I removed its re-installable output ` +
		`(${f.dirs.map((d) => path.relative(f.path, d) || path.basename(d)).join(', ')}; ${formatBytes(f.freedBytes)}). The source is untouched; run \`npm install\` before using it again. ` +
		`If the work is finished, merge it and remove the worktree; after ${Math.round(WORKTREE_JANITOR_CONSTANTS.ARCHIVE_MIN_IDLE_MS / (24 * 60 * 60 * 1000))} days untouched it is saved as a patch and removed.`
	);
}

/**
 * The message to a lead when a worktree was archived and removed.
 *
 * @param f - Path, branch, patch file, what the patch holds, idle days
 * @returns Message text
 */
export function buildArchiveNotice(f: { path: string; branch: string | null; patch: ArchivePatchResult; idleMs: number; commitsNotOnDefault: number | null; keepRef?: string | null }): string {
	const days = Math.floor(f.idleMs / (24 * 60 * 60 * 1000));
	const held: string[] = [];
	if (f.patch.trackedChanges) held.push('uncommitted changes to tracked files');
	if (f.patch.untrackedFiles > 0) held.push(`${f.patch.untrackedFiles} untracked file${f.patch.untrackedFiles === 1 ? '' : 's'}`);
	const skipped = f.patch.skippedUntracked.length > 0 ? ` ${f.patch.skippedUntracked.length} file(s) were too large for the patch and are listed in its header.` : '';
	const commits =
		f.commitsNotOnDefault && f.commitsNotOnDefault > 0
			? f.branch
				? ` Its ${f.commitsNotOnDefault} unmerged commit(s) are still on branch ${f.branch}.`
				: f.keepRef
					? ` Its ${f.commitsNotOnDefault} unmerged commit(s) are kept under ${f.keepRef}.`
					: ''
			: '';
	return (
		`Worktree ${f.path} was untouched for ${days} days, so I archived and removed it. ` +
		`Its ${held.length > 0 ? held.join(' and ') : 'working tree (nothing uncommitted)'} ${held.length > 0 ? 'are' : 'is'} saved in ${f.patch.file} (${formatBytes(f.patch.bytes)}).${commits}${skipped} ` +
		'To continue: check out the branch in a new worktree and `git apply --3way` the patch.'
	);
}
