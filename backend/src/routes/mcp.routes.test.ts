/**
 * MCP Routes Tests
 *
 * Tests for the MCP JSON-RPC endpoint integration
 *
 * @module routes/mcp.routes.test
 */

import { createMCPRoutes, initializeMCPServer, destroyMCPServer, getMCPServer } from './mcp.routes.js';
import express, { Express } from 'express';
import request from 'supertest';

describe('MCP Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/mcp', createMCPRoutes());
	});

	afterAll(() => {
		destroyMCPServer();
	});

	describe('Health Check', () => {
		it('should return health status when MCP server is not initialized', async () => {
			const response = await request(app).get('/mcp/health');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('status');
			expect(response.body).toHaveProperty('mcp');
			expect(response.body).toHaveProperty('timestamp');
		});
	});

	describe('MCP Endpoint (without initialization)', () => {
		it('should return 503 when MCP server is not initialized', async () => {
			const response = await request(app)
				.post('/mcp')
				.send({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
				});

			expect(response.status).toBe(503);
			expect(response.body).toHaveProperty('error');
			expect(response.body.error.message).toBe('MCP server not initialized');
		});
	});

	describe('Invalid Requests', () => {
		it('should return 400 for empty request body', async () => {
			// Initialize MCP server for this test
			await initializeMCPServer();

			const response = await request(app)
				.post('/mcp')
				.send(null);

			expect(response.status).toBe(400);
			expect(response.body.error.message).toBe('Invalid request');

			destroyMCPServer();
		});
	});

	describe('getMCPServer', () => {
		it('should return null when not initialized', () => {
			expect(getMCPServer()).toBeNull();
		});

		it('should return server instance when initialized', async () => {
			await initializeMCPServer();
			expect(getMCPServer()).not.toBeNull();
			destroyMCPServer();
		});
	});
});

describe('MCP Routes (with initialized server)', () => {
	let app: Express;

	beforeAll(async () => {
		app = express();
		app.use(express.json());
		app.use('/mcp', createMCPRoutes());
		await initializeMCPServer();
	});

	afterAll(() => {
		destroyMCPServer();
	});

	describe('JSON-RPC Protocol', () => {
		it('should handle initialize method', async () => {
			const response = await request(app)
				.post('/mcp')
				.send({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
				});

			expect(response.status).toBe(200);
			expect(response.body.jsonrpc).toBe('2.0');
			expect(response.body.id).toBe(1);
			expect(response.body.result).toHaveProperty('protocolVersion');
			expect(response.body.result).toHaveProperty('capabilities');
			expect(response.body.result).toHaveProperty('serverInfo');
			expect(response.body.result.serverInfo.name).toBe('agentmux-mcp-server');
		});

		it('should handle notifications/initialized', async () => {
			const response = await request(app)
				.post('/mcp')
				.send({
					jsonrpc: '2.0',
					id: 2,
					method: 'notifications/initialized',
				});

			expect(response.status).toBe(200);
			expect(response.body.jsonrpc).toBe('2.0');
			expect(response.body.id).toBe(2);
		});

		it('should handle tools/list method', async () => {
			const response = await request(app)
				.post('/mcp')
				.send({
					jsonrpc: '2.0',
					id: 3,
					method: 'tools/list',
				});

			expect(response.status).toBe(200);
			expect(response.body.jsonrpc).toBe('2.0');
			expect(response.body.result).toHaveProperty('tools');
			expect(Array.isArray(response.body.result.tools)).toBe(true);

			// Check for expected tools
			const toolNames = response.body.result.tools.map((t: { name: string }) => t.name);
			expect(toolNames).toContain('send_message');
			expect(toolNames).toContain('broadcast');
			expect(toolNames).toContain('get_team_status');
			expect(toolNames).toContain('get_agent_logs');
			expect(toolNames).toContain('get_agent_status');
		});

		it('should return error for unknown method', async () => {
			const response = await request(app)
				.post('/mcp')
				.send({
					jsonrpc: '2.0',
					id: 4,
					method: 'unknown_method',
				});

			expect(response.status).toBe(200);
			expect(response.body.jsonrpc).toBe('2.0');
			expect(response.body.error).toBeDefined();
			expect(response.body.error.code).toBe(-32601);
			expect(response.body.error.message).toBe('Method not found');
		});
	});

	describe('Health Check (with initialized server)', () => {
		it('should return ok status when MCP server is initialized', async () => {
			const response = await request(app).get('/mcp/health');

			expect(response.status).toBe(200);
			expect(response.body.status).toBe('ok');
			expect(response.body.mcp).toBe('running');
		});
	});
});
