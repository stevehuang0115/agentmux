import { questionCardSkipReason, type CardGateInput } from './question-card-gate.js';
import type { OwnerDecision } from '../../types/decision.types.js';

const now = new Date('2026-10-16T12:00:00Z');
const place = { slackChannelId: 'C1', threadTs: '1760000000.000100' };

function decision(over: Partial<OwnerDecision>): OwnerDecision {
  return {
    id: 'd-1',
    question: 'Should I publish the landing page draft today?',
    kind: 'reply_question',
    asker: 'ella',
    status: 'open',
    createdAt: new Date(now.getTime() - 60_000).toISOString(),
    ...over,
  } as OwnerDecision;
}

function gate(over: Partial<CardGateInput>): ReturnType<typeof questionCardSkipReason> {
  return questionCardSkipReason({ question: 'Can I send the weekly newsletter to the full list now?', agent: 'ella', place, recent: [], now, ...over });
}

describe('questionCardSkipReason', () => {
  it('cards a clean question to the owner', () => {
    expect(gate({})).toBeNull();
  });

  it('skips fragments cut mid-sentence (real cards D-726, D-740)', () => {
    expect(gate({ question: ':4，1080×1440 — 这样行不行？' })).toBe('fragment');
    expect(gate({ question: 'md、sending — 可以发吗？' })).toBe('fragment');
  });

  it('skips questions meant for someone else (D-701, D-789)', () => {
    expect(gate({ question: '你们能在周五 9 点前回一句结论吗？' })).toBe('for_someone_else');
    expect(gate({ question: '这个价格我先和 Steve 定一下再回你可以吗？' })).toBe('for_someone_else');
    expect(gate({ question: 'Owen，你那边的素材今天能给我吗？', colleagueNames: ['Owen'] })).toBe('for_someone_else');
  });

  it('skips when the same agent already has a pending card in this thread', () => {
    expect(gate({ recent: [decision({ question: 'Totally different topic about invoices?', place })] })).toBe('thread_has_card');
    expect(gate({ recent: [decision({ question: 'Totally different topic about invoices?', place, status: 'answered' as OwnerDecision['status'] })] })).toBeNull();
    expect(gate({ recent: [decision({ question: 'Totally different topic about invoices?', place: { slackChannelId: 'C2' } })] })).toBeNull();
  });

  it('skips a repeat of a recent question (D-832/D-833)', () => {
    const q = 'Can I send the weekly newsletter to the full list now?';
    expect(gate({ place: null, recent: [decision({ question: q, status: 'answered' as OwnerDecision['status'] })] })).toBe('same_as_recent');
    const old = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(gate({ place: null, recent: [decision({ question: q, status: 'answered' as OwnerDecision['status'], createdAt: old })] })).toBeNull();
  });

  it('matches a repeat by the card form of the question too', () => {
    const stored = 'Landing page: can I publish the draft to production tonight?';
    expect(gate({ question: 'ok?', cardQuestion: stored, place: null, recent: [decision({ question: stored, status: 'answered' as OwnerDecision['status'] })] })).toBe('same_as_recent');
  });

  it('caps lifted cards per agent per day', () => {
    const answered = (i: number): OwnerDecision =>
      decision({ id: `d-${i}`, question: `Unrelated topic number ${i} about something else entirely?`, status: 'answered' as OwnerDecision['status'] });
    expect(gate({ place: null, recent: [answered(1), answered(2)] })).toBeNull();
    expect(gate({ place: null, recent: [answered(1), answered(2), answered(3)] })).toBe('daily_cap');
    // Other agents' and other kinds' cards do not count.
    expect(gate({ place: null, recent: [answered(1), answered(2), { ...answered(3), asker: 'owen' }, { ...answered(4), kind: 'ask_owner' as OwnerDecision['kind'] }] })).toBeNull();
  });
});
