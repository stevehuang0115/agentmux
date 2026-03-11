/**
 * Auditor Scheduler Service
 *
 * Manages the lifecycle and triggering of the Crewly Auditor agent.
 * The auditor runs in always-active mode — initialized at server start
 * and kept alive until the service stops.
 *
 * Three trigger layers:
 *   L1 — Periodic: setInterval every AUDIT_INTERVAL_MS (30 min)
 *   L2 — Event-driven: EventBus events (agent:inactive, task:failed) with debounce
 *   L3 — API: POST /api/auditor/trigger manual trigger
 *
 * Additionally supports direct Slack conversation via handleUserMessage().
 *
 * @module services/agent/auditor-scheduler
 */

import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { AUDITOR_SCHEDULER_CONSTANTS } from '../../constants.js';
import { formatError } from '../../utils/format-error.js';
import type { EventBusService } from '../event-bus/event-bus.service.js';
import type { CrewlyAgentRuntimeService } from './crewly-agent/crewly-agent-runtime.service.js';

/**
 * Status of the AuditorSchedulerService.
 */
export type AuditorSchedulerStatus = 'stopped' | 'idle' | 'running_audit';

/**
 * Result from a trigger attempt.
 */
export interface AuditTriggerResult {
  /** Whether the audit was started */
  triggered: boolean;
  /** Reason if not triggered */
  reason?: string;
  /** Trigger source */
  source: 'periodic' | 'event' | 'api';
  /** Timestamp */
  timestamp: string;
}

/**
 * Slack context for user message routing.
 */
export interface SlackContext {
  channelId: string;
  threadTs: string;
}

/**
 * Scheduler service that orchestrates Auditor agent lifecycle.
 *
 * Always-active mode: the auditor runtime is initialized at start()
 * and remains alive until stop(). Audit runs do NOT shut down the runtime.
 *
 * Singleton — use AuditorSchedulerService.getInstance().
 *
 * @example
 * ```typescript
 * const scheduler = AuditorSchedulerService.getInstance();
 * scheduler.setAuditorRuntime(runtime);
 * scheduler.setEventBusService(eventBus);
 * scheduler.start();
 * ```
 */
export class AuditorSchedulerService {
  private static instance: AuditorSchedulerService | null = null;

  private logger: ComponentLogger;
  private status: AuditorSchedulerStatus = 'stopped';

  // Dependencies
  private auditorRuntime: CrewlyAgentRuntimeService | null = null;
  private eventBusService: EventBusService | null = null;

  // L1: Periodic timer
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  // L2: Event-driven debounce
  private eventDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListenerBound = false;

  // Lifecycle: timeout protection
  private auditTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAuditStart: number = 0;
  private auditCount: number = 0;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('AuditorScheduler');
  }

  /**
   * Get the singleton instance.
   *
   * @returns AuditorSchedulerService instance
   */
  static getInstance(): AuditorSchedulerService {
    if (!AuditorSchedulerService.instance) {
      AuditorSchedulerService.instance = new AuditorSchedulerService();
    }
    return AuditorSchedulerService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    if (AuditorSchedulerService.instance) {
      AuditorSchedulerService.instance.stop();
    }
    AuditorSchedulerService.instance = null;
  }

  /**
   * Set the Auditor runtime service for lifecycle management.
   *
   * @param runtime - The CrewlyAgentRuntimeService configured for the auditor
   */
  setAuditorRuntime(runtime: CrewlyAgentRuntimeService): void {
    this.auditorRuntime = runtime;
  }

  /**
   * Set the EventBusService for L2 event-driven triggers.
   *
   * @param eventBus - The EventBusService instance
   */
  setEventBusService(eventBus: EventBusService): void {
    this.eventBusService = eventBus;
  }

  /**
   * Start all trigger layers and initialize the auditor runtime.
   * The auditor is initialized immediately (always-active mode).
   * L1: periodic interval. L2: EventBus listener.
   */
  start(): void {
    if (this.status !== 'stopped') {
      this.logger.warn('AuditorScheduler already started');
      return;
    }

    this.status = 'idle';
    this.logger.info('AuditorScheduler starting (always-active mode)');

    // Initialize auditor runtime immediately (always-active)
    void this.initializeAuditorRuntime();

    // L1: Periodic trigger
    this.periodicTimer = setInterval(() => {
      void this.trigger('periodic');
    }, AUDITOR_SCHEDULER_CONSTANTS.AUDIT_INTERVAL_MS);

    // L2: EventBus listener
    this.bindEventBusListener();

    this.logger.info('AuditorScheduler started', {
      intervalMs: AUDITOR_SCHEDULER_CONSTANTS.AUDIT_INTERVAL_MS,
      debounceMs: AUDITOR_SCHEDULER_CONSTANTS.EVENT_DEBOUNCE_MS,
      timeoutMs: AUDITOR_SCHEDULER_CONSTANTS.AUDIT_TIMEOUT_MS,
    });
  }

  /**
   * Stop all trigger layers, clean up timers, and shut down the runtime.
   * Only called when the entire service is shutting down.
   */
  stop(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
    if (this.eventDebounceTimer) {
      clearTimeout(this.eventDebounceTimer);
      this.eventDebounceTimer = null;
    }
    if (this.auditTimeoutTimer) {
      clearTimeout(this.auditTimeoutTimer);
      this.auditTimeoutTimer = null;
    }

    // Shutdown runtime only on full service stop
    if (this.auditorRuntime?.isReady()) {
      this.auditorRuntime.shutdown();
    }

    this.eventListenerBound = false;
    this.status = 'stopped';
    this.logger.info('AuditorScheduler stopped');
  }

  /**
   * Trigger an audit run.
   *
   * Checks if an audit is already running, ensures the auditor is ready,
   * sends the audit command, and keeps the runtime alive after completion.
   *
   * @param source - What triggered this audit ('periodic', 'event', 'api')
   * @returns Result indicating whether the audit was triggered
   */
  async trigger(source: AuditTriggerResult['source']): Promise<AuditTriggerResult> {
    const timestamp = new Date().toISOString();

    // Guard: already running
    if (this.status === 'running_audit') {
      this.logger.debug('Audit already running, skipping trigger', { source });
      return { triggered: false, reason: 'Audit already in progress', source, timestamp };
    }

    // Guard: stopped
    if (this.status === 'stopped') {
      return { triggered: false, reason: 'Scheduler is stopped', source, timestamp };
    }

    // Guard: no runtime
    if (!this.auditorRuntime) {
      this.logger.warn('No auditor runtime configured');
      return { triggered: false, reason: 'No auditor runtime configured', source, timestamp };
    }

    this.logger.info('Triggering audit', { source });
    this.status = 'running_audit';
    this.lastAuditStart = Date.now();
    this.auditCount++;

    // Start timeout timer to prevent audit from hanging forever (RL5)
    this.auditTimeoutTimer = setTimeout(() => {
      if (this.status === 'running_audit') {
        this.logger.error('Audit timed out, resetting to idle', {
          source,
          timeoutMs: AUDITOR_SCHEDULER_CONSTANTS.AUDIT_TIMEOUT_MS,
        });
        this.status = 'idle';
      }
    }, AUDITOR_SCHEDULER_CONSTANTS.AUDIT_TIMEOUT_MS);

    try {
      // Ensure auditor is ready (should already be from start(), defensive check)
      if (!this.auditorRuntime.isReady()) {
        await this.initializeAuditorRuntime();
      }

      // Send audit command
      const auditCommand = AUDITOR_SCHEDULER_CONSTANTS.AUDIT_COMMAND;
      this.logger.info('Sending audit command', { command: auditCommand.substring(0, 80) });
      const result = await this.auditorRuntime.handleMessage(auditCommand);

      this.logger.info('Audit completed', {
        source,
        steps: result.steps,
        toolCalls: result.toolCalls.length,
        duration: Date.now() - this.lastAuditStart,
      });

      // Stay idle — do NOT shutdown (always-active mode)
      this.status = 'idle';

      return { triggered: true, source, timestamp };
    } catch (error) {
      const errMsg = formatError(error);
      this.logger.error('Audit failed', { source, error: errMsg });

      // Stay idle — do NOT shutdown on error (always-active mode)
      this.status = 'idle';

      return { triggered: false, reason: `Audit error: ${errMsg}`, source, timestamp };
    } finally {
      if (this.auditTimeoutTimer) {
        clearTimeout(this.auditTimeoutTimer);
        this.auditTimeoutTimer = null;
      }
    }
  }

  /**
   * Handle a user message routed from Slack.
   *
   * Passes the message to the auditor runtime with Slack context
   * so the auditor can reply directly via the reply_slack tool.
   *
   * @param message - User message text (auditor prefix already stripped)
   * @param slackContext - Slack channel and thread identifiers
   * @returns Result indicating whether the message was handled
   */
  async handleUserMessage(
    message: string,
    slackContext: SlackContext,
  ): Promise<AuditTriggerResult> {
    const timestamp = new Date().toISOString();

    if (!this.auditorRuntime) {
      return { triggered: false, reason: 'No auditor runtime configured', source: 'api', timestamp };
    }

    // Ensure runtime is ready (always-active should have it ready)
    if (!this.auditorRuntime.isReady()) {
      await this.initializeAuditorRuntime();
    }

    if (!this.auditorRuntime.isReady()) {
      return { triggered: false, reason: 'Failed to initialize auditor runtime', source: 'api', timestamp };
    }

    // Prefix message with Slack context so auditor can use reply_slack
    const slackPrefix = `[SLACK_CONTEXT:channelId=${slackContext.channelId},threadTs=${slackContext.threadTs}]\n`;

    try {
      this.logger.info('Handling user message via auditor', {
        messageLength: message.length,
        channelId: slackContext.channelId,
      });

      await this.auditorRuntime.handleMessage(slackPrefix + message);
      return { triggered: true, source: 'api', timestamp };
    } catch (error) {
      const errMsg = formatError(error);
      this.logger.error('Auditor user message failed', { error: errMsg });
      return { triggered: false, reason: `Auditor error: ${errMsg}`, source: 'api', timestamp };
    }
  }

  /**
   * Get the current scheduler status and statistics.
   *
   * @returns Status object
   */
  getStatus(): {
    status: AuditorSchedulerStatus;
    auditCount: number;
    lastAuditStart: string | null;
    periodicEnabled: boolean;
    eventListenerBound: boolean;
    runtimeReady: boolean;
  } {
    return {
      status: this.status,
      auditCount: this.auditCount,
      lastAuditStart: this.lastAuditStart
        ? new Date(this.lastAuditStart).toISOString()
        : null,
      periodicEnabled: this.periodicTimer !== null,
      eventListenerBound: this.eventListenerBound,
      runtimeReady: this.auditorRuntime?.isReady() ?? false,
    };
  }

  // ===== Private helpers =====

  /**
   * Initialize the auditor runtime with the auditor role prompt.
   * Called at start() and as defensive fallback in trigger()/handleUserMessage().
   */
  private async initializeAuditorRuntime(): Promise<void> {
    if (!this.auditorRuntime) return;
    try {
      if (!this.auditorRuntime.isReady()) {
        await this.auditorRuntime.initializeInProcess(
          AUDITOR_SCHEDULER_CONSTANTS.AUDITOR_SESSION_NAME,
          undefined,
          'auditor',
        );
        this.logger.info('Auditor runtime initialized (always-active mode)');
      }
    } catch (error) {
      this.logger.error('Failed to initialize auditor runtime', {
        error: formatError(error),
      });
    }
  }

  /**
   * Bind the EventBus listener for L2 event-driven triggers.
   * Listens for agent:inactive and task:failed events with debounce.
   */
  private bindEventBusListener(): void {
    if (!this.eventBusService || this.eventListenerBound) {
      return;
    }

    const triggerEvents = AUDITOR_SCHEDULER_CONSTANTS.TRIGGER_EVENT_TYPES;

    this.eventBusService.on('event_delivered', (payload: { eventType: string }) => {
      if (!triggerEvents.includes(payload.eventType)) {
        return;
      }

      this.logger.debug('Audit-triggering event received, debouncing', {
        eventType: payload.eventType,
      });

      // Debounce: reset timer on each qualifying event
      if (this.eventDebounceTimer) {
        clearTimeout(this.eventDebounceTimer);
      }

      this.eventDebounceTimer = setTimeout(() => {
        this.eventDebounceTimer = null;
        void this.trigger('event');
      }, AUDITOR_SCHEDULER_CONSTANTS.EVENT_DEBOUNCE_MS);
    });

    this.eventListenerBound = true;
    this.logger.debug('EventBus listener bound', { triggerEvents });
  }
}
