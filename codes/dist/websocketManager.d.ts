import { Server, Socket } from 'socket.io';
import * as pty from 'node-pty';
import { TmuxManager } from './tmux';
export interface TerminalSession {
    id: string;
    ptyProcess: pty.IPty;
    socket: Socket;
    userId: string;
    sessionName: string;
    windowName?: string;
}
export declare class WebSocketManager {
    private io;
    private tmuxManager;
    private terminals;
    constructor(io: Server, tmuxManager: TmuxManager);
    private setupSocketHandlers;
    private handleCreateTerminal;
    private handleTerminalInput;
    private handleResizeTerminal;
    private handleKillTerminal;
    private captureIntervals;
    private handleStartCapture;
    private handleStopCapture;
    private handleDisconnect;
    getTerminalInfo(terminalId: string): TerminalSession | undefined;
    getUserTerminals(userId: string): TerminalSession[];
    broadcast(event: string, data: any): void;
    sendToUser(userId: string, event: string, data: any): void;
}
//# sourceMappingURL=websocketManager.d.ts.map