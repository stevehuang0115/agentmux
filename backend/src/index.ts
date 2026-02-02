#!/usr/bin/env node

// Load environment variables from .env file BEFORE any other imports
// This ensures env vars are available when services initialize
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename_early = fileURLToPath(import.meta.url);
const __dirname_early = path.dirname(__filename_early);

// Load .env from project root (two directories up from backend/src/index.ts)
dotenv.config({ path: path.resolve(__dirname_early, '../../.env') });

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'os';

import {
	StorageService,
	TmuxService,
	SchedulerService,
	MessageSchedulerService,
	ActivityMonitorService,
	TaskTrackingService,
	TeamActivityWebSocketService,
	TeamsJsonWatcherService,
} from './services/index.js';
import {
	getSessionBackend,
	getSessionStatePersistence,
	destroySessionBackend,
} from './services/session/index.js';
import { ApiController } from './controllers/api.controller.js';
import { createApiRoutes } from './routes/api.routes.js';
import { createMCPRoutes, initializeMCPServer, destroyMCPServer } from './routes/mcp.routes.js';
import { TerminalGateway, setTerminalGateway } from './websocket/terminal.gateway.js';
import { StartupConfig } from './types/index.js';
import { LoggerService } from './services/core/logger.service.js';
import { getImprovementStartupService } from './services/orchestrator/improvement-startup.service.js';
import { initializeSlackIfConfigured, shutdownSlack } from './services/slack/index.js';

// Use the early-defined __dirname for consistency
const __dirname = __dirname_early;

/**
 * Safely parses an integer from a string with validation and fallback.
 *
 * @param value - The string value to parse, or undefined
 * @param defaultValue - The default value to return if parsing fails or value is invalid
 * @param envVarName - Optional name of the environment variable for logging purposes
 * @returns The parsed integer or the default value if parsing fails
 */
function parseIntWithFallback(value: string | undefined, defaultValue: number, envVarName?: string): number {
	if (value === undefined || value === '') {
		return defaultValue;
	}

	const parsed = parseInt(value, 10);

	// Check if parsing resulted in NaN or if the value contains non-numeric characters
	// that would be silently ignored by parseInt (e.g., "3000abc" -> 3000)
	if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
		const logger = LoggerService.getInstance().createComponentLogger('ConfigParser');
		logger.warn('Invalid numeric environment variable value, using default', {
			envVar: envVarName,
			value,
			defaultValue,
		});
		return defaultValue;
	}

	// Validate that the entire string was a valid number (no trailing non-numeric chars)
	if (String(parsed) !== value.trim()) {
		const logger = LoggerService.getInstance().createComponentLogger('ConfigParser');
		logger.warn('Environment variable contains non-numeric characters, using parsed value', {
			envVar: envVarName,
			originalValue: value,
			parsedValue: parsed,
		});
	}

	return parsed;
}

export class AgentMuxServer {
	private app: express.Application;
	private httpServer: ReturnType<typeof createServer>;
	private io: SocketIOServer;
	private config: StartupConfig;
	private logger = LoggerService.getInstance().createComponentLogger('AgentMuxServer');

	private storageService!: StorageService;
	private tmuxService!: TmuxService;
	private schedulerService!: SchedulerService;
	private messageSchedulerService!: MessageSchedulerService;
	private activityMonitorService!: ActivityMonitorService;
	private taskTrackingService!: TaskTrackingService;
	private teamActivityWebSocketService!: TeamActivityWebSocketService;
	private teamsJsonWatcherService!: TeamsJsonWatcherService;
	private apiController!: ApiController;
	private terminalGateway!: TerminalGateway;

	constructor(config?: Partial<StartupConfig>) {
		// Resolve ~ to actual home directory
		const resolveHomePath = (inputPath: string) => {
			if (inputPath.startsWith('~/')) {
				return path.join(os.homedir(), inputPath.slice(2));
			}
			if (inputPath === '~') {
				return os.homedir();
			}
			return inputPath;
		};

		const defaultAgentmuxHome =
			config?.agentmuxHome || process.env.AGENTMUX_HOME || '~/.agentmux';

		this.config = {
			webPort: config?.webPort || parseIntWithFallback(process.env.WEB_PORT, 8787, 'WEB_PORT'),
			mcpPort: config?.mcpPort || parseIntWithFallback(process.env.AGENTMUX_MCP_PORT, 8789, 'AGENTMUX_MCP_PORT'),
			agentmuxHome: resolveHomePath(defaultAgentmuxHome),
			defaultCheckInterval:
				config?.defaultCheckInterval ||
				parseIntWithFallback(process.env.DEFAULT_CHECK_INTERVAL, 30, 'DEFAULT_CHECK_INTERVAL'),
			autoCommitInterval:
				config?.autoCommitInterval || parseIntWithFallback(process.env.AUTO_COMMIT_INTERVAL, 30, 'AUTO_COMMIT_INTERVAL'),
		};

		this.app = express();
		this.httpServer = createServer(this.app);
		this.io = new SocketIOServer(this.httpServer, {
			cors: {
				origin: process.env.NODE_ENV === 'production' ? false : '*',
				methods: ['GET', 'POST'],
			},
			// Configure ping/pong to keep connections alive
			pingInterval: 10000, // Send ping every 10 seconds
			pingTimeout: 5000, // Wait 5 seconds for pong response
			// Prefer WebSocket transport for lower latency
			transports: ['websocket', 'polling'],
			// Allow transport upgrade from polling to websocket
			allowUpgrades: true,
			// Increase buffer size for large terminal output
			maxHttpBufferSize: 5 * 1024 * 1024, // 5MB
		});

		this.initializeServices();
		this.configureMiddleware();
		this.configureRoutes();
		this.configureWebSocket();
	}

	private initializeServices(): void {
		this.storageService = StorageService.getInstance(this.config.agentmuxHome);
		this.tmuxService = new TmuxService();
		this.schedulerService = new SchedulerService(this.storageService);
		this.messageSchedulerService = new MessageSchedulerService(
			this.tmuxService,
			this.storageService
		);
		this.activityMonitorService = ActivityMonitorService.getInstance();
		this.taskTrackingService = new TaskTrackingService();
		this.teamActivityWebSocketService = new TeamActivityWebSocketService(
			this.storageService,
			this.tmuxService,
			this.taskTrackingService
		);
		this.teamsJsonWatcherService = new TeamsJsonWatcherService();
		this.apiController = new ApiController(
			this.storageService,
			this.tmuxService,
			this.schedulerService,
			this.messageSchedulerService
		);
		this.terminalGateway = new TerminalGateway(this.io);

		// Set terminal gateway singleton for chat integration
		setTerminalGateway(this.terminalGateway);

		// Connect WebSocket service to terminal gateway for broadcasting
		this.teamActivityWebSocketService.setTerminalGateway(this.terminalGateway);

		// Connect teams.json watcher to team activity service for real-time updates
		this.teamsJsonWatcherService.setTeamActivityService(this.teamActivityWebSocketService);
	}

	private configureMiddleware(): void {
		// Security middleware
		this.app.use(
			helmet({
				contentSecurityPolicy: {
					directives: {
						defaultSrc: ["'self'"],
						styleSrc: ["'self'", "'unsafe-inline'"],
						scriptSrc: ["'self'"],
						imgSrc: ["'self'", 'data:', 'https:'],
						connectSrc: ["'self'", 'ws:', 'wss:'],
					},
				},
			})
		);

		// CORS
		this.app.use(
			cors({
				origin: process.env.NODE_ENV === 'production' ? false : '*',
				credentials: true,
			})
		);

		// Logging
		this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

		// Body parsing
		this.app.use(express.json({ limit: '10mb' }));
		this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

		// Note: Static files are configured in configureRoutes() after API routes
	}

	private configureRoutes(): void {
		// API routes
		this.app.use('/api', createApiRoutes(this.apiController));

		// MCP routes - JSON-RPC endpoint for Claude Code integration
		this.app.use('/mcp', createMCPRoutes());

		// Health check
		this.app.get('/health', (req, res) => {
			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				version: process.env.npm_package_version || '1.0.0',
			});
		});

		// Static files for frontend (after API routes)
		// __dirname is backend/src/ in dev mode (tsx) or backend/dist/ in compiled mode
		// We need to go up 2 levels to reach the project root (agentmux/)
		const projectRoot = path.resolve(__dirname, '../..');
		const frontendPath = path.join(projectRoot, 'frontend/dist');
		this.app.use(express.static(frontendPath));

		// Serve frontend for all other routes (SPA)
		this.app.get('*', (req, res) => {
			const frontendIndexPath = path.join(projectRoot, 'frontend/dist/index.html');
			res.sendFile(frontendIndexPath);
		});

		// Error handling middleware
		this.app.use(
			(
				err: Error,
				req: express.Request,
				res: express.Response,
				next: express.NextFunction
			) => {
				this.logger.error('Request error', { error: err.message, stack: err.stack });
				res.status(500).json({
					success: false,
					error:
						process.env.NODE_ENV === 'production'
							? 'Internal server error'
							: err.message,
				});
			}
		);

		// 404 handler
		this.app.use((req, res) => {
			res.status(404).json({
				success: false,
				error: 'Endpoint not found',
			});
		});
	}

	private configureWebSocket(): void {
		this.io.on('connection', (socket) => {
			this.logger.info('Client connected', { socketId: socket.id });

			socket.on('disconnect', () => {
				this.logger.info('Client disconnected', { socketId: socket.id });
			});
		});

		// Connect terminal output to WebSocket
		this.tmuxService.on('output', (output) => {
			this.io.emit('terminal_output', output);
		});

		// Forward scheduler events
		this.schedulerService.on('check_executed', (data) => {
			this.io.emit('check_executed', data);
		});

		this.schedulerService.on('check_scheduled', (data) => {
			this.io.emit('check_scheduled', data);
		});
	}

	async start(): Promise<void> {
		try {
			this.logger.info('Starting AgentMux server...');
			this.logger.info('Server startup info', {
				pid: process.pid,
				memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				targetPort: this.config.webPort
			});

			// Check for pending self-improvement (hot-reload recovery)
			await this.checkPendingSelfImprovement();

			// Check if port is already in use
			await this.checkPortAvailability();

			// Skip tmux initialization since we're using PTY session backend
			// Note: TmuxService is kept for backward compatibility but PTY is the active backend
			try {
				await this.tmuxService.initialize();
			} catch (error) {
				// Ignore tmux initialization errors - PTY backend is primary
			}

			// Initialize PTY session backend and restore saved sessions
			this.logger.info('Initializing PTY session backend...');
			const sessionBackend = await getSessionBackend();
			const persistence = getSessionStatePersistence();
			const restoredCount = await persistence.restoreState(sessionBackend);
			if (restoredCount > 0) {
				this.logger.info('Restored PTY sessions from saved state', { count: restoredCount });
			}

			// Start message scheduler
			this.logger.info('Starting message scheduler...');
			await this.messageSchedulerService.start();

			// Start activity monitoring
			this.logger.info('Starting activity monitoring...');
			this.activityMonitorService.startPolling();

			// Start team activity WebSocket service
			this.logger.info('Starting team activity WebSocket service...');
			this.teamActivityWebSocketService.start();

			// Start teams.json file watcher for real-time updates
			this.logger.info('Starting teams.json file watcher...');
			this.teamsJsonWatcherService.start();
			this.logger.info('Teams.json file watcher started for real-time updates');

			// Initialize MCP server (integrated into backend)
			this.logger.info('Initializing MCP server...');
			await initializeMCPServer();
			this.logger.info('MCP server integrated at /mcp endpoint');

			// Initialize Slack if configured
			await this.initializeSlackIfConfigured();

			// Start HTTP server with enhanced error handling
			await this.startHttpServer();

			// Register cleanup handlers
			this.registerSignalHandlers();

			// Start health monitoring
			this.startHealthMonitoring();

		} catch (error) {
			this.logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
			if (error instanceof Error && error.message.includes('EADDRINUSE')) {
				this.logger.error('Port already in use', { port: this.config.webPort });
				this.logger.info('Try killing existing processes or use a different port');
				await this.handlePortConflict();
			}
			throw error;
		}
	}

	/**
	 * Initialize Slack integration if environment variables are configured.
	 * Gracefully handles missing configuration or connection failures.
	 */
	private async initializeSlackIfConfigured(): Promise<void> {
		try {
			this.logger.info('Checking Slack configuration...');
			const result = await initializeSlackIfConfigured({
				agentRegistrationService: this.apiController.agentRegistrationService,
			});

			if (result.success) {
				this.logger.info('Slack integration initialized successfully');
			} else if (result.attempted) {
				this.logger.warn('Slack initialization failed', { error: result.error });
			} else {
				this.logger.info('Slack not configured, skipping initialization');
			}
		} catch (error) {
			this.logger.error('Error initializing Slack integration', {
				error: error instanceof Error ? error.message : String(error),
			});
			// Don't fail startup if Slack fails
		}
	}

	/**
	 * Check for and handle pending self-improvement from hot-reload.
	 * This runs at startup to validate or rollback any changes made
	 * before the process was restarted.
	 */
	private async checkPendingSelfImprovement(): Promise<void> {
		try {
			const startupService = getImprovementStartupService();
			const result = await startupService.runStartupCheck();

			if (result.hadPendingImprovement) {
				this.logger.info('Handled pending self-improvement', {
					improvementId: result.improvementId,
					action: result.action,
					validationPassed: result.validationPassed,
				});

				if (result.action === 'rolled_back') {
					this.logger.warn('Self-improvement rollback performed', {
						error: result.error,
					});
				}
			}
		} catch (error) {
			this.logger.error('Error checking pending self-improvement', {
				error: error instanceof Error ? error.message : String(error),
			});
			// Continue startup even if self-improvement check fails
		}
	}

	private async checkPortAvailability(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const { createServer } = await import('net');
			const testServer = createServer();

			testServer.listen(this.config.webPort, () => {
				testServer.close(() => {
					this.logger.info('Port is available', { port: this.config.webPort });
					resolve();
				});
			});

			testServer.on('error', (error: any) => {
				if (error.code === 'EADDRINUSE') {
					reject(new Error(`Port ${this.config.webPort} is already in use`));
				} else {
					reject(error);
				}
			});
		});
	}

	private async startHttpServer(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const startTime = Date.now();

			this.httpServer.listen(this.config.webPort, () => {
				const duration = Date.now() - startTime;
				this.logger.info('AgentMux server started', {
					port: this.config.webPort,
					durationMs: duration,
					dashboardUrl: `http://localhost:${this.config.webPort}`,
					mcpUrl: `http://localhost:${this.config.webPort}/mcp`,
					websocketUrl: `ws://localhost:${this.config.webPort}`,
					home: this.config.agentmuxHome
				});
				this.logger.info('To configure Claude Code, run:', {
					command: `claude mcp add --transport http agentmux http://localhost:${this.config.webPort}/mcp`
				});
				resolve();
			});

			this.httpServer.on('error', (error: any) => {
				this.logger.error('HTTP Server error', { error: error.message, code: error.code });

				if (error.code === 'EADDRINUSE') {
					this.logger.error('Port already in use by another process', { port: this.config.webPort });
					this.logger.info('Suggestion: Kill the existing process or change the port');
				} else if (error.code === 'EACCES') {
					this.logger.error('Permission denied for port', { port: this.config.webPort });
					this.logger.info('Suggestion: Try a port above 1024 or run with appropriate permissions');
				}

				reject(error);
			});
		});
	}

	private async handlePortConflict(): Promise<void> {
		this.logger.info('Attempting to identify conflicting process...');

		try {
			const { execSync } = await import('child_process');
			const result = execSync(`lsof -ti :${this.config.webPort}`, { encoding: 'utf8' }).trim();

			if (result) {
				this.logger.info('Process using port identified', { port: this.config.webPort, pid: result });
				this.logger.info('To kill it manually', { command: `kill -9 ${result}` });
			}
		} catch (error) {
			this.logger.info('Could not identify the conflicting process');
		}
	}

	private registerSignalHandlers(): void {
		this.logger.info('Registering signal handlers...');

		process.on('SIGTERM', () => {
			this.logger.info('Received SIGTERM signal');
			this.shutdown();
		});

		process.on('SIGINT', () => {
			this.logger.info('Received SIGINT signal (Ctrl+C)');
			this.shutdown();
		});

		process.on('uncaughtException', (error) => {
			this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
			this.logMemoryUsage();
			this.shutdown();
		});

		process.on('unhandledRejection', (reason, promise) => {
			this.logger.error('Unhandled rejection', {
				reason: reason instanceof Error ? reason.message : String(reason),
				stack: reason instanceof Error ? reason.stack : undefined
			});
			this.logMemoryUsage();
			this.shutdown();
		});
	}

	private startHealthMonitoring(): void {
		this.logger.info('Starting health monitoring...');

		// Monitor memory usage every 30 seconds
		setInterval(() => {
			this.logMemoryUsage();
		}, 30000);
	}

	private logMemoryUsage(): void {
		const usage = process.memoryUsage();
		const heapUsed = Math.round(usage.heapUsed / 1024 / 1024);
		const heapTotal = Math.round(usage.heapTotal / 1024 / 1024);
		const external = Math.round(usage.external / 1024 / 1024);

		this.logger.debug('Memory usage', { heapUsedMB: heapUsed, heapTotalMB: heapTotal, externalMB: external });

		// Warn if memory usage is high
		if (heapUsed > 500) {
			this.logger.warn('High memory usage detected', { heapUsedMB: heapUsed });
		}
	}

	async shutdown(): Promise<void> {
		this.logger.info('Shutting down AgentMux server...');

		try {
			// Save PTY session state before cleanup
			this.logger.info('Saving PTY session state...');
			try {
				const sessionBackend = await getSessionBackend();
				const persistence = getSessionStatePersistence();
				const savedCount = await persistence.saveState(sessionBackend);
				if (savedCount > 0) {
					this.logger.info('Saved PTY sessions for later restoration', { count: savedCount });
				}
				// Destroy PTY session backend
				await destroySessionBackend();
			} catch (error) {
				this.logger.warn('Failed to save PTY session state', { error: error instanceof Error ? error.message : String(error) });
			}

			// Clean up schedulers
			this.schedulerService.cleanup();
			this.messageSchedulerService.cleanup();
			// Stop activity monitoring
			this.activityMonitorService.stopPolling();

			// Stop team activity WebSocket service
			this.teamActivityWebSocketService.stop();

			// Stop teams.json file watcher
			this.teamsJsonWatcherService.stop();

			// Shutdown Slack integration
			this.logger.info('Shutting down Slack integration...');
			await shutdownSlack();

			// Destroy MCP server
			this.logger.info('Stopping MCP server...');
			destroyMCPServer();

			// Kill all tmux sessions
			const sessions = await this.tmuxService.listSessions();
			for (const session of sessions) {
				if (session.sessionName.startsWith('agentmux_')) {
					await this.tmuxService.killSession(session.sessionName);
				}
			}

			// Close HTTP server
			await new Promise<void>((resolve) => {
				this.httpServer.close(() => {
					this.logger.info('Server shut down gracefully');
					resolve();
				});
			});

			process.exit(0);
		} catch (error) {
			this.logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
			process.exit(1);
		}
	}

	getConfig(): StartupConfig {
		return { ...this.config };
	}
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	const server = new AgentMuxServer();
	const logger = LoggerService.getInstance().createComponentLogger('AgentMuxServer');
	server.start().catch((error) => {
		logger.error('Failed to start AgentMux server', { error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	});
}

export default AgentMuxServer;
