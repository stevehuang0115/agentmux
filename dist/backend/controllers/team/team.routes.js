import { Router } from 'express';
import { createTeam, getTeams, getTeam, startTeam, stopTeam, getTeamWorkload, deleteTeam, getTeamMemberSession, addTeamMember, updateTeamMember, deleteTeamMember, startTeamMember, stopTeamMember, reportMemberReady, registerMemberStatus, generateMemberContext, injectContextIntoSession, refreshMemberContext, getTeamActivityStatus, updateTeamMemberRuntime } from './team.controller.js';
/**
 * Creates team router with all team-related endpoints
 * @param context - API context with services
 * @returns Express router configured with team routes
 */
export function createTeamRouter(context) {
    const router = Router();
    // Team CRUD operations
    router.post('/', createTeam.bind(context));
    router.get('/', getTeams.bind(context));
    router.get('/:id', getTeam.bind(context));
    router.delete('/:id', deleteTeam.bind(context));
    // Team lifecycle management
    router.post('/:id/start', startTeam.bind(context));
    router.post('/:id/stop', stopTeam.bind(context));
    router.get('/:id/workload', getTeamWorkload.bind(context));
    // Team member management
    router.post('/:id/members', addTeamMember.bind(context));
    router.put('/:teamId/members/:memberId', updateTeamMember.bind(context));
    router.delete('/:teamId/members/:memberId', deleteTeamMember.bind(context));
    // Team member lifecycle
    router.post('/:teamId/members/:memberId/start', startTeamMember.bind(context));
    router.post('/:teamId/members/:memberId/stop', stopTeamMember.bind(context));
    // Team member sessions and monitoring
    router.get('/:teamId/members/:memberId/session', getTeamMemberSession.bind(context));
    router.post('/members/ready', reportMemberReady.bind(context));
    router.post('/members/register', registerMemberStatus.bind(context));
    // Context management
    router.get('/:teamId/members/:memberId/context', generateMemberContext.bind(context));
    router.post('/:teamId/members/:memberId/context/inject', injectContextIntoSession.bind(context));
    router.post('/:teamId/members/:memberId/context/refresh', refreshMemberContext.bind(context));
    // Team activity monitoring
    router.get('/activity-status', getTeamActivityStatus.bind(context));
    // Runtime management
    router.put('/:teamId/members/:memberId/runtime', updateTeamMemberRuntime.bind(context));
    return router;
}
//# sourceMappingURL=team.routes.js.map