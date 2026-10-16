/**
 * Agent ask ledger — the return path of agent-to-agent messages.
 *
 * When one agent hands work to another with a plain message (send-message /
 * `/terminal/:to/write`), nothing brings the answer back: no WorkItem, no
 * completion event. On 2026-10-14 Pia passed the owner's "replicate this X
 * video" to Dex; Dex rendered the films in 24 minutes, wrote "both parts are
 * done" into its own terminal and stopped. Nobody saw it for seven hours.
 *
 * This ledger remembers each agent message once it is delivered. When the
 * receiver ends a turn that worked on it for a while and it neither wrote
 * back to the sender nor posted anywhere, the harness passes the receiver's
 * last words to the sender. The receiver's open asks also hold the owner's
 * ticket open (an agent that handed the work on has not answered yet).
 *
 * Cheap by construction: no model call, one transcript read per forwarded
 * ask. Off switch: `CREWLY_AGENT_ASK_RETURN=off`.
 *
 * @module services/messaging/agent-ask-ledger.service
 */

import * as fsSync from 'fs';
import * as path from 'path';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { atomicWriteJson } from '../../utils/file-io.utils.js';

/** Tunables. */
export const AGENT_ASK_CONSTANTS = {
	/** Store file under CREWLY_HOME */
	FILE_NAME: 'agent-asks.json',
	/** A turn this long after the delivery counts as having worked on the message (ms) */
	MIN_WORK_MS: 2 * 60_000,
	/**
	 * A turn that ends sooner than MIN_WORK_MS but at least this long after
	 * the delivery read it and let it go (an FYI, an "ok"): the ask is dropped
	 * without a word. Sooner than this, the turn that ended is the previous
	 * one, not the message's (ms).
	 */
	MIN_READ_MS: 15_000,
	/** An ask nobody answered is forgotten after this (ms) */
	TTL_MS: 12 * 60 * 60_000,
	/** Asks kept in the store */
	MAX_ASKS: 300,
	/** Characters of the asked message quoted back to the sender */
	EXCERPT_CHARS: 200,
	/** Characters of the receiver's last words passed on */
	RESULT_CHARS: 3000,
	/** Env switch: `off` disables the ledger */
	ENV_SWITCH: 'CREWLY_AGENT_ASK_RETURN',
} as const;

const C = AGENT_ASK_CONSTANTS;

/** One delivered agent-to-agent message. */
export interface AgentAsk {
	/** Sending agent */
	sender: string;
	/** Receiving agent */
	target: string;
	/** Start of the message */
	excerpt: string;
	/** When it reached the receiver's turn (epoch ms) */
	deliveredAt: number;
}

/** Collaborators. */
export interface AgentAskLedgerDeps {
	/** Store file; omit to keep the ledger in memory only */
	file?: string;
	/** What the receiver last wrote in its own transcript since `sinceMs`, or null */
	readLastWords: (session: string, sinceMs: number) => Promise<string | null>;
	/** Deliver a harness message to an agent */
	deliver: (session: string, text: string) => Promise<unknown>;
	/** Readable name of an agent (default: the member part of its session name) */
	displayName?: (session: string) => string;
	now?: () => number;
}

interface StoreShape {
	asks: AgentAsk[];
	/** Last post of each agent in chat (epoch ms) */
	posts: Record<string, number>;
}

/**
 * The member name in a session id: `flopost-dex-7f17ecbc` → `Dex`.
 *
 * @param session - Session name
 * @returns Readable name
 */
export function memberName(session: string): string {
	const parts = session.split('-');
	const name = parts.length >= 3 && /^[0-9a-f]{6,}$/.test(parts[parts.length - 1]) ? parts[parts.length - 2] : session;
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Text handed to the sender in place of the answer it never got.
 *
 * @param input - Names, the asked excerpt, minutes worked, the last words
 * @returns Message for the sender
 */
export function renderReturnedAnswer(input: { target: string; excerpt: string; minutes: number; lastWords: string | null }): string {
	const head = `[ANSWER FROM ${input.target.toUpperCase()}] ${input.target} worked on your message for about ${input.minutes} min and ended without writing back to you or posting anywhere.`;
	const asked = `Your message: "${input.excerpt}"`;
	if (!input.lastWords) {
		return `${head} Crewly could not read what it said. ${asked}\nAsk ${input.target} for the result.`;
	}
	return (
		`${head} Crewly is passing on its last words. ${asked}\n\n` +
		`--- ${input.target} ---\n${input.lastWords}\n---\n\n` +
		`If this is what you were waiting for, carry it on (for example, post it where the owner asked). No need to answer Crewly.`
	);
}

/**
 * Remembers delivered agent messages and returns unsent answers. See module docs.
 */
export class AgentAskLedger {
	private asks: AgentAsk[] = [];
	private posts = new Map<string, number>();
	private readonly logger: ComponentLogger;
	private readonly now: () => number;
	private saving: Promise<void> = Promise.resolve();

	constructor(private readonly deps: AgentAskLedgerDeps) {
		this.logger = LoggerService.getInstance().createComponentLogger('AgentAskLedger');
		this.now = deps.now ?? Date.now;
		this.load();
	}

	/**
	 * A message from `sender` reached `target`'s turn.
	 *
	 * @param target - Receiving agent
	 * @param sender - Sending agent
	 * @param text - What was delivered
	 */
	noteDelivered(target: string, sender: string, text: string): void {
		if (!target || !sender || target === sender) return;
		const excerpt = text.replace(/\s+/g, ' ').trim().slice(0, C.EXCERPT_CHARS);
		this.asks.push({ sender, target, excerpt, deliveredAt: this.now() });
		this.prune();
		this.save();
	}

	/**
	 * `from` wrote to `to`: every open ask of `to` to `from` is answered.
	 *
	 * @param from - Writing agent
	 * @param to - Agent written to
	 */
	noteAnswered(from: string, to: string): void {
		const before = this.asks.length;
		this.asks = this.asks.filter((a) => !(a.target === from && a.sender === to));
		if (this.asks.length !== before) this.save();
	}

	/**
	 * An agent posted in chat (an answer, not an interim note): asks delivered
	 * to it before now count as answered where they were asked to be.
	 *
	 * @param session - Posting agent
	 */
	notePost(session: string): void {
		if (!session) return;
		this.posts.set(session, this.now());
		this.save();
	}

	/**
	 * Asks `sender` made that are still unanswered.
	 *
	 * @param sender - Asking agent
	 * @returns Open asks, oldest first
	 */
	openAsksBy(sender: string): AgentAsk[] {
		this.prune();
		return this.asks.filter((a) => a.sender === sender);
	}

	/**
	 * Every ask still unanswered (copies), for "where is it now" views.
	 *
	 * @returns Open asks, oldest first
	 */
	openAsks(): AgentAsk[] {
		this.prune();
		return this.asks.map((a) => ({ ...a }));
	}

	/**
	 * `target` finished a turn. An ask it worked on for at least
	 * {@link AGENT_ASK_CONSTANTS.MIN_WORK_MS} with no word back is answered
	 * for it: its last words go to the sender. One it answered in chat, or
	 * read in a short turn, is dropped. Never throws.
	 *
	 * @param target - Agent whose turn ended
	 * @returns Asks returned to their senders
	 */
	async onTurnEnded(target: string): Promise<number> {
		try {
			this.prune();
			const now = this.now();
			const mine = this.asks.filter((a) => a.target === target);
			if (mine.length === 0) return 0;
			const posted = this.posts.get(target) ?? 0;
			const age = (a: AgentAsk): number => now - a.deliveredAt;
			// Answered in chat, or read and let go after a short turn: drop quietly.
			const quiet = mine.filter((a) => posted >= a.deliveredAt || (age(a) >= C.MIN_READ_MS && age(a) < C.MIN_WORK_MS));
			const due = mine.filter((a) => posted < a.deliveredAt && age(a) >= C.MIN_WORK_MS);
			if (quiet.length === 0 && due.length === 0) return 0;
			const settled = new Set([...quiet, ...due]);
			this.asks = this.asks.filter((a) => !settled.has(a));
			this.save();
			// One message per sender, from the oldest ask it is waiting on.
			const bySender = new Map<string, AgentAsk>();
			for (const a of due) if (!bySender.has(a.sender)) bySender.set(a.sender, a);
			let returned = 0;
			for (const ask of bySender.values()) {
				const lastWords = await this.deps.readLastWords(target, ask.deliveredAt).catch(() => null);
				const text = renderReturnedAnswer({
					target: (this.deps.displayName ?? memberName)(target),
					excerpt: ask.excerpt,
					minutes: Math.max(1, Math.round((now - ask.deliveredAt) / 60_000)),
					lastWords: lastWords ? clipResult(lastWords) : null,
				});
				try {
					await this.deps.deliver(ask.sender, text);
					returned += 1;
					this.logger.info('Returned an unsent answer to its asker', { from: target, to: ask.sender, hadText: !!lastWords });
				} catch (err) {
					this.logger.warn('Could not return an unsent answer', { from: target, to: ask.sender, error: err instanceof Error ? err.message : String(err) });
				}
			}
			return returned;
		} catch (err) {
			this.logger.debug('Ask settle failed', { target, error: err instanceof Error ? err.message : String(err) });
			return 0;
		}
	}

	private prune(): void {
		const cutoff = this.now() - C.TTL_MS;
		this.asks = this.asks.filter((a) => a.deliveredAt >= cutoff).slice(-C.MAX_ASKS);
		for (const [s, at] of this.posts) if (at < cutoff) this.posts.delete(s);
	}

	private load(): void {
		if (!this.deps.file) return;
		try {
			const raw = JSON.parse(fsSync.readFileSync(this.deps.file, 'utf-8')) as Partial<StoreShape>;
			if (Array.isArray(raw.asks)) {
				this.asks = raw.asks.filter(
					(a): a is AgentAsk =>
						!!a && typeof a.sender === 'string' && typeof a.target === 'string' && typeof a.excerpt === 'string' && typeof a.deliveredAt === 'number',
				);
			}
			if (raw.posts && typeof raw.posts === 'object') {
				for (const [s, at] of Object.entries(raw.posts)) if (typeof at === 'number') this.posts.set(s, at);
			}
			this.prune();
		} catch {
			// missing or unreadable: start empty
		}
	}

	private save(): void {
		const file = this.deps.file;
		if (!file) return;
		const data: StoreShape = { asks: this.asks, posts: Object.fromEntries(this.posts) };
		this.saving = this.saving
			.then(async () => {
				fsSync.mkdirSync(path.dirname(file), { recursive: true });
				await atomicWriteJson(file, data);
			})
			.catch((err: unknown) => {
				this.logger.debug('Ask ledger not saved', { error: err instanceof Error ? err.message : String(err) });
			});
	}

	/** Wait for pending writes (tests). */
	async flush(): Promise<void> {
		await this.saving;
	}
}

/**
 * The agent's last message in a transcript since a time: the text of the
 * newest assistant entry that has text (Claude Code JSONL or Codex rollout).
 * Subagent (sidechain), meta and API-error entries are not the agent's words.
 *
 * @param text - Whole JSONL lines (a tail of the file is fine)
 * @param kind - Transcript format
 * @param sinceMs - Ignore entries older than this (epoch ms)
 * @returns The text, or null when there is none
 */
export function lastWordsFromTranscript(text: string, kind: 'claude' | 'codex', sinceMs: number): string | null {
	let last: string | null = null;
	for (const line of text.split('\n')) {
		if (line.length < 20) continue;
		if (kind === 'claude' && !(line.includes('"type":"assistant"') && line.includes('"type":"text"'))) continue;
		if (kind === 'codex' && !line.includes('"agent_message"') && !line.includes('"output_text"')) continue;
		let entry: Record<string, unknown>;
		try {
			entry = JSON.parse(line) as Record<string, unknown>;
		} catch {
			continue;
		}
		const at = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
		if (!Number.isFinite(at) || at < sinceMs) continue;
		let found: string | null = null;
		if (kind === 'claude') {
			if (entry.type !== 'assistant' || entry.isSidechain === true || entry.isMeta === true || entry.isApiErrorMessage === true) continue;
			const content = (entry.message as { content?: unknown } | undefined)?.content;
			if (!Array.isArray(content)) continue;
			const parts = content
				.filter((b): b is { type: string; text: string } => !!b && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string')
				.map((b) => b.text.trim())
				.filter(Boolean);
			if (parts.length > 0) found = parts.join('\n');
		} else {
			const p = entry.payload as Record<string, unknown> | undefined;
			if (!p) continue;
			if (entry.type === 'event_msg' && p.type === 'agent_message' && typeof p.message === 'string') found = p.message.trim();
			else if (entry.type === 'response_item' && p.type === 'message' && p.role === 'assistant' && Array.isArray(p.content)) {
				const parts = (p.content as Array<{ type?: string; text?: unknown }>)
					.filter((b) => b?.type === 'output_text' && typeof b.text === 'string')
					.map((b) => (b.text as string).trim())
					.filter(Boolean);
				if (parts.length > 0) found = parts.join('\n');
			}
		}
		if (found) last = found;
	}
	return last;
}

/**
 * Keep the end of a long text: the conclusion is at the end.
 *
 * @param text - Last words
 * @returns At most {@link AGENT_ASK_CONSTANTS.RESULT_CHARS} characters
 */
function clipResult(text: string): string {
	const t = text.trim();
	return t.length <= C.RESULT_CHARS ? t : `…${t.slice(-(C.RESULT_CHARS - 1))}`;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: AgentAskLedger | null = null;

/** @returns The wired ledger, or null before boot (and when switched off) */
export function getAgentAskLedger(): AgentAskLedger | null {
	return instance;
}

/** @param ledger - The ledger to expose (null clears) */
export function setAgentAskLedger(ledger: AgentAskLedger | null): void {
	instance = ledger;
}

/**
 * Whether the ledger is switched on.
 *
 * @param env - Environment
 * @returns False when `CREWLY_AGENT_ASK_RETURN=off`
 */
export function agentAskReturnEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
	return (env[C.ENV_SWITCH] ?? '').toLowerCase() !== 'off';
}
