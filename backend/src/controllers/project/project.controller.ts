import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec, spawn } from 'child_process';
import { ProjectModel, TeamModel } from '../../models/index.js';
import { ContextLoaderService, TicketEditorService, TaskService } from '../../services/index.js';
import { ApiResponse, Project } from '../../types/index.js';
import { getFileIcon, countFiles } from '../utils/file-utils.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

const execAsync = promisify(exec);

// Project Management
export async function createProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { path: projectPath, name, description } = req.body as any;
		if (!projectPath) {
			res.status(400).json({
				success: false,
				error: 'Project path is required',
			} as ApiResponse);
			return;
		}
		const project = await this.storageService.addProject(projectPath);

		let finalProject = project;
		if (name || description) {
			const projectModel = ProjectModel.fromJSON(project);
			if (name) (projectModel as any).name = name;
			if (description) (projectModel as any).description = description;
			const updated = projectModel.toJSON();
			await this.storageService.saveProject(updated);
			finalProject = updated;
		}

		// For Gemini CLI orchestrator, add new project path to allowlist
		try {
			// Check if orchestrator is running and uses Gemini CLI
			const orchestratorStatus = await this.storageService.getOrchestratorStatus();
			const isGeminiOrchestrator = orchestratorStatus?.runtimeType === 'gemini-cli';
			const isOrchestratorActive =
				orchestratorStatus?.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE;

			if (isGeminiOrchestrator && isOrchestratorActive) {
				console.log(
					'Orchestrator is running with Gemini CLI, adding new project to allowlist...',
					{
						projectPath: finalProject.path,
						projectName: finalProject.name,
					}
				);

				// Import RuntimeServiceFactory dynamically to avoid circular dependency
				const { RuntimeServiceFactory } = await import(
					'../../services/agent/runtime-service.factory.js'
				);
				const { RUNTIME_TYPES, ORCHESTRATOR_SESSION_NAME } = await import(
					'../../constants.js'
				);

				// Get Gemini runtime service instance
				const geminiService = RuntimeServiceFactory.create(
					RUNTIME_TYPES.GEMINI_CLI,
					this.tmuxService.getTmuxCommandService(),
					process.cwd()
				) as any; // Cast to access Gemini-specific methods

				// Add new project path to allowlist
				const allowlistResult = await geminiService.addProjectToAllowlist(
					ORCHESTRATOR_SESSION_NAME,
					finalProject.path
				);

				console.log('Gemini CLI allowlist update result for new project:', {
					projectPath: finalProject.path,
					success: allowlistResult.success,
					message: allowlistResult.message,
				});
			} else if (isGeminiOrchestrator && !isOrchestratorActive) {
				console.log(
					'Orchestrator uses Gemini CLI but is not active, project allowlist will be updated when orchestrator starts'
				);
			}
		} catch (error) {
			// Log error but continue - as per requirement, don't fail project creation
			console.warn('Failed to add new project to Gemini CLI allowlist (continuing anyway):', {
				projectPath: finalProject.path,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		res.status(201).json({
			success: true,
			data: finalProject,
			message: 'Project added successfully',
		} as ApiResponse<Project>);
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
		res.status(500).json({
			success: false,
			error: 'Failed to retrieve projects',
		} as ApiResponse);
	}
}

export async function getProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		res.json({ success: true, data: project } as ApiResponse<Project>);
	} catch (error) {
		console.error('Error getting project:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to retrieve project',
		} as ApiResponse);
	}
}

export async function getProjectStatus(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const tickets = await this.storageService.getTickets(project.path);
		const activeTickets = tickets.filter((t) => t.status !== 'done');
		res.json({
			success: true,
			data: {
				project,
				activeTickets: activeTickets.length,
				totalTickets: tickets.length,
				teams: project.teams || {},
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error getting project status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get project status',
		} as ApiResponse);
	}
}

// Delegated complex project lifecycle operations (keep behavior intact)
export async function startProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params as any;
		const { teamIds } = req.body as any;
		if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
			res.status(400).json({
				success: false,
				error: 'Team IDs array is required',
			} as ApiResponse);
			return;
		}
		const teamId = teamIds[0];
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const teams = await this.storageService.getTeams();
		const team = teams.find((t) => t.id === teamId);
		if (!team) {
			res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse);
			return;
		}
		// Project orchestration now handled via scheduled messages to orchestrator
		project.status = 'active';

		// Create check-in scheduled message for 15-minute cycles (includes auto-assignment)
		let checkinScheduleId: string | undefined;
		if (this.messageSchedulerService) {
			try {
				const { PromptTemplateService } = await import('../../services/index.js');
				const promptService = new PromptTemplateService();
				const checkinMessage = await promptService.getCheckinPrompt({
					projectName: project.name,
					projectId: id,
					projectPath: project.path,
					currentTimestamp: new Date().toISOString(),
				});

				const scheduledMessage = {
					id: `checkin-${id}-${Date.now()}`,
					name: `Check-in for Project ${project.name}`,
					targetTeam: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, // Send to orchestrator
					targetProject: id,
					message: checkinMessage,
					delayAmount: 15,
					delayUnit: 'minutes' as const,
					isRecurring: true,
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				this.messageSchedulerService.scheduleMessage(scheduledMessage);
				checkinScheduleId = scheduledMessage.id;

				// Create immediate orchestrator coordination message (5 second delay)
				// Load the project start prompt from template
				const projectStartMessage = await promptService.getProjectStartPrompt({
					projectName: project.name,
					projectPath: project.path,
					teamName: team.name,
					teamMemberCount: team.members.length.toString(),
				});

				const immediateCoordinationMessage = {
					id: `immediate-coord-${id}-${Date.now()}`,
					name: `🚀 Project Started - Immediate Coordination - ${project.name}`,
					targetTeam: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, // Send to orchestrator
					targetProject: id,
					message: projectStartMessage,
					delayAmount: 5, // 5 seconds
					delayUnit: 'seconds' as const,
					isRecurring: false, // One-time immediate message
					isActive: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};

				this.messageSchedulerService.scheduleMessage(immediateCoordinationMessage);

				// Save the scheduled message ID to the project for stop functionality
				project.scheduledMessageId = checkinScheduleId;
			} catch (e) {
				console.warn('Failed to create check-in scheduled message:', e);
			}
		}

		await this.storageService.saveProject(project);
		let scheduleInfo: any;
		try {
			scheduleInfo = await this.activeProjectsService.startProject(
				id,
				this.messageSchedulerService
			);
		} catch (e) {
			console.warn('Failed to start project lifecycle management:', e);
		}
		res.json({
			success: true,
			message: 'Project started successfully with scheduled orchestration',
			data: {
				projectId: id,
				teamId,
				orchestrationStarted: true,
				checkInScheduleId: scheduleInfo?.checkInScheduleId,
				gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId,
				checkinScheduleId,
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error starting project:', error);
		res.status(500).json({ success: false, error: 'Failed to start project' } as ApiResponse);
	}
}

export async function stopProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

		// Cancel ALL scheduled messages for this project
		if (this.messageSchedulerService) {
			try {
				// Get all scheduled messages and find ones targeting this project
				const allMessages = await this.storageService.getScheduledMessages();
				const projectMessages = allMessages.filter((msg) => msg.targetProject === id);

				console.log(
					`Found ${projectMessages.length} scheduled messages to cancel for project ${id}`
				);

				// Cancel each message and delete from storage
				for (const message of projectMessages) {
					try {
						this.messageSchedulerService.cancelMessage(message.id);
						await this.storageService.deleteScheduledMessage(message.id);
						console.log(
							`Cancelled and deleted scheduled message: ${message.name} (${message.id})`
						);
					} catch (msgError) {
						console.warn(`Failed to cancel/delete message ${message.id}:`, msgError);
					}
				}

				project.scheduledMessageId = undefined; // Clear the schedule ID
			} catch (e) {
				console.warn('Failed to cancel scheduled messages:', e);
			}
		}

		try {
			await this.activeProjectsService.stopProject(id, this.messageSchedulerService);
		} catch (e) {
			console.warn('Failed to stop project lifecycle management:', e);
		}
		project.status = 'stopped';
		await this.storageService.saveProject(project);
		res.json({
			success: true,
			message: 'Project stopped successfully. Auto-assignment scheduling has been cancelled.',
			data: { projectId: id, status: 'stopped' },
		} as ApiResponse);
	} catch (error) {
		console.error('Error stopping project:', error);
		res.status(500).json({ success: false, error: 'Failed to stop project' } as ApiResponse);
	}
}

export async function restartProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		let scheduleInfo: any;
		try {
			scheduleInfo = await this.activeProjectsService.restartProject(
				id,
				this.messageSchedulerService
			);
		} catch (e) {
			console.warn('Failed to restart project lifecycle management:', e);
		}
		project.status = 'active';
		await this.storageService.saveProject(project);
		res.json({
			success: true,
			message: 'Project restarted successfully',
			data: {
				projectId: id,
				status: 'active',
				checkInScheduleId: scheduleInfo?.checkInScheduleId,
				gitCommitScheduleId: scheduleInfo?.gitCommitScheduleId,
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error restarting project:', error);
		res.status(500).json({ success: false, error: 'Failed to restart project' } as ApiResponse);
	}
}

export async function assignTeamsToProject(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const { teamAssignments } = req.body as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const projectModel = ProjectModel.fromJSON(project);
		if (teamAssignments) {
			for (const [role, teamIds] of Object.entries(teamAssignments)) {
				for (const teamId of teamIds as string[]) {
					projectModel.assignTeam(teamId, role);
				}
			}
		}
		await this.storageService.saveProject(projectModel.toJSON());
		const assignedTeamDetails: Array<{ team: any; role: string }> = [];
		if (teamAssignments) {
			const teams = await this.storageService.getTeams();
			for (const [role, teamIds] of Object.entries(teamAssignments)) {
				for (const teamId of teamIds as string[]) {
					const team = teams.find((t) => t.id === teamId);
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
				const orchestratorSession = AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME;
				const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
				if (sessionExists) {
					const teamsInfo = assignedTeamDetails
						.map(({ team, role }) => {
							const memberList =
								(team.members || [])
									.map(
										(m: any) =>
											`  - ${m.name} (${m.role}) - ${m.sessionName || 'N/A'}`
									)
									.join('\\n') || '  No members found';
							const sessions =
								(team.members || [])
									.map((m: any) => m.sessionName || 'N/A')
									.join(', ') || 'No sessions';
							return `### ${team.name} (${role})\n- **Team ID**: ${
								team.id
							}\n- **Members**: ${
								(team.members || []).length
							} members\n- **Session Names**: ${sessions}\n- **Member Details**:\n${memberList}`;
						})
						.join('\\n\\n');
					const orchestratorPrompt = `## Team Assignment Notification\n\nNew team(s) have been assigned to project **${project.name}**!\n\n${teamsInfo}\n\n### Action Required:\nPlease use the MCP tooling to create and initialize the assigned team sessions. You should:\n\n1. **Create tmux sessions** for each team member using their designated session names\n2. **Initialize the project environment** in each session with the project path: \`${project.path}\`\n3. **Set up the development context** for each team member based on their role\n4. **Verify all sessions are active** and ready for collaboration\n\n### Project Details:\n- **Project Path**: ${project.path}\n- **Project ID**: ${project.id}\n- **Total Teams Assigned**: ${assignedTeamDetails.length}\n\n---\n*Please confirm when all team sessions have been created and initialized successfully.*`;
					// Send message using robust tmux_robosend.sh script (includes Enter key automatically)
					await this.tmuxService.sendMessage(orchestratorSession, orchestratorPrompt);
				}
			} catch (notificationError) {
				console.warn(
					'Failed to notify orchestrator about team assignment:',
					notificationError
				);
			}
		}
		res.json({
			success: true,
			data: projectModel.toJSON(),
			message: 'Teams assigned to project successfully',
		} as ApiResponse<Project>);
	} catch (error) {
		console.error('Error assigning teams to project:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to assign teams to project',
		} as ApiResponse);
	}
}

export async function unassignTeamFromProject(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id: projectId } = req.params as any;
		const { teamId } = req.body as any;
		if (!teamId) {
			res.status(400).json({
				success: false,
				error: 'Missing required field: teamId',
			} as ApiResponse);
			return;
		}
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === projectId);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const teams = await this.storageService.getTeams();
		const team = teams.find((t) => t.id === teamId);
		if (!team) {
			res.status(404).json({ success: false, error: 'Team not found' } as ApiResponse);
			return;
		}
		if ((team as any).currentProject !== projectId) {
			res.status(400).json({
				success: false,
				error: 'Team is not assigned to this project',
			} as ApiResponse);
			return;
		}
		const projectModel = ProjectModel.fromJSON(project);
		projectModel.unassignTeam(teamId);
		await this.storageService.saveProject(projectModel.toJSON());
		(team as any).currentProject = undefined;
		(team as any).updatedAt = new Date().toISOString();
		await this.storageService.saveTeam(team);
		try {
			const orchestratorSession = AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME;
			const sessionExists = await this.tmuxService.sessionExists(orchestratorSession);
			if (sessionExists) {
				const memberLines =
					(team.members || [])
						.map((m) => `- ${m.name} (${m.role}) - Session: ${m.sessionName || 'N/A'}`)
						.join('\\n') || 'No members found';
				const notificationMessage = `## Team Unassignment Notification\n\nTeam **${
					team.name
				}** has been unassigned from project **${
					project.name
				}**.\n\n### Team Details:\n- **Team ID**: ${team.id}\n- **Team Name**: ${
					team.name
				}  \n- **Members**: ${
					(team.members || []).length
				} members\n- **Previous Project**: ${
					project.name
				}\n\n### Action Required:\nPlease coordinate the cleanup of team member sessions and update any active workflows accordingly.\n\n### Team Members to Clean Up:\n${memberLines}\n\n---\n*This notification was sent automatically when the team was unassigned from the project.*`;
				// Send message using robust tmux_robosend.sh script (includes Enter key automatically)
				await this.tmuxService.sendMessage(orchestratorSession, notificationMessage);
			}
		} catch (notificationError) {
			console.warn(
				'Failed to notify orchestrator about team unassignment:',
				notificationError
			);
		}
		res.json({
			success: true,
			data: projectModel.toJSON(),
			message: `Team "${team.name}" unassigned from project "${project.name}" successfully`,
		} as ApiResponse<Project>);
	} catch (error) {
		console.error('Error unassigning team from project:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to unassign team from project',
		} as ApiResponse);
	}
}

export async function getProjectFiles(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params;
		const { depth = '3', includeDotFiles = 'true' } = req.query as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

		const buildFileTree = async (
			dirPath: string,
			relativePath = '',
			currentDepth = 0,
			maxDepth = parseInt(depth as string)
		): Promise<any[]> => {
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
							icon: getFileIcon(item, stats.isDirectory()),
						};
						if (stats.isDirectory()) {
							node.children = await buildFileTree(
								fullPath,
								relativeItemPath,
								currentDepth + 1,
								maxDepth
							);
						}
						tree.push(node);
					} catch {}
				}
				return tree.sort((a, b) => {
					if (a.name === '.agentmux') return -1;
					if (b.name === '.agentmux') return 1;
					if (a.type === 'folder' && b.type === 'file') return -1;
					if (a.type === 'file' && b.type === 'folder') return 1;
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
			try {
				await fs.stat(parentResolved);
				resolvedPath = parentResolved;
			} catch {
				resolvedPath = path.resolve(project.path);
			}
		}
		try {
			await fs.stat(resolvedPath);
		} catch (pathError: any) {
			res.status(400).json({
				success: false,
				error: `Project path "${resolvedPath}" is not accessible: ${
					pathError?.message || 'Unknown error'
				}`,
			} as ApiResponse);
			return;
		}
		const fileTree = await buildFileTree(resolvedPath);
		const totalFiles = countFiles(fileTree);
		res.json({
			success: true,
			data: {
				project: { id: project.id, name: project.name, path: project.path },
				files: fileTree,
				totalFiles,
				generatedAt: new Date().toISOString(),
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error getting project files:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get project files',
		} as ApiResponse);
	}
}

export async function getFileContent(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { projectId } = req.params as any;
		const { filePath } = req.query as any;
		if (!filePath || typeof filePath !== 'string') {
			res.status(400).json({ success: false, error: 'File path is required' } as ApiResponse);
			return;
		}
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === projectId);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const resolvedProjectPath = path.isAbsolute(project.path)
			? project.path
			: path.resolve(process.cwd(), project.path);
		try {
			await fs.access(resolvedProjectPath);
		} catch {
			res.status(404).json({
				success: false,
				error: 'Project directory does not exist',
			} as ApiResponse);
			return;
		}
		const fullFilePath = path.join(resolvedProjectPath, filePath);
		const resolvedFilePath = path.resolve(fullFilePath);
		if (!resolvedFilePath.startsWith(resolvedProjectPath)) {
			res.status(403).json({
				success: false,
				error: 'Access denied: File outside project directory',
			} as ApiResponse);
			return;
		}
		try {
			const content = await fs.readFile(fullFilePath, 'utf8');
			res.json({ success: true, data: { content, filePath } } as ApiResponse<{
				content: string;
				filePath: string;
			}>);
		} catch (fileError: any) {
			if (fileError.code === 'ENOENT')
				res.status(404).json({ success: false, error: 'File not found' } as ApiResponse);
			else if (fileError.code === 'EISDIR')
				res.status(400).json({
					success: false,
					error: 'Path is a directory, not a file',
				} as ApiResponse);
			else throw fileError;
		}
	} catch (error) {
		console.error('Error reading file content:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to read file content',
		} as ApiResponse);
	}
}

export async function getAgentmuxMarkdownFiles(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { projectPath } = req.query as any;
		if (!projectPath || typeof projectPath !== 'string') {
			res.status(400).json({
				success: false,
				error: 'Project path is required',
			} as ApiResponse);
			return;
		}
		const agentmuxPath = path.join(projectPath, '.agentmux');
		try {
			await fs.access(agentmuxPath);
		} catch {
			await fs.mkdir(agentmuxPath, { recursive: true });
			await fs.mkdir(path.join(agentmuxPath, 'specs'), { recursive: true });
		}
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
		res.status(500).json({
			success: false,
			error: 'Failed to scan .agentmux files',
		} as ApiResponse);
	}
}

export async function saveMarkdownFile(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { projectPath, filePath, content } = req.body as any;
		if (!projectPath || !filePath || content === undefined) {
			res.status(400).json({
				success: false,
				error: 'Project path, file path, and content are required',
			} as ApiResponse);
			return;
		}
		const fullFilePath = path.join(projectPath, filePath);
		const resolvedProjectPath = path.resolve(projectPath);
		const resolvedFilePath = path.resolve(fullFilePath);
		if (!resolvedFilePath.startsWith(resolvedProjectPath)) {
			res.status(403).json({
				success: false,
				error: 'Access denied: File outside project directory',
			} as ApiResponse);
			return;
		}
		await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
		await fs.writeFile(fullFilePath, content, 'utf8');
		res.json({ success: true, message: 'File saved successfully' } as ApiResponse);
	} catch (error) {
		console.error('Error saving markdown file:', error);
		res.status(500).json({ success: false, error: 'Failed to save file' } as ApiResponse);
	}
}

export async function getProjectCompletion(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p: any) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const tickets = await this.storageService.getTickets(project.path);
		const completedTickets = tickets.filter((t) => t.status === 'done');
		const completionRate =
			tickets.length > 0 ? Math.round((completedTickets.length / tickets.length) * 100) : 0;
		res.json({
			success: true,
			data: {
				totalTickets: tickets.length,
				completedTickets: completedTickets.length,
				completionRate,
				isCompleted: completionRate === 100,
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error getting project completion:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get project completion',
		} as ApiResponse);
	}
}

export async function deleteProject(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p: any) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

		// Cancel ALL scheduled messages for this project BEFORE deletion
		if (this.messageSchedulerService) {
			try {
				// Get all scheduled messages and find ones targeting this project
				const allMessages = await this.storageService.getScheduledMessages();
				const projectMessages = allMessages.filter((msg) => msg.targetProject === id);

				console.log(
					`Found ${projectMessages.length} scheduled messages to cancel for project ${id} before deletion`
				);

				// Cancel each message and delete from storage
				for (const message of projectMessages) {
					try {
						this.messageSchedulerService.cancelMessage(message.id);
						await this.storageService.deleteScheduledMessage(message.id);
						console.log(
							`Cancelled and deleted scheduled message: ${message.name} (${message.id})`
						);
					} catch (msgError) {
						console.warn(`Failed to cancel/delete message ${message.id}:`, msgError);
					}
				}
			} catch (e) {
				console.warn('Failed to cancel scheduled messages during project deletion:', e);
			}
		}

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
		res.json({
			success: true,
			message: `Project deleted successfully. ${activeTeams.length} teams were unassigned and all scheduled messages cancelled.`,
		} as ApiResponse);
	} catch (error) {
		console.error('Error deleting project:', error);
		res.status(500).json({ success: false, error: 'Failed to delete project' } as ApiResponse);
	}
}

export async function getProjectStats(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

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

		const tickets = await this.storageService.getTickets(resolvedProjectPath, {
			projectId: id,
		});
		const taskCount = tickets.length;

		const stats = {
			mdFileCount,
			taskCount,
			hasProjectMd,
			hasUserJourneyMd,
			hasInitialGoalMd,
			hasInitialUserJourneyMd,
		};

		res.json({
			success: true,
			data: stats,
			message: 'Project stats retrieved successfully',
		} as ApiResponse);
	} catch (error) {
		console.error('Error getting project stats:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get project stats',
		} as ApiResponse);
	}
}

export async function openProjectInFinder(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const resolvedProjectPath = path.isAbsolute(project.path)
			? project.path
			: path.resolve(process.cwd(), project.path);
		try {
			await fs.access(resolvedProjectPath);
		} catch {
			res.status(404).json({
				success: false,
				error: 'Project directory does not exist',
			} as ApiResponse);
			return;
		}
		try {
			await execAsync(`open "${resolvedProjectPath}"`);
			res.json({ success: true, message: 'Project folder opened in Finder' } as ApiResponse);
		} catch (e) {
			console.error('Error opening Finder:', e);
			res.status(500).json({ success: false, error: 'Failed to open Finder' } as ApiResponse);
		}
	} catch (error) {
		console.error('Error opening project in Finder:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to open project in Finder',
		} as ApiResponse);
	}
}

export async function createSpecFile(this: ApiContext, req: Request, res: Response): Promise<void> {
	try {
		const { id } = req.params;
		const { fileName, content } = req.body as any;
		if (!fileName || !content) {
			res.status(400).json({
				success: false,
				error: 'Missing fileName or content',
			} as ApiResponse);
			return;
		}
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const resolvedProjectPath = path.isAbsolute(project.path)
			? project.path
			: path.resolve(process.cwd(), project.path);
		const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
		const filePath = path.join(specsPath, fileName);
		try {
			await fs.mkdir(specsPath, { recursive: true });
			await fs.writeFile(filePath, content, 'utf-8');
			res.json({
				success: true,
				data: { fileName, filePath, specsPath },
				message: `${fileName} saved successfully`,
			} as ApiResponse);
		} catch (error) {
			console.error('Error creating spec file:', error);
			res.status(500).json({
				success: false,
				error: 'Failed to create spec file',
			} as ApiResponse);
		}
	} catch (error) {
		console.error('Error creating spec file:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create spec file',
		} as ApiResponse);
	}
}

export async function getSpecFileContent(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params;
		const { fileName } = req.query as any;
		if (!fileName) {
			res.status(400).json({
				success: false,
				error: 'Missing fileName parameter',
			} as ApiResponse);
			return;
		}
		const projects = await this.storageService.getProjects();
		const project = projects.find((p: any) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const resolvedProjectPath = path.isAbsolute(project.path)
			? project.path
			: path.resolve(process.cwd(), project.path);
		const specsPath = path.join(resolvedProjectPath, '.agentmux', 'specs');
		const filePath = path.join(specsPath, String(fileName));
		try {
			const content = await fs.readFile(filePath, 'utf-8');
			res.json({
				success: true,
				data: { fileName, content, filePath },
				message: `${fileName} content retrieved successfully`,
			} as ApiResponse);
		} catch {
			res.status(404).json({
				success: false,
				error: `File ${fileName} not found`,
			} as ApiResponse);
		}
	} catch (error) {
		console.error('Error getting spec file content:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get spec file content',
		} as ApiResponse);
	}
}

export async function getProjectContext(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { projectId } = req.params;
		const options = req.query as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p: any) => p.id === projectId);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}
		const contextLoader = new ContextLoaderService(project.path);
		const context = await contextLoader.loadProjectContext({
			includeFiles: options.includeFiles !== 'false',
			includeGitHistory: options.includeGitHistory !== 'false',
			includeTickets: options.includeTickets !== 'false',
			maxFileSize: options.maxFileSize ? parseInt(options.maxFileSize) : undefined,
			fileExtensions: options.fileExtensions
				? String(options.fileExtensions).split(',')
				: undefined,
		});
		res.json({ success: true, data: context } as ApiResponse);
	} catch (error) {
		console.error('Error loading project context:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to load project context',
		} as ApiResponse);
	}
}

/**
 * Get alignment status for a project (stub implementation)
 * Returns default status indicating no alignment issues
 */
export async function getAlignmentStatus(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

		// Return default alignment status (no issues)
		const alignmentStatus = {
			hasIssues: false,
			alignmentFilePath: null,
		};

		res.json({ success: true, data: alignmentStatus } as ApiResponse);
	} catch (error) {
		console.error('Error getting alignment status:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get alignment status',
		} as ApiResponse);
	}
}

/**
 * Continue with misalignment endpoint (stub implementation)
 * Acknowledges user decision to continue despite alignment issues
 */
export async function continueWithMisalignment(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const projects = await this.storageService.getProjects();
		const project = projects.find((p) => p.id === id);
		if (!project) {
			res.status(404).json({ success: false, error: 'Project not found' } as ApiResponse);
			return;
		}

		// Log the decision to continue with misalignment
		console.log(
			`User chose to continue with misalignment for project: ${project.name} (${id})`
		);

		res.json({
			success: true,
			message: 'Continuing with misalignment acknowledged',
		} as ApiResponse);
	} catch (error) {
		console.error('Error handling continue with misalignment:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to handle continue with misalignment',
		} as ApiResponse);
	}
}
