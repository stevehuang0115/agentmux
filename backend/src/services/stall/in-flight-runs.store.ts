/**
 * The stall watcher's state on disk (`CREWLY_HOME/in-flight-runs.json`):
 * background runs agents said they started, the ladder stamps of every
 * stalled item (agent / lead / owner steps), pending teammate-claim checks,
 * the per-agent nudge times and the time the watcher was first armed.
 * One small JSON file, written atomically; a missing or broken file is an
 * empty state (specs/2026-10-17-stall-watcher.md).
 *
 * @module services/stall/in-flight-runs.store
 */

import { promises as fs } from 'fs';
import path from 'path';
import { STALL_WATCHER_CONSTANTS } from '../../constants.js';

const C = STALL_WATCHER_CONSTANTS;

/** A run an agent said it started, with when it should be back. */
export interface InFlightRun {
	/** Stable id (the message id that announced it) */
	id: string;
	/** Agent session */
	agent: string;
	/** chat-v2 channel of the announcement */
	channelId: string;
	/** chat-v2 thread root (the announcement itself when it was a root post) */
	threadId: string;
	/** The sentence that announced it (clipped) */
	head: string;
	/** Epoch ms of the announcement */
	startedAt: number;
	/** Estimate the agent gave (ms), or the default */
	estimateMs: number;
	/** Whether the estimate came from the text */
	estimateSource: 'text' | 'default';
	/** startedAt + estimateMs */
	expectedBy: number;
}

/** When each step of the ladder fired for one item (epoch ms). */
export interface LadderState {
	agentAt?: number;
	leadAt?: number;
	ownerAt?: number;
	/** The lead that was told at the lead step (its answer in the thread stops the owner step) */
	leadSession?: string;
	/** Last time any step of this item ran (for pruning) */
	seenAt: number;
}

/** A "<Name> is doing it" told to the owner, waiting for its check (crewly#1362). */
export interface PendingClaim {
	/** The message id that made the claim */
	id: string;
	/** Who said it */
	speaker: string;
	/** The teammate named (session) */
	member: string;
	/** The teammate's display name as written */
	memberName: string;
	/** Epoch ms of the claim */
	saidAt: number;
	/** The sentence (clipped) */
	head: string;
}

/** Everything the watcher persists. */
export interface StallWatcherState {
	version: number;
	/** Epoch ms of the first real pass; sends start ARM_DELAY_MS later */
	armedAt?: number;
	runs: InFlightRun[];
	/** Ladder stamps by item key (`promise:<request>/<item>`, `claim:<workItem>`, `run:<id>`) */
	ladders: Record<string, LadderState>;
	/** Last watcher nudge per agent session (epoch ms) */
	lastNudgeByAgent: Record<string, number>;
	claims: PendingClaim[];
}

/**
 * A fresh, empty state.
 *
 * @returns Empty state
 */
export function emptyState(): StallWatcherState {
	return { version: C.STATE_VERSION, runs: [], ladders: {}, lastNudgeByAgent: {}, claims: [] };
}

/**
 * Drop what is too old to matter: runs past RUN_MAX_AGE_MS, ladders not
 * seen for LADDER_TTL_MS, nudge times older than the cooldown, and claim
 * checks past their window twice over (something kept them from running).
 * Caps the run and claim lists at their maxima (oldest first).
 *
 * @param state - State (mutated in place)
 * @param now - Epoch ms
 * @returns The same state
 */
export function pruneState(state: StallWatcherState, now: number): StallWatcherState {
	state.runs = state.runs.filter((r) => now - r.startedAt < C.RUN_MAX_AGE_MS).slice(-C.MAX_RUNS);
	for (const [key, ladder] of Object.entries(state.ladders)) {
		if (now - ladder.seenAt >= C.LADDER_TTL_MS) delete state.ladders[key];
	}
	for (const [agent, at] of Object.entries(state.lastNudgeByAgent)) {
		if (now - at >= C.NUDGE_COOLDOWN_MS) delete state.lastNudgeByAgent[agent];
	}
	state.claims = state.claims.filter((c) => now - c.saidAt < 2 * C.CLAIM_CHECK_WINDOW_MS + C.INTERVAL_MS).slice(-C.MAX_PENDING_CLAIMS);
	return state;
}

/**
 * Whether a parsed file is a usable state.
 *
 * @param value - Parsed JSON
 * @returns True for a state object
 */
function isState(value: unknown): value is StallWatcherState {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.runs) && typeof v.ladders === 'object' && v.ladders !== null;
}

/**
 * Reads and writes the state file.
 */
export class InFlightRunsStore {
	/**
	 * @param filePath - Absolute path of the state file
	 */
	constructor(private readonly filePath: string) {}

	/** @returns The state file path */
	get path(): string {
		return this.filePath;
	}

	/**
	 * Read the state; a missing, unreadable or malformed file is an empty state.
	 *
	 * @returns The state (missing lists filled in)
	 */
	async load(): Promise<StallWatcherState> {
		try {
			const raw = await fs.readFile(this.filePath, 'utf8');
			const parsed: unknown = JSON.parse(raw);
			if (!isState(parsed)) return emptyState();
			return {
				...emptyState(),
				...parsed,
				runs: parsed.runs ?? [],
				ladders: parsed.ladders ?? {},
				lastNudgeByAgent: parsed.lastNudgeByAgent ?? {},
				claims: parsed.claims ?? [],
			};
		} catch {
			return emptyState();
		}
	}

	/**
	 * Write the state atomically (temp file + rename).
	 *
	 * @param state - State to write
	 */
	async save(state: StallWatcherState): Promise<void> {
		await fs.mkdir(path.dirname(this.filePath), { recursive: true });
		const tmp = `${this.filePath}.${process.pid}.tmp`;
		await fs.writeFile(tmp, JSON.stringify({ ...state, version: C.STATE_VERSION }, null, 2), 'utf8');
		await fs.rename(tmp, this.filePath);
	}
}
