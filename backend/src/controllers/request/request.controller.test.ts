/**
 * Tests for Request Controller — HTTP handlers for V3 Request API.
 *
 * @module controllers/request/request.controller.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { listRequests, getRequest, createRequestHandler, planRequest, updateRequest, getRequestWhereabouts } from './request.controller.js';

// Mock RequestService
const mockRequests = new Map<string, unknown>();

const mockPlan = jest.fn<(message: string, options?: Record<string, unknown>) => Promise<unknown>>().mockImplementation(async (message: string, _options?: Record<string, unknown>) => ({
  message,
  tasks: [
    { title: 'Task 1', description: 'Do thing 1', acceptanceCriteria: ['Done'], priority: 'high' },
    { title: 'Task 2', description: 'Do thing 2', acceptanceCriteria: ['Done'], priority: 'medium' },
  ],
  reasoning: 'Decomposed using "build" strategy into 2 tasks.',
  strategy: 'build',
}));

jest.mock('../../services/v3/request.service.js', () => ({
  RequestService: {
    getInstance: () => ({
      listAll: jest.fn().mockImplementation(async () => Array.from(mockRequests.values())),
      getById: jest.fn<(id: string) => Promise<unknown>>().mockImplementation(async (id: string) => mockRequests.get(id) ?? null),
      create: jest.fn().mockImplementation(async (input: unknown) => {
        const req = { id: 'req-new', ...(input as Record<string, unknown>), status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), workItemIds: [] };
        mockRequests.set(req.id, req);
        return req;
      }),
      update: jest.fn<(id: string, updates: unknown) => Promise<unknown>>().mockImplementation(async (id: string, updates: unknown) => {
        const existing = mockRequests.get(id);
        if (!existing) throw new Error(`Request not found: ${id}`);
        const updated = { ...(existing as Record<string, unknown>), ...(updates as Record<string, unknown>) };
        mockRequests.set(id, updated);
        return updated;
      }),
      plan: mockPlan,
    }),
  },
}));

const mockPoolItems: unknown[] = [];
jest.mock('../../services/task-pool/task-pool.service.js', () => ({
  TaskPoolService: { getInstance: () => ({ getAllItems: async () => mockPoolItems }) },
}));
const mockAsks: unknown[] = [];
jest.mock('../../services/messaging/agent-ask-ledger.service.js', () => ({
  getAgentAskLedger: () => ({ openAsks: () => mockAsks }),
}));

/**
 * Creates a mock Express request object.
 *
 * @param overrides - Properties to override
 * @returns Mock request
 */
function mockReq(overrides: Record<string, unknown> = {}): unknown {
  return {
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
}

/**
 * Creates a mock Express response object with chainable methods.
 *
 * @returns Mock response with json, status methods
 */
function mockRes(): { json: ReturnType<typeof jest.fn>; status: ReturnType<typeof jest.fn>; _lastJson: unknown; _statusCode: number } {
  const res: Record<string, unknown> = {};
  res._lastJson = null;
  res._statusCode = 200;
  res.json = jest.fn().mockImplementation((data: unknown) => {
    res._lastJson = data;
    return res;
  });
  res.status = jest.fn<(code: number) => unknown>().mockImplementation((code: number) => {
    res._statusCode = code;
    return res;
  });
  return res as ReturnType<typeof mockRes>;
}

describe('Request Controller', () => {
  beforeEach(() => {
    mockRequests.clear();
    // Seed a test request
    mockRequests.set('req-1', {
      id: 'req-1',
      sourceConversationItemId: 'conv-1',
      title: 'Test request',
      description: 'A test request',
      status: 'open',
      priority: 'normal',
      workItemIds: [],
      createdAt: '2026-04-06T00:00:00Z',
      updatedAt: '2026-04-06T00:00:00Z',
    });
  });

  describe('listRequests', () => {
    it('should return all requests', async () => {
      const req = mockReq();
      const res = mockRes();

      await listRequests(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        count: 1,
      }));
    });
  });

  describe('getRequest', () => {
    it('should return a request by ID', async () => {
      const req = mockReq({ params: { id: 'req-1' } });
      const res = mockRes();

      await getRequest(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'req-1' }),
      }));
    });

    it('should return 404 for non-existent request', async () => {
      const req = mockReq({ params: { id: 'nonexistent' } });
      const res = mockRes();

      await getRequest(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if id is missing', async () => {
      const req = mockReq({ params: {} });
      const res = mockRes();

      await getRequest(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createRequestHandler', () => {
    it('should create a new request', async () => {
      const req = mockReq({
        body: {
          sourceConversationItemId: 'conv-new',
          title: 'New request',
          description: 'A new request',
        },
      });
      const res = mockRes();

      await createRequestHandler(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ title: 'New request' }),
      }));
    });

    it('should return 400 for invalid body', async () => {
      const req = mockReq({ body: null });
      const res = mockRes();

      await createRequestHandler(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('planRequest', () => {
    it('should return a plan for a valid message', async () => {
      const req = mockReq({ body: { message: 'Build a new search feature' } });
      const res = mockRes();

      await planRequest(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          message: 'Build a new search feature',
          tasks: expect.arrayContaining([
            expect.objectContaining({ title: 'Task 1' }),
          ]),
          strategy: 'build',
        }),
      }));
    });

    it('should return 400 when message is missing', async () => {
      const req = mockReq({ body: {} });
      const res = mockRes();

      await planRequest(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when message is not a string', async () => {
      const req = mockReq({ body: { message: 123 } });
      const res = mockRes();

      await planRequest(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should pass options to the plan service when provided', async () => {
      const req = mockReq({
        body: { message: 'Build a search feature', options: { maxTasks: 5, defaultPriority: 'high' } },
      });
      const res = mockRes();

      await planRequest(req as any, res as any);

      expect(mockPlan).toHaveBeenCalledWith('Build a search feature', { maxTasks: 5, defaultPriority: 'high' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateRequest', () => {
    it('should update a request', async () => {
      const req = mockReq({
        params: { id: 'req-1' },
        body: { title: 'Updated title' },
      });
      const res = mockRes();

      await updateRequest(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ title: 'Updated title' }),
      }));
    });

    it('should return 404 for non-existent request', async () => {
      const req = mockReq({
        params: { id: 'nonexistent' },
        body: { title: 'nope' },
      });
      const res = mockRes();

      await updateRequest(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

describe('getRequestWhereabouts', () => {
  beforeEach(() => {
    mockRequests.clear();
    mockPoolItems.length = 0;
    mockAsks.length = 0;
    mockRequests.set('req-w', { id: 'req-w', title: 'Video', status: 'running', ticketNumber: 12, workItemIds: [], createdAt: '2026-10-14T13:00:00Z', updatedAt: '2026-10-14T13:00:00Z' });
  });

  it('returns the holders, by id or by ticket number', async () => {
    mockPoolItems.push({ id: 'wi-1', type: 'delegate', status: 'running', title: 'Make it', requestId: 'req-w', target: 'dex', createdAt: '2026-10-14T13:05:00Z', metadata: {} });
    mockAsks.push({ sender: 'dex', target: 'sam', excerpt: 'render it', deliveredAt: Date.parse('2026-10-14T13:10:00Z') });
    for (const id of ['req-w', 'TKT-12', '12']) {
      const res = mockRes();
      await getRequestWhereabouts(mockReq({ params: { id } }) as never, res as never);
      const body = res._lastJson as { success: boolean; data: { holders: Array<{ session: string; state: string }> } };
      expect(body.success).toBe(true);
      expect(body.data.holders.map((h) => `${h.session}:${h.state}`)).toEqual(['dex:waiting_on_agent', 'sam:working']);
    }
  });

  it('404 for an unknown request', async () => {
    const res = mockRes();
    await getRequestWhereabouts(mockReq({ params: { id: 'TKT-99' } }) as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
