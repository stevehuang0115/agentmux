import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as orchestratorHandlers from '../../controllers/domains/orchestrator.handlers.js';

export function registerOrchestratorRoutes(router: Router, apiController: ApiController): void {
  // Orchestrator Routes
  router.post('/orchestrator/setup', (req, res) => orchestratorHandlers.setupOrchestrator.call(apiController, req, res));
  router.get('/orchestrator/health', (req, res) => orchestratorHandlers.getOrchestratorHealth.call(apiController, req, res));
  router.get('/orchestrator/commands', (req, res) => orchestratorHandlers.getOrchestratorCommands.call(apiController, req, res));
  router.post('/orchestrator/execute', (req, res) => orchestratorHandlers.executeOrchestratorCommand.call(apiController, req, res));
  router.post('/orchestrator/send-message', (req, res) => orchestratorHandlers.sendOrchestratorMessage.call(apiController, req, res));
  router.post('/orchestrator/send-enter', (req, res) => orchestratorHandlers.sendOrchestratorEnter.call(apiController, req, res));
}
