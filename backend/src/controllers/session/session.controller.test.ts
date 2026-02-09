/**
 * Session Controller Tests
 *
 * Tests for session controller endpoints.
 *
 * @module controllers/session/session.controller.test
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import { getPreviousSessions, dismissPreviousSessions } from './session.controller.js';
import { RUNTIME_TYPES } from '../../constants.js';

// Mock dependencies
jest.mock('../../services/session/index.js', () => ({
	getSessionBackendSync: jest.fn(),
	getSessionBackend: jest.fn(),
	getSessionStatePersistence: jest.fn(),
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
