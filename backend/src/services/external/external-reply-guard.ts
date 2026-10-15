/**
 * Deterministic checks on a reply before it leaves for an external asker
 * (specs/2026-10-15-embedded-agent.md, "reply-external + guard").
 *
 * The guard never rewrites a reply. It blocks it and says why, and the front
 * agent writes it again. That keeps the agent the author of every word the
 * asker sees, and the owner can read in the audit what was stopped.
 *
 * @module services/external/external-reply-guard
 */

import { EXTERNAL_CONSTANTS } from '../../constants.js';
import { redactSecretsWithCount } from '../../utils/secret-redactor.js';
import { collectSecretEnvValues } from '../../utils/secret-env.js';
import { hasToolCallMarkup } from '../../utils/tool-call-markup.utils.js';

/** Why a reply was blocked (stable codes, safe to show the agent). */
export type ExternalReplyBlockReason =
	| 'empty'
	| 'too_long'
	| 'secret'
	| 'tool_markup'
	| 'internal_path'
	| 'local_address'
	| 'internal_id'
	| 'other_asker';

/** What the guard knows about the reply's context. */
export interface ExternalReplyContext {
	/** Names, emails and ids of the embed's other askers */
	otherAskers: readonly string[];
	/** Agent session names of this instance (they are internal) */
	internalSessions: readonly string[];
	/** Env maps whose secret values must never appear (default process.env) */
	envs?: ReadonlyArray<Record<string, string | undefined>>;
}

/** Guard verdict. */
export interface ExternalReplyVerdict {
	ok: boolean;
	reasons: ExternalReplyBlockReason[];
}

/** File-system paths that only exist inside the instance. */
const INTERNAL_PATH_RE = /(?:^|[\s"'`(=])(?:\/Users\/|\/home\/|\/root\/|\/opt\/|\/private\/|\/var\/|\/tmp\/|~\/|[A-Za-z]:\\)\S*/;
const CREWLY_DIR_RE = /\.crewly(?:\/|\\)/;
/** Loopback and private network addresses. */
const LOCAL_ADDRESS_RE = /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b|\[::1\]/i;
/** Ids of Crewly's own records (tickets, work items, chat conversations). */
const INTERNAL_ID_RE = /\b(?:TKT-\d+|CREW-\d+|WI-[A-Za-z0-9]{4,}|ext-[0-9a-f]{12}|crewly-orc)\b/;
/** Shortest mark worth matching: shorter ones collide with ordinary words. */
const MIN_MARK_LENGTH = 3;

/**
 * @param s - Raw text
 * @returns The text as a literal regex source
 */
function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether the text contains a mark as a whole word (case-insensitive).
 *
 * @param text - Reply
 * @param mark - Name, email or id
 * @returns True when present
 */
function containsWord(text: string, mark: string): boolean {
	const m = mark.trim();
	if (m.length < MIN_MARK_LENGTH) return false;
	return new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRe(m)}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(text);
}

/**
 * Check a reply meant for an external asker.
 *
 * @param text - The reply
 * @param ctx - Other askers, internal sessions, env with secrets
 * @returns ok, or the reasons it is blocked
 *
 * @example
 * ```ts
 * checkExternalReply('See /Users/steve/x', { otherAskers: [], internalSessions: [] });
 * // → { ok: false, reasons: ['internal_path'] }
 * ```
 */
export function checkExternalReply(text: string, ctx: ExternalReplyContext): ExternalReplyVerdict {
	const reasons = new Set<ExternalReplyBlockReason>();
	const body = (text ?? '').trim();
	if (!body) return { ok: false, reasons: ['empty'] };
	if (body.length > EXTERNAL_CONSTANTS.MAX_REPLY_CHARS) reasons.add('too_long');

	const secrets = collectSecretEnvValues(...(ctx.envs ?? [process.env]));
	if (redactSecretsWithCount(body, secrets).count > 0) reasons.add('secret');
	if (hasToolCallMarkup(body)) reasons.add('tool_markup');
	if (INTERNAL_PATH_RE.test(body) || CREWLY_DIR_RE.test(body)) reasons.add('internal_path');
	if (LOCAL_ADDRESS_RE.test(body)) reasons.add('local_address');
	if (INTERNAL_ID_RE.test(body) || ctx.internalSessions.some((s) => s.length >= MIN_MARK_LENGTH && body.includes(s))) {
		reasons.add('internal_id');
	}
	if (ctx.otherAskers.some((m) => containsWord(body, m))) reasons.add('other_asker');

	return { ok: reasons.size === 0, reasons: [...reasons] };
}

/** What each reason tells the front agent, so it can write the reply again. */
export const EXTERNAL_REPLY_REASON_HINTS: Readonly<Record<ExternalReplyBlockReason, string>> = {
	empty: 'The reply is empty.',
	too_long: `The reply is longer than ${EXTERNAL_CONSTANTS.MAX_REPLY_CHARS} characters. Shorten it.`,
	secret: 'The reply contains a credential or token. Remove it.',
	tool_markup: 'The reply contains tool-call markup. Send only the words meant for the person.',
	internal_path: 'The reply contains a file path on this machine. Describe the thing instead.',
	local_address: 'The reply contains a local or private network address.',
	internal_id: 'The reply names an internal record or agent session (ticket, work item, session name). Leave it out.',
	other_asker: 'The reply mentions another person who uses this panel. Each person only hears about their own things.',
};
