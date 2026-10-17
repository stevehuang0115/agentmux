/**
 * Agent-to-agent coordination in Slack rooms (crewly#1340).
 *
 * 2026-10-16, #content-team: Ella, Max and Sam — all on the owner's Mac —
 * posted 20+ top-level Slack messages to each other in 90 minutes ("@Max
 * CREW-718 step 1 of 2 done…", "@Sam Got it, going with your first
 * option…", "@Sam 1.0.217 is live…"). Each one was a new unread for the
 * owner, who does not need that discussion; internal ticket ids leaked into
 * every post; and Ella sent Sam the same conclusion three times.
 *
 * The model is a company group chat: whoever the room asked is the room's
 * one voice; it reaches its helpers privately, and posts one update when
 * their result is in. The pure pieces of that live here:
 *  - {@link classifyAgentAddressing}: whom an agent's room post is for —
 *    only agents on this machine (stays inside Crewly), agents elsewhere
 *    (Slack, in a thread), or anyone else (unchanged);
 *  - {@link stripTicketIds}: internal ticket ids out of anything an agent
 *    posts to Slack, for real ticket prefixes only;
 *  - {@link CoordinationDedupe}: the same agent sending a near-identical
 *    message to the same recipients in the same room within 15 minutes.
 *
 * @module services/slack/agent-coordination
 */

import { questionSimilarity } from '../open-items/open-item-card.js';
import { AGENT_COORDINATION_CONSTANTS } from '../../constants.js';

/** Whom an agent's room post addresses. */
export type AgentAddressing =
  /** Only agents running on this machine: delivered inside Crewly, never posted to Slack. */
  | 'local-only'
  /** Only agents, at least one on another machine: Slack is the only way there, in a thread. */
  | 'cross-machine'
  /** No agent @'d, or a person / broadcast / name nobody knows: posted as before. */
  | 'other';

/** What the room knows about the names an agent post @'s. */
export interface AgentAddressingInput {
  /** Agents @'d that run on this machine (sessions) */
  localAgents: readonly string[];
  /** Agents @'d that run on another machine (sessions or names) */
  remoteAgents: readonly string[];
  /** @-tokens or native ids that are neither: a person, or a name nobody knows */
  others: readonly string[];
  /** A person addressed by name without an @ ("Steve, …"), or @here/@channel */
  addressesPeople: boolean;
}

/**
 * Whom an agent's post addresses. Anything that may be for a person — a
 * person's name, a broadcast, a name that matched nobody — keeps today's
 * behaviour: the owner must never miss a message meant for them.
 *
 * @param input - The resolved names
 * @returns The addressing class
 *
 * @example
 * ```typescript
 * classifyAgentAddressing({ localAgents: ['max'], remoteAgents: [], others: [], addressesPeople: false }); // 'local-only'
 * classifyAgentAddressing({ localAgents: ['max'], remoteAgents: ['rex'], others: [], addressesPeople: false }); // 'cross-machine'
 * classifyAgentAddressing({ localAgents: ['max'], remoteAgents: [], others: ['Steve'], addressesPeople: false }); // 'other'
 * ```
 */
export function classifyAgentAddressing(input: AgentAddressingInput): AgentAddressing {
  if (input.addressesPeople || input.others.length > 0) return 'other';
  if (input.remoteAgents.length > 0) return 'cross-machine';
  if (input.localAgents.length > 0) return 'local-only';
  return 'other';
}

/**
 * The real ticket prefixes, normalised: upper case, two to ten letters or
 * digits starting with a letter. One-letter prefixes (the `T` fallback,
 * decisions' `D`) are left out — "T-5" or "D-3" in prose is too often not
 * a ticket.
 *
 * @param prefixes - Prefixes as configured (project ticket counters, `TKT`)
 * @returns Unique prefixes, longest first
 */
export function normaliseTicketPrefixes(prefixes: readonly string[]): string[] {
  const clean = new Set<string>();
  for (const p of prefixes) {
    const up = (p ?? '').trim().toUpperCase();
    if (/^[A-Z][A-Z0-9]{1,9}$/.test(up)) clean.add(up);
  }
  return [...clean].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/**
 * Take internal ticket ids out of a Slack post. Tickets are the harness's
 * bookkeeping; the owner never sees their ids or mechanics.
 *
 * Only ids with a real prefix are touched, so "UTF-8", "GPT-6" or "ISO-27001"
 * stay. An id that is part of a path, branch or URL ("fix/CREW-12",
 * "/blog/CREW-12") stays too. A parenthetical of ids goes with its brackets,
 * a leading "CREW-718:" with its colon, and a preposition left dangling
 * before punctuation ("for CREW-718.") goes with the id.
 *
 * @param text - The post
 * @param prefixes - Real ticket prefixes
 * @returns The post without ticket ids (the original when nothing would be left)
 *
 * @example
 * ```typescript
 * stripTicketIds('@Max CREW-718 step 1 of 2 done', ['CREW']); // '@Max step 1 of 2 done'
 * stripTicketIds('the fix (CREW-718) is live', ['CREW']);      // 'the fix is live'
 * stripTicketIds('UTF-8 and GPT-6', ['CREW']);                 // unchanged
 * ```
 */
export function stripTicketIds(text: string, prefixes: readonly string[]): string {
  const list = normaliseTicketPrefixes(prefixes);
  if (!text || list.length === 0) return text;
  const id = `(?<![\\p{L}\\p{N}_/.#-])(?:${list.join('|')})-\\d+(?![\\p{L}\\p{N}_/-])`;
  if (!new RegExp(id, 'u').test(text)) return text;
  let out = text
    // "(CREW-718)", "(CREW-718, CREW-719)"
    .replace(new RegExp(`[ \\t]*\\(\\s*${id}(?:\\s*(?:,|/|&|and)\\s*${id})*\\s*\\)`, 'gu'), '')
    // "CREW-718: …", "CREW-718 — …"
    .replace(new RegExp(`${id}[ \\t]*[:：—–][ \\t]*`, 'gu'), '')
    // "for CREW-718." / "on CREW-718," — the preposition goes too
    .replace(new RegExp(`[ \\t]+(?:[Ff]or|[Oo]n|[Ii]n|[Uu]nder|[Aa]bout|[Oo]f|[Rr]e)[ \\t]+${id}(?=[ \\t]*(?:[.,;:!?)]|$))`, 'gmu'), '')
    // A bare id, with the space after it ("@Max CREW-718 step" → "@Max step")
    .replace(new RegExp(`${id}[ \\t]?`, 'gu'), '');
  out = out
    .replace(/(\S)[ \t]{2,}(?=\S)/gu, '$1 ')
    .replace(/[ \t]+([.,;:!?)])/gu, '$1')
    .replace(/\([ \t]*\)/gu, '')
    .replace(/[ \t]+$/gmu, '');
  return out.trim().length > 0 ? out : text;
}

/** One message remembered for the dedupe. */
interface SentEntry {
  text: string;
  at: number;
}

/**
 * Drops an agent's near-identical repeat to the same recipients in the same
 * room within {@link AGENT_COORDINATION_CONSTANTS.DUPLICATE_WINDOW_MS} — Ella
 * sent Sam one conclusion three times in six minutes (2026-10-16).
 * In memory: a restart forgets, which only lets one repeat through.
 */
export class CoordinationDedupe {
  private readonly sent = new Map<string, SentEntry[]>();

  /**
   * @param windowMs - How long a message counts as recent
   * @param threshold - Similarity (0..1) at which two messages are one
   */
  constructor(
    private readonly windowMs: number = AGENT_COORDINATION_CONSTANTS.DUPLICATE_WINDOW_MS,
    private readonly threshold: number = AGENT_COORDINATION_CONSTANTS.DUPLICATE_SIMILARITY,
  ) {}

  /**
   * Whether this message repeats one the same agent sent the same recipients
   * here recently. A message that is not a repeat is remembered.
   *
   * @param room - Room id
   * @param sender - Sending agent
   * @param recipients - Addressed agents
   * @param text - The message
   * @param now - Current time (ms)
   * @returns True for a repeat (drop it)
   */
  isRepeat(room: string, sender: string, recipients: readonly string[], text: string, now: number): boolean {
    const key = `${room}|${sender}|${[...new Set(recipients)].sort().join(',')}`;
    const body = comparable(text);
    const recent = (this.sent.get(key) ?? []).filter((e) => now - e.at <= this.windowMs);
    const repeat = body.length > 0 && recent.some((e) => questionSimilarity(e.text, body) >= this.threshold);
    if (!repeat) recent.push({ text: body, at: now });
    if (recent.length > 0) this.sent.set(key, recent.slice(-AGENT_COORDINATION_CONSTANTS.DUPLICATE_HISTORY));
    else this.sent.delete(key);
    if (this.sent.size > AGENT_COORDINATION_CONSTANTS.DUPLICATE_MAX_KEYS) {
      const oldest = this.sent.keys().next().value;
      if (oldest !== undefined) this.sent.delete(oldest);
    }
    return repeat;
  }
}

/**
 * A message as compared for repeats: without @-mentions and Slack ids, so
 * "@Sam X" and "@Sam @Max X" compare on X.
 *
 * @param text - Message
 * @returns Comparable text
 */
function comparable(text: string): string {
  return (text ?? '')
    .replace(/<[@#!][^>]*>/g, ' ')
    .replace(/(?<![\w])@[\p{L}\p{N}_.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
