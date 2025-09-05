interface ErrorEvent {
    id: string;
    timestamp: string;
    level: 'error' | 'warning' | 'critical';
    message: string;
    stack?: string;
    context: Record<string, any>;
    source: 'backend' | 'frontend' | 'mcp' | 'cli';
    userId?: string;
    sessionId?: string;
    component?: string;
    action?: string;
    metadata?: Record<string, any>;
}
interface ErrorStats {
    totalErrors: number;
    errorsByLevel: Record<string, number>;
    errorsBySource: Record<string, number>;
    errorsByComponent: Record<string, number>;
    topErrors: Array<{
        message: string;
        count: number;
        lastSeen: string;
    }>;
    recentErrors: ErrorEvent[];
}
export declare class ErrorTrackingService {
    private static instance;
    private errors;
    private logger;
    private config;
    private errorCounts;
    private maxStoredErrors;
    private errorRetentionHours;
    private constructor();
    static getInstance(): ErrorTrackingService;
    /**
     * Track an error event
     */
    trackError(error: Error | string, context?: {
        level?: 'error' | 'warning' | 'critical';
        source?: 'backend' | 'frontend' | 'mcp' | 'cli';
        userId?: string;
        sessionId?: string;
        component?: string;
        action?: string;
        metadata?: Record<string, any>;
    }): string;
    /**
     * Get error statistics
     */
    getErrorStats(): ErrorStats;
    /**
     * Get errors by criteria
     */
    getErrors(criteria?: {
        level?: string;
        source?: string;
        component?: string;
        userId?: string;
        sessionId?: string;
        since?: string;
        limit?: number;
    }): ErrorEvent[];
    /**
     * Get a specific error by ID
     */
    getError(errorId: string): ErrorEvent | null;
    /**
     * Clear errors (for maintenance or testing)
     */
    clearErrors(criteria?: {
        olderThan?: string;
        level?: string;
        source?: string;
    }): number;
    /**
     * Health check for error tracking service
     */
    getHealthStatus(): {
        status: 'healthy' | 'warning' | 'critical';
        details: {
            storedErrors: number;
            memoryUsage: string;
            recentCriticalErrors: number;
            oldestError?: string;
            newestError?: string;
        };
    };
    private generateErrorId;
    private trimStoredErrors;
    private updateErrorCounts;
    private logError;
    private handleCriticalError;
    private cleanupOldErrors;
}
export {};
//# sourceMappingURL=error-tracking.service.d.ts.map