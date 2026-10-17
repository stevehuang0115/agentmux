/**
 * Tests for the work record assembler, renderer and parser (#1349).
 *
 * @module services/wiki/work-record.test
 */

import { WORK_RECORD_CONSTANTS } from '../../constants.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { ProjectTicket } from '../../types/project-ticket.types.js';
import type { Request } from '../../types/v2/request.types.js';
import type { TraceEvent } from '../trace/trace.types.js';
import {
  assembleWorkRecord,
  cleanOwnerText,
  isRecordableWorkItem,
  isVerifyWorkItem,
  isWorkRecordEntry,
  outcomePhrase,
  parseWorkRecordBody,
  parseWorkRecordRef,
  renderWorkRecordBody,
  shortWorkRecordLine,
  workItemEndedAt,
  workRecordRef,
  type WorkRecordInputs,
} from './work-record.js';

const NOW = Date.parse('2026-10-17T03:00:00.000Z');
const OWEN = 'ce-owen-ad0320ab';
const NOVA = 'ce-nova-a2b1f759';
const ELLA = 'ce-ella-11aa22bb';
const LEO = 'ce-leo-33cc44dd';
const WI_ID = '820e669a-d893-4061-a6c0-57ecbb5191c5';

const NAMES: Record<string, string> = { [OWEN]: 'Owen', [NOVA]: 'Nova', [ELLA]: 'Ella', [LEO]: 'Leo' };
const nameOf = (s: string): string => NAMES[s] ?? s;
const kindOf = (s: string): 'lead' | 'agent' => (s === OWEN ? 'lead' : 'agent');

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: WI_ID,
    type: 'delegate',
    owner: 'team_lead',
    target: NOVA,
    title: 'Nova, daily ops 10/16 item 1 (CE-376): update /news/perm-suspension for WorkItem 820e669a-d893-4061-a6c0-57ecbb5191c5',
    description: 'CE-376: Update section 06 with the Cloudera settlement; preview only, do not publish.',
    status: 'verified',
    createdAt: '2026-10-17T02:38:29.270Z',
    startedAt: '2026-10-17T02:50:54.987Z',
    completedAt: '2026-10-17T02:51:15.922Z',
    retryCount: 0,
    maxRetries: 3,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    traceId: 'tr-20261017-848ee2af',
    metadata: {
      delegatedBy: OWEN,
      reviewedBy: OWEN,
      teamId: 'team-ce',
      projectPath: '/proj/ce-core',
      projectTicket: { projectPath: '/proj/ce-core', id: 'CE-376' },
      origin: { kind: 'trigger', triggerId: 't1', teamId: 'team-ce', topic: 'Run daily ops and report to Steve' },
    },
    result: {
      summary: 'Section 06 Cloudera update drafted as preview only (https://visa.example.com/analysis/preview/6ad2e) for CE-376, live post untouched.',
      evidence: [
        { type: 'artifact', path: '/proj/ce-core/.crewly/findings/cloudera-update-2026-10-16/' },
        { type: 'command', command: 'check-legal-claims.py', exitCode: 0 },
        { type: 'command', command: 'check-readability.py', exitCode: 0 },
      ],
    },
    ...overrides,
  };
}

function verifyItem(parent: WorkItem, status: WorkItem['status'] = 'done'): WorkItem {
  return { ...workItem(), id: `${parent.id}:verify:${parent.id}`, type: 'review', target: OWEN, status, title: `Verify: ${parent.title}`, metadata: { verifyOf: parent.id }, result: undefined };
}

function ticket(overrides: Partial<ProjectTicket> = {}): ProjectTicket {
  return {
    id: 'CE-376',
    title: 'Nova, daily ops 10/16 item 1',
    status: 'done',
    priority: 'P2',
    assignee: NOVA,
    team: 'team-ce',
    labels: [],
    ownerReview: false,
    createdAt: '2026-10-17T02:38:29.000Z',
    updatedAt: '2026-10-17T02:51:16.000Z',
    workItemId: WI_ID,
    requestId: null,
    source: `agent:${OWEN}`,
    migratedFrom: null,
    fileName: 'CE-376.md',
    filePath: '/proj/ce-core/.crewly/tickets/CE-376.md',
    projectPath: '/proj/ce-core',
    description: 'Update section 06 with the Cloudera settlement (CE-376). Preview only.',
    acceptance: [],
    log: ['2026-10-17T02:51:16.000Z · crewly · WorkItem 820e669a verified → done'],
    extra: {},
    ...overrides,
  };
}

function ev(type: TraceEvent['type'], actor: string | null, summary: string, extra: Partial<TraceEvent> = {}): TraceEvent {
  return { ts: '2026-10-17T02:51:00.000Z', traceId: 'tr-20261017-848ee2af', type, actor: actor ? { kind: 'agent', session: actor } : { kind: 'system' }, refs: {}, summary, outcome: 'ok', ...extra };
}

function inputs(overrides: Partial<WorkRecordInputs> = {}): WorkRecordInputs {
  return { workItem: workItem(), phase: 'final', nameOf, kindOf, now: NOW, ...overrides };
}

describe('work record helpers', () => {
  it('builds and parses refs', () => {
    expect(workRecordRef('abc', 'final')).toBe('work-record:abc#final');
    expect(parseWorkRecordRef('work-record:abc#blocked')).toEqual({ workItemId: 'abc', phase: 'blocked' });
    expect(parseWorkRecordRef('work-record:abc#other')).toBeNull();
    expect(parseWorkRecordRef('mem:1')).toBeNull();
  });

  it('recognises record entries, verify items and recordable items', () => {
    expect(isWorkRecordEntry({ sourceType: 'work_record', ref: 'x' })).toBe(true);
    expect(isWorkRecordEntry({ sourceType: 'record_learning', ref: 'work-record:a#final' })).toBe(true);
    expect(isWorkRecordEntry({ sourceType: 'record_learning', ref: 'mem:1' })).toBe(false);
    const wi = workItem();
    expect(isVerifyWorkItem(wi)).toBe(false);
    expect(isVerifyWorkItem(verifyItem(wi))).toBe(true);
    expect(isRecordableWorkItem(wi)).toBe(true);
    expect(isRecordableWorkItem(verifyItem(wi))).toBe(false);
    expect(isRecordableWorkItem(workItem({ type: 'ticket_triage' }))).toBe(false);
    expect(workItemEndedAt(workItem({ completedAt: undefined, statusChangedAt: '2026-10-17T01:00:00.000Z' }))).toBe('2026-10-17T01:00:00.000Z');
  });

  it('cleans owner-facing text of ticket ids, WorkItem ids and uuids', () => {
    const text = 'Done (CE-376) for WorkItem 820e669a-d893-4061-a6c0-57ecbb5191c5 — see CREW-100: the fix, ref 51935f36-f721-4292-82d4-89e1f902ee34:verify:51935f36-f721-4292-82d4-89e1f902ee34.';
    const out = cleanOwnerText(text, ['CE', 'CREW']);
    expect(out).not.toMatch(/CE-376|CREW-100|820e669a|51935f36|WorkItem/);
    expect(out).toContain('the fix');
    expect(cleanOwnerText('a'.repeat(50), [], 10)).toHaveLength(10);
  });
});

describe('assembleWorkRecord', () => {
  it('assembles a verified delegation: asker, doer, outputs, reviewer, outcome and meta', () => {
    const wi = workItem();
    const trace = [
      ev('message.outbound', NOVA, `${NOVA} → Slack C0C2Y1FRCP7: @Owen section 06 done, preview only`, { data: { destination: 'slack' }, refs: { workItemId: WI_ID } }),
    ];
    const record = assembleWorkRecord(inputs({ ticket: ticket(), children: [verifyItem(wi)], trace }));

    expect(record.title).not.toMatch(/CE-376|820e669a|WorkItem/);
    expect(record.askedBy).toEqual({ kind: 'lead', name: 'Owen', session: OWEN });
    expect(record.forOwner).toBe(false);
    expect(record.askQuote).toBe('Update section 06 with the Cloudera settlement. Preview only.');
    expect(record.doneBy).toEqual({ kind: 'agent', name: 'Nova', session: NOVA });
    expect(record.did).toContain('Section 06 Cloudera update drafted as preview only');
    expect(record.did).not.toContain('CE-376');
    expect(record.outputs).toEqual(expect.arrayContaining([
      'https://visa.example.com/analysis/preview/6ad2e',
      '/proj/ce-core/.crewly/findings/cloudera-update-2026-10-16/',
      '2 checks passed',
      '1 message posted (Slack)',
    ]));
    expect(record.errors).toEqual([]);
    expect(record.helpers).toEqual([{ how: 'reviewed', name: 'Owen', session: OWEN }]);
    expect(record.outcome).toBe('lead_verified');
    expect(record.outcomeBy).toBe('Owen');
    expect(record.durationMs).toBe(Date.parse(wi.completedAt!) - Date.parse(wi.startedAt!));
    expect(record.meta).toMatchObject({ wi: WI_ID, phase: 'final', status: 'verified', ticket: 'CE-376', trace: 'tr-20261017-848ee2af', team: 'team-ce', asked_by: `${OWEN}:lead`, done_by: NOVA, outcome: 'lead_verified', helpers: `${OWEN}:reviewed` });
  });

  it('names the owner, the place and the agent who took the ask for an owner-origin delegation', () => {
    const wi = workItem({ metadata: { ...workItem().metadata, origin: { kind: 'owner', slackChannelId: 'C1', threadTs: '1.2', receivedBy: OWEN } } });
    const record = assembleWorkRecord(inputs({ workItem: wi }));
    expect(record.askedBy.name).toBe('Owen');
    expect(record.forOwner).toBe(true);
    expect(record.askedWhere).toBe('Slack thread');
    const body = renderWorkRecordBody(record);
    expect(body).toContain('asked by: Owen (team lead) for the owner (Slack thread) — "');

    const direct = assembleWorkRecord(inputs({ workItem: workItem({ metadata: { origin: { kind: 'owner', conversationId: 'conv-1' } } }) }));
    expect(direct.askedBy).toEqual({ kind: 'owner', name: 'the owner' });
    expect(direct.askedWhere).toBe('chat');
  });

  it('falls back to the schedule, the ticket source and the WorkItem owner for the asker', () => {
    const scheduled = assembleWorkRecord(inputs({ workItem: workItem({ metadata: { origin: { kind: 'trigger', topic: 'Daily ops (CE-1)' } } }), ticketPrefixes: ['CE'] }));
    expect(scheduled.askedBy.kind).toBe('schedule');
    expect(scheduled.askedBy.name).toBe('schedule "Daily ops"');

    const fromTicket = assembleWorkRecord(inputs({ workItem: workItem({ metadata: {} }), ticket: ticket({ source: `agent:${ELLA}` }) }));
    expect(fromTicket.askedBy).toEqual({ kind: 'agent', name: 'Ella', session: ELLA });

    const ownerTicket = assembleWorkRecord(inputs({ workItem: workItem({ metadata: {} }), ticket: ticket({ source: 'owner' }) }));
    expect(ownerTicket.askedBy.kind).toBe('owner');

    const orc = assembleWorkRecord(inputs({ workItem: workItem({ metadata: {}, owner: 'orchestrator' }) }));
    expect(orc.askedBy).toEqual({ kind: 'orchestrator', name: 'the orchestrator' });
  });

  it('collects errors from the transcript, the trace and retries, with their resolution', () => {
    const wi = workItem({ retryCount: 1, metadata: { ...workItem().metadata, lastFailureReason: 'lease expired' } });
    const trace = [
      ev('turn.error', NOVA, `Turn of ${NOVA} failed: API 529 overloaded`, { outcome: 'failed' }),
      ev('skill.call', NOVA, `${NOVA} called POST /task-pool/complete/:id`, { outcome: 'failed', refs: { skill: 'POST /task-pool/complete/:id' } }),
      ev('skill.call', ELLA, 'someone else failed', { outcome: 'failed', refs: { skill: 'GET /x' } }),
    ];
    const record = assembleWorkRecord(inputs({
      workItem: wi,
      trace,
      transcript: { errors: [{ what: 'Bash `npm test` exit 1', resolved: 'fixed' }, { what: 'Bash `npm test` exit 1', resolved: 'fixed' }], filesWritten: ['src/a.ts'], urls: ['https://github.com/o/r/pull/12'], commits: ['abc1234'], posts: 2, toolCalls: 9 },
    }));
    expect(record.errors).toEqual([
      { what: 'Bash `npm test` exit 1', resolved: 'fixed' },
      { what: `Turn of ${NOVA} failed: API 529 overloaded`, resolved: 'fixed' },
      { what: 'POST /task-pool/complete/:id failed', resolved: 'fixed' },
      { what: 'retried 1 time: lease expired', resolved: 'fixed' },
    ]);
    expect(record.outputs).toEqual(expect.arrayContaining(['https://github.com/o/r/pull/12', 'commit abc1234', 'src/a.ts', '2 messages posted']));
  });

  it('caps errors and outputs', () => {
    const errors = Array.from({ length: 12 }, (_, i) => ({ what: `error ${i}`, resolved: 'unknown' as const }));
    const urls = Array.from({ length: 20 }, (_, i) => `https://github.com/o/r/pull/${i}`);
    const record = assembleWorkRecord(inputs({ workItem: workItem({ result: {} }), transcript: { errors, filesWritten: [], urls, commits: [], posts: 0, toolCalls: 0 } }));
    expect(record.errors).toHaveLength(WORK_RECORD_CONSTANTS.MAX_ERRORS);
    expect(record.outputs).toHaveLength(WORK_RECORD_CONSTANTS.MAX_OUTPUTS);
  });

  it('finds helpers: delegated sub-tasks, agents asked (answered or not) and the reviewer', () => {
    const wi = workItem();
    const child: WorkItem = { ...workItem(), id: 'child-1', parentWorkItemId: WI_ID, target: LEO, status: 'done', title: 'Leo, check the legal claims (CE-377)', metadata: {} };
    const byDelegation: WorkItem = { ...workItem(), id: 'child-2', target: ELLA, status: 'rejected', title: 'Ella, translate the note', createdAt: '2026-10-17T02:51:00.000Z', metadata: { delegatedBy: NOVA } };
    const outside: WorkItem = { ...byDelegation, id: 'child-3', createdAt: '2026-10-16T00:00:00.000Z' };
    const trace = [
      ev('message.agent', NOVA, `${NOVA} → ${ELLA}: which source did you use?`, { refs: { session: ELLA } }),
      ev('turn.delivered', null, `System message delivered to ${NOVA}: the DOJ release`, { data: { sender: ELLA, kind: 'system' } }),
      ev('message.agent', NOVA, `${NOVA} → ${OWEN}: ready for review`, { refs: { session: OWEN } }),
      ev('message.agent', 'WorkItemDispatch', `WorkItemDispatch → ${NOVA}: [CREWLY-DISPATCH]`, { refs: { session: NOVA } }),
    ];
    const record = assembleWorkRecord(inputs({ children: [child, byDelegation, outside, verifyItem(wi)], trace }));
    expect(record.helpers).toEqual([
      { how: 'delegated', name: 'Leo', session: LEO, what: 'Leo, check the legal claims', back: 'done' },
      { how: 'delegated', name: 'Ella', session: ELLA, what: 'Ella, translate the note', back: 'rejected' },
      { how: 'asked', name: 'Owen', session: OWEN, back: 'no answer' },
      { how: 'reviewed', name: 'Owen', session: OWEN },
    ]);
    expect(record.meta.helpers).toBe(`${LEO}:delegated,${ELLA}:delegated,${OWEN}:asked,${OWEN}:reviewed`);
  });

  it('marks an ask answered when the helper wrote back', () => {
    const trace = [
      ev('message.agent', NOVA, `${NOVA} → ${ELLA}: which source?`, { refs: { session: ELLA } }),
      ev('message.agent', ELLA, `${ELLA} → ${NOVA}: the DOJ release`, { refs: { session: NOVA } }),
    ];
    const record = assembleWorkRecord(inputs({ trace }));
    expect(record.helpers).toEqual([{ how: 'asked', name: 'Ella', session: ELLA, back: 'answered' }, { how: 'reviewed', name: 'Owen', session: OWEN }]);
  });

  it('resolves outcomes: owner review, silence, request acceptance, rejection, cancellation, failure, blocked', () => {
    const wi = workItem();
    expect(assembleWorkRecord(inputs({ ticket: ticket({ ownerReview: true, status: 'done' }) })).outcome).toBe('owner_verified');
    expect(assembleWorkRecord(inputs({ ticket: ticket({ ownerReview: true, status: 'done', labels: ['auto_accepted'] }) })).outcome).toBe('silence_accepted');
    expect(assembleWorkRecord(inputs({ ticket: ticket({ ownerReview: true, status: 'review' }), children: [verifyItem(wi)] })).outcome).toBe('waiting_owner');
    expect(assembleWorkRecord(inputs({ request: { acceptedBy: 'owner' } as Request })).outcome).toBe('owner_verified');
    expect(assembleWorkRecord(inputs({ request: { acceptedBy: 'silence', tags: ['auto_accepted'] } as unknown as Request })).outcome).toBe('silence_accepted');
    expect(assembleWorkRecord(inputs({ workItem: workItem({ status: 'done' }) })).outcome).toBe('done');

    const rejected = assembleWorkRecord(inputs({ workItem: workItem({ status: 'rejected', result: { verdict: 'the preview still shows the old date' } }), children: [verifyItem(wi)] }));
    expect(rejected.outcome).toBe('rejected');
    expect(rejected.outcomeBy).toBe('Owen');
    expect(rejected.outcomeNote).toBe('the preview still shows the old date');

    const cancelled = assembleWorkRecord(inputs({ workItem: workItem({ status: 'cancelled', cancelReason: 'Superseded by CE-380', completedAt: undefined, statusChangedAt: '2026-10-17T02:55:00.000Z' }) }));
    expect(cancelled.outcome).toBe('cancelled');
    expect(cancelled.outcomeNote).toBe('Superseded by');
    expect(cancelled.endedAt).toBe('2026-10-17T02:55:00.000Z');

    const failed = assembleWorkRecord(inputs({ workItem: workItem({ status: 'failed', error: 'build broke' }) }));
    expect(failed.outcome).toBe('failed');
    expect(failed.errors).toEqual([{ what: 'build broke', resolved: 'unresolved' }]);

    const blocked = assembleWorkRecord(inputs({ workItem: workItem({ status: 'blocked', blockedReason: 'waiting on the owner for the API key', completedAt: undefined, statusChangedAt: '2026-10-16T00:00:00.000Z' }), phase: 'blocked' }));
    expect(blocked.outcome).toBe('blocked');
    expect(blocked.outcomeNote).toBe('waiting on the owner for the API key');
    expect(blocked.meta.phase).toBe('blocked');
    expect(outcomePhrase(blocked)).toBe('blocked');
  });
});

describe('renderWorkRecordBody / parseWorkRecordBody', () => {
  it('round-trips the fields and keeps ticket ids on the meta line only', () => {
    const wi = workItem();
    const record = assembleWorkRecord(inputs({
      ticket: ticket(),
      children: [verifyItem(wi), { ...workItem(), id: 'child-1', parentWorkItemId: WI_ID, target: LEO, status: 'done', title: 'Leo, check claims', metadata: {} }],
      transcript: { errors: [{ what: 'Bash `npm test` exit 1', resolved: 'fixed' }], filesWritten: [], urls: [], commits: [], posts: 0, toolCalls: 1 },
    }));
    const body = renderWorkRecordBody(record);
    const [headline, ...rest] = body.split('\n');
    expect(headline).toMatch(/^\(record\) \*\*.+\*\* — verified by Owen$/);
    const ownerFacing = rest.filter((l) => !l.startsWith('meta:')).join('\n');
    expect(ownerFacing).not.toMatch(/CE-376|820e669a|WorkItem/);
    expect(body).toMatch(/^meta: wi=820e669a-d893-4061-a6c0-57ecbb5191c5 phase=final status=verified .*ticket=CE-376/m);
    expect(body.length).toBeLessThanOrEqual(WORK_RECORD_CONSTANTS.MAX_CHARS);

    const parsed = parseWorkRecordBody(body);
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe(record.title);
    expect(parsed!.askedBy).toBe('Owen (team lead)');
    expect(parsed!.doneBy).toBe('Nova');
    expect(parsed!.did).toContain('Section 06');
    expect(parsed!.outputs).toContain('2 checks passed');
    expect(parsed!.errors).toEqual(['Bash `npm test` exit 1 (fixed)']);
    expect(parsed!.helpers).toEqual([
      { how: 'delegated', name: 'Leo', rest: '"Leo, check claims" → done' },
      { how: 'reviewed', name: 'Owen', rest: '' },
    ]);
    expect(parsed!.outcome).toMatch(/^verified by Owen, /);
    expect(parsed!.meta).toMatchObject({ wi: WI_ID, ticket: 'CE-376', done_by: NOVA });
    expect(shortWorkRecordLine(parsed!)).toMatch(/^\*\*.+\*\* — asked by Owen \(team lead\) — done by Nova — outputs: .+ → verified by Owen/);
    expect(parseWorkRecordBody('(gotcha) not a record')).toBeNull();
  });

  it('never exceeds the cap and always keeps the meta line', () => {
    const long = 'x'.repeat(3_000);
    const record = assembleWorkRecord(inputs({
      workItem: workItem({ result: { summary: long } }),
      transcript: { errors: Array.from({ length: 5 }, (_, i) => ({ what: `e${i} ${'y'.repeat(150)}`, resolved: 'unknown' as const })), filesWritten: Array.from({ length: 8 }, (_, i) => `f${i}/${'z'.repeat(150)}`), urls: [], commits: [], posts: 0, toolCalls: 0 },
    }));
    const body = renderWorkRecordBody(record);
    expect(body.length).toBeLessThanOrEqual(WORK_RECORD_CONSTANTS.MAX_CHARS);
    expect(body.split('\n').pop()).toMatch(/^meta: wi=/);
    expect(parseWorkRecordBody(body)?.meta.wi).toBe(WI_ID);
  });
});
