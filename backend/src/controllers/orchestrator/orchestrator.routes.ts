import { Router } from 'express';
import type { ApiContext } from '../types.js';
import {
  getOrchestratorCommands,
  executeOrchestratorCommand,
  sendOrchestratorMessage,
  sendOrchestratorEnter,
  setupOrchestrator,
  stopOrchestrator,
  getOrchestratorHealth,
  assignTaskToOrchestrator,
  updateOrchestratorRuntime
} from './orchestrator.controller.js';

/**
 * Creates orchestrator router with all orchestrator-related endpoints
 * @param context - API context with services
 * @returns Express router configured with orchestrator routes
 */
export function createOrchestratorRouter(context: ApiContext): Router {
  const router = Router();

  // Orchestrator management
  router.post('/setup', setupOrchestrator.bind(context));
  router.post('/stop', stopOrchestrator.bind(context));
  router.get('/health', getOrchestratorHealth.bind(context));

  // Command and message handling
  router.get('/commands', getOrchestratorCommands.bind(context));
  router.post('/commands/execute', executeOrchestratorCommand.bind(context));
  router.post('/messages', sendOrchestratorMessage.bind(context));
  router.post('/messages/enter', sendOrchestratorEnter.bind(context));

  // Task assignment
  router.post('/projects/:projectId/tasks', assignTaskToOrchestrator.bind(context));

  // Runtime management
  router.put('/runtime', updateOrchestratorRuntime.bind(context));

  return router;
}