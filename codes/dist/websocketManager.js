"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const pty = __importStar(require("node-pty"));
class WebSocketManager {
    constructor(io, tmuxManager) {
        this.terminals = new Map();
        this.captureIntervals = new Map();
        this.io = io;
        this.tmuxManager = tmuxManager;
        // Increase max listeners to prevent warnings in tests
        this.io.setMaxListeners(50);
        this.setupSocketHandlers();
    }
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
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
    async handleCreateTerminal(socket, data, callback) {
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
            const terminalSession = {
                id: terminalId,
                ptyProcess,
                socket,
                userId: socket.userId || 'unknown',
                sessionName,
                windowName
            };
            this.terminals.set(terminalId, terminalSession);
            // Forward terminal output to socket
            ptyProcess.onData((data) => {
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
        }
        catch (error) {
            console.error('Error creating terminal:', error);
            callback?.({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    handleTerminalInput(socket, data) {
        const terminal = this.terminals.get(data.terminalId);
        if (!terminal || terminal.socket.id !== socket.id) {
            socket.emit('error', { message: 'Terminal not found or access denied' });
            return;
        }
        terminal.ptyProcess.write(data.input);
    }
    handleResizeTerminal(socket, data) {
        const terminal = this.terminals.get(data.terminalId);
        if (!terminal || terminal.socket.id !== socket.id) {
            socket.emit('error', { message: 'Terminal not found or access denied' });
            return;
        }
        terminal.ptyProcess.resize(data.cols, data.rows);
    }
    handleKillTerminal(socket, data) {
        const terminal = this.terminals.get(data.terminalId);
        if (!terminal || terminal.socket.id !== socket.id) {
            socket.emit('error', { message: 'Terminal not found or access denied' });
            return;
        }
        terminal.ptyProcess.kill();
        this.terminals.delete(data.terminalId);
    }
    async handleStartCapture(socket, data) {
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
            }
            catch (error) {
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
    handleStopCapture(socket, data) {
        const captureId = `${socket.id}-${data.target}`;
        const interval = this.captureIntervals.get(captureId);
        if (interval) {
            clearInterval(interval);
            this.captureIntervals.delete(captureId);
            socket.emit('capture-stopped', { target: data.target });
        }
    }
    handleDisconnect(socket) {
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
    getTerminalInfo(terminalId) {
        return this.terminals.get(terminalId);
    }
    // Get all terminals for a user
    getUserTerminals(userId) {
        return Array.from(this.terminals.values()).filter(t => t.userId === userId);
    }
    // Broadcast to all clients
    broadcast(event, data) {
        this.io.emit(event, data);
    }
    // Send to specific user's sockets
    sendToUser(userId, event, data) {
        this.io.sockets.sockets.forEach((socket) => {
            if (socket.userId === userId) {
                socket.emit(event, data);
            }
        });
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=websocketManager.js.map