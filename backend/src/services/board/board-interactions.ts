/**
 * Who messaged whom (crewly#1247 canvas links): a small in-memory record of
 * agent-to-agent messages, kept for the last two hours. The board turns it into
 * `messaging` links. Contents are never kept, only sender, receiver and time.
 *
 * @module services/board/board-interactions
 */

import { BOARD_CONSTANTS } from '../../constants.js';

const C = BOARD_CONSTANTS;

/** One sender -> receiver pair as the board reads it. */
export interface InteractionPair {
	from: string;
	to: string;
	/** Messages in the window */
	count: number;
	firstAt: number;
	lastAt: number;
}

/** Records agent-to-agent messages. */
export class AgentInteractionRecorder {
	private readonly pairs = new Map<string, { from: string; to: string; times: number[] }>();
	private readonly listeners = new Set<(from: string, to: string) => void>();

	/**
	 * Note a message.
	 *
	 * @param from - Sender session (`<session>@<instanceId>` when on another machine)
	 * @param to - Receiver session
	 * @param now - Clock (tests)
	 */
	record(from: string, to: string, now: number = Date.now()): void {
		if (!from || !to || from === to) return;
		const key = `${from}\u0000${to}`;
		let pair = this.pairs.get(key);
		if (!pair) {
			pair = { from, to, times: [] };
			this.pairs.set(key, pair);
		}
		pair.times.push(now);
		if (pair.times.length > C.LINK_MESSAGING_MAX_PER_PAIR) pair.times.splice(0, pair.times.length - C.LINK_MESSAGING_MAX_PER_PAIR);
		for (const l of this.listeners) {
			try {
				l(from, to);
			} catch {
				/* a listener never breaks the sender */
			}
		}
	}

	/**
	 * Be told about each message (the push marks the sender dirty).
	 *
	 * @param listener - Called with sender and receiver
	 * @returns Unsubscribe
	 */
	onRecord(listener: (from: string, to: string) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Pairs with a message in the window; older entries are forgotten.
	 *
	 * @param now - Clock
	 * @returns Pairs
	 */
	pairsNow(now: number = Date.now()): InteractionPair[] {
		const out: InteractionPair[] = [];
		const cutoff = now - C.LINK_MESSAGING_WINDOW_MS;
		for (const [key, pair] of this.pairs) {
			const first = pair.times.findIndex((t) => t >= cutoff);
			if (first < 0) {
				this.pairs.delete(key);
				continue;
			}
			if (first > 0) pair.times.splice(0, first);
			out.push({ from: pair.from, to: pair.to, count: pair.times.length, firstAt: pair.times[0], lastAt: pair.times[pair.times.length - 1] });
		}
		return out;
	}

	/** Forget everything (tests). */
	clear(): void {
		this.pairs.clear();
	}
}

let instance: AgentInteractionRecorder | null = null;

/**
 * The process-wide recorder.
 *
 * @returns The recorder
 */
export function getAgentInteractions(): AgentInteractionRecorder {
	instance ??= new AgentInteractionRecorder();
	return instance;
}

/** Drop the process-wide recorder (tests). */
export function resetAgentInteractions(): void {
	instance = null;
}
