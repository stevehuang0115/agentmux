import { Server } from 'socket.io';
import { FileWatcherService } from '../services/file-watcher.service.js';
export declare class FileWatcherGateway {
    private server;
    private logger;
    private fileWatcher;
    private clientProjects;
    private projectClients;
    constructor(server: Server, fileWatcher: FileWatcherService);
    private setupSocketHandlers;
    private handleConnection;
    private handleDisconnect;
    /**
     * Subscribe to file changes for a specific project
     */
    private handleSubscribeProject;
    /**
     * Unsubscribe from file changes for a specific project
     */
    private handleUnsubscribeProject;
    /**
     * Get file watcher statistics
     */
    private handleGetStats;
    /**
     * Get list of watched projects
     */
    private handleGetWatchedProjects;
    /**
     * Manually trigger file scan for a project
     */
    private handleTriggerScan;
    /**
     * Setup listeners for file watcher events
     */
    private setupFileWatcherListeners;
    /**
     * Broadcast message to all clients subscribed to a project
     */
    private broadcastToProject;
    /**
     * Broadcast stats update to all connected clients
     */
    broadcastStats(): void;
    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        totalClients: number;
        projectSubscriptions: number;
        activeProjects: number;
    };
}
//# sourceMappingURL=file-watcher.gateway.d.ts.map