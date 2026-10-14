/**
 * Where an orchestrator chat post lands — conversation AND thread.
 *
 * Audit 2026-10-07..14: 13 of ~25 misplaced Slack posts were the orchestrator
 * ("[Owen, relayed by the orc] ..."). `/api/chat/agent-response` carried no
 * thread for the orchestrator at all (a post always landed top-level in the
 * room), and a post with no conversation named defaulted to the LAST owner
 * turn however old it was — so a relay of Owen's result, sent hours later,
 * landed in whichever channel the owner had last written to (#flopost,
 * #think-tank, #air-steamfun, #book-publish).
 *
 * Order (first match wins):
 *  1. a Slack thread the caller named — kept as given;
 *  2. the work item the post answers (`workItemId`), when nothing else was
 *     named — its owner origin's conversation and Slack thread;
 *  3. the turn origin's thread, when the post goes to the origin's own
 *     conversation and that origin is fresh;
 *  4. nothing named, no work item and a stale turn origin: the orchestrator's
 *     own owner DM instead of a "last active channel".
 *
 * Pure decision logic; the caller supplies the owner-DM lookup.
 *
 * @module services/orc/orc-post-placement
 */

import { ORC_REPLY_ROUTE_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { TurnOrigin } from './orc-reply-route.service.js';
import { originOfWorkItem, planWorkDestination } from './work-item-destination.js';

/** Why the placement is what it is. */
export type OrcPostPlacementVia = 'named-thread' | 'work-item' | 'origin-thread' | 'owner-dm' | 'unchanged';

/** Input of {@link planOrcPostPlacement}. */
export interface OrcPostPlacementInput {
  /** Conversation the caller named, if any */
  requestedConversationId?: string;
  /** Slack thread key the caller named (already parsed and formatted), if any */
  requestedSlackThread?: string;
  /** Conversation the reply router settled on (named, rerouted, or defaulted to the origin) */
  routedConversationId?: string;
  /** The orchestrator's last owner turn, however old */
  origin?: TurnOrigin;
  /** The work item the post answers, if the caller named one */
  workItem?: WorkItem | null;
  /** The orchestrator's own chat conversation with the owner, or null when unknown */
  ownerDmConversationId: string | null;
  /** Clock (epoch ms) */
  now: number;
}

/** Where the post goes. */
export interface OrcPostPlacement {
  /** Conversation to post in (undefined: the caller's own fallback applies) */
  conversationId?: string;
  /** Slack thread key to post under (undefined: top level) */
  slackThread?: string;
  /** Which rule decided */
  via: OrcPostPlacementVia;
  /** One line for the log */
  reason: string;
}

/**
 * Decide the conversation and thread of an orchestrator post.
 *
 * @param input - What the caller named, the routed conversation, the turn origin and the work item
 * @returns The placement
 */
export function planOrcPostPlacement(input: OrcPostPlacementInput): OrcPostPlacement {
  const { origin, now } = input;
  const named = input.requestedConversationId?.trim() || undefined;
  const routed = input.routedConversationId?.trim() || undefined;

  if (input.requestedSlackThread) {
    return {
      ...(routed ? { conversationId: routed } : {}),
      slackThread: input.requestedSlackThread,
      via: 'named-thread',
      reason: 'the caller named the Slack thread',
    };
  }

  if (!named && input.workItem && originOfWorkItem(input.workItem)) {
    const planned = planWorkDestination({ workItem: input.workItem, now });
    if (planned.kind === 'owner-origin') {
      const o = planned.origin;
      return {
        conversationId: o.conversationId,
        ...(o.slackThreadKey ? { slackThread: o.slackThreadKey } : {}),
        via: 'work-item',
        reason: planned.reason,
      };
    }
  }

  const fresh = !!origin && now - origin.receivedAt <= ORC_REPLY_ROUTE_CONSTANTS.ORIGIN_TTL_MS;
  if (origin && routed === origin.conversationId && fresh && origin.slackThreadKey) {
    return {
      conversationId: routed,
      slackThread: origin.slackThreadKey,
      via: 'origin-thread',
      reason: "the post goes to its turn origin's conversation — answering in that Slack thread",
    };
  }

  if (!named && origin && !fresh && input.ownerDmConversationId && routed === origin.conversationId && routed !== input.ownerDmConversationId) {
    return {
      conversationId: input.ownerDmConversationId,
      via: 'owner-dm',
      reason: 'nothing named the destination and the last owner turn is stale — the owner DM, not the last active channel',
    };
  }

  return { ...(routed ? { conversationId: routed } : {}), via: 'unchanged', reason: 'no better place known' };
}

/**
 * The work item with the given id, from a list.
 *
 * @param items - Pool items
 * @param id - Work item id
 * @returns The item or null
 */
export function findWorkItem(items: WorkItem[], id: string | undefined): WorkItem | null {
  if (!id) return null;
  return items.find((w) => w.id === id) ?? null;
}
