/**
 * Tests for Agent Heartbeat Middleware
 */

import type { Request, Response, NextFunction } from 'express';

// Mock the heartbeat service before importing the middleware
const mockUpdateAgentHeartbeat = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/agent/agent-heartbeat.service.js', () => ({
	updateAgentHeartbeat: (...args: unknown[]) => mockUpdateAgentHeartbeat(...args),
}));

jest.mock('../services/core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

import { agentHeartbeatMiddleware } from './agent-heartbeat.middleware.js';

describe('agentHeartbeatMiddleware', () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		mockReq = { headers: {} };
		mockRes = {};
		mockNext = jest.fn();
	});

	it('should call updateAgentHeartbeat when X-Agent-Session header is present', () => {
		mockReq.headers = { 'x-agent-session': 'crewly-orc' };

		agentHeartbeatMiddleware(mockReq as Request, mockRes as Response, mockNext);

		expect(mockUpdateAgentHeartbeat).toHaveBeenCalledWith('crewly-orc');
		expect(mockNext).toHaveBeenCalledTimes(1);
	});

	it('should not call updateAgentHeartbeat when header is missing', () => {
		mockReq.headers = {};

		agentHeartbeatMiddleware(mockReq as Request, mockRes as Response, mockNext);

		expect(mockUpdateAgentHeartbeat).not.toHaveBeenCalled();
		expect(mockNext).toHaveBeenCalledTimes(1);
	});

	it('should not call updateAgentHeartbeat when header is empty string', () => {
		mockReq.headers = { 'x-agent-session': '' };

		agentHeartbeatMiddleware(mockReq as Request, mockRes as Response, mockNext);

		expect(mockUpdateAgentHeartbeat).not.toHaveBeenCalled();
		expect(mockNext).toHaveBeenCalledTimes(1);
	});

	it('should always call next() even if heartbeat fails', async () => {
		mockUpdateAgentHeartbeat.mockRejectedValueOnce(new Error('heartbeat error'));
		mockReq.headers = { 'x-agent-session': 'test-session' };

		agentHeartbeatMiddleware(mockReq as Request, mockRes as Response, mockNext);

		expect(mockNext).toHaveBeenCalledTimes(1);
		// Allow the fire-and-forget promise to settle
		await new Promise((r) => setTimeout(r, 10));
		expect(mockUpdateAgentHeartbeat).toHaveBeenCalledWith('test-session');
	});

	it('should not call updateAgentHeartbeat when header is an array', () => {
		// Express may parse duplicate headers as arrays
		mockReq.headers = { 'x-agent-session': ['a', 'b'] as unknown as string };

		agentHeartbeatMiddleware(mockReq as Request, mockRes as Response, mockNext);

		// typeof ['a','b'] is 'object', not 'string'
		expect(mockUpdateAgentHeartbeat).not.toHaveBeenCalled();
		expect(mockNext).toHaveBeenCalledTimes(1);
	});
});
