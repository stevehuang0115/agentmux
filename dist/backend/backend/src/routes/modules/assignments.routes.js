import * as assignmentsHandlers from '../../controllers/task-management/assignments.controller.js';
export function registerAssignmentsRoutes(router, apiController) {
    // Assignments Routes
    router.get('/assignments', (req, res) => assignmentsHandlers.getAssignments.call(apiController, req, res));
    router.patch('/assignments/:id', (req, res) => assignmentsHandlers.updateAssignment.call(apiController, req, res));
}
//# sourceMappingURL=assignments.routes.js.map