import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as configHandlers from '../../controllers/system/config.controller.js';

export function registerConfigRoutes(router: Router, apiController: ApiController): void {
  // Config Files Routes
  router.get('/config/:fileName', (req, res) => configHandlers.getConfigFile.call(apiController, req, res));
}
