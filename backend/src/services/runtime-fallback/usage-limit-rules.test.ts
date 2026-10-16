/**
 * Tests for usage-limit detection: real runtime wording vs login expiry vs
 * transient rate limits.
 *
 * Claude samples use wording from the Claude Code 2.1.287 binary and from
 * older releases; TUI-rendered lines place words with `CSI n G`, as Claude
 * Code does on screen.
 */

import { detectUsageLimit, detectUsageLimitScreen, getUsageLimitRules, isFreshNonLimitOutput } from './usage-limit-rules.js';

/** 2026-10-01 12:00 UTC. */
const NOW = Date.UTC(2026, 9, 1, 12, 0);

/**
 * Render words the way Claude Code's TUI does (cursor-to-column moves).
 *
 * @param words - Words of the line
 * @returns Raw PTY text
 */
function tuiLine(words: string[]): string {
	let column = 2;
	let out = '';
	for (const word of words) {
		out += `\x1b[${column}G${word}`;
		column += word.length + 1;
	}
	return `${out}\r\n`;
}

describe('detectUsageLimit — Claude Code usage limits', () => {
	it.each([
		["You've hit your limit · resets 3pm (America/Los_Angeles)", 'claude.hit_your_limit'],
		["  ⎿  You've hit your weekly limit · resets Oct 6, 9am", 'claude.hit_your_limit'],
		["You've hit your Opus limit · /upgrade to increase your usage limit.", 'claude.hit_your_limit'],
		["You've hit your monthly spend limit · resets Nov 1, 12am", 'claude.hit_your_limit'],
		['Usage limit reached · continuing automatically at 3pm · esc to cancel', 'claude.usage_limit_reached'],
		['Usage limit reached again · continuing automatically at 8pm · esc to cancel', 'claude.usage_limit_reached'],
		['Claude AI usage limit reached|1767225600', 'claude.legacy_limit_reached'],
		['5-hour limit reached ∙ resets 3pm', 'claude.window_limit_reached'],
		['Claude usage limit reached. Your limit will reset at 5pm (Asia/Shanghai).', 'claude.legacy_limit_reached'],
		["You're out of extra usage · resets 3pm", 'claude.out_of_usage'],
		["You're out of usage credits. /model to switch models.", 'claude.out_of_usage'],
		[
			'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"Claude usage limit reached for your plan; it resets 3pm (UTC)."}}',
			'claude.api_usage_429',
		],
		[
			'API Error: 400 {"type":"error","error":{"type":"billing_error","message":"spend limit reached (daily; resets 2026-10-02 00:00 UTC)"}}',
			'claude.api_usage_429',
		],
	])('detects %s', (output, ruleId) => {
		const match = detectUsageLimit(output, 'claude-code', NOW);
		expect(match).toMatchObject({ runtime: 'claude-code', ruleId, kind: 'usage_limit' });
	});

	it('reads "credit balance is too low" as a billing limit (no reset time)', () => {
		const match = detectUsageLimit(
			'API Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
			'claude-code',
			NOW,
		);
		expect(match).toMatchObject({ runtime: 'claude-code', ruleId: 'claude.api_credit_balance', kind: 'billing', resetAt: null });
	});

	it('parses the reset time of a Claude limit', () => {
		const match = detectUsageLimit("You've hit your limit · resets 3pm (America/Los_Angeles)", 'claude-code', NOW);
		expect(match?.resetAt).toBe(Date.UTC(2026, 9, 1, 22, 0));
	});

	it('detects a TUI line whose words are placed with cursor moves', () => {
		const raw = `\x1b[38;5;203m${tuiLine(['⎿', "You've", 'hit', 'your', 'limit', '·', 'resets', '3pm', '(UTC)'])}\x1b[0m`;
		const match = detectUsageLimit(raw, 'claude-code', NOW);
		expect(match).toMatchObject({ ruleId: 'claude.hit_your_limit', kind: 'usage_limit' });
		expect(match?.resetAt).toBe(Date.UTC(2026, 9, 1, 15, 0));
	});
});

describe('detectUsageLimit — Claude Code transient and non-matches', () => {
	it('treats a plain API 429 rate limit as transient', () => {
		const output =
			'API Error: 429 {"type":"error","error":{"type":"rate_limit_error","message":"This request would exceed your account\'s rate limit. Please try again later."}}';
		expect(detectUsageLimit(output, 'claude-code', NOW)).toMatchObject({ ruleId: 'claude.api_rate_limited', kind: 'transient', resetAt: null });
	});

	it('treats an overloaded API as transient', () => {
		expect(detectUsageLimit('API Error: 529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}', 'claude-code', NOW)).toMatchObject({
			kind: 'transient',
			ruleId: 'claude.api_overloaded',
		});
	});

	it('never reports an expired login (that belongs to the re-login flow)', () => {
		expect(detectUsageLimit('  ⎿  Login expired · Please run /login', 'claude-code', NOW)).toBeNull();
		expect(
			detectUsageLimit(
				'API Error: 401 {"type":"error","error":{"type":"authentication_error","message":"OAuth token has expired."}} · Please run /login',
				'claude-code',
				NOW,
			),
		).toBeNull();
	});

	it.each([
		['the "approaching" warning', 'Approaching usage limit · resets at 3pm'],
		['the percentage warning', "You've used 90% of your session limit · resets 3pm"],
		['source code that mentions the words', 'const message = "usage limit reached";'],
		['prose without UI context', 'We should handle the case where the usage limit reached its cap'],
		['the login-expiry warning', 'Your login expires in 3 days · run /login to renew'],
	])('ignores %s', (_label, output) => {
		expect(detectUsageLimit(output, 'claude-code', NOW)).toBeNull();
	});
});

describe('detectUsageLimit — Codex', () => {
	it('detects "try again in …" and parses it', () => {
		const output = "■ You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing) or try again in 4 days 7 hours 3 minutes.";
		const match = detectUsageLimit(output, 'codex-cli', NOW);
		expect(match).toMatchObject({ runtime: 'codex-cli', ruleId: 'codex.usage_limit', kind: 'usage_limit' });
		expect(match?.resetAt).toBe(NOW + ((4 * 24 + 7) * 60 + 3) * 60 * 1000);
	});

	it('detects "try again at 4:05 PM"', () => {
		const match = detectUsageLimit("You've hit your usage limit. Try again at 4:05 PM.", 'codex-cli', NOW, 'UTC');
		expect(match?.resetAt).toBe(Date.UTC(2026, 9, 1, 16, 5));
	});

	it('treats a retried 429 as transient', () => {
		expect(detectUsageLimit('stream error: exceeded retry limit, last status: 429 Too Many Requests', 'codex-cli', NOW)).toMatchObject({
			kind: 'transient',
		});
	});

	it('leaves an expired Codex login to the re-login flow', () => {
		expect(detectUsageLimit('Your access token could not be refreshed because your refresh token has expired', 'codex-cli', NOW)).toBeNull();
	});
});

describe('detectUsageLimit — Antigravity / Gemini', () => {
	it('detects a daily quota as a usage limit', () => {
		const output =
			"[API Error: RESOURCE_EXHAUSTED] Quota exceeded for quota metric 'Generate Content API requests per day' and limit 'GenerateContent request limit per day'";
		expect(detectUsageLimit(output, 'antigravity-cli', NOW)).toMatchObject({ ruleId: 'antigravity.quota_exceeded', kind: 'usage_limit' });
	});

	it('detects "You exceeded your current quota"', () => {
		expect(
			detectUsageLimit('429 You exceeded your current quota, please check your plan and billing details.', 'antigravity-cli', NOW),
		).toMatchObject({ kind: 'usage_limit' });
	});

	it('treats a bare RESOURCE_EXHAUSTED / 429 as transient', () => {
		expect(detectUsageLimit('Error: 429 Too Many Requests — Resource has been exhausted (e.g. check quota).', 'antigravity-cli', NOW)).toMatchObject({
			kind: 'transient',
		});
	});

	it('has rules for the retired Gemini CLI too', () => {
		expect(getUsageLimitRules('gemini-cli').length).toBeGreaterThan(0);
	});
});

describe('detectUsageLimit — DeepSeek (crewly-agent)', () => {
	it('reads Insufficient Balance (HTTP 402) as a billing limit with no reset time', () => {
		expect(detectUsageLimit('AI_APICallError: Insufficient Balance', 'crewly-agent', NOW)).toMatchObject({
			runtime: 'crewly-agent',
			ruleId: 'crewly-agent.insufficient_balance',
			kind: 'billing',
			resetAt: null,
		});
	});

	it('reads a provider credit error as billing and a quota window as a usage limit', () => {
		expect(detectUsageLimit('Your credit balance is too low to access the Anthropic API.', 'crewly-agent', NOW)).toMatchObject({ kind: 'billing' });
		expect(detectUsageLimit('insufficient_quota', 'crewly-agent', NOW)).toMatchObject({ kind: 'billing' });
		expect(detectUsageLimit('You have exhausted your daily quota', 'crewly-agent', NOW)).toMatchObject({ kind: 'usage_limit' });
	});

	it('treats "Rate Limit Reached" (HTTP 429) as transient', () => {
		expect(detectUsageLimit('Request failed with status code 429: Rate Limit Reached', 'crewly-agent', NOW)).toMatchObject({ kind: 'transient' });
	});

	it('returns null for an unrelated error', () => {
		expect(detectUsageLimit('ECONNRESET socket hang up', 'crewly-agent', NOW)).toBeNull();
	});
});

describe('detectUsageLimit — misc', () => {
	it('returns null for an unknown runtime or empty output', () => {
		expect(detectUsageLimit('Usage limit reached · resets 3pm', 'opencode-cli', NOW)).toBeNull();
		expect(detectUsageLimit('', 'claude-code', NOW)).toBeNull();
	});
});

/**
 * The orchestrator's screen on 2026-10-16 (Claude Code weekly limit), as the
 * owner saw it. Crewly did not recognise it and looped for ~38 hours.
 */
const WEEKLY_LIMIT_MENU_SCREEN = [
	'> Check the review queue and report back',
	'',
	"  ⎿  You've hit your weekly limit · resets Oct 16 at 8pm (America/New_York)",
	'     /upgrade to increase your usage limit.',
	'',
	'   What do you want to do?',
	'',
	'   ❯ 1. Stop and wait for limit to reset',
	'     2. Wait here, then continue automatically at 8pm',
	'',
	'   Enter to confirm · Esc to cancel',
].join('\n');

/** 2026-10-16 12:00 UTC (08:00 in New York). */
const INCIDENT_NOW = Date.UTC(2026, 9, 16, 12, 0);
/** Oct 16, 8pm in New York (EDT, UTC-4). */
const INCIDENT_RESET = Date.UTC(2026, 9, 17, 0, 0);

describe('detectUsageLimitScreen — Claude Code usage-limit states on screen', () => {
	it('recognises the weekly-limit menu with its reset time and highlighted option', () => {
		expect(detectUsageLimitScreen(WEEKLY_LIMIT_MENU_SCREEN, 'claude-code', INCIDENT_NOW)).toEqual({
			runtime: 'claude-code',
			ruleId: 'claude.hit_your_limit',
			resetAt: INCIDENT_RESET,
			menu: { selected: 1 },
		});
	});

	it('recognises the menu when the TUI dropped the spaces', () => {
		const flat = WEEKLY_LIMIT_MENU_SCREEN.split('\n').map((l) => l.replace(/ /g, '')).join('\n');
		expect(detectUsageLimitScreen(flat, 'claude-code', INCIDENT_NOW)).toMatchObject({ menu: { selected: 1 } });
	});

	it('takes the reset time from option 2 when the limit line has scrolled away', () => {
		const tail = [
			'   ❯ 1. Stop and wait for limit to reset',
			'     2. Wait here, then continue automatically at 8pm',
			'   Enter to confirm · Esc to cancel',
		].join('\n');
		const match = detectUsageLimitScreen(tail, 'claude-code', INCIDENT_NOW, 'America/New_York');
		expect(match).toMatchObject({ ruleId: 'claude.usage_limit_menu', resetAt: INCIDENT_RESET, menu: { selected: 1 } });
	});

	it('reports option 2 as highlighted after Down', () => {
		const moved = WEEKLY_LIMIT_MENU_SCREEN.replace('❯ 1.', '  1.').replace('     2. Wait', '   ❯ 2. Wait');
		expect(detectUsageLimitScreen(moved, 'claude-code', INCIDENT_NOW)?.menu).toEqual({ selected: 2 });
	});

	it.each([
		["  ⎿  You've hit your weekly limit · resets Oct 16 at 8pm (America/New_York)", INCIDENT_RESET],
		["  ⎿  You've hit your session limit · resets Oct 16, 3pm (America/New_York)", Date.UTC(2026, 9, 16, 19, 0)],
	])('recognises the dated plain limit line %s at the bottom of the screen', (line, resetAt) => {
		const screen = ['> do the thing', line, '', '╭────────╮', '│ >      │', '╰────────╯'].join('\n');
		expect(detectUsageLimitScreen(screen, 'claude-code', INCIDENT_NOW)).toMatchObject({ resetAt, menu: null });
	});

	it.each([
		"  ⎿  You've hit your session limit · resets 3pm (America/New_York)",
		'  ⎿  5-hour limit reached ∙ resets 3pm (America/New_York)',
		"  ⎿  You've hit your weekly limit · resets 8pm (America/New_York)",
		'Claude usage limit reached. Your limit will reset at 5pm (Asia/Shanghai).',
	])('ignores the undated plain limit line %s on a screen (a resumed conversation repaints old ones)', (line) => {
		const resumed = ['> earlier request', line, '', '> next request', '⏺ Done.', '╭────────╮', '│ >      │', '╰────────╯'].join('\n');
		expect(detectUsageLimitScreen(resumed, 'claude-code', INCIDENT_NOW)).toBeNull();
		// The same line as new live output still counts (the output stream reads it).
		expect(detectUsageLimit(line, 'claude-code', INCIDENT_NOW)).not.toBeNull();
	});

	it('still reads the menu when its limit line has no date (the menu is live, not history)', () => {
		const screen = WEEKLY_LIMIT_MENU_SCREEN.replace('resets Oct 16 at 8pm', 'resets 8pm');
		expect(detectUsageLimitScreen(screen, 'claude-code', INCIDENT_NOW)).toMatchObject({ resetAt: INCIDENT_RESET, menu: { selected: 1 } });
	});

	it('ignores a plain limit line whose dated reset already passed (an old message)', () => {
		const screen = "  ⎿  You've hit your weekly limit · resets Oct 9 at 8pm (America/New_York)\n> ";
		expect(detectUsageLimitScreen(screen, 'claude-code', INCIDENT_NOW)).toBeNull();
	});

	it('ignores a plain limit line with no reset time (only live output may report that)', () => {
		expect(detectUsageLimitScreen("You're out of usage credits. /model to switch models.", 'claude-code', INCIDENT_NOW)).toBeNull();
	});

	it('ignores a limit far up in the scrollback', () => {
		const later = Array.from({ length: 40 }, (_, i) => `line ${i} of later work`);
		expect(detectUsageLimitScreen([WEEKLY_LIMIT_MENU_SCREEN, ...later].join('\n'), 'claude-code', INCIDENT_NOW)).toBeNull();
	});

	it('ignores transient rate limits and an ordinary screen', () => {
		expect(detectUsageLimitScreen('API Error: 429 rate_limit_error', 'claude-code', INCIDENT_NOW)).toBeNull();
		expect(detectUsageLimitScreen('> hello\n✻ Thinking…', 'claude-code', INCIDENT_NOW)).toBeNull();
		expect(detectUsageLimitScreen('', 'claude-code', INCIDENT_NOW)).toBeNull();
	});

	it('only reads the menu for Claude Code', () => {
		expect(detectUsageLimitScreen(WEEKLY_LIMIT_MENU_SCREEN, 'codex-cli', INCIDENT_NOW)).toBeNull();
	});
});

describe('isFreshNonLimitOutput — activity that lifts a usage-limit state', () => {
	it('is true for ordinary work output', () => {
		expect(isFreshNonLimitOutput('⏺ Read(src/app.ts)\n  ⎿  Read 120 lines\n⏺ Updating the request handler now', 'claude-code', INCIDENT_NOW)).toBe(true);
	});

	it('is false for the limit line, the menu, and their repaints', () => {
		expect(isFreshNonLimitOutput(WEEKLY_LIMIT_MENU_SCREEN, 'claude-code', INCIDENT_NOW)).toBe(false);
		expect(isFreshNonLimitOutput("  ⎿  You've hit your weekly limit · resets Oct 16 at 8pm (America/New_York)", 'claude-code', INCIDENT_NOW)).toBe(false);
		expect(isFreshNonLimitOutput('   ❯ 2. Wait here, then continue automatically at 8pm   ', 'claude-code', INCIDENT_NOW)).toBe(false);
	});

	it('is false for short chunks (cursor moves, spinner ticks)', () => {
		expect(isFreshNonLimitOutput('\x1b[2K\x1b[1G✻ ', 'claude-code', INCIDENT_NOW)).toBe(false);
		expect(isFreshNonLimitOutput('', 'claude-code', INCIDENT_NOW)).toBe(false);
	});
});
