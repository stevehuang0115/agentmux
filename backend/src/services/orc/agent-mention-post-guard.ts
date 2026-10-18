/**
 * Refuse a post into the owner's thread that only talks to other agents
 * (crewly#1375, expected point 4).
 *
 * 2026-10-18: Atlas (Think Tank) messaged Pia (Flopost) with send-message
 * while Pia was answering the owner's video thread. Having no other address
 * for Atlas, Pia ran `reply-channel` into the owner's thread with "@Atlas …":
 * a cost/timing report about another project, in the middle of the owner's
 * conversation.
 *
 * Conservative by construction — the post is refused only when ALL hold:
 *  - the poster's latest input is another agent's message (its turn was not
 *    prompted by this conversation);
 *  - the owner wrote to the poster in this conversation recently (it is an
 *    owner thread, not an agents' room);
 *  - the text @-mentions someone, and every @-mention is a known agent (an
 *    unknown name or the owner keeps the post).
 *
 * Pure decision; the lookups are injected.
 *
 * @module services/orc/agent-mention-post-guard
 */

import type { LatestInput } from './reply-destination-resolver.js';

/** `@Name` at a word start (`@Atlas`, `(@Atlas`); trailing punctuation dropped. */
const MENTION = /(?:^|[\s(])@([A-Za-z][\w.-]{0,40})/g;

/** Input of {@link misdirectedAgentMention}. */
export interface AgentMentionPostInput {
  /** Posting agent */
  session: string;
  /** Post text */
  content: string;
  /** The poster's latest input */
  latest: LatestInput | null;
  /** Whether the owner wrote to the poster in this conversation recently */
  ownerAskedHere: boolean;
  /** The agent session an @-name belongs to, or null when it is not a known agent */
  agentByName: (name: string) => string | null;
}

/** A refused post. */
export interface MisdirectedAgentMention {
  /** The agent whose message the poster is answering */
  sender: string;
  /** Agent sessions the post @-mentions */
  mentioned: string[];
  /** What the poster is told */
  message: string;
}

/**
 * The `@names` a text mentions, in order, without duplicates.
 *
 * @param text - Post text
 * @returns Names (without `@`)
 *
 * @example
 * ```typescript
 * mentionedNames('@Atlas (1) your note…, cc @Lyra.'); // ['Atlas', 'Lyra']
 * ```
 */
export function mentionedNames(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text ?? '').matchAll(MENTION)) {
    const name = m[1].replace(/[.-]+$/, '');
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Whether a post into an owner thread only talks to agents, unprompted by
 * that thread — and what to tell the poster.
 *
 * @param input - Poster, text, latest input and lookups
 * @returns The refusal, or null to post
 */
export function misdirectedAgentMention(input: AgentMentionPostInput): MisdirectedAgentMention | null {
  const { latest } = input;
  if (latest?.kind !== 'agent' || !latest.sender || latest.sender === input.session) return null;
  if (!input.ownerAskedHere) return null;
  const names = mentionedNames(input.content);
  if (names.length === 0) return null;
  const mentioned: string[] = [];
  for (const name of names) {
    const agent = input.agentByName(name);
    if (!agent || agent === input.session) return null;
    if (!mentioned.includes(agent)) mentioned.push(agent);
  }
  const to = mentioned.includes(latest.sender) ? latest.sender : mentioned[0];
  return {
    sender: latest.sender,
    mentioned,
    message:
      `Not posted: this is the owner's thread, your latest message came from ${latest.sender} (another agent), ` +
      `and your post only @-mentions agents. Send it to the agent instead: send-message --to ${to} "<your message>". ` +
      'If the owner should read it, post it without the @-mention.',
  };
}
