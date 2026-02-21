/**
 * Safe Restart Service
 *
 * Manages graceful shutdown and restart of Crewly,
 * preserving state and enabling seamless recovery.
 *
 * @module services/orchestrator/safe-restart
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getStatePersistenceService } from './state-persistence.service.js';
// Lazy-imported to break circular dependency:
// slack-orchestrator-bridge → orchestrator/index → safe-restart → slack-orchestrator-bridge
let _getSlackOrchestratorBridge: typeof import('../slack/slack-orchestrator-bridge.js').getSlackOrchestratorBridge | null = null;
async function getSlackBridgeLazy() {
  if (!_getSlackOrchestratorBridge) {
    const mod = await import('../slack/slack-orchestrator-bridge.js');
    _getSlackOrchestratorBridge = mod.getSlackOrchestratorBridge;
  }
  return _getSlackOrchestratorBridge();
}
import { ResumeInstructions } from '../../types/orchestrator-state.types.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

/**
 * Restart configuration
 */
export interface RestartConfig {
  /** Reason for restart */
  reason: string;
  /** Delay before restart in ms */
  delayMs?: number;
  /** Skip state save (emergency restart) */
  skipStateSave?: boolean;
  /** Command to run after restart */
  postRestartCommand?: string;
  /** Notify via Slack */
  notifySlack?: boolean;
}

/**
 * Restart status
 */
export interface RestartStatus {
  /** Whether a restart is in progress */
  isRestarting: boolean;
  /** When restart was scheduled */
  restartScheduledAt?: string;
  /** Why restart was scheduled */
  restartReason?: string;
  /** Countdown until restart */
  countdown?: number;
}

/**
 * Restart marker file content
 */
interface RestartMarker {
  /** Restart reason */
  reason: string;
  /** Timestamp */
  timestamp: string;
  /** Command to run after restart */
  postRestartCommand?: string;
}

/**
 * Safe restart service singleton
 */
let safeRestartInstance: SafeRestartService | null = null;

/**
 * SafeRestartService class
 *
 * Handles graceful shutdown, state preservation, and process restart.
 * Integrates with state persistence and Slack for notifications.
 *
 * @example
 * ```typescript
 * const service = getSafeRestartService();
 *
 * // Handle startup and resume
 * const instructions = await service.handleStartup();
 * if (instructions) {
 *   // Resume tasks and conversations
 * }
 *
 * // Schedule restart for self-improvement
 * service.scheduleRestart({
 *   reason: 'Applying code changes',
 *   delayMs: 5000,
 *   notifySlack: true,
 * });
 * ```
 */
export class SafeRestartService {
  private isRestartingFlag: boolean = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private scheduledRestartReason: string | null = null;
  private scheduledRestartTime: Date | null = null;
  private shutdownCallbacks: Array<() => Promise<void>> = [];
  private startupCallbacks: Array<
    (instructions: ResumeInstructions) => Promise<void>
  > = [];
  private signalHandlersRegistered: boolean = false;
  private logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('SafeRestart');

  /**
   * Create a new SafeRestartService
   *
   * Note: Does not automatically register signal handlers.
   * Call registerProcessHandlers() explicitly to enable signal handling.
   */
  constructor() {
    // Handlers are registered separately to allow testing
  }

  /**
   * Register process signal handlers
   *
   * Sets up handlers for SIGTERM, SIGINT, and error events.
   * Should be called during application initialization.
   */
  registerProcessHandlers(): void {
    if (this.signalHandlersRegistered) return;

    // Handle graceful shutdown signals
    const shutdownHandler = async (signal: string): Promise<void> => {
      this.logger.info('Received signal, initiating graceful shutdown...', { signal });
      await this.gracefulShutdown(`signal:${signal}`);
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception', { error: error instanceof Error ? error.message : String(error) });
      await this.emergencyShutdown(error.message);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      this.logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
      // Don't exit, just log and try to recover
    });

    this.signalHandlersRegistered = true;
    this.logger.info('Process handlers registered');
  }

  /**
   * Register a callback to run before shutdown
   *
   * @param callback - Async function to run during shutdown
   */
  onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Register a callback to run after startup
   *
   * @param callback - Async function to run with resume instructions
   */
  onStartup(
    callback: (instructions: ResumeInstructions) => Promise<void>
  ): void {
    this.startupCallbacks.push(callback);
  }

  /**
   * Handle application startup
   *
   * Initializes state persistence, loads previous state, and runs
   * startup callbacks with resume instructions.
   *
   * @returns Resume instructions if restarting, null for fresh start
   */
  async handleStartup(): Promise<ResumeInstructions | null> {
    const statePersistence = getStatePersistenceService();
    const previousState = await statePersistence.initialize();

    if (!previousState) {
      this.logger.info('Fresh start - no previous state');
      return null;
    }

    // Generate resume instructions
    const instructions =
      statePersistence.generateResumeInstructions(previousState);

    // Notify via Slack if available
    try {
      const slackBridge = await getSlackBridgeLazy();
      for (const notification of instructions.notifications) {
        if (notification.type === 'slack') {
          await slackBridge.sendNotification({
            type: 'alert',
            title: 'Crewly Restarted',
            message: notification.message,
            urgency: 'normal',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch {
      // Slack not available, continue without notification
      this.logger.info('Slack notification skipped (not connected)');
    }

    // Run startup callbacks
    for (const callback of this.startupCallbacks) {
      try {
        await callback(instructions);
      } catch (error) {
        this.logger.error('Startup callback error', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return instructions;
  }

  /**
   * Initiate graceful shutdown
   *
   * Runs all shutdown callbacks and saves state before shutdown.
   *
   * @param reason - Reason for shutdown
   */
  async gracefulShutdown(reason: string): Promise<void> {
    if (this.isRestartingFlag) return;
    this.isRestartingFlag = true;

    this.logger.info('Graceful shutdown', { reason });

    // Run shutdown callbacks
    for (const callback of this.shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        this.logger.error('Shutdown callback error', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Save state
    try {
      const statePersistence = getStatePersistenceService();
      await statePersistence.prepareForShutdown();
    } catch (error) {
      this.logger.error('Failed to save state', { error: error instanceof Error ? error.message : String(error) });
    }

    // Notify Slack
    try {
      const slackBridge = await getSlackBridgeLazy();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'Crewly Shutting Down',
        message: `Reason: ${reason}. State has been saved and will resume on restart.`,
        urgency: 'normal',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }

    this.logger.info('Shutdown complete');
  }

  /**
   * Emergency shutdown (minimal cleanup)
   *
   * Attempts to save state with minimal processing for error scenarios.
   *
   * @param reason - Reason for emergency shutdown
   */
  async emergencyShutdown(reason: string): Promise<void> {
    this.logger.error('Emergency shutdown', { reason });

    try {
      const statePersistence = getStatePersistenceService();
      await statePersistence.saveState('error_recovery');
    } catch (error) {
      this.logger.error('Failed to save state in emergency', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Schedule a restart
   *
   * Schedules a restart after the specified delay.
   *
   * @param config - Restart configuration
   */
  scheduleRestart(config: RestartConfig): void {
    const delayMs = config.delayMs ?? 5000;

    this.logger.info('Restart scheduled', { delayMs, reason: config.reason });

    this.scheduledRestartReason = config.reason;
    this.scheduledRestartTime = new Date(Date.now() + delayMs);

    // Notify Slack
    if (config.notifySlack) {
      this.notifyRestartScheduled(config.reason, delayMs);
    }

    this.restartTimer = setTimeout(async () => {
      await this.executeRestart(config);
    }, delayMs);
  }

  /**
   * Cancel scheduled restart
   *
   * @returns True if a restart was cancelled, false if none scheduled
   */
  cancelScheduledRestart(): boolean {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
      this.scheduledRestartReason = null;
      this.scheduledRestartTime = null;
      this.logger.info('Scheduled restart cancelled');
      return true;
    }
    return false;
  }

  /**
   * Execute restart
   *
   * @param config - Restart configuration
   */
  private async executeRestart(config: RestartConfig): Promise<void> {
    if (!config.skipStateSave) {
      await this.gracefulShutdown(config.reason);
    }

    this.logger.info('Restarting process...');

    // Write restart marker file
    const markerPath = path.join(process.cwd(), '.restart-marker');
    const marker: RestartMarker = {
      reason: config.reason,
      timestamp: new Date().toISOString(),
      postRestartCommand: config.postRestartCommand,
    };
    await fs.writeFile(markerPath, JSON.stringify(marker));

    // Spawn new process
    const args = process.argv.slice(1);
    const newProcess = spawn(process.argv[0], args, {
      detached: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        CREWLY_RESTARTED: 'true',
        CREWLY_RESTART_REASON: config.reason,
      },
    });

    newProcess.unref();

    // Exit current process
    process.exit(0);
  }

  /**
   * Notify about scheduled restart
   *
   * @param reason - Restart reason
   * @param delayMs - Delay in milliseconds
   */
  private async notifyRestartScheduled(
    reason: string,
    delayMs: number
  ): Promise<void> {
    try {
      const slackBridge = await getSlackBridgeLazy();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'Crewly Restart Scheduled',
        message: `:hourglass: Restarting in ${Math.round(
          delayMs / 1000
        )} seconds\nReason: ${reason}`,
        urgency: 'normal',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }
  }

  /**
   * Get restart status
   *
   * @returns Current restart status
   */
  getStatus(): RestartStatus {
    const status: RestartStatus = {
      isRestarting: this.isRestartingFlag,
    };

    if (this.scheduledRestartTime) {
      status.restartScheduledAt = this.scheduledRestartTime.toISOString();
      status.restartReason = this.scheduledRestartReason ?? undefined;
      status.countdown = Math.max(
        0,
        Math.round((this.scheduledRestartTime.getTime() - Date.now()) / 1000)
      );
    }

    return status;
  }

  /**
   * Check if this is a restart (vs fresh start)
   *
   * @returns True if this process was started after a restart
   */
  isRestart(): boolean {
    return process.env.CREWLY_RESTARTED === 'true';
  }

  /**
   * Get restart reason (if restarted)
   *
   * @returns Restart reason or undefined for fresh start
   */
  getRestartReason(): string | undefined {
    return process.env.CREWLY_RESTART_REASON;
  }

  /**
   * Check for and execute post-restart command
   *
   * Reads the restart marker file and executes any post-restart command.
   */
  async checkPostRestartCommand(): Promise<void> {
    const markerPath = path.join(process.cwd(), '.restart-marker');

    try {
      const data = await fs.readFile(markerPath, 'utf-8');
      const marker = JSON.parse(data) as RestartMarker;

      // Delete marker
      await fs.unlink(markerPath);

      if (marker.postRestartCommand) {
        this.logger.info('Post-restart command found', { command: marker.postRestartCommand });
        // Note: Actual command execution would be implemented here
        // For safety, we just log for now
      }
    } catch {
      // No marker file, normal start
    }
  }

  /**
   * Clear shutdown callbacks (for testing)
   */
  clearShutdownCallbacks(): void {
    this.shutdownCallbacks = [];
  }

  /**
   * Clear startup callbacks (for testing)
   */
  clearStartupCallbacks(): void {
    this.startupCallbacks = [];
  }
}

/**
 * Get singleton instance
 *
 * @returns SafeRestartService instance
 */
export function getSafeRestartService(): SafeRestartService {
  if (!safeRestartInstance) {
    safeRestartInstance = new SafeRestartService();
  }
  return safeRestartInstance;
}

/**
 * Reset instance (for testing)
 */
export function resetSafeRestartService(): void {
  if (safeRestartInstance) {
    safeRestartInstance.cancelScheduledRestart();
    safeRestartInstance.clearShutdownCallbacks();
    safeRestartInstance.clearStartupCallbacks();
  }
  safeRestartInstance = null;
}
