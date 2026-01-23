/**
 * MCP Types Tests
 *
 * Tests for MCP type definitions and type guards
 *
 * @module types/mcp.types.test
 */

import type {
	MCPRequest,
	MCPResponse,
	MCPToolResult,
	SendMessageParams,
	BroadcastParams,
	ToolSchema,
	TicketInfo,
	MCPTeam,
	MCPTeamMember,
	TaskContent,
	InProgressTask,
} from './mcp.types.js';

describe('MCP Types', () => {
	describe('MCPRequest', () => {
		it('should allow valid request objects', () => {
			const request: MCPRequest = {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/list',
			};

			expect(request.jsonrpc).toBe('2.0');
			expect(request.id).toBe(1);
			expect(request.method).toBe('tools/list');
		});

		it('should allow request with params', () => {
			const request: MCPRequest = {
				jsonrpc: '2.0',
				id: 'test-id',
				method: 'tools/call',
				params: { name: 'send_message', arguments: { to: 'test', message: 'hello' } },
			};

			expect(request.params).toBeDefined();
			expect(request.params?.name).toBe('send_message');
		});
	});

	describe('MCPResponse', () => {
		it('should allow success response', () => {
			const response: MCPResponse = {
				jsonrpc: '2.0',
				id: 1,
				result: { tools: [] },
			};

			expect(response.result).toBeDefined();
			expect(response.error).toBeUndefined();
		});

		it('should allow error response', () => {
			const response: MCPResponse = {
				jsonrpc: '2.0',
				id: 1,
				error: {
					code: -32601,
					message: 'Method not found',
				},
			};

			expect(response.error).toBeDefined();
			expect(response.error?.code).toBe(-32601);
		});
	});

	describe('MCPToolResult', () => {
		it('should allow success result', () => {
			const result: MCPToolResult = {
				content: [{ type: 'text', text: 'Success' }],
			};

			expect(result.content).toHaveLength(1);
			expect(result.isError).toBeUndefined();
		});

		it('should allow error result', () => {
			const result: MCPToolResult = {
				content: [{ type: 'text', text: 'Error occurred' }],
				isError: true,
			};

			expect(result.isError).toBe(true);
		});
	});

	describe('Tool Parameter Types', () => {
		it('should validate SendMessageParams', () => {
			const params: SendMessageParams = {
				to: 'agent-1',
				message: 'Hello',
				teamMemberId: 'member-123',
			};

			expect(params.to).toBe('agent-1');
			expect(params.message).toBe('Hello');
		});

		it('should validate BroadcastParams', () => {
			const params: BroadcastParams = {
				message: 'Broadcast message',
				excludeSelf: true,
			};

			expect(params.excludeSelf).toBe(true);
		});
	});

	describe('ToolSchema', () => {
		it('should validate tool schema structure', () => {
			const schema: ToolSchema = {
				name: 'send_message',
				description: 'Send a message to another team member',
				inputSchema: {
					type: 'object',
					properties: {
						to: { type: 'string', description: 'Recipient' },
						message: { type: 'string', description: 'Message content' },
					},
					required: ['to', 'message'],
				},
			};

			expect(schema.name).toBe('send_message');
			expect(schema.inputSchema.type).toBe('object');
			expect(schema.inputSchema.required).toContain('to');
		});
	});

	describe('Data Types', () => {
		it('should validate TicketInfo', () => {
			const ticket: TicketInfo = {
				id: 'TICKET-001',
				title: 'Implement feature',
				status: 'in_progress',
				assignedTo: 'developer-1',
				priority: 'high',
			};

			expect(ticket.id).toBe('TICKET-001');
			expect(ticket.status).toBe('in_progress');
		});

		it('should validate MCPTeam', () => {
			const team: MCPTeam = {
				id: 'team-1',
				name: 'Development Team',
				members: [],
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			};

			expect(team.name).toBe('Development Team');
			expect(team.members).toHaveLength(0);
		});

		it('should validate MCPTeamMember', () => {
			const member: MCPTeamMember = {
				id: 'member-1',
				name: 'Developer',
				sessionName: 'dev-session',
				role: 'developer',
				agentStatus: 'active',
				workingStatus: 'in_progress',
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z',
			};

			expect(member.agentStatus).toBe('active');
			expect(member.workingStatus).toBe('in_progress');
		});
	});

	describe('Task Types', () => {
		it('should validate TaskContent', () => {
			const task: TaskContent = {
				id: 'task-1',
				title: 'Complete feature',
				description: 'Implementation details',
				status: 'open',
				priority: 'high',
			};

			expect(task.id).toBe('task-1');
			expect(task.priority).toBe('high');
		});

		it('should validate InProgressTask', () => {
			const task: InProgressTask = {
				taskPath: '/path/to/task.md',
				status: 'in_progress',
				assignedSessionName: 'dev-1',
				startedAt: '2024-01-01T00:00:00Z',
			};

			expect(task.taskPath).toBe('/path/to/task.md');
			expect(task.status).toBe('in_progress');
		});
	});
});
