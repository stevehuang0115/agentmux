export class TerminalGateway {
    io;
    tmuxService;
    connectedClients = new Map(); // sessionName -> Set<socketId>
    constructor(io, tmuxService) {
        this.io = io;
        this.tmuxService = tmuxService;
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`WebSocket client connected: ${socket.id}`);
            // Handle subscription to terminal sessions
            socket.on('subscribe_to_session', (sessionName) => {
                this.subscribeToSession(sessionName, socket);
            });
            // Handle unsubscription from terminal sessions
            socket.on('unsubscribe_from_session', (sessionName) => {
                this.unsubscribeFromSession(sessionName, socket);
            });
            // Handle sending input to terminal sessions
            socket.on('send_input', async (data) => {
                await this.sendInput(data.sessionName, data.input, socket);
            });
            // Handle terminal resize events
            socket.on('terminal_resize', (data) => {
                this.handleTerminalResize(data.sessionName, data.cols, data.rows);
            });
            // Handle client disconnection
            socket.on('disconnect', () => {
                this.handleClientDisconnect(socket);
            });
            // Send initial connection confirmation
            socket.emit('connected', {
                type: 'connection_established',
                payload: { socketId: socket.id },
                timestamp: new Date().toISOString()
            });
        });
        // Listen to tmux service events
        this.tmuxService.on('output', (output) => {
            this.broadcastOutput(output.sessionName, output);
        });
        this.tmuxService.on('session_killed', (data) => {
            this.broadcastSessionStatus(data.sessionName, 'terminated');
        });
        this.tmuxService.on('message_sent', (data) => {
            this.broadcastMessage(data.sessionName, 'input_sent', data);
        });
    }
    /**
     * Subscribe a client to a specific terminal session
     */
    subscribeToSession(sessionName, socket) {
        // Add client to subscription list
        if (!this.connectedClients.has(sessionName)) {
            this.connectedClients.set(sessionName, new Set());
            // Enable output streaming for this session if it's the first subscriber
            this.tmuxService.enableOutputStreaming(sessionName);
            console.log(`Enabled output streaming for session ${sessionName}`);
        }
        this.connectedClients.get(sessionName).add(socket.id);
        // Join socket.io room for this session
        socket.join(`terminal_${sessionName}`);
        console.log(`Client ${socket.id} subscribed to session ${sessionName}`);
        // Send current terminal state to new subscriber
        this.sendCurrentTerminalState(sessionName, socket);
        // Confirm subscription
        socket.emit('subscription_confirmed', {
            type: 'subscription_confirmed',
            payload: { sessionName },
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Unsubscribe a client from a terminal session
     */
    unsubscribeFromSession(sessionName, socket) {
        const clients = this.connectedClients.get(sessionName);
        if (clients) {
            clients.delete(socket.id);
            // Clean up empty session subscriptions
            if (clients.size === 0) {
                this.connectedClients.delete(sessionName);
            }
        }
        // Leave socket.io room
        socket.leave(`terminal_${sessionName}`);
        console.log(`Client ${socket.id} unsubscribed from session ${sessionName}`);
        // Confirm unsubscription
        socket.emit('unsubscription_confirmed', {
            type: 'unsubscription_confirmed',
            payload: { sessionName },
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Send input to a terminal session
     */
    async sendInput(sessionName, input, socket) {
        try {
            // Verify session exists
            if (!await this.tmuxService.sessionExists(sessionName)) {
                socket.emit('error', {
                    type: 'session_not_found',
                    payload: { sessionName, error: 'Session does not exist' },
                    timestamp: new Date().toISOString()
                });
                return;
            }
            // Send input to tmux session
            await this.tmuxService.sendMessage(sessionName, input);
            // Broadcast input confirmation to all subscribers
            this.broadcastMessage(sessionName, 'input_received', {
                sessionName,
                input,
                fromClient: socket.id
            });
        }
        catch (error) {
            console.error(`Error sending input to session ${sessionName}:`, error);
            socket.emit('error', {
                type: 'input_error',
                payload: {
                    sessionName,
                    error: error instanceof Error ? error.message : 'Failed to send input'
                },
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Handle terminal resize events
     */
    handleTerminalResize(sessionName, cols, rows) {
        // Note: tmux handles terminal resizing automatically, but we can log it
        console.log(`Terminal resize for session ${sessionName}: ${cols}x${rows}`);
        // Broadcast resize event to other clients viewing the same session
        this.broadcastMessage(sessionName, 'terminal_resized', {
            sessionName,
            cols,
            rows
        });
    }
    /**
     * Handle client disconnection
     */
    handleClientDisconnect(socket) {
        console.log(`Client disconnected: ${socket.id}`);
        // Remove client from all session subscriptions
        for (const [sessionName, clients] of this.connectedClients.entries()) {
            if (clients.has(socket.id)) {
                clients.delete(socket.id);
                // Clean up empty subscriptions
                if (clients.size === 0) {
                    this.connectedClients.delete(sessionName);
                }
            }
        }
    }
    /**
     * Broadcast terminal output to all subscribers of a session
     */
    broadcastOutput(sessionName, output) {
        const message = {
            type: 'terminal_output',
            payload: output,
            timestamp: new Date().toISOString()
        };
        this.io.to(`terminal_${sessionName}`).emit('terminal_output', message);
    }
    /**
     * Broadcast session status changes
     */
    broadcastSessionStatus(sessionName, status) {
        const message = {
            type: 'team_status',
            payload: { sessionName, status },
            timestamp: new Date().toISOString()
        };
        this.io.to(`terminal_${sessionName}`).emit('session_status', message);
    }
    /**
     * Broadcast general messages to session subscribers
     */
    broadcastMessage(sessionName, type, payload) {
        const message = {
            type: type,
            payload,
            timestamp: new Date().toISOString()
        };
        this.io.to(`terminal_${sessionName}`).emit(type, message);
    }
    /**
     * Send current terminal state to a new subscriber
     */
    async sendCurrentTerminalState(sessionName, socket) {
        try {
            // Check if session exists
            if (!await this.tmuxService.sessionExists(sessionName)) {
                socket.emit('session_not_found', {
                    type: 'session_not_found',
                    payload: { sessionName },
                    timestamp: new Date().toISOString()
                });
                return;
            }
            // Capture current terminal content
            const output = await this.tmuxService.capturePane(sessionName, 100);
            const terminalState = {
                sessionName,
                content: output,
                timestamp: new Date().toISOString(),
                type: 'stdout'
            };
            // Send initial terminal state
            socket.emit('initial_terminal_state', {
                type: 'initial_terminal_state',
                payload: terminalState,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error(`Error getting terminal state for ${sessionName}:`, error);
            socket.emit('error', {
                type: 'terminal_state_error',
                payload: {
                    sessionName,
                    error: error instanceof Error ? error.message : 'Failed to get terminal state'
                },
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Get statistics about connected clients
     */
    getConnectionStats() {
        const sessionSubscriptions = {};
        for (const [sessionName, clients] of this.connectedClients.entries()) {
            sessionSubscriptions[sessionName] = clients.size;
        }
        return {
            totalClients: this.io.sockets.sockets.size,
            sessionSubscriptions,
            totalSessions: this.connectedClients.size
        };
    }
    /**
     * Force disconnect all clients from a session (useful when session is killed)
     */
    disconnectSessionClients(sessionName) {
        this.io.to(`terminal_${sessionName}`).disconnectSockets();
        this.connectedClients.delete(sessionName);
        console.log(`Disconnected all clients from session: ${sessionName}`);
    }
    /**
     * Broadcast system-wide notifications
     */
    broadcastSystemNotification(message, type = 'info') {
        this.io.emit('system_notification', {
            type: 'system_notification',
            payload: { message, notificationType: type },
            timestamp: new Date().toISOString()
        });
    }
}
//# sourceMappingURL=terminal.gateway.js.map