/**
 * Self-Improvement Service
 *
 * Enables the orchestrator to safely modify the Crewly codebase,
 * using the marker system to persist state across hot-reload restarts.
 *
 * @module services/orchestrator/self-improvement
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
// Lazy-imported to break circular dependency:
// slack-orchestrator-bridge → orchestrator/index → self-improvement → slack-orchestrator-bridge
let _getSlackOrchestratorBridge: typeof import('../slack/slack-orchestrator-bridge.js').getSlackOrchestratorBridge | null = null;
async function getSlackBridgeLazy() {
  if (!_getSlackOrchestratorBridge) {
    const mod = await import('../slack/slack-orchestrator-bridge.js');
    _getSlackOrchestratorBridge = mod.getSlackOrchestratorBridge;
  }
  return _getSlackOrchestratorBridge();
}
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

/**
 * Improvement request configuration
 */
export interface ImprovementRequest {
  /** Description of the improvement */
  description: string;
  /** Files that will be modified */
  targetFiles: string[];
  /** Planned changes to apply */
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    description: string;
    content?: string;  // New content for create/modify
  }>;
  /** Slack context for notifications */
  slackContext?: {
    channelId: string;
    threadTs: string;
    userId: string;
  };
}

/**
 * Improvement plan returned after planning
 */
export interface ImprovementPlan {
  /** Unique improvement ID */
  id: string;
  /** Description of the improvement */
  description: string;
  /** Target files */
  targetFiles: string[];
  /** Planned changes */
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    description: string;
  }>;
  /** Risk level assessment */
  riskLevel: 'low' | 'medium' | 'high';
  /** Whether changes require restart */
  requiresRestart: boolean;
}

/**
 * Result of an improvement execution
 */
export interface ImprovementResult {
  /** Whether the improvement was started */
  started: boolean;
  /** Message about what happened */
  message: string;
  /** Task ID for tracking */
  taskId?: string;
}

/**
 * Self-improvement service singleton
 */
let selfImprovementInstance: SelfImprovementService | null = null;

/**
 * SelfImprovementService class
 *
 * Manages the self-improvement workflow using the marker system
 * to persist state across hot-reload restarts.
 *
 * Flow:
 * 1. planImprovement() - Creates marker in 'planning' phase
 * 2. executeImprovement() - Creates backups, applies changes
 * 3. Process is killed by hot-reload
 * 4. Startup hook handles validation and rollback
 *
 * @example
 * ```typescript
 * const service = getSelfImprovementService();
 *
 * const plan = await service.planImprovement({
 *   description: 'Add new feature',
 *   targetFiles: ['src/feature.ts'],
 *   changes: [{ file: 'src/feature.ts', type: 'create', description: 'New feature', content: '...' }],
 * });
 *
 * const result = await service.executeImprovement(request);
 * // Hot-reload will kill the process, startup hook will validate
 * ```
 */
export class SelfImprovementService {
  private projectRoot: string;
  private logger: ComponentLogger = LoggerService.getInstance().createComponentLogger('SelfImprovement');

  /**
   * Create a new SelfImprovementService.
   *
   * @param projectRoot - Root directory of the project (defaults to process.cwd())
   */
  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Plan an improvement (creates marker in 'planning' phase).
   *
   * @param request - The improvement request configuration
   * @returns ImprovementPlan for review before execution
   * @throws Error if another improvement is already pending
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

    this.logger.info('Task planned', { taskId });

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
   * Execute the planned improvement.
   *
   * IMPORTANT: This method:
   * 1. Creates backups
   * 2. Writes marker with backup info
   * 3. Applies changes (triggers hot-reload)
   * 4. Process gets killed by hot-reload
   * 5. Startup hook handles validation
   *
   * @param request - The improvement request with content
   * @returns Result indicating that changes were started
   * @throws Error if no improvement is planned
   */
  async executeImprovement(
    request: ImprovementRequest
  ): Promise<ImprovementResult> {
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
      this.logger.info('Creating git checkpoint...');
      const gitInfo = await this.createGitCheckpoint();

      // Step 2: Create file backups
      this.logger.info('Creating file backups...');
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
      this.logger.info('Applying changes...');
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
        taskId: marker.id,
      };

    } catch (error) {
      this.logger.error('Error during execution', { error: error instanceof Error ? error.message : String(error) });

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
   * Cancel a planned improvement.
   *
   * @throws Error if improvement is past planning phase
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

    this.logger.info('Task cancelled', { taskId: marker.id });
  }

  /**
   * Get current improvement status.
   *
   * @returns Current improvement marker or null
   */
  async getStatus(): Promise<ImprovementMarker | null> {
    const markerService = getImprovementMarkerService();
    return await markerService.getPendingImprovement();
  }

  /**
   * Get improvement history.
   *
   * @param limit - Maximum number of history items to return
   * @returns Array of historical improvement markers
   */
  async getHistory(limit: number = 10): Promise<ImprovementMarker[]> {
    const markerService = getImprovementMarkerService();
    return await markerService.getHistory(limit);
  }

  /**
   * Create git checkpoint.
   *
   * @returns Git commit and branch info
   */
  private async createGitCheckpoint(): Promise<{ commit?: string; branch?: string }> {
    try {
      const commit = (await this.runCommand('git', ['rev-parse', 'HEAD'])).trim();
      const branch = (await this.runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
      return { commit, branch };
    } catch {
      this.logger.warn('Git checkpoint failed, using file backups only');
      return {};
    }
  }

  /**
   * Create file backups.
   *
   * @param files - Files to backup
   * @returns Array of backup records
   */
  private async createFileBackups(files: string[]): Promise<FileBackupRecord[]> {
    const backups: FileBackupRecord[] = [];
    const backupDir = path.join(
      this.projectRoot,
      '.crewly',
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
   * Apply file changes.
   *
   * @param changes - Changes to apply
   * @returns Array of applied changes
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

      this.logger.info('Applied change', { type: change.type, file: change.file });
    }

    return applied;
  }

  /**
   * Analyze risk level.
   *
   * @param files - Files to analyze
   * @returns Risk level
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
   * Check if changes require restart.
   *
   * @param files - Files being changed
   * @returns True if restart is needed
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
   * Run shell command.
   *
   * @param cmd - Command to run
   * @param args - Command arguments
   * @returns Command output
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
   * Send Slack notification.
   *
   * @param message - Message to send
   * @param urgency - Urgency level
   */
  private async notifySlack(message: string, urgency: 'low' | 'normal' | 'high' | 'critical'): Promise<void> {
    try {
      const slackBridge = await getSlackBridgeLazy();
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

/**
 * Get singleton instance.
 *
 * @returns SelfImprovementService instance
 */
export function getSelfImprovementService(): SelfImprovementService {
  if (!selfImprovementInstance) {
    selfImprovementInstance = new SelfImprovementService();
  }
  return selfImprovementInstance;
}

/**
 * Reset instance (for testing).
 */
export function resetSelfImprovementService(): void {
  selfImprovementInstance = null;
}
