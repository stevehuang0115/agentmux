import { Server as SocketIOServer, Socket } from 'socket.io';
import { TmuxService } from '../services/tmux.service.js';
import { TerminalOutput, WebSocketMessage } from '../types/index.js';

export class TerminalGateway {
  private io: SocketIOServer;
  private tmuxService: TmuxService;
  private connectedClients: Map<string, Set<string>> = new Map(); // sessionName -> Set<socketId>

  constructor(io: SocketIOServer, tmuxService: TmuxService) {
    this.io = io;
    this.tmuxService = tmuxService;
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);

      // Handle subscription to terminal sessions
      socket.on('subscribe_to_session', (sessionName: string) => {
        this.subscribeToSession(sessionName, socket);
      });

      // Handle unsubscription from terminal sessions
      socket.on('unsubscribe_from_session', (sessionName: string) => {
        this.unsubscribeFromSession(sessionName, socket);
      });

      // Handle sending input to terminal sessions
      socket.on('send_input', async (data: { sessionName: string; input: string }) => {
        await this.sendInput(data.sessionName, data.input, socket);
      });

      // Handle terminal resize events
      socket.on('terminal_resize', (data: { sessionName: string; cols: number; rows: number }) => {
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
      } as WebSocketMessage);
    });

    // Listen to tmux service events
    this.tmuxService.on('output', (output: TerminalOutput) => {
      this.broadcastOutput(output.sessionName, output);
    });

    this.tmuxService.on('session_killed', (data: { sessionName: string }) => {
      this.broadcastSessionStatus(data.sessionName, 'terminated');
    });

    this.tmuxService.on('message_sent', (data: { sessionName: string; message: string }) => {
      this.broadcastMessage(data.sessionName, 'input_sent', data);
    });
  }

  /**
   * Subscribe a client to a specific terminal session
   */
  subscribeToSession(sessionName: string, socket: Socket): void {
    // Add client to subscription list
    if (!this.connectedClients.has(sessionName)) {
      this.connectedClients.set(sessionName, new Set());
      
      // Enable output streaming for this session if it's the first subscriber
      this.tmuxService.enableOutputStreaming(sessionName);
      console.log(`Enabled output streaming for session ${sessionName}`);
    }
    
    this.connectedClients.get(sessionName)!.add(socket.id);

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
    } as WebSocketMessage);
  }

  /**
   * Unsubscribe a client from a terminal session
   */
  unsubscribeFromSession(sessionName: string, socket: Socket): void {
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
    } as WebSocketMessage);
  }

  /**
   * Send input to a terminal session
   */
  async sendInput(sessionName: string, input: string, socket: Socket): Promise<void> {
    try {
      // Verify session exists
      if (!await this.tmuxService.sessionExists(sessionName)) {
        socket.emit('error', {
          type: 'session_not_found',
          payload: { sessionName, error: 'Session does not exist' },
          timestamp: new Date().toISOString()
        } as WebSocketMessage);
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

    } catch (error) {
      console.error(`Error sending input to session ${sessionName}:`, error);
      
      socket.emit('error', {
        type: 'input_error',
        payload: {
          sessionName,
          error: error instanceof Error ? error.message : 'Failed to send input'
        },
        timestamp: new Date().toISOString()
      } as WebSocketMessage);
    }
  }

  /**
   * Handle terminal resize events
   */
  private handleTerminalResize(sessionName: string, cols: number, rows: number): void {
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
  private handleClientDisconnect(socket: Socket): void {
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
  private broadcastOutput(sessionName: string, output: TerminalOutput): void {
    const message: WebSocketMessage = {
      type: 'terminal_output',
      payload: output,
      timestamp: new Date().toISOString()
    };

    this.io.to(`terminal_${sessionName}`).emit('terminal_output', message);
  }

  /**
   * Broadcast session status changes
   */
  private broadcastSessionStatus(sessionName: string, status: string): void {
    const message: WebSocketMessage = {
      type: 'team_status',
      payload: { sessionName, status },
      timestamp: new Date().toISOString()
    };

    this.io.to(`terminal_${sessionName}`).emit('session_status', message);
  }

  /**
   * Broadcast general messages to session subscribers
   */
  private broadcastMessage(sessionName: string, type: string, payload: any): void {
    const message: WebSocketMessage = {
      type: type as any,
      payload,
      timestamp: new Date().toISOString()
    };

    this.io.to(`terminal_${sessionName}`).emit(type, message);
  }

  /**
   * Send current terminal state to a new subscriber
   */
  private async sendCurrentTerminalState(sessionName: string, socket: Socket): Promise<void> {
    try {
      // Check if session exists
      if (!await this.tmuxService.sessionExists(sessionName)) {
        socket.emit('session_not_found', {
          type: 'session_not_found',
          payload: { sessionName },
          timestamp: new Date().toISOString()
        } as WebSocketMessage);
        return;
      }

      // Capture current terminal content
      const output = await this.tmuxService.capturePane(sessionName, 100);
      
      const terminalState: TerminalOutput = {
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
      } as WebSocketMessage);

    } catch (error) {
      console.error(`Error getting terminal state for ${sessionName}:`, error);
      
      socket.emit('error', {
        type: 'terminal_state_error',
        payload: {
          sessionName,
          error: error instanceof Error ? error.message : 'Failed to get terminal state'
        },
        timestamp: new Date().toISOString()
      } as WebSocketMessage);
    }
  }

  /**
   * Get statistics about connected clients
   */
  getConnectionStats(): {
    totalClients: number;
    sessionSubscriptions: Record<string, number>;
    totalSessions: number;
  } {
    const sessionSubscriptions: Record<string, number> = {};
    
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
  disconnectSessionClients(sessionName: string): void {
    this.io.to(`terminal_${sessionName}`).disconnectSockets();
    this.connectedClients.delete(sessionName);
    
    console.log(`Disconnected all clients from session: ${sessionName}`);
  }

  /**
   * Broadcast system-wide notifications
   */
  broadcastSystemNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.io.emit('system_notification', {
      type: 'system_notification',
      payload: { message, notificationType: type },
      timestamp: new Date().toISOString()
    } as WebSocketMessage);
  }
}