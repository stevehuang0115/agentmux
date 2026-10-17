/**
 * AgentMemoryRefreshService — daily reconciliation of what an agent learned.
 *
 * Why (#1345): `memory.json` only moved when an agent called remember or
 * record-learning with a role-relevant text, and the consolidation sweep
 * wrote an empty report. Meanwhile the agent's real lessons were piling up
 * in the vault activity logs (`llm-curated/log.md`, entries whose caller is
 * the agent) where nothing read them back.
 *
 * What this does, once a day per active agent and on a delayed boot
 * catch-up, without an LLM:
 *   - reads the agent's own non-noise log entries since its last run (first
 *     run: the last `LOOKBACK_MS`) from the project vault it works in and
 *     the global vault;
 *   - reflects each into `memory.json` role knowledge (category from the
 *     entry's `(gotcha)` / `(decision)` / `(pattern)` prefix; duplicates
 *     reinforce the existing entry, so a re-run is idempotent), capped per
 *     run;
 *   - writes gotchas and decisions into the project's memory
 *     (`knowledge/gotchas.json`, `knowledge/decisions.json`), which the
 *     project context at startup is built from.
 * `standing.md` stays agent-written: the moved memory watermark is what
 * raises the existing standing-refresh WorkItem.
 *
 * `CREWLY_AGENT_MEMORY_REFRESH=false` disables it.
 *
 * @module services/memory/agent-memory-refresh.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { AGENT_MEMORY_REFRESH_CONSTANTS, WIKI_LOG_CONSTANTS } from '../../constants.js';
import { atomicWriteJson, safeReadJson, ensureDir } from '../../utils/file-io.utils.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import type { RoleKnowledgeCategory } from '../../types/memory.types.js';
import { AgentMemoryService, type IAgentMemoryService } from './agent-memory.service.js';
import { ProjectMemoryService } from './project-memory.service.js';
import {
  logBodyKey,
  logEntryCategory,
  logEntryTopic,
  parseLogEntries,
  recentContentEntries,
  type WikiLogEntryRecord,
} from '../wiki/wiki-log-entries.js';

/** An agent the refresh should consider. */
export interface RefreshableAgent {
  sessionName: string;
  role: string;
  /** Project the agent works in (its vault is `<projectPath>/.crewly/wiki`); absent for the orchestrator, which only has the global vault. */
  projectPath?: string;
}

/** Project-memory writer surface the refresh needs (narrow for tests). */
export interface ProjectMemoryWriterLike {
  addGotcha(projectPath: string, gotcha: { title: string; problem: string; solution: string; severity: 'low' | 'medium' | 'high' | 'critical'; discoveredBy: string }): Promise<string>;
  addDecision(projectPath: string, decision: { title: string; decision: string; rationale: string; decidedBy: string }): Promise<string>;
}

/** Options for {@link AgentMemoryRefreshService}. */
export interface AgentMemoryRefreshOptions {
  /** Active agents to refresh. */
  listAgents: () => Promise<RefreshableAgent[]>;
  /** Interval between runs (default 24 h). */
  intervalMs?: number;
  /** Delay before the boot-time catch-up run (default 2 min). */
  bootDelayMs?: number;
  /** State file (default under CREWLY_HOME). `null` keeps state in memory (tests). */
  statePath?: string | null;
  /** Global vault path override (default `<CREWLY_HOME>/global-wiki`). */
  globalVaultPath?: string;
  /** Service overrides (tests). */
  agentMemory?: IAgentMemoryService;
  projectMemory?: ProjectMemoryWriterLike;
  /** Clock (tests). */
  now?: () => number;
}

/** Persisted state: last run per agent. */
interface RefreshState {
  lastRunAt: Record<string, string>;
}

/** Outcome for one agent. */
export interface AgentRefreshOutcome {
  sessionName: string;
  /** Entries considered after noise/dedupe filters. */
  candidates: number;
  /** Role-knowledge entries added or reinforced. */
  knowledge: number;
  /** Gotchas/decisions written into project memory. */
  projectMemory: number;
  /** Why nothing happened (when it did not). */
  skipped?: 'no_memory' | 'no_entries';
}

/**
 * Daily agent-memory refresh. Start at boot, stop at shutdown.
 */
export class AgentMemoryRefreshService {
  private static instance: AgentMemoryRefreshService | null = null;
  private readonly logger: ComponentLogger;
  private readonly listAgents: () => Promise<RefreshableAgent[]>;
  private readonly intervalMs: number;
  private readonly bootDelayMs: number;
  private readonly statePath: string | null;
  private readonly globalVaultPath: string;
  private readonly agentMemory: IAgentMemoryService;
  private readonly projectMemory: ProjectMemoryWriterLike;
  private readonly nowFn: () => number;
  private timer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  private running = false;
  private state: RefreshState = { lastRunAt: {} };
  private stateLoaded = false;

  constructor(opts: AgentMemoryRefreshOptions) {
    this.logger = LoggerService.getInstance().createComponentLogger('AgentMemoryRefresh');
    this.listAgents = opts.listAgents;
    this.intervalMs = opts.intervalMs ?? AGENT_MEMORY_REFRESH_CONSTANTS.INTERVAL_MS;
    this.bootDelayMs = opts.bootDelayMs ?? AGENT_MEMORY_REFRESH_CONSTANTS.BOOT_DELAY_MS;
    this.statePath = opts.statePath === null ? null : opts.statePath ?? path.join(getCrewlyHomePath(), AGENT_MEMORY_REFRESH_CONSTANTS.STATE_FILE);
    this.globalVaultPath = opts.globalVaultPath ?? path.join(getCrewlyHomePath(), 'global-wiki');
    this.agentMemory = opts.agentMemory ?? AgentMemoryService.getInstance();
    this.projectMemory = opts.projectMemory ?? ProjectMemoryService.getInstance();
    this.nowFn = opts.now ?? (() => Date.now());
  }

  static getInstance(): AgentMemoryRefreshService | null {
    return this.instance;
  }

  /** Wire / detach the production singleton. */
  static setInstance(next: AgentMemoryRefreshService | null): void {
    if (this.instance && this.instance !== next) this.instance.stop();
    this.instance = next;
  }

  /**
   * Begin the schedule: a delayed boot run, then every `intervalMs`.
   * Idempotent. Returns false when the kill switch is set.
   *
   * @returns Whether the schedule started
   */
  start(): boolean {
    if (this.timer) return true;
    if (process.env[AGENT_MEMORY_REFRESH_CONSTANTS.ENV_KILL_SWITCH] === 'false') {
      this.logger.warn(`AgentMemoryRefresh disabled via ${AGENT_MEMORY_REFRESH_CONSTANTS.ENV_KILL_SWITCH}=false — not starting`);
      return false;
    }
    this.bootTimer = setTimeout(() => {
      this.bootTimer = null;
      void this.runOnce();
    }, this.bootDelayMs);
    this.bootTimer.unref?.();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    this.logger.info('AgentMemoryRefresh started', { intervalMs: this.intervalMs, bootDelayMs: this.bootDelayMs });
    return true;
  }

  /** Stop the schedule. Safe to call more than once. */
  stop(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('AgentMemoryRefresh stopped');
    }
  }

  /**
   * One pass over every active agent whose last run is older than the
   * interval (or `force`). Public for tests and an on-demand run.
   *
   * @param opts - `force` refreshes every agent regardless of its last run
   * @returns One outcome per agent refreshed
   */
  async runOnce(opts: { force?: boolean } = {}): Promise<AgentRefreshOutcome[]> {
    if (this.running) {
      this.logger.debug('AgentMemoryRefresh already running — skipping overlap');
      return [];
    }
    this.running = true;
    const outcomes: AgentRefreshOutcome[] = [];
    try {
      await this.loadState();
      const now = this.nowFn();
      let agents: RefreshableAgent[];
      try {
        agents = await this.listAgents();
      } catch (err) {
        this.logger.warn('AgentMemoryRefresh: listAgents failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
        return [];
      }
      for (const agent of agents) {
        const lastRun = Date.parse(this.state.lastRunAt[agent.sessionName] ?? '');
        if (!opts.force && Number.isFinite(lastRun) && now - lastRun < this.intervalMs) continue;
        try {
          const outcome = await this.refreshAgent(agent, Number.isFinite(lastRun) ? lastRun : now - AGENT_MEMORY_REFRESH_CONSTANTS.LOOKBACK_MS, now);
          outcomes.push(outcome);
          if (outcome.skipped !== 'no_memory') this.state.lastRunAt[agent.sessionName] = new Date(now).toISOString();
        } catch (err) {
          this.logger.warn('AgentMemoryRefresh: agent failed (non-fatal)', { sessionName: agent.sessionName, error: err instanceof Error ? err.message : String(err) });
        }
      }
      await this.saveState();
      const touched = outcomes.filter((o) => o.knowledge + o.projectMemory > 0);
      if (outcomes.length > 0) {
        this.logger.info('AgentMemoryRefresh pass', {
          agents: outcomes.length,
          touched: touched.map((o) => ({ agent: o.sessionName, knowledge: o.knowledge, projectMemory: o.projectMemory })),
        });
      }
      return outcomes;
    } finally {
      this.running = false;
    }
  }

  /**
   * Refresh one agent from its log entries written between `since` and `now`.
   *
   * @param agent - Agent to refresh
   * @param since - Epoch ms lower bound (exclusive of older entries)
   * @param now - Epoch ms upper bound
   * @returns Counts
   */
  async refreshAgent(agent: RefreshableAgent, since: number, now: number): Promise<AgentRefreshOutcome> {
    const outcome: AgentRefreshOutcome = { sessionName: agent.sessionName, candidates: 0, knowledge: 0, projectMemory: 0 };
    const memory = await this.agentMemory.getAgentMemory(agent.sessionName);
    if (!memory) return { ...outcome, skipped: 'no_memory' };

    const vaults = agent.projectPath ? [path.join(agent.projectPath, '.crewly', 'wiki'), this.globalVaultPath] : [this.globalVaultPath];
    const entries = await this.ownEntries(agent.sessionName, vaults, since, now);
    outcome.candidates = entries.length;
    if (entries.length === 0) return { ...outcome, skipped: 'no_entries' };

    let added = 0;
    for (const entry of entries) {
      if (added >= AGENT_MEMORY_REFRESH_CONSTANTS.MAX_ENTRIES_PER_AGENT) break;
      const category = logEntryCategory(entry.body);
      const content = this.clip(this.stripPrefix(entry.body));
      if (!content) continue;
      try {
        await this.agentMemory.addRoleKnowledge(agent.sessionName, {
          category: this.knowledgeCategory(category),
          content,
          learnedFrom: entry.ref || undefined,
          confidence: AGENT_MEMORY_REFRESH_CONSTANTS.CONFIDENCE,
          evidence: entry.ref ? [entry.ref] : undefined,
        });
        outcome.knowledge++;
        added++;
      } catch (err) {
        this.logger.debug('AgentMemoryRefresh: addRoleKnowledge failed', { sessionName: agent.sessionName, error: err instanceof Error ? err.message : String(err) });
      }
      if (agent.projectPath && (category === 'gotcha' || category === 'decision')) {
        try {
          await this.writeProjectMemory(agent, category, content, entry);
          outcome.projectMemory++;
        } catch (err) {
          this.logger.debug('AgentMemoryRefresh: project memory write failed', { sessionName: agent.sessionName, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    return outcome;
  }

  // ---------------------------------------------------------------------------

  /**
   * The agent's own non-noise log entries across `vaults` in `(since, now]`,
   * deduped by body, oldest first.
   */
  private async ownEntries(sessionName: string, vaults: readonly string[], since: number, now: number): Promise<WikiLogEntryRecord[]> {
    const seen = new Set<string>();
    const out: WikiLogEntryRecord[] = [];
    const windowDays = Math.max(1, Math.ceil((now - since) / 86_400_000));
    for (const vault of vaults) {
      const logAbs = path.join(vault, WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH);
      if (!existsSync(logAbs)) continue;
      let raw: string;
      try {
        raw = await fs.readFile(logAbs, 'utf8');
      } catch {
        continue;
      }
      for (const e of recentContentEntries(parseLogEntries(raw), windowDays, now)) {
        if (e.caller !== sessionName || e.timestampMs <= since) continue;
        const key = logBodyKey(e.body);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(e);
      }
    }
    return out.sort((a, b) => a.timestampMs - b.timestampMs);
  }

  /**
   * Write a gotcha or decision into the project's memory.
   */
  private async writeProjectMemory(agent: RefreshableAgent, category: string, content: string, entry: WikiLogEntryRecord): Promise<void> {
    if (!agent.projectPath) return;
    const title = this.clip(logEntryTopic(entry.body) === category ? content : logEntryTopic(entry.body), 80);
    if (category === 'gotcha') {
      await this.projectMemory.addGotcha(agent.projectPath, {
        title,
        problem: content,
        solution: '',
        severity: 'medium',
        discoveredBy: agent.sessionName,
      });
      return;
    }
    await this.projectMemory.addDecision(agent.projectPath, {
      title,
      decision: content,
      rationale: `Recorded by ${agent.sessionName} in the vault log (${entry.timestamp.slice(0, 10)}).`,
      decidedBy: agent.sessionName,
    });
  }

  private knowledgeCategory(category: string): RoleKnowledgeCategory {
    if (category === 'gotcha') return 'anti-pattern';
    if (category === 'workflow' || category === 'sop_update') return 'workflow';
    return 'best-practice';
  }

  /** Drop the `(category)` / `[tag]` lead and a bold title's markers. */
  private stripPrefix(body: string): string {
    return body
      .replace(/^\s*(?:\([a-z_-]+\)\s*)?(?:\[[a-z_-]+\]\s*)?/i, '')
      .replace(/^\*\*([^*]+)\*\*\s*(?:\([a-z_-]+\))?\s*/i, '$1: ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clip(text: string, max: number = AGENT_MEMORY_REFRESH_CONSTANTS.ENTRY_MAX_CHARS): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  private async loadState(): Promise<void> {
    if (this.stateLoaded) return;
    this.stateLoaded = true;
    if (!this.statePath) return;
    try {
      const data = await safeReadJson<Partial<RefreshState> | null>(this.statePath, null);
      if (data?.lastRunAt && typeof data.lastRunAt === 'object') this.state = { lastRunAt: { ...data.lastRunAt } };
    } catch (err) {
      this.logger.warn('AgentMemoryRefresh: failed to load state (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async saveState(): Promise<void> {
    if (!this.statePath) return;
    try {
      await ensureDir(path.dirname(this.statePath));
      await atomicWriteJson(this.statePath, this.state);
    } catch (err) {
      this.logger.warn('AgentMemoryRefresh: failed to persist state (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
