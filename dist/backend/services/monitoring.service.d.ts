export interface SystemMetrics {
    timestamp: string;
    cpu: {
        usage: number;
        loadAverage: number[];
        cores: number;
    };
    memory: {
        used: number;
        total: number;
        free: number;
        percentage: number;
        heap: NodeJS.MemoryUsage;
    };
    disk: {
        usage: number;
        free: number;
        total: number;
    };
    network: {
        connections: number;
        bytesReceived: number;
        bytesSent: number;
    };
    process: {
        pid: number;
        uptime: number;
        memoryUsage: NodeJS.MemoryUsage;
        cpuUsage: NodeJS.CpuUsage;
    };
}
export interface PerformanceMetrics {
    timestamp: string;
    requests: {
        total: number;
        successful: number;
        failed: number;
        averageResponseTime: number;
    };
    agents: {
        active: number;
        total: number;
        averageMemoryUsage: number;
    };
    websockets: {
        connections: number;
        messagesPerSecond: number;
    };
    database: {
        operations: number;
        averageQueryTime: number;
        connectionPoolSize: number;
    };
}
export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    message?: string;
    details?: Record<string, any>;
}
export interface AlertCondition {
    id: string;
    name: string;
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals';
    threshold: number;
    duration: number;
    severity: 'info' | 'warning' | 'critical';
    enabled: boolean;
}
export declare class MonitoringService {
    private static instance;
    private config;
    private logger;
    private metricsHistory;
    private performanceHistory;
    private healthChecks;
    private alertConditions;
    private activeAlerts;
    private monitoringInterval;
    private healthCheckInterval;
    private requestCount;
    private successfulRequests;
    private failedRequests;
    private totalResponseTime;
    private lastRequestReset;
    private startTime;
    private lastCpuUsage;
    private constructor();
    static getInstance(): MonitoringService;
    private initializeAlertConditions;
    private startMonitoring;
    private collectMetrics;
    private collectSystemMetrics;
    private calculateCpuUsage;
    private collectPerformanceMetrics;
    private resetPerformanceCounters;
    private checkAlertConditions;
    private getMetricValue;
    private evaluateCondition;
    private triggerAlert;
    private runHealthChecks;
    private checkMemoryHealth;
    private checkCpuHealth;
    private checkDiskHealth;
    private checkProcessHealth;
    recordRequest(success: boolean, responseTime: number): void;
    getSystemMetrics(): SystemMetrics | null;
    getPerformanceMetrics(): PerformanceMetrics | null;
    getMetricsHistory(hours?: number): SystemMetrics[];
    getHealthStatus(): Map<string, HealthCheckResult>;
    getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy';
    getAlertConditions(): AlertCondition[];
    updateAlertCondition(id: string, updates: Partial<AlertCondition>): boolean;
    getActiveAlerts(): Array<{
        condition: AlertCondition;
        triggeredAt: Date;
    }>;
    shutdown(): void;
}
//# sourceMappingURL=monitoring.service.d.ts.map