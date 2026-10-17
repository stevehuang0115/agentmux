/**
 * Low-disk guard — pure helpers for the disk janitor's free-space check.
 *
 * The janitor checks free space on the volume holding CREWLY_HOME every
 * 10 minutes. Below the low mark — max(15 GB, 8 % of the disk), because a
 * ~1 TB Mac already misbehaves at 5–8 % free — it cleans up at once with
 * shorter idle thresholds; if space is still short it tells the owner (at most
 * once per 24 h, or once per 6 h and marked urgent below max(5 GB, 3 %)) what
 * it freed, what it could not remove and why, and that it never touches the
 * owner's own files. This file holds the decisions and the wording; the
 * service does the I/O.
 *
 * @module services/worktree/low-disk-guard
 */

import * as fs from 'fs';
import { WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import { formatBytes } from './worktree-janitor.git.js';

/** Subset of `fs.StatFs` the guard needs (numbers or bigints). */
export interface StatFsLike {
	/** Free blocks available to unprivileged users */
	bavail: number | bigint;
	/** Block size in bytes */
	bsize: number | bigint;
	/** Total blocks on the volume (optional: an older probe may not report it) */
	blocks?: number | bigint;
}

/** Free and total bytes of a volume. */
export interface DiskSpace {
	/** Free bytes for unprivileged users */
	freeBytes: number;
	/** Total bytes, or null when the probe did not report the size */
	totalBytes: number | null;
}

/** `fs.promises.statfs`-compatible probe. */
export type StatFsFn = (p: string) => Promise<StatFsLike>;

/** Disk level relative to the thresholds. */
export type DiskLevel = 'ok' | 'low' | 'critical';

/** Janitor state persisted under CREWLY_HOME (notice cadence, sweep cadence, arming). */
export interface LowDiskNoticeState {
	/** Last notice of any kind (ms epoch) */
	lastNoticeAt?: number;
	/** Last urgent notice (ms epoch) */
	lastUrgentAt?: number;
	/**
	 * First real pass that ran with the crewly#1354 retention code (ms epoch).
	 * Its deletes stay dry-run until RETENTION_ARM_DELAY_MS after this.
	 */
	retentionArmedAt?: number;
	/** Last transcript sweep (ms epoch) */
	lastTranscriptSweepAt?: number;
	/** Last tmp / logs sweep (ms epoch) */
	lastTmpSweepAt?: number;
}

/** Something the janitor looked at and left on disk. */
export interface KeptItem {
	/** Absolute path */
	path: string;
	/** Size in bytes */
	bytes: number;
	/** Janitor reason code (`dirty`, `not-merged`, `unpushed`, …) */
	reason: string;
}

/**
 * Free bytes on the volume holding `p`.
 *
 * @param p - Any path on the volume
 * @param statfs - Probe (default `fs.promises.statfs`)
 * @returns Free bytes for unprivileged users, or null when the probe failed
 */
export async function readFreeBytes(p: string, statfs: StatFsFn = defaultStatFs): Promise<number | null> {
	return (await readDiskSpace(p, statfs))?.freeBytes ?? null;
}

/**
 * Free and total bytes of the volume holding `p`.
 *
 * @param p - Any path on the volume
 * @param statfs - Probe (default `fs.promises.statfs`)
 * @returns Free and total bytes, or null when the probe failed
 */
export async function readDiskSpace(p: string, statfs: StatFsFn = defaultStatFs): Promise<DiskSpace | null> {
	try {
		const s = await statfs(p);
		const bsize = Number(s.bsize);
		const total = s.blocks === undefined ? null : Number(s.blocks) * bsize;
		return { freeBytes: Number(s.bavail) * bsize, totalBytes: total !== null && Number.isFinite(total) && total > 0 ? total : null };
	} catch {
		return null;
	}
}

/**
 * The low-disk mark for a volume: the absolute floor or a fraction of the
 * disk, whichever is larger. A 926 GB disk gets ~74 GB, a 100 GB disk 15 GB.
 *
 * @param totalBytes - Disk size, or null when unknown (the floor is used)
 * @returns Bytes below which free space counts as low
 */
export function lowDiskThresholdBytes(totalBytes: number | null): number {
	const floor = WORKTREE_JANITOR_CONSTANTS.LOW_DISK_BYTES;
	return totalBytes ? Math.max(floor, Math.round(totalBytes * WORKTREE_JANITOR_CONSTANTS.LOW_DISK_FRACTION)) : floor;
}

/**
 * The critical mark for a volume: max(5 GB, 3 % of the disk).
 *
 * @param totalBytes - Disk size, or null when unknown (the floor is used)
 * @returns Bytes below which free space counts as critical
 */
export function criticalDiskThresholdBytes(totalBytes: number | null): number {
	const floor = WORKTREE_JANITOR_CONSTANTS.CRITICAL_DISK_BYTES;
	return totalBytes ? Math.max(floor, Math.round(totalBytes * WORKTREE_JANITOR_CONSTANTS.CRITICAL_DISK_FRACTION)) : floor;
}

async function defaultStatFs(p: string): Promise<StatFsLike> {
	return fs.promises.statfs(p);
}

/**
 * Classify free space against the volume's marks.
 *
 * @param freeBytes - Free bytes
 * @param totalBytes - Disk size (null / omitted: the absolute floors apply)
 * @returns `critical` below the critical mark, `low` below the low mark, else `ok`
 *
 * @example
 * ```typescript
 * diskLevel(50 * GB, 926 * GB); // 'low' (mark is 8 % = 74 GB)
 * diskLevel(50 * GB);           // 'ok'  (no size: 15 GB floor)
 * ```
 */
export function diskLevel(freeBytes: number, totalBytes: number | null = null): DiskLevel {
	if (freeBytes < criticalDiskThresholdBytes(totalBytes)) return 'critical';
	if (freeBytes < lowDiskThresholdBytes(totalBytes)) return 'low';
	return 'ok';
}

/**
 * Whether the crewly#1354 retention deletes are armed: the first real pass
 * records the time and only logs; deletes start RETENTION_ARM_DELAY_MS later.
 *
 * @param state - Janitor state
 * @param now - Current time (ms)
 * @returns True when deletes may run
 */
export function retentionArmed(state: LowDiskNoticeState, now: number): boolean {
	return state.retentionArmedAt !== undefined && now - state.retentionArmedAt >= WORKTREE_JANITOR_CONSTANTS.RETENTION_ARM_DELAY_MS;
}

/**
 * Idle threshold to use, shortened in low-disk mode.
 *
 * @param normalMs - Threshold in normal mode
 * @param lowDisk - Whether free space is below LOW_DISK_BYTES
 * @returns `normalMs`, or `normalMs / LOW_DISK_IDLE_DIVISOR` floored at LOW_DISK_MIN_IDLE_FLOOR_MS
 *
 * @example
 * ```typescript
 * idleThreshold(24 * HOUR, true); // 12 h
 * idleThreshold(2 * HOUR, true);  // 2 h (floor)
 * ```
 */
export function idleThreshold(normalMs: number, lowDisk: boolean): number {
	if (!lowDisk) return normalMs;
	const halved = normalMs / WORKTREE_JANITOR_CONSTANTS.LOW_DISK_IDLE_DIVISOR;
	return Math.max(Math.min(normalMs, WORKTREE_JANITOR_CONSTANTS.LOW_DISK_MIN_IDLE_FLOOR_MS), halved);
}

/**
 * Whether to tell the owner now, and how.
 *
 * @param level - Current disk level (after cleanup)
 * @param state - When the owner was last told
 * @param now - Current time (ms)
 * @returns `urgent`, `normal`, or null (nothing to send)
 */
export function noticeToSend(level: DiskLevel, state: LowDiskNoticeState, now: number): 'urgent' | 'normal' | null {
	if (level === 'ok') return null;
	if (level === 'critical') {
		const last = state.lastUrgentAt;
		return last === undefined || now - last >= WORKTREE_JANITOR_CONSTANTS.CRITICAL_DISK_NOTIFY_INTERVAL_MS ? 'urgent' : null;
	}
	const last = state.lastNoticeAt;
	return last === undefined || now - last >= WORKTREE_JANITOR_CONSTANTS.LOW_DISK_NOTIFY_INTERVAL_MS ? 'normal' : null;
}

/**
 * The state after a notice went out.
 *
 * @param state - Previous state
 * @param kind - What was sent
 * @param now - Send time (ms)
 * @returns New state
 */
export function recordNotice(state: LowDiskNoticeState, kind: 'urgent' | 'normal', now: number): LowDiskNoticeState {
	return { ...state, lastNoticeAt: now, ...(kind === 'urgent' ? { lastUrgentAt: now } : {}) };
}

/** What one pass freed, by kind (bytes), for the owner line. */
export interface FreedBreakdown {
	/** Finished worktrees and scratch dirs removed */
	worktrees: number;
	/** node_modules / build output stripped from kept worktrees */
	stripped: number;
	/** Worktrees archived as a patch and removed */
	archived: number;
	/** Agent transcripts pruned */
	transcripts: number;
	/** CREWLY_HOME/tmp and logs */
	tmp: number;
}

/**
 * One short line of what a pass freed, by kind; empty when nothing was.
 *
 * @param freed - Bytes freed per kind
 * @returns `"freed 3.2 GB (worktrees 2.1 GB, node_modules 1.1 GB)"` or ''
 */
export function describeFreed(freed: FreedBreakdown): string {
	const parts: string[] = [];
	if (freed.worktrees > 0) parts.push(`finished worktrees ${formatBytes(freed.worktrees)}`);
	if (freed.stripped > 0) parts.push(`node_modules of idle worktrees ${formatBytes(freed.stripped)}`);
	if (freed.archived > 0) parts.push(`archived worktrees ${formatBytes(freed.archived)}`);
	if (freed.transcripts > 0) parts.push(`old agent transcripts ${formatBytes(freed.transcripts)}`);
	if (freed.tmp > 0) parts.push(`temp files and logs ${formatBytes(freed.tmp)}`);
	const total = freed.worktrees + freed.stripped + freed.archived + freed.transcripts + freed.tmp;
	return total > 0 ? `freed ${formatBytes(total)} (${parts.join(', ')})` : '';
}

const REASON_TEXT: Record<string, string> = {
	dirty: 'has changes that were never committed',
	'not-merged': 'has work that is not merged yet',
	unpushed: 'has commits that were never pushed',
	stash: 'has stashed changes',
	'no-remote': 'is a git repo with no remote, so its history may exist nowhere else',
	'has-external-worktrees': 'has a worktree somewhere else that depends on it',
	'contains-worktree': 'holds a worktree that is still in use or not finished',
	recent: 'was used recently',
	locked: 'is locked by a running tool',
	'process-inside': 'a program is still open in it',
	'agent-session-inside': 'an agent is working in it',
	'cwd-probe-failed': 'could not check whether a program is using it',
	'managed-by-workitem-worktrees': 'belongs to an open task',
	'status-failed': 'git could not read it',
	'git-failed': 'git could not read it',
	'remove-failed': 'deleting it failed',
	'archive-failed': 'saving its changes as a patch failed, so it stays',
	'contains-git': 'holds a git checkout, which only the worktree rules may remove',
	'live-session': 'is the conversation of a running agent',
	foreign: 'is not an agent conversation',
};

/**
 * Plain-English reason for a kept item.
 *
 * @param reason - Janitor reason code
 * @returns Short phrase ("has changes that were never committed")
 */
export function describeReason(reason: string): string {
	return REASON_TEXT[reason] ?? `kept (${reason})`;
}

/**
 * Owner notice for low disk: free space, what was freed, and the biggest
 * items left with the reason, short enough for a phone.
 *
 * @param input - Free bytes, urgency, bytes freed this pass, kept items
 * @returns Title and message
 */
export function buildLowDiskNotice(input: {
	freeBytes: number;
	urgent: boolean;
	freedBytes: number;
	items: KeptItem[];
	/** Optional breakdown of what was freed (replaces the plain "cleaned up X" line) */
	freed?: FreedBreakdown;
	/** Optional: total disk size, so the owner sees the mark that was crossed */
	totalBytes?: number | null;
}): { title: string; message: string } {
	const title = input.urgent ? 'URGENT: disk almost full' : 'Disk space is running low';
	const lines: string[] = [];
	const ofDisk = input.totalBytes ? ` of ${formatBytes(input.totalBytes)}` : '';
	lines.push(`Only ${formatBytes(input.freeBytes)}${ofDisk} free on this machine.${input.urgent ? ' Crewly and the agents may stop working soon.' : ''}`);
	const breakdown = input.freed ? describeFreed(input.freed) : '';
	lines.push(
		breakdown
			? `Today I ${breakdown}, but it is not enough.`
			: input.freedBytes > 0
				? `I cleaned up ${formatBytes(input.freedBytes)} of finished work, but it is not enough.`
				: 'I found nothing more that is safe to delete on my own.',
	);
	const top = [...input.items].sort((a, b) => b.bytes - a.bytes).slice(0, WORKTREE_JANITOR_CONSTANTS.LOW_DISK_REPORT_ITEMS);
	if (top.length > 0) {
		lines.push('', 'Biggest things I left alone:');
		for (const it of top) lines.push(`• ${it.path} (${formatBytes(it.bytes)}) — ${describeReason(it.reason)}`);
		lines.push('', 'Tell me which ones can go, or free up space another way.');
	} else {
		lines.push('Please free up some space.');
	}
	lines.push('I only clean what agents left behind (worktrees, scratch dirs, agent transcripts, Crewly temp files and logs); your own files, downloads and app caches I never touch.');
	return { title, message: lines.join('\n') };
}
