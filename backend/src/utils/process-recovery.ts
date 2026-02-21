#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { LoggerService, ComponentLogger } from '../services/core/logger.service.js';

/**
 * ProcessRecovery manages automatic restart and monitoring of the Crewly backend process
 *
 * Features:
 * - Automatic restart on crashes
 * - Memory usage monitoring
 * - Port conflict detection and resolution
 * - Exponential backoff for restart attempts
 * - Health checks and process monitoring
 *
 * @example
 * ```typescript
 * const recovery = new ProcessRecovery();
 * await recovery.start();
 * ```
 */
export class ProcessRecovery extends EventEmitter {
	private childProcess: ChildProcess | null = null;
	private restartCount: number = 0;
	private maxRestarts: number = 5;
	private baseRetryDelay: number = 1000; // 1 second
	private maxRetryDelay: number = 30000; // 30 seconds
	private isShuttingDown: boolean = false;
	private healthCheckInterval: NodeJS.Timeout | null = null;
	private memoryMonitorInterval: NodeJS.Timeout | null = null;
	private processStartTime: number = 0;
	private minRuntime: number = 30000; // Process must run for at least 30 seconds
	private logger: ComponentLogger;

	constructor() {
		super();
		this.logger = LoggerService.getInstance().createComponentLogger('ProcessRecovery');
		this.setupSignalHandlers();
	}

	/**
	 * Start the backend process with recovery monitoring
	 *
	 * @returns Promise that resolves when the process recovery system is started
	 */
	async start(): Promise<void> {
		this.logger.info('Starting Crewly Backend with Process Recovery');
		this.logger.info('Recovery configuration', { maxRestarts: this.maxRestarts, minRuntimeSeconds: this.minRuntime / 1000 });

		await this.startBackendProcess();
		this.startHealthChecks();
		this.startMemoryMonitoring();
	}

	/**
	 * Start the backend process
	 *
	 * @returns Promise that resolves when the process is started
	 */
	private async startBackendProcess(): Promise<void> {
		if (this.isShuttingDown) {
			this.logger.info('Shutdown in progress, not starting process');
			return;
		}

		const backendScript = path.resolve(process.cwd(), 'backend/src/index.js');

		this.logger.info('Starting backend process', {
			attempt: this.restartCount + 1,
			maxAttempts: this.maxRestarts + 1,
			script: backendScript,
		});

		this.processStartTime = Date.now();

		this.childProcess = spawn('node', [backendScript], {
			stdio: ['pipe', 'pipe', 'pipe'],
			detached: false,
			env: {
				...process.env,
				NODE_ENV: process.env.NODE_ENV || 'development',
				RECOVERY_MODE: 'true'
			}
		});

		if (!this.childProcess.pid) {
			throw new Error('Failed to start backend process');
		}

		this.logger.info('Backend process started', { pid: this.childProcess.pid });

		// Handle process output
		this.childProcess.stdout?.on('data', (data) => {
			const output = data.toString().trim();
			this.logger.info('Backend output', { output });

			// Check for successful startup
			if (output.includes('Crewly server started on port')) {
				this.logger.info('Backend process started successfully');
				this.emit('process_started');
			}

			// Check for port conflicts
			if (output.includes('EADDRINUSE') || output.includes('already in use')) {
				this.logger.warn('Port conflict detected');
				this.emit('port_conflict');
			}
		});

		this.childProcess.stderr?.on('data', (data) => {
			const error = data.toString().trim();
			this.logger.error('Backend error output', { output: error });

			// Track critical errors
			if (error.includes('FATAL') || error.includes('Cannot start')) {
				this.emit('critical_error', error);
			}
		});

		// Handle process exit
		this.childProcess.on('exit', async (code, signal) => {
			const runtime = Date.now() - this.processStartTime;
			this.logger.info('Backend process exited', { code, signal, runtimeMs: runtime });

			this.childProcess = null;
			this.emit('process_exit', { code, signal, runtime });

			if (!this.isShuttingDown) {
				await this.handleProcessExit(code, signal, runtime);
			}
		});

		this.childProcess.on('error', (error) => {
			this.logger.error('Backend process error', { error: error.message, stack: error.stack });
			this.emit('process_error', error);
		});
	}

	/**
	 * Handle process exit and determine if restart is needed
	 *
	 * @param code - Exit code of the process
	 * @param signal - Signal that killed the process
	 * @param runtime - How long the process ran
	 */
	private async handleProcessExit(code: number | null, signal: string | null, runtime: number): Promise<void> {
		// Don't restart if explicitly killed or shutdown
		if (signal === 'SIGTERM' || signal === 'SIGINT' || code === 0) {
			this.logger.info('Process exited gracefully, not restarting');
			return;
		}

		// Check if we've exceeded restart limits
		if (this.restartCount >= this.maxRestarts) {
			this.logger.error('Maximum restart attempts exceeded', { maxRestarts: this.maxRestarts });
			this.emit('max_restarts_exceeded');
			return;
		}

		// If process crashed too quickly, it's likely a persistent issue
		if (runtime < this.minRuntime) {
			this.logger.warn('Process crashed too quickly', { runtimeMs: runtime, minRuntimeMs: this.minRuntime });
			this.restartCount++;
		} else {
			// Reset restart count if process ran for a reasonable time
			this.restartCount = 0;
		}

		// Calculate retry delay with exponential backoff
		const retryDelay = Math.min(
			this.baseRetryDelay * Math.pow(2, this.restartCount),
			this.maxRetryDelay
		);

		this.logger.info('Restarting backend process', { retryDelaySeconds: retryDelay / 1000, attempt: this.restartCount + 1 });

		setTimeout(async () => {
			try {
				await this.startBackendProcess();
			} catch (error) {
				this.logger.error('Failed to restart backend process', { error: error instanceof Error ? error.message : String(error) });
				this.restartCount++;
				await this.handleProcessExit(1, null, 0);
			}
		}, retryDelay);
	}

	/**
	 * Start health checks for the backend process
	 */
	private startHealthChecks(): void {
		this.healthCheckInterval = setInterval(async () => {
			if (!this.childProcess || this.isShuttingDown) return;

			try {
				// Simple health check - verify process is still running
				if (this.childProcess.killed || this.childProcess.exitCode !== null) {
					this.logger.warn('Health check failed: process is not running');
					return;
				}
			} catch (error) {
				this.logger.warn('Health check error', { error: error instanceof Error ? error.message : String(error) });
			}
		}, 30000); // Check every 30 seconds
	}

	/**
	 * Start memory monitoring for early detection of memory leaks
	 */
	private startMemoryMonitoring(): void {
		this.memoryMonitorInterval = setInterval(() => {
			if (!this.childProcess || this.isShuttingDown) return;

			const usage = process.memoryUsage();
			const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);

			this.logger.debug('Recovery process memory', { heapUsedMB: heapUsed });

			// Warn if recovery process itself is using too much memory
			if (heapUsed > 100) {
				this.logger.warn('Recovery process high memory usage', { heapUsedMB: heapUsed });
			}
		}, 60000); // Check every minute
	}

	/**
	 * Setup signal handlers for graceful shutdown
	 */
	private setupSignalHandlers(): void {
		process.on('SIGTERM', () => this.shutdown('SIGTERM'));
		process.on('SIGINT', () => this.shutdown('SIGINT'));

		process.on('uncaughtException', (error) => {
			this.logger.error('Uncaught exception in recovery process', { error: error.message, stack: error.stack });
			this.shutdown('uncaughtException');
		});

		process.on('unhandledRejection', (reason) => {
			this.logger.error('Unhandled rejection in recovery process', {
				reason: reason instanceof Error ? reason.message : String(reason),
			});
			this.shutdown('unhandledRejection');
		});
	}

	/**
	 * Gracefully shutdown the recovery system and backend process
	 *
	 * @param signal - Signal that triggered the shutdown
	 */
	async shutdown(signal?: string): Promise<void> {
		if (this.isShuttingDown) return;

		this.isShuttingDown = true;
		this.logger.info('Shutting down process recovery', { signal });

		// Clear intervals
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}
		if (this.memoryMonitorInterval) {
			clearInterval(this.memoryMonitorInterval);
		}

		// Gracefully stop backend process
		if (this.childProcess && !this.childProcess.killed) {
			this.logger.info('Sending SIGTERM to backend process');
			this.childProcess.kill('SIGTERM');

			// Wait up to 10 seconds for graceful shutdown
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					if (this.childProcess && !this.childProcess.killed) {
						this.logger.info('Force killing backend process');
						this.childProcess.kill('SIGKILL');
					}
					resolve();
				}, 10000);

				this.childProcess?.on('exit', () => {
					clearTimeout(timeout);
					resolve();
				});
			});
		}

		this.logger.info('Process recovery shutdown complete');
		process.exit(0);
	}

	/**
	 * Get current status of the backend process
	 *
	 * @returns Status information about the backend process
	 */
	getStatus(): {
		isRunning: boolean;
		pid: number | undefined;
		restartCount: number;
		runtime: number;
	} {
		return {
			isRunning: this.childProcess !== null && !this.childProcess.killed,
			pid: this.childProcess?.pid,
			restartCount: this.restartCount,
			runtime: this.processStartTime ? Date.now() - this.processStartTime : 0
		};
	}
}

// If this script is run directly, start the recovery system
const _isMain = process.argv[1]?.endsWith('process-recovery.ts') || process.argv[1]?.endsWith('process-recovery.js');
if (_isMain) {
	const logger = LoggerService.getInstance().createComponentLogger('ProcessRecovery');
	const recovery = new ProcessRecovery();

	recovery.on('process_started', () => {
		logger.info('Backend process started successfully');
	});

	recovery.on('process_exit', ({ code, signal, runtime }) => {
		logger.info('Process exit', { code, signal, runtimeMs: runtime });
	});

	recovery.on('max_restarts_exceeded', () => {
		logger.error('Maximum restart attempts exceeded, exiting');
		process.exit(1);
	});

	recovery.start().catch((error) => {
		logger.error('Failed to start process recovery', { error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	});
}
