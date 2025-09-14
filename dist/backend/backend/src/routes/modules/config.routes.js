import * as configHandlers from '../../controllers/system/config.controller.js';
export function registerConfigRoutes(router, apiController) {
    // Config Files Routes
    router.get('/config/:fileName', (req, res) => configHandlers.getConfigFile.call(apiController, req, res));
}
//# sourceMappingURL=config.routes.js.map