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

const router = Router();

/**
 * POST /api/self-improvement/plan
 * Create an improvement plan
 *
 * @param req - Express request with improvement plan data
 * @param res - Express response
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const service = getSelfImprovementService();
    const plan = await service.planImprovement({
      description: req.body.description,
      targetFiles: req.body.targetFiles,
      changes: req.body.changes,
      slackContext: req.body.slackContext,
    });
    res.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create plan';
    res.status(400).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Failed to execute plan';
    res.status(500).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Failed to get status';
    res.status(500).json({ error: message });
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
    const message = error instanceof Error ? error.message : 'Failed to cancel';
    res.status(400).json({ error: message });
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
    // Note: Rollback is handled by the startup service automatically
    // This endpoint is for manual rollback requests
    const { getImprovementStartupService } = await import('../../services/orchestrator/improvement-startup.service.js');
    const startupService = getImprovementStartupService();

    // Force a rollback check
    const result = await startupService.forceRollback(req.body.reason || 'Manual rollback requested');

    res.json({
      success: result.success,
      filesRestored: result.filesRestored || 0,
      message: result.message || 'Rollback completed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to rollback';
    res.status(500).json({ error: message });
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
    const limit = parseInt(req.query.limit as string) || 10;
    const history = await service.getHistory(limit);
    res.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get history';
    res.status(500).json({ error: message });
  }
});

export default router;
