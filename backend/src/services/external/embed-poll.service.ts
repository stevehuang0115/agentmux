/**
 * Brings embedded-panel messages from Crewly Cloud to the front agent
 * (specs/2026-10-15-embedded-agent.md, "OSS (crewly)").
 *
 * One long-poll loop per embed in `embeds.json`. For each pending asker
 * message it records the conversation, marks the front agent as acting for
 * the asker (a guest), turns the panel's "typing…" on, delivers the
 * `[EXTERNAL MESSAGE]` wrapper, and acks. A message that could not be
 * delivered is not acked, so Cloud hands it over again on the next poll.
 *
 * @module services/external/embed-poll.service
 */

import { EXTERNAL_CONSTANTS } from '../../constants.js';
import type { ExternalAuditEntry } from './external-audit.js';
import { formatExternalMessage, parsePendingMessage, type PendingExternalMessage } from './external-message.js';
import { externalPersonId, type ExternalStore } from './external-store.js';

const C = EXTERNAL_CONSTANTS;
/** Message ids remembered after delivery, so a failed ack never delivers twice. */
const MAX_REMEMBERED = 2000;
/** Wrapper label when the embed has none. */
const DEFAULT_LABEL = 'the portal';

/** The part of the Apps Cloud client the poller uses. */
export interface EmbedCloud {
	isAvailable(): boolean;
	request<T>(method: string, path: string, opts?: { body?: unknown; query?: Record<string, string | number | undefined>; timeoutMs?: number }): Promise<T>;
}

/** Dependencies of {@link EmbedPollService}. */
export interface EmbedPollDeps {
	store: ExternalStore;
	cloud: EmbedCloud;
	/** Agent skills root, for the commands in the wrapper */
	skillsPath: () => string;
	/** Deliver text to an agent session, starting it when needed; true when delivered */
	sendToAgent(session: string, text: string): Promise<boolean>;
	/** Record who the session now acts for */
	recordActingFor(session: string, personId: string): void;
	audit(entry: ExternalAuditEntry): void;
	/** Wait (tests pass a fake) */
	sleep?: (ms: number) => Promise<void>;
	warn?: (msg: string, meta?: Record<string, unknown>) => void;
}

/**
 * Long-polls Cloud for every attached embed.
 */
export class EmbedPollService {
	private readonly loops = new Map<string, Promise<void>>();
	private readonly delivered = new Set<string>();
	private running = false;
	private readonly sleep: (ms: number) => Promise<void>;

	/**
	 * @param deps - Store, Cloud, delivery, acting-for, audit
	 */
	constructor(private readonly deps: EmbedPollDeps) {
		this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms).unref?.()));
	}

	/**
	 * Start a loop for each attached embed (and for embeds attached later, via {@link refresh}).
	 */
	start(): void {
		this.running = true;
		this.refresh();
	}

	/** Stop every loop after its current poll. */
	stop(): void {
		this.running = false;
	}

	/**
	 * Start loops for embeds that have none. Loops of removed embeds end by themselves.
	 */
	refresh(): void {
		if (!this.running) return;
		for (const { embedId } of this.deps.store.listEmbeds()) {
			if (this.loops.has(embedId)) continue;
			const loop = this.run(embedId).finally(() => this.loops.delete(embedId));
			this.loops.set(embedId, loop);
		}
	}

	/** @returns Embed ids with a running loop */
	activeEmbeds(): string[] {
		return [...this.loops.keys()];
	}

	/**
	 * One embed's loop: poll, handle, back off on errors.
	 *
	 * @param embedId - Embed id
	 */
	private async run(embedId: string): Promise<void> {
		let backoff = 0;
		while (this.running && this.deps.store.getEmbed(embedId)) {
			if (!this.deps.cloud.isAvailable()) {
				await this.sleep(C.POLL_BACKOFF_MAX_MS);
				continue;
			}
			try {
				await this.pollOnce(embedId);
				backoff = 0;
			} catch (err) {
				backoff = Math.min(backoff ? backoff * 2 : C.POLL_BACKOFF_MS, C.POLL_BACKOFF_MAX_MS);
				this.deps.warn?.('Embed poll failed', { embedId, error: err instanceof Error ? err.message : String(err), retryInMs: backoff });
				await this.sleep(backoff);
			}
		}
	}

	/**
	 * One long poll and the delivery of what it returned.
	 *
	 * @param embedId - Embed id
	 * @returns Number of messages delivered
	 * @throws When the poll itself fails
	 */
	async pollOnce(embedId: string): Promise<number> {
		const data = await this.deps.cloud.request<{ items?: unknown[] }>('GET', `/embeds/${encodeURIComponent(embedId)}/pending`, {
			query: { wait: C.POLL_WAIT_S },
			timeoutMs: C.POLL_TIMEOUT_MS,
		});
		const items = (data?.items ?? []).map(parsePendingMessage).filter((m): m is PendingExternalMessage => !!m);
		const toAck: string[] = [];
		let deliveredCount = 0;
		let failed = false;
		for (const m of items) {
			if (this.delivered.has(m.messageId)) {
				toAck.push(m.messageId);
				continue;
			}
			// Later messages of a conversation wait for an earlier one that failed, to keep order.
			if (failed) break;
			const ok = await this.deliver(embedId, m);
			if (!ok) {
				failed = true;
				continue;
			}
			this.remember(m.messageId);
			toAck.push(m.messageId);
			deliveredCount++;
		}
		if (toAck.length) {
			await this.deps.cloud.request('POST', `/embeds/${encodeURIComponent(embedId)}/ack`, { body: { messageIds: toAck } });
		}
		if (failed) await this.sleep(C.POLL_BACKOFF_MS);
		return deliveredCount;
	}

	/**
	 * Hand one message to the embed's front agent.
	 *
	 * @param embedId - Embed id
	 * @param m - Pending message
	 * @returns True when the agent got it (or it can never be delivered and was dropped)
	 */
	private async deliver(embedId: string, m: PendingExternalMessage): Promise<boolean> {
		const embed = this.deps.store.getEmbed(embedId);
		if (!embed) return false;
		if (!C.CONVERSATION_ID_PATTERN.test(m.conversationId)) {
			// Malformed at the source: acking drops it instead of retrying forever.
			this.deps.warn?.('Embed message with a bad conversation id dropped', { embedId, messageId: m.messageId });
			return true;
		}
		this.deps.store.noteConversation({
			conversationId: m.conversationId,
			embedId,
			sub: m.sub,
			askerName: m.asker.name,
			...(m.asker.email ? { askerEmail: m.asker.email } : {}),
			roles: m.asker.roles,
			profileId: m.profileId,
		});
		this.deps.recordActingFor(embed.frontAgent, externalPersonId(embedId, m.sub));
		await this.setTyping(embedId, m.conversationId, true);
		let ok = false;
		try {
			ok = await this.deps.sendToAgent(embed.frontAgent, formatExternalMessage(m, embed.label ?? DEFAULT_LABEL, this.deps.skillsPath()));
		} catch {
			ok = false;
		}
		this.deps.audit({
			event: ok ? 'delivered' : 'delivery_failed',
			embedId,
			conversationId: m.conversationId,
			agent: embed.frontAgent,
			messageId: m.messageId,
			chars: m.text.length,
		});
		if (!ok) await this.setTyping(embedId, m.conversationId, false);
		return ok;
	}

	/**
	 * Turn the panel's "typing…" on or off (best effort).
	 *
	 * @param embedId - Embed id
	 * @param conversationId - Conversation
	 * @param on - State
	 */
	async setTyping(embedId: string, conversationId: string, on: boolean): Promise<void> {
		try {
			await this.deps.cloud.request('POST', `/embeds/${encodeURIComponent(embedId)}/typing`, { body: { conversationId, on } });
		} catch {
			// cosmetic
		}
	}

	/**
	 * @param messageId - Delivered message
	 */
	private remember(messageId: string): void {
		this.delivered.add(messageId);
		if (this.delivered.size > MAX_REMEMBERED) {
			const oldest = this.delivered.values().next().value;
			if (oldest !== undefined) this.delivered.delete(oldest);
		}
	}
}
