#!/usr/bin/env node
import { StartupConfig } from './types/index.js';
export declare class AgentMuxServer {
    private app;
    private httpServer;
    private io;
    private config;
    private storageService;
    private tmuxService;
    private schedulerService;
    private messageSchedulerService;
    private activityMonitorService;
    private apiController;
    private terminalGateway;
    constructor(config?: Partial<StartupConfig>);
    private initializeServices;
    private configureMiddleware;
    private configureRoutes;
    private configureWebSocket;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getConfig(): StartupConfig;
}
export default AgentMuxServer;
//# sourceMappingURL=index.d.ts.map