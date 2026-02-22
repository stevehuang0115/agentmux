/**
 * Tests for the MCP Client Service.
 *
 * Validates connection management, tool discovery, tool calling,
 * error handling, and multi-server orchestration.
 */

import {
	McpClientService,
	MCP_CLIENT_CONSTANTS,
	type McpServerConfig,
	type McpToolInfo,
} from './mcp-client.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClose = jest.fn().mockResolvedValue(undefined);
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockListTools = jest.fn().mockResolvedValue({ tools: [] });
const mockCallTool = jest.fn().mockResolvedValue({ content: [], isError: false });
const mockGetServerVersion = jest.fn().mockReturnValue(undefined);

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
	Client: jest.fn().mockImplementation(() => ({
		connect: mockConnect,
		close: mockClose,
		listTools: mockListTools,
		callTool: mockCallTool,
		getServerVersion: mockGetServerVersion,
	})),
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
	StdioClientTransport: jest.fn().mockImplementation(() => ({
		start: jest.fn().mockResolvedValue(undefined),
		close: jest.fn().mockResolvedValue(undefined),
	})),
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const MockClient = Client as jest.MockedClass<typeof Client>;
const MockTransport = StdioClientTransport as jest.MockedClass<typeof StdioClientTransport>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testConfig: McpServerConfig = {
	command: 'npx',
	args: ['-y', '@anthropic/mcp-filesystem', '/tmp'],
};

const testConfigWithEnv: McpServerConfig = {
	command: 'node',
	args: ['server.js'],
	env: { API_KEY: 'test-key' },
};

function mockToolsResponse(tools: Array<{ name: string; description?: string }>) {
	return {
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: { type: 'object' as const, properties: {} },
		})),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('McpClientService', () => {
	let service: McpClientService;

	beforeEach(() => {
		service = new McpClientService();
		jest.clearAllMocks();

		// Default: listTools returns empty
		mockListTools.mockResolvedValue({ tools: [] });
		mockCallTool.mockResolvedValue({ content: [], isError: false });
		mockGetServerVersion.mockReturnValue(undefined);
	});

	// -----------------------------------------------------------------------
	// Constants
	// -----------------------------------------------------------------------

	describe('MCP_CLIENT_CONSTANTS', () => {
		it('has client info with name and version', () => {
			expect(MCP_CLIENT_CONSTANTS.CLIENT_INFO.NAME).toBe('crewly-agent');
			expect(MCP_CLIENT_CONSTANTS.CLIENT_INFO.VERSION).toBe('1.0.0');
		});

		it('has timeout values', () => {
			expect(MCP_CLIENT_CONSTANTS.TOOL_CALL_TIMEOUT_MS).toBe(30000);
			expect(MCP_CLIENT_CONSTANTS.CONNECTION_TIMEOUT_MS).toBe(15000);
		});
	});

	// -----------------------------------------------------------------------
	// connectServer
	// -----------------------------------------------------------------------

	describe('connectServer', () => {
		it('creates transport with correct server params', async () => {
			await service.connectServer('filesystem', testConfig);

			expect(MockTransport).toHaveBeenCalledWith({
				command: 'npx',
				args: ['-y', '@anthropic/mcp-filesystem', '/tmp'],
				env: undefined,
				stderr: 'ignore',
			});
		});

		it('creates client with correct info and capabilities', async () => {
			await service.connectServer('filesystem', testConfig);

			expect(MockClient).toHaveBeenCalledWith(
				{
					name: 'crewly-agent',
					version: '1.0.0',
				},
				{ capabilities: {} },
			);
		});

		it('connects client to transport', async () => {
			await service.connectServer('filesystem', testConfig);

			expect(mockConnect).toHaveBeenCalledWith(
				expect.any(Object), // transport instance
			);
		});

		it('discovers tools after connecting', async () => {
			mockListTools.mockResolvedValue(
				mockToolsResponse([
					{ name: 'read_file', description: 'Read a file' },
					{ name: 'write_file', description: 'Write a file' },
				]),
			);

			await service.connectServer('filesystem', testConfig);

			expect(mockListTools).toHaveBeenCalled();
			const tools = service.listTools('filesystem');
			expect(tools).toHaveLength(2);
			expect(tools[0].name).toBe('read_file');
			expect(tools[0].serverName).toBe('filesystem');
		});

		it('passes env variables to transport', async () => {
			await service.connectServer('custom', testConfigWithEnv);

			expect(MockTransport).toHaveBeenCalledWith(
				expect.objectContaining({
					env: { API_KEY: 'test-key' },
				}),
			);
		});

		it('throws when server name is already connected', async () => {
			await service.connectServer('filesystem', testConfig);

			await expect(
				service.connectServer('filesystem', testConfig),
			).rejects.toThrow('already connected');
		});

		it('throws when connection fails', async () => {
			mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

			await expect(
				service.connectServer('broken', testConfig),
			).rejects.toThrow('Connection refused');
		});

		it('throws when tool discovery fails', async () => {
			mockListTools.mockRejectedValueOnce(new Error('Protocol error'));

			await expect(
				service.connectServer('broken', testConfig),
			).rejects.toThrow('Protocol error');
		});
	});

	// -----------------------------------------------------------------------
	// disconnectServer
	// -----------------------------------------------------------------------

	describe('disconnectServer', () => {
		it('closes the client and removes from connections', async () => {
			await service.connectServer('filesystem', testConfig);
			expect(service.isServerConnected('filesystem')).toBe(true);

			await service.disconnectServer('filesystem');

			expect(mockClose).toHaveBeenCalled();
			expect(service.isServerConnected('filesystem')).toBe(false);
		});

		it('throws when server is not connected', async () => {
			await expect(
				service.disconnectServer('nonexistent'),
			).rejects.toThrow('not connected');
		});
	});

	// -----------------------------------------------------------------------
	// disconnectAll
	// -----------------------------------------------------------------------

	describe('disconnectAll', () => {
		it('disconnects all connected servers', async () => {
			await service.connectServer('server1', testConfig);
			await service.connectServer('server2', testConfigWithEnv);
			expect(service.getConnectedServers()).toHaveLength(2);

			await service.disconnectAll();

			expect(service.getConnectedServers()).toHaveLength(0);
			expect(mockClose).toHaveBeenCalledTimes(2);
		});

		it('handles no connected servers gracefully', async () => {
			await expect(service.disconnectAll()).resolves.not.toThrow();
		});

		it('continues disconnecting even if one fails', async () => {
			await service.connectServer('server1', testConfig);
			await service.connectServer('server2', testConfigWithEnv);

			// First close call fails, second succeeds
			mockClose
				.mockRejectedValueOnce(new Error('Process already exited'))
				.mockResolvedValueOnce(undefined);

			await expect(service.disconnectAll()).resolves.not.toThrow();

			// Both should be removed from connections regardless
			expect(service.getConnectedServers()).toHaveLength(0);
		});
	});

	// -----------------------------------------------------------------------
	// listTools
	// -----------------------------------------------------------------------

	describe('listTools', () => {
		beforeEach(async () => {
			mockListTools
				.mockResolvedValueOnce(
					mockToolsResponse([
						{ name: 'read_file', description: 'Read a file' },
						{ name: 'write_file', description: 'Write a file' },
					]),
				)
				.mockResolvedValueOnce(
					mockToolsResponse([
						{ name: 'search_issues', description: 'Search GitHub issues' },
					]),
				);

			await service.connectServer('filesystem', testConfig);
			await service.connectServer('github', testConfigWithEnv);
		});

		it('returns tools from all servers when no filter', () => {
			const tools = service.listTools();
			expect(tools).toHaveLength(3);
		});

		it('returns tools from a specific server when filtered', () => {
			const tools = service.listTools('filesystem');
			expect(tools).toHaveLength(2);
			expect(tools.every((t) => t.serverName === 'filesystem')).toBe(true);
		});

		it('returns empty array for unknown server', () => {
			const tools = service.listTools('nonexistent');
			expect(tools).toHaveLength(0);
		});

		it('includes serverName on each tool', () => {
			const tools = service.listTools();
			const githubTools = tools.filter((t) => t.serverName === 'github');
			expect(githubTools).toHaveLength(1);
			expect(githubTools[0].name).toBe('search_issues');
		});

		it('returns copies, not references to internal state', () => {
			const tools1 = service.listTools('filesystem');
			const tools2 = service.listTools('filesystem');
			expect(tools1).not.toBe(tools2);
			expect(tools1).toEqual(tools2);
		});
	});

	// -----------------------------------------------------------------------
	// callTool
	// -----------------------------------------------------------------------

	describe('callTool', () => {
		beforeEach(async () => {
			mockListTools.mockResolvedValue(
				mockToolsResponse([
					{ name: 'read_file', description: 'Read a file' },
					{ name: 'list_dir', description: 'List directory' },
				]),
			);

			await service.connectServer('filesystem', testConfig);
		});

		it('calls the tool with correct name and arguments', async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: 'text', text: 'file content here' }],
				isError: false,
			});

			const result = await service.callTool('filesystem', 'read_file', {
				path: '/tmp/test.txt',
			});

			expect(mockCallTool).toHaveBeenCalledWith({
				name: 'read_file',
				arguments: { path: '/tmp/test.txt' },
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toBe('file content here');
			expect(result.isError).toBe(false);
		});

		it('passes empty args when none provided', async () => {
			mockCallTool.mockResolvedValue({
				content: [],
				isError: false,
			});

			await service.callTool('filesystem', 'list_dir');

			expect(mockCallTool).toHaveBeenCalledWith({
				name: 'list_dir',
				arguments: {},
			});
		});

		it('returns isError true when tool reports an error', async () => {
			mockCallTool.mockResolvedValue({
				content: [{ type: 'text', text: 'File not found' }],
				isError: true,
			});

			const result = await service.callTool('filesystem', 'read_file', {
				path: '/nonexistent',
			});

			expect(result.isError).toBe(true);
		});

		it('handles image content blocks', async () => {
			mockCallTool.mockResolvedValue({
				content: [{
					type: 'image',
					data: 'base64data',
					mimeType: 'image/png',
				}],
				isError: false,
			});

			const result = await service.callTool('filesystem', 'read_file', {
				path: '/tmp/image.png',
			});

			expect(result.content[0].type).toBe('image');
			expect(result.content[0].data).toBe('base64data');
			expect(result.content[0].mimeType).toBe('image/png');
		});

		it('handles empty content array', async () => {
			mockCallTool.mockResolvedValue({
				content: [],
				isError: false,
			});

			const result = await service.callTool('filesystem', 'list_dir');

			expect(result.content).toHaveLength(0);
			expect(result.isError).toBe(false);
		});

		it('throws when server is not connected', async () => {
			await expect(
				service.callTool('nonexistent', 'read_file'),
			).rejects.toThrow('not connected');
		});

		it('throws when tool is not found on server', async () => {
			await expect(
				service.callTool('filesystem', 'nonexistent_tool'),
			).rejects.toThrow('not found');
			await expect(
				service.callTool('filesystem', 'nonexistent_tool'),
			).rejects.toThrow('Available tools: read_file, list_dir');
		});

		it('propagates errors from the MCP SDK', async () => {
			mockCallTool.mockRejectedValueOnce(new Error('Server crashed'));

			await expect(
				service.callTool('filesystem', 'read_file'),
			).rejects.toThrow('Server crashed');
		});
	});

	// -----------------------------------------------------------------------
	// refreshTools
	// -----------------------------------------------------------------------

	describe('refreshTools', () => {
		it('updates cached tools from server', async () => {
			mockListTools.mockResolvedValueOnce(
				mockToolsResponse([{ name: 'tool_v1' }]),
			);

			await service.connectServer('server', testConfig);
			expect(service.listTools('server')).toHaveLength(1);
			expect(service.listTools('server')[0].name).toBe('tool_v1');

			// Server now has a new tool
			mockListTools.mockResolvedValueOnce(
				mockToolsResponse([{ name: 'tool_v1' }, { name: 'tool_v2' }]),
			);

			await service.refreshTools('server');

			expect(service.listTools('server')).toHaveLength(2);
			expect(service.listTools('server')[1].name).toBe('tool_v2');
		});

		it('throws when server is not connected', async () => {
			await expect(
				service.refreshTools('nonexistent'),
			).rejects.toThrow('not connected');
		});
	});

	// -----------------------------------------------------------------------
	// getConnectedServers
	// -----------------------------------------------------------------------

	describe('getConnectedServers', () => {
		it('returns empty array when no servers connected', () => {
			expect(service.getConnectedServers()).toEqual([]);
		});

		it('returns names of connected servers', async () => {
			await service.connectServer('server1', testConfig);
			await service.connectServer('server2', testConfigWithEnv);

			const servers = service.getConnectedServers();
			expect(servers).toContain('server1');
			expect(servers).toContain('server2');
			expect(servers).toHaveLength(2);
		});
	});

	// -----------------------------------------------------------------------
	// isServerConnected
	// -----------------------------------------------------------------------

	describe('isServerConnected', () => {
		it('returns false for unknown server', () => {
			expect(service.isServerConnected('unknown')).toBe(false);
		});

		it('returns true for connected server', async () => {
			await service.connectServer('filesystem', testConfig);
			expect(service.isServerConnected('filesystem')).toBe(true);
		});

		it('returns false after disconnecting', async () => {
			await service.connectServer('filesystem', testConfig);
			await service.disconnectServer('filesystem');
			expect(service.isServerConnected('filesystem')).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// getServerStatuses
	// -----------------------------------------------------------------------

	describe('getServerStatuses', () => {
		it('returns empty array when no servers', () => {
			expect(service.getServerStatuses()).toEqual([]);
		});

		it('returns status for connected servers', async () => {
			mockListTools.mockResolvedValue(
				mockToolsResponse([
					{ name: 'tool1' },
					{ name: 'tool2' },
				]),
			);

			await service.connectServer('filesystem', testConfig);

			const statuses = service.getServerStatuses();
			expect(statuses).toHaveLength(1);
			expect(statuses[0].name).toBe('filesystem');
			expect(statuses[0].connected).toBe(true);
			expect(statuses[0].toolCount).toBe(2);
		});

		it('includes server version info when available', async () => {
			mockGetServerVersion.mockReturnValue({
				name: 'mcp-filesystem',
				version: '0.1.0',
			});

			await service.connectServer('filesystem', testConfig);

			const statuses = service.getServerStatuses();
			expect(statuses[0].serverName).toBe('mcp-filesystem');
			expect(statuses[0].serverVersion).toBe('0.1.0');
		});

		it('handles missing server version info', async () => {
			mockGetServerVersion.mockReturnValue(undefined);

			await service.connectServer('filesystem', testConfig);

			const statuses = service.getServerStatuses();
			expect(statuses[0].serverName).toBeUndefined();
			expect(statuses[0].serverVersion).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// connectAll
	// -----------------------------------------------------------------------

	describe('connectAll', () => {
		it('connects to multiple servers', async () => {
			mockListTools.mockResolvedValue(mockToolsResponse([{ name: 'tool1' }]));

			const errors = await service.connectAll({
				server1: testConfig,
				server2: testConfigWithEnv,
			});

			expect(errors.size).toBe(0);
			expect(service.getConnectedServers()).toHaveLength(2);
		});

		it('returns errors for failed connections', async () => {
			// First connection succeeds, second fails
			mockConnect
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Spawn failed'));

			const errors = await service.connectAll({
				server1: testConfig,
				server2: testConfigWithEnv,
			});

			expect(errors.size).toBe(1);
			expect(errors.get('server2')?.message).toBe('Spawn failed');
			// server1 should still be connected
			expect(service.isServerConnected('server1')).toBe(true);
		});

		it('handles all connections failing', async () => {
			mockConnect.mockRejectedValue(new Error('All broken'));

			const errors = await service.connectAll({
				server1: testConfig,
				server2: testConfigWithEnv,
			});

			expect(errors.size).toBe(2);
			expect(service.getConnectedServers()).toHaveLength(0);
		});

		it('handles empty config map', async () => {
			const errors = await service.connectAll({});

			expect(errors.size).toBe(0);
			expect(service.getConnectedServers()).toHaveLength(0);
		});

		it('wraps non-Error rejection reasons', async () => {
			mockConnect.mockRejectedValueOnce('string error');

			const errors = await service.connectAll({
				server1: testConfig,
			});

			expect(errors.size).toBe(1);
			expect(errors.get('server1')).toBeInstanceOf(Error);
			expect(errors.get('server1')?.message).toBe('string error');
		});
	});
});
