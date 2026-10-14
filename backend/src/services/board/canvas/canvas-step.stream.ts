/**
 * The live step stream per agent (crewly#1247 v2).
 *
 * Pairs a tool start with its end (hook PreToolUse / PostToolUse) into one
 * {@link StepEvent} with a duration and a status, takes instant steps (a chat
 * reply, a browser action) and the agent's own short text lines (from the
 * transcript tail), and keeps the last 300 per agent in memory.
 *
 * A step is sent again, with the same id, when it changes (`running` ->
 * `done` / `error`): `unsent` holds the newest version of every step Cloud has
 * not taken yet, so a failed push loses nothing (capped per agent).
 *
 * In memory only; nothing here reads files or the network. Everything that
 * goes in has been through the redaction in {@link ./canvas-step.normalizer}
 * and {@link ./canvas-redact}.
 *
 * @module services/board/canvas/canvas-step.stream
 */

import { CANVAS_CONSTANTS } from '../../../constants.js';
import type { StepShape } from './canvas-step.normalizer.js';
import type { StepEvent, StepStatus } from './canvas.types.js';

const C = CANVAS_CONSTANTS;

interface SessionSteps {
	/** Oldest first (by `at`) */
	steps: StepEvent[];
	byId: Map<string, StepEvent>;
	/** Ids of running steps, oldest first */
	open: string[];
	/** Newest version of each step Cloud has not taken */
	unsent: Map<string, StepEvent>;
	seq: number;
}

/** Called when a session's steps changed. */
export type StepChangeListener = (session: string) => void;

const sameVersion = (a: StepEvent, b: StepEvent): boolean => a.status === b.status && a.durationMs === b.durationMs && a.text === b.text && a.target === b.target;

/**
 * Steps per agent.
 */
export class StepStream {
	private readonly sessions = new Map<string, SessionSteps>();
	private readonly listeners = new Set<StepChangeListener>();

	/**
	 * Subscribe to changes.
	 *
	 * @param listener - Called with the session whose steps changed
	 * @returns Unsubscribe
	 */
	onChange(listener: StepChangeListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(session: string): void {
		for (const l of this.listeners) {
			try {
				l(session);
			} catch {
				// a listener must never break a hook
			}
		}
	}

	private get(session: string): SessionSteps {
		let s = this.sessions.get(session);
		if (!s) {
			s = { steps: [], byId: new Map(), open: [], unsent: new Map(), seq: 0 };
			this.sessions.set(session, s);
		}
		return s;
	}

	private touch(s: SessionSteps, step: StepEvent): void {
		s.unsent.set(step.id, { ...step });
		while (s.unsent.size > C.UNSENT_MAX_PER_AGENT) {
			const oldest = s.unsent.keys().next().value as string;
			s.unsent.delete(oldest);
		}
	}

	private insert(s: SessionSteps, step: StepEvent): void {
		let i = s.steps.length;
		const at = Date.parse(step.at);
		while (i > 0 && Date.parse(s.steps[i - 1].at) > at) i -= 1;
		s.steps.splice(i, 0, step);
		s.byId.set(step.id, step);
		while (s.steps.length > C.STEPS_MAX_PER_AGENT) {
			const gone = s.steps.shift() as StepEvent;
			s.byId.delete(gone.id);
			s.open = s.open.filter((id) => id !== gone.id);
		}
	}

	/** A running step older than the limit lost its end: close it without a duration. */
	private sweep(session: string, s: SessionSteps, now: number): void {
		const stale = s.open.filter((id) => {
			const step = s.byId.get(id);
			return !step || now - Date.parse(step.at) > C.OPEN_STEP_MAX_MS;
		});
		if (stale.length === 0) return;
		for (const id of stale) {
			const step = s.byId.get(id);
			if (step && step.status === 'running') {
				step.status = 'done';
				this.touch(s, step);
			}
		}
		s.open = s.open.filter((id) => !stale.includes(id));
		this.emit(session);
	}

	/**
	 * A step began (a tool call started).
	 *
	 * @param session - Agent session
	 * @param shape - Kind, verb and target
	 * @param opts.id - The runtime's tool-call id; a derived one when absent
	 * @param now - Clock (tests)
	 * @returns The step id
	 */
	start(session: string, shape: StepShape, opts: { id?: string } = {}, now: number = Date.now()): string {
		const s = this.get(session);
		this.sweep(session, s, now);
		s.seq += 1;
		const id = opts.id ?? `${session}-${now.toString(36)}-${s.seq}`;
		const existing = s.byId.get(id);
		if (existing) return id; // a repeated PreToolUse
		const step: StepEvent = { session, id, at: new Date(now).toISOString(), ...shape, status: 'running' };
		this.insert(s, step);
		s.open.push(id);
		this.touch(s, step);
		this.emit(session);
		return id;
	}

	/**
	 * A step ended. Without an id the oldest running step ends (a hook that
	 * did not name its tool call).
	 *
	 * @param session - Agent session
	 * @param id - Step id, if known
	 * @param status - How it ended
	 * @param now - Clock (tests)
	 */
	finish(session: string, id?: string, status: StepStatus = 'done', now: number = Date.now()): void {
		const s = this.sessions.get(session);
		if (!s) return;
		const target = id ?? s.open[0];
		if (!target) return;
		const step = s.byId.get(target);
		if (!step) return;
		s.open = s.open.filter((x) => x !== target);
		if (step.status !== 'running' && !(status === 'error' && step.status === 'done')) return;
		step.status = status;
		if (step.durationMs === undefined) step.durationMs = Math.max(0, now - Date.parse(step.at));
		this.touch(s, step);
		this.emit(session);
	}

	/**
	 * A step turned out to have failed (the transcript's `is_error` flag), after
	 * its end was already seen.
	 *
	 * @param session - Agent session
	 * @param id - Step id
	 * @param now - Clock (tests)
	 */
	markError(session: string, id: string, now: number = Date.now()): void {
		this.finish(session, id, 'error', now);
	}

	/**
	 * A step that has no duration (a message sent, a page opened by the
	 * extension). Dropped when a tool call of the same kind is running, or the
	 * previous step is the same thing within 5 s (a skill's own tool call and
	 * the controller that served it).
	 *
	 * @param session - Agent session
	 * @param shape - Kind, verb and target
	 * @param now - Clock (tests)
	 * @returns The step id, or null when it repeated the previous step
	 */
	instant(session: string, shape: StepShape, now: number = Date.now()): string | null {
		const s = this.get(session);
		// A tool call of the same kind is running: this is that very action seen from the
		// controller that served it (a messaging skill posting, the browser skill navigating)
		if (s.open.some((id) => s.byId.get(id)?.kind === shape.kind)) return null;
		const last = s.steps[s.steps.length - 1];
		if (last && last.kind === shape.kind && last.target === shape.target && now - Date.parse(last.at) < C.STEP_DEDUPE_MS) {
			// A running tool call that is this very action: let it carry the duration
			return null;
		}
		s.seq += 1;
		const id = `${session}-${now.toString(36)}-${s.seq}`;
		const step: StepEvent = { session, id, at: new Date(now).toISOString(), ...shape, status: 'done' };
		this.insert(s, step);
		this.touch(s, step);
		this.emit(session);
		return id;
	}

	/**
	 * One line of the agent's own words.
	 *
	 * @param session - Agent session
	 * @param id - Stable id (the transcript entry's uuid)
	 * @param atMs - When it was written
	 * @param text - Already reduced and redacted (see shortAgentLine)
	 * @returns True when it is new
	 */
	text(session: string, id: string, atMs: number, text: string): boolean {
		const s = this.get(session);
		const stepId = `txt-${id}`;
		if (s.byId.has(stepId)) return false;
		const step: StepEvent = {
			session,
			id: stepId,
			at: new Date(atMs).toISOString(),
			kind: 'text',
			label: 'Said',
			text: text.slice(0, C.TEXT_MAX),
			status: 'done',
		};
		this.insert(s, step);
		this.touch(s, step);
		this.emit(session);
		return true;
	}

	/**
	 * The turn ended: whatever still runs ended with it.
	 *
	 * @param session - Agent session
	 * @param now - Clock (tests)
	 */
	closeAll(session: string, now: number = Date.now()): void {
		const s = this.sessions.get(session);
		if (!s || s.open.length === 0) return;
		for (const id of [...s.open]) this.finish(session, id, 'done', now);
		s.open = [];
	}

	/**
	 * A session's recent steps (oldest first).
	 *
	 * @param session - Agent session
	 * @param limit - Newest this many
	 * @param now - Clock (tests)
	 * @returns Copies
	 */
	recent(session: string, limit: number = 50, now: number = Date.now()): StepEvent[] {
		const s = this.sessions.get(session);
		if (!s) return [];
		const cutoff = now - C.STEPS_MAX_AGE_MS;
		return s.steps.filter((x) => Date.parse(x.at) >= cutoff).slice(-limit).map((x) => ({ ...x }));
	}

	/** Whether the session has a step that is still running. */
	hasRunning(session: string): boolean {
		return (this.sessions.get(session)?.open.length ?? 0) > 0;
	}

	/**
	 * Steps (new or changed) Cloud has not taken. Call {@link ackUnsent} once
	 * it did.
	 *
	 * @param sessions - Only these sessions (all when omitted)
	 * @param max - Most steps in all
	 * @param perSession - Most steps per session (the oldest go first; the rest wait for the next delta)
	 * @returns Steps, oldest first
	 */
	peekUnsent(sessions?: Iterable<string>, max: number = C.DELTA_STEPS_MAX, perSession: number = C.DELTA_STEPS_PER_AGENT_MAX): StepEvent[] {
		const out: StepEvent[] = [];
		const keys = sessions ? [...sessions] : [...this.sessions.keys()];
		for (const key of keys) {
			const s = this.sessions.get(key);
			if (!s || s.unsent.size === 0) continue;
			const list = [...s.unsent.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
			out.push(...list.slice(0, perSession).map((x) => ({ ...x })));
		}
		out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
		return out.length > max ? out.slice(0, max) : out;
	}

	/**
	 * Mark steps as taken. A step that changed since it was peeked stays
	 * unsent (and goes out again); steps left over by the per-delta limit stay
	 * too, for the next delta.
	 *
	 * @param steps - What {@link peekUnsent} returned and Cloud accepted
	 */
	ackUnsent(steps: readonly StepEvent[]): void {
		for (const step of steps) {
			const s = this.sessions.get(step.session);
			if (!s) continue;
			const current = s.unsent.get(step.id);
			if (current && sameVersion(current, step)) s.unsent.delete(step.id);
		}
	}

	/** Sessions with steps not yet sent. */
	sessionsWithUnsent(): string[] {
		return [...this.sessions.entries()].filter(([, s]) => s.unsent.size > 0).map(([k]) => k);
	}

	/**
	 * Forget a session (it was deleted).
	 *
	 * @param session - Agent session
	 */
	forget(session: string): void {
		this.sessions.delete(session);
	}
}
