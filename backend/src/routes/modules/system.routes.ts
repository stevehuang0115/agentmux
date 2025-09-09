import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as systemHandlers from '../../controllers/domains/system.handlers.js';

export function registerSystemRoutes(router: Router, apiController: ApiController): void {
  // System Administration Routes
  router.get('/system/health', (req, res) => systemHandlers.getSystemHealth.call(apiController, req, res));
  router.get('/system/claude-status', (req, res) => systemHandlers.getClaudeStatus.call(apiController, req, res));
  router.get('/system/metrics', (req, res) => systemHandlers.getSystemMetrics.call(apiController, req, res));
  router.get('/system/config', (req, res) => systemHandlers.getSystemConfiguration.call(apiController, req, res));
  router.patch('/system/config', (req, res) => systemHandlers.updateSystemConfiguration.call(apiController, req, res));
  router.post('/system/config/default', (req, res) => systemHandlers.createDefaultConfig.call(apiController, req, res));
  router.get('/system/logs', (req, res) => systemHandlers.getSystemLogs.call(apiController, req, res));
  router.get('/system/alerts', (req, res) => systemHandlers.getAlerts.call(apiController, req, res));
  router.patch('/system/alerts/:conditionId', (req, res) => systemHandlers.updateAlertCondition.call(apiController, req, res));

  // API Health within /api scope
  router.get('/health', (req, res) => systemHandlers.healthCheck.call(apiController, req, res));
}
