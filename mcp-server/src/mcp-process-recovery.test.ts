import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MCPProcessRecovery } from './mcp-process-recovery.js';
import { EventEmitter } from 'events';

jest.mock('child_process');
jest.mock('node:fs');

describe('MCPProcessRecovery', () => {
	let recovery: MCPProcessRecovery;
	let mockChildProcess: any;

	beforeEach(() => {
		// Mock child process
		mockChildProcess = new EventEmitter();
		mockChildProcess.pid = 12345;
		mockChildProcess.killed = false;
		mockChildProcess.exitCode = null;
		mockChildProcess.kill = jest.fn();
		mockChildProcess.stdout = new EventEmitter();
		mockChildProcess.stderr = new EventEmitter();

		// Mock spawn to return our mock child process
		const { spawn } = require('child_process');
		(spawn as jest.Mock).mockReturnValue(mockChildProcess);

		recovery = new MCPProcessRecovery();
	});

	afterEach(async () => {
		if (recovery) {
			await recovery.shutdown();
		}
		jest.clearAllMocks();
		jest.clearAllTimers();
	});

	describe('constructor', () => {
		it('should initialize with default values', () => {
			expect(recovery).toBeInstanceOf(MCPProcessRecovery);
			expect(recovery).toBeInstanceOf(EventEmitter);
		});

		it('should use environment MCP port if provided', () => {
			process.env.AGENTMUX_MCP_PORT = '3002';
			const customRecovery = new MCPProcessRecovery();
			expect(customRecovery).toBeInstanceOf(MCPProcessRecovery);
			delete process.env.AGENTMUX_MCP_PORT;
		});
	});

	describe('start', () => {
		it('should start MCP process successfully', async () => {
			const startPromise = recovery.start();

			// Simulate successful startup
			setTimeout(() => {
				mockChildProcess.stdout.emit('data', 'AgentMux MCP Server Started!');
			}, 10);

			await startPromise;

			expect(require('child_process').spawn).toHaveBeenCalledWith(
				'node',
				expect.arrayContaining([expect.stringContaining('index.js')]),
				expect.objectContaining({
					stdio: ['pipe', 'pipe', 'pipe'],
					env: expect.objectContaining({
						RECOVERY_MODE: 'true',
						AGENTMUX_MCP_PORT: '3001'
					})
				})
			);
		});

		it('should emit process_started event on successful startup', (done) => {
			recovery.on('process_started', () => {
				done();
			});

			recovery.start();

			// Simulate successful startup
			setTimeout(() => {
				mockChildProcess.stdout.emit('data', 'AgentMux MCP Server Started!');
			}, 10);
		});

		it('should detect port conflicts', (done) => {
			recovery.on('port_conflict', () => {
				done();
			});

			recovery.start();

			// Simulate port conflict
			setTimeout(() => {
				mockChildProcess.stdout.emit('data', 'Error: EADDRINUSE: address already in use');
			}, 10);
		});

		it('should detect import errors', (done) => {
			recovery.on('import_error', (error) => {
				expect(error).toContain('SyntaxError');
				done();
			});

			recovery.start();

			// Simulate import error
			setTimeout(() => {
				mockChildProcess.stdout.emit('data', 'SyntaxError: Named export not found');
			}, 10);
		});
	});

	describe('process exit handling', () => {
		beforeEach(async () => {
			await recovery.start();
			// Simulate successful startup
			mockChildProcess.stdout.emit('data', 'AgentMux MCP Server Started!');
		});

		it('should restart on unexpected exit', (done) => {
			const { spawn } = require('child_process');
			let callCount = 0;

			// Count spawn calls
			(spawn as jest.Mock).mockImplementation(() => {
				callCount++;
				if (callCount === 2) {
					done(); // Second call means restart happened
				}
				return mockChildProcess;
			});

			// Simulate process crash
			mockChildProcess.emit('exit', 1, null);
		});

		it('should not restart on graceful shutdown', async () => {
			const { spawn } = require('child_process');
			const initialCallCount = (spawn as jest.Mock).mock.calls.length;

			// Start shutdown
			const shutdownPromise = recovery.shutdown();

			// Simulate graceful exit
			mockChildProcess.emit('exit', 0, 'SIGTERM');

			await shutdownPromise;

			// Should not have called spawn again
			expect((spawn as jest.Mock).mock.calls.length).toBe(initialCallCount);
		});

		it('should increment restart count on quick crashes', () => {
			const initialStatus = recovery.getStatus();

			// Simulate quick crash (less than minRuntime)
			mockChildProcess.emit('exit', 1, null);

			const afterCrashStatus = recovery.getStatus();
			expect(afterCrashStatus.restartCount).toBeGreaterThan(initialStatus.restartCount);
		});

		it('should emit max_restarts_exceeded when limit reached', (done) => {
			recovery.on('max_restarts_exceeded', () => {
				done();
			});

			// Simulate multiple quick crashes to exceed restart limit
			for (let i = 0; i < 11; i++) {
				mockChildProcess.emit('exit', 1, null);
			}
		});
	});

	describe('getStatus', () => {
		it('should return correct status information', async () => {
			await recovery.start();

			const status = recovery.getStatus();

			expect(status).toEqual({
				isRunning: true,
				pid: 12345,
				restartCount: 0,
				runtime: expect.any(Number),
				lastHealthyTime: expect.any(Number),
				healthyDuration: expect.any(Number)
			});
		});

		it('should show not running when process is killed', async () => {
			await recovery.start();

			mockChildProcess.killed = true;

			const status = recovery.getStatus();
			expect(status.isRunning).toBe(false);
		});
	});

	describe('shutdown', () => {
		it('should gracefully shutdown the process', async () => {
			await recovery.start();

			const shutdownPromise = recovery.shutdown('SIGTERM');

			// Simulate process exit
			setTimeout(() => {
				mockChildProcess.emit('exit', 0, 'SIGTERM');
			}, 10);

			await shutdownPromise;

			expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
		});

		it('should force kill if graceful shutdown times out', async () => {
			await recovery.start();

			const shutdownPromise = recovery.shutdown('SIGTERM');

			// Don't emit exit event to simulate hanging process
			// The timeout should trigger force kill

			await shutdownPromise;

			expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
		});
	});

	describe('health checks', () => {
		beforeEach(async () => {
			// Mock fetch for health checks
			global.fetch = jest.fn();
			await recovery.start();
		});

		afterEach(() => {
			delete (global as any).fetch;
		});

		it('should perform HTTP health checks', async () => {
			const mockFetch = global.fetch as jest.Mock;
			mockFetch.mockResolvedValue({ ok: true });

			// Wait for health check interval
			await new Promise(resolve => setTimeout(resolve, 16000));

			expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/health');
		});

		it('should handle health check failures', async () => {
			const mockFetch = global.fetch as jest.Mock;
			mockFetch.mockRejectedValue(new Error('Connection refused'));

			// This should not throw
			await new Promise(resolve => setTimeout(resolve, 16000));

			expect(mockFetch).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should handle process spawn errors', async () => {
			const { spawn } = require('child_process');
			(spawn as jest.Mock).mockImplementation(() => {
				const errorProcess = new EventEmitter();
				errorProcess.pid = undefined;
				return errorProcess;
			});

			await expect(recovery.start()).rejects.toThrow('Failed to start MCP server process');
		});

		it('should emit critical_error on stderr output', (done) => {
			recovery.on('critical_error', (error) => {
				expect(error).toContain('FATAL');
				done();
			});

			recovery.start();

			setTimeout(() => {
				mockChildProcess.stderr.emit('data', 'FATAL: Cannot initialize server');
			}, 10);
		});

		it('should emit module_error on ES6/CommonJS issues', (done) => {
			recovery.on('module_error', (error) => {
				expect(error).toContain('Named export');
				done();
			});

			recovery.start();

			setTimeout(() => {
				mockChildProcess.stderr.emit('data', 'SyntaxError: Named export \'TmuxService\' not found');
			}, 10);
		});
	});
});