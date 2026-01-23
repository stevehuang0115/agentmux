#!/usr/bin/env node

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

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
import { TerminalGateway } from './websocket/terminal.gateway.js';
import { StartupConfig } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AgentMuxServer {
	private app: express.Application;
	private httpServer: ReturnType<typeof createServer>;
	private io: SocketIOServer;
	private config: StartupConfig;

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
			webPort: config?.webPort || parseInt(process.env.WEB_PORT || '8787'),
			mcpPort: config?.mcpPort || parseInt(process.env.AGENTMUX_MCP_PORT || '8789'),
			agentmuxHome: resolveHomePath(defaultAgentmuxHome),
			defaultCheckInterval:
				config?.defaultCheckInterval ||
				parseInt(process.env.DEFAULT_CHECK_INTERVAL || '30'),
			autoCommitInterval:
				config?.autoCommitInterval || parseInt(process.env.AUTO_COMMIT_INTERVAL || '30'),
		};

		this.app = express();
		this.httpServer = createServer(this.app);
		this.io = new SocketIOServer(this.httpServer, {
			cors: {
				origin: process.env.NODE_ENV === 'production' ? false : '*',
				methods: ['GET', 'POST'],
			},
		});

		this.initializeServices();
		this.configureMiddleware();
		this.configureRoutes();
		this.configureWebSocket();
	}

	private initializeServices(): void {
		this.storageService = StorageService.getInstance(this.config.agentmuxHome);
		this.tmuxService = new TmuxService();
		this.schedulerService = new SchedulerService(this.tmuxService, this.storageService);
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
		// When compiled, __dirname is dist/backend, so we need to go up to project root
		const projectRoot = path.resolve(__dirname, '../../../..');
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
				console.error('Error:', err);
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
			console.log(`Client connected: ${socket.id}`);

			socket.on('disconnect', () => {
				console.log(`Client disconnected: ${socket.id}`);
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
			console.log('🚀 Starting AgentMux server...');
			console.log(`📍 Process ID: ${process.pid}`);
			console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
			console.log(`🎯 Target port: ${this.config.webPort}`);

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
			console.log('🔌 Initializing PTY session backend...');
			const sessionBackend = await getSessionBackend();
			const persistence = getSessionStatePersistence();
			const restoredCount = await persistence.restoreState(sessionBackend);
			if (restoredCount > 0) {
				console.log(`📂 Restored ${restoredCount} PTY session(s) from saved state`);
			}

			// Start message scheduler
			console.log('📅 Starting message scheduler...');
			await this.messageSchedulerService.start();

			// Start activity monitoring
			console.log('📊 Starting activity monitoring...');
			this.activityMonitorService.startPolling();

			// Start team activity WebSocket service
			console.log('🌐 Starting team activity WebSocket service...');
			this.teamActivityWebSocketService.start();

			// Start teams.json file watcher for real-time updates
			console.log('👁️ Starting teams.json file watcher...');
			this.teamsJsonWatcherService.start();
			console.log('📁 Teams.json file watcher started for real-time updates');

			// Initialize MCP server (integrated into backend)
			console.log('🔌 Initializing MCP server...');
			await initializeMCPServer();
			console.log('✅ MCP server integrated at /mcp endpoint');

			// Start HTTP server with enhanced error handling
			await this.startHttpServer();

			// Register cleanup handlers
			this.registerSignalHandlers();

			// Start health monitoring
			this.startHealthMonitoring();

		} catch (error) {
			console.error('❌ Failed to start server:', error);
			if (error instanceof Error && error.message.includes('EADDRINUSE')) {
				console.error(`🚨 Port ${this.config.webPort} is already in use!`);
				console.error('💡 Try killing existing processes or use a different port');
				await this.handlePortConflict();
			}
			throw error;
		}
	}

	private async checkPortAvailability(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const { createServer } = await import('net');
			const testServer = createServer();

			testServer.listen(this.config.webPort, () => {
				testServer.close(() => {
					console.log(`✅ Port ${this.config.webPort} is available`);
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
				console.log(`🚀 AgentMux server started on port ${this.config.webPort} (${duration}ms)`);
				console.log(`📊 Dashboard: http://localhost:${this.config.webPort}`);
				console.log(`🔌 MCP: http://localhost:${this.config.webPort}/mcp`);
				console.log(`⚡ WebSocket: ws://localhost:${this.config.webPort}`);
				console.log(`🏠 Home: ${this.config.agentmuxHome}`);
				console.log('');
				console.log('To configure Claude Code:');
				console.log(`claude mcp add --transport http agentmux http://localhost:${this.config.webPort}/mcp`);
				console.log('');
				resolve();
			});

			this.httpServer.on('error', (error: any) => {
				console.error('🚨 HTTP Server error:', error);

				if (error.code === 'EADDRINUSE') {
					console.error(`❌ Port ${this.config.webPort} is already in use by another process`);
					console.error(`💡 Suggestion: Kill the existing process or change the port`);
				} else if (error.code === 'EACCES') {
					console.error(`❌ Permission denied for port ${this.config.webPort}`);
					console.error(`💡 Suggestion: Try a port above 1024 or run with appropriate permissions`);
				}

				reject(error);
			});
		});
	}

	private async handlePortConflict(): Promise<void> {
		console.log('🔍 Attempting to identify conflicting process...');

		try {
			const { execSync } = await import('child_process');
			const result = execSync(`lsof -ti :${this.config.webPort}`, { encoding: 'utf8' }).trim();

			if (result) {
				console.log(`📍 Process using port ${this.config.webPort}: PID ${result}`);
				console.log(`💡 To kill it manually: kill -9 ${result}`);
			}
		} catch (error) {
			console.log('ℹ️ Could not identify the conflicting process');
		}
	}

	private registerSignalHandlers(): void {
		console.log('🛡️ Registering signal handlers...');

		process.on('SIGTERM', () => {
			console.log('📡 Received SIGTERM signal');
			this.shutdown();
		});

		process.on('SIGINT', () => {
			console.log('📡 Received SIGINT signal (Ctrl+C)');
			this.shutdown();
		});

		process.on('uncaughtException', (error) => {
			console.error('🚨 Uncaught exception:', error);
			console.error('📍 Stack trace:', error.stack);
			this.logMemoryUsage();
			this.shutdown();
		});

		process.on('unhandledRejection', (reason, promise) => {
			console.error('🚨 Unhandled rejection at:', promise, 'reason:', reason);
			this.logMemoryUsage();
			this.shutdown();
		});
	}

	private startHealthMonitoring(): void {
		console.log('💓 Starting health monitoring...');

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

		console.log(`💾 Memory - Heap: ${heapUsed}/${heapTotal}MB, External: ${external}MB`);

		// Warn if memory usage is high
		if (heapUsed > 500) {
			console.warn(`⚠️ High memory usage detected: ${heapUsed}MB`);
		}
	}

	async shutdown(): Promise<void> {
		console.log('\n🛑 Shutting down AgentMux server...');

		try {
			// Save PTY session state before cleanup
			console.log('💾 Saving PTY session state...');
			try {
				const sessionBackend = await getSessionBackend();
				const persistence = getSessionStatePersistence();
				const savedCount = await persistence.saveState(sessionBackend);
				if (savedCount > 0) {
					console.log(`✅ Saved ${savedCount} PTY session(s) for later restoration`);
				}
				// Destroy PTY session backend
				await destroySessionBackend();
			} catch (error) {
				console.error('⚠️ Failed to save PTY session state:', error);
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

			// Destroy MCP server
			console.log('🔌 Stopping MCP server...');
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
					console.log('✅ Server shut down gracefully');
					resolve();
				});
			});

			process.exit(0);
		} catch (error) {
			console.error('Error during shutdown:', error);
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
	server.start().catch((error) => {
		console.error('Failed to start AgentMux server:', error);
		process.exit(1);
	});
}

export default AgentMuxServer;
