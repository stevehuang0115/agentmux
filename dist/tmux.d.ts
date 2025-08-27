export interface TmuxSession {
    name: string;
    windows: TmuxWindow[];
}
export interface TmuxWindow {
    index: number;
    name: string;
    active: boolean;
}
export interface TmuxMessage {
    session: string;
    window: number | string;
    pane?: number;
    message: string;
}
export declare class TmuxManager {
    private processes;
    listSessions(): Promise<TmuxSession[]>;
    listWindows(sessionName: string): Promise<TmuxWindow[]>;
    sendMessage(target: string, message: string): Promise<boolean>;
    capturePane(target: string, lines?: number): Promise<string>;
    createWindow(sessionName: string, windowName: string, workingDir?: string): Promise<boolean>;
    killWindow(sessionName: string, windowIndex: number | string): Promise<boolean>;
}
//# sourceMappingURL=tmux.d.ts.map