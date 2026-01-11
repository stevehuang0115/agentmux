/**
 * Tests for PtySessionBackend class
 */

import { PtySessionBackend } from './pty-session-backend.js';
import type { SessionOptions } from '../session-backend.interface.js';

// Determine the shell to use based on platform
const TEST_SHELL = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
const TEST_CWD = process.cwd();

/**
 * Create default session options for testing
 */
function createTestOptions(overrides: Partial<SessionOptions> = {}): SessionOptions {
	return {
		cwd: TEST_CWD,
		command: TEST_SHELL,
		...overrides,
	};
}

describe('PtySessionBackend', () => {
	let backend: PtySessionBackend | null = null;

	beforeEach(() => {
		backend = new PtySessionBackend();
	});

	afterEach(async () => {
		// Clean up all sessions after each test
		if (backend) {
			await backend.destroy();
			backend = null;
		}
	});

	describe('constructor', () => {
		it('should create a backend with no sessions', () => {
			expect(backend!.getSessionCount()).toBe(0);
		});
	});

	describe('createSession', () => {
		it('should create a session with the given name', async () => {
			const session = await backend!.createSession('test-session', createTestOptions());

			expect(session.name).toBe('test-session');
		});

		it('should create a session with a valid PID', async () => {
			const session = await backend!.createSession('test-session', createTestOptions());

			expect(session.pid).toBeGreaterThan(0);
		});

		it('should add session to the session count', async () => {
			await backend!.createSession('test-session', createTestOptions());

			expect(backend!.getSessionCount()).toBe(1);
		});

		it('should throw when creating a session with duplicate name', async () => {
			await backend!.createSession('test-session', createTestOptions());

			await expect(
				backend!.createSession('test-session', createTestOptions())
			).rejects.toThrow("Session 'test-session' already exists");
		});

		it('should allow creating multiple sessions with different names', async () => {
			await backend!.createSession('session-1', createTestOptions());
			await backend!.createSession('session-2', createTestOptions());
			await backend!.createSession('session-3', createTestOptions());

			expect(backend!.getSessionCount()).toBe(3);
		});
	});

	describe('getSession', () => {
		it('should return undefined for non-existent session', () => {
			const session = backend!.getSession('non-existent');

			expect(session).toBeUndefined();
		});

		it('should return the session for existing session', async () => {
			const created = await backend!.createSession('test-session', createTestOptions());
			const retrieved = backend!.getSession('test-session');

			expect(retrieved).toBe(created);
		});
	});

	describe('killSession', () => {
		it('should do nothing for non-existent session', async () => {
			// Should not throw
			await expect(backend!.killSession('non-existent')).resolves.toBeUndefined();
		});

		it('should remove session from backend', async () => {
			await backend!.createSession('test-session', createTestOptions());
			expect(backend!.getSessionCount()).toBe(1);

			await backend!.killSession('test-session');
			expect(backend!.getSessionCount()).toBe(0);
		});

		it('should make session no longer accessible via getSession', async () => {
			await backend!.createSession('test-session', createTestOptions());
			await backend!.killSession('test-session');

			expect(backend!.getSession('test-session')).toBeUndefined();
		});

		it('should make sessionExists return false', async () => {
			await backend!.createSession('test-session', createTestOptions());
			expect(backend!.sessionExists('test-session')).toBe(true);

			await backend!.killSession('test-session');
			expect(backend!.sessionExists('test-session')).toBe(false);
		});
	});

	describe('listSessions', () => {
		it('should return empty array when no sessions', () => {
			const sessions = backend!.listSessions();

			expect(sessions).toEqual([]);
		});

		it('should return array with session names', async () => {
			await backend!.createSession('session-a', createTestOptions());
			await backend!.createSession('session-b', createTestOptions());

			const sessions = backend!.listSessions();

			expect(sessions).toContain('session-a');
			expect(sessions).toContain('session-b');
			expect(sessions).toHaveLength(2);
		});

		it('should not include killed sessions', async () => {
			await backend!.createSession('session-a', createTestOptions());
			await backend!.createSession('session-b', createTestOptions());
			await backend!.killSession('session-a');

			const sessions = backend!.listSessions();

			expect(sessions).not.toContain('session-a');
			expect(sessions).toContain('session-b');
			expect(sessions).toHaveLength(1);
		});
	});

	describe('sessionExists', () => {
		it('should return false for non-existent session', () => {
			expect(backend!.sessionExists('non-existent')).toBe(false);
		});

		it('should return true for existing session', async () => {
			await backend!.createSession('test-session', createTestOptions());

			expect(backend!.sessionExists('test-session')).toBe(true);
		});

		it('should return false after session is killed', async () => {
			await backend!.createSession('test-session', createTestOptions());
			await backend!.killSession('test-session');

			expect(backend!.sessionExists('test-session')).toBe(false);
		});
	});

	describe('captureOutput', () => {
		it('should return empty string for non-existent session', () => {
			const output = backend!.captureOutput('non-existent');

			expect(output).toBe('');
		});

		it('should capture output from session', async () => {
			const session = await backend!.createSession('test-session', createTestOptions());

			// Write something to generate output
			session.write('echo "test output"\n');

			// Wait for output to be processed
			await new Promise(resolve => setTimeout(resolve, 500));

			const output = backend!.captureOutput('test-session');

			// Output should not be empty (at least shell prompt)
			expect(typeof output).toBe('string');
		});
	});

	describe('getTerminalBuffer', () => {
		it('should return empty string for non-existent session', () => {
			const buffer = backend!.getTerminalBuffer('non-existent');

			expect(buffer).toBe('');
		});

		it('should return buffer content', async () => {
			const session = await backend!.createSession('test-session', createTestOptions());

			// Write something to generate output
			session.write('echo "buffer content"\n');

			// Wait for output to be processed
			await new Promise(resolve => setTimeout(resolve, 500));

			const buffer = backend!.getTerminalBuffer('test-session');

			expect(typeof buffer).toBe('string');
		});
	});

	describe('destroy', () => {
		it('should kill all sessions', async () => {
			await backend!.createSession('session-1', createTestOptions());
			await backend!.createSession('session-2', createTestOptions());
			await backend!.createSession('session-3', createTestOptions());

			expect(backend!.getSessionCount()).toBe(3);

			await backend!.destroy();

			expect(backend!.getSessionCount()).toBe(0);
		});

		it('should be idempotent', async () => {
			await backend!.createSession('test-session', createTestOptions());

			await backend!.destroy();
			await backend!.destroy();
			await backend!.destroy();

			expect(backend!.getSessionCount()).toBe(0);
		});
	});

	describe('resizeSession', () => {
		it('should throw for non-existent session', () => {
			expect(() => backend!.resizeSession('non-existent', 120, 40)).toThrow(
				"Session 'non-existent' does not exist"
			);
		});

		it('should resize existing session', async () => {
			await backend!.createSession('test-session', createTestOptions({
				cols: 80,
				rows: 24,
			}));

			// Should not throw
			expect(() => backend!.resizeSession('test-session', 120, 40)).not.toThrow();
		});
	});

	describe('getSessionCount', () => {
		it('should return 0 when no sessions', () => {
			expect(backend!.getSessionCount()).toBe(0);
		});

		it('should return correct count', async () => {
			await backend!.createSession('session-1', createTestOptions());
			expect(backend!.getSessionCount()).toBe(1);

			await backend!.createSession('session-2', createTestOptions());
			expect(backend!.getSessionCount()).toBe(2);

			await backend!.killSession('session-1');
			expect(backend!.getSessionCount()).toBe(1);
		});
	});
});

describe('PtySessionBackend integration', () => {
	let backend: PtySessionBackend | null = null;

	beforeEach(() => {
		backend = new PtySessionBackend();
	});

	afterEach(async () => {
		if (backend) {
			await backend.destroy();
			backend = null;
		}
	});

	it('should capture command output in terminal buffer', (done) => {
		backend!.createSession('test-session', createTestOptions())
			.then((session) => {
				// Write a command
				const testMarker = 'PTY_TEST_OUTPUT_MARKER';
				const command = process.platform === 'win32'
					? `Write-Host "${testMarker}"\r\n`
					: `echo "${testMarker}"\n`;

				session.write(command);

				// Wait and check output
				setTimeout(() => {
					const output = backend!.captureOutput('test-session');
					expect(output).toContain(testMarker);
					done();
				}, 1000);
			});
	}, 15000);

	it('should maintain session state between reads', async () => {
		const session = await backend!.createSession('test-session', createTestOptions());

		// Write first command
		const command1 = process.platform === 'win32'
			? 'Write-Host "FIRST"\r\n'
			: 'echo "FIRST"\n';
		session.write(command1);

		await new Promise(resolve => setTimeout(resolve, 500));
		const output1 = backend!.captureOutput('test-session');

		// Write second command
		const command2 = process.platform === 'win32'
			? 'Write-Host "SECOND"\r\n'
			: 'echo "SECOND"\n';
		session.write(command2);

		await new Promise(resolve => setTimeout(resolve, 500));
		const output2 = backend!.captureOutput('test-session');

		// Second output should be longer or equal (accumulated)
		expect(output2.length).toBeGreaterThanOrEqual(output1.length);
	}, 15000);

	it('should handle multiple concurrent sessions', async () => {
		const session1 = await backend!.createSession('session-1', createTestOptions());
		const session2 = await backend!.createSession('session-2', createTestOptions());
		const session3 = await backend!.createSession('session-3', createTestOptions());

		// All should have valid PIDs
		expect(session1.pid).toBeGreaterThan(0);
		expect(session2.pid).toBeGreaterThan(0);
		expect(session3.pid).toBeGreaterThan(0);

		// All PIDs should be different
		expect(session1.pid).not.toBe(session2.pid);
		expect(session2.pid).not.toBe(session3.pid);
		expect(session1.pid).not.toBe(session3.pid);

		expect(backend!.getSessionCount()).toBe(3);
	});
});
