/**
 * Retry for a start that was deferred by the running-agent cap while a message
 * waits on the agent's queue.
 *
 * The slot queue gives a start 2 minutes and then lets go ("deferred"). The
 * dispatcher holds the owner's message on the agent's persisted queue in that
 * case, but nothing else starts the agent: the reconciler only wakes agents for
 * work items and the queued-wake only fires when an agent goes down. Without a
 * retry the message sits until someone happens to message the agent again
 * (Ella, 2026-10-11).
 *
 * @module services/messaging/deferred-start-retry
 */

import { LoggerService } from '../core/logger.service.js';

/** Tuning for {@link scheduleDeferredStartRetry}. */
export const DEFERRED_START_RETRY_CONSTANTS = {
	/** Pause between rounds (a round itself waits up to the slot-queue timeout) */
	ROUND_PAUSE_MS: 5_000,
	/** Rounds before the retry gives up (the message stays queued for the next wake) */
	MAX_ROUNDS: 6,
} as const;

/** What the retry needs. */
export interface DeferredStartRetryDeps {
	/** Starts the agent; `deferred` when it again waited for a slot and got none. */
	activate: (sessionName: string) => Promise<{ success: boolean; deferred?: boolean }>;
	/** Whether messages still wait on the agent's queue. */
	hasPending: (sessionName: string) => boolean;
	/** Pause between rounds (tests inject an instant one). */
	sleep?: (ms: number) => Promise<void>;
}

const logger = LoggerService.getInstance().createComponentLogger('DeferredStartRetry');
const inFlight = new Set<string>();

/** Forget retries in flight (tests). */
export function resetDeferredStartRetries(): void {
	inFlight.clear();
}

/**
 * Keep trying to start an agent whose start was deferred, until it starts, its
 * queue empties, a start fails for another reason, or the rounds run out.
 * One retry loop per agent.
 *
 * @param sessionName - Agent whose start was deferred
 * @param deps - Start, queue check and pause
 * @returns Resolves when the loop ends (callers normally do not await it)
 */
export async function scheduleDeferredStartRetry(sessionName: string, deps: DeferredStartRetryDeps): Promise<void> {
	if (inFlight.has(sessionName)) return;
	inFlight.add(sessionName);
	const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => { const t = setTimeout(resolve, ms); t.unref?.(); }));
	try {
		for (let round = 1; round <= DEFERRED_START_RETRY_CONSTANTS.MAX_ROUNDS; round++) {
			await sleep(DEFERRED_START_RETRY_CONSTANTS.ROUND_PAUSE_MS);
			if (!deps.hasPending(sessionName)) return;
			let res: { success: boolean; deferred?: boolean };
			try {
				res = await deps.activate(sessionName);
			} catch (err) {
				logger.warn('Deferred start retry failed', { sessionName, round, error: err instanceof Error ? err.message : String(err) });
				return;
			}
			if (res.success) {
				logger.info('Deferred start went through', { sessionName, round });
				return;
			}
			if (!res.deferred) {
				logger.warn('Deferred start retry ended: the start failed', { sessionName, round });
				return;
			}
		}
		logger.warn('Deferred start still waiting for a slot; leaving the message queued', { sessionName });
	} finally {
		inFlight.delete(sessionName);
	}
}
