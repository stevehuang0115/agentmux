/**
 * Runaway-file watcher — catches a single file that grows without bound in an
 * agent's scratch dir or worktree (crewly#1078: a 40 GB `all.md` filled a Mac
 * before the low-disk alert, which only reports free space, could help).
 *
 * ## What it does, once a minute
 * 1. Walks the watched dirs (Claude scratch session dirs, `crewly-worktrees`,
 *    each registered project's `.claude/worktrees` and `.crewly/worktrees`),
 *    skipping `node_modules` and `.git`, and `lstat`s regular files only
 *    (symlinks are never followed).
 * 2. Compares each file's size with its size at the previous scan. A file is
 *    a **runaway** when
 *    - it is at least RUNAWAY_FILE_BYTES (5 GB) AND it grew since the last
 *      scan, or
 *    - it grew by at least RUNAWAY_GROWTH_BYTES_PER_MIN (1 GB/min).
 * 3. For a runaway: stops the process(es) that have the file open (`lsof`,
 *    SIGTERM then SIGKILL; never this process or its parent), cuts the file
 *    down to its first 1 MB (so the disk is freed and the agent can still
 *    see what it was writing), tells the agent working there, and alerts the
 *    owner through the existing low-disk alert path. Each path alerts the
 *    owner once.
 * 4. A file that is at least 5 GB but NOT growing is only reported to the
 *    owner (once): it may be legitimate, so nothing is killed or cut.
 *
 * The truncate step only runs when the file is not open by a process we could
 * not stop. Files outside the watched dirs are never touched.
 *
 * @module services/worktree/runaway-file-watcher
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORKTREE_JANITOR_CONSTANTS as K } from '../../constants.js';
import { EventLoopYielder, formatBytes, isPathInside, runCommand } from './worktree-janitor.git.js';

/** Why a file was flagged. */
export type RunawayKind = 'growing' | 'oversize';

/** One flagged file. */
export interface RunawayFinding {
	/** Absolute path */
	path: string;
	/** Current size in bytes */
	bytes: number;
	/** Growth since the previous scan, bytes per minute (0 when unknown) */
	growthPerMin: number;
	/** `growing` (acted on) or `oversize` (reported only) */
	kind: RunawayKind;
}

/** What was done about a flagged file. */
export interface RunawayOutcome extends RunawayFinding {
	/** Pids that were sent SIGTERM/SIGKILL */
	stoppedPids: number[];
	/** True when the file was cut down to its head */
	truncated: boolean;
	/** Bytes released by the truncate */
	freedBytes: number;
	/** Agent sessions that were told */
	notifiedAgents: string[];
	/** True when the owner notice was delivered */
	ownerNotified: boolean;
}

/** Injectable I/O (defaults talk to the OS). */
export interface RunawayWatcherDeps {
	/** Directories to scan this tick */
	listRoots: () => Promise<string[]>;
	/** Pids that have `file` open (default `lsof -t`) */
	findWriters?: (file: string) => Promise<number[]>;
	/** Signal a pid (default process.kill) */
	kill?: (pid: number, signal: NodeJS.Signals) => void;
	/** Whether a pid is still alive (default signal 0) */
	isAlive?: (pid: number) => boolean;
	/** Sleep (default setTimeout) */
	sleep?: (ms: number) => Promise<void>;
	/** Tell the agent(s) working near `file`; returns the sessions told */
	notifyAgents?: (file: string, message: string) => Promise<string[]>;
	/** Tell the owner; true when delivered */
	notifyOwner?: (notice: { title: string; message: string; urgent: boolean }) => Promise<boolean>;
	/** Clock (default Date.now) */
	now?: () => number;
	/** Logger */
	logger?: { info(m: string, c?: Record<string, unknown>): void; warn(m: string, c?: Record<string, unknown>): void };
}

interface Seen {
	bytes: number;
	at: number;
}

/**
 * Stateful watcher; call {@link RunawayFileWatcher.scan} on a timer.
 *
 * @example
 * ```typescript
 * const w = new RunawayFileWatcher({ listRoots: async () => ['/private/tmp/claude-501'] });
 * setInterval(() => void w.scan(), 60_000);
 * ```
 */
export class RunawayFileWatcher {
	private seen = new Map<string, Seen>();
	private alerted = new Set<string>();

	/**
	 * @param deps - Roots to scan and the side-effect hooks
	 */
	constructor(private readonly deps: RunawayWatcherDeps) {}

	/**
	 * One scan: find runaway files, act on them. Never throws.
	 *
	 * @returns Outcome per flagged file (empty when nothing is wrong)
	 */
	async scan(): Promise<RunawayOutcome[]> {
		const now = (this.deps.now ?? Date.now)();
		const outcomes: RunawayOutcome[] = [];
		try {
			const roots = await this.deps.listRoots();
			const next = new Map<string, Seen>();
			const findings: RunawayFinding[] = [];
			const budget = { left: K.RUNAWAY_SCAN_MAX_ENTRIES };
			const yielder = new EventLoopYielder();
			for (const root of roots) {
				await this.walk(root, 0, budget, yielder, async (file, bytes) => {
					if (bytes < K.RUNAWAY_TRACK_MIN_BYTES && !this.seen.has(file)) return;
					const prev = this.seen.get(file);
					if (bytes >= K.RUNAWAY_TRACK_MIN_BYTES) next.set(file, { bytes, at: now });
					const grew = prev ? bytes > prev.bytes : false;
					const minutes = prev ? Math.max((now - prev.at) / 60_000, 1 / 60) : 0;
					const growthPerMin = prev && grew ? Math.round((bytes - prev.bytes) / minutes) : 0;
					if (grew && (bytes >= K.RUNAWAY_FILE_BYTES || growthPerMin >= K.RUNAWAY_GROWTH_BYTES_PER_MIN)) {
						findings.push({ path: file, bytes, growthPerMin, kind: 'growing' });
					} else if (bytes >= K.RUNAWAY_FILE_BYTES && !this.alerted.has(file)) {
						findings.push({ path: file, bytes, growthPerMin: 0, kind: 'oversize' });
					}
				});
			}
			this.seen = next;
			for (const f of findings) outcomes.push(await this.handle(f));
		} catch (err) {
			this.deps.logger?.warn('Runaway-file scan failed', { error: err instanceof Error ? err.message : String(err) });
		}
		return outcomes;
	}

	private async walk(
		dir: string,
		depth: number,
		budget: { left: number },
		yielder: EventLoopYielder,
		onFile: (file: string, bytes: number) => Promise<void>,
	): Promise<void> {
		if (depth > K.RUNAWAY_SCAN_DEPTH || budget.left <= 0) return;
		let entries: fs.Dirent[];
		try {
			entries = await fs.promises.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			if (budget.left-- <= 0) return;
			await yielder.tick();
			const full = path.join(dir, e.name);
			if (e.isSymbolicLink()) continue;
			if (e.isDirectory()) {
				if (K.SEARCH_SKIP_DIRS.includes(e.name)) continue;
				await this.walk(full, depth + 1, budget, yielder, onFile);
			} else if (e.isFile()) {
				try {
					const st = await fs.promises.lstat(full);
					if (st.isFile()) await onFile(full, st.size);
				} catch {
					// vanished between readdir and lstat
				}
			}
		}
	}

	private async handle(f: RunawayFinding): Promise<RunawayOutcome> {
		const out: RunawayOutcome = { ...f, stoppedPids: [], truncated: false, freedBytes: 0, notifiedAgents: [], ownerNotified: false };
		const log = this.deps.logger;
		if (f.kind === 'growing') {
			out.stoppedPids = await this.stopWriters(f.path);
			const stillOpen = (await (this.deps.findWriters ?? defaultFindWriters)(f.path).catch(() => [] as number[])).filter(this.notSelf);
			if (stillOpen.length === 0) {
				try {
					const before = (await fs.promises.lstat(f.path)).size;
					await fs.promises.truncate(f.path, Math.min(before, K.RUNAWAY_KEEP_HEAD_BYTES));
					out.truncated = true;
					out.freedBytes = Math.max(0, before - K.RUNAWAY_KEEP_HEAD_BYTES);
				} catch (err) {
					log?.warn('Could not cut a runaway file', { path: f.path, error: err instanceof Error ? err.message : String(err) });
				}
			}
			this.seen.delete(f.path);
			out.notifiedAgents = await (this.deps.notifyAgents ?? (async () => []))(
				f.path,
				`[DISK GUARD] ${f.path} was growing without bound (${formatBytes(f.bytes)}, +${formatBytes(f.growthPerMin)}/min). ` +
					`Crewly stopped the process writing it${out.truncated ? ' and cut the file to its first 1 MB' : ''}. ` +
					'Find what was producing the output, fix it, and cap anything you redirect (| head -c 50M).',
			).catch(() => [] as string[]);
		}
		if (!this.alerted.has(f.path)) {
			this.alerted.add(f.path);
			const what =
				f.kind === 'growing'
					? `A file was growing out of control in an agent's working dir: ${f.path} (${formatBytes(f.bytes)}${f.growthPerMin ? `, +${formatBytes(f.growthPerMin)}/min` : ''}). ` +
						`Crewly stopped ${out.stoppedPids.length} process(es) writing it${out.truncated ? ` and cut the file, freeing ${formatBytes(out.freedBytes)}` : ' but could not cut it (still open)'}.` +
						(out.notifiedAgents.length ? ` Told: ${out.notifiedAgents.join(', ')}.` : '')
					: `A very large file sits in an agent's working dir: ${f.path} (${formatBytes(f.bytes)}). It is not growing, so nothing was touched; delete it if it is not needed.`;
			out.ownerNotified = await (this.deps.notifyOwner ?? (async () => false))({
				title: f.kind === 'growing' ? 'Runaway file stopped' : 'Very large file in an agent dir',
				message: what,
				urgent: f.kind === 'growing',
			}).catch(() => false);
		}
		log?.warn(`Runaway file (${f.kind}): ${f.path} ${formatBytes(f.bytes)}`, { stoppedPids: out.stoppedPids, truncated: out.truncated });
		return out;
	}

	private readonly notSelf = (pid: number): boolean => pid !== process.pid && pid !== process.ppid;

	/** SIGTERM the file's writers, SIGKILL those still alive after the grace period. */
	private async stopWriters(file: string): Promise<number[]> {
		const kill = this.deps.kill ?? ((pid, sig) => process.kill(pid, sig));
		const alive = this.deps.isAlive ?? defaultIsAlive;
		const sleep = this.deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
		const pids = (await (this.deps.findWriters ?? defaultFindWriters)(file).catch(() => [] as number[])).filter(this.notSelf);
		for (const pid of pids) {
			try {
				kill(pid, 'SIGTERM');
			} catch {
				// already gone, or not ours
			}
		}
		if (pids.length > 0) {
			await sleep(K.RUNAWAY_KILL_GRACE_MS);
			for (const pid of pids) {
				if (!alive(pid)) continue;
				try {
					kill(pid, 'SIGKILL');
				} catch {
					// ignore
				}
			}
		}
		return pids;
	}
}

function defaultIsAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Pids of this user's processes that have `file` open.
 *
 * @param file - Absolute path
 * @returns Pids (empty when none, or when `lsof` is unavailable)
 */
export async function defaultFindWriters(file: string): Promise<number[]> {
	if (process.platform === 'win32') return [];
	const r = await runCommand('lsof', ['-t', '-w', '--', file], { timeoutMs: K.RUNAWAY_LSOF_TIMEOUT_MS });
	if (!r.stdout) return [];
	return r.stdout
		.split('\n')
		.map((l) => Number(l.trim()))
		.filter((n) => Number.isInteger(n) && n > 1);
}

/**
 * Directories to watch: Claude scratch roots, `<tmp>/crewly-worktrees`, and
 * each repo's `.claude/worktrees` and `.crewly/worktrees`. Missing dirs are
 * dropped.
 *
 * @param scratchRoots - Claude Code scratch roots
 * @param tmpRoots - Temp roots whose `crewly-worktrees/` holds agent worktrees
 * @param repoPaths - Registered project / repo paths
 * @returns Existing directories to scan
 */
export function runawayWatchRoots(scratchRoots: string[], tmpRoots: string[], repoPaths: string[]): string[] {
	const candidates = [
		...scratchRoots,
		...tmpRoots.map((r) => path.join(r, K.TMP_WORKTREE_DIR)),
		...repoPaths.flatMap((r) => [path.join(r, K.AGENT_WORKTREE_DIR), path.join(r, K.MANAGED_WORKTREE_DIR)]),
	];
	const out: string[] = [];
	for (const c of candidates) {
		try {
			if (fs.statSync(c).isDirectory() && !out.some((o) => isPathInside(c, o))) out.push(c);
		} catch {
			// missing
		}
	}
	return out;
}
