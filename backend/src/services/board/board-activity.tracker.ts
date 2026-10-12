/**
 * Live activity per agent (crewly#1247): the current activity, the last
 * meaningful action and a rolling timeline, fed by hook events, browser
 * actions, chat replies and owner waits. In memory only: a restart starts the
 * timeline over (the agents restart with it).
 *
 * Event-driven: `record*` do a few map operations and tell the listeners; the
 * push scheduler decides when to send. Nothing here reads files or the
 * network.
 *
 * @module services/board/board-activity.tracker
 */

import { BOARD_CONSTANTS } from '../../constants.js';
import {
	normalizeBrowserAction,
	normalizeMessage,
	normalizeOwnerWait,
	normalizeToolUse,
	THINKING,
	type NormalizedActivity,
	type NormalizeContext,
	type ToolInput,
} from './board-activity.normalizer.js';
import type { BoardActivity, BoardTimelineEvent } from './board.types.js';

const C = BOARD_CONSTANTS;

/** Called when a session's board row may have changed. */
export type BoardChangeListener = (session: string) => void;

interface SessionActivity {
	/** Open tool calls (tool_use_id or synthetic) -> start time */
	open: Map<string, number>;
	/** The activity being shown */
	current: { activity: NormalizedActivity; since: number; lastEventAt: number } | null;
	/** Last meaningful action (not "thinking") */
	last: { text: string; at: number } | null;
	/** Waiting for the owner (set by hooks: permission prompt / question) */
	ownerWait: { activity: NormalizedActivity; since: number } | null;
	/** Timeline, oldest first */
	timeline: BoardTimelineEvent[];
	/** Timeline events not yet sent to Cloud */
	unsent: BoardTimelineEvent[];
	seq: number;
}

/** What a session shows right now. */
export interface LiveActivity {
	activity: BoardActivity | null;
	lastAction: { text: string; at: string } | null;
}

/**
 * Per-session board activity.
 */
export class BoardActivityTracker {
	private static instance: BoardActivityTracker | null = null;
	private readonly sessions = new Map<string, SessionActivity>();
	private readonly listeners = new Set<BoardChangeListener>();
	/** Project roots by session, for relative paths */
	private rootsOf: (session: string) => readonly string[] = () => [];

	/** @returns The process-wide tracker */
	static getInstance(): BoardActivityTracker {
		if (!BoardActivityTracker.instance) BoardActivityTracker.instance = new BoardActivityTracker();
		return BoardActivityTracker.instance;
	}

	/** Drop the process-wide tracker (tests). */
	static resetInstance(): void {
		BoardActivityTracker.instance = null;
	}

	/**
	 * Where an agent's project roots come from.
	 *
	 * @param fn - Session -> project roots
	 */
	setRootsResolver(fn: (session: string) => readonly string[]): void {
		this.rootsOf = fn;
	}

	/**
	 * Subscribe to changes.
	 *
	 * @param listener - Called with the session whose row may have changed
	 * @returns Unsubscribe
	 */
	onChange(listener: BoardChangeListener): () => void {
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

	private get(session: string): SessionActivity {
		let s = this.sessions.get(session);
		if (!s) {
			s = { open: new Map(), current: null, last: null, ownerWait: null, timeline: [], unsent: [], seq: 0 };
			this.sessions.set(session, s);
		}
		return s;
	}

	/**
	 * A hook event arrived. PreToolUse starts an activity; PostToolUse ends
	 * it; UserPromptSubmit / Stop / SessionStart reset the turn; a permission
	 * prompt or question is a wait on the owner.
	 *
	 * @param session - Agent session
	 * @param event - Hook event name
	 * @param info - Tool details (PreToolUse / PostToolUse) and the notification type
	 * @param now - Clock (tests)
	 */
	recordHook(
		session: string,
		event: string,
		info: { toolName?: string; toolInput?: ToolInput; toolUseId?: string; notificationType?: string; isSubagent?: boolean } = {},
		now: number = Date.now(),
	): void {
		const s = this.get(session);
		switch (event) {
			case 'PreToolUse': {
				if (!info.toolName) return;
				const roots = this.safeRoots(session);
				const activity = normalizeToolUse(info.toolName, info.toolInput ?? {}, { roots } as NormalizeContext);
				s.open.set(info.toolUseId ?? `anon-${(s.seq += 1)}`, now);
				s.ownerWait = null;
				this.show(session, s, activity, now);
				return;
			}
			case 'PostToolUse': {
				if (info.toolUseId) s.open.delete(info.toolUseId);
				else if (s.open.size > 0) s.open.delete(s.open.keys().next().value as string);
				if (s.current) s.current.lastEventAt = now;
				s.ownerWait = null;
				return;
			}
			case 'UserPromptSubmit':
			case 'SessionStart':
				s.open.clear();
				s.ownerWait = null;
				s.current = { activity: THINKING, since: now, lastEventAt: now };
				this.emit(session);
				return;
			case 'Stop':
				s.open.clear();
				s.ownerWait = null;
				s.current = null;
				this.emit(session);
				return;
			case 'Notification':
			case 'PermissionRequest':
				if (event === 'PermissionRequest' || info.notificationType === 'permission_prompt') {
					this.setOwnerWait(session, 'permission to continue', now);
				} else if (info.notificationType === 'elicitation_dialog') {
					this.setOwnerWait(session, 'an answer to its question', now);
				}
				return;
			default:
				return;
		}
	}

	/**
	 * An agent action in Chrome.
	 *
	 * @param session - Agent session
	 * @param tool - Extension tool name
	 * @param url - Page URL, if known
	 * @param now - Clock (tests)
	 */
	recordBrowser(session: string, tool: string, url?: string, now: number = Date.now()): void {
		const s = this.get(session);
		this.show(session, s, normalizeBrowserAction(tool, url), now);
	}

	/**
	 * An agent posted to a channel or the owner chat.
	 *
	 * @param session - Agent session
	 * @param channel - Channel or chat name
	 * @param now - Clock (tests)
	 */
	recordMessage(session: string, channel: string, now: number = Date.now()): void {
		const s = this.get(session);
		this.show(session, s, normalizeMessage(channel), now);
	}

	/**
	 * An agent waits on the owner.
	 *
	 * @param session - Agent session
	 * @param what - Short plain-words description
	 * @param now - Clock (tests)
	 */
	setOwnerWait(session: string, what: string, now: number = Date.now()): void {
		const s = this.get(session);
		if (s.ownerWait) return;
		const activity = normalizeOwnerWait(what);
		s.ownerWait = { activity, since: now };
		this.pushTimeline(s, session, activity, now);
		this.emit(session);
	}

	/**
	 * The wait is over.
	 *
	 * @param session - Agent session
	 */
	clearOwnerWait(session: string): void {
		const s = this.sessions.get(session);
		if (!s?.ownerWait) return;
		s.ownerWait = null;
		this.emit(session);
	}

	/** Make `activity` current and the last action; notify when the row changed. */
	private show(session: string, s: SessionActivity, activity: NormalizedActivity, now: number): void {
		const prev = s.current;
		const same = prev !== null && prev.activity.type === activity.type && prev.activity.detail === activity.detail;
		s.current = { activity, since: same && prev ? prev.since : now, lastEventAt: now };
		if (activity.type !== 'thinking') {
			const changedText = s.last?.text !== activity.text;
			s.last = { text: activity.text, at: now };
			this.pushTimeline(s, session, activity, now);
			if (!same || changedText) this.emit(session);
		} else if (!same) {
			this.emit(session);
		}
	}

	private pushTimeline(s: SessionActivity, session: string, activity: NormalizedActivity, now: number): void {
		const tail = s.timeline[s.timeline.length - 1];
		// The same line twice within 10 s is one event (a tool called in a loop)
		if (tail && tail.text === activity.text && now - Date.parse(tail.at) < 10_000) return;
		const event: BoardTimelineEvent = { session, at: new Date(now).toISOString(), type: activity.type, text: activity.text };
		s.timeline.push(event);
		s.unsent.push(event);
		if (s.timeline.length > C.TIMELINE_MAX_EVENTS) s.timeline.splice(0, s.timeline.length - C.TIMELINE_MAX_EVENTS);
		if (s.unsent.length > C.TIMELINE_MAX_EVENTS) s.unsent.splice(0, s.unsent.length - C.TIMELINE_MAX_EVENTS);
	}

	private safeRoots(session: string): readonly string[] {
		try {
			return this.rootsOf(session);
		} catch {
			return [];
		}
	}

	/**
	 * What the session shows now. While a tool runs it is that tool; for
	 * {@link BOARD_CONSTANTS.ACTIVITY_LINGER_MS} after it, the same; then
	 * "thinking" (when `working`), else nothing.
	 *
	 * @param session - Agent session
	 * @param working - The runtime says the agent is in a turn
	 * @param now - Clock (tests)
	 * @returns Activity and last action
	 */
	live(session: string, working: boolean, now: number = Date.now()): LiveActivity {
		const s = this.sessions.get(session);
		if (!s) return { activity: working ? { type: 'thinking', detail: THINKING.detail, since: new Date(now).toISOString() } : null, lastAction: null };
		const lastAction = s.last ? { text: s.last.text, at: new Date(s.last.at).toISOString() } : null;
		if (s.ownerWait) {
			return { activity: { type: s.ownerWait.activity.type, detail: s.ownerWait.activity.detail, since: new Date(s.ownerWait.since).toISOString() }, lastAction };
		}
		// A lost PostToolUse must not pin a tool forever
		for (const [id, at] of s.open) if (now - at > C.OPEN_TOOL_MAX_MS) s.open.delete(id);
		const cur = s.current;
		if (!working && s.open.size === 0) return { activity: null, lastAction };
		if (cur && (s.open.size > 0 || now - cur.lastEventAt <= C.ACTIVITY_LINGER_MS || cur.activity.type === 'thinking')) {
			return { activity: { type: cur.activity.type, detail: cur.activity.detail, since: new Date(cur.since).toISOString() }, lastAction };
		}
		if (working) {
			const since = cur ? cur.lastEventAt + C.ACTIVITY_LINGER_MS : now;
			return { activity: { type: 'thinking', detail: THINKING.detail, since: new Date(Math.min(since, now)).toISOString() }, lastAction };
		}
		return { activity: null, lastAction };
	}

	/**
	 * Timeline events not sent yet. Call {@link ackUnsent} once Cloud took them;
	 * until then they stay queued (capped), so a failed push loses nothing.
	 *
	 * @param sessions - Only these sessions (all when omitted)
	 * @returns Events, oldest first, at most {@link BOARD_CONSTANTS.DELTA_TIMELINE_MAX} per session
	 */
	peekUnsent(sessions?: Iterable<string>): BoardTimelineEvent[] {
		const out: BoardTimelineEvent[] = [];
		const keys = sessions ? [...sessions] : [...this.sessions.keys()];
		for (const key of keys) {
			const s = this.sessions.get(key);
			if (!s || s.unsent.length === 0) continue;
			out.push(...s.unsent.slice(-C.DELTA_TIMELINE_MAX));
		}
		return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
	}

	/**
	 * Mark events as sent (everything unsent up to the newest of them is
	 * dropped, including older ones cut by the per-delta limit).
	 *
	 * @param events - Events returned by {@link peekUnsent} that Cloud took
	 */
	ackUnsent(events: readonly BoardTimelineEvent[]): void {
		const newest = new Map<string, number>();
		for (const e of events) newest.set(e.session, Math.max(newest.get(e.session) ?? 0, Date.parse(e.at)));
		for (const [session, at] of newest) {
			const s = this.sessions.get(session);
			if (s) s.unsent = s.unsent.filter((e) => Date.parse(e.at) > at);
		}
	}

	/** Sessions with timeline events not yet sent. */
	sessionsWithUnsent(): string[] {
		return [...this.sessions.entries()].filter(([, s]) => s.unsent.length > 0).map(([k]) => k);
	}

	/**
	 * A session's recent timeline (24 h, newest last).
	 *
	 * @param session - Agent session
	 * @param now - Clock (tests)
	 * @returns Events
	 */
	timeline(session: string, now: number = Date.now()): BoardTimelineEvent[] {
		const s = this.sessions.get(session);
		if (!s) return [];
		const cutoff = now - C.TIMELINE_MAX_AGE_MS;
		s.timeline = s.timeline.filter((e) => Date.parse(e.at) >= cutoff);
		return [...s.timeline];
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

/**
 * The process-wide tracker.
 *
 * @returns The tracker
 */
export function getBoardActivity(): BoardActivityTracker {
	return BoardActivityTracker.getInstance();
}
