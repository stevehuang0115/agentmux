/**
 * Tmp and log janitor — retention for `<CREWLY_HOME>/tmp` and size caps for
 * `<CREWLY_HOME>/logs/archive` and `logs/sessions` (crewly#1354).
 *
 * `~/.crewly/tmp` is where agents, skills and Crewly itself put scratch
 * output (Slack downloads, release build dirs, previews, skill output) and
 * nothing ever removed it (600 MB on one Mac); the log archive had a 7-day
 * rule but no cap (600 MB) and session logs none at all (200 MB).
 *
 * Tmp rules: a top-level entry untouched (shallow tree mtime) for 7 days is
 * removed. Some sub-directories are swept per child with their own age
 * instead (`slack-files` / `slack-images` / `slack-pdfs` 30 days,
 * `crewly-web-release` 2 days, `skill-output` 7 days) and the directory itself
 * stays. Never removed: symlinks, anything a process or agent session has as
 * cwd, and any entry holding a git checkout — a linked worktree in tmp
 * belongs to the worktree rules (the service adds tmp to their discovery
 * roots), and a clone may be the only copy of its history.
 *
 * Log caps: the oldest files go first until the directory fits; a file
 * written in the last hour, or the log of a live session, is never deleted.
 *
 * @module services/worktree/tmp-janitor
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import { EventLoopYielder, findGitCheckouts, isPathInside, latestTreeMtimeMs } from './worktree-janitor.git.js';

/** A place a live process or agent is working in (same shape as the janitor's BusyCwd). */
export interface TmpBusyCwd {
	cwd: string;
	source: 'agent-session' | 'process';
}

/** Why a tmp entry was removed or kept. */
export type TmpReason = 'old' | 'recent' | 'contains-git' | 'process-inside' | 'agent-session-inside' | 'cwd-probe-failed' | 'symlink' | 'remove-failed';

/** Verdict for one tmp entry. */
export interface TmpEntryVerdict {
	/** Absolute path */
	path: string;
	/** Bytes (0 when unknown) */
	bytes: number;
	/** What the sweep decided */
	decision: 'remove' | 'keep';
	/** The deciding rule */
	reason: TmpReason;
	/** Ms since last touched, when known */
	idleMs?: number;
	/** True when deleted */
	removed: boolean;
	/** Error text when deletion failed */
	error?: string;
}

/** Result of one tmp sweep. */
export interface TmpSweepSummary {
	/** The tmp root */
	root: string;
	/** Entries deleted */
	removed: number;
	/** Dry run: entries that would be deleted */
	wouldRemove: number;
	/** Bytes freed */
	freedBytes: number;
	/** Dry run: bytes that would be freed */
	wouldFreeBytes: number;
	/** Entries kept (`recent` ones are counted, not listed) */
	kept: number;
	/** Kept entries by reason */
	keptReasons: Record<string, number>;
	/** Verdicts (all but `recent`) */
	entries: TmpEntryVerdict[];
}

/** Input of {@link sweepTmp}. */
export interface TmpSweepInput {
	/** `<CREWLY_HOME>/tmp` */
	root: string;
	/** Busy cwds, or null when the probe failed (everything is then kept) */
	busy: TmpBusyCwd[] | null;
	/** Current time (ms) */
	now: number;
	/** When true, nothing is deleted */
	dryRun: boolean;
	/** Age for top-level entries (default TMP_MAX_AGE_MS) */
	maxAgeMs?: number;
	/** Per-child policies by sub-directory name (default TMP_CHILD_POLICIES) */
	childPolicies?: Readonly<Record<string, number>>;
	/** Size probe (default: shallow stat walk) */
	sizeOf?: (p: string) => Promise<number | null>;
}

/** Bytes of a path by a bounded stat walk (no symlinks followed). */
export async function shallowBytes(p: string, depth = 6): Promise<number> {
	let total = 0;
	const yielder = new EventLoopYielder();
	const walk = async (q: string, level: number): Promise<void> => {
		await yielder.tick();
		let st: fs.Stats;
		try {
			st = await fs.promises.lstat(q);
		} catch {
			return;
		}
		total += st.size;
		if (!st.isDirectory() || level >= depth) return;
		let names: string[];
		try {
			names = await fs.promises.readdir(q);
		} catch {
			return;
		}
		for (const n of names) await walk(path.join(q, n), level + 1);
	};
	await walk(p, 0);
	return total;
}

/**
 * One sweep of the tmp root. Never throws; an unreadable root yields an
 * empty summary.
 *
 * @param input - Root, busy cwds, clock, dry-run flag
 * @returns What was removed and kept
 */
export async function sweepTmp(input: TmpSweepInput): Promise<TmpSweepSummary> {
	const summary: TmpSweepSummary = { root: input.root, removed: 0, wouldRemove: 0, freedBytes: 0, wouldFreeBytes: 0, kept: 0, keptReasons: {}, entries: [] };
	const policies = input.childPolicies ?? WORKTREE_JANITOR_CONSTANTS.TMP_CHILD_POLICIES;
	const defaultAge = input.maxAgeMs ?? WORKTREE_JANITOR_CONSTANTS.TMP_MAX_AGE_MS;
	let top: fs.Dirent[];
	try {
		top = await fs.promises.readdir(input.root, { withFileTypes: true });
	} catch {
		return summary;
	}
	const keep = (v: TmpEntryVerdict): void => {
		summary.kept += 1;
		summary.keptReasons[v.reason] = (summary.keptReasons[v.reason] ?? 0) + 1;
		if (v.reason !== 'recent') summary.entries.push(v);
	};
	const sizeOf = async (p: string): Promise<number> => (input.sizeOf ? await input.sizeOf(p) : null) ?? (await shallowBytes(p));

	const consider = async (entry: fs.Dirent, full: string, maxAge: number): Promise<void> => {
		const base = { path: full, bytes: 0, removed: false };
		if (entry.isSymbolicLink()) return keep({ ...base, decision: 'keep', reason: 'symlink' });
		if (input.busy === null) return keep({ ...base, decision: 'keep', reason: 'cwd-probe-failed' });
		const hit = input.busy.find((b) => isPathInside(b.cwd, full));
		if (hit) return keep({ ...base, decision: 'keep', reason: hit.source === 'agent-session' ? 'agent-session-inside' : 'process-inside' });
		const mtime = await latestTreeMtimeMs(full, WORKTREE_JANITOR_CONSTANTS.TMP_MTIME_DEPTH);
		const idleMs = mtime === null ? undefined : Math.max(0, input.now - mtime);
		if (idleMs === undefined || idleMs < maxAge) return keep({ ...base, decision: 'keep', reason: 'recent', idleMs });
		if (entry.isDirectory()) {
			const repos = await findGitCheckouts(full, WORKTREE_JANITOR_CONSTANTS.TMP_MTIME_DEPTH, 5000);
			if (repos.length > 0) return keep({ ...base, decision: 'keep', reason: 'contains-git', idleMs });
		}
		const bytes = await sizeOf(full);
		const verdict: TmpEntryVerdict = { ...base, bytes, decision: 'remove', reason: 'old', idleMs };
		if (input.dryRun) {
			summary.wouldRemove += 1;
			summary.wouldFreeBytes += bytes;
			summary.entries.push(verdict);
			return;
		}
		try {
			await fs.promises.rm(full, { recursive: true, force: true });
			verdict.removed = true;
			summary.removed += 1;
			summary.freedBytes += bytes;
			summary.entries.push(verdict);
		} catch (err) {
			keep({ ...verdict, decision: 'keep', reason: 'remove-failed', error: err instanceof Error ? err.message : String(err) });
		}
	};

	const yielder = new EventLoopYielder();
	for (const entry of top) {
		await yielder.tick();
		const full = path.join(input.root, entry.name);
		const childAge = policies[entry.name];
		if (childAge !== undefined && entry.isDirectory()) {
			let children: fs.Dirent[];
			try {
				children = await fs.promises.readdir(full, { withFileTypes: true });
			} catch {
				continue;
			}
			for (const child of children) await consider(child, path.join(full, child.name), childAge);
			continue;
		}
		await consider(entry, full, defaultAge);
	}
	return summary;
}

/** Input of {@link capDirectoryBytes}. */
export interface DirCapInput {
	/** Directory of files to cap (not recursive) */
	dir: string;
	/** Allowed total bytes */
	capBytes: number;
	/** Current time (ms) */
	now: number;
	/** When true, nothing is deleted */
	dryRun: boolean;
	/** Files to consider (default: every regular file) */
	filter?: (name: string) => boolean;
	/** Files never deleted (a live session's log) */
	protect?: (name: string) => boolean;
	/** A file written within this long is never deleted (default LOG_CAP_MIN_AGE_MS) */
	minAgeMs?: number;
}

/** Result of {@link capDirectoryBytes}. */
export interface DirCapSummary {
	/** The directory */
	dir: string;
	/** Total bytes before */
	totalBytes: number;
	/** The cap */
	capBytes: number;
	/** Files deleted (oldest first) */
	deleted: string[];
	/** Bytes freed */
	freedBytes: number;
	/** Dry run: files that would be deleted */
	wouldDelete: string[];
	/** Dry run: bytes that would be freed */
	wouldFreeBytes: number;
	/** Bytes that stay over the cap because every remaining file is protected or too new */
	overCapBytes: number;
}

/**
 * Delete the oldest files of a directory until it fits the cap. Never
 * throws; an unreadable directory yields an empty summary.
 *
 * @param input - Directory, cap, filters, clock, dry-run flag
 * @returns What was deleted and what still exceeds the cap
 */
export async function capDirectoryBytes(input: DirCapInput): Promise<DirCapSummary> {
	const summary: DirCapSummary = { dir: input.dir, totalBytes: 0, capBytes: input.capBytes, deleted: [], freedBytes: 0, wouldDelete: [], wouldFreeBytes: 0, overCapBytes: 0 };
	let names: string[];
	try {
		names = await fs.promises.readdir(input.dir);
	} catch {
		return summary;
	}
	const minAge = input.minAgeMs ?? WORKTREE_JANITOR_CONSTANTS.LOG_CAP_MIN_AGE_MS;
	const files: Array<{ name: string; bytes: number; mtimeMs: number; locked: boolean }> = [];
	for (const name of names) {
		if (input.filter && !input.filter(name)) continue;
		try {
			const st = await fs.promises.lstat(path.join(input.dir, name));
			if (!st.isFile()) continue;
			const locked = (input.protect?.(name) ?? false) || input.now - st.mtimeMs < minAge;
			files.push({ name, bytes: st.size, mtimeMs: st.mtimeMs, locked });
			summary.totalBytes += st.size;
		} catch {
			// vanished
		}
	}
	let total = summary.totalBytes;
	files.sort((a, b) => a.mtimeMs - b.mtimeMs);
	for (const f of files) {
		if (total <= input.capBytes) break;
		if (f.locked) continue;
		if (input.dryRun) {
			summary.wouldDelete.push(f.name);
			summary.wouldFreeBytes += f.bytes;
			total -= f.bytes;
			continue;
		}
		try {
			await fs.promises.unlink(path.join(input.dir, f.name));
			summary.deleted.push(f.name);
			summary.freedBytes += f.bytes;
			total -= f.bytes;
		} catch {
			// busy — try the next one
		}
	}
	summary.overCapBytes = Math.max(0, total - input.capBytes);
	return summary;
}
