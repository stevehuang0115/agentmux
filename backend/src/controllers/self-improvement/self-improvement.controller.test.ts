/**
 * Tests for Self-Improvement Controller
 *
 * @module controllers/self-improvement/self-improvement.controller.test
 */

import express from 'express';
import request from 'supertest';
import selfImprovementRouter from './self-improvement.controller.js';

// Mock the services
jest.mock('../../services/orchestrator/index.js', () => ({
  getSelfImprovementService: jest.fn(() => ({
    planImprovement: jest.fn(),
    executeImprovement: jest.fn(),
    getStatus: jest.fn(),
    cancelImprovement: jest.fn(),
    getHistory: jest.fn(),
  })),
  getImprovementMarkerService: jest.fn(() => ({
    getPendingImprovement: jest.fn(),
    recordRollbackStarted: jest.fn(),
    recordRollbackCompleted: jest.fn(),
    completeImprovement: jest.fn(),
  })),
}));

import {
  getSelfImprovementService,
  getImprovementMarkerService,
} from '../../services/orchestrator/index.js';

describe('SelfImprovementController', () => {
  let app: express.Application;
  let mockSelfImprovementService: jest.Mocked<ReturnType<typeof getSelfImprovementService>>;
  let mockMarkerService: jest.Mocked<ReturnType<typeof getImprovementMarkerService>>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/self-improvement', selfImprovementRouter);

    mockSelfImprovementService = getSelfImprovementService() as jest.Mocked<
      ReturnType<typeof getSelfImprovementService>
    >;
    mockMarkerService = getImprovementMarkerService() as jest.Mocked<
      ReturnType<typeof getImprovementMarkerService>
    >;

    jest.clearAllMocks();
  });

  describe('POST /plan', () => {
    it('should create a plan successfully', async () => {
      const planResult = {
        id: 'si-123',
        description: 'Test improvement',
        targetFiles: ['src/test.ts'],
        changes: [{ file: 'src/test.ts', type: 'modify' as const, description: 'Test' }],
        riskLevel: 'low' as const,
        requiresRestart: true,
      };

      mockSelfImprovementService.planImprovement.mockResolvedValue(planResult);

      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test improvement',
          targetFiles: ['src/test.ts'],
          changes: [
            { file: 'src/test.ts', type: 'modify', description: 'Test', content: 'new content' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(planResult);
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({ description: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 500 for service errors', async () => {
      mockSelfImprovementService.planImprovement.mockRejectedValue(
        new Error('Another improvement pending')
      );

      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test',
          targetFiles: ['src/test.ts'],
          changes: [],
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Another improvement pending');
    });
  });

  describe('POST /execute', () => {
    it('should return 400 for missing planId', async () => {
      const response = await request(app)
        .post('/api/self-improvement/execute')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('planId');
    });

    it('should return 404 for unknown planId', async () => {
      const response = await request(app)
        .post('/api/self-improvement/execute')
        .send({ planId: 'unknown-id' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No pending request');
    });
  });

  describe('GET /status', () => {
    it('should return status successfully', async () => {
      mockSelfImprovementService.getStatus.mockResolvedValue(null);

      const response = await request(app).get('/api/self-improvement/status');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });

    it('should return active improvement', async () => {
      const status = {
        id: 'si-123',
        description: 'Test',
        phase: 'planning' as const,
        restartCount: 0,
        targetFiles: ['src/test.ts'],
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        backup: { files: [], createdAt: '' },
        changes: [],
        validation: { required: [], results: [] },
      };

      mockSelfImprovementService.getStatus.mockResolvedValue(status);

      const response = await request(app).get('/api/self-improvement/status');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(status);
    });
  });

  describe('POST /rollback', () => {
    it('should return 400 for missing reason', async () => {
      const response = await request(app)
        .post('/api/self-improvement/rollback')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('reason');
    });

    it('should return 404 when no improvement to rollback', async () => {
      mockMarkerService.getPendingImprovement.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/self-improvement/rollback')
        .send({ reason: 'Tests failing' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('No improvement to rollback');
    });
  });

  describe('POST /cancel', () => {
    it('should cancel successfully', async () => {
      mockSelfImprovementService.getStatus.mockResolvedValue(null);
      mockSelfImprovementService.cancelImprovement.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/self-improvement/cancel')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.cancelled).toBe(true);
    });
  });

  describe('GET /history', () => {
    it('should return history successfully', async () => {
      mockSelfImprovementService.getHistory.mockResolvedValue([]);

      const response = await request(app).get('/api/self-improvement/history');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should respect limit query parameter', async () => {
      mockSelfImprovementService.getHistory.mockResolvedValue([]);

      await request(app).get('/api/self-improvement/history?limit=5');

      expect(mockSelfImprovementService.getHistory).toHaveBeenCalledWith(5);
    });
  });
});
