/**
 * Tests for Budget Service
 *
 * @module services/autonomous/budget.service.test
 */

import { BudgetService } from './budget.service.js';
import {
  UsageRecord,
  BudgetConfig,
  BudgetAlert,
  BUDGET_CONSTANTS,
  DEFAULT_BUDGET_CONFIG,
} from '../../types/budget.types.js';

// Mock dependencies
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn().mockReturnValue({
      createComponentLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }),
    }),
  },
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rename: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  open: jest.fn().mockResolvedValue({
    sync: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
}));

describe('BudgetService', () => {
  let service: BudgetService;

  const testAgentId = 'test-agent-001';
  const testSessionName = 'test-session';
  const testProjectPath = '/test/project';

  beforeEach(() => {
    // Clear singleton and mocks
    BudgetService.clearInstance();
    service = BudgetService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.clearCache();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = BudgetService.getInstance();
      const instance2 = BudgetService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should clear instance correctly', () => {
      const instance1 = BudgetService.getInstance();
      BudgetService.clearInstance();
      const instance2 = BudgetService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost for claude-3-sonnet model', () => {
      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-sonnet',
        operation: 'task',
      };

      const cost = service.calculateCost(record);

      // Expected: 1000 * 0.000003 + 500 * 0.000015 = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 6);
    });

    it('should calculate cost for claude-3-opus model', () => {
      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-opus',
        operation: 'task',
      };

      const cost = service.calculateCost(record);

      // Expected: 1000 * 0.000015 + 500 * 0.000075 = 0.015 + 0.0375 = 0.0525
      expect(cost).toBeCloseTo(0.0525, 6);
    });

    it('should calculate cost for claude-3-haiku model', () => {
      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 10000,
        outputTokens: 5000,
        model: 'claude-3-haiku',
        operation: 'task',
      };

      const cost = service.calculateCost(record);

      // Expected: 10000 * 0.00000025 + 5000 * 0.00000125 = 0.0025 + 0.00625 = 0.00875
      expect(cost).toBeCloseTo(0.00875, 6);
    });

    it('should use default rates for unknown models', () => {
      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 1000,
        outputTokens: 500,
        model: 'unknown-model',
        operation: 'task',
      };

      const cost = service.calculateCost(record);

      // Uses default rates (same as sonnet)
      expect(cost).toBeCloseTo(0.0105, 6);
    });
  });

  describe('Budget Configuration', () => {
    it('should use default budget config initially', async () => {
      const budget = await service.getBudget('global');

      expect(budget.dailyLimit).toBe(DEFAULT_BUDGET_CONFIG.dailyLimit);
      expect(budget.warningThreshold).toBe(DEFAULT_BUDGET_CONFIG.warningThreshold);
    });

    it('should set and get agent-specific budget', async () => {
      const fs = require('fs/promises');
      fs.writeFile.mockResolvedValue(undefined);

      const agentBudget: BudgetConfig = {
        scope: 'agent',
        scopeId: testAgentId,
        dailyLimit: 10.0,
        warningThreshold: 0.75,
      };

      await service.setBudget(agentBudget);
      const retrieved = await service.getBudget(testAgentId);

      expect(retrieved.dailyLimit).toBe(10.0);
      expect(retrieved.warningThreshold).toBe(0.75);
    });

    it('should set and get project-specific budget', async () => {
      const fs = require('fs/promises');
      fs.writeFile.mockResolvedValue(undefined);

      const projectBudget: BudgetConfig = {
        scope: 'project',
        scopeId: testProjectPath,
        dailyLimit: 25.0,
        warningThreshold: 0.9,
      };

      await service.setBudget(projectBudget);
      const retrieved = await service.getBudget(testProjectPath);

      expect(retrieved.dailyLimit).toBe(25.0);
    });

    it('should fall back to global budget for unknown scope', async () => {
      const budget = await service.getBudget('unknown-scope');

      expect(budget).toEqual(expect.objectContaining({
        scope: 'global',
        scopeId: 'global',
      }));
    });
  });

  describe('Budget Status', () => {
    beforeEach(() => {
      const fs = require('fs');
      const fsPromises = require('fs/promises');
      fs.existsSync.mockReturnValue(false);
      fsPromises.writeFile.mockResolvedValue(undefined);
    });

    it('should report within budget when no usage', async () => {
      const status = await service.checkBudget(testAgentId);

      expect(status.withinBudget).toBe(true);
      expect(status.dailyUsed).toBe(0);
      expect(status.percentUsed).toBe(0);
    });

    it('should check if agent is within budget', async () => {
      const isWithin = await service.isWithinBudget(testAgentId);

      expect(isWithin).toBe(true);
    });

    it('should get remaining budget', async () => {
      const remaining = await service.getRemainingBudget(testAgentId);

      expect(remaining).toBe(DEFAULT_BUDGET_CONFIG.dailyLimit);
    });
  });

  describe('Usage Recording', () => {
    beforeEach(() => {
      const fs = require('fs');
      const fsPromises = require('fs/promises');
      fs.existsSync.mockReturnValue(false);
      fsPromises.readFile.mockResolvedValue('[]');
      fsPromises.writeFile.mockResolvedValue(undefined);
    });

    it('should record usage without errors', async () => {
      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 500,
        outputTokens: 200,
        model: 'claude-3-sonnet',
        operation: 'continuation',
      };

      await expect(service.recordUsage(record)).resolves.not.toThrow();
    });

    it('should calculate and store estimated cost', async () => {
      const fs = require('fs/promises');
      let savedRecords: UsageRecord[] = [];

      fs.writeFile.mockImplementation(async (path: string, content: string) => {
        if (path.includes('.json')) {
          savedRecords = JSON.parse(content);
        }
      });

      const record: UsageRecord = {
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-sonnet',
        operation: 'task',
      };

      await service.recordUsage(record);

      expect(savedRecords).toHaveLength(1);
      expect(savedRecords[0].estimatedCost).toBeCloseTo(0.0105, 6);
    });
  });

  describe('Usage Summary', () => {
    beforeEach(() => {
      const fs = require('fs');
      const fsPromises = require('fs/promises');
      fs.existsSync.mockReturnValue(true);
    });

    it('should summarize usage for an agent', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: testAgentId,
              sessionName: testSessionName,
              projectPath: testProjectPath,
              timestamp: new Date().toISOString(),
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: testAgentId,
              sessionName: testSessionName,
              projectPath: testProjectPath,
              timestamp: new Date().toISOString(),
              inputTokens: 500,
              outputTokens: 250,
              model: 'claude-3-sonnet',
              operation: 'continuation',
              estimatedCost: 0.00525,
            },
          ]);
        }
        return '[]';
      });

      const summary = await service.getUsage(testAgentId, 'day');

      expect(summary.totalInputTokens).toBe(1500);
      expect(summary.totalOutputTokens).toBe(750);
      expect(summary.totalTokens).toBe(2250);
      expect(summary.estimatedCost).toBeCloseTo(0.01575, 5);
      expect(summary.operationBreakdown.task).toBe(1);
      expect(summary.operationBreakdown.continuation).toBe(1);
    });

    it('should filter by agent ID', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: testAgentId,
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: 'other-agent',
              inputTokens: 2000,
              outputTokens: 1000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.021,
            },
          ]);
        }
        return '[]';
      });

      const summary = await service.getUsage(testAgentId, 'day');

      expect(summary.totalInputTokens).toBe(1000);
      expect(summary.totalOutputTokens).toBe(500);
    });

    it('should summarize project usage', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: 'agent-1',
              projectPath: testProjectPath,
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: 'agent-2',
              projectPath: testProjectPath,
              inputTokens: 500,
              outputTokens: 250,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.00525,
            },
            {
              agentId: 'agent-3',
              projectPath: '/other/project',
              inputTokens: 2000,
              outputTokens: 1000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.021,
            },
          ]);
        }
        return '[]';
      });

      const summary = await service.getProjectUsage(testProjectPath, 'day');

      expect(summary.totalInputTokens).toBe(1500);
      expect(summary.totalOutputTokens).toBe(750);
    });
  });

  describe('Budget Alerts', () => {
    beforeEach(() => {
      const fs = require('fs');
      const fsPromises = require('fs/promises');
      fs.existsSync.mockReturnValue(true);
      fsPromises.writeFile.mockResolvedValue(undefined);
    });

    it('should emit warning when threshold crossed', async () => {
      const warningHandler = jest.fn();
      service.onBudgetWarning(warningHandler);

      // Set a low budget
      await service.setBudget({
        scope: 'agent',
        scopeId: testAgentId,
        dailyLimit: 1.0,
        warningThreshold: 0.8,
      });

      // Mock high usage (85% of limit)
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: testAgentId,
              inputTokens: 100000,
              outputTokens: 50000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.85, // 85% of $1 limit
            },
          ]);
        }
        return '[]';
      });

      // Record a new usage to trigger check
      await service.recordUsage({
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 100,
        outputTokens: 50,
        model: 'claude-3-sonnet',
        operation: 'task',
      });

      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          scopeId: testAgentId,
        })
      );
    });

    it('should emit exceeded when over budget', async () => {
      const exceededHandler = jest.fn();
      service.onBudgetExceeded(exceededHandler);

      // Set a low budget
      await service.setBudget({
        scope: 'agent',
        scopeId: testAgentId,
        dailyLimit: 1.0,
        warningThreshold: 0.8,
      });

      // Mock over-budget usage
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: testAgentId,
              inputTokens: 200000,
              outputTokens: 100000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 1.1, // Over $1 limit
            },
          ]);
        }
        return '[]';
      });

      // Record a new usage to trigger check
      await service.recordUsage({
        agentId: testAgentId,
        sessionName: testSessionName,
        projectPath: testProjectPath,
        timestamp: new Date().toISOString(),
        inputTokens: 100,
        outputTokens: 50,
        model: 'claude-3-sonnet',
        operation: 'task',
      });

      expect(exceededHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exceeded',
          scopeId: testAgentId,
        })
      );
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
    });

    it('should generate a daily report', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: 'agent-1',
              projectPath: testProjectPath,
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: 'agent-2',
              projectPath: testProjectPath,
              inputTokens: 2000,
              outputTokens: 1000,
              model: 'claude-3-sonnet',
              operation: 'continuation',
              estimatedCost: 0.021,
            },
          ]);
        }
        return '[]';
      });

      const report = await service.generateReport({ period: 'day' });

      expect(report.period).toBe('day');
      expect(report.generatedAt).toBeDefined();
      expect(report.totalCost).toBeCloseTo(0.0315, 4);
      expect(report.totalTokens).toBe(4500);
      expect(report.agentBreakdown).toHaveLength(2);
    });

    it('should filter report by project', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: 'agent-1',
              projectPath: testProjectPath,
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: 'agent-2',
              projectPath: '/other/project',
              inputTokens: 2000,
              outputTokens: 1000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.021,
            },
          ]);
        }
        return '[]';
      });

      const report = await service.generateReport({
        period: 'day',
        projectPath: testProjectPath,
      });

      expect(report.agentBreakdown).toHaveLength(1);
      expect(report.totalTokens).toBe(1500);
    });

    it('should filter report by agent', async () => {
      const today = new Date().toISOString().split('T')[0];
      const fsPromises = require('fs/promises');

      fsPromises.readFile.mockImplementation(async (path: string) => {
        if (path.includes(today)) {
          return JSON.stringify([
            {
              agentId: 'agent-1',
              inputTokens: 1000,
              outputTokens: 500,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.0105,
            },
            {
              agentId: 'agent-2',
              inputTokens: 2000,
              outputTokens: 1000,
              model: 'claude-3-sonnet',
              operation: 'task',
              estimatedCost: 0.021,
            },
          ]);
        }
        return '[]';
      });

      const report = await service.generateReport({
        period: 'day',
        agentId: 'agent-1',
      });

      expect(report.agentBreakdown).toHaveLength(1);
      expect(report.agentBreakdown[0].agentId).toBe('agent-1');
    });
  });

  describe('Period Handling', () => {
    it('should handle day period', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);

      const summary = await service.getUsage(testAgentId, 'day');

      expect(summary.totalTokens).toBe(0);
    });

    it('should handle week period', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);

      const summary = await service.getUsage(testAgentId, 'week');

      expect(summary.totalTokens).toBe(0);
    });

    it('should handle month period', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);

      const summary = await service.getUsage(testAgentId, 'month');

      expect(summary.totalTokens).toBe(0);
    });
  });

  describe('Token Cost Constants', () => {
    it('should have costs for all major models', () => {
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-opus']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-5-sonnet']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-sonnet']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-haiku']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-opus-4']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-sonnet-4']).toBeDefined();
      expect(BUDGET_CONSTANTS.TOKEN_COSTS['default']).toBeDefined();
    });

    it('should have output cost higher than input cost', () => {
      for (const [model, rates] of Object.entries(BUDGET_CONSTANTS.TOKEN_COSTS)) {
        expect(rates.output).toBeGreaterThan(rates.input);
      }
    });
  });
});
