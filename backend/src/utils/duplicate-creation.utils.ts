/**
 * Creation-time duplicate checks: the same creator making the same thing
 * (ticket, WorkItem, message) again within a short window gets the existing
 * one instead of a second copy.
 *
 * @module utils/duplicate-creation
 */

import { DUPLICATE_CREATION_CONSTANTS as D } from '../constants.js';
import { TERMINAL_WORK_ITEM_STATUSES, type WorkItem } from '../types/v2/work-item.types.js';

/**
 * Title / text key: lower-cased, punctuation and whitespace collapsed.
 *
 * @param text - Title or message
 * @returns Comparison key
 */
export function normalizeForDedupe(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim();
}

/** Why a WorkItem may be returned instead of creating another. */
export interface WorkItemDuplicateQuery {
  /** Who creates it (agent session; undefined = owner / unknown, never deduped) */
  creator: string | undefined;
  /** Target session */
  target: string | undefined;
  /** New title */
  title: string;
  /** Clock (epoch ms) */
  now: number;
}

/**
 * An open WorkItem the same creator already made for the same target with the
 * same title inside {@link D.WORK_ITEM_WINDOW_MS}.
 *
 * @param query - The would-be new item
 * @param items - Pool items
 * @returns The existing item, or null
 */
export function findDuplicateWorkItem(query: WorkItemDuplicateQuery, items: readonly WorkItem[]): WorkItem | null {
  if (!query.creator) return null;
  const key = normalizeForDedupe(query.title);
  if (!key) return null;
  return (
    items.find((wi) => {
      if (TERMINAL_WORK_ITEM_STATUSES.has(wi.status)) return false;
      if ((wi.target ?? '') !== (query.target ?? '')) return false;
      if (normalizeForDedupe(wi.title ?? '') !== key) return false;
      const meta = (wi.metadata ?? {}) as Record<string, unknown>;
      const madeBy = typeof meta['delegatedBy'] === 'string' ? (meta['delegatedBy'] as string) : wi.owner;
      if (madeBy !== query.creator) return false;
      const age = query.now - Date.parse(wi.createdAt);
      return Number.isFinite(age) && age >= 0 && age <= D.WORK_ITEM_WINDOW_MS;
    }) ?? null
  );
}

/**
 * The harness's own "Follow through" WorkItem for the same target and title,
 * whatever its status, inside {@link D.FOLLOW_THROUGH_WINDOW_MS}: a promise is
 * parked once, not after every stop or restart.
 *
 * @param items - Pool items
 * @param target - Agent session
 * @param title - Title of the would-be item
 * @param harnessCreated - The harness origin tag (`stated-intent`, `owner-promise`)
 * @param now - Clock (epoch ms)
 * @returns The existing item, or null
 */
export function findExistingFollowThrough(items: readonly WorkItem[], target: string, title: string, harnessCreated: string, now: number): WorkItem | null {
  const key = normalizeForDedupe(title);
  return (
    items.find((wi) => {
      const meta = (wi.metadata ?? {}) as Record<string, unknown>;
      if (meta['harnessCreated'] !== harnessCreated || wi.target !== target) return false;
      if (normalizeForDedupe(wi.title ?? '') !== key) return false;
      const age = now - Date.parse(wi.createdAt);
      return Number.isFinite(age) && age <= D.FOLLOW_THROUGH_WINDOW_MS;
    }) ?? null
  );
}

/** Recent agent messages: fingerprint -> when it was sent (epoch ms). */
const recentMessages = new Map<string, number>();

/** Forget every tracked message (tests). */
export function resetAgentMessageDedupeForTesting(): void {
  recentMessages.clear();
}

/**
 * Forget a recorded message, so a resend is not taken for a duplicate. Used
 * when the first send did not go through.
 *
 * @param sender - Sending agent session
 * @param target - Receiving session
 * @param text - Message text, as passed to {@link agentMessageRepeatOf}
 */
export function forgetAgentMessage(sender: string, target: string, text: string): void {
  recentMessages.delete(`${sender}\u0000${target}\u0000${normalizeForDedupe(text)}`);
}

/**
 * Whether an agent already sent this exact message to this target inside the
 * window. Records it otherwise. Short messages and exempt senders never match.
 *
 * @param sender - Sending agent session
 * @param target - Receiving session
 * @param text - Message text (trace markers should be stripped by the caller)
 * @param now - Clock (epoch ms)
 * @returns Seconds since the identical earlier message, or null when it is new
 */
export function agentMessageRepeatOf(sender: string, target: string, text: string, now: number = Date.now()): number | null {
  if (!sender || D.AGENT_MESSAGE_EXEMPT_SENDERS.includes(sender)) return null;
  const key = normalizeForDedupe(text);
  if (key.length < D.AGENT_MESSAGE_MIN_CHARS) return null;
  const fingerprint = `${sender}\u0000${target}\u0000${key}`;
  const last = recentMessages.get(fingerprint);
  if (last !== undefined && now - last < D.AGENT_MESSAGE_WINDOW_MS) return Math.round((now - last) / 1000);
  recentMessages.set(fingerprint, now);
  if (recentMessages.size > D.AGENT_MESSAGE_MAX_TRACKED) {
    for (const [k, at] of recentMessages) {
      if (now - at >= D.AGENT_MESSAGE_WINDOW_MS) recentMessages.delete(k);
    }
  }
  return null;
}
