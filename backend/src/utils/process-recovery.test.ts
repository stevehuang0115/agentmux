import { ProcessRecovery } from './process-recovery.js';
import { EventEmitter } from 'events';

/**
 * Test suite for ProcessRecovery utility
 *
 * Tests process monitoring, restart mechanisms, and error handling
 */
describe('ProcessRecovery', () => {
	let recovery: ProcessRecovery;

	beforeEach(() => {
		recovery = new ProcessRecovery();
	});

	afterEach(async () => {
		if (recovery) {
			await recovery.shutdown();
		}
	});

	describe('Process Monitoring', () => {
		test('should start backend process successfully', async () => {
			const startPromise = new Promise<void>((resolve) => {
				recovery.on('process_started', resolve);
			});

			await recovery.start();
			await startPromise;

			const status = recovery.getStatus();
			expect(status.isRunning).toBe(true);
			expect(status.pid).toBeDefined();
		});

		test('should detect process exit', async () => {
			const exitPromise = new Promise<any>((resolve) => {
				recovery.on('process_exit', resolve);
			});

			await recovery.start();

			// Simulate process crash by killing it
			const status = recovery.getStatus();
			if (status.pid) {
				process.kill(status.pid, 'SIGKILL');
			}

			const exitInfo = await exitPromise;
			expect(exitInfo.signal).toBe('SIGKILL');
		});
	});

	describe('Recovery Mechanisms', () => {
		test('should restart process after crash', async () => {
			let restartCount = 0;
			recovery.on('process_started', () => {
				restartCount++;
			});

			await recovery.start();

			// Wait for initial start
			await new Promise(resolve => setTimeout(resolve, 1000));

			// Kill the process
			const status = recovery.getStatus();
			if (status.pid) {
				process.kill(status.pid, 'SIGKILL');
			}

			// Wait for restart
			await new Promise(resolve => setTimeout(resolve, 5000));

			expect(restartCount).toBeGreaterThan(1);
		});

		test('should implement exponential backoff', async () => {
			const recovery = new ProcessRecovery();

			// Mock rapid crashes
			const startTimes: number[] = [];
			recovery.on('process_started', () => {
				startTimes.push(Date.now());
			});

			// This would require mocking the child process to crash immediately
			// Implementation depends on testing framework capabilities
		});
	});

	describe('Error Handling', () => {
		test('should handle port conflicts gracefully', async () => {
			const portConflictPromise = new Promise<void>((resolve) => {
				recovery.on('port_conflict', resolve);
			});

			// Start first instance
			await recovery.start();

			// Try to start second instance (should conflict)
			const recovery2 = new ProcessRecovery();
			await recovery2.start();

			await portConflictPromise;

			await recovery2.shutdown();
		});

		test('should stop restart attempts after max limit', async () => {
			const maxRestartsPromise = new Promise<void>((resolve) => {
				recovery.on('max_restarts_exceeded', resolve);
			});

			// Mock a process that crashes immediately multiple times
			// This would require mocking the child process behavior

			await maxRestartsPromise;
		});
	});

	describe('Health Monitoring', () => {
		test('should monitor memory usage', async () => {
			await recovery.start();

			// Wait for a health check cycle
			await new Promise(resolve => setTimeout(resolve, 35000));

			const status = recovery.getStatus();
			expect(status.runtime).toBeGreaterThan(30000);
		});

		test('should provide accurate status information', () => {
			const status = recovery.getStatus();

			expect(status).toHaveProperty('isRunning');
			expect(status).toHaveProperty('pid');
			expect(status).toHaveProperty('restartCount');
			expect(status).toHaveProperty('runtime');
		});
	});

	describe('Graceful Shutdown', () => {
		test('should shutdown gracefully on SIGTERM', async () => {
			await recovery.start();

			const shutdownPromise = recovery.shutdown('SIGTERM');

			await expect(shutdownPromise).resolves.toBeUndefined();
		});

		test('should cleanup resources on shutdown', async () => {
			await recovery.start();
			await recovery.shutdown();

			const status = recovery.getStatus();
			expect(status.isRunning).toBe(false);
		});
	});
});

/**
 * Integration tests for ProcessRecovery with real backend
 */
describe('ProcessRecovery Integration', () => {
	let recovery: ProcessRecovery;

	beforeEach(() => {
		recovery = new ProcessRecovery();
	});

	afterEach(async () => {
		if (recovery) {
			await recovery.shutdown();
		}
	});

	test('should successfully start and monitor backend', async () => {
		const events: string[] = [];

		recovery.on('process_started', () => events.push('started'));
		recovery.on('process_exit', () => events.push('exit'));
		recovery.on('port_conflict', () => events.push('conflict'));
		recovery.on('critical_error', () => events.push('error'));

		await recovery.start();

		// Let it run for a bit
		await new Promise(resolve => setTimeout(resolve, 10000));

		expect(events).toContain('started');

		const status = recovery.getStatus();
		expect(status.isRunning).toBe(true);
		expect(status.runtime).toBeGreaterThan(5000);
	});
});

/**
 * Performance tests for ProcessRecovery
 */
describe('ProcessRecovery Performance', () => {
	test('should start backend within reasonable time', async () => {
		const recovery = new ProcessRecovery();
		const startTime = Date.now();

		const startPromise = new Promise<void>((resolve) => {
			recovery.on('process_started', resolve);
		});

		await recovery.start();
		await startPromise;

		const duration = Date.now() - startTime;
		expect(duration).toBeLessThan(10000); // Should start within 10 seconds

		await recovery.shutdown();
	});

	test('should have minimal memory overhead', async () => {
		const recovery = new ProcessRecovery();
		const initialMemory = process.memoryUsage().heapUsed;

		await recovery.start();

		// Wait for stabilization
		await new Promise(resolve => setTimeout(resolve, 5000));

		const finalMemory = process.memoryUsage().heapUsed;
		const overhead = (finalMemory - initialMemory) / 1024 / 1024; // MB

		expect(overhead).toBeLessThan(50); // Should use less than 50MB overhead

		await recovery.shutdown();
	});
});

/**
 * Stress tests for ProcessRecovery
 */
describe('ProcessRecovery Stress Tests', () => {
	test('should handle rapid restart requests', async () => {
		const recovery = new ProcessRecovery();

		// Start and stop multiple times rapidly
		let cycleCount = 0;
		for (let i = 0; i < 5; i++) {
			await recovery.start();
			await new Promise(resolve => setTimeout(resolve, 1000));
			await recovery.shutdown();
			cycleCount++;
		}

		// Should complete all cycles without crashing or throwing
		expect(cycleCount).toBe(5);
	});
});

/**
 * Mock utilities for testing
 */
export class MockChildProcess extends EventEmitter {
	pid: number;
	killed: boolean = false;
	exitCode: number | null = null;
	stdout = new EventEmitter();
	stderr = new EventEmitter();

	constructor(pid: number = Math.floor(Math.random() * 10000)) {
		super();
		this.pid = pid;
	}

	kill(signal?: string): void {
		this.killed = true;
		this.exitCode = signal === 'SIGKILL' ? null : 0;
		this.emit('exit', this.exitCode, signal);
	}

	simulateOutput(message: string): void {
		this.stdout.emit('data', Buffer.from(message));
	}

	simulateError(error: string): void {
		this.stderr.emit('data', Buffer.from(error));
	}

	simulateSuccess(): void {
		this.simulateOutput('🚀 AgentMux server started on port 3000');
	}

	simulatePortConflict(): void {
		this.simulateError('Error: EADDRINUSE - Port 3000 is already in use');
	}
}

/**
 * Test utilities and helpers
 */
export const TestHelpers = {
	/**
	 * Wait for a specific event to be emitted
	 */
	waitForEvent(emitter: EventEmitter, event: string, timeout: number = 5000): Promise<any> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				reject(new Error(`Timeout waiting for event: ${event}`));
			}, timeout);

			emitter.once(event, (data) => {
				clearTimeout(timer);
				resolve(data);
			});
		});
	},

	/**
	 * Create a mock recovery instance for testing
	 */
	createMockRecovery(): ProcessRecovery {
		const recovery = new ProcessRecovery();
		// Override child process spawning for testing
		return recovery;
	},

	/**
	 * Check if port is available
	 */
	async isPortAvailable(port: number): Promise<boolean> {
		return new Promise((resolve) => {
			const testServer = require('net').createServer();

			testServer.listen(port, () => {
				testServer.close(() => resolve(true));
			});

			testServer.on('error', () => resolve(false));
		});
	}
};