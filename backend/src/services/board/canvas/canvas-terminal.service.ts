/**
 * Masked terminal tail for the canvas (crewly#1247 v2).
 *
 * The owner opens an agent's terminal in the portal: Cloud relays
 * `terminal_open`, and this service posts the agent's PTY tail to Cloud about
 * once a second - the first frame is the last 200 lines - until the viewer
 * stops renewing (a lease of 2 minutes, renewed by `terminal_renew` every
 * 60 s), closes it, the agent's session ends, Cloud says it is no longer
 * wanted, or the stream has run 30 minutes.
 *
 * Every frame is masked on the machine ({@link maskTerminalText}: secrets by
 * value, by name and by shape, emails, URL queries, bearer tokens, password
 * prompts, long token-like words) BEFORE it is posted; a frame is only posted
 * when its masked content changed. Frames are never written to disk here and
 * Cloud keeps them in memory only.
 *
 * @module services/board/canvas/canvas-terminal.service
 */

import { gzipSync } from 'zlib';
import { CANVAS_CONSTANTS, BOARD_CONSTANTS } from '../../../constants.js';
import type { SecretEnvValue } from '../../../utils/secret-env.js';
import { LoggerService, type ComponentLogger } from '../../core/logger.service.js';
import { maskTerminalText } from './canvas-redact.js';
import type { TerminalFrame } from './canvas.types.js';

const C = CANVAS_CONSTANTS;

/** The Cloud session (CloudClientService). */
export interface TerminalCloud {
	getToken(): string | null;
	getCloudUrl(): string | null;
	tryRefreshToken?(): Promise<boolean>;
}

/** Constructor dependencies. */
export interface CanvasTerminalDeps {
	cloud: TerminalCloud;
	/** This machine's Cloud instance id */
	identity: () => Promise<{ instanceId: string }>;
	/** The raw PTY tail of a session, or null when it has none */
	capture: (session: string, lines: number) => string | null;
	/** Whether the agent's terminal session exists */
	exists: (session: string) => boolean;
	/** Exact secret values to mask */
	secrets?: () => readonly SecretEnvValue[];
	fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
	now?: () => number;
	setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	clearTimeout?: (h: ReturnType<typeof setTimeout>) => void;
	logger?: ComponentLogger;
}

/** Why a stream could not be opened. */
export type TerminalOpenResult = { ok: true } | { ok: false; code: 'no_session' | 'too_many_streams' | 'not_signed_in' };

interface Stream {
	session: string;
	seq: number;
	startedAt: number;
	leaseUntil: number;
	lastKey: string | null;
	failures: number;
	timer: ReturnType<typeof setTimeout> | null;
	busy: boolean;
	/** Re-send even when nothing changed (reopened) */
	force: boolean;
}

/** Streams masked PTY tails to Cloud while a viewer holds a lease. */
export class CanvasTerminalService {
	private readonly streams = new Map<string, Stream>();
	private readonly logger: ComponentLogger;
	private readonly now: () => number;
	private readonly fetchImpl: (input: string, init: RequestInit) => Promise<Response>;
	private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	private readonly clearTimer: (h: ReturnType<typeof setTimeout>) => void;

	constructor(private readonly deps: CanvasTerminalDeps) {
		this.logger = deps.logger ?? LoggerService.getInstance().createComponentLogger('CanvasTerminal');
		this.now = deps.now ?? Date.now;
		this.fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
		this.setTimer =
			deps.setTimeout ??
			((fn, ms) => {
				const t = setTimeout(fn, ms);
				t.unref?.();
				return t;
			});
		this.clearTimer = deps.clearTimeout ?? ((h) => clearTimeout(h));
	}

	/** Sessions being streamed. */
	active(): string[] {
		return [...this.streams.keys()];
	}

	/**
	 * Start (or restart) a stream; the first frame goes out at once.
	 *
	 * @param session - Agent session
	 * @returns Whether it is streaming
	 */
	open(session: string): TerminalOpenResult {
		if (!this.deps.cloud.getToken() || !this.deps.cloud.getCloudUrl()) return { ok: false, code: 'not_signed_in' };
		if (!this.deps.exists(session)) return { ok: false, code: 'no_session' };
		const existing = this.streams.get(session);
		if (existing) {
			existing.leaseUntil = this.now() + C.TERMINAL_LEASE_MS;
			existing.force = true;
			this.schedule(existing, 0);
			return { ok: true };
		}
		if (this.streams.size >= C.TERMINAL_MAX_STREAMS) return { ok: false, code: 'too_many_streams' };
		const now = this.now();
		const stream: Stream = { session, seq: 0, startedAt: now, leaseUntil: now + C.TERMINAL_LEASE_MS, lastKey: null, failures: 0, timer: null, busy: false, force: true };
		this.streams.set(session, stream);
		this.schedule(stream, 0);
		return { ok: true };
	}

	/**
	 * The viewer is still there: extend the lease.
	 *
	 * @param session - Agent session
	 * @returns False when no stream is open (the viewer must open again)
	 */
	renew(session: string): boolean {
		const s = this.streams.get(session);
		if (!s) return false;
		s.leaseUntil = this.now() + C.TERMINAL_LEASE_MS;
		return true;
	}

	/**
	 * Stop a stream; a last frame tells Cloud it ended.
	 *
	 * @param session - Agent session
	 * @param reason - Why it ended
	 */
	close(session: string, reason: NonNullable<TerminalFrame['reason']> = 'closed'): void {
		const s = this.streams.get(session);
		if (!s) return;
		this.streams.delete(session);
		if (s.timer) this.clearTimer(s.timer);
		s.timer = null;
		void this.post(s, [], true, reason).catch(() => undefined);
	}

	/** Stop every stream (shutdown). */
	closeAll(): void {
		for (const session of [...this.streams.keys()]) this.close(session, 'closed');
	}

	private schedule(s: Stream, delayMs: number): void {
		if (s.timer) this.clearTimer(s.timer);
		s.timer = this.setTimer(() => {
			s.timer = null;
			void this.tick(s);
		}, delayMs);
	}

	/** One frame: stop if the stream is over, else mask the tail and post it when it changed. */
	private async tick(s: Stream): Promise<void> {
		if (this.streams.get(s.session) !== s || s.busy) return;
		s.busy = true;
		try {
			const now = this.now();
			if (now > s.leaseUntil) return this.close(s.session, 'lease_expired');
			if (now - s.startedAt > C.TERMINAL_MAX_STREAM_MS) return this.close(s.session, 'too_long');
			if (!this.deps.exists(s.session)) return this.close(s.session, 'session_gone');
			let raw: string | null = null;
			try {
				raw = this.deps.capture(s.session, C.TERMINAL_TAIL_LINES);
			} catch {
				raw = null;
			}
			if (raw !== null) {
				const lines = maskTerminalText(raw, this.deps.secrets?.() ?? []);
				const key = lines.join('\n');
				if (s.force || key !== s.lastKey) {
					const outcome = await this.post(s, lines, false);
					if (this.streams.get(s.session) !== s) return;
					if (outcome === 'stop') return this.close(s.session, 'cloud_stopped');
					if (outcome === 'ok') {
						s.lastKey = key;
						s.force = false;
						s.failures = 0;
					} else {
						s.failures += 1;
						if (s.failures >= C.TERMINAL_MAX_FAILURES) return this.close(s.session, 'send_failed');
					}
				}
			}
			if (this.streams.get(s.session) === s) this.schedule(s, C.TERMINAL_FRAME_INTERVAL_MS);
		} finally {
			s.busy = false;
		}
	}

	/**
	 * Post one frame.
	 *
	 * @returns `ok`; `stop` when Cloud no longer wants frames (404 / 403 / 410, `keep: false`); `retry` on any other failure
	 */
	private async post(s: Stream, lines: string[], closed: boolean, reason?: TerminalFrame['reason']): Promise<'ok' | 'stop' | 'retry'> {
		const token = this.deps.cloud.getToken();
		const base = this.deps.cloud.getCloudUrl();
		if (!token || !base) return 'retry';
		const instanceId = (await this.deps.identity()).instanceId;
		s.seq += 1;
		const frame: TerminalFrame = {
			instanceId,
			session: s.session,
			seq: s.seq,
			at: new Date(this.now()).toISOString(),
			lines,
			...(closed ? { closed: true, ...(reason ? { reason } : {}) } : {}),
		};
		let refreshed = false;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			let response: Response;
			try {
				response = await this.fetchImpl(`${base.replace(/\/$/, '')}${C.TERMINAL_FRAME_PATH}`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.deps.cloud.getToken() ?? token}`,
						'Content-Type': 'application/json',
						'Content-Encoding': 'gzip',
						[BOARD_CONSTANTS.INSTANCE_HEADER]: instanceId,
					},
					body: gzipSync(Buffer.from(JSON.stringify(frame))),
					signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS),
				});
			} catch {
				return 'retry';
			}
			if (response.status === 401 && !refreshed && this.deps.cloud.tryRefreshToken) {
				refreshed = true;
				if (await this.deps.cloud.tryRefreshToken().catch(() => false)) continue;
			}
			if (response.status === 404 || response.status === 403 || response.status === 410) return 'stop';
			if (!response.ok) return 'retry';
			if (closed) return 'ok';
			const parsed = (await response.json().catch(() => null)) as { data?: { keep?: unknown } } | null;
			return parsed?.data?.keep === false ? 'stop' : 'ok';
		}
		return 'retry';
	}
}
