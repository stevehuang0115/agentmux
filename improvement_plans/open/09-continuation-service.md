---
id: 09-continuation-service
title: Implement ContinuationService Core
phase: 2
priority: P0
status: open
estimatedHours: 12
dependencies: [07-continuation-detection, 08-output-analyzer]
blocks: [10-continuation-prompts, 11-iteration-tracking]
---

# Task: Implement ContinuationService Core

## Objective
Create the main `ContinuationService` that orchestrates continuation detection, analysis, and action execution.

## Background
This service ties together:
- `ContinuationEventEmitter` (detection)
- `OutputAnalyzer` (analysis)
- Action execution (prompts, notifications, task management)

## Deliverables

### 1. ContinuationService Interface

```typescript
// backend/src/services/continuation/continuation.service.ts

interface IContinuationService {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;

  // Event handling
  handleContinuationEvent(event: ContinuationEvent): Promise<void>;

  // Analysis
  analyzeAgent(sessionName: string): Promise<AgentStateAnalysis>;

  // Actions
  injectContinuationPrompt(sessionName: string, analysis: AgentStateAnalysis): Promise<void>;
  assignNextTask(sessionName: string): Promise<void>;
  notifyOwner(sessionName: string, reason: string, analysis: AgentStateAnalysis): Promise<void>;
  retryWithHints(sessionName: string, analysis: AgentStateAnalysis): Promise<void>;

  // Configuration
  setMaxIterations(sessionName: string, max: number): Promise<void>;
  getSessionConfig(sessionName: string): Promise<ContinuationConfig>;

  // Status
  getActiveMonitors(): string[];
  getSessionStatus(sessionName: string): Promise<SessionContinuationStatus>;
}

interface ContinuationConfig {
  maxIterations: number;
  enabled: boolean;
  autoAssignNext: boolean;
  notifyOnMaxIterations: boolean;
  notifyOnError: boolean;
}

interface SessionContinuationStatus {
  sessionName: string;
  isMonitored: boolean;
  currentIteration: number;
  maxIterations: number;
  lastAnalysis?: AgentStateAnalysis;
  lastAction?: ContinuationAction;
  lastActionTime?: string;
}
```

### 2. Implementation

```typescript
class ContinuationService implements IContinuationService {
  private static instance: ContinuationService;
  private eventEmitter: ContinuationEventEmitter;
  private outputAnalyzer: OutputAnalyzer;
  private sessionBackend: PtySessionBackend;
  private taskService: TaskService;
  private memoryService: MemoryService;
  private logger: Logger;

  private sessionConfigs: Map<string, ContinuationConfig> = new Map();
  private sessionStatus: Map<string, SessionContinuationStatus> = new Map();
  private isRunning: boolean = false;

  static getInstance(): ContinuationService {
    if (!ContinuationService.instance) {
      ContinuationService.instance = new ContinuationService();
    }
    return ContinuationService.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.eventEmitter.on('continuation', (event) => {
      this.handleContinuationEvent(event).catch(err => {
        this.logger.error('Error handling continuation event', { error: err, event });
      });
    });

    this.isRunning = true;
    this.logger.info('ContinuationService started');
  }

  async stop(): Promise<void> {
    this.eventEmitter.removeAllListeners('continuation');
    this.isRunning = false;
    this.logger.info('ContinuationService stopped');
  }

  async handleContinuationEvent(event: ContinuationEvent): Promise<void> {
    const { sessionName, trigger } = event;
    this.logger.info('Handling continuation event', { sessionName, trigger });

    // Check if continuation is enabled for this session
    const config = await this.getSessionConfig(sessionName);
    if (!config.enabled) {
      this.logger.debug('Continuation disabled for session', { sessionName });
      return;
    }

    // Capture current output
    const output = await this.captureOutput(sessionName);

    // Get current task info
    const currentTask = await this.getCurrentTask(sessionName);

    // Analyze the state
    const analysis = await this.outputAnalyzer.analyze({
      sessionName,
      output,
      currentTask,
      exitCode: event.metadata.exitCode,
    });

    this.logger.info('Analysis complete', { sessionName, conclusion: analysis.conclusion });

    // Update status
    this.updateSessionStatus(sessionName, analysis);

    // Execute recommended action
    await this.executeAction(sessionName, analysis, config);
  }

  private async executeAction(
    sessionName: string,
    analysis: AgentStateAnalysis,
    config: ContinuationConfig
  ): Promise<void> {
    const action = analysis.recommendation;
    this.logger.info('Executing action', { sessionName, action });

    switch (action) {
      case 'inject_prompt':
        await this.injectContinuationPrompt(sessionName, analysis);
        break;

      case 'assign_next_task':
        if (config.autoAssignNext) {
          await this.assignNextTask(sessionName);
        } else {
          await this.notifyOwner(sessionName, 'Task completed', analysis);
        }
        break;

      case 'notify_owner':
        await this.notifyOwner(sessionName, analysis.evidence.join('; '), analysis);
        break;

      case 'retry_with_hints':
        await this.retryWithHints(sessionName, analysis);
        break;

      case 'pause_agent':
        await this.pauseAgent(sessionName);
        break;

      case 'no_action':
        this.logger.debug('No action needed', { sessionName });
        break;
    }

    // Record action
    const status = this.sessionStatus.get(sessionName);
    if (status) {
      status.lastAction = action;
      status.lastActionTime = new Date().toISOString();
    }
  }

  async injectContinuationPrompt(
    sessionName: string,
    analysis: AgentStateAnalysis
  ): Promise<void> {
    const currentTask = await this.getCurrentTask(sessionName);
    const projectPath = await this.getProjectPath(sessionName);
    const agentId = await this.getAgentId(sessionName);

    // Increment iteration
    if (currentTask) {
      await this.incrementIteration(currentTask);
    }

    // Build continuation prompt
    const prompt = await this.buildContinuationPrompt({
      sessionName,
      analysis,
      currentTask,
      projectPath,
      agentId,
    });

    // Inject into session
    await this.injectPrompt(sessionName, prompt);

    this.logger.info('Continuation prompt injected', {
      sessionName,
      iteration: analysis.iterations + 1,
    });
  }

  private async buildContinuationPrompt(params: BuildPromptParams): Promise<string> {
    const { analysis, currentTask, projectPath, agentId } = params;

    // Get project memory for context
    const memoryContext = await this.memoryService.getFullContext(agentId, projectPath);

    // Get recent learnings
    const learnings = await this.memoryService.getProjectMemory()
      .getRecentLearnings(projectPath, 5);

    // Load continuation template
    const template = await this.loadTemplate('continue-work.md');

    // Substitute variables
    return this.substituteVariables(template, {
      CURRENT_TASK: currentTask?.title || 'Unknown task',
      TASK_DESCRIPTION: currentTask?.description || '',
      ITERATIONS: analysis.iterations.toString(),
      MAX_ITERATIONS: analysis.maxIterations.toString(),
      LAST_ANALYSIS: analysis.evidence.join('\n- '),
      PROJECT_KNOWLEDGE: memoryContext,
      LEARNINGS: learnings,
      QUALITY_GATES: this.formatQualityGates(currentTask?.qualityGates),
      HINTS: this.getHintsForConclusion(analysis.conclusion),
    });
  }

  async assignNextTask(sessionName: string): Promise<void> {
    const currentTask = await this.getCurrentTask(sessionName);

    // Complete current task
    if (currentTask) {
      await this.taskService.completeTask(currentTask.path, sessionName);
      this.logger.info('Task completed', { sessionName, taskId: currentTask.id });
    }

    // Find next task
    const agentId = await this.getAgentId(sessionName);
    const role = await this.getAgentRole(sessionName);
    const projectPath = await this.getProjectPath(sessionName);

    const nextTask = await this.taskService.getNextTask(projectPath, role);

    if (nextTask) {
      // Assign and inject prompt
      await this.taskService.assignTask(nextTask.path, sessionName);
      const prompt = await this.buildTaskAssignmentPrompt(nextTask, sessionName);
      await this.injectPrompt(sessionName, prompt);

      this.logger.info('Next task assigned', { sessionName, taskId: nextTask.id });
    } else {
      // No more tasks - notify owner
      await this.notifyOwner(sessionName, 'All tasks completed, no more work available', {
        conclusion: 'TASK_COMPLETE',
        confidence: 1.0,
        evidence: ['All tasks in queue completed'],
        recommendation: 'notify_owner',
        iterations: 0,
        maxIterations: 0,
      });
    }
  }

  async retryWithHints(sessionName: string, analysis: AgentStateAnalysis): Promise<void> {
    const currentTask = await this.getCurrentTask(sessionName);

    // Increment iteration
    if (currentTask) {
      await this.incrementIteration(currentTask);
    }

    // Build retry prompt with error hints
    const hints = this.buildErrorHints(analysis);
    const prompt = await this.buildRetryPrompt(sessionName, analysis, hints);

    await this.injectPrompt(sessionName, prompt);

    this.logger.info('Retry prompt injected with hints', {
      sessionName,
      errorType: analysis.evidence[0],
    });
  }

  async notifyOwner(
    sessionName: string,
    reason: string,
    analysis: AgentStateAnalysis
  ): Promise<void> {
    // TODO: Integrate with notification system
    // For now, log and store for dashboard

    this.logger.warn('Owner notification', {
      sessionName,
      reason,
      conclusion: analysis.conclusion,
      evidence: analysis.evidence,
    });

    // Store notification for dashboard
    await this.storeNotification({
      type: 'continuation',
      sessionName,
      reason,
      analysis,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }

  private async injectPrompt(sessionName: string, prompt: string): Promise<void> {
    const session = await this.sessionBackend.getSession(sessionName);
    if (!session) {
      throw new Error(`Session not found: ${sessionName}`);
    }

    // Check if Claude Code is running, restart if needed
    const isClaudeRunning = await this.isClaudeCodeRunning(sessionName);
    if (!isClaudeRunning) {
      await this.restartClaudeCode(sessionName);
    }

    // Send prompt to session
    await session.write(prompt + '\n');
  }

  private getHintsForConclusion(conclusion: AgentConclusion): string {
    switch (conclusion) {
      case 'INCOMPLETE':
        return `
- Review your progress so far
- Check if all acceptance criteria are met
- Run tests and fix any failures
- Make a commit when ready
- Call complete_task when truly done`;

      case 'STUCK_OR_ERROR':
        return `
- Read the error message carefully
- Check for typos or missing imports
- Verify dependencies are installed
- Try a different approach if stuck
- Use recall tool to check for known gotchas`;

      default:
        return '';
    }
  }
}
```

### 3. File Structure

```
backend/src/services/continuation/
├── continuation.service.ts         (this task)
├── continuation.service.test.ts
├── continuation-events.service.ts  (Task 07)
├── output-analyzer.service.ts      (Task 08)
├── continuation.types.ts
├── patterns/
│   └── ...
└── index.ts
```

## Implementation Steps

1. **Create service class**
   - Singleton pattern
   - Dependency injection

2. **Implement event handling**
   - Subscribe to events
   - Route to analysis

3. **Implement action execution**
   - Each action type
   - Error handling

4. **Implement prompt injection**
   - Check Claude running
   - Restart if needed
   - Send prompt

5. **Implement task management**
   - Complete current
   - Assign next
   - Handle no more tasks

6. **Implement notifications**
   - Store for dashboard
   - Future: external notifications

7. **Write tests**
   - Unit tests
   - Integration tests
   - Mock dependencies

## Acceptance Criteria

- [ ] Service starts and stops cleanly
- [ ] Events trigger analysis
- [ ] Actions execute correctly
- [ ] Prompts inject successfully
- [ ] Task transitions work
- [ ] Notifications stored
- [ ] Tests passing

## Notes

- This is the central orchestrator for continuation
- Must be resilient to failures
- Log extensively for debugging
- Consider circuit breaker for repeated failures
