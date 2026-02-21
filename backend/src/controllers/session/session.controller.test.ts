/**
 * Session Controller Tests
 *
 * Tests for session controller endpoints.
 *
 * @module controllers/session/session.controller.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { getPreviousSessions, dismissPreviousSessions, writeToSession } from './session.controller.js';
import { RUNTIME_TYPES } from '../../constants.js';

// Mock dependencies
const mockSendMessage = jest.fn<any>();
jest.mock('../../services/session/index.js', () => ({
	getSessionBackendSync: jest.fn(),
	getSessionBackend: jest.fn(),
	getSessionStatePersistence: jest.fn(),
	createSessionCommandHelper: jest.fn(() => ({
		sendMessage: mockSendMessage,
	})),
}));

jest.mock('../../services/core/logger.service.js', () => ({
	LoggerService: {
		getInstance: jest.fn(() => ({
			createComponentLogger: jest.fn(() => ({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			})),
		})),
	},
}));

// Import mocked modules
import { getSessionStatePersistence, getSessionBackendSync } from '../../services/session/index.js';

const mockGetPersistence = getSessionStatePersistence as jest.MockedFunction<typeof getSessionStatePersistence>;
const mockGetBackend = getSessionBackendSync as jest.MockedFunction<typeof getSessionBackendSync>;

/**
 * Shape of the JSON response from getPreviousSessions
 */
interface PreviousSessionsResponse {
	success: boolean;
	data: {
		sessions: Array<{
			name: string;
			role?: string;
			teamId?: string;
			runtimeType: string;
			hasResumeId: boolean;
		}>;
	};
}

/**
 * Create a mock Express Response object
 */
function createMockRes(): Response {
	const res: Partial<Response> = {
		json: jest.fn().mockReturnThis() as any,
		status: jest.fn().mockReturnThis() as any,
	};
	return res as Response;
}

/**
 * Create a mock Express Request object
 */
function createMockReq(overrides?: Partial<Request>): Request {
	return { params: {}, query: {}, body: {}, ...overrides } as Request;
}

describe('Session Controller - Previous Sessions', () => {
	let mockPersistence: any;
	let mockBackend: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockPersistence = {
			getRegisteredSessionsMap: jest.fn(() => new Map()),
			clearStateAndMetadata: jest.fn(() => Promise.resolve()),
		};

		mockBackend = {
			sessionExists: jest.fn(() => false),
		};

		mockGetPersistence.mockReturnValue(mockPersistence);
		mockGetBackend.mockReturnValue(mockBackend);
	});

	describe('getPreviousSessions', () => {
		it('should return sessions with no active PTY', async () => {
			const sessionsMap = new Map([
				['agent-1', { name: 'agent-1', role: 'dev', teamId: 'team-1', runtimeType: RUNTIME_TYPES.CLAUDE_CODE, claudeSessionId: 'abc-123' }],
				['agent-2', { name: 'agent-2', role: 'qa', runtimeType: RUNTIME_TYPES.GEMINI_CLI }],
			]);
			mockPersistence.getRegisteredSessionsMap.mockReturnValue(sessionsMap);
			mockBackend.sessionExists.mockReturnValue(false);

			const req = createMockReq();
			const res = createMockRes();

			await getPreviousSessions.call(undefined, req, res);

			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: {
					sessions: [
						{ name: 'agent-1', role: 'dev', teamId: 'team-1', runtimeType: RUNTIME_TYPES.CLAUDE_CODE, hasResumeId: true },
						{ name: 'agent-2', role: 'qa', teamId: undefined, runtimeType: RUNTIME_TYPES.GEMINI_CLI, hasResumeId: false },
					],
				},
			});
		});

		it('should filter out sessions with active PTY', async () => {
			const sessionsMap = new Map([
				['active-agent', { name: 'active-agent', role: 'dev', runtimeType: RUNTIME_TYPES.CLAUDE_CODE }],
				['stopped-agent', { name: 'stopped-agent', role: 'qa', runtimeType: RUNTIME_TYPES.CLAUDE_CODE }],
			]);
			mockPersistence.getRegisteredSessionsMap.mockReturnValue(sessionsMap);
			mockBackend.sessionExists.mockImplementation((name: string) => name === 'active-agent');

			const req = createMockReq();
			const res = createMockRes();

			await getPreviousSessions.call(undefined, req, res);

			const jsonCall = (res.json as jest.Mock).mock.calls[0][0] as PreviousSessionsResponse;
			expect(jsonCall.data.sessions).toHaveLength(1);
			expect(jsonCall.data.sessions[0].name).toBe('stopped-agent');
		});

		it('should return empty array when no sessions registered', async () => {
			const req = createMockReq();
			const res = createMockRes();

			await getPreviousSessions.call(undefined, req, res);

			expect(res.json).toHaveBeenCalledWith({
				success: true,
				data: { sessions: [] },
			});
		});

		it('should handle errors gracefully', async () => {
			mockGetPersistence.mockImplementation(() => { throw new Error('Persistence error'); });

			const req = createMockReq();
			const res = createMockRes();

			await getPreviousSessions.call(undefined, req, res);

			expect(res.status).toHaveBeenCalledWith(500);
		});
	});

	describe('dismissPreviousSessions', () => {
		it('should call clearStateAndMetadata and return success', async () => {
			const req = createMockReq();
			const res = createMockRes();

			await dismissPreviousSessions.call(undefined, req, res);

			expect(mockPersistence.clearStateAndMetadata).toHaveBeenCalled();
			expect(res.json).toHaveBeenCalledWith({ success: true });
		});

		it('should handle errors gracefully', async () => {
			mockPersistence.clearStateAndMetadata.mockRejectedValue(new Error('Clear failed'));

			const req = createMockReq();
			const res = createMockRes();

			await dismissPreviousSessions.call(undefined, req, res);

			expect(res.status).toHaveBeenCalledWith(500);
		});
	});
});

describe('Session Controller - writeToSession', () => {
	let mockWrite: jest.Mock<any>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockWrite = jest.fn();
		mockSendMessage.mockResolvedValue(undefined);
	});

	it('should use raw write by default (no mode)', async () => {
		const mockSession = { write: mockWrite };
		mockGetBackend.mockReturnValue({
			sessionExists: jest.fn(() => true),
			getSession: jest.fn(() => mockSession),
		} as any);

		const req = createMockReq({
			params: { name: 'test-session' },
			body: { data: 'hello world' },
		} as any);
		const res = createMockRes();

		await writeToSession.call(undefined, req, res);

		expect(mockWrite).toHaveBeenCalledWith('hello world');
		expect(mockSendMessage).not.toHaveBeenCalled();
		expect(res.json).toHaveBeenCalledWith({ success: true, message: "Data written to session 'test-session'" });
	});

	it('should use sendMessage when mode is "message"', async () => {
		mockGetBackend.mockReturnValue({
			sessionExists: jest.fn(() => true),
			getSession: jest.fn(() => ({ write: mockWrite })),
		} as any);

		const req = createMockReq({
			params: { name: 'test-session' },
			body: { data: 'hello world', mode: 'message' },
		} as any);
		const res = createMockRes();

		await writeToSession.call(undefined, req, res);

		expect(mockSendMessage).toHaveBeenCalledWith('test-session', 'hello world');
		expect(mockWrite).not.toHaveBeenCalled();
		expect(res.json).toHaveBeenCalledWith({ success: true, message: "Message sent to session 'test-session'" });
	});

	it('should return 400 when data is missing', async () => {
		const req = createMockReq({
			params: { name: 'test-session' },
			body: {},
		} as any);
		const res = createMockRes();

		await writeToSession.call(undefined, req, res);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'Data is required' });
	});

	it('should return 404 when session does not exist', async () => {
		mockGetBackend.mockReturnValue({
			sessionExists: jest.fn(() => false),
		} as any);

		const req = createMockReq({
			params: { name: 'missing-session' },
			body: { data: 'hello' },
		} as any);
		const res = createMockRes();

		await writeToSession.call(undefined, req, res);

		expect(res.status).toHaveBeenCalledWith(404);
	});
});
