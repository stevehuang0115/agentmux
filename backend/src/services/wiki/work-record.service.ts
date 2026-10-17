/**
 * WorkRecordService (#1349) — one work record per finished task, written to
 * the project vault log.
 *
 * The vault log only held what agents volunteered. This service writes, for
 * every WorkItem that reaches a terminal state (done, verified, rejected,
 * cancelled, failed) and for every item parked in `blocked` for more than a
 * day, one structured `(record)` entry: who asked, who did it, what came
 * out, what went wrong and how it was resolved, who helped, how it ended.
 * The entry goes through `WikiIngestService` (source type `work_record`) into
 * the project vault's `llm-curated/log.md` and, when the team has a vault,
 * into that too. From there the weekly digest, search, and the startup
 * briefing pick it up.
 *
 * Sources, all already on disk or in memory: the WorkItem, its linked
 * project ticket or Request, its children (delegations, the verify item),
 * the run trace, and a bounded tail of the doer's transcript. No model
 * calls.
 *
 * Idempotent: a `work-record:<id>#<phase>` key is remembered in
 * `CREWLY_HOME/work-records-state.json` (seeded from the vault log) and the
 * ingest path refuses an identical body. A finished item whose ticket still
 * waits for the owner's OK is deferred (the ticket change retries it; after
 * `DEFER_MAX_MS` it is written as "waiting for the owner's OK").
 *
 * Runs on the terminal events with a short delay, plus an hourly tick that
 * catches up on items of the last `CATCHUP_WINDOW_DAYS` without a record
 * (at most `CATCHUP_MAX_PER_PASS`), deferred items and long-blocked items.
 * `CREWLY_WORK_RECORDS=false` disables it.
 *
 * @module services/wiki/work-record.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { BOOT_PRESSURE_CONSTANTS, ORCHESTRATOR_SESSION_NAME, WIKI_LOG_CONSTANTS, WORK_RECORD_CONSTANTS } from '../../constants.js';
import type { BootGate } from './wiki-maintenance.service.js';
import { atomicWriteJson, ensureDir, safeReadJson } from '../../utils/file-io.utils.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { isLeadRole } from '../../utils/team.utils.js';
import { collectSecretEnvValues } from '../../utils/secret-env.js';
import { redactSecrets } from '../../utils/secret-redactor.js';
import type { Project, Team } from '../../types/index.js';
import type { WorkItem, WorkItemStatus } from '../../types/v2/work-item.types.js';
import type { ProjectTicket } from '../../types/project-ticket.types.js';
import { readProjectTicketLink } from '../../types/project-ticket.types.js';
import { listTicketPrefixes } from '../project-tickets/ticket-prefixes.js';
import type { Request } from '../../types/v2/request.types.js';
import type { AgentEvent, EventType } from '../../types/event-bus.types.js';
import type { TraceEvent } from '../trace/trace.types.js';
import { memberName } from '../messaging/agent-ask-ledger.service.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import { redactSensitive } from './wiki-redaction.js';
import { parseLogEntries } from './wiki-log-entries.js';
import {
  assembleWorkRecord,
  isRecordableWorkItem,
  isWorkRecordEntry,
  renderWorkRecordBody,
  workItemEndedAt,
  workRecordRef,
  type WorkRecord,
  type WorkRecordPartyKind,
  type WorkRecordPhase,
} from './work-record.js';
import { parseClaudeTranscriptWindow, readTranscriptTail, transcriptWorthReading, type TranscriptWindowFacts } from './work-record-transcript.js';

const C = WORK_RECORD_CONSTANTS;

/** Statuses that close a task and get a `final` record. */
export const FINAL_RECORD_STATUSES: ReadonlySet<WorkItemStatus> = new Set<WorkItemStatus>(['done', 'verified', 'rejected', 'cancelled', 'failed']);

/** Events that announce a terminal transition. */
export const WORK_RECORD_EVENT_TYPES: readonly EventType[] = ['task:done', 'task:verified', 'task:rejected', 'task:cancelled', 'task:failed'];

/** Where a session's transcript is. */
export type WorkRecordTranscriptLocator = (session: string) => Promise<{ kind: 'claude' | 'codex'; file: string } | null>;

/** Collaborators (every I/O surface is injectable for tests). */
export interface WorkRecordServiceDeps {
  listWorkItems: () => Promise<WorkItem[]>;
  findWorkItem: (id: string) => Promise<WorkItem | null>;
  listTeams: () => Promise<Team[]>;
  listProjects: () => Promise<Project[]>;
  /** Linked project ticket (default: none). */
  getTicket?: (projectPath: string, id: string) => Promise<ProjectTicket | null>;
  /** Linked Request (default: none). */
  getRequest?: (id: string) => Promise<Request | null>;
  /** The run trace's events for an item (default: none). */
  readTrace?: (workItem: WorkItem) => Promise<readonly TraceEvent[]>;
  /** The doer's transcript (default: none). */
  locateTranscript?: WorkRecordTranscriptLocator;
  /** Ticket prefixes of the registered projects, for stripping (default: each project's ticket counter). */
  listTicketPrefixes?: (projectPaths: readonly string[]) => Promise<string[]>;
  /** In-process event bus to subscribe to (default: none; the tick still runs). */
  eventBus?: { onInProcess(types: EventType | EventType[], handler: (e: AgentEvent) => void | Promise<void>): () => void };
  /** Ticket change feed: called with the ticket's WorkItem id when a ticket settles (default: none). */
  onTicketSettled?: (listener: (workItemId: string) => void) => () => void;
  ingest?: WikiIngestService;
  /** State file; `null` keeps state in memory (tests). */
  statePath?: string | null;
  globalVaultPath?: string;
  teamsRoot?: string;
  intervalMs?: number;
  bootDelayMs?: number;
  eventDelayMs?: number;
  now?: () => number;
  /** Secret values to mask on top of the pattern-based redaction (default: the process env). */
  secrets?: () => ReadonlyArray<{ name: string; value: string }>;
  /**
   * Held before the boot pass (crewly#1353): restore queue drained, memory
   * calm. When the gate gave up waiting the boot pass writes at most
   * `reducedMaxPerPass` records. Default: none.
   */
  bootGate?: BootGate;
  /** Records per boot pass when the gate gave up waiting (default BOOT_PRESSURE_CONSTANTS.WORK_RECORD_REDUCED_BATCH). */
  reducedMaxPerPass?: number;
}

/** Persisted state. */
interface RecordState {
  /** `work-record:<id>#<phase>` → ISO time written. */
  recorded: Record<string, string>;
}

/** Outcome of one record attempt. */
export interface WorkRecordAttempt {
  workItemId: string;
  phase: WorkRecordPhase;
  result: 'written' | 'already_recorded' | 'deferred' | 'not_recordable' | 'not_terminal' | 'no_vault' | 'refused' | 'missing';
  vaults?: string[];
  record?: WorkRecord;
  body?: string;
}

/** Outcome of one pass. */
export interface WorkRecordPassResult {
  candidates: number;
  written: number;
  deferred: number;
  blocked: number;
  refused: number;
}

/**
 * Per-task work records. Start at boot, stop at shutdown.
 */
export class WorkRecordService {
  private static instance: WorkRecordService | null = null;
  private readonly logger: ComponentLogger;
  private readonly deps: WorkRecordServiceDeps;
  private readonly ingest: WikiIngestService;
  private readonly statePath: string | null;
  private readonly globalVaultPath: string;
  private readonly teamsRoot: string;
  private readonly intervalMs: number;
  private readonly bootDelayMs: number;
  private readonly bootGate: BootGate | null;
  private readonly reducedMaxPerPass: number;
  private readonly eventDelayMs: number;
  private readonly nowFn: () => number;
  private timer: NodeJS.Timeout | null = null;
  private bootTimer: NodeJS.Timeout | null = null;
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly unsubscribers: Array<() => void> = [];
  private running = false;
  private state: RecordState = { recorded: {} };
  private stateLoaded = false;
  private readonly seededVaults = new Set<string>();
  /** Transcript facts cache for the current pass: session → file text. */
  private transcriptCache = new Map<string, Promise<{ kind: 'claude' | 'codex'; text: string } | null>>();
  /** Ticket prefixes of the registered projects, refreshed once per pass. */
  private prefixCache: Promise<string[]> | null = null;

  constructor(deps: WorkRecordServiceDeps) {
    this.logger = LoggerService.getInstance().createComponentLogger('WorkRecord');
    this.deps = deps;
    this.ingest = deps.ingest ?? WikiIngestService.getInstance();
    this.statePath = deps.statePath === null ? null : deps.statePath ?? path.join(getCrewlyHomePath(), C.STATE_FILE);
    this.globalVaultPath = deps.globalVaultPath ?? path.join(getCrewlyHomePath(), 'global-wiki');
    this.teamsRoot = deps.teamsRoot ?? path.join(getCrewlyHomePath(), 'teams');
    this.intervalMs = deps.intervalMs ?? C.TICK_MS;
    this.bootDelayMs = deps.bootDelayMs ?? C.BOOT_DELAY_MS;
    this.bootGate = deps.bootGate ?? null;
    this.reducedMaxPerPass = deps.reducedMaxPerPass ?? BOOT_PRESSURE_CONSTANTS.WORK_RECORD_REDUCED_BATCH;
    this.eventDelayMs = deps.eventDelayMs ?? C.EVENT_DELAY_MS;
    this.nowFn = deps.now ?? (() => Date.now());
  }

  static getInstance(): WorkRecordService | null {
    return this.instance;
  }

  /** Wire / detach the production singleton. */
  static setInstance(next: WorkRecordService | null): void {
    if (this.instance && this.instance !== next) this.instance.stop();
    this.instance = next;
  }

  /**
   * Subscribe to the terminal events and the ticket feed, schedule the boot
   * catch-up and the hourly tick. Idempotent. Returns false when the kill
   * switch is set.
   *
   * @returns Whether the service started
   */
  start(): boolean {
    if (this.timer) return true;
    if (process.env[C.ENV_KILL_SWITCH] === 'false') {
      this.logger.warn(`WorkRecord disabled via ${C.ENV_KILL_SWITCH}=false — not starting`);
      return false;
    }
    if (this.deps.eventBus) {
      this.unsubscribers.push(this.deps.eventBus.onInProcess([...WORK_RECORD_EVENT_TYPES], (e) => {
        if (typeof e.workItemId === 'string' && e.workItemId) this.schedule(e.workItemId);
      }));
    }
    if (this.deps.onTicketSettled) {
      this.unsubscribers.push(this.deps.onTicketSettled((workItemId) => this.schedule(workItemId)));
    }
    this.bootTimer = setTimeout(() => {
      this.bootTimer = null;
      void this.bootPass();
    }, this.bootDelayMs);
    this.bootTimer.unref?.();
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref?.();
    this.logger.info('WorkRecord started', { intervalMs: this.intervalMs, bootDelayMs: this.bootDelayMs, events: !!this.deps.eventBus, bootGate: !!this.bootGate });
    return true;
  }

  /**
   * The boot catch-up: waits at the boot gate when one is wired; when the
   * gate gave up waiting (the machine stayed busy) the pass is reduced to
   * `reducedMaxPerPass` records. Public for tests.
   *
   * @returns Pass result
   */
  async bootPass(): Promise<WorkRecordPassResult> {
    let maxPerPass: number | undefined;
    if (this.bootGate) {
      try {
        const gate = await this.bootGate();
        if (gate.reduced) maxPerPass = this.reducedMaxPerPass;
        if (gate.waitedMs > 0) this.logger.info('WorkRecord boot pass waited for a quiet machine', { waitedMs: gate.waitedMs, reduced: gate.reduced, reason: gate.reason, maxPerPass: maxPerPass ?? C.CATCHUP_MAX_PER_PASS });
      } catch (err) {
        this.logger.warn('WorkRecord boot gate failed (running anyway)', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    return this.runOnce({ maxPerPass });
  }

  /** Stop timers and subscriptions. Safe to call more than once. */
  stop(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    for (const t of this.pending.values()) clearTimeout(t);
    this.pending.clear();
    for (const u of this.unsubscribers.splice(0)) {
      try {
        u();
      } catch {
        // detached already
      }
    }
  }

  /**
   * Record one item soon (coalesced per id): the ticket sync, the verify
   * item and the evidence land in the seconds after the event.
   *
   * @param workItemId - WorkItem id
   */
  schedule(workItemId: string): void {
    if (this.pending.has(workItemId)) return;
    const t = setTimeout(() => {
      this.pending.delete(workItemId);
      void this.recordById(workItemId).catch((err) => {
        this.logger.warn('WorkRecord: event-driven record failed (non-fatal)', { workItemId, error: err instanceof Error ? err.message : String(err) });
      });
    }, this.eventDelayMs);
    t.unref?.();
    this.pending.set(workItemId, t);
  }

  /** Items waiting for their event delay (tests). */
  pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Record one item by id if it is terminal.
   *
   * @param workItemId - WorkItem id
   * @returns What happened
   */
  async recordById(workItemId: string): Promise<WorkRecordAttempt> {
    const wi = await this.deps.findWorkItem(workItemId);
    if (!wi) return { workItemId, phase: 'final', result: 'missing' };
    if (!FINAL_RECORD_STATUSES.has(wi.status)) return { workItemId, phase: 'final', result: 'not_terminal' };
    await this.loadState();
    const all = await this.deps.listWorkItems();
    const attempt = await this.recordItem(wi, 'final', all);
    await this.saveState();
    return attempt;
  }

  /**
   * One pass: finished items of the window without a record (newest first,
   * capped), then long-blocked items. Public for tests and an on-demand run.
   *
   * @param opts - `maxPerPass` caps the records written (default CATCHUP_MAX_PER_PASS)
   * @returns Counts
   */
  async runOnce(opts: { maxPerPass?: number } = {}): Promise<WorkRecordPassResult> {
    const result: WorkRecordPassResult = { candidates: 0, written: 0, deferred: 0, blocked: 0, refused: 0 };
    if (this.running) return result;
    this.running = true;
    this.transcriptCache = new Map();
    this.prefixCache = null;
    try {
      await this.loadState();
      const now = this.nowFn();
      const all = await this.deps.listWorkItems();
      const cutoff = now - C.CATCHUP_WINDOW_DAYS * 86_400_000;
      const finals = all
        .filter((wi) => FINAL_RECORD_STATUSES.has(wi.status) && isRecordableWorkItem(wi))
        .filter((wi) => Date.parse(workItemEndedAt(wi)) >= cutoff)
        .filter((wi) => !this.state.recorded[workRecordRef(wi.id, 'final')])
        .sort((a, b) => Date.parse(workItemEndedAt(b)) - Date.parse(workItemEndedAt(a)));
      const blocked = all
        .filter((wi) => wi.status === 'blocked' && isRecordableWorkItem(wi))
        .filter((wi) => now - Date.parse(wi.statusChangedAt ?? wi.createdAt) >= C.BLOCKED_AFTER_MS)
        .filter((wi) => !this.state.recorded[workRecordRef(wi.id, 'blocked')]);
      result.candidates = finals.length + blocked.length;
      let budget = opts.maxPerPass ?? C.CATCHUP_MAX_PER_PASS;
      for (const wi of finals) {
        if (budget <= 0) break;
        const a = await this.safeRecord(wi, 'final', all);
        if (a.result === 'written') {
          result.written++;
          budget--;
        } else if (a.result === 'deferred') result.deferred++;
        else if (a.result === 'refused' || a.result === 'no_vault') result.refused++;
      }
      for (const wi of blocked) {
        if (budget <= 0) break;
        const a = await this.safeRecord(wi, 'blocked', all);
        if (a.result === 'written') {
          result.blocked++;
          budget--;
        } else if (a.result === 'refused' || a.result === 'no_vault') result.refused++;
      }
      await this.saveState();
      if (result.candidates > 0) this.logger.info('WorkRecord pass', { ...result, remaining: Math.max(0, result.candidates - result.written - result.blocked - result.deferred - result.refused) });
      return result;
    } finally {
      this.running = false;
      this.transcriptCache = new Map();
    }
  }

  /**
   * Assemble and write one record. Public for tests.
   *
   * @param wi - The WorkItem (terminal, or blocked for a `blocked` record)
   * @param phase - Record phase
   * @param all - Every WorkItem (children are looked up here)
   * @returns What happened, with the record and body when assembled
   */
  async recordItem(wi: WorkItem, phase: WorkRecordPhase, all: readonly WorkItem[]): Promise<WorkRecordAttempt> {
    const key = workRecordRef(wi.id, phase);
    const base: WorkRecordAttempt = { workItemId: wi.id, phase, result: 'written' };
    if (!isRecordableWorkItem(wi)) return { ...base, result: 'not_recordable' };
    if (this.state.recorded[key]) return { ...base, result: 'already_recorded' };

    const [teams, projects] = await Promise.all([this.deps.listTeams(), this.deps.listProjects()]);
    const { projectPath, teamId } = this.resolveProject(wi, teams, projects);
    const vaults = await this.resolveVaults(projectPath, teamId);
    if (vaults.length === 0) return { ...base, result: 'no_vault' };
    await this.seedFromVault(vaults[0]);
    if (this.state.recorded[key]) return { ...base, result: 'already_recorded' };

    const link = readProjectTicketLink(wi.metadata);
    const [ticket, request, trace] = await Promise.all([
      link && this.deps.getTicket ? this.deps.getTicket(link.projectPath, link.id).catch(() => null) : Promise.resolve(null),
      wi.requestId && this.deps.getRequest ? this.deps.getRequest(wi.requestId).catch(() => null) : Promise.resolve(null),
      this.deps.readTrace ? this.deps.readTrace(wi).catch(() => [] as readonly TraceEvent[]) : Promise.resolve([] as readonly TraceEvent[]),
    ]);
    const children = all.filter((c) => c.id !== wi.id && (c.parentWorkItemId === wi.id || c.metadata?.verifyOf === wi.id || c.id.startsWith(`${wi.id}:verify:`) || (!!wi.target && c.metadata?.delegatedBy === wi.target)));
    const transcript = phase === 'final' ? await this.transcriptFacts(wi, projectPath) : null;

    const names = this.nameResolvers(teams);
    const record = assembleWorkRecord({
      workItem: wi,
      phase,
      ticket,
      request,
      children,
      trace: trace.slice(0, C.TRACE_MAX_EVENTS),
      transcript,
      nameOf: names.nameOf,
      kindOf: names.kindOf,
      ticketPrefixes: await this.ticketPrefixes(all, projects),
      now: this.nowFn(),
    });

    if (record.outcome === 'waiting_owner' && this.nowFn() - Date.parse(workItemEndedAt(wi)) < C.DEFER_MAX_MS) {
      return { ...base, result: 'deferred', record };
    }

    const body = this.redact(renderWorkRecordBody(record));
    let written = 0;
    for (const vault of vaults) {
      const outcome = await this.ingest.ingest({
        vaultPath: vault,
        sourceType: C.SOURCE_TYPE,
        sourceRef: key,
        sourceBody: body,
        callerSession: wi.target ?? 'system:work-record',
      });
      if (outcome.ok || outcome.reason === 'duplicate') written++;
      else this.logger.debug('WorkRecord: ingest refused', { vault, workItemId: wi.id, reason: outcome.reason });
    }
    if (written === 0) return { ...base, result: 'refused', record, body, vaults };
    this.remember(key);
    this.logger.info('WorkRecord written', { workItemId: wi.id, phase, outcome: record.outcome, doneBy: record.doneBy.name, vaults: vaults.length, chars: body.length });
    return { ...base, result: 'written', record, body, vaults };
  }

  // ---------------------------------------------------------------------------

  private async safeRecord(wi: WorkItem, phase: WorkRecordPhase, all: readonly WorkItem[]): Promise<WorkRecordAttempt> {
    try {
      return await this.recordItem(wi, phase, all);
    } catch (err) {
      this.logger.warn('WorkRecord: record failed (non-fatal)', { workItemId: wi.id, phase, error: err instanceof Error ? err.message : String(err) });
      return { workItemId: wi.id, phase, result: 'refused' };
    }
  }

  /**
   * The project the item belongs to: `metadata.projectPath`, the ticket's
   * project, else the first project of the doer's (or `metadata.teamId`) team.
   */
  private resolveProject(wi: WorkItem, teams: readonly Team[], projects: readonly Project[]): { projectPath: string | null; teamId: string | null } {
    const metaTeam = typeof wi.metadata?.teamId === 'string' ? wi.metadata.teamId : null;
    const team = teams.find((t) => t.id === metaTeam) ?? teams.find((t) => (t.members ?? []).some((m) => m.sessionName === wi.target || m.agentId === wi.target)) ?? null;
    const link = readProjectTicketLink(wi.metadata);
    let projectPath: string | null = typeof wi.metadata?.projectPath === 'string' ? wi.metadata.projectPath : link?.projectPath ?? null;
    if (!projectPath && team) {
      const p = (team.projectIds ?? []).map((id) => projects.find((pr) => pr.id === id)).find((pr): pr is Project => !!pr);
      projectPath = p?.path ?? null;
    }
    if (!projectPath && typeof wi.metadata?.projectId === 'string') {
      projectPath = projects.find((p) => p.id === wi.metadata?.projectId)?.path ?? null;
    }
    return { projectPath, teamId: team?.id ?? metaTeam };
  }

  /**
   * Vaults to write: the project vault (falling back to the global vault
   * when the project has none) and the team vault when it exists.
   */
  private async resolveVaults(projectPath: string | null, teamId: string | null): Promise<string[]> {
    const out: string[] = [];
    const projectVault = projectPath ? path.join(projectPath, '.crewly', 'wiki') : null;
    if (projectVault && existsSync(path.join(projectVault, 'SCHEMA.md'))) out.push(projectVault);
    else if (existsSync(path.join(this.globalVaultPath, 'SCHEMA.md'))) out.push(this.globalVaultPath);
    if (teamId) {
      const teamVault = path.join(this.teamsRoot, teamId, 'wiki');
      if (existsSync(path.join(teamVault, 'SCHEMA.md')) && !out.includes(teamVault)) out.push(teamVault);
    }
    return out;
  }

  private nameResolvers(teams: readonly Team[]): { nameOf: (s: string) => string; kindOf: (s: string) => WorkRecordPartyKind } {
    const bySession = new Map<string, { name: string; role: string; lead: boolean }>();
    for (const team of teams) {
      const leadIds = new Set([team.leaderId, ...((team as { leaderIds?: string[] }).leaderIds ?? [])].filter(Boolean));
      for (const m of team.members ?? []) {
        const info = { name: m.name, role: m.role, lead: leadIds.has(m.id) || isLeadRole(m.role) };
        if (m.sessionName) bySession.set(m.sessionName, info);
        if (m.agentId) bySession.set(m.agentId, info);
      }
    }
    const nameOf = (s: string): string => {
      if (s === ORCHESTRATOR_SESSION_NAME) return 'the orchestrator';
      return bySession.get(s)?.name ?? memberName(s);
    };
    const kindOf = (s: string): WorkRecordPartyKind => {
      if (s === ORCHESTRATOR_SESSION_NAME) return 'orchestrator';
      const info = bySession.get(s);
      if (!info) return 'agent';
      return info.lead ? 'lead' : 'agent';
    };
    return { nameOf, kindOf };
  }

  /**
   * Ticket prefixes to strip from owner-facing text: every registered
   * project's ticket counter (one small file each, read once per pass) plus
   * the prefixes seen on pool items.
   */
  private async ticketPrefixes(all: readonly WorkItem[], projects: readonly Project[]): Promise<string[]> {
    const out = new Set<string>();
    for (const wi of all) {
      const link = readProjectTicketLink(wi.metadata);
      const dash = link?.id.indexOf('-') ?? -1;
      if (link && dash > 0) out.add(link.id.slice(0, dash));
    }
    const paths = projects.map((p) => p.path).filter((p): p is string => typeof p === 'string' && p.length > 0);
    this.prefixCache ??= (this.deps.listTicketPrefixes ?? ((roots) => listTicketPrefixes({ listProjectPaths: async () => [...roots] })))(paths).catch(() => []);
    for (const p of await this.prefixCache) out.add(p);
    return [...out];
  }

  /**
   * Facts from the doer's transcript for the task window, when the item is
   * recent enough for the window to be in the tail. One tail read per
   * session per pass.
   */
  private async transcriptFacts(wi: WorkItem, projectPath: string | null): Promise<TranscriptWindowFacts | null> {
    if (!this.deps.locateTranscript || !wi.target) return null;
    const endedMs = Date.parse(workItemEndedAt(wi));
    if (!transcriptWorthReading(endedMs, this.nowFn())) return null;
    const session = wi.target;
    let cached = this.transcriptCache.get(session);
    if (!cached) {
      const locate = this.deps.locateTranscript;
      cached = (async () => {
        try {
          const target = await locate(session);
          if (!target || target.kind !== 'claude') return null;
          return { kind: target.kind, text: await readTranscriptTail(target.file) };
        } catch {
          return null;
        }
      })();
      this.transcriptCache.set(session, cached);
    }
    const loaded = await cached;
    if (!loaded) return null;
    const fromMs = Date.parse(wi.startedAt ?? wi.createdAt);
    return parseClaudeTranscriptWindow(loaded.text, { fromMs: Number.isFinite(fromMs) ? fromMs : endedMs, toMs: endedMs }, projectPath ? [projectPath] : []);
  }

  /** Pattern-based redaction plus the process's known secret values. */
  private redact(body: string): string {
    const secrets = this.deps.secrets ? this.deps.secrets() : collectSecretEnvValues(process.env);
    return redactSecrets(redactSensitive(body), secrets);
  }

  /** Seed the recorded set from a vault's log once, so a lost state file does not double-write. */
  private async seedFromVault(vault: string): Promise<void> {
    if (this.seededVaults.has(vault)) return;
    this.seededVaults.add(vault);
    try {
      const raw = await fs.readFile(path.join(vault, WIKI_LOG_CONSTANTS.LOG_RELATIVE_PATH), 'utf8');
      for (const e of parseLogEntries(raw)) {
        if (isWorkRecordEntry(e) && e.ref && !this.state.recorded[e.ref]) this.state.recorded[e.ref] = e.timestamp;
      }
    } catch {
      // no log yet
    }
  }

  private remember(key: string): void {
    this.state.recorded[key] = new Date(this.nowFn()).toISOString();
    const keys = Object.keys(this.state.recorded);
    if (keys.length > C.STATE_MAX_KEYS) {
      const sorted = keys.sort((a, b) => Date.parse(this.state.recorded[a]) - Date.parse(this.state.recorded[b]));
      for (const k of sorted.slice(0, keys.length - C.STATE_MAX_KEYS)) delete this.state.recorded[k];
    }
  }

  private async loadState(): Promise<void> {
    if (this.stateLoaded) return;
    this.stateLoaded = true;
    if (!this.statePath) return;
    try {
      const data = await safeReadJson<Partial<RecordState> | null>(this.statePath, null);
      if (data?.recorded && typeof data.recorded === 'object') this.state = { recorded: { ...data.recorded } };
    } catch (err) {
      this.logger.warn('WorkRecord: failed to load state (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  private async saveState(): Promise<void> {
    if (!this.statePath) return;
    try {
      await ensureDir(path.dirname(this.statePath));
      await atomicWriteJson(this.statePath, this.state);
    } catch (err) {
      this.logger.warn('WorkRecord: failed to persist state (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
    }
  }
}
