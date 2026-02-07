/**
 * MCP (Model Context Protocol) Routes
 *
 * This router exposes the MCP JSON-RPC endpoint for Claude Code integration.
 * It imports and uses the existing AgentMuxMCPServer class from the mcp-server
 * package, running it within the backend process.
 *
 * @module routes/mcp
 */

import { Router, Request, Response } from 'express';
import { AgentMuxMCPServer } from '../../../mcp-server/src/server.js';
import { LoggerService } from '../services/core/logger.service.js';
import { AGENTMUX_CONSTANTS } from '../../../config/constants.js';

const logger = LoggerService.getInstance();

let mcpServer: AgentMuxMCPServer | null = null;

/**
 * Initialize the MCP server instance
 *
 * @returns Promise that resolves when MCP server is ready
 */
export async function initializeMCPServer(): Promise<void> {
	logger.info('[MCP Routes] Initializing MCP server...');
	// Set session name for MCP server so memory tools work for the orchestrator
	if (!process.env.TMUX_SESSION_NAME) {
		process.env.TMUX_SESSION_NAME = AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME;
	}
	mcpServer = new AgentMuxMCPServer();
	await mcpServer.initialize();
	logger.info('[MCP Routes] MCP server initialized successfully');
}

/**
 * Cleanup the MCP server instance
 */
export function destroyMCPServer(): void {
	if (mcpServer) {
		mcpServer.destroy();
		mcpServer = null;
		logger.info('[MCP Routes] MCP server destroyed');
	}
}

/**
 * Get the MCP server instance
 *
 * @returns The MCP server instance or null if not initialized
 */
export function getMCPServer(): AgentMuxMCPServer | null {
	return mcpServer;
}

/**
 * Create the MCP routes
 *
 * @returns Express router with MCP endpoints
 */
export function createMCPRoutes(): Router {
	const router = Router();

	// Health check for MCP
	router.get('/health', (req: Request, res: Response) => {
		res.json({
			status: mcpServer ? 'ok' : 'not_initialized',
			mcp: mcpServer ? 'running' : 'stopped',
			timestamp: new Date().toISOString(),
		});
	});

	// Main MCP JSON-RPC endpoint
	router.post('/', async (req: Request, res: Response) => {
		if (!mcpServer) {
			res.status(503).json({
				jsonrpc: '2.0',
				id: req.body?.id,
				error: {
					code: -32603,
					message: 'MCP server not initialized',
				},
			});
			return;
		}

		try {
			const request = req.body;

			if (!request || typeof request !== 'object') {
				res.status(400).json({
					jsonrpc: '2.0',
					id: null,
					error: {
						code: -32600,
						message: 'Invalid request',
					},
				});
				return;
			}

			// Handle MCP requests using the server's internal handler
			const response = await handleMCPRequest(request);
			res.json(response);
		} catch (error) {
			logger.error('[MCP Routes] Error handling MCP request', {
				error: error instanceof Error ? error.message : String(error),
			});
			res.status(500).json({
				jsonrpc: '2.0',
				id: req.body?.id,
				error: {
					code: -32603,
					message: 'Internal error',
					data: error instanceof Error ? error.message : 'Unknown error',
				},
			});
		}
	});

	return router;
}

/**
 * Handle an MCP JSON-RPC request
 *
 * @param request - The JSON-RPC request object
 * @returns The JSON-RPC response object
 */
async function handleMCPRequest(request: {
	jsonrpc: string;
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}): Promise<{
	jsonrpc: string;
	id?: string | number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}> {
	if (!mcpServer) {
		return {
			jsonrpc: '2.0',
			id: request.id,
			error: {
				code: -32603,
				message: 'MCP server not initialized',
			},
		};
	}

	// Handle initialize
	if (request.method === 'initialize') {
		return {
			jsonrpc: '2.0',
			id: request.id,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: 'agentmux-mcp-server',
					version: '1.0.0',
				},
			},
		};
	}

	// Handle notifications
	if (
		request.method === 'notifications/initialized' ||
		request.method === 'notifications/cancelled'
	) {
		return {
			jsonrpc: '2.0',
			id: request.id,
		};
	}

	// Handle tools/list
	if (request.method === 'tools/list') {
		// Access the private method via type assertion
		const server = mcpServer as unknown as {
			getToolDefinitions: () => Array<{
				name: string;
				description: string;
				inputSchema: Record<string, unknown>;
			}>;
		};
		return {
			jsonrpc: '2.0',
			id: request.id,
			result: { tools: server.getToolDefinitions() },
		};
	}

	// Handle tools/call
	if (request.method === 'tools/call') {
		const toolName = (request.params as { name: string; arguments?: Record<string, unknown> })?.name;
		const toolArgs = (request.params as { name: string; arguments?: Record<string, unknown> })?.arguments || {};

		try {
			const result = await callMCPTool(toolName, toolArgs);
			return {
				jsonrpc: '2.0',
				id: request.id,
				result,
			};
		} catch (error) {
			return {
				jsonrpc: '2.0',
				id: request.id,
				error: {
					code: -32603,
					message: 'Tool execution failed',
					data: error instanceof Error ? error.message : 'Unknown error',
				},
			};
		}
	}

	// Unknown method
	return {
		jsonrpc: '2.0',
		id: request.id,
		error: {
			code: -32601,
			message: 'Method not found',
		},
	};
}

/**
 * Call an MCP tool by name
 *
 * @param toolName - Name of the tool to call
 * @param args - Arguments for the tool
 * @returns Tool result
 */
async function callMCPTool(
	toolName: string,
	args: Record<string, unknown>
): Promise<{
	content: Array<{ type: 'text'; text: string }>;
	isError?: boolean;
}> {
	if (!mcpServer) {
		throw new Error('MCP server not initialized');
	}

	// Map tool names to handler methods
	// Using type assertion to access the methods
	const server = mcpServer as unknown as Record<string, (args: Record<string, unknown>) => Promise<{
		content: Array<{ type: 'text'; text: string }>;
		isError?: boolean;
	}>>;

	const toolHandlers: Record<string, string> = {
		send_message: 'sendMessage',
		broadcast: 'broadcast',
		get_team_status: 'getTeamStatus',
		get_agent_logs: 'getAgentLogs',
		get_agent_status: 'getAgentStatus',
		register_agent_status: 'registerAgentStatus',
		accept_task: 'acceptTask',
		complete_task: 'completeTask',
		check_quality_gates: 'checkQualityGates',
		read_task: 'readTask',
		block_task: 'blockTask',
		assign_task: 'assignTask',
		get_tickets: 'getTickets',
		update_ticket: 'updateTicket',
		report_progress: 'reportProgress',
		request_review: 'requestReview',
		schedule_check: 'scheduleCheck',
		enforce_commit: 'enforceCommit',
		create_team: 'createTeam',
		delegate_task: 'delegateTask',
		terminate_agent: 'terminateAgent',
		terminate_agents: 'terminateAgents',
		// Memory Management Tools
		remember: 'rememberKnowledge',
		recall: 'recallKnowledge',
		record_learning: 'recordLearning',
		get_my_context: 'getMyContext',
		get_sops: 'getSOPs',
		// Chat Response
		send_chat_response: 'sendChatResponse',
	};

	const handlerName = toolHandlers[toolName];
	if (!handlerName) {
		throw new Error(`Unknown tool: ${toolName}`);
	}

	const handler = server[handlerName];
	if (typeof handler !== 'function') {
		throw new Error(`Tool handler not found: ${toolName}`);
	}

	return handler.call(mcpServer, args);
}
