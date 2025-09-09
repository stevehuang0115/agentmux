import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { ProjectModel, TeamModel } from '../../models/index.js';
import { ContextLoaderService } from '../../services/context-loader.service.js';
import { WorkflowService } from '../../services/workflow.service.js';
import { TicketEditorService } from '../../services/ticket-editor.service.js';
import { TaskService } from '../../services/task.service.js';
import { ApiResponse, Project } from '../../types/index.js';
import { getFileIcon, countFiles } from '../utils/file-utils.js';

const execAsync = promisify(exec);

// Project Management
export async function createProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { path: projectPath, name, description } = req.body as any;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'Project path is required' } as ApiResponse);
      return;
    }
    const project = await this.storageService.addProject(projectPath);
    if (name || description) {
      const projectModel = ProjectModel.fromJSON(project);
      if (name) (projectModel as any).name = name;
      if (description) (projectModel as any).description = description;
      const updated = projectModel.toJSON();
      await this.storageService.saveProject(updated);
      res.status(201).json({ success: true, data: updated, message: 'Project added successfully' } as ApiResponse<Project>);
      return;
    }
    res.status(201).json({ success: true, data: project, message: 'Project added successfully' } as ApiResponse<Project>);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' } as ApiResponse);
  }
}

export async function getProjects(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const projects = await this.storageService.getProjects();
    res.json({ success: true, data: projects } as ApiResponse<Project[]>);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve projects' } as ApiResponse);
  }
}

export async function getProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    res.json({ success: true, data: project } as ApiResponse<Project>);
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve project' } as ApiResponse);
  }
}

export async function getProjectStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const tickets = await this.storageService.getTickets(project.path);
    const activeTickets = tickets.filter(t => t.status !== 'done');
    res.json({ success: true, data: { project, activeTickets: activeTickets.length, totalTickets: tickets.length, teams: project.teams || {} } } as ApiResponse);
  } catch (error) {
    console.error('Error getting project status:', error);
    res.status(500).json({ success: false, error: 'Failed to get project status' } as ApiResponse);
  }
}

// Delegated complex project lifecycle operations (keep behavior intact)
export async function startProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const { teamIds } = req.body as any;
    if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) { res.status(400).json({ success: false, error: 'Team IDs array is required' } as ApiResponse); return; }
    const teamId = teamIds[0];
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    const result = await WorkflowService.getInstance().startProject({ projectId: id, teamId });
    if (!result.success) { res.status(500).json({ success: false, error: result.error || 'Failed to start project orchestration' } as ApiResponse); return; }
    project.status = 'active';
    await this.storageService.saveProject(project);
    let scheduleInfo: any; try { scheduleInfo = await this.activeProjectsService.startProject(id, this.messageSchedulerService); } catch (e) { console.warn('Failed to start project lifecycle management:', e); }
    res.json({ success: true, message: result.message || 'Project orchestration started successfully', data: { projectId: id, teamId, executionId: result.executionId, orchestrationStarted: true, checkInScheduleId: scheduleInfo?.checkInScheduleId, gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId } } as ApiResponse);
  } catch (error) {
    console.error('Error starting project:', error);
    res.status(500).json({ success: false, error: 'Failed to start project' } as ApiResponse);
  }
}

export async function stopProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    try { await this.activeProjectsService.stopProject(id, this.messageSchedulerService); } catch (e) { console.warn('Failed to stop project lifecycle management:', e); }
    project.status = 'stopped';
    await this.storageService.saveProject(project);
    res.json({ success: true, message: 'Project stopped successfully', data: { projectId: id, status: 'stopped' } } as ApiResponse);
  } catch (error) {
    console.error('Error stopping project:', error);
    res.status(500).json({ success: false, error: 'Failed to stop project' } as ApiResponse);
  }
}

export async function restartProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    let scheduleInfo: any;
    try { scheduleInfo = await this.activeProjectsService.restartProject(id, this.messageSchedulerService); } catch (e) { console.warn('Failed to restart project lifecycle management:', e); }
    project.status = 'active';
    await this.storageService.saveProject(project);
    res.json({ success: true, message: 'Project restarted successfully', data: { projectId: id, status: 'active', checkInScheduleId: scheduleInfo?.checkInScheduleId, gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId } } as ApiResponse);
  } catch (error) {
    console.error('Error restarting project:', error);
    res.status(500).json({ success: false, error: 'Failed to restart project' } as ApiResponse);
  }
}

export async function assignTeamsToProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const { teamAssignments } = req.body as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const projectModel = ProjectModel.fromJSON(project);
    if (teamAssignments) {
      for (const [role, teamIds] of Object.entries(teamAssignments)) {
        for (const teamId of teamIds as string[]) { projectModel.assignTeam(teamId, role); }
      }
    }
    await this.storageService.saveProject(projectModel.toJSON());
    const assignedTeamDetails: Array<{ team: any, role: string }> = [];
    if (teamAssignments) {
      const teams = await this.storageService.getTeams();
      for (const [role, teamIds] of Object.entries(teamAssignments)) {
        for (const teamId of teamIds as string[]) {
          const team = teams.find(t => t.id === teamId);
          if (team) {
            (team as any).currentProject = id;
            (team as any).updatedAt = new Date().toISOString();
            await this.storageService.saveTeam(team);
            assignedTeamDetails.push({ team, role });
          }
        }
      }
    }
    if (assignedTeamDetails.length > 0) {
      try {
        const orchestratorSession = 'agentmux-orc';
        const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
        if (sessionExists) {
          const teamsInfo = assignedTeamDetails.map(({ team, role }) => {
            const memberList = (team.members || []).map((m: any) => `  - ${m.name} (${m.role}) - ${m.sessionName || 'N/A'}`).join('\\n') || '  No members found';
            const sessions = (team.members || []).map((m: any) => m.sessionName || 'N/A').join(', ') || 'No sessions';
            return `### ${team.name} (${role})\n- **Team ID**: ${team.id}\n- **Members**: ${(team.members || []).length} members\n- **Session Names**: ${sessions}\n- **Member Details**:\n${memberList}`;
          }).join('\\n\\n');
          const orchestratorPrompt = `## Team Assignment Notification\n\nNew team(s) have been assigned to project **${project.name}**!\n\n${teamsInfo}\n\n### Action Required:\nPlease use the MCP tooling to create and initialize the assigned team sessions. You should:\n\n1. **Create tmux sessions** for each team member using their designated session names\n2. **Initialize the project environment** in each session with the project path: \`${project.path}\`\n3. **Set up the development context** for each team member based on their role\n4. **Verify all sessions are active** and ready for collaboration\n\n### Project Details:\n- **Project Path**: ${project.path}\n- **Project ID**: ${project.id}\n- **Total Teams Assigned**: ${assignedTeamDetails.length}\n\n---\n*Please confirm when all team sessions have been created and initialized successfully.*`;
          await this.tmuxService.sendMessage(orchestratorSession, orchestratorPrompt);
          await new Promise(resolve => setTimeout(resolve, 500));
          const tmuxProcess = spawn('tmux', ['send-keys', '-t', orchestratorSession, 'Enter']);
          await new Promise((resolve, reject) => {
            tmuxProcess.on('close', code => code === 0 ? resolve(code) : reject(new Error(`tmux send-keys failed with exit code ${code}`)));
            tmuxProcess.on('error', reject);
          });
        }
      } catch (notificationError) {
        console.warn('Failed to notify orchestrator about team assignment:', notificationError);
      }
    }
    res.json({ success: true, data: projectModel.toJSON(), message: 'Teams assigned to project successfully' } as ApiResponse<Project>);
  } catch (error) {
    console.error('Error assigning teams to project:', error);
    res.status(500).json({ success: false, error: 'Failed to assign teams to project' } as ApiResponse);
  }
}

export async function unassignTeamFromProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id: projectId } = req.params as any;
    const { teamId } = req.body as any;
    if (!teamId) { res.status(400).json({ success: false, error: 'Missing required field: teamId' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const teams = await this.storageService.getTeams();
    const team = teams.find(t => t.id === teamId);
    if (!team) { res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse); return; }
    if ((team as any).currentProject !== projectId) { res.status(400).json({ success: false, error: 'Team is not assigned to this project' } as ApiResponse); return; }
    const projectModel = ProjectModel.fromJSON(project);
    projectModel.unassignTeam(teamId);
    await this.storageService.saveProject(projectModel.toJSON());
    (team as any).currentProject = undefined;
    (team as any).updatedAt = new Date().toISOString();
    await this.storageService.saveTeam(team);
    try {
      const orchestratorSession = 'agentmux-orc';
      const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
      if (sessionExists) {
        const memberLines = (team.members || []).map(m => `- ${m.name} (${m.role}) - Session: ${m.sessionName || 'N/A'}`).join('\\n') || 'No members found';
        const notificationMessage = `## Team Unassignment Notification\n\nTeam **${team.name}** has been unassigned from project **${project.name}**.\n\n### Team Details:\n- **Team ID**: ${team.id}\n- **Team Name**: ${team.name}  \n- **Members**: ${(team.members || []).length} members\n- **Previous Project**: ${project.name}\n\n### Action Required:\nPlease coordinate the cleanup of team member sessions and update any active workflows accordingly.\n\n### Team Members to Clean Up:\n${memberLines}\n\n---\n*This notification was sent automatically when the team was unassigned from the project.*`;
        await this.tmuxService.sendMessage(orchestratorSession, notificationMessage);
        await new Promise(resolve => setTimeout(resolve, 500));
        const tmuxProcess = spawn('tmux', ['send-keys', '-t', orchestratorSession, 'Enter']);
        await new Promise((resolve, reject) => {
          tmuxProcess.on('close', code => code === 0 ? resolve(code) : reject(new Error(`tmux send-keys failed with exit code ${code}`)));
          tmuxProcess.on('error', reject);
        });
      }
    } catch (notificationError) {
      console.warn('Failed to notify orchestrator about team unassignment:', notificationError);
    }
    res.json({ success: true, data: projectModel.toJSON(), message: `Team "${team.name}" unassigned from project "${project.name}" successfully` } as ApiResponse<Project>);
  } catch (error) {
    console.error('Error unassigning team from project:', error);
    res.status(500).json({ success: false, error: 'Failed to unassign team from project' } as ApiResponse);
  }
}

export async function getProjectFiles(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { depth = '3', includeDotFiles = 'true' } = req.query as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }

    const buildFileTree = async (dirPath: string, relativePath = '', currentDepth = 0, maxDepth = parseInt(depth as string)): Promise<any[]> => {
      if (currentDepth > maxDepth) return [];
      try {
        const items = await fs.readdir(dirPath);
        const tree: any[] = [];
        for (const item of items) {
          const isAgentmuxFolder = item === '.agentmux';
          const isDotFile = item.startsWith('.');
          if (isDotFile && !isAgentmuxFolder && includeDotFiles !== 'true') continue;
          const fullPath = path.join(dirPath, item);
          const relativeItemPath = relativePath ? path.join(relativePath, item) : item;
          try {
            const stats = await fs.stat(fullPath);
            const node: any = {
              name: item,
              path: relativeItemPath,
              type: stats.isDirectory() ? 'folder' : 'file',
              size: stats.size,
              modified: stats.mtime.toISOString(),
              icon: getFileIcon(item, stats.isDirectory())
            };
            if (stats.isDirectory()) {
              node.children = await buildFileTree(fullPath, relativeItemPath, currentDepth + 1, maxDepth);
            }
            tree.push(node);
          } catch {}
        }
        return tree.sort((a, b) => {
          if (a.name === '.agentmux') return -1; if (b.name === '.agentmux') return 1;
          if (a.type === 'folder' && b.type === 'file') return -1; if (a.type === 'file' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
      } catch {
        return [];
      }
    };

    // Resolve project path robustly
    let resolvedPath: string;
    if (path.isAbsolute(project.path)) {
      resolvedPath = project.path;
    } else {
      const parentDir = path.dirname(process.cwd());
      const parentResolved = path.resolve(parentDir, project.path);
      try { await fs.stat(parentResolved); resolvedPath = parentResolved; }
      catch { resolvedPath = path.resolve(project.path); }
    }
    try { await fs.stat(resolvedPath); } catch (pathError: any) {
      res.status(400).json({ success: false, error: `Project path "${resolvedPath}" is not accessible: ${pathError?.message || 'Unknown error'}` } as ApiResponse); return;
    }
    const fileTree = await buildFileTree(resolvedPath);
    const totalFiles = countFiles(fileTree);
    res.json({ success: true, data: { project: { id: project.id, name: project.name, path: project.path }, files: fileTree, totalFiles, generatedAt: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error getting project files:', error);
    res.status(500).json({ success: false, error: 'Failed to get project files' } as ApiResponse);
  }
}

export async function getFileContent(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params as any;
    const { filePath } = req.query as any;
    if (!filePath || typeof filePath !== 'string') { res.status(400).json({ success: false, error: 'File path is required' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const resolvedProjectPath = path.isAbsolute(project.path) ? project.path : path.resolve(process.cwd(), project.path);
    try { await fs.access(resolvedProjectPath); } catch { res.status(404).json({ success: false, error: 'Project directory does not exist' } as ApiResponse); return; }
    const fullFilePath = path.join(resolvedProjectPath, filePath);
    const resolvedFilePath = path.resolve(fullFilePath);
    if (!resolvedFilePath.startsWith(resolvedProjectPath)) { res.status(403).json({ success: false, error: 'Access denied: File outside project directory' } as ApiResponse); return; }
    try {
      const content = await fs.readFile(fullFilePath, 'utf8');
      res.json({ success: true, data: { content, filePath } } as ApiResponse<{ content: string; filePath: string }>);
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') res.status(404).json({ success: false, error: 'File not found' } as ApiResponse);
      else if (fileError.code === 'EISDIR') res.status(400).json({ success: false, error: 'Path is a directory, not a file' } as ApiResponse);
      else throw fileError;
    }
  } catch (error) {
    console.error('Error reading file content:', error);
    res.status(500).json({ success: false, error: 'Failed to read file content' } as ApiResponse);
  }
}

export async function getAgentmuxMarkdownFiles(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectPath } = req.query as any;
    if (!projectPath || typeof projectPath !== 'string') { res.status(400).json({ success: false, error: 'Project path is required' } as ApiResponse); return; }
    const agentmuxPath = path.join(projectPath, '.agentmux');
    try { await fs.access(agentmuxPath); } catch { await fs.mkdir(agentmuxPath, { recursive: true }); await fs.mkdir(path.join(agentmuxPath, 'specs'), { recursive: true }); }
    const files: string[] = [];
    const scanDirectory = async (dirPath: string, relativePath = '') => {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativeFilePath = path.join(relativePath, entry.name);
          if (entry.isDirectory()) await scanDirectory(fullPath, relativeFilePath);
          else if (entry.name.endsWith('.md')) files.push(relativeFilePath);
        }
      } catch {}
    };
    await scanDirectory(agentmuxPath);
    res.json({ success: true, data: { files } } as ApiResponse<{ files: string[] }>);
  } catch (error) {
    console.error('Error scanning .agentmux files:', error);
    res.status(500).json({ success: false, error: 'Failed to scan .agentmux files' } as ApiResponse);
  }
}

export async function saveMarkdownFile(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectPath, filePath, content } = req.body as any;
    if (!projectPath || !filePath || content === undefined) { res.status(400).json({ success: false, error: 'Project path, file path, and content are required' } as ApiResponse); return; }
    const fullFilePath = path.join(projectPath, filePath);
    const resolvedProjectPath = path.resolve(projectPath);
    const resolvedFilePath = path.resolve(fullFilePath);
    if (!resolvedFilePath.startsWith(resolvedProjectPath)) { res.status(403).json({ success: false, error: 'Access denied: File outside project directory' } as ApiResponse); return; }
    await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
    await fs.writeFile(fullFilePath, content, 'utf8');
    res.json({ success: true, message: 'File saved successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error saving markdown file:', error);
    res.status(500).json({ success: false, error: 'Failed to save file' } as ApiResponse);
  }
}

export async function getProjectCompletion(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projects = await this.storageService.getProjects();
    const project = projects.find((p: any) => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const tickets = await this.storageService.getTickets(project.path);
    const completedTickets = tickets.filter(t => t.status === 'done');
    const completionRate = tickets.length > 0 ? Math.round((completedTickets.length / tickets.length) * 100) : 0;
    res.json({ success: true, data: { totalTickets: tickets.length, completedTickets: completedTickets.length, completionRate, isCompleted: completionRate === 100 } } as ApiResponse);
  } catch (error) {
    console.error('Error getting project completion:', error);
    res.status(500).json({ success: false, error: 'Failed to get project completion' } as ApiResponse);
  }
}

export async function deleteProject(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projects = await this.storageService.getProjects();
    const project = projects.find((p: any) => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const teams = await this.storageService.getTeams();
    const activeTeams = teams.filter((t: any) => (t as any).currentProject === id);
    if (activeTeams.length > 0) {
      for (const team of activeTeams) {
        const teamModel = (await import('../../models/index.js')).TeamModel.fromJSON(team);
        (teamModel as any).currentProject = undefined;
        await this.storageService.saveTeam(teamModel.toJSON());
      }
    }
    await this.storageService.deleteProject(id);
    res.json({ success: true, message: `Project deleted successfully. ${activeTeams.length} teams were unassigned.` } as ApiResponse);
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' } as ApiResponse);
  }
}

export async function getProjectStats(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }

    // Resolve path similar to original controller
    const resolvedProjectPath = path.isAbsolute(project.path)
      ? project.path
      : path.resolve(process.cwd(), project.path);

    const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');

    let mdFileCount = 0;
    let hasProjectMd = false;
    let hasUserJourneyMd = false;
    let hasInitialGoalMd = false;
    let hasInitialUserJourneyMd = false;

    try {
      await fs.access(specsPath);
      const files = await fs.readdir(specsPath);
      for (const file of files) {
        const filePath = path.join(specsPath, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isFile() && file.endsWith('.md')) {
            mdFileCount++;
            if (file === 'project.md') hasProjectMd = true;
            if (file === 'user-journey.md') hasUserJourneyMd = true;
            if (file === 'initial_goal.md') hasInitialGoalMd = true;
            if (file === 'initial_user_journey.md') hasInitialUserJourneyMd = true;
          }
        } catch {}
      }
    } catch {
      // specs folder missing; keep defaults
    }

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

    res.json({ success: true, data: stats, message: 'Project stats retrieved successfully' } as ApiResponse);
  } catch (error) {
    console.error('Error getting project stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get project stats' } as ApiResponse);
  }
}

export async function openProjectInFinder(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const resolvedProjectPath = path.isAbsolute(project.path) ? project.path : path.resolve(process.cwd(), project.path);
    try { await fs.access(resolvedProjectPath); } catch { res.status(404).json({ success: false, error: 'Project directory does not exist' } as ApiResponse); return; }
    try { await execAsync(`open "${resolvedProjectPath}"`); res.json({ success: true, message: 'Project folder opened in Finder' } as ApiResponse); }
    catch (e) { console.error('Error opening Finder:', e); res.status(500).json({ success: false, error: 'Failed to open Finder' } as ApiResponse); }
  } catch (error) {
    console.error('Error opening project in Finder:', error);
    res.status(500).json({ success: false, error: 'Failed to open project in Finder' } as ApiResponse);
  }
}

export async function createSpecFile(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { fileName, content } = req.body as any;
    if (!fileName || !content) { res.status(400).json({ success: false, error: 'Missing fileName or content' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const resolvedProjectPath = path.isAbsolute(project.path) ? project.path : path.resolve(process.cwd(), project.path);
    const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
    const filePath = path.join(specsPath, fileName);
    try { await fs.mkdir(specsPath, { recursive: true }); await fs.writeFile(filePath, content, 'utf-8');
      res.json({ success: true, data: { fileName, filePath, specsPath }, message: `${fileName} saved successfully` } as ApiResponse);
    } catch (error) {
      console.error('Error creating spec file:', error);
      res.status(500).json({ success: false, error: 'Failed to create spec file' } as ApiResponse);
    }
  } catch (error) {
    console.error('Error creating spec file:', error);
    res.status(500).json({ success: false, error: 'Failed to create spec file' } as ApiResponse);
  }
}

export async function getSpecFileContent(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { fileName } = req.query as any;
    if (!fileName) { res.status(400).json({ success: false, error: 'Missing fileName parameter' } as ApiResponse); return; }
    const projects = await this.storageService.getProjects();
    const project = projects.find((p: any) => p.id === id);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const resolvedProjectPath = path.isAbsolute(project.path) ? project.path : path.resolve(process.cwd(), project.path);
    const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
    const filePath = path.join(specsPath, String(fileName));
    try { const content = await fs.readFile(filePath, 'utf-8');
      res.json({ success: true, data: { fileName, content, filePath }, message: `${fileName} content retrieved successfully` } as ApiResponse);
    } catch {
      res.status(404).json({ success: false, error: `File ${fileName} not found` } as ApiResponse);
    }
  } catch (error) {
    console.error('Error getting spec file content:', error);
    res.status(500).json({ success: false, error: 'Failed to get spec file content' } as ApiResponse);
  }
}

export async function getProjectContext(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const options = req.query as any;
    const projects = await this.storageService.getProjects();
    const project = projects.find((p: any) => p.id === projectId);
    if (!project) { res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse); return; }
    const contextLoader = new ContextLoaderService(project.path);
    const context = await contextLoader.loadProjectContext({
      includeFiles: options.includeFiles !== 'false',
      includeGitHistory: options.includeGitHistory !== 'false',
      includeTickets: options.includeTickets !== 'false',
      maxFileSize: options.maxFileSize ? parseInt(options.maxFileSize) : undefined,
      fileExtensions: options.fileExtensions ? String(options.fileExtensions).split(',') : undefined
    });
    res.json({ success: true, data: context } as ApiResponse);
  } catch (error) {
    console.error('Error loading project context:', error);
    res.status(500).json({ success: false, error: 'Failed to load project context' } as ApiResponse);
  }
}
