/**
 * What agents and the owner do with external conversations
 * (specs/2026-10-15-embedded-agent.md): reply to an asker through the guard,
 * call the host's API as the asker, and attach embeds to a front agent.
 *
 * @module services/external/external.service
 */

import { EXTERNAL_CONSTANTS } from '../../constants.js';
import type { ExternalAuditEntry } from './external-audit.js';
import { checkExternalReply, EXTERNAL_REPLY_REASON_HINTS, type ExternalReplyBlockReason } from './external-reply-guard.js';
import type { ExternalConversation, ExternalEmbed, ExternalStore } from './external-store.js';
import type { EmbedCloud } from './embed-poll.service.js';

const C = EXTERNAL_CONSTANTS;
const HOST_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** HTTP method allowed on the host API. */
export type HostMethod = (typeof HOST_METHODS)[number];

/** A failure the controller maps to an HTTP status. */
export class ExternalError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'ExternalError';
	}
}

/** Who is calling: an agent session, or the owner. */
export type ExternalCaller = { kind: 'agent'; session: string } | { kind: 'owner' };

/** Result of a host API call, as handed to the agent. */
export interface HostCallResult {
	status: number;
	contentType: string;
	body: string;
	truncated: boolean;
}

/** Dependencies of {@link ExternalService}. */
export interface ExternalServiceDeps {
	store: ExternalStore;
	cloud: EmbedCloud;
	audit(entry: ExternalAuditEntry): void;
	/** Turn the panel's "typing…" off after a reply */
	setTyping(embedId: string, conversationId: string, on: boolean): Promise<void>;
	/** Start polling embeds attached since the last call */
	refreshPolling(): void;
	/** Agent session names of this instance (internal, never in a reply) */
	internalSessions(): Promise<string[]>;
	fetchImpl?: typeof fetch;
}

/**
 * External conversations: replies, host calls, embed attachment.
 */
export class ExternalService {
	private readonly fetchImpl: typeof fetch;

	/**
	 * @param deps - Store, Cloud, audit, typing, polling, sessions
	 */
	constructor(private readonly deps: ExternalServiceDeps) {
		this.fetchImpl = deps.fetchImpl ?? fetch;
	}

	/**
	 * Send a reply to one asker, after the guard.
	 *
	 * @param caller - The agent (must be the embed's front agent) or the owner
	 * @param conversationId - `ext-…`
	 * @param text - The reply
	 * @returns `{ sent: true }`
	 * @throws ExternalError 404 unknown conversation, 403 not the front agent, 422 reply_blocked (details.reasons/hints)
	 */
	async reply(caller: ExternalCaller, conversationId: string, text: string): Promise<{ sent: true }> {
		const { conv, embed } = this.authorize(caller, conversationId);
		const body = (text ?? '').trim();
		const verdict = checkExternalReply(body, {
			otherAskers: this.deps.store.otherAskerMarks(conv.embedId, conv.conversationId),
			internalSessions: await this.deps.internalSessions().catch(() => [embed.frontAgent]),
		});
		const agent = caller.kind === 'agent' ? caller.session : undefined;
		if (!verdict.ok) {
			this.deps.audit({ event: 'reply_blocked', embedId: conv.embedId, conversationId, ...(agent ? { agent } : {}), chars: body.length, reasons: verdict.reasons });
			throw new ExternalError(422, 'reply_blocked', `Not sent: ${verdict.reasons.map((r: ExternalReplyBlockReason) => EXTERNAL_REPLY_REASON_HINTS[r]).join(' ')} Write it again.`, {
				reasons: verdict.reasons,
			});
		}
		await this.deps.cloud.request('POST', `/embeds/${encodeURIComponent(conv.embedId)}/replies`, { body: { conversationId, text: body } });
		await this.deps.setTyping(conv.embedId, conversationId, false);
		this.deps.audit({ event: 'replied', embedId: conv.embedId, conversationId, ...(agent ? { agent } : {}), chars: body.length });
		return { sent: true };
	}

	/**
	 * Call the host's API as the conversation's asker.
	 *
	 * Cloud mints a 5-minute token bound to the asker (`scope: self`); the host
	 * answers with that person's own permissions. Redirects are not followed,
	 * so the token never goes to another origin.
	 *
	 * @param caller - The front agent or the owner
	 * @param conversationId - `ext-…`
	 * @param method - HTTP method
	 * @param hostPath - Path under the host API base (`/my-classes?from=…`)
	 * @param body - JSON body for POST/PUT/PATCH
	 * @returns Status, content type and (capped) body text
	 * @throws ExternalError 400 bad method/path/body, 403, 404, 502 host unreachable
	 */
	async hostCall(caller: ExternalCaller, conversationId: string, method: string, hostPath: string, body?: unknown): Promise<HostCallResult> {
		const { conv } = this.authorize(caller, conversationId);
		const m = (method ?? '').toUpperCase() as HostMethod;
		if (!HOST_METHODS.includes(m)) throw new ExternalError(400, 'bad_method', `Method must be one of ${HOST_METHODS.join(', ')}.`);
		if (typeof hostPath !== 'string' || !hostPath.startsWith('/') || hostPath.startsWith('//') || /(?:^|\/)\.\.(?:\/|$|\?)|[\s\\]/.test(hostPath)) {
			throw new ExternalError(400, 'bad_path', 'Path must start with "/" and stay under the host API (no "..", spaces or backslashes).');
		}
		let payload: string | undefined;
		if (body !== undefined && m !== 'GET' && m !== 'DELETE') {
			payload = JSON.stringify(body);
			if (Buffer.byteLength(payload) > C.MAX_HOST_BODY_BYTES) throw new ExternalError(400, 'body_too_large', `Body is over ${C.MAX_HOST_BODY_BYTES} bytes.`);
		}
		const { token, hostApiBase } = await this.deps.cloud.request<{ token: string; hostApiBase: string }>(
			'POST',
			`/embeds/${encodeURIComponent(conv.embedId)}/host-token`,
			{ body: { conversationId } },
		);
		const url = joinHostUrl(hostApiBase, hostPath);
		let res: Response;
		try {
			res = await this.fetchImpl(url, {
				method: m,
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}) },
				...(payload !== undefined ? { body: payload } : {}),
				redirect: 'manual',
				signal: AbortSignal.timeout(C.HOST_TIMEOUT_MS),
			});
		} catch (err) {
			this.deps.audit({ event: 'host_call', embedId: conv.embedId, conversationId, method: m, path: hostPath.split('?')[0], status: 0 });
			throw new ExternalError(502, 'host_unreachable', `The host API did not answer: ${err instanceof Error ? err.message : String(err)}`);
		}
		const { text, truncated } = await readCapped(res, C.MAX_HOST_RESPONSE_BYTES);
		this.deps.audit({ event: 'host_call', embedId: conv.embedId, conversationId, method: m, path: hostPath.split('?')[0], status: res.status });
		return { status: res.status, contentType: res.headers.get('content-type') ?? '', body: text, truncated };
	}

	/** @returns Attached embeds */
	listEmbeds(): ExternalEmbed[] {
		return this.deps.store.listEmbeds();
	}

	/**
	 * Attach (or re-point) an embed to a front agent and start polling it.
	 *
	 * @param embed - Embed id, agent, optional label
	 * @returns The stored embed
	 * @throws ExternalError 400 when invalid
	 */
	attachEmbed(embed: ExternalEmbed): ExternalEmbed {
		try {
			this.deps.store.setEmbed(embed);
		} catch (err) {
			throw new ExternalError(400, 'bad_embed', err instanceof Error ? err.message : String(err));
		}
		this.deps.refreshPolling();
		return this.deps.store.getEmbed(embed.embedId) as ExternalEmbed;
	}

	/**
	 * Detach an embed: its loop ends after the current poll.
	 *
	 * @param embedId - Embed id
	 * @throws ExternalError 404 when not attached
	 */
	detachEmbed(embedId: string): void {
		if (!this.deps.store.removeEmbed(embedId)) throw new ExternalError(404, 'not_found', 'That embed is not attached here.');
	}

	/**
	 * The conversation and embed a caller may act in.
	 *
	 * @param caller - Agent or owner
	 * @param conversationId - `ext-…`
	 * @returns Conversation and embed
	 * @throws ExternalError 404 / 403
	 */
	private authorize(caller: ExternalCaller, conversationId: string): { conv: ExternalConversation; embed: ExternalEmbed } {
		const conv = C.CONVERSATION_ID_PATTERN.test(conversationId ?? '') ? this.deps.store.getConversation(conversationId) : null;
		const embed = conv ? this.deps.store.getEmbed(conv.embedId) : null;
		if (!conv || !embed) throw new ExternalError(404, 'unknown_conversation', 'No such external conversation on this machine.');
		if (caller.kind === 'agent' && caller.session !== embed.frontAgent) {
			throw new ExternalError(403, 'not_front_agent', "Only the agent this portal talks to can act in its conversations. Ask that agent, or the owner, to answer.");
		}
		return { conv, embed };
	}
}

/**
 * Join the host API base and a path, refusing anything that leaves the base.
 *
 * @param base - `https://portal.example/api/crewly/ops`
 * @param hostPath - `/my-classes?from=…`
 * @returns The full URL
 * @throws ExternalError 502 when the base is not http(s), 400 when the path escapes it
 */
export function joinHostUrl(base: string, hostPath: string): string {
	let b: URL;
	try {
		b = new URL(base);
	} catch {
		throw new ExternalError(502, 'bad_host_base', 'The embed has no valid host API address. Set it in the Crewly dashboard.');
	}
	if (b.protocol !== 'https:' && b.protocol !== 'http:') throw new ExternalError(502, 'bad_host_base', 'The host API address must be http(s).');
	const prefix = b.pathname.replace(/\/+$/, '');
	const u = new URL(`${b.origin}${prefix}${hostPath}`);
	if (u.origin !== b.origin || !(u.pathname === prefix || u.pathname.startsWith(`${prefix}/`) || prefix === '')) {
		throw new ExternalError(400, 'bad_path', 'That path leaves the host API.');
	}
	return u.toString();
}

/**
 * Read a response body up to a byte cap.
 *
 * @param res - Response
 * @param max - Byte cap
 * @returns Text and whether it was cut
 */
async function readCapped(res: Response, max: number): Promise<{ text: string; truncated: boolean }> {
	if (!res.body) return { text: '', truncated: false };
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let truncated = false;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (size + value.byteLength > max) {
			chunks.push(value.subarray(0, max - size));
			truncated = true;
			await reader.cancel().catch(() => undefined);
			break;
		}
		chunks.push(value);
		size += value.byteLength;
	}
	return { text: Buffer.concat(chunks).toString('utf-8'), truncated };
}
