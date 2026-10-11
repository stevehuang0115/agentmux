/**
 * Tests for the Google Docs comment gate over HTTP: an agent's comment writes
 * are queued, the owner's 「发 C<n>」 releases the batch, an owner credential
 * posts directly.
 *
 * @module controllers/google/google.doc-comment-gate.test
 */

import request from 'supertest';
import express, { type Application } from 'express';
import { createGoogleRouter } from './google.routes.js';
import { setGoogleControllerDeps, type GoogleControllerDeps } from './google.controller.js';
import { GoogleWorkspaceError } from '../../services/google/google-workspace-token.service.js';
import { resetDocCommentGate, listDocCommentBatches } from '../../services/google/docs-comment-gate.js';
import { ownerUnlessAgentForTests } from '../../middleware/caller-identity.testing.js';

jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }),
    }),
  },
}));

/** Owner chat messages as (createdAt, text), newest first like the real store. */
let ownerMessages: Array<{ at: number; text: string }> = [];
const getRecentOwnerMessageContents = jest.fn((since: number) => ownerMessages.filter((m) => m.at >= since).map((m) => m.text));
jest.mock('../../services/chat-v2/chat-v2.singleton.js', () => ({
  getChatV2Service: () => ({ getRecentOwnerMessageContents }),
}));

let app: Application;
let docComments: { list: jest.Mock; add: jest.Mock; reply: jest.Mock; resolve: jest.Mock };

beforeEach(() => {
  resetDocCommentGate();
  ownerMessages = [];
  getRecentOwnerMessageContents.mockClear();
  docComments = {
    list: jest.fn(),
    add: jest.fn().mockImplementation(async (docId: string) => ({ docId, id: 'new' })),
    reply: jest.fn().mockImplementation(async (docId: string, commentId: string) => ({ docId, commentId, id: 'rep' })),
    resolve: jest.fn().mockImplementation(async (docId: string, commentId: string) => ({ docId, commentId, id: 'res', resolved: true })),
  };
  setGoogleControllerDeps({ tokens: {}, docComments } as unknown as GoogleControllerDeps);
  app = express();
  app.use(ownerUnlessAgentForTests);
  app.use(express.json());
  app.use('/api/google', createGoogleRouter());
});

afterEach(() => setGoogleControllerDeps(null));

const asAgent = (r: request.Test, session = 'ella') => r.set('X-Agent-Session', session);

describe('agent comment writes are queued, not posted', () => {
  it('queues add / reply / resolve into one batch and posts nothing', async () => {
    const add = await asAgent(request(app).post('/api/google/docs/d/comments')).send({ text: 'Source?', quote: 'grew 40%' });
    const reply = await asAgent(request(app).post('/api/google/docs/d/comments/c1/replies')).send({ text: 'Fixed' });
    const resolve = await asAgent(request(app).post('/api/google/docs/d/comments/c1/resolve')).send({});

    expect(add.status).toBe(202);
    expect(add.body.data).toMatchObject({ held: true, batch: 'C1', queued: 1, message: expect.stringContaining('NOT posted') });
    expect(reply.body.data).toMatchObject({ batch: 'C1', queued: 2 });
    expect(resolve.body.data).toMatchObject({ batch: 'C1', queued: 3 });
    expect(docComments.add).not.toHaveBeenCalled();
    expect(docComments.reply).not.toHaveBeenCalled();
    expect(docComments.resolve).not.toHaveBeenCalled();
    expect(listDocCommentBatches()[0].items.map((i) => i.action)).toEqual(['add', 'reply', 'resolve']);
  });

  it('never posts for a caller that is neither the owner nor a named agent', async () => {
    const bare = express();
    bare.use(express.json());
    bare.use('/api/google', createGoogleRouter());
    const res = await request(bare).post('/api/google/docs/d/comments').send({ text: 'x' });
    expect(res.status).not.toBe(200);
    expect(docComments.add).not.toHaveBeenCalled();
  });

  it('rejects an empty comment instead of queueing it', async () => {
    const res = await asAgent(request(app).post('/api/google/docs/d/comments')).send({ text: '  ' });
    expect(res.status).toBe(400);
    expect(listDocCommentBatches()).toHaveLength(0);
  });

  it('remembers the Google account and the cited authorization with the item', async () => {
    await asAgent(request(app).post('/api/google/docs/d/comments/c1/replies'))
      .set('X-Google-Account', 'work@x.com')
      .set('X-Agent-Authorization', 'owner 14:22 - "yes reply"')
      .send({ text: 'ok' });
    const [batch] = listDocCommentBatches();
    expect(batch.items[0]).toMatchObject({ action: 'reply', account: 'work@x.com' });
    expect(batch.claims).toEqual(['owner 14:22 - "yes reply"']);
  });

  it('an owner credential still posts directly', async () => {
    const res = await request(app).post('/api/google/docs/d/comments/c1/replies').send({ text: 'Fixed' });
    expect(res.status).toBe(200);
    expect(docComments.reply).toHaveBeenCalledWith('d', 'c1', 'Fixed');
    expect(listDocCommentBatches()).toHaveLength(0);
  });

  it('list stays open to agents', async () => {
    docComments.list.mockResolvedValue({ docId: 'd', comments: [], truncated: false });
    const res = await asAgent(request(app).get('/api/google/docs/d/comments'));
    expect(res.status).toBe(200);
  });
});

describe('releasing a batch', () => {
  const queueTwo = async () => {
    await asAgent(request(app).post('/api/google/docs/d/comments/c1/replies')).send({ text: 'Fixed' });
    await asAgent(request(app).post('/api/google/docs/d/comments/c1/resolve')).send({});
  };

  it('refuses an agent send until the owner says 发 <code>', async () => {
    await queueTwo();
    const res = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/send')).send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'needs_owner_confirmation', reason: 'no_confirmation' });
    expect(docComments.reply).not.toHaveBeenCalled();
    expect(listDocCommentBatches()).toHaveLength(1);
  });

  it('one owner OK posts the whole batch, in order', async () => {
    await queueTwo();
    ownerMessages = [{ at: Date.now() + 10, text: '发 C1' }];
    const res = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/send')).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ batch: 'C1', posted: 2, remaining: 0 });
    expect(docComments.reply).toHaveBeenCalledWith('d', 'c1', 'Fixed');
    expect(docComments.resolve).toHaveBeenCalledWith('d', 'c1', undefined);
    expect(listDocCommentBatches()).toHaveLength(0);
  });

  it('an OK that predates the last queued comment does not count', async () => {
    ownerMessages = [{ at: Date.now() - 60_000, text: '发 C1' }];
    await queueTwo();
    const res = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/send')).send({});
    expect(res.status).toBe(403);
    expect(docComments.reply).not.toHaveBeenCalled();
  });

  it('the owner credential can post a batch from the dashboard', async () => {
    await queueTwo();
    const res = await request(app).post('/api/google/doc-comment-batches/C1/send').send({});
    expect(res.status).toBe(200);
    expect(docComments.reply).toHaveBeenCalledTimes(1);
  });

  it('stops on the first failure and keeps the rest queued, so a retry never double-posts', async () => {
    await queueTwo();
    docComments.resolve.mockRejectedValueOnce(new GoogleWorkspaceError(502, 'google_error', 'boom'));
    ownerMessages = [{ at: Date.now() + 10, text: '发 C1' }];
    const first = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/send')).send({});
    expect(first.status).toBe(207);
    expect(first.body).toMatchObject({ success: false, error: 'partial', data: { posted: 1, remaining: 1 } });

    const retry = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/send')).send({});
    expect(retry.status).toBe(200);
    expect(docComments.reply).toHaveBeenCalledTimes(1);
    expect(docComments.resolve).toHaveBeenCalledTimes(2);
  });

  it('a failure on the first item uses the normal Google error mapping', async () => {
    await queueTwo();
    docComments.reply.mockRejectedValueOnce(new GoogleWorkspaceError(403, 'reauth_required', 'needs Drive edit access'));
    const res = await request(app).post('/api/google/doc-comment-batches/C1/send').send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'reauth_required' });
    expect(listDocCommentBatches()[0].items).toHaveLength(2);
  });

  it('acts as the Google account each item was queued for', async () => {
    await asAgent(request(app).post('/api/google/docs/d/comments/c1/replies')).set('X-Google-Account', 'work@x.com').send({ text: 'ok' });
    const res = await request(app).post('/api/google/doc-comment-batches/C1/send').send({});
    expect(res.status).toBe(200);
    expect(docComments.reply).toHaveBeenCalledWith('d', 'c1', 'ok');
  });

  it('404s an unknown batch; discard drops a queued one', async () => {
    expect((await request(app).post('/api/google/doc-comment-batches/C9/send').send({})).status).toBe(404);
    await queueTwo();
    const list = await request(app).get('/api/google/doc-comment-batches');
    expect(list.body.data.batches[0]).toMatchObject({ code: 'C1', agentSession: 'ella' });
    const gone = await asAgent(request(app).post('/api/google/doc-comment-batches/C1/discard')).send({});
    expect(gone.body.data).toMatchObject({ discarded: true, dropped: 2 });
    expect(listDocCommentBatches()).toHaveLength(0);
  });
});
