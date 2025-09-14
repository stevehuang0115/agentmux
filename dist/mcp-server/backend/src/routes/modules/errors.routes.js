import * as errorHandlers from '../../controllers/system/errors.controller.js';
export function registerErrorRoutes(router, apiController) {
    // Error Tracking Routes
    router.post('/errors', (req, res) => errorHandlers.trackError.call(apiController, req, res));
    router.get('/errors/stats', (req, res) => errorHandlers.getErrorStats.call(apiController, req, res));
    router.get('/errors', (req, res) => errorHandlers.getErrors.call(apiController, req, res));
    router.get('/errors/:errorId', (req, res) => errorHandlers.getError.call(apiController, req, res));
    router.delete('/errors', (req, res) => errorHandlers.clearErrors.call(apiController, req, res));
}
//# sourceMappingURL=errors.routes.js.map