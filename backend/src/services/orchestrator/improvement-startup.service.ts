/**
 * Improvement Startup Service
 *
 * Handles self-improvement continuation after process restart.
 * This is the critical hook that makes self-improvement work
 * with hot-reload / nodemon.
 *
 * @module services/orchestrator/improvement-startup
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  getImprovementMarkerService,
  ImprovementMarker,
  ImprovementPhase,
  ValidationResult,
} from './improvement-marker.service.js';

/**
 * Startup result indicating what action was taken
 */
export interface StartupResult {
  hadPendingImprovement: boolean;
  improvementId?: string;
  phase?: ImprovementPhase;
  action?: 'validated' | 'rolled_back' | 'cleaned_up' | 'none';
  validationPassed?: boolean;
  error?: string;
}

/**
 * Validation check configuration
 */
interface ValidationCheck {
  name: string;
  command: string;
  args: string[];
  required: boolean;
  timeoutMs: number;
}

/**
 * Default validation checks
 */
const DEFAULT_VALIDATIONS: ValidationCheck[] = [
  {
    name: 'build',
    command: 'npm',
    args: ['run', 'build'],
    required: true,
    timeoutMs: 120000,
  },
  {
    name: 'lint',
    command: 'npm',
    args: ['run', 'lint'],
    required: true,
    timeoutMs: 60000,
  },
  {
    name: 'test',
    command: 'npm',
    args: ['run', 'test'],
    required: true,
    timeoutMs: 300000,
  },
];

/**
 * Maximum restart count before giving up
 */
const MAX_RESTART_COUNT = 3;

/**
 * ImprovementStartupService class
 *
 * Runs at application startup to check for and handle pending
 * self-improvements that were interrupted by hot-reload.
 */
export class ImprovementStartupService {
  private projectRoot: string;

  /**
   * Creates an instance of ImprovementStartupService.
   *
   * @param projectRoot - Project root directory
   */
  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Run the startup check.
   *
   * This should be called early in application startup,
   * before normal operations begin.
   *
   * @returns Result of the startup check
   */
  async runStartupCheck(): Promise<StartupResult> {
    const markerService = getImprovementMarkerService();
    await markerService.initialize();

    // Check for pending improvement
    const marker = await markerService.getPendingImprovement();

    if (!marker) {
      return { hadPendingImprovement: false };
    }

    console.log(`[ImprovementStartup] Found pending improvement: ${marker.id}`);
    console.log(`[ImprovementStartup] Phase: ${marker.phase}, Restarts: ${marker.restartCount}`);

    // Increment restart count
    const restartCount = await markerService.incrementRestartCount();

    // Check for too many restarts (possible infinite loop)
    if (restartCount > MAX_RESTART_COUNT) {
      console.error(`[ImprovementStartup] Too many restarts (${restartCount}), forcing rollback`);
      return await this.handleTooManyRestarts(marker);
    }

    // Handle based on phase
    switch (marker.phase) {
      case 'planning':
      case 'backing_up':
        // Improvement was interrupted before changes were applied
        // Safe to just clean up
        return await this.handleInterruptedPlanning(marker);

      case 'changes_applied':
        // Changes were applied, need to validate
        return await this.handleChangesApplied(marker);

      case 'validating':
        // Was in the middle of validation, continue
        return await this.handleValidating(marker);

      case 'rolling_back':
        // Was rolling back, continue
        return await this.handleRollingBack(marker);

      case 'rolled_back':
        // Rollback complete, just clean up
        return await this.handleRolledBack(marker);

      case 'complete':
        // Shouldn't have a pending marker, clean up
        await markerService.deleteMarker();
        return { hadPendingImprovement: true, action: 'cleaned_up' };

      default:
        console.warn(`[ImprovementStartup] Unknown phase: ${marker.phase}`);
        return { hadPendingImprovement: true, action: 'none' };
    }
  }

  /**
   * Handle interrupted planning phase.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleInterruptedPlanning(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Improvement interrupted during planning, cleaning up');

    const markerService = getImprovementMarkerService();
    await markerService.deleteMarker();

    await this.notifySlack(
      marker,
      ':warning: Self-improvement was interrupted during planning and has been cancelled.',
      'normal'
    );

    return {
      hadPendingImprovement: true,
      improvementId: marker.id,
      phase: marker.phase,
      action: 'cleaned_up',
    };
  }

  /**
   * Handle changes_applied phase - run validation.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleChangesApplied(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Changes applied, running validation...');

    const markerService = getImprovementMarkerService();
    await markerService.updatePhase('validating');

    await this.notifySlack(
      marker,
      ':hourglass: AgentMux restarted after self-improvement. Running validation...',
      'normal'
    );

    // Run validation
    const validationPassed = await this.runValidation(marker);

    if (validationPassed) {
      return await this.handleValidationSuccess(marker);
    } else {
      return await this.handleValidationFailure(marker);
    }
  }

  /**
   * Handle validating phase - continue validation.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleValidating(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Continuing validation...');

    // Check which validations have already passed
    const passedChecks = marker.validation.results
      .filter(r => r.passed)
      .map(r => r.check);

    // Run remaining validations
    const validationPassed = await this.runValidation(marker, passedChecks);

    if (validationPassed) {
      return await this.handleValidationSuccess(marker);
    } else {
      return await this.handleValidationFailure(marker);
    }
  }

  /**
   * Run validation checks.
   *
   * @param marker - The improvement marker
   * @param skipChecks - Checks to skip (already passed)
   * @returns True if all required validations passed
   */
  private async runValidation(
    marker: ImprovementMarker,
    skipChecks: string[] = []
  ): Promise<boolean> {
    const markerService = getImprovementMarkerService();
    let allPassed = true;

    for (const check of DEFAULT_VALIDATIONS) {
      if (skipChecks.includes(check.name)) {
        console.log(`[ImprovementStartup] Skipping ${check.name} (already passed)`);
        continue;
      }

      console.log(`[ImprovementStartup] Running ${check.name}...`);
      const startTime = Date.now();

      try {
        await this.runCommand(check.command, check.args, check.timeoutMs);

        const result: ValidationResult = {
          check: check.name,
          passed: true,
          duration: Date.now() - startTime,
        };

        await markerService.recordValidationResult(result);
        console.log(`[ImprovementStartup] ${check.name} passed (${result.duration}ms)`);

      } catch (error) {
        const result: ValidationResult = {
          check: check.name,
          passed: false,
          output: (error as Error).message,
          duration: Date.now() - startTime,
        };

        await markerService.recordValidationResult(result);
        console.error(`[ImprovementStartup] ${check.name} FAILED: ${result.output}`);

        if (check.required) {
          allPassed = false;
          break; // Stop on first required failure
        }
      }
    }

    return allPassed;
  }

  /**
   * Handle validation success.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleValidationSuccess(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] All validation passed!');

    const markerService = getImprovementMarkerService();
    await markerService.completeImprovement(true);

    await this.notifySlack(
      marker,
      `:white_check_mark: *Self-improvement completed successfully!*\n\n*${marker.description}*\n\nAll validation checks passed. Changes are now active.`,
      'normal'
    );

    return {
      hadPendingImprovement: true,
      improvementId: marker.id,
      phase: 'complete',
      action: 'validated',
      validationPassed: true,
    };
  }

  /**
   * Handle validation failure - trigger rollback.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleValidationFailure(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Validation failed, initiating rollback...');

    const markerService = getImprovementMarkerService();

    // Get fresh marker with updated validation results
    const updatedMarker = await markerService.getPendingImprovement();
    const currentMarker = updatedMarker || marker;

    // Get failed checks
    const failedChecks = currentMarker.validation.results
      .filter(r => !r.passed)
      .map(r => `${r.check}: ${r.output || 'failed'}`)
      .join('\n');

    await markerService.recordRollbackStarted(`Validation failed:\n${failedChecks}`);

    await this.notifySlack(
      currentMarker,
      `:x: *Self-improvement validation failed!*\n\n*${currentMarker.description}*\n\nRolling back changes...\n\n\`\`\`\n${failedChecks}\n\`\`\``,
      'high'
    );

    // Perform rollback
    const rollbackResult = await this.performRollback(currentMarker);

    if (rollbackResult.success) {
      await markerService.recordRollbackCompleted(
        rollbackResult.filesRestored,
        rollbackResult.gitReset
      );

      // Complete with failure status
      await markerService.completeImprovement(false);

      await this.notifySlack(
        currentMarker,
        `:rewind: *Rollback completed.* The codebase has been restored to its previous state.`,
        'normal'
      );

      // Note: This may trigger another hot-reload from the rollback file changes
      // The next startup will see phase='complete' and just clean up
    }

    return {
      hadPendingImprovement: true,
      improvementId: currentMarker.id,
      phase: currentMarker.phase,
      action: 'rolled_back',
      validationPassed: false,
      error: failedChecks,
    };
  }

  /**
   * Handle rolling_back phase - continue rollback.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleRollingBack(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Continuing rollback...');

    const markerService = getImprovementMarkerService();
    const rollbackResult = await this.performRollback(marker);

    await markerService.recordRollbackCompleted(
      rollbackResult.filesRestored,
      rollbackResult.gitReset
    );

    await markerService.completeImprovement(false);

    return {
      hadPendingImprovement: true,
      improvementId: marker.id,
      phase: 'rolled_back',
      action: 'rolled_back',
      validationPassed: false,
    };
  }

  /**
   * Handle rolled_back phase - just clean up.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleRolledBack(marker: ImprovementMarker): Promise<StartupResult> {
    console.log('[ImprovementStartup] Rollback already complete, cleaning up');

    const markerService = getImprovementMarkerService();
    await markerService.completeImprovement(false);

    return {
      hadPendingImprovement: true,
      improvementId: marker.id,
      phase: 'rolled_back',
      action: 'cleaned_up',
    };
  }

  /**
   * Handle too many restarts.
   *
   * @param marker - The improvement marker
   * @returns Startup result
   */
  private async handleTooManyRestarts(marker: ImprovementMarker): Promise<StartupResult> {
    const markerService = getImprovementMarkerService();

    await markerService.recordError(
      `Too many restarts (${marker.restartCount}), possible infinite loop`
    );

    await this.notifySlack(
      marker,
      `:rotating_light: *Self-improvement stuck in restart loop!*\n\n*${marker.description}*\n\nForcing rollback after ${marker.restartCount} restarts.`,
      'critical'
    );

    // Force rollback
    await this.performRollback(marker);
    await markerService.completeImprovement(false);

    return {
      hadPendingImprovement: true,
      improvementId: marker.id,
      action: 'rolled_back',
      validationPassed: false,
      error: 'Too many restarts, forced rollback',
    };
  }

  /**
   * Perform rollback of file changes.
   *
   * @param marker - The improvement marker with backup info
   * @returns Rollback result
   */
  private async performRollback(
    marker: ImprovementMarker
  ): Promise<{ success: boolean; filesRestored: string[]; gitReset: boolean }> {
    const filesRestored: string[] = [];
    let gitReset = false;

    // Try git reset first
    if (marker.backup.gitCommit) {
      try {
        await this.runCommand('git', ['reset', '--hard', marker.backup.gitCommit], 30000);
        gitReset = true;
        console.log(`[ImprovementStartup] Git reset to ${marker.backup.gitCommit}`);
        return { success: true, filesRestored: marker.targetFiles, gitReset: true };
      } catch (error) {
        console.warn('[ImprovementStartup] Git reset failed, using file backups');
      }
    }

    // Restore from file backups
    for (const backup of marker.backup.files) {
      try {
        if (backup.existed) {
          // Restore original file
          const content = await fs.readFile(backup.backupPath, 'utf-8');
          await fs.mkdir(path.dirname(backup.originalPath), { recursive: true });
          await fs.writeFile(
            path.join(this.projectRoot, backup.originalPath),
            content
          );
        } else {
          // Delete file that was created
          await fs.unlink(path.join(this.projectRoot, backup.originalPath));
        }
        filesRestored.push(backup.originalPath);
        console.log(`[ImprovementStartup] Restored: ${backup.originalPath}`);
      } catch (error) {
        console.error(`[ImprovementStartup] Failed to restore ${backup.originalPath}:`, error);
      }
    }

    return { success: true, filesRestored, gitReset };
  }

  /**
   * Run a shell command.
   *
   * @param cmd - Command to run
   * @param args - Command arguments
   * @param timeoutMs - Timeout in milliseconds
   * @returns Command output
   */
  private runCommand(cmd: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data; });
      child.stderr.on('data', (data) => { stderr += data; });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout || `Exit code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Send Slack notification.
   *
   * @param marker - The improvement marker
   * @param message - Message to send
   * @param urgency - Message urgency level
   */
  private async notifySlack(
    marker: ImprovementMarker,
    message: string,
    urgency: 'low' | 'normal' | 'high' | 'critical'
  ): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { getSlackOrchestratorBridge } = await import('../slack/slack-orchestrator-bridge.js');
      const slackBridge = getSlackOrchestratorBridge();
      await slackBridge.sendNotification({
        type: 'alert',
        title: 'Self-Improvement Update',
        message,
        urgency,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Slack not available, silently ignore
    }
  }
}

/**
 * Singleton instance
 */
let startupServiceInstance: ImprovementStartupService | null = null;

/**
 * Get singleton instance of ImprovementStartupService.
 *
 * @returns The singleton ImprovementStartupService instance
 */
export function getImprovementStartupService(): ImprovementStartupService {
  if (!startupServiceInstance) {
    startupServiceInstance = new ImprovementStartupService();
  }
  return startupServiceInstance;
}

/**
 * Reset singleton instance (for testing).
 */
export function resetImprovementStartupService(): void {
  startupServiceInstance = null;
}
