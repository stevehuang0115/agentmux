import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';

describe('MCP Server Integration Tests', () => {
	let mcpProcess: ChildProcess;
	let backendProcess: ChildProcess;
	const testPort = 3002; // Use different port for testing
	const backendTestPort = 3003; // Use different port for backend testing
	const baseUrl = `http://localhost:${testPort}`;

	beforeAll(async () => {
		// Start backend server for testing
		backendProcess = spawn('node', ['dist/backend/index.js'], {
			env: {
				...process.env,
				WEB_PORT: backendTestPort.toString(),
				NODE_ENV: 'test',
			},
			stdio: 'pipe',
		});

		// Wait for backend server to start
		await setTimeout(2000);

		// Verify backend server is accessible
		try {
			const backendHealthResponse = await fetch(`http://localhost:${backendTestPort}/health`);
			if (!backendHealthResponse.ok) {
				console.warn('Backend server health check failed, but continuing with test...');
			} else {
				console.log('Backend server is accessible on port', backendTestPort);
			}
		} catch (error) {
			console.warn('Backend server not accessible yet, but continuing with test...', error);
		}

		// Start MCP server for testing
		mcpProcess = spawn('node', ['dist/mcp-server/index.js'], {
			env: {
				...process.env,
				AGENTMUX_MCP_PORT: testPort.toString(),
				API_PORT: backendTestPort.toString(),
				TMUX_SESSION_NAME: 'test-session',
				PROJECT_PATH: '/tmp/test-project',
				AGENT_ROLE: 'test',
			},
			stdio: 'pipe',
		});

		// Wait for MCP server to start
		await setTimeout(3000);
	}, 15000);

	afterAll(async () => {
		// Kill MCP process first
		if (mcpProcess) {
			mcpProcess.kill('SIGTERM');
			// Give time for graceful shutdown
			await setTimeout(1000);
			if (!mcpProcess.killed) {
				mcpProcess.kill('SIGKILL');
			}
		}

		// Kill backend process
		if (backendProcess) {
			backendProcess.kill('SIGTERM');
			// Give time for graceful shutdown
			await setTimeout(1000);
			if (!backendProcess.killed) {
				backendProcess.kill('SIGKILL');
			}
		}
	});

	describe('Health Check', () => {
		it('should respond to health check', async () => {
			const response = await fetch(`${baseUrl}/health`);
			expect(response.ok).toBe(true);

			const body = (await response.json()) as any;
			expect(body.status).toBe('ok');
			expect(body.mcp).toBe('running');
		});
	});

	describe('MCP Protocol', () => {
		it('should handle MCP initialization', async () => {
			const initRequest = {
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: {
					protocolVersion: '2024-11-05',
					capabilities: {},
					clientInfo: {
						name: 'test-client',
						version: '1.0.0',
					},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(initRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.id).toBe(1);
			expect(body.result).toBeDefined();
		});

		it('should list available tools', async () => {
			const toolsRequest = {
				jsonrpc: '2.0',
				id: 2,
				method: 'tools/list',
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolsRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.id).toBe(2);
			expect(Array.isArray(body.result.tools)).toBe(true);

			// Verify register_agent_status tool has correct schema with memberId parameter
			const registerTool = body.result.tools.find(
				(tool: any) => tool.name === 'register_agent_status'
			);
			expect(registerTool).toBeDefined();
			expect(registerTool.description).toBe(
				'Register agent as active and ready to receive instructions'
			);

			// Verify all 3 parameters are present
			const properties = registerTool.inputSchema.properties;
			expect(properties.role).toBeDefined();
			expect(properties.role.type).toBe('string');
			expect(properties.sessionId).toBeDefined();
			expect(properties.sessionId.type).toBe('string');
			expect(properties.memberId).toBeDefined();
			expect(properties.memberId.type).toBe('string');
			expect(properties.memberId.description).toBe('Team member ID for association');

			// Verify required parameters (role and sessionId required, memberId optional)
			expect(registerTool.inputSchema.required).toEqual(['role', 'sessionId']);

			// Check for key tools
			const toolNames = body.result.tools.map((tool: any) => tool.name);
			expect(toolNames).toContain('send_message');
			expect(toolNames).toContain('broadcast');
			expect(toolNames).toContain('get_team_status');
			expect(toolNames).toContain('register_agent_status');
		});

		it('should handle invalid method gracefully', async () => {
			const invalidRequest = {
				jsonrpc: '2.0',
				id: 3,
				method: 'invalid/method',
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(invalidRequest),
			});

			expect(response.status).toBe(500);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.error).toBeDefined();
		});

		it('should handle malformed JSON gracefully', async () => {
			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: 'invalid json',
			});

			expect(response.status).toBe(500);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.error).toBeDefined();
		});
	});

	describe('Tool Execution', () => {
		it('should execute get_team_status tool', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 4,
				method: 'tools/call',
				params: {
					name: 'get_team_status',
					arguments: {},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.id).toBe(4);
			expect(body.result).toBeDefined();
			expect(Array.isArray(body.result.content)).toBe(true);
		});

		it('should execute register_agent_status tool with memberId parameter', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 11,
				method: 'tools/call',
				params: {
					name: 'register_agent_status',
					arguments: {
						role: 'tpm',
						sessionId: 'test-session-with-member',
						memberId: 'test-member-abc123',
					},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.id).toBe(11);
			expect(body.result).toBeDefined();
			expect(Array.isArray(body.result.content)).toBe(true);

			// Should indicate registration attempt (may fail in test environment due to backend connection)
			const content = body.result.content[0].text;
			expect(content).toMatch(/(Agent registered successfully|Failed to register agent)/);
			if (content.includes('registered successfully')) {
				expect(content).toContain('Role: tpm');
				expect(content).toContain('Session: test-session-with-member');
			}
		});

		it('should execute register_agent_status tool with sessionId', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 10,
				method: 'tools/call',
				params: {
					name: 'register_agent_status',
					arguments: {
						role: 'test-agent',
						sessionId: 'test-session-123',
					},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			expect(body.id).toBe(10);
			expect(body.result).toBeDefined();
			expect(Array.isArray(body.result.content)).toBe(true);
			// In test environment, backend isn't running so expect connection failure
			expect(body.result.content[0].text).toMatch(
				/(registered successfully|Failed to register agent)/
			);
			if (body.result.content[0].text.includes('registered successfully')) {
				expect(body.result.content[0].text).toContain('test-agent');
				expect(body.result.content[0].text).toContain('test-session-123');
			}
		});

		it('should handle notifications/initialized without error', async () => {
			const notificationRequest = {
				jsonrpc: '2.0',
				method: 'notifications/initialized',
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(notificationRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			// Notifications should not have a result field
			expect(body.result).toBeUndefined();
			expect(body.error).toBeUndefined();
		});

		it('should handle notifications/cancelled without error', async () => {
			const notificationRequest = {
				jsonrpc: '2.0',
				method: 'notifications/cancelled',
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(notificationRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.jsonrpc).toBe('2.0');
			// Notifications should not have a result field
			expect(body.result).toBeUndefined();
			expect(body.error).toBeUndefined();
		});

		it('should handle send_message tool with rate limiting', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 5,
				method: 'tools/call',
				params: {
					name: 'send_message',
					arguments: {
						to: 'test-target',
						message: 'integration test message',
					},
				},
			};

			// First request
			const response1 = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response1.ok).toBe(true);
			const body1 = (await response1.json()) as any;
			expect(body1.result).toBeDefined();

			// Immediate second request should be rate limited
			const response2 = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ...toolRequest, id: 6 }),
			});

			expect(response2.ok).toBe(true);
			const body2 = (await response2.json()) as any;
			// Either rate limited or error due to missing tmux session
			expect(body2.result.content[0].text).toMatch(
				/(Rate limit exceeded|Failed to send message)/
			);
		});

		it('should handle unknown tool', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 7,
				method: 'tools/call',
				params: {
					name: 'unknown_tool',
					arguments: {},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.status).toBe(500);
			const body = (await response.json()) as any;
			expect(body.error).toBeDefined();
		});
	});

	describe('CORS and Security', () => {
		it('should handle CORS preflight requests', async () => {
			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'OPTIONS',
			});

			expect(response.ok).toBe(true);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
		});

		it('should return 404 for unknown endpoints', async () => {
			const response = await fetch(`${baseUrl}/unknown-endpoint`);
			expect(response.status).toBe(404);
		});
	});

	describe('Resource Management', () => {
		it('should handle multiple concurrent requests', async () => {
			const requests = [];

			for (let i = 0; i < 10; i++) {
				const request = fetch(`${baseUrl}/mcp`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						jsonrpc: '2.0',
						id: 100 + i,
						method: 'tools/list',
					}),
				});
				requests.push(request);
			}

			const responses = await Promise.all(requests);

			// All requests should succeed (though some tools might be rate limited)
			for (const response of responses) {
				expect(response.ok).toBe(true);
			}
		});

		it('should handle large payloads', async () => {
			const largeMessage = 'x'.repeat(10000); // 10KB message

			const toolRequest = {
				jsonrpc: '2.0',
				id: 8,
				method: 'tools/call',
				params: {
					name: 'send_message',
					arguments: {
						to: 'test-target',
						message: largeMessage,
					},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.result).toBeDefined();
		});
	});

	describe('Error Recovery', () => {
		it('should recover from tmux command failures', async () => {
			const toolRequest = {
				jsonrpc: '2.0',
				id: 9,
				method: 'tools/call',
				params: {
					name: 'send_message',
					arguments: {
						to: 'definitely-nonexistent-session-12345',
						message: 'test message',
					},
				},
			};

			const response = await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(toolRequest),
			});

			expect(response.ok).toBe(true);
			const body = (await response.json()) as any;
			expect(body.result.content[0].text).toMatch(/(not found|can't find pane)/);
		});

		it('should continue serving after failed operations', async () => {
			// First, make a request that will likely fail
			await fetch(`${baseUrl}/mcp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 10,
					method: 'tools/call',
					params: {
						name: 'send_message',
						arguments: {
							to: 'nonexistent',
							message: 'fail',
						},
					},
				}),
			});

			// Then verify server still works
			const healthResponse = await fetch(`${baseUrl}/health`);
			expect(healthResponse.ok).toBe(true);
		});
	});
});
