import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { Team, TeamMember, ApiResponse, ScheduledMessage } from '../../types/index.js';

export async function createTeam(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { name, description, members, projectPath, currentProject } = req.body as any;

    if (!name || !members || !Array.isArray(members) || members.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name and members array'
      } as ApiResponse);
      return;
    }

    for (const member of members) {
      if (!member.name || !member.role || !member.systemPrompt) {
        res.status(400).json({
          success: false,
          error: 'All team members must have name, role, and systemPrompt'
        } as ApiResponse);
        return;
      }
    }

    const existingTeams = await this.storageService.getTeams();
    if (existingTeams.find(t => t.name === name)) {
      res.status(500).json({
        success: false,
        error: `Team with name "${name}" already exists`
      } as ApiResponse);
      return;
    }

    const teamId = uuidv4();
    const teamMembers: TeamMember[] = [] as any;
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const memberId = uuidv4();

      const teamMember: TeamMember = {
        id: memberId,
        name: member.name,
        sessionName: '',
        role: member.role,
        systemPrompt: member.systemPrompt,
        agentStatus: 'inactive',
        workingStatus: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      teamMembers.push(teamMember);
    }

    const team: Team = {
      id: teamId,
      name,
      description: description || '',
      members: teamMembers,
      currentProject: currentProject || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.storageService.saveTeam(team);

    for (const member of teamMembers) {
      if (member.role === 'tpm') {
        console.log(`TPM ${member.sessionName}: File-based workflow (no duplicate messages)`);
      } else {
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

export async function getTeams(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const teams = await this.storageService.getTeams();
    const orchestratorStatus = await this.storageService.getOrchestratorStatus();
    const orchestratorTeam: Team = {
      id: 'orchestrator',
      name: 'Orchestrator Team',
      description: 'System orchestrator for project management',
      members: [
        {
          id: 'orchestrator-member',
          name: 'Agentmux Orchestrator',
          sessionName: 'agentmux-orc',
          role: 'orchestrator',
          systemPrompt: 'You are the AgentMux Orchestrator responsible for coordinating teams and managing project workflows.',
          agentStatus: (orchestratorStatus as any)?.agentStatus || 'inactive',
          workingStatus: (orchestratorStatus as any)?.workingStatus || 'idle',
          createdAt: (orchestratorStatus as any)?.createdAt || new Date().toISOString(),
          updatedAt: (orchestratorStatus as any)?.updatedAt || new Date().toISOString()
        } as any
      ],
      createdAt: (orchestratorStatus as any)?.createdAt || new Date().toISOString(),
      updatedAt: (orchestratorStatus as any)?.updatedAt || new Date().toISOString()
    } as any;

    const allTeams = [orchestratorTeam, ...teams];
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

export async function getTeam(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
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
            sessionName: 'agentmux-orc',
            role: 'orchestrator',
            systemPrompt: 'You are the AgentMux Orchestrator responsible for coordinating teams and managing project workflows.',
            agentStatus: (orchestratorStatus as any)?.agentStatus || 'inactive',
            workingStatus: (orchestratorStatus as any)?.workingStatus || 'idle',
            createdAt: (orchestratorStatus as any)?.createdAt || new Date().toISOString(),
            updatedAt: (orchestratorStatus as any)?.updatedAt || new Date().toISOString()
          } as any
        ],
        createdAt: (orchestratorStatus as any)?.createdAt || new Date().toISOString(),
        updatedAt: (orchestratorStatus as any)?.updatedAt || new Date().toISOString()
      } as any;
      res.json({ success: true, data: orchestratorTeam } as ApiResponse<Team>);
      return;
    }

    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: team } as ApiResponse<Team>);
  } catch (error) {
    console.error('Error getting team:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve team' } as ApiResponse);
  }
}

export async function startTeam(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { projectId, enableGitReminder = false } = req.body as any;

    if (id === 'orchestrator') {
      const sessionExists = await this.tmuxService.sessionExists('agentmux-orc');
      if (!sessionExists) {
        const createResult = await this.tmuxService.createOrchestratorSession({
          sessionName: 'agentmux-orc',
          projectPath: process.cwd(),
          windowName: 'orchestrator'
        });
        if (createResult.success) {
          const initResult = await this.tmuxService.initializeOrchestrator('agentmux-orc');
          res.json({
            success: true,
            message: `Orchestrator session created and ${initResult.success ? 'Claude initialized' : 'Claude initialization failed'}`,
            data: { sessionsCreated: 1, sessionsAlreadyRunning: 0, sessionName: 'agentmux-orc', claudeInitialized: initResult.success }
          } as ApiResponse);
        } else {
          res.status(500).json({
            success: false,
            error: `Failed to create orchestrator session: ${createResult.error}`,
            data: { sessionsCreated: 0, sessionsAlreadyRunning: 0 }
          } as ApiResponse);
        }
      } else {
        res.json({ success: true, message: 'Orchestrator session is already running', data: { sessionsCreated: 0, sessionsAlreadyRunning: 1, sessionName: 'agentmux-orc' } } as ApiResponse);
      }
      return;
    }

    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse);
      return;
    }

    const projects = await this.storageService.getProjects();
    let targetProjectId = projectId || (team as any).currentProject;
    if (!targetProjectId) {
      res.status(400).json({ success: false, error: 'No project specified. Please select a project to assign this team to.' } as ApiResponse);
      return;
    }

    const assignedProject = projects.find(p => p.id === targetProjectId);
    if (!assignedProject) {
      res.status(400).json({ success: false, error: 'Selected project not found. Please check project selection.' } as ApiResponse);
      return;
    }

    let sessionsCreated = 0;
    let sessionsAlreadyRunning = 0;
    const results: any[] = [];

    const existingSessions = await this.tmuxService.listSessions();
    const existingSessionNames = new Set(existingSessions.map(s => s.sessionName));

    const parallelConfig = { enabled: true, maxParallel: 3 };

    const membersToStart = team.members;
    if (!parallelConfig.enabled || parallelConfig.maxParallel <= 1) {
      for (const member of membersToStart) {
        try {
          if (member.sessionName && existingSessionNames.has(member.sessionName)) {
            sessionsAlreadyRunning++;
            results.push({ memberName: member.name, sessionName: member.sessionName, status: 'already_running', memberId: member.id });
            continue;
          }

          // Set status to activating when starting the member
          member.agentStatus = 'activating';
          member.workingStatus = 'idle';
          (member as any).updatedAt = new Date().toISOString();

          const teamSlug = team.name.toLowerCase().replace(/\s+/g, '-');
          const memberSlug = member.name.toLowerCase().replace(/\s+/g, '-');
          const memberIdSlug = member.id.substring(0, 8);
          const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;

          const createResult = await this.tmuxService.createTeamMemberSession({
            name: member.name,
            role: member.role,
            systemPrompt: member.systemPrompt,
            projectPath: assignedProject.path,
            memberId: member.id
          }, sessionName);

          if (createResult.success) {
            // Note: Don't modify member directly to avoid race conditions
            // Session name will be set when we re-fetch team state at the end
            sessionsCreated++;
            results.push({ memberName: member.name, sessionName, status: 'created', success: true, memberId: member.id });
          } else {
            // Reset to inactive if session creation failed
            member.agentStatus = 'inactive';
            results.push({ memberName: member.name, sessionName: null, status: 'failed', error: createResult.error, success: false, memberId: member.id });
          }
        } catch (error) {
          // Reset to inactive if session creation failed
          member.agentStatus = 'inactive';
          results.push({ memberName: member.name, sessionName: null, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', success: false, memberId: member.id });
        }
      }
    } else {
      const batches: TeamMember[][] = [];
      for (let i = 0; i < membersToStart.length; i += parallelConfig.maxParallel) {
        batches.push(membersToStart.slice(i, i + parallelConfig.maxParallel));
      }
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchPromises = batch.map(async (member) => {
          try {
            if (member.sessionName && existingSessionNames.has(member.sessionName)) {
              return { memberName: member.name, sessionName: member.sessionName, status: 'already_running', success: true, memberId: member.id };
            }

            // Set status to activating when starting the member
            member.agentStatus = 'activating';
            member.workingStatus = 'idle';
            (member as any).updatedAt = new Date().toISOString();

            const teamSlug = team.name.toLowerCase().replace(/\s+/g, '-');
            const memberSlug = member.name.toLowerCase().replace(/\s+/g, '-');
            const memberIdSlug = member.id.substring(0, 8);
            const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;
            const createResult = await this.tmuxService.createTeamMemberSession({
              name: member.name,
              role: member.role,
              systemPrompt: member.systemPrompt,
              projectPath: assignedProject.path,
              memberId: member.id
            }, sessionName);
            if (createResult.success) {
              // Note: Don't modify member directly as it may cause race conditions
              // The sessionName will be set later when we re-fetch the team state
              return { memberName: member.name, sessionName, status: 'created', success: true, memberId: member.id };
            } else {
              // Reset to inactive if session creation failed
              member.agentStatus = 'inactive';
              return { memberName: member.name, sessionName: null, status: 'failed', error: createResult.error, success: false, memberId: member.id };
            }
          } catch (error) {
            // Reset to inactive if session creation failed
            member.agentStatus = 'inactive';
            return { memberName: member.name, sessionName: null, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error', success: false, memberId: member.id };
          }
        });
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => { if (result.success && result.status === 'created') sessionsCreated++; results.push(result); });
        if (batchIndex < batches.length - 1) { await new Promise(resolve => setTimeout(resolve, 1000)); }
      }
    }

    if (sessionsCreated > 0) {
      // Re-fetch current team state to preserve any status updates that happened during parallel session creation
      const currentTeams = await this.storageService.getTeams();
      const currentTeam = currentTeams.find(t => t.id === id);
      
      if (currentTeam) {
        // Update session names for successfully created sessions without overwriting agentStatus
        for (const result of results) {
          if (result.success && result.status === 'created' && result.memberId) {
            const currentMember = currentTeam.members.find(m => m.id === result.memberId);
            if (currentMember) {
              currentMember.sessionName = result.sessionName;
              currentMember.updatedAt = new Date().toISOString();
            }
          }
        }
        
        await this.storageService.saveTeam(currentTeam);
      } else {
        // Fallback to original logic if team not found
        (team as any).updatedAt = new Date().toISOString();
        await this.storageService.saveTeam(team);
      }
    }

    let scheduledMessageId: string | null = null;
    if (enableGitReminder && this.messageSchedulerService) {
      const messageId = `git-reminder-${team.id}-${Date.now()}`;
      const gitReminderMessage: ScheduledMessage = {
        id: messageId,
        name: `Git Reminder for ${team.name}`,
        targetTeam: team.id,
        targetProject: (assignedProject as any).id,
        message: `📝 Git Reminder: Time to commit your changes! Remember our 30-minute commit discipline.\n\n` +
                `Project: ${assignedProject.name}\n` +
                `Please check your progress and commit any pending changes:\n` +
                `- Review your modified files\n` +
                `- Add meaningful commit messages\n` +
                `- Push changes if ready\n\n` +
                `This is an automated reminder to help maintain good development practices.`,
        delayAmount: 30,
        delayUnit: 'minutes',
        isRecurring: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any;
      try {
        await this.storageService.saveScheduledMessage(gitReminderMessage);
        this.messageSchedulerService.scheduleMessage(gitReminderMessage);
        scheduledMessageId = messageId;
      } catch (error) {
        console.error('Error creating git reminder:', error);
      }
    }

    const responseMessage = `Team started. Created ${sessionsCreated} new sessions, ${sessionsAlreadyRunning} already running. Sessions are working in project: ${assignedProject.name}` + (enableGitReminder ? '. Git reminders enabled every 30 minutes.' : '');
    res.json({
      success: true,
      message: responseMessage,
      data: { sessionsCreated, sessionsAlreadyRunning, projectName: assignedProject.name, projectPath: assignedProject.path, gitReminderEnabled: enableGitReminder, scheduledMessageId, results }
    } as ApiResponse);
  } catch (error) {
    console.error('Error starting team:', error);
    res.status(500).json({ success: false, error: 'Failed to start team' } as ApiResponse);
  }
}

export async function stopTeam(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (id === 'orchestrator') {
      res.json({ success: true, message: 'Orchestrator session cannot be stopped as it manages the system', data: { sessionsStopped: 0, sessionsNotFound: 0, results: [] } } as ApiResponse);
      return;
    }
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }

    let sessionsStopped = 0; let sessionsNotFound = 0; const results: any[] = [];
    for (const member of team.members) {
      if (member.sessionName) {
        try {
          const sessionExists = await this.tmuxService.sessionExists(member.sessionName);
          if (sessionExists) {
            await this.tmuxService.killSession(member.sessionName);
            sessionsStopped++;
            results.push({ memberName: member.name, sessionName: member.sessionName, status: 'stopped' });
          } else {
            sessionsNotFound++;
            results.push({ memberName: member.name, sessionName: member.sessionName, status: 'not_found' });
          }
          member.sessionName = '';
        } catch (error) {
          results.push({ memberName: member.name, sessionName: member.sessionName, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' });
          member.sessionName = '';
        }
      } else {
        results.push({ memberName: member.name, sessionName: null, status: 'no_session' });
      }
    }
    (team as any).updatedAt = new Date().toISOString();
    await this.storageService.saveTeam(team);

    if (this.messageSchedulerService) {
      try {
        const scheduledMessages = await this.storageService.getScheduledMessages();
        const teamMessages = scheduledMessages.filter(msg => (msg as any).targetTeam === team.id);
        for (const message of teamMessages) {
          (message as any).isActive = false;
          await this.storageService.saveScheduledMessage(message);
          this.messageSchedulerService.cancelMessage(message.id);
        }
      } catch (error) {
        console.error('Error cancelling team scheduled messages:', error);
      }
    }
    res.json({ success: true, message: `Team stopped. Stopped ${sessionsStopped} sessions, ${sessionsNotFound} were already stopped.`, data: { sessionsStopped, sessionsNotFound, results } } as ApiResponse);
  } catch (error) {
    console.error('Error stopping team:', error);
    res.status(500).json({ success: false, error: 'Failed to stop team' } as ApiResponse);
  }
}

export async function getTeamWorkload(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    let assignedTickets = 0; let completedTickets = 0;
    for (const project of projects) {
      const tickets = await this.storageService.getTickets(project.path, { assignedTo: id });
      assignedTickets += tickets.length;
      completedTickets += tickets.filter((t: any) => t.status === 'done').length;
    }
    res.json({ success: true, data: { teamId: id, teamName: team.name, assignedTickets, completedTickets, workloadPercentage: assignedTickets > 0 ? Math.round((completedTickets / assignedTickets) * 100) : 0 } } as ApiResponse);
  } catch (error) {
    console.error('Error getting team workload:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve team workload' } as ApiResponse);
  }
}

export async function deleteTeam(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (id === 'orchestrator') {
      res.status(400).json({ success: false, error: 'Cannot delete the Orchestrator Team' } as ApiResponse);
      return;
    }
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }

    try {
      const orchestratorSession = 'agentmux-orc';
      const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
      if (sessionExists) {
        const sessionNames = team.members?.map(m => m.sessionName).filter(Boolean) || [];
        const orchestratorPrompt = `## Team Deletion Notification\n\nTeam **"${team.name}"** (ID: ${id}) is being deleted.\n\n### Sessions to be terminated:\n${sessionNames.length > 0 ? sessionNames.map(name => `- ${name}`).join('\n') : '- No active sessions'}\n\n### Team Details:\n- **Team Name**: ${team.name}\n- **Members**: ${team.members?.length || 0}\n- **Current Project**: ${team.currentProject || 'None'}\n\nThe orchestrator should be aware that these team members are no longer available for task delegation.\n\n---\n*Team deletion initiated by user request.*`;
        await this.tmuxService.sendMessage(orchestratorSession, orchestratorPrompt);
      }
    } catch (notificationError) {
      console.warn('Failed to notify orchestrator about team deletion:', notificationError);
    }

    if (team.members && team.members.length > 0) {
      for (const member of team.members) {
        if (member.sessionName) {
          try {
            await this.tmuxService.killSession(member.sessionName);
            this.schedulerService.cancelAllChecksForSession(member.sessionName);
          } catch (error) {
            console.warn(`Failed to kill session for member ${member.name}:`, error);
          }
        }
      }
    }
    await this.storageService.deleteTeam(id);
    res.json({ success: true, message: 'Team terminated successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ success: false, error: 'Failed to terminate team' } as ApiResponse);
  }
}

export async function getTeamMemberSession(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params;
    const { lines = 50 } = req.query as any;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const member = team.members?.find(m => m.id === memberId);
    if (!member) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    if (!member.sessionName) { res.status(400).json({ success: false, error: 'No active session for this team member' } as ApiResponse); return; }
    const output = await this.tmuxService.capturePane(member.sessionName, Number(lines));
    res.json({ success: true, data: { memberId: member.id, memberName: member.name, sessionName: member.sessionName, output, timestamp: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error getting team member session:', error);
    res.status(500).json({ success: false, error: 'Failed to get team member session' } as ApiResponse);
  }
}

export async function addTeamMember(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, role } = req.body as any;
    if (!name || !role) { res.status(400).json({ success: false, error: 'Name and role are required' } as ApiResponse); return; }
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === id);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const newMember: TeamMember = {
      id: `member-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: String(name).trim(),
      sessionName: '',
      role: role as any,
      systemPrompt: `You are ${name}, a ${role} on the ${team.name} team.`,
      agentStatus: 'inactive',
      workingStatus: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;
    team.members.push(newMember);
    (team as any).updatedAt = new Date().toISOString();
    await this.storageService.saveTeam(team);
    res.json({ success: true, data: newMember, message: 'Team member added successfully' } as ApiResponse<TeamMember>);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ success: false, error: 'Failed to add team member' } as ApiResponse);
  }
}

export async function updateTeamMember(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params;
    const updates = req.body as any;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const memberIndex = team.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const updatedMember = { ...team.members[memberIndex], ...updates, updatedAt: new Date().toISOString() } as any;
    team.members[memberIndex] = updatedMember;
    (team as any).updatedAt = new Date().toISOString();
    await this.storageService.saveTeam(team);
    res.json({ success: true, data: updatedMember, message: 'Team member updated successfully' } as ApiResponse<TeamMember>);
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ success: false, error: 'Failed to update team member' } as ApiResponse);
  }
}

export async function deleteTeamMember(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const memberIndex = team.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const member = team.members[memberIndex];
    if (member.sessionName) {
      try { await this.tmuxService.killSession(member.sessionName); } catch (error) { console.warn(`Failed to kill tmux session ${member.sessionName}:`, error); }
    }
    team.members.splice(memberIndex, 1);
    (team as any).updatedAt = new Date().toISOString();
    await this.storageService.saveTeam(team);
    res.json({ success: true, message: 'Team member removed successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team member' } as ApiResponse);
  }
}

export async function startTeamMember(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const memberIndex = team.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const member = team.members[memberIndex];
    if (member.sessionName) {
      const sessions = await this.tmuxService.listSessions();
      const hasActiveSession = sessions.some(s => s.sessionName === member.sessionName);
      if (hasActiveSession) {
        // Handle synchronization issue: session exists but status might be inactive
        if (member.agentStatus === 'inactive') {
          try {
            // Try to check if the agent in the session is responsive
            const captureResult = await Promise.race([
              this.tmuxService.capturePane(member.sessionName, 5),
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Agent check timeout')), 1000)
              )
            ]);
            
            // If we can capture output, the session is likely active
            if (captureResult && captureResult.length > 0) {
              // Update status to active to sync with session state
              team.members[memberIndex] = { 
                ...member, 
                agentStatus: 'active', 
                workingStatus: member.workingStatus || 'working',
                updatedAt: new Date().toISOString() 
              } as any;
              await this.storageService.saveTeam(team);
              
              res.json({ 
                success: true, 
                message: 'Agent status synchronized with active session',
                sessionName: member.sessionName,
                agentStatus: 'active'
              } as ApiResponse);
              return;
            } else {
              // Session exists but appears zombie - kill it and proceed with new creation
              console.log(`Cleaning up zombie session: ${member.sessionName}`);
              await this.tmuxService.killSession(member.sessionName).catch(() => {
                // Ignore errors if session doesn't exist
              });
              // Clear the session name and allow new session creation
              team.members[memberIndex] = { 
                ...member, 
                sessionName: undefined,
                updatedAt: new Date().toISOString() 
              } as any;
            }
          } catch (error) {
            // If we can't check the session, assume it's zombie and clean it up
            console.log(`Error checking session ${member.sessionName}, treating as zombie:`, error);
            await this.tmuxService.killSession(member.sessionName).catch(() => {
              // Ignore errors if session doesn't exist
            });
            // Clear the session name and allow new session creation
            team.members[memberIndex] = { 
              ...member, 
              sessionName: undefined,
              updatedAt: new Date().toISOString() 
            } as any;
          }
        } else {
          // Session exists and agent status is active/activating - this is normal conflict
          res.status(400).json({ success: false, error: 'Team member already has an active session' } as ApiResponse); 
          return;
        }
      }
    }
    if (member.agentStatus === 'activating' || member.agentStatus === 'active') {
      res.status(400).json({ success: false, error: `Team member is already ${member.agentStatus}` } as ApiResponse); return;
    }
    team.members[memberIndex] = { ...member, agentStatus: 'activating', workingStatus: member.workingStatus || 'idle', updatedAt: new Date().toISOString() } as any;
    await this.storageService.saveTeam(team);
    try {
      const sessionConfig = {
        name: member.name,
        role: member.role,
        systemPrompt: member.systemPrompt,
        projectPath: (team as any).currentProject ? (await this.storageService.getProjects()).find(p => p.id === (team as any).currentProject)?.path : undefined,
        memberId: member.id
      };
      const teamSlug = team.name.toLowerCase().replace(/\s+/g, '-');
      const memberSlug = member.name.toLowerCase().replace(/\s+/g, '-');
      const memberIdSlug = member.id.substring(0, 8);
      const sessionName = `${teamSlug}-${memberSlug}-${memberIdSlug}`;
      const createResult = await this.tmuxService.createTeamMemberSession(sessionConfig as any, sessionName);
      if (createResult.success) {
        // Re-fetch current team state to preserve any status updates that happened during session creation
        const currentTeams = await this.storageService.getTeams();
        const currentTeam = currentTeams.find(t => t.id === teamId);
        const currentMember = currentTeam?.members.find(m => m.id === memberId);
        
        if (currentTeam && currentMember) {
          // Preserve current agentStatus (might have been updated during session creation)
          // but ensure sessionName is set
          currentMember.sessionName = createResult.sessionName || sessionName;
          currentMember.updatedAt = new Date().toISOString();
          
          await this.storageService.saveTeam(currentTeam);
          
          // Return current agentStatus in response
          res.json({ 
            success: true, 
            data: { 
              memberId: member.id, 
              sessionName: createResult.sessionName || sessionName, 
              status: currentMember.agentStatus 
            }, 
            message: `Team member ${member.name} started successfully` 
          } as ApiResponse);
        } else {
          // Fallback if team not found
          team.members[memberIndex].sessionName = createResult.sessionName || sessionName;
          team.members[memberIndex].updatedAt = new Date().toISOString();
          await this.storageService.saveTeam(team);
          res.json({ success: true, data: { memberId: member.id, sessionName: createResult.sessionName, status: team.members[memberIndex].agentStatus }, message: `Team member ${member.name} started successfully` } as ApiResponse);
        }
      } else {
        team.members[memberIndex] = { ...member, agentStatus: 'inactive', updatedAt: new Date().toISOString() } as any;
        await this.storageService.saveTeam(team);
        res.status(500).json({ success: false, error: createResult.error || 'Failed to create team member session' } as ApiResponse);
      }
    } catch (error) {
      team.members[memberIndex] = { ...member, agentStatus: 'inactive', updatedAt: new Date().toISOString() } as any;
      await this.storageService.saveTeam(team);
      console.error('Error starting team member:', error);
      res.status(500).json({ success: false, error: 'Failed to start team member' } as ApiResponse);
    }
  } catch (error) {
    console.error('Error starting team member:', error);
    res.status(500).json({ success: false, error: 'Failed to start team member' } as ApiResponse);
  }
}

export async function stopTeamMember(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const memberIndex = team.members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const member = team.members[memberIndex];
    try {
      if (member.sessionName) {
        try { await this.tmuxService.killSession(member.sessionName); } catch (error) { console.log(`Session ${member.sessionName} could not be killed (might already be dead):`, error); }
      }
      team.members[memberIndex] = { ...member, sessionName: '', agentStatus: 'inactive', workingStatus: 'idle', updatedAt: new Date().toISOString() } as any;
      await this.storageService.saveTeam(team);
      res.json({ success: true, data: { memberId: member.id, status: 'idle' }, message: `Team member ${member.name} stopped successfully` } as ApiResponse);
    } catch (error) {
      console.error('Error stopping team member session:', error);
      res.status(500).json({ success: false, error: 'Failed to stop team member session' } as ApiResponse);
    }
  } catch (error) {
    console.error('Error stopping team member:', error);
    res.status(500).json({ success: false, error: 'Failed to stop team member' } as ApiResponse);
  }
}

export async function reportMemberReady(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { sessionName, role, capabilities, readyAt } = req.body as any;
    if (!sessionName || !role) { res.status(400).json({ success: false, error: 'sessionName and role are required' } as ApiResponse); return; }
    const teams = await this.storageService.getTeams();
    let memberFound = false;
    for (const team of teams) {
      for (const member of team.members) {
        if (member.sessionName === sessionName) {
          (member as any).readyAt = readyAt || new Date().toISOString();
          (member as any).capabilities = capabilities || [];
          memberFound = true;
          break;
        }
      }
      if (memberFound) {
        (team as any).updatedAt = new Date().toISOString();
        await this.storageService.saveTeam(team);
        break;
      }
    }
    if (!memberFound) { console.warn(`Session ${sessionName} not found in any team, but reporting ready anyway`); }
    res.json({ success: true, message: `Agent ${sessionName} reported ready with role ${role}`, data: { sessionName, role, capabilities, readyAt } } as ApiResponse);
  } catch (error) {
    console.error('Error reporting member ready:', error);
    res.status(500).json({ success: false, error: 'Failed to report member ready' } as ApiResponse);
  }
}

export async function registerMemberStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  console.log(`[API] 🚀 registerMemberStatus called`);
  console.log(`[API] 📋 Request headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[API] 📤 Request body:`, JSON.stringify(req.body, null, 2));
  console.log(`[API] 🌐 Request URL:`, req.url);
  console.log(`[API] 🔧 Request method:`, req.method);
  try {
    const { sessionName, role, status, registeredAt, memberId } = req.body as any;
    console.log(`[API] 📋 Extracted parameters:`, { sessionName, role, status, registeredAt, memberId });
    if (!sessionName || !role) { res.status(400).json({ success: false, error: 'sessionName and role are required' } as ApiResponse); return; }
    if (role === 'orchestrator' && sessionName === 'agentmux-orc') {
      console.log(`[API] 🎭 Handling orchestrator registration`);
      try {
        await this.storageService.updateOrchestratorStatus('active');
        console.log(`[API] ✅ Orchestrator registered as active`);
        res.json({ success: true, message: `Orchestrator ${sessionName} registered as active`, sessionName } as ApiResponse);
        return;
      } catch (error) {
        console.log(`[API] ❌ Error updating orchestrator status:`, error);
        res.status(500).json({ success: false, error: 'Failed to update orchestrator status' } as ApiResponse);
        return;
      }
    }
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
          member.agentStatus = 'active';
          (member as any).workingStatus = (member as any).workingStatus || 'idle';
          (member as any).readyAt = registeredAt || new Date().toISOString();
          if (memberId && member.id === memberId && !member.sessionName) {
            member.sessionName = sessionName;
            console.log(`[API] 📝 Updated member sessionName to: ${sessionName}`);
          }
          memberFound = true;
          break;
        }
      }
      if (memberFound) {
        (team as any).updatedAt = new Date().toISOString();
        console.log(`[API] 💾 Saving updated team: ${team.name}`);
        await this.storageService.saveTeam(team);
        break;
      }
    }
    if (!memberFound) { console.log(`[API] ⚠️ Session ${sessionName}${memberId ? ` (member ID: ${memberId})` : ''} not found in any team, but registering status anyway`); }
    console.log(`[API] ✅ Registration successful, sending response`);
    res.json({ success: true, message: `Agent ${sessionName} registered as active with role ${role}`, data: { sessionName, role, status: 'active', registeredAt: registeredAt || new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.log(`[API] ❌ Exception in registerMemberStatus:`, error);
    console.log(`[API] 📋 Error details:`, { name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : 'No stack trace' });
    res.status(500).json({ success: false, error: 'Failed to register member status' } as ApiResponse);
  }
}

export async function generateMemberContext(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params as any;
    const options = req.query as any;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const member = team.members.find(m => m.id === memberId);
    if (!member) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => Object.values(p.teams || {}).flat().includes(teamId));
    if (!project) { res.status(404).json({ success: false, error: 'No project found for this team' } as ApiResponse); return; }
    const contextLoader = new (await import('../../services/context-loader.service.js')).ContextLoaderService(project.path);
    const contextPrompt = await contextLoader.generateContextPrompt(member, {
      includeFiles: options.includeFiles !== 'false',
      includeGitHistory: options.includeGitHistory !== 'false',
      includeTickets: options.includeTickets !== 'false'
    });
    res.json({ success: true, data: { teamId, memberId, memberName: member.name, contextPrompt, generatedAt: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error generating member context:', error);
    res.status(500).json({ success: false, error: 'Failed to generate member context' } as ApiResponse);
  }
}

export async function injectContextIntoSession(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params as any;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const member = team.members.find(m => m.id === memberId);
    if (!member) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => Object.values(p.teams || {}).flat().includes(teamId));
    if (!project) { res.status(404).json({ success: false, error: 'No project found for this team' } as ApiResponse); return; }
    const { ContextLoaderService } = await import('../../services/context-loader.service.js');
    const contextLoader = new ContextLoaderService(project.path);
    const success = await contextLoader.injectContextIntoSession(member.sessionName, member);
    if (!success) { res.status(500).json({ success: false, error: 'Failed to inject context into session' } as ApiResponse); return; }
    res.json({ success: true, data: { teamId, memberId, memberName: member.name, sessionName: member.sessionName, contextInjected: true, injectedAt: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error injecting context into session:', error);
    res.status(500).json({ success: false, error: 'Failed to inject context into session' } as ApiResponse);
  }
}

export async function refreshMemberContext(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { teamId, memberId } = req.params as any;
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const member = team.members.find(m => m.id === memberId);
    if (!member) { res.status(404).json({ success: false, error: 'Team member not found' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => Object.values(p.teams || {}).flat().includes(teamId));
    if (!project) { res.status(404).json({ success: false, error: 'No project found for this team' } as ApiResponse); return; }
    const { ContextLoaderService } = await import('../../services/context-loader.service.js');
    const contextLoader = new ContextLoaderService(project.path);
    const contextPath = await contextLoader.refreshContext(member);
    res.json({ success: true, data: { teamId, memberId, memberName: member.name, contextPath, refreshedAt: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error refreshing member context:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh member context' } as ApiResponse);
  }
}

export async function getTeamActivityStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const now = new Date().toISOString();
    const orchestratorRunning = await this.tmuxService.sessionExists('agentmux-orc');
    const teams = await this.storageService.getTeams();
    const memberStatuses: any[] = [];
    const teamsToUpdate: typeof teams = [];

    // Process all teams with concurrency limit to prevent overwhelming the system
    const CONCURRENCY_LIMIT = 2; // Reduced to be more conservative
    const MAX_OUTPUT_SIZE = 1024; // Max 1KB per member terminal output

    for (let teamIndex = 0; teamIndex < teams.length; teamIndex += CONCURRENCY_LIMIT) {
      const teamBatch = teams.slice(teamIndex, teamIndex + CONCURRENCY_LIMIT);
      
      const teamPromises = teamBatch.map(async (team) => {
        let teamUpdated = false;
        
        for (const member of team.members) {
          if (member.agentStatus === 'active' && member.sessionName) {
            try {
              // Add timeout to prevent hanging
              const sessionExists = await Promise.race([
                this.tmuxService.sessionExists(member.sessionName),
                new Promise<boolean>((_, reject) => 
                  setTimeout(() => reject(new Error('Session check timeout')), 3000)
                )
              ]);

              if (!sessionExists) {
                member.agentStatus = 'inactive';
                member.workingStatus = 'idle';
                (member as any).lastActivityCheck = now;
                // Clear terminal output to prevent memory leak
                delete (member as any).lastTerminalOutput;
                teamUpdated = true;

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

              // Capture terminal output with strict timeout and size limit
              const currentOutput = await Promise.race([
                this.tmuxService.capturePane(member.sessionName, 15), // Reduced from 50 to 15 lines
                new Promise<string>((_, reject) => 
                  setTimeout(() => reject(new Error('Capture timeout')), 2000) // Shorter timeout
                )
              ]).catch(() => ''); // Return empty string on error/timeout

              // Strict size limiting to prevent memory issues
              const trimmedOutput = currentOutput.length > MAX_OUTPUT_SIZE 
                ? '...' + currentOutput.substring(currentOutput.length - MAX_OUTPUT_SIZE + 3)
                : currentOutput;

              const previousOutput = (member as any).lastTerminalOutput || '';
              const activityDetected = trimmedOutput !== previousOutput && trimmedOutput.trim() !== '';
              const newWorkingStatus = activityDetected ? 'in_progress' : 'idle';
              
              if (member.workingStatus !== newWorkingStatus) {
                member.workingStatus = newWorkingStatus;
                teamUpdated = true;
              }
              
              (member as any).lastActivityCheck = now;
              // Store only limited output to prevent memory leak
              (member as any).lastTerminalOutput = trimmedOutput;

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
              // Clear terminal output on error to prevent memory leak
              delete (member as any).lastTerminalOutput;
              
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
            memberStatuses.push({
              teamId: team.id,
              teamName: team.name,
              memberId: member.id,
              memberName: member.name,
              role: member.role,
              sessionName: member.sessionName || '',
              agentStatus: member.agentStatus || 'inactive',
              workingStatus: member.workingStatus || 'idle',
              lastActivityCheck: (member as any).lastActivityCheck || now,
              activityDetected: false
            });
          }
        }

        if (teamUpdated) {
          teamsToUpdate.push(team);
        }
      });

      await Promise.all(teamPromises);
    }

    // Save only teams that were actually updated (more efficient than saving all teams)
    if (teamsToUpdate.length > 0) {
      const savePromises = teamsToUpdate.map(team => this.storageService.saveTeam(team));
      await Promise.all(savePromises);
    }

    // Clean up memory before sending response
    if (global.gc) {
      global.gc();
    }

    res.json({
      success: true,
      data: {
        orchestrator: { running: orchestratorRunning, sessionName: orchestratorRunning ? 'agentmux-orc' : null },
        teams,
        members: memberStatuses,
        checkedAt: now,
        totalMembers: memberStatuses.length,
        totalActiveMembers: memberStatuses.filter(m => m.agentStatus === 'active').length
      }
    } as ApiResponse);

  } catch (error) {
    console.error('Error checking team activity status:', error);
    res.status(500).json({ success: false, error: 'Failed to check team activity status' } as ApiResponse);
  }
}
