import { Router } from 'express';
export function createApiRoutes(apiController) {
    const router = Router();
    // Team Management Routes
    router.post('/teams', (req, res) => apiController.createTeam(req, res));
    router.get('/teams', (req, res) => apiController.getTeams(req, res));
    router.get('/teams/activity-check', (req, res) => apiController.getTeamActivityStatus(req, res));
    router.get('/teams/:id', (req, res) => apiController.getTeam(req, res));
    router.post('/teams/:id/start', (req, res) => apiController.startTeam(req, res));
    router.post('/teams/:id/stop', (req, res) => apiController.stopTeam(req, res));
    router.get('/teams/:teamId/members/:memberId/session', (req, res) => apiController.getTeamMemberSession(req, res));
    router.post('/teams/:id/members', (req, res) => apiController.addTeamMember(req, res));
    router.patch('/teams/:teamId/members/:memberId', (req, res) => apiController.updateTeamMember(req, res));
    router.delete('/teams/:teamId/members/:memberId', (req, res) => apiController.deleteTeamMember(req, res));
    router.post('/teams/:teamId/members/:memberId/start', (req, res) => apiController.startTeamMember(req, res));
    router.post('/teams/:teamId/members/:memberId/stop', (req, res) => apiController.stopTeamMember(req, res));
    router.get('/teams/:id/workload', (req, res) => apiController.getTeamWorkload(req, res));
    router.patch('/teams/:id/status', (req, res) => apiController.updateTeamStatus(req, res));
    router.delete('/teams/:id', (req, res) => apiController.deleteTeam(req, res));
    router.post('/team-members/report-ready', (req, res) => apiController.reportMemberReady(req, res));
    router.post('/team-members/register-status', (req, res) => apiController.registerMemberStatus(req, res));
    // Project Management Routes
    router.post('/projects', (req, res) => apiController.createProject(req, res));
    router.get('/projects', (req, res) => apiController.getProjects(req, res));
    router.get('/projects/:id', (req, res) => apiController.getProject(req, res));
    router.post('/projects/:id/start', (req, res) => apiController.startProject(req, res));
    router.post('/projects/:id/stop', (req, res) => apiController.stopProject(req, res));
    router.post('/projects/:id/restart', (req, res) => apiController.restartProject(req, res));
    router.post('/projects/:id/assign-teams', (req, res) => apiController.assignTeamsToProject(req, res));
    router.post('/projects/:id/unassign-team', (req, res) => apiController.unassignTeamFromProject(req, res));
    router.get('/projects/:id/status', (req, res) => apiController.getProjectStatus(req, res));
    router.get('/projects/:id/files', (req, res) => apiController.getProjectFiles(req, res));
    router.get('/projects/:projectId/file-content', (req, res) => apiController.getFileContent(req, res));
    router.get('/projects/:id/completion', (req, res) => apiController.getProjectCompletion(req, res));
    router.delete('/projects/:id', (req, res) => apiController.deleteProject(req, res));
    router.post('/projects/:projectId/assign-task', (req, res) => apiController.assignTaskToOrchestrator(req, res));
    // Project Detail View Routes
    router.get('/projects/:id/stats', (req, res) => apiController.getProjectStats(req, res));
    router.get('/projects/:id/specs-status', (req, res) => apiController.getProjectSpecsStatus(req, res));
    router.post('/projects/:id/open-finder', (req, res) => apiController.openProjectInFinder(req, res));
    router.post('/projects/:id/create-spec-file', (req, res) => apiController.createSpecFile(req, res));
    router.get('/projects/:id/spec-file-content', (req, res) => apiController.getSpecFileContent(req, res));
    router.get('/projects/:id/alignment-status', (req, res) => apiController.getAlignmentStatus(req, res));
    router.post('/projects/:id/continue-with-misalignment', (req, res) => apiController.continueWithMisalignment(req, res));
    // Ticket Editor Routes
    router.post('/projects/:projectId/tickets', (req, res) => apiController.createTicket(req, res));
    router.get('/projects/:projectId/tickets', (req, res) => apiController.getTickets(req, res));
    router.get('/projects/:projectId/tickets/:ticketId', (req, res) => apiController.getTicket(req, res));
    router.put('/projects/:projectId/tickets/:ticketId', (req, res) => apiController.updateTicket(req, res));
    router.delete('/projects/:projectId/tickets/:ticketId', (req, res) => apiController.deleteTicket(req, res));
    router.post('/projects/:projectId/tickets/:ticketId/subtasks', (req, res) => apiController.addSubtask(req, res));
    router.patch('/projects/:projectId/tickets/:ticketId/subtasks/:subtaskId/toggle', (req, res) => apiController.toggleSubtask(req, res));
    // Task Management Routes (from markdown files)
    router.get('/projects/:projectId/tasks', (req, res) => apiController.getAllTasks(req, res));
    router.get('/projects/:projectId/milestones', (req, res) => apiController.getMilestones(req, res));
    router.get('/projects/:projectId/tasks/status/:status', (req, res) => apiController.getTasksByStatus(req, res));
    router.get('/projects/:projectId/tasks/milestone/:milestoneId', (req, res) => apiController.getTasksByMilestone(req, res));
    // Build Specs Routes
    router.get('/build-specs/config', (req, res) => apiController.getBuildSpecConfig(req, res));
    router.post('/build-specs/retry-step', (req, res) => apiController.retryBuildSpecStep(req, res));
    // Build Tasks Routes
    router.get('/build-tasks/config', (req, res) => apiController.getBuildTaskConfig(req, res));
    router.post('/build-tasks/retry-step', (req, res) => apiController.retryBuildTaskStep(req, res));
    router.get('/projects/:projectId/tasks-status', (req, res) => apiController.getProjectTasksStatus(req, res));
    // Task Management Routes (for MCP tools)
    router.post('/task-management/assign', (req, res) => apiController.assignTask(req, res));
    router.post('/task-management/complete', (req, res) => apiController.completeTask(req, res));
    router.post('/task-management/block', (req, res) => apiController.blockTask(req, res));
    router.post('/task-management/take-next', (req, res) => apiController.takeNextTask(req, res));
    router.post('/task-management/sync', (req, res) => apiController.syncTaskStatus(req, res));
    router.get('/task-management/team-progress', (req, res) => apiController.getTeamProgress(req, res));
    // Task Creation Routes
    router.post('/tasks/create-from-config', (req, res) => apiController.createTasksFromConfig(req, res));
    // Ticket Template Routes
    router.post('/projects/:projectId/ticket-templates/:templateName', (req, res) => apiController.createTicketTemplate(req, res));
    router.get('/projects/:projectId/ticket-templates', (req, res) => apiController.getTicketTemplates(req, res));
    router.get('/projects/:projectId/ticket-templates/:templateName', (req, res) => apiController.getTicketTemplate(req, res));
    // Context Loading Routes
    router.get('/projects/:projectId/context', (req, res) => apiController.getProjectContext(req, res));
    router.get('/teams/:teamId/members/:memberId/context', (req, res) => apiController.generateMemberContext(req, res));
    router.post('/teams/:teamId/members/:memberId/context/inject', (req, res) => apiController.injectContextIntoSession(req, res));
    router.post('/teams/:teamId/members/:memberId/context/refresh', (req, res) => apiController.refreshMemberContext(req, res));
    // Git Integration Routes
    router.get('/projects/:projectId/git/status', (req, res) => apiController.getGitStatus(req, res));
    router.post('/projects/:projectId/git/commit', (req, res) => apiController.commitChanges(req, res));
    router.post('/projects/:projectId/git/auto-commit/start', (req, res) => apiController.startAutoCommit(req, res));
    router.post('/projects/:projectId/git/auto-commit/stop', (req, res) => apiController.stopAutoCommit(req, res));
    router.get('/projects/:projectId/git/history', (req, res) => apiController.getCommitHistory(req, res));
    router.post('/projects/:projectId/git/branch', (req, res) => apiController.createBranch(req, res));
    router.post('/projects/:projectId/git/pull-request', (req, res) => apiController.createPullRequest(req, res));
    // System Administration Routes
    router.get('/system/health', (req, res) => apiController.getSystemHealth(req, res));
    router.get('/system/claude-status', (req, res) => apiController.getClaudeStatus(req, res));
    router.get('/system/metrics', (req, res) => apiController.getSystemMetrics(req, res));
    router.get('/system/config', (req, res) => apiController.getSystemConfiguration(req, res));
    router.patch('/system/config', (req, res) => apiController.updateSystemConfiguration(req, res));
    router.post('/system/config/default', (req, res) => apiController.createDefaultConfig(req, res));
    router.get('/system/logs', (req, res) => apiController.getSystemLogs(req, res));
    router.get('/system/alerts', (req, res) => apiController.getAlerts(req, res));
    router.patch('/system/alerts/:conditionId', (req, res) => apiController.updateAlertCondition(req, res));
    router.get('/health', (req, res) => apiController.healthCheck(req, res));
    // Scheduler Routes
    router.post('/schedule', (req, res) => apiController.scheduleCheck(req, res));
    router.get('/schedule', (req, res) => apiController.getScheduledChecks(req, res));
    router.delete('/schedule/:id', (req, res) => apiController.cancelScheduledCheck(req, res));
    // Terminal Routes
    router.get('/terminal/sessions', (req, res) => apiController.listTerminalSessions(req, res));
    router.get('/terminal/:session/capture', (req, res) => apiController.captureTerminal(req, res));
    router.post('/terminal/:session/input', (req, res) => apiController.sendTerminalInput(req, res));
    router.post('/terminal/:session/key', (req, res) => apiController.sendTerminalKey(req, res));
    // Markdown Editor Routes
    router.get('/projects/files', (req, res) => apiController.getAgentmuxMarkdownFiles(req, res));
    router.post('/projects/save-file', (req, res) => apiController.saveMarkdownFile(req, res));
    // Assignments Routes
    router.get('/assignments', (req, res) => apiController.getAssignments(req, res));
    router.patch('/assignments/:id', (req, res) => apiController.updateAssignment(req, res));
    // Orchestrator Routes
    router.post('/orchestrator/setup', (req, res) => apiController.setupOrchestrator(req, res));
    router.get('/orchestrator/commands', (req, res) => apiController.getOrchestratorCommands(req, res));
    router.post('/orchestrator/execute', (req, res) => apiController.executeOrchestratorCommand(req, res));
    router.post('/orchestrator/send-message', (req, res) => apiController.sendOrchestratorMessage(req, res));
    router.post('/orchestrator/send-enter', (req, res) => apiController.sendOrchestratorEnter(req, res));
    // Workflow Management Routes
    router.get('/workflows/executions/:executionId', (req, res) => apiController.getWorkflowExecution(req, res));
    router.get('/workflows/active', (req, res) => apiController.getActiveWorkflows(req, res));
    router.delete('/workflows/executions/:executionId', (req, res) => apiController.cancelWorkflowExecution(req, res));
    // Error Tracking Routes
    router.post('/errors', (req, res) => apiController.trackError(req, res));
    router.get('/errors/stats', (req, res) => apiController.getErrorStats(req, res));
    router.get('/errors', (req, res) => apiController.getErrors(req, res));
    router.get('/errors/:errorId', (req, res) => apiController.getError(req, res));
    router.delete('/errors', (req, res) => apiController.clearErrors(req, res));
    // Scheduled Messages Routes
    router.post('/scheduled-messages', (req, res) => apiController.createScheduledMessage(req, res));
    router.get('/scheduled-messages', (req, res) => apiController.getScheduledMessages(req, res));
    router.get('/scheduled-messages/:id', (req, res) => apiController.getScheduledMessage(req, res));
    router.put('/scheduled-messages/:id', (req, res) => apiController.updateScheduledMessage(req, res));
    router.delete('/scheduled-messages/:id', (req, res) => apiController.deleteScheduledMessage(req, res));
    router.post('/scheduled-messages/:id/toggle', (req, res) => apiController.toggleScheduledMessage(req, res));
    router.post('/scheduled-messages/:id/run', (req, res) => apiController.runScheduledMessage(req, res));
    // Message Delivery Logs Routes
    router.get('/message-delivery-logs', (req, res) => apiController.getDeliveryLogs(req, res));
    router.delete('/message-delivery-logs', (req, res) => apiController.clearDeliveryLogs(req, res));
    // Config Files Routes
    router.get('/config/:fileName', (req, res) => apiController.getConfigFile(req, res));
    return router;
}
//# sourceMappingURL=api.routes.js.map