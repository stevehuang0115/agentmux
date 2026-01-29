/**
 * Budget Service Type Definitions
 *
 * Types for API usage tracking and budget management.
 *
 * @module types/budget.types
 */

/**
 * Record of API usage for a single operation
 */
export interface UsageRecord {
  /** Unique identifier for the agent */
  agentId: string;
  /** Session name of the agent */
  sessionName: string;
  /** Project path */
  projectPath: string;
  /** Timestamp of the usage */
  timestamp: string;
  /** Number of input tokens used */
  inputTokens: number;
  /** Number of output tokens generated */
  outputTokens: number;
  /** Model used for the operation */
  model: string;
  /** Type of operation (task, continuation, memory, etc.) */
  operation: BudgetOperationType;
  /** Associated task ID, if applicable */
  taskId?: string;
  /** Estimated cost in USD (calculated after recording) */
  estimatedCost?: number;
}

/**
 * Types of budget operations
 */
export type BudgetOperationType =
  | 'task'
  | 'continuation'
  | 'memory'
  | 'sop'
  | 'quality_gate'
  | 'prompt_building'
  | 'other';

/**
 * Summary of usage over a period
 */
export interface UsageSummary {
  /** Total input tokens used */
  totalInputTokens: number;
  /** Total output tokens generated */
  totalOutputTokens: number;
  /** Total tokens (input + output) */
  totalTokens: number;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Breakdown by operation type */
  operationBreakdown: Record<string, number>;
  /** Breakdown by model */
  modelBreakdown: Record<string, number>;
}

/**
 * Scope of budget configuration
 */
export type BudgetScope = 'global' | 'project' | 'agent';

/**
 * Budget configuration
 */
export interface BudgetConfig {
  /** Scope of the budget (global, project, or agent) */
  scope: BudgetScope;
  /** Identifier for the scope (project path or agent ID) */
  scopeId: string;
  /** Daily spending limit in USD */
  dailyLimit?: number;
  /** Weekly spending limit in USD */
  weeklyLimit?: number;
  /** Monthly spending limit in USD */
  monthlyLimit?: number;
  /** Maximum tokens per task */
  maxTokensPerTask?: number;
  /** Percentage (0-1) at which to trigger warning */
  warningThreshold: number;
}

/**
 * Current budget status
 */
export interface BudgetStatus {
  /** Whether usage is within budget */
  withinBudget: boolean;
  /** Amount used today in USD */
  dailyUsed: number;
  /** Daily limit in USD */
  dailyLimit: number;
  /** Percentage of budget used (0-1) */
  percentUsed: number;
  /** Estimated remaining runway description */
  estimatedRunway: string;
}

/**
 * Budget alert types
 */
export type BudgetAlertType = 'warning' | 'exceeded';

/**
 * Budget alert event
 */
export interface BudgetAlert {
  /** Type of alert */
  type: BudgetAlertType;
  /** Scope of the budget */
  scope: BudgetScope;
  /** Scope identifier */
  scopeId: string;
  /** Current usage in USD */
  currentUsage: number;
  /** Budget limit in USD */
  limit: number;
  /** Timestamp of the alert */
  timestamp: string;
}

/**
 * Time period for reports
 */
export type BudgetPeriod = 'day' | 'week' | 'month';

/**
 * Parameters for generating a budget report
 */
export interface ReportParams {
  /** Time period to report on */
  period: BudgetPeriod;
  /** Optional project path to filter by */
  projectPath?: string;
  /** Optional agent ID to filter by */
  agentId?: string;
}

/**
 * Agent usage summary for reports
 */
export interface AgentUsageSummary extends UsageSummary {
  /** Agent identifier */
  agentId: string;
}

/**
 * Complete budget report
 */
export interface BudgetReport {
  /** Time period covered */
  period: BudgetPeriod;
  /** When the report was generated */
  generatedAt: string;
  /** Total cost in USD */
  totalCost: number;
  /** Total tokens used */
  totalTokens: number;
  /** Breakdown by agent */
  agentBreakdown: AgentUsageSummary[];
}

/**
 * Stored budget configuration file format
 */
export interface BudgetConfigFile {
  /** Global budget settings */
  global?: Omit<BudgetConfig, 'scope' | 'scopeId'>;
  /** Project-specific budgets */
  projects?: Record<string, Omit<BudgetConfig, 'scope' | 'scopeId'>>;
  /** Agent-specific budgets */
  agents?: Record<string, Omit<BudgetConfig, 'scope' | 'scopeId'>>;
}

/**
 * Token cost rates per model
 */
export interface TokenCostRates {
  /** Cost per input token in USD */
  input: number;
  /** Cost per output token in USD */
  output: number;
}

// ======================
// Constants
// ======================

/**
 * Budget-related constants
 */
export const BUDGET_CONSTANTS = {
  /** Default configuration values */
  DEFAULTS: {
    DAILY_LIMIT: 50.0,
    WEEKLY_LIMIT: 200.0,
    MONTHLY_LIMIT: 500.0,
    WARNING_THRESHOLD: 0.8,
    MAX_TOKENS_PER_TASK: 100000,
  },

  /** Token cost rates by model (USD per token) */
  TOKEN_COSTS: {
    'claude-3-opus': { input: 0.000015, output: 0.000075 },
    'claude-3-5-sonnet': { input: 0.000003, output: 0.000015 },
    'claude-3-sonnet': { input: 0.000003, output: 0.000015 },
    'claude-3-haiku': { input: 0.00000025, output: 0.00000125 },
    'claude-opus-4': { input: 0.000015, output: 0.000075 },
    'claude-sonnet-4': { input: 0.000003, output: 0.000015 },
    default: { input: 0.000003, output: 0.000015 },
  } as Record<string, TokenCostRates>,

  /** File paths */
  PATHS: {
    USAGE_DIR: 'usage',
    BUDGETS_FILE: 'budgets.json',
    BUDGETS_YAML_FILE: 'budgets.yaml',
  },

  /** Operation types */
  OPERATIONS: {
    TASK: 'task' as BudgetOperationType,
    CONTINUATION: 'continuation' as BudgetOperationType,
    MEMORY: 'memory' as BudgetOperationType,
    SOP: 'sop' as BudgetOperationType,
    QUALITY_GATE: 'quality_gate' as BudgetOperationType,
    PROMPT_BUILDING: 'prompt_building' as BudgetOperationType,
    OTHER: 'other' as BudgetOperationType,
  },
} as const;

/**
 * Default global budget configuration
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  scope: 'global',
  scopeId: 'global',
  dailyLimit: BUDGET_CONSTANTS.DEFAULTS.DAILY_LIMIT,
  weeklyLimit: BUDGET_CONSTANTS.DEFAULTS.WEEKLY_LIMIT,
  monthlyLimit: BUDGET_CONSTANTS.DEFAULTS.MONTHLY_LIMIT,
  maxTokensPerTask: BUDGET_CONSTANTS.DEFAULTS.MAX_TOKENS_PER_TASK,
  warningThreshold: BUDGET_CONSTANTS.DEFAULTS.WARNING_THRESHOLD,
};

/**
 * All budget operation types
 */
export const ALL_BUDGET_OPERATIONS: BudgetOperationType[] = [
  'task',
  'continuation',
  'memory',
  'sop',
  'quality_gate',
  'prompt_building',
  'other',
];

/**
 * All budget scopes
 */
export const ALL_BUDGET_SCOPES: BudgetScope[] = ['global', 'project', 'agent'];

/**
 * All budget periods
 */
export const ALL_BUDGET_PERIODS: BudgetPeriod[] = ['day', 'week', 'month'];
