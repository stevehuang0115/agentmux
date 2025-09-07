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
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from './services/index.js';
import { ActivityMonitorService } from './services/activity-monitor.service.js';
import { ApiController } from './controllers/api.controller.js';
import { createApiRoutes } from './routes/api.routes.js';
import { TerminalGateway } from './websocket/terminal.gateway.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class AgentMuxServer {
    app;
    httpServer;
    io;
    config;
    storageService;
    tmuxService;
    schedulerService;
    messageSchedulerService;
    activityMonitorService;
    apiController;
    terminalGateway;
    constructor(config) {
        // Resolve ~ to actual home directory
        const resolveHomePath = (inputPath) => {
            if (inputPath.startsWith('~/')) {
                return path.join(os.homedir(), inputPath.slice(2));
            }
            if (inputPath === '~') {
                return os.homedir();
            }
            return inputPath;
        };
        const defaultAgentmuxHome = config?.agentmuxHome || process.env.AGENTMUX_HOME || '~/.agentmux';
        this.config = {
            webPort: config?.webPort || parseInt(process.env.WEB_PORT || '3000'),
            mcpPort: config?.mcpPort || parseInt(process.env.MCP_PORT || '3001'),
            agentmuxHome: resolveHomePath(defaultAgentmuxHome),
            defaultCheckInterval: config?.defaultCheckInterval || parseInt(process.env.DEFAULT_CHECK_INTERVAL || '30'),
            autoCommitInterval: config?.autoCommitInterval || parseInt(process.env.AUTO_COMMIT_INTERVAL || '30'),
        };
        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            cors: {
                origin: process.env.NODE_ENV === 'production' ? false : '*',
                methods: ['GET', 'POST']
            }
        });
        this.initializeServices();
        this.configureMiddleware();
        this.configureRoutes();
        this.configureWebSocket();
    }
    initializeServices() {
        this.storageService = new StorageService(this.config.agentmuxHome);
        this.tmuxService = new TmuxService();
        this.schedulerService = new SchedulerService(this.tmuxService, this.storageService);
        this.messageSchedulerService = new MessageSchedulerService(this.tmuxService, this.storageService);
        this.activityMonitorService = ActivityMonitorService.getInstance();
        this.apiController = new ApiController(this.storageService, this.tmuxService, this.schedulerService, this.messageSchedulerService);
        this.terminalGateway = new TerminalGateway(this.io, this.tmuxService);
    }
    configureMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                },
            },
        }));
        // CORS
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' ? false : '*',
            credentials: true
        }));
        // Logging
        this.app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        // Static files for frontend
        const frontendPath = path.join(__dirname, '../../frontend/dist');
        this.app.use(express.static(frontendPath));
    }
    configureRoutes() {
        // API routes
        this.app.use('/api', createApiRoutes(this.apiController));
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            });
        });
        // Serve frontend for all other routes (SPA)
        this.app.get('*', (req, res) => {
            const frontendPath = path.join(__dirname, '../../frontend/dist/index.html');
            res.sendFile(frontendPath);
        });
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({
                success: false,
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
            });
        });
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });
    }
    configureWebSocket() {
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
    async start() {
        try {
            // Initialize tmux server
            await this.tmuxService.initialize();
            // Start message scheduler
            await this.messageSchedulerService.start();
            // Start activity monitoring
            this.activityMonitorService.startPolling();
            // Start HTTP server
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.config.webPort, () => {
                    console.log(`🚀 AgentMux server started on port ${this.config.webPort}`);
                    console.log(`📊 Dashboard: http://localhost:${this.config.webPort}`);
                    console.log(`⚡ WebSocket: ws://localhost:${this.config.webPort}`);
                    console.log(`🏠 Home: ${this.config.agentmuxHome}`);
                    resolve();
                });
                this.httpServer.on('error', (error) => {
                    console.error('Server error:', error);
                    reject(error);
                });
            });
            // Register cleanup handlers
            process.on('SIGTERM', this.shutdown.bind(this));
            process.on('SIGINT', this.shutdown.bind(this));
            process.on('uncaughtException', (error) => {
                console.error('Uncaught exception:', error);
                this.shutdown();
            });
            process.on('unhandledRejection', (reason, promise) => {
                console.error('Unhandled rejection at:', promise, 'reason:', reason);
                this.shutdown();
            });
        }
        catch (error) {
            console.error('Failed to start server:', error);
            throw error;
        }
    }
    async shutdown() {
        console.log('\n🛑 Shutting down AgentMux server...');
        try {
            // Clean up schedulers
            this.schedulerService.cleanup();
            this.messageSchedulerService.cleanup();
            // Stop activity monitoring
            this.activityMonitorService.stopPolling();
            // Kill all tmux sessions
            const sessions = await this.tmuxService.listSessions();
            for (const session of sessions) {
                if (session.sessionName.startsWith('agentmux_')) {
                    await this.tmuxService.killSession(session.sessionName);
                }
            }
            // Close HTTP server
            await new Promise((resolve) => {
                this.httpServer.close(() => {
                    console.log('✅ Server shut down gracefully');
                    resolve();
                });
            });
            process.exit(0);
        }
        catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    getConfig() {
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
//# sourceMappingURL=index.js.map