/**
 * Usage-limit rules — per-runtime patterns that mean "this runtime's account
 * is out of usage", as opposed to a login that expired (login-expiry-rules.ts,
 * the re-login flow) or a short rate limit the runtime retries by itself.
 *
 * Modelled on login-expiry-rules.ts: output is normalized with
 * {@link normalizeTerminalOutput} and every pattern is matched against the
 * normalized text and its spaceless copy (Claude Code places words with
 * cursor moves instead of spaces), so patterns use `\s*` between words.
 *
 * Wording sources:
 * - Claude Code 2.1.287 binary (`strings`, 2026-10-01): `Usage limit
 *   reached`, `Usage limit reached again`, `continuing automatically {when}`,
 *   `You're out of extra usage`, `You're out of usage credits`, `You've hit
 *   your monthly spend limit`, ` resets $…`, `/upgrade to increase your usage
 *   limit.`, the API's `billing_error` "spend limit reached (daily; resets …)",
 *   and its own note that the client composes "You've hit your limit" from a
 *   429. Older releases print `5-hour limit reached ∙ resets 3pm`, `Claude
 *   usage limit reached. Your limit will reset at 3pm (America/Los_Angeles).`
 *   and `Claude AI usage limit reached|<epoch>`.
 * - Codex: `You've hit your usage limit. Upgrade to Pro (…) or try again in
 *   4 days 7 hours 3 minutes.` / `… try again at 4:05 PM.`; transient:
 *   `exceeded retry limit, last status: 429 Too Many Requests`.
 * - Gemini / Antigravity: `RESOURCE_EXHAUSTED` with `Quota exceeded for quota
 *   metric '… per day'`, `You exceeded your current quota`, `You have
 *   exhausted your daily quota`; a bare 429 / RESOURCE_EXHAUSTED is transient.
 * - DeepSeek (the in-process Crewly Agent): HTTP 402 `Insufficient Balance`
 *   is a `billing` limit (no reset; the owner must top up); HTTP 429 `Rate Limit Reached` is transient.
 *
 * Context requirements keep an agent that merely reads or quotes this kind of
 * text (for example while working on this file) from tripping a rule: the
 * Claude UI rules need the `·` / `∙` separator, a reset time or a slash
 * command next to the message; API rules need the API error context.
 * Warnings that the limit is near ("Approaching usage limit", "You've used
 * 90% of your session limit") are deliberately not matched.
 *
 * @module services/runtime-fallback/usage-limit-rules
 */

import { RUNTIME_TYPES, USAGE_LIMIT_STATE_CONSTANTS } from '../../constants.js';
import { normalizeTerminalOutput, type NormalizedScreen } from '../harness/login-rules.js';
import { detectLoginExpiry } from '../harness/login-expiry-rules.js';
import { parseResetTime } from './reset-time.js';

/**
 * `usage_limit`: the account is out of usage until a window resets;
 * `billing`: the account is out of money / credit (DeepSeek 402 "Insufficient
 * Balance", "credit balance is too low") — it has no reset time and only
 * comes back when the owner tops up, so it is never retried on a timer;
 * `transient`: a short rate limit the runtime retries.
 */
export type UsageLimitKind = 'usage_limit' | 'billing' | 'transient';

/**
 * Whether a kind means the runtime cannot be used (as opposed to a transient
 * rate limit).
 *
 * @param kind - Match kind
 * @returns True for `usage_limit` and `billing`
 */
export function isExhaustingKind(kind: UsageLimitKind): boolean {
	return kind === 'usage_limit' || kind === 'billing';
}

/** One rule: every pattern must match (AND); `none` must not match. */
export interface UsageLimitRule {
	/** Stable id, used in logs (never contains output) */
	id: string;
	/** Runtime type the rule belongs to */
	runtime: string;
	kind: UsageLimitKind;
	/** All must match the normalized text or its spaceless copy */
	all: readonly RegExp[];
	/** None of these may match (e.g. a warning, not the limit itself) */
	none?: readonly RegExp[];
}

/** What {@link detectUsageLimit} found. */
export interface UsageLimitMatch {
	/** Runtime the rule belongs to */
	runtime: string;
	ruleId: string;
	kind: UsageLimitKind;
	/** When the limit lifts (epoch ms), when the message says so */
	resetAt: number | null;
}

/** Claude UI context: the separator, a reset time, or a Claude slash command. */
const CLAUDE_UI_CONTEXT = /[·∙•]|\bresets?\b|reset\s*at|continuing\s*automatically|\/(?:upgrade|extra-usage|usage-credits|rate-limit-options|model)\b|\|\s*\d{10}\b/i;
/** API error context for Claude: a 429 / billing error. */
const CLAUDE_API_429 = /\b429\b|rate_limit_error|billing_error/i;
/** Wording that means "usage", not a per-minute rate. */
const USAGE_WORDING = /usage\s*limit|limit\s*reached|hit\s*your\s*(?:[\w-]+\s*)?limit|spend\s*limit|quota|limit\s*will\s*reset|\bresets?\b|out\s*of\s*(?:extra\s*)?usage/i;

/** Claude Code rules (usage limits first, then transient). */
export const CLAUDE_USAGE_RULES: readonly UsageLimitRule[] = [
	{
		id: 'claude.api_usage_429',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/API\s*Error|"type"\s*:\s*"error"/i, CLAUDE_API_429, USAGE_WORDING],
	},
	{
		id: 'claude.api_credit_balance',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'billing',
		all: [/API\s*Error|"type"\s*:\s*"error"/i, /credit\s*balance\s*(?:is\s*)?too\s*low/i],
	},
	{
		id: 'claude.legacy_limit_reached',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/Claude\s*(?:AI\s*)?usage\s*limit\s*reached\s*(?:\|\s*\d{10}|\.\s*Your\s*limit\s*will\s*reset)/i],
	},
	{
		id: 'claude.hit_your_limit',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/You['’]ve\s*hit\s*your\s*(?:[\w-]+\s*){0,3}limit/i, CLAUDE_UI_CONTEXT],
	},
	{
		id: 'claude.usage_limit_reached',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/usage\s*(?:credit\s*)?limit\s*reached/i, CLAUDE_UI_CONTEXT],
	},
	{
		id: 'claude.window_limit_reached',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/(?:5-hour|five-hour|weekly|session|daily|Opus|Sonnet|Fable)\s*limit\s*reached/i, CLAUDE_UI_CONTEXT],
	},
	{
		id: 'claude.out_of_usage',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'usage_limit',
		all: [/You['’]re\s*out\s*of\s*(?:extra\s*usage|usage\s*credits)/i, CLAUDE_UI_CONTEXT],
	},
	{
		id: 'claude.api_rate_limited',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'transient',
		all: [/API\s*Error/i, /\b429\b|rate_limit_error/i],
	},
	{
		id: 'claude.api_overloaded',
		runtime: RUNTIME_TYPES.CLAUDE_CODE,
		kind: 'transient',
		all: [/API\s*Error/i, /\b529\b|overloaded_error/i],
	},
];

/** Codex rules. */
export const CODEX_USAGE_RULES: readonly UsageLimitRule[] = [
	{
		id: 'codex.usage_limit',
		runtime: RUNTIME_TYPES.CODEX_CLI,
		kind: 'usage_limit',
		all: [/You['’]ve\s*hit\s*your\s*usage\s*limit/i, /try\s*again|upgrade|resets?/i],
	},
	{
		id: 'codex.quota_exceeded',
		runtime: RUNTIME_TYPES.CODEX_CLI,
		kind: 'billing',
		all: [/insufficient_quota|exceeded\s*your\s*current\s*quota/i],
	},
	{
		id: 'codex.rate_limited',
		runtime: RUNTIME_TYPES.CODEX_CLI,
		kind: 'transient',
		all: [/\b429\b\s*Too\s*Many\s*Requests|exceeded\s*retry\s*limit|rate\s*limit\s*reached\s*for/i],
	},
];

/** Gemini quota rules, shared by Antigravity CLI and Gemini CLI. */
function geminiRules(runtime: string, prefix: string): UsageLimitRule[] {
	return [
		{
			id: `${prefix}.quota_exceeded`,
			runtime,
			kind: 'usage_limit',
			all: [/exceeded\s*your\s*current\s*quota|exhausted\s*your\s*(?:daily\s*)?quota|quota\s*exceeded\s*for\s*quota\s*metric[^\n]*per\s*day|daily\s*(?:quota|limit)\s*(?:exceeded|reached)/i],
		},
		{
			id: `${prefix}.rate_limited`,
			runtime,
			kind: 'transient',
			all: [/RESOURCE_EXHAUSTED|\b429\b\s*Too\s*Many\s*Requests|status\s*(?:code\s*)?:?\s*429|Resource\s*has\s*been\s*exhausted/i],
		},
	];
}

/** Antigravity CLI rules. */
export const ANTIGRAVITY_USAGE_RULES: readonly UsageLimitRule[] = geminiRules(RUNTIME_TYPES.ANTIGRAVITY_CLI, 'antigravity');

/** Gemini CLI rules (retired runtime, detect only). */
export const GEMINI_USAGE_RULES: readonly UsageLimitRule[] = geminiRules(RUNTIME_TYPES.GEMINI_CLI, 'gemini');

/**
 * In-process Crewly Agent rules. These run on the error of a failed model
 * call (never on text the model wrote), so they need no UI context.
 */
export const CREWLY_AGENT_USAGE_RULES: readonly UsageLimitRule[] = [
	{
		id: 'crewly-agent.insufficient_balance',
		runtime: RUNTIME_TYPES.CREWLY_AGENT,
		kind: 'billing',
		all: [/Insufficient\s*Balance|\b402\b[^\n]*(?:Payment\s*Required|balance)/i],
	},
	{
		id: 'crewly-agent.out_of_credit',
		runtime: RUNTIME_TYPES.CREWLY_AGENT,
		kind: 'billing',
		all: [/insufficient_quota|credit\s*balance\s*(?:is\s*)?too\s*low/i],
	},
	{
		id: 'crewly-agent.quota_exceeded',
		runtime: RUNTIME_TYPES.CREWLY_AGENT,
		kind: 'usage_limit',
		all: [/exceeded\s*your\s*current\s*quota|exhausted\s*your\s*(?:daily\s*)?quota|usage\s*limit\s*reached/i],
	},
	{
		id: 'crewly-agent.rate_limited',
		runtime: RUNTIME_TYPES.CREWLY_AGENT,
		kind: 'transient',
		all: [/statusCode:?\s*429\b|status\s*(?:code\s*)?:?\s*429\b|\b429\s*Too\s*Many|Rate\s*Limit\s*Reached|Too\s*Many\s*Requests|RESOURCE_EXHAUSTED|overloaded_error|\bOverloaded\b/i],
	},
];

/** Rules by runtime. */
const RULES_BY_RUNTIME: Readonly<Record<string, readonly UsageLimitRule[]>> = {
	[RUNTIME_TYPES.CLAUDE_CODE]: CLAUDE_USAGE_RULES,
	[RUNTIME_TYPES.CODEX_CLI]: CODEX_USAGE_RULES,
	[RUNTIME_TYPES.ANTIGRAVITY_CLI]: ANTIGRAVITY_USAGE_RULES,
	[RUNTIME_TYPES.GEMINI_CLI]: GEMINI_USAGE_RULES,
	[RUNTIME_TYPES.CREWLY_AGENT]: CREWLY_AGENT_USAGE_RULES,
};

/**
 * Usage-limit rules for a runtime.
 *
 * @param runtime - Runtime type
 * @returns Rules to try (empty for a runtime without rules)
 */
export function getUsageLimitRules(runtime: string): readonly UsageLimitRule[] {
	return RULES_BY_RUNTIME[runtime] ?? [];
}

/**
 * Whether a pattern matches the normalized text or its spaceless copy.
 *
 * @param pattern - Pattern
 * @param screen - Normalized screen
 * @returns True on a match
 */
function matches(pattern: RegExp, screen: NormalizedScreen): boolean {
	const nonGlobal = new RegExp(pattern.source, pattern.flags.replace('g', ''));
	return nonGlobal.test(screen.text) || nonGlobal.test(screen.spaceless);
}

/**
 * Find a usage-limit (or transient rate-limit) message in a runtime's output.
 * An expired login is never reported here — that is the re-login flow's.
 *
 * @param output - Raw PTY output (escape sequences allowed), captured screen, or an error message
 * @param runtime - The runtime the output came from
 * @param now - Current time (ms), for the reset time
 * @param defaultTimeZone - Zone for reset clock times that name none
 * @returns The match, or null
 *
 * @example
 * ```ts
 * detectUsageLimit("You've hit your limit · resets 3pm (America/Los_Angeles)", 'claude-code');
 * // { runtime: 'claude-code', ruleId: 'claude.hit_your_limit', kind: 'usage_limit', resetAt: <next 3pm LA> }
 * ```
 */
export function detectUsageLimit(output: string, runtime: string, now: number = Date.now(), defaultTimeZone?: string): UsageLimitMatch | null {
	if (!output) return null;
	const rules = getUsageLimitRules(runtime);
	if (rules.length === 0) return null;
	if (detectLoginExpiry(output, runtime === RUNTIME_TYPES.CLAUDE_CODE || runtime === RUNTIME_TYPES.CODEX_CLI ? runtime : null)) {
		return null;
	}
	const screen = normalizeTerminalOutput(output);
	for (const rule of rules) {
		if (!rule.all.every((pattern) => matches(pattern, screen))) continue;
		if (rule.none?.some((pattern) => matches(pattern, screen))) continue;
		return {
			runtime: rule.runtime,
			ruleId: rule.id,
			kind: rule.kind,
			// A billing limit has no reset time: it lifts when the owner tops up.
			resetAt: rule.kind === 'usage_limit' ? parseResetTime(screen.text, now, defaultTimeZone) : null,
		};
	}
	return null;
}

/**
 * Claude Code's usage-limit menu, shown when a turn hits the limit:
 *
 * ```
 *   ⎿  You've hit your weekly limit · resets Oct 16 at 8pm (America/New_York)
 *    What do you want to do?
 *    ❯ 1. Stop and wait for limit to reset
 *      2. Wait here, then continue automatically at 8pm
 *    Enter to confirm · Esc to cancel
 * ```
 *
 * Both options must be on screen. Matched against the spaceless screen tail.
 */
export const CLAUDE_USAGE_LIMIT_MENU: readonly RegExp[] = [
	/Stopandwaitfor(?:the)?limittoreset/i,
	/Waithere,?thencontinueautomatically/i,
];

/** Which option of the usage-limit menu is highlighted (`❯`). */
const MENU_SELECTED = /❯\s*([12])\./;

/** Option 2 of the usage-limit menu, from "continue automatically" to the end of its line. */
const MENU_OPTION_2_TIME = /continue\s*automatically[^\n]*/i;

/** What {@link detectUsageLimitScreen} found. */
export interface UsageLimitScreenMatch {
	/** Runtime the match belongs to */
	runtime: string;
	/** Rule that matched the limit line, or `claude.usage_limit_menu` */
	ruleId: string;
	/** When the limit lifts (epoch ms), when the screen says so and it is plausible */
	resetAt: number | null;
	/** Set while the usage-limit menu is open; `selected` is the highlighted option */
	menu: { selected: 1 | 2 | null } | null;
}

/**
 * The last `count` non-empty lines of a screen, normalized.
 *
 * @param screen - Captured screen (escape sequences allowed)
 * @param count - Lines to keep
 * @returns The tail as text
 */
function screenTail(screen: string, count: number): string {
	const lines = normalizeTerminalOutput(screen).text.split('\n').filter((line) => line.trim().length > 0);
	return lines.slice(-count).join('\n');
}

/**
 * A reset time a live screen may be trusted with: in the future and at most
 * {@link USAGE_LIMIT_STATE_CONSTANTS.MAX_RESET_AHEAD_MS} away. A dated reset
 * that already passed is read by {@link parseResetTime} as next year's, so a
 * reset that far ahead means an old message.
 *
 * @param resetAt - Parsed reset time
 * @param now - Current time (ms)
 * @returns The reset time, or null when absent or implausible
 */
function plausibleReset(resetAt: number | null, now: number): number | null {
	if (resetAt === null) return null;
	return resetAt > now && resetAt - now <= USAGE_LIMIT_STATE_CONSTANTS.MAX_RESET_AHEAD_MS ? resetAt : null;
}

/**
 * Find a usage-limit state on a captured screen — what the agent shows right
 * now — as opposed to {@link detectUsageLimit}, which reads live output and
 * error text.
 *
 * Only the bottom of the screen counts (old scrollback and resumed
 * transcripts sit above it):
 *
 * - Claude Code's usage-limit menu ({@link CLAUDE_USAGE_LIMIT_MENU}) is a
 *   modal waiting for an answer, so it always counts; the reset time comes
 *   from the limit line above it or from option 2 ("continue automatically
 *   at 8pm").
 * - A plain limit line ("You've hit your … limit · resets …") counts only
 *   with a plausible reset time ({@link plausibleReset}), so an old line that
 *   names a past date is not read as a new limit.
 *
 * Transient rate limits and expired logins are never reported.
 *
 * @param screen - Captured screen text (escape sequences allowed)
 * @param runtime - Runtime the session runs
 * @param now - Current time (ms)
 * @param defaultTimeZone - Zone for reset clock times that name none
 * @returns The match, or null
 *
 * @example
 * ```ts
 * detectUsageLimitScreen(screen, 'claude-code');
 * // { runtime: 'claude-code', ruleId: 'claude.hit_your_limit', resetAt: <Oct 16 8pm New York>, menu: { selected: 1 } }
 * ```
 */
export function detectUsageLimitScreen(
	screen: string,
	runtime: string,
	now: number = Date.now(),
	defaultTimeZone?: string,
): UsageLimitScreenMatch | null {
	if (!screen) return null;
	const tail = screenTail(screen, USAGE_LIMIT_STATE_CONSTANTS.SCREEN_TAIL_LINES);
	if (!tail) return null;
	const lineMatch = detectUsageLimit(tail, runtime, now, defaultTimeZone);
	const exhausting = lineMatch && isExhaustingKind(lineMatch.kind) ? lineMatch : null;

	const spaceless = tail.replace(/[ \t]+/g, '');
	if (runtime === RUNTIME_TYPES.CLAUDE_CODE && CLAUDE_USAGE_LIMIT_MENU.every((re) => re.test(spaceless))) {
		const selected = MENU_SELECTED.exec(tail)?.[1];
		// Option 2 names the reset ("continue automatically at 8pm"); read only
		// that line — option 1's "limit to reset" is followed by "2." otherwise.
		const option2 = MENU_OPTION_2_TIME.exec(tail)?.[0] ?? '';
		const resetAt = plausibleReset(exhausting?.resetAt ?? parseResetTime(option2, now, defaultTimeZone), now);
		return {
			runtime,
			ruleId: exhausting?.ruleId ?? 'claude.usage_limit_menu',
			resetAt,
			menu: { selected: selected === '1' ? 1 : selected === '2' ? 2 : null },
		};
	}

	if (!exhausting) return null;
	const resetAt = plausibleReset(exhausting.resetAt, now);
	if (resetAt === null) return null;
	return { runtime: exhausting.runtime, ruleId: exhausting.ruleId, resetAt, menu: null };
}
