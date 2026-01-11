import {
	createSessionBackend,
	getSessionBackend,
	getSessionBackendSync,
	getSessionBackendType,
	destroySessionBackend,
	isSessionBackendInitialized,
	resetSessionBackendFactory,
	setSessionBackendForTesting,
} from './session-backend.factory.js';
import type { ISession, ISessionBackend, SessionOptions } from './session-backend.interface.js';

/**
 * Create a mock session for testing
 */
function createMockSession(name: string): ISession {
	return {
		name,
		pid: 12345,
		cwd: '/test/dir',
		onData: jest.fn().mockReturnValue(() => {}),
		onExit: jest.fn().mockReturnValue(() => {}),
		write: jest.fn(),
		resize: jest.fn(),
		kill: jest.fn(),
	};
}

/**
 * Create a mock session backend for testing
 */
function createMockBackend(): jest.Mocked<ISessionBackend> {
	const sessions = new Map<string, ISession>();

	return {
		createSession: jest.fn().mockImplementation(async (name: string, _options: SessionOptions) => {
			const session = createMockSession(name);
			sessions.set(name, session);
			return session;
		}),
		getSession: jest.fn().mockImplementation((name: string) => sessions.get(name)),
		killSession: jest.fn().mockImplementation(async (name: string) => {
			sessions.delete(name);
		}),
		listSessions: jest.fn().mockImplementation(() => Array.from(sessions.keys())),
		sessionExists: jest.fn().mockImplementation((name: string) => sessions.has(name)),
		captureOutput: jest.fn().mockReturnValue('mock output'),
		getTerminalBuffer: jest.fn().mockReturnValue('mock buffer'),
		destroy: jest.fn().mockResolvedValue(undefined),
	};
}

describe('SessionBackendFactory', () => {
	beforeEach(() => {
		// Reset factory state before each test
		resetSessionBackendFactory();
	});

	afterEach(() => {
		// Clean up after each test
		resetSessionBackendFactory();
	});

	describe('createSessionBackend', () => {
		it('should create pty backend successfully', async () => {
			const backend = await createSessionBackend('pty');

			expect(backend).toBeDefined();
			expect(isSessionBackendInitialized()).toBe(true);
			expect(getSessionBackendType()).toBe('pty');

			// Cleanup
			await destroySessionBackend();
		});

		it('should throw error for tmux backend (currently disabled)', async () => {
			await expect(createSessionBackend('tmux')).rejects.toThrow(
				'tmux backend is currently disabled'
			);
		});

		it('should default to pty backend when no type specified', async () => {
			const backend = await createSessionBackend();

			expect(backend).toBeDefined();
			expect(getSessionBackendType()).toBe('pty');

			// Cleanup
			await destroySessionBackend();
		});

		it('should throw error for unsupported backend type', async () => {
			// @ts-expect-error Testing invalid type
			await expect(createSessionBackend('invalid')).rejects.toThrow(
				'Unsupported session backend type'
			);
		});

		it('should return existing backend if same type requested', async () => {
			const backend1 = await createSessionBackend('pty');
			const backend2 = await createSessionBackend('pty');

			expect(backend1).toBe(backend2);

			// Cleanup
			await destroySessionBackend();
		});
	});

	describe('getSessionBackend', () => {
		it('should create pty backend if none exists', async () => {
			const backend = await getSessionBackend();

			expect(backend).toBeDefined();
			expect(isSessionBackendInitialized()).toBe(true);
			expect(getSessionBackendType()).toBe('pty');

			// Cleanup
			await destroySessionBackend();
		});

		it('should return existing backend if one is set', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = await getSessionBackend();
			expect(backend).toBe(mockBackend);
		});
	});

	describe('getSessionBackendSync', () => {
		it('should return null when no backend is initialized', () => {
			const backend = getSessionBackendSync();
			expect(backend).toBeNull();
		});

		it('should return backend when one is set', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = getSessionBackendSync();
			expect(backend).toBe(mockBackend);
		});
	});

	describe('getSessionBackendType', () => {
		it('should return null when no backend is initialized', () => {
			const type = getSessionBackendType();
			expect(type).toBeNull();
		});

		it('should return pty when pty backend is set', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const type = getSessionBackendType();
			expect(type).toBe('pty');
		});

		it('should return tmux when tmux backend is set', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'tmux');

			const type = getSessionBackendType();
			expect(type).toBe('tmux');
		});
	});

	describe('destroySessionBackend', () => {
		it('should do nothing when no backend exists', async () => {
			// Should not throw
			await expect(destroySessionBackend()).resolves.toBeUndefined();
		});

		it('should destroy backend and reset state', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			expect(isSessionBackendInitialized()).toBe(true);

			await destroySessionBackend();

			expect(isSessionBackendInitialized()).toBe(false);
			expect(getSessionBackendSync()).toBeNull();
			expect(getSessionBackendType()).toBeNull();
			expect(mockBackend.destroy).toHaveBeenCalledTimes(1);
		});
	});

	describe('isSessionBackendInitialized', () => {
		it('should return false when no backend is initialized', () => {
			expect(isSessionBackendInitialized()).toBe(false);
		});

		it('should return true when backend is set', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			expect(isSessionBackendInitialized()).toBe(true);
		});
	});

	describe('resetSessionBackendFactory', () => {
		it('should reset all factory state', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			expect(isSessionBackendInitialized()).toBe(true);
			expect(getSessionBackendType()).toBe('pty');

			resetSessionBackendFactory();

			expect(isSessionBackendInitialized()).toBe(false);
			expect(getSessionBackendType()).toBeNull();
			expect(getSessionBackendSync()).toBeNull();
		});
	});

	describe('setSessionBackendForTesting', () => {
		it('should set backend and type', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			expect(getSessionBackendSync()).toBe(mockBackend);
			expect(getSessionBackendType()).toBe('pty');
		});

		it('should allow setting null to clear backend', () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			expect(isSessionBackendInitialized()).toBe(true);

			setSessionBackendForTesting(null, null);

			expect(isSessionBackendInitialized()).toBe(false);
		});
	});

	describe('mock backend functionality', () => {
		it('should support creating sessions via mock backend', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = await getSessionBackend();
			const session = await backend.createSession('test-session', {
				cwd: '/home/user',
				command: '/bin/bash',
			});

			expect(session.name).toBe('test-session');
			expect(session.pid).toBe(12345);
			expect(backend.sessionExists('test-session')).toBe(true);
			expect(backend.listSessions()).toContain('test-session');
		});

		it('should support killing sessions via mock backend', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = await getSessionBackend();
			await backend.createSession('test-session', {
				cwd: '/home/user',
				command: '/bin/bash',
			});

			expect(backend.sessionExists('test-session')).toBe(true);

			await backend.killSession('test-session');

			expect(backend.sessionExists('test-session')).toBe(false);
		});

		it('should support capturing output via mock backend', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = await getSessionBackend();
			const output = backend.captureOutput('test-session');

			expect(output).toBe('mock output');
		});

		it('should support getting terminal buffer via mock backend', async () => {
			const mockBackend = createMockBackend();
			setSessionBackendForTesting(mockBackend, 'pty');

			const backend = await getSessionBackend();
			const buffer = backend.getTerminalBuffer('test-session');

			expect(buffer).toBe('mock buffer');
		});
	});
});

describe('ISession interface compliance', () => {
	describe('mock session', () => {
		it('should implement all required properties', () => {
			const session = createMockSession('test');

			expect(session).toHaveProperty('name');
			expect(session).toHaveProperty('pid');
			expect(session).toHaveProperty('cwd');
			expect(typeof session.name).toBe('string');
			expect(typeof session.pid).toBe('number');
			expect(typeof session.cwd).toBe('string');
		});

		it('should implement all required methods', () => {
			const session = createMockSession('test');

			expect(typeof session.onData).toBe('function');
			expect(typeof session.onExit).toBe('function');
			expect(typeof session.write).toBe('function');
			expect(typeof session.resize).toBe('function');
			expect(typeof session.kill).toBe('function');
		});

		it('should return unsubscribe function from onData', () => {
			const session = createMockSession('test');
			const unsubscribe = session.onData(() => {});

			expect(typeof unsubscribe).toBe('function');
		});

		it('should return unsubscribe function from onExit', () => {
			const session = createMockSession('test');
			const unsubscribe = session.onExit(() => {});

			expect(typeof unsubscribe).toBe('function');
		});
	});
});

describe('ISessionBackend interface compliance', () => {
	describe('mock backend', () => {
		it('should implement all required methods', () => {
			const backend = createMockBackend();

			expect(typeof backend.createSession).toBe('function');
			expect(typeof backend.getSession).toBe('function');
			expect(typeof backend.killSession).toBe('function');
			expect(typeof backend.listSessions).toBe('function');
			expect(typeof backend.sessionExists).toBe('function');
			expect(typeof backend.captureOutput).toBe('function');
			expect(typeof backend.getTerminalBuffer).toBe('function');
			expect(typeof backend.destroy).toBe('function');
		});

		it('should return Promise from createSession', () => {
			const backend = createMockBackend();
			const result = backend.createSession('test', { cwd: '/', command: '/bin/bash' });

			expect(result).toBeInstanceOf(Promise);
		});

		it('should return Promise from killSession', () => {
			const backend = createMockBackend();
			const result = backend.killSession('test');

			expect(result).toBeInstanceOf(Promise);
		});

		it('should return Promise from destroy', () => {
			const backend = createMockBackend();
			const result = backend.destroy();

			expect(result).toBeInstanceOf(Promise);
		});
	});
});
