/**
 * Self-Improvement Controller
 *
 * REST API endpoints for self-improvement operations.
 * Enables the orchestrator to safely modify the AgentMux codebase.
 *
 * @module controllers/self-improvement
 */

import { Router, Request, Response } from 'express';
import { getSelfImprovementService } from '../../services/orchestrator/index.js';
import { getImprovementStartupService } from '../../services/orchestrator/improvement-startup.service.js';

const router = Router();

/**
 * Helper to extract error message from unknown error
 *
 * @param error - The caught error
 * @param fallback - Fallback message if error is not an Error instance
 * @returns Error message string
 */
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * POST /api/self-improvement/plan
 * Create an improvement plan
 *
 * @param req - Express request with improvement plan data
 * @param res - Express response
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { description, targetFiles, changes, slackContext } = req.body;

    // Validate required fields
    if (!description || typeof description !== 'string') {
      res.status(400).json({ error: 'description is required and must be a string' });
      return;
    }

    if (!Array.isArray(targetFiles) || targetFiles.length === 0) {
      res.status(400).json({ error: 'targetFiles is required and must be a non-empty array' });
      return;
    }

    if (!Array.isArray(changes) || changes.length === 0) {
      res.status(400).json({ error: 'changes is required and must be a non-empty array' });
      return;
    }

    const service = getSelfImprovementService();
    const plan = await service.planImprovement({
      description,
      targetFiles,
      changes,
      slackContext,
    });
    res.json(plan);
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error, 'Failed to create plan') });
  }
});

/**
 * POST /api/self-improvement/execute
 * Execute an improvement plan
 *
 * @param req - Express request with plan ID
 * @param res - Express response
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();

    // Get the current pending marker to retrieve the full request
    const status = await service.getStatus();
    if (!status) {
      res.status(400).json({ error: 'No improvement planned' });
      return;
    }

    // Execute with stored changes from marker
    const result = await service.executeImprovement({
      description: status.description,
      targetFiles: status.targetFiles,
      changes: (status.changes || []).map((c: { file: string; type: 'create' | 'modify' | 'delete'; description: string }) => ({
        file: c.file,
        type: c.type,
        description: c.description,
      })),
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to execute plan') });
  }
});

/**
 * GET /api/self-improvement/status
 * Get current improvement status
 *
 * @param _req - Express request
 * @param res - Express response
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const status = await service.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to get status') });
  }
});

/**
 * POST /api/self-improvement/cancel
 * Cancel a planned improvement
 *
 * @param _req - Express request
 * @param res - Express response
 */
router.post('/cancel', async (_req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    await service.cancelImprovement();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: getErrorMessage(error, 'Failed to cancel') });
  }
});

/**
 * POST /api/self-improvement/rollback
 * Rollback the last improvement
 *
 * @param req - Express request with rollback reason
 * @param res - Express response
 */
router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const startupService = getImprovementStartupService();
    const result = await startupService.forceRollback(req.body.reason || 'Manual rollback requested');

    res.json({
      success: result.success,
      filesRestored: result.filesRestored || 0,
      message: result.message || 'Rollback completed',
    });
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to rollback') });
  }
});

/**
 * GET /api/self-improvement/history
 * Get improvement history
 *
 * @param req - Express request with optional limit query param
 * @param res - Express response
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const parsedLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 10 : Math.min(parsedLimit, 100);
    const history = await service.getHistory(limit);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to get history') });
  }
});

export default router;
