# Task: Create Safe Restart Service

## Overview

Create a service that handles graceful shutdown and restart of AgentMux, ensuring state is preserved and operations can resume after restart. This is critical for self-improvement scenarios where code changes require a restart.

## Priority

**High** - Enables safe self-improvement

## Dependencies

- `47-orchestrator-state-types.md` - State types
- `48-orchestrator-state-service.md` - State persistence

## Files to Create

### 1. Create `backend/src/services/orchestrator/safe-restart.service.ts`

```typescript
/**
 * Safe Restart Service
 *
 * Manages graceful shutdown and restart of AgentMux,
 * preserving state and enabling seamless recovery.
 *
 * @module services/orchestrator/safe-restart
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getStatePersistenceService } from './state-persistence.service.js';
import { getSlackOrchestratorBridge } from '../slack/slack-orchestrator-bridge.js';
import { ResumeInstructions } from '../../types/orchestrator-state.types.js';

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
  isRestarting: boolean;
  restartScheduledAt?: string;
  restartReason?: string;
  countdown?: number;
}

/**
 * Safe restart service singleton
 */
let safeRestartInstance: SafeRestartService | null = null;

/**
 * SafeRestartService class
 */
export class SafeRestartService {
  private isRestarting: boolean = false;
  private restartTimer: NodeJS.Timeout | null = null;
  private shutdownCallbacks: Array<() => Promise<void>> = [];
  private startupCallbacks: Array<(instructions: ResumeInstructions) => Promise<void>> = [];

  constructor() {
    // Register process handlers
    this.registerProcessHandlers();
  }

  /**
   * Register process signal handlers
   */
  private registerProcessHandlers(): void {
    // Handle graceful shutdown signals
    const shutdownHandler = async (signal: string) => {
      console.log(`[SafeRestart] Received ${signal}, initiating graceful shutdown...`);
      await this.gracefulShutdown(`signal:${signal}`);
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      console.error('[SafeRestart] Uncaught exception:', error);
      await this.emergencyShutdown(error.message);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('[SafeRestart] Unhandled rejection:', reason);
      // Don't exit, just log and try to recover
    });
  }

  /**
   * Register a callback to run before shutdown
   */
  onShutdown(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  /**
   * Register a callback to run after startup
   */
  onStartup(callback: (instructions: ResumeInstructions) => Promise<void>): void {
    this.startupCallbacks.push(callback);
  }

  /**
   * Handle application startup
   */
  async handleStartup(): Promise<ResumeInstructions | null> {
    const statePersistence = getStatePersistenceService();
    const previousState = await statePersistence.initialize();

    if (!previousState) {
      console.log('[SafeRestart] Fresh start - no previous state');
      return null;
    }

    // Generate resume instructions
    const instructions = statePersistence.generateResumeInstructions(previousState);

    // Notify via Slack if available
    try {
      const slackBridge = getSlackOrchestratorBridge();
      for (const notification of instructions.notifications) {
        if (notification.type === 'slack') {
          await slackBridge.sendNotification({
            type: 'alert',
            title: 'AgentMux Restarted',
            message: notification.message,
            urgency: 'normal',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      // Slack not available, continue without notification
      console.log('[SafeRestart] Slack notification skipped (not connected)');
    }

    // Run startup callbacks
    for (const callback of this.startupCallbacks) {
      try {
        await callback(instructions);
      } catch (error) {
        console.error('[SafeRestart] Startup callback error:', error);
      }
    }

    return instructions;
  }

  /**
   * Initiate graceful shutdown
   */
  async gracefulShutdown(reason: string): Promise<void> {
    if (this.isRestarting) return;
    this.isRestarting = true;

    console.log(`[SafeRestart] Graceful shutdown: ${reason}`);

    // Run shutdown callbacks
    for (const callback of this.shutdownCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.error('[SafeRestart] Shutdown callback error:', error);
      }
    }

    // Save state
    const statePersistence = getStatePersistenceService();
    await statePersistence.prepareForShutdown();

    // Notify Slack
    try {
      const slackBridge = getSlackOrchestratorBridge();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'AgentMux Shutting Down',
        message: `Reason: ${reason}. State has been saved and will resume on restart.`,
        urgency: 'normal',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }

    console.log('[SafeRestart] Shutdown complete');
  }

  /**
   * Emergency shutdown (minimal cleanup)
   */
  async emergencyShutdown(reason: string): Promise<void> {
    console.error(`[SafeRestart] Emergency shutdown: ${reason}`);

    try {
      const statePersistence = getStatePersistenceService();
      await statePersistence.saveState('error_recovery');
    } catch (error) {
      console.error('[SafeRestart] Failed to save state in emergency:', error);
    }
  }

  /**
   * Schedule a restart
   */
  scheduleRestart(config: RestartConfig): void {
    const delayMs = config.delayMs || 5000;

    console.log(`[SafeRestart] Restart scheduled in ${delayMs}ms: ${config.reason}`);

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
   */
  cancelScheduledRestart(): boolean {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
      console.log('[SafeRestart] Scheduled restart cancelled');
      return true;
    }
    return false;
  }

  /**
   * Execute restart
   */
  private async executeRestart(config: RestartConfig): Promise<void> {
    if (!config.skipStateSave) {
      await this.gracefulShutdown(config.reason);
    }

    console.log('[SafeRestart] Restarting process...');

    // Write restart marker file
    const markerPath = path.join(process.cwd(), '.restart-marker');
    await fs.writeFile(markerPath, JSON.stringify({
      reason: config.reason,
      timestamp: new Date().toISOString(),
      postRestartCommand: config.postRestartCommand,
    }));

    // Spawn new process
    const args = process.argv.slice(1);
    const newProcess = spawn(process.argv[0], args, {
      detached: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        AGENTMUX_RESTARTED: 'true',
        AGENTMUX_RESTART_REASON: config.reason,
      },
    });

    newProcess.unref();

    // Exit current process
    process.exit(0);
  }

  /**
   * Notify about scheduled restart
   */
  private async notifyRestartScheduled(reason: string, delayMs: number): Promise<void> {
    try {
      const slackBridge = getSlackOrchestratorBridge();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'AgentMux Restart Scheduled',
        message: `:hourglass: Restarting in ${Math.round(delayMs / 1000)} seconds\nReason: ${reason}`,
        urgency: 'normal',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }
  }

  /**
   * Get restart status
   */
  getStatus(): RestartStatus {
    return {
      isRestarting: this.isRestarting,
      restartScheduledAt: this.restartTimer ? new Date().toISOString() : undefined,
    };
  }

  /**
   * Check if this is a restart (vs fresh start)
   */
  isRestart(): boolean {
    return process.env.AGENTMUX_RESTARTED === 'true';
  }

  /**
   * Get restart reason (if restarted)
   */
  getRestartReason(): string | undefined {
    return process.env.AGENTMUX_RESTART_REASON;
  }

  /**
   * Check for and execute post-restart command
   */
  async checkPostRestartCommand(): Promise<void> {
    const markerPath = path.join(process.cwd(), '.restart-marker');

    try {
      const data = await fs.readFile(markerPath, 'utf-8');
      const marker = JSON.parse(data);

      // Delete marker
      await fs.unlink(markerPath);

      if (marker.postRestartCommand) {
        console.log(`[SafeRestart] Executing post-restart command: ${marker.postRestartCommand}`);
        // Execute command (could spawn or use exec)
      }
    } catch {
      // No marker file, normal start
    }
  }
}

/**
 * Get singleton instance
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
  safeRestartInstance = null;
}
```

### 2. Update `backend/src/services/orchestrator/index.ts`

```typescript
export {
  StatePersistenceService,
  getStatePersistenceService,
  resetStatePersistenceService,
} from './state-persistence.service.js';

export {
  SafeRestartService,
  getSafeRestartService,
  resetSafeRestartService,
} from './safe-restart.service.js';
```

### 3. Create `backend/src/services/orchestrator/safe-restart.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SafeRestartService,
  getSafeRestartService,
  resetSafeRestartService,
} from './safe-restart.service.js';

// Mock dependencies
vi.mock('./state-persistence.service.js', () => ({
  getStatePersistenceService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(null),
    generateResumeInstructions: vi.fn(() => ({
      resumeOrder: [],
      conversationsToResume: [],
      tasksToResume: [],
      notifications: [],
    })),
    prepareForShutdown: vi.fn().mockResolvedValue(undefined),
    saveState: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../slack/slack-orchestrator-bridge.js', () => ({
  getSlackOrchestratorBridge: vi.fn(() => ({
    sendNotification: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('SafeRestartService', () => {
  beforeEach(() => {
    resetSafeRestartService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetSafeRestartService();
  });

  describe('getSafeRestartService', () => {
    it('should return singleton instance', () => {
      const service1 = getSafeRestartService();
      const service2 = getSafeRestartService();
      expect(service1).toBe(service2);
    });
  });

  describe('handleStartup', () => {
    it('should return null on fresh start', async () => {
      const service = getSafeRestartService();
      const instructions = await service.handleStartup();
      expect(instructions).toBeNull();
    });
  });

  describe('onShutdown and onStartup', () => {
    it('should register shutdown callbacks', () => {
      const service = getSafeRestartService();
      const callback = vi.fn().mockResolvedValue(undefined);

      service.onShutdown(callback);
      // Callback should be registered without error
    });

    it('should register startup callbacks', () => {
      const service = getSafeRestartService();
      const callback = vi.fn().mockResolvedValue(undefined);

      service.onStartup(callback);
      // Callback should be registered without error
    });
  });

  describe('scheduleRestart and cancelScheduledRestart', () => {
    it('should schedule and cancel restart', () => {
      const service = getSafeRestartService();

      service.scheduleRestart({
        reason: 'test',
        delayMs: 10000,
        notifySlack: false,
      });

      const status = service.getStatus();
      expect(status.isRestarting).toBe(false);

      const cancelled = service.cancelScheduledRestart();
      expect(cancelled).toBe(true);
    });

    it('should return false when no restart scheduled', () => {
      const service = getSafeRestartService();
      const cancelled = service.cancelScheduledRestart();
      expect(cancelled).toBe(false);
    });
  });

  describe('isRestart and getRestartReason', () => {
    it('should detect fresh start', () => {
      const service = getSafeRestartService();
      expect(service.isRestart()).toBe(false);
      expect(service.getRestartReason()).toBeUndefined();
    });

    it('should detect restart from environment', () => {
      process.env.AGENTMUX_RESTARTED = 'true';
      process.env.AGENTMUX_RESTART_REASON = 'test-reason';

      const service = new SafeRestartService();

      expect(service.isRestart()).toBe(true);
      expect(service.getRestartReason()).toBe('test-reason');

      delete process.env.AGENTMUX_RESTARTED;
      delete process.env.AGENTMUX_RESTART_REASON;
    });
  });
});
```

## Acceptance Criteria

- [ ] Service handles SIGTERM/SIGINT gracefully
- [ ] State saved before shutdown
- [ ] Slack notified of shutdown/restart
- [ ] Scheduled restart with delay works
- [ ] Restart can be cancelled
- [ ] New process spawned on restart
- [ ] Resume instructions generated on startup
- [ ] Environment variables pass restart info
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests with mocked dependencies
- Signal handling tests
- Restart scheduling tests
- Environment variable tests

## Estimated Effort

30 minutes

## Notes

- Detached spawn ensures new process survives old one
- Marker file passes info between restarts
- Slack notifications keep user informed
- Emergency shutdown minimizes data loss
