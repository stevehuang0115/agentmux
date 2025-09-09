import { Router } from 'express';
import { ApiController } from '../../controllers/api.controller.js';
import * as teamHandlers from '../../controllers/domains/teams.handlers.js';

export function registerTeamRoutes(router: Router, apiController: ApiController): void {
  // Team Management Routes
  router.post('/teams', (req, res) => teamHandlers.createTeam.call(apiController, req, res));
  router.get('/teams', (req, res) => teamHandlers.getTeams.call(apiController, req, res));
  router.get('/teams/activity-check', (req, res) => teamHandlers.getTeamActivityStatus.call(apiController, req, res));
  router.get('/teams/:id', (req, res) => teamHandlers.getTeam.call(apiController, req, res));
  router.post('/teams/:id/start', (req, res) => teamHandlers.startTeam.call(apiController, req, res));
  router.post('/teams/:id/stop', (req, res) => teamHandlers.stopTeam.call(apiController, req, res));
  router.get('/teams/:teamId/members/:memberId/session', (req, res) => teamHandlers.getTeamMemberSession.call(apiController, req, res));
  router.post('/teams/:id/members', (req, res) => teamHandlers.addTeamMember.call(apiController, req, res));
  router.patch('/teams/:teamId/members/:memberId', (req, res) => teamHandlers.updateTeamMember.call(apiController, req, res));
  router.delete('/teams/:teamId/members/:memberId', (req, res) => teamHandlers.deleteTeamMember.call(apiController, req, res));
  router.post('/teams/:teamId/members/:memberId/start', (req, res) => teamHandlers.startTeamMember.call(apiController, req, res));
  router.post('/teams/:teamId/members/:memberId/stop', (req, res) => teamHandlers.stopTeamMember.call(apiController, req, res));
  router.get('/teams/:id/workload', (req, res) => teamHandlers.getTeamWorkload.call(apiController, req, res));
  router.delete('/teams/:id', (req, res) => teamHandlers.deleteTeam.call(apiController, req, res));
  router.post('/team-members/report-ready', (req, res) => teamHandlers.reportMemberReady.call(apiController, req, res));
  router.post('/team-members/register-status', (req, res) => teamHandlers.registerMemberStatus.call(apiController, req, res));

  // Team Member Context Routes
  router.get('/teams/:teamId/members/:memberId/context', (req, res) => teamHandlers.generateMemberContext.call(apiController, req, res));
  router.post('/teams/:teamId/members/:memberId/context/inject', (req, res) => teamHandlers.injectContextIntoSession.call(apiController, req, res));
  router.post('/teams/:teamId/members/:memberId/context/refresh', (req, res) => teamHandlers.refreshMemberContext.call(apiController, req, res));
}
