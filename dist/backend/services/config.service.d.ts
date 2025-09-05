export interface AppConfig {
    server: {
        port: number;
        host: string;
        nodeEnv: 'development' | 'production' | 'test';
        corsOrigin: string[];
        trustProxy: boolean;
    };
    mcp: {
        port: number;
        enabled: boolean;
        maxConnections: number;
        timeoutMs: number;
    };
    storage: {
        dataPath: string;
        backupEnabled: boolean;
        backupInterval: number;
        maxBackups: number;
    };
    git: {
        autoCommitEnabled: boolean;
        autoCommitInterval: number;
        defaultBranch: string;
        pushToRemote: boolean;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
        format: 'json' | 'simple';
        enableFileLogging: boolean;
        logDir: string;
        maxFiles: number;
        maxSize: string;
    };
    monitoring: {
        metricsEnabled: boolean;
        healthCheckInterval: number;
        performanceTrackingEnabled: boolean;
        memoryThreshold: number;
        cpuThreshold: number;
    };
    security: {
        rateLimitEnabled: boolean;
        rateLimitWindow: number;
        rateLimitMax: number;
        enableHelmet: boolean;
        sessionSecret?: string;
    };
    websocket: {
        enabled: boolean;
        pingTimeout: number;
        pingInterval: number;
        maxConnections: number;
    };
    agents: {
        maxConcurrentAgents: number;
        defaultTimeout: number;
        maxMemoryPerAgent: number;
        contextRefreshInterval: number;
    };
}
export declare class ConfigService {
    private static instance;
    private config;
    private configPath;
    private constructor();
    static getInstance(): ConfigService;
    private resolveConfigPath;
    private getDefaultConfig;
    private loadConfig;
    private mergeConfigs;
    getConfig(): AppConfig;
    get<K extends keyof AppConfig>(section: K): AppConfig[K];
    updateConfig(updates: Partial<AppConfig>): Promise<void>;
    createDefaultConfigFile(): Promise<void>;
    validateConfig(): {
        isValid: boolean;
        errors: string[];
    };
    getEnvironmentInfo(): Record<string, any>;
    isDevelopment(): boolean;
    isProduction(): boolean;
    isTest(): boolean;
}
//# sourceMappingURL=config.service.d.ts.map