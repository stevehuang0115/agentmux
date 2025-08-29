import { EventEmitter } from 'events';
import { FileStorage } from './FileStorage';
export interface PaneStatus {
    sessionName: string;
    windowIndex: number;
    paneIndex: number;
    byteCount: number;
    lastActive: Date;
    isActive: boolean;
}
export declare class ActivityPoller extends EventEmitter {
    private interval;
    private storage;
    private lastByteCounts;
    private isPolling;
    private pollInterval;
    constructor(storage: FileStorage);
    start(): void;
    stop(): void;
    isRunning(): boolean;
    setPollInterval(ms: number): void;
    private checkAllPanes;
    private checkTeamActivity;
    private checkPaneActivity;
    private getPaneByteCount;
    private capturePaneContent;
    private getSessionInfo;
    getCurrentStatus(): Promise<PaneStatus[]>;
    cleanup(): void;
}
//# sourceMappingURL=ActivityPoller.d.ts.map