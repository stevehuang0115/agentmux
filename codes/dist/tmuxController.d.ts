import * as pty from 'node-pty';
import { EventEmitter } from 'events';
export interface TmuxSession {
    name: string;
    windows: TmuxWindow[];
    created: Date;
    lastActivity: Date;
}
export interface TmuxWindow {
    index: number;
    name: string;
    active: boolean;
    panes: TmuxPane[];
}
export interface TmuxPane {
    index: number;
    active: boolean;
    width: number;
    height: number;
    command?: string;
}
export interface TmuxAttachOptions {
    sessionName: string;
    windowIndex?: number;
    paneIndex?: number;
    cols?: number;
    rows?: number;
}
export declare class TmuxController extends EventEmitter {
    private attachedSessions;
    private captureProcesses;
    constructor();
    attachToSession(options: TmuxAttachOptions): Promise<pty.IPty>;
    detachFromSession(sessionName: string, windowIndex?: number, paneIndex?: number): boolean;
    sendInput(sessionName: string, input: string, windowIndex?: number, paneIndex?: number): boolean;
    resizeSession(sessionName: string, cols: number, rows: number, windowIndex?: number, paneIndex?: number): boolean;
    getDetailedSessions(): Promise<TmuxSession[]>;
    private getDetailedWindows;
    private getWindowPanes;
    startPaneStream(sessionName: string, windowIndex: number, paneIndex?: number): EventEmitter;
    stopPaneStream(sessionName: string, windowIndex: number, paneIndex?: number): boolean;
    createSession(name: string, command?: string, workingDir?: string): Promise<boolean>;
    killSession(sessionName: string): Promise<boolean>;
    getAttachedSessions(): string[];
    cleanup(): void;
}
//# sourceMappingURL=tmuxController.d.ts.map