---
id: 21-budget-service
title: Implement BudgetService
phase: 5
priority: P2
status: open
estimatedHours: 8
dependencies: [09-continuation-service]
blocks: []
---

# Task: Implement BudgetService

## Objective
Create a service to track API usage, costs, and enforce budget limits.

## Background
Autonomous agents can consume significant API credits. We need:
- Track token usage per agent
- Enforce daily/weekly budget limits
- Alert when approaching limits
- Pause agents when over budget

## Deliverables

### 1. BudgetService Interface

```typescript
// backend/src/services/autonomous/budget.service.ts

interface IBudgetService {
  // Usage tracking
  recordUsage(params: UsageRecord): Promise<void>;
  getUsage(agentId: string, period: 'day' | 'week' | 'month'): Promise<UsageSummary>;
  getProjectUsage(projectPath: string, period: 'day' | 'week' | 'month'): Promise<UsageSummary>;

  // Budget management
  setBudget(params: BudgetConfig): Promise<void>;
  getBudget(scope: string): Promise<BudgetConfig>;
  checkBudget(agentId: string): Promise<BudgetStatus>;

  // Limits
  isWithinBudget(agentId: string): Promise<boolean>;
  getRemainingBudget(agentId: string): Promise<number>;

  // Alerts
  onBudgetWarning(handler: (alert: BudgetAlert) => void): void;
  onBudgetExceeded(handler: (alert: BudgetAlert) => void): void;

  // Reports
  generateReport(params: ReportParams): Promise<BudgetReport>;
}

interface UsageRecord {
  agentId: string;
  sessionName: string;
  projectPath: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  operation: string;  // 'task', 'continuation', 'memory', etc.
  taskId?: string;
}

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  operationBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
}

interface BudgetConfig {
  scope: 'global' | 'project' | 'agent';
  scopeId: string;
  dailyLimit?: number;       // USD
  weeklyLimit?: number;
  monthlyLimit?: number;
  maxTokensPerTask?: number;
  warningThreshold: number;  // 0-1, e.g., 0.8 = warn at 80%
}

interface BudgetStatus {
  withinBudget: boolean;
  dailyUsed: number;
  dailyLimit: number;
  percentUsed: number;
  estimatedRunway: string;   // "3 hours at current rate"
}

interface BudgetAlert {
  type: 'warning' | 'exceeded';
  scope: string;
  scopeId: string;
  currentUsage: number;
  limit: number;
  timestamp: string;
}
```

### 2. Implementation

```typescript
class BudgetService extends EventEmitter implements IBudgetService {
  private static instance: BudgetService;
  private logger: Logger;

  private readonly usagePath: string;
  private readonly configPath: string;

  // Token costs (approximate, update as needed)
  private readonly TOKEN_COSTS: Record<string, { input: number; output: number }> = {
    'claude-3-opus': { input: 0.000015, output: 0.000075 },
    'claude-3-sonnet': { input: 0.000003, output: 0.000015 },
    'claude-3-haiku': { input: 0.00000025, output: 0.00000125 },
    'default': { input: 0.000003, output: 0.000015 },
  };

  static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService();
    }
    return BudgetService.instance;
  }

  private constructor() {
    super();
    const home = getCrewlyHome();
    this.usagePath = path.join(home, 'usage');
    this.configPath = path.join(home, 'budgets.json');
    this.logger = LoggerService.getInstance().createLogger('BudgetService');
  }

  async recordUsage(record: UsageRecord): Promise<void> {
    // Calculate cost
    const cost = this.calculateCost(record);

    // Store record
    const dayFile = this.getDayFile(record.timestamp);
    await this.appendUsage(dayFile, { ...record, estimatedCost: cost });

    // Check budgets
    await this.checkAndAlert(record.agentId);
  }

  private calculateCost(record: UsageRecord): number {
    const rates = this.TOKEN_COSTS[record.model] || this.TOKEN_COSTS['default'];
    return (record.inputTokens * rates.input) + (record.outputTokens * rates.output);
  }

  async getUsage(agentId: string, period: 'day' | 'week' | 'month'): Promise<UsageSummary> {
    const records = await this.loadRecords(period);
    const agentRecords = records.filter(r => r.agentId === agentId);
    return this.summarizeRecords(agentRecords);
  }

  async checkBudget(agentId: string): Promise<BudgetStatus> {
    const budget = await this.getEffectiveBudget(agentId);
    const usage = await this.getUsage(agentId, 'day');

    const dailyLimit = budget.dailyLimit || Infinity;
    const percentUsed = usage.estimatedCost / dailyLimit;

    return {
      withinBudget: usage.estimatedCost < dailyLimit,
      dailyUsed: usage.estimatedCost,
      dailyLimit,
      percentUsed,
      estimatedRunway: this.estimateRunway(usage, dailyLimit),
    };
  }

  async isWithinBudget(agentId: string): Promise<boolean> {
    const status = await this.checkBudget(agentId);
    return status.withinBudget;
  }

  private async checkAndAlert(agentId: string): Promise<void> {
    const budget = await this.getEffectiveBudget(agentId);
    const usage = await this.getUsage(agentId, 'day');

    const percentUsed = usage.estimatedCost / (budget.dailyLimit || Infinity);

    if (percentUsed >= 1.0) {
      this.emit('budget_exceeded', {
        type: 'exceeded',
        scope: 'agent',
        scopeId: agentId,
        currentUsage: usage.estimatedCost,
        limit: budget.dailyLimit,
        timestamp: new Date().toISOString(),
      });

      // Pause agent
      await this.pauseAgentForBudget(agentId);
    } else if (percentUsed >= budget.warningThreshold) {
      this.emit('budget_warning', {
        type: 'warning',
        scope: 'agent',
        scopeId: agentId,
        currentUsage: usage.estimatedCost,
        limit: budget.dailyLimit,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async pauseAgentForBudget(agentId: string): Promise<void> {
    this.logger.warn('Pausing agent due to budget', { agentId });
    // Emit event for ContinuationService to handle
    this.emit('agent_budget_exceeded', { agentId });
  }

  async generateReport(params: ReportParams): Promise<BudgetReport> {
    const records = await this.loadRecords(params.period);

    // Group by agent
    const byAgent: Record<string, UsageRecord[]> = {};
    for (const record of records) {
      if (!byAgent[record.agentId]) {
        byAgent[record.agentId] = [];
      }
      byAgent[record.agentId].push(record);
    }

    // Generate summaries
    const agentSummaries = Object.entries(byAgent).map(([agentId, recs]) => ({
      agentId,
      ...this.summarizeRecords(recs),
    }));

    return {
      period: params.period,
      generatedAt: new Date().toISOString(),
      totalCost: agentSummaries.reduce((sum, s) => sum + s.estimatedCost, 0),
      totalTokens: agentSummaries.reduce((sum, s) => sum + s.totalTokens, 0),
      agentBreakdown: agentSummaries,
    };
  }

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
      summary.estimatedCost += this.calculateCost(record);

      // Operation breakdown
      const op = record.operation || 'unknown';
      summary.operationBreakdown[op] = (summary.operationBreakdown[op] || 0) + 1;

      // Model breakdown
      summary.modelBreakdown[record.model] =
        (summary.modelBreakdown[record.model] || 0) + record.inputTokens + record.outputTokens;
    }

    return summary;
  }

  private estimateRunway(usage: UsageSummary, dailyLimit: number): string {
    const remaining = dailyLimit - usage.estimatedCost;
    if (remaining <= 0) return 'Budget exceeded';

    // Rough estimate based on average cost per operation
    const avgCostPerOp = usage.estimatedCost /
      Object.values(usage.operationBreakdown).reduce((a, b) => a + b, 1);

    const remainingOps = Math.floor(remaining / avgCostPerOp);
    return `~${remainingOps} operations remaining`;
  }
}
```

### 3. Configuration

```yaml
# ~/.crewly/budgets.yaml

global:
  dailyLimit: 50.00
  weeklyLimit: 200.00
  warningThreshold: 0.8

projects:
  /path/to/project:
    dailyLimit: 20.00
    maxTokensPerTask: 100000

agents:
  backend-dev:
    dailyLimit: 10.00
```

### 4. Integration

```typescript
// In ContinuationService - check budget before continuing
async injectContinuationPrompt(sessionName: string, analysis: AgentStateAnalysis): Promise<void> {
  const agentId = await this.getAgentId(sessionName);

  // Check budget
  if (!await this.budgetService.isWithinBudget(agentId)) {
    this.logger.warn('Agent over budget, not continuing', { agentId });
    await this.notifyOwner(sessionName, 'Budget exceeded', analysis);
    return;
  }

  // Continue with prompt injection...
}

// Record usage after API calls
async function recordApiCall(agentId: string, response: ApiResponse) {
  await budgetService.recordUsage({
    agentId,
    sessionName: await getSessionName(agentId),
    projectPath: await getProjectPath(agentId),
    timestamp: new Date().toISOString(),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: response.model,
    operation: 'continuation',
  });
}
```

## Implementation Steps

1. **Create service class**
   - Singleton pattern
   - Event emitter

2. **Implement usage tracking**
   - Record usage
   - Calculate costs
   - Store to files

3. **Implement budget management**
   - Load/save configs
   - Check limits

4. **Implement alerts**
   - Warning threshold
   - Exceeded handling

5. **Implement reporting**
   - Generate summaries
   - Breakdowns

6. **Integrate with system**
   - ContinuationService
   - API call recording

7. **Write tests**
   - Cost calculation
   - Budget checking
   - Alerts

## Acceptance Criteria

- [ ] Usage recording works
- [ ] Cost calculation accurate
- [ ] Budget checking works
- [ ] Alerts fire at thresholds
- [ ] Reports generate correctly
- [ ] Integration with continuation
- [ ] Tests passing

## Notes

- Update token costs periodically
- Consider different models
- Allow override for important tasks
- Provide clear budget visibility
