import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ApiResponse } from '../../types/index.js';
import {
	ORCHESTRATOR_SESSION_NAME,
	ORCHESTRATOR_WINDOW_NAME,
	AGENT_INITIALIZATION_TIMEOUT,
	ORCHESTRATOR_ROLE,
} from '../../constants.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';

// Delegate to existing ApiController methods to preserve complex logic without duplication
export async function getOrchestratorCommands(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const mockCommands = [
			{
				id: '1',
				command: 'get_team_status',
				timestamp: new Date(Date.now() - 300000).toISOString(),
				output: 'All teams active and working',
				status: 'completed',
			},
			{
				id: '2',
				command: 'delegate_task dev-alice "Implement user auth"',
				timestamp: new Date(Date.now() - 600000).toISOString(),
				output: 'Task delegated successfully',
				status: 'completed',
			},
		];
		res.json(mockCommands);
	} catch (error) {
		console.error('Error fetching orchestrator commands:', error);
		res.status(500).json([]);
	}
}

export async function executeOrchestratorCommand(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { command } = req.body as any;
		if (!command || typeof command !== 'string') {
			res.status(400).json({ success: false, error: 'Command is required' });
			return;
		}

		let output = '';
		if (command.startsWith('get_team_status')) {
			const teams = await this.storageService.getTeams();
			const teamStatuses = teams.map((team) => {
				const hasActiveMembers = team.members.some(
					(m) => m.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
				);
				const hasActivatingMembers = team.members.some(
					(m) => m.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING
				);
				const computedStatus = hasActiveMembers
					? AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
					: hasActivatingMembers
					? AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING
					: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE;
				return {
					name: team.name,
					status: computedStatus,
					members: team.members.length,
					project: (team as any).currentProject || 'None',
				};
			});
			output = `Team Status Report:\n${teamStatuses
				.map((t) => `${t.name}: ${t.status} (${t.members} members) - ${t.project}`)
				.join('\n')}`;
		} else if (command.startsWith('list_projects')) {
			const projects = await this.storageService.getProjects();
			output = `Active Projects:\n${projects
				.map(
					(p) =>
						`${p.name}: ${p.status} (${
							Object.values(p.teams).flat().length
						} teams assigned)`
				)
				.join('\n')}`;
		} else if (command.startsWith('list_sessions')) {
			try {
				const { exec } = await import('child_process');
				const { promisify } = await import('util');
				const execAsync = promisify(exec);
				const result = await execAsync(
					'tmux list-sessions -F "#{session_name}" 2>/dev/null || echo "No sessions"'
				);
				output = `Active tmux sessions:\n${result.stdout}`;
			} catch (error) {
				output = 'No tmux sessions found or tmux not available';
			}
		} else if (command.startsWith('broadcast')) {
			const message = command.substring(10).trim();
			output = message
				? `Broadcast sent to all active sessions: "${message}"`
				: 'Error: No message provided for broadcast';
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
		res.status(500).json({
			success: false,
			error: 'Failed to execute command',
			output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
	}
}

export async function sendOrchestratorMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { message } = req.body as any;

		// Use the unified agent message sending
		const result = await this.agentRegistrationService.sendMessageToAgent(
			ORCHESTRATOR_SESSION_NAME,
			message
		);

		if (!result.success) {
			res.status(400).json({
				success: false,
				error: result.error || 'Failed to send message to orchestrator',
			} as ApiResponse);
			return;
		}

		res.json({
			success: true,
			message: 'Message sent to orchestrator successfully',
			messageLength: message.length,
			timestamp: new Date().toISOString(),
		} as ApiResponse);
	} catch (error) {
		console.error('Error sending orchestrator message:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to send message',
		} as ApiResponse);
	}
}

export async function sendOrchestratorEnter(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		// Use the unified agent key sending
		const result = await this.agentRegistrationService.sendKeyToAgent(
			ORCHESTRATOR_SESSION_NAME,
			'Enter'
		);

		if (!result.success) {
			res.status(500).json({
				success: false,
				error: result.error || 'Failed to send Enter key to orchestrator',
			} as ApiResponse);
			return;
		}

		res.json({
			success: true,
			message: 'Enter key sent to orchestrator',
			timestamp: new Date().toISOString(),
		} as ApiResponse);
	} catch (error) {
		console.error('Error sending Enter to orchestrator:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to send Enter key',
		} as ApiResponse);
	}
}

export async function setupOrchestrator(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		// Get orchestrator's runtime type from storage
		let runtimeType = 'claude-code'; // Default fallback
		try {
			const orchestratorStatus = await this.storageService.getOrchestratorStatus();
			if (orchestratorStatus?.runtimeType) {
				runtimeType = orchestratorStatus.runtimeType;
				console.log('Using orchestrator runtime type from storage:', runtimeType);
			} else {
				console.warn(
					'No runtime type found in orchestrator status, using default:',
					runtimeType
				);
			}
		} catch (error) {
			console.warn(
				'Failed to get orchestrator runtime type from storage, using default:',
				runtimeType,
				error
			);
		}

		// Use the unified agent registration service for orchestrator creation
		const result = await this.agentRegistrationService.createAgentSession({
			sessionName: ORCHESTRATOR_SESSION_NAME,
			role: ORCHESTRATOR_ROLE,
			projectPath: process.cwd(),
			windowName: ORCHESTRATOR_WINDOW_NAME,
			runtimeType: runtimeType as any, // Pass the runtime type from teams.json
		});

		if (!result.success) {
			res.status(500).json({
				success: false,
				error: result.error || 'Failed to create orchestrator session',
			} as ApiResponse);
			return;
		}

		// For Gemini CLI orchestrator, add all existing project paths to allowlist
		if (runtimeType === 'gemini-cli') {
			try {
				console.log('Orchestrator uses Gemini CLI, adding existing projects to allowlist...');
				
				// Get all existing projects
				const projects = await this.storageService.getProjects();
				const projectPaths = projects.map(project => project.path);
				
				if (projectPaths.length > 0) {
					console.log('Found projects to add to Gemini CLI allowlist:', projectPaths);
					
					// Import RuntimeServiceFactory dynamically to avoid circular dependency
					const { RuntimeServiceFactory } = await import('../../services/agent/runtime-service.factory.js');
					const { RUNTIME_TYPES } = await import('../../constants.js');
					
					// Get Gemini runtime service instance
					const geminiService = RuntimeServiceFactory.create(
						RUNTIME_TYPES.GEMINI_CLI,
						this.tmuxService.getTmuxCommandService(),
						process.cwd()
					) as any; // Cast to access Gemini-specific methods
					
					// Add all project paths to allowlist
					const allowlistResult = await geminiService.addMultipleProjectsToAllowlist(
						ORCHESTRATOR_SESSION_NAME,
						projectPaths
					);
					
					console.log('Gemini CLI allowlist update result:', {
						success: allowlistResult.success,
						message: allowlistResult.message,
						successCount: allowlistResult.results.filter((r: any) => r.success).length,
						totalCount: allowlistResult.results.length
					});
				} else {
					console.log('No existing projects found to add to Gemini CLI allowlist');
				}
			} catch (error) {
				// Log error but continue - as per requirement, don't fail orchestrator startup
				console.warn('Failed to add existing projects to Gemini CLI allowlist (continuing anyway):', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		res.json({
			success: true,
			message: result.message || 'Orchestrator session created and registered successfully',
			sessionName: result.sessionName,
		} as ApiResponse);
	} catch (error) {
		console.error('Error setting up orchestrator session:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to setup orchestrator session',
		} as ApiResponse);
	}
}

export async function getOrchestratorHealth(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		// Use the unified agent health checking
		const result = await this.agentRegistrationService.checkAgentHealth(
			ORCHESTRATOR_SESSION_NAME,
			ORCHESTRATOR_ROLE,
			1000
		);

		if (!result.success) {
			res.status(500).json({
				success: false,
				error: result.error || 'Failed to check orchestrator health',
			} as ApiResponse);
			return;
		}

		// Rename 'agent' to 'orchestrator' for backward compatibility
		const responseData = {
			...result.data,
			orchestrator: {
				...result.data!.agent,
				sessionName: result.data!.agent.running ? ORCHESTRATOR_SESSION_NAME : null,
			},
		};
		delete (responseData as any).agent;

		res.json({
			success: true,
			data: responseData,
		} as ApiResponse);
	} catch (error) {
		console.error('Error checking orchestrator health:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to check orchestrator health',
		} as ApiResponse);
	}
}

export async function stopOrchestrator(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		// Use the unified agent registration service for orchestrator termination
		const result = await this.agentRegistrationService.terminateAgentSession(
			ORCHESTRATOR_SESSION_NAME,
			ORCHESTRATOR_ROLE
		);

		if (!result.success) {
			res.status(500).json({
				success: false,
				error: result.error || 'Failed to stop orchestrator',
			} as ApiResponse);
			return;
		}

		res.json({
			success: true,
			message: result.message || 'Orchestrator stopped successfully',
			sessionName: ORCHESTRATOR_SESSION_NAME,
		} as ApiResponse);
	} catch (error) {
		console.error('Error stopping orchestrator:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to stop orchestrator',
		} as ApiResponse);
	}
}

export async function assignTaskToOrchestrator(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { projectId } = req.params as any;
		const {
			taskId,
			taskTitle,
			taskDescription,
			taskPriority,
			taskMilestone,
			projectName,
			projectPath,
		} = req.body as any;

		if (!taskId || !taskTitle) {
			res.status(400).json({
				success: false,
				error: 'Task ID and title are required',
			} as ApiResponse);
			return;
		}

		// Use the unified health check to verify orchestrator is running
		const healthResult = await this.agentRegistrationService.checkAgentHealth(
			ORCHESTRATOR_SESSION_NAME,
			ORCHESTRATOR_ROLE
		);

		if (!healthResult.success || !healthResult.data?.agent.running) {
			res.status(400).json({
				success: false,
				error: 'Orchestrator session is not running. Please start the orchestrator first.',
			} as ApiResponse);
			return;
		}

		// Generate the task assignment prompt
		const assignmentMessage =
			await this.promptTemplateService.getOrchestratorTaskAssignmentPrompt({
				projectName,
				projectPath,
				taskId,
				taskTitle,
				taskDescription,
				taskPriority,
				taskMilestone,
			});

		// Use the unified message sending
		const messageResult = await this.agentRegistrationService.sendMessageToAgent(
			ORCHESTRATOR_SESSION_NAME,
			assignmentMessage
		);

		if (!messageResult.success) {
			res.status(500).json({
				success: false,
				error: messageResult.error || 'Failed to send task assignment to orchestrator',
			} as ApiResponse);
			return;
		}

		res.json({
			success: true,
			message: 'Task assigned to orchestrator successfully',
			data: {
				taskId,
				taskTitle,
				sessionName: ORCHESTRATOR_SESSION_NAME,
				assignedAt: new Date().toISOString(),
			},
		} as ApiResponse);
	} catch (error) {
		console.error('Error assigning task to orchestrator:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to assign task to orchestrator',
		} as ApiResponse);
	}
}

export async function updateOrchestratorRuntime(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { runtimeType } = req.body as { runtimeType: string };

		if (!runtimeType || typeof runtimeType !== 'string') {
			res.status(400).json({
				success: false,
				error: 'runtimeType is required and must be a string',
			} as ApiResponse);
			return;
		}

		// Validate runtime type
		const validRuntimeTypes = ['claude-code', 'gemini-cli', 'codex-cli'];
		if (!validRuntimeTypes.includes(runtimeType)) {
			res.status(400).json({
				success: false,
				error: `Invalid runtime type. Must be one of: ${validRuntimeTypes.join(', ')}`,
			} as ApiResponse);
			return;
		}

		// Update orchestrator runtime type
		await this.storageService.updateOrchestratorRuntimeType(runtimeType as any);

		res.json({
			success: true,
			data: { runtimeType },
			message: `Orchestrator runtime updated to ${runtimeType}`,
		} as ApiResponse);
	} catch (error) {
		console.error('Error updating orchestrator runtime:', error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to update orchestrator runtime',
		} as ApiResponse);
	}
}
