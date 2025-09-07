import { Request, Response } from 'express';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../services/index.js';
import { TicketEditorService } from '../services/ticket-editor.service.js';
import { TaskService } from '../services/task.service.js';
import { TaskTrackingService } from '../services/task-tracking.service.js';
import { TaskFolderService } from '../services/task-folder.service.js';
import { ActiveProjectsService } from '../services/active-projects.service.js';
import { ContextLoaderService } from '../services/context-loader.service.js';
import { GitIntegrationService } from '../services/git-integration.service.js';
import { ConfigService } from '../services/config.service.js';
import { LoggerService } from '../services/logger.service.js';
import { MonitoringService } from '../services/monitoring.service.js';
import { WorkflowService } from '../services/workflow.service.js';
import { ErrorTrackingService } from '../services/error-tracking.service.js';
import { PromptTemplateService } from '../services/prompt-template.service.js';
import { Team, Project, Ticket, TeamConfig, TeamMember, ApiResponse, ScheduledMessage } from '../types/index.js';
import { TeamModel, ProjectModel, TicketModel, ScheduledMessageModel, MessageDeliveryLogModel } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ApiController {
  private taskService: TaskService;
  private taskTrackingService: TaskTrackingService;
  private taskFolderService: TaskFolderService;
  private activeProjectsService: ActiveProjectsService;
  private promptTemplateService: PromptTemplateService;

  constructor(
    private storageService: StorageService,
    private tmuxService: TmuxService,
    private schedulerService: SchedulerService,
    private messageSchedulerService?: MessageSchedulerService
  ) {
    this.taskService = new TaskService();
    this.taskTrackingService = new TaskTrackingService();
    this.taskFolderService = new TaskFolderService();
    this.activeProjectsService = new ActiveProjectsService(this.storageService);
    this.promptTemplateService = new PromptTemplateService();
  }

  // Team Management
  async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, members, projectPath, currentProject } = req.body as TeamConfig & { projectPath?: string; currentProject?: string };

      if (!name || !members || !Array.isArray(members) || members.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name and members array'
        } as ApiResponse);
        return;
      }

      // Validate each member
      for (const member of members) {
        if (!member.name || !member.role || !member.systemPrompt) {
          res.status(400).json({
            success: false,
            error: 'All team members must have name, role, and systemPrompt'
          } as ApiResponse);
          return;
        }
      }

      // Check for duplicate team names
      const existingTeams = await this.storageService.getTeams();
      if (existingTeams.find(t => t.name === name)) {
        res.status(500).json({
          success: false,
          error: `Team with name "${name}" already exists`
        } as ApiResponse);
        return;
      }

      const teamId = uuidv4();
      
      // Create team members with unique IDs (sessions will be created when assigned to project)
      const teamMembers = [];
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const memberId = uuidv4();
        // Session name will be set when team is assigned to a project

        const teamMember = {
          id: memberId,
          name: member.name,
          sessionName: '', // Empty initially, will be set during project assignment
          role: member.role,
          systemPrompt: member.systemPrompt,
          status: 'idle' as const,
          agentStatus: 'inactive' as const,
          workingStatus: 'idle' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        teamMembers.push(teamMember);
        // Note: tmux sessions will be created when team is assigned to a project
      }

      // Create team object with new structure
      const team = {
        id: teamId,
        name,
        description: description || '',
        members: teamMembers,
        currentProject: currentProject || undefined, // Use project ID from request if provided
        status: 'idle' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save team configuration
      await this.storageService.saveTeam(team);

      // Schedule default check-ins for all team members, but handle TPM differently
      for (const member of teamMembers) {
        if (member.role === 'tpm') {
          // TPM uses file-based workflow instead of time-based check-ins - temporarily disabled
          // this.scheduleTPMBuildSpecWorkflow(member.sessionName, team.currentProject);
          console.log(`TPM ${member.sessionName}: File-based workflow (no duplicate messages)`);
        } else {
          // All other roles get default scheduled check-ins
          this.schedulerService.scheduleDefaultCheckins(member.sessionName);
        }
      }

      res.status(201).json({
        success: true,
        data: team,
        message: 'Team created and sessions started successfully'
      } as ApiResponse<Team>);

    } catch (error) {
      console.error('Error creating team:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create team'
      } as ApiResponse);
    }
  }

  async getTeams(req: Request, res: Response): Promise<void> {
    try {
      const teams = await this.storageService.getTeams();
      
      // Get real orchestrator status
      const orchestratorStatus = await this.storageService.getOrchestratorStatus();
      
      // Create orchestrator team with real status
      const orchestratorTeam: Team = {
        id: 'orchestrator',
        name: 'Orchestrator Team',
        description: 'System orchestrator for project management',
        members: [
          {
            id: 'orchestrator-member',
            name: 'Agentmux Orchestrator',
            sessionName: 'agentmux-orc', // Hardcoded session ID
            role: 'orchestrator',
            systemPrompt: 'You are the AgentMux Orchestrator responsible for coordinating teams and managing project workflows.',
            status: orchestratorStatus?.status === 'active' ? 'active' : 'idle',
            agentStatus: orchestratorStatus?.agentStatus || (orchestratorStatus?.status === 'active' ? 'active' : 'inactive'),
            workingStatus: orchestratorStatus?.workingStatus || 'idle',
            createdAt: orchestratorStatus?.createdAt || new Date().toISOString(),
            updatedAt: orchestratorStatus?.updatedAt || new Date().toISOString()
          }
        ],
        status: orchestratorStatus?.status === 'active' ? 'active' : 'idle',
        createdAt: orchestratorStatus?.createdAt || new Date().toISOString(),
        updatedAt: orchestratorStatus?.updatedAt || new Date().toISOString()
      };
      
      // Add orchestrator team at the beginning of the list
      const allTeams = [orchestratorTeam, ...teams];
      
      // Include orchestrator status in response for banner
      res.json({
        success: true,
        data: allTeams,
        orchestrator: orchestratorStatus
      } as ApiResponse<Team[]>);

    } catch (error) {
      console.error('Error getting teams:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve teams'
      } as ApiResponse);
    }
  }

  async updateTeamStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['idle', 'working', 'blocked', 'terminated'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: idle, working, blocked, or terminated'
        } as ApiResponse);
        return;
      }

      await this.storageService.updateTeamStatus(id, status);

      res.json({
        success: true,
        message: 'Team status updated successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error updating team status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update team status'
      } as ApiResponse);
    }
  }

  async getTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Handle orchestrator team specially
      if (id === 'orchestrator') {
        const orchestratorStatus = await this.storageService.getOrchestratorStatus();
        const orchestratorTeam: Team = {
          id: 'orchestrator',
          name: 'Orchestrator Team',
          description: 'System orchestrator for project management',
          members: [
            {
              id: 'orchestrator-member',
              name: 'Agentmux Orchestrator',
              sessionName: 'agentmux-orc', // Hardcoded session ID
              role: 'orchestrator',
              systemPrompt: 'You are the AgentMux Orchestrator responsible for coordinating teams and managing project workflows.',
              status: orchestratorStatus?.status === 'active' ? 'active' : 'idle',
              agentStatus: orchestratorStatus?.agentStatus || (orchestratorStatus?.status === 'active' ? 'active' : 'inactive'),
              workingStatus: orchestratorStatus?.workingStatus || 'idle',
              createdAt: orchestratorStatus?.createdAt || new Date().toISOString(),
              updatedAt: orchestratorStatus?.updatedAt || new Date().toISOString()
            }
          ],
          status: orchestratorStatus?.status === 'active' ? 'active' : 'idle',
          createdAt: orchestratorStatus?.createdAt || new Date().toISOString(),
          updatedAt: orchestratorStatus?.updatedAt || new Date().toISOString()
        };
        
        res.json({
          success: true,
          data: orchestratorTeam
        } as ApiResponse<Team>);
        return;
      }
      
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: team
      } as ApiResponse<Team>);

    } catch (error) {
      console.error('Error getting team:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve team'
      } as ApiResponse);
    }
  }

  async startTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { projectId, enableGitReminder = false } = req.body;
      
      // Handle orchestrator team specially
      if (id === 'orchestrator') {
        const sessionExists = await this.tmuxService.sessionExists('agentmux-orc');
        
        if (!sessionExists) {
          // Create orchestrator session
          const createResult = await this.tmuxService.createOrchestratorSession({
            sessionName: 'agentmux-orc',
            projectPath: process.cwd(),
            windowName: 'orchestrator'
          });
          
          if (createResult.success) {
            // Initialize Claude in the orchestrator session
            const initResult = await this.tmuxService.initializeOrchestrator('agentmux-orc');
            
            res.json({
              success: true,
              message: `Orchestrator session created and ${initResult.success ? 'Claude initialized' : 'Claude initialization failed'}`,
              data: {
                sessionsCreated: 1,
                sessionsAlreadyRunning: 0,
                sessionName: 'agentmux-orc',
                claudeInitialized: initResult.success
              }
            } as ApiResponse);
          } else {
            res.status(500).json({
              success: false,
              error: `Failed to create orchestrator session: ${createResult.error}`,
              data: {
                sessionsCreated: 0,
                sessionsAlreadyRunning: 0
              }
            } as ApiResponse);
          }
        } else {
          res.json({
            success: true,
            message: 'Orchestrator session is already running',
            data: {
              sessionsCreated: 0,
              sessionsAlreadyRunning: 1,
              sessionName: 'agentmux-orc'
            }
          } as ApiResponse);
        }
        return;
      }
      
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Get all projects
      const projects = await this.storageService.getProjects();
      
      // Determine which project to use
      let targetProjectId = projectId || team.currentProject;
      
      if (!targetProjectId) {
        res.status(400).json({
          success: false,
          error: 'No project specified. Please select a project to assign this team to.'
        } as ApiResponse);
        return;
      }

      // Find the target project
      const assignedProject = projects.find(p => p.id === targetProjectId);
      
      if (!assignedProject) {
        res.status(400).json({
          success: false,
          error: 'Selected project not found. Please check project selection.'
        } as ApiResponse);
        return;
      }

      // If projectId was provided and it's different from current assignment, update the team
      if (projectId && projectId !== team.currentProject) {
        team.currentProject = projectId;
        team.updatedAt = new Date().toISOString();
        await this.storageService.saveTeam(team);
        console.log(`Team ${team.name} assigned to project ${assignedProject.name}`);
      }

      let sessionsCreated = 0;
      let sessionsAlreadyRunning = 0;
      const results = [];

      // Check existing sessions first (sequential because it's just checking)
      for (const member of team.members) {
        if (member.sessionName) {
          // Check if session still exists
          const sessionExists = await this.tmuxService.sessionExists(member.sessionName);
          if (sessionExists) {
            sessionsAlreadyRunning++;
            results.push({
              memberName: member.name,
              sessionName: member.sessionName,
              status: 'already_running'
            });
          } else {
            // Session name exists but session is dead, clear it and create new one
            member.sessionName = '';
          }
        }
      }

      // Create sessions for members that need them (controlled concurrency)
      const membersNeedingSessions = team.members.filter(member => !member.sessionName);
      
      if (membersNeedingSessions.length > 0) {
        console.log(`Creating ${membersNeedingSessions.length} team member sessions with controlled concurrency...`);
        
        // Process sessions in batches to avoid resource exhaustion
        const batchSize = 2; // Max 2 concurrent session creations to prevent EAGAIN errors
        const batches = [];
        
        for (let i = 0; i < membersNeedingSessions.length; i += batchSize) {
          batches.push(membersNeedingSessions.slice(i, i + batchSize));
        }
        
        console.log(`Processing ${batches.length} batches of ${batchSize} sessions each`);
        
        // Process each batch sequentially, but members within batch in parallel
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} sessions)`);
          
          const batchPromises = batch.map(async (member) => {
            // Generate unique session name using team name, member name, and member ID
            const teamSlug = team.name.replace(/\s+/g, '-').toLowerCase();
            const memberSlug = (member.name || member.role).replace(/\s+/g, '-').toLowerCase();
            const memberIdSlug = member.id.substring(0, 8); // Use first 8 chars of member ID for uniqueness
            const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;
            
            try {
              // Create tmux session for this team member
              const createResult = await this.tmuxService.createTeamMemberSession({
                name: member.name,
                role: member.role,
                systemPrompt: member.systemPrompt,
                projectPath: assignedProject.path, // Use the assigned project's path
                memberId: member.id
              }, sessionName);

              if (createResult.success) {
                member.sessionName = sessionName;
                return {
                  memberName: member.name,
                  sessionName,
                  status: 'created',
                  success: true
                };
              } else {
                return {
                  memberName: member.name,
                  sessionName: null,
                  status: 'failed',
                  error: createResult.error,
                  success: false
                };
              }
            } catch (error) {
              return {
                memberName: member.name,
                sessionName: null,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                success: false
              };
            }
          });

          // Wait for this batch to complete before starting next batch
          const batchResults = await Promise.all(batchPromises);
          
          // Process batch results
          batchResults.forEach(result => {
            if (result.success) {
              sessionsCreated++;
            }
            results.push(result);
          });

          console.log(`Batch ${batchIndex + 1} completed. Batch created: ${batchResults.filter(r => r.success).length}/${batchResults.length}`);
          
          // Small delay between batches to let system recover
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log(`Controlled parallel session creation completed. Total created: ${sessionsCreated}, Total results: ${results.length}`);
      }

      // Save updated team with session names
      if (sessionsCreated > 0) {
        team.updatedAt = new Date().toISOString();
        await this.storageService.saveTeam(team);
      }

      // Set up git reminder if requested
      let scheduledMessageId = null;
      if (enableGitReminder && this.messageSchedulerService) {
        const messageId = `git-reminder-${team.id}-${Date.now()}`;
        const gitReminderMessage: ScheduledMessage = {
          id: messageId,
          name: `Git Reminder for ${team.name}`,
          targetTeam: team.id,
          targetProject: assignedProject.id,
          message: `📝 Git Reminder: Time to commit your changes! Remember our 30-minute commit discipline.\n\n` +
                  `Project: ${assignedProject.name}\n` +
                  `Please check your progress and commit any pending changes:\n` +
                  `- Review your modified files\n` +
                  `- Add meaningful commit messages\n` +
                  `- Push changes if ready\n\n` +
                  `This is an automated reminder to help maintain good development practices.`,
          delayAmount: 30,
          delayUnit: 'minutes' as const,
          isRecurring: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          await this.storageService.saveScheduledMessage(gitReminderMessage);
          this.messageSchedulerService.scheduleMessage(gitReminderMessage);
          scheduledMessageId = messageId;
          console.log(`Created git reminder scheduled message for team ${team.name}: ${scheduledMessageId}`);
        } catch (error) {
          console.error('Error creating git reminder:', error);
          // Don't fail the team start if reminder creation fails
        }
      }

      const responseMessage = `Team started. Created ${sessionsCreated} new sessions, ${sessionsAlreadyRunning} already running. Sessions are working in project: ${assignedProject.name}` + 
        (enableGitReminder ? '. Git reminders enabled every 30 minutes.' : '');

      res.json({
        success: true,
        message: responseMessage,
        data: {
          sessionsCreated,
          sessionsAlreadyRunning,
          projectName: assignedProject.name,
          projectPath: assignedProject.path,
          gitReminderEnabled: enableGitReminder,
          scheduledMessageId,
          results
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error starting team:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start team'
      } as ApiResponse);
    }
  }

  async stopTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Handle orchestrator team specially - don't stop it
      if (id === 'orchestrator') {
        res.json({
          success: true,
          message: 'Orchestrator session cannot be stopped as it manages the system',
          data: {
            sessionsStopped: 0,
            sessionsNotFound: 0,
            results: []
          }
        } as ApiResponse);
        return;
      }
      
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);
      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      let sessionsStopped = 0;
      let sessionsNotFound = 0;
      const results = [];

      // Kill tmux sessions for all team members
      for (const member of team.members) {
        if (member.sessionName) {
          try {
            // Check if session exists before trying to kill it
            const sessionExists = await this.tmuxService.sessionExists(member.sessionName);
            if (sessionExists) {
              // Kill the tmux session
              await this.tmuxService.killSession(member.sessionName);
              sessionsStopped++;
              results.push({
                memberName: member.name,
                sessionName: member.sessionName,
                status: 'stopped'
              });
              console.log(`Stopped session ${member.sessionName} for ${member.name}`);
            } else {
              sessionsNotFound++;
              results.push({
                memberName: member.name,
                sessionName: member.sessionName,
                status: 'not_found'
              });
              console.log(`Session ${member.sessionName} for ${member.name} was already stopped`);
            }
            
            // Clear the session name from member
            member.sessionName = '';
          } catch (error) {
            results.push({
              memberName: member.name,
              sessionName: member.sessionName,
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`Failed to stop session ${member.sessionName} for ${member.name}:`, error);
            
            // Still clear the session name even if killing failed
            member.sessionName = '';
          }
        } else {
          results.push({
            memberName: member.name,
            sessionName: null,
            status: 'no_session'
          });
        }
      }

      // Save updated team (with cleared session names)
      team.updatedAt = new Date().toISOString();
      await this.storageService.saveTeam(team);

      // Cancel any recurring git reminders for this team
      if (this.messageSchedulerService) {
        try {
          // Get all scheduled messages and cancel team-related ones
          const scheduledMessages = await this.storageService.getScheduledMessages();
          const teamMessages = scheduledMessages.filter(msg => msg.targetTeam === team.id);
          
          for (const message of teamMessages) {
            message.isActive = false;
            await this.storageService.saveScheduledMessage(message);
            this.messageSchedulerService.cancelMessage(message.id);
          }
          
          if (teamMessages.length > 0) {
            console.log(`Cancelled ${teamMessages.length} scheduled messages for team ${team.name}`);
          }
        } catch (error) {
          console.error('Error cancelling team scheduled messages:', error);
          // Don't fail the team stop if message cancellation fails
        }
      }

      const responseMessage = `Team stopped. Stopped ${sessionsStopped} sessions, ${sessionsNotFound} were already stopped.`;
      
      res.json({
        success: true,
        message: responseMessage,
        data: {
          sessionsStopped,
          sessionsNotFound,
          results
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error stopping team:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop team'
      } as ApiResponse);
    }
  }

  async getTeamWorkload(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Get all projects and count assigned tickets
      const projects = await this.storageService.getProjects();
      let assignedTickets = 0;
      let completedTickets = 0;

      for (const project of projects) {
        const tickets = await this.storageService.getTickets(project.path, { assignedTo: id });
        assignedTickets += tickets.length;
        completedTickets += tickets.filter(t => t.status === 'done').length;
      }

      res.json({
        success: true,
        data: {
          teamId: id,
          teamName: team.name,
          assignedTickets,
          completedTickets,
          workloadPercentage: assignedTickets > 0 ? Math.round((completedTickets / assignedTickets) * 100) : 0
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting team workload:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve team workload'
      } as ApiResponse);
    }
  }

  async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Prevent deletion of orchestrator team
      if (id === 'orchestrator') {
        res.status(400).json({
          success: false,
          error: 'Cannot delete the Orchestrator Team'
        } as ApiResponse);
        return;
      }

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Notify orchestrator about team deletion first
      try {
        const orchestratorSession = 'agentmux-orc';
        const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
        
        if (sessionExists) {
          const sessionNames = team.members?.map(m => m.sessionName).filter(Boolean) || [];
          const sessionList = sessionNames.length > 0 ? sessionNames.join(', ') : 'None';
          
          const orchestratorPrompt = `## Team Deletion Notification

Team **"${team.name}"** (ID: ${id}) is being deleted.

### Sessions to be terminated:
${sessionNames.length > 0 ? sessionNames.map(name => `- ${name}`).join('\n') : '- No active sessions'}

### Team Details:
- **Team Name**: ${team.name}
- **Members**: ${team.members?.length || 0}
- **Current Project**: ${team.currentProject || 'None'}

The orchestrator should be aware that these team members are no longer available for task delegation.

---
*Team deletion initiated by user request.*`;

          await this.tmuxService.sendMessage(orchestratorSession, orchestratorPrompt);
          console.log(`Notified orchestrator about team deletion: ${team.name}`);
        }
      } catch (notificationError) {
        console.warn('Failed to notify orchestrator about team deletion:', notificationError);
        // Continue with deletion even if notification fails
      }

      // Kill tmux sessions for all team members
      if (team.members && team.members.length > 0) {
        for (const member of team.members) {
          if (member.sessionName) {
            try {
              await this.tmuxService.killSession(member.sessionName);
              this.schedulerService.cancelAllChecksForSession(member.sessionName);
              console.log(`Killed session: ${member.sessionName} for member: ${member.name}`);
            } catch (error) {
              console.warn(`Failed to kill session for member ${member.name}:`, error);
            }
          }
        }
      }

      // Remove team from storage
      await this.storageService.deleteTeam(id);

      res.json({
        success: true,
        message: 'Team terminated successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error deleting team:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to terminate team'
      } as ApiResponse);
    }
  }

  async getTeamMemberSession(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;
      const { lines = 50 } = req.query;

      // Get team to find member
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Find member in team
      const member = team.members?.find(m => m.id === memberId);
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      if (!member.sessionName) {
        res.status(400).json({
          success: false,
          error: 'No active session for this team member'
        } as ApiResponse);
        return;
      }

      // Capture terminal output
      const output = await this.tmuxService.capturePane(member.sessionName, Number(lines));
      
      res.json({
        success: true,
        data: {
          memberId: member.id,
          memberName: member.name,
          sessionName: member.sessionName,
          output: output,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse<{
        memberId: string;
        memberName: string;
        sessionName: string;
        output: string;
        timestamp: string;
      }>);

    } catch (error) {
      console.error('Error getting team member session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get team member session'
      } as ApiResponse);
    }
  }

  async addTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, role } = req.body;

      if (!name || !role) {
        res.status(400).json({
          success: false,
          error: 'Name and role are required'
        } as ApiResponse);
        return;
      }

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === id);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Create new member
      const newMember: TeamMember = {
        id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        sessionName: '', // Session name will be set when member is started
        role: role as TeamMember['role'],
        systemPrompt: `You are ${name}, a ${role} on the ${team.name} team.`,
        status: 'idle',
        agentStatus: 'inactive',
        workingStatus: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add member to team
      team.members.push(newMember);
      team.updatedAt = new Date().toISOString();

      await this.storageService.saveTeam(team);

      res.json({
        success: true,
        data: newMember,
        message: 'Team member added successfully'
      } as ApiResponse<TeamMember>);

    } catch (error) {
      console.error('Error adding team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add team member'
      } as ApiResponse);
    }
  }

  async updateTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;
      const updates = req.body;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const memberIndex = team.members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      // Update member with provided fields
      const updatedMember = {
        ...team.members[memberIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      team.members[memberIndex] = updatedMember;
      team.updatedAt = new Date().toISOString();

      await this.storageService.saveTeam(team);

      res.json({
        success: true,
        data: updatedMember,
        message: 'Team member updated successfully'
      } as ApiResponse<TeamMember>);

    } catch (error) {
      console.error('Error updating team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update team member'
      } as ApiResponse);
    }
  }

  async deleteTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const memberIndex = team.members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      const member = team.members[memberIndex];

      // Stop member's tmux session if it exists
      if (member.sessionName) {
        try {
          await this.tmuxService.killSession(member.sessionName);
          console.log(`Killed tmux session for member ${member.name}: ${member.sessionName}`);
        } catch (error) {
          console.warn(`Failed to kill tmux session ${member.sessionName}:`, error);
        }
      }

      // Remove member from team
      team.members.splice(memberIndex, 1);
      team.updatedAt = new Date().toISOString();

      await this.storageService.saveTeam(team);

      res.json({
        success: true,
        message: 'Team member removed successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error deleting team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete team member'
      } as ApiResponse);
    }
  }

  async startTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const memberIndex = team.members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      const member = team.members[memberIndex];

      // Check if member already has an active session
      if (member.sessionName) {
        const sessions = await this.tmuxService.listSessions();
        const hasActiveSession = sessions.some(s => s.sessionName === member.sessionName);
        
        if (hasActiveSession) {
          res.status(400).json({
            success: false,
            error: 'Team member already has an active session'
          } as ApiResponse);
          return;
        }
      }

      // Check if member is already in activating or active state
      if (member.status === 'activating' || member.status === 'active') {
        res.status(400).json({
          success: false,
          error: `Team member is already ${member.status}`
        } as ApiResponse);
        return;
      }

      // Update member status to activating
      team.members[memberIndex] = {
        ...member,
        status: 'activating', // Legacy field for backward compatibility
        agentStatus: 'activating', // New agent connection status
        workingStatus: member.workingStatus || 'idle', // Initialize working status if not set
        updatedAt: new Date().toISOString()
      };
      
      await this.storageService.saveTeam(team);

      // Create tmux session for the member
      try {
        const sessionConfig = {
          name: member.name,
          role: member.role,
          systemPrompt: member.systemPrompt,
          projectPath: team.currentProject ? 
            (await this.storageService.getProjects()).find(p => p.id === team.currentProject)?.path : 
            undefined,
          memberId: member.id
        };

        // Generate session name similar to how it's done in startTeam
        const teamSlug = team.name.toLowerCase().replace(/\s+/g, '-');
        const memberSlug = member.name.toLowerCase().replace(/\s+/g, '-');
        const memberIdSlug = member.id.substring(0, 8);
        const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;

        const createResult = await this.tmuxService.createTeamMemberSession(sessionConfig, sessionName);

        if (createResult.success) {
          // Update member with session information
          team.members[memberIndex] = {
            ...team.members[memberIndex],
            sessionName: createResult.sessionName || sessionName,
            status: 'activating', // Will be updated to 'active' once Claude reports ready
            updatedAt: new Date().toISOString()
          };

          await this.storageService.saveTeam(team);

          res.json({
            success: true,
            data: {
              memberId: member.id,
              sessionName: createResult.sessionName,
              status: 'activating'
            },
            message: `Team member ${member.name} started successfully`
          } as ApiResponse);

        } else {
          // Revert status on failure
          team.members[memberIndex] = {
            ...member,
            status: (member.status as TeamMember['status']) === 'activating' ? 'idle' : member.status,
            updatedAt: new Date().toISOString()
          };
          
          await this.storageService.saveTeam(team);

          res.status(500).json({
            success: false,
            error: createResult.error || 'Failed to create team member session'
          } as ApiResponse);
        }

      } catch (error) {
        // Revert status on failure
        team.members[memberIndex] = {
          ...member,
          status: (member.status as TeamMember['status']) === 'activating' ? 'idle' : member.status,
          updatedAt: new Date().toISOString()
        };
        
        await this.storageService.saveTeam(team);

        console.error('Error starting team member:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to start team member'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error starting team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start team member'
      } as ApiResponse);
    }
  }

  async stopTeamMember(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const memberIndex = team.members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      const member = team.members[memberIndex];

      try {
        // Kill the tmux session if it exists (ignore errors if session doesn't exist)
        if (member.sessionName) {
          try {
            await this.tmuxService.killSession(member.sessionName);
          } catch (error) {
            // Log but don't fail - session might already be dead
            console.log(`Session ${member.sessionName} could not be killed (might already be dead):`, error);
          }
        }

        // Always update member status to inactive regardless of session existence
        team.members[memberIndex] = {
          ...member,
          sessionName: '',
          status: 'idle',
          agentStatus: 'inactive',
          workingStatus: 'idle',
          updatedAt: new Date().toISOString()
        };

        await this.storageService.saveTeam(team);

        res.json({
          success: true,
          data: {
            memberId: member.id,
            status: 'idle'
          },
          message: `Team member ${member.name} stopped successfully`
        } as ApiResponse);

      } catch (error) {
        console.error('Error stopping team member session:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to stop team member session'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error stopping team member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop team member'
      } as ApiResponse);
    }
  }

  async getAlignmentStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Check if alignment_comparison.md exists
      const alignmentFilePath = path.join(project.path, '.agentmux', 'specs', 'alignment_comparison.md');
      
      try {
        await fs.access(alignmentFilePath);
        
        // File exists, read its content
        const content = await fs.readFile(alignmentFilePath, 'utf-8');
        
        res.json({
          success: true,
          data: {
            hasAlignmentIssues: true,
            alignmentFilePath,
            content
          }
        } as ApiResponse<{
          hasAlignmentIssues: boolean;
          alignmentFilePath: string;
          content: string;
        }>);
        
      } catch (accessError) {
        // File doesn't exist
        res.json({
          success: true,
          data: {
            hasAlignmentIssues: false,
            alignmentFilePath: null,
            content: null
          }
        } as ApiResponse<{
          hasAlignmentIssues: boolean;
          alignmentFilePath: string | null;
          content: string | null;
        }>);
      }

    } catch (error) {
      console.error('Error checking alignment status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check alignment status'
      } as ApiResponse);
    }
  }

  async continueWithMisalignment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Find the Build Specs PM team for this project
      const teams = await this.storageService.getTeams();
      const buildSpecsPMTeam = teams.find(team => 
        team.name.includes('Build Specs PM') && 
        project.teams?.pm?.includes(team.id)
      );

      if (!buildSpecsPMTeam) {
        res.status(404).json({
          success: false,
          error: 'Build Specs PM team not found for this project'
        } as ApiResponse);
        return;
      }

      // Remove alignment_comparison.md file since user decided to continue anyway
      try {
        const alignmentFilePath = path.join(project.path, '.agentmux', 'specs', 'alignment_comparison.md');
        if (fsSync.existsSync(alignmentFilePath)) {
          fsSync.unlinkSync(alignmentFilePath);
          console.log(`Removed alignment_comparison.md file: ${alignmentFilePath}`);
        }
      } catch (fileError) {
        console.warn('Failed to remove alignment_comparison.md file:', fileError);
        // Don't fail the entire operation if file removal fails
      }

      // Send message directly to PM session instead of orchestrator
      try {
        // Use the member's sessionName if available, otherwise use member's name as fallback
        const pmMember = buildSpecsPMTeam.members?.[0];
        if (!pmMember) {
          res.status(404).json({
            success: false,
            error: 'No PM member found in Build Specs team'
          } as ApiResponse);
          return;
        }
        
        const pmSessionName = pmMember.sessionName || pmMember.name;
        const sessionExists = await this.tmuxService.sessionExists(pmSessionName);
        
        if (sessionExists) {
          const pmPrompt = `## User Decision: Continue Build Specs Despite Alignment Issues

Project **"${project.name}"** (${project.path})

The user has reviewed your alignment comparison analysis and decided to **CONTINUE WITH BUILD SPECS** despite the codebase alignment issues you identified.

### Action Required:
Please proceed with the Build Specs workflow immediately:

1. ✅ Skip further alignment verification  
2. ✅ Begin creating comprehensive project specifications
3. ✅ Create task planning files as originally planned
4. ✅ Work with the existing codebase structure

The alignment issues have been acknowledged and the user accepts the potential conflicts between existing code and the specified goals/user journey.

### Next Steps:
Continue with specification creation workflow immediately. Start with creating the directory structure and then proceed to specification creation as outlined in your previous instructions.

---
*User override: Proceeding with Build Specs despite alignment conflicts*`;

          await this.tmuxService.sendMessage(pmSessionName, pmPrompt);
          console.log(`Notified PM ${pmSessionName} to continue Build Specs despite alignment issues for project: ${project.name}`);
        } else {
          console.warn(`PM session ${pmSessionName} does not exist`);
          res.status(404).json({
            success: false,
            error: `PM session ${pmSessionName} not found`
          } as ApiResponse);
          return;
        }
      } catch (notificationError) {
        console.error('Failed to notify PM about alignment override:', notificationError);
        res.status(500).json({
          success: false,
          error: 'Failed to notify PM about alignment override'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'PM notified to continue Build Specs despite alignment issues'
      } as ApiResponse);

    } catch (error) {
      console.error('Error continuing with misalignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to continue with misalignment'
      } as ApiResponse);
    }
  }

  async getBuildSpecConfig(req: Request, res: Response): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'build_spec_prompt.json');
      
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: 'Build spec config file not found'
        } as ApiResponse);
        return;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      res.json({
        success: true,
        data: config
      } as ApiResponse);

    } catch (error) {
      console.error('Error loading build spec config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load build spec config'
      } as ApiResponse);
    }
  }

  async retryBuildSpecStep(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, stepId, targetSession, projectName } = req.body;

      if (!projectId || !stepId || !targetSession) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: projectId, stepId, targetSession'
        } as ApiResponse);
        return;
      }

      // Load the build spec config to get the step prompts
      const configPath = path.join(process.cwd(), 'config', 'build_spec_prompt.json');
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: 'Build spec config file not found'
        } as ApiResponse);
        return;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      const step = config.steps.find((s: any) => s.id === stepId);

      if (!step) {
        res.status(404).json({
          success: false,
          error: `Step ${stepId} not found in build spec config`
        } as ApiResponse);
        return;
      }

      // Get the project for context
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Replace placeholders in prompts
      const processedPrompts = step.prompts.map((prompt: string) =>
        prompt
          .replace(/\{PROJECT_NAME\}/g, projectName || project.name)
          .replace(/\{PROJECT_ID\}/g, projectId)
          .replace(/\{PROJECT_PATH\}/g, project.path)
      );

      // Send the step prompts to the target session
      try {
        const sessionExists = await this.tmuxService.sessionExists(targetSession);
        
        if (!sessionExists) {
          console.warn(`Target session ${targetSession} does not exist for step retry`);
          res.status(404).json({
            success: false,
            error: `Session ${targetSession} not found`
          } as ApiResponse);
          return;
        }

        // Send all prompts for this step
        const fullPrompt = processedPrompts.join('\n\n');
        await this.tmuxService.sendMessage(targetSession, fullPrompt);

        res.json({
          success: true,
          message: `Step ${stepId} (${step.name}) retry sent to ${targetSession}`
        } as ApiResponse);

        console.log(`Retried step ${stepId}: ${step.name} for project ${projectName} -> ${targetSession}`);

      } catch (sessionError) {
        console.error('Failed to send step retry to session:', sessionError);
        res.status(500).json({
          success: false,
          error: 'Failed to send step retry to session'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error retrying build spec step:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry build spec step'
      } as ApiResponse);
    }
  }

  async getBuildTaskConfig(req: Request, res: Response): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'build_tasks_prompt.json');
      
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: 'Build task config file not found'
        } as ApiResponse);
        return;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      res.json({
        success: true,
        data: config
      } as ApiResponse<any>);

    } catch (error) {
      console.error('Error loading build task config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load build task config'
      } as ApiResponse);
    }
  }

  async getProjectTasksStatus(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        } as ApiResponse);
        return;
      }

      // Get the project
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const tasksPath = path.join(resolvedProjectPath, '.agentmux', 'tasks');

      // Check if tasks directory exists and scan for milestone directories
      let hasTasksDirectory = false;
      let milestoneDirectories: string[] = [];
      
      try {
        await fs.access(tasksPath);
        hasTasksDirectory = true;
        
        const files = await fs.readdir(tasksPath);
        for (const file of files) {
          const filePath = path.join(tasksPath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isDirectory() && file.match(/^m\d+_/)) {
            milestoneDirectories.push(file);
          }
        }
      } catch (error) {
        // Tasks directory doesn't exist, which is expected initially
        hasTasksDirectory = false;
      }

      res.json({
        success: true,
        data: {
          hasTasksDirectory,
          milestoneDirectories,
          tasksPath: tasksPath
        }
      } as ApiResponse<any>);

    } catch (error) {
      console.error('Error fetching project tasks status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch project tasks status'
      } as ApiResponse);
    }
  }

  async retryBuildTaskStep(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, stepId, targetSession, projectName } = req.body;

      if (!projectId || !stepId || !targetSession) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: projectId, stepId, targetSession'
        } as ApiResponse);
        return;
      }

      // Load the build task config to get the step prompts
      const configPath = path.join(process.cwd(), 'config', 'build_tasks_prompt.json');
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: 'Build task config file not found'
        } as ApiResponse);
        return;
      }

      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      const step = config.steps.find((s: any) => s.id === stepId);

      if (!step) {
        res.status(404).json({
          success: false,
          error: `Step ${stepId} not found in build task config`
        } as ApiResponse);
        return;
      }

      // Get the project for context
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      // Try to get initial goal and user journey from specs
      let initialGoal = '';
      let userJourney = '';

      try {
        const initialGoalPath = path.join(resolvedProjectPath, '.agentmux', 'specs', 'initial_goal.md');
        if (fsSync.existsSync(initialGoalPath)) {
          initialGoal = await fs.readFile(initialGoalPath, 'utf-8');
        }
      } catch (error) {
        console.warn('Could not read initial_goal.md:', error);
      }

      try {
        const userJourneyPath = path.join(resolvedProjectPath, '.agentmux', 'specs', 'initial_user_journey.md');
        if (fsSync.existsSync(userJourneyPath)) {
          userJourney = await fs.readFile(userJourneyPath, 'utf-8');
        }
      } catch (error) {
        console.warn('Could not read initial_user_journey.md:', error);
      }

      // Replace placeholders in prompts
      const processedPrompts = step.prompts.map((prompt: string) =>
        prompt
          .replace(/\{PROJECT_NAME\}/g, projectName || project.name)
          .replace(/\{PROJECT_ID\}/g, projectId)
          .replace(/\{PROJECT_PATH\}/g, resolvedProjectPath)
          .replace(/\{INITIAL_GOAL\}/g, initialGoal)
          .replace(/\{USER_JOURNEY\}/g, userJourney)
      );

      // Send the step prompts to the target session
      try {
        const sessionExists = await this.tmuxService.sessionExists(targetSession);
        
        if (!sessionExists) {
          console.warn(`Target session ${targetSession} does not exist for build task step retry`);
          res.status(404).json({
            success: false,
            error: `Session ${targetSession} not found`
          } as ApiResponse);
          return;
        }

        // Send all prompts for this step
        const fullPrompt = processedPrompts.join('\n\n');
        await this.tmuxService.sendMessage(targetSession, fullPrompt);

        res.json({
          success: true,
          message: `Build Task Step ${stepId} (${step.name}) retry sent to ${targetSession}`
        } as ApiResponse);

        console.log(`Retried build task step ${stepId}: ${step.name} for project ${projectName} -> ${targetSession}`);

      } catch (sessionError) {
        console.error('Failed to send build task step retry to session:', sessionError);
        res.status(500).json({
          success: false,
          error: 'Failed to send build task step retry to session'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error retrying build task step:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retry build task step'
      } as ApiResponse);
    }
  }

  // Task Management API Endpoints (for MCP tools)
  async assignTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskPath, memberId, sessionId } = req.body;

      if (!taskPath || !memberId || !sessionId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: taskPath, memberId, sessionId'
        } as ApiResponse);
        return;
      }

      // Move task from open to in_progress folder
      const newTaskPath = await this.taskFolderService.moveTaskToStatus(taskPath, 'in_progress');

      // Extract project info from path to track assignment
      const pathParts = taskPath.split('/');
      const projectPathIndex = pathParts.findIndex((part: string) => part === '.agentmux');
      if (projectPathIndex === -1) {
        res.status(400).json({
          success: false,
          error: 'Invalid task path: .agentmux not found'
        } as ApiResponse);
        return;
      }

      const projectPath = pathParts.slice(0, projectPathIndex).join('/');
      const taskFileName = pathParts[pathParts.length - 1];
      const taskName = taskFileName.replace(/^\d+_/, '').replace('.md', '').replace(/_/g, ' ');

      // Find project ID from path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => 
        p.path === projectPath || 
        path.resolve(process.cwd(), p.path) === projectPath
      );

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found for task path'
        } as ApiResponse);
        return;
      }

      // Extract role from filename
      const roleMatch = taskFileName.match(/_([a-z]+)\.md$/);
      const targetRole = roleMatch ? roleMatch[1] : 'unknown';

      // Track assignment
      await this.taskTrackingService.assignTask(
        project.id,
        newTaskPath,
        taskName,
        targetRole,
        memberId,
        sessionId
      );

      res.json({
        success: true,
        message: `Task assigned and moved to in_progress folder`,
        data: { newTaskPath }
      } as ApiResponse);

    } catch (error) {
      console.error('Error assigning task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign task'
      } as ApiResponse);
    }
  }

  async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskPath } = req.body;

      if (!taskPath) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: taskPath'
        } as ApiResponse);
        return;
      }

      // Move task to done folder
      const newTaskPath = await this.taskFolderService.moveTaskToStatus(taskPath, 'done');

      // Find and remove from tracking
      const allTasks = await this.taskTrackingService.getAllInProgressTasks();
      const task = allTasks.find(t => t.taskFilePath === taskPath);
      
      if (task) {
        await this.taskTrackingService.removeTask(task.id);
      }

      res.json({
        success: true,
        message: 'Task completed and moved to done folder',
        data: { newTaskPath }
      } as ApiResponse);

    } catch (error) {
      console.error('Error completing task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete task'
      } as ApiResponse);
    }
  }

  async blockTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskPath, reason } = req.body;

      if (!taskPath || !reason) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: taskPath, reason'
        } as ApiResponse);
        return;
      }

      // Move task to blocked folder
      const newTaskPath = await this.taskFolderService.moveTaskToStatus(taskPath, 'blocked');

      // Update tracking with block reason
      const allTasks = await this.taskTrackingService.getAllInProgressTasks();
      const task = allTasks.find(t => t.taskFilePath === taskPath);
      
      if (task) {
        await this.taskTrackingService.updateTaskStatus(task.id, 'blocked', reason);
      }

      res.json({
        success: true,
        message: 'Task blocked and moved to blocked folder',
        data: { newTaskPath, reason }
      } as ApiResponse);

    } catch (error) {
      console.error('Error blocking task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to block task'
      } as ApiResponse);
    }
  }

  async takeNextTask(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, memberRole, sessionId } = req.body;

      if (!projectId || !memberRole) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: projectId, memberRole'
        } as ApiResponse);
        return;
      }

      // Find project
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Resolve project path
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      // Get available open tasks
      const openTasks = await this.taskTrackingService.getOpenTasks(resolvedProjectPath);
      
      // Find task matching role (or fallback to any task)
      let bestTask = openTasks.find(task => task.targetRole === memberRole);
      if (!bestTask && openTasks.length > 0) {
        // Fallback: assign any available task if no role-specific task found
        bestTask = openTasks[0];
      }

      if (!bestTask) {
        res.json({
          success: true,
          message: 'No available tasks found for assignment',
          data: null
        } as ApiResponse);
        return;
      }

      // Assign the task (this will move it to in_progress and track it)
      const assignedTask = await this.taskTrackingService.assignTask(
        projectId,
        bestTask.filePath,
        bestTask.taskName,
        bestTask.targetRole,
        'current-member', // We'll need to get actual member ID
        sessionId || 'unknown-session'
      );

      // Move task file to in_progress folder
      const newTaskPath = await this.taskFolderService.moveTaskToStatus(bestTask.filePath, 'in_progress');

      res.json({
        success: true,
        message: 'Next task assigned successfully',
        data: {
          taskId: assignedTask.id,
          taskName: bestTask.taskName,
          taskPath: newTaskPath,
          targetRole: bestTask.targetRole,
          milestoneFolder: bestTask.milestoneFolder
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error taking next task:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to take next task'
      } as ApiResponse);
    }
  }

  async syncTaskStatus(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: projectId'
        } as ApiResponse);
        return;
      }

      // Find project
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Resolve project path
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      // Sync task status with file system
      await this.taskTrackingService.syncTasksWithFileSystem(resolvedProjectPath, projectId);

      res.json({
        success: true,
        message: 'Task status synchronized with file system'
      } as ApiResponse);

    } catch (error) {
      console.error('Error syncing task status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync task status'
      } as ApiResponse);
    }
  }

  async createTasksFromConfig(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, configType, targetRole } = req.body;
      
      if (!projectId || !configType || !targetRole) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: projectId, configType, and targetRole'
        } as ApiResponse);
        return;
      }
      
      // Get project details
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }
      
      // Load the JSON configuration
      const configPath = path.join(process.cwd(), 'config', `${configType}.json`);
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: `Configuration file not found: ${configType}.json`
        } as ApiResponse);
        return;
      }
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      // Generate tasks from config steps
      const tasksCreated = [];
      const milestoneId = `m0_${configType.replace('_prompt', '')}_tasks`;
      
      // Create milestone directory structure
      const milestoneDir = path.join(project.path, '.agentmux', 'tasks', milestoneId);
      await this.taskFolderService.createMilestoneStatusFolders(milestoneDir);
      
      // Load initial project specs for template substitution
      let initialGoal = '';
      let userJourney = '';
      
      try {
        const [goalResponse, journeyResponse] = await Promise.all([
          fs.readFile(path.join(project.path, '.agentmux', 'specs', 'initial_goal.md'), 'utf-8').catch(() => ''),
          fs.readFile(path.join(project.path, '.agentmux', 'specs', 'initial_user_journey.md'), 'utf-8').catch(() => '')
        ]);
        initialGoal = goalResponse;
        userJourney = journeyResponse;
      } catch (error) {
        console.warn('Could not load initial project specs for template substitution:', error);
      }
      
      // Template substitution function
      const substituteTemplate = (text: string): string => {
        return text
          .replace(/\{PROJECT_NAME\}/g, project.name)
          .replace(/\{PROJECT_PATH\}/g, project.path)
          .replace(/\{PROJECT_ID\}/g, project.id)
          .replace(/\{INITIAL_GOAL\}/g, initialGoal)
          .replace(/\{USER_JOURNEY\}/g, userJourney);
      };

      // Generate tasks for each step in the config
      for (const [index, step] of config.steps.entries()) {
        const taskId = `task_${String(index + 1).padStart(2, '0')}_${step.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        
        // Apply template substitution to step content
        const substitutedTitle = substituteTemplate(step.name);
        const substitutedDescription = step.description 
          ? substituteTemplate(step.description)
          : step.prompts 
            ? step.prompts.map((prompt: string) => substituteTemplate(prompt)).join('\n\n')
            : 'Task generated from configuration step.';
        
        // Create task content with frontmatter
        const taskContent = `---
id: ${taskId}
title: ${substitutedTitle}
status: open
priority: medium
targetRole: ${step.targetRole || targetRole}
assignedTo: orchestrator
createdAt: ${new Date().toISOString()}
milestoneId: ${milestoneId}
dependencies: ${step.dependencies ? JSON.stringify(step.dependencies) : '[]'}
estimatedHours: ${step.estimatedHours || 2}
---

# ${substitutedTitle}

## Description
${substitutedDescription}

## Acceptance Criteria
${step.verification ? 
  `- [ ] Verification: ${step.verification.type}${step.verification.paths ? ' - Check paths: ' + step.verification.paths.join(', ') : ''}`
  : '- [ ] Complete task as described'}

## Notes
- **Delay**: ${step.delayMinutes || 0} minutes
- **Config Type**: ${configType}
- **Step ID**: ${step.id}
- **Project**: ${project.name}
- **Project Path**: ${project.path}

Generated from ${configType} configuration on ${new Date().toLocaleString()}
`;

        // Save task file in 'open' folder
        const taskFilePath = path.join(milestoneDir, 'open', `${taskId}.md`);
        await fs.writeFile(taskFilePath, taskContent, 'utf-8');
        
        tasksCreated.push({
          id: taskId,
          title: substitutedTitle,
          filePath: taskFilePath,
          status: 'open',
          targetRole: step.targetRole || targetRole
        });
      }
      
      // Add task to global tracking for orchestrator assignment
      for (const task of tasksCreated) {
        await this.taskTrackingService.addTaskToQueue({
          projectId: projectId,
          taskFilePath: task.filePath,
          taskName: task.title,
          targetRole: task.targetRole,
          priority: 'medium',
          createdAt: new Date().toISOString()
        });
      }
      
      res.json({
        success: true,
        message: `Created ${tasksCreated.length} tasks from ${configType} configuration. Tasks assigned to orchestrator for ${targetRole} role assignment.`,
        data: {
          tasksCreated: tasksCreated.length,
          milestoneId,
          configType,
          targetRole,
          tasks: tasksCreated.map(t => ({ id: t.id, title: t.title, status: t.status }))
        }
      } as ApiResponse);
      
    } catch (error) {
      console.error('Error creating tasks from config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create tasks from configuration: ' + (error instanceof Error ? error.message : 'Unknown error')
      } as ApiResponse);
    }
  }

  async getTeamProgress(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.query;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Missing required query parameter: projectId'
        } as ApiResponse);
        return;
      }

      // Find project
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Get assigned teams for this project
      const allTeams = await this.storageService.getTeams();
      const assignedTeams = allTeams.filter(team => 
        Object.keys(project.teams).includes(team.id)
      );
      
      // Get in-progress tasks for this project
      const inProgressTasks = await this.taskTrackingService.getTasksForProject(projectId as string);

      // Get available open tasks
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const openTasks = await this.taskTrackingService.getOpenTasks(resolvedProjectPath);

      // Build team progress report
      const teamProgress = [];
      
      for (const team of assignedTeams) {
        for (const member of team.members) {
          const memberTasks = inProgressTasks.filter(t => t.assignedTeamMemberId === member.id);
          
          teamProgress.push({
            id: member.id,
            name: member.name,
            role: member.role,
            status: memberTasks.length > 0 ? 'working' : 'available',
            currentTasks: memberTasks.map(t => ({
              id: t.id,
              name: t.taskName,
              path: t.taskFilePath,
              assignedAt: t.assignedAt,
              status: t.status
            })),
            lastActivity: memberTasks.length > 0 ? 
              Math.max(...memberTasks.map(t => new Date(t.assignedAt).getTime())) : null
          });
        }
      }

      res.json({
        success: true,
        data: {
          project: {
            id: project.id,
            name: project.name,
            path: project.path
          },
          teamMembers: teamProgress,
          openTasks: openTasks.map(task => ({
            name: task.taskName,
            role: task.targetRole,
            milestone: task.milestoneFolder,
            path: task.filePath
          })),
          inProgressCount: inProgressTasks.length,
          openCount: openTasks.length
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting team progress:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get team progress'
      } as ApiResponse);
    }
  }

  // Project Management
  async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { path, name, description } = req.body;

      if (!path) {
        res.status(400).json({
          success: false,
          error: 'Project path is required'
        } as ApiResponse);
        return;
      }

      const project = await this.storageService.addProject(path);
      
      // Update project with name and description if provided
      if (name || description) {
        const projectModel = ProjectModel.fromJSON(project);
        if (name) (projectModel as any).name = name;
        if (description) (projectModel as any).description = description;
        const updatedProject = projectModel.toJSON();
        await this.storageService.saveProject(updatedProject);
        
        res.status(201).json({
          success: true,
          data: updatedProject,
          message: 'Project added successfully'
        } as ApiResponse<Project>);
        return;
      }

      res.status(201).json({
        success: true,
        data: project,
        message: 'Project added successfully'
      } as ApiResponse<Project>);

    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create project'
      } as ApiResponse);
    }
  }

  async getProjects(req: Request, res: Response): Promise<void> {
    try {
      const projects = await this.storageService.getProjects();
      
      res.json({
        success: true,
        data: projects
      } as ApiResponse<Project[]>);

    } catch (error) {
      console.error('Error getting projects:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve projects'
      } as ApiResponse);
    }
  }

  async getProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: project
      } as ApiResponse<Project>);

    } catch (error) {
      console.error('Error getting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project'
      } as ApiResponse);
    }
  }


  async assignTeamsToProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { teamAssignments } = req.body; // { [role]: [teamId] }

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const projectModel = ProjectModel.fromJSON(project);

      // Assign teams to project
      if (teamAssignments) {
        for (const [role, teamIds] of Object.entries(teamAssignments)) {
          for (const teamId of teamIds as string[]) {
            projectModel.assignTeam(teamId, role);
          }
        }
      }

      // Update project teams in storage
      await this.storageService.saveProject(projectModel.toJSON());

      // Update teams with their currentProject assignment and collect team details
      const assignedTeamDetails: Array<{ team: any, role: string }> = [];
      if (teamAssignments) {
        const teams = await this.storageService.getTeams();
        for (const [role, teamIds] of Object.entries(teamAssignments)) {
          for (const teamId of teamIds as string[]) {
            const team = teams.find(t => t.id === teamId);
            if (team) {
              team.currentProject = id;
              team.updatedAt = new Date().toISOString();
              await this.storageService.saveTeam(team);
              assignedTeamDetails.push({ team, role });
            }
          }
        }
      }

      // Notify orchestrator about team assignments with MCP tooling prompt
      if (assignedTeamDetails.length > 0) {
        try {
          const orchestratorSession = 'agentmux-orc';
          const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
          
          if (sessionExists) {
            const teamsInfo = assignedTeamDetails.map(({ team, role }) => 
              `### ${team.name} (${role})
- **Team ID**: ${team.id}
- **Members**: ${team.members?.length || 0} members
- **Session Names**: ${team.members?.map((m: any) => m.sessionName || 'N/A').join(', ') || 'No sessions'}
- **Member Details**: 
${team.members?.map((member: any) => `  - ${member.name} (${member.role}) - ${member.sessionName || 'N/A'}`).join('\n') || '  No members found'}`
            ).join('\n\n');

            const orchestratorPrompt = `## Team Assignment Notification

New team(s) have been assigned to project **${project.name}**!

${teamsInfo}

### Action Required:
Please use the MCP tooling to create and initialize the assigned team sessions. You should:

1. **Create tmux sessions** for each team member using their designated session names
2. **Initialize the project environment** in each session with the project path: \`${project.path}\`
3. **Set up the development context** for each team member based on their role
4. **Verify all sessions are active** and ready for collaboration

### MCP Command Suggestion:
Use the agentmux MCP tools to:
- Create team member sessions
- Initialize project workspace in each session
- Set up role-specific development environments
- Verify team readiness for project work

### Project Details:
- **Project Path**: ${project.path}
- **Project ID**: ${project.id}
- **Total Teams Assigned**: ${assignedTeamDetails.length}

---
*Please confirm when all team sessions have been created and initialized successfully.*`;

            await this.tmuxService.sendMessage(orchestratorSession, orchestratorPrompt);
            
            // Add a small delay and send Enter key directly via tmux send-keys
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Use spawn to send Enter key directly
            const { spawn } = await import('child_process');
            const tmuxProcess = spawn('tmux', ['send-keys', '-t', orchestratorSession, 'Enter']);
            
            await new Promise((resolve, reject) => {
              tmuxProcess.on('close', (code) => {
                if (code === 0) {
                  resolve(code);
                } else {
                  reject(new Error(`tmux send-keys failed with exit code ${code}`));
                }
              });
              tmuxProcess.on('error', reject);
            });
            
            console.log(`Notified orchestrator about team assignments: ${assignedTeamDetails.map(t => t.team.name).join(', ')} to ${project.name}`);
          }
        } catch (notificationError) {
          console.warn('Failed to notify orchestrator about team assignment:', notificationError);
          // Don't fail the request if notification fails
        }
      }

      res.json({
        success: true,
        data: projectModel.toJSON(),
        message: 'Teams assigned to project successfully'
      } as ApiResponse<Project>);

    } catch (error) {
      console.error('Error assigning teams to project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign teams to project'
      } as ApiResponse);
    }
  }

  async unassignTeamFromProject(req: Request, res: Response): Promise<void> {
    try {
      const { id: projectId } = req.params;
      const { teamId } = req.body;

      if (!teamId) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: teamId'
        } as ApiResponse);
        return;
      }

      // Get and validate project exists
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Get and validate team exists
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);

      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Verify team is actually assigned to this project
      if (team.currentProject !== projectId) {
        res.status(400).json({
          success: false,
          error: 'Team is not assigned to this project'
        } as ApiResponse);
        return;
      }

      const projectModel = ProjectModel.fromJSON(project);

      // Remove team from project
      projectModel.unassignTeam(teamId);

      // Update project in storage
      await this.storageService.saveProject(projectModel.toJSON());

      // Clear team's currentProject assignment
      team.currentProject = undefined;
      team.updatedAt = new Date().toISOString();
      await this.storageService.saveTeam(team);

      // Notify orchestrator about team unassignment
      try {
        const orchestratorSession = 'agentmux-orc';
        const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
        
        if (sessionExists) {
          const notificationMessage = `## Team Unassignment Notification

Team **${team.name}** has been unassigned from project **${project.name}**.

### Team Details:
- **Team ID**: ${team.id}
- **Team Name**: ${team.name}  
- **Members**: ${team.members?.length || 0} members
- **Previous Project**: ${project.name}

### Action Required:
Please coordinate the cleanup of team member sessions and update any active workflows accordingly.

### Team Members to Clean Up:
${team.members?.map(member => `- ${member.name} (${member.role}) - Session: ${member.sessionName || 'N/A'}`).join('\n') || 'No members found'}

---
*This notification was sent automatically when the team was unassigned from the project.*`;

          await this.tmuxService.sendMessage(orchestratorSession, notificationMessage);
          
          // Add a small delay and send Enter key directly via tmux send-keys
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use spawn to send Enter key directly
          const { spawn } = await import('child_process');
          const tmuxProcess = spawn('tmux', ['send-keys', '-t', orchestratorSession, 'Enter']);
          
          await new Promise((resolve, reject) => {
            tmuxProcess.on('close', (code) => {
              if (code === 0) {
                resolve(code);
              } else {
                reject(new Error(`tmux send-keys failed with exit code ${code}`));
              }
            });
            tmuxProcess.on('error', reject);
          });
          
          console.log(`Notified orchestrator about team unassignment: ${team.name} from ${project.name}`);
        }
      } catch (notificationError) {
        console.warn('Failed to notify orchestrator about team unassignment:', notificationError);
        // Don't fail the request if notification fails
      }

      res.json({
        success: true,
        data: projectModel.toJSON(),
        message: `Team "${team.name}" unassigned from project "${project.name}" successfully`
      } as ApiResponse<Project>);

    } catch (error) {
      console.error('Error unassigning team from project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unassign team from project'
      } as ApiResponse);
    }
  }

  async getProjectStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Get active tickets
      const tickets = await this.storageService.getTickets(project.path);
      const activeTickets = tickets.filter(t => t.status !== 'done');

      res.json({
        success: true,
        data: {
          project,
          activeTickets: activeTickets.length,
          totalTickets: tickets.length,
          teams: project.teams || {}
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting project status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project status'
      } as ApiResponse);
    }
  }

  async getProjectFiles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { depth = '3', includeDotFiles = 'true' } = req.query;
      
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Recursive file tree builder
      const buildFileTree = async (
        dirPath: string, 
        relativePath: string = '', 
        currentDepth: number = 0, 
        maxDepth: number = parseInt(depth as string)
      ): Promise<any[]> => {
        if (currentDepth > maxDepth) {
          return [];
        }

        try {
          const items = await fs.readdir(dirPath);
          const tree = [];
          console.log(`Reading directory: ${dirPath} (depth: ${currentDepth}/${maxDepth}), found ${items.length} items: ${items.join(', ')}`);

          for (const item of items) {
            // Always include .agentmux folder, otherwise respect includeDotFiles setting
            const isAgentmuxFolder = item === '.agentmux';
            const isDotFile = item.startsWith('.');
            
            if (isDotFile && !isAgentmuxFolder && includeDotFiles !== 'true') {
              console.log(`Skipping dot file: ${item} (includeDotFiles: ${includeDotFiles})`);
              continue;
            }

            const fullPath = path.join(dirPath, item);
            const relativeItemPath = relativePath ? path.join(relativePath, item) : item;
            
            try {
              const stats = await fs.stat(fullPath);
              
              const fileNode: any = {
                name: item,
                path: relativeItemPath,
                type: stats.isDirectory() ? 'folder' : 'file',
                size: stats.size,
                modified: stats.mtime.toISOString(),
                icon: this.getFileIcon(item, stats.isDirectory())
              };

              if (stats.isDirectory()) {
                // Recursively get children for directories
                fileNode.children = await buildFileTree(
                  fullPath, 
                  relativeItemPath, 
                  currentDepth + 1, 
                  maxDepth
                );
              }

              tree.push(fileNode);
            } catch (statError) {
              // Skip files/folders that can't be accessed
              continue;
            }
          }

          // Sort: .agentmux first, then directories, then files, all alphabetically within their groups
          return tree.sort((a, b) => {
            // .agentmux folder always comes first
            if (a.name === '.agentmux') return -1;
            if (b.name === '.agentmux') return 1;
            
            // Then sort by type (folders before files)
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            
            // Finally sort alphabetically within the same type
            return a.name.localeCompare(b.name);
          });

        } catch (error) {
          console.error(`Error reading directory ${dirPath}:`, error);
          return [];
        }
      };

      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        // Resolve the project path to an absolute path
        // If the project path is relative, try resolving it relative to parent directory first
        let resolvedPath: string;
        if (path.isAbsolute(project.path)) {
          resolvedPath = project.path;
        } else {
          // Try resolving relative to parent directory (where sibling projects should be)
          const parentDir = path.dirname(process.cwd());
          const parentResolved = path.resolve(parentDir, project.path);
          
          // Check if the path exists in parent directory
          try {
            await fs.stat(parentResolved);
            resolvedPath = parentResolved;
          } catch {
            // If not found in parent, fall back to resolving from current directory
            resolvedPath = path.resolve(project.path);
          }
        }
        console.log(`Building file tree for project "${project.name}"`);
        console.log(`Original path: "${project.path}"`);
        console.log(`Resolved path: "${resolvedPath}"`);
        console.log(`Current working directory: "${process.cwd()}"`);
        console.log(`Path.isAbsolute(project.path): ${path.isAbsolute(project.path)}`);
        
        // Check if the resolved project path exists and is accessible
        try {
          const pathStats = await fs.stat(resolvedPath);
          console.log(`Resolved path exists and is ${pathStats.isDirectory() ? 'a directory' : 'not a directory'}`);
        } catch (pathError) {
          console.error(`Resolved project path "${resolvedPath}" is not accessible:`, pathError);
          res.status(400).json({
            success: false,
            error: `Project path "${resolvedPath}" is not accessible: ${pathError instanceof Error ? pathError.message : 'Unknown error'}`
          } as ApiResponse);
          return;
        }
        
        const fileTree = await buildFileTree(resolvedPath);
        console.log(`Built file tree with ${fileTree.length} top-level items`);

        res.json({
          success: true,
          data: {
            projectId: project.id,
            projectName: project.name,
            projectPath: project.path,
            resolvedPath: resolvedPath,
            files: fileTree,
            totalFiles: this.countFiles(fileTree),
            generatedAt: new Date().toISOString()
          }
        } as ApiResponse);

      } catch (fsError) {
        console.error('Error building file tree:', fsError);
        res.json({
          success: true,
          data: {
            projectId: project.id,
            projectName: project.name,
            projectPath: project.path,
            files: [],
            totalFiles: 0,
            generatedAt: new Date().toISOString()
          }
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error getting project files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project files'
      } as ApiResponse);
    }
  }

  // Helper method to get file icons
  private getFileIcon(fileName: string, isDirectory: boolean): string {
    if (isDirectory) {
      // Special folder icons
      if (fileName === '.agentmux') return '⚙️';
      if (fileName === 'node_modules') return '📦';
      if (fileName === '.git') return '🔗';
      if (fileName === 'src' || fileName === 'source') return '📁';
      if (fileName === 'test' || fileName === 'tests' || fileName === '__tests__') return '🧪';
      if (fileName === 'docs' || fileName === 'documentation') return '📚';
      if (fileName === 'assets' || fileName === 'images') return '🖼️';
      if (fileName === 'components') return '🧩';
      if (fileName === 'lib' || fileName === 'libs') return '📚';
      if (fileName === 'config') return '⚙️';
      if (fileName === 'scripts') return '📜';
      if (fileName === 'dist' || fileName === 'build') return '📦';
      return '📁';
    } else {
      // File extension based icons
      const ext = fileName.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'js': case 'jsx': return '📄';
        case 'ts': case 'tsx': return '🔵';
        case 'py': return '🐍';
        case 'java': return '☕';
        case 'cpp': case 'c': case 'cc': return '⚙️';
        case 'rs': return '🦀';
        case 'go': return '🐹';
        case 'rb': return '💎';
        case 'php': return '🐘';
        case 'html': case 'htm': return '🌐';
        case 'css': case 'scss': case 'sass': case 'less': return '🎨';
        case 'json': case 'yaml': case 'yml': case 'toml': return '⚙️';
        case 'md': case 'markdown': return '📝';
        case 'txt': case 'log': return '📄';
        case 'pdf': return '📕';
        case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼️';
        case 'mp4': case 'avi': case 'mov': return '🎬';
        case 'mp3': case 'wav': case 'flac': return '🎵';
        case 'zip': case 'tar': case 'gz': case 'rar': return '📦';
        case 'lock': return '🔒';
        case 'env': return '🔐';
        case 'dockerfile': return '🐳';
        case 'sh': case 'bash': case 'zsh': return '📜';
        case 'gitignore': return '🚫';
        default: return '📄';
      }
    }
  }

  // Helper method to count total files in tree
  private countFiles(tree: any[]): number {
    let count = 0;
    for (const node of tree) {
      if (node.type === 'file') {
        count++;
      } else if (node.children) {
        count += this.countFiles(node.children);
      }
    }
    return count;
  }

  async getProjectCompletion(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const tickets = await this.storageService.getTickets(project.path);
      const completedTickets = tickets.filter(t => t.status === 'done');
      const completionRate = tickets.length > 0 ? Math.round((completedTickets.length / tickets.length) * 100) : 0;

      res.json({
        success: true,
        data: {
          totalTickets: tickets.length,
          completedTickets: completedTickets.length,
          completionRate,
          isCompleted: completionRate === 100
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting project completion:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project completion'
      } as ApiResponse);
    }
  }

  async deleteProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Check for active teams
      const teams = await this.storageService.getTeams();
      const activeTeams = teams.filter(t => t.currentProject === id);

      if (activeTeams.length > 0) {
        // Unassign teams from project
        for (const team of activeTeams) {
          const teamModel = TeamModel.fromJSON(team);
          // Clear the project assignment
          (teamModel as any).currentProject = undefined;
          await this.storageService.saveTeam(teamModel.toJSON());
        }
      }

      // Delete project from storage (only removes from ~/.agentmux/projects.json, keeps .agentmux folder)
      await this.storageService.deleteProject(id);

      res.json({
        success: true,
        message: `Project deleted successfully. ${activeTeams.length} teams were unassigned.`
      } as ApiResponse);

    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete project'
      } as ApiResponse);
    }
  }


  // Scheduler Management
  async scheduleCheck(req: Request, res: Response): Promise<void> {
    try {
      const { targetSession, minutes, message, isRecurring, intervalMinutes } = req.body;

      if (!targetSession || !minutes || !message) {
        res.status(400).json({
          success: false,
          error: 'targetSession, minutes, and message are required'
        } as ApiResponse);
        return;
      }

      let checkId: string;

      if (isRecurring && intervalMinutes) {
        checkId = this.schedulerService.scheduleRecurringCheck(targetSession, intervalMinutes, message);
      } else {
        checkId = this.schedulerService.scheduleCheck(targetSession, minutes, message);
      }

      res.status(201).json({
        success: true,
        data: { checkId },
        message: 'Check-in scheduled successfully'
      } as ApiResponse<{ checkId: string }>);

    } catch (error) {
      console.error('Error scheduling check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule check-in'
      } as ApiResponse);
    }
  }

  async getScheduledChecks(req: Request, res: Response): Promise<void> {
    try {
      const { session } = req.query;

      let checks;
      if (session) {
        checks = this.schedulerService.getChecksForSession(session as string);
      } else {
        checks = this.schedulerService.listScheduledChecks();
      }

      res.json({
        success: true,
        data: checks
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting scheduled checks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve scheduled checks'
      } as ApiResponse);
    }
  }

  async cancelScheduledCheck(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      this.schedulerService.cancelCheck(id);

      res.json({
        success: true,
        message: 'Check-in cancelled successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error cancelling check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel check-in'
      } as ApiResponse);
    }
  }

  // Terminal Management
  async listTerminalSessions(req: Request, res: Response): Promise<void> {
    try {
      const sessions = await this.tmuxService.listSessions();
      res.json({
        success: true,
        data: sessions
      } as ApiResponse);
    } catch (error) {
      console.error('Error listing terminal sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list terminal sessions'
      } as ApiResponse);
    }
  }

  async captureTerminal(req: Request, res: Response): Promise<void> {
    try {
      const { session } = req.params;
      const { lines } = req.query;

      const output = await this.tmuxService.capturePane(
        session, 
        lines ? parseInt(lines as string) : 100
      );

      res.json({
        success: true,
        data: { output, session }
      } as ApiResponse);

    } catch (error) {
      console.error('Error capturing terminal:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to capture terminal output'
      } as ApiResponse);
    }
  }

  async sendTerminalInput(req: Request, res: Response): Promise<void> {
    try {
      const { session } = req.params;
      const { input } = req.body;

      if (!input) {
        res.status(400).json({
          success: false,
          error: 'Input is required'
        } as ApiResponse);
        return;
      }

      await this.tmuxService.sendMessage(session, input);

      res.json({
        success: true,
        message: 'Input sent successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error sending terminal input:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send terminal input'
      } as ApiResponse);
    }
  }

  async sendTerminalKey(req: Request, res: Response): Promise<void> {
    try {
      const { session } = req.params;
      const { key } = req.body;

      if (!key) {
        res.status(400).json({
          success: false,
          error: 'Key is required'
        } as ApiResponse);
        return;
      }

      await this.tmuxService.sendKey(session, key);

      res.json({
        success: true,
        message: 'Key sent successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error sending terminal key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send terminal key'
      } as ApiResponse);
    }
  }

  async getFileContent(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { filePath } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        res.status(400).json({
          success: false,
          error: 'File path is required'
        } as ApiResponse);
        return;
      }

      // Get project to verify it exists and get project path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution (same as getProjectFiles)
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        // Try parent directory first
        const parentDir = path.dirname(process.cwd());
        const parentResolved = path.resolve(parentDir, project.path);
        
        try {
          await fs.stat(parentResolved);
          resolvedProjectPath = parentResolved;
          console.log(`✅ Using parent directory path: ${resolvedProjectPath}`);
        } catch {
          resolvedProjectPath = path.resolve(project.path);
          console.log(`⚠️ Fallback to current directory path: ${resolvedProjectPath}`);
        }
      }

      // Read file content
      const fullFilePath = path.join(resolvedProjectPath, filePath);
      console.log(`🔍 Attempting to read file: ${fullFilePath}`);
      
      // Security check - ensure file is within project directory
      const resolvedFilePath = path.resolve(fullFilePath);
      
      if (!resolvedFilePath.startsWith(resolvedProjectPath)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: File outside project directory'
        } as ApiResponse);
        return;
      }

      try {
        const content = await fs.readFile(fullFilePath, 'utf8');
        res.json({
          success: true,
          data: { content, filePath }
        } as ApiResponse<{ content: string; filePath: string }>);
      } catch (fileError: any) {
        if (fileError.code === 'ENOENT') {
          res.status(404).json({
            success: false,
            error: 'File not found'
          } as ApiResponse);
        } else if (fileError.code === 'EISDIR') {
          res.status(400).json({
            success: false,
            error: 'Path is a directory, not a file'
          } as ApiResponse);
        } else {
          throw fileError;
        }
      }

    } catch (error) {
      console.error('Error reading file content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to read file content'
      } as ApiResponse);
    }
  }

  async getAgentmuxMarkdownFiles(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath, type } = req.query;
      
      if (!projectPath || typeof projectPath !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Project path is required'
        } as ApiResponse);
        return;
      }

      const agentmuxPath = path.join(projectPath, '.agentmux');
      
      // Check if .agentmux directory exists
      try {
        await fs.access(agentmuxPath);
      } catch {
        // Create .agentmux directory if it doesn't exist
        await fs.mkdir(agentmuxPath, { recursive: true });
        await fs.mkdir(path.join(agentmuxPath, 'specs'), { recursive: true });
      }

      const files: string[] = [];
      
      // Look for markdown files in .agentmux and its subdirectories
      const scanDirectory = async (dirPath: string, relativePath = '') => {
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativeFilePath = path.join(relativePath, entry.name);
            
            if (entry.isDirectory()) {
              // Recursively scan subdirectories
              await scanDirectory(fullPath, relativeFilePath);
            } else if (entry.name.endsWith('.md')) {
              files.push(relativeFilePath);
            }
          }
        } catch (error) {
          // Ignore directories that can't be read
        }
      };

      await scanDirectory(agentmuxPath);

      res.json({
        success: true,
        data: { files }
      } as ApiResponse<{ files: string[] }>);

    } catch (error) {
      console.error('Error scanning .agentmux files:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to scan .agentmux files'
      } as ApiResponse);
    }
  }

  async saveMarkdownFile(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath, filePath, content } = req.body;
      
      if (!projectPath || !filePath || content === undefined) {
        res.status(400).json({
          success: false,
          error: 'Project path, file path, and content are required'
        } as ApiResponse);
        return;
      }

      // Construct full file path
      const fullFilePath = path.join(projectPath, filePath);
      
      // Security check - ensure file is within project directory
      const resolvedProjectPath = path.resolve(projectPath);
      const resolvedFilePath = path.resolve(fullFilePath);
      
      if (!resolvedFilePath.startsWith(resolvedProjectPath)) {
        res.status(403).json({
          success: false,
          error: 'Access denied: File outside project directory'
        } as ApiResponse);
        return;
      }

      // Ensure the directory exists
      const dirPath = path.dirname(fullFilePath);
      await fs.mkdir(dirPath, { recursive: true });

      // Write the file
      await fs.writeFile(fullFilePath, content, 'utf8');

      res.json({
        success: true,
        message: 'File saved successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error saving markdown file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save file'
      } as ApiResponse);
    }
  }

  async startProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { teamIds } = req.body;
      
      if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Team IDs array is required'
        } as ApiResponse);
        return;
      }

      // For now, support single team assignment
      // TODO: Support multiple teams in a single project
      const teamId = teamIds[0];
      
      // Get project details
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Get team details
      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);
      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      // Start the workflow orchestration
      const workflowService = WorkflowService.getInstance();
      const result = await workflowService.startProject({
        projectId: id,
        teamId: teamId
      });

      if (result.success) {
        // Update project status
        project.status = 'active';
        await this.storageService.saveProject(project);

        // Start project lifecycle management with scheduled check-ins
        let scheduleInfo;
        try {
          scheduleInfo = await this.activeProjectsService.startProject(id, this.messageSchedulerService);
        } catch (scheduleError) {
          console.warn('Failed to start project lifecycle management:', scheduleError);
        }

        res.json({
          success: true,
          message: result.message || 'Project orchestration started successfully',
          data: {
            projectId: id,
            teamId: teamId,
            executionId: result.executionId,
            orchestrationStarted: true,
            checkInScheduleId: scheduleInfo?.checkInScheduleId,
            gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId
          }
        } as ApiResponse<{
          projectId: string;
          teamId: string;
          executionId: string;
          orchestrationStarted: boolean;
          checkInScheduleId?: string;
          gitCommitScheduleId?: string;
        }>);
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to start project orchestration'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error starting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start project'
      } as ApiResponse);
    }
  }

  async stopProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get project details
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Stop project lifecycle management
      try {
        await this.activeProjectsService.stopProject(id, this.messageSchedulerService);
      } catch (scheduleError) {
        console.warn('Failed to stop project lifecycle management:', scheduleError);
      }

      // Update project status
      project.status = 'stopped';
      await this.storageService.saveProject(project);

      res.json({
        success: true,
        message: 'Project stopped successfully',
        data: {
          projectId: id,
          status: 'stopped'
        }
      } as ApiResponse<{
        projectId: string;
        status: string;
      }>);

    } catch (error) {
      console.error('Error stopping project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop project'
      } as ApiResponse);
    }
  }

  async restartProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get project details
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Restart project lifecycle management
      let scheduleInfo;
      try {
        scheduleInfo = await this.activeProjectsService.restartProject(id, this.messageSchedulerService);
      } catch (scheduleError) {
        console.warn('Failed to restart project lifecycle management:', scheduleError);
      }

      // Update project status
      project.status = 'active';
      await this.storageService.saveProject(project);

      res.json({
        success: true,
        message: 'Project restarted successfully',
        data: {
          projectId: id,
          status: 'active',
          checkInScheduleId: scheduleInfo?.checkInScheduleId,
          gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId
        }
      } as ApiResponse<{
        projectId: string;
        status: string;
        checkInScheduleId?: string;
        gitCommitScheduleId?: string;
      }>);

    } catch (error) {
      console.error('Error restarting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restart project'
      } as ApiResponse);
    }
  }

  private buildProjectContextMessage(project: any, team: any, member: any): string {
    return `# Project Context Loaded

**Project**: ${project.name}
**Path**: ${project.path}
**Your Role**: ${member.role}
**Team**: ${team.name}

## Project Description
${project.description || 'No description provided'}

## Your Responsibilities
${member.systemPrompt}

## Getting Started
You are now in the project directory. You can:
- Explore the codebase: \`ls\`, \`find . -name "*.js"\`, etc.
- Check project status: \`git status\`, \`npm run build\`  
- Review specifications: \`cat .agentmux/specs/*.md\`
- View tasks: \`ls .agentmux/tasks/\`

Ready to work! Type your commands below.`;
  }

  // Assignments API endpoints
  async getAssignments(req: Request, res: Response): Promise<void> {
    try {
      const projects = await this.storageService.getProjects();
      const teams = await this.storageService.getTeams();
      
      const assignments = [];
      
      // Create assignments from project-team relationships
      for (const project of projects) {
        for (const teamId of Object.values(project.teams).flat()) {
          const team = teams.find(t => t.id === teamId);
          if (team) {
            assignments.push({
              id: `${project.id}-${teamId}`,
              title: `${project.name} - ${team.name}`,
              description: 'No description available',
              status: project.status === 'active' ? 'in-progress' : 'todo',
              assignedTo: team.members[0]?.name || 'Unassigned',
              priority: 'medium' as const,
              teamId: team.id,
              teamName: team.name,
              createdAt: project.createdAt,
              dueDate: undefined,
              tags: [team.members[0]?.role || 'general']
            });
          }
        }
      }

      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch assignments'
      });
    }
  }

  async updateAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      // Assignment ID format: projectId-teamId
      const [projectId, teamId] = id.split('-');

      if (status && ['todo', 'in-progress', 'review', 'done'].includes(status)) {
        // Update project status based on assignment status
        const projects = await this.storageService.getProjects();
        const project = projects.find(p => p.id === projectId);
        
        if (project) {
          if (status === 'in-progress') {
            project.status = 'active';
          } else if (status === 'done') {
            project.status = 'completed';
          }
          
          await this.storageService.saveProject(project);
        }
      }

      res.json({
        success: true,
        message: 'Assignment updated successfully'
      });
    } catch (error) {
      console.error('Error updating assignment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update assignment'
      });
    }
  }

  // Orchestrator API endpoints
  async getOrchestratorCommands(req: Request, res: Response): Promise<void> {
    try {
      // Mock command history for now - in production, this would come from logs
      const mockCommands = [
        {
          id: '1',
          command: 'get_team_status',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          output: 'All teams active and working',
          status: 'completed'
        },
        {
          id: '2', 
          command: 'delegate_task dev-alice "Implement user auth"',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          output: 'Task delegated successfully',
          status: 'completed'
        }
      ];

      res.json(mockCommands);
    } catch (error) {
      console.error('Error fetching orchestrator commands:', error);
      res.status(500).json([]);
    }
  }

  async executeOrchestratorCommand(req: Request, res: Response): Promise<void> {
    try {
      const { command } = req.body;

      if (!command || typeof command !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Command is required'
        });
        return;
      }

      // Parse and execute orchestrator commands
      let output = '';
      
      if (command.startsWith('get_team_status')) {
        const teams = await this.storageService.getTeams();
        const teamStatuses = teams.map(team => ({
          name: team.name,
          status: team.status,
          members: team.members.length,
          project: team.currentProject || 'None'
        }));
        
        output = `Team Status Report:\n${teamStatuses.map(t => 
          `${t.name}: ${t.status} (${t.members} members) - ${t.project}`
        ).join('\n')}`;
        
      } else if (command.startsWith('list_projects')) {
        const projects = await this.storageService.getProjects();
        output = `Active Projects:\n${projects.map(p => 
          `${p.name}: ${p.status} (${Object.values(p.teams).flat().length} teams assigned)`
        ).join('\n')}`;
        
      } else if (command.startsWith('list_sessions')) {
        // Mock tmux session listing
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          const result = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null || echo "No sessions"');
          output = `Active tmux sessions:\n${result.stdout}`;
        } catch (error) {
          output = 'No tmux sessions found or tmux not available';
        }
        
      } else if (command.startsWith('broadcast')) {
        const message = command.substring(10).trim();
        if (message) {
          // Mock broadcast execution
          output = `Broadcast sent to all active sessions: "${message}"`;
        } else {
          output = 'Error: No message provided for broadcast';
        }
        
      } else if (command.startsWith('help')) {
        output = `Available Orchestrator Commands:
get_team_status - Show status of all teams
list_projects - List all projects and their status
list_sessions - Show active tmux sessions
broadcast <message> - Send message to all team members
delegate_task <team> <task> - Assign task to team
create_team <role> <name> - Create new team
schedule_check <minutes> <message> - Schedule check-in reminder
help - Show this help message`;
        
      } else {
        output = `Unknown command: ${command}\nType 'help' for available commands.`;
      }

      res.json({
        success: true,
        output: output,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error executing orchestrator command:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute command',
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  async sendOrchestratorMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Message is required'
        });
        return;
      }

      // Send message to orchestrator session
      const orchestratorSession = 'agentmux-orc';
      
      try {
        await this.tmuxService.sendMessage(orchestratorSession, message);
        
        res.json({
          success: true,
          message: 'Message sent to orchestrator successfully',
          messageLength: message.length,
          timestamp: new Date().toISOString()
        });
        
      } catch (tmuxError) {
        console.error('Error sending message to orchestrator:', tmuxError);
        res.status(500).json({
          success: false,
          error: 'Failed to send message to orchestrator session'
        });
      }
      
    } catch (error) {
      console.error('Error sending orchestrator message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  }

  async sendOrchestratorEnter(req: Request, res: Response): Promise<void> {
    try {
      const orchestratorSession = 'agentmux-orc';
      
      // Send Enter key to orchestrator session using the public sendKey method
      await this.tmuxService.sendKey(orchestratorSession, 'Enter');
      
      res.json({
        success: true,
        message: 'Enter key sent to orchestrator',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error sending Enter to orchestrator:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send Enter key'
      });
    }
  }

  async setupOrchestrator(req: Request, res: Response): Promise<void> {
    try {
      const orchestratorSession = 'agentmux-orc';
      
      console.log('Setting up orchestrator session:', orchestratorSession);

      // Check if session already exists and is properly registered
      const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
      
      if (sessionExists) {
        console.log('Orchestrator tmux session already exists - checking registration status:', orchestratorSession);
        
        // Check if orchestrator is properly registered
        const registrationStatus = await this.checkAgentRegistrationStatus('orchestrator');
        
        if (registrationStatus.registered) {
          console.log('Orchestrator is already registered and active');
          res.json({
            success: true,
            message: 'Orchestrator session already running and registered',
            sessionName: orchestratorSession
          });
          return;
        }
      }

      // Create orchestrator session if it doesn't exist
      if (!sessionExists) {
        console.log('Creating new orchestrator session');
        const createResult = await this.tmuxService.createOrchestratorSession({
          sessionName: orchestratorSession,
          projectPath: process.cwd(),
          windowName: 'Orchestrator'
        });

        if (!createResult.success) {
          throw new Error(createResult.error || 'Failed to create orchestrator session');
        }
      }

      // Use the new progressive escalation system
      console.log('Initializing orchestrator with progressive escalation');
      const initResult = await this.tmuxService.initializeAgentWithRegistration(
        orchestratorSession,
        'orchestrator',
        process.cwd(),
        90000 // 90 seconds total timeout
      );
      
      if (!initResult.success) {
        throw new Error(initResult.error || 'Failed to initialize and register orchestrator');
      }

      console.log('Orchestrator setup completed successfully:', initResult.message);

      res.json({
        success: true,
        message: initResult.message || 'Orchestrator session created and registered successfully',
        sessionName: orchestratorSession
      });
      
    } catch (error) {
      console.error('Error setting up orchestrator session:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup orchestrator session'
      });
    }
  }

  private buildOrchestratorSystemPrompt(sessionName: string): string {
    return `# AgentMux Orchestrator

You are the AgentMux orchestrator, responsible for managing and coordinating development teams.

## IMPORTANT: MCP Tool Registration Required
You must immediately use the AgentMux MCP tool called 'register_agent_status' to register yourself as active. This is NOT a shell command - it's an MCP tool available to you.

Call the MCP tool like this:
- Tool name: register_agent_status
- Parameters: {"role": "orchestrator", "sessionId": "${sessionName}"}

After successful registration, respond with "Orchestrator registered and awaiting tasks" and then wait for explicit project assignments or task instructions.

## Your Responsibilities
- Coordinate multiple development teams
- Manage project workflows and timelines  
- Ensure proper git commit practices (30-minute intervals)
- Monitor team progress and resolve blockers
- Assign and distribute tasks across team members

## Available MCP Tools
You have access to AgentMux MCP tools for:
- Team management and coordination (register_agent_status, etc.)
- Task assignment and tracking
- Git operations and commit management
- Project monitoring and status reporting

Do NOT run shell commands like curl or bash scripts. Use only the MCP tools provided to you.

Wait for explicit project assignments or task instructions from the user.`;
  }

  private async waitForOrchestratorRegistration(sessionName: string, timeout: number): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    
    console.log(`Waiting for orchestrator registration in session: ${sessionName} (timeout: ${timeout}ms)`);
    
    while (Date.now() - startTime < timeout) {
      try {
        // Check if the agent has registered by looking for the registration status
        // This checks if the register_agent_status MCP tool was called successfully
        const registrationStatus = await this.checkAgentRegistrationStatus('orchestrator');
        
        if (registrationStatus.registered) {
          console.log('Orchestrator registration detected successfully');
          return true;
        }
        
        // Also check terminal output for registration messages
        const terminalOutput = await this.tmuxService.capturePane(sessionName, 10);
        
        if (terminalOutput.includes('register_agent_status') || 
            terminalOutput.includes('Orchestrator registered') ||
            terminalOutput.includes('Agent registered')) {
          console.log('Orchestrator registration activity detected in terminal output');
          return true;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
      } catch (error) {
        console.warn('Error while waiting for orchestrator registration:', error);
      }
    }
    
    console.warn(`Timeout waiting for orchestrator registration in session: ${sessionName}`);
    return false;
  }

  private async checkAgentRegistrationStatus(role: string): Promise<{registered: boolean, lastSeen?: string}> {
    try {
      // Check the runtime file for agent status tracking
      // This would be populated by the /api/team-members/register-status endpoint
      const runtimePath = path.join(process.env.AGENTMUX_HOME || path.join(os.homedir(), '.agentmux'), 'runtime.json');
      
      if (fsSync.existsSync(runtimePath)) {
        const runtimeContent = await fs.readFile(runtimePath, 'utf-8');
        const runtimeData = JSON.parse(runtimeContent);
        
        // Look for agent registration in runtime data
        if (runtimeData.agentStatus && runtimeData.agentStatus[role]) {
          const agentStatus = runtimeData.agentStatus[role];
          const lastActivity = new Date(agentStatus.lastActivity || agentStatus.registeredAt).getTime();
          const isRecent = Date.now() - lastActivity < 60000; // Active within last minute
          
          return {
            registered: agentStatus.status === 'active' && isRecent,
            lastSeen: agentStatus.lastActivity
          };
        }
      }
      
      return { registered: false };
    } catch (error) {
      console.warn('Error checking agent registration status:', error);
      return { registered: false };
    }
  }

  // Ticket Editor API endpoints
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const ticketData = req.body;

      // Get project to determine ticket directory
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const ticket = await ticketService.createTicket(ticketData);

      res.json({
        success: true,
        data: ticket
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket'
      } as ApiResponse);
    }
  }

  async getTickets(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { status, assignedTo, priority } = req.query;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const filter = {
        status: status as string,
        assignedTo: assignedTo as string,
        priority: priority as string
      };

      const tickets = await ticketService.getAllTickets(filter);

      res.json({
        success: true,
        data: tickets
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tickets'
      } as ApiResponse);
    }
  }

  async getTicket(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, ticketId } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const ticket = await ticketService.getTicket(ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: ticket
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket'
      } as ApiResponse);
    }
  }

  async updateTicket(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, ticketId } = req.params;
      const updates = req.body;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const ticket = await ticketService.updateTicket(ticketId, updates);

      res.json({
        success: true,
        data: ticket
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating ticket:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update ticket'
      } as ApiResponse);
    }
  }

  async deleteTicket(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, ticketId } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const deleted = await ticketService.deleteTicket(ticketId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { deleted: true }
      } as ApiResponse);
    } catch (error) {
      console.error('Error deleting ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete ticket'
      } as ApiResponse);
    }
  }

  async addSubtask(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, ticketId } = req.params;
      const { title } = req.body;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const ticket = await ticketService.addSubtask(ticketId, title);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: ticket
      } as ApiResponse);
    } catch (error) {
      console.error('Error adding subtask:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add subtask'
      } as ApiResponse);
    }
  }

  async toggleSubtask(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, ticketId, subtaskId } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const ticket = await ticketService.toggleSubtask(ticketId, subtaskId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket or subtask not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: ticket
      } as ApiResponse);
    } catch (error) {
      console.error('Error toggling subtask:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle subtask'
      } as ApiResponse);
    }
  }

  // Ticket Template endpoints
  async createTicketTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, templateName } = req.params;
      const templateData = req.body;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      await ticketService.createTicketTemplate(templateName, templateData);

      res.json({
        success: true,
        data: { templateName, created: true }
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating ticket template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket template'
      } as ApiResponse);
    }
  }

  async getTicketTemplates(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const templates = await ticketService.getAllTemplates();

      res.json({
        success: true,
        data: templates
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching ticket templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket templates'
      } as ApiResponse);
    }
  }

  async getTicketTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, templateName } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const ticketService = new TicketEditorService(project.path);
      const template = await ticketService.getTicketTemplate(templateName);

      if (!template) {
        res.status(404).json({
          success: false,
          error: 'Template not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: template
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching ticket template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket template'
      } as ApiResponse);
    }
  }

  // Context Loading endpoints
  async getProjectContext(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const options = req.query;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const contextLoader = new ContextLoaderService(project.path);
      const context = await contextLoader.loadProjectContext({
        includeFiles: options.includeFiles !== 'false',
        includeGitHistory: options.includeGitHistory !== 'false',
        includeTickets: options.includeTickets !== 'false',
        maxFileSize: options.maxFileSize ? parseInt(options.maxFileSize as string) : undefined,
        fileExtensions: options.fileExtensions ? (options.fileExtensions as string).split(',') : undefined
      });

      res.json({
        success: true,
        data: context
      } as ApiResponse);
    } catch (error) {
      console.error('Error loading project context:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load project context'
      } as ApiResponse);
    }
  }

  async generateMemberContext(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;
      const options = req.query;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);
      
      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const member = team.members.find(m => m.id === memberId);
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      // Find the project this team is working on
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => 
        Object.values(p.teams || {}).flat().includes(teamId)
      );

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'No project found for this team'
        } as ApiResponse);
        return;
      }

      const contextLoader = new ContextLoaderService(project.path);
      const contextPrompt = await contextLoader.generateContextPrompt(member, {
        includeFiles: options.includeFiles !== 'false',
        includeGitHistory: options.includeGitHistory !== 'false',
        includeTickets: options.includeTickets !== 'false'
      });

      res.json({
        success: true,
        data: {
          teamId,
          memberId,
          memberName: member.name,
          contextPrompt,
          generatedAt: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error generating member context:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate member context'
      } as ApiResponse);
    }
  }

  async injectContextIntoSession(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);
      
      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const member = team.members.find(m => m.id === memberId);
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      // Find the project this team is working on
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => 
        Object.values(p.teams || {}).flat().includes(teamId)
      );

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'No project found for this team'
        } as ApiResponse);
        return;
      }

      const contextLoader = new ContextLoaderService(project.path);
      const success = await contextLoader.injectContextIntoSession(member.sessionName, member);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to inject context into session'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          teamId,
          memberId,
          memberName: member.name,
          sessionName: member.sessionName,
          contextInjected: true,
          injectedAt: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error injecting context into session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to inject context into session'
      } as ApiResponse);
    }
  }

  async refreshMemberContext(req: Request, res: Response): Promise<void> {
    try {
      const { teamId, memberId } = req.params;

      const teams = await this.storageService.getTeams();
      const team = teams.find(t => t.id === teamId);
      
      if (!team) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        } as ApiResponse);
        return;
      }

      const member = team.members.find(m => m.id === memberId);
      if (!member) {
        res.status(404).json({
          success: false,
          error: 'Team member not found'
        } as ApiResponse);
        return;
      }

      // Find the project this team is working on
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => 
        Object.values(p.teams || {}).flat().includes(teamId)
      );

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'No project found for this team'
        } as ApiResponse);
        return;
      }

      const contextLoader = new ContextLoaderService(project.path);
      const contextPath = await contextLoader.refreshContext(member);

      res.json({
        success: true,
        data: {
          teamId,
          memberId,
          memberName: member.name,
          contextPath,
          refreshedAt: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error refreshing member context:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh member context'
      } as ApiResponse);
    }
  }

  // Git Integration endpoints
  async getGitStatus(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      
      if (!await gitService.isGitRepository()) {
        res.status(400).json({
          success: false,
          error: 'Not a git repository'
        } as ApiResponse);
        return;
      }

      const status = await gitService.getGitStatus();
      const stats = await gitService.getRepositoryStats();
      const lastCommit = await gitService.getLastCommitInfo();

      res.json({
        success: true,
        data: {
          status,
          stats,
          lastCommit
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting git status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get git status'
      } as ApiResponse);
    }
  }

  async commitChanges(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { message, includeUntracked, dryRun } = req.body;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      
      if (!await gitService.isGitRepository()) {
        res.status(400).json({
          success: false,
          error: 'Not a git repository'
        } as ApiResponse);
        return;
      }

      const result = await gitService.commit({
        message,
        includeUntracked,
        dryRun
      });

      res.json({
        success: true,
        data: result
      } as ApiResponse);
    } catch (error) {
      console.error('Error committing changes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to commit changes'
      } as ApiResponse);
    }
  }

  async startAutoCommit(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { intervalMinutes } = req.body;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      
      if (!await gitService.isGitRepository()) {
        await gitService.initializeGitRepository();
      }

      await gitService.startAutoCommitTimer(intervalMinutes || 30);

      // Store git service instance (in a real application, you'd manage this differently)
      (global as any).gitServices = (global as any).gitServices || {};
      (global as any).gitServices[projectId] = gitService;

      res.json({
        success: true,
        data: {
          projectId,
          intervalMinutes: intervalMinutes || 30,
          started: true
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error starting auto-commit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start auto-commit'
      } as ApiResponse);
    }
  }

  async stopAutoCommit(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      // Retrieve git service instance
      const gitServices = (global as any).gitServices || {};
      const gitService = gitServices[projectId];

      if (gitService) {
        gitService.stopAutoCommitTimer();
        delete gitServices[projectId];
      }

      res.json({
        success: true,
        data: {
          projectId,
          stopped: true
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error stopping auto-commit:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop auto-commit'
      } as ApiResponse);
    }
  }

  async getCommitHistory(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { limit } = req.query;

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      
      if (!await gitService.isGitRepository()) {
        res.status(400).json({
          success: false,
          error: 'Not a git repository'
        } as ApiResponse);
        return;
      }

      const history = await gitService.getCommitHistory(
        limit ? parseInt(limit as string) : 10
      );

      res.json({
        success: true,
        data: {
          commits: history,
          projectId
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting commit history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get commit history'
      } as ApiResponse);
    }
  }

  async createBranch(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { branchName, switchTo } = req.body;

      if (!branchName) {
        res.status(400).json({
          success: false,
          error: 'Branch name is required'
        } as ApiResponse);
        return;
      }

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      await gitService.createBranch(branchName, switchTo);

      res.json({
        success: true,
        data: {
          projectId,
          branchName,
          switchedTo: switchTo || false
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating branch:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create branch'
      } as ApiResponse);
    }
  }

  async createPullRequest(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { baseBranch, headBranch, title, description } = req.body;

      if (!baseBranch || !headBranch || !title) {
        res.status(400).json({
          success: false,
          error: 'baseBranch, headBranch, and title are required'
        } as ApiResponse);
        return;
      }

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      const gitService = new GitIntegrationService(project.path);
      const result = await gitService.createPullRequest({
        title,
        description,
        sourceBranch: headBranch,
        targetBranch: baseBranch
      });

      res.json({
        success: true,
        data: {
          projectId,
          pullRequestUrl: result
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating pull request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create pull request'
      } as ApiResponse);
    }
  }

  // System Administration endpoints
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const monitoring = MonitoringService.getInstance();
      const config = ConfigService.getInstance();
      
      const healthStatus = monitoring.getHealthStatus();
      const overallHealth = monitoring.getOverallHealth();
      const systemMetrics = monitoring.getSystemMetrics();
      const performanceMetrics = monitoring.getPerformanceMetrics();
      const environmentInfo = config.getEnvironmentInfo();

      res.json({
        success: true,
        data: {
          status: overallHealth,
          timestamp: new Date().toISOString(),
          services: Object.fromEntries(healthStatus),
          metrics: {
            system: systemMetrics,
            performance: performanceMetrics
          },
          environment: environmentInfo
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting system health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system health'
      } as ApiResponse);
    }
  }

  async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { hours } = req.query;
      const monitoring = MonitoringService.getInstance();
      
      const hoursToFetch = hours ? parseInt(hours as string) : 1;
      const metricsHistory = monitoring.getMetricsHistory(hoursToFetch);
      const currentMetrics = monitoring.getSystemMetrics();
      const performanceMetrics = monitoring.getPerformanceMetrics();

      res.json({
        success: true,
        data: {
          current: {
            system: currentMetrics,
            performance: performanceMetrics
          },
          history: metricsHistory,
          period: `${hoursToFetch} hours`
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting system metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system metrics'
      } as ApiResponse);
    }
  }

  async getSystemConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config = ConfigService.getInstance();
      const appConfig = config.getConfig();
      const validation = config.validateConfig();
      const environmentInfo = config.getEnvironmentInfo();

      res.json({
        success: true,
        data: {
          config: appConfig,
          validation,
          environment: environmentInfo
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting system configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system configuration'
      } as ApiResponse);
    }
  }

  async updateSystemConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const config = ConfigService.getInstance();
      const updates = req.body;

      await config.updateConfig(updates);
      const validation = config.validateConfig();

      res.json({
        success: true,
        data: {
          updated: true,
          validation,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating system configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update system configuration'
      } as ApiResponse);
    }
  }

  async getSystemLogs(req: Request, res: Response): Promise<void> {
    try {
      const { level, limit } = req.query;
      const logger = LoggerService.getInstance();
      
      const logs = await logger.getRecentLogs(
        level as any,
        limit ? parseInt(limit as string) : 100
      );

      res.json({
        success: true,
        data: {
          logs,
          count: logs.length,
          level: level || 'all',
          limit: limit || 100
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting system logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system logs'
      } as ApiResponse);
    }
  }

  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const monitoring = MonitoringService.getInstance();
      
      const activeAlerts = monitoring.getActiveAlerts();
      const alertConditions = monitoring.getAlertConditions();

      res.json({
        success: true,
        data: {
          active: activeAlerts,
          conditions: alertConditions,
          count: activeAlerts.length
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts'
      } as ApiResponse);
    }
  }

  async updateAlertCondition(req: Request, res: Response): Promise<void> {
    try {
      const { conditionId } = req.params;
      const updates = req.body;
      const monitoring = MonitoringService.getInstance();
      
      const success = monitoring.updateAlertCondition(conditionId, updates);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Alert condition not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          conditionId,
          updated: true,
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error updating alert condition:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update alert condition'
      } as ApiResponse);
    }
  }

  async createDefaultConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = ConfigService.getInstance();
      
      await config.createDefaultConfigFile();

      res.json({
        success: true,
        data: {
          message: 'Default configuration file created',
          timestamp: new Date().toISOString()
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error creating default configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create default configuration'
      } as ApiResponse);
    }
  }

  // Basic health check endpoint (for load balancers, etc.)
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const monitoring = MonitoringService.getInstance();
      const overallHealth = monitoring.getOverallHealth();
      const uptime = process.uptime();

      const statusCode = overallHealth === 'unhealthy' ? 503 : 200;

      res.status(statusCode).json({
        success: overallHealth !== 'unhealthy',
        data: {
          status: overallHealth,
          uptime: Math.round(uptime),
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      console.error('Error in health check:', error);
      res.status(503).json({
        success: false,
        error: 'Health check failed'
      } as ApiResponse);
    }
  }

  async getClaudeStatus(req: Request, res: Response): Promise<void> {
    try {
      const claudeStatus = await this.tmuxService.checkClaudeInstallation();
      res.json({
        success: true,
        data: claudeStatus
      } as ApiResponse);
    } catch (error) {
      console.error('Error checking Claude status:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Claude status'
      } as ApiResponse);
    }
  }

  // Workflow execution endpoints
  async getWorkflowExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const workflowService = WorkflowService.getInstance();
      const execution = workflowService.getExecution(executionId);

      if (!execution) {
        res.status(404).json({
          success: false,
          error: 'Workflow execution not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: execution
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting workflow execution:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow execution'
      } as ApiResponse);
    }
  }

  async getActiveWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const workflowService = WorkflowService.getInstance();
      const executions = workflowService.getActiveExecutions();

      res.json({
        success: true,
        data: executions
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting active workflows:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active workflows'
      } as ApiResponse);
    }
  }

  async cancelWorkflowExecution(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params;
      const workflowService = WorkflowService.getInstance();
      const result = await workflowService.cancelExecution(executionId);

      if (result) {
        res.json({
          success: true,
          message: 'Workflow execution cancelled successfully'
        } as ApiResponse);
      } else {
        res.status(404).json({
          success: false,
          error: 'Workflow execution not found or cannot be cancelled'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error cancelling workflow execution:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel workflow execution'
      } as ApiResponse);
    }
  }

  // Error Tracking Management
  async trackError(req: Request, res: Response): Promise<void> {
    try {
      const { message, level, source, component, action, metadata } = req.body;
      
      if (!message) {
        res.status(400).json({
          success: false,
          error: 'Error message is required'
        } as ApiResponse);
        return;
      }

      const errorTracker = ErrorTrackingService.getInstance();
      const errorId = errorTracker.trackError(message, {
        level: level || 'error',
        source: source || 'frontend',
        component,
        action,
        metadata,
        sessionId: req.headers['x-session-id'] as string,
        userId: req.headers['x-user-id'] as string
      });

      res.status(201).json({
        success: true,
        data: { errorId },
        message: 'Error tracked successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track error'
      } as ApiResponse);
    }
  }

  async getErrorStats(req: Request, res: Response): Promise<void> {
    try {
      const errorTracker = ErrorTrackingService.getInstance();
      const stats = errorTracker.getErrorStats();

      res.json({
        success: true,
        data: stats
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting error stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get error statistics'
      } as ApiResponse);
    }
  }

  async getErrors(req: Request, res: Response): Promise<void> {
    try {
      const { level, source, component, userId, sessionId, since, limit } = req.query;
      
      const errorTracker = ErrorTrackingService.getInstance();
      const errors = errorTracker.getErrors({
        level: level as string,
        source: source as string,
        component: component as string,
        userId: userId as string,
        sessionId: sessionId as string,
        since: since as string,
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        data: errors
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting errors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get errors'
      } as ApiResponse);
    }
  }

  async getError(req: Request, res: Response): Promise<void> {
    try {
      const { errorId } = req.params;
      
      const errorTracker = ErrorTrackingService.getInstance();
      const errorEvent = errorTracker.getError(errorId);

      if (!errorEvent) {
        res.status(404).json({
          success: false,
          error: 'Error not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: errorEvent
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get error'
      } as ApiResponse);
    }
  }

  async clearErrors(req: Request, res: Response): Promise<void> {
    try {
      const { olderThan, level, source } = req.body;
      
      const errorTracker = ErrorTrackingService.getInstance();
      const removedCount = errorTracker.clearErrors({
        olderThan,
        level,
        source
      });

      res.json({
        success: true,
        data: { removedCount },
        message: `Cleared ${removedCount} error records`
      } as ApiResponse);

    } catch (error) {
      console.error('Error clearing errors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear errors'
      } as ApiResponse);
    }
  }

  // Scheduled Messages Management
  async createScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { name, targetTeam, targetProject, message, delayAmount, delayUnit, isRecurring } = req.body;

      if (!name || !targetTeam || !message || !delayAmount || !delayUnit) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name, targetTeam, message, delayAmount, and delayUnit'
        } as ApiResponse);
        return;
      }

      const scheduledMessage = ScheduledMessageModel.create({
        name,
        targetTeam,
        targetProject,
        message,
        delayAmount: parseInt(delayAmount),
        delayUnit,
        isRecurring: isRecurring || false,
        isActive: true
      });

      await this.storageService.saveScheduledMessage(scheduledMessage);

      // Schedule the message for execution
      this.messageSchedulerService?.scheduleMessage(scheduledMessage);

      res.json({
        success: true,
        data: scheduledMessage,
        message: 'Scheduled message created successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error creating scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create scheduled message'
      } as ApiResponse);
    }
  }

  async getScheduledMessages(req: Request, res: Response): Promise<void> {
    try {
      const scheduledMessages = await this.storageService.getScheduledMessages();

      res.json({
        success: true,
        data: scheduledMessages
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting scheduled messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled messages'
      } as ApiResponse);
    }
  }

  async getScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const scheduledMessage = await this.storageService.getScheduledMessage(id);

      if (!scheduledMessage) {
        res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: scheduledMessage
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled message'
      } as ApiResponse);
    }
  }

  async updateScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, targetTeam, targetProject, message, delayAmount, delayUnit, isRecurring, isActive } = req.body;

      const existingMessage = await this.storageService.getScheduledMessage(id);
      if (!existingMessage) {
        res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        } as ApiResponse);
        return;
      }

      const updatedMessage = ScheduledMessageModel.update(existingMessage, {
        name,
        targetTeam,
        targetProject,
        message,
        delayAmount: delayAmount ? parseInt(delayAmount) : undefined,
        delayUnit,
        isRecurring,
        isActive
      });

      await this.storageService.saveScheduledMessage(updatedMessage);

      // Reschedule the message
      this.messageSchedulerService?.scheduleMessage(updatedMessage);

      res.json({
        success: true,
        data: updatedMessage,
        message: 'Scheduled message updated successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error updating scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update scheduled message'
      } as ApiResponse);
    }
  }

  async deleteScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const deleted = await this.storageService.deleteScheduledMessage(id);
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        } as ApiResponse);
        return;
      }

      // Cancel the scheduled message
      this.messageSchedulerService?.cancelMessage(id);

      res.json({
        success: true,
        message: 'Scheduled message deleted successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete scheduled message'
      } as ApiResponse);
    }
  }

  async toggleScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const existingMessage = await this.storageService.getScheduledMessage(id);
      if (!existingMessage) {
        res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        } as ApiResponse);
        return;
      }

      const updatedMessage = ScheduledMessageModel.update(existingMessage, {
        isActive: isActive !== undefined ? isActive : !existingMessage.isActive
      });

      await this.storageService.saveScheduledMessage(updatedMessage);

      // Handle scheduling based on active state
      if (updatedMessage.isActive) {
        this.messageSchedulerService?.scheduleMessage(updatedMessage);
      } else {
        this.messageSchedulerService?.cancelMessage(id);
      }

      res.json({
        success: true,
        data: updatedMessage,
        message: `Scheduled message ${updatedMessage.isActive ? 'activated' : 'deactivated'}`
      } as ApiResponse);

    } catch (error) {
      console.error('Error toggling scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle scheduled message'
      } as ApiResponse);
    }
  }

  async runScheduledMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const scheduledMessage = await this.storageService.getScheduledMessage(id);
      if (!scheduledMessage) {
        res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        } as ApiResponse);
        return;
      }

      let success = false;
      let error: string | undefined;

      try {
        // Send message to target team session
        const sessionName = scheduledMessage.targetTeam === 'orchestrator' 
          ? 'agentmux-orc' 
          : scheduledMessage.targetTeam;

        await this.tmuxService.sendMessage(sessionName, scheduledMessage.message);
        success = true;
      } catch (sendError) {
        success = false;
        error = sendError instanceof Error ? sendError.message : 'Failed to send message';
        console.error('Error sending message to session:', sendError);
      }

      // Create delivery log
      const deliveryLog = MessageDeliveryLogModel.create({
        scheduledMessageId: scheduledMessage.id,
        messageName: scheduledMessage.name,
        targetTeam: scheduledMessage.targetTeam,
        targetProject: scheduledMessage.targetProject,
        message: scheduledMessage.message,
        success,
        error
      });

      await this.storageService.saveDeliveryLog(deliveryLog);

      // Update last run time
      const updatedMessage = ScheduledMessageModel.updateLastRun(
        scheduledMessage,
        new Date().toISOString()
      );
      await this.storageService.saveScheduledMessage(updatedMessage);

      res.json({
        success: true,
        data: { 
          delivered: success,
          deliveryLog 
        },
        message: success 
          ? 'Scheduled message sent successfully' 
          : `Failed to send message: ${error}`
      } as ApiResponse);

    } catch (error) {
      console.error('Error running scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run scheduled message'
      } as ApiResponse);
    }
  }

  async getDeliveryLogs(req: Request, res: Response): Promise<void> {
    try {
      const logs = await this.storageService.getDeliveryLogs();
      res.json({
        success: true,
        data: logs,
        message: 'Delivery logs retrieved successfully'
      } as ApiResponse);
    } catch (error) {
      console.error('Error getting delivery logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get delivery logs'
      } as ApiResponse);
    }
  }

  async clearDeliveryLogs(req: Request, res: Response): Promise<void> {
    try {
      await this.storageService.clearDeliveryLogs();
      res.json({
        success: true,
        message: 'Delivery logs cleared successfully'
      } as ApiResponse);
    } catch (error) {
      console.error('Error clearing delivery logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear delivery logs'
      } as ApiResponse);
    }
  }

  // Project Detail View APIs
  async getProjectStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution (same as getProjectFiles)
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');

      let mdFileCount = 0;
      let hasProjectMd = false;
      let hasUserJourneyMd = false;
      let hasInitialGoalMd = false;
      let hasInitialUserJourneyMd = false;

      try {
        // Check if specs folder exists and count .md files
        await fs.access(specsPath);
        const files = await fs.readdir(specsPath);
        
        for (const file of files) {
          const filePath = path.join(specsPath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile() && file.endsWith('.md')) {
            mdFileCount++;
            
            if (file === 'project.md') {
              hasProjectMd = true;
            }
            if (file === 'user-journey.md') {
              hasUserJourneyMd = true;
            }
            if (file === 'initial_goal.md') {
              hasInitialGoalMd = true;
            }
            if (file === 'initial_user_journey.md') {
              hasInitialUserJourneyMd = true;
            }
          }
        }
      } catch (error) {
        // Specs folder doesn't exist or is inaccessible, use defaults
        mdFileCount = 0;
        hasProjectMd = false;
        hasUserJourneyMd = false;
        hasInitialGoalMd = false;
        hasInitialUserJourneyMd = false;
      }

      // Get task count from tickets
      const tickets = await this.storageService.getTickets(resolvedProjectPath, { projectId: id });
      const taskCount = tickets.length;

      const stats = {
        mdFileCount,
        taskCount,
        hasProjectMd,
        hasUserJourneyMd,
        hasInitialGoalMd,
        hasInitialUserJourneyMd
      };

      res.json({
        success: true,
        data: stats,
        message: 'Project stats retrieved successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting project stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project stats'
      } as ApiResponse);
    }
  }

  async getProjectSpecsStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
      const specsPathAlt = path.join(resolvedProjectPath, 'specs'); // Alternative specs location
      const tasksPath = path.join(resolvedProjectPath, '.agentmux', 'tasks');

      let hasProjectMd = false;
      let hasFrontendDesignMd = false;
      let hasBackendDesignMd = false;
      let hasUserJourneyMd = false;
      let hasMcpDesignMd = false;
      let hasIntegrationTestsMd = false;
      let hasTasksMd = false;
      let hasInitialGoalMd = false;
      let hasInitialUserJourneyMd = false;

      // Helper function to check files in a directory
      const checkSpecsInDirectory = async (dirPath: string, isFallback: boolean = false) => {
        try {
          await fs.access(dirPath);
          const files = await fs.readdir(dirPath);
          
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isFile() && file.endsWith('.md')) {
              switch (file) {
                case 'project.md':
                  hasProjectMd = true;
                  break;
                case 'frontend-design.md':
                case 'frontend_design.md':
                  hasFrontendDesignMd = true;
                  break;
                case 'backend-design.md':
                case 'backend_design.md':
                  hasBackendDesignMd = true;
                  break;
                case 'mcp-design.md':
                case 'mcp_design.md':
                  hasMcpDesignMd = true;
                  break;
                case 'integration-tests.md':
                case 'integration_tests.md':
                  hasIntegrationTestsMd = true;
                  break;
                case 'initial_goal.md':
                  hasInitialGoalMd = true;
                  break;
                case 'initial_user_journey.md':
                  hasInitialUserJourneyMd = true;
                  break;
              }
              
              // Also check for any *_design.md files
              if (file.endsWith('_design.md')) {
                if (file === 'frontend_design.md') hasFrontendDesignMd = true;
                if (file === 'backend_design.md') hasBackendDesignMd = true;
                if (file === 'mcp_design.md') hasMcpDesignMd = true;
              }
            }
          }
        } catch (error) {
          // Directory doesn't exist or is inaccessible
          // Only log for primary path, not for fallback paths as they're expected to potentially not exist
          if (!isFallback) {
            console.log(`Directory ${dirPath} not accessible:`, error);
          }
        }
      };

      // Check both possible specs directories
      await checkSpecsInDirectory(specsPath); // .agentmux/specs
      await checkSpecsInDirectory(specsPathAlt, true); // specs (fallback location)


      // Check tasks folder for any .md files
      try {
        await fs.access(tasksPath);
        const taskFiles = await fs.readdir(tasksPath);
        
        for (const file of taskFiles) {
          const filePath = path.join(tasksPath, file);
          const stat = await fs.stat(filePath);
          
          if (stat.isFile() && file.endsWith('.md')) {
            hasTasksMd = true;
            break; // Found at least one .md file in tasks
          }
        }
      } catch (error) {
        // Tasks folder doesn't exist or is inaccessible
        console.log('Tasks folder not accessible:', error);
      }

      const specsStatus = {
        hasProjectMd,
        hasFrontendDesignMd,
        hasBackendDesignMd,
        hasUserJourneyMd,
        hasMcpDesignMd,
        hasIntegrationTestsMd,
        hasTasksMd,
        hasInitialGoalMd,
        hasInitialUserJourneyMd
      };


      res.json({
        success: true,
        data: specsStatus,
        message: 'Project specs status retrieved successfully'
      } as ApiResponse);

    } catch (error) {
      console.error('Error getting project specs status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get project specs status'
      } as ApiResponse);
    }
  }

  async openProjectInFinder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution (same as getProjectFiles)
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      // Check if directory exists
      try {
        await fs.access(resolvedProjectPath);
      } catch (error) {
        res.status(404).json({
          success: false,
          error: 'Project directory does not exist'
        } as ApiResponse);
        return;
      }

      // Open in Finder (macOS) - could be extended for other platforms
      try {
        await execAsync(`open "${resolvedProjectPath}"`);
        
        res.json({
          success: true,
          message: 'Project folder opened in Finder'
        } as ApiResponse);
      } catch (error) {
        console.error('Error opening Finder:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to open Finder'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error opening project in Finder:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to open project in Finder'
      } as ApiResponse);
    }
  }

  async createSpecFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fileName, content } = req.body;

      if (!fileName || !content) {
        res.status(400).json({
          success: false,
          error: 'Missing fileName or content'
        } as ApiResponse);
        return;
      }

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution (same as getProjectFiles)
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
      const filePath = path.join(specsPath, fileName);

      try {
        // Ensure specs directory exists
        await fs.mkdir(specsPath, { recursive: true });

        // Write the file (will overwrite if it exists)
        await fs.writeFile(filePath, content, 'utf-8');

        res.json({
          success: true,
          data: {
            fileName,
            filePath: filePath,
            specsPath
          },
          message: `${fileName} saved successfully`
        } as ApiResponse);

      } catch (error) {
        console.error('Error creating spec file:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create spec file'
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error creating spec file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create spec file'
      } as ApiResponse);
    }
  }

  async getSpecFileContent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { fileName } = req.query;

      if (!fileName) {
        res.status(400).json({
          success: false,
          error: 'Missing fileName parameter'
        } as ApiResponse);
        return;
      }

      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === id);

      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Enhanced path resolution (same as getProjectFiles)
      let resolvedProjectPath: string;
      if (path.isAbsolute(project.path)) {
        resolvedProjectPath = project.path;
      } else {
        resolvedProjectPath = path.resolve(process.cwd(), project.path);
      }

      const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
      const filePath = path.join(specsPath, fileName as string);

      try {
        // Read the file content
        const content = await fs.readFile(filePath, 'utf-8');

        res.json({
          success: true,
          data: {
            fileName,
            content,
            filePath
          },
          message: `${fileName} content retrieved successfully`
        } as ApiResponse);

      } catch (error) {
        console.error('Error reading spec file:', error);
        res.status(404).json({
          success: false,
          error: `File ${fileName} not found`
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error getting spec file content:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get spec file content'
      } as ApiResponse);
    }
  }

  async getConfigFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;
      
      // Validate fileName to prevent directory traversal
      if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        res.status(400).json({
          success: false,
          error: 'Invalid file name'
        } as ApiResponse);
        return;
      }

      const configPath = path.join(process.cwd(), 'config', fileName);
      
      // Check if file exists
      if (!fsSync.existsSync(configPath)) {
        res.status(404).json({
          success: false,
          error: `Config file ${fileName} not found`
        } as ApiResponse);
        return;
      }

      // Read and parse JSON config file
      const fileContent = fsSync.readFileSync(configPath, 'utf8');
      
      // For JSON files, parse and return as JSON
      if (fileName.endsWith('.json')) {
        try {
          const jsonContent = JSON.parse(fileContent);
          res.json(jsonContent);
        } catch (parseError) {
          res.status(500).json({
            success: false,
            error: 'Invalid JSON format in config file'
          } as ApiResponse);
        }
      } else {
        // For other files, return as text
        res.json({
          success: true,
          data: { content: fileContent },
          message: `Config file ${fileName} retrieved successfully`
        } as ApiResponse);
      }

    } catch (error) {
      console.error('Error getting config file:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get config file'
      } as ApiResponse);
    }
  }


  /*
   * Schedule TPM-specific build spec workflow based on file existence
   * Instead of time-based check-ins, TPM monitors file existence and progresses through build spec steps
   */
  /* private scheduleTPMBuildSpecWorkflow(sessionName: string, projectId?: string): void {
    console.log(`Setting up TPM build spec workflow for session: ${sessionName}`);
    
    if (!projectId) {
      console.log(`TPM session ${sessionName} has no project assigned - waiting for project assignment`);
      return;
    }

    // Get project details for path information
    this.storageService.getProjects().then(projects => {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        console.log(`TPM workflow: Project ${projectId} not found`);
        return;
      }

      // Start intelligent file monitoring workflow
      this.startTPMFileMonitoring(sessionName, project);
    }).catch((error: any) => {
      console.error('Error setting up TPM workflow:', error);
    });
  } */

  /*
   * Start intelligent file monitoring for TPM build spec workflow
   * Checks file existence and prompts for next steps based on current progress
   */
  /* private startTPMFileMonitoring(sessionName: string, project: any): void {
    const checkInterval = 5; // Check every 5 minutes
    
    const performFileCheck = async () => {
      try {
        const nextStep = await this.determineTPMNextStep(project);
        
        if (nextStep) {
          const message = this.buildTPMStepMessage(nextStep, project);
          await this.tmuxService.sendMessage(sessionName, message);
          console.log(`TPM workflow: Sent step ${nextStep.stepId} to ${sessionName}`);
        }
      } catch (error) {
        console.error(`TPM file monitoring error for ${sessionName}:`, error);
      }
    };

    // Initial check after 2 minutes
    this.schedulerService.scheduleCheck(sessionName, 2, 'TPM-FILE-CHECK-INITIAL');
    
    // Set up recurring checks
    this.schedulerService.scheduleRecurringCheck(sessionName, checkInterval, 'TPM-FILE-CHECK-RECURRING');
  }

  /**
   * Determine the next step for TPM based on current file state
   */
  private async determineTPMNextStep(project: any): Promise<any | null> {
    
    const specsPath = path.join(project.path, '.agentmux', 'specs');
    const projectMdPath = path.join(specsPath, 'project.md');
    
    try {
      // Check if specs directory exists
      await fs.access(specsPath);
    } catch {
      // Specs directory doesn't exist - need step 1
      return { stepId: 1, type: 'create-project-md', reason: 'specs-dir-missing' };
    }

    try {
      // Check if project.md exists
      await fs.access(projectMdPath);
    } catch {
      // project.md doesn't exist - need step 1
      return { stepId: 1, type: 'create-project-md', reason: 'project-md-missing' };
    }

    try {
      // project.md exists, check for design documents
      const files = await fs.readdir(specsPath);
      const designFiles = files.filter((file: string) => file.endsWith('_design.md'));
      
      if (designFiles.length === 0) {
        // No design files - need step 2
        return { stepId: 2, type: 'create-design-docs', reason: 'design-docs-missing' };
      }
      
      // Check for integration_tests.md
      const integrationTestsPath = path.join(specsPath, 'integration_tests.md');
      try {
        await fs.access(integrationTestsPath);
        // All files exist - workflow complete
        return null;
      } catch {
        // integration_tests.md missing - need step 3
        return { stepId: 3, type: 'create-integration-tests', reason: 'integration-tests-missing' };
      }
    } catch (error) {
      console.error('Error checking design files:', error);
      return null;
    }
  }

  /**
   * Build the appropriate message for TPM based on the next step
   */
  private buildTPMStepMessage(nextStep: any, project: any): string {
    const configPath = '/Users/yellowsunhy/Desktop/projects/justslash/agentmux/config/build_spec_prompt.json';
    
    try {
      const config = JSON.parse(fsSync.readFileSync(configPath, 'utf8'));
      const step = config.steps.find((s: any) => s.id === nextStep.stepId);
      
      if (!step) {
        return `File Check Result: Ready for step ${nextStep.stepId} but configuration not found.`;
      }

      // Substitute variables in the prompts
      const prompts = step.prompts.map((prompt: string) => 
        prompt
          .replace(/\{PROJECT_NAME\}/g, project.name)
          .replace(/\{PROJECT_PATH\}/g, project.path)
          .replace(/\{INITIAL_GOAL\}/g, project.initialGoal || 'See project documentation')
          .replace(/\{USER_JOURNEY\}/g, project.userJourney || 'See project requirements')
      );

      return `BUILD SPEC PROGRESS UPDATE\n\nFile Check Status: ${nextStep.reason}\nNext Action Required: ${step.name}\n\n${prompts.join('\n')}`;
      
    } catch (error) {
      console.error('Error building TPM step message:', error);
      return `File Check Complete: Ready for step ${nextStep.stepId} (${nextStep.type})`;
    }
  }

  // Task Management Methods
  async getAllTasks(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        } as ApiResponse);
        return;
      }

      // Get project to find its path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Create project-specific task service
      const projectTaskService = new TaskService(project.path);
      const tasks = await projectTaskService.getAllTasks();
      
      res.json({
        success: true,
        data: tasks
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks'
      } as ApiResponse);
    }
  }

  async getMilestones(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        } as ApiResponse);
        return;
      }

      // Get project to find its path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Create project-specific task service
      const projectTaskService = new TaskService(project.path);
      const milestones = await projectTaskService.getMilestones();
      
      res.json({
        success: true,
        data: milestones
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching milestones:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch milestones'
      } as ApiResponse);
    }
  }

  async getTasksByStatus(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, status } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        } as ApiResponse);
        return;
      }

      // Get project to find its path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Create project-specific task service
      const projectTaskService = new TaskService(project.path);
      const tasks = await projectTaskService.getTasksByStatus(status);
      
      res.json({
        success: true,
        data: tasks
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching tasks by status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks by status'
      } as ApiResponse);
    }
  }

  async getTasksByMilestone(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, milestoneId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required'
        } as ApiResponse);
        return;
      }

      // Get project to find its path
      const projects = await this.storageService.getProjects();
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        res.status(404).json({
          success: false,
          error: 'Project not found'
        } as ApiResponse);
        return;
      }

      // Create project-specific task service
      const projectTaskService = new TaskService(project.path);
      const tasks = await projectTaskService.getTasksByMilestone(milestoneId);
      
      res.json({
        success: true,
        data: tasks
      } as ApiResponse);
    } catch (error) {
      console.error('Error fetching tasks by milestone:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tasks by milestone'
      } as ApiResponse);
    }
  }

  // Task assignment endpoints
  async getOrchestratorStatus(req: Request, res: Response): Promise<void> {
    try {
      // Check if orchestrator session exists
      const sessionExists = await this.tmuxService.sessionExists('agentmux-orc');
      
      res.json({
        success: true,
        running: sessionExists,
        sessionName: sessionExists ? 'agentmux-orc' : null
      } as ApiResponse);
    } catch (error) {
      console.error('Error checking orchestrator status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check orchestrator status'
      } as ApiResponse);
    }
  }

  async getTeamActivityStatus(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Check orchestrator status
      const orchestratorRunning = await this.tmuxService.sessionExists('agentmux-orc');
      
      // Get all teams data
      const teams = await this.storageService.getTeams();
      const memberStatuses: any[] = [];
      
      // Process each team and ALL its members (not just active ones)
      for (const team of teams) {
        for (const member of team.members) {
          // Check all members, but only do activity detection for active ones with sessions
          if (member.agentStatus === 'active' && member.sessionName) {
            try {
              // Check if session still exists
              const sessionExists = await this.tmuxService.sessionExists(member.sessionName);
              if (!sessionExists) {
                // Session no longer exists, update agentStatus to inactive
                member.agentStatus = 'inactive';
                member.workingStatus = 'idle';
                member.lastActivityCheck = now;
                memberStatuses.push({
                  teamId: team.id,
                  teamName: team.name,
                  memberId: member.id,
                  memberName: member.name,
                  role: member.role,
                  sessionName: member.sessionName,
                  agentStatus: 'inactive',
                  workingStatus: 'idle',
                  lastActivityCheck: now,
                  activityDetected: false
                });
                continue;
              }

              // Capture current terminal output
              const currentOutput = await this.tmuxService.capturePane(member.sessionName, 50);
              
              // Get previous output from member's lastActivityCheck data
              const previousOutput = (member as any).lastTerminalOutput || '';
              
              // Check for activity (delta in terminal output)
              const activityDetected = currentOutput !== previousOutput && currentOutput.trim() !== '';
              
              // Update working status based on activity
              const newWorkingStatus = activityDetected ? 'in_progress' : 'idle';
              
              // Update member data
              member.workingStatus = newWorkingStatus;
              member.lastActivityCheck = now;
              (member as any).lastTerminalOutput = currentOutput;
              
              memberStatuses.push({
                teamId: team.id,
                teamName: team.name,
                memberId: member.id,
                memberName: member.name,
                role: member.role,
                sessionName: member.sessionName,
                agentStatus: member.agentStatus,
                workingStatus: newWorkingStatus,
                lastActivityCheck: now,
                activityDetected
              });
              
            } catch (error) {
              console.error(`Error checking activity for member ${member.id}:`, error);
              memberStatuses.push({
                teamId: team.id,
                teamName: team.name,
                memberId: member.id,
                memberName: member.name,
                role: member.role,
                sessionName: member.sessionName,
                agentStatus: member.agentStatus,
                workingStatus: 'idle',
                lastActivityCheck: now,
                activityDetected: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          } else {
            // Include inactive members without activity checks
            memberStatuses.push({
              teamId: team.id,
              teamName: team.name,
              memberId: member.id,
              memberName: member.name,
              role: member.role,
              sessionName: member.sessionName || '',
              agentStatus: member.agentStatus || 'inactive',
              workingStatus: member.workingStatus || 'idle',
              lastActivityCheck: member.lastActivityCheck || now,
              activityDetected: false
            });
          }
        }
      }
      
      // Save updated team data
      for (const team of teams) {
        await this.storageService.saveTeam(team);
      }
      
      res.json({
        success: true,
        data: {
          orchestrator: {
            running: orchestratorRunning,
            sessionName: orchestratorRunning ? 'agentmux-orc' : null
          },
          teams: teams, // Include full teams data
          members: memberStatuses,
          checkedAt: now,
          totalMembers: memberStatuses.length,
          totalActiveMembers: memberStatuses.filter(m => m.agentStatus === 'active').length
        }
      } as ApiResponse);
      
    } catch (error) {
      console.error('Error checking team activity status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check team activity status'
      } as ApiResponse);
    }
  }

  async assignTaskToOrchestrator(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { 
        taskId, 
        taskTitle, 
        taskDescription, 
        taskPriority, 
        taskMilestone, 
        projectName, 
        projectPath 
      } = req.body;

      if (!taskId || !taskTitle) {
        res.status(400).json({
          success: false,
          error: 'Task ID and title are required'
        } as ApiResponse);
        return;
      }

      // Check if orchestrator session exists
      const sessionExists = await this.tmuxService.sessionExists('agentmux-orc');
      if (!sessionExists) {
        res.status(400).json({
          success: false,
          error: 'Orchestrator session is not running. Please start the orchestrator first.'
        } as ApiResponse);
        return;
      }

      // Build task assignment message for orchestrator using template
      const assignmentMessage = await this.promptTemplateService.getOrchestratorTaskAssignmentPrompt({
        projectName,
        projectPath,
        taskId,
        taskTitle,
        taskDescription,
        taskPriority,
        taskMilestone
      });

      // Send message to orchestrator
      await this.tmuxService.sendMessage('agentmux-orc', assignmentMessage);

      res.json({
        success: true,
        message: 'Task assigned to orchestrator successfully',
        data: {
          taskId,
          taskTitle,
          sessionName: 'agentmux-orc',
          assignedAt: new Date().toISOString()
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error assigning task to orchestrator:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to assign task to orchestrator'
      } as ApiResponse);
    }
  }

  async reportMemberReady(req: Request, res: Response): Promise<void> {
    try {
      const { sessionName, role, capabilities, readyAt } = req.body;

      if (!sessionName || !role) {
        res.status(400).json({
          success: false,
          error: 'sessionName and role are required'
        } as ApiResponse);
        return;
      }

      // Find the team member by session name
      const teams = await this.storageService.getTeams();
      let memberFound = false;

      for (const team of teams) {
        for (const member of team.members) {
          if (member.sessionName === sessionName) {
            // Update member status to ready
            member.status = 'ready';
            member.readyAt = readyAt || new Date().toISOString();
            member.capabilities = capabilities || [];
            memberFound = true;
            break;
          }
        }
        if (memberFound) {
          team.updatedAt = new Date().toISOString();
          await this.storageService.saveTeam(team);
          break;
        }
      }

      if (!memberFound) {
        console.warn(`Session ${sessionName} not found in any team, but reporting ready anyway`);
      }

      res.json({
        success: true,
        message: `Agent ${sessionName} reported ready with role ${role}`,
        data: {
          sessionName,
          role,
          capabilities,
          readyAt
        }
      } as ApiResponse);

    } catch (error) {
      console.error('Error reporting member ready:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to report member ready'
      } as ApiResponse);
    }
  }

  /**
   * Register member status (simple active registration)
   */
  async registerMemberStatus(req: Request, res: Response): Promise<void> {
    console.log(`[API] 🚀 registerMemberStatus called`);
    console.log(`[API] 📋 Request headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[API] 📤 Request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[API] 🌐 Request URL:`, req.url);
    console.log(`[API] 🔧 Request method:`, req.method);
    
    try {
      const { sessionName, role, status, registeredAt, memberId } = req.body;
      console.log(`[API] 📋 Extracted parameters:`, { sessionName, role, status, registeredAt, memberId });

      if (!sessionName || !role) {
        console.log(`[API] ❌ Missing required parameters - sessionName: ${sessionName}, role: ${role}`);
        res.status(400).json({
          success: false,
          error: 'sessionName and role are required'
        } as ApiResponse);
        return;
      }

      // Handle orchestrator registration separately
      if (role === 'orchestrator' && sessionName === 'agentmux-orc') {
        console.log(`[API] 🎭 Handling orchestrator registration`);
        try {
          await this.storageService.updateOrchestratorStatus('active');
          console.log(`[API] ✅ Orchestrator registered as active`);
          
          res.json({
            success: true,
            message: `Orchestrator ${sessionName} registered as active`,
            sessionName: sessionName
          } as ApiResponse);
          return;
        } catch (error) {
          console.log(`[API] ❌ Error updating orchestrator status:`, error);
          res.status(500).json({
            success: false,
            error: 'Failed to update orchestrator status'
          } as ApiResponse);
          return;
        }
      }

      // Find the team member by memberId or session name and update to active
      console.log(`[API] 🔍 Looking up team member with memberId: ${memberId}, sessionName: ${sessionName}`);
      const teams = await this.storageService.getTeams();
      console.log(`[API] 📋 Found ${teams.length} teams to search`);
      let memberFound = false;

      for (const team of teams) {
        console.log(`[API] 🏗️ Searching team: ${team.name} (${team.members.length} members)`);
        for (const member of team.members) {
          const matchesId = memberId && member.id === memberId;
          const matchesSession = member.sessionName === sessionName;
          
          if (matchesId || matchesSession) {
            console.log(`[API] ✅ Found matching member: ${member.name} (${member.role})`);
            console.log(`[API] 📋 Match type: ${matchesId ? 'memberId' : 'sessionName'}`);
            
            // Update member status to active (both legacy and new fields)
            member.status = 'active'; // Legacy field for backward compatibility
            member.agentStatus = 'active'; // New agent connection status
            member.workingStatus = member.workingStatus || 'idle'; // Initialize working status if not set
            member.readyAt = registeredAt || new Date().toISOString();
            // Update session name if it's not set yet (when looked up by memberId)
            if (memberId && member.id === memberId && !member.sessionName) {
              member.sessionName = sessionName;
              console.log(`[API] 📝 Updated member sessionName to: ${sessionName}`);
            }
            memberFound = true;
            break;
          }
        }
        if (memberFound) {
          team.updatedAt = new Date().toISOString();
          console.log(`[API] 💾 Saving updated team: ${team.name}`);
          await this.storageService.saveTeam(team);
          break;
        }
      }

      if (!memberFound) {
        console.log(`[API] ⚠️ Session ${sessionName}${memberId ? ` (member ID: ${memberId})` : ''} not found in any team, but registering status anyway`);
      }

      console.log(`[API] ✅ Registration successful, sending response`);
      res.json({
        success: true,
        message: `Agent ${sessionName} registered as active with role ${role}`,
        data: {
          sessionName,
          role,
          status: 'active',
          registeredAt: registeredAt || new Date().toISOString()
        }
      } as ApiResponse);

    } catch (error) {
      console.log(`[API] ❌ Exception in registerMemberStatus:`, error);
      console.log(`[API] 📋 Error details:`, {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      res.status(500).json({
        success: false,
        error: 'Failed to register member status'
      } as ApiResponse);
    }
  }
}