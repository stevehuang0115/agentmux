/**
 * Self-Improvement Controller Tests
 *
 * Tests for the self-improvement REST API endpoints.
 *
 * @module controllers/self-improvement.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import selfImprovementRouter from './self-improvement.controller.js';

// Mock the services
vi.mock('../../services/orchestrator/index.js', () => ({
  getSelfImprovementService: vi.fn(() => ({
    planImprovement: vi.fn(),
    executeImprovement: vi.fn(),
    getStatus: vi.fn(),
    cancelImprovement: vi.fn(),
    getHistory: vi.fn(),
  })),
}));

vi.mock('../../services/orchestrator/improvement-startup.service.js', () => ({
  getImprovementStartupService: vi.fn(() => ({
    forceRollback: vi.fn(),
  })),
}));

import { getSelfImprovementService } from '../../services/orchestrator/index.js';

describe('self-improvement.controller', () => {
  let app: express.Application;
  let mockService: ReturnType<typeof getSelfImprovementService>;

  beforeEach(() => {
    vi.resetAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/self-improvement', selfImprovementRouter);

    mockService = getSelfImprovementService();
  });

  describe('POST /api/self-improvement/plan', () => {
    it('should create an improvement plan', async () => {
      const mockPlan = {
        id: 'si-123',
        description: 'Test improvement',
        targetFiles: ['src/test.ts'],
        riskLevel: 'low',
        requiresRestart: true,
      };

      vi.mocked(mockService.planImprovement).mockResolvedValue(mockPlan);

      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test improvement',
          targetFiles: ['src/test.ts'],
          changes: [{ file: 'src/test.ts', type: 'modify', description: 'Update test' }],
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('si-123');
      expect(response.body.riskLevel).toBe('low');
    });

    it('should return 400 on plan error', async () => {
      vi.mocked(mockService.planImprovement).mockRejectedValue(
        new Error('Another improvement is pending')
      );

      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test',
          targetFiles: ['test.ts'],
          changes: [{ file: 'test.ts', type: 'modify', description: 'Test change' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Another improvement is pending');
    });

    it('should return 400 when description is missing', async () => {
      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          targetFiles: ['test.ts'],
          changes: [{ file: 'test.ts', type: 'modify', description: 'Test' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('description is required');
    });

    it('should return 400 when targetFiles is empty', async () => {
      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test',
          targetFiles: [],
          changes: [{ file: 'test.ts', type: 'modify', description: 'Test' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('targetFiles is required');
    });

    it('should return 400 when changes is empty', async () => {
      const response = await request(app)
        .post('/api/self-improvement/plan')
        .send({
          description: 'Test',
          targetFiles: ['test.ts'],
          changes: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('changes is required');
    });
  });

  describe('GET /api/self-improvement/status', () => {
    it('should return current status', async () => {
      const mockStatus = {
        id: 'si-123',
        description: 'Test',
        phase: 'planning',
        targetFiles: ['test.ts'],
      };

      vi.mocked(mockService.getStatus).mockResolvedValue(mockStatus as never);

      const response = await request(app)
        .get('/api/self-improvement/status');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('si-123');
      expect(response.body.phase).toBe('planning');
    });

    it('should return null when no pending improvement', async () => {
      vi.mocked(mockService.getStatus).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/self-improvement/status');

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });

  describe('POST /api/self-improvement/cancel', () => {
    it('should cancel planned improvement', async () => {
      vi.mocked(mockService.cancelImprovement).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/self-improvement/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 on cancel error', async () => {
      vi.mocked(mockService.cancelImprovement).mockRejectedValue(
        new Error('Cannot cancel: in execution phase')
      );

      const response = await request(app)
        .post('/api/self-improvement/cancel');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot cancel');
    });
  });

  describe('GET /api/self-improvement/history', () => {
    it('should return improvement history', async () => {
      const mockHistory = [
        { id: 'si-1', description: 'First', phase: 'completed' },
        { id: 'si-2', description: 'Second', phase: 'completed' },
      ];

      vi.mocked(mockService.getHistory).mockResolvedValue(mockHistory as never);

      const response = await request(app)
        .get('/api/self-improvement/history');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('si-1');
    });

    it('should respect limit parameter', async () => {
      vi.mocked(mockService.getHistory).mockResolvedValue([]);

      await request(app)
        .get('/api/self-improvement/history?limit=5');

      expect(mockService.getHistory).toHaveBeenCalledWith(5);
    });

    it('should cap limit at 100', async () => {
      vi.mocked(mockService.getHistory).mockResolvedValue([]);

      await request(app)
        .get('/api/self-improvement/history?limit=999');

      expect(mockService.getHistory).toHaveBeenCalledWith(100);
    });

    it('should use default limit for invalid values', async () => {
      vi.mocked(mockService.getHistory).mockResolvedValue([]);

      await request(app)
        .get('/api/self-improvement/history?limit=invalid');

      expect(mockService.getHistory).toHaveBeenCalledWith(10);
    });
  });
});
