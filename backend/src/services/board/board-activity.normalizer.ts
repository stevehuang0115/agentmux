/**
 * Activity normalizer (crewly#1247): maps a runtime tool call (a Claude Code
 * hook event, a browser action, a chat reply, a wait on the owner) to one of
 * the board activity types and a plain-words line.
 *
 * - Edit / Write / MultiEdit / NotebookEdit (and Read / Grep / Glob) -> coding, repo-relative path
 * - Bash -> command, executable + subcommand only (`git push`, `npm test`, `python build.py`)
 * - Crewly skill scripts run through Bash -> by skill: messaging, browsing, writing
 * - WebFetch / WebSearch / browser tools -> browsing, host + path
 * - mcp__ tools -> by name
 *
 * Every string that comes out has been through {@link scrubText}; the raw
 * tool input is read here and dropped, never stored or logged.
 *
 * Pure (no I/O).
 *
 * @module services/board/board-activity.normalizer
 */

import { clip, redactUrl, reduceCommand, relativePath, scrubText } from './board-redact.js';
import type { BoardActivityType } from './board.types.js';

/** A normalized activity. */
export interface NormalizedActivity {
	type: BoardActivityType;
	/** Path / host+path / command name / channel (<= 140 chars) */
	detail: string;
	/** One plain-words line for the timeline and "last action" (<= 140 chars) */
	text: string;
}

/** The slice of a tool input the hook sends (all optional strings, already length-capped by the hook). */
export interface ToolInput {
	filePath?: string;
	command?: string;
	url?: string;
}

/** Context for path relativization. */
export interface NormalizeContext {
	/** Project roots (the agent's project dir, repos) */
	roots?: readonly string[];
}

/** Longest input string the normalizer reads. */
const MAX_INPUT = 1200;

/**
 * Validate a raw `toolInput` from the hook endpoint.
 *
 * @param raw - Parsed JSON value
 * @returns Only the three known string fields, capped; `{}` for anything else
 */
export function parseToolInput(raw: unknown): ToolInput {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const o = raw as Record<string, unknown>;
	const pick = (key: string): string | undefined => (typeof o[key] === 'string' && (o[key] as string).length > 0 ? (o[key] as string).slice(0, MAX_INPUT) : undefined);
	const out: ToolInput = {};
	const filePath = pick('filePath');
	const command = pick('command');
	const url = pick('url');
	if (filePath) out.filePath = filePath;
	if (command) out.command = command;
	if (url) out.url = url;
	return out;
}

const done = (type: BoardActivityType, detail: string, text: string): NormalizedActivity => ({
	type,
	detail: clip(scrubText(detail) || type),
	text: clip(scrubText(text) || type),
});

/** Skills by what they do for the owner. */
const MESSAGING_SKILLS = new Set([
	'reply-chat', 'reply', 'reply-channel', 'send-chat-response', 'reply-slack', 'slack-post', 'slack-file', 'send-message', 'send-file', 'gmail-send',
	'whatsapp-send', 'whatsapp-draft', 'reply-gchat', 'reply-remote', 'broadcast', 'broadcast-to-org', 'ask-owner',
]);
const BROWSING_SKILLS = new Set(['remote-browser', 'web-search', 'browse-stealth', 'chrome-attach']);
/** Writing skills and what to call the place they write to. */
const WRITING_SKILLS: Record<string, string> = {
	'docs-write': 'Google Docs',
	'docs-comment': 'Google Docs',
	'sheets-write': 'Google Sheets',
	'slides-create': 'Google Slides',
	'drive-upload': 'Google Drive',
	'canva-create': 'Canva',
	'canva-upload': 'Canva',
	'canva-export': 'Canva',
	'publish-app': 'a Crewly app',
	'app-data': 'a Crewly app',
	'generate-pdf': 'a PDF',
	'zoho-draft': 'Zoho Mail',
	'content-writer': 'a document',
	'content-repurposer': 'a document',
	'update-sop': 'an SOP',
	'update-team-norm': 'team norms',
};

/** A chat / channel name as it may be shown: `#name`-like, short, no tokens. */
const CHANNEL_NAME = /^#?[A-Za-z0-9][\w.-]{0,38}$/;

/**
 * The value after a flag in a skill's arguments.
 *
 * @param args - Words after the script
 * @param flags - Accepted flag spellings
 * @returns The value, or undefined
 */
function flagValue(args: readonly string[], flags: readonly string[]): string | undefined {
	for (let i = 0; i < args.length - 1; i += 1) {
		if (flags.includes(args[i])) return args[i + 1];
	}
	return undefined;
}

/**
 * Normalize a Bash command.
 *
 * @param command - The shell command
 * @returns Activity
 */
function fromCommand(command: string): NormalizedActivity {
	const reduced = reduceCommand(command);
	if (!reduced) return done('command', 'shell command', 'Ran a shell command');
	if (reduced.skill) {
		const skill = reduced.skill;
		if (MESSAGING_SKILLS.has(skill)) {
			const channel = flagValue(reduced.args, ['--channel', '--to']);
			const name = channel && CHANNEL_NAME.test(channel) ? (channel.startsWith('#') ? channel : `#${channel}`) : skill.includes('slack') ? 'Slack' : 'owner chat';
			return done('messaging', name, name === 'owner chat' ? 'Replied in the owner chat' : `Posted in ${name}`);
		}
		if (BROWSING_SKILLS.has(skill)) {
			const url = reduced.args.find((w) => /^https?:\/\//i.test(w));
			const where = url ? redactUrl(url) : 'the browser';
			return done('browsing', where, `Browsing ${where}`);
		}
		const place = WRITING_SKILLS[skill];
		if (place) return done('writing', place, `Writing in ${place}`);
		return done('command', reduced.label, `Ran ${reduced.label}`);
	}
	if ((reduced.executable === 'curl' || reduced.executable === 'wget') && reduced.args.length > 0) {
		const url = reduced.args.find((w) => /^https?:\/\//i.test(w));
		if (url) {
			const host = redactUrl(url).split('/')[0];
			return done('command', `${reduced.executable} ${host}`, `Called ${host}`);
		}
	}
	return done('command', reduced.label, `Ran ${reduced.label}`);
}

/**
 * Classify an MCP tool by its server and tool name.
 *
 * @param name - `mcp__server__tool`
 * @param input - Tool input
 * @returns Activity
 */
function fromMcp(name: string, input: ToolInput): NormalizedActivity {
	const parts = name.split('__');
	const server = parts[1] ?? 'mcp';
	const tool = parts.slice(2).join('_') || server;
	const hay = `${server} ${tool}`.toLowerCase();
	if (/browser|chrome|playwright|puppeteer|navigate|screenshot/.test(hay)) {
		const where = input.url ? redactUrl(input.url) : 'the browser';
		return done('browsing', where, `Browsing ${where}`);
	}
	if (/slack|chat|message|mail|email|telegram|whatsapp|discord/.test(hay)) return done('messaging', server, `Sent a message via ${server}`);
	if (/docs?|drive|sheets?|slides?|notion|zoho|canva|wiki|write|publish/.test(hay)) return done('writing', server, `Writing in ${server}`);
	return done('other', `${server} ${tool}`, `Used ${server}`);
}

/**
 * Normalize one tool call.
 *
 * @param toolName - Runtime tool name (`Edit`, `Bash`, `mcp__x__y`, ...)
 * @param input - Validated input slice
 * @param ctx - Project roots for relative paths
 * @returns Activity (never contains raw input)
 *
 * @example
 * ```typescript
 * normalizeToolUse('Edit', { filePath: '/work/crewly/src/a.ts' }, { roots: ['/work/crewly'] });
 * // { type: 'coding', detail: 'crewly/src/a.ts', text: 'Edited crewly/src/a.ts' }
 * ```
 */
export function normalizeToolUse(toolName: string, input: ToolInput = {}, ctx: NormalizeContext = {}): NormalizedActivity {
	const name = toolName || 'tool';
	const rel = input.filePath ? relativePath(input.filePath, ctx.roots ?? []) : '';
	switch (name) {
		case 'Edit':
		case 'MultiEdit':
			return rel ? done('coding', rel, `Edited ${rel}`) : done('coding', 'a file', 'Edited a file');
		case 'Write':
			return rel ? done('coding', rel, `Wrote ${rel}`) : done('coding', 'a file', 'Wrote a file');
		case 'NotebookEdit':
			return rel ? done('coding', rel, `Edited notebook ${rel}`) : done('coding', 'a notebook', 'Edited a notebook');
		case 'Read':
			return rel ? done('coding', rel, `Read ${rel}`) : done('coding', 'a file', 'Read a file');
		case 'Grep':
		case 'Glob':
		case 'LS':
			return done('coding', rel || 'the code', 'Searched the code');
		case 'Bash':
		case 'BashOutput':
		case 'KillShell':
			return input.command ? fromCommand(input.command) : done('command', 'shell command', 'Ran a shell command');
		case 'WebFetch': {
			const where = input.url ? redactUrl(input.url) : 'a web page';
			return done('browsing', where, `Opened ${where}`);
		}
		case 'WebSearch':
			return done('browsing', 'web search', 'Searched the web');
		case 'Task':
		case 'Agent':
			return done('thinking', 'helper agent', 'Working with a helper agent');
		case 'TodoWrite':
			return done('thinking', 'planning', 'Planned the next steps');
		case 'AskUserQuestion':
			return done('waiting_owner', 'a question for the owner', 'Asked the owner a question');
		case 'ExitPlanMode':
			return done('waiting_owner', 'plan approval', 'Waiting for the plan to be approved');
		default:
			break;
	}
	if (name.startsWith('mcp__')) return fromMcp(name, input);
	const safe = /^[A-Za-z0-9_-]{1,64}$/.test(name) ? name : 'tool';
	return done('other', safe, `Used ${safe}`);
}

/**
 * A browser action by an agent (the Chrome extension path).
 *
 * @param tool - Extension tool name (`navigate`, `click`, ...)
 * @param url - The page the agent is on, if known
 * @returns Activity
 */
export function normalizeBrowserAction(tool: string, url?: string): NormalizedActivity {
	const where = url ? redactUrl(url) : 'the browser';
	const verb = tool === 'navigate' ? 'Opened' : 'Browsing';
	return done('browsing', where, `${verb} ${where}`);
}

/**
 * An agent message to the owner or a channel.
 *
 * @param channel - Channel or chat name (`#general`, `owner chat`)
 * @returns Activity
 */
export function normalizeMessage(channel: string): NormalizedActivity {
	const name = CHANNEL_NAME.test(channel) && !channel.startsWith('#') && channel !== 'owner chat' ? `#${channel}` : channel;
	return done('messaging', name, name === 'owner chat' ? 'Replied in the owner chat' : `Posted in ${name}`);
}

/**
 * The agent waits for the owner.
 *
 * @param what - Short plain-words description (`approval to send an email`)
 * @returns Activity
 */
export function normalizeOwnerWait(what: string): NormalizedActivity {
	const w = scrubText(what) || 'the owner';
	return done('waiting_owner', w, `Waiting for the owner: ${w}`);
}

/** The agent is in a turn but between tools. */
export const THINKING: NormalizedActivity = { type: 'thinking', detail: 'thinking', text: 'Thinking' };
