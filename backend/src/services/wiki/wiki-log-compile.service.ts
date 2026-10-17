/**
 * WikiLogCompileService — turns the week's log entries into a digest page.
 *
 * Agents append learnings to `llm-curated/log.md` and nothing ever read
 * them back (#1345): bookkeep waited for ten net-new *pages* and reflect
 * fed a queue nobody drained. This service does the deterministic half of
 * "compile": once a day it takes the non-noise, not-yet-compiled entries
 * of the last `COMPILE_WINDOW_DAYS`, groups them by category and topic,
 * and writes (or appends to) one page per vault and ISO week under
 * `llm-curated/digests/`, through the normal ingest path so the page gets
 * frontmatter, an index line and history. Compiled entries are remembered
 * by body key in `<vault>/.wiki-compile-state.json` so a later run does
 * not compile them again. No LLM; an agent can still rewrite a digest into
 * a proper topic page.
 *
 * @module services/wiki/wiki-log-compile.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { WIKI_LOG_CONSTANTS } from '../../constants.js';
import { atomicWriteJson, safeReadJson } from '../../utils/file-io.utils.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import {
  logBodyKey,
  logEntryCategory,
  logEntryTopic,
  parseLogEntries,
  recentContentEntries,
  type WikiLogEntryRecord,
} from './wiki-log-entries.js';

/** Persisted per-vault compile bookkeeping. */
interface CompileState {
  /** Body keys already compiled, oldest first (bounded). */
  compiledKeys: string[];
  /** ISO time of the last page write. */
  lastCompiledAt: string | null;
}

/** Options for {@link WikiLogCompileService.compile}. */
export interface WikiLogCompileOptions {
  /** Report only; write nothing (page or state). */
  dryRun?: boolean;
  /** Clock (tests). */
  now?: number;
  /** Window override (tests). */
  windowDays?: number;
  /** Minimum-entries override (tests). */
  minEntries?: number;
}

/** Outcome of one vault's compile. */
export interface WikiLogCompileResult {
  vaultPath: string;
  /** False when the log is missing, too few new entries, or ingest refused the page. */
  compiled: boolean;
  reason?: 'no_log' | 'too_few_entries' | 'ingest_refused';
  /** Uncompiled non-noise entries found in the window. */
  candidates: number;
  /** Entries written into the digest. */
  entriesCompiled: number;
  /** Vault-relative digest page (planned in a dry run). */
  pagePath?: string;
  /** Topic groups written. */
  groups: number;
  dryRun: boolean;
}

/**
 * ISO-8601 week label (`YYYY-Www`) of a date.
 *
 * @param ms - Epoch ms
 * @returns Label such as `2026-W42`
 */
export function isoWeekLabel(ms: number): string {
  const d = new Date(ms);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of the current week decides the ISO year.
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Compiles vault log entries into weekly digest pages. Stateless singleton
 * apart from the per-vault state file.
 */
export class WikiLogCompileService {
  private static instance: WikiLogCompileService | null = null;
  private readonly logger: ComponentLogger;

  constructor(private readonly ingest: WikiIngestService = WikiIngestService.getInstance()) {
    this.logger = LoggerService.getInstance().createComponentLogger('WikiLogCompile');
  }

  static getInstance(): WikiLogCompileService {
    if (!this.instance) this.instance = new WikiLogCompileService();
    return this.instance;
  }

  /** Test-only reset. */
  static _resetForTesting(): void {
    this.instance = null;
  }

  /**
   * Compile one vault's uncompiled recent entries into this week's digest.
   *
   * @param vaultPath - Vault root
   * @param opts - Dry run, clock and threshold overrides
   * @returns What was (or would be) written
   *
   * @example
   * ```typescript
   * const r = await WikiLogCompileService.getInstance().compile(vault);
   * // r.compiled && r.pagePath === 'llm-curated/digests/2026-W42.md'
   * ```
   */
  async compile(vaultPath: string, opts: WikiLogCompileOptions = {}): Promise<WikiLogCompileResult> {
    const dryRun = opts.dryRun === true;
    const now = opts.now ?? Date.now();
    const windowDays = opts.windowDays ?? WIKI_LOG_CONSTANTS.COMPILE_WINDOW_DAYS;
    const minEntries = opts.minEntries ?? WIKI_LOG_CONSTANTS.COMPILE_MIN_ENTRIES;
    const base: WikiLogCompileResult = { vaultPath, compiled: false, candidates: 0, entriesCompiled: 0, groups: 0, dryRun };

    let raw: string;
    try {
      raw = await fs.readFile(path.join(vaultPath, WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH), 'utf8');
    } catch {
      return { ...base, reason: 'no_log' };
    }

    const state = await this.readState(vaultPath);
    const done = new Set(state.compiledKeys);
    const candidates = recentContentEntries(parseLogEntries(raw), windowDays, now)
      .filter((e) => !done.has(logBodyKey(e.body)))
      .sort((a, b) => a.timestampMs - b.timestampMs)
      .slice(0, WIKI_LOG_CONSTANTS.COMPILE_MAX_ENTRIES);
    base.candidates = candidates.length;
    if (candidates.length < minEntries) return { ...base, reason: 'too_few_entries' };

    const week = isoWeekLabel(now);
    const pagePath = `${WIKI_LOG_CONSTANTS.COMPILE_DIR}/${week}.md`;
    const groups = this.group(candidates);
    const body = this.renderBody(groups, candidates, now);
    const result: WikiLogCompileResult = { ...base, compiled: true, entriesCompiled: candidates.length, pagePath, groups: groups.length };

    if (dryRun) {
      this.logger.info('WikiLogCompile dry run — would write digest', { vaultPath, pagePath, entries: candidates.length, groups: groups.length });
      return result;
    }

    const counts = this.categoryCounts(candidates);
    const outcome = await this.ingest.ingest({
      vaultPath,
      sourceType: 'record_learning',
      sourceRef: `wiki-log-compile:${week}:${new Date(now).toISOString()}`,
      sourceBody: body,
      callerSession: 'system:wiki-log-compile',
      targetRelativePath: pagePath,
      title: `Digest ${week}`,
      summary: `${candidates.length} learnings from the vault log (${counts}) compiled ${new Date(now).toISOString().slice(0, 10)} — read before working on these topics; promote what still matters to its own page.`,
      keepBecause: 'reusable_method',
      tags: ['digest', week],
    });
    if (!outcome.ok) {
      this.logger.warn('WikiLogCompile: ingest refused the digest page (non-fatal)', { vaultPath, pagePath, reason: outcome.reason });
      return { ...base, reason: 'ingest_refused', candidates: candidates.length };
    }

    const keys = [...state.compiledKeys, ...candidates.map((e) => logBodyKey(e.body))];
    await this.writeState(vaultPath, {
      compiledKeys: keys.slice(-WIKI_LOG_CONSTANTS.COMPILE_STATE_MAX_KEYS),
      lastCompiledAt: new Date(now).toISOString(),
    });
    this.logger.info('WikiLogCompile wrote digest', { vaultPath, pagePath, entries: candidates.length, groups: groups.length });
    return result;
  }

  /**
   * Compile every vault in a list; failures are logged per vault.
   *
   * @param vaults - Vault roots
   * @param opts - Passed to {@link compile}
   * @returns One result per vault checked
   */
  async compileAll(vaults: readonly string[], opts: WikiLogCompileOptions = {}): Promise<WikiLogCompileResult[]> {
    const out: WikiLogCompileResult[] = [];
    for (const vaultPath of vaults) {
      try {
        out.push(await this.compile(vaultPath, opts));
      } catch (err) {
        this.logger.warn('WikiLogCompile failed for vault (non-fatal)', { vaultPath, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------

  /**
   * Group entries by `<category> / <topic>`, largest groups first, stable
   * within a group (oldest first).
   *
   * @param entries - Candidate entries
   * @returns Groups with a label and members
   */
  private group(entries: readonly WikiLogEntryRecord[]): Array<{ label: string; members: WikiLogEntryRecord[] }> {
    const byLabel = new Map<string, WikiLogEntryRecord[]>();
    for (const e of entries) {
      const category = logEntryCategory(e.body);
      const topic = logEntryTopic(e.body);
      const label = topic.toLowerCase() === category ? category : `${category} / ${topic}`;
      const list = byLabel.get(label) ?? [];
      list.push(e);
      byLabel.set(label, list);
    }
    return [...byLabel.entries()]
      .map(([label, members]) => ({ label, members }))
      .sort((a, b) => b.members.length - a.members.length || a.label.localeCompare(b.label));
  }

  /**
   * `k gotchas, m decisions, …` for the page summary.
   *
   * @param entries - Entries
   * @returns Comma-separated counts, most frequent first
   */
  private categoryCounts(entries: readonly WikiLogEntryRecord[]): string {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const c = logEntryCategory(e.body);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${n} ${c}`)
      .join(', ');
  }

  /**
   * Markdown body of one compile run: a dated heading, then one `###` per
   * group with one bullet per entry (author, date, body clipped).
   *
   * @param groups - Grouped entries
   * @param all - All entries in the run (for the date range)
   * @param now - Epoch ms of the run
   * @returns Markdown
   */
  private renderBody(groups: ReadonlyArray<{ label: string; members: WikiLogEntryRecord[] }>, all: readonly WikiLogEntryRecord[], now: number): string {
    const first = all[0]?.timestamp.slice(0, 10) ?? '';
    const last = all[all.length - 1]?.timestamp.slice(0, 10) ?? '';
    const lines: string[] = [`## Compiled ${new Date(now).toISOString().slice(0, 10)} — ${all.length} entries from ${first} to ${last}`, ''];
    for (const g of groups) {
      lines.push(`### ${g.label} (${g.members.length})`, '');
      for (const e of g.members) {
        const body = e.body.replace(/\s+/g, ' ').trim();
        const clipped = body.length > WIKI_LOG_CONSTANTS.COMPILE_ENTRY_MAX_CHARS ? `${body.slice(0, WIKI_LOG_CONSTANTS.COMPILE_ENTRY_MAX_CHARS - 1)}…` : body;
        lines.push(`- ${e.timestamp.slice(0, 10)} · ${e.caller}: ${clipped}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  private statePath(vaultPath: string): string {
    return path.join(vaultPath, WIKI_LOG_CONSTANTS.COMPILE_STATE_FILE);
  }

  private async readState(vaultPath: string): Promise<CompileState> {
    const data = await safeReadJson<Partial<CompileState> | null>(this.statePath(vaultPath), null);
    return {
      compiledKeys: Array.isArray(data?.compiledKeys) ? data.compiledKeys.filter((k): k is string => typeof k === 'string') : [],
      lastCompiledAt: typeof data?.lastCompiledAt === 'string' ? data.lastCompiledAt : null,
    };
  }

  private async writeState(vaultPath: string, state: CompileState): Promise<void> {
    await atomicWriteJson(this.statePath(vaultPath), state);
  }
}
