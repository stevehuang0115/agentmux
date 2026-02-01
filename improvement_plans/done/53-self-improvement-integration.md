# Task: Integrate Self-Improvement with Marker System

## Overview

Update the existing SelfImprovementService to use the new marker system, ensuring state is persisted before any file changes are made. This connects the planning/execution phase with the startup validation phase.

## Priority

**Critical** - Connects the two halves of self-improvement

## Dependencies

- `50-self-improvement-service.md` - Base service
- `51-self-improvement-marker.md` - Marker system
- `52-self-improvement-startup-hook.md` - Startup validation

## Files to Modify

### 1. Update `backend/src/services/orchestrator/self-improvement.service.ts`

Key changes:
1. Use marker service instead of internal state
2. Write marker BEFORE making any file changes
3. Let hot-reload happen naturally
4. Don't run validation inline (startup hook does this)

```typescript
/**
 * Self-Improvement Service (Updated)
 *
 * Now uses the marker system to persist state across hot-reload restarts.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import {
  getImprovementMarkerService,
  ImprovementMarker,
  FileBackupRecord,
} from './improvement-marker.service.js';
import { getSlackOrchestratorBridge } from '../slack/slack-orchestrator-bridge.js';

export interface ImprovementRequest {
  description: string;
  targetFiles: string[];
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    description: string;
    content?: string;  // New content for create/modify
  }>;
  slackContext?: {
    channelId: string;
    threadTs: string;
    userId: string;
  };
}

export interface ImprovementPlan {
  id: string;
  description: string;
  targetFiles: string[];
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    description: string;
  }>;
  riskLevel: 'low' | 'medium' | 'high';
  requiresRestart: boolean;
}

let selfImprovementInstance: SelfImprovementService | null = null;

export class SelfImprovementService {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Plan an improvement (creates marker in 'planning' phase)
   *
   * @returns ImprovementPlan for review before execution
   */
  async planImprovement(request: ImprovementRequest): Promise<ImprovementPlan> {
    const markerService = getImprovementMarkerService();
    await markerService.initialize();

    // Check for existing pending improvement
    const existing = await markerService.getPendingImprovement();
    if (existing) {
      throw new Error(
        `Another improvement is already pending: ${existing.id} (${existing.description})`
      );
    }

    const taskId = `si-${Date.now()}`;

    // Analyze risk level
    const riskLevel = this.analyzeRisk(request.targetFiles);
    const requiresRestart = this.checkRequiresRestart(request.targetFiles);

    // Create marker
    await markerService.createMarker(
      taskId,
      request.description,
      request.targetFiles,
      request.slackContext
    );

    // Notify via Slack
    await this.notifySlack(
      `:wrench: *Self-improvement planned:* ${request.description}\n` +
      `Files: ${request.targetFiles.length}\n` +
      `Risk: ${riskLevel}\n` +
      `Requires restart: ${requiresRestart}`,
      'normal'
    );

    return {
      id: taskId,
      description: request.description,
      targetFiles: request.targetFiles,
      changes: request.changes.map(c => ({
        file: c.file,
        type: c.type,
        description: c.description,
      })),
      riskLevel,
      requiresRestart,
    };
  }

  /**
   * Execute the planned improvement
   *
   * IMPORTANT: This method:
   * 1. Creates backups
   * 2. Writes marker with backup info
   * 3. Applies changes (triggers hot-reload)
   * 4. Process gets killed by hot-reload
   * 5. Startup hook handles validation
   */
  async executeImprovement(
    request: ImprovementRequest
  ): Promise<{ started: boolean; message: string }> {
    const markerService = getImprovementMarkerService();

    // Get the pending marker
    const marker = await markerService.getPendingImprovement();
    if (!marker) {
      throw new Error('No improvement planned. Call planImprovement first.');
    }

    if (marker.phase !== 'planning') {
      throw new Error(`Cannot execute: improvement is in '${marker.phase}' phase`);
    }

    try {
      // Step 1: Create git checkpoint
      console.log('[SelfImprovement] Creating git checkpoint...');
      const gitInfo = await this.createGitCheckpoint();

      // Step 2: Create file backups
      console.log('[SelfImprovement] Creating file backups...');
      const backups = await this.createFileBackups(request.targetFiles);

      // Step 3: Record backup in marker (CRITICAL: do this before changes)
      await markerService.recordBackup(
        gitInfo.commit,
        gitInfo.branch,
        backups
      );

      // Notify that we're about to make changes
      await this.notifySlack(
        `:hammer: *Starting self-improvement changes...*\n` +
        `Backup created: ${gitInfo.commit?.substring(0, 7) || 'file backups'}\n` +
        `Files to modify: ${request.changes.length}\n\n` +
        `:warning: Hot-reload will restart the process. Validation will run automatically.`,
        'normal'
      );

      // Step 4: Apply changes (this will trigger hot-reload!)
      console.log('[SelfImprovement] Applying changes...');
      const appliedChanges = await this.applyChanges(request.changes);

      // Step 5: Record that changes were applied
      await markerService.recordChangesApplied(appliedChanges);

      // At this point, hot-reload will likely kill us.
      // If we survive (somehow), we could run validation here,
      // but the startup hook will handle it anyway.

      return {
        started: true,
        message: 'Changes applied. Hot-reload will restart the process. ' +
                 'Validation will run automatically on startup.',
      };

    } catch (error) {
      console.error('[SelfImprovement] Error during execution:', error);

      await markerService.recordError(
        (error as Error).message,
        (error as Error).stack
      );

      await this.notifySlack(
        `:x: *Self-improvement failed:* ${(error as Error).message}`,
        'critical'
      );

      throw error;
    }
  }

  /**
   * Cancel a planned improvement
   */
  async cancelImprovement(): Promise<void> {
    const markerService = getImprovementMarkerService();
    const marker = await markerService.getPendingImprovement();

    if (!marker) {
      return; // Nothing to cancel
    }

    if (marker.phase !== 'planning') {
      throw new Error(
        `Cannot cancel: improvement is in '${marker.phase}' phase. ` +
        `Rollback may be needed.`
      );
    }

    await markerService.deleteMarker();

    await this.notifySlack(
      `:no_entry: Self-improvement cancelled: ${marker.description}`,
      'normal'
    );
  }

  /**
   * Get current improvement status
   */
  async getStatus(): Promise<ImprovementMarker | null> {
    const markerService = getImprovementMarkerService();
    return await markerService.getPendingImprovement();
  }

  /**
   * Get improvement history
   */
  async getHistory(limit: number = 10): Promise<ImprovementMarker[]> {
    const markerService = getImprovementMarkerService();
    return await markerService.getHistory(limit);
  }

  /**
   * Create git checkpoint
   */
  private async createGitCheckpoint(): Promise<{ commit?: string; branch?: string }> {
    try {
      const commit = (await this.runCommand('git', ['rev-parse', 'HEAD'])).trim();
      const branch = (await this.runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      return { commit, branch };
    } catch {
      console.warn('[SelfImprovement] Git checkpoint failed, using file backups only');
      return {};
    }
  }

  /**
   * Create file backups
   */
  private async createFileBackups(files: string[]): Promise<FileBackupRecord[]> {
    const backups: FileBackupRecord[] = [];
    const backupDir = path.join(
      this.projectRoot,
      '.agentmux',
      'self-improvement',
      'backups',
      `backup-${Date.now()}`
    );

    await fs.mkdir(backupDir, { recursive: true });

    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      const backupPath = path.join(backupDir, file);

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const checksum = crypto.createHash('md5').update(content).digest('hex');

        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.writeFile(backupPath, content);

        backups.push({
          originalPath: file,
          backupPath,
          checksum,
          existed: true,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File doesn't exist (will be created)
          backups.push({
            originalPath: file,
            backupPath,
            checksum: '',
            existed: false,
          });
        } else {
          throw error;
        }
      }
    }

    return backups;
  }

  /**
   * Apply file changes
   */
  private async applyChanges(
    changes: Array<{
      file: string;
      type: 'create' | 'modify' | 'delete';
      description: string;
      content?: string;
    }>
  ): Promise<Array<{ file: string; type: 'create' | 'modify' | 'delete'; description: string }>> {
    const applied: Array<{ file: string; type: 'create' | 'modify' | 'delete'; description: string }> = [];

    for (const change of changes) {
      const fullPath = path.join(this.projectRoot, change.file);

      switch (change.type) {
        case 'delete':
          await fs.unlink(fullPath);
          break;

        case 'create':
        case 'modify':
          if (change.content) {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, change.content);
          }
          break;
      }

      applied.push({
        file: change.file,
        type: change.type,
        description: change.description,
      });

      console.log(`[SelfImprovement] Applied: ${change.type} ${change.file}`);
    }

    return applied;
  }

  /**
   * Analyze risk level
   */
  private analyzeRisk(files: string[]): 'low' | 'medium' | 'high' {
    const highRiskPatterns = [
      /index\.ts$/,
      /server\.ts$/,
      /app\.ts$/,
      /package\.json$/,
      /tsconfig\.json$/,
    ];

    const mediumRiskPatterns = [
      /service\.ts$/,
      /controller\.ts$/,
      /middleware/,
    ];

    for (const file of files) {
      if (highRiskPatterns.some(p => p.test(file))) {
        return 'high';
      }
    }

    for (const file of files) {
      if (mediumRiskPatterns.some(p => p.test(file))) {
        return 'medium';
      }
    }

    return 'low';
  }

  /**
   * Check if changes require restart
   */
  private checkRequiresRestart(files: string[]): boolean {
    const restartPatterns = [
      /backend\/src\//,
      /package\.json$/,
      /tsconfig\.json$/,
    ];

    return files.some(file =>
      restartPatterns.some(pattern => pattern.test(file))
    );
  }

  /**
   * Run shell command
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
          reject(new Error(stderr || stdout));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Send Slack notification
   */
  private async notifySlack(message: string, urgency: 'low' | 'normal' | 'high' | 'critical'): Promise<void> {
    try {
      const slackBridge = getSlackOrchestratorBridge();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'Self-Improvement',
        message,
        urgency,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available
    }
  }
}

export function getSelfImprovementService(): SelfImprovementService {
  if (!selfImprovementInstance) {
    selfImprovementInstance = new SelfImprovementService();
  }
  return selfImprovementInstance;
}

export function resetSelfImprovementService(): void {
  selfImprovementInstance = null;
}
```

### 2. Update MCP Tool for Self-Improvement

Add/update in MCP server:

```typescript
{
  name: 'self_improve',
  description: 'Plan and execute improvements to the AgentMux codebase. Use plan first, then execute.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['plan', 'execute', 'cancel', 'status', 'history'],
        description: 'Action to perform',
      },
      description: {
        type: 'string',
        description: 'Description of the improvement (for plan)',
      },
      files: {
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
            content: { type: 'string', description: 'New content for create/modify' },
          },
          required: ['file', 'type', 'description'],
        },
        description: 'Changes to make (for execute)',
      },
    },
    required: ['action'],
  },
  handler: async (params) => {
    const service = getSelfImprovementService();

    switch (params.action) {
      case 'plan':
        const plan = await service.planImprovement({
          description: params.description,
          targetFiles: params.files,
          changes: params.changes || [],
        });
        return {
          success: true,
          plan,
          message: `Improvement planned: ${plan.id}. Risk: ${plan.riskLevel}. ` +
                   `Call execute to apply changes.`,
        };

      case 'execute':
        const result = await service.executeImprovement({
          description: params.description,
          targetFiles: params.files,
          changes: params.changes,
        });
        return result;

      case 'cancel':
        await service.cancelImprovement();
        return { success: true, message: 'Improvement cancelled' };

      case 'status':
        const status = await service.getStatus();
        return { success: true, status };

      case 'history':
        const history = await service.getHistory();
        return { success: true, history };
    }
  },
}
```

## Complete Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. ORCHESTRATOR DECIDES TO IMPROVE                                 │
│     "I should fix this bug in the login flow"                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. CALL self_improve WITH action='plan'                            │
│     - Creates marker file (phase: planning)                         │
│     - Returns risk assessment                                       │
│     - Notifies Slack                                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. CALL self_improve WITH action='execute'                         │
│     - Creates git checkpoint                                        │
│     - Creates file backups                                          │
│     - Updates marker (phase: backing_up)                            │
│     - Applies file changes                                          │
│     - Updates marker (phase: changes_applied)                       │
│     - ← HOT RELOAD KILLS PROCESS                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. NEW PROCESS STARTS                                              │
│     - Startup hook detects marker                                   │
│     - Runs validation (build, lint, test)                           │
│     - If PASS: complete, notify success                             │
│     - If FAIL: rollback, notify failure                             │
│     - Resumes normal operation                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Acceptance Criteria

- [ ] SelfImprovementService uses marker system
- [ ] Backup created BEFORE any file changes
- [ ] Marker updated BEFORE file changes (critical!)
- [ ] MCP tool supports plan/execute/cancel/status/history
- [ ] Risk analysis provided in plan response
- [ ] Content can be provided for file changes
- [ ] Slack notifications at each step
- [ ] TypeScript compilation passes
- [ ] All tests pass

## Testing Requirements

- Unit tests for plan/execute/cancel flow
- Integration test with marker service
- Risk analysis tests
- Backup creation tests

## Estimated Effort

30 minutes

## Notes

- The key insight: marker is updated BEFORE changes
- This ensures state survives hot-reload
- Startup hook handles validation, not execute method
- Two-phase approach (plan then execute) allows review
