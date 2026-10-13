/**
 * Stalled background work watchdog.
 *
 * A Claude Code agent that starts a background subagent / fork and ends its
 * turn is "busy" for as long as that work runs (up to OPEN_WORK_MAX_MS). When
 * the fork dies silently, nobody noticed for an hour and the agent was then
 * stopped for a slot with its promise unmet (Pia, 2026-10-12). This watchdog
 * looks for background work whose transcript stopped growing
 * (`AgentTurnStateService.stalledBackground`), stops counting it as busy and
 * tells the agent once.
 *
 * @module services/monitoring/background-work-watchdog
 */

import { TURN_STATE_CONSTANTS } from '../../constants.js';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import type { AgentTurnStateService, StalledBackground } from './agent-turn-state.js';

/** What the watchdog needs. */
export interface BackgroundWatchdogDeps {
	/** Turn state to probe */
	turnState: Pick<AgentTurnStateService, 'knownSessions' | 'stalledBackground' | 'dropBackground'>;
	/** Deliver text into an agent's conversation */
	sendToAgent: (session: string, text: string) => Promise<{ success: boolean }>;
	/** Clock (tests) */
	now?: () => number;
}

/**
 * The nudge sent to an agent whose background work stopped.
 *
 * @param stalled - The stalled work
 * @param now - Epoch ms
 * @returns Harness text for the agent
 */
export function stalledBackgroundNudge(stalled: StalledBackground, now: number): string {
	const at = new Date(stalled.lastProgressAt).toISOString().slice(11, 16);
	const minutes = Math.max(1, Math.round((now - stalled.lastProgressAt) / 60_000));
	const what = stalled.description ? `"${stalled.description}"` : 'a background task';
	return (
		`[BACKGROUND TASK STALLED] Your background task ${what} has made no progress since ${at} UTC (${minutes} min). ` +
		'It most likely died. Check what it produced; if the work is not finished, continue it yourself in the foreground now. ' +
		'Do not wait for it to report. If you told the owner you would deliver something, you still owe it.'
	);
}

/**
 * Periodic check for stalled background work.
 */
export class BackgroundWorkWatchdog {
	private timer: NodeJS.Timeout | null = null;
	private readonly logger: ComponentLogger;
	private busy = false;

	/**
	 * @param deps - Seams
	 */
	constructor(private readonly deps: BackgroundWatchdogDeps) {
		this.logger = LoggerService.getInstance().createComponentLogger('BackgroundWatchdog');
	}

	/** Start the periodic check. */
	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => {
			void this.tick().catch(() => undefined);
		}, TURN_STATE_CONSTANTS.BACKGROUND_WATCHDOG_INTERVAL_MS);
		this.timer.unref?.();
	}

	/** Stop the periodic check. */
	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/**
	 * One pass: nudge each agent whose background work stalled, once, and stop
	 * counting that work. Never throws.
	 *
	 * @returns Sessions nudged
	 */
	async tick(): Promise<string[]> {
		if (this.busy) return [];
		this.busy = true;
		const nudged: string[] = [];
		try {
			const now = this.deps.now ? this.deps.now() : Date.now();
			for (const session of this.deps.turnState.knownSessions()) {
				const stalled = this.deps.turnState.stalledBackground(session, now);
				if (!stalled) continue;
				// Dropped first: the agent is told once, and no longer counted busy.
				this.deps.turnState.dropBackground(session);
				this.logger.warn('Background work made no progress — telling the agent', {
					session,
					silentMin: Math.round((now - stalled.lastProgressAt) / 60_000),
					tasks: stalled.agentIds.length,
				});
				try {
					await this.deps.sendToAgent(session, stalledBackgroundNudge(stalled, now));
					nudged.push(session);
				} catch {
					/* best-effort: the work is no longer counted either way */
				}
			}
		} finally {
			this.busy = false;
		}
		return nudged;
	}
}
