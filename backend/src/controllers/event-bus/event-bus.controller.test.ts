/**
 * Tests for Event Bus Controller
 *
 * @module controllers/event-bus/event-bus.controller.test
 */

import {
  setEventBusService,
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  getSubscription,
} from './event-bus.controller.js';

// Mock logger
jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

/**
 * Create a mock Express request
 */
function mockRequest(overrides: any = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

/**
 * Create a mock Express response
 */
function mockResponse(): any {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

const mockNext = jest.fn();

describe('EventBusController', () => {
  let mockEventBus: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      listSubscriptions: jest.fn(),
      getSubscription: jest.fn(),
    };
    setEventBusService(mockEventBus);
  });

  describe('createSubscription', () => {
    it('should create a subscription and return 201', async () => {
      const sub = { id: 'sub-1', eventType: 'agent:idle' };
      mockEventBus.subscribe.mockReturnValue(sub);

      const req = mockRequest({
        body: { eventType: 'agent:idle', filter: {}, subscriberSession: 'orc' },
      });
      const res = mockResponse();

      await createSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: sub });
    });

    it('should return 400 for invalid input', async () => {
      mockEventBus.subscribe.mockImplementation(() => {
        throw new Error('Invalid subscription input');
      });

      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await createSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 429 when limit reached', async () => {
      mockEventBus.subscribe.mockImplementation(() => {
        throw new Error('Subscription limit reached for session orc (max 50)');
      });

      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await createSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should return 503 when service not initialized', async () => {
      setEventBusService(null as any);

      const req = mockRequest({ body: {} });
      const res = mockResponse();

      await createSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('deleteSubscription', () => {
    it('should delete subscription and return success', async () => {
      mockEventBus.unsubscribe.mockReturnValue(true);

      const req = mockRequest({ params: { subscriptionId: 'sub-1' } });
      const res = mockResponse();

      await deleteSubscription(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { subscriptionId: 'sub-1' },
      });
    });

    it('should return 404 for unknown subscription', async () => {
      mockEventBus.unsubscribe.mockReturnValue(false);

      const req = mockRequest({ params: { subscriptionId: 'unknown' } });
      const res = mockResponse();

      await deleteSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 503 when service not initialized', async () => {
      setEventBusService(null as any);

      const req = mockRequest({ params: { subscriptionId: 'sub-1' } });
      const res = mockResponse();

      await deleteSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('listSubscriptions', () => {
    it('should return all subscriptions', async () => {
      const subs = [{ id: 'sub-1' }, { id: 'sub-2' }];
      mockEventBus.listSubscriptions.mockReturnValue(subs);

      const req = mockRequest();
      const res = mockResponse();

      await listSubscriptions(req, res, mockNext);

      expect(mockEventBus.listSubscriptions).toHaveBeenCalledWith(undefined);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: subs });
    });

    it('should filter by subscriberSession query param', async () => {
      mockEventBus.listSubscriptions.mockReturnValue([]);

      const req = mockRequest({ query: { subscriberSession: 'orc' } });
      const res = mockResponse();

      await listSubscriptions(req, res, mockNext);

      expect(mockEventBus.listSubscriptions).toHaveBeenCalledWith('orc');
    });

    it('should return 503 when service not initialized', async () => {
      setEventBusService(null as any);

      const req = mockRequest();
      const res = mockResponse();

      await listSubscriptions(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });

  describe('getSubscription', () => {
    it('should return a single subscription', async () => {
      const sub = { id: 'sub-1', eventType: 'agent:idle' };
      mockEventBus.getSubscription.mockReturnValue(sub);

      const req = mockRequest({ params: { subscriptionId: 'sub-1' } });
      const res = mockResponse();

      await getSubscription(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({ success: true, data: sub });
    });

    it('should return 404 for unknown subscription', async () => {
      mockEventBus.getSubscription.mockReturnValue(undefined);

      const req = mockRequest({ params: { subscriptionId: 'unknown' } });
      const res = mockResponse();

      await getSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 503 when service not initialized', async () => {
      setEventBusService(null as any);

      const req = mockRequest({ params: { subscriptionId: 'sub-1' } });
      const res = mockResponse();

      await getSubscription(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
    });
  });
});
