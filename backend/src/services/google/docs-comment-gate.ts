/**
 * Google Docs Comment Gate
 *
 * Holds an agent's outgoing Google Doc comments (add / reply / resolve) until
 * the owner says to post them.
 *
 * ## Why
 *
 * A comment or reply on a shared Google Doc is visible to every collaborator
 * under the owner's name, and cannot be quietly taken back. That makes it an
 * outbound action like `gmail-send`, not like `docs-write`. So an agent does
 * not post one by asking to; it queues it, and the owner authorizes it.
 *
 * ## How the owner authorizes (owner-away friendly)
 *
 * The same mechanism WhatsApp drafts use (`whatsapp-draft-gate`): a genuine
 * owner chat message — which an agent cannot write — saying 「发 C3」 /
 * "send C3". Slack DMs, threads and team channels all land in owner chat, so
 * one reply from a phone is enough.
 *
 * Authorization is per BATCH, not per comment. Everything an agent queues
 * lands in one open batch with one code, so an agent reviewing a doc can queue
 * 38 comments, ask once ("post these 38 comments? reply 「发 C3」"), and a
 * single owner OK releases all of them.
 *
 * The owner message must POST-DATE the last change to the batch. Adding or
 * changing a comment after the owner said OK moves the batch past that
 * message, so the OK never covers comments the owner has not been shown.
 * Bounding the batch's age bounds the confirmation to the same window.
 *
 * The gate keeps no judgment about wording; the owner sees the comments
 * (through the agent, or `GET /api/google/doc-comment-batches`) before
 * answering.
 *
 * @module services/google/docs-comment-gate
 */

import { LoggerService } from '../core/logger.service.js';

const logger = LoggerService.getInstance().createComponentLogger('DocsCommentGate');

/** How long after a batch's last change the owner's OK still counts (ms). */
export const DOC_COMMENT_CONFIRM_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Owner messages scanned for a confirmation. */
export const DOC_COMMENT_CONFIRM_SCAN_LIMIT = 200;

/**
 * Owner confirmation: 「发 C3」 / 「发送 C3」 / "send #C3" / 「确认发送 C3」.
 * Group 2 is the batch code. The `C` is required so it never collides with
 * WhatsApp's `W<n>` codes.
 */
export const DOC_COMMENT_CONFIRM_PATTERN = /^(发|发送|send|确认发送?)\s*#?(C\d+)\s*$/i;

/** One comment action waiting on the owner. */
export interface HeldDocComment {
	/** What to do */
	action: 'add' | 'reply' | 'resolve';
	/** Document id */
	docId: string;
	/** Comment id (reply / resolve) */
	commentId?: string;
	/** Comment or reply text (optional for resolve) */
	text?: string;
	/** Quoted document text (add only) */
	quote?: string;
	/** Google account to act as; undefined = the default one */
	account?: string;
}

/** Everything one agent has queued for the owner, under one code. */
export interface DocCommentBatch {
	/** Code the owner answers with, e.g. `C3` */
	code: string;
	/** Numeric part of the code */
	seq: number;
	/** Agent that queued the comments */
	agentSession: string;
	/** Queued actions, in order */
	items: HeldDocComment[];
	/** What the agent says authorizes them, captured at each attempt */
	claims: string[];
	/** When the batch was opened (epoch ms) */
	createdAt: number;
	/** When it last changed (epoch ms); the owner's OK must be after this */
	updatedAt: number;
	/** True while it is being posted (guards against a concurrent second send) */
	sending?: boolean;
}

/** Why an agent's send was refused. */
export type BatchSendRefusal = 'no_confirmation' | 'window_expired';

/** Outcome of {@link decideBatchSend}. */
export type BatchSendDecision =
	| { allowed: true; via: 'owner' | 'owner_confirmation'; confirmation?: string }
	| { allowed: false; reason: BatchSendRefusal };

/** Open batches by code. */
const batches = new Map<string, DocCommentBatch>();
let nextSeq = 1;

/**
 * Queue one comment action in the agent's open batch (opening one if needed).
 *
 * @param agentSession - The agent that wants to post
 * @param item - The action
 * @param claim - What the agent cites as authorization, if anything
 * @param now - Epoch ms (tests)
 * @returns The batch, now including the item
 */
export function holdDocComment(agentSession: string, item: HeldDocComment, claim?: string, now = Date.now()): DocCommentBatch {
	let batch = [...batches.values()].find((b) => b.agentSession === agentSession && !b.sending);
	if (!batch) {
		const seq = nextSeq++;
		batch = { code: `C${seq}`, seq, agentSession, items: [], claims: [], createdAt: now, updatedAt: now };
		batches.set(batch.code, batch);
	}
	batch.items.push(item);
	if (claim && !batch.claims.includes(claim)) batch.claims.push(claim);
	// Any change moves the batch past an earlier owner OK.
	batch.updatedAt = now;
	logger.info('Doc comment held for the owner', { code: batch.code, agentSession, action: item.action, docId: item.docId, queued: batch.items.length });
	return batch;
}

/**
 * Parse a batch code.
 *
 * @param raw - `C3`, `c3`, `#C3`
 * @returns The canonical code, or null
 */
export function parseBatchCode(raw: string): string | null {
	const m = /^#?C(\d+)$/i.exec(raw.trim());
	return m ? `C${Number.parseInt(m[1], 10)}` : null;
}

/**
 * One batch.
 *
 * @param ref - Batch code
 * @returns The batch, or undefined
 */
export function getDocCommentBatch(ref: string): DocCommentBatch | undefined {
	const code = parseBatchCode(ref);
	return code ? batches.get(code) : undefined;
}

/**
 * All open batches, oldest first.
 *
 * @returns The batches
 */
export function listDocCommentBatches(): DocCommentBatch[] {
	return [...batches.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Drop a batch.
 *
 * @param code - Batch code
 * @returns True when there was one
 */
export function clearDocCommentBatch(code: string): boolean {
	return batches.delete(code);
}

/**
 * Whether one owner message confirms posting a given batch.
 *
 * @param text - Owner message text
 * @param batch - The batch
 * @returns True for 「发 C3」-style messages naming this batch
 */
export function isBatchConfirmation(text: string, batch: Pick<DocCommentBatch, 'code'>): boolean {
	const m = DOC_COMMENT_CONFIRM_PATTERN.exec(text.trim());
	return !!m && parseBatchCode(m[2]) === batch.code;
}

/**
 * Decide whether the caller may post this batch now.
 *
 * @param ctx - Batch, caller (undefined = owner credential), owner-message source, clock
 * @returns Allowed (and why), or refused (and why)
 */
export function decideBatchSend(ctx: {
	batch: DocCommentBatch;
	agentSession: string | undefined;
	ownerMessagesSince: (sinceMs: number) => string[];
	now: number;
}): BatchSendDecision {
	if (!ctx.agentSession) return { allowed: true, via: 'owner' };
	if (ctx.now - ctx.batch.updatedAt > DOC_COMMENT_CONFIRM_WINDOW_MS) return { allowed: false, reason: 'window_expired' };
	// `>=` in the source query; the strict check keeps an OK given in the same
	// millisecond as the last change from counting.
	const confirmation = ctx.ownerMessagesSince(ctx.batch.updatedAt + 1).find((t) => isBatchConfirmation(t, ctx.batch));
	return confirmation !== undefined
		? { allowed: true, via: 'owner_confirmation', confirmation }
		: { allowed: false, reason: 'no_confirmation' };
}

/**
 * Text returned to the agent when it queues a comment: what to ask the owner.
 *
 * @param batch - The batch the comment went into
 * @returns Instruction text
 */
export function buildHoldMessage(batch: Pick<DocCommentBatch, 'code' | 'items'>): string {
	const n = batch.items.length;
	return (
		`Queued as ${batch.code} (${n} comment action${n === 1 ? '' : 's'}). NOT posted: comments on a shared Google Doc are visible ` +
		`to its collaborators under the owner's name. Keep queueing the rest, then ask the owner ONCE for the whole batch — show what ` +
		`will be posted (doc, each comment, a short summary if long) and ask them to reply 「发 ${batch.code}」 to post all ${n === 1 ? 'of it' : 'of them'}. ` +
		`Queue nothing more after asking (a later addition needs a fresh OK). When the owner's 「发 ${batch.code}」 arrives, run the same skill with ` +
		`\`send --batch ${batch.code}\`. Do not post any other way.`
	);
}

/**
 * Message for a refused agent send.
 *
 * @param code - Batch code
 * @param reason - Refusal reason
 * @returns Message for the 403 body
 */
export function buildBatchRefusalMessage(code: string, reason: BatchSendRefusal): string {
	if (reason === 'window_expired') {
		const hours = Math.round(DOC_COMMENT_CONFIRM_WINDOW_MS / (60 * 60 * 1000));
		return `Batch ${code} last changed more than ${hours} hours ago, so the owner's earlier OK no longer counts. Ask the owner again to reply 「发 ${code}」.`;
	}
	return (
		`The owner has not confirmed batch ${code} since it last changed. Show the owner what will be posted and ask them to reply ` +
		`「发 ${code}」 (anything queued after their OK needs a fresh one). Only then run send again. Never post without it.`
	);
}

/** Drops all state (tests). */
export function resetDocCommentGate(): void {
	batches.clear();
	nextSeq = 1;
}
