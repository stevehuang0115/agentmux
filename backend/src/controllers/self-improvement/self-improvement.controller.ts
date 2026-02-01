/**
 * Self-Improvement Controller
 *
 * REST API endpoints for self-improvement operations.
 * Provides endpoints for planning, executing, monitoring, and
 * rolling back codebase modifications.
 *
 * @module controllers/self-improvement
 */

import { Router, Request, Response } from 'express';
import {
  getSelfImprovementService,
  getImprovementMarkerService,
} from '../../services/orchestrator/index.js';
import type { ImprovementRequest } from '../../services/orchestrator/index.js';

const router = Router();

/**
 * Stored improvement requests for later execution
 * Key is the plan ID, value is the full request with file contents
 */
const pendingRequests: Map<string, ImprovementRequest> = new Map();

/**
 * POST /api/self-improvement/plan
 *
 * Create an improvement plan with file changes.
 * The plan must be executed separately after creation.
 *
 * @body description - Description of the improvement
 * @body targetFiles - Array of file paths to modify
 * @body changes - Array of file changes with type and content
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { description, targetFiles, changes } = req.body;

    if (!description || !targetFiles || !changes) {
      res.status(400).json({
        error: 'Missing required fields: description, targetFiles, changes',
      });
      return;
    }

    const service = getSelfImprovementService();
    const request: ImprovementRequest = {
      description,
      targetFiles,
      changes,
    };

    const plan = await service.planImprovement(request);

    // Store the full request for later execution
    pendingRequests.set(plan.id, request);

    res.json({
      data: plan,
    });
  } catch (error) {
    console.error('[SelfImprovementController] Plan error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/self-improvement/execute
 *
 * Execute a previously created improvement plan.
 * This triggers file modifications and may cause hot-reload restart.
 *
 * @body planId - ID of the plan to execute
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;

    if (!planId) {
      res.status(400).json({ error: 'Missing required field: planId' });
      return;
    }

    // Get the stored request
    const request = pendingRequests.get(planId);
    if (!request) {
      res.status(404).json({
        error: `No pending request found for plan ID: ${planId}`,
      });
      return;
    }

    const service = getSelfImprovementService();
    const result = await service.executeImprovement(request);

    // Clear the pending request
    pendingRequests.delete(planId);

    res.json({
      data: result,
    });
  } catch (error) {
    console.error('[SelfImprovementController] Execute error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/self-improvement/status
 *
 * Get the current self-improvement status.
 * Returns the pending improvement marker if one exists.
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const status = await service.getStatus();

    res.json({
      data: status,
    });
  } catch (error) {
    console.error('[SelfImprovementController] Status error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/self-improvement/rollback
 *
 * Rollback the current/last improvement.
 * Restores files from backup and resets the state.
 *
 * @body reason - Reason for the rollback
 */
router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'Missing required field: reason' });
      return;
    }

    const markerService = getImprovementMarkerService();
    const marker = await markerService.getPendingImprovement();

    if (!marker) {
      res.status(404).json({ error: 'No improvement to rollback' });
      return;
    }

    // Record rollback started
    await markerService.recordRollbackStarted(reason);

    // Perform rollback using file backups
    const filesRestored: string[] = [];
    let gitReset = false;

    if (marker.backup.files.length > 0) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const projectRoot = process.cwd();

      for (const backup of marker.backup.files) {
        try {
          if (backup.existed) {
            // Restore from backup
            const content = await fs.readFile(backup.backupPath, 'utf-8');
            const targetPath = path.join(projectRoot, backup.originalPath);
            await fs.writeFile(targetPath, content);
            filesRestored.push(backup.originalPath);
          } else {
            // Delete file that was created
            const targetPath = path.join(projectRoot, backup.originalPath);
            await fs.unlink(targetPath).catch(() => {});
            filesRestored.push(backup.originalPath);
          }
        } catch (error) {
          console.error(`Failed to restore ${backup.originalPath}:`, error);
        }
      }
    }

    // Record rollback completed
    await markerService.recordRollbackCompleted(filesRestored, gitReset);

    // Complete the improvement as failed
    await markerService.completeImprovement(false);

    res.json({
      data: {
        success: true,
        filesRestored: filesRestored.length,
        gitReset,
      },
    });
  } catch (error) {
    console.error('[SelfImprovementController] Rollback error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * POST /api/self-improvement/cancel
 *
 * Cancel a pending improvement plan.
 * Only works if the improvement is still in planning phase.
 */
router.post('/cancel', async (_req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const status = await service.getStatus();

    if (status) {
      pendingRequests.delete(status.id);
    }

    await service.cancelImprovement();

    res.json({
      data: { cancelled: true },
    });
  } catch (error) {
    console.error('[SelfImprovementController] Cancel error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

/**
 * GET /api/self-improvement/history
 *
 * Get history of past improvements.
 *
 * @query limit - Maximum number of history items (default: 10)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const service = getSelfImprovementService();
    const history = await service.getHistory(limit);

    res.json({
      data: history,
    });
  } catch (error) {
    console.error('[SelfImprovementController] History error:', error);
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
