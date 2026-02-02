/**
 * Terminal Controller Tests
 *
 * Tests for the terminal session management API endpoints.
 *
 * @module terminal-controller.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as terminalController from './terminal.controller.js';

// Mock the session module
jest.mock('../../services/session/index.js', () => ({
	getSessionBackendSync: jest.fn(),
}));

// Mock the logger service
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

// Mock the constants
jest.mock('../../constants.js', () => ({
	TERMINAL_CONTROLLER_CONSTANTS: {
		DEFAULT_CAPTURE_LINES: 50,
		MAX_CAPTURE_LINES: 500,
		MAX_OUTPUT_SIZE: 16384,
	},
}));

describe('TerminalController', () => {
	let mockReq: Partial<Request>;
	let mockRes: Partial<Response>;
	let mockSession: any;
	let mockBackend: any;
	let getSessionBackendSync: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		// Create mock response with proper typing
		const jsonMock = jest.fn().mockReturnThis();
		const statusMock = jest.fn().mockReturnThis();
		mockRes = {
			json: jsonMock as any,
			status: statusMock as any,
		};

		// Create mock session
		mockSession = {
			name: 'test-session',
			write: jest.fn(),
		};

		// Create mock backend
		mockBackend = {
			listSessions: jest.fn(() => ['session1', 'session2']),
			sessionExists: jest.fn(() => true),
			getSession: jest.fn(() => mockSession),
			captureOutput: jest.fn(() => 'mock terminal output'),
			getRawHistory: jest.fn(() => 'raw history with colors'),
			killSession: jest.fn(),
		};

		// Set up the mock
		getSessionBackendSync = require('../../services/session/index.js').getSessionBackendSync;
		(getSessionBackendSync as jest.Mock).mockReturnValue(mockBackend);
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	describe('listTerminalSessions', () => {
		it('should return list of sessions', async () => {
			mockReq = {};

			await terminalController.listTerminalSessions(mockReq as Request, mockRes as Response);

			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				data: { sessions: ['session1', 'session2'] },
			});
		});

		it('should return empty array when no sessions exist', async () => {
			mockBackend.listSessions.mockReturnValue([]);
			mockReq = {};

			await terminalController.listTerminalSessions(mockReq as Request, mockRes as Response);

			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				data: { sessions: [] },
			});
		});

		it('should return 503 when backend not initialized', async () => {
			(getSessionBackendSync as jest.Mock).mockReturnValue(null);
			mockReq = {};

			await terminalController.listTerminalSessions(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(503);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Session backend not initialized',
			});
		});

		it('should handle errors gracefully', async () => {
			mockBackend.listSessions.mockImplementation(() => {
				throw new Error('Backend error');
			});
			mockReq = {};

			await terminalController.listTerminalSessions(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Failed to list terminal sessions',
			});
		});
	});

	describe('sessionExists', () => {
		it('should return true when session exists', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
			};

			await terminalController.sessionExists(mockReq as Request, mockRes as Response);

			expect(mockBackend.sessionExists).toHaveBeenCalledWith('test-session');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				data: { exists: true, sessionName: 'test-session' },
			});
		});

		it('should return false when session does not exist', async () => {
			mockBackend.sessionExists.mockReturnValue(false);
			mockReq = {
				params: { sessionName: 'nonexistent' } as any,
			};

			await terminalController.sessionExists(mockReq as Request, mockRes as Response);

			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				data: { exists: false, sessionName: 'nonexistent' },
			});
		});

		it('should return 400 when session name is missing', async () => {
			mockReq = {
				params: {} as any,
			};

			await terminalController.sessionExists(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Session name is required',
			});
		});

		it('should return 503 when backend not initialized', async () => {
			(getSessionBackendSync as jest.Mock).mockReturnValue(null);
			mockReq = {
				params: { sessionName: 'test-session' } as any,
			};

			await terminalController.sessionExists(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(503);
		});
	});

	describe('captureTerminal', () => {
		it('should return terminal output', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				query: { lines: '50' } as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			expect(mockBackend.captureOutput).toHaveBeenCalledWith('test-session', 50);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				data: {
					output: 'mock terminal output',
					sessionName: 'test-session',
					lines: 50,
					truncated: false,
				},
			});
		});

		it('should return 404 when session does not exist', async () => {
			mockBackend.sessionExists.mockReturnValue(false);
			mockReq = {
				params: { sessionName: 'nonexistent' } as any,
				query: {} as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: "Session 'nonexistent' not found",
			});
		});

		it('should use default lines when not specified', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				query: {} as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			expect(mockBackend.captureOutput).toHaveBeenCalledWith('test-session', 50);
		});

		it('should limit lines to max', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				query: { lines: '1000' } as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			expect(mockBackend.captureOutput).toHaveBeenCalledWith('test-session', 500);
		});

		it('should truncate large output', async () => {
			const largeOutput = 'x'.repeat(20000);
			mockBackend.captureOutput.mockReturnValue(largeOutput);
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				query: {} as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			const jsonMock = mockRes.json as jest.Mock;
			const callArg = jsonMock.mock.calls[0][0] as { data: { truncated: boolean; output: string } };
			expect(callArg.data.truncated).toBe(true);
			expect(callArg.data.output.startsWith('...')).toBe(true);
		});
	});

	describe('writeToSession', () => {
		it('should write data to session', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { data: 'hello' },
			};

			await terminalController.writeToSession(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('hello');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				message: 'Data written successfully',
			});
		});

		it('should return 400 when data is missing', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: {},
			};

			await terminalController.writeToSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Data is required',
			});
		});

		it('should return 404 when session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(null);
			mockReq = {
				params: { sessionName: 'nonexistent' } as any,
				body: { data: 'hello' },
			};

			await terminalController.writeToSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: "Session 'nonexistent' not found",
			});
		});

		it('should allow empty string data', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { data: '' },
			};

			await terminalController.writeToSession(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				message: 'Data written successfully',
			});
		});
	});

	describe('sendTerminalInput', () => {
		it('should send input with carriage return', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { input: 'echo hello' },
			};

			await terminalController.sendTerminalInput(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('echo hello\r');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				message: 'Input sent successfully',
			});
		});

		it('should return 400 when input is missing', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: {},
			};

			await terminalController.sendTerminalInput(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Input is required',
			});
		});

		it('should return 400 when input is empty string', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { input: '' },
			};

			await terminalController.sendTerminalInput(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should handle complex commands with special characters', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { input: 'grep -r "test" . | head -10' },
			};

			await terminalController.sendTerminalInput(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('grep -r "test" . | head -10\r');
		});
	});

	describe('sendTerminalKey', () => {
		it('should send Enter key', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { key: 'Enter' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('\r');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				message: 'Key sent successfully',
			});
		});

		it('should send Ctrl+C key', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { key: 'C-c' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('\x03');
		});

		it('should send Escape key', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { key: 'Escape' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('\x1b');
		});

		it('should send Tab key', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { key: 'Tab' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('\t');
		});

		it('should return 400 when key is missing', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: {},
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Key is required',
			});
		});

		it('should pass through unknown keys unchanged', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
				body: { key: 'custom-key' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockSession.write).toHaveBeenCalledWith('custom-key');
		});
	});

	describe('killSession', () => {
		it('should kill session', async () => {
			mockReq = {
				params: { sessionName: 'test-session' } as any,
			};

			await terminalController.killSession(mockReq as Request, mockRes as Response);

			expect(mockBackend.killSession).toHaveBeenCalledWith('test-session');
			expect(mockRes.json).toHaveBeenCalledWith({
				success: true,
				message: 'Session killed successfully',
			});
		});

		it('should return 404 when session does not exist', async () => {
			mockBackend.sessionExists.mockReturnValue(false);
			mockReq = {
				params: { sessionName: 'nonexistent' } as any,
			};

			await terminalController.killSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: "Session 'nonexistent' not found",
			});
		});

		it('should return 400 when session name is missing', async () => {
			mockReq = {
				params: {} as any,
			};

			await terminalController.killSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Session name is required',
			});
		});

		it('should return 503 when backend not initialized', async () => {
			(getSessionBackendSync as jest.Mock).mockReturnValue(null);
			mockReq = {
				params: { sessionName: 'test-session' } as any,
			};

			await terminalController.killSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(503);
		});

		it('should handle kill errors gracefully', async () => {
			mockBackend.killSession.mockRejectedValue(new Error('Kill failed'));
			mockReq = {
				params: { sessionName: 'test-session' } as any,
			};

			await terminalController.killSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Failed to kill session',
			});
		});
	});

	describe('Parameter validation', () => {
		it('should validate session name for capture', async () => {
			mockReq = {
				params: {} as any,
				query: {} as any,
			};

			await terminalController.captureTerminal(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith({
				success: false,
				error: 'Session name is required',
			});
		});

		it('should validate session name for write', async () => {
			mockReq = {
				params: {} as any,
				body: { data: 'test' },
			};

			await terminalController.writeToSession(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should validate session name for input', async () => {
			mockReq = {
				params: {} as any,
				body: { input: 'test' },
			};

			await terminalController.sendTerminalInput(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should validate session name for key', async () => {
			mockReq = {
				params: {} as any,
				body: { key: 'Enter' },
			};

			await terminalController.sendTerminalKey(mockReq as Request, mockRes as Response);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});
});
