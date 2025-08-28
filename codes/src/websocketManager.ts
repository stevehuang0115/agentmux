import { Server, Socket } from 'socket.io';
import * as pty from 'node-pty';
import { TmuxManager } from './tmux';
import { AuthenticatedSocket } from './middleware/auth';

export interface TerminalSession {
  id: string;
  ptyProcess: pty.IPty;
  socket: Socket;
  userId: string;
  sessionName: string;
  windowName?: string;
}

export class WebSocketManager {
  private io: Server;
  private tmuxManager: TmuxManager;
  private terminals: Map<string, TerminalSession> = new Map();

  constructor(io: Server, tmuxManager: TmuxManager) {
    this.io = io;
    this.tmuxManager = tmuxManager;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`WebSocket client connected: ${socket.id} (User: ${socket.user?.username})`);

      // Terminal streaming
      socket.on('create-terminal', this.handleCreateTerminal.bind(this, socket));
      socket.on('terminal-input', this.handleTerminalInput.bind(this, socket));
      socket.on('resize-terminal', this.handleResizeTerminal.bind(this, socket));
      socket.on('kill-terminal', this.handleKillTerminal.bind(this, socket));

      // Real-time tmux capture
      socket.on('start-capture', this.handleStartCapture.bind(this, socket));
      socket.on('stop-capture', this.handleStopCapture.bind(this, socket));

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleCreateTerminal(socket: AuthenticatedSocket, data: {
    sessionName: string;
    windowName?: string;
    cols?: number;
    rows?: number;
  }, callback?: Function): Promise<void> {
    try {
      const { sessionName, windowName, cols = 80, rows = 24 } = data;
      const terminalId = `${socket.id}-${Date.now()}`;

      // Create a new pty process
      const ptyProcess = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd: process.cwd(),
        env: process.env
      });

      // Store terminal session
      const terminalSession: TerminalSession = {
        id: terminalId,
        ptyProcess,
        socket,
        userId: socket.userId || 'unknown',
        sessionName,
        windowName
      };

      this.terminals.set(terminalId, terminalSession);

      // Forward terminal output to socket
      ptyProcess.onData((data: string) => {
        socket.emit('terminal-output', {
          terminalId,
          data
        });
      });

      // Handle process exit
      ptyProcess.onExit((e) => {
        console.log(`Terminal ${terminalId} exited with code ${e.exitCode}, signal ${e.signal}`);
        socket.emit('terminal-exit', {
          terminalId,
          code: e.exitCode,
          signal: e.signal
        });
        this.terminals.delete(terminalId);
      });

      // Attach to tmux session if specified
      if (sessionName) {
        setTimeout(() => {
          ptyProcess.write(`tmux attach-session -t ${sessionName}\r`);
        }, 100);
      }

      callback?.({ success: true, terminalId });

    } catch (error) {
      console.error('Error creating terminal:', error);
      callback?.({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private handleTerminalInput(socket: AuthenticatedSocket, data: {
    terminalId: string;
    input: string;
  }): void {
    const terminal = this.terminals.get(data.terminalId);
    
    if (!terminal || terminal.socket.id !== socket.id) {
      socket.emit('error', { message: 'Terminal not found or access denied' });
      return;
    }

    terminal.ptyProcess.write(data.input);
  }

  private handleResizeTerminal(socket: AuthenticatedSocket, data: {
    terminalId: string;
    cols: number;
    rows: number;
  }): void {
    const terminal = this.terminals.get(data.terminalId);
    
    if (!terminal || terminal.socket.id !== socket.id) {
      socket.emit('error', { message: 'Terminal not found or access denied' });
      return;
    }

    terminal.ptyProcess.resize(data.cols, data.rows);
  }

  private handleKillTerminal(socket: AuthenticatedSocket, data: {
    terminalId: string;
  }): void {
    const terminal = this.terminals.get(data.terminalId);
    
    if (!terminal || terminal.socket.id !== socket.id) {
      socket.emit('error', { message: 'Terminal not found or access denied' });
      return;
    }

    terminal.ptyProcess.kill();
    this.terminals.delete(data.terminalId);
  }

  private captureIntervals: Map<string, NodeJS.Timeout> = new Map();

  private async handleStartCapture(socket: AuthenticatedSocket, data: {
    session: string;
    window: number | string;
    pane?: number;
    interval?: number;
  }): Promise<void> {
    const { session, window, pane, interval = 1000 } = data;
    const target = pane ? `${session}:${window}.${pane}` : `${session}:${window}`;
    const captureId = `${socket.id}-${target}`;

    // Stop existing capture if running
    this.handleStopCapture(socket, { target });

    const captureInterval = setInterval(async () => {
      try {
        const content = await this.tmuxManager.capturePane(target, 50);
        socket.emit('capture-update', {
          target,
          content,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`Capture error for ${target}:`, error);
        socket.emit('capture-error', {
          target,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, interval);

    this.captureIntervals.set(captureId, captureInterval);

    socket.emit('capture-started', { target });
  }

  private handleStopCapture(socket: AuthenticatedSocket, data: {
    target: string;
  }): void {
    const captureId = `${socket.id}-${data.target}`;
    const interval = this.captureIntervals.get(captureId);
    
    if (interval) {
      clearInterval(interval);
      this.captureIntervals.delete(captureId);
      socket.emit('capture-stopped', { target: data.target });
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket): void {
    console.log('WebSocket client disconnected:', socket.id);
    
    // Clean up terminals owned by this socket
    for (const [terminalId, terminal] of this.terminals.entries()) {
      if (terminal.socket.id === socket.id) {
        terminal.ptyProcess.kill();
        this.terminals.delete(terminalId);
      }
    }

    // Clean up capture intervals
    for (const [captureId, interval] of this.captureIntervals.entries()) {
      if (captureId.startsWith(socket.id)) {
        clearInterval(interval);
        this.captureIntervals.delete(captureId);
      }
    }
  }

  // Get terminal session info
  getTerminalInfo(terminalId: string): TerminalSession | undefined {
    return this.terminals.get(terminalId);
  }

  // Get all terminals for a user
  getUserTerminals(userId: string): TerminalSession[] {
    return Array.from(this.terminals.values()).filter(t => t.userId === userId);
  }

  // Broadcast to all clients
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // Send to specific user's sockets
  sendToUser(userId: string, event: string, data: any): void {
    this.io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
      if (socket.userId === userId) {
        socket.emit(event, data);
      }
    });
  }
}