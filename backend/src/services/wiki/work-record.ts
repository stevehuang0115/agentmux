/**
 * Work records (#1349) — the pure half.
 *
 * A work record is one structured `(record)` entry in a vault's activity log
 * describing a finished (or long-blocked) task: who asked for it, who did it,
 * what came out, what went wrong on the way and how it was resolved, who was
 * pulled in, and how it ended. This module knows the shape, assembles a
 * record from already-loaded inputs (no I/O, so fixtures can drive it),
 * renders it as a log body, and parses a body back for the digest and the
 * startup briefing.
 *
 * Owner-facing lines never carry ticket ids or WorkItem ids; those live on
 * the `meta:` line, which the digest reads but never renders.
 *
 * Body layout (one field per line, parse-friendly):
 *
 *   (record) **<title>** — <outcome phrase>
 *   asked by: <who> — "<quote>"
 *   done by: <name>
 *   did: <summary>
 *   outputs: <a>; <b>
 *   errors: <what> (fixed); <what> (unresolved)
 *   helpers: delegated to Leo: "<title>" → done; asked Ella → answered; reviewed by Owen
 *   outcome: <phrase>
 *   meta: wi=<id> phase=final status=verified asked_by=owen:lead done_by=nova …
 *
 * @module services/wiki/work-record
 */

import { WORK_RECORD_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { ProjectTicket } from '../../types/project-ticket.types.js';
import type { Request } from '../../types/v2/request.types.js';
import type { TraceEvent } from '../trace/trace.types.js';
import type { WorkItemOrigin } from '../orc/work-item-destination.js';
import { TICKET_CONSTANTS } from '../../constants.js';
import { stripTicketIds } from '../slack/agent-coordination.js';
import type { WikiLogEntryRecord } from './wiki-log-entries.js';
import type { TranscriptWindowFacts } from './work-record-transcript.js';

const C = WORK_RECORD_CONSTANTS;

/** Who a party to the task is. */
export type WorkRecordPartyKind = 'owner' | 'orchestrator' | 'lead' | 'agent' | 'schedule' | 'system';

/** How the task ended. */
export type WorkRecordOutcome =
  | 'owner_verified'
  | 'lead_verified'
  | 'silence_accepted'
  | 'done'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'blocked'
  | 'waiting_owner';

/** `final` closes the task; `blocked` is an interim record for a parked task. */
export type WorkRecordPhase = 'final' | 'blocked';

/** One party (asker, doer, helper). */
export interface WorkRecordParty {
  kind: WorkRecordPartyKind;
  /** Display name (`Owen`, `the owner`, `schedule "Daily ops"`). */
  name: string;
  /** Agent session when the party is an agent. */
  session?: string;
}

/** Someone pulled in while the task ran. */
export interface WorkRecordHelper {
  how: 'delegated' | 'asked' | 'reviewed';
  name: string;
  session?: string;
  /** Delegated sub-task title. */
  what?: string;
  /** What came back (`done`, `rejected`, `answered`, `no answer`). */
  back?: string;
}

/** An error met on the way. */
export interface WorkRecordError {
  what: string;
  resolved: 'fixed' | 'unresolved' | 'unknown';
}

/** The assembled record. */
export interface WorkRecord {
  workItemId: string;
  phase: WorkRecordPhase;
  title: string;
  askedBy: WorkRecordParty;
  /** Where the ask came from, when known (`Slack thread`, `chat`, `app comment`). */
  askedWhere?: string;
  /** The person the asker acted for (an owner-origin delegation by a lead). */
  forOwner: boolean;
  askQuote: string;
  doneBy: WorkRecordParty;
  did: string;
  outputs: string[];
  errors: WorkRecordError[];
  helpers: WorkRecordHelper[];
  outcome: WorkRecordOutcome;
  /** Who decided the outcome (reviewer, owner), display name. */
  outcomeBy?: string;
  /** Cancel / block / rejection reason. */
  outcomeNote?: string;
  endedAt: string;
  durationMs?: number;
  /** Machine-readable fields for the digest (ticket ids live here only). */
  meta: Record<string, string>;
}

/** Everything the assembler needs, already loaded. */
export interface WorkRecordInputs {
  workItem: WorkItem;
  phase: WorkRecordPhase;
  /** Linked project ticket (`metadata.projectTicket`), when found. */
  ticket?: ProjectTicket | null;
  /** Linked Request (`workItem.requestId`), when found. */
  request?: Request | null;
  /** Child items: delegations and the verify item. */
  children?: readonly WorkItem[];
  /** The run trace's events, when a trace exists. */
  trace?: readonly TraceEvent[];
  /** Facts from the doer's transcript for the task window. */
  transcript?: TranscriptWindowFacts | null;
  /** Display name of an agent session. */
  nameOf: (session: string) => string;
  /** Party kind of an agent session (`lead`, `orchestrator`, `agent`). */
  kindOf: (session: string) => WorkRecordPartyKind;
  /** Ticket prefixes to strip from owner-facing text (`CE`, `CREW`). */
  ticketPrefixes?: readonly string[];
  /** Clock. */
  now?: number;
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?::[A-Za-z]+:[0-9a-f-]+)*\b/gi;
const WORK_ITEM_WORD_RE = /\b(?:WorkItem|work item)\s+(?=\[?[0-9a-f]{8}-)/gi;
const URL_RE = /https?:\/\/[^\s)"'<>]+/g;

/**
 * `work-record:<workItemId>#<phase>` — the entry's `ref:` and its dedupe key.
 *
 * @param workItemId - WorkItem id
 * @param phase - Record phase
 * @returns Stable ref
 */
export function workRecordRef(workItemId: string, phase: WorkRecordPhase): string {
  return `${C.REF_PREFIX}${workItemId}#${phase}`;
}

/**
 * Parse a record ref back into its parts.
 *
 * @param ref - `ref:` value
 * @returns Parts, or null when it is not a record ref
 */
export function parseWorkRecordRef(ref: string): { workItemId: string; phase: WorkRecordPhase } | null {
  if (!ref.startsWith(C.REF_PREFIX)) return null;
  const rest = ref.slice(C.REF_PREFIX.length);
  const hash = rest.lastIndexOf('#');
  if (hash <= 0) return null;
  const phase = rest.slice(hash + 1);
  if (phase !== 'final' && phase !== 'blocked') return null;
  return { workItemId: rest.slice(0, hash), phase };
}

/**
 * Whether a log entry is a work record.
 *
 * @param entry - Parsed log entry
 * @returns True for `work_record` entries (by source type or ref)
 */
export function isWorkRecordEntry(entry: Pick<WikiLogEntryRecord, 'sourceType' | 'ref'>): boolean {
  return entry.sourceType === C.SOURCE_TYPE || entry.ref.startsWith(C.REF_PREFIX);
}

/**
 * Whether a WorkItem is the verify item of another (`<id>:verify:<id>` or
 * `metadata.verifyOf`). Verify items are folded into the parent's record.
 *
 * @param wi - WorkItem
 * @returns True for a verify item
 */
export function isVerifyWorkItem(wi: Pick<WorkItem, 'id' | 'metadata' | 'type'>): boolean {
  return wi.id.includes(':verify:') || typeof wi.metadata?.verifyOf === 'string';
}

/**
 * Whether a WorkItem gets a record at all: real work, not a verify item or a
 * bookkeeping type.
 *
 * @param wi - WorkItem
 * @returns True when the item is recordable
 */
export function isRecordableWorkItem(wi: Pick<WorkItem, 'id' | 'metadata' | 'type'>): boolean {
  if (isVerifyWorkItem(wi)) return false;
  return !C.SKIPPED_TYPES.includes(wi.type);
}

/**
 * The moment an item stopped: `completedAt`, else `statusChangedAt`, else
 * `createdAt`.
 *
 * @param wi - WorkItem
 * @returns ISO time
 */
export function workItemEndedAt(wi: Pick<WorkItem, 'completedAt' | 'statusChangedAt' | 'createdAt'>): string {
  return wi.completedAt ?? wi.statusChangedAt ?? wi.createdAt;
}

/**
 * Owner-facing text: ticket ids, WorkItem ids and uuids removed, whitespace
 * collapsed, clipped.
 *
 * @param text - Raw text
 * @param prefixes - Ticket prefixes to strip
 * @param max - Character cap
 * @returns Clean one-line text
 */
export function cleanOwnerText(text: string | undefined | null, prefixes: readonly string[] = [], max: number = Number.MAX_SAFE_INTEGER): string {
  if (!text) return '';
  let out = text.replace(/\r?\n+/g, ' ');
  out = out.replace(WORK_ITEM_WORD_RE, '').replace(UUID_RE, '');
  out = stripTicketIds(out, prefixes);
  out = out
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .replace(/^[\s—–:-]+/, '')
    .trim();
  return clip(out, max);
}

/**
 * Clip to `max` characters with an ellipsis.
 *
 * @param text - Text
 * @param max - Cap
 * @returns Clipped text
 */
export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text;
}

/**
 * Assemble a record from loaded inputs. Pure.
 *
 * @param inputs - WorkItem, links, trace, transcript facts and name resolvers
 * @returns The record
 *
 * @example
 * ```typescript
 * const record = assembleWorkRecord({ workItem, phase: 'final', ticket, children, trace, nameOf, kindOf });
 * const body = renderWorkRecordBody(record);
 * ```
 */
export function assembleWorkRecord(inputs: WorkRecordInputs): WorkRecord {
  const wi = inputs.workItem;
  const prefixes = collectPrefixes(inputs);
  const clean = (t: string | undefined | null, max?: number): string => cleanOwnerText(t, prefixes, max);
  const doerSession = wi.target ?? '';
  const doneBy: WorkRecordParty = doerSession
    ? { kind: inputs.kindOf(doerSession), name: inputs.nameOf(doerSession), session: doerSession }
    : { kind: 'system', name: 'nobody (unassigned)' };

  const origin = (wi.metadata?.origin ?? undefined) as WorkItemOrigin | undefined;
  const { askedBy, askedWhere, forOwner } = resolveAsker(wi, origin, inputs, prefixes);
  const askQuote = clean(firstLine(inputs.ticket?.description) || firstLine(wi.description) || firstLine(inputs.request?.description) || firstLine(wi.briefMarkdown) || wi.title, C.QUOTE_MAX_CHARS);

  const bag = { ...(wi.output ?? {}), ...(wi.result ?? {}) } as Record<string, unknown>;
  const did = clean(summaryOf(bag) || (wi.status === 'cancelled' ? wi.cancelReason : wi.status === 'blocked' ? wi.blockedReason : wi.error) || '', C.DID_MAX_CHARS);

  const outputs = collectOutputs(wi, bag, inputs, prefixes);
  const errors = collectErrors(wi, inputs, prefixes);
  const helpers = collectHelpers(wi, inputs, prefixes);
  const { outcome, outcomeBy, outcomeNote } = resolveOutcome(wi, inputs, prefixes);

  const endedAt = inputs.phase === 'blocked' ? (wi.statusChangedAt ?? workItemEndedAt(wi)) : workItemEndedAt(wi);
  const startMs = Date.parse(wi.startedAt ?? wi.createdAt);
  const endMs = Date.parse(endedAt);
  const durationMs = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs ? endMs - startMs : undefined;

  const meta: Record<string, string> = {
    wi: wi.id,
    phase: inputs.phase,
    status: wi.status,
    asked_by: `${metaToken(askedBy.session ?? askedBy.kind)}:${askedBy.kind}`,
    done_by: metaToken(doneBy.session ?? doneBy.kind),
    outcome,
  };
  if (inputs.ticket) meta.ticket = inputs.ticket.id;
  if (wi.requestId) meta.request = wi.requestId;
  if (wi.traceId) meta.trace = wi.traceId;
  if (typeof wi.metadata?.teamId === 'string') meta.team = wi.metadata.teamId;
  if (helpers.length) meta.helpers = helpers.map((h) => `${metaToken(h.session ?? h.name)}:${h.how}`).join(',');
  if (outcomeBy) meta.outcome_by = metaToken(outcomeBy);

  return {
    workItemId: wi.id,
    phase: inputs.phase,
    title: clean(wi.title, 120) || 'Untitled task',
    askedBy,
    askedWhere,
    forOwner,
    askQuote,
    doneBy,
    did,
    outputs,
    errors,
    helpers,
    outcome,
    outcomeBy,
    outcomeNote,
    endedAt,
    durationMs,
    meta,
  };
}

/**
 * Render a record as the log body. Always fits `MAX_CHARS`; the `meta:` line
 * is never cut.
 *
 * @param record - Assembled record
 * @returns Markdown body
 */
export function renderWorkRecordBody(record: WorkRecord): string {
  const asked = [
    `${record.askedBy.name}${partySuffix(record.askedBy)}`,
    record.forOwner ? 'for the owner' : '',
    record.askedWhere ? `(${record.askedWhere})` : '',
  ].filter(Boolean).join(' ');
  const lines: string[] = [
    `(record) **${record.title}** — ${outcomePhrase(record)}`,
    `asked by: ${asked}${record.askQuote ? ` — "${record.askQuote}"` : ''}`,
    `done by: ${record.doneBy.name}`,
  ];
  if (record.did) lines.push(`did: ${record.did}`);
  if (record.outputs.length) lines.push(`outputs: ${record.outputs.join('; ')}`);
  if (record.errors.length) lines.push(`errors: ${record.errors.map((e) => `${e.what} (${e.resolved})`).join('; ')}`);
  if (record.helpers.length) lines.push(`helpers: ${record.helpers.map(renderHelper).join('; ')}`);
  lines.push(`outcome: ${outcomePhrase(record)}${record.outcomeNote ? ` — ${record.outcomeNote}` : ''}${record.durationMs ? `, ${humanDuration(record.durationMs)}` : ''}`);
  const metaLine = `meta: ${Object.entries(record.meta).map(([k, v]) => `${k}=${v}`).join(' ')}`;
  let body = lines.join('\n');
  const budget = C.MAX_CHARS - metaLine.length - 1;
  if (body.length > budget) body = `${body.slice(0, Math.max(0, budget - 1)).replace(/\n[^\n]*$/, '')}\n…`;
  return `${body}\n${metaLine}`;
}

/** A record as read back from a log body. */
export interface ParsedWorkRecord {
  title: string;
  askedBy: string;
  doneBy: string;
  did: string;
  outputs: string[];
  errors: string[];
  helpers: Array<{ how: 'delegated' | 'asked' | 'reviewed'; name: string; rest: string }>;
  outcome: string;
  meta: Record<string, string>;
}

/**
 * Parse a record body written by {@link renderWorkRecordBody}.
 *
 * @param body - Log entry body
 * @returns The fields, or null when the body is not a record
 */
export function parseWorkRecordBody(body: string): ParsedWorkRecord | null {
  const lines = body.split('\n');
  const head = lines[0]?.match(/^\s*\(record\)\s+\*\*(.+?)\*\*(?:\s+—\s+(.*))?$/);
  if (!head) return null;
  const fields = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const m = line.match(/^([a-z ]+):\s?(.*)$/);
    if (m) fields.set(m[1], m[2]);
  }
  const meta: Record<string, string> = {};
  for (const token of (fields.get('meta') ?? '').split(/\s+/)) {
    const eq = token.indexOf('=');
    if (eq > 0) meta[token.slice(0, eq)] = token.slice(eq + 1);
  }
  const helpers: ParsedWorkRecord['helpers'] = [];
  for (const part of splitList(fields.get('helpers'))) {
    const h = part.match(/^(delegated to|asked|reviewed by)\s+(.+?)(?::\s|\s→\s|$)(.*)$/);
    if (!h) continue;
    helpers.push({ how: h[1] === 'delegated to' ? 'delegated' : h[1] === 'asked' ? 'asked' : 'reviewed', name: h[2].trim(), rest: h[3].trim() });
  }
  const asked = fields.get('asked by') ?? '';
  return {
    title: head[1].trim(),
    askedBy: asked.split(' — "')[0].trim(),
    doneBy: (fields.get('done by') ?? '').trim(),
    did: (fields.get('did') ?? '').trim(),
    outputs: splitList(fields.get('outputs')),
    errors: splitList(fields.get('errors')),
    helpers,
    outcome: (fields.get('outcome') ?? head[2] ?? '').trim(),
    meta,
  };
}

/**
 * One-line form of a record for the startup briefing and the digest.
 *
 * @param parsed - Parsed record
 * @param max - Character cap
 * @returns `**Title** — asked by X, done by Y → outcome`
 */
export function shortWorkRecordLine(parsed: ParsedWorkRecord, max: number = C.BRIEFING_LINE_MAX_CHARS): string {
  const parts = [`**${clip(parsed.title, 80)}**`, `asked by ${parsed.askedBy || 'unknown'}`, `done by ${parsed.doneBy || 'unknown'}`];
  if (parsed.outputs.length) parts.push(`outputs: ${parsed.outputs.slice(0, 2).map((o) => clip(o, 60)).join('; ')}`);
  const tail = ` → ${clip(parsed.outcome, 60)}`;
  return `${clip(parts.join(' — '), Math.max(40, max - tail.length))}${tail}`;
}

// ---------------------------------------------------------------------------
// Assembly internals
// ---------------------------------------------------------------------------

function collectPrefixes(inputs: WorkRecordInputs): string[] {
  const out = new Set<string>(inputs.ticketPrefixes ?? []);
  const ticketId = inputs.ticket?.id ?? (inputs.workItem.metadata?.projectTicket as { id?: string } | undefined)?.id;
  if (typeof ticketId === 'string') {
    const dash = ticketId.indexOf('-');
    if (dash > 0) out.add(ticketId.slice(0, dash));
  }
  out.add(TICKET_CONSTANTS.NUMBER_PREFIX.replace(/-$/, ''));
  return [...out];
}

function firstLine(text: string | undefined | null): string {
  if (!text) return '';
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^#+\s*/, '').replace(/^\*\*[^*]+\*\*\s*/, '').trim();
    if (line.length > 0) return line;
  }
  return '';
}

function summaryOf(bag: Record<string, unknown>): string {
  for (const k of ['summary', 'message', 'text', 'verdict', 'reason']) {
    const v = bag[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

function resolveAsker(wi: WorkItem, origin: WorkItemOrigin | undefined, inputs: WorkRecordInputs, prefixes: readonly string[]): { askedBy: WorkRecordParty; askedWhere?: string; forOwner: boolean } {
  const delegatedBy = typeof wi.metadata?.delegatedBy === 'string' ? wi.metadata.delegatedBy : undefined;
  const forOwner = origin?.kind === 'owner';
  const askedWhere = origin?.kind === 'owner' ? ownerPlace(origin) : undefined;
  if (delegatedBy && delegatedBy !== wi.target) {
    return { askedBy: { kind: inputs.kindOf(delegatedBy), name: inputs.nameOf(delegatedBy), session: delegatedBy }, askedWhere, forOwner };
  }
  if (origin?.kind === 'owner') {
    return { askedBy: { kind: 'owner', name: 'the owner' }, askedWhere, forOwner: false };
  }
  if (origin?.kind === 'trigger') {
    return { askedBy: { kind: 'schedule', name: `schedule "${cleanOwnerText(origin.topic, prefixes, 60)}"` }, forOwner: false };
  }
  const source = inputs.ticket?.source ?? inputs.request?.origin?.author;
  if (typeof source === 'string') {
    const session = source.replace(/^agent:/, '');
    if (source === 'owner' || inputs.request?.origin?.channel === 'slack-dm' || inputs.request?.origin?.channel === 'portal') {
      return { askedBy: { kind: 'owner', name: 'the owner' }, askedWhere: inputs.request?.origin?.channel, forOwner: false };
    }
    if (session && session !== wi.target && /^[a-z0-9][a-z0-9-]*$/i.test(session)) {
      return { askedBy: { kind: inputs.kindOf(session), name: inputs.nameOf(session), session }, forOwner };
    }
  }
  if (wi.owner === 'orchestrator') return { askedBy: { kind: 'orchestrator', name: 'the orchestrator' }, forOwner };
  if (wi.owner === 'team_lead') return { askedBy: { kind: 'lead', name: 'the team lead' }, forOwner };
  return { askedBy: { kind: 'system', name: 'Crewly (system)' }, forOwner };
}

function ownerPlace(origin: Extract<WorkItemOrigin, { kind: 'owner' }>): string {
  if (origin.appComment) return 'app comment';
  if (origin.slackChannelId && origin.threadTs) return 'Slack thread';
  if (origin.slackChannelId) return 'Slack DM';
  if (origin.conversationId) return 'chat';
  return 'owner message';
}

function collectOutputs(wi: WorkItem, bag: Record<string, unknown>, inputs: WorkRecordInputs, prefixes: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string): void => {
    const t = cleanOwnerText(s, prefixes, C.OUTPUT_MAX_CHARS);
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  const summary = summaryOf(bag);
  for (const url of summary.match(URL_RE) ?? []) push(url.replace(/[.,;:]+$/, ''));
  const evidence = bag.evidence;
  let checks = 0;
  if (Array.isArray(evidence)) {
    for (const e of evidence as Array<Record<string, unknown>>) {
      if (e?.type === 'artifact' && typeof e.path === 'string') push(e.path);
      else if (e?.type === 'command' && typeof e.exitCode === 'number' && e.exitCode === 0) checks++;
    }
  }
  if (checks > 0) push(`${checks} check${checks === 1 ? '' : 's'} passed`);
  for (const k of ['files', 'artifacts', 'paths', 'evidencePaths', 'outputPaths', 'prUrl', 'pr', 'url']) {
    const v = bag[k];
    if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && push(x));
    else if (typeof v === 'string') push(v);
  }
  const t = inputs.transcript;
  if (t) {
    for (const u of t.urls) push(u);
    for (const c of t.commits) push(`commit ${c}`);
    for (const f of t.filesWritten) push(f);
  }
  const posts = new Map<string, number>();
  for (const ev of inputs.trace ?? []) {
    if (ev.type !== 'message.outbound' || ev.outcome !== 'ok' || ev.actor.session !== wi.target) continue;
    const place = placeFromSummary(ev.summary) ?? String(ev.data?.destination ?? ev.data?.source ?? 'message');
    posts.set(place, (posts.get(place) ?? 0) + 1);
  }
  for (const [place, n] of posts) push(`${n} message${n === 1 ? '' : 's'} posted (${place})`);
  if (t && t.posts > 0 && posts.size === 0) push(`${t.posts} message${t.posts === 1 ? '' : 's'} posted`);
  return out.slice(0, C.MAX_OUTPUTS);
}

function placeFromSummary(summary: string): string | null {
  const m = summary.match(/→\s+(Slack|chat|app|WhatsApp)\b/i);
  return m ? m[1] : null;
}

function collectErrors(wi: WorkItem, inputs: WorkRecordInputs, prefixes: readonly string[]): WorkRecordError[] {
  const out: WorkRecordError[] = [];
  const seen = new Set<string>();
  const push = (what: string, resolved: WorkRecordError['resolved']): void => {
    const t = cleanOwnerText(what, prefixes, C.ERROR_MAX_CHARS);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ what: t, resolved });
  };
  for (const e of inputs.transcript?.errors ?? []) push(e.what, e.resolved);
  for (const ev of inputs.trace ?? []) {
    const mine = ev.actor.session === wi.target || ev.refs.workItemId === wi.id;
    if (!mine) continue;
    if (ev.type === 'turn.error' || ev.type === 'error' || ev.type === 'guard.block') push(ev.summary, finishedOk(wi) ? 'fixed' : 'unknown');
    else if (ev.type === 'skill.call' && ev.outcome === 'failed') push(`${String(ev.refs.skill ?? 'a skill call')} failed`, finishedOk(wi) ? 'fixed' : 'unknown');
    else if (ev.type === 'message.outbound' && ev.outcome === 'failed') push(ev.summary, 'unknown');
  }
  if (wi.retryCount > 0) push(`retried ${wi.retryCount} time${wi.retryCount === 1 ? '' : 's'}${typeof wi.metadata?.lastFailureReason === 'string' ? `: ${wi.metadata.lastFailureReason}` : ''}`, finishedOk(wi) ? 'fixed' : 'unresolved');
  if (wi.status === 'failed' && wi.error) push(wi.error, 'unresolved');
  return out.slice(0, C.MAX_ERRORS);
}

function finishedOk(wi: WorkItem): boolean {
  return wi.status === 'done' || wi.status === 'verified';
}

function collectHelpers(wi: WorkItem, inputs: WorkRecordInputs, prefixes: readonly string[]): WorkRecordHelper[] {
  const out: WorkRecordHelper[] = [];
  const doer = wi.target;
  const startMs = Date.parse(wi.startedAt ?? wi.createdAt);
  const endMs = Date.parse(workItemEndedAt(wi));
  const verify = (inputs.children ?? []).find((c) => isVerifyWorkItem(c) && (c.metadata?.verifyOf === wi.id || c.id.startsWith(`${wi.id}:verify:`)));
  for (const child of inputs.children ?? []) {
    if (isVerifyWorkItem(child) || child.id === wi.id) continue;
    const byParent = child.parentWorkItemId === wi.id;
    const createdMs = Date.parse(child.createdAt);
    const byDoer = !!doer && child.metadata?.delegatedBy === doer && Number.isFinite(createdMs) && createdMs >= startMs - C.TRANSCRIPT_WINDOW_SLACK_MS && (!Number.isFinite(endMs) || createdMs <= endMs + C.TRANSCRIPT_WINDOW_SLACK_MS);
    if (!byParent && !byDoer) continue;
    if (!child.target || child.target === doer) continue;
    out.push({ how: 'delegated', name: inputs.nameOf(child.target), session: child.target, what: cleanOwnerText(child.title, prefixes, 60), back: child.status });
  }
  const asked = new Map<string, WorkRecordHelper>();
  const dispatchers = new Set<string>(['WorkItemDispatch']);
  for (const ev of inputs.trace ?? []) {
    if (ev.type !== 'message.agent' || !doer) continue;
    const from = ev.actor.session;
    const to = ev.refs.session;
    if (!from || !to || dispatchers.has(from)) continue;
    if (from === doer && to !== doer && !out.some((h) => h.session === to)) {
      if (!asked.has(to)) asked.set(to, { how: 'asked', name: inputs.nameOf(to), session: to, back: 'no answer' });
    } else if (to === doer && asked.has(from)) {
      const h = asked.get(from);
      if (h) h.back = 'answered';
    }
  }
  for (const ev of inputs.trace ?? []) {
    if (ev.type !== 'turn.delivered' || !doer) continue;
    const sender = typeof ev.data?.sender === 'string' ? ev.data.sender : null;
    if (sender && asked.has(sender) && ev.summary.includes(`delivered to ${doer}`)) {
      const h = asked.get(sender);
      if (h) h.back = 'answered';
    }
  }
  out.push(...asked.values());
  const reviewer = verify?.target ?? (typeof wi.metadata?.reviewedBy === 'string' ? wi.metadata.reviewedBy : undefined);
  if (reviewer && reviewer !== doer) out.push({ how: 'reviewed', name: inputs.nameOf(reviewer), session: reviewer });
  return out.slice(0, C.MAX_HELPERS);
}

function resolveOutcome(wi: WorkItem, inputs: WorkRecordInputs, prefixes: readonly string[]): { outcome: WorkRecordOutcome; outcomeBy?: string; outcomeNote?: string } {
  const reviewer = reviewerOf(wi, inputs);
  const reviewerName = reviewer ? inputs.nameOf(reviewer) : undefined;
  if (inputs.phase === 'blocked' || wi.status === 'blocked') {
    return { outcome: 'blocked', outcomeNote: cleanOwnerText(wi.blockedReason, prefixes, 160) || undefined };
  }
  switch (wi.status) {
    case 'cancelled':
      return { outcome: 'cancelled', outcomeNote: cleanOwnerText(wi.cancelReason, prefixes, 160) || undefined };
    case 'failed':
      return { outcome: 'failed', outcomeNote: cleanOwnerText(wi.error, prefixes, 160) || undefined };
    case 'rejected': {
      const bag = { ...(wi.output ?? {}), ...(wi.result ?? {}) } as Record<string, unknown>;
      const note = typeof bag.rejectionReason === 'string' ? bag.rejectionReason : typeof bag.verdict === 'string' ? bag.verdict : undefined;
      return { outcome: 'rejected', outcomeBy: reviewerName, outcomeNote: cleanOwnerText(note, prefixes, 160) || undefined };
    }
    default:
      break;
  }
  // done / verified: the linked ticket decides whether the owner had a say.
  const ticket = inputs.ticket;
  const request = inputs.request;
  if (request?.acceptedBy === 'silence' || request?.tags?.includes(TICKET_CONSTANTS.REVIEW.AUTO_ACCEPTED_TAG)) return { outcome: 'silence_accepted' };
  if (request?.acceptedBy === 'owner') return { outcome: 'owner_verified', outcomeBy: 'the owner' };
  if (ticket?.ownerReview) {
    if (ticket.status === 'done') {
      if (ticket.labels.includes(TICKET_CONSTANTS.REVIEW.AUTO_ACCEPTED_TAG) || ticketLogSaysSilence(ticket)) return { outcome: 'silence_accepted' };
      return { outcome: 'owner_verified', outcomeBy: 'the owner' };
    }
    if (ticket.status === 'review') return { outcome: 'waiting_owner', outcomeBy: reviewerName };
  }
  if (wi.status === 'verified') return { outcome: 'lead_verified', outcomeBy: reviewerName };
  return { outcome: 'done' };
}

function reviewerOf(wi: WorkItem, inputs: WorkRecordInputs): string | undefined {
  const verify = (inputs.children ?? []).find((c) => isVerifyWorkItem(c) && (c.metadata?.verifyOf === wi.id || c.id.startsWith(`${wi.id}:verify:`)));
  const r = verify?.target ?? (typeof wi.metadata?.reviewedBy === 'string' ? wi.metadata.reviewedBy : undefined);
  return r && r !== wi.target ? r : undefined;
}

function ticketLogSaysSilence(ticket: ProjectTicket): boolean {
  const last = ticket.log[ticket.log.length - 1] ?? '';
  return /auto[- ]accept|silence|no objection/i.test(last);
}

/**
 * The outcome phrase used in the headline and the `outcome:` line.
 *
 * @param record - Record
 * @returns Owner-facing phrase
 */
export function outcomePhrase(record: Pick<WorkRecord, 'outcome' | 'outcomeBy'>): string {
  switch (record.outcome) {
    case 'owner_verified':
      return 'verified by the owner';
    case 'lead_verified':
      return record.outcomeBy ? `verified by ${record.outcomeBy}` : 'verified';
    case 'silence_accepted':
      return 'accepted (no objection from the owner)';
    case 'done':
      return 'done (no review)';
    case 'rejected':
      return record.outcomeBy ? `rejected by ${record.outcomeBy}` : 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'waiting_owner':
      return "finished, waiting for the owner's OK";
    default:
      return String(record.outcome);
  }
}

function partySuffix(party: WorkRecordParty): string {
  if (party.kind === 'lead') return ' (team lead)';
  if (party.kind === 'orchestrator' && party.session) return ' (orchestrator)';
  return '';
}

function renderHelper(h: WorkRecordHelper): string {
  const line = h.how === 'delegated'
    ? `delegated to ${h.name}: "${h.what ?? ''}" → ${h.back ?? 'open'}`
    : h.how === 'asked'
      ? `asked ${h.name} → ${h.back ?? 'no answer'}`
      : `reviewed by ${h.name}`;
  return clip(line, C.HELPER_MAX_CHARS);
}

function humanDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 6) / 10;
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

function metaToken(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.:-]/g, '');
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(/;\s+/).map((s) => s.trim()).filter(Boolean);
}
