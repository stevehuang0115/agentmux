/**
 * Whether a question lifted out of an agent's reply earns its own decision
 * card, or is only tracked.
 *
 * The question is already in the agent's message in the owner's thread; a
 * card repeats it with buttons. Over 3.5 days (2026-10-13 → 10-16) the owner
 * got 142 cards, ~40 a day, most of them lifted: cut-off fragments
 * ("md、sending — 可以发吗？"), questions meant for another agent ("你们能在
 * 周五 9 点前回一句结论吗？"), a second card in a thread that already had one,
 * and two cards for one question in the same minute. A card is only worth it
 * when it is a clean question to the owner that he has not been carded on
 * already, and an agent gets only a few a day.
 *
 * Questions that fail the gate stay tracked (the owner answers in the
 * thread, as he does anyway); they just do not get a card.
 *
 * @module services/open-items/question-card-gate
 */

import { OPEN_ITEMS_CONSTANTS } from '../../constants.js';
import type { OwnerDecision } from '../../types/decision.types.js';
import { questionSimilarity } from './open-item-card.js';

/** Why a lifted question gets no card. */
export type CardSkipReason = 'one_card_per_message' | 'fragment' | 'for_someone_else' | 'thread_has_card' | 'same_as_recent' | 'daily_cap';

/** Input to {@link questionCardSkipReason}. */
export interface CardGateInput {
  /** The question as extracted from the reply */
  question: string;
  /** The question as the card would show it (may add its subject) */
  cardQuestion?: string;
  /** Asking agent's session */
  agent: string;
  /** Where the card would go (null/undefined: no Slack place) */
  place?: { slackChannelId: string; threadTs?: string } | null;
  /** Decisions this agent asked in the last day (any kind, any status) */
  recent: readonly OwnerDecision[];
  /** Names of the agent's colleagues (to spot a question addressed to one of them) */
  colleagueNames?: readonly string[];
  /** Now */
  now: Date;
}

/** Statuses of a card still waiting on the owner. */
const PENDING = new Set(['open', 'parked']);

/** A fragment starts mid-sentence: punctuation, or a few latin letters glued to CJK punctuation ("md、…"). */
const FRAGMENT_START = /^(?:[\p{P}\p{S}]|[a-z0-9]{1,4}[、，,:：;；)）])/u;

/** Words that address several people / someone other than the owner. */
const PLURAL_YOU = /你们|大家|各位|\byou (?:all|guys)\b|\beveryone\b/i;

/** The owner named in the third person ("和 Steve 定", "ask Steve"). */
const OWNER_THIRD_PERSON = /(?:和|跟|与|问|找|请|让)\s*(?:Steve|老板|owner)|(?:ask|tell|check with)\s+(?:Steve|the owner)\b/i;

/**
 * Why this lifted question should not get a card, or null when it should.
 *
 * @param input - The question and what the agent asked recently
 * @returns The reason to skip the card, or null to post it
 */
export function questionCardSkipReason(input: CardGateInput): CardSkipReason | null {
  const q = input.question.trim();
  if (FRAGMENT_START.test(q)) return 'fragment';
  if (PLURAL_YOU.test(q) || OWNER_THIRD_PERSON.test(q)) return 'for_someone_else';
  const head = q.slice(0, 16);
  if ((input.colleagueNames ?? []).some((n) => n && new RegExp(`^@?${escapeRegExp(n)}\\s*[，,:：]`, 'i').test(head))) return 'for_someone_else';

  const dayAgo = input.now.getTime() - OPEN_ITEMS_CONSTANTS.REPLY_CARD_WINDOW_MS;
  const lifted = input.recent.filter((d) => d.kind === 'reply_question' && d.asker === input.agent && Date.parse(d.createdAt) >= dayAgo);
  const place = input.place;
  if (place && lifted.some((d) => PENDING.has(d.status) && samePlace(d.place, place))) return 'thread_has_card';
  const dedupeSince = input.now.getTime() - OPEN_ITEMS_CONSTANTS.ASK_OWNER_DEDUPE_WINDOW_MS;
  if (
    input.recent.some(
      (d) =>
        Date.parse(d.createdAt) >= dedupeSince &&
        [q, input.cardQuestion].some((t) => !!t && questionSimilarity(d.question, t) >= OPEN_ITEMS_CONSTANTS.SAME_QUESTION_SIMILARITY),
    )
  ) {
    return 'same_as_recent';
  }
  if (lifted.length >= OPEN_ITEMS_CONSTANTS.REPLY_CARDS_PER_AGENT_PER_DAY) return 'daily_cap';
  return null;
}

/**
 * Same Slack thread (or the same top-level channel when neither has a thread).
 *
 * @param a - A card's place
 * @param b - The new card's place
 * @returns True when they are one conversation
 */
function samePlace(a: { slackChannelId: string; threadTs?: string } | undefined, b: { slackChannelId: string; threadTs?: string }): boolean {
  return !!a && a.slackChannelId === b.slackChannelId && (a.threadTs ?? '') === (b.threadTs ?? '');
}

/**
 * Escape a string for use inside a RegExp.
 *
 * @param s - Raw text
 * @returns Escaped text
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
