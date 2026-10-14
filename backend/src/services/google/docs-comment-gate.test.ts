/**
 * Tests for the Google Docs comment gate: batching, and the owner-confirmation rule.
 *
 * @module services/google/docs-comment-gate.test
 */

import {
  DOC_COMMENT_CONFIRM_WINDOW_MS,
  buildHoldMessage,
  clearDocCommentBatch,
  decideBatchSend,
  getDocCommentBatch,
  holdDocComment,
  isBatchConfirmation,
  listDocCommentBatches,
  parseBatchCode,
  resetDocCommentGate,
} from './docs-comment-gate.js';

jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }),
    }),
  },
}));

beforeEach(() => resetDocCommentGate());

describe('holdDocComment', () => {
  it('puts everything one agent queues into a single batch with one code', () => {
    const a = holdDocComment('ella', { action: 'reply', docId: 'd', commentId: 'c1', text: 'Done' }, undefined, 100);
    const b = holdDocComment('ella', { action: 'resolve', docId: 'd', commentId: 'c1' }, undefined, 200);
    expect(b.code).toBe(a.code);
    expect(b.items).toHaveLength(2);
    expect(b.createdAt).toBe(100);
    expect(b.updatedAt).toBe(200);
    expect(listDocCommentBatches()).toHaveLength(1);
  });

  it('keeps a separate batch per agent', () => {
    const a = holdDocComment('ella', { action: 'add', docId: 'd', text: 'x' });
    const b = holdDocComment('rex', { action: 'add', docId: 'd', text: 'y' });
    expect(a.code).not.toBe(b.code);
  });

  it('records each distinct cited authorization once', () => {
    holdDocComment('ella', { action: 'add', docId: 'd', text: 'x' }, 'owner said ok');
    const b = holdDocComment('ella', { action: 'add', docId: 'd', text: 'y' }, 'owner said ok');
    expect(b.claims).toEqual(['owner said ok']);
  });

  it('opens a fresh batch once the previous one is cleared', () => {
    const a = holdDocComment('ella', { action: 'add', docId: 'd', text: 'x' });
    clearDocCommentBatch(a.code);
    const b = holdDocComment('ella', { action: 'add', docId: 'd', text: 'y' });
    expect(b.code).not.toBe(a.code);
    expect(getDocCommentBatch(a.code)).toBeUndefined();
  });
});

describe('batch codes and confirmations', () => {
  it('parses codes case-insensitively', () => {
    expect(parseBatchCode('c3')).toBe('C3');
    expect(parseBatchCode('#C03')).toBe('C3');
    expect(parseBatchCode('W3')).toBeNull();
  });

  it.each(['发 C1', '发送 C1', 'send C1', 'send #c1', '确认发送 C1', ' 发C1 '])('accepts %j', (text) => {
    expect(isBatchConfirmation(text, { code: 'C1' })).toBe(true);
  });

  it.each(['发 C2', 'send W1', '发 1', 'please send C1 now', 'ok', ''])('rejects %j', (text) => {
    expect(isBatchConfirmation(text, { code: 'C1' })).toBe(false);
  });
});

describe('decideBatchSend', () => {
  const batch = () => holdDocComment('ella', { action: 'add', docId: 'd', text: 'x' }, undefined, 1_000);

  it('lets an owner credential through without any chat message', () => {
    const d = decideBatchSend({ batch: batch(), agentSession: undefined, ownerMessagesSince: () => [], now: 2_000 });
    expect(d).toEqual({ allowed: true, via: 'owner' });
  });

  it('refuses an agent with no owner confirmation', () => {
    const d = decideBatchSend({ batch: batch(), agentSession: 'ella', ownerMessagesSince: () => ['hello'], now: 2_000 });
    expect(d).toEqual({ allowed: false, reason: 'no_confirmation' });
  });

  it('allows an agent once the owner has said 发 <code> after the last change', () => {
    const b = batch();
    const since = jest.fn().mockReturnValue(['thanks', `发 ${b.code}`]);
    const d = decideBatchSend({ batch: b, agentSession: 'ella', ownerMessagesSince: since, now: 2_000 });
    expect(d).toMatchObject({ allowed: true, via: 'owner_confirmation', confirmation: `发 ${b.code}` });
    // Only messages after the batch's last change are even looked at.
    expect(since).toHaveBeenCalledWith(b.updatedAt + 1);
  });

  it('does not accept an OK for a different batch', () => {
    const d = decideBatchSend({ batch: batch(), agentSession: 'ella', ownerMessagesSince: () => ['发 C99'], now: 2_000 });
    expect(d).toEqual({ allowed: false, reason: 'no_confirmation' });
  });

  it('refuses once the batch is older than the confirmation window', () => {
    const d = decideBatchSend({
      batch: batch(),
      agentSession: 'ella',
      ownerMessagesSince: () => ['发 C1'],
      now: 1_000 + DOC_COMMENT_CONFIRM_WINDOW_MS + 1,
    });
    expect(d).toEqual({ allowed: false, reason: 'window_expired' });
  });

  it('a comment queued after the OK needs a fresh OK', () => {
    const b = batch();
    // The owner message store answers by timestamp: nothing after the new change.
    const messages = [{ at: 1_500, text: `发 ${b.code}` }];
    const source = (since: number) => messages.filter((m) => m.at >= since).map((m) => m.text);
    expect(decideBatchSend({ batch: b, agentSession: 'ella', ownerMessagesSince: source, now: 2_000 }).allowed).toBe(true);
    holdDocComment('ella', { action: 'add', docId: 'd', text: 'late addition' }, undefined, 1_800);
    expect(decideBatchSend({ batch: b, agentSession: 'ella', ownerMessagesSince: source, now: 2_000 })).toEqual({
      allowed: false,
      reason: 'no_confirmation',
    });
  });
});

describe('buildHoldMessage', () => {
  it('tells the agent to ask once, with the code and the follow-up command', () => {
    const b = holdDocComment('ella', { action: 'add', docId: 'd', text: 'x' });
    const msg = buildHoldMessage(b);
    expect(msg).toContain(`「发 ${b.code}」`);
    expect(msg).toContain(`send --batch ${b.code}`);
    expect(msg).toContain('NOT posted');
  });
});
