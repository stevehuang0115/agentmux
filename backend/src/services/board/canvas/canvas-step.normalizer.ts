/**
 * Step normalizer (crewly#1247 v2): maps a runtime tool call, a browser action,
 * a chat reply or a wait on the owner to one canvas step: a kind, a verb
 * (`label`) and a redacted `target`. Same redaction rules as the board
 * ({@link scrubText}, repo-relative paths, host + path, executable +
 * subcommand); the raw tool input is read here and dropped.
 *
 * Pure (no I/O).
 *
 * @module services/board/canvas/canvas-step.normalizer
 */

import {
	BROWSING_SKILLS,
	CHANNEL_NAME,
	flagValue,
	MESSAGING_SKILLS,
	WRITING_SKILLS,
	type NormalizeContext,
	type ToolInput,
} from '../board-activity.normalizer.js';
import { clip, looksLikeToken, redactUrl, reduceCommand, relativePath, scrubText } from '../board-redact.js';
import type { StepKind } from './canvas.types.js';

/** What a step says before it gets an id and a time. */
export interface StepShape {
	kind: StepKind;
	label: string;
	target?: string;
}

const shape = (kind: StepKind, label: string, target?: string): StepShape => {
	const t = target ? clip(scrubText(target, 120)) : '';
	return { kind, label, ...(t ? { target: t } : {}) };
};

const channelName = (raw: string | undefined, fallback: string): string => {
	// A readable name only: a chat-v2 channel id (a UUID) or a Slack id says nothing to the owner
	if (!raw || !CHANNEL_NAME.test(raw) || looksLikeToken(raw.replace(/^#/, '')) || /^[0-9a-f]{8}-/i.test(raw) || /^[CDG][A-Z0-9]{8,}$/.test(raw)) return fallback;
	return raw.startsWith('#') ? raw : `#${raw}`;
};

function fromCommand(command: string): StepShape {
	const reduced = reduceCommand(command);
	if (!reduced) return shape('command', 'Ran', 'a shell command');
	if (reduced.skill) {
		const skill = reduced.skill;
		if (MESSAGING_SKILLS.has(skill)) {
			const fallback = skill.includes('slack') ? 'Slack' : skill === 'reply-channel' ? 'a channel' : 'owner chat';
			return shape('message', 'Sent message', channelName(flagValue(reduced.args, ['--channel', '--to']), fallback));
		}
		if (BROWSING_SKILLS.has(skill)) {
			const url = reduced.args.find((w) => /^https?:\/\//i.test(w));
			if (skill === 'web-search') return shape('search', 'Searched', 'the web');
			return shape('browse', url ? 'Opened' : 'Browsed', url ? redactUrl(url) : 'the browser');
		}
		const place = WRITING_SKILLS[skill];
		if (place) return shape('write', 'Wrote in', place);
		return shape('command', 'Ran', reduced.label);
	}
	if ((reduced.executable === 'curl' || reduced.executable === 'wget') && reduced.args.length > 0) {
		const url = reduced.args.find((w) => /^https?:\/\//i.test(w));
		if (url) return shape('browse', 'Fetched', redactUrl(url));
	}
	return shape('command', 'Ran', reduced.label);
}

function fromMcp(name: string, input: ToolInput): StepShape {
	const parts = name.split('__');
	const server = parts[1] ?? 'mcp';
	const tool = parts.slice(2).join('_') || server;
	const hay = `${server} ${tool}`.toLowerCase();
	if (/browser|chrome|playwright|puppeteer|navigate|screenshot/.test(hay)) {
		return shape('browse', /navigate/.test(hay) ? 'Opened' : 'Browsed', input.url ? redactUrl(input.url) : 'the browser');
	}
	if (/slack|chat|message|mail|email|telegram|whatsapp|discord/.test(hay)) return shape('message', 'Sent message', server);
	if (/search/.test(hay)) return shape('search', 'Searched', server);
	if (/docs?|drive|sheets?|slides?|notion|zoho|canva|wiki|write|publish/.test(hay)) return shape('write', 'Wrote in', server);
	return shape('tool', 'Used', `${server} ${tool}`);
}

/**
 * One tool call as a step.
 *
 * @param toolName - Runtime tool name (`Edit`, `Bash`, `mcp__x__y`, ...)
 * @param input - Validated input slice (see {@link parseToolInput})
 * @param ctx - Project roots for relative paths
 * @returns Kind, verb and redacted target
 *
 * @example
 * ```typescript
 * stepOfTool('Bash', { command: 'cd app && npm test -- --ci' }); // { kind: 'command', label: 'Ran', target: 'npm test' }
 * stepOfTool('WebSearch', { query: 'open swarm rivals' }); // { kind: 'search', label: 'Searched', target: '"open swarm rivals"' }
 * ```
 */
export function stepOfTool(toolName: string, input: ToolInput = {}, ctx: NormalizeContext = {}): StepShape {
	const name = toolName || 'tool';
	const rel = input.filePath ? relativePath(input.filePath, ctx.roots ?? []) : '';
	switch (name) {
		case 'Read':
			return shape('read', 'Read', rel || 'a file');
		case 'Edit':
		case 'MultiEdit':
			return shape('edit', 'Edited', rel || 'a file');
		case 'NotebookEdit':
			return shape('edit', 'Edited', rel || 'a notebook');
		case 'Write':
			return shape('write', 'Wrote', rel || 'a file');
		case 'Grep':
		case 'Glob':
		case 'LS':
			return shape('search', 'Searched', rel || 'the code');
		case 'Bash':
		case 'BashOutput':
		case 'KillShell':
			return input.command ? fromCommand(input.command) : shape('command', 'Ran', 'a shell command');
		case 'WebFetch':
			return shape('browse', 'Opened', input.url ? redactUrl(input.url) : 'a web page');
		case 'WebSearch': {
			const q = input.query ? scrubText(input.query, 100) : '';
			return shape('search', 'Searched', q ? `"${q}"` : 'the web');
		}
		case 'Task':
		case 'Agent':
			return shape('tool', 'Asked', 'a helper agent');
		case 'TodoWrite':
			return shape('tool', 'Planned', 'the next steps');
		case 'AskUserQuestion':
			return shape('wait', 'Asked', 'the owner a question');
		case 'ExitPlanMode':
			return shape('wait', 'Waiting for', 'plan approval');
		default:
			break;
	}
	if (name.startsWith('mcp__')) return fromMcp(name, input);
	return shape('tool', 'Used', /^[A-Za-z0-9_-]{1,64}$/.test(name) ? name : 'a tool');
}

/**
 * A browser action by an agent (the Chrome extension path).
 *
 * @param tool - Extension tool name (`navigate`, `click`, ...)
 * @param url - The page the agent is on, if known
 * @returns Step shape
 */
export function stepOfBrowserAction(tool: string, url?: string): StepShape {
	const where = url ? redactUrl(url) : 'the browser';
	const verbs: Record<string, string> = {
		navigate: 'Opened',
		click: 'Clicked on',
		type: 'Typed on',
		scroll: 'Scrolled',
		screenshot: 'Looked at',
		read: 'Read',
		extract: 'Read',
	};
	return shape('browse', verbs[tool] ?? 'Browsed', where);
}

/**
 * An agent message to the owner or a channel.
 *
 * @param channel - Channel or chat name (`#general`, `owner chat`, `Slack`)
 * @returns Step shape
 */
export function stepOfMessage(channel: string): StepShape {
	const name = CHANNEL_NAME.test(channel) && !channel.startsWith('#') && channel !== 'owner chat' && channel !== 'Slack' ? `#${channel}` : channel;
	return shape('message', 'Sent message', name);
}

/**
 * The agent waits for the owner.
 *
 * @param what - Short plain-words description
 * @returns Step shape
 */
export function stepOfOwnerWait(what: string): StepShape {
	return shape('wait', 'Waiting for', what || 'the owner');
}
