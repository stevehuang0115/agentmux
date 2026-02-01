/**
 * Self-Improve MCP Tools Tests
 *
 * Tests for the self-improvement MCP tool handlers.
 *
 * @module tools/self-improve.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSelfImprovePlan,
  handleSelfImproveExecute,
  handleSelfImproveStatus,
  handleSelfImproveCancel,
  handleSelfImproveRollback,
  handleSelfImproveHistory,
  selfImproveToolDefinition,
} from './self-improve-tools.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('self-improve-tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('handleSelfImprovePlan', () => {
    it('should create an improvement plan', async () => {
      const mockPlan = {
        id: 'si-123456',
        description: 'Test improvement',
        targetFiles: ['src/test.ts'],
        riskLevel: 'low',
        requiresRestart: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlan),
      });

      const result = await handleSelfImprovePlan({
        description: 'Test improvement',
        files: [{
          path: 'src/test.ts',
          operation: 'modify',
          content: 'new content',
          description: 'Update test file',
        }],
      });

      expect(result).toContain('Improvement plan created');
      expect(result).toContain('si-123456');
      expect(result).toContain('Risk level: low');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/self-improvement/plan'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle plan creation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Another improvement is pending'),
      });

      const result = await handleSelfImprovePlan({
        description: 'Test',
        files: [{ path: 'test.ts', operation: 'modify', description: 'test' }],
      });

      expect(result).toContain('Failed to create improvement plan');
    });
  });

  describe('handleSelfImproveExecute', () => {
    it('should execute an improvement plan', async () => {
      const mockResult = {
        started: true,
        message: 'Changes applied',
        taskId: 'si-123456',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await handleSelfImproveExecute({
        planId: 'si-123456',
      });

      expect(result).toContain('Improvement execution started');
      expect(result).toContain('si-123456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/self-improvement/execute'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle execute failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('No improvement planned'),
      });

      const result = await handleSelfImproveExecute({ planId: 'invalid' });

      expect(result).toContain('Failed to execute improvement');
    });
  });

  describe('handleSelfImproveStatus', () => {
    it('should return current status', async () => {
      const mockStatus = {
        id: 'si-123456',
        description: 'Test improvement',
        phase: 'planning',
        targetFiles: ['src/test.ts'],
        startedAt: '2024-01-01T00:00:00Z',
        changesApplied: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const result = await handleSelfImproveStatus();

      expect(result).toContain('Current self-improvement status');
      expect(result).toContain('si-123456');
      expect(result).toContain('planning');
    });

    it('should indicate no pending tasks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });

      const result = await handleSelfImproveStatus();

      expect(result).toContain('No pending self-improvement tasks');
    });
  });

  describe('handleSelfImproveCancel', () => {
    it('should cancel a planned improvement', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await handleSelfImproveCancel();

      expect(result).toContain('cancelled successfully');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/self-improvement/cancel'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should handle cancel failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Cannot cancel: improvement is in executing phase'),
      });

      const result = await handleSelfImproveCancel();

      expect(result).toContain('Failed to cancel improvement');
    });
  });

  describe('handleSelfImproveRollback', () => {
    it('should rollback changes', async () => {
      const mockResult = {
        success: true,
        filesRestored: 3,
        message: 'Changes reverted',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await handleSelfImproveRollback({
        reason: 'Tests failing',
      });

      expect(result).toContain('Rollback completed');
      expect(result).toContain('Files restored: 3');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/self-improvement/rollback'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('handleSelfImproveHistory', () => {
    it('should return improvement history', async () => {
      const mockHistory = [
        { id: 'si-1', description: 'Fix bug', phase: 'completed', startedAt: '2024-01-01' },
        { id: 'si-2', description: 'Add feature', phase: 'completed', startedAt: '2024-01-02' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHistory),
      });

      const result = await handleSelfImproveHistory();

      expect(result).toContain('Recent improvement history');
      expect(result).toContain('si-1');
      expect(result).toContain('Fix bug');
    });

    it('should indicate empty history', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await handleSelfImproveHistory();

      expect(result).toContain('No improvement history found');
    });
  });

  describe('selfImproveToolDefinition', () => {
    it('should have correct name and description', () => {
      expect(selfImproveToolDefinition.name).toBe('self_improve');
      expect(selfImproveToolDefinition.description).toContain('Safely modify the AgentMux codebase');
    });

    it('should have action as required property', () => {
      expect(selfImproveToolDefinition.inputSchema.required).toContain('action');
    });

    it('should include all actions in enum', () => {
      const actionProp = selfImproveToolDefinition.inputSchema.properties.action;
      expect(actionProp.enum).toContain('plan');
      expect(actionProp.enum).toContain('execute');
      expect(actionProp.enum).toContain('status');
      expect(actionProp.enum).toContain('cancel');
      expect(actionProp.enum).toContain('rollback');
      expect(actionProp.enum).toContain('history');
    });
  });
});
