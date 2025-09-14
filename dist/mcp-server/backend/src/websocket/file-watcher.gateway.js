import { LoggerService } from '../services/index.js';
export class FileWatcherGateway {
    server;
    logger;
    fileWatcher;
    clientProjects = new Map(); // clientId -> Set of projectIds
    projectClients = new Map(); // projectId -> Set of clientIds
    constructor(server, fileWatcher) {
        this.server = server;
        this.logger = LoggerService.getInstance();
        this.fileWatcher = fileWatcher;
        // Listen to file watcher events
        this.setupFileWatcherListeners();
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        this.server.on('connection', (socket) => {
            this.handleConnection(socket);
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
            socket.on('subscribe-project', (data) => {
                this.handleSubscribeProject(socket, data);
            });
            socket.on('unsubscribe-project', (data) => {
                this.handleUnsubscribeProject(socket, data);
            });
            socket.on('get-stats', () => {
                this.handleGetStats(socket);
            });
            socket.on('get-watched-projects', () => {
                this.handleGetWatchedProjects(socket);
            });
            socket.on('trigger-scan', (data) => {
                this.handleTriggerScan(socket, data);
            });
        });
    }
    handleConnection(client) {
        this.logger.info(`File Watcher client connected: ${client.id}`);
        this.clientProjects.set(client.id, new Set());
    }
    handleDisconnect(client) {
        this.logger.info(`File Watcher client disconnected: ${client.id}`);
        // Cleanup client subscriptions
        const subscribedProjects = this.clientProjects.get(client.id);
        if (subscribedProjects) {
            for (const projectId of subscribedProjects) {
                const projectClients = this.projectClients.get(projectId);
                if (projectClients) {
                    projectClients.delete(client.id);
                    if (projectClients.size === 0) {
                        this.projectClients.delete(projectId);
                    }
                }
            }
        }
        this.clientProjects.delete(client.id);
    }
    /**
     * Subscribe to file changes for a specific project
     */
    handleSubscribeProject(client, data) {
        const { projectId } = data;
        // Add client to project subscriptions
        const clientProjects = this.clientProjects.get(client.id) || new Set();
        clientProjects.add(projectId);
        this.clientProjects.set(client.id, clientProjects);
        // Add client to project's client list
        const projectClients = this.projectClients.get(projectId) || new Set();
        projectClients.add(client.id);
        this.projectClients.set(projectId, projectClients);
        this.logger.info(`Client ${client.id} subscribed to project ${projectId}`);
        // Send current watcher status
        client.emit('subscription-confirmed', {
            projectId,
            isWatching: this.fileWatcher.isWatching(projectId),
            stats: this.fileWatcher.getStats()
        });
    }
    /**
     * Unsubscribe from file changes for a specific project
     */
    handleUnsubscribeProject(client, data) {
        const { projectId } = data;
        // Remove client from project subscriptions
        const clientProjects = this.clientProjects.get(client.id);
        if (clientProjects) {
            clientProjects.delete(projectId);
        }
        // Remove client from project's client list
        const projectClients = this.projectClients.get(projectId);
        if (projectClients) {
            projectClients.delete(client.id);
            if (projectClients.size === 0) {
                this.projectClients.delete(projectId);
            }
        }
        this.logger.info(`Client ${client.id} unsubscribed from project ${projectId}`);
        client.emit('unsubscription-confirmed', { projectId });
    }
    /**
     * Get file watcher statistics
     */
    handleGetStats(client) {
        const stats = this.fileWatcher.getStats();
        client.emit('stats', stats);
    }
    /**
     * Get list of watched projects
     */
    handleGetWatchedProjects(client) {
        const watchedProjects = this.fileWatcher.getWatchedProjects();
        client.emit('watched-projects', watchedProjects);
    }
    /**
     * Manually trigger file scan for a project
     */
    async handleTriggerScan(client, data) {
        try {
            const { projectId, projectPath } = data;
            // Restart watcher for this project
            if (this.fileWatcher.isWatching(projectId)) {
                await this.fileWatcher.stopWatchingProject(projectId);
            }
            await this.fileWatcher.watchProject(projectId, projectPath);
            client.emit('scan-completed', { projectId, success: true });
            this.logger.info(`Manual scan triggered for project ${projectId}`);
        }
        catch (error) {
            client.emit('scan-error', {
                projectId: data.projectId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            this.logger.error('Manual scan failed:', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Setup listeners for file watcher events
     */
    setupFileWatcherListeners() {
        // Listen for file change events
        this.fileWatcher.on('fileChange', (event) => {
            this.broadcastToProject(event.projectId, 'file-change', event);
        });
        // Listen for context refresh events
        this.fileWatcher.on('contextRefresh', (data) => {
            this.broadcastToProject(data.projectId, 'context-refresh', data);
        });
        // Listen for task changes
        this.fileWatcher.on('tasksChanged', (data) => {
            this.broadcastToProject(data.projectId, 'tasks-changed', data);
        });
        // Listen for memory updates
        this.fileWatcher.on('memoryUpdated', (data) => {
            this.broadcastToProject(data.projectId, 'memory-updated', data);
        });
        // Listen for prompt changes
        this.fileWatcher.on('promptsChanged', (data) => {
            this.broadcastToProject(data.projectId, 'prompts-changed', data);
        });
        // Listen for general project changes
        this.fileWatcher.on('projectChanged', (data) => {
            this.broadcastToProject(data.projectId, 'project-changed', data);
        });
    }
    /**
     * Broadcast message to all clients subscribed to a project
     */
    broadcastToProject(projectId, event, data) {
        const projectClients = this.projectClients.get(projectId);
        if (!projectClients || projectClients.size === 0) {
            return;
        }
        for (const clientId of projectClients) {
            const socket = this.server.sockets.sockets.get(clientId);
            if (socket) {
                socket.emit(event, data);
            }
        }
        this.logger.debug(`Broadcasted ${event} to ${projectClients.size} clients for project ${projectId}`);
    }
    /**
     * Broadcast stats update to all connected clients
     */
    broadcastStats() {
        const stats = this.fileWatcher.getStats();
        this.server.emit('stats-update', stats);
    }
    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            totalClients: this.clientProjects.size,
            projectSubscriptions: Array.from(this.clientProjects.values())
                .reduce((sum, projects) => sum + projects.size, 0),
            activeProjects: this.projectClients.size
        };
    }
}
//# sourceMappingURL=file-watcher.gateway.js.map