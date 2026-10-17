/**
 * Tests for WorkRecordService (#1349): event-driven records, the catch-up
 * pass, idempotence, deferral while a ticket waits for the owner, blocked
 * records, vault routing and redaction.
 *
 * @module services/wiki/work-record.service.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { WORK_RECORD_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { Project, Team } from '../../types/index.js';
import type { ProjectTicket } from '../../types/project-ticket.types.js';
import type { AgentEvent, EventType } from '../../types/event-bus.types.js';
import type { TraceEvent } from '../trace/trace.types.js';
import { WikiIngestService } from './wiki-ingest.service.js';
import { WIKI_LOG_HEADER, parseLogEntries, serializeLogEntry } from './wiki-log-entries.js';
import { WorkRecordService, FINAL_RECORD_STATUSES } from './work-record.service.js';
import { parseWorkRecordBody, workRecordRef } from './work-record.js';

const SCHEMA = `
vault_scope: project
vault_id: test-project
hardcoded:
  - path: memory/
    frozen: true
    description: "Project memory."
    referenced_by: [skill:remember]
llm_curated:
  - path: llm-curated/
    frozen: false
    seed_subdirs: [decisions]
    llm_can_create_subdirs: true
    lint_may_restructure: true
write_policy:
  canonical: [team-leader, orchestrator]
  proposed_only: [worker]
  schema_writer: [steve]
`;

const NOW = Date.parse('2026-10-17T03:00:00.000Z');
const HOUR = 3_600_000;
const OWEN = 'ce-owen-ad0320ab';
const NOVA = 'ce-nova-a2b1f759';
const TEAM_ID = 'team-ce';

function wi(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id,
    type: 'delegate',
    owner: 'team_lead',
    target: NOVA,
    title: `Task ${id} (CE-${id.length})`,
    description: 'Please do the thing.',
    status: 'verified',
    createdAt: new Date(NOW - 2 * HOUR).toISOString(),
    startedAt: new Date(NOW - HOUR).toISOString(),
    completedAt: new Date(NOW - 30 * 60_000).toISOString(),
    retryCount: 0,
    maxRetries: 3,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    metadata: { delegatedBy: OWEN, teamId: TEAM_ID, reviewedBy: OWEN },
    result: { summary: `Did the thing for ${id}; token xoxb-123456-ABCDEFGHIJKLMNOP leaked here.` },
    ...overrides,
  };
}

describe('WorkRecordService', () => {
  let home: string;
  let project: string;
  let vault: string;
  let teamVault: string;
  let items: WorkItem[];
  let tickets: Map<string, ProjectTicket>;
  let traces: Map<string, TraceEvent[]>;
  let handlers: Array<(e: AgentEvent) => void | Promise<void>>;
  let ticketListeners: Array<(workItemId: string) => void>;
  let transcriptFile: string | null;
  let clock: number;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-wr-home-'));
    project = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-wr-project-'));
    vault = path.join(project, '.crewly/wiki');
    teamVault = path.join(home, 'teams', TEAM_ID, 'wiki');
    for (const v of [vault, path.join(home, 'global-wiki')]) {
      await fs.mkdir(path.join(v, 'llm-curated'), { recursive: true });
      await fs.writeFile(path.join(v, 'SCHEMA.md'), SCHEMA, 'utf8');
    }
    items = [];
    tickets = new Map();
    traces = new Map();
    handlers = [];
    ticketListeners = [];
    transcriptFile = null;
    clock = NOW;
    WikiIngestService._resetForTesting();
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    delete process.env[WORK_RECORD_CONSTANTS.ENV_KILL_SWITCH];
  });

  const teams: Team[] = [{
    id: TEAM_ID,
    name: 'CE',
    members: [
      { id: 'm1', name: 'Owen', sessionName: OWEN, role: 'team-leader' } as unknown as Team['members'][number],
      { id: 'm2', name: 'Nova', sessionName: NOVA, role: 'content-strategist' } as unknown as Team['members'][number],
    ],
    projectIds: ['p1'],
    createdAt: '',
    updatedAt: '',
    leaderId: 'm1',
  }];

  function build(overrides: Partial<ConstructorParameters<typeof WorkRecordService>[0]> = {}): WorkRecordService {
    const projects: Project[] = [{ id: 'p1', name: 'CE', path: project, teams: {}, status: 'active' } as Project];
    return new WorkRecordService({
      listWorkItems: async () => items,
      findWorkItem: async (id) => items.find((w) => w.id === id) ?? null,
      listTeams: async () => teams,
      listProjects: async () => projects,
      getTicket: async (_p, id) => tickets.get(id) ?? null,
      readTrace: async (w) => traces.get(w.id) ?? [],
      locateTranscript: async () => (transcriptFile ? { kind: 'claude', file: transcriptFile } : null),
      listTicketPrefixes: async () => ['CE'],
      eventBus: { onInProcess: (_types: EventType | EventType[], h) => { handlers.push(h); return () => undefined; } },
      onTicketSettled: (l) => { ticketListeners.push(l); return () => undefined; },
      ingest: new WikiIngestService(),
      statePath: path.join(home, 'work-records-state.json'),
      globalVaultPath: path.join(home, 'global-wiki'),
      teamsRoot: path.join(home, 'teams'),
      eventDelayMs: 1,
      now: () => clock,
      secrets: () => [],
      ...overrides,
    });
  }

  async function logEntries(v: string = vault) {
    const file = path.join(v, 'llm-curated/log.md');
    if (!existsSync(file)) return [];
    return parseLogEntries(await fs.readFile(file, 'utf8'));
  }

  it('writes one record per finished item into the project vault, redacted, and remembers it', async () => {
    items = [wi('a'), wi('b', { status: 'done', completedAt: new Date(NOW - HOUR).toISOString() }), wi('c', { status: 'running' })];
    const service = build();
    const pass = await service.runOnce();
    expect(pass).toMatchObject({ candidates: 2, written: 2, deferred: 0, blocked: 0, refused: 0 });

    const entries = await logEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.sourceType)).toEqual(['work_record', 'work_record']);
    expect(entries.map((e) => e.caller)).toEqual([NOVA, NOVA]);
    expect(entries.map((e) => e.ref).sort()).toEqual([workRecordRef('a', 'final'), workRecordRef('b', 'final')]);
    const a = parseWorkRecordBody(entries.find((e) => e.ref.includes(':a#'))!.body)!;
    expect(a.title).toBe('Task a');
    expect(a.askedBy).toBe('Owen (team lead)');
    expect(a.doneBy).toBe('Nova');
    expect(a.did).toContain('[REDACTED slack_token]');
    expect(a.did).not.toContain('xoxb-');
    expect(a.outcome).toMatch(/^verified by Owen/);
    expect(a.meta.wi).toBe('a');

    const state = JSON.parse(await fs.readFile(path.join(home, 'work-records-state.json'), 'utf8')) as { recorded: Record<string, string> };
    expect(Object.keys(state.recorded).sort()).toEqual([workRecordRef('a', 'final'), workRecordRef('b', 'final')]);

    // Idempotent: a second pass writes nothing, and a fresh service seeded from the log does not either.
    expect(await service.runOnce()).toMatchObject({ candidates: 0, written: 0 });
    await fs.rm(path.join(home, 'work-records-state.json'));
    expect(await build().runOnce()).toMatchObject({ candidates: 2, written: 0 });
    expect(await logEntries()).toHaveLength(2);
  });

  it('records on the terminal event after the delay, once per item', async () => {
    items = [wi('a')];
    const service = build();
    service.start();
    expect(handlers).toHaveLength(1);
    const event = { workItemId: 'a', type: 'task:verified' } as unknown as AgentEvent;
    await handlers[0](event);
    await handlers[0](event);
    expect(service.pendingCount()).toBe(1);
    await new Promise((r) => setTimeout(r, 30));
    expect(await logEntries()).toHaveLength(1);
    expect(await service.recordById('a')).toMatchObject({ result: 'already_recorded' });
    expect(await service.recordById('missing')).toMatchObject({ result: 'missing' });
    items.push(wi('r', { status: 'running' }));
    expect(await service.recordById('r')).toMatchObject({ result: 'not_terminal' });
    service.stop();
  });

  it('defers while the ticket waits for the owner, records when it settles, and gives up waiting after the cap', async () => {
    items = [wi('a', { metadata: { delegatedBy: OWEN, teamId: TEAM_ID, projectTicket: { projectPath: project, id: 'CE-1' } } })];
    const ticket: ProjectTicket = {
      id: 'CE-1', title: 'Task', status: 'review', priority: 'P2', assignee: NOVA, team: TEAM_ID, labels: [], ownerReview: true,
      createdAt: '', updatedAt: '', workItemId: 'a', requestId: null, source: `agent:${OWEN}`, migratedFrom: null,
      fileName: 'CE-1.md', filePath: '', projectPath: project, description: 'Please review (CE-1).', acceptance: [], log: [], extra: {},
    };
    tickets.set('CE-1', ticket);
    const service = build();
    service.start();
    expect(await service.runOnce()).toMatchObject({ candidates: 1, written: 0, deferred: 1 });
    expect(await logEntries()).toHaveLength(0);

    tickets.set('CE-1', { ...ticket, status: 'done' });
    ticketListeners[0]('a');
    await new Promise((r) => setTimeout(r, 30));
    const [entry] = await logEntries();
    const parsed = parseWorkRecordBody(entry.body)!;
    expect(parsed.outcome).toMatch(/^verified by the owner/);
    expect(parsed.meta.ticket).toBe('CE-1');
    expect(entry.body.split('\n').filter((l) => !l.startsWith('meta:')).join('\n')).not.toContain('CE-1');
    service.stop();

    // A ticket still in review after the cap is written as waiting.
    items = [wi('b', { metadata: { delegatedBy: OWEN, teamId: TEAM_ID, projectTicket: { projectPath: project, id: 'CE-2' } } })];
    tickets.set('CE-2', { ...ticket, id: 'CE-2', workItemId: 'b', status: 'review' });
    clock = NOW + WORK_RECORD_CONSTANTS.DEFER_MAX_MS + HOUR;
    expect(await build().runOnce()).toMatchObject({ candidates: 1, written: 1 });
    const waiting = (await logEntries()).find((e) => e.ref.includes(':b#'))!;
    expect(parseWorkRecordBody(waiting.body)!.outcome).toContain("waiting for the owner's OK");
  });

  it('writes a blocked record for an item parked over a day, then a final record when it finishes', async () => {
    items = [wi('a', { status: 'blocked', blockedReason: 'Waiting on the owner for the API key', completedAt: undefined, statusChangedAt: new Date(NOW - 2 * WORK_RECORD_CONSTANTS.BLOCKED_AFTER_MS).toISOString() }), wi('fresh', { status: 'blocked', completedAt: undefined, statusChangedAt: new Date(NOW - HOUR).toISOString() })];
    const service = build();
    expect(await service.runOnce()).toMatchObject({ candidates: 1, blocked: 1, written: 0 });
    let entries = await logEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].ref).toBe(workRecordRef('a', 'blocked'));
    expect(parseWorkRecordBody(entries[0].body)!.outcome).toBe('blocked — Waiting on the owner for the API key');

    items[0] = { ...items[0], status: 'done', completedAt: new Date(NOW).toISOString() };
    expect(await service.runOnce()).toMatchObject({ candidates: 1, written: 1 });
    entries = await logEntries();
    expect(entries.map((e) => e.ref)).toEqual([workRecordRef('a', 'blocked'), workRecordRef('a', 'final')]);
  });

  it('skips verify items and bookkeeping types, honours the window and the per-pass cap', async () => {
    items = [
      wi('a'),
      wi('a:verify:a', { type: 'review', target: OWEN, status: 'done', metadata: { verifyOf: 'a' } }),
      wi('t', { type: 'ticket_triage' }),
      wi('old', { completedAt: new Date(NOW - (WORK_RECORD_CONSTANTS.CATCHUP_WINDOW_DAYS + 1) * 24 * HOUR).toISOString() }),
    ];
    expect(await build().runOnce()).toMatchObject({ candidates: 1, written: 1 });
    const record = parseWorkRecordBody((await logEntries())[0].body)!;
    expect(record.helpers).toEqual([{ how: 'reviewed', name: 'Owen', rest: '' }]);

    items = Array.from({ length: WORK_RECORD_CONSTANTS.CATCHUP_MAX_PER_PASS + 5 }, (_, i) => wi(`w${i}`));
    const pass = await build().runOnce();
    expect(pass.written).toBe(WORK_RECORD_CONSTANTS.CATCHUP_MAX_PER_PASS);
    expect(pass.candidates).toBe(WORK_RECORD_CONSTANTS.CATCHUP_MAX_PER_PASS + 5);
  });

  it('writes to the team vault too when it exists, and to the global vault when the project has none', async () => {
    await fs.mkdir(path.join(teamVault, 'llm-curated'), { recursive: true });
    await fs.writeFile(path.join(teamVault, 'SCHEMA.md'), SCHEMA, 'utf8');
    items = [wi('a')];
    const attempt = await build().recordItem(items[0], 'final', items);
    expect(attempt.result).toBe('written');
    expect(attempt.vaults).toEqual([vault, teamVault]);
    expect(await logEntries(teamVault)).toHaveLength(1);

    await fs.rm(path.join(vault, 'SCHEMA.md'));
    items = [wi('g')];
    const fallback = await build().recordItem(items[0], 'final', items);
    expect(fallback.vaults).toEqual([path.join(home, 'global-wiki'), teamVault]);
    expect((await logEntries(path.join(home, 'global-wiki'))).map((e) => e.ref)).toEqual([workRecordRef('g', 'final')]);
  });

  it('folds the trace, the children and the transcript into the record', async () => {
    const child = wi('child', { parentWorkItemId: 'a', target: 'ce-leo-33cc44dd', status: 'done', title: 'Leo, check claims', metadata: {} });
    items = [wi('a', { startedAt: new Date(NOW - HOUR).toISOString(), completedAt: new Date(NOW - 30 * 60_000).toISOString() }), child];
    traces.set('a', [
      { ts: '', traceId: 't', type: 'message.outbound', actor: { kind: 'agent', session: NOVA }, refs: { workItemId: 'a' }, summary: `${NOVA} → Slack C1: done`, outcome: 'ok', data: { destination: 'slack' } },
      { ts: '', traceId: 't', type: 'turn.error', actor: { kind: 'agent', session: NOVA }, refs: {}, summary: `Turn of ${NOVA} failed: API 529`, outcome: 'failed' },
    ]);
    transcriptFile = path.join(home, 'transcript.jsonl');
    const at = (minAgo: number): string => new Date(NOW - minAgo * 60_000).toISOString();
    await fs.writeFile(transcriptFile, [
      JSON.stringify({ type: 'assistant', uuid: '1', timestamp: at(50), message: { content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'npm test' } }] } }),
      JSON.stringify({ type: 'user', uuid: '2', timestamp: at(49), message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'Exit code 1\nFAIL' }] } }),
      JSON.stringify({ type: 'assistant', uuid: '3', timestamp: at(45), message: { content: [{ type: 'tool_use', id: 'y', name: 'Write', input: { file_path: `${project}/src/new.ts`, content: '' } }] } }),
      JSON.stringify({ type: 'user', uuid: '4', timestamp: at(44), message: { content: [{ type: 'tool_result', tool_use_id: 'y', content: 'ok' }] } }),
    ].join('\n'), 'utf8');

    const attempt = await build().recordItem(items[0], 'final', items);
    expect(attempt.result).toBe('written');
    const parsed = parseWorkRecordBody(attempt.body!)!;
    expect(parsed.outputs).toEqual(expect.arrayContaining(['src/new.ts', '1 message posted (Slack)']));
    expect(parsed.errors).toEqual(['Bash `npm test` exit 1 (unresolved)', `Turn of ${NOVA} failed: API 529 (fixed)`]);
    expect(parsed.helpers).toEqual(expect.arrayContaining([{ how: 'delegated', name: 'Leo', rest: '"Leo, check claims" → done' }, { how: 'reviewed', name: 'Owen', rest: '' }]));
  });

  it('start() honours the kill switch and FINAL_RECORD_STATUSES names the closing statuses', () => {
    process.env[WORK_RECORD_CONSTANTS.ENV_KILL_SWITCH] = 'false';
    const service = build();
    expect(service.start()).toBe(false);
    expect(handlers).toHaveLength(0);
    expect([...FINAL_RECORD_STATUSES].sort()).toEqual(['cancelled', 'done', 'failed', 'rejected', 'verified']);
    service.stop();
  });

  it('keeps an existing learning entry untouched and appends records after it', async () => {
    await fs.writeFile(path.join(vault, 'llm-curated/log.md'), WIKI_LOG_HEADER + serializeLogEntry({ timestamp: new Date(NOW - HOUR).toISOString(), sourceType: 'record_learning', caller: NOVA, ref: 'mem:1', body: '(gotcha) something real' }), 'utf8');
    items = [wi('a')];
    await build().runOnce();
    const entries = await logEntries();
    expect(entries.map((e) => e.sourceType)).toEqual(['record_learning', 'work_record']);
  });
});
