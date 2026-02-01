# Task: Create Self-Improvement Workflow Service

## Overview

Create a service that enables the orchestrator to safely modify the AgentMux codebase itself. This includes planning changes, creating backups, validating changes, and rolling back if needed.

## Priority

**High** - Enables self-improvement capability

## Dependencies

- `47-orchestrator-state-types.md` - State types
- `48-orchestrator-state-service.md` - State persistence
- `49-safe-restart-service.md` - Safe restart

## Files to Create

### 1. Create `backend/src/services/orchestrator/self-improvement.service.ts`

```typescript
/**
 * Self-Improvement Service
 *
 * Enables the orchestrator to safely modify the AgentMux codebase,
 * with proper validation, backup, and rollback capabilities.
 *
 * @module services/orchestrator/self-improvement
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import {
  SelfImprovementState,
  PlannedChange,
  FileBackup,
  ValidationCheck,
} from '../../types/orchestrator-state.types.js';
import { getStatePersistenceService } from './state-persistence.service.js';
import { getSafeRestartService } from './safe-restart.service.js';
import { getSlackOrchestratorBridge } from '../slack/slack-orchestrator-bridge.js';

/**
 * Improvement request
 */
export interface ImprovementRequest {
  description: string;
  targetFiles: string[];
  changes: PlannedChange[];
  requiresRestart: boolean;
  skipTests?: boolean;
}

/**
 * Improvement result
 */
export interface ImprovementResult {
  success: boolean;
  taskId: string;
  changesApplied: string[];
  validationPassed: boolean;
  needsRestart: boolean;
  error?: string;
  rollbackPerformed?: boolean;
}

/**
 * Self-improvement service singleton
 */
let selfImprovementInstance: SelfImprovementService | null = null;

/**
 * SelfImprovementService class
 */
export class SelfImprovementService {
  private currentState: SelfImprovementState | null = null;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Plan an improvement task
   *
   * @param request - Improvement request
   * @returns Task ID
   */
  async planImprovement(request: ImprovementRequest): Promise<string> {
    const taskId = `si-${Date.now()}`;

    // Analyze risk level
    const highRiskFiles = request.targetFiles.filter(f =>
      f.includes('index.ts') ||
      f.includes('server.ts') ||
      f.includes('app.ts') ||
      f.includes('package.json')
    );

    if (highRiskFiles.length > 0) {
      console.warn(`[SelfImprovement] High-risk files targeted: ${highRiskFiles.join(', ')}`);
    }

    // Create state
    this.currentState = {
      currentTask: {
        id: taskId,
        description: request.description,
        targetFiles: request.targetFiles,
        plannedChanges: request.changes,
        status: 'planning',
      },
      validationChecks: this.getDefaultValidationChecks(request),
    };

    // Persist state
    const statePersistence = getStatePersistenceService();
    statePersistence.updateSelfImprovement(this.currentState);
    await statePersistence.saveState('self_improvement');

    // Notify via Slack
    await this.notifySlack(
      'Self-Improvement Planned',
      `:wrench: *${request.description}*\n\nTarget files: ${request.targetFiles.length}\nChanges: ${request.changes.length}\nRequires restart: ${request.requiresRestart}`,
      'normal'
    );

    console.log(`[SelfImprovement] Task ${taskId} planned`);
    return taskId;
  }

  /**
   * Execute the planned improvement
   */
  async executeImprovement(): Promise<ImprovementResult> {
    if (!this.currentState?.currentTask) {
      throw new Error('No improvement task planned');
    }

    const task = this.currentState.currentTask;
    const result: ImprovementResult = {
      success: false,
      taskId: task.id,
      changesApplied: [],
      validationPassed: false,
      needsRestart: false,
    };

    try {
      // Step 1: Create backups
      console.log('[SelfImprovement] Creating backups...');
      task.status = 'implementing';
      await this.createBackups();

      // Step 2: Create git commit point
      const gitCommit = await this.createGitCheckpoint();
      if (this.currentState.backup) {
        this.currentState.backup.gitCommit = gitCommit;
      }

      // Update state
      const statePersistence = getStatePersistenceService();
      statePersistence.updateSelfImprovement(this.currentState);
      await statePersistence.saveState('self_improvement');

      // Step 3: Apply changes
      console.log('[SelfImprovement] Applying changes...');
      for (const change of task.plannedChanges) {
        await this.applyChange(change);
        result.changesApplied.push(change.file);
      }

      // Step 4: Run validation
      console.log('[SelfImprovement] Running validation...');
      task.status = 'testing';
      const validationPassed = await this.runValidation();
      result.validationPassed = validationPassed;

      if (!validationPassed) {
        // Rollback
        console.log('[SelfImprovement] Validation failed, rolling back...');
        await this.rollback();
        result.rollbackPerformed = true;
        result.error = 'Validation failed';

        await this.notifySlack(
          'Self-Improvement Failed',
          `:x: *${task.description}*\n\nValidation failed. Changes rolled back.`,
          'high'
        );

        return result;
      }

      // Step 5: Success
      task.status = 'completed';
      result.success = true;

      // Check if restart needed
      const needsRestart = this.checkNeedsRestart(result.changesApplied);
      result.needsRestart = needsRestart;

      await this.notifySlack(
        'Self-Improvement Completed',
        `:white_check_mark: *${task.description}*\n\nChanges applied: ${result.changesApplied.length}\n${needsRestart ? ':warning: Restart required' : 'No restart needed'}`,
        'normal'
      );

      // Schedule restart if needed
      if (needsRestart) {
        console.log('[SelfImprovement] Scheduling restart...');
        const restartService = getSafeRestartService();
        restartService.scheduleRestart({
          reason: `Self-improvement: ${task.description}`,
          delayMs: 10000,
          notifySlack: true,
        });
      }

      return result;

    } catch (error) {
      console.error('[SelfImprovement] Error:', error);
      result.error = (error as Error).message;

      // Attempt rollback
      try {
        await this.rollback();
        result.rollbackPerformed = true;
      } catch (rollbackError) {
        console.error('[SelfImprovement] Rollback failed:', rollbackError);
      }

      await this.notifySlack(
        'Self-Improvement Error',
        `:x: *${task.description}*\n\nError: ${result.error}\nRollback: ${result.rollbackPerformed ? 'Completed' : 'Failed'}`,
        'critical'
      );

      return result;
    }
  }

  /**
   * Create backups of target files
   */
  private async createBackups(): Promise<void> {
    if (!this.currentState?.currentTask) return;

    const backups: FileBackup[] = [];
    const backupId = `backup-${Date.now()}`;

    for (const file of this.currentState.currentTask.targetFiles) {
      const fullPath = path.join(this.projectRoot, file);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const checksum = crypto.createHash('md5').update(content).digest('hex');

        const backupPath = path.join(
          this.projectRoot,
          '.agentmux',
          'self-improvement',
          backupId,
          file
        );

        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, content);

        backups.push({
          path: file,
          originalContent: content,
          backupPath,
          checksum,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, that's OK for new files
      }
    }

    this.currentState.backup = {
      id: backupId,
      createdAt: new Date().toISOString(),
      files: backups,
    };
  }

  /**
   * Create git checkpoint
   */
  private async createGitCheckpoint(): Promise<string | undefined> {
    try {
      const result = await this.runCommand('git', ['rev-parse', 'HEAD']);
      return result.trim();
    } catch {
      console.warn('[SelfImprovement] Could not create git checkpoint');
      return undefined;
    }
  }

  /**
   * Apply a single change
   */
  private async applyChange(change: PlannedChange): Promise<void> {
    const fullPath = path.join(this.projectRoot, change.file);

    switch (change.type) {
      case 'delete':
        await fs.unlink(fullPath);
        break;

      case 'create':
      case 'modify':
        // The actual content should come from the orchestrator's edit
        // This is a placeholder - real implementation would use Edit tool
        console.log(`[SelfImprovement] Would apply change to ${change.file}: ${change.description}`);
        break;
    }
  }

  /**
   * Run validation checks
   */
  private async runValidation(): Promise<boolean> {
    const checks = this.currentState?.validationChecks || [];
    let allPassed = true;

    for (const check of checks) {
      if (!check.required) continue;

      try {
        console.log(`[SelfImprovement] Running check: ${check.name}`);

        switch (check.type) {
          case 'build':
            await this.runCommand('npm', ['run', 'build']);
            break;

          case 'test':
            await this.runCommand('npm', ['run', 'test']);
            break;

          case 'lint':
            await this.runCommand('npm', ['run', 'lint']);
            break;

          case 'custom':
            if (check.command) {
              const [cmd, ...args] = check.command.split(' ');
              await this.runCommand(cmd, args);
            }
            break;
        }

        check.passed = true;
        console.log(`[SelfImprovement] Check passed: ${check.name}`);

      } catch (error) {
        check.passed = false;
        check.output = (error as Error).message;
        allPassed = false;
        console.error(`[SelfImprovement] Check failed: ${check.name}`);
      }
    }

    return allPassed;
  }

  /**
   * Rollback changes
   */
  private async rollback(): Promise<void> {
    if (!this.currentState?.backup) {
      console.warn('[SelfImprovement] No backup to restore from');
      return;
    }

    const backup = this.currentState.backup;

    // Try git reset first
    if (backup.gitCommit) {
      try {
        await this.runCommand('git', ['reset', '--hard', backup.gitCommit]);
        console.log(`[SelfImprovement] Git reset to ${backup.gitCommit}`);
        return;
      } catch {
        console.warn('[SelfImprovement] Git reset failed, using file backups');
      }
    }

    // Restore from file backups
    for (const fileBackup of backup.files) {
      const fullPath = path.join(this.projectRoot, fileBackup.path);

      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileBackup.originalContent);
        console.log(`[SelfImprovement] Restored: ${fileBackup.path}`);
      } catch (error) {
        console.error(`[SelfImprovement] Failed to restore ${fileBackup.path}:`, error);
      }
    }

    if (this.currentState.currentTask) {
      this.currentState.currentTask.status = 'rolled_back';
    }
  }

  /**
   * Check if restart is needed
   */
  private checkNeedsRestart(changedFiles: string[]): boolean {
    const restartTriggers = [
      'backend/src/index.ts',
      'backend/src/server.ts',
      'backend/src/app.ts',
      'package.json',
      'tsconfig.json',
      /backend\/src\/services\/.*\.ts$/,
      /backend\/src\/controllers\/.*\.ts$/,
    ];

    for (const file of changedFiles) {
      for (const trigger of restartTriggers) {
        if (typeof trigger === 'string') {
          if (file === trigger) return true;
        } else {
          if (trigger.test(file)) return true;
        }
      }
    }

    return false;
  }

  /**
   * Get default validation checks
   */
  private getDefaultValidationChecks(request: ImprovementRequest): ValidationCheck[] {
    const checks: ValidationCheck[] = [
      {
        name: 'TypeScript Build',
        type: 'build',
        required: true,
      },
      {
        name: 'Linting',
        type: 'lint',
        required: true,
      },
    ];

    if (!request.skipTests) {
      checks.push({
        name: 'Unit Tests',
        type: 'test',
        required: true,
      });
    }

    return checks;
  }

  /**
   * Run a shell command
   */
  private runCommand(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed (${code}): ${stderr || stdout}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Notify via Slack
   */
  private async notifySlack(
    title: string,
    message: string,
    urgency: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<void> {
    try {
      const slackBridge = getSlackOrchestratorBridge();
      await slackBridge.sendNotification({
        type: 'alert',
        title,
        message,
        urgency,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }
  }

  /**
   * Get current state
   */
  getState(): SelfImprovementState | null {
    return this.currentState;
  }

  /**
   * Cancel current improvement
   */
  async cancelImprovement(): Promise<void> {
    if (this.currentState?.currentTask) {
      if (this.currentState.currentTask.status === 'implementing') {
        await this.rollback();
      }
      this.currentState = null;
    }
  }
}

/**
 * Get singleton instance
 */
export function getSelfImprovementService(): SelfImprovementService {
  if (!selfImprovementInstance) {
    selfImprovementInstance = new SelfImprovementService();
  }
  return selfImprovementInstance;
}

/**
 * Reset instance (for testing)
 */
export function resetSelfImprovementService(): void {
  selfImprovementInstance = null;
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

export {
  SelfImprovementService,
  getSelfImprovementService,
  resetSelfImprovementService,
} from './self-improvement.service.js';
```

### 3. Create `backend/src/services/orchestrator/self-improvement.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  SelfImprovementService,
  getSelfImprovementService,
  resetSelfImprovementService,
  ImprovementRequest,
} from './self-improvement.service.js';

// Mock dependencies
vi.mock('./state-persistence.service.js', () => ({
  getStatePersistenceService: vi.fn(() => ({
    updateSelfImprovement: vi.fn(),
    saveState: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('./safe-restart.service.js', () => ({
  getSafeRestartService: vi.fn(() => ({
    scheduleRestart: vi.fn(),
  })),
}));

vi.mock('../slack/slack-orchestrator-bridge.js', () => ({
  getSlackOrchestratorBridge: vi.fn(() => ({
    sendNotification: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('SelfImprovementService', () => {
  let testDir: string;
  let service: SelfImprovementService;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `si-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    service = new SelfImprovementService(testDir);
    resetSelfImprovementService();
  });

  afterEach(async () => {
    resetSelfImprovementService();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('getSelfImprovementService', () => {
    it('should return singleton instance', () => {
      const service1 = getSelfImprovementService();
      const service2 = getSelfImprovementService();
      expect(service1).toBe(service2);
    });
  });

  describe('planImprovement', () => {
    it('should plan improvement task', async () => {
      const request: ImprovementRequest = {
        description: 'Fix bug in login',
        targetFiles: ['src/auth.ts'],
        changes: [
          {
            file: 'src/auth.ts',
            type: 'modify',
            description: 'Fix validation',
            risk: 'low',
          },
        ],
        requiresRestart: false,
      };

      const taskId = await service.planImprovement(request);

      expect(taskId).toMatch(/^si-\d+$/);

      const state = service.getState();
      expect(state?.currentTask?.description).toBe('Fix bug in login');
      expect(state?.currentTask?.status).toBe('planning');
    });

    it('should identify high-risk files', async () => {
      const warnSpy = vi.spyOn(console, 'warn');

      const request: ImprovementRequest = {
        description: 'Update server',
        targetFiles: ['backend/src/index.ts'],
        changes: [],
        requiresRestart: true,
      };

      await service.planImprovement(request);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('High-risk files')
      );
    });
  });

  describe('cancelImprovement', () => {
    it('should cancel and clear state', async () => {
      const request: ImprovementRequest = {
        description: 'Test',
        targetFiles: ['test.ts'],
        changes: [],
        requiresRestart: false,
      };

      await service.planImprovement(request);
      expect(service.getState()).not.toBeNull();

      await service.cancelImprovement();
      expect(service.getState()).toBeNull();
    });
  });
});
```

## MCP Tool Integration

Add MCP tool for orchestrator to use:

```typescript
// In MCP server, add tool:
{
  name: 'self_improve',
  description: 'Plan and execute improvements to the AgentMux codebase',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['plan', 'execute', 'status', 'cancel'],
        description: 'Action to perform',
      },
      description: {
        type: 'string',
        description: 'Description of the improvement (for plan)',
      },
      targetFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to modify (for plan)',
      },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            type: { type: 'string', enum: ['create', 'modify', 'delete'] },
            description: { type: 'string' },
          },
        },
        description: 'Planned changes (for plan)',
      },
    },
    required: ['action'],
  },
}
```

## Acceptance Criteria

- [ ] Improvement planning creates backups
- [ ] Git checkpoint created before changes
- [ ] Validation runs build, lint, and tests
- [ ] Rollback restores from backups
- [ ] Git reset used when available
- [ ] Slack notifications at each step
- [ ] Restart scheduled when needed
- [ ] State persisted throughout process
- [ ] High-risk files identified
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests with mocked dependencies
- Backup creation tests
- Rollback tests
- Validation check tests

## Estimated Effort

60 minutes

## Notes

- Orchestrator uses this via MCP tool
- Multiple safety layers prevent broken state
- Slack keeps user informed of progress
- Automatic restart only after validation passes
