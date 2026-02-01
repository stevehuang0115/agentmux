/**
 * Tests for Self-Improvement Tool Handlers
 *
 * @module tools/self-improve-tools.test
 */

import { handleSelfImprove } from './self-improve-tools.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Self-Improvement Tool Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSelfImprove', () => {
    describe('plan action', () => {
      it('should create a plan successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 'si-123',
              description: 'Test improvement',
              targetFiles: ['src/test.ts'],
              riskLevel: 'low',
              requiresRestart: true,
            },
          }),
        });

        const result = await handleSelfImprove({
          action: 'plan',
          description: 'Test improvement',
          files: [
            {
              path: 'src/test.ts',
              operation: 'modify',
              content: 'new content',
              description: 'Modify test file',
            },
          ],
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe('Improvement plan created');
        expect(result.plan).toEqual({
          id: 'si-123',
          description: 'Test improvement',
          filesAffected: 1,
          riskLevel: 'low',
          requiresRestart: true,
        });
        expect(result.nextSteps).toContain('si-123');
      });

      it('should handle plan creation failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
          json: async () => ({ error: 'Invalid request' }),
        });

        const result = await handleSelfImprove({
          action: 'plan',
          description: 'Test',
          files: [],
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid request');
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await handleSelfImprove({
          action: 'plan',
          description: 'Test',
          files: [],
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });

    describe('execute action', () => {
      it('should execute a plan successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              started: true,
              message: 'Changes applied',
              taskId: 'si-123',
            },
          }),
        });

        const result = await handleSelfImprove({
          action: 'execute',
          planId: 'si-123',
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe('Changes applied');
        expect(result.taskId).toBe('si-123');
      });

      it('should handle execution failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Server Error',
          json: async () => ({ error: 'Execution failed' }),
        });

        const result = await handleSelfImprove({
          action: 'execute',
          planId: 'invalid',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Execution failed');
      });
    });

    describe('status action', () => {
      it('should return active improvement status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: 'si-123',
              description: 'Test improvement',
              phase: 'validating',
              restartCount: 1,
              targetFiles: ['src/test.ts'],
              lastUpdatedAt: '2024-01-01T00:00:00Z',
            },
          }),
        });

        const result = await handleSelfImprove({ action: 'status' });

        expect(result.success).toBe(true);
        expect(result.hasActive).toBe(true);
        expect(result.improvement).toEqual({
          id: 'si-123',
          description: 'Test improvement',
          phase: 'validating',
          restartCount: 1,
          filesAffected: 1,
          lastUpdated: '2024-01-01T00:00:00Z',
        });
      });

      it('should return no active improvement', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: null }),
        });

        const result = await handleSelfImprove({ action: 'status' });

        expect(result.success).toBe(true);
        expect(result.hasActive).toBe(false);
        expect(result.message).toBe('No active self-improvement');
      });
    });

    describe('rollback action', () => {
      it('should rollback successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              success: true,
              filesRestored: 3,
              gitReset: false,
            },
          }),
        });

        const result = await handleSelfImprove({
          action: 'rollback',
          reason: 'Tests failing',
        });

        expect(result.success).toBe(true);
        expect(result.message).toBe('Rollback completed');
        expect(result.filesRestored).toBe(3);
        expect(result.reason).toBe('Tests failing');
      });

      it('should handle rollback failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Server Error',
          json: async () => ({ error: 'No backup available' }),
        });

        const result = await handleSelfImprove({
          action: 'rollback',
          reason: 'Test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('No backup available');
      });
    });

    describe('cancel action', () => {
      it('should cancel successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { cancelled: true } }),
        });

        const result = await handleSelfImprove({ action: 'cancel' });

        expect(result.success).toBe(true);
        expect(result.message).toBe('Improvement cancelled');
      });

      it('should handle cancel failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          statusText: 'Server Error',
          json: async () => ({ error: 'Cannot cancel in current phase' }),
        });

        const result = await handleSelfImprove({ action: 'cancel' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Cannot cancel in current phase');
      });
    });

    describe('unknown action', () => {
      it('should handle unknown action', async () => {
        const result = await handleSelfImprove({
          action: 'unknown' as 'status',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown action');
      });
    });
  });
});
