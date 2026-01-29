/**
 * Tests for Autonomous Services Index
 *
 * @module services/autonomous/index.test
 */

import {
  AutoAssignService,
  AgentWorkload,
  IAutoAssignService,
  BudgetService,
  IBudgetService,
} from './index.js';

describe('Autonomous Services Index', () => {
  describe('AutoAssignService exports', () => {
    it('should export AutoAssignService', () => {
      expect(AutoAssignService).toBeDefined();
      expect(typeof AutoAssignService.getInstance).toBe('function');
    });

    it('should export AgentWorkload type', () => {
      // Type exports are validated at compile time
      // This test verifies the export exists at runtime
      const workload: AgentWorkload = {
        sessionName: 'test-session',
        agentId: 'agent-1',
        role: 'developer',
        currentTasks: [],
        completedToday: 0,
        averageIterations: 0,
      };

      expect(workload.sessionName).toBe('test-session');
    });

    it('should export IAutoAssignService interface', () => {
      // Interface exports are validated at compile time
      // This test documents the expected interface methods
      const interfaceMethods = [
        'initialize',
        'getConfig',
        'setConfig',
        'assignNextTask',
        'findNextTask',
        'assignTask',
        'getTaskQueue',
        'refreshQueue',
        'getAgentWorkload',
        'onTaskAssigned',
        'onAgentIdle',
        'pauseAutoAssign',
        'resumeAutoAssign',
        'isAutoAssignEnabled',
      ];

      // Verify the AutoAssignService implements the interface
      const instance = AutoAssignService.getInstance();
      for (const method of interfaceMethods) {
        expect(typeof (instance as any)[method]).toBe('function');
      }

      AutoAssignService.clearInstance();
    });
  });

  describe('BudgetService exports', () => {
    it('should export BudgetService', () => {
      expect(BudgetService).toBeDefined();
      expect(typeof BudgetService.getInstance).toBe('function');
    });

    it('should export IBudgetService interface', () => {
      // Interface exports are validated at compile time
      // This test documents the expected interface methods
      const interfaceMethods = [
        'initialize',
        'recordUsage',
        'getUsage',
        'getProjectUsage',
        'setBudget',
        'getBudget',
        'checkBudget',
        'isWithinBudget',
        'getRemainingBudget',
        'onBudgetWarning',
        'onBudgetExceeded',
        'generateReport',
      ];

      // Verify the BudgetService implements the interface
      const instance = BudgetService.getInstance();
      for (const method of interfaceMethods) {
        expect(typeof (instance as any)[method]).toBe('function');
      }

      BudgetService.clearInstance();
    });
  });
});
