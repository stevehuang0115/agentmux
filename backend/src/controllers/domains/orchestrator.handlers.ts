import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';

// Delegate to existing ApiController methods to preserve complex logic without duplication
export async function getOrchestratorCommands(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
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

export async function executeOrchestratorCommand(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { command } = req.body as any;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ success: false, error: 'Command is required' });
      return;
    }

    let output = '';
    if (command.startsWith('get_team_status')) {
      const teams = await this.storageService.getTeams();
      const teamStatuses = teams.map(team => {
        const hasActiveMembers = team.members.some(m => m.agentStatus === 'active');
        const hasActivatingMembers = team.members.some(m => m.agentStatus === 'activating');
        const computedStatus = hasActiveMembers ? 'active' : hasActivatingMembers ? 'activating' : 'inactive';
        return { name: team.name, status: computedStatus, members: team.members.length, project: (team as any).currentProject || 'None' };
      });
      output = `Team Status Report:\n${teamStatuses.map(t => `${t.name}: ${t.status} (${t.members} members) - ${t.project}`).join('\n')}`;
    } else if (command.startsWith('list_projects')) {
      const projects = await this.storageService.getProjects();
      output = `Active Projects:\n${projects.map(p => `${p.name}: ${p.status} (${Object.values(p.teams).flat().length} teams assigned)`).join('\n')}`;
    } else if (command.startsWith('list_sessions')) {
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
      output = message ? `Broadcast sent to all active sessions: "${message}"` : 'Error: No message provided for broadcast';
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

    res.json({ success: true, output, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error executing orchestrator command:', error);
    res.status(500).json({ success: false, error: 'Failed to execute command', output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
}

export async function sendOrchestratorMessage(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body as any;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }
    const orchestratorSession = 'agentmux-orc';
    try {
      await this.tmuxService.sendMessage(orchestratorSession, message);
      res.json({ success: true, message: 'Message sent to orchestrator successfully', messageLength: message.length, timestamp: new Date().toISOString() });
    } catch (tmuxError) {
      console.error('Error sending message to orchestrator:', tmuxError);
      res.status(500).json({ success: false, error: 'Failed to send message to orchestrator session' });
    }
  } catch (error) {
    console.error('Error sending orchestrator message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

export async function sendOrchestratorEnter(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const orchestratorSession = 'agentmux-orc';
    await this.tmuxService.sendKey(orchestratorSession, 'Enter');
    res.json({ success: true, message: 'Enter key sent to orchestrator', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error sending Enter to orchestrator:', error);
    res.status(500).json({ success: false, error: 'Failed to send Enter key' });
  }
}

export async function setupOrchestrator(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const orchestratorSession = 'agentmux-orc';
    const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
    if (!sessionExists) {
      const createResult = await this.tmuxService.createOrchestratorSession({ sessionName: orchestratorSession, projectPath: process.cwd(), windowName: 'Orchestrator' });
      if (!createResult.success) {
        res.status(500).json({ success: false, error: createResult.error || 'Failed to create orchestrator session' });
        return;
      }
    }
    // Initialize with registration escalation (reuses tmuxService logic)
    const initResult = await this.tmuxService.initializeAgentWithRegistration(orchestratorSession, 'orchestrator', process.cwd(), 90000);
    if (!initResult.success) {
      res.status(500).json({ success: false, error: initResult.error || 'Failed to initialize and register orchestrator' });
      return;
    }
    res.json({ success: true, message: initResult.message || 'Orchestrator session created and registered successfully', sessionName: orchestratorSession });
  } catch (error) {
    console.error('Error setting up orchestrator session:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to setup orchestrator session' });
  }
}

export async function getOrchestratorHealth(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    // Lightweight orchestrator health check with timeout
    const orchestratorRunning = await Promise.race([
      this.tmuxService.sessionExists('agentmux-orc'),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 1000)
      )
    ]).catch(() => false);

    res.json({
      success: true,
      data: {
        orchestrator: {
          running: orchestratorRunning,
          sessionName: orchestratorRunning ? 'agentmux-orc' : null,
          status: orchestratorRunning ? 'active' : 'inactive'
        },
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error checking orchestrator health:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check orchestrator health' 
    } as ApiResponse);
  }
}

export async function assignTaskToOrchestrator(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    const { taskId, taskTitle, taskDescription, taskPriority, taskMilestone, projectName, projectPath } = req.body as any;
    if (!taskId || !taskTitle) {
      res.status(400).json({ success: false, error: 'Task ID and title are required' } as ApiResponse);
      return;
    }
    const sessionExists = await this.tmuxService.sessionExists('agentmux-orc');
    if (!sessionExists) {
      res.status(400).json({ success: false, error: 'Orchestrator session is not running. Please start the orchestrator first.' } as ApiResponse);
      return;
    }
    const assignmentMessage = await this.promptTemplateService.getOrchestratorTaskAssignmentPrompt({
      projectName,
      projectPath,
      taskId,
      taskTitle,
      taskDescription,
      taskPriority,
      taskMilestone
    });
    await this.tmuxService.sendMessage('agentmux-orc', assignmentMessage);
    res.json({ success: true, message: 'Task assigned to orchestrator successfully', data: { taskId, taskTitle, sessionName: 'agentmux-orc', assignedAt: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error assigning task to orchestrator:', error);
    res.status(500).json({ success: false, error: 'Failed to assign task to orchestrator' } as ApiResponse);
  }
}
