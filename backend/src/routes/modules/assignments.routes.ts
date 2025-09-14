import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as assignmentsHandlers from '../../controllers/task-management/assignments.controller.js';

export function registerAssignmentsRoutes(router: Router, apiController: ApiController): void {
  // Assignments Routes
  router.get('/assignments', (req, res) => assignmentsHandlers.getAssignments.call(apiController, req, res));
  router.patch('/assignments/:id', (req, res) => assignmentsHandlers.updateAssignment.call(apiController, req, res));
}
