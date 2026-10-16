/**
 * Read an agent's screen for a usage-limit state, record it, and answer
 * Claude Code's usage-limit menu.
 *
 * One entry point ({@link inspectUsageLimitScreen}) for every place that
 * already reads an agent's screen: the login/screen monitor's 30s sweep, the
 * orchestrator heartbeat, and the delivery wait for a prompt. Detection is
 * {@link detectUsageLimitScreen}; the state is {@link markUsageLimited}.
 *
 * The menu ("❯ 1. Stop and wait for limit to reset / 2. Wait here, then
 * continue automatically at 8pm") is answered with option 2, like the other
 * known start-up prompts are answered with the one right choice for an
 * unattended agent: the turn waits and goes on by itself at the reset, so
 * nobody has to come back and re-send it. Only while option 1 or 2 is the
 * highlighted one, once per state, and Enter is pressed only after the
 * screen shows option 2 highlighted.
 *
 * @module services/runtime-fallback/usage-limit-screen
 */

import { USAGE_LIMIT_STATE_CONSTANTS } from '../../constants.js';
import { delay } from '../../utils/async.utils.js';
import { reportRuntimeOutput } from './effective-runtime.js';
import { detectUsageLimitScreen } from './usage-limit-rules.js';
import { markUsageLimited, noteUsageLimitMenuAnswered, usageLimitOf, type UsageLimitedInfo } from './usage-limit-state.js';

/** Keys and screen access, to answer the menu. */
export interface UsageLimitMenuIO {
	sendKey(sessionName: string, key: string): Promise<void>;
	sendEnter(sessionName: string): Promise<void>;
	/** Current screen of the session */
	capture(sessionName: string): string;
}

/** Minimal logger. */
export interface UsageLimitScreenLogger {
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
}

/** Options of {@link inspectUsageLimitScreen}. */
export interface InspectUsageLimitOptions {
	/** Keys + capture; without it the menu is left alone */
	io?: UsageLimitMenuIO;
	logger?: UsageLimitScreenLogger;
	now?: number;
	/** Zone for reset clock times that name none */
	timeZone?: string;
	/** Hand a new detection to the runtime fallback (default true) */
	reportToFallback?: boolean;
}

/** `❯` on option 2 of the usage-limit menu. */
const OPTION_2_SELECTED = /❯\s*2\.\s*Wait\s*here/i;

/**
 * Answer the usage-limit menu with option 2 ("Wait here, then continue
 * automatically"). Down + check + Enter from option 1; Enter from option 2.
 *
 * @param sessionName - Session
 * @param selected - Highlighted option
 * @param io - Keys + capture
 * @returns True when Enter was pressed on option 2
 */
async function answerMenu(sessionName: string, selected: 1 | 2, io: UsageLimitMenuIO): Promise<boolean> {
	if (selected === 1) {
		await io.sendKey(sessionName, 'Down');
		await delay(USAGE_LIMIT_STATE_CONSTANTS.MENU_KEY_DELAY_MS);
		if (!OPTION_2_SELECTED.test(io.capture(sessionName))) return false;
	}
	await io.sendEnter(sessionName);
	return true;
}

/**
 * Look at a session's screen for a usage-limit state. On a match the state
 * is recorded (a new one is logged and handed to the runtime fallback, which
 * may move the agent to another runtime) and an open usage-limit menu is
 * answered. Never throws.
 *
 * @param sessionName - Session
 * @param screen - Captured screen
 * @param runtime - Runtime the session runs (null when unknown: nothing is detected)
 * @param options - Keys, logger, clock
 * @returns The state in force (also one recorded earlier), or null
 *
 * @example
 * ```ts
 * const limited = await inspectUsageLimitScreen('crewly-orc', screen, 'claude-code', { io });
 * if (limited) return; // do not restart / wait / write
 * ```
 */
export async function inspectUsageLimitScreen(
	sessionName: string,
	screen: string,
	runtime: string | null,
	options: InspectUsageLimitOptions = {},
): Promise<UsageLimitedInfo | null> {
	const now = options.now ?? Date.now();
	try {
		const match = runtime ? detectUsageLimitScreen(screen, runtime, now, options.timeZone) : null;
		if (!match) return usageLimitOf(sessionName, now);

		const { info, isNew } = markUsageLimited(
			{ sessionName, runtime, ruleId: match.ruleId, resetAt: match.resetAt, source: match.menu ? 'menu' : 'screen' },
			now,
		);
		if (isNew) {
			options.logger?.warn('Agent runtime is out of usage — no restarts or deliveries until it resets', {
				sessionName,
				runtime,
				rule: match.ruleId,
				until: info.until ?? null,
				retryAt: info.retryAt,
				menu: match.menu !== null,
			});
			// The screen is live (bottom of it, a plausible reset): the fallback may
			// move the agent to another runtime meanwhile.
			if (options.reportToFallback !== false && runtime) reportRuntimeOutput(sessionName, runtime, screen, 'output');
		}

		const selected = match.menu?.selected;
		if (options.io && selected && !info.menuAnsweredAt) {
			// Once per state: a menu that comes back is not pressed into again.
			noteUsageLimitMenuAnswered(sessionName, now);
			const answered = await answerMenu(sessionName, selected, options.io);
			if (answered) {
				options.logger?.info('Answered the usage-limit menu: wait and continue automatically at the reset', { sessionName, until: info.until ?? null });
			} else {
				options.logger?.warn('Usage-limit menu: could not select "Wait here, then continue automatically"; left as is', { sessionName });
			}
		}
		return info;
	} catch (err) {
		options.logger?.warn('Usage-limit screen check failed (ignored)', { sessionName, error: err instanceof Error ? err.message : String(err) });
		return usageLimitOf(sessionName, now);
	}
}
