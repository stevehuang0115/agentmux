#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ProcessRecovery manages automatic restart and monitoring of the AgentMux backend process
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

	constructor() {
		super();
		this.setupSignalHandlers();
	}

	/**
	 * Start the backend process with recovery monitoring
	 *
	 * @returns Promise that resolves when the process recovery system is started
	 */
	async start(): Promise<void> {
		console.log('🔄 Starting AgentMux Backend with Process Recovery...');
		console.log(`📊 Max restarts: ${this.maxRestarts}`);
		console.log(`⏱️ Min runtime: ${this.minRuntime / 1000}s`);

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
			console.log('🛑 Shutdown in progress, not starting process');
			return;
		}

		const backendScript = path.resolve(__dirname, '../index.js');

		console.log(`🚀 Starting backend process (attempt ${this.restartCount + 1}/${this.maxRestarts + 1})`);
		console.log(`📂 Script: ${backendScript}`);

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

		console.log(`✅ Backend process started with PID: ${this.childProcess.pid}`);

		// Handle process output
		this.childProcess.stdout?.on('data', (data) => {
			const output = data.toString().trim();
			console.log(`[Backend] ${output}`);

			// Check for successful startup
			if (output.includes('AgentMux server started on port')) {
				console.log('✅ Backend process started successfully');
				this.emit('process_started');
			}

			// Check for port conflicts
			if (output.includes('EADDRINUSE') || output.includes('already in use')) {
				console.warn('⚠️ Port conflict detected');
				this.emit('port_conflict');
			}
		});

		this.childProcess.stderr?.on('data', (data) => {
			const error = data.toString().trim();
			console.error(`[Backend Error] ${error}`);

			// Track critical errors
			if (error.includes('FATAL') || error.includes('Cannot start')) {
				this.emit('critical_error', error);
			}
		});

		// Handle process exit
		this.childProcess.on('exit', async (code, signal) => {
			const runtime = Date.now() - this.processStartTime;
			console.log(`📊 Backend process exited: code=${code}, signal=${signal}, runtime=${runtime}ms`);

			this.childProcess = null;
			this.emit('process_exit', { code, signal, runtime });

			if (!this.isShuttingDown) {
				await this.handleProcessExit(code, signal, runtime);
			}
		});

		this.childProcess.on('error', (error) => {
			console.error('🚨 Backend process error:', error);
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
			console.log('✅ Process exited gracefully, not restarting');
			return;
		}

		// Check if we've exceeded restart limits
		if (this.restartCount >= this.maxRestarts) {
			console.error(`❌ Maximum restart attempts (${this.maxRestarts}) exceeded`);
			this.emit('max_restarts_exceeded');
			return;
		}

		// If process crashed too quickly, it's likely a persistent issue
		if (runtime < this.minRuntime) {
			console.warn(`⚠️ Process crashed too quickly (${runtime}ms < ${this.minRuntime}ms)`);
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

		console.log(`🔄 Restarting in ${retryDelay / 1000}s... (attempt ${this.restartCount + 1})`);

		setTimeout(async () => {
			try {
				await this.startBackendProcess();
			} catch (error) {
				console.error('❌ Failed to restart backend process:', error);
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
					console.warn('⚠️ Health check failed: process is not running');
					return;
				}

				// You could add HTTP health check here
				// const response = await fetch('http://localhost:3000/health');
				// if (!response.ok) {
				//     console.warn('⚠️ Health check failed: HTTP endpoint not responding');
				// }

			} catch (error) {
				console.warn('⚠️ Health check error:', error);
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

			console.log(`💾 Recovery process memory: ${heapUsed}MB`);

			// Warn if recovery process itself is using too much memory
			if (heapUsed > 100) {
				console.warn(`⚠️ Recovery process high memory usage: ${heapUsed}MB`);
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
			console.error('🚨 Uncaught exception in recovery process:', error);
			this.shutdown('uncaughtException');
		});

		process.on('unhandledRejection', (reason) => {
			console.error('🚨 Unhandled rejection in recovery process:', reason);
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
		console.log(`🛑 Shutting down process recovery (signal: ${signal})...`);

		// Clear intervals
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}
		if (this.memoryMonitorInterval) {
			clearInterval(this.memoryMonitorInterval);
		}

		// Gracefully stop backend process
		if (this.childProcess && !this.childProcess.killed) {
			console.log('📡 Sending SIGTERM to backend process...');
			this.childProcess.kill('SIGTERM');

			// Wait up to 10 seconds for graceful shutdown
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					if (this.childProcess && !this.childProcess.killed) {
						console.log('⚡ Force killing backend process...');
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

		console.log('✅ Process recovery shutdown complete');
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
if (import.meta.url === `file://${process.argv[1]}`) {
	const recovery = new ProcessRecovery();

	recovery.on('process_started', () => {
		console.log('✅ Backend process started successfully');
	});

	recovery.on('process_exit', ({ code, signal, runtime }) => {
		console.log(`📊 Process exit: code=${code}, signal=${signal}, runtime=${runtime}ms`);
	});

	recovery.on('max_restarts_exceeded', () => {
		console.error('❌ Maximum restart attempts exceeded, exiting');
		process.exit(1);
	});

	recovery.start().catch((error) => {
		console.error('❌ Failed to start process recovery:', error);
		process.exit(1);
	});
}