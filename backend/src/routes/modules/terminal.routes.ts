import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as terminalHandlers from '../../controllers/monitoring/terminal.controller.js';

export function registerTerminalRoutes(router: Router, apiController: ApiController): void {
  // Terminal Routes
  router.get('/terminal/sessions', (req, res) => terminalHandlers.listTerminalSessions.call(apiController, req, res));
  router.get('/terminal/:sessionName/capture', (req, res) => terminalHandlers.captureTerminal.call(apiController, req, res));
  router.post('/terminal/:sessionName/input', (req, res) => terminalHandlers.sendTerminalInput.call(apiController, req, res));
  router.post('/terminal/:sessionName/key', (req, res) => terminalHandlers.sendTerminalKey.call(apiController, req, res));
}
