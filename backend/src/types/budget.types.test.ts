/**
 * Tests for Budget Type Definitions
 *
 * @module types/budget.types.test
 */

import {
  UsageRecord,
  UsageSummary,
  BudgetConfig,
  BudgetStatus,
  BudgetAlert,
  BudgetReport,
  ReportParams,
  BudgetConfigFile,
  TokenCostRates,
  BudgetOperationType,
  BudgetScope,
  BudgetPeriod,
  AgentUsageSummary,
  BUDGET_CONSTANTS,
  DEFAULT_BUDGET_CONFIG,
  ALL_BUDGET_OPERATIONS,
  ALL_BUDGET_SCOPES,
  ALL_BUDGET_PERIODS,
} from './budget.types.js';

describe('Budget Types', () => {
  describe('UsageRecord interface', () => {
    it('should define a complete usage record', () => {
      const record: UsageRecord = {
        agentId: 'agent-001',
        sessionName: 'dev-session',
        projectPath: '/project/path',
        timestamp: '2026-01-29T00:00:00Z',
        inputTokens: 1000,
        outputTokens: 500,
        model: 'claude-3-sonnet',
        operation: 'task',
        taskId: 'task-123',
        estimatedCost: 0.0105,
      };

      expect(record.agentId).toBe('agent-001');
      expect(record.inputTokens).toBe(1000);
      expect(record.operation).toBe('task');
    });

    it('should allow optional fields', () => {
      const record: UsageRecord = {
        agentId: 'agent-001',
        sessionName: 'dev-session',
        projectPath: '/project',
        timestamp: '2026-01-29T00:00:00Z',
        inputTokens: 500,
        outputTokens: 200,
        model: 'claude-3-haiku',
        operation: 'continuation',
      };

      expect(record.taskId).toBeUndefined();
      expect(record.estimatedCost).toBeUndefined();
    });
  });

  describe('UsageSummary interface', () => {
    it('should define a usage summary', () => {
      const summary: UsageSummary = {
        totalInputTokens: 10000,
        totalOutputTokens: 5000,
        totalTokens: 15000,
        estimatedCost: 0.105,
        operationBreakdown: {
          task: 5,
          continuation: 10,
          memory: 2,
        },
        modelBreakdown: {
          'claude-3-sonnet': 12000,
          'claude-3-haiku': 3000,
        },
      };

      expect(summary.totalTokens).toBe(15000);
      expect(summary.operationBreakdown.task).toBe(5);
    });
  });

  describe('BudgetConfig interface', () => {
    it('should define a global budget config', () => {
      const config: BudgetConfig = {
        scope: 'global',
        scopeId: 'global',
        dailyLimit: 50.0,
        weeklyLimit: 200.0,
        monthlyLimit: 500.0,
        maxTokensPerTask: 100000,
        warningThreshold: 0.8,
      };

      expect(config.scope).toBe('global');
      expect(config.dailyLimit).toBe(50.0);
    });

    it('should define a project budget config', () => {
      const config: BudgetConfig = {
        scope: 'project',
        scopeId: '/path/to/project',
        dailyLimit: 20.0,
        warningThreshold: 0.9,
      };

      expect(config.scope).toBe('project');
      expect(config.weeklyLimit).toBeUndefined();
    });

    it('should define an agent budget config', () => {
      const config: BudgetConfig = {
        scope: 'agent',
        scopeId: 'backend-dev',
        dailyLimit: 10.0,
        warningThreshold: 0.75,
      };

      expect(config.scope).toBe('agent');
    });
  });

  describe('BudgetStatus interface', () => {
    it('should define budget status within budget', () => {
      const status: BudgetStatus = {
        withinBudget: true,
        dailyUsed: 25.0,
        dailyLimit: 50.0,
        percentUsed: 0.5,
        estimatedRunway: '~50 operations remaining',
      };

      expect(status.withinBudget).toBe(true);
      expect(status.percentUsed).toBe(0.5);
    });

    it('should define budget status over budget', () => {
      const status: BudgetStatus = {
        withinBudget: false,
        dailyUsed: 55.0,
        dailyLimit: 50.0,
        percentUsed: 1.1,
        estimatedRunway: 'Budget exceeded',
      };

      expect(status.withinBudget).toBe(false);
      expect(status.percentUsed).toBeGreaterThan(1.0);
    });
  });

  describe('BudgetAlert interface', () => {
    it('should define a warning alert', () => {
      const alert: BudgetAlert = {
        type: 'warning',
        scope: 'agent',
        scopeId: 'agent-001',
        currentUsage: 42.5,
        limit: 50.0,
        timestamp: '2026-01-29T00:00:00Z',
      };

      expect(alert.type).toBe('warning');
      expect(alert.currentUsage).toBe(42.5);
    });

    it('should define an exceeded alert', () => {
      const alert: BudgetAlert = {
        type: 'exceeded',
        scope: 'project',
        scopeId: '/project/path',
        currentUsage: 52.0,
        limit: 50.0,
        timestamp: '2026-01-29T00:00:00Z',
      };

      expect(alert.type).toBe('exceeded');
    });
  });

  describe('ReportParams interface', () => {
    it('should define report parameters', () => {
      const params: ReportParams = {
        period: 'week',
        projectPath: '/project',
        agentId: 'agent-001',
      };

      expect(params.period).toBe('week');
    });

    it('should work with minimal parameters', () => {
      const params: ReportParams = {
        period: 'day',
      };

      expect(params.projectPath).toBeUndefined();
      expect(params.agentId).toBeUndefined();
    });
  });

  describe('AgentUsageSummary interface', () => {
    it('should extend UsageSummary with agentId', () => {
      const summary: AgentUsageSummary = {
        agentId: 'agent-001',
        totalInputTokens: 5000,
        totalOutputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 0.05,
        operationBreakdown: { task: 3 },
        modelBreakdown: { 'claude-3-sonnet': 7500 },
      };

      expect(summary.agentId).toBe('agent-001');
      expect(summary.totalTokens).toBe(7500);
    });
  });

  describe('BudgetReport interface', () => {
    it('should define a complete report', () => {
      const report: BudgetReport = {
        period: 'week',
        generatedAt: '2026-01-29T00:00:00Z',
        totalCost: 150.0,
        totalTokens: 5000000,
        agentBreakdown: [
          {
            agentId: 'agent-001',
            totalInputTokens: 3000000,
            totalOutputTokens: 1500000,
            totalTokens: 4500000,
            estimatedCost: 135.0,
            operationBreakdown: { task: 50, continuation: 100 },
            modelBreakdown: { 'claude-3-sonnet': 4500000 },
          },
          {
            agentId: 'agent-002',
            totalInputTokens: 350000,
            totalOutputTokens: 150000,
            totalTokens: 500000,
            estimatedCost: 15.0,
            operationBreakdown: { task: 10 },
            modelBreakdown: { 'claude-3-haiku': 500000 },
          },
        ],
      };

      expect(report.period).toBe('week');
      expect(report.agentBreakdown).toHaveLength(2);
      expect(report.totalCost).toBe(150.0);
    });
  });

  describe('BudgetConfigFile interface', () => {
    it('should define a complete config file', () => {
      const configFile: BudgetConfigFile = {
        global: {
          dailyLimit: 50.0,
          weeklyLimit: 200.0,
          warningThreshold: 0.8,
        },
        projects: {
          '/project/a': {
            dailyLimit: 20.0,
            warningThreshold: 0.9,
          },
        },
        agents: {
          'backend-dev': {
            dailyLimit: 10.0,
            warningThreshold: 0.75,
          },
        },
      };

      expect(configFile.global?.dailyLimit).toBe(50.0);
      expect(configFile.projects?.['/project/a']?.dailyLimit).toBe(20.0);
    });
  });

  describe('TokenCostRates interface', () => {
    it('should define token cost rates', () => {
      const rates: TokenCostRates = {
        input: 0.000003,
        output: 0.000015,
      };

      expect(rates.input).toBe(0.000003);
      expect(rates.output).toBe(0.000015);
    });
  });

  describe('BUDGET_CONSTANTS', () => {
    describe('DEFAULTS', () => {
      it('should have correct default values', () => {
        expect(BUDGET_CONSTANTS.DEFAULTS.DAILY_LIMIT).toBe(50.0);
        expect(BUDGET_CONSTANTS.DEFAULTS.WEEKLY_LIMIT).toBe(200.0);
        expect(BUDGET_CONSTANTS.DEFAULTS.MONTHLY_LIMIT).toBe(500.0);
        expect(BUDGET_CONSTANTS.DEFAULTS.WARNING_THRESHOLD).toBe(0.8);
        expect(BUDGET_CONSTANTS.DEFAULTS.MAX_TOKENS_PER_TASK).toBe(100000);
      });
    });

    describe('TOKEN_COSTS', () => {
      it('should have costs for common models', () => {
        expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-opus']).toBeDefined();
        expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-sonnet']).toBeDefined();
        expect(BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-haiku']).toBeDefined();
        expect(BUDGET_CONSTANTS.TOKEN_COSTS['default']).toBeDefined();
      });

      it('should have correct cost structure', () => {
        const sonnetCosts = BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-sonnet'];
        expect(sonnetCosts.input).toBe(0.000003);
        expect(sonnetCosts.output).toBe(0.000015);
      });

      it('should have opus costs higher than sonnet', () => {
        const opusCosts = BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-opus'];
        const sonnetCosts = BUDGET_CONSTANTS.TOKEN_COSTS['claude-3-sonnet'];
        expect(opusCosts.input).toBeGreaterThan(sonnetCosts.input);
        expect(opusCosts.output).toBeGreaterThan(sonnetCosts.output);
      });
    });

    describe('PATHS', () => {
      it('should have correct path constants', () => {
        expect(BUDGET_CONSTANTS.PATHS.USAGE_DIR).toBe('usage');
        expect(BUDGET_CONSTANTS.PATHS.BUDGETS_FILE).toBe('budgets.json');
        expect(BUDGET_CONSTANTS.PATHS.BUDGETS_YAML_FILE).toBe('budgets.yaml');
      });
    });

    describe('OPERATIONS', () => {
      it('should have all operation types', () => {
        expect(BUDGET_CONSTANTS.OPERATIONS.TASK).toBe('task');
        expect(BUDGET_CONSTANTS.OPERATIONS.CONTINUATION).toBe('continuation');
        expect(BUDGET_CONSTANTS.OPERATIONS.MEMORY).toBe('memory');
        expect(BUDGET_CONSTANTS.OPERATIONS.SOP).toBe('sop');
        expect(BUDGET_CONSTANTS.OPERATIONS.QUALITY_GATE).toBe('quality_gate');
        expect(BUDGET_CONSTANTS.OPERATIONS.PROMPT_BUILDING).toBe('prompt_building');
        expect(BUDGET_CONSTANTS.OPERATIONS.OTHER).toBe('other');
      });
    });
  });

  describe('DEFAULT_BUDGET_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_BUDGET_CONFIG.scope).toBe('global');
      expect(DEFAULT_BUDGET_CONFIG.scopeId).toBe('global');
      expect(DEFAULT_BUDGET_CONFIG.dailyLimit).toBe(50.0);
      expect(DEFAULT_BUDGET_CONFIG.weeklyLimit).toBe(200.0);
      expect(DEFAULT_BUDGET_CONFIG.monthlyLimit).toBe(500.0);
      expect(DEFAULT_BUDGET_CONFIG.warningThreshold).toBe(0.8);
    });
  });

  describe('ALL_BUDGET_OPERATIONS', () => {
    it('should contain all 7 operation types', () => {
      expect(ALL_BUDGET_OPERATIONS).toHaveLength(7);
      expect(ALL_BUDGET_OPERATIONS).toContain('task');
      expect(ALL_BUDGET_OPERATIONS).toContain('continuation');
      expect(ALL_BUDGET_OPERATIONS).toContain('memory');
      expect(ALL_BUDGET_OPERATIONS).toContain('sop');
      expect(ALL_BUDGET_OPERATIONS).toContain('quality_gate');
      expect(ALL_BUDGET_OPERATIONS).toContain('prompt_building');
      expect(ALL_BUDGET_OPERATIONS).toContain('other');
    });
  });

  describe('ALL_BUDGET_SCOPES', () => {
    it('should contain all 3 scope types', () => {
      expect(ALL_BUDGET_SCOPES).toHaveLength(3);
      expect(ALL_BUDGET_SCOPES).toContain('global');
      expect(ALL_BUDGET_SCOPES).toContain('project');
      expect(ALL_BUDGET_SCOPES).toContain('agent');
    });
  });

  describe('ALL_BUDGET_PERIODS', () => {
    it('should contain all 3 period types', () => {
      expect(ALL_BUDGET_PERIODS).toHaveLength(3);
      expect(ALL_BUDGET_PERIODS).toContain('day');
      expect(ALL_BUDGET_PERIODS).toContain('week');
      expect(ALL_BUDGET_PERIODS).toContain('month');
    });
  });

  describe('BudgetOperationType', () => {
    it('should allow all valid operation types', () => {
      const operations: BudgetOperationType[] = [
        'task',
        'continuation',
        'memory',
        'sop',
        'quality_gate',
        'prompt_building',
        'other',
      ];

      expect(operations).toHaveLength(7);
    });
  });

  describe('BudgetScope', () => {
    it('should allow all valid scopes', () => {
      const scopes: BudgetScope[] = ['global', 'project', 'agent'];

      expect(scopes).toHaveLength(3);
    });
  });

  describe('BudgetPeriod', () => {
    it('should allow all valid periods', () => {
      const periods: BudgetPeriod[] = ['day', 'week', 'month'];

      expect(periods).toHaveLength(3);
    });
  });
});
