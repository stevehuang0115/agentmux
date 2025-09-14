import * as projectHandlers from '../../controllers/project/project.controller.js';
import * as ticketHandlers from '../../controllers/task-management/tickets.controller.js';
import * as gitHandlers from '../../controllers/project/git.controller.js';
import * as taskHandlers from '../../controllers/task-management/tasks.controller.js';
import * as orchestratorHandlers from '../../controllers/orchestrator/orchestrator.controller.js';
export function registerProjectRoutes(router, apiController) {
    // Project Management Routes
    router.post('/projects', (req, res) => projectHandlers.createProject.call(apiController, req, res));
    router.get('/projects', (req, res) => projectHandlers.getProjects.call(apiController, req, res));
    router.get('/projects/:id', (req, res) => projectHandlers.getProject.call(apiController, req, res));
    router.post('/projects/:id/start', (req, res) => projectHandlers.startProject.call(apiController, req, res));
    router.post('/projects/:id/stop', (req, res) => projectHandlers.stopProject.call(apiController, req, res));
    router.post('/projects/:id/restart', (req, res) => projectHandlers.restartProject.call(apiController, req, res));
    router.post('/projects/:id/assign-teams', (req, res) => projectHandlers.assignTeamsToProject.call(apiController, req, res));
    router.post('/projects/:id/unassign-team', (req, res) => projectHandlers.unassignTeamFromProject.call(apiController, req, res));
    router.get('/projects/:id/status', (req, res) => projectHandlers.getProjectStatus.call(apiController, req, res));
    router.get('/projects/:id/files', (req, res) => projectHandlers.getProjectFiles.call(apiController, req, res));
    router.get('/projects/:projectId/file-content', (req, res) => projectHandlers.getFileContent.call(apiController, req, res));
    router.get('/projects/:id/completion', (req, res) => projectHandlers.getProjectCompletion.call(apiController, req, res));
    router.delete('/projects/:id', (req, res) => projectHandlers.deleteProject.call(apiController, req, res));
    router.post('/projects/:projectId/assign-task', (req, res) => orchestratorHandlers.assignTaskToOrchestrator.call(apiController, req, res));
    // Project Detail View Routes
    router.get('/projects/:id/stats', (req, res) => projectHandlers.getProjectStats.call(apiController, req, res));
    router.post('/projects/:id/open-finder', (req, res) => projectHandlers.openProjectInFinder.call(apiController, req, res));
    router.post('/projects/:id/create-spec-file', (req, res) => projectHandlers.createSpecFile.call(apiController, req, res));
    router.get('/projects/:id/spec-file-content', (req, res) => projectHandlers.getSpecFileContent.call(apiController, req, res));
    // Ticket Editor Routes
    router.post('/projects/:projectId/tickets', (req, res) => ticketHandlers.createTicket.call(apiController, req, res));
    router.get('/projects/:projectId/tickets', (req, res) => ticketHandlers.getTickets.call(apiController, req, res));
    router.get('/projects/:projectId/tickets/:ticketId', (req, res) => ticketHandlers.getTicket.call(apiController, req, res));
    router.put('/projects/:projectId/tickets/:ticketId', (req, res) => ticketHandlers.updateTicket.call(apiController, req, res));
    router.delete('/projects/:projectId/tickets/:ticketId', (req, res) => ticketHandlers.deleteTicket.call(apiController, req, res));
    router.post('/projects/:projectId/tickets/:ticketId/subtasks', (req, res) => ticketHandlers.addSubtask.call(apiController, req, res));
    router.patch('/projects/:projectId/tickets/:ticketId/subtasks/:subtaskId/toggle', (req, res) => ticketHandlers.toggleSubtask.call(apiController, req, res));
    // Task Management Routes (from markdown files)
    router.get('/projects/:projectId/tasks', (req, res) => taskHandlers.getAllTasks.call(apiController, req, res));
    router.get('/projects/:projectId/milestones', (req, res) => taskHandlers.getMilestones.call(apiController, req, res));
    router.get('/projects/:projectId/tasks/status/:status', (req, res) => taskHandlers.getTasksByStatus.call(apiController, req, res));
    router.get('/projects/:projectId/tasks/milestone/:milestoneId', (req, res) => taskHandlers.getTasksByMilestone.call(apiController, req, res));
    router.get('/projects/:projectId/tasks-status', (req, res) => taskHandlers.getProjectTasksStatus.call(apiController, req, res));
    // Ticket Template Routes
    router.post('/projects/:projectId/ticket-templates/:templateName', (req, res) => ticketHandlers.createTicketTemplate.call(apiController, req, res));
    router.get('/projects/:projectId/ticket-templates', (req, res) => ticketHandlers.getTicketTemplates.call(apiController, req, res));
    router.get('/projects/:projectId/ticket-templates/:templateName', (req, res) => ticketHandlers.getTicketTemplate.call(apiController, req, res));
    // Context Loading Routes
    router.get('/projects/:projectId/context', (req, res) => projectHandlers.getProjectContext.call(apiController, req, res));
    // Git Integration Routes
    router.get('/projects/:projectId/git/status', (req, res) => gitHandlers.getGitStatus.call(apiController, req, res));
    router.post('/projects/:projectId/git/commit', (req, res) => gitHandlers.commitChanges.call(apiController, req, res));
    router.post('/projects/:projectId/git/auto-commit/start', (req, res) => gitHandlers.startAutoCommit.call(apiController, req, res));
    router.post('/projects/:projectId/git/auto-commit/stop', (req, res) => gitHandlers.stopAutoCommit.call(apiController, req, res));
    router.get('/projects/:projectId/git/history', (req, res) => gitHandlers.getCommitHistory.call(apiController, req, res));
    router.post('/projects/:projectId/git/branch', (req, res) => gitHandlers.createBranch.call(apiController, req, res));
    router.post('/projects/:projectId/git/pull-request', (req, res) => gitHandlers.createPullRequest.call(apiController, req, res));
    // Markdown Editor Routes
    router.get('/projects/files', (req, res) => projectHandlers.getAgentmuxMarkdownFiles.call(apiController, req, res));
    router.post('/projects/save-file', (req, res) => projectHandlers.saveMarkdownFile.call(apiController, req, res));
}
//# sourceMappingURL=projects.routes.js.map