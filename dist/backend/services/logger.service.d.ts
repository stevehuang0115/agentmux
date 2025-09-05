export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    stack?: string;
    requestId?: string;
    userId?: string;
    component?: string;
}
export interface LoggerOptions {
    component?: string;
    requestId?: string;
    userId?: string;
}
export declare class LoggerService {
    private static instance;
    private config;
    private logQueue;
    private flushTimer;
    private isShuttingDown;
    private readonly LOG_LEVELS;
    private constructor();
    static getInstance(): LoggerService;
    private initializeLogDirectory;
    private startLogFlusher;
    private setupProcessHandlers;
    private shouldLog;
    private formatLogEntry;
    private writeToFile;
    private rotateLogs;
    private log;
    private writeToConsole;
    private flushLogs;
    error(message: string, context?: Record<string, any>, options?: LoggerOptions): void;
    warn(message: string, context?: Record<string, any>, options?: LoggerOptions): void;
    info(message: string, context?: Record<string, any>, options?: LoggerOptions): void;
    debug(message: string, context?: Record<string, any>, options?: LoggerOptions): void;
    logHttpRequest(method: string, url: string, statusCode: number, duration: number, options?: LoggerOptions): void;
    logHttpError(method: string, url: string, statusCode: number, error: string, options?: LoggerOptions): void;
    logAgentAction(agentId: string, action: string, success: boolean, details?: Record<string, any>, options?: LoggerOptions): void;
    logSystemMetric(metric: string, value: number, unit: string, options?: LoggerOptions): void;
    logSecurityEvent(event: string, details: Record<string, any>, options?: LoggerOptions): void;
    logDatabaseOperation(operation: string, table: string, duration: number, success: boolean, options?: LoggerOptions): void;
    createComponentLogger(component: string): ComponentLogger;
    createRequestLogger(requestId: string, userId?: string): RequestLogger;
    getRecentLogs(level?: LogLevel, limit?: number): Promise<LogEntry[]>;
    shutdown(): void;
}
export declare class ComponentLogger {
    private logger;
    private component;
    constructor(logger: LoggerService, component: string);
    error(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'component'>): void;
    warn(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'component'>): void;
    info(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'component'>): void;
    debug(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'component'>): void;
}
export declare class RequestLogger {
    private logger;
    private requestId;
    private userId?;
    constructor(logger: LoggerService, requestId: string, userId?: string | undefined);
    error(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'requestId' | 'userId'>): void;
    warn(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'requestId' | 'userId'>): void;
    info(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'requestId' | 'userId'>): void;
    debug(message: string, context?: Record<string, any>, options?: Omit<LoggerOptions, 'requestId' | 'userId'>): void;
}
//# sourceMappingURL=logger.service.d.ts.map