import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';

export function registerWorkflowRoutes(router: Router, apiController: ApiController): void {
  // Legacy workflow routes removed - project orchestration now handled via scheduled messages
  router.get('/workflows/executions/:executionId', (req, res) => {
    res.status(410).json({ success: false, error: 'Workflow execution API deprecated - orchestration now handled via scheduled messages' });
  });
  router.get('/workflows/active', (req, res) => {
    res.status(410).json({ success: false, error: 'Active workflows API deprecated - orchestration now handled via scheduled messages' });
  });
  router.delete('/workflows/executions/:executionId', (req, res) => {
    res.status(410).json({ success: false, error: 'Workflow cancellation API deprecated - orchestration now handled via scheduled messages' });
  });
}
