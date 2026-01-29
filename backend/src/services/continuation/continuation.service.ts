/**
 * Continuation Service
 *
 * Main orchestrator for continuation detection, analysis, and action execution.
 * Ties together event detection, output analysis, and response actions.
 *
 * @module services/continuation/continuation.service
 */

import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { ContinuationEventEmitter } from './continuation-events.service.js';
import { OutputAnalyzer } from './output-analyzer.service.js';
import {
  ContinuationEvent,
  ContinuationAction,
  AgentStateAnalysis,
  AgentConclusion,
  ContinuationActionResult,
  TaskInfo,
  IContinuationService,
  IterationTracking,
} from '../../types/continuation.types.js';
import { CONTINUATION_CONSTANTS } from '../../constants.js';

/**
 * Configuration for a session's continuation behavior
 */
export interface ContinuationConfig {
  /** Maximum iterations allowed before stopping */
  maxIterations: number;
  /** Whether continuation is enabled */
  enabled: boolean;
  /** Whether to auto-assign next task on completion */
  autoAssignNext: boolean;
  /** Whether to notify owner when max iterations reached */
  notifyOnMaxIterations: boolean;
  /** Whether to notify owner on errors */
  notifyOnError: boolean;
}

/**
 * Status of a session's continuation state
 */
export interface SessionContinuationStatus {
  /** Session name */
  sessionName: string;
  /** Whether the session is being monitored */
  isMonitored: boolean;
  /** Current iteration count */
  currentIteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Last analysis result */
  lastAnalysis?: AgentStateAnalysis;
  /** Last action taken */
  lastAction?: ContinuationAction;
  /** ISO timestamp of last action */
  lastActionTime?: string;
}

/**
 * Notification stored for dashboard display
 */
export interface ContinuationNotification {
  /** Notification type */
  type: 'continuation';
  /** Session that triggered the notification */
  sessionName: string;
  /** Reason for the notification */
  reason: string;
  /** Analysis that led to notification */
  analysis: AgentStateAnalysis;
  /** ISO timestamp */
  timestamp: string;
  /** Whether the notification has been acknowledged */
  acknowledged: boolean;
}

/**
 * Parameters for building a continuation prompt
 */
interface BuildPromptParams {
  sessionName: string;
  analysis: AgentStateAnalysis;
  currentTask?: TaskInfo;
  projectPath: string;
  agentId: string;
}

/**
 * Default configuration for continuation
 */
const DEFAULT_CONFIG: ContinuationConfig = {
  maxIterations: CONTINUATION_CONSTANTS.ITERATIONS.DEFAULT_MAX,
  enabled: true,
  autoAssignNext: true,
  notifyOnMaxIterations: true,
  notifyOnError: true,
};

/**
 * Service that orchestrates continuation detection and response
 *
 * Features:
 * - Subscribes to continuation events
 * - Analyzes agent output to determine state
 * - Executes appropriate actions (prompt injection, task assignment, etc.)
 * - Tracks iteration counts and session status
 * - Stores notifications for dashboard
 *
 * @example
 * ```typescript
 * const service = ContinuationService.getInstance();
 * await service.start();
 *
 * // Service now handles continuation events automatically
 *
 * // Check session status
 * const status = await service.getSessionStatus('team-dev');
 * console.log(`Iteration ${status.currentIteration} of ${status.maxIterations}`);
 * ```
 */
export class ContinuationService implements IContinuationService {
  private static instance: ContinuationService | null = null;

  private readonly logger: ComponentLogger;
  private readonly eventEmitter: ContinuationEventEmitter;
  private readonly outputAnalyzer: OutputAnalyzer;

  private readonly sessionConfigs: Map<string, ContinuationConfig> = new Map();
  private readonly sessionStatus: Map<string, SessionContinuationStatus> = new Map();
  private readonly iterationTracking: Map<string, IterationTracking> = new Map();
  private readonly notifications: ContinuationNotification[] = [];

  private isRunning: boolean = false;
  private eventHandler: ((event: ContinuationEvent) => void) | null = null;

  /**
   * Creates a new ContinuationService
   */
  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('ContinuationService');
    this.eventEmitter = ContinuationEventEmitter.getInstance();
    this.outputAnalyzer = OutputAnalyzer.getInstance();
  }

  /**
   * Gets the singleton instance
   *
   * @returns The ContinuationService instance
   */
  public static getInstance(): ContinuationService {
    if (!ContinuationService.instance) {
      ContinuationService.instance = new ContinuationService();
    }
    return ContinuationService.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    if (ContinuationService.instance) {
      ContinuationService.instance.stop();
    }
    ContinuationService.instance = null;
  }

  /**
   * Start the continuation service
   *
   * Subscribes to continuation events and begins monitoring.
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Service already running');
      return;
    }

    this.eventHandler = (event: ContinuationEvent) => {
      this.handleEvent(event).catch((err) => {
        this.logger.error('Error handling continuation event', { error: err, event });
      });
    };

    this.eventEmitter.on('continuation', this.eventHandler);
    this.isRunning = true;
    this.logger.info('ContinuationService started');
  }

  /**
   * Stop the continuation service
   *
   * Unsubscribes from events and cleans up.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.eventHandler) {
      this.eventEmitter.off('continuation', this.eventHandler);
      this.eventHandler = null;
    }

    this.isRunning = false;
    this.logger.info('ContinuationService stopped');
  }

  /**
   * Handle a continuation event
   *
   * @param event - The continuation event
   * @returns Action result
   */
  public async handleEvent(event: ContinuationEvent): Promise<ContinuationActionResult> {
    const { sessionName, trigger, agentId, projectPath } = event;
    this.logger.info('Handling continuation event', { sessionName, trigger });

    try {
      // Check if continuation is enabled for this session
      const config = await this.getSessionConfig(sessionName);
      if (!config.enabled) {
        this.logger.debug('Continuation disabled for session', { sessionName });
        return {
          success: true,
          action: 'no_action',
          message: 'Continuation disabled for session',
          executedAt: new Date().toISOString(),
        };
      }

      // Get iteration tracking
      const tracking = this.getOrCreateIterationTracking(sessionName, agentId);

      // Capture current output (placeholder - would integrate with PTY)
      const output = event.metadata.lastOutput || '';

      // Analyze the state
      const analysis = await this.outputAnalyzer.analyze(sessionName, output, {
        iterations: tracking.iterations,
      });

      this.logger.info('Analysis complete', {
        sessionName,
        conclusion: analysis.conclusion,
        confidence: analysis.confidence,
      });

      // Update session status
      this.updateSessionStatus(sessionName, analysis);

      // Execute recommended action
      const result = await this.executeAction(sessionName, analysis, config, {
        agentId,
        projectPath,
      });

      // Record in iteration history
      this.recordIteration(sessionName, trigger, analysis, result.action);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error handling continuation event', { sessionName, error: errorMessage });

      return {
        success: false,
        action: 'no_action',
        message: 'Error handling continuation event',
        error: errorMessage,
        executedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get iteration tracking for a session
   *
   * @param sessionName - Session name
   * @returns Iteration tracking data or null
   */
  public async getIterationTracking(sessionName: string): Promise<IterationTracking | null> {
    return this.iterationTracking.get(sessionName) || null;
  }

  /**
   * Reset iteration count for a session
   *
   * @param sessionName - Session name
   */
  public async resetIterations(sessionName: string): Promise<void> {
    const tracking = this.iterationTracking.get(sessionName);
    if (tracking) {
      tracking.iterations = 0;
      tracking.history = [];
      tracking.startedAt = new Date().toISOString();
      this.logger.info('Reset iterations for session', { sessionName });
    }
  }

  /**
   * Execute a continuation action
   *
   * @param sessionName - Session to act on
   * @param analysis - Analysis result
   * @param config - Session configuration
   * @param context - Additional context
   * @returns Action result
   */
  private async executeAction(
    sessionName: string,
    analysis: AgentStateAnalysis,
    config: ContinuationConfig,
    context: { agentId: string; projectPath: string }
  ): Promise<ContinuationActionResult> {
    const action = analysis.recommendation;
    this.logger.info('Executing action', { sessionName, action });

    const now = new Date().toISOString();

    try {
      switch (action) {
        case 'inject_prompt':
          await this.injectContinuationPrompt(sessionName, analysis, context);
          return {
            success: true,
            action,
            message: 'Continuation prompt injected',
            executedAt: now,
          };

        case 'assign_next_task':
          if (config.autoAssignNext) {
            await this.assignNextTask(sessionName);
            return {
              success: true,
              action,
              message: 'Next task assigned',
              executedAt: now,
            };
          } else {
            await this.notifyOwner(sessionName, 'Task completed', analysis);
            return {
              success: true,
              action: 'notify_owner',
              message: 'Owner notified of task completion',
              executedAt: now,
            };
          }

        case 'notify_owner':
          await this.notifyOwner(sessionName, analysis.evidence.join('; '), analysis);
          return {
            success: true,
            action,
            message: 'Owner notified',
            executedAt: now,
          };

        case 'retry_with_hints':
          await this.retryWithHints(sessionName, analysis, context);
          return {
            success: true,
            action,
            message: 'Retry prompt injected with hints',
            executedAt: now,
          };

        case 'pause_agent':
          await this.pauseAgent(sessionName);
          return {
            success: true,
            action,
            message: 'Agent paused',
            executedAt: now,
          };

        case 'no_action':
        default:
          this.logger.debug('No action needed', { sessionName });
          return {
            success: true,
            action: 'no_action',
            message: 'No action taken',
            executedAt: now,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error executing action', { sessionName, action, error: errorMessage });

      return {
        success: false,
        action,
        message: `Failed to execute action: ${action}`,
        error: errorMessage,
        executedAt: now,
      };
    }
  }

  /**
   * Inject a continuation prompt into the session
   *
   * @param sessionName - Session to inject into
   * @param analysis - Analysis result
   * @param context - Additional context
   */
  private async injectContinuationPrompt(
    sessionName: string,
    analysis: AgentStateAnalysis,
    context: { agentId: string; projectPath: string }
  ): Promise<void> {
    // Increment iteration
    const tracking = this.iterationTracking.get(sessionName);
    if (tracking) {
      tracking.iterations++;
      tracking.lastIterationAt = new Date().toISOString();
    }

    // Build continuation prompt
    const prompt = this.buildContinuationPrompt(analysis);

    // Log the prompt (actual injection would go through PTY backend)
    this.logger.info('Continuation prompt prepared', {
      sessionName,
      iteration: tracking?.iterations || 1,
      promptLength: prompt.length,
    });

    // TODO: Integrate with PtySessionBackend to actually inject the prompt
    // await this.ptyBackend.injectPrompt(sessionName, prompt);
  }

  /**
   * Assign the next task to the session
   *
   * @param sessionName - Session to assign to
   */
  private async assignNextTask(sessionName: string): Promise<void> {
    this.logger.info('Assigning next task', { sessionName });

    // Reset iteration count for new task
    await this.resetIterations(sessionName);

    // TODO: Integrate with TaskService to find and assign next task
    // const nextTask = await this.taskService.getNextTask(projectPath, role);
    // if (nextTask) {
    //   await this.taskService.assignTask(nextTask.path, sessionName);
    // }
  }

  /**
   * Notify the owner about the session state
   *
   * @param sessionName - Session that needs attention
   * @param reason - Reason for notification
   * @param analysis - Analysis result
   */
  private async notifyOwner(
    sessionName: string,
    reason: string,
    analysis: AgentStateAnalysis
  ): Promise<void> {
    this.logger.warn('Owner notification', {
      sessionName,
      reason,
      conclusion: analysis.conclusion,
      evidence: analysis.evidence,
    });

    // Store notification for dashboard
    const notification: ContinuationNotification = {
      type: 'continuation',
      sessionName,
      reason,
      analysis,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.notifications.push(notification);

    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications.shift();
    }

    // TODO: Integrate with external notification system (WebSocket, email, etc.)
  }

  /**
   * Retry with error hints
   *
   * @param sessionName - Session to retry
   * @param analysis - Analysis result with error info
   * @param context - Additional context
   */
  private async retryWithHints(
    sessionName: string,
    analysis: AgentStateAnalysis,
    context: { agentId: string; projectPath: string }
  ): Promise<void> {
    // Increment iteration
    const tracking = this.iterationTracking.get(sessionName);
    if (tracking) {
      tracking.iterations++;
      tracking.lastIterationAt = new Date().toISOString();
    }

    // Build retry prompt with error hints
    const prompt = this.buildRetryPrompt(analysis);

    this.logger.info('Retry prompt prepared with hints', {
      sessionName,
      iteration: tracking?.iterations || 1,
      errorEvidence: analysis.evidence[0],
    });

    // TODO: Integrate with PtySessionBackend to inject the prompt
  }

  /**
   * Pause the agent session
   *
   * @param sessionName - Session to pause
   */
  private async pauseAgent(sessionName: string): Promise<void> {
    this.logger.info('Pausing agent', { sessionName });

    // Update status
    const status = this.sessionStatus.get(sessionName);
    if (status) {
      status.isMonitored = false;
    }

    // TODO: Integrate with PtySessionBackend to actually pause
  }

  /**
   * Build a continuation prompt based on analysis
   *
   * @param analysis - Analysis result
   * @returns Continuation prompt string
   */
  private buildContinuationPrompt(analysis: AgentStateAnalysis): string {
    const hints = this.getHintsForConclusion(analysis.conclusion);
    const evidence = analysis.evidence.join('\n- ');

    return `
Continue working on the current task.

**Current Status:**
- Iteration: ${analysis.iterations + 1} of ${analysis.maxIterations}
- Observations:
  - ${evidence || 'No specific observations'}

**Next Steps:**
${hints}

Please continue with the task and call complete_task when finished.
`.trim();
  }

  /**
   * Build a retry prompt with error hints
   *
   * @param analysis - Analysis result with error info
   * @returns Retry prompt string
   */
  private buildRetryPrompt(analysis: AgentStateAnalysis): string {
    const evidence = analysis.evidence.join('\n- ');

    return `
An error was detected. Please review and fix.

**Error Information:**
- ${evidence}

**Suggestions:**
- Read the error message carefully
- Check for typos or missing imports
- Verify dependencies are installed
- Use recall tool to check for known gotchas
- Try a different approach if stuck

Please fix the issue and continue with the task.
`.trim();
  }

  /**
   * Get hints based on the conclusion
   *
   * @param conclusion - Agent conclusion
   * @returns Hint string
   */
  private getHintsForConclusion(conclusion: AgentConclusion): string {
    switch (conclusion) {
      case 'INCOMPLETE':
        return `- Review your progress so far
- Check if all acceptance criteria are met
- Run tests and fix any failures
- Make a commit when ready
- Call complete_task when truly done`;

      case 'STUCK_OR_ERROR':
        return `- Read the error message carefully
- Check for typos or missing imports
- Verify dependencies are installed
- Try a different approach if stuck
- Use recall tool to check for known gotchas`;

      case 'WAITING_INPUT':
        return `- If you have enough information, proceed with reasonable defaults
- Otherwise, clearly state what information you need`;

      default:
        return `- Continue working on the task
- Call complete_task when finished`;
    }
  }

  /**
   * Get or create iteration tracking for a session
   *
   * @param sessionName - Session name
   * @param agentId - Agent ID
   * @returns Iteration tracking
   */
  private getOrCreateIterationTracking(sessionName: string, agentId: string): IterationTracking {
    let tracking = this.iterationTracking.get(sessionName);

    if (!tracking) {
      tracking = {
        sessionName,
        agentId,
        taskId: '',
        iterations: 0,
        maxIterations: CONTINUATION_CONSTANTS.ITERATIONS.DEFAULT_MAX,
        startedAt: new Date().toISOString(),
        lastIterationAt: new Date().toISOString(),
        history: [],
      };
      this.iterationTracking.set(sessionName, tracking);
    }

    return tracking;
  }

  /**
   * Record an iteration in the history
   *
   * @param sessionName - Session name
   * @param trigger - What triggered this iteration
   * @param analysis - Analysis result
   * @param action - Action taken
   */
  private recordIteration(
    sessionName: string,
    trigger: ContinuationEvent['trigger'],
    analysis: AgentStateAnalysis,
    action: ContinuationAction
  ): void {
    const tracking = this.iterationTracking.get(sessionName);
    if (tracking) {
      tracking.history.push({
        iteration: tracking.iterations,
        trigger,
        conclusion: analysis.conclusion,
        action,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 50 history entries
      if (tracking.history.length > 50) {
        tracking.history.shift();
      }
    }
  }

  /**
   * Update session status with latest analysis
   *
   * @param sessionName - Session name
   * @param analysis - Analysis result
   */
  private updateSessionStatus(sessionName: string, analysis: AgentStateAnalysis): void {
    const tracking = this.iterationTracking.get(sessionName);

    const status: SessionContinuationStatus = {
      sessionName,
      isMonitored: true,
      currentIteration: tracking?.iterations || 0,
      maxIterations: tracking?.maxIterations || CONTINUATION_CONSTANTS.ITERATIONS.DEFAULT_MAX,
      lastAnalysis: analysis,
    };

    this.sessionStatus.set(sessionName, status);
  }

  /**
   * Set maximum iterations for a session
   *
   * @param sessionName - Session name
   * @param max - Maximum iterations
   */
  public async setMaxIterations(sessionName: string, max: number): Promise<void> {
    const config = await this.getSessionConfig(sessionName);
    config.maxIterations = Math.min(max, CONTINUATION_CONSTANTS.ITERATIONS.ABSOLUTE_MAX);
    this.sessionConfigs.set(sessionName, config);

    const tracking = this.iterationTracking.get(sessionName);
    if (tracking) {
      tracking.maxIterations = config.maxIterations;
    }

    this.logger.info('Set max iterations', { sessionName, max: config.maxIterations });
  }

  /**
   * Get configuration for a session
   *
   * @param sessionName - Session name
   * @returns Session configuration
   */
  public async getSessionConfig(sessionName: string): Promise<ContinuationConfig> {
    let config = this.sessionConfigs.get(sessionName);

    if (!config) {
      config = { ...DEFAULT_CONFIG };
      this.sessionConfigs.set(sessionName, config);
    }

    return config;
  }

  /**
   * Get active monitors
   *
   * @returns List of session names being monitored
   */
  public getActiveMonitors(): string[] {
    return Array.from(this.sessionStatus.entries())
      .filter(([, status]) => status.isMonitored)
      .map(([name]) => name);
  }

  /**
   * Get status for a session
   *
   * @param sessionName - Session name
   * @returns Session status or null
   */
  public async getSessionStatus(sessionName: string): Promise<SessionContinuationStatus | null> {
    return this.sessionStatus.get(sessionName) || null;
  }

  /**
   * Get all notifications
   *
   * @param unacknowledgedOnly - Only return unacknowledged notifications
   * @returns List of notifications
   */
  public getNotifications(unacknowledgedOnly = false): ContinuationNotification[] {
    if (unacknowledgedOnly) {
      return this.notifications.filter((n) => !n.acknowledged);
    }
    return [...this.notifications];
  }

  /**
   * Acknowledge a notification
   *
   * @param timestamp - Notification timestamp to acknowledge
   */
  public acknowledgeNotification(timestamp: string): void {
    const notification = this.notifications.find((n) => n.timestamp === timestamp);
    if (notification) {
      notification.acknowledged = true;
    }
  }

  /**
   * Check if service is running
   *
   * @returns True if running
   */
  public isServiceRunning(): boolean {
    return this.isRunning;
  }
}
