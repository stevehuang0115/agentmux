/**
 * Budget Service
 *
 * Tracks API usage, costs, and enforces budget limits for agents.
 *
 * @module services/autonomous/budget.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { EventEmitter } from 'events';
import { parse as parseYAML } from 'yaml';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { atomicWriteJson, safeReadJson, modifyJsonFile } from '../../utils/file-io.utils.js';
import {
  UsageRecord,
  UsageSummary,
  BudgetConfig,
  BudgetStatus,
  BudgetAlert,
  BudgetReport,
  ReportParams,
  BudgetConfigFile,
  BudgetPeriod,
  BUDGET_CONSTANTS,
  DEFAULT_BUDGET_CONFIG,
  AgentUsageSummary,
} from '../../types/budget.types.js';

/**
 * Interface for the Budget Service
 */
export interface IBudgetService {
  /**
   * Initialize the budget service
   */
  initialize(): Promise<void>;

  /**
   * Record API usage
   *
   * @param record - Usage record to store
   */
  recordUsage(record: UsageRecord): Promise<void>;

  /**
   * Get usage summary for an agent
   *
   * @param agentId - Agent identifier
   * @param period - Time period
   * @returns Usage summary
   */
  getUsage(agentId: string, period: BudgetPeriod): Promise<UsageSummary>;

  /**
   * Get usage summary for a project
   *
   * @param projectPath - Project path
   * @param period - Time period
   * @returns Usage summary
   */
  getProjectUsage(projectPath: string, period: BudgetPeriod): Promise<UsageSummary>;

  /**
   * Set budget configuration
   *
   * @param config - Budget configuration
   */
  setBudget(config: BudgetConfig): Promise<void>;

  /**
   * Get budget configuration for a scope
   *
   * @param scope - Scope identifier
   * @returns Budget configuration
   */
  getBudget(scope: string): Promise<BudgetConfig>;

  /**
   * Check budget status for an agent
   *
   * @param agentId - Agent identifier
   * @returns Budget status
   */
  checkBudget(agentId: string): Promise<BudgetStatus>;

  /**
   * Check if agent is within budget
   *
   * @param agentId - Agent identifier
   * @returns True if within budget
   */
  isWithinBudget(agentId: string): Promise<boolean>;

  /**
   * Get remaining budget for an agent
   *
   * @param agentId - Agent identifier
   * @returns Remaining budget in USD
   */
  getRemainingBudget(agentId: string): Promise<number>;

  /**
   * Register handler for budget warning events
   *
   * @param handler - Event handler
   */
  onBudgetWarning(handler: (alert: BudgetAlert) => void): void;

  /**
   * Register handler for budget exceeded events
   *
   * @param handler - Event handler
   */
  onBudgetExceeded(handler: (alert: BudgetAlert) => void): void;

  /**
   * Generate a budget report
   *
   * @param params - Report parameters
   * @returns Budget report
   */
  generateReport(params: ReportParams): Promise<BudgetReport>;
}

/**
 * Service for tracking API usage and enforcing budget limits
 *
 * @example
 * ```typescript
 * const service = BudgetService.getInstance();
 * await service.initialize();
 *
 * // Record usage after API call
 * await service.recordUsage({
 *   agentId: 'agent-001',
 *   sessionName: 'dev-session',
 *   projectPath: '/project',
 *   timestamp: new Date().toISOString(),
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   model: 'claude-3-sonnet',
 *   operation: 'task',
 * });
 *
 * // Check if agent is within budget
 * if (await service.isWithinBudget('agent-001')) {
 *   // Continue operations
 * }
 * ```
 */
export class BudgetService extends EventEmitter implements IBudgetService {
  private static instance: BudgetService | null = null;

  private readonly logger: ComponentLogger;
  private readonly usagePath: string;
  private readonly configPath: string;

  /** Budget configurations cache */
  private budgets: Map<string, BudgetConfig> = new Map();
  /** Global budget config */
  private globalBudget: BudgetConfig = { ...DEFAULT_BUDGET_CONFIG };
  /** Whether the service is initialized */
  private initialized: boolean = false;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    super();
    this.logger = LoggerService.getInstance().createComponentLogger('BudgetService');
    const home = this.getAgentMuxHome();
    this.usagePath = path.join(home, BUDGET_CONSTANTS.PATHS.USAGE_DIR);
    this.configPath = path.join(home, BUDGET_CONSTANTS.PATHS.BUDGETS_FILE);
  }

  /**
   * Gets the singleton instance
   *
   * @returns The BudgetService instance
   */
  public static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    BudgetService.instance = null;
  }

  /**
   * Get the AgentMux home directory
   *
   * @returns Home directory path
   */
  private getAgentMuxHome(): string {
    return process.env.AGENTMUX_HOME || path.join(process.env.HOME || '', '.agentmux');
  }

  /**
   * Initialize the budget service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Ensure usage directory exists
    if (!existsSync(this.usagePath)) {
      mkdirSync(this.usagePath, { recursive: true });
    }

    // Load configuration
    await this.loadConfig();

    this.initialized = true;
    this.logger.info('BudgetService initialized', {
      usagePath: this.usagePath,
      configPath: this.configPath,
    });
  }

  /**
   * Load budget configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      // Try JSON config first
      if (existsSync(this.configPath)) {
        const content = await fs.readFile(this.configPath, 'utf-8');
        const config = JSON.parse(content) as BudgetConfigFile;
        this.applyConfig(config);
        return;
      }

      // Try YAML config
      const yamlPath = path.join(
        path.dirname(this.configPath),
        BUDGET_CONSTANTS.PATHS.BUDGETS_YAML_FILE
      );
      if (existsSync(yamlPath)) {
        const content = await fs.readFile(yamlPath, 'utf-8');
        const config = parseYAML(content) as BudgetConfigFile;
        this.applyConfig(config);
        return;
      }

      this.logger.debug('No budget config found, using defaults');
    } catch (error) {
      this.logger.warn('Failed to load budget config, using defaults', { error });
    }
  }

  /**
   * Apply loaded configuration
   *
   * @param config - Configuration file contents
   */
  private applyConfig(config: BudgetConfigFile): void {
    // Apply global config
    if (config.global) {
      this.globalBudget = {
        ...DEFAULT_BUDGET_CONFIG,
        ...config.global,
        scope: 'global',
        scopeId: 'global',
      };
    }

    // Apply project configs
    if (config.projects) {
      for (const [projectPath, projectConfig] of Object.entries(config.projects)) {
        this.budgets.set(`project:${projectPath}`, {
          ...DEFAULT_BUDGET_CONFIG,
          ...projectConfig,
          scope: 'project',
          scopeId: projectPath,
        });
      }
    }

    // Apply agent configs
    if (config.agents) {
      for (const [agentId, agentConfig] of Object.entries(config.agents)) {
        this.budgets.set(`agent:${agentId}`, {
          ...DEFAULT_BUDGET_CONFIG,
          ...agentConfig,
          scope: 'agent',
          scopeId: agentId,
        });
      }
    }

    this.logger.debug('Budget config applied', {
      globalLimit: this.globalBudget.dailyLimit,
      projectConfigs: Object.keys(config.projects || {}).length,
      agentConfigs: Object.keys(config.agents || {}).length,
    });
  }

  /**
   * Record API usage
   *
   * @param record - Usage record to store
   */
  public async recordUsage(record: UsageRecord): Promise<void> {
    // Calculate cost
    const cost = this.calculateCost(record);
    const enrichedRecord: UsageRecord = { ...record, estimatedCost: cost };

    // Store record
    const dayFile = this.getDayFile(record.timestamp);
    await this.appendUsage(dayFile, enrichedRecord);

    // Check budgets and alert if needed
    await this.checkAndAlert(record.agentId);

    this.logger.debug('Usage recorded', {
      agentId: record.agentId,
      tokens: record.inputTokens + record.outputTokens,
      cost,
    });
  }

  /**
   * Calculate cost for a usage record
   *
   * @param record - Usage record
   * @returns Estimated cost in USD
   */
  public calculateCost(record: UsageRecord): number {
    const rates =
      BUDGET_CONSTANTS.TOKEN_COSTS[record.model] || BUDGET_CONSTANTS.TOKEN_COSTS['default'];
    return record.inputTokens * rates.input + record.outputTokens * rates.output;
  }

  /**
   * Get the file path for a day's usage
   *
   * @param timestamp - ISO timestamp
   * @returns File path
   */
  private getDayFile(timestamp: string): string {
    const date = timestamp.split('T')[0];
    return path.join(this.usagePath, `${date}.json`);
  }

  /**
   * Append a usage record to a file
   *
   * @param filePath - File path
   * @param record - Usage record
   */
  private async appendUsage(filePath: string, record: UsageRecord): Promise<void> {
    await modifyJsonFile<UsageRecord[]>(filePath, [], (records) => {
      records.push(record);
    });
  }

  /**
   * Load usage records for a time period
   *
   * @param period - Time period
   * @returns Array of usage records
   */
  private async loadRecords(period: BudgetPeriod): Promise<UsageRecord[]> {
    const dates = this.getDatesForPeriod(period);
    const records: UsageRecord[] = [];

    for (const date of dates) {
      const filePath = path.join(this.usagePath, `${date}.json`);
      const dayRecords = await safeReadJson<UsageRecord[]>(filePath, []);
      records.push(...dayRecords);
    }

    return records;
  }

  /**
   * Get date strings for a period
   *
   * @param period - Time period
   * @returns Array of date strings (YYYY-MM-DD)
   */
  private getDatesForPeriod(period: BudgetPeriod): string[] {
    const dates: string[] = [];
    const now = new Date();
    let daysBack = 1;

    switch (period) {
      case 'day':
        daysBack = 1;
        break;
      case 'week':
        daysBack = 7;
        break;
      case 'month':
        daysBack = 30;
        break;
    }

    for (let i = 0; i < daysBack; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * Get usage summary for an agent
   *
   * @param agentId - Agent identifier
   * @param period - Time period
   * @returns Usage summary
   */
  public async getUsage(agentId: string, period: BudgetPeriod): Promise<UsageSummary> {
    const records = await this.loadRecords(period);
    const agentRecords = records.filter((r) => r.agentId === agentId);
    return this.summarizeRecords(agentRecords);
  }

  /**
   * Get usage summary for a project
   *
   * @param projectPath - Project path
   * @param period - Time period
   * @returns Usage summary
   */
  public async getProjectUsage(projectPath: string, period: BudgetPeriod): Promise<UsageSummary> {
    const records = await this.loadRecords(period);
    const projectRecords = records.filter((r) => r.projectPath === projectPath);
    return this.summarizeRecords(projectRecords);
  }

  /**
   * Summarize usage records
   *
   * @param records - Array of usage records
   * @returns Usage summary
   */
  private summarizeRecords(records: UsageRecord[]): UsageSummary {
    const summary: UsageSummary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      operationBreakdown: {},
      modelBreakdown: {},
    };

    for (const record of records) {
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;
      summary.totalTokens += record.inputTokens + record.outputTokens;
      summary.estimatedCost += record.estimatedCost ?? this.calculateCost(record);

      // Operation breakdown (count of operations)
      const op = record.operation || 'other';
      summary.operationBreakdown[op] = (summary.operationBreakdown[op] || 0) + 1;

      // Model breakdown (tokens)
      const model = record.model || 'unknown';
      summary.modelBreakdown[model] =
        (summary.modelBreakdown[model] || 0) + record.inputTokens + record.outputTokens;
    }

    return summary;
  }

  /**
   * Set budget configuration
   *
   * @param config - Budget configuration
   */
  public async setBudget(config: BudgetConfig): Promise<void> {
    const key = `${config.scope}:${config.scopeId}`;

    if (config.scope === 'global') {
      this.globalBudget = config;
    } else {
      this.budgets.set(key, config);
    }

    // Save to file
    await this.saveConfig();

    this.logger.info('Budget set', {
      scope: config.scope,
      scopeId: config.scopeId,
      dailyLimit: config.dailyLimit,
    });
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(): Promise<void> {
    const config: BudgetConfigFile = {
      global: {
        dailyLimit: this.globalBudget.dailyLimit,
        weeklyLimit: this.globalBudget.weeklyLimit,
        monthlyLimit: this.globalBudget.monthlyLimit,
        maxTokensPerTask: this.globalBudget.maxTokensPerTask,
        warningThreshold: this.globalBudget.warningThreshold,
      },
      projects: {},
      agents: {},
    };

    for (const [key, budget] of this.budgets.entries()) {
      const [scope, scopeId] = key.split(':');
      const budgetData = {
        dailyLimit: budget.dailyLimit,
        weeklyLimit: budget.weeklyLimit,
        monthlyLimit: budget.monthlyLimit,
        maxTokensPerTask: budget.maxTokensPerTask,
        warningThreshold: budget.warningThreshold,
      };

      if (scope === 'project' && config.projects) {
        config.projects[scopeId] = budgetData;
      } else if (scope === 'agent' && config.agents) {
        config.agents[scopeId] = budgetData;
      }
    }

    await atomicWriteJson(this.configPath, config);
  }

  /**
   * Get budget configuration for a scope
   *
   * @param scope - Scope identifier
   * @returns Budget configuration
   */
  public async getBudget(scope: string): Promise<BudgetConfig> {
    // Try to find specific budget
    const agentKey = `agent:${scope}`;
    if (this.budgets.has(agentKey)) {
      return this.budgets.get(agentKey)!;
    }

    const projectKey = `project:${scope}`;
    if (this.budgets.has(projectKey)) {
      return this.budgets.get(projectKey)!;
    }

    // Fall back to global
    return this.globalBudget;
  }

  /**
   * Get the effective budget for an agent (considering hierarchy)
   *
   * @param agentId - Agent identifier
   * @returns Effective budget configuration
   */
  private async getEffectiveBudget(agentId: string): Promise<BudgetConfig> {
    // Check agent-specific budget first
    const agentKey = `agent:${agentId}`;
    if (this.budgets.has(agentKey)) {
      return this.budgets.get(agentKey)!;
    }

    // Fall back to global
    return this.globalBudget;
  }

  /**
   * Check budget status for an agent
   *
   * @param agentId - Agent identifier
   * @returns Budget status
   */
  public async checkBudget(agentId: string): Promise<BudgetStatus> {
    const budget = await this.getEffectiveBudget(agentId);
    const usage = await this.getUsage(agentId, 'day');

    const dailyLimit = budget.dailyLimit ?? Infinity;
    const percentUsed = dailyLimit === Infinity ? 0 : usage.estimatedCost / dailyLimit;

    return {
      withinBudget: usage.estimatedCost < dailyLimit,
      dailyUsed: usage.estimatedCost,
      dailyLimit,
      percentUsed,
      estimatedRunway: this.estimateRunway(usage, dailyLimit),
    };
  }

  /**
   * Estimate remaining runway based on current usage
   *
   * @param usage - Current usage summary
   * @param dailyLimit - Daily budget limit
   * @returns Human-readable runway estimate
   */
  private estimateRunway(usage: UsageSummary, dailyLimit: number): string {
    const remaining = dailyLimit - usage.estimatedCost;
    if (remaining <= 0) return 'Budget exceeded';
    if (dailyLimit === Infinity) return 'No limit set';

    // Calculate average cost per operation
    const totalOps = Object.values(usage.operationBreakdown).reduce((a, b) => a + b, 0);
    if (totalOps === 0) return 'No usage yet';

    const avgCostPerOp = usage.estimatedCost / totalOps;
    if (avgCostPerOp === 0) return 'Insufficient data';

    const remainingOps = Math.floor(remaining / avgCostPerOp);
    return `~${remainingOps} operations remaining`;
  }

  /**
   * Check if agent is within budget
   *
   * @param agentId - Agent identifier
   * @returns True if within budget
   */
  public async isWithinBudget(agentId: string): Promise<boolean> {
    const status = await this.checkBudget(agentId);
    return status.withinBudget;
  }

  /**
   * Get remaining budget for an agent
   *
   * @param agentId - Agent identifier
   * @returns Remaining budget in USD
   */
  public async getRemainingBudget(agentId: string): Promise<number> {
    const status = await this.checkBudget(agentId);
    return Math.max(0, status.dailyLimit - status.dailyUsed);
  }

  /**
   * Check budgets and emit alerts if thresholds are crossed
   *
   * @param agentId - Agent identifier
   */
  private async checkAndAlert(agentId: string): Promise<void> {
    const budget = await this.getEffectiveBudget(agentId);
    const usage = await this.getUsage(agentId, 'day');

    const dailyLimit = budget.dailyLimit ?? Infinity;
    if (dailyLimit === Infinity) return;

    const percentUsed = usage.estimatedCost / dailyLimit;

    if (percentUsed >= 1.0) {
      const alert: BudgetAlert = {
        type: 'exceeded',
        scope: 'agent',
        scopeId: agentId,
        currentUsage: usage.estimatedCost,
        limit: dailyLimit,
        timestamp: new Date().toISOString(),
      };

      this.emit('budget_exceeded', alert);
      this.emit('agent_budget_exceeded', { agentId });

      this.logger.warn('Budget exceeded', { agentId, usage: usage.estimatedCost, limit: dailyLimit });
    } else if (percentUsed >= budget.warningThreshold) {
      const alert: BudgetAlert = {
        type: 'warning',
        scope: 'agent',
        scopeId: agentId,
        currentUsage: usage.estimatedCost,
        limit: dailyLimit,
        timestamp: new Date().toISOString(),
      };

      this.emit('budget_warning', alert);

      this.logger.info('Budget warning', {
        agentId,
        usage: usage.estimatedCost,
        limit: dailyLimit,
        percentUsed: Math.round(percentUsed * 100),
      });
    }
  }

  /**
   * Register handler for budget warning events
   *
   * @param handler - Event handler
   */
  public onBudgetWarning(handler: (alert: BudgetAlert) => void): void {
    this.on('budget_warning', handler);
  }

  /**
   * Register handler for budget exceeded events
   *
   * @param handler - Event handler
   */
  public onBudgetExceeded(handler: (alert: BudgetAlert) => void): void {
    this.on('budget_exceeded', handler);
  }

  /**
   * Generate a budget report
   *
   * @param params - Report parameters
   * @returns Budget report
   */
  public async generateReport(params: ReportParams): Promise<BudgetReport> {
    let records = await this.loadRecords(params.period);

    // Filter by project if specified
    if (params.projectPath) {
      records = records.filter((r) => r.projectPath === params.projectPath);
    }

    // Filter by agent if specified
    if (params.agentId) {
      records = records.filter((r) => r.agentId === params.agentId);
    }

    // Group by agent
    const byAgent: Record<string, UsageRecord[]> = {};
    for (const record of records) {
      if (!byAgent[record.agentId]) {
        byAgent[record.agentId] = [];
      }
      byAgent[record.agentId].push(record);
    }

    // Generate summaries
    const agentSummaries: AgentUsageSummary[] = Object.entries(byAgent).map(([agentId, recs]) => ({
      agentId,
      ...this.summarizeRecords(recs),
    }));

    const report: BudgetReport = {
      period: params.period,
      generatedAt: new Date().toISOString(),
      totalCost: agentSummaries.reduce((sum, s) => sum + s.estimatedCost, 0),
      totalTokens: agentSummaries.reduce((sum, s) => sum + s.totalTokens, 0),
      agentBreakdown: agentSummaries,
    };

    this.logger.debug('Report generated', {
      period: params.period,
      totalCost: report.totalCost,
      agentCount: agentSummaries.length,
    });

    return report;
  }

  /**
   * Clear all cached data (for testing)
   */
  public clearCache(): void {
    this.budgets.clear();
    this.globalBudget = { ...DEFAULT_BUDGET_CONFIG };
    this.initialized = false;
  }

  /**
   * Get all usage records (for testing)
   *
   * @param period - Time period
   * @returns All usage records
   */
  public async getAllRecords(period: BudgetPeriod): Promise<UsageRecord[]> {
    return this.loadRecords(period);
  }
}
