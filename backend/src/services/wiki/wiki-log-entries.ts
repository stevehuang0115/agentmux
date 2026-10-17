/**
 * The vault activity log (`llm-curated/log.md`) as entries.
 *
 * One place that knows the entry format `WikiIngestService` appends:
 *
 *   ## [<ISO>] <sourceType> | <caller>
 *
 *   ref: <sourceRef>
 *
 *   <body>
 *
 * Used by search (one document per recent entry), rotation (carry forward
 * the recent non-noise entries), the digest compiler and the startup
 * briefing. Also decides what counts as a content-free entry (#1345): a
 * templated state transition carries nothing a reader could use.
 *
 * @module services/wiki/wiki-log-entries
 */

import { createHash } from 'crypto';
import { WIKI_LOG_CONSTANTS } from '../../constants.js';

/** One parsed `log.md` entry. */
export interface WikiLogEntryRecord {
  /** ISO timestamp from the header. */
  timestamp: string;
  /** Epoch ms of `timestamp`, or NaN when it does not parse. */
  timestampMs: number;
  /** Source type from the header (`record_learning`, `user_chat`, ...). */
  sourceType: string;
  /** Caller session (or source ref) from the header. */
  caller: string;
  /** `ref:` line value, '' when absent. */
  ref: string;
  /** Entry body after the `ref:` line, trimmed. */
  body: string;
  /** The entry's raw text, header included, as it stands in the file. */
  raw: string;
}

/** Header a fresh `log.md` starts with. */
export const WIKI_LOG_HEADER =
  '# Activity log\n\nAppend-only log of ingested sources. Each entry: `## [<ISO>] <sourceType> | <caller>`.\n';

const HEADER_RE = /^## \[([^\]]+)\]\s+(\S+)\s+\|\s+(.+)$/gm;
const HEADER_LINE_RE = /^## \[([^\]]+)\]\s+(\S+)\s+\|\s+(.+)$/;

/**
 * Whether one line is an entry header (`## [<timestamp>] <sourceType> | <caller>`).
 *
 * @param line - One line without its newline
 * @returns True for a header line
 */
export function isLogEntryHeaderLine(line: string): boolean {
  return HEADER_LINE_RE.test(line);
}

/**
 * Templated records that carry no information for a reader:
 *  - auto-learning state transitions (`[pattern] [[WorkItem-x]] task:done running→done. timestamp=… Source: …`);
 *  - the same shape without the category tag;
 *  - task-completion stubs (`Task completed: …`) that belong on the WorkItem.
 */
const NOISE_PATTERNS: readonly RegExp[] = [
  /\[\[(?:WorkItem|Mission)-[^\]]+\]\]\s+(?:task|mission):[a-z_]+\s+\S*\.?\s*(?:team=\S+\s*)?(?:mission=\S+\s*)?(?:resolver=\S+\s*)?timestamp=/i,
  /^\s*(?:\([a-z_]+\)\s*)?(?:\[[a-z_]+\]\s*)?Task (?:completed|done)(?: by [^:]+)?:\s*\S/i,
];

/**
 * Whether a learning / log body is a content-free templated record.
 *
 * @param body - Entry body or learning text
 * @returns True when the text matches a known templated shape or is blank
 *
 * @example
 * ```typescript
 * isNoiseLogBody('(learning) [pattern] [[WorkItem-1]] task:done running→done. timestamp=2026-10-17T00:00:00Z. Source: x.'); // true
 * isNoiseLogBody('(gotcha) complete-task rejects queued→done; accept-task first.'); // false
 * ```
 */
export function isNoiseLogBody(body: string | undefined | null): boolean {
  if (!body) return true;
  const text = body.trim();
  if (text.length === 0) return true;
  return NOISE_PATTERNS.some((re) => re.test(text));
}

/**
 * Conversation handover snapshots (`**Conversation handover — <agent> — task <id>** (fact) …`)
 * that the fresh-conversation path mirrors into the vault. They are state,
 * not knowledge: a thousand of them a week on one machine. They stay in the
 * log (the agent is pointed at them) but are not knowledge for search, the
 * digest, memory or the briefing.
 *
 * @param body - Entry body
 * @returns True for a handover snapshot
 */
export function isHandoverLogBody(body: string | undefined | null): boolean {
  if (!body) return false;
  return /^\s*(?:\([a-z_-]+\)\s*)?\*\*Conversation handover\b/i.test(body.trim());
}

/**
 * Normalised form of a body used for duplicate detection: whitespace
 * collapsed, case folded, trailing punctuation dropped.
 *
 * @param body - Entry body
 * @returns Normalised text
 */
export function normalizeLogBody(body: string): string {
  return body.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.。]+$/, '');
}

/**
 * Stable key of an entry's content (sha1 of the normalised body). Two
 * entries with the same body share a key whatever their timestamps.
 *
 * @param body - Entry body
 * @returns 40-char hex digest
 */
export function logBodyKey(body: string): string {
  return createHash('sha1').update(normalizeLogBody(body)).digest('hex');
}

/**
 * Parse a whole `log.md` into entries, in file order. Text before the
 * first entry header (the preamble, a migrated learnings import) is not an
 * entry and is dropped.
 *
 * @param raw - File content
 * @returns Entries in file order
 */
export function parseLogEntries(raw: string): WikiLogEntryRecord[] {
  const matches: Array<{ idx: number; ts: string; sourceType: string; caller: string }> = [];
  HEADER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADER_RE.exec(raw))) {
    matches.push({ idx: m.index, ts: m[1], sourceType: m[2], caller: m[3].trim() });
  }
  const entries: WikiLogEntryRecord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : raw.length;
    const block = raw.slice(start, end);
    const refMatch = block.match(/^ref:\s*(.+)$/m);
    let body = '';
    if (refMatch) {
      const refLineEnd = block.indexOf(refMatch[0]) + refMatch[0].length;
      body = block.slice(refLineEnd).replace(/^\n+/, '').trim();
    } else {
      // Entries written by hand or migrated: body is everything after the header line.
      body = block.slice(block.indexOf('\n') + 1).trim();
    }
    entries.push({
      timestamp: matches[i].ts,
      timestampMs: Date.parse(matches[i].ts),
      sourceType: matches[i].sourceType,
      caller: matches[i].caller,
      ref: refMatch ? refMatch[1].trim() : '',
      body,
      raw: block.replace(/\s+$/, ''),
    });
  }
  return entries;
}

/**
 * Serialise an entry back into the append format (leading blank line,
 * header, ref line, body, trailing blank line).
 *
 * @param entry - Entry to serialise
 * @returns Markdown block
 */
export function serializeLogEntry(entry: Pick<WikiLogEntryRecord, 'timestamp' | 'sourceType' | 'caller' | 'ref' | 'body'>): string {
  return ['', `## [${entry.timestamp}] ${entry.sourceType} | ${entry.caller}`, '', `ref: ${entry.ref}`, '', entry.body, ''].join('\n');
}

/**
 * The entries from the last `days` days that carry content, newest first,
 * with duplicate bodies collapsed (the newest copy wins). Handover
 * snapshots are left out unless `includeHandovers` is set (rotation keeps
 * them; search, digest, memory and briefing do not).
 *
 * @param entries - Parsed entries (any order)
 * @param days - Window length
 * @param now - Current epoch ms
 * @param limit - Cap on returned entries
 * @param options - `includeHandovers` keeps handover snapshots
 * @returns Recent, non-noise, deduped entries, newest first
 */
export function recentContentEntries(
  entries: readonly WikiLogEntryRecord[],
  days: number,
  now: number = Date.now(),
  limit: number = Number.MAX_SAFE_INTEGER,
  options: { includeHandovers?: boolean } = {},
): WikiLogEntryRecord[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  const out: WikiLogEntryRecord[] = [];
  const sorted = [...entries].sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  for (const e of sorted) {
    if (!Number.isFinite(e.timestampMs) || e.timestampMs < cutoff) continue;
    if (isNoiseLogBody(e.body)) continue;
    if (!options.includeHandovers && isHandoverLogBody(e.body)) continue;
    const key = logBodyKey(e.body);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Vault-relative "path" of a log entry as surfaced by search:
 * `llm-curated/log.md#<ISO timestamp>`.
 *
 * @param entry - Entry
 * @returns Pseudo path
 */
export function logEntryPath(entry: Pick<WikiLogEntryRecord, 'timestamp'>): string {
  return `${WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH}${WIKI_LOG_CONSTANTS.ENTRY_PATH_SEPARATOR}${entry.timestamp}`;
}

/**
 * Whether a vault-relative path points at a log entry (as opposed to a page).
 *
 * @param relativePath - Path from a search hit
 * @returns True for `llm-curated/log.md#…`
 */
export function isLogEntryPath(relativePath: string): boolean {
  return relativePath.startsWith(`${WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH}${WIKI_LOG_CONSTANTS.ENTRY_PATH_SEPARATOR}`);
}

/**
 * The `(category)` prefix `MemoryService` puts on a mirrored memory
 * (`(gotcha) …`, `(decision) …`) or the `[tag]` an auto-recorder uses.
 *
 * @param body - Entry body
 * @returns Lower-case category, or 'learning' when none is present
 */
export function logEntryCategory(body: string): string {
  const m = body.match(/^\s*(?:\*\*[^*]+\*\*\s*)?[([]([a-z_-]+)[)\]]/i);
  return m ? m[1].toLowerCase() : 'learning';
}

/**
 * Topic of an entry for grouping in a digest: the first `[[Entity]]` link,
 * else a bold `**Title**` lead, else the category.
 *
 * @param body - Entry body
 * @returns Short topic label
 */
export function logEntryTopic(body: string): string {
  const link = body.match(/\[\[([^\]]{1,80})\]\]/);
  if (link) return link[1].trim();
  const bold = body.match(/^\s*(?:\([a-z_-]+\)\s*)?\*\*([^*]{1,80})\*\*/i);
  if (bold) return bold[1].trim();
  return logEntryCategory(body);
}
