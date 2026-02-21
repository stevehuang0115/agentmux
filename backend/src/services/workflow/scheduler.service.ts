/**
 * Scheduler Service
 *
 * Enhanced scheduler service with PTY compatibility, continuation-aware scheduling,
 * and adaptive scheduling based on agent activity.
 *
 * @module services/workflow/scheduler.service
 */

import { EventEmitter } from 'events';
import { ScheduledCheck } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  ISessionBackend,
  getSessionBackendSync,
  createSessionBackend,
} from '../session/index.js';
import { StorageService } from '../core/storage.service.js';
import { MessageDeliveryLogModel } from '../../models/ScheduledMessage.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { AgentRegistrationService } from '../agent/agent-registration.service.js';
import { RUNTIME_TYPES, RuntimeType } from '../../constants.js';
import {
  ScheduledMessageType,
  EnhancedScheduledMessage,
  AdaptiveScheduleConfig,
  ActivityInfo,
  ScheduleContinuationParams,
  DEFAULT_SCHEDULES,
  DEFAULT_ADAPTIVE_CONFIG,
  SchedulerStats,
} from '../../types/scheduler.types.js';

/**
 * Interface for ContinuationService integration
 */
interface IContinuationServiceLike {
  handleEvent(event: {
    trigger: string;
    sessionName: string;
    agentId: string;
    projectPath: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }): Promise<unknown>;
}

/**
 * Interface for ActivityMonitor integration
 */
interface IActivityMonitorLike {
  getWorkingStatusForSession(sessionName: string): Promise<'idle' | 'in_progress' | null>;
}

/**
 * Enhanced SchedulerService with PTY compatibility
 *
 * Features:
 * - Uses PTY session backend instead of tmux
 * - Continuation-aware scheduling
 * - Adaptive scheduling based on activity
 * - Recurring check persistence to disk (survives restarts via StorageService)
 * - Backward compatible API
 *
 * ## Migration Note: SchedulerService vs MessageSchedulerService
 *
 * Both services schedule recurring messages to agent sessions, but they serve
 * different purposes and should remain separate:
 *
 * **MessageSchedulerService** — User-configured scheduled messages.
 * - Messages are persisted as `ScheduledMessage` objects with full CRUD via
 *   the frontend settings UI.
 * - Supports `delayUnit` (seconds/minutes/hours), `targetProject`, and
 *   `isActive` toggles.
 * - Uses a sequential message queue (`executeMessageSequentially`) to
 *   prevent race conditions when multiple user-configured messages fire at
 *   the same time.
 * - Loads state on startup via `loadAndScheduleAllMessages()`.
 *
 * **SchedulerService** (this class) — Programmatic/orchestrator-driven checks.
 * - Checks are created dynamically by the orchestrator via the
 *   `schedule-check` skill or internally by `scheduleDefaultCheckins`.
 * - Supports continuation-aware checks, adaptive scheduling based on
 *   agent activity, and max occurrence limits.
 * - Uses `ScheduledCheck` type with `intervalMinutes` (minutes only).
 * - Persists recurring checks to `~/.crewly/recurring-checks.json` and
 *   restores them via `restoreRecurringChecks()`.
 *
 * **Recommendation:** Keep both services. They share the same delivery
 * path (`AgentRegistrationService.sendMessageToAgent`), but unifying them
 * would require merging two different persistence models, two different
 * scheduling APIs, and two different use-case flows (UI-driven vs
 * orchestrator-driven). The sequential queue pattern from
 * MessageSchedulerService could be adopted here if concurrent recurring
 * check delivery becomes a problem in practice.
 *
 * @example
 * ```typescript
 * const scheduler = new SchedulerService(storageService);
 *
 * // Schedule default check-ins
 * const checkIds = scheduler.scheduleDefaultCheckins('agent-session');
 *
 * // Schedule a continuation check
 * const contId = scheduler.scheduleContinuationCheck({
 *   sessionName: 'agent-session',
 *   delayMinutes: 5,
 *   agentId: 'agent-1',
 *   projectPath: '/path/to/project',
 * });
 *
 * // Schedule adaptive check-in
 * await scheduler.scheduleAdaptiveCheckin('agent-session');
 * ```
 */
export class SchedulerService extends EventEmitter {
  private scheduledChecks: Map<string, NodeJS.Timeout> = new Map();
  private oneTimeChecksData: Map<string, ScheduledCheck> = new Map();
  private recurringChecks: Map<string, ScheduledCheck> = new Map();
  private recurringTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private continuationChecks: Map<string, NodeJS.Timeout> = new Map();
  private adaptiveChecks: Map<string, string> = new Map();
  private enhancedMessages: Map<string, EnhancedScheduledMessage> = new Map();

  private _sessionBackend: ISessionBackend | null = null;
  private storageService: StorageService;
  private logger: ComponentLogger;

  // Optional service integrations
  private continuationService: IContinuationServiceLike | null = null;
  private activityMonitor: IActivityMonitorLike | null = null;
  private agentRegistrationService: AgentRegistrationService | null = null;

  /**
   * Creates a new SchedulerService
   *
   * @param storageService - Storage service for delivery logs
   */
  constructor(storageService: StorageService) {
    super();
    this.storageService = storageService;
    this.logger = LoggerService.getInstance().createComponentLogger('SchedulerService');
  }

  /**
   * Get the session backend, lazily initializing if needed
   *
   * @returns Promise resolving to the session backend
   */
  private async getBackend(): Promise<ISessionBackend> {
    if (!this._sessionBackend) {
      this._sessionBackend = getSessionBackendSync();
      if (!this._sessionBackend) {
        this._sessionBackend = await createSessionBackend('pty');
      }
    }
    return this._sessionBackend;
  }

  /**
   * Get the session backend synchronously (may return null if not initialized)
   *
   * @returns Session backend or null
   */
  private get sessionBackend(): ISessionBackend | null {
    if (!this._sessionBackend) {
      this._sessionBackend = getSessionBackendSync();
    }
    return this._sessionBackend;
  }

  /**
   * Set the continuation service for integration
   *
   * @param service - Continuation service instance
   */
  public setContinuationService(service: IContinuationServiceLike): void {
    this.continuationService = service;
    this.logger.info('ContinuationService integration enabled');
  }

  /**
   * Set the activity monitor for adaptive scheduling
   *
   * @param monitor - Activity monitor instance
   */
  public setActivityMonitor(monitor: IActivityMonitorLike): void {
    this.activityMonitor = monitor;
    this.logger.info('ActivityMonitor integration enabled');
  }

  /**
   * Set the AgentRegistrationService for reliable message delivery.
   * Called after both services are constructed to avoid circular dependencies.
   *
   * @param service - The AgentRegistrationService instance
   */
  public setAgentRegistrationService(service: AgentRegistrationService): void {
    this.agentRegistrationService = service;
    this.logger.info('AgentRegistrationService integration enabled for reliable delivery');
  }

  /**
   * Resolve the runtime type for a target session by looking up the team member.
   * Falls back to claude-code if the member is not found.
   *
   * @param sessionName - The session name to look up
   * @returns The runtime type for the session
   */
  private async resolveRuntimeType(sessionName: string): Promise<RuntimeType> {
    try {
      const memberInfo = await this.storageService.findMemberBySessionName(sessionName);
      if (memberInfo?.member?.runtimeType) {
        return memberInfo.member.runtimeType as RuntimeType;
      }
    } catch (err) {
      this.logger.debug('Could not resolve runtime type, using default', {
        sessionName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return RUNTIME_TYPES.CLAUDE_CODE;
  }

  /**
   * Schedule a one-time check-in for an agent
   *
   * @param targetSession - Target session name
   * @param minutes - Delay in minutes
   * @param message - Message to send
   * @param type - Type of scheduled message
   * @returns Check ID
   */
  scheduleCheck(
    targetSession: string,
    minutes: number,
    message: string,
    type: ScheduledMessageType = 'check-in'
  ): string {
    const checkId = uuidv4();
    const scheduledFor = new Date(Date.now() + minutes * 60 * 1000);

    const scheduledCheck: ScheduledCheck = {
      id: checkId,
      targetSession,
      message,
      scheduledFor: scheduledFor.toISOString(),
      isRecurring: false,
      createdAt: new Date().toISOString(),
    };

    // Store enhanced message info
    const enhancedMessage: EnhancedScheduledMessage = {
      id: checkId,
      sessionName: targetSession,
      message,
      scheduledFor,
      type,
      createdAt: new Date().toISOString(),
    };
    this.enhancedMessages.set(checkId, enhancedMessage);

    // Persist to disk so one-time checks survive restarts
    this.storageService.saveOneTimeCheck(scheduledCheck).catch(err => {
      this.logger.error('Failed to persist one-time check', {
        checkId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Schedule the execution
    const timeout = setTimeout(() => {
      this.executeCheck(targetSession, message);
      this.scheduledChecks.delete(checkId);
      this.enhancedMessages.delete(checkId);
      this.storageService.deleteOneTimeCheck(checkId).catch(err => {
        this.logger.error('Failed to delete persisted one-time check after execution', {
          checkId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      this.emit('check_executed', scheduledCheck);
    }, minutes * 60 * 1000);

    this.scheduledChecks.set(checkId, timeout);

    this.emit('check_scheduled', scheduledCheck);
    this.logger.info('Scheduled check-in', {
      checkId,
      targetSession,
      minutes,
      type,
    });

    return checkId;
  }

  /**
   * Schedule recurring check-ins for an agent
   *
   * @param targetSession - Target session name
   * @param intervalMinutes - Interval in minutes
   * @param message - Message to send
   * @param type - Type of scheduled message
   * @param maxOccurrences - Maximum number of times the check fires (undefined = unlimited)
   * @returns Check ID
   */
  scheduleRecurringCheck(
    targetSession: string,
    intervalMinutes: number,
    message: string,
    type: ScheduledMessageType = 'progress-check',
    maxOccurrences?: number
  ): string {
    const checkId = uuidv4();
    const firstExecution = new Date(Date.now() + intervalMinutes * 60 * 1000);

    const scheduledCheck: ScheduledCheck = {
      id: checkId,
      targetSession,
      message,
      scheduledFor: firstExecution.toISOString(),
      intervalMinutes,
      isRecurring: true,
      createdAt: new Date().toISOString(),
    };

    this.recurringChecks.set(checkId, scheduledCheck);

    // Persist to disk so checks survive restarts
    this.storageService.saveRecurringCheck(scheduledCheck).catch(err => {
      this.logger.error('Failed to persist recurring check', {
        checkId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Store enhanced message info
    const enhancedMessage: EnhancedScheduledMessage = {
      id: checkId,
      sessionName: targetSession,
      message,
      scheduledFor: firstExecution,
      type,
      recurring: {
        interval: intervalMinutes,
        currentOccurrence: 0,
        maxOccurrences,
      },
      createdAt: new Date().toISOString(),
    };
    this.enhancedMessages.set(checkId, enhancedMessage);

    // Schedule the first execution and set up recurring
    this.scheduleRecurringExecution(checkId, intervalMinutes, targetSession, message);

    this.emit('recurring_check_scheduled', scheduledCheck);
    this.logger.info('Scheduled recurring check-in', {
      checkId,
      targetSession,
      intervalMinutes,
      type,
    });

    return checkId;
  }

  /**
   * Schedule default check-ins for a new agent
   *
   * @param sessionName - Session name
   * @returns Array of check IDs
   */
  scheduleDefaultCheckins(sessionName: string): string[] {
    const checkIds: string[] = [];

    // Initial check-in after 5 minutes
    checkIds.push(
      this.scheduleCheck(
        sessionName,
        DEFAULT_SCHEDULES.initialCheck,
        'Initial check-in: How are you getting started? Any immediate questions or blockers?',
        'check-in'
      )
    );

    // Progress check every 30 minutes
    checkIds.push(
      this.scheduleRecurringCheck(
        sessionName,
        DEFAULT_SCHEDULES.progressCheck,
        'Regular check-in: Please provide a status update. What have you accomplished? What are you working on next? Any blockers?',
        'progress-check'
      )
    );

    // Commit reminder every 25 minutes (before 30-min limit)
    checkIds.push(
      this.scheduleRecurringCheck(
        sessionName,
        DEFAULT_SCHEDULES.commitReminder,
        'Git reminder: Please ensure you commit your changes. Remember our 30-minute commit discipline.',
        'commit-reminder'
      )
    );

    this.logger.info('Scheduled default check-ins', {
      sessionName,
      checkCount: checkIds.length,
    });

    return checkIds;
  }

  /**
   * Schedule a continuation check
   *
   * Continuation checks trigger the ContinuationService instead of
   * sending a regular message.
   *
   * @param params - Continuation parameters
   * @returns Check ID
   */
  scheduleContinuationCheck(params: ScheduleContinuationParams): string {
    const { sessionName, delayMinutes, agentId, projectPath } = params;
    const checkId = uuidv4();

    // Store enhanced message info
    const enhancedMessage: EnhancedScheduledMessage = {
      id: checkId,
      sessionName,
      message: '', // No message for continuation checks
      scheduledFor: new Date(Date.now() + delayMinutes * 60 * 1000),
      type: 'continuation',
      metadata: {
        triggerContinuation: true,
        agentId,
        projectPath,
      },
      createdAt: new Date().toISOString(),
    };
    this.enhancedMessages.set(checkId, enhancedMessage);

    // Schedule the continuation trigger
    const timeout = setTimeout(async () => {
      await this.executeContinuationCheck(sessionName, agentId, projectPath);
      this.continuationChecks.delete(checkId);
      this.enhancedMessages.delete(checkId);
      this.emit('continuation_check_executed', { checkId, sessionName });
    }, delayMinutes * 60 * 1000);

    this.continuationChecks.set(checkId, timeout);

    this.emit('continuation_check_scheduled', { checkId, sessionName, delayMinutes });
    this.logger.info('Scheduled continuation check', {
      checkId,
      sessionName,
      delayMinutes,
    });

    return checkId;
  }

  /**
   * Schedule an adaptive check-in based on agent activity
   *
   * Adjusts the check interval based on whether the agent is active or idle.
   *
   * @param sessionName - Session name
   * @param config - Adaptive configuration (uses defaults if not provided)
   * @returns Check ID
   */
  async scheduleAdaptiveCheckin(
    sessionName: string,
    config: AdaptiveScheduleConfig = DEFAULT_ADAPTIVE_CONFIG
  ): Promise<string> {
    // Get activity info
    const activity = await this.getActivityInfo(sessionName);

    // Calculate interval based on activity
    let interval = config.baseInterval;

    if (activity.isHighlyActive) {
      // Agent is busy, check less frequently
      interval = Math.min(interval * config.adjustmentFactor, config.maxInterval);
    } else if (activity.isIdle) {
      // Agent may need help, check more frequently
      interval = Math.max(interval / config.adjustmentFactor, config.minInterval);
    }

    // Round to nearest minute
    interval = Math.round(interval);

    this.logger.info('Scheduling adaptive check-in', {
      sessionName,
      interval,
      isHighlyActive: activity.isHighlyActive,
      isIdle: activity.isIdle,
    });

    // Schedule the check
    const checkId = this.scheduleCheck(
      sessionName,
      interval,
      'Adaptive check-in: How is your progress? Do you need any assistance?',
      'progress-check'
    );

    // Track as adaptive check
    this.adaptiveChecks.set(checkId, sessionName);

    return checkId;
  }

  /**
   * Get activity info for a session
   *
   * @param sessionName - Session name
   * @returns Activity information
   */
  private async getActivityInfo(sessionName: string): Promise<ActivityInfo> {
    if (!this.activityMonitor) {
      // Without activity monitor, assume moderate activity
      return {
        isHighlyActive: false,
        isIdle: false,
      };
    }

    try {
      const workingStatus = await this.activityMonitor.getWorkingStatusForSession(sessionName);

      return {
        isHighlyActive: workingStatus === 'in_progress',
        isIdle: workingStatus === 'idle',
        lastActivityAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting activity info', {
        sessionName,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isHighlyActive: false,
        isIdle: false,
      };
    }
  }

  /**
   * Cancel a scheduled check-in
   *
   * @param checkId - Check ID to cancel
   */
  cancelCheck(checkId: string): void {
    // Cancel one-time check
    const timeout = this.scheduledChecks.get(checkId);
    if (timeout) {
      clearTimeout(timeout);
      this.scheduledChecks.delete(checkId);
      this.enhancedMessages.delete(checkId);
      this.storageService.deleteOneTimeCheck(checkId).catch(err => {
        this.logger.error('Failed to delete persisted one-time check', {
          checkId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      this.emit('check_cancelled', { checkId, type: 'one-time' });
      this.logger.info('Cancelled one-time check-in', { checkId });
      return;
    }

    // Cancel recurring check
    const recurringCheck = this.recurringChecks.get(checkId);
    if (recurringCheck) {
      const recurringTimeout = this.recurringTimeouts.get(checkId);
      if (recurringTimeout) {
        clearTimeout(recurringTimeout);
        this.recurringTimeouts.delete(checkId);
      }
      this.recurringChecks.delete(checkId);
      this.enhancedMessages.delete(checkId);
      this.storageService.deleteRecurringCheck(checkId).catch(err => {
        this.logger.error('Failed to delete persisted recurring check', {
          checkId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      this.emit('check_cancelled', { checkId, type: 'recurring' });
      this.logger.info('Cancelled recurring check-in', { checkId });
      return;
    }

    // Cancel continuation check
    const contTimeout = this.continuationChecks.get(checkId);
    if (contTimeout) {
      clearTimeout(contTimeout);
      this.continuationChecks.delete(checkId);
      this.enhancedMessages.delete(checkId);
      this.emit('check_cancelled', { checkId, type: 'continuation' });
      this.logger.info('Cancelled continuation check', { checkId });
      return;
    }

    // Remove from adaptive checks if present
    this.adaptiveChecks.delete(checkId);

    this.logger.warn('Check-in not found', { checkId });
  }

  /**
   * Cancel all checks for a specific session
   *
   * @param sessionName - Session name
   */
  cancelAllChecksForSession(sessionName: string): void {
    // Cancel one-time checks
    for (const [checkId, timeout] of this.scheduledChecks.entries()) {
      const enhanced = this.enhancedMessages.get(checkId);
      if (enhanced && enhanced.sessionName === sessionName) {
        clearTimeout(timeout);
        this.scheduledChecks.delete(checkId);
        this.enhancedMessages.delete(checkId);
      }
    }

    // Cancel recurring checks
    for (const [checkId, check] of this.recurringChecks.entries()) {
      if (check.targetSession === sessionName) {
        const recurringTimeout = this.recurringTimeouts.get(checkId);
        if (recurringTimeout) {
          clearTimeout(recurringTimeout);
          this.recurringTimeouts.delete(checkId);
        }
        this.recurringChecks.delete(checkId);
        this.enhancedMessages.delete(checkId);
        this.storageService.deleteRecurringCheck(checkId).catch(err => {
          this.logger.error('Failed to delete persisted recurring check', {
            checkId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
        this.emit('session_checks_cancelled', { sessionName, checkId });
      }
    }

    // Cancel continuation checks
    for (const [checkId, timeout] of this.continuationChecks.entries()) {
      const enhanced = this.enhancedMessages.get(checkId);
      if (enhanced && enhanced.sessionName === sessionName) {
        clearTimeout(timeout);
        this.continuationChecks.delete(checkId);
        this.enhancedMessages.delete(checkId);
      }
    }

    // Remove from adaptive checks
    for (const [checkId, session] of this.adaptiveChecks.entries()) {
      if (session === sessionName) {
        this.adaptiveChecks.delete(checkId);
      }
    }

    this.logger.info('Cancelled all check-ins for session', { sessionName });
  }

  /**
   * List all scheduled check-ins
   *
   * @returns Array of scheduled checks
   */
  listScheduledChecks(): ScheduledCheck[] {
    const checks: ScheduledCheck[] = [];

    // Add recurring checks
    for (const check of this.recurringChecks.values()) {
      checks.push(check);
    }

    // Note: We don't store one-time check details after scheduling
    // In a production system, you'd want to persist this information

    return checks.sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
    );
  }

  /**
   * Get checks for a specific session
   *
   * @param sessionName - Session name
   * @returns Array of scheduled checks
   */
  getChecksForSession(sessionName: string): ScheduledCheck[] {
    return this.listScheduledChecks().filter((check) => check.targetSession === sessionName);
  }

  /**
   * Get enhanced message information for a check
   *
   * @param checkId - Check ID
   * @returns Enhanced message or undefined
   */
  getEnhancedMessage(checkId: string): EnhancedScheduledMessage | undefined {
    return this.enhancedMessages.get(checkId);
  }

  /**
   * Execute a check-in using reliable delivery via AgentRegistrationService.
   * Falls back to direct PTY write if AgentRegistrationService is not available.
   *
   * The reliable delivery path provides: prompt detection before sending,
   * two-step write (text then Enter separately), progressive delivery verification,
   * background stuck-message scanning, and retry logic.
   *
   * @param targetSession - Target session name
   * @param message - Message to send
   */
  private async executeCheck(targetSession: string, message: string): Promise<void> {
    let success = false;
    let error: string | undefined;

    try {
      if (this.agentRegistrationService) {
        // Reliable delivery path: uses retry + progressive verification + background scanner
        const runtimeType = await this.resolveRuntimeType(targetSession);
        const deliveryResult = await this.agentRegistrationService.sendMessageToAgent(
          targetSession,
          message,
          runtimeType
        );
        success = deliveryResult.success;
        if (!success) {
          throw new Error(deliveryResult.error || 'Delivery failed after retries');
        }

        this.logger.info('Check-in executed via reliable delivery', {
          targetSession,
          messageLength: message.length,
        });
      } else {
        // Fallback: direct PTY write (should not happen in normal operation)
        this.logger.warn('AgentRegistrationService not available, using fallback PTY write', {
          targetSession,
        });

        const backend = await this.getBackend();
        if (!backend.sessionExists(targetSession)) {
          this.logger.info('Session no longer exists, skipping check-in', { targetSession });
          return;
        }

        const { SessionCommandHelper } = await import('../session/session-command-helper.js');
        const commandHelper = new SessionCommandHelper(backend);
        await commandHelper.sendMessage(targetSession, message);
        success = true;

        this.logger.info('Check-in executed via fallback', {
          targetSession,
          messageLength: message.length,
        });
      }

      this.emit('check_executed', {
        targetSession,
        message,
        executedAt: new Date().toISOString(),
      });
    } catch (sendError) {
      success = false;
      error = sendError instanceof Error ? sendError.message : 'Unknown error';
      this.logger.error('Error executing check-in', { targetSession, error });

      this.emit('check_execution_failed', {
        targetSession,
        message,
        error,
      });
    }

    // Create delivery log for scheduler messages
    const deliveryLog = MessageDeliveryLogModel.create({
      scheduledMessageId: `scheduler-${uuidv4()}`,
      messageName: message.includes('Git reminder')
        ? 'Scheduled Git Reminder'
        : 'Scheduled Status Check-in',
      targetTeam: targetSession,
      targetProject: '',
      message: message,
      success,
      error,
    });

    try {
      await this.storageService.saveDeliveryLog(deliveryLog);
    } catch (logError) {
      this.logger.error('Error saving scheduler delivery log', {
        error: logError instanceof Error ? logError.message : String(logError),
      });
    }
  }

  /**
   * Execute a continuation check
   *
   * @param sessionName - Session name
   * @param agentId - Agent ID
   * @param projectPath - Project path
   */
  private async executeContinuationCheck(
    sessionName: string,
    agentId?: string,
    projectPath?: string
  ): Promise<void> {
    if (!this.continuationService) {
      // Fall back to regular message if no continuation service
      this.logger.warn('No ContinuationService configured, sending regular message', {
        sessionName,
      });
      await this.executeCheck(
        sessionName,
        'Continuation check: Please continue working on your current task.'
      );
      return;
    }

    try {
      await this.continuationService.handleEvent({
        trigger: 'explicit_request',
        sessionName,
        agentId: agentId || 'unknown',
        projectPath: projectPath || '',
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'scheduler',
          scheduledCheck: true,
        },
      });

      this.logger.info('Continuation check executed', { sessionName });
    } catch (error) {
      this.logger.error('Error executing continuation check', {
        sessionName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set up recurring execution
   *
   * @param checkId - Check ID
   * @param intervalMinutes - Interval in minutes
   * @param targetSession - Target session
   * @param message - Message to send
   */
  private scheduleRecurringExecution(
    checkId: string,
    intervalMinutes: number,
    targetSession: string,
    message: string
  ): void {
    const executeRecurring = async () => {
      // Check if this recurring check is still active
      if (!this.recurringChecks.has(checkId)) {
        this.recurringTimeouts.delete(checkId);
        return; // Check was cancelled
      }

      await this.executeCheck(targetSession, message);

      // Log per-execution result
      const enhanced = this.enhancedMessages.get(checkId);
      const occurrence = (enhanced?.recurring?.currentOccurrence ?? 0) + 1;
      const maxOcc = enhanced?.recurring?.maxOccurrences;
      this.logger.info('Recurring check executed', {
        checkId,
        targetSession,
        occurrence,
        maxOccurrences: maxOcc ?? 'unlimited',
      });

      // Update occurrence count
      if (enhanced?.recurring) {
        enhanced.recurring.currentOccurrence =
          (enhanced.recurring.currentOccurrence || 0) + 1;

        // Check if max occurrences reached
        if (
          enhanced.recurring.maxOccurrences &&
          enhanced.recurring.currentOccurrence >= enhanced.recurring.maxOccurrences
        ) {
          this.cancelCheck(checkId);
          this.logger.info('Recurring check reached max occurrences', {
            checkId,
            maxOccurrences: enhanced.recurring.maxOccurrences,
          });
          return;
        }
      }

      // Check again if still active before scheduling next (may have been cancelled during execution)
      if (!this.recurringChecks.has(checkId)) {
        this.recurringTimeouts.delete(checkId);
        return;
      }

      // Schedule next execution only after delivery completes
      const nextTimeout = setTimeout(executeRecurring, intervalMinutes * 60 * 1000);
      this.recurringTimeouts.set(checkId, nextTimeout);
    };

    // Schedule first execution
    const firstTimeout = setTimeout(executeRecurring, intervalMinutes * 60 * 1000);
    this.recurringTimeouts.set(checkId, firstTimeout);
  }

  /**
   * Clean up all scheduled checks
   */
  cleanup(): void {
    // Clear all one-time checks
    for (const timeout of this.scheduledChecks.values()) {
      clearTimeout(timeout);
    }
    this.scheduledChecks.clear();

    // Clear all recurring checks and their timeouts
    for (const timeout of this.recurringTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.recurringTimeouts.clear();
    this.recurringChecks.clear();

    // Clear persisted recurring checks
    this.storageService.clearRecurringChecks().catch(err => {
      this.logger.error('Failed to clear persisted recurring checks', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Clear persisted one-time checks
    this.storageService.clearOneTimeChecks().catch(err => {
      this.logger.error('Failed to clear persisted one-time checks', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Clear all continuation checks
    for (const timeout of this.continuationChecks.values()) {
      clearTimeout(timeout);
    }
    this.continuationChecks.clear();

    // Clear adaptive checks
    this.adaptiveChecks.clear();

    // Clear enhanced messages
    this.enhancedMessages.clear();

    this.logger.info('Scheduler service cleaned up');
  }

  /**
   * Restore recurring checks from disk after a restart.
   *
   * Reads persisted recurring check state and re-schedules each one.
   * The first execution fires after one interval from now (not from the
   * original creation time) to avoid a burst of catch-up deliveries.
   *
   * @returns Number of checks restored
   */
  async restoreRecurringChecks(): Promise<number> {
    try {
      const persisted = await this.storageService.getRecurringChecks();
      if (persisted.length === 0) {
        return 0;
      }

      let restored = 0;
      for (const check of persisted) {
        if (!check.isRecurring || !check.intervalMinutes) {
          continue;
        }

        // Re-create the in-memory state and schedule
        this.recurringChecks.set(check.id, check);

        const enhancedMessage: EnhancedScheduledMessage = {
          id: check.id,
          sessionName: check.targetSession,
          message: check.message,
          scheduledFor: new Date(Date.now() + check.intervalMinutes * 60 * 1000),
          type: 'progress-check',
          recurring: {
            interval: check.intervalMinutes,
            currentOccurrence: 0,
          },
          createdAt: check.createdAt,
        };
        this.enhancedMessages.set(check.id, enhancedMessage);

        this.scheduleRecurringExecution(
          check.id,
          check.intervalMinutes,
          check.targetSession,
          check.message
        );
        restored++;
      }

      this.logger.info('Restored recurring checks from disk', {
        total: persisted.length,
        restored,
      });

      return restored;
    } catch (error) {
      this.logger.error('Failed to restore recurring checks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Restore one-time checks from disk after a restart.
   *
   * Reads persisted one-time check state and re-schedules each one using the
   * remaining time until the original scheduledFor. Checks whose scheduledFor
   * time has already passed are discarded as stale.
   *
   * @returns Number of checks restored
   */
  async restoreOneTimeChecks(): Promise<number> {
    try {
      const persisted = await this.storageService.getOneTimeChecks();
      if (persisted.length === 0) {
        return 0;
      }

      let restored = 0;
      const now = Date.now();

      for (const check of persisted) {
        // Skip recurring checks that ended up here by mistake
        if (check.isRecurring) {
          continue;
        }

        const scheduledTime = new Date(check.scheduledFor).getTime();
        const remainingMs = scheduledTime - now;

        // If the scheduled time has already passed, discard as stale
        if (remainingMs <= 0) {
          this.storageService.deleteOneTimeCheck(check.id).catch(err => {
            this.logger.error('Failed to delete stale one-time check', {
              checkId: check.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
          continue;
        }

        // Re-create the in-memory state and schedule with remaining time
        const enhancedMessage: EnhancedScheduledMessage = {
          id: check.id,
          sessionName: check.targetSession,
          message: check.message,
          scheduledFor: new Date(check.scheduledFor),
          type: 'check-in',
          createdAt: check.createdAt,
        };
        this.enhancedMessages.set(check.id, enhancedMessage);

        const timeout = setTimeout(() => {
          this.executeCheck(check.targetSession, check.message);
          this.scheduledChecks.delete(check.id);
          this.enhancedMessages.delete(check.id);
          this.storageService.deleteOneTimeCheck(check.id).catch(err => {
            this.logger.error('Failed to delete persisted one-time check after execution', {
              checkId: check.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
          this.emit('check_executed', check);
        }, remainingMs);

        this.scheduledChecks.set(check.id, timeout);
        restored++;
      }

      this.logger.info('Restored one-time checks from disk', {
        total: persisted.length,
        restored,
      });

      return restored;
    } catch (error) {
      this.logger.error('Failed to restore one-time checks', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get scheduler statistics
   *
   * @returns Statistics object
   */
  getStats(): SchedulerStats {
    const activeSessions = new Set<string>();

    // Count sessions from recurring checks
    for (const check of this.recurringChecks.values()) {
      activeSessions.add(check.targetSession);
    }

    // Count sessions from enhanced messages (includes one-time and continuation)
    for (const msg of this.enhancedMessages.values()) {
      activeSessions.add(msg.sessionName);
    }

    return {
      oneTimeChecks: this.scheduledChecks.size,
      recurringChecks: this.recurringChecks.size,
      totalActiveSessions: activeSessions.size,
      continuationChecks: this.continuationChecks.size,
      adaptiveChecks: this.adaptiveChecks.size,
    };
  }
}
