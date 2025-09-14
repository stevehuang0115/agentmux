import * as schedulerHandlers from '../../controllers/system/scheduler.controller.js';
export function registerSchedulerRoutes(router, apiController) {
    // Scheduler Routes
    router.post('/schedule', (req, res) => schedulerHandlers.scheduleCheck.call(apiController, req, res));
    router.get('/schedule', (req, res) => schedulerHandlers.getScheduledChecks.call(apiController, req, res));
    router.delete('/schedule/:id', (req, res) => schedulerHandlers.cancelScheduledCheck.call(apiController, req, res));
}
//# sourceMappingURL=scheduler.routes.js.map