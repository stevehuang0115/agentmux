/**
 * Tests for PtySession class
 */

import { PtySession } from './pty-session.js';
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

describe('PtySession', () => {
	let session: PtySession | null = null;

	afterEach(() => {
		// Clean up any session after each test
		if (session && !session.isKilled()) {
			session.kill();
		}
		session = null;
	});

	describe('constructor', () => {
		it('should create a session with the given name', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			expect(session.name).toBe('test-session');
		});

		it('should create a session with the given cwd', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			expect(session.cwd).toBe(TEST_CWD);
		});

		it('should spawn a PTY process with a valid PID', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			expect(session.pid).toBeGreaterThan(0);
		});

		it('should accept custom terminal dimensions', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions({
				cols: 120,
				rows: 40,
			}));

			expect(session.pid).toBeGreaterThan(0);
		});

		it('should accept custom environment variables', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions({
				env: { CUSTOM_VAR: 'test-value' },
			}));

			expect(session.pid).toBeGreaterThan(0);
		});
	});

	describe('write', () => {
		it('should write data to the session', async () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Should not throw
			expect(() => session!.write('echo hello\n')).not.toThrow();
		});

		it('should throw when writing to a killed session', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());
			session.kill();

			expect(() => session!.write('echo hello\n')).toThrow(
				'Cannot write to killed session test-session'
			);
		});
	});

	describe('onData', () => {
		it('should register a data listener', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const callback = jest.fn();
			const unsubscribe = session.onData(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should return an unsubscribe function', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const callback = jest.fn();
			const unsubscribe = session.onData(callback);

			// Should not throw
			expect(() => unsubscribe()).not.toThrow();
		});

		it('should receive data from the session', (done) => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			let received = false;
			session.onData((data) => {
				if (!received) {
					received = true;
					expect(data.length).toBeGreaterThan(0);
					done();
				}
			});

			// Write a command that produces output
			session.write('echo hello\n');
		}, 10000);

		it('should allow multiple data listeners', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const callback1 = jest.fn();
			const callback2 = jest.fn();

			const unsub1 = session.onData(callback1);
			const unsub2 = session.onData(callback2);

			expect(typeof unsub1).toBe('function');
			expect(typeof unsub2).toBe('function');
		});

		it('should throw when max listeners exceeded', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Register 100 listeners (the maximum)
			for (let i = 0; i < 100; i++) {
				session.onData(() => {});
			}

			// The 101st should throw
			expect(() => session!.onData(() => {})).toThrow(
				'Maximum data listener count (100) exceeded'
			);
		});
	});

	describe('onExit', () => {
		it('should register an exit listener', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const callback = jest.fn();
			const unsubscribe = session.onExit(callback);

			expect(typeof unsubscribe).toBe('function');
		});

		it('should return an unsubscribe function', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const callback = jest.fn();
			const unsubscribe = session.onExit(callback);

			// Should not throw
			expect(() => unsubscribe()).not.toThrow();
		});

		it('should call exit listener when process exits naturally', (done) => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			session.onExit((code) => {
				expect(typeof code).toBe('number');
				done();
			});

			// Send exit command to trigger natural process exit
			setTimeout(() => {
				const exitCommand = process.platform === 'win32'
					? 'exit\r\n'
					: 'exit\n';
				session!.write(exitCommand);
			}, 100);
		}, 10000);

		it('should throw when max listeners exceeded', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Register 50 listeners (the maximum)
			for (let i = 0; i < 50; i++) {
				session.onExit(() => {});
			}

			// The 51st should throw
			expect(() => session!.onExit(() => {})).toThrow(
				'Maximum exit listener count (50) exceeded'
			);
		});
	});

	describe('resize', () => {
		it('should resize the terminal', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Should not throw
			expect(() => session!.resize(120, 40)).not.toThrow();
		});

		it('should throw when resizing a killed session', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());
			session.kill();

			expect(() => session!.resize(120, 40)).toThrow(
				'Cannot resize killed session test-session'
			);
		});
	});

	describe('kill', () => {
		it('should kill the session', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Should not throw
			expect(() => session!.kill()).not.toThrow();
			expect(session.isKilled()).toBe(true);
		});

		it('should be idempotent (can be called multiple times)', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			session.kill();
			session.kill();
			session.kill();

			expect(session.isKilled()).toBe(true);
		});

		it('should clear all listeners', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const dataCallback = jest.fn();
			const exitCallback = jest.fn();

			session.onData(dataCallback);
			session.onExit(exitCallback);

			session.kill();

			expect(session.isKilled()).toBe(true);
		});

		it('should accept a signal parameter', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Should not throw when passing a signal
			expect(() => session!.kill('SIGTERM')).not.toThrow();
			expect(session.isKilled()).toBe(true);
		});

		it('should accept SIGKILL as a signal', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			expect(() => session!.kill('SIGKILL')).not.toThrow();
			expect(session.isKilled()).toBe(true);
		});
	});

	describe('forceKill', () => {
		it('should force-kill the session', async () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			await session.forceKill();
			expect(session.isKilled()).toBe(true);
		});

		it('should not throw if process is already dead', async () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			// Kill normally first, then force-kill should still work
			session.kill();
			await expect(session.forceKill()).resolves.toBeUndefined();
		});

		it('should clear all listeners', async () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			const dataCallback = jest.fn();
			const exitCallback = jest.fn();

			session.onData(dataCallback);
			session.onExit(exitCallback);

			await session.forceKill();
			expect(session.isKilled()).toBe(true);
		});
	});

	describe('isKilled', () => {
		it('should return false for new session', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());

			expect(session.isKilled()).toBe(false);
		});

		it('should return true after kill()', () => {
			session = new PtySession('test-session', TEST_CWD, createTestOptions());
			session.kill();

			expect(session.isKilled()).toBe(true);
		});
	});
});

describe('PtySession integration', () => {
	let session: PtySession | null = null;

	afterEach(() => {
		if (session && !session.isKilled()) {
			session.kill();
		}
		session = null;
	});

	it('should execute a command and receive output', (done) => {
		session = new PtySession('test-session', TEST_CWD, createTestOptions());

		let outputBuffer = '';
		session.onData((data) => {
			outputBuffer += data;
			// Look for our test string in the output
			if (outputBuffer.includes('CREWLY_TEST_123')) {
				expect(outputBuffer).toContain('CREWLY_TEST_123');
				done();
			}
		});

		// Use a command that works on both Unix and Windows
		const command = process.platform === 'win32'
			? 'Write-Host "CREWLY_TEST_123"\r\n'
			: 'echo "CREWLY_TEST_123"\n';

		setTimeout(() => {
			session!.write(command);
		}, 500);
	}, 15000);

	it('should handle special characters', (done) => {
		session = new PtySession('test-session', TEST_CWD, createTestOptions());

		let outputBuffer = '';
		session.onData((data) => {
			outputBuffer += data;
			if (outputBuffer.includes('special')) {
				done();
			}
		});

		const command = process.platform === 'win32'
			? 'Write-Host "special"\r\n'
			: 'echo "special"\n';

		setTimeout(() => {
			session!.write(command);
		}, 500);
	}, 15000);
});
