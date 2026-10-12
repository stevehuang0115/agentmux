/**
 * Transcript tail for the canvas (crewly#1247 v2): the agent's own short text
 * lines (and, for Codex, its tool calls) from the runtime's own transcript.
 *
 * - Claude Code: `<claude home>/projects/<cwd>/<session id>.jsonl` (located the
 *   way the turn-state fallback does). Only `assistant` `text` blocks become
 *   steps, reduced by {@link shortAgentLine}; a `tool_result`'s `is_error` flag
 *   marks its step failed. Tool inputs, tool OUTPUTS, thinking and user
 *   messages are never read into anything.
 * - Codex: `<codex home>/sessions/.../rollout-*-<conversation id>.jsonl`.
 *   Assistant `output_text` becomes text steps; shell / exec / apply_patch
 *   calls become command / edit steps (reduced to executable + subcommand /
 *   file name), paired with their output by call id for the duration. Output
 *   bodies are not read.
 *
 * Incremental: a byte cursor per file, only whole new lines, at most
 * {@link CANVAS_CONSTANTS.TAIL_MAX_READ_BYTES} per pass; lines that cannot be
 * a text / error line are skipped by substring before any JSON.parse (tool
 * results are the bulk of a transcript). Nothing is logged or stored beyond
 * the redacted step.
 *
 * @module services/board/canvas/canvas-transcript.tail
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { CANVAS_CONSTANTS } from '../../../constants.js';
import type { SecretEnvValue } from '../../../utils/secret-env.js';
import { relativePath } from '../board-redact.js';
import { shortAgentLine } from './canvas-redact.js';
import { stepOfTool, type StepShape } from './canvas-step.normalizer.js';
import type { StepStream } from './canvas-step.stream.js';

const C = CANVAS_CONSTANTS;

/** What a chunk of transcript says. */
export type TailItem =
	| { kind: 'text'; id: string; at: number; text: string }
	| { kind: 'tool_error'; toolUseId: string; at: number }
	| { kind: 'step_start'; id: string; at: number; shape: StepShape }
	| { kind: 'step_end'; id: string; at: number };

/** Parse options. */
export interface TailParseOptions {
	secrets?: readonly SecretEnvValue[];
	roots?: readonly string[];
	/** Drop text older than this (epoch ms) */
	minAt?: number;
}

const toMs = (v: unknown, fallback: number): number => {
	const t = typeof v === 'string' ? Date.parse(v) : NaN;
	return Number.isFinite(t) ? t : fallback;
};

/**
 * Items from whole lines of a Claude Code transcript.
 *
 * @param text - Whole JSONL lines
 * @param opts - Secrets to mask, oldest text to keep
 * @param now - Fallback time for an entry with no timestamp
 * @returns Items in file order
 */
export function parseClaudeTail(text: string, opts: TailParseOptions = {}, now: number = Date.now()): TailItem[] {
	const out: TailItem[] = [];
	for (const line of text.split('\n')) {
		if (line.length < 20) continue;
		const isAssistantText = line.includes('"type":"assistant"') && line.includes('"type":"text"');
		const isError = line.includes('"is_error":true') && line.includes('"tool_result"');
		if (!isAssistantText && !isError) continue;
		let entry: Record<string, unknown>;
		try {
			entry = JSON.parse(line) as Record<string, unknown>;
		} catch {
			continue;
		}
		// A subagent's chatter is not the agent's; meta / API-error entries are not its words
		if (entry.isSidechain === true || entry.isMeta === true || entry.isApiErrorMessage === true) continue;
		const message = entry.message as { content?: unknown } | undefined;
		const content = message?.content;
		if (!Array.isArray(content)) continue;
		const at = toMs(entry.timestamp, now);
		if (entry.type === 'assistant') {
			const uuid = typeof entry.uuid === 'string' ? entry.uuid : `${at}`;
			content.forEach((block, i) => {
				const b = block as { type?: string; text?: unknown };
				if (b?.type !== 'text') return;
				if (opts.minAt !== undefined && at < opts.minAt) return;
				const t = shortAgentLine(b.text, opts.secrets ?? []);
				if (t) out.push({ kind: 'text', id: `${uuid}:${i}`, at, text: t });
			});
		} else if (entry.type === 'user') {
			for (const block of content) {
				const b = block as { type?: string; tool_use_id?: unknown; is_error?: unknown };
				// Only the flag and the id are read; the result's content never is
				if (b?.type === 'tool_result' && b.is_error === true && typeof b.tool_use_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(b.tool_use_id)) {
					out.push({ kind: 'tool_error', toolUseId: b.tool_use_id, at });
				}
			}
		}
	}
	return out;
}

/** The shell command a Codex call runs, from its (JSON) arguments or its JS wrapper. */
function codexCommand(name: string, raw: unknown): string | null {
	if (typeof raw !== 'string' || raw.length > 20_000) return null;
	if (name === 'exec') {
		// The code-mode wrapper: `tools.exec_command({cmd:"..."})`
		const m = /\bcmd\s*:\s*("(?:[^"\\]|\\.)*")/.exec(raw);
		if (!m) return null;
		try {
			return JSON.parse(m[1]) as string;
		} catch {
			return null;
		}
	}
	try {
		const args = JSON.parse(raw) as { command?: unknown; cmd?: unknown };
		const c = args.command ?? args.cmd;
		if (typeof c === 'string') return c;
		if (Array.isArray(c) && c.every((x) => typeof x === 'string')) {
			const words = c as string[];
			// ["bash","-lc","git status"] runs the last word
			return /^(?:ba|z|da)?sh$/.test(words[0] ?? '') && words.length >= 3 ? words[words.length - 1] : words.join(' ');
		}
	} catch {
		return null;
	}
	return null;
}

const PATCH_FILE = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/m;

/**
 * Items from whole lines of a Codex rollout.
 *
 * @param text - Whole JSONL lines
 * @param opts - Secrets to mask, project roots, oldest text to keep
 * @param now - Fallback time for an entry with no timestamp
 * @returns Items in file order
 */
export function parseCodexTail(text: string, opts: TailParseOptions = {}, now: number = Date.now()): TailItem[] {
	const out: TailItem[] = [];
	const textId = (t: string): string => `cx-${createHash('sha1').update(t).digest('hex').slice(0, 14)}`;
	for (const line of text.split('\n')) {
		if (line.length < 20) continue;
		const interesting =
			line.includes('"output_text"') || line.includes('"agent_message"') || line.includes('"function_call') || line.includes('"custom_tool_call');
		if (!interesting) continue;
		let entry: { timestamp?: string; type?: string; payload?: Record<string, unknown> };
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		const p = entry.payload;
		if (!p || typeof p !== 'object') continue;
		const at = toMs(entry.timestamp, now);
		if (entry.type === 'event_msg' && p.type === 'agent_message' && typeof p.message === 'string') {
			if (opts.minAt !== undefined && at < opts.minAt) continue;
			const t = shortAgentLine(p.message, opts.secrets ?? []);
			if (t) out.push({ kind: 'text', id: textId(t), at, text: t });
			continue;
		}
		if (entry.type !== 'response_item') continue;
		if (p.type === 'message' && p.role === 'assistant' && Array.isArray(p.content)) {
			if (opts.minAt !== undefined && at < opts.minAt) continue;
			for (const block of p.content as Array<{ type?: string; text?: unknown }>) {
				if (block?.type !== 'output_text') continue;
				const t = shortAgentLine(block.text, opts.secrets ?? []);
				if (t) out.push({ kind: 'text', id: textId(t), at, text: t });
			}
			continue;
		}
		const callId = typeof p.call_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(p.call_id) ? p.call_id : null;
		if (!callId) continue;
		if (p.type === 'function_call' || p.type === 'custom_tool_call' || p.type === 'local_shell_call') {
			if (opts.minAt !== undefined && at < opts.minAt) continue;
			const name = typeof p.name === 'string' ? p.name : '';
			if (name === 'apply_patch') {
				const file = PATCH_FILE.exec(typeof p.input === 'string' ? p.input : typeof p.arguments === 'string' ? p.arguments : '')?.[1]?.trim();
				const shape = stepOfTool('Edit', file ? { filePath: file } : {}, { roots: opts.roots ?? [] });
				out.push({ kind: 'step_start', id: callId, at, shape });
				continue;
			}
			const command = codexCommand(name, name === 'exec' ? p.input : p.arguments);
			if (command) out.push({ kind: 'step_start', id: callId, at, shape: stepOfTool('Bash', { command }, { roots: opts.roots ?? [] }) });
			else if (name && name !== 'exec') out.push({ kind: 'step_start', id: callId, at, shape: stepOfTool(name, {}, { roots: opts.roots ?? [] }) });
		} else if (p.type === 'function_call_output' || p.type === 'custom_tool_call_output') {
			out.push({ kind: 'step_end', id: callId, at });
		}
	}
	return out;
}

/** Where a session's transcript is. */
export interface TailTarget {
	kind: 'claude' | 'codex';
	file: string;
}

/** Collaborators. */
export interface TranscriptTailDeps {
	steps: StepStream;
	/** Sessions to follow */
	sessions: () => string[];
	/** The session's transcript, or null (Gemini, agy: none) */
	locate: (session: string) => Promise<TailTarget | null> | TailTarget | null;
	/** Project roots of a session (relative paths) */
	roots?: (session: string) => readonly string[];
	/** Exact secret values to mask */
	secrets?: () => readonly SecretEnvValue[];
	/** Someone is watching: poll faster */
	isLive?: () => boolean;
	now?: () => number;
	setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	clearTimeout?: (h: ReturnType<typeof setTimeout>) => void;
}

interface Cursor {
	file: string;
	kind: 'claude' | 'codex';
	offset: number;
	/** First look: only recent text */
	fresh: boolean;
}

/**
 * Follows the transcripts of the agents and feeds the step stream.
 */
export class TranscriptTailService {
	private readonly cursors = new Map<string, Cursor>();
	private readonly located = new Map<string, { at: number; target: TailTarget | null }>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private started = false;
	private readonly now: () => number;
	private readonly setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
	private readonly clearTimer: (h: ReturnType<typeof setTimeout>) => void;

	constructor(private readonly deps: TranscriptTailDeps) {
		this.now = deps.now ?? Date.now;
		this.setTimer =
			deps.setTimeout ??
			((fn, ms) => {
				const t = setTimeout(fn, ms);
				t.unref?.();
				return t;
			});
		this.clearTimer = deps.clearTimeout ?? ((h) => clearTimeout(h));
	}

	/** Start polling. Idempotent. */
	start(): void {
		if (this.started) return;
		this.started = true;
		this.schedule();
	}

	/** Stop polling. */
	stop(): void {
		this.started = false;
		if (this.timer) this.clearTimer(this.timer);
		this.timer = null;
	}

	private schedule(): void {
		if (!this.started) return;
		const live = this.deps.isLive?.() ?? false;
		this.timer = this.setTimer(() => {
			this.timer = null;
			void this.tick().finally(() => this.schedule());
		}, live ? C.TAIL_LIVE_INTERVAL_MS : C.TAIL_IDLE_INTERVAL_MS);
	}

	/**
	 * One pass over every followed session. Never throws.
	 *
	 * @returns Items fed to the stream
	 */
	async tick(): Promise<number> {
		if (this.running) return 0;
		this.running = true;
		let fed = 0;
		try {
			const sessions = this.deps.sessions();
			for (const session of sessions) {
				try {
					fed += await this.follow(session);
				} catch {
					// one unreadable transcript must not stop the others
				}
			}
			const known = new Set(sessions);
			for (const key of [...this.cursors.keys()]) if (!known.has(key)) this.cursors.delete(key);
			for (const key of [...this.located.keys()]) if (!known.has(key)) this.located.delete(key);
		} finally {
			this.running = false;
		}
		return fed;
	}

	private async target(session: string): Promise<TailTarget | null> {
		const now = this.now();
		const hit = this.located.get(session);
		if (hit && now - hit.at < C.TAIL_LOCATE_TTL_MS) return hit.target;
		let target: TailTarget | null = null;
		try {
			target = await this.deps.locate(session);
		} catch {
			target = null;
		}
		this.located.set(session, { at: now, target });
		return target;
	}

	private async follow(session: string): Promise<number> {
		const target = await this.target(session);
		if (!target) {
			this.cursors.delete(session);
			return 0;
		}
		let size: number;
		try {
			size = (await fs.stat(target.file)).size;
		} catch {
			this.located.delete(session);
			return 0;
		}
		let cursor = this.cursors.get(session);
		if (!cursor || cursor.file !== target.file || size < cursor.offset) {
			cursor = { file: target.file, kind: target.kind, offset: Math.max(0, size - C.TAIL_FIRST_READ_BYTES), fresh: true };
			this.cursors.set(session, cursor);
		}
		if (size === cursor.offset) return 0;
		let from = cursor.offset;
		if (size - from > C.TAIL_MAX_READ_BYTES) from = size - C.TAIL_MAX_READ_BYTES;
		const handle = await fs.open(target.file, 'r');
		let buf: Buffer;
		try {
			buf = Buffer.alloc(size - from);
			await handle.read(buf, 0, buf.length, from);
		} finally {
			await handle.close();
		}
		// Work in bytes: a multi-byte character cut at the end must not shift the cursor
		const lastNl = buf.lastIndexOf(0x0a);
		if (lastNl < 0) return 0;
		// A read that starts mid-file starts mid-line: skip to the first whole line
		const startedMidFile = from > 0 && (from !== cursor.offset || cursor.fresh);
		const firstNl = startedMidFile ? buf.indexOf(0x0a) : -1;
		if (startedMidFile && firstNl >= lastNl) {
			cursor.offset = from + lastNl + 1;
			return 0;
		}
		const complete = buf.subarray(startedMidFile ? firstNl + 1 : 0, lastNl).toString('utf-8');
		cursor.offset = from + lastNl + 1;
		const now = this.now();
		const opts: TailParseOptions = {
			secrets: this.deps.secrets?.() ?? [],
			roots: this.deps.roots?.(session) ?? [],
			...(cursor.fresh ? { minAt: now - C.TAIL_FIRST_MAX_AGE_MS } : {}),
		};
		cursor.fresh = false;
		const items = cursor.kind === 'claude' ? parseClaudeTail(complete, opts, now) : parseCodexTail(complete, opts, now);
		return this.feed(session, items, cursor.kind === 'codex');
	}

	private feed(session: string, items: TailItem[], callsAreSteps: boolean): number {
		let fed = 0;
		const steps = this.deps.steps;
		// A flood of narration (first look, a long pass) keeps the newest lines
		const texts = items.filter((i) => i.kind === 'text');
		const keep = new Set(texts.slice(-10));
		for (const item of items) {
			switch (item.kind) {
				case 'text':
					if (keep.has(item) && steps.text(session, item.id, item.at, item.text)) fed += 1;
					break;
				case 'tool_error':
					steps.markError(session, item.toolUseId, item.at);
					break;
				case 'step_start':
					// Codex has no hooks: its calls are the steps
					if (callsAreSteps) {
						steps.start(session, item.shape, { id: item.id }, item.at);
						fed += 1;
					}
					break;
				case 'step_end':
					if (callsAreSteps) steps.finish(session, item.id, 'done', item.at);
					break;
			}
		}
		return fed;
	}
}

/** Re-exported for the wiring: a path made relative to project roots. */
export { relativePath };
