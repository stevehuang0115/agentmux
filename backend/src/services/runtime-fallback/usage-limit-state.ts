/**
 * Usage-limit state per agent session — "this agent's runtime is out of
 * usage until …". Process-wide and dependency-free (like the spend-cap gate)
 * so the hot paths can ask it cheaply: the orchestrator restart service and
 * heartbeat monitor (no restarts while limited), delivery (no waiting on a
 * prompt that will not come, messages held), dispatch, and the status APIs.
 *
 * Why (2026-10-16): the orchestrator sat on Claude Code's weekly-limit menu
 * for ~38 hours. Crewly kept waiting for its prompt every ~17s, restarted it
 * 12 times in 15 minutes, and `GET /api/orchestrator/status` said "active and
 * ready" the whole time.
 *
 * Fed by the login/screen monitor (screen sweep + live output) through
 * {@link markUsageLimited}. A state lifts on its own at the reset time (plus
 * a short grace), or after {@link USAGE_LIMIT_STATE_CONSTANTS.NO_RESET_BACKOFF_MS}
 * when no reset time was given; it is set again if the limit is still there.
 * It is lifted early ({@link liftUsageLimit}) as soon as the agent works
 * again: a finished turn or tool call (Claude Code hooks), or fresh live
 * output that is not a limit message.
 * It is held in memory only: it describes the live screen, and after a Crewly
 * restart the screen is read again.
 *
 * Distinct from the runtime fallback's account-wide "exhausted runtime"
 * record: that one moves agents to another runtime; this one says what a
 * given session is doing right now. A session moved to another runtime is
 * cleared ({@link clearUsageLimit}).
 *
 * @module services/runtime-fallback/usage-limit-state
 */

import { RUNTIME_FALLBACK_CONSTANTS, USAGE_LIMIT_STATE_CONSTANTS } from '../../constants.js';

/** Where a usage-limit state was seen. */
export type UsageLimitSource = 'menu' | 'screen' | 'output';

/** A session that is out of usage. */
export interface UsageLimitedInfo {
	/** Agent session */
	sessionName: string;
	/** Runtime that is out of usage (null when unknown) */
	runtime: string | null;
	/** Detection rule (logs only) */
	ruleId: string;
	/** Where it was seen */
	source: UsageLimitSource;
	/** ISO time of first detection */
	detectedAt: string;
	/** ISO time the limit was last seen (every detection refreshes it) */
	lastSeenAt: string;
	/** ISO time the runtime says the limit resets, when it says so */
	until?: string;
	/** ISO time the session may be tried again (reset + grace, or the backoff) */
	retryAt: string;
	/** ISO time Crewly answered the usage-limit menu, when it did */
	menuAnsweredAt?: string;
}

/** Input of {@link markUsageLimited}. */
export interface MarkUsageLimitedInput {
	sessionName: string;
	runtime: string | null;
	ruleId: string;
	/** Reset time (epoch ms), or null when unknown */
	resetAt: number | null;
	source: UsageLimitSource;
}

/** API view of a usage-limited session (the `usageLimited` status field). */
export interface UsageLimitedView {
	/** ISO reset time, when known */
	until?: string;
	/** ISO time Crewly tries the session again */
	retryAt: string;
	/** ISO time of first detection */
	detectedAt: string;
	/** Runtime that is out of usage */
	runtime: string | null;
}

const states = new Map<string, UsageLimitedInfo>();

/**
 * When a state with this reset time may be tried again.
 *
 * @param resetAt - Reset time (ms), or null
 * @param now - Current time (ms)
 * @returns Epoch ms
 */
function retryAtFor(resetAt: number | null, now: number): number {
	return resetAt !== null
		? resetAt + USAGE_LIMIT_STATE_CONSTANTS.RESET_GRACE_MS
		: now + USAGE_LIMIT_STATE_CONSTANTS.NO_RESET_BACKOFF_MS;
}

/**
 * Record that a session is out of usage. A state already in force keeps its
 * first-detection time; a reset time seen later replaces the backoff, and a
 * later detection without one does not extend it.
 *
 * @param input - Session, runtime, rule, reset time, source
 * @param now - Current time (ms)
 * @returns The state and whether it is new (not in force before this call)
 *
 * @example
 * ```ts
 * markUsageLimited({ sessionName: 'crewly-orc', runtime: 'claude-code', ruleId: 'claude.hit_your_limit', resetAt, source: 'menu' });
 * ```
 */
export function markUsageLimited(input: MarkUsageLimitedInput, now: number = Date.now()): { info: UsageLimitedInfo; isNew: boolean } {
	const existing = usageLimitOf(input.sessionName, now);
	// A reset in the past or implausibly far ahead (an old dated message read
	// as next year's) is not trusted: back off instead.
	const resetAt =
		input.resetAt !== null && input.resetAt > now && input.resetAt - now <= USAGE_LIMIT_STATE_CONSTANTS.MAX_RESET_AHEAD_MS
			? input.resetAt
			: null;
	const until = resetAt !== null ? new Date(resetAt).toISOString() : undefined;
	if (existing) {
		if (until && existing.until !== until) {
			existing.until = until;
			existing.retryAt = new Date(retryAtFor(resetAt, now)).toISOString();
		}
		if (input.runtime && !existing.runtime) existing.runtime = input.runtime;
		if (input.source === 'menu') existing.source = 'menu';
		existing.lastSeenAt = new Date(now).toISOString();
		return { info: existing, isNew: false };
	}
	const info: UsageLimitedInfo = {
		sessionName: input.sessionName,
		runtime: input.runtime,
		ruleId: input.ruleId,
		source: input.source,
		detectedAt: new Date(now).toISOString(),
		lastSeenAt: new Date(now).toISOString(),
		...(until ? { until } : {}),
		retryAt: new Date(retryAtFor(resetAt, now)).toISOString(),
	};
	states.set(input.sessionName, info);
	return { info, isNew: true };
}

/**
 * The usage-limit state in force for a session. A state past its retry time
 * is dropped. Never throws.
 *
 * @param sessionName - Agent session
 * @param now - Current time (ms)
 * @returns The state, or null when the session may run
 */
export function usageLimitOf(sessionName: string, now: number = Date.now()): UsageLimitedInfo | null {
	const info = states.get(sessionName);
	if (!info) return null;
	if (Date.parse(info.retryAt) <= now) {
		states.delete(sessionName);
		return null;
	}
	return info;
}

/**
 * Milliseconds until a usage-limited session may be tried again.
 *
 * @param info - The state
 * @param now - Current time (ms)
 * @returns Milliseconds (at least 0)
 */
export function usageLimitRemainingMs(info: UsageLimitedInfo, now: number = Date.now()): number {
	return Math.max(0, Date.parse(info.retryAt) - now);
}

/**
 * Note that Crewly answered the usage-limit menu of a session.
 *
 * @param sessionName - Agent session
 * @param now - Current time (ms)
 */
export function noteUsageLimitMenuAnswered(sessionName: string, now: number = Date.now()): void {
	const info = usageLimitOf(sessionName, now);
	if (info) info.menuAnsweredAt = new Date(now).toISOString();
}

/**
 * Forget a session's usage-limit state (it moved to another runtime, or the
 * owner changed its runtime).
 *
 * @param sessionName - Agent session
 * @returns True when a state was in force
 */
export function clearUsageLimit(sessionName: string): boolean {
	return states.delete(sessionName);
}

/**
 * Lift a session's usage-limit state because the agent works again: it
 * finished a turn, or wrote fresh output that is not a limit message.
 * Activity within {@link USAGE_LIMIT_STATE_CONSTANTS.LIFT_GRACE_MS} of the
 * limit last being seen, or of Crewly answering its menu, is the repaint of
 * that screen and does not count.
 *
 * @param sessionName - Agent session
 * @param now - Current time (ms)
 * @returns The lifted state, or null when none was in force or it was too soon
 *
 * @example
 * ```ts
 * if (liftUsageLimit('crewly-orc')) logger.info('Orchestrator works again');
 * ```
 */
export function liftUsageLimit(sessionName: string, now: number = Date.now()): UsageLimitedInfo | null {
	const info = usageLimitOf(sessionName, now);
	if (!info) return null;
	const lastSeen = Math.max(Date.parse(info.lastSeenAt), info.menuAnsweredAt ? Date.parse(info.menuAnsweredAt) : 0);
	if (now - lastSeen < USAGE_LIMIT_STATE_CONSTANTS.LIFT_GRACE_MS) return null;
	states.delete(sessionName);
	return info;
}

/**
 * Every session that is usage-limited now.
 *
 * @param now - Current time (ms)
 * @returns States
 */
export function listUsageLimited(now: number = Date.now()): UsageLimitedInfo[] {
	return [...states.keys()].map((s) => usageLimitOf(s, now)).filter((i): i is UsageLimitedInfo => i !== null);
}

/**
 * The status-API view of a session's state (`usageLimited`), or undefined.
 *
 * @param sessionName - Agent session
 * @param now - Current time (ms)
 * @returns View, or undefined when the session is not limited
 */
export function usageLimitedView(sessionName: string, now: number = Date.now()): UsageLimitedView | undefined {
	const info = usageLimitOf(sessionName, now);
	if (!info) return undefined;
	return { ...(info.until ? { until: info.until } : {}), retryAt: info.retryAt, detectedAt: info.detectedAt, runtime: info.runtime };
}

/**
 * One-line, owner-facing reason, e.g. "Orchestrator is out of Claude usage
 * until 2026-10-17T00:00:00.000Z".
 *
 * @param name - Who is limited ("Orchestrator", "Ella")
 * @param info - The state
 * @returns Reason text
 */
export function usageLimitReason(name: string, info: UsageLimitedInfo): string {
	const runtime = info.runtime ? RUNTIME_FALLBACK_CONSTANTS.SHORT_LABELS[info.runtime] ?? info.runtime : null;
	const what = runtime ? `out of ${runtime} usage` : 'out of usage';
	return info.until
		? `${name} is ${what} until ${info.until}`
		: `${name} is ${what} (reset time unknown; trying again at ${info.retryAt})`;
}

/** Forget every state (tests). */
export function resetUsageLimitState(): void {
	states.clear();
}
