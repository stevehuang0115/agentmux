/**
 * Session State Persistence Tests
 *
 * Tests for the session state persistence service.
 *
 * @module session-state-persistence.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';
import {
	SessionStatePersistence,
	getSessionStatePersistence,
	resetSessionStatePersistence,
	PersistedState,
	PersistedSessionInfo,
} from './session-state-persistence.js';
import type { ISessionBackend, SessionOptions } from './session-backend.interface.js';
import { RUNTIME_TYPES } from '../../constants.js';

// Mock the logger service
jest.mock('../core/logger.service.js', () => ({
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

describe('SessionStatePersistence', () => {
	let persistence: SessionStatePersistence;
	let testFilePath: string;
	let mockBackend: jest.Mocked<ISessionBackend>;

	beforeEach(async () => {
		// Create a unique temp file for each test
		testFilePath = path.join(tmpdir(), `session-state-test-${Date.now()}.json`);
		persistence = new SessionStatePersistence(testFilePath);

		// Create mock backend
		mockBackend = {
			createSession: jest.fn(),
			getSession: jest.fn(),
			killSession: jest.fn(),
			listSessions: jest.fn(() => []),
			sessionExists: jest.fn(() => false),
			captureOutput: jest.fn(() => ''),
			getTerminalBuffer: jest.fn(() => ''),
			destroy: jest.fn(),
		} as unknown as jest.Mocked<ISessionBackend>;
	});

	afterEach(async () => {
		// Clean up test file
		try {
			await fs.unlink(testFilePath);
		} catch {
			// File might not exist
		}
		resetSessionStatePersistence();
	});

	describe('registerSession', () => {
		it('should register a session for persistence', () => {
			const options: SessionOptions = {
				cwd: '/home/user/project',
				command: 'claude',
				args: ['--dangerously-skip-permissions'],
			};

			persistence.registerSession('test-session', options, RUNTIME_TYPES.CLAUDE_CODE, 'dev', 'team-1');

			expect(persistence.isSessionRegistered('test-session')).toBe(true);
			expect(persistence.getRegisteredSessions()).toContain('test-session');
		});

		it('should store session metadata correctly', () => {
			const options: SessionOptions = {
				cwd: '/home/user/project',
				command: 'claude',
				args: ['--resume'],
				env: { NODE_ENV: 'development' },
			};

			persistence.registerSession('test-session', options, RUNTIME_TYPES.CLAUDE_CODE, 'dev', 'team-1');

			const metadata = persistence.getSessionMetadata('test-session');
			expect(metadata).toEqual({
				name: 'test-session',
				cwd: '/home/user/project',
				command: 'claude',
				args: ['--resume'],
				runtimeType: RUNTIME_TYPES.CLAUDE_CODE,
				role: 'dev',
				teamId: 'team-1',
				env: { NODE_ENV: 'development' },
			});
		});
	});

	describe('unregisterSession', () => {
		it('should remove a session from persistence', () => {
			const options: SessionOptions = {
				cwd: '/home/user',
				command: 'claude',
			};

			persistence.registerSession('test-session', options, RUNTIME_TYPES.CLAUDE_CODE);
			expect(persistence.isSessionRegistered('test-session')).toBe(true);

			persistence.unregisterSession('test-session');
			expect(persistence.isSessionRegistered('test-session')).toBe(false);
		});

		it('should handle unregistering non-existent session gracefully', () => {
			expect(() => {
				persistence.unregisterSession('non-existent');
			}).not.toThrow();
		});
	});

	describe('saveState', () => {
		it('should save state to file', async () => {
			const options: SessionOptions = {
				cwd: '/home/user/project',
				command: 'claude',
				args: ['--resume'],
			};

			persistence.registerSession('session1', options, RUNTIME_TYPES.CLAUDE_CODE, 'dev');
			persistence.registerSession('session2', options, RUNTIME_TYPES.GEMINI_CLI, 'qa');

			(mockBackend.listSessions as jest.Mock).mockReturnValue(['session1', 'session2']);

			const saved = await persistence.saveState(mockBackend);

			expect(saved).toBe(2);

			// Verify file contents
			const content = await fs.readFile(testFilePath, 'utf-8');
			const state: PersistedState = JSON.parse(content);

			expect(state.version).toBe(1);
			expect(state.sessions).toHaveLength(2);
			expect(state.sessions.map((s: PersistedSessionInfo) => s.name)).toContain('session1');
			expect(state.sessions.map((s: PersistedSessionInfo) => s.name)).toContain('session2');
		});

		it('should only save active sessions', async () => {
			const options: SessionOptions = {
				cwd: '/home/user',
				command: 'claude',
			};

			persistence.registerSession('active-session', options, RUNTIME_TYPES.CLAUDE_CODE);
			persistence.registerSession('inactive-session', options, RUNTIME_TYPES.CLAUDE_CODE);

			// Only one session is active in the backend
			(mockBackend.listSessions as jest.Mock).mockReturnValue(['active-session']);

			const saved = await persistence.saveState(mockBackend);

			expect(saved).toBe(1);

			const state = await persistence.loadState();
			expect(state?.sessions).toHaveLength(1);
			expect(state?.sessions[0].name).toBe('active-session');
		});

		it('should create directory if it does not exist', async () => {
			const nestedPath = path.join(tmpdir(), 'nested', 'dir', `state-${Date.now()}.json`);
			const nestedPersistence = new SessionStatePersistence(nestedPath);

			const options: SessionOptions = {
				cwd: '/home/user',
				command: 'claude',
			};

			nestedPersistence.registerSession('test', options, RUNTIME_TYPES.CLAUDE_CODE);
			(mockBackend.listSessions as jest.Mock).mockReturnValue(['test']);

			await nestedPersistence.saveState(mockBackend);

			const content = await fs.readFile(nestedPath, 'utf-8');
			expect(JSON.parse(content).sessions).toHaveLength(1);

			// Clean up
			await fs.rm(path.join(tmpdir(), 'nested'), { recursive: true });
		});
	});

	describe('restoreState', () => {
		it('should restore sessions from saved state', async () => {
			// Create state file
			const state: PersistedState = {
				version: 1,
				savedAt: new Date().toISOString(),
				sessions: [
					{
						name: 'restored-session',
						cwd: '/home/user/project',
						command: 'claude',
						args: [],
						runtimeType: RUNTIME_TYPES.CLAUDE_CODE,
						role: 'dev',
					},
				],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			const restored = await persistence.restoreState(mockBackend);

			expect(restored).toBe(1);
			expect(mockBackend.createSession).toHaveBeenCalledWith('restored-session', {
				cwd: '/home/user/project',
				command: 'claude',
				args: ['--resume'], // Should add --resume for Claude
				env: undefined,
			});
			expect(persistence.isSessionRegistered('restored-session')).toBe(true);
		});

		it('should add --resume flag for Claude sessions', async () => {
			const state: PersistedState = {
				version: 1,
				savedAt: new Date().toISOString(),
				sessions: [
					{
						name: 'claude-session',
						cwd: '/home/user',
						command: 'claude',
						args: ['--dangerously-skip-permissions'],
						runtimeType: RUNTIME_TYPES.CLAUDE_CODE,
					},
				],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			await persistence.restoreState(mockBackend);

			const callArgs = (mockBackend.createSession as jest.Mock).mock.calls[0][1] as SessionOptions;
			expect(callArgs.args).toContain('--resume');
			expect(callArgs.args).toContain('--dangerously-skip-permissions');
		});

		it('should not add --resume for non-Claude sessions', async () => {
			const state: PersistedState = {
				version: 1,
				savedAt: new Date().toISOString(),
				sessions: [
					{
						name: 'gemini-session',
						cwd: '/home/user',
						command: 'gemini',
						args: ['--model', 'gemini-pro'],
						runtimeType: RUNTIME_TYPES.GEMINI_CLI,
					},
				],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			await persistence.restoreState(mockBackend);

			const callArgs = (mockBackend.createSession as jest.Mock).mock.calls[0][1] as SessionOptions;
			expect(callArgs.args).not.toContain('--resume');
			expect(callArgs.args).toEqual(['--model', 'gemini-pro']);
		});

		it('should return 0 if no state file exists', async () => {
			const restored = await persistence.restoreState(mockBackend);

			expect(restored).toBe(0);
			expect(mockBackend.createSession).not.toHaveBeenCalled();
		});

		it('should skip unknown state versions', async () => {
			const state = {
				version: 999, // Unknown version
				savedAt: new Date().toISOString(),
				sessions: [{ name: 'test', cwd: '/', command: 'bash', args: [], runtimeType: 'claude-code' }],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			const restored = await persistence.restoreState(mockBackend);

			expect(restored).toBe(0);
			expect(mockBackend.createSession).not.toHaveBeenCalled();
		});

		it('should continue restoring other sessions if one fails', async () => {
			const state: PersistedState = {
				version: 1,
				savedAt: new Date().toISOString(),
				sessions: [
					{ name: 'session1', cwd: '/', command: 'claude', args: [], runtimeType: RUNTIME_TYPES.CLAUDE_CODE },
					{ name: 'session2', cwd: '/', command: 'claude', args: [], runtimeType: RUNTIME_TYPES.CLAUDE_CODE },
					{ name: 'session3', cwd: '/', command: 'claude', args: [], runtimeType: RUNTIME_TYPES.CLAUDE_CODE },
				],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			// First and third succeed, second fails
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const createSessionMock = mockBackend.createSession as jest.Mock<any>;
			createSessionMock
				.mockResolvedValueOnce({})
				.mockRejectedValueOnce(new Error('Failed'))
				.mockResolvedValueOnce({});

			const restored = await persistence.restoreState(mockBackend);

			expect(restored).toBe(2);
			expect(persistence.isSessionRegistered('session1')).toBe(true);
			expect(persistence.isSessionRegistered('session2')).toBe(false);
			expect(persistence.isSessionRegistered('session3')).toBe(true);
		});
	});

	describe('clearState', () => {
		it('should delete the state file', async () => {
			// Create state file
			await fs.writeFile(testFilePath, JSON.stringify({ version: 1, sessions: [] }));

			await persistence.clearState();

			await expect(fs.access(testFilePath)).rejects.toThrow();
		});

		it('should not throw if file does not exist', async () => {
			await expect(persistence.clearState()).resolves.not.toThrow();
		});
	});

	describe('clearMetadata', () => {
		it('should clear all registered sessions', () => {
			const options: SessionOptions = { cwd: '/', command: 'bash' };

			persistence.registerSession('session1', options, RUNTIME_TYPES.CLAUDE_CODE);
			persistence.registerSession('session2', options, RUNTIME_TYPES.GEMINI_CLI);

			expect(persistence.getRegisteredSessions()).toHaveLength(2);

			persistence.clearMetadata();

			expect(persistence.getRegisteredSessions()).toHaveLength(0);
		});
	});

	describe('loadState', () => {
		it('should load state from file', async () => {
			const state: PersistedState = {
				version: 1,
				savedAt: '2024-01-01T00:00:00.000Z',
				sessions: [
					{
						name: 'test-session',
						cwd: '/home/user',
						command: 'claude',
						args: [],
						runtimeType: RUNTIME_TYPES.CLAUDE_CODE,
					},
				],
			};

			await fs.writeFile(testFilePath, JSON.stringify(state));

			const loaded = await persistence.loadState();

			expect(loaded).toEqual(state);
		});

		it('should return null for non-existent file', async () => {
			const loaded = await persistence.loadState();

			expect(loaded).toBeNull();
		});

		it('should return null for invalid JSON', async () => {
			await fs.writeFile(testFilePath, 'not valid json');

			const loaded = await persistence.loadState();

			expect(loaded).toBeNull();
		});
	});

	describe('singleton', () => {
		it('should return same instance', () => {
			resetSessionStatePersistence();

			const instance1 = getSessionStatePersistence();
			const instance2 = getSessionStatePersistence();

			expect(instance1).toBe(instance2);
		});

		it('should create new instance after reset', () => {
			const instance1 = getSessionStatePersistence();
			resetSessionStatePersistence();
			const instance2 = getSessionStatePersistence();

			expect(instance1).not.toBe(instance2);
		});
	});

	describe('getFilePath', () => {
		it('should return the state file path', () => {
			expect(persistence.getFilePath()).toBe(testFilePath);
		});
	});
});
