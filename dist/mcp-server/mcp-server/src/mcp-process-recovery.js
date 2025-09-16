#!/usr/bin/env node
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * MCPProcessRecovery manages automatic restart and monitoring of the AgentMux MCP server
 *
 * Features:
 * - Automatic restart on crashes and SIGTERM
 * - Health checks via HTTP endpoint
 * - Cross-service communication with backend
 * - Exponential backoff for restart attempts
 * - Memory usage monitoring
 * - ES6/CommonJS import error handling
 *
 * @example
 * ```typescript
 * const recovery = new MCPProcessRecovery();
 * await recovery.start();
 * ```
 */
export class MCPProcessRecovery extends EventEmitter {
    childProcess = null;
    restartCount = 0;
    maxRestarts = 10;
    baseRetryDelay = 2000; // 2 seconds
    maxRetryDelay = 30000; // 30 seconds
    isShuttingDown = false;
    healthCheckInterval = null;
    memoryMonitorInterval = null;
    processStartTime = 0;
    minRuntime = 15000; // Process must run for at least 15 seconds
    mcpPort = 3001;
    lastHealthyTime = 0;
    constructor() {
        super();
        this.setupSignalHandlers();
        this.mcpPort = parseInt(process.env.AGENTMUX_MCP_PORT || '3001');
    }
    /**
     * Start the MCP server with recovery monitoring
     *
     * @returns Promise that resolves when the process recovery system is started
     */
    async start() {
        console.log('🔄 Starting AgentMux MCP Server with Process Recovery...');
        console.log(`📊 Max restarts: ${this.maxRestarts}`);
        console.log(`⏱️ Min runtime: ${this.minRuntime / 1000}s`);
        console.log(`🌐 MCP Port: ${this.mcpPort}`);
        await this.startMCPProcess();
        this.startHealthChecks();
        this.startMemoryMonitoring();
    }
    /**
     * Start the MCP server process
     *
     * @returns Promise that resolves when the process is started
     */
    async startMCPProcess() {
        if (this.isShuttingDown) {
            console.log('🛑 Shutdown in progress, not starting MCP process');
            return;
        }
        const mcpScript = path.resolve(__dirname, './index.js');
        console.log(`🚀 Starting MCP server process (attempt ${this.restartCount + 1}/${this.maxRestarts + 1})`);
        console.log(`📂 Script: ${mcpScript}`);
        this.processStartTime = Date.now();
        this.childProcess = spawn('node', [mcpScript], {
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || 'development',
                RECOVERY_MODE: 'true',
                AGENTMUX_MCP_PORT: this.mcpPort.toString()
            }
        });
        if (!this.childProcess.pid) {
            throw new Error('Failed to start MCP server process');
        }
        console.log(`✅ MCP server process started with PID: ${this.childProcess.pid}`);
        // Handle process output
        this.childProcess.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            console.log(`[MCP] ${output}`);
            // Check for successful startup
            if (output.includes('AgentMux MCP Server Started') || output.includes(`http://localhost:${this.mcpPort}`)) {
                console.log('✅ MCP server started successfully');
                this.lastHealthyTime = Date.now();
                this.emit('process_started');
            }
            // Check for port conflicts
            if (output.includes('EADDRINUSE') || output.includes('already in use')) {
                console.warn('⚠️ MCP server port conflict detected');
                this.emit('port_conflict');
            }
            // Check for import/module errors
            if (output.includes('SyntaxError') || output.includes('Named export') || output.includes('not found')) {
                console.error('🚨 MCP server module import error detected');
                this.emit('import_error', output);
            }
        });
        this.childProcess.stderr?.on('data', (data) => {
            const error = data.toString().trim();
            console.error(`[MCP Error] ${error}`);
            // Track critical errors
            if (error.includes('FATAL') || error.includes('Cannot start') || error.includes('SyntaxError')) {
                this.emit('critical_error', error);
            }
            // Handle ES6/CommonJS import errors specifically
            if (error.includes('Named export') && error.includes('not found')) {
                console.error('🚨 ES6/CommonJS import compatibility issue detected');
                this.emit('module_error', error);
            }
        });
        // Handle process exit
        this.childProcess.on('exit', async (code, signal) => {
            const runtime = Date.now() - this.processStartTime;
            console.log(`📊 MCP server process exited: code=${code}, signal=${signal}, runtime=${runtime}ms`);
            this.childProcess = null;
            this.emit('process_exit', { code, signal, runtime });
            if (!this.isShuttingDown) {
                await this.handleProcessExit(code, signal, runtime);
            }
        });
        this.childProcess.on('error', (error) => {
            console.error('🚨 MCP server process error:', error);
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
    async handleProcessExit(code, signal, runtime) {
        // Always restart the MCP server unless explicitly shut down
        // This is different from backend - MCP server should always be available
        if (signal === 'SIGINT' && this.isShuttingDown) {
            console.log('✅ MCP server exited due to shutdown, not restarting');
            return;
        }
        // Check if we've exceeded restart limits
        if (this.restartCount >= this.maxRestarts) {
            console.error(`❌ Maximum MCP restart attempts (${this.maxRestarts}) exceeded`);
            this.emit('max_restarts_exceeded');
            return;
        }
        // If process crashed too quickly, it's likely a persistent issue
        if (runtime < this.minRuntime) {
            console.warn(`⚠️ MCP server crashed too quickly (${runtime}ms < ${this.minRuntime}ms)`);
            this.restartCount++;
        }
        else {
            // Reset restart count if process ran for a reasonable time
            this.restartCount = Math.max(0, this.restartCount - 1);
        }
        // Calculate retry delay with exponential backoff
        const retryDelay = Math.min(this.baseRetryDelay * Math.pow(2, this.restartCount), this.maxRetryDelay);
        console.log(`🔄 Restarting MCP server in ${retryDelay / 1000}s... (attempt ${this.restartCount + 1})`);
        setTimeout(async () => {
            try {
                await this.startMCPProcess();
            }
            catch (error) {
                console.error('❌ Failed to restart MCP server process:', error);
                this.restartCount++;
                await this.handleProcessExit(1, null, 0);
            }
        }, retryDelay);
    }
    /**
     * Start health checks for the MCP server
     */
    startHealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            if (!this.childProcess || this.isShuttingDown)
                return;
            try {
                // Check if process is still running
                if (this.childProcess.killed || this.childProcess.exitCode !== null) {
                    console.warn('⚠️ MCP health check failed: process is not running');
                    return;
                }
                // HTTP health check
                try {
                    const response = await fetch(`http://localhost:${this.mcpPort}/health`);
                    if (response.ok) {
                        this.lastHealthyTime = Date.now();
                        console.log('💚 MCP server health check passed');
                    }
                    else {
                        console.warn(`⚠️ MCP health check failed: HTTP ${response.status}`);
                    }
                }
                catch (httpError) {
                    const timeSinceHealthy = Date.now() - this.lastHealthyTime;
                    console.warn(`⚠️ MCP health check failed: ${httpError}, unhealthy for ${timeSinceHealthy}ms`);
                    // If unhealthy for more than 60 seconds, restart
                    if (timeSinceHealthy > 60000) {
                        console.error('🚨 MCP server unhealthy for too long, restarting...');
                        this.restartMCPServer();
                    }
                }
            }
            catch (error) {
                console.warn('⚠️ MCP health check error:', error);
            }
        }, 15000); // Check every 15 seconds
    }
    /**
     * Start memory monitoring for early detection of memory leaks
     */
    startMemoryMonitoring() {
        this.memoryMonitorInterval = setInterval(() => {
            if (!this.childProcess || this.isShuttingDown)
                return;
            const usage = process.memoryUsage();
            const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
            console.log(`💾 MCP recovery process memory: ${heapUsed}MB`);
            // Warn if recovery process itself is using too much memory
            if (heapUsed > 150) {
                console.warn(`⚠️ MCP recovery process high memory usage: ${heapUsed}MB`);
            }
        }, 60000); // Check every minute
    }
    /**
     * Manually restart the MCP server
     */
    async restartMCPServer() {
        if (this.childProcess && !this.childProcess.killed) {
            console.log('📡 Manually restarting MCP server...');
            this.childProcess.kill('SIGTERM');
        }
    }
    /**
     * Setup signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            console.error('🚨 Uncaught exception in MCP recovery process:', error);
            this.shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            console.error('🚨 Unhandled rejection in MCP recovery process:', reason);
            this.shutdown('unhandledRejection');
        });
    }
    /**
     * Gracefully shutdown the recovery system and MCP server process
     *
     * @param signal - Signal that triggered the shutdown
     */
    async shutdown(signal) {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        console.log(`🛑 Shutting down MCP process recovery (signal: ${signal})...`);
        // Clear intervals
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        // Gracefully stop MCP server process
        if (this.childProcess && !this.childProcess.killed) {
            console.log('📡 Sending SIGTERM to MCP server process...');
            this.childProcess.kill('SIGTERM');
            // Wait up to 10 seconds for graceful shutdown
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (this.childProcess && !this.childProcess.killed) {
                        console.log('⚡ Force killing MCP server process...');
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
        console.log('✅ MCP process recovery shutdown complete');
        process.exit(0);
    }
    /**
     * Get current status of the MCP server process
     *
     * @returns Status information about the MCP server process
     */
    getStatus() {
        return {
            isRunning: this.childProcess !== null && !this.childProcess.killed,
            pid: this.childProcess?.pid,
            restartCount: this.restartCount,
            runtime: this.processStartTime ? Date.now() - this.processStartTime : 0,
            lastHealthyTime: this.lastHealthyTime,
            healthyDuration: this.lastHealthyTime ? Date.now() - this.lastHealthyTime : 0
        };
    }
}
// If this script is run directly, start the recovery system
if (import.meta.url === `file://${process.argv[1]}`) {
    const recovery = new MCPProcessRecovery();
    recovery.on('process_started', () => {
        console.log('✅ MCP server process started successfully');
    });
    recovery.on('process_exit', ({ code, signal, runtime }) => {
        console.log(`📊 MCP process exit: code=${code}, signal=${signal}, runtime=${runtime}ms`);
    });
    recovery.on('critical_error', (error) => {
        console.error('🚨 MCP server critical error:', error);
    });
    recovery.on('import_error', (error) => {
        console.error('🚨 MCP server import error - likely ES6/CommonJS issue:', error);
    });
    recovery.on('max_restarts_exceeded', () => {
        console.error('❌ Maximum MCP restart attempts exceeded, exiting');
        process.exit(1);
    });
    recovery.start().catch((error) => {
        console.error('❌ Failed to start MCP process recovery:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=mcp-process-recovery.js.map