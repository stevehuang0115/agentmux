/**
 * MCP Client Service
 *
 * Enables Crewly agents to connect to external MCP (Model Context Protocol)
 * servers and use their tools. This is the client-side counterpart to our
 * existing MCP server — it lets agents consume tools from any MCP-compatible
 * server (filesystem, GitHub, database, etc.).
 *
 * Supports stdio-based MCP servers (child process spawning) which is the
 * standard transport for local MCP servers.
 *
 * @module services/mcp-client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
	StdioClientTransport,
	type StdioServerParameters,
} from '@modelcontextprotocol/sdk/client/stdio.js';

// ========================= Constants =========================

/**
 * MCP Client configuration constants
 */
export const MCP_CLIENT_CONSTANTS = {
	/** Client identification sent during MCP handshake */
	CLIENT_INFO: {
		NAME: 'crewly-agent',
		VERSION: '1.0.0',
	},
	/** Default timeout for tool calls (30 seconds) */
	TOOL_CALL_TIMEOUT_MS: 30000,
	/** Default timeout for server connection (15 seconds) */
	CONNECTION_TIMEOUT_MS: 15000,
} as const;

// ========================= Types =========================

/**
 * Configuration for an external MCP server.
 *
 * Matches the format used in `crewly.config.ts`:
 * ```typescript
 * mcpServers: {
 *   filesystem: { command: 'npx', args: ['-y', '@anthropic/mcp-filesystem'] },
 *   github: { command: 'npx', args: ['-y', '@anthropic/mcp-github'] },
 * }
 * ```
 */
export interface McpServerConfig {
	/** The executable command to run (e.g., 'npx', 'node', 'python') */
	command: string;
	/** Command-line arguments for the executable */
	args?: string[];
	/** Environment variables to set for the server process */
	env?: Record<string, string>;
}

/**
 * Normalized tool information from an MCP server.
 */
export interface McpToolInfo {
	/** Tool name as registered on the MCP server */
	name: string;
	/** Human-readable description of the tool */
	description?: string;
	/** JSON Schema describing the tool's input parameters */
	inputSchema: Record<string, unknown>;
	/** Name of the MCP server that provides this tool */
	serverName: string;
}

/**
 * Result from calling an MCP tool.
 */
export interface McpToolResult {
	/** Content blocks returned by the tool */
	content: McpContentBlock[];
	/** Whether the tool call resulted in an error */
	isError: boolean;
}

/**
 * A single content block in a tool result.
 */
export interface McpContentBlock {
	/** Content type: 'text', 'image', or 'resource' */
	type: string;
	/** Text content (when type is 'text') */
	text?: string;
	/** Base64-encoded data (when type is 'image') */
	data?: string;
	/** MIME type (when type is 'image') */
	mimeType?: string;
}

/**
 * Status information for a connected MCP server.
 */
export interface McpServerStatus {
	/** Server identifier */
	name: string;
	/** Whether the server is currently connected */
	connected: boolean;
	/** Number of tools available from this server */
	toolCount: number;
	/** Server name reported during handshake */
	serverName?: string;
	/** Server version reported during handshake */
	serverVersion?: string;
}

/**
 * Internal state for a single MCP server connection.
 */
interface McpServerConnection {
	/** The MCP SDK client instance */
	client: Client;
	/** The stdio transport for the child process */
	transport: StdioClientTransport;
	/** Cached list of tools from this server */
	tools: McpToolInfo[];
	/** Original configuration */
	config: McpServerConfig;
}

// ========================= Service =========================

/**
 * Manages connections to external MCP servers and provides a unified
 * interface for discovering and calling tools across all connected servers.
 *
 * Agents use this service to:
 * 1. Connect to configured MCP servers at startup
 * 2. Discover available tools across all servers
 * 3. Call tools by name with type-safe arguments
 * 4. Gracefully disconnect on shutdown
 *
 * @example
 * ```typescript
 * const mcpClient = new McpClientService();
 *
 * // Connect to a filesystem MCP server
 * await mcpClient.connectServer('filesystem', {
 *   command: 'npx',
 *   args: ['-y', '@anthropic/mcp-filesystem', '/home/user'],
 * });
 *
 * // List all available tools
 * const tools = mcpClient.listTools();
 *
 * // Call a tool
 * const result = await mcpClient.callTool('filesystem', 'read_file', {
 *   path: '/home/user/file.txt',
 * });
 *
 * // Disconnect all servers
 * await mcpClient.disconnectAll();
 * ```
 */
export class McpClientService {
	/** Map of server name -> active connection */
	private connections: Map<string, McpServerConnection> = new Map();

	/**
	 * Connect to an external MCP server via stdio transport.
	 *
	 * Spawns the server as a child process, performs the MCP handshake,
	 * and caches the list of available tools.
	 *
	 * @param name - Unique identifier for this server connection
	 * @param config - Server configuration (command, args, env)
	 * @throws Error if already connected to a server with this name
	 * @throws Error if the connection or handshake fails
	 */
	async connectServer(name: string, config: McpServerConfig): Promise<void> {
		if (this.connections.has(name)) {
			throw new Error(
				`MCP server "${name}" is already connected. Disconnect first before reconnecting.`,
			);
		}

		const serverParams: StdioServerParameters = {
			command: config.command,
			args: config.args,
			env: config.env,
			stderr: 'ignore',
		};

		const transport = new StdioClientTransport(serverParams);

		const client = new Client(
			{
				name: MCP_CLIENT_CONSTANTS.CLIENT_INFO.NAME,
				version: MCP_CLIENT_CONSTANTS.CLIENT_INFO.VERSION,
			},
			{ capabilities: {} },
		);

		await client.connect(transport);

		// Discover available tools
		const toolsResult = await client.listTools();
		const tools: McpToolInfo[] = (toolsResult.tools || []).map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema as Record<string, unknown>,
			serverName: name,
		}));

		this.connections.set(name, {
			client,
			transport,
			tools,
			config,
		});
	}

	/**
	 * Disconnect from a specific MCP server.
	 *
	 * Closes the transport and cleans up the child process.
	 *
	 * @param name - Name of the server to disconnect
	 * @throws Error if the server is not connected
	 */
	async disconnectServer(name: string): Promise<void> {
		const connection = this.connections.get(name);
		if (!connection) {
			throw new Error(
				`MCP server "${name}" is not connected.`,
			);
		}

		await connection.client.close();
		this.connections.delete(name);
	}

	/**
	 * Disconnect from all connected MCP servers.
	 *
	 * Closes all transports and cleans up child processes. Errors from
	 * individual disconnections are caught and do not prevent other
	 * servers from being disconnected. Connections are always removed
	 * from the internal map, even if `close()` fails.
	 */
	async disconnectAll(): Promise<void> {
		const entries = Array.from(this.connections.entries());

		await Promise.allSettled(
			entries.map(async ([name, connection]) => {
				try {
					await connection.client.close();
				} finally {
					this.connections.delete(name);
				}
			}),
		);
	}

	/**
	 * List all available tools across connected MCP servers.
	 *
	 * @param serverName - Optional: filter tools to a specific server
	 * @returns Array of tool information objects
	 */
	listTools(serverName?: string): McpToolInfo[] {
		if (serverName) {
			const connection = this.connections.get(serverName);
			if (!connection) {
				return [];
			}
			return [...connection.tools];
		}

		const allTools: McpToolInfo[] = [];
		for (const connection of this.connections.values()) {
			allTools.push(...connection.tools);
		}
		return allTools;
	}

	/**
	 * Call a tool on a specific MCP server.
	 *
	 * @param serverName - Name of the server that provides the tool
	 * @param toolName - Name of the tool to call
	 * @param args - Arguments to pass to the tool
	 * @returns The tool's result containing content blocks and error status
	 * @throws Error if the server is not connected
	 * @throws Error if the tool is not found on the server
	 * @throws Error if the tool call fails
	 */
	async callTool(
		serverName: string,
		toolName: string,
		args: Record<string, unknown> = {},
	): Promise<McpToolResult> {
		const connection = this.connections.get(serverName);
		if (!connection) {
			throw new Error(
				`MCP server "${serverName}" is not connected.`,
			);
		}

		const toolExists = connection.tools.some((t) => t.name === toolName);
		if (!toolExists) {
			throw new Error(
				`Tool "${toolName}" not found on MCP server "${serverName}". ` +
				`Available tools: ${connection.tools.map((t) => t.name).join(', ')}`,
			);
		}

		const result = await connection.client.callTool({
			name: toolName,
			arguments: args,
		});

		// Normalize the result to our McpToolResult interface
		const content: McpContentBlock[] = Array.isArray(result.content)
			? result.content.map((block) => ({
				type: (block as Record<string, unknown>).type as string,
				text: (block as Record<string, unknown>).text as string | undefined,
				data: (block as Record<string, unknown>).data as string | undefined,
				mimeType: (block as Record<string, unknown>).mimeType as string | undefined,
			}))
			: [];

		return {
			content,
			isError: result.isError === true,
		};
	}

	/**
	 * Refresh the tool list for a specific server.
	 *
	 * Useful when a server's tools may have changed since the initial connection.
	 *
	 * @param serverName - Name of the server to refresh
	 * @throws Error if the server is not connected
	 */
	async refreshTools(serverName: string): Promise<void> {
		const connection = this.connections.get(serverName);
		if (!connection) {
			throw new Error(
				`MCP server "${serverName}" is not connected.`,
			);
		}

		const toolsResult = await connection.client.listTools();
		connection.tools = (toolsResult.tools || []).map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema as Record<string, unknown>,
			serverName,
		}));
	}

	/**
	 * Get the names of all currently connected MCP servers.
	 *
	 * @returns Array of server names
	 */
	getConnectedServers(): string[] {
		return Array.from(this.connections.keys());
	}

	/**
	 * Check if a specific MCP server is currently connected.
	 *
	 * @param name - Server name to check
	 * @returns True if the server is connected
	 */
	isServerConnected(name: string): boolean {
		return this.connections.has(name);
	}

	/**
	 * Get status information for all connected servers.
	 *
	 * @returns Array of server status objects including tool counts
	 */
	getServerStatuses(): McpServerStatus[] {
		const statuses: McpServerStatus[] = [];

		for (const [name, connection] of this.connections.entries()) {
			const serverVersion = connection.client.getServerVersion();
			statuses.push({
				name,
				connected: true,
				toolCount: connection.tools.length,
				serverName: serverVersion?.name,
				serverVersion: serverVersion?.version,
			});
		}

		return statuses;
	}

	/**
	 * Connect to multiple MCP servers from a configuration map.
	 *
	 * This is the primary entrypoint for agent startup. Errors from
	 * individual connections are caught — failing servers do not prevent
	 * other servers from connecting.
	 *
	 * @param configs - Map of server name -> server config
	 * @returns Map of server name -> error (only for servers that failed to connect)
	 *
	 * @example
	 * ```typescript
	 * const errors = await mcpClient.connectAll({
	 *   filesystem: { command: 'npx', args: ['-y', '@anthropic/mcp-filesystem', '/tmp'] },
	 *   github: { command: 'npx', args: ['-y', '@anthropic/mcp-github'] },
	 * });
	 *
	 * if (errors.size > 0) {
	 *   console.warn('Some MCP servers failed to connect:', errors);
	 * }
	 * ```
	 */
	async connectAll(
		configs: Record<string, McpServerConfig>,
	): Promise<Map<string, Error>> {
		const errors = new Map<string, Error>();

		const entries = Object.entries(configs);
		const results = await Promise.allSettled(
			entries.map(([name, config]) => this.connectServer(name, config)),
		);

		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const [name] = entries[index];
				errors.set(
					name,
					result.reason instanceof Error
						? result.reason
						: new Error(String(result.reason)),
				);
			}
		});

		return errors;
	}
}
