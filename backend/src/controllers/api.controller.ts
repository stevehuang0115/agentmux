import { Request, Response } from 'express';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../services/index.js';
import { ActiveProjectsService } from '../services/active-projects.service.js';
import { PromptTemplateService } from '../services/prompt-template.service.js';
import { TaskAssignmentMonitorService } from '../services/task-assignment-monitor.service.js';

export class ApiController {
  public activeProjectsService: ActiveProjectsService;
  public promptTemplateService: PromptTemplateService;
  public taskAssignmentMonitor: TaskAssignmentMonitorService;

  constructor(
    public storageService: StorageService,
    public tmuxService: TmuxService,
    public schedulerService: SchedulerService,
    public messageSchedulerService?: MessageSchedulerService
  ) {
    this.activeProjectsService = new ActiveProjectsService(this.storageService);
    this.promptTemplateService = new PromptTemplateService();
    this.taskAssignmentMonitor = new TaskAssignmentMonitorService(this.tmuxService);
  }

  // Task Management Methods
  public async assignTask(req: Request, res: Response): Promise<void> {
    const { assignTask } = await import('./domains/task-management.handlers.js');
    return assignTask.call(this, req, res);
  }

  public async completeTask(req: Request, res: Response): Promise<void> {
    const { completeTask } = await import('./domains/task-management.handlers.js');
    return completeTask.call(this, req, res);
  }

  public async blockTask(req: Request, res: Response): Promise<void> {
    const { blockTask } = await import('./domains/task-management.handlers.js');
    return blockTask.call(this, req, res);
  }

  public async takeNextTask(req: Request, res: Response): Promise<void> {
    const { takeNextTask } = await import('./domains/task-management.handlers.js');
    return takeNextTask.call(this, req, res);
  }

  public async syncTaskStatus(req: Request, res: Response): Promise<void> {
    const { syncTaskStatus } = await import('./domains/task-management.handlers.js');
    return syncTaskStatus.call(this, req, res);
  }

  public async getTeamProgress(req: Request, res: Response): Promise<void> {
    const { getTeamProgress } = await import('./domains/task-management.handlers.js');
    return getTeamProgress.call(this, req, res);
  }

  public async createTasksFromConfig(req: Request, res: Response): Promise<void> {
    const { createTasksFromConfig } = await import('./domains/task-management.handlers.js');
    return createTasksFromConfig.call(this, req, res);
  }

  // Teams Methods
  public async createTeam(req: Request, res: Response): Promise<void> {
    const { createTeam } = await import('./domains/teams.handlers.js');
    return createTeam.call(this, req, res);
  }

  public async getTeams(req: Request, res: Response): Promise<void> {
    const { getTeams } = await import('./domains/teams.handlers.js');
    return getTeams.call(this, req, res);
  }

  public async getTeam(req: Request, res: Response): Promise<void> {
    const { getTeam } = await import('./domains/teams.handlers.js');
    return getTeam.call(this, req, res);
  }

  public async startTeam(req: Request, res: Response): Promise<void> {
    const { startTeam } = await import('./domains/teams.handlers.js');
    return startTeam.call(this, req, res);
  }

  public async stopTeam(req: Request, res: Response): Promise<void> {
    const { stopTeam } = await import('./domains/teams.handlers.js');
    return stopTeam.call(this, req, res);
  }

  public async getTeamWorkload(req: Request, res: Response): Promise<void> {
    const { getTeamWorkload } = await import('./domains/teams.handlers.js');
    return getTeamWorkload.call(this, req, res);
  }

  public async deleteTeam(req: Request, res: Response): Promise<void> {
    const { deleteTeam } = await import('./domains/teams.handlers.js');
    return deleteTeam.call(this, req, res);
  }

  public async getTeamMemberSession(req: Request, res: Response): Promise<void> {
    const { getTeamMemberSession } = await import('./domains/teams.handlers.js');
    return getTeamMemberSession.call(this, req, res);
  }

  public async addTeamMember(req: Request, res: Response): Promise<void> {
    const { addTeamMember } = await import('./domains/teams.handlers.js');
    return addTeamMember.call(this, req, res);
  }

  public async updateTeamMember(req: Request, res: Response): Promise<void> {
    const { updateTeamMember } = await import('./domains/teams.handlers.js');
    return updateTeamMember.call(this, req, res);
  }

  public async deleteTeamMember(req: Request, res: Response): Promise<void> {
    const { deleteTeamMember } = await import('./domains/teams.handlers.js');
    return deleteTeamMember.call(this, req, res);
  }

  public async startTeamMember(req: Request, res: Response): Promise<void> {
    const { startTeamMember } = await import('./domains/teams.handlers.js');
    return startTeamMember.call(this, req, res);
  }

  public async stopTeamMember(req: Request, res: Response): Promise<void> {
    const { stopTeamMember } = await import('./domains/teams.handlers.js');
    return stopTeamMember.call(this, req, res);
  }

  public async reportMemberReady(req: Request, res: Response): Promise<void> {
    const { reportMemberReady } = await import('./domains/teams.handlers.js');
    return reportMemberReady.call(this, req, res);
  }

  public async registerMemberStatus(req: Request, res: Response): Promise<void> {
    const { registerMemberStatus } = await import('./domains/teams.handlers.js');
    return registerMemberStatus.call(this, req, res);
  }

  public async generateMemberContext(req: Request, res: Response): Promise<void> {
    const { generateMemberContext } = await import('./domains/teams.handlers.js');
    return generateMemberContext.call(this, req, res);
  }

  public async injectContextIntoSession(req: Request, res: Response): Promise<void> {
    const { injectContextIntoSession } = await import('./domains/teams.handlers.js');
    return injectContextIntoSession.call(this, req, res);
  }

  public async refreshMemberContext(req: Request, res: Response): Promise<void> {
    const { refreshMemberContext } = await import('./domains/teams.handlers.js');
    return refreshMemberContext.call(this, req, res);
  }

  public async getTeamActivityStatus(req: Request, res: Response): Promise<void> {
    const { getTeamActivityStatus } = await import('./domains/teams.handlers.js');
    return getTeamActivityStatus.call(this, req, res);
  }

  // Projects Methods
  public async createProject(req: Request, res: Response): Promise<void> {
    const { createProject } = await import('./domains/projects.handlers.js');
    return createProject.call(this, req, res);
  }

  public async getProjects(req: Request, res: Response): Promise<void> {
    const { getProjects } = await import('./domains/projects.handlers.js');
    return getProjects.call(this, req, res);
  }

  public async getProject(req: Request, res: Response): Promise<void> {
    const { getProject } = await import('./domains/projects.handlers.js');
    return getProject.call(this, req, res);
  }

  public async getProjectStatus(req: Request, res: Response): Promise<void> {
    const { getProjectStatus } = await import('./domains/projects.handlers.js');
    return getProjectStatus.call(this, req, res);
  }

  public async getProjectFiles(req: Request, res: Response): Promise<void> {
    const { getProjectFiles } = await import('./domains/projects.handlers.js');
    return getProjectFiles.call(this, req, res);
  }

  public async getFileContent(req: Request, res: Response): Promise<void> {
    const { getFileContent } = await import('./domains/projects.handlers.js');
    return getFileContent.call(this, req, res);
  }

  public async getProjectCompletion(req: Request, res: Response): Promise<void> {
    const { getProjectCompletion } = await import('./domains/projects.handlers.js');
    return getProjectCompletion.call(this, req, res);
  }

  public async deleteProject(req: Request, res: Response): Promise<void> {
    const { deleteProject } = await import('./domains/projects.handlers.js');
    return deleteProject.call(this, req, res);
  }

  public async getProjectContext(req: Request, res: Response): Promise<void> {
    const { getProjectContext } = await import('./domains/projects.handlers.js');
    return getProjectContext.call(this, req, res);
  }

  public async openProjectInFinder(req: Request, res: Response): Promise<void> {
    const { openProjectInFinder } = await import('./domains/projects.handlers.js');
    return openProjectInFinder.call(this, req, res);
  }

  public async createSpecFile(req: Request, res: Response): Promise<void> {
    const { createSpecFile } = await import('./domains/projects.handlers.js');
    return createSpecFile.call(this, req, res);
  }

  public async getSpecFileContent(req: Request, res: Response): Promise<void> {
    const { getSpecFileContent } = await import('./domains/projects.handlers.js');
    return getSpecFileContent.call(this, req, res);
  }

  public async getAgentmuxMarkdownFiles(req: Request, res: Response): Promise<void> {
    const { getAgentmuxMarkdownFiles } = await import('./domains/projects.handlers.js');
    return getAgentmuxMarkdownFiles.call(this, req, res);
  }

  public async saveMarkdownFile(req: Request, res: Response): Promise<void> {
    const { saveMarkdownFile } = await import('./domains/projects.handlers.js');
    return saveMarkdownFile.call(this, req, res);
  }

  public async startProject(req: Request, res: Response): Promise<void> {
    const { startProject } = await import('./domains/projects.handlers.js');
    return startProject.call(this, req, res);
  }

  public async stopProject(req: Request, res: Response): Promise<void> {
    const { stopProject } = await import('./domains/projects.handlers.js');
    return stopProject.call(this, req, res);
  }

  public async restartProject(req: Request, res: Response): Promise<void> {
    const { restartProject } = await import('./domains/projects.handlers.js');
    return restartProject.call(this, req, res);
  }

  public async assignTeamsToProject(req: Request, res: Response): Promise<void> {
    const { assignTeamsToProject } = await import('./domains/projects.handlers.js');
    return assignTeamsToProject.call(this, req, res);
  }

  public async unassignTeamFromProject(req: Request, res: Response): Promise<void> {
    const { unassignTeamFromProject } = await import('./domains/projects.handlers.js');
    return unassignTeamFromProject.call(this, req, res);
  }

  // Tickets Methods
  public async createTicket(req: Request, res: Response): Promise<void> {
    const { createTicket } = await import('./domains/tickets.handlers.js');
    return createTicket.call(this, req, res);
  }

  public async getTickets(req: Request, res: Response): Promise<void> {
    const { getTickets } = await import('./domains/tickets.handlers.js');
    return getTickets.call(this, req, res);
  }

  public async getTicket(req: Request, res: Response): Promise<void> {
    const { getTicket } = await import('./domains/tickets.handlers.js');
    return getTicket.call(this, req, res);
  }

  public async updateTicket(req: Request, res: Response): Promise<void> {
    const { updateTicket } = await import('./domains/tickets.handlers.js');
    return updateTicket.call(this, req, res);
  }

  public async deleteTicket(req: Request, res: Response): Promise<void> {
    const { deleteTicket } = await import('./domains/tickets.handlers.js');
    return deleteTicket.call(this, req, res);
  }

  public async addSubtask(req: Request, res: Response): Promise<void> {
    const { addSubtask } = await import('./domains/tickets.handlers.js');
    return addSubtask.call(this, req, res);
  }

  public async toggleSubtask(req: Request, res: Response): Promise<void> {
    const { toggleSubtask } = await import('./domains/tickets.handlers.js');
    return toggleSubtask.call(this, req, res);
  }

  public async createTicketTemplate(req: Request, res: Response): Promise<void> {
    const { createTicketTemplate } = await import('./domains/tickets.handlers.js');
    return createTicketTemplate.call(this, req, res);
  }

  public async getTicketTemplates(req: Request, res: Response): Promise<void> {
    const { getTicketTemplates } = await import('./domains/tickets.handlers.js');
    return getTicketTemplates.call(this, req, res);
  }

  public async getTicketTemplate(req: Request, res: Response): Promise<void> {
    const { getTicketTemplate } = await import('./domains/tickets.handlers.js');
    return getTicketTemplate.call(this, req, res);
  }

  // Git Methods
  public async getGitStatus(req: Request, res: Response): Promise<void> {
    const { getGitStatus } = await import('./domains/git.handlers.js');
    return getGitStatus.call(this, req, res);
  }

  public async commitChanges(req: Request, res: Response): Promise<void> {
    const { commitChanges } = await import('./domains/git.handlers.js');
    return commitChanges.call(this, req, res);
  }

  public async startAutoCommit(req: Request, res: Response): Promise<void> {
    const { startAutoCommit } = await import('./domains/git.handlers.js');
    return startAutoCommit.call(this, req, res);
  }

  public async stopAutoCommit(req: Request, res: Response): Promise<void> {
    const { stopAutoCommit } = await import('./domains/git.handlers.js');
    return stopAutoCommit.call(this, req, res);
  }

  public async getCommitHistory(req: Request, res: Response): Promise<void> {
    const { getCommitHistory } = await import('./domains/git.handlers.js');
    return getCommitHistory.call(this, req, res);
  }

  public async createBranch(req: Request, res: Response): Promise<void> {
    const { createBranch } = await import('./domains/git.handlers.js');
    return createBranch.call(this, req, res);
  }

  public async createPullRequest(req: Request, res: Response): Promise<void> {
    const { createPullRequest } = await import('./domains/git.handlers.js');
    return createPullRequest.call(this, req, res);
  }

  // Orchestrator Methods
  public async getOrchestratorCommands(req: Request, res: Response): Promise<void> {
    const { getOrchestratorCommands } = await import('./domains/orchestrator.handlers.js');
    return getOrchestratorCommands.call(this, req, res);
  }

  public async executeOrchestratorCommand(req: Request, res: Response): Promise<void> {
    const { executeOrchestratorCommand } = await import('./domains/orchestrator.handlers.js');
    return executeOrchestratorCommand.call(this, req, res);
  }

  public async sendOrchestratorMessage(req: Request, res: Response): Promise<void> {
    const { sendOrchestratorMessage } = await import('./domains/orchestrator.handlers.js');
    return sendOrchestratorMessage.call(this, req, res);
  }

  public async sendOrchestratorEnter(req: Request, res: Response): Promise<void> {
    const { sendOrchestratorEnter } = await import('./domains/orchestrator.handlers.js');
    return sendOrchestratorEnter.call(this, req, res);
  }

  public async setupOrchestrator(req: Request, res: Response): Promise<void> {
    const { setupOrchestrator } = await import('./domains/orchestrator.handlers.js');
    return setupOrchestrator.call(this, req, res);
  }

  public async getOrchestratorHealth(req: Request, res: Response): Promise<void> {
    const { getOrchestratorHealth } = await import('./domains/orchestrator.handlers.js');
    return getOrchestratorHealth.call(this, req, res);
  }

  public async assignTaskToOrchestrator(req: Request, res: Response): Promise<void> {
    const { assignTaskToOrchestrator } = await import('./domains/orchestrator.handlers.js');
    return assignTaskToOrchestrator.call(this, req, res);
  }

  // Scheduler Methods
  public async scheduleCheck(req: Request, res: Response): Promise<void> {
    const { scheduleCheck } = await import('./domains/scheduler.handlers.js');
    return scheduleCheck.call(this, req, res);
  }

  public async getScheduledChecks(req: Request, res: Response): Promise<void> {
    const { getScheduledChecks } = await import('./domains/scheduler.handlers.js');
    return getScheduledChecks.call(this, req, res);
  }

  public async cancelScheduledCheck(req: Request, res: Response): Promise<void> {
    const { cancelScheduledCheck } = await import('./domains/scheduler.handlers.js');
    return cancelScheduledCheck.call(this, req, res);
  }

  // Terminal Methods
  public async listTerminalSessions(req: Request, res: Response): Promise<void> {
    const { listTerminalSessions } = await import('./domains/terminal.handlers.js');
    return listTerminalSessions.call(this, req, res);
  }

  public async captureTerminal(req: Request, res: Response): Promise<void> {
    const { captureTerminal } = await import('./domains/terminal.handlers.js');
    return captureTerminal.call(this, req, res);
  }

  public async sendTerminalInput(req: Request, res: Response): Promise<void> {
    const { sendTerminalInput } = await import('./domains/terminal.handlers.js');
    return sendTerminalInput.call(this, req, res);
  }

  public async sendTerminalKey(req: Request, res: Response): Promise<void> {
    const { sendTerminalKey } = await import('./domains/terminal.handlers.js');
    return sendTerminalKey.call(this, req, res);
  }

  // Errors Methods
  public async trackError(req: Request, res: Response): Promise<void> {
    const { trackError } = await import('./domains/errors.handlers.js');
    return trackError.call(this, req, res);
  }

  public async getErrorStats(req: Request, res: Response): Promise<void> {
    const { getErrorStats } = await import('./domains/errors.handlers.js');
    return getErrorStats.call(this, req, res);
  }

  public async getErrors(req: Request, res: Response): Promise<void> {
    const { getErrors } = await import('./domains/errors.handlers.js');
    return getErrors.call(this, req, res);
  }

  public async getError(req: Request, res: Response): Promise<void> {
    const { getError } = await import('./domains/errors.handlers.js');
    return getError.call(this, req, res);
  }

  public async clearErrors(req: Request, res: Response): Promise<void> {
    const { clearErrors } = await import('./domains/errors.handlers.js');
    return clearErrors.call(this, req, res);
  }

  // Scheduled Messages Methods
  public async createScheduledMessage(req: Request, res: Response): Promise<void> {
    const { createScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return createScheduledMessage.call(this, req, res);
  }

  public async getScheduledMessages(req: Request, res: Response): Promise<void> {
    const { getScheduledMessages } = await import('./domains/scheduled-messages.handlers.js');
    return getScheduledMessages.call(this, req, res);
  }

  public async getScheduledMessage(req: Request, res: Response): Promise<void> {
    const { getScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return getScheduledMessage.call(this, req, res);
  }

  public async updateScheduledMessage(req: Request, res: Response): Promise<void> {
    const { updateScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return updateScheduledMessage.call(this, req, res);
  }

  public async deleteScheduledMessage(req: Request, res: Response): Promise<void> {
    const { deleteScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return deleteScheduledMessage.call(this, req, res);
  }

  public async toggleScheduledMessage(req: Request, res: Response): Promise<void> {
    const { toggleScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return toggleScheduledMessage.call(this, req, res);
  }

  public async runScheduledMessage(req: Request, res: Response): Promise<void> {
    const { runScheduledMessage } = await import('./domains/scheduled-messages.handlers.js');
    return runScheduledMessage.call(this, req, res);
  }

  // Delivery Logs Methods
  public async getDeliveryLogs(req: Request, res: Response): Promise<void> {
    const { getDeliveryLogs } = await import('./domains/delivery-logs.handlers.js');
    return getDeliveryLogs.call(this, req, res);
  }

  public async clearDeliveryLogs(req: Request, res: Response): Promise<void> {
    const { clearDeliveryLogs } = await import('./domains/delivery-logs.handlers.js');
    return clearDeliveryLogs.call(this, req, res);
  }

  // Workflows Methods
  public async getWorkflowExecution(req: Request, res: Response): Promise<void> {
    const { getWorkflowExecution } = await import('./domains/workflows.handlers.js');
    return getWorkflowExecution.call(this, req, res);
  }

  public async getActiveWorkflows(req: Request, res: Response): Promise<void> {
    const { getActiveWorkflows } = await import('./domains/workflows.handlers.js');
    return getActiveWorkflows.call(this, req, res);
  }

  public async cancelWorkflowExecution(req: Request, res: Response): Promise<void> {
    const { cancelWorkflowExecution } = await import('./domains/workflows.handlers.js');
    return cancelWorkflowExecution.call(this, req, res);
  }

  // Config Files Methods
  public async getConfigFile(req: Request, res: Response): Promise<void> {
    const { getConfigFile } = await import('./domains/config.handlers.js');
    return getConfigFile.call(this, req, res);
  }

  // Project Tasks Methods
  public async getAllTasks(req: Request, res: Response): Promise<void> {
    const { getAllTasks } = await import('./domains/tasks.handlers.js');
    return getAllTasks.call(this, req, res);
  }

  public async getMilestones(req: Request, res: Response): Promise<void> {
    const { getMilestones } = await import('./domains/tasks.handlers.js');
    return getMilestones.call(this, req, res);
  }

  public async getTasksByStatus(req: Request, res: Response): Promise<void> {
    const { getTasksByStatus } = await import('./domains/tasks.handlers.js');
    return getTasksByStatus.call(this, req, res);
  }

  public async getTasksByMilestone(req: Request, res: Response): Promise<void> {
    const { getTasksByMilestone } = await import('./domains/tasks.handlers.js');
    return getTasksByMilestone.call(this, req, res);
  }

  public async getProjectTasksStatus(req: Request, res: Response): Promise<void> {
    const { getProjectTasksStatus } = await import('./domains/tasks.handlers.js');
    return getProjectTasksStatus.call(this, req, res);
  }
}

