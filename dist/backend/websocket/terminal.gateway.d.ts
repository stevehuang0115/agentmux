import { Server as SocketIOServer, Socket } from 'socket.io';
import { TmuxService } from '../services/tmux.service.js';
export declare class TerminalGateway {
    private io;
    private tmuxService;
    private connectedClients;
    constructor(io: SocketIOServer, tmuxService: TmuxService);
    private setupEventHandlers;
    /**
     * Subscribe a client to a specific terminal session
     */
    subscribeToSession(sessionName: string, socket: Socket): void;
    /**
     * Unsubscribe a client from a terminal session
     */
    unsubscribeFromSession(sessionName: string, socket: Socket): void;
    /**
     * Send input to a terminal session
     */
    sendInput(sessionName: string, input: string, socket: Socket): Promise<void>;
    /**
     * Handle terminal resize events
     */
    private handleTerminalResize;
    /**
     * Handle client disconnection
     */
    private handleClientDisconnect;
    /**
     * Broadcast terminal output to all subscribers of a session
     */
    private broadcastOutput;
    /**
     * Broadcast session status changes
     */
    private broadcastSessionStatus;
    /**
     * Broadcast general messages to session subscribers
     */
    private broadcastMessage;
    /**
     * Send current terminal state to a new subscriber
     */
    private sendCurrentTerminalState;
    /**
     * Get statistics about connected clients
     */
    getConnectionStats(): {
        totalClients: number;
        sessionSubscriptions: Record<string, number>;
        totalSessions: number;
    };
    /**
     * Force disconnect all clients from a session (useful when session is killed)
     */
    disconnectSessionClients(sessionName: string): void;
    /**
     * Broadcast system-wide notifications
     */
    broadcastSystemNotification(message: string, type?: 'info' | 'warning' | 'error'): void;
}
//# sourceMappingURL=terminal.gateway.d.ts.map