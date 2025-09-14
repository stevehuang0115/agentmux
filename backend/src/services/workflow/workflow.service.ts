import { TmuxService, OrchestratorConfig } from '../agent/tmux.service.js';
import { StorageService } from '../core/storage.service.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { Project, Team } from '../../types/index.js';
import { 
  ORCHESTRATOR_SESSION_NAME,
  ORCHESTRATOR_WINDOW_NAME,
  CLAUDE_INITIALIZATION_TIMEOUT
} from '../../constants.js';

export interface ProjectStartRequest {
  projectId: string;
  teamId: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  error?: string;
  timestamp: Date;
}

export interface WorkflowExecution {
  id: string;
  type: 'project_start';
  projectId: string;
  teamId: string;
  steps: WorkflowStep[];
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  orchestratorSession?: string;
}

export class WorkflowService {
  private static instance: WorkflowService;
  private logger: ComponentLogger;
  private tmuxService: TmuxService;
  private storageService: StorageService;
  private activeExecutions: Map<string, WorkflowExecution> = new Map();

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('WorkflowService');
    this.tmuxService = new TmuxService();
    this.storageService = StorageService.getInstance();
  }

  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * Start a project with full orchestration workflow
   */
  public async startProject(request: ProjectStartRequest): Promise<{
    success: boolean;
    executionId: string;
    message?: string;
    error?: string;
  }> {
    try {
      this.logger.info('Starting project workflow', request);

      // Generate execution ID
      const executionId = `project_start_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Get project and team data
      const project = await this.getProjectById(request.projectId);
      const team = await this.getTeamById(request.teamId);

      if (!project) {
        return {
          success: false,
          executionId,
          error: `Project not found: ${request.projectId}`
        };
      }

      if (!team) {
        return {
          success: false,
          executionId,
          error: `Team not found: ${request.teamId}`
        };
      }

      // Create workflow execution
      const execution: WorkflowExecution = {
        id: executionId,
        type: 'project_start',
        projectId: request.projectId,
        teamId: request.teamId,
        steps: this.createProjectStartSteps(),
        status: 'running',
        startTime: new Date()
      };

      this.activeExecutions.set(executionId, execution);

      // Start workflow execution
      this.executeProjectStartWorkflow(execution, project, team);

      return {
        success: true,
        executionId,
        message: 'Project start workflow initiated'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to start project workflow', { ...request, error: errorMessage });
      
      return {
        success: false,
        executionId: '',
        error: errorMessage
      };
    }
  }

  /**
   * Get workflow execution status
   */
  public getExecution(executionId: string): WorkflowExecution | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Get all active executions
   */
  public getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Cancel a running workflow
   */
  public async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'failed';
    execution.endTime = new Date();
    
    // Update current step to failed
    const currentStep = execution.steps.find(s => s.status === 'running');
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = 'Workflow cancelled by user';
      currentStep.timestamp = new Date();
    }

    this.logger.info('Workflow execution cancelled', { executionId });
    return true;
  }

  /**
   * Create the steps for project start workflow
   */
  private createProjectStartSteps(): WorkflowStep[] {
    return [
      {
        id: 'verify_orchestrator',
        name: 'Verify Orchestrator is Running',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'create_team_sessions',
        name: 'Create Team Member Sessions',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'send_project_prompt',
        name: 'Send Project Start Prompt to Orchestrator',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'monitor_setup',
        name: 'Monitor Team Setup Progress',
        status: 'pending',
        timestamp: new Date()
      }
    ];
  }

  /**
   * Execute the project start workflow
   */
  private async executeProjectStartWorkflow(execution: WorkflowExecution, project: Project, team: Team): Promise<void> {
    try {
      this.logger.info('Executing project start workflow', { 
        executionId: execution.id, 
        projectName: project.name,
        teamName: team.name 
      });

      // Step 1: Verify orchestrator is running (orchestrator should already be initialized at app startup)
      await this.executeStep(execution, 'verify_orchestrator', async () => {
        const orchestratorSession = ORCHESTRATOR_SESSION_NAME;
        const exists = await this.tmuxService.sessionExists(orchestratorSession);
        execution.orchestratorSession = orchestratorSession;
        
        if (!exists) {
          return {
            success: false,
            error: 'Orchestrator session is not running. Please ensure AgentMux is started properly with orchestrator initialization.'
          };
        }
        
        return {
          success: true,
          message: 'Orchestrator session is running and ready'
        };
      });

      // Step 2: Create team sessions
      await this.executeStep(execution, 'create_team_sessions', async () => {
        const createdSessions: string[] = [];
        
        if (team.members && Array.isArray(team.members)) {
          for (const member of team.members) {
            // Create unique session name using team name, member name, and member ID for guaranteed uniqueness
            const teamSlug = team.name.replace(/\s+/g, '-').toLowerCase();
            const memberSlug = (member.name || member.role).replace(/\s+/g, '-').toLowerCase();
            const memberIdSlug = member.id.substring(0, 8); // Use first 8 chars of member ID for uniqueness
            const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;
            
            this.logger.info(`Creating session for member`, { 
              memberName: member.name, 
              memberRole: member.role, 
              memberId: member.id,
              sessionName 
            });
            
            try {
              const sessionConfig = {
                name: sessionName,
                projectPath: project.path || process.cwd(),
                role: member.role,
                systemPrompt: member.systemPrompt || 'You are a development team member working on this project.',
                memberId: member.id,
                runtimeType: member.runtimeType
              };
              
              const sessionId = await this.tmuxService.createSession(sessionConfig);
              createdSessions.push(sessionId);
              
              // Initialize Claude Code in the session
              await this.tmuxService.initializeClaudeInSession(sessionName);
              
              // Send role-specific prompt to the team member
              await this.sendTeamMemberPrompt(sessionName, project, member, team);
              
              // Update team member sessionName in database to match actual tmux session
              try {
                const teams = await this.storageService.getTeams();
                const teamToUpdate = teams.find(t => t.id === team.id);
                if (teamToUpdate) {
                  const memberToUpdate = teamToUpdate.members.find(m => m.id === member.id);
                  if (memberToUpdate) {
                    memberToUpdate.sessionName = sessionName;
                    await this.storageService.saveTeam(teamToUpdate);
                    this.logger.info(`Updated sessionName for ${member.name}`, { 
                      memberId: member.id, 
                      sessionName 
                    });
                  }
                }
              } catch (dbError) {
                this.logger.warn(`Failed to update sessionName in database for ${member.name}`, { 
                  error: String(dbError) 
                });
              }
              
            } catch (error) {
              this.logger.warn(`Failed to create session for ${member.name}`, { error: String(error) });
            }
          }
        }
        
        return {
          success: createdSessions.length > 0,
          message: `Created ${createdSessions.length} team sessions: ${createdSessions.join(', ')}`,
          error: createdSessions.length === 0 ? 'Failed to create any team sessions' : undefined
        };
      });

      // Step 3: Send project start prompt to orchestrator
      await this.executeStep(execution, 'send_project_prompt', async () => {
        const orchestratorSession = execution.orchestratorSession!;
        const projectData = {
          projectName: project.name,
          projectPath: project.path || process.cwd(),
          teamDetails: team,
          requirements: 'See project documentation'
        };
        
        const result = await this.tmuxService.sendProjectStartPrompt(orchestratorSession, projectData);
        return {
          success: result.success,
          message: result.message,
          error: result.error
        };
      });

      // Step 4: Monitor setup (start monitoring but don't wait for completion)
      await this.executeStep(execution, 'monitor_setup', async () => {
        // Start background monitoring
        this.startTeamSetupMonitoring(execution);
        return {
          success: true,
          message: 'Team setup monitoring started'
        };
      });

      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      
      this.logger.info('Project start workflow completed successfully', { 
        executionId: execution.id,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Project start workflow failed', { 
        executionId: execution.id, 
        error: errorMessage 
      });

      execution.status = 'failed';
      execution.endTime = new Date();

      // Mark current step as failed
      const currentStep = execution.steps.find(s => s.status === 'running');
      if (currentStep) {
        currentStep.status = 'failed';
        currentStep.error = errorMessage;
        currentStep.timestamp = new Date();
      }
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    execution: WorkflowExecution, 
    stepId: string, 
    stepFunction: () => Promise<{ success: boolean; message?: string; error?: string }>
  ): Promise<void> {
    const step = execution.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.status = 'running';
    step.timestamp = new Date();
    
    this.logger.info('Executing workflow step', { 
      executionId: execution.id, 
      stepId, 
      stepName: step.name 
    });

    try {
      const result = await stepFunction();
      
      if (result.success) {
        step.status = 'completed';
        step.message = result.message;
        this.logger.info('Workflow step completed', { 
          executionId: execution.id, 
          stepId, 
          message: result.message 
        });
      } else {
        step.status = 'failed';
        step.error = result.error;
        this.logger.error('Workflow step failed', { 
          executionId: execution.id, 
          stepId, 
          error: result.error 
        });
        throw new Error(result.error || 'Step execution failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      step.status = 'failed';
      step.error = errorMessage;
      step.timestamp = new Date();
      throw error;
    }
  }

  /**
   * Start background monitoring of team setup
   */
  private startTeamSetupMonitoring(execution: WorkflowExecution): void {
    const monitoringInterval = setInterval(async () => {
      try {
        if (execution.status !== 'running' && execution.status !== 'completed') {
          clearInterval(monitoringInterval);
          return;
        }

        const orchestratorSession = execution.orchestratorSession;
        if (!orchestratorSession) {
          clearInterval(monitoringInterval);
          return;
        }

        // Check if orchestrator session is still active
        const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
        if (!sessionExists) {
          this.logger.warn('Orchestrator session no longer exists, stopping monitoring', { 
            executionId: execution.id 
          });
          clearInterval(monitoringInterval);
          return;
        }

        // Capture recent output to check progress
        const output = await this.tmuxService.capturePane(orchestratorSession, 50);
        
        // Log progress updates
        if (output.includes('Session created:') || 
            output.includes('Team member initialized:') ||
            output.includes('All team members ready')) {
          
          this.logger.info('Team setup progress detected', { 
            executionId: execution.id,
            recentActivity: output.slice(-200)
          });
        }

      } catch (error) {
        this.logger.error('Error during team setup monitoring', { 
          executionId: execution.id, 
          error: String(error) 
        });
      }
    }, 30000); // Check every 30 seconds

    // Stop monitoring after 30 minutes
    setTimeout(() => {
      clearInterval(monitoringInterval);
      this.logger.info('Team setup monitoring timeout reached', { 
        executionId: execution.id 
      });
    }, 30 * 60 * 1000);
  }

  /**
   * Get project by ID
   */
  private async getProjectById(projectId: string): Promise<Project | null> {
    const projects = await this.storageService.getProjects();
    return projects.find(p => p.id === projectId) || null;
  }

  /**
   * Get team by ID
   */
  private async getTeamById(teamId: string): Promise<Team | null> {
    const teams = await this.storageService.getTeams();
    return teams.find(t => t.id === teamId) || null;
  }

  /**
   * Send comprehensive project instructions to a team member
   */
  private async sendTeamMemberPrompt(sessionName: string, project: Project, member: any, team: Team): Promise<void> {
    const prompt = this.buildTeamMemberPrompt(project, member, team);
    await this.tmuxService.sendMessage(sessionName, prompt);
    this.logger.info('Team member prompt sent', { sessionName, memberName: member.name, role: member.role });
  }

  /**
   * Build comprehensive prompt for team members
   */
  private buildTeamMemberPrompt(project: Project, member: any, team: Team): string {
    const projectPath = project.path || process.cwd();
    const specsPath = `${projectPath}/.agentmux/specs/`;
    
    const prompt = `# Welcome to ${project.name} Project

You are **${member.name}**, a **${member.role}** working on the "${project.name}" project as part of the **${team.name}**.

## 🎯 Your Mission
Build a full-stack application according to the specifications in **${specsPath}**

## 📋 Project Details
- **Project**: ${project.name}
- **Path**: ${projectPath}  
- **Team**: ${team.name}
- **Your Role**: ${member.role}
- **System Prompt**: ${member.systemPrompt || 'General development team member'}

## 🚀 What You Need To Do

### Phase 1: Setup & Planning
1. **Review Specifications**: Examine all files in \`${specsPath}\`
2. **Understand Architecture**: Study the technical requirements and system design
3. **Plan Your Work**: Break down your role's responsibilities into actionable tasks

### Phase 2: Development  
1. **Follow Role Guidelines**: 
   ${member.role === 'Project Manager' ? `
   - Coordinate with team members
   - Track project progress  
   - Manage timelines and deliverables
   - Ensure quality standards` : 
   member.role === 'Developer' ? `
   - Write clean, maintainable code
   - Implement features according to specs
   - Follow coding standards and best practices
   - Write tests for your code` :
   member.role === 'DevOps' ? `
   - Set up CI/CD pipelines
   - Manage deployment infrastructure  
   - Configure monitoring and logging
   - Ensure scalability and security` :
   `- Execute tasks according to your specialized role
   - Collaborate with team members
   - Maintain high quality standards`}

2. **Git Workflow**: 
   - Make commits every 30 minutes with descriptive messages
   - Use feature branches for major changes
   - Coordinate with team on merge conflicts

3. **Communication**:
   - Update team on your progress regularly
   - Ask questions when clarification is needed
   - Share knowledge and help teammates

## 🔧 Getting Started
1. Navigate to the project directory: \`cd ${projectPath}\`
2. Review the specs: \`ls -la ${specsPath}\`
3. Start working on Phase 1 tasks for your role
4. Set up your development environment as needed
5. Begin implementing according to the specifications

## ⏰ Schedule
- **Git commits**: Every 30 minutes  
- **Progress updates**: Every hour
- **Team coordination**: As needed

## 📚 Resources
- Project specifications: \`${specsPath}\`
- Team coordination: Via the orchestrator
- Technical documentation: Check project README files

**Start by reviewing the project specifications and then begin Phase 1 development. The orchestrator will coordinate overall progress.**

Ready to build something amazing! 🚀`;

    return prompt;
  }

  /**
   * Cleanup resources
   */
  public shutdown(): void {
    // Clean up any active monitoring
    for (const execution of this.activeExecutions.values()) {
      if (execution.status === 'running') {
        execution.status = 'failed';
        execution.endTime = new Date();
      }
    }

    // Cleanup tmux service if it has cleanup method
    this.logger.info('Workflow service shutdown complete');
  }
}