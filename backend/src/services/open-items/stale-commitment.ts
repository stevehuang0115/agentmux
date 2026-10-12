/**
 * Stale commitments: an old owner promise is re-checked before it is
 * resurfaced (incident 2026-10-12, TKT-334).
 *
 * @module services/open-items/stale-commitment
 */

import { OPEN_ITEMS_CONSTANTS } from '../../constants.js';
import type { Request } from '../../types/v2/request.types.js';
import type { RequestOpenItem } from '../../types/v2/open-item.types.js';

/**
 * Whether a commitment is old enough that it must be re-checked before it is
 * resurfaced (incident 2026-10-12, TKT-334: a five-day-old "save the draft in
 * info@ once Zoho is connected" was acted on after the owner had sent the
 * email himself).
 *
 * @param item - Commitment
 * @param now - Clock
 * @returns True when older than {@link OPEN_ITEMS_CONSTANTS.STALE_VERIFY_AFTER_MS}
 */
export function isStaleCommitment(item: Pick<RequestOpenItem, 'createdAt'>, now: Date): boolean {
  const made = Date.parse(item.createdAt);
  return Number.isFinite(made) && now.getTime() - made >= OPEN_ITEMS_CONSTANTS.STALE_VERIFY_AFTER_MS;
}

/**
 * Why an old commitment no longer needs doing, judged only from what Crewly
 * already knows: its ticket is done / cancelled, or someone other than the
 * promising agent (the owner) posted in the ticket's thread after the promise.
 * Young commitments are never judged here.
 *
 * @param request - Its request
 * @param item - Commitment
 * @param now - Clock
 * @returns The reason (for `closedReason`), or null when it may still be needed
 */
export function supersededReason(request: Pick<Request, 'status' | 'discussion'>, item: RequestOpenItem, now: Date): string | null {
  if (item.type !== 'commitment' || !isStaleCommitment(item, now)) return null;
  if (request.status === 'done' || request.status === 'cancelled') return `superseded: the ticket is ${request.status}`;
  const made = Date.parse(item.createdAt);
  const reply = (request.discussion ?? []).find((d) => d.author !== item.agent && Date.parse(d.at) > made);
  return reply ? `superseded: the owner posted in the thread on ${reply.at.slice(0, 10)} after the promise` : null;
}

/**
 * The line added to every prompt that resurfaces an old commitment.
 *
 * @param item - Commitment
 * @param now - Clock
 * @returns The notice, or '' when the commitment is not old
 */
export function staleCommitmentNotice(item: Pick<RequestOpenItem, 'createdAt'>, now: Date): string {
  if (!isStaleCommitment(item, now)) return '';
  return (
    `\nThis is from ${item.createdAt.slice(0, 10)}. Before contacting the owner, verify it is still needed: check the thread since then, ` +
    `the ticket status, and for email work the Sent folder and existing drafts (you have read access). ` +
    `If it was already done, close it without messaging the owner.`
  );
}
