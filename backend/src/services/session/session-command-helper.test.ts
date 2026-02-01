/**
 * Tests for SessionCommandHelper
 */

import { SessionCommandHelper, KEY_CODES, createSessionCommandHelper } from './session-command-helper.js';
import type { ISession, ISessionBackend } from './session-backend.interface.js';
import { LoggerService } from '../core/logger.service.js';

// Mock the logger service
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

describe('SessionCommandHelper', () => {
	let mockBackend: jest.Mocked<ISessionBackend>;
	let mockSession: jest.Mocked<ISession>;
	let helper: SessionCommandHelper;

	beforeEach(() => {
		// Create mock session
		mockSession = {
			name: 'test-session',
			pid: 12345,
			cwd: '/test/path',
			onData: jest.fn(),
			onExit: jest.fn(),
			write: jest.fn(),
			resize: jest.fn(),
			kill: jest.fn(),
		} as any;

		// Create mock backend
		mockBackend = {
			createSession: jest.fn().mockResolvedValue(mockSession),
			getSession: jest.fn().mockReturnValue(mockSession),
			killSession: jest.fn().mockResolvedValue(undefined),
			listSessions: jest.fn().mockReturnValue(['test-session']),
			sessionExists: jest.fn().mockReturnValue(true),
			captureOutput: jest.fn().mockReturnValue('terminal output'),
			getTerminalBuffer: jest.fn().mockReturnValue('buffer content'),
			destroy: jest.fn().mockResolvedValue(undefined),
		} as any;

		helper = new SessionCommandHelper(mockBackend);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('sessionExists', () => {
		it('should return true when session exists', () => {
			expect(helper.sessionExists('test-session')).toBe(true);
			expect(mockBackend.sessionExists).toHaveBeenCalledWith('test-session');
		});

		it('should return false when session does not exist', () => {
			mockBackend.sessionExists.mockReturnValue(false);
			expect(helper.sessionExists('non-existent')).toBe(false);
		});
	});

	describe('getSession', () => {
		it('should return session when it exists', () => {
			const session = helper.getSession('test-session');
			expect(session).toBe(mockSession);
		});

		it('should return undefined when session does not exist', () => {
			mockBackend.getSession.mockReturnValue(undefined);
			const session = helper.getSession('non-existent');
			expect(session).toBeUndefined();
		});
	});

	describe('sendMessage', () => {
		it('should write message followed by separate Enter key', async () => {
			await helper.sendMessage('test-session', 'hello world');
			// First call: message text
			expect(mockSession.write).toHaveBeenNthCalledWith(1, 'hello world');
			// Second call: Enter key (after delay)
			expect(mockSession.write).toHaveBeenNthCalledWith(2, '\r');
			expect(mockSession.write).toHaveBeenCalledTimes(2);
		});

		it('should handle multi-line messages', async () => {
			await helper.sendMessage('test-session', 'line1\nline2\nline3');
			expect(mockSession.write).toHaveBeenNthCalledWith(1, 'line1\nline2\nline3');
			expect(mockSession.write).toHaveBeenNthCalledWith(2, '\r');
		});

		it('should throw error if session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(undefined);
			await expect(helper.sendMessage('non-existent', 'test')).rejects.toThrow(
				"Session 'non-existent' does not exist"
			);
		});
	});

	describe('sendKey', () => {
		it('should send special key codes', async () => {
			await helper.sendKey('test-session', 'Enter');
			expect(mockSession.write).toHaveBeenCalledWith('\r');
		});

		it('should send Ctrl+C key code', async () => {
			await helper.sendKey('test-session', 'C-c');
			expect(mockSession.write).toHaveBeenCalledWith('\x03');
		});

		it('should send literal key if not special', async () => {
			await helper.sendKey('test-session', 'a');
			expect(mockSession.write).toHaveBeenCalledWith('a');
		});

		it('should throw error if session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(undefined);
			await expect(helper.sendKey('non-existent', 'Enter')).rejects.toThrow(
				"Session 'non-existent' does not exist"
			);
		});
	});

	describe('sendCtrlC', () => {
		it('should send Ctrl+C character', async () => {
			await helper.sendCtrlC('test-session');
			expect(mockSession.write).toHaveBeenCalledWith('\x03');
		});

		it('should throw error if session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(undefined);
			await expect(helper.sendCtrlC('non-existent')).rejects.toThrow(
				"Session 'non-existent' does not exist"
			);
		});
	});

	describe('sendEnter', () => {
		it('should send Enter character', async () => {
			await helper.sendEnter('test-session');
			expect(mockSession.write).toHaveBeenCalledWith('\r');
		});
	});

	describe('sendEscape', () => {
		it('should send Escape character', async () => {
			await helper.sendEscape('test-session');
			expect(mockSession.write).toHaveBeenCalledWith('\x1b');
		});
	});

	describe('clearCurrentCommandLine', () => {
		it('should send Ctrl+C then Ctrl+U', async () => {
			await helper.clearCurrentCommandLine('test-session');
			expect(mockSession.write).toHaveBeenCalledWith('\x03');
			expect(mockSession.write).toHaveBeenCalledWith('\x15');
		});

		it('should throw error if session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(undefined);
			await expect(helper.clearCurrentCommandLine('non-existent')).rejects.toThrow(
				"Session 'non-existent' does not exist"
			);
		});
	});

	describe('capturePane', () => {
		it('should return captured output', () => {
			const output = helper.capturePane('test-session', 50);
			expect(output).toBe('terminal output');
			expect(mockBackend.captureOutput).toHaveBeenCalledWith('test-session', 50);
		});

		it('should use default lines value', () => {
			helper.capturePane('test-session');
			expect(mockBackend.captureOutput).toHaveBeenCalledWith('test-session', 100);
		});
	});

	describe('listSessions', () => {
		it('should return list of sessions', () => {
			const sessions = helper.listSessions();
			expect(sessions).toEqual(['test-session']);
		});
	});

	describe('killSession', () => {
		it('should kill the session', async () => {
			await helper.killSession('test-session');
			expect(mockBackend.killSession).toHaveBeenCalledWith('test-session');
		});
	});

	describe('createSession', () => {
		it('should create a session with default options', async () => {
			const session = await helper.createSession('new-session', '/test/cwd');
			expect(mockBackend.createSession).toHaveBeenCalledWith('new-session', {
				cwd: '/test/cwd',
				command: expect.any(String),
				args: undefined,
				env: undefined,
				cols: undefined,
				rows: undefined,
			});
			expect(session).toBe(mockSession);
		});

		it('should create a session with custom options', async () => {
			await helper.createSession('new-session', '/test/cwd', {
				command: 'node',
				args: ['script.js'],
				env: { NODE_ENV: 'test' },
				cols: 120,
				rows: 40,
			});

			expect(mockBackend.createSession).toHaveBeenCalledWith('new-session', {
				cwd: '/test/cwd',
				command: 'node',
				args: ['script.js'],
				env: { NODE_ENV: 'test' },
				cols: 120,
				rows: 40,
			});
		});
	});

	describe('setEnvironmentVariable', () => {
		it('should write export command', async () => {
			await helper.setEnvironmentVariable('test-session', 'MY_VAR', 'my_value');
			expect(mockSession.write).toHaveBeenCalledWith('export MY_VAR="my_value"\r');
		});

		it('should throw error if session does not exist', async () => {
			mockBackend.getSession.mockReturnValue(undefined);
			await expect(
				helper.setEnvironmentVariable('non-existent', 'KEY', 'VALUE')
			).rejects.toThrow("Session 'non-existent' does not exist");
		});
	});

	describe('resizeSession', () => {
		it('should resize the session', () => {
			helper.resizeSession('test-session', 120, 40);
			expect(mockSession.resize).toHaveBeenCalledWith(120, 40);
		});

		it('should throw error if session does not exist', () => {
			mockBackend.getSession.mockReturnValue(undefined);
			expect(() => helper.resizeSession('non-existent', 120, 40)).toThrow(
				"Session 'non-existent' does not exist"
			);
		});
	});

	describe('getBackend', () => {
		it('should return the underlying backend', () => {
			expect(helper.getBackend()).toBe(mockBackend);
		});
	});

	describe('KEY_CODES', () => {
		it('should have correct key codes', () => {
			expect(KEY_CODES['Enter']).toBe('\r');
			expect(KEY_CODES['C-c']).toBe('\x03');
			expect(KEY_CODES['C-u']).toBe('\x15');
			expect(KEY_CODES['Escape']).toBe('\x1b');
			expect(KEY_CODES['Tab']).toBe('\t');
		});
	});

	describe('createSessionCommandHelper', () => {
		it('should create a SessionCommandHelper instance', () => {
			const newHelper = createSessionCommandHelper(mockBackend);
			expect(newHelper).toBeInstanceOf(SessionCommandHelper);
		});
	});
});
