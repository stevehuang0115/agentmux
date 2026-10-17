/**
 * Work a restart cut off inside an agent's Claude Code conversation
 * (crewly#1361). A `tool_use` block whose `tool_use_id` never received a
 * `tool_result` before the transcript ends was still running when the process
 * died: a sub-agent (Task / Agent tool) or a background / long-running shell
 * command. Neither survives the restart, but the agent's last words in the
 * transcript say the work is "still in progress", so a resumed agent waited on
 * it for 16 hours. The handover lists these calls as interrupted, near its
 * top and again under "Open work", so the new conversation restarts them or
 * reports them lost instead of waiting.
 *
 * @module services/agent/handover-interrupted
 */

import { HANDOVER_CONSTANTS } from '../../constants.js';

const C = HANDOVER_CONSTANTS;

/** A `tool_use` block of the transcript that has not received its result (yet). */
export interface PendingToolCall {
	/** `tool_use.id` */
	id: string;
	/** Tool name ("Task", "Agent", "Bash", …) */
	name: string;
	/** `tool_use.input` as recorded */
	input: unknown;
}

/** One interrupted call, as the handover describes it. */
export interface InterruptedWork {
	kind: 'sub-agent' | 'background-command';
	/** What it was doing: the sub-agent's description and prompt head, or the command head (clipped) */
	text: string;
}

/**
 * Clip to one line of at most {@link HANDOVER_CONSTANTS.INTERRUPTED_TEXT_MAX_CHARS}
 * characters, without a trailing full stop (the bullet adds its own sentence).
 *
 * @param text - Text
 * @returns One line
 */
function clip(text: string): string {
	const flat = text.replace(/\s+/g, ' ').trim().replace(/[.。]+$/u, '');
	return flat.length > C.INTERRUPTED_TEXT_MAX_CHARS ? `${flat.slice(0, C.INTERRUPTED_TEXT_MAX_CHARS)}…` : flat;
}

/**
 * A string field of a tool input object, or ''.
 *
 * @param input - `tool_use.input`
 * @param key - Field name
 * @returns The field when it is a string
 */
function field(input: unknown, key: string): string {
	if (!input || typeof input !== 'object') return '';
	const v = (input as Record<string, unknown>)[key];
	return typeof v === 'string' ? v : '';
}

/**
 * Whether a pending call is long-running work that dies with the process: a
 * sub-agent, or a shell command run in the background or that looks like a
 * render / encode / build ({@link HANDOVER_CONSTANTS.LONG_COMMAND_PATTERN}).
 * A short command that merely had no result yet (the last `cat` before the
 * cut) is not listed: nothing was lost but its output.
 *
 * @param call - Pending tool call
 * @returns The interrupted work it stands for, or null
 */
export function interruptedFromCall(call: PendingToolCall): InterruptedWork | null {
	if (C.SUBAGENT_TOOLS.includes(call.name)) {
		const description = field(call.input, 'description');
		const prompt = field(call.input, 'prompt');
		const text = clip([description, prompt].filter(Boolean).join(': ') || call.name);
		return { kind: 'sub-agent', text };
	}
	if (C.SHELL_TOOLS.includes(call.name)) {
		const command = field(call.input, 'command');
		const background = !!call.input && typeof call.input === 'object' && (call.input as Record<string, unknown>).run_in_background === true;
		if (!background && !C.LONG_COMMAND_PATTERN.test(command)) return null;
		return { kind: 'background-command', text: clip(command || call.name) };
	}
	return null;
}

/**
 * The interrupted work among the calls still pending at the end of a
 * transcript, oldest first, at most {@link HANDOVER_CONSTANTS.INTERRUPTED_MAX_ITEMS}.
 *
 * @param pending - Tool calls without a result, in transcript order
 * @returns Interrupted sub-agents and background commands
 *
 * @example
 * interruptedWork([{ id: 't1', name: 'Task', input: { description: 'Make v4', prompt: '…' } }])
 * // → [{ kind: 'sub-agent', text: 'Make v4: …' }]
 */
export function interruptedWork(pending: readonly PendingToolCall[]): InterruptedWork[] {
	const out: InterruptedWork[] = [];
	for (const call of pending) {
		const item = interruptedFromCall(call);
		if (item) out.push(item);
		if (out.length >= C.INTERRUPTED_MAX_ITEMS) break;
	}
	return out;
}

/**
 * One bullet of the section.
 *
 * @param item - Interrupted work
 * @returns The line
 */
export function interruptedLine(item: InterruptedWork): string {
	return item.kind === 'sub-agent'
		? `${C.SUBAGENT_LINE_PREFIX}${item.text}${C.SUBAGENT_LINE_SUFFIX}`
		: `${C.COMMAND_LINE_PREFIX}${item.text}${C.COMMAND_LINE_SUFFIX}`;
}

/**
 * The "Interrupted by the restart" section of a handover: factual, one bullet
 * per call, nothing about mechanics.
 *
 * @param items - Interrupted work
 * @returns Markdown, or '' when nothing was interrupted
 */
export function formatInterruptedSection(items: readonly InterruptedWork[]): string {
	if (items.length === 0) return '';
	return [C.INTERRUPTED_HEADING, '', ...items.map(interruptedLine)].join('\n');
}

/**
 * Read the interrupted work back out of a handover body that carries the
 * section (the pointers header is written by a different module and lists
 * the same items under "Open work").
 *
 * @param body - Handover body
 * @returns The items, in order; [] when the section is absent
 */
export function interruptedFromHandoverBody(body: string): InterruptedWork[] {
	const start = body.indexOf(C.INTERRUPTED_HEADING);
	if (start === -1) return [];
	const out: InterruptedWork[] = [];
	for (const raw of body.slice(start + C.INTERRUPTED_HEADING.length).split('\n')) {
		const line = raw.trim();
		if (!line) continue;
		if (!line.startsWith('- ')) break;
		if (line.startsWith(C.SUBAGENT_LINE_PREFIX) && line.endsWith(C.SUBAGENT_LINE_SUFFIX)) {
			out.push({ kind: 'sub-agent', text: line.slice(C.SUBAGENT_LINE_PREFIX.length, line.length - C.SUBAGENT_LINE_SUFFIX.length) });
		} else if (line.startsWith(C.COMMAND_LINE_PREFIX) && line.endsWith(C.COMMAND_LINE_SUFFIX)) {
			out.push({ kind: 'background-command', text: line.slice(C.COMMAND_LINE_PREFIX.length, line.length - C.COMMAND_LINE_SUFFIX.length) });
		}
	}
	return out;
}
