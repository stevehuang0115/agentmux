/**
 * StartupBriefingService — the knowledge part of an agent's registration
 * prompt (#1345).
 *
 * Registration already injects "what am I on the hook for" (active work)
 * and the session memory (last summary, memory context, today's log). This
 * module adds what was missing, in one size-capped section:
 *
 *   1. the project's wiki: the one-line index (trimmed) and the most
 *      recently changed topic pages (title + summary);
 *   2. the agent's lessons from the last `LESSONS_DAYS` days: its role
 *      knowledge plus its own entries in the project and global vault logs;
 *   3. open owner threads the agent is part of, from the owner-thread
 *      sentinel (an unanswered owner message, a standing promise, an open
 *      approval card).
 *
 * All reads are plain files or in-memory state; no LLM, no retrieval
 * ranking. The whole section is capped at `MAX_CHARS`; when over budget
 * the index is trimmed first, then recent pages, then lessons — owner
 * threads are never cut.
 *
 * @module services/memory/startup-briefing.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { STARTUP_BRIEFING_CONSTANTS, WIKI_LOG_CONSTANTS } from '../../constants.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { AgentMemoryService, type IAgentMemoryService } from './agent-memory.service.js';
import { WikiIndexService, type WikiIndexEntry } from '../wiki/wiki-index.service.js';
import { WikiRecentService, type WikiRecentEntry } from '../wiki/wiki-recent.service.js';
import { isSeedFile, isLogArchivePath } from '../wiki/wiki-vault-walk.js';
import { parsePage } from '../wiki/wiki-page.js';
import { logBodyKey, parseLogEntries, recentContentEntries } from '../wiki/wiki-log-entries.js';
import { getOwnerThreadSentinel, type OwnerThreadEntry } from '../messaging/owner-thread-sentinel.service.js';

/** Input to {@link StartupBriefingService.build}. */
export interface StartupBriefingInput {
  sessionName: string;
  role: string;
  projectPath: string;
}

/** Narrow surfaces the service reads (overridable in tests). */
export interface StartupBriefingDeps {
  agentMemory?: IAgentMemoryService;
  index?: WikiIndexService;
  recent?: WikiRecentService;
  /** Owner-thread entries (default: the live sentinel's `list()`). */
  listOwnerThreads?: () => OwnerThreadEntry[];
  /** Global vault path (default `<CREWLY_HOME>/global-wiki`). */
  globalVaultPath?: string;
  /** Clock (tests). */
  now?: () => number;
}

/** One lesson line. */
interface Lesson {
  at: number;
  text: string;
  source: string;
}

/**
 * Builds the `## Your Project Knowledge` section. Stateless singleton.
 */
export class StartupBriefingService {
  private static instance: StartupBriefingService | null = null;
  private readonly logger: ComponentLogger;
  private readonly agentMemory: IAgentMemoryService;
  private readonly index: WikiIndexService;
  private readonly recent: WikiRecentService;
  private readonly listOwnerThreads: () => OwnerThreadEntry[];
  private readonly globalVaultPath: string;
  private readonly nowFn: () => number;

  constructor(deps: StartupBriefingDeps = {}) {
    this.logger = LoggerService.getInstance().createComponentLogger('StartupBriefing');
    this.agentMemory = deps.agentMemory ?? AgentMemoryService.getInstance();
    this.index = deps.index ?? WikiIndexService.getInstance();
    this.recent = deps.recent ?? WikiRecentService.getInstance();
    this.listOwnerThreads = deps.listOwnerThreads ?? (() => getOwnerThreadSentinel()?.list() ?? []);
    this.globalVaultPath = deps.globalVaultPath ?? path.join(getCrewlyHomePath(), 'global-wiki');
    this.nowFn = deps.now ?? (() => Date.now());
  }

  static getInstance(): StartupBriefingService {
    if (!this.instance) this.instance = new StartupBriefingService();
    return this.instance;
  }

  /** Test-only reset. */
  static _resetForTesting(): void {
    this.instance = null;
  }

  /**
   * Build the section. Returns '' when there is nothing to say (no vault,
   * no lessons, no threads), so the caller can skip it.
   *
   * @param input - Agent session, role and project
   * @returns Markdown section capped at `STARTUP_BRIEFING_CONSTANTS.MAX_CHARS`, or ''
   *
   * @example
   * ```typescript
   * const md = await StartupBriefingService.getInstance().build({ sessionName, role, projectPath });
   * if (md) prompt += `\n\n---\n\n${md}`;
   * ```
   */
  async build(input: StartupBriefingInput): Promise<string> {
    const now = this.nowFn();
    const vaultPath = path.join(input.projectPath, '.crewly', 'wiki');
    const hasVault = existsSync(path.join(vaultPath, 'SCHEMA.md'));

    const [indexMd, pagesMd, lessonsMd, threadsMd] = await Promise.all([
      hasVault ? this.renderIndex(vaultPath) : Promise.resolve(''),
      hasVault ? this.renderRecentPages(vaultPath) : Promise.resolve(''),
      this.renderLessons(input.sessionName, hasVault ? vaultPath : null, now),
      Promise.resolve(this.renderOwnerThreads(input.sessionName, now)),
    ]);

    const parts: Array<{ key: 'index' | 'pages' | 'lessons' | 'threads'; md: string }> = [];
    if (threadsMd) parts.push({ key: 'threads', md: threadsMd });
    if (lessonsMd) parts.push({ key: 'lessons', md: lessonsMd });
    if (pagesMd) parts.push({ key: 'pages', md: pagesMd });
    if (indexMd) parts.push({ key: 'index', md: indexMd });
    if (parts.length === 0) return '';

    const sections = this.fitToBudget(parts);
    const md = [
      STARTUP_BRIEFING_CONSTANTS.HEADING,
      '',
      'Read before acting: what this project already knows, what you learned recently, and which owner threads are waiting on you. Use `wiki-query` / `recall` for anything not listed.',
      '',
      ...sections,
    ].join('\n').trim();
    this.logger.debug('Startup knowledge briefing built', { sessionName: input.sessionName, chars: md.length, parts: parts.map((p) => p.key) });
    return md;
  }

  // ---------------------------------------------------------------------------

  /**
   * Drop content until the whole section fits `MAX_CHARS`: the index is
   * trimmed first (it is the cheapest to re-fetch with `wiki-query`), then
   * recent pages, then lessons. Owner threads are never cut.
   */
  private fitToBudget(parts: Array<{ key: 'index' | 'pages' | 'lessons' | 'threads'; md: string }>): string[] {
    const headerChars = STARTUP_BRIEFING_CONSTANTS.HEADING.length + 200;
    const total = (): number => parts.reduce((n, p) => n + p.md.length + 2, headerChars);
    for (const key of ['index', 'pages', 'lessons'] as const) {
      if (total() <= STARTUP_BRIEFING_CONSTANTS.MAX_CHARS) break;
      const i = parts.findIndex((p) => p.key === key);
      if (i < 0) continue;
      const over = total() - STARTUP_BRIEFING_CONSTANTS.MAX_CHARS;
      const kept = parts[i].md.length - over - 40;
      if (kept > 200) {
        parts[i].md = `${parts[i].md.slice(0, kept).replace(/\n[^\n]*$/, '')}\n- … (trimmed to fit)`;
      } else {
        parts.splice(i, 1);
      }
    }
    return parts.map((p) => p.md);
  }

  /**
   * `### Project wiki index` — one line per page, capped.
   */
  private async renderIndex(vaultPath: string): Promise<string> {
    let entries: WikiIndexEntry[];
    try {
      entries = (await this.index.read(vaultPath)).entries.filter((e) => !e.supersededBy);
    } catch {
      return '';
    }
    if (entries.length === 0) return '';
    const lines: string[] = [];
    let chars = 0;
    for (const e of entries) {
      const line = `- ${e.relativePath}: ${e.title}${e.summary ? ` — ${this.clip(e.summary, STARTUP_BRIEFING_CONSTANTS.PAGE_SUMMARY_MAX_CHARS)}` : ''}`;
      if (chars + line.length > STARTUP_BRIEFING_CONSTANTS.INDEX_MAX_CHARS) {
        lines.push(`- … ${entries.length - lines.length} more pages; read \`llm-curated/index.md\` or call \`wiki-query\`.`);
        break;
      }
      lines.push(line);
      chars += line.length + 1;
    }
    return [`### Project wiki index (${entries.length} pages)`, '', ...lines].join('\n');
  }

  /**
   * `### Recently changed pages` — the most recently modified topic pages
   * with their title and summary.
   */
  private async renderRecentPages(vaultPath: string): Promise<string> {
    let recent: WikiRecentEntry[];
    try {
      const out = await this.recent.list({ vaultPath, limit: STARTUP_BRIEFING_CONSTANTS.RECENT_PAGES * 4 });
      if (!out.ok) return '';
      recent = out.entries;
    } catch {
      return '';
    }
    const pages = recent
      .filter((e) => e.llmCurated && !isSeedFile(e.relativePath) && !isLogArchivePath(e.relativePath) && !e.relativePath.startsWith('llm-curated/_proposed/'))
      .slice(0, STARTUP_BRIEFING_CONSTANTS.RECENT_PAGES);
    if (pages.length === 0) return '';
    const lines: string[] = [];
    for (const p of pages) {
      let title = path.basename(p.relativePath, '.md');
      let summary = '';
      try {
        const { frontmatter } = parsePage(await fs.readFile(path.join(vaultPath, p.relativePath), 'utf8'));
        if (frontmatter.superseded_by) continue;
        if (frontmatter.title) title = frontmatter.title;
        if (frontmatter.summary) summary = frontmatter.summary;
      } catch {
        // unreadable page: list it by name only
      }
      lines.push(`- ${p.relativePath} (${p.modifiedAt.slice(0, 10)}): ${title}${summary ? ` — ${this.clip(summary, STARTUP_BRIEFING_CONSTANTS.PAGE_SUMMARY_MAX_CHARS)}` : ''}`);
    }
    return lines.length ? ['### Recently changed pages', '', ...lines].join('\n') : '';
  }

  /**
   * `### Your lessons (last N days)` — role knowledge and the agent's own
   * vault log entries, newest first, deduped, capped.
   */
  private async renderLessons(sessionName: string, projectVault: string | null, now: number): Promise<string> {
    const cutoff = now - STARTUP_BRIEFING_CONSTANTS.LESSONS_DAYS * 86_400_000;
    const lessons: Lesson[] = [];
    const seen = new Set<string>();
    const push = (l: Lesson): void => {
      const key = logBodyKey(l.text);
      if (seen.has(key)) return;
      seen.add(key);
      lessons.push(l);
    };

    try {
      for (const k of await this.agentMemory.getRoleKnowledge(sessionName)) {
        const at = Date.parse(k.createdAt);
        if (!Number.isFinite(at) || at < cutoff || k.superseded) continue;
        push({ at, text: k.content, source: 'memory' });
      }
    } catch {
      // an agent without memory yet has no lessons
    }

    for (const vault of [projectVault, this.globalVaultPath]) {
      if (!vault) continue;
      const logAbs = path.join(vault, WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH);
      let raw: string;
      try {
        raw = await fs.readFile(logAbs, 'utf8');
      } catch {
        continue;
      }
      for (const e of recentContentEntries(parseLogEntries(raw), STARTUP_BRIEFING_CONSTANTS.LESSONS_DAYS, now)) {
        if (e.caller !== sessionName) continue;
        push({ at: e.timestampMs, text: e.body, source: vault === projectVault ? 'project log' : 'global log' });
      }
    }
    if (lessons.length === 0) return '';
    lessons.sort((a, b) => b.at - a.at);
    const lines = lessons
      .slice(0, STARTUP_BRIEFING_CONSTANTS.LESSONS_MAX)
      .map((l) => `- ${new Date(l.at).toISOString().slice(0, 10)} (${l.source}): ${this.clip(l.text.replace(/\s+/g, ' ').trim(), STARTUP_BRIEFING_CONSTANTS.LESSON_MAX_CHARS)}`);
    return [`### Your lessons (last ${STARTUP_BRIEFING_CONSTANTS.LESSONS_DAYS} days)`, '', ...lines].join('\n');
  }

  /**
   * `### Owner threads waiting on you` — threads where the owner's latest
   * message is unanswered, a promise of yours is standing, or a card is open.
   */
  private renderOwnerThreads(sessionName: string, now: number): string {
    let entries: OwnerThreadEntry[];
    try {
      entries = this.listOwnerThreads().filter((e) => e.agent === sessionName);
    } catch {
      return '';
    }
    const open = entries
      .filter((e) => {
        const unanswered = typeof e.ownerAt === 'number' && e.ownerAt > (e.agentPostAt ?? 0);
        const promise = !!e.promise && !e.promise.parkedWorkItemId;
        return unanswered || promise || e.cards.length > 0;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, STARTUP_BRIEFING_CONSTANTS.THREADS_MAX);
    if (open.length === 0) return '';
    const lines = open.map((e) => {
      const where = e.threadTs ? `Slack ${e.slackChannelId}, thread ${e.threadTs}` : `Slack DM ${e.slackChannelId}`;
      const why: string[] = [];
      if (typeof e.ownerAt === 'number' && e.ownerAt > (e.agentPostAt ?? 0)) why.push(`owner message unanswered for ${this.age(now - e.ownerAt)}`);
      if (e.promise && !e.promise.parkedWorkItemId) why.push(`you promised something ${this.age(now - e.promise.at)} ago`);
      if (e.cards.length > 0) why.push(`${e.cards.length} approval card(s) open`);
      const preview = e.agentPreview ? ` — your last post: "${this.clip(e.agentPreview.replace(/\s+/g, ' ').trim(), STARTUP_BRIEFING_CONSTANTS.THREAD_PREVIEW_MAX_CHARS)}"` : '';
      return `- ${where}: ${why.join('; ')}${preview}`;
    });
    return ['### Owner threads waiting on you', '', ...lines, '', 'Reply in the thread first; the owner reads threads, not status lines.'].join('\n');
  }

  private age(ms: number): string {
    const minutes = Math.max(0, Math.round(ms / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} d`;
  }

  private clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }
}
