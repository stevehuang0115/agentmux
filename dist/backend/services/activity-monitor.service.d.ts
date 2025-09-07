export declare class ActivityMonitorService {
    private static instance;
    private logger;
    private storageService;
    private tmuxService;
    private intervalId;
    private readonly POLLING_INTERVAL;
    private constructor();
    static getInstance(): ActivityMonitorService;
    startPolling(): void;
    stopPolling(): void;
    private performActivityCheck;
    private updateOrchestratorWithStatuses;
    isRunning(): boolean;
    getPollingInterval(): number;
}
//# sourceMappingURL=activity-monitor.service.d.ts.map