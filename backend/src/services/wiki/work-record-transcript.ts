/**
 * Transcript facts for a work record (#1349).
 *
 * Reads a bounded tail of the doer's Claude Code transcript and keeps only
 * what happened inside the task window: failed tool calls (with whether the
 * same call later succeeded), files written, PR / commit references and
 * messages posted. Only the main chain counts (`isSidechain` entries belong
 * to subagents). Tool results are read for their error flag and the first
 * line of an exit code, never copied.
 *
 * Codex rollouts are not read (their shape differs; the trace covers them).
 *
 * @module services/wiki/work-record-transcript
 */

import * as fs from 'fs/promises';
import { WORK_RECORD_CONSTANTS } from '../../constants.js';
import { redactSensitive } from './wiki-redaction.js';
import type { WorkRecordError } from './work-record.js';

const C = WORK_RECORD_CONSTANTS;

/** What the transcript slice says about a task. */
export interface TranscriptWindowFacts {
  errors: WorkRecordError[];
  filesWritten: string[];
  urls: string[];
  commits: string[];
  /** Messages the agent posted through a reply / post skill. */
  posts: number;
  /** Tool calls seen inside the window. */
  toolCalls: number;
}

/** Task window. */
export interface TranscriptWindow {
  fromMs: number;
  toMs: number;
}

const PR_URL_RE = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|issues)\/\d+/g;
const COMMIT_LINE_RE = /^\[[^\]\s]+ (?:\(root-commit\) )?([0-9a-f]{7,12})\]/m;
const EXIT_CODE_RE = /^Exit code (\d+)/m;
const POST_SKILL_RE = /\b(?:reply-chat|reply-channel|reply|slack-post|send-chat-response|send-message|slack-file|whatsapp-send|gmail-send)\b/;
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

interface ToolUse {
  name: string;
  summary: string;
  key: string;
  at: number;
}

/**
 * Read the end of a file as whole lines (the first partial line is dropped).
 *
 * @param file - Path
 * @param maxBytes - Bytes from the end
 * @returns Text, '' when the file cannot be read
 */
export async function readTranscriptTail(file: string, maxBytes: number = C.TRANSCRIPT_TAIL_BYTES): Promise<string> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(file, 'r');
    const { size } = await handle.stat();
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    await handle.read(buf, 0, buf.length, start);
    const text = buf.toString('utf-8');
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } catch {
    return '';
  } finally {
    await handle?.close();
  }
}

/**
 * Facts from whole Claude transcript lines inside a window.
 *
 * @param text - JSONL text (whole lines)
 * @param window - Task window (epoch ms); entries outside it are ignored
 * @param roots - Project roots to make file paths relative to
 * @returns Facts (empty when nothing fell in the window)
 *
 * @example
 * ```typescript
 * const facts = parseClaudeTranscriptWindow(await readTranscriptTail(file), { fromMs, toMs }, [projectPath]);
 * facts.errors; // [{ what: 'Bash `npm test` exit 1', resolved: 'fixed' }]
 * ```
 */
export function parseClaudeTranscriptWindow(text: string, window: TranscriptWindow, roots: readonly string[] = []): TranscriptWindowFacts {
  const facts: TranscriptWindowFacts = { errors: [], filesWritten: [], urls: [], commits: [], posts: 0, toolCalls: 0 };
  const uses = new Map<string, ToolUse>();
  const failed: Array<{ use: ToolUse; at: number }> = [];
  const succeededKeys = new Map<string, number>();
  const files = new Set<string>();
  const urls = new Set<string>();
  const commits = new Set<string>();
  const from = window.fromMs - C.TRANSCRIPT_WINDOW_SLACK_MS;
  const to = window.toMs + C.TRANSCRIPT_WINDOW_SLACK_MS;

  for (const line of text.split('\n')) {
    if (line.length < 20 || !(line.includes('"tool_use"') || line.includes('"tool_result"') || line.includes('"type":"text"'))) continue;
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (entry.isSidechain === true || entry.isMeta === true || entry.isApiErrorMessage === true) continue;
    const at = Date.parse(typeof entry.timestamp === 'string' ? entry.timestamp : '');
    if (!Number.isFinite(at) || at < from || at > to) continue;
    const content = (entry.message as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content as Array<Record<string, unknown>>) {
      if (block?.type === 'tool_use' && typeof block.id === 'string' && typeof block.name === 'string') {
        const use = describeToolUse(block.name, block.input, roots, at);
        uses.set(block.id, use);
        facts.toolCalls++;
        if (FILE_TOOLS.has(block.name)) {
          const p = filePathOf(block.input);
          if (p) files.add(relative(p, roots));
        }
        if (block.name === 'Bash' && POST_SKILL_RE.test(commandOf(block.input))) facts.posts++;
      } else if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        const use = uses.get(block.tool_use_id);
        const resultText = resultTextOf(block.content);
        const exit = resultText.match(EXIT_CODE_RE);
        const nonZeroExit = exit ? Number(exit[1]) !== 0 : false;
        if (block.is_error === true || nonZeroExit) {
          if (use) failed.push({ use: exit && nonZeroExit ? { ...use, summary: `${use.summary} exit ${exit[1]}` } : use, at });
        } else if (use) {
          succeededKeys.set(use.key, at);
        }
        for (const u of resultText.match(PR_URL_RE) ?? []) urls.add(u);
        const commit = resultText.match(COMMIT_LINE_RE);
        if (commit && use?.name === 'Bash' && /\bgit\s+commit\b/.test(use.summary)) commits.add(commit[1]);
      } else if (block?.type === 'text' && typeof block.text === 'string' && entry.type === 'assistant') {
        for (const u of block.text.match(PR_URL_RE) ?? []) urls.add(u);
      }
    }
  }

  const seen = new Set<string>();
  for (const f of failed) {
    const what = redactSensitive(f.use.summary);
    if (seen.has(what)) continue;
    seen.add(what);
    const later = succeededKeys.get(f.use.key);
    facts.errors.push({ what, resolved: later !== undefined && later > f.at ? 'fixed' : 'unresolved' });
    if (facts.errors.length >= C.MAX_ERRORS) break;
  }
  facts.filesWritten = [...files].slice(0, C.MAX_OUTPUTS);
  facts.urls = [...urls].slice(0, C.MAX_OUTPUTS);
  facts.commits = [...commits].slice(0, C.MAX_OUTPUTS);
  return facts;
}

/**
 * Whether a transcript is worth reading for an item that ended at `endedMs`:
 * the tail only holds recent turns.
 *
 * @param endedMs - When the item ended (epoch ms)
 * @param now - Clock
 * @returns True when the window may still be in the tail
 */
export function transcriptWorthReading(endedMs: number, now: number = Date.now()): boolean {
  return Number.isFinite(endedMs) && now - endedMs <= C.TRANSCRIPT_MAX_AGE_MS;
}

// ---------------------------------------------------------------------------

function describeToolUse(name: string, input: unknown, roots: readonly string[], at: number): ToolUse {
  if (name === 'Bash') {
    const command = commandOf(input).replace(/\s+/g, ' ').trim();
    const shown = command.length > 80 ? `${command.slice(0, 79)}…` : command;
    return { name, summary: `Bash \`${shown}\``, key: `Bash:${command.slice(0, 200)}`, at };
  }
  const p = filePathOf(input);
  if (p) return { name, summary: `${name} ${relative(p, roots)}`, key: `${name}:${p}`, at };
  return { name, summary: `${name} call`, key: `${name}:`, at };
}

function commandOf(input: unknown): string {
  const c = (input as { command?: unknown } | undefined)?.command;
  return typeof c === 'string' ? c : '';
}

function filePathOf(input: unknown): string | null {
  const p = (input as { file_path?: unknown; notebook_path?: unknown; path?: unknown } | undefined);
  const v = p?.file_path ?? p?.notebook_path ?? p?.path;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function relative(file: string, roots: readonly string[]): string {
  for (const root of roots) {
    if (root && file.startsWith(`${root}/`)) return file.slice(root.length + 1);
  }
  return file;
}

function resultTextOf(content: unknown): string {
  if (typeof content === 'string') return content.slice(0, 4_000);
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof (c as { text?: unknown })?.text === 'string' ? ((c as { text: string }).text) : ''))
      .join('\n')
      .slice(0, 4_000);
  }
  return '';
}
