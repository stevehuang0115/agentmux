import { AgentRegistrationService } from '../services/index.js';
import { ActiveProjectsService } from '../services/index.js';
import { PromptTemplateService } from '../services/index.js';
import { TaskAssignmentMonitorService } from '../services/index.js';
import { TaskTrackingService } from '../services/index.js';
export class ApiController {
    storageService;
    tmuxService;
    schedulerService;
    messageSchedulerService;
    activeProjectsService;
    promptTemplateService;
    taskAssignmentMonitor;
    taskTrackingService;
    agentRegistrationService;
    constructor(storageService, tmuxService, schedulerService, messageSchedulerService) {
        this.storageService = storageService;
        this.tmuxService = tmuxService;
        this.schedulerService = schedulerService;
        this.messageSchedulerService = messageSchedulerService;
        this.activeProjectsService = new ActiveProjectsService(this.storageService);
        this.promptTemplateService = new PromptTemplateService();
        this.taskAssignmentMonitor = new TaskAssignmentMonitorService(this.tmuxService);
        this.taskTrackingService = new TaskTrackingService();
        // Create AgentRegistrationService - it needs access to the internal services from TmuxService
        // We'll access the internal services through the TmuxService properties
        const tmuxCommand = this.tmuxService.tmuxCommand;
        this.agentRegistrationService = new AgentRegistrationService(tmuxCommand, process.cwd(), this.storageService);
    }
    // Task Management Methods
    async assignTask(req, res) {
        const { assignTask } = await import('./task-management/task-management.controller.js');
        return assignTask.call(this, req, res);
    }
    async completeTask(req, res) {
        const { completeTask } = await import('./task-management/task-management.controller.js');
        return completeTask.call(this, req, res);
    }
    async blockTask(req, res) {
        const { blockTask } = await import('./task-management/task-management.controller.js');
        return blockTask.call(this, req, res);
    }
    async takeNextTask(req, res) {
        const { takeNextTask } = await import('./task-management/task-management.controller.js');
        return takeNextTask.call(this, req, res);
    }
    async syncTaskStatus(req, res) {
        const { syncTaskStatus } = await import('./task-management/task-management.controller.js');
        return syncTaskStatus.call(this, req, res);
    }
    async getTeamProgress(req, res) {
        const { getTeamProgress } = await import('./task-management/task-management.controller.js');
        return getTeamProgress.call(this, req, res);
    }
    async createTasksFromConfig(req, res) {
        const { createTasksFromConfig } = await import('./task-management/task-management.controller.js');
        return createTasksFromConfig.call(this, req, res);
    }
    // Teams Methods
    async createTeam(req, res) {
        const { createTeam } = await import('./team/team.controller.js');
        return createTeam.call(this, req, res);
    }
    async getTeams(req, res) {
        const { getTeams } = await import('./team/team.controller.js');
        return getTeams.call(this, req, res);
    }
    async getTeam(req, res) {
        const { getTeam } = await import('./team/team.controller.js');
        return getTeam.call(this, req, res);
    }
    async startTeam(req, res) {
        const { startTeam } = await import('./team/team.controller.js');
        return startTeam.call(this, req, res);
    }
    async stopTeam(req, res) {
        const { stopTeam } = await import('./team/team.controller.js');
        return stopTeam.call(this, req, res);
    }
    async getTeamWorkload(req, res) {
        const { getTeamWorkload } = await import('./team/team.controller.js');
        return getTeamWorkload.call(this, req, res);
    }
    async deleteTeam(req, res) {
        const { deleteTeam } = await import('./team/team.controller.js');
        return deleteTeam.call(this, req, res);
    }
    async getTeamMemberSession(req, res) {
        const { getTeamMemberSession } = await import('./team/team.controller.js');
        return getTeamMemberSession.call(this, req, res);
    }
    async addTeamMember(req, res) {
        const { addTeamMember } = await import('./team/team.controller.js');
        return addTeamMember.call(this, req, res);
    }
    async updateTeamMember(req, res) {
        const { updateTeamMember } = await import('./team/team.controller.js');
        return updateTeamMember.call(this, req, res);
    }
    async deleteTeamMember(req, res) {
        const { deleteTeamMember } = await import('./team/team.controller.js');
        return deleteTeamMember.call(this, req, res);
    }
    async startTeamMember(req, res) {
        const { startTeamMember } = await import('./team/team.controller.js');
        return startTeamMember.call(this, req, res);
    }
    async stopTeamMember(req, res) {
        const { stopTeamMember } = await import('./team/team.controller.js');
        return stopTeamMember.call(this, req, res);
    }
    async reportMemberReady(req, res) {
        const { reportMemberReady } = await import('./team/team.controller.js');
        return reportMemberReady.call(this, req, res);
    }
    async registerMemberStatus(req, res) {
        const { registerMemberStatus } = await import('./team/team.controller.js');
        return registerMemberStatus.call(this, req, res);
    }
    async generateMemberContext(req, res) {
        const { generateMemberContext } = await import('./team/team.controller.js');
        return generateMemberContext.call(this, req, res);
    }
    async injectContextIntoSession(req, res) {
        const { injectContextIntoSession } = await import('./team/team.controller.js');
        return injectContextIntoSession.call(this, req, res);
    }
    async refreshMemberContext(req, res) {
        const { refreshMemberContext } = await import('./team/team.controller.js');
        return refreshMemberContext.call(this, req, res);
    }
    async getTeamActivityStatus(req, res) {
        const { getTeamActivityStatus } = await import('./team/team.controller.js');
        return getTeamActivityStatus.call(this, req, res);
    }
    // Projects Methods
    async createProject(req, res) {
        const { createProject } = await import('./project/project.controller.js');
        return createProject.call(this, req, res);
    }
    async getProjects(req, res) {
        const { getProjects } = await import('./project/project.controller.js');
        return getProjects.call(this, req, res);
    }
    async getProject(req, res) {
        const { getProject } = await import('./project/project.controller.js');
        return getProject.call(this, req, res);
    }
    async getProjectStatus(req, res) {
        const { getProjectStatus } = await import('./project/project.controller.js');
        return getProjectStatus.call(this, req, res);
    }
    async getProjectFiles(req, res) {
        const { getProjectFiles } = await import('./project/project.controller.js');
        return getProjectFiles.call(this, req, res);
    }
    async getFileContent(req, res) {
        const { getFileContent } = await import('./project/project.controller.js');
        return getFileContent.call(this, req, res);
    }
    async getProjectCompletion(req, res) {
        const { getProjectCompletion } = await import('./project/project.controller.js');
        return getProjectCompletion.call(this, req, res);
    }
    async deleteProject(req, res) {
        const { deleteProject } = await import('./project/project.controller.js');
        return deleteProject.call(this, req, res);
    }
    async getProjectContext(req, res) {
        const { getProjectContext } = await import('./project/project.controller.js');
        return getProjectContext.call(this, req, res);
    }
    async openProjectInFinder(req, res) {
        const { openProjectInFinder } = await import('./project/project.controller.js');
        return openProjectInFinder.call(this, req, res);
    }
    async createSpecFile(req, res) {
        const { createSpecFile } = await import('./project/project.controller.js');
        return createSpecFile.call(this, req, res);
    }
    async getSpecFileContent(req, res) {
        const { getSpecFileContent } = await import('./project/project.controller.js');
        return getSpecFileContent.call(this, req, res);
    }
    async getAgentmuxMarkdownFiles(req, res) {
        const { getAgentmuxMarkdownFiles } = await import('./project/project.controller.js');
        return getAgentmuxMarkdownFiles.call(this, req, res);
    }
    async saveMarkdownFile(req, res) {
        const { saveMarkdownFile } = await import('./project/project.controller.js');
        return saveMarkdownFile.call(this, req, res);
    }
    async startProject(req, res) {
        const { startProject } = await import('./project/project.controller.js');
        return startProject.call(this, req, res);
    }
    async stopProject(req, res) {
        const { stopProject } = await import('./project/project.controller.js');
        return stopProject.call(this, req, res);
    }
    async restartProject(req, res) {
        const { restartProject } = await import('./project/project.controller.js');
        return restartProject.call(this, req, res);
    }
    async assignTeamsToProject(req, res) {
        const { assignTeamsToProject } = await import('./project/project.controller.js');
        return assignTeamsToProject.call(this, req, res);
    }
    async unassignTeamFromProject(req, res) {
        const { unassignTeamFromProject } = await import('./project/project.controller.js');
        return unassignTeamFromProject.call(this, req, res);
    }
    // Tickets Methods
    async createTicket(req, res) {
        const { createTicket } = await import('./task-management/tickets.controller.js');
        return createTicket.call(this, req, res);
    }
    async getTickets(req, res) {
        const { getTickets } = await import('./task-management/tickets.controller.js');
        return getTickets.call(this, req, res);
    }
    async getTicket(req, res) {
        const { getTicket } = await import('./task-management/tickets.controller.js');
        return getTicket.call(this, req, res);
    }
    async updateTicket(req, res) {
        const { updateTicket } = await import('./task-management/tickets.controller.js');
        return updateTicket.call(this, req, res);
    }
    async deleteTicket(req, res) {
        const { deleteTicket } = await import('./task-management/tickets.controller.js');
        return deleteTicket.call(this, req, res);
    }
    async addSubtask(req, res) {
        const { addSubtask } = await import('./task-management/tickets.controller.js');
        return addSubtask.call(this, req, res);
    }
    async toggleSubtask(req, res) {
        const { toggleSubtask } = await import('./task-management/tickets.controller.js');
        return toggleSubtask.call(this, req, res);
    }
    async createTicketTemplate(req, res) {
        const { createTicketTemplate } = await import('./task-management/tickets.controller.js');
        return createTicketTemplate.call(this, req, res);
    }
    async getTicketTemplates(req, res) {
        const { getTicketTemplates } = await import('./task-management/tickets.controller.js');
        return getTicketTemplates.call(this, req, res);
    }
    async getTicketTemplate(req, res) {
        const { getTicketTemplate } = await import('./task-management/tickets.controller.js');
        return getTicketTemplate.call(this, req, res);
    }
    // Git Methods
    async getGitStatus(req, res) {
        const { getGitStatus } = await import('./project/git.controller.js');
        return getGitStatus.call(this, req, res);
    }
    async commitChanges(req, res) {
        const { commitChanges } = await import('./project/git.controller.js');
        return commitChanges.call(this, req, res);
    }
    async startAutoCommit(req, res) {
        const { startAutoCommit } = await import('./project/git.controller.js');
        return startAutoCommit.call(this, req, res);
    }
    async stopAutoCommit(req, res) {
        const { stopAutoCommit } = await import('./project/git.controller.js');
        return stopAutoCommit.call(this, req, res);
    }
    async getCommitHistory(req, res) {
        const { getCommitHistory } = await import('./project/git.controller.js');
        return getCommitHistory.call(this, req, res);
    }
    async createBranch(req, res) {
        const { createBranch } = await import('./project/git.controller.js');
        return createBranch.call(this, req, res);
    }
    async createPullRequest(req, res) {
        const { createPullRequest } = await import('./project/git.controller.js');
        return createPullRequest.call(this, req, res);
    }
    // Orchestrator Methods
    async getOrchestratorCommands(req, res) {
        const { getOrchestratorCommands } = await import('./orchestrator/orchestrator.controller.js');
        return getOrchestratorCommands.call(this, req, res);
    }
    async executeOrchestratorCommand(req, res) {
        const { executeOrchestratorCommand } = await import('./orchestrator/orchestrator.controller.js');
        return executeOrchestratorCommand.call(this, req, res);
    }
    async sendOrchestratorMessage(req, res) {
        const { sendOrchestratorMessage } = await import('./orchestrator/orchestrator.controller.js');
        return sendOrchestratorMessage.call(this, req, res);
    }
    async sendOrchestratorEnter(req, res) {
        const { sendOrchestratorEnter } = await import('./orchestrator/orchestrator.controller.js');
        return sendOrchestratorEnter.call(this, req, res);
    }
    async setupOrchestrator(req, res) {
        const { setupOrchestrator } = await import('./orchestrator/orchestrator.controller.js');
        return setupOrchestrator.call(this, req, res);
    }
    async getOrchestratorHealth(req, res) {
        const { getOrchestratorHealth } = await import('./orchestrator/orchestrator.controller.js');
        return getOrchestratorHealth.call(this, req, res);
    }
    async assignTaskToOrchestrator(req, res) {
        const { assignTaskToOrchestrator } = await import('./orchestrator/orchestrator.controller.js');
        return assignTaskToOrchestrator.call(this, req, res);
    }
    // Scheduler Methods
    async scheduleCheck(req, res) {
        const { scheduleCheck } = await import('./system/scheduler.controller.js');
        return scheduleCheck.call(this, req, res);
    }
    async getScheduledChecks(req, res) {
        const { getScheduledChecks } = await import('./system/scheduler.controller.js');
        return getScheduledChecks.call(this, req, res);
    }
    async cancelScheduledCheck(req, res) {
        const { cancelScheduledCheck } = await import('./system/scheduler.controller.js');
        return cancelScheduledCheck.call(this, req, res);
    }
    // Terminal Methods
    async listTerminalSessions(req, res) {
        const { listTerminalSessions } = await import('./monitoring/terminal.controller.js');
        return listTerminalSessions.call(this, req, res);
    }
    async captureTerminal(req, res) {
        const { captureTerminal } = await import('./monitoring/terminal.controller.js');
        return captureTerminal.call(this, req, res);
    }
    async sendTerminalInput(req, res) {
        const { sendTerminalInput } = await import('./monitoring/terminal.controller.js');
        return sendTerminalInput.call(this, req, res);
    }
    async sendTerminalKey(req, res) {
        const { sendTerminalKey } = await import('./monitoring/terminal.controller.js');
        return sendTerminalKey.call(this, req, res);
    }
    // Errors Methods
    async trackError(req, res) {
        const { trackError } = await import('./system/errors.controller.js');
        return trackError.call(this, req, res);
    }
    async getErrorStats(req, res) {
        const { getErrorStats } = await import('./system/errors.controller.js');
        return getErrorStats.call(this, req, res);
    }
    async getErrors(req, res) {
        const { getErrors } = await import('./system/errors.controller.js');
        return getErrors.call(this, req, res);
    }
    async getError(req, res) {
        const { getError } = await import('./system/errors.controller.js');
        return getError.call(this, req, res);
    }
    async clearErrors(req, res) {
        const { clearErrors } = await import('./system/errors.controller.js');
        return clearErrors.call(this, req, res);
    }
    // Scheduled Messages Methods
    async createScheduledMessage(req, res) {
        const { createScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return createScheduledMessage.call(this, req, res);
    }
    async getScheduledMessages(req, res) {
        const { getScheduledMessages } = await import('./messaging/scheduled-messages.controller.js');
        return getScheduledMessages.call(this, req, res);
    }
    async getScheduledMessage(req, res) {
        const { getScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return getScheduledMessage.call(this, req, res);
    }
    async updateScheduledMessage(req, res) {
        const { updateScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return updateScheduledMessage.call(this, req, res);
    }
    async deleteScheduledMessage(req, res) {
        const { deleteScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return deleteScheduledMessage.call(this, req, res);
    }
    async toggleScheduledMessage(req, res) {
        const { toggleScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return toggleScheduledMessage.call(this, req, res);
    }
    async runScheduledMessage(req, res) {
        const { runScheduledMessage } = await import('./messaging/scheduled-messages.controller.js');
        return runScheduledMessage.call(this, req, res);
    }
    // Delivery Logs Methods
    async getDeliveryLogs(req, res) {
        const { getDeliveryLogs } = await import('./messaging/delivery-logs.controller.js');
        return getDeliveryLogs.call(this, req, res);
    }
    async clearDeliveryLogs(req, res) {
        const { clearDeliveryLogs } = await import('./messaging/delivery-logs.controller.js');
        return clearDeliveryLogs.call(this, req, res);
    }
    // Workflows Methods - Deprecated (orchestration now handled via scheduled messages)
    async getWorkflowExecution(req, res) {
        res.status(410).json({ success: false, error: 'Workflow execution API deprecated - orchestration now handled via scheduled messages' });
    }
    async getActiveWorkflows(req, res) {
        res.status(410).json({ success: false, error: 'Active workflows API deprecated - orchestration now handled via scheduled messages' });
    }
    async cancelWorkflowExecution(req, res) {
        res.status(410).json({ success: false, error: 'Workflow cancellation API deprecated - orchestration now handled via scheduled messages' });
    }
    // Config Files Methods
    async getConfigFile(req, res) {
        const { getConfigFile } = await import('./system/config.controller.js');
        return getConfigFile.call(this, req, res);
    }
    // Project Tasks Methods
    async getAllTasks(req, res) {
        const { getAllTasks } = await import('./task-management/tasks.controller.js');
        return getAllTasks.call(this, req, res);
    }
    async getMilestones(req, res) {
        const { getMilestones } = await import('./task-management/tasks.controller.js');
        return getMilestones.call(this, req, res);
    }
    async getTasksByStatus(req, res) {
        const { getTasksByStatus } = await import('./task-management/tasks.controller.js');
        return getTasksByStatus.call(this, req, res);
    }
    async getTasksByMilestone(req, res) {
        const { getTasksByMilestone } = await import('./task-management/tasks.controller.js');
        return getTasksByMilestone.call(this, req, res);
    }
    async getProjectTasksStatus(req, res) {
        const { getProjectTasksStatus } = await import('./task-management/tasks.controller.js');
        return getProjectTasksStatus.call(this, req, res);
    }
}
//# sourceMappingURL=api.controller.js.map