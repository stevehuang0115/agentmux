/**
 * Pushes the owner board to Crewly Cloud (crewly#1247).
 *
 * - a full snapshot every 60 s (Cloud may ask for another cadence);
 * - a delta (only the agent rows that changed, plus new timeline events and
 *   canvas steps) within {@link BOARD_CONSTANTS.DELTA_DELAY_MS} of an activity
 *   change, or within {@link CANVAS_CONSTANTS.LIVE_DELTA_DELAY_MS} while Cloud
 *   says someone is watching the canvas (`live: true` / `viewers > 0` in its
 *   answer, believed for {@link CANVAS_CONSTANTS.LIVE_TTL_MS});
 * - gzip bodies, exponential backoff on failure, an hour's pause when Cloud
 *   does not take board pushes (not deployed / refusing);
 * - nothing is sent when the machine is not signed in to Cloud, or when
 *   `CREWLY_BOARD_PUSH=0`.
 *
 * Event-driven: a change only marks a session dirty and arms one timer; the
 * delta is built from the builder's cache and the live tracker, never from a
 * disk scan.
 *
 * @module services/board/board-push.service
 */

import { gzipSync } from 'zlib';
import { BOARD_CONSTANTS, CANVAS_CONSTANTS } from '../../constants.js';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import type { BoardActivityTracker } from './board-activity.tracker.js';
import type { BoardSnapshotBuilder } from './board-snapshot.builder.js';
import { getAgentInteractions, type AgentInteractionRecorder } from './board-interactions.js';
import { linkKey, type BoardDelta, type BoardLink, type BoardSnapshot } from './board.types.js';

const C = BOARD_CONSTANTS;
const CV = CANVAS_CONSTANTS;

/** The Cloud session (CloudClientService). */
export interface BoardCloudSession {
	getToken(): string | null;
	getCloudUrl(): string | null;
	tryRefreshToken?(): Promise<boolean>;
}

/** Constructor dependencies. */
export interface BoardPushDeps {
	builder: BoardSnapshotBuilder;
	tracker: BoardActivityTracker;
	cloud: BoardCloudSession;
	env?: NodeJS.ProcessEnv;
	fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
	now?: () => number;
	setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
	logger?: ComponentLogger;
	/** Agent-to-agent messages (default: the process-wide recorder) */
	interactions?: AgentInteractionRecorder;
}

/** What one push did. */
export type BoardPushOutcome = 'sent' | 'nothing' | 'skipped' | 'paused' | 'failed';

/**
 * Whether the board push is switched off.
 *
 * @param env - Environment
 * @returns True for `CREWLY_BOARD_PUSH=0` (also `false` / `off`)
 */
export function isBoardPushDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
	const v = (env[C.ENV_SWITCH] ?? '').trim().toLowerCase();
	return v === '0' || v === 'false' || v === 'off' || v === 'no';
}

/**
 * Shrink a snapshot until its JSON fits the body limit: the longest list
 * loses its tail first.
 *
 * @param snapshot - Snapshot (mutated)
 * @returns The same snapshot
 */
export function fitSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
	const size = (): number => Buffer.byteLength(JSON.stringify(snapshot));
	// Links go first: a map of lines is the least important part of the body
	while (snapshot.links && snapshot.links.length > 0 && size() > C.MAX_BODY_BYTES) snapshot.links.length = Math.floor(snapshot.links.length / 2);
	const lists: Array<unknown[]> = [snapshot.outcomes.doneToday, snapshot.outcomes.stuck, snapshot.outcomes.waitingOnOwner];
	let guard = 0;
	while (size() > C.MAX_BODY_BYTES && guard < 500) {
		guard += 1;
		const longest = lists.reduce((a, b) => (b.length > a.length ? b : a), lists[0]);
		if (longest.length > 0) {
			longest.length = Math.floor(longest.length / 2);
			continue;
		}
		// Only agents are left: drop the last agent of the biggest team
		const team = [...snapshot.teams].sort((a, b) => b.agents.length - a.agents.length)[0];
		if (!team || team.agents.length === 0) break;
		team.agents.pop();
	}
	return snapshot;
}

/** Pushes snapshots and deltas. */
export class BoardPushService {
	private readonly logger: ComponentLogger;
	private readonly fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
	private readonly now: () => number;
	private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;

	private started = false;
	private fullTimer: ReturnType<typeof setTimeout> | null = null;
	private deltaTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribe: (() => void) | null = null;
	private readonly dirty = new Set<string>();
	/** Rows Cloud has, as JSON, by session */
	private readonly lastSent = new Map<string, string>();
	/** Links Cloud has, as JSON, by identity */
	private readonly lastLinks = new Map<string, string>();
	/** A message was recorded since the last delta: the links may differ */
	private linksDirty = false;
	private lastToken: string | null = null;
	private fullOk = false;
	private fullAfterMs: number = C.FULL_INTERVAL_MS;
	private failures = 0;
	private pausedUntil = 0;
	private pauseLogged = false;
	/** Cloud said viewers are watching until this time (epoch ms) */
	private liveUntil = 0;
	private inFlight: Promise<unknown> = Promise.resolve();

	constructor(private readonly deps: BoardPushDeps) {
		this.logger = deps.logger ?? LoggerService.getInstance().createComponentLogger('BoardPush');
		this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
		this.now = deps.now ?? Date.now;
		this.setTimer =
			deps.setTimeout ??
			((fn, ms) => {
				const t = setTimeout(fn, ms);
				t.unref?.();
				return t;
			});
		this.clearTimer = deps.clearTimeout ?? ((h) => clearTimeout(h));
	}

	/**
	 * Whether Cloud recently said someone is watching the canvas.
	 *
	 * @returns True while the live answer is believed
	 */
	isLive(): boolean {
		return this.now() < this.liveUntil;
	}

	/**
	 * Treat the canvas as watched for a while (an owner action just arrived, so
	 * someone is there).
	 */
	noteViewer(): void {
		this.liveUntil = Math.max(this.liveUntil, this.now() + CV.LIVE_TTL_MS);
	}

	/** Whether the push is switched off in the environment. */
	get disabled(): boolean {
		return isBoardPushDisabled(this.deps.env ?? process.env);
	}

	/** Start pushing. Idempotent; a no-op when switched off. Never throws. */
	start(): void {
		if (this.started || this.disabled) return;
		this.started = true;
		// A step changed: the agent's row did not necessarily, but a delta is due
		const offRows = this.deps.tracker.onChange((session) => this.markDirty(session));
		const offSteps = this.deps.tracker.steps.onChange((session) => this.markDirty(session));
		const offMessages = (this.deps.interactions ?? getAgentInteractions()).onRecord((from) => {
			this.linksDirty = true;
			this.markDirty(from);
		});
		this.unsubscribe = () => {
			offRows();
			offSteps();
			offMessages();
		};
		this.scheduleFull(0);
	}

	/** Stop timers and the subscription. */
	stop(): void {
		this.started = false;
		if (this.fullTimer) this.clearTimer(this.fullTimer);
		if (this.deltaTimer) this.clearTimer(this.deltaTimer);
		this.fullTimer = null;
		this.deltaTimer = null;
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.dirty.clear();
	}

	/**
	 * A session's row may have changed: send a delta soon.
	 *
	 * @param session - Agent session
	 */
	markDirty(session: string): void {
		if (!this.started) return;
		this.dirty.add(session);
		if (this.deltaTimer) return;
		this.deltaTimer = this.setTimer(() => {
			this.deltaTimer = null;
			void this.flushDelta();
		}, this.isLive() ? CV.LIVE_DELTA_DELAY_MS : C.DELTA_DELAY_MS);
	}

	private scheduleFull(delayMs: number): void {
		if (!this.started) return;
		if (this.fullTimer) this.clearTimer(this.fullTimer);
		this.fullTimer = this.setTimer(() => {
			this.fullTimer = null;
			void this.pushFull().finally(() => this.scheduleFull(this.nextFullDelay()));
		}, delayMs);
	}

	private nextFullDelay(): number {
		// A failure retries by its own backoff (or pause), not by the 60 s cadence
		const remaining = this.pausedUntil - this.now();
		return remaining > 0 ? remaining : this.fullAfterMs;
	}

	/** The Cloud endpoint and token, or null when the machine is not signed in or a pause is on. */
	private target(): { base: string; token: string } | 'paused' | null {
		if (this.disabled) return null;
		const token = this.deps.cloud.getToken();
		const base = this.deps.cloud.getCloudUrl();
		if (!token || !base) return null;
		if (token !== this.lastToken) {
			// New sign-in / refreshed token: Cloud's copy may be another account's; resend everything
			if (this.lastToken !== null) this.fullOk = false;
			this.lastToken = token;
		}
		if (this.now() < this.pausedUntil) return 'paused';
		return { base: base.replace(/\/$/, ''), token };
	}

	/**
	 * Build and send the full snapshot, then any timeline events that are
	 * waiting. Serialised with deltas. Never throws.
	 *
	 * @returns What happened
	 */
	pushFull(): Promise<BoardPushOutcome> {
		const run = this.inFlight.then(() => this.doFull()).catch((): BoardPushOutcome => 'failed');
		this.inFlight = run;
		return run;
	}

	private async doFull(): Promise<BoardPushOutcome> {
		const target = this.target();
		if (target === null) return 'skipped';
		if (target === 'paused') return 'paused';
		const snapshot = fitSnapshot(await this.deps.builder.build());
		const outcome = await this.post(target, C.SNAPSHOT_PATH, snapshot, snapshot.instanceId);
		if (outcome !== 'sent') return outcome;
		this.fullOk = true;
		this.lastSent.clear();
		for (const team of snapshot.teams) for (const a of team.agents) this.lastSent.set(a.session, JSON.stringify(a));
		this.lastLinks.clear();
		for (const l of snapshot.links ?? []) this.lastLinks.set(linkKey(l), JSON.stringify(l));
		this.linksDirty = false;
		this.dirty.clear();
		// Timeline events ride in deltas
		const pending = new Set([...this.deps.tracker.sessionsWithUnsent(), ...this.deps.tracker.steps.sessionsWithUnsent()]);
		if (pending.size > 0) await this.doDelta(pending);
		return 'sent';
	}

	/**
	 * Send a delta for the sessions marked dirty. Serialised with full pushes.
	 * Never throws.
	 *
	 * @returns What happened
	 */
	flushDelta(): Promise<BoardPushOutcome> {
		const sessions = new Set(this.dirty);
		this.dirty.clear();
		const run = this.inFlight.then(() => this.doDelta(sessions)).catch((): BoardPushOutcome => 'failed');
		this.inFlight = run;
		return run;
	}

	private async doDelta(sessions: Set<string>): Promise<BoardPushOutcome> {
		if (sessions.size === 0) return 'nothing';
		const target = this.target();
		// The next full snapshot carries the rows; a delta before the first one is pointless
		if (target === null || target === 'paused' || !this.fullOk || !this.deps.builder.primed) return target === 'paused' ? 'paused' : 'skipped';
		const rows = this.deps.builder.rows(sessions);
		const changed = rows.filter((r) => this.lastSent.get(r.session) !== JSON.stringify(stripTeam(r)));
		const timeline = this.deps.tracker.peekUnsent(sessions);
		let steps = this.deps.tracker.steps.peekUnsent(sessions);
		// Links are recomputed only after a message (the rest comes with the full build)
		let links: BoardLink[] = [];
		let removedLinks: string[] = [];
		const linksWereDirty = this.linksDirty;
		if (linksWereDirty) {
			this.linksDirty = false;
			const now = this.deps.builder.links();
			links = now.filter((l) => this.lastLinks.get(linkKey(l)) !== JSON.stringify(l));
			const keys = new Set(now.map(linkKey));
			removedLinks = [...this.lastLinks.keys()].filter((k) => !keys.has(k));
		}
		if (changed.length === 0 && timeline.length === 0 && steps.length === 0 && links.length === 0 && removedLinks.length === 0) return 'nothing';
		const instanceId = (await this.deps.builder.identity()).instanceId;
		const body: BoardDelta = {
			v: 1,
			instanceId,
			generatedAt: new Date(this.now()).toISOString(),
			agents: changed,
			...(timeline.length > 0 ? { timeline } : {}),
			...(steps.length > 0 ? { steps } : {}),
			...(links.length > 0 ? { links } : {}),
			...(removedLinks.length > 0 ? { removedLinks } : {}),
		};
		// The body limit is on the uncompressed JSON: the newest steps go first when it does not fit
		for (let guard = 0; guard < 20 && body.steps && Buffer.byteLength(JSON.stringify(body)) > C.MAX_BODY_BYTES; guard += 1) {
			steps = steps.slice(Math.ceil(steps.length / 2));
			if (steps.length > 0) body.steps = steps;
			else delete body.steps;
		}
		const outcome = await this.post(target, C.DELTA_PATH, body, instanceId);
		if (outcome === 'sent') {
			for (const r of changed) this.lastSent.set(r.session, JSON.stringify(stripTeam(r)));
			for (const l of links) this.lastLinks.set(linkKey(l), JSON.stringify(l));
			for (const k of removedLinks) this.lastLinks.delete(k);
			this.deps.tracker.ackUnsent(timeline);
			this.deps.tracker.steps.ackUnsent(steps);
			// Steps the per-delta limit held back go in the next one
			const left = this.deps.tracker.steps.sessionsWithUnsent();
			for (const session of left) this.markDirty(session);
		} else if (outcome === 'failed') {
			// keep them dirty for the next try (the full push also repairs everything)
			if (linksWereDirty) this.linksDirty = true;
			for (const s of sessions) this.dirty.add(s);
		}
		return outcome;
	}

	/** Cloud's answer says whether anyone is watching (`live: true` or `viewers > 0`, at the top or under `next`). */
	private noteLiveAnswer(data: { live?: unknown; viewers?: unknown; next?: { live?: unknown; viewers?: unknown } } | undefined): void {
		if (!data) return;
		const live = (o: { live?: unknown; viewers?: unknown } | undefined): boolean | null => {
			if (!o) return null;
			if (typeof o.live === 'boolean') return o.live;
			if (typeof o.viewers === 'number' && Number.isFinite(o.viewers)) return o.viewers > 0;
			return null;
		};
		const answer = live(data) ?? live(data.next);
		if (answer === true) this.liveUntil = this.now() + CV.LIVE_TTL_MS;
		else if (answer === false) this.liveUntil = 0;
	}

	private async post(target: { base: string; token: string }, path: string, body: unknown, instanceId: string): Promise<BoardPushOutcome> {
		const json = JSON.stringify(body);
		const gz = gzipSync(Buffer.from(json));
		let status = 0;
		let code: string | null = null;
		try {
			const response = await this.fetchImpl(`${target.base}${path}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${target.token}`,
					'Content-Type': 'application/json',
					'Content-Encoding': 'gzip',
					[C.INSTANCE_HEADER]: instanceId,
				},
				body: gz,
				signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS),
			});
			status = response.status;
			if (response.ok) {
				const parsed = (await response.json().catch(() => null)) as {
					data?: { live?: unknown; viewers?: unknown; next?: { fullAfterSec?: unknown; live?: unknown; viewers?: unknown } };
				} | null;
				const sec = parsed?.data?.next?.fullAfterSec;
				if (typeof sec === 'number' && Number.isFinite(sec)) this.fullAfterMs = Math.min(600, Math.max(15, sec)) * 1000;
				this.noteLiveAnswer(parsed?.data);
				this.failures = 0;
				if (this.pauseLogged) {
					this.pauseLogged = false;
					this.logger.info('Crewly Cloud is taking board updates again');
				}
				return 'sent';
			}
			const parsed = (await response.json().catch(() => null)) as { code?: unknown } | null;
			code = typeof parsed?.code === 'string' ? parsed.code : null;
		} catch (error) {
			code = error instanceof Error ? error.message : String(error);
		}
		if (status === 404 || status === 400 || status === 503 || status === 403 || status === 413) {
			this.pausedUntil = this.now() + C.UNAVAILABLE_RETRY_MS;
			this.fullOk = false;
			if (!this.pauseLogged) {
				this.pauseLogged = true;
				this.logger.info('Crewly Cloud is not taking board updates right now; checking again later', { status, code });
			}
			return 'paused';
		}
		if (status === 401) void this.deps.cloud.tryRefreshToken?.().catch(() => false);
		this.failures += 1;
		this.fullOk = false;
		const delay = Math.min(C.BACKOFF_INITIAL_MS * 2 ** (this.failures - 1), C.BACKOFF_MAX_MS);
		this.pausedUntil = this.now() + delay;
		// A failed delta: the next full snapshot repairs every row, so bring it forward to the end of the backoff
		if (path === C.DELTA_PATH) this.scheduleFull(delay);
		if (this.failures === 1) this.logger.warn('Board push failed; will retry', { status, code, retryInMs: delay });
		return 'failed';
	}
}

/** A row without the delta-only `teamId`, as the full snapshot has it. */
function stripTeam<T extends { teamId?: string }>(row: T): Omit<T, 'teamId'> {
	const { teamId: _teamId, ...rest } = row;
	void _teamId;
	return rest;
}
