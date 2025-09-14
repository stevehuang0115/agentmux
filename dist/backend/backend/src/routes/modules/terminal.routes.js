import * as terminalHandlers from '../../controllers/monitoring/terminal.controller.js';
export function registerTerminalRoutes(router, apiController) {
    // Terminal Routes
    router.get('/terminal/sessions', (req, res) => terminalHandlers.listTerminalSessions.call(apiController, req, res));
    router.get('/terminal/:session/capture', (req, res) => terminalHandlers.captureTerminal.call(apiController, req, res));
    router.post('/terminal/:session/input', (req, res) => terminalHandlers.sendTerminalInput.call(apiController, req, res));
    router.post('/terminal/:session/key', (req, res) => terminalHandlers.sendTerminalKey.call(apiController, req, res));
}
//# sourceMappingURL=terminal.routes.js.map