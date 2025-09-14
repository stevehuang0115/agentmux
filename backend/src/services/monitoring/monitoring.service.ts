import * as os from 'os';
import * as process from 'process';
import { ConfigService } from '../core/config.service.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

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
  duration: number; // seconds
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private config: ConfigService;
  private logger: ComponentLogger;
  
  private metricsHistory: SystemMetrics[] = [];
  private performanceHistory: PerformanceMetrics[] = [];
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private alertConditions: AlertCondition[] = [];
  private activeAlerts: Map<string, Date> = new Map();
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  private requestCount = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private totalResponseTime = 0;
  private lastRequestReset = Date.now();

  private startTime = Date.now();
  private lastCpuUsage: NodeJS.CpuUsage | null = null;

  private constructor() {
    this.config = ConfigService.getInstance();
    this.logger = LoggerService.getInstance().createComponentLogger('Monitoring');
    this.initializeAlertConditions();
    this.startMonitoring();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeAlertConditions(): void {
    const memoryThreshold = this.config.get('monitoring').memoryThreshold;
    const cpuThreshold = this.config.get('monitoring').cpuThreshold;

    this.alertConditions = [
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        metric: 'memory.percentage',
        operator: 'greater_than',
        threshold: memoryThreshold,
        duration: 60,
        severity: 'warning',
        enabled: true
      },
      {
        id: 'critical-memory-usage',
        name: 'Critical Memory Usage',
        metric: 'memory.percentage',
        operator: 'greater_than',
        threshold: memoryThreshold * 1.2,
        duration: 30,
        severity: 'critical',
        enabled: true
      },
      {
        id: 'high-cpu-usage',
        name: 'High CPU Usage',
        metric: 'cpu.usage',
        operator: 'greater_than',
        threshold: cpuThreshold,
        duration: 120,
        severity: 'warning',
        enabled: true
      },
      {
        id: 'disk-space-low',
        name: 'Low Disk Space',
        metric: 'disk.usage',
        operator: 'greater_than',
        threshold: 85,
        duration: 300,
        severity: 'warning',
        enabled: true
      }
    ];
  }

  private startMonitoring(): void {
    const monitoringConfig = this.config.get('monitoring');
    
    if (monitoringConfig.metricsEnabled) {
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, 30000); // Collect metrics every 30 seconds

      this.logger.info('Metrics collection started');
    }

    if (monitoringConfig.healthCheckInterval > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.runHealthChecks();
      }, monitoringConfig.healthCheckInterval);

      this.logger.info('Health checks started');
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const performanceMetrics = this.collectPerformanceMetrics();

      this.metricsHistory.push(systemMetrics);
      this.performanceHistory.push(performanceMetrics);

      // Keep only last 1000 entries
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }
      if (this.performanceHistory.length > 1000) {
        this.performanceHistory = this.performanceHistory.slice(-1000);
      }

      // Check alert conditions
      this.checkAlertConditions(systemMetrics);

      // Log metrics
      const mainLogger = LoggerService.getInstance();
      mainLogger.logSystemMetric('cpu_usage', systemMetrics.cpu.usage, '%');
      mainLogger.logSystemMetric('memory_usage', systemMetrics.memory.percentage, '%');
      mainLogger.logSystemMetric('disk_usage', systemMetrics.disk.usage, '%');

    } catch (error) {
      this.logger.error('Failed to collect metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
    this.lastCpuUsage = process.cpuUsage();
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        used: usedMem,
        total: totalMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100,
        heap: process.memoryUsage()
      },
      disk: {
        usage: 0, // Would need additional library for cross-platform disk usage
        free: 0,
        total: 0
      },
      network: {
        connections: 0, // Would need additional monitoring
        bytesReceived: 0,
        bytesSent: 0
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: cpuUsage
      }
    };
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    const totalUsage = cpuUsage.user + cpuUsage.system;
    const totalTime = 1000000; // 1 second in microseconds
    return (totalUsage / totalTime) * 100;
  }

  private collectPerformanceMetrics(): PerformanceMetrics {
    const now = Date.now();
    const timeSinceReset = (now - this.lastRequestReset) / 1000;
    
    const avgResponseTime = this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0;

    const metrics: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        failed: this.failedRequests,
        averageResponseTime: avgResponseTime
      },
      agents: {
        active: 0, // Would be populated by agent tracking
        total: 0,
        averageMemoryUsage: 0
      },
      websockets: {
        connections: 0, // Would be populated by WebSocket tracking
        messagesPerSecond: 0
      },
      database: {
        operations: 0, // Would be populated by database monitoring
        averageQueryTime: 0,
        connectionPoolSize: 0
      }
    };

    // Reset counters every hour
    if (timeSinceReset > 3600) {
      this.resetPerformanceCounters();
    }

    return metrics;
  }

  private resetPerformanceCounters(): void {
    this.requestCount = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalResponseTime = 0;
    this.lastRequestReset = Date.now();
  }

  private checkAlertConditions(metrics: SystemMetrics): void {
    for (const condition of this.alertConditions) {
      if (!condition.enabled) continue;

      const value = this.getMetricValue(metrics, condition.metric);
      if (value === undefined) continue;

      const shouldAlert = this.evaluateCondition(value, condition.operator, condition.threshold);
      const alertKey = `${condition.id}_${condition.metric}`;

      if (shouldAlert) {
        if (!this.activeAlerts.has(alertKey)) {
          this.activeAlerts.set(alertKey, new Date());
          
          // Check if alert has persisted for required duration
          setTimeout(() => {
            if (this.activeAlerts.has(alertKey)) {
              this.triggerAlert(condition, value);
            }
          }, condition.duration * 1000);
        }
      } else {
        // Clear alert if condition is no longer met
        if (this.activeAlerts.has(alertKey)) {
          this.activeAlerts.delete(alertKey);
          this.logger.info('Alert condition cleared', {
            condition: condition.name,
            metric: condition.metric,
            value
          });
        }
      }
    }
  }

  private getMetricValue(metrics: SystemMetrics, metricPath: string): number | undefined {
    const paths = metricPath.split('.');
    let value: any = metrics;
    
    for (const path of paths) {
      if (value && typeof value === 'object' && path in value) {
        value = value[path];
      } else {
        return undefined;
      }
    }
    
    return typeof value === 'number' ? value : undefined;
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }

  private triggerAlert(condition: AlertCondition, value: number): void {
    const alertMessage = `${condition.name}: ${condition.metric} is ${value} (threshold: ${condition.threshold})`;
    
    switch (condition.severity) {
      case 'critical':
        this.logger.error(alertMessage, {
          alertId: condition.id,
          metric: condition.metric,
          value,
          threshold: condition.threshold,
          severity: condition.severity
        });
        break;
      case 'warning':
        this.logger.warn(alertMessage, {
          alertId: condition.id,
          metric: condition.metric,
          value,
          threshold: condition.threshold,
          severity: condition.severity
        });
        break;
      default:
        this.logger.info(alertMessage, {
          alertId: condition.id,
          metric: condition.metric,
          value,
          threshold: condition.threshold,
          severity: condition.severity
        });
    }
  }

  private async runHealthChecks(): Promise<void> {
    const healthChecks = [
      this.checkMemoryHealth(),
      this.checkCpuHealth(),
      this.checkDiskHealth(),
      this.checkProcessHealth()
    ];

    const results = await Promise.allSettled(healthChecks);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.healthChecks.set(result.value.service, result.value);
      }
    }
  }

  private async checkMemoryHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    const memoryUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const usedPercent = (memoryUsage.heapUsed / totalMem) * 100;
    
    const memoryThreshold = this.config.get('monitoring').memoryThreshold;
    
    return {
      service: 'memory',
      status: usedPercent > memoryThreshold * 1.2 ? 'unhealthy' : 
              usedPercent > memoryThreshold ? 'degraded' : 'healthy',
      responseTime: Date.now() - start,
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        usedPercent: Math.round(usedPercent * 100) / 100
      }
    };
  }

  private async checkCpuHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const avgLoad = loadAvg[0] / cpuCount * 100;
    
    const cpuThreshold = this.config.get('monitoring').cpuThreshold;
    
    return {
      service: 'cpu',
      status: avgLoad > cpuThreshold * 1.2 ? 'unhealthy' : 
              avgLoad > cpuThreshold ? 'degraded' : 'healthy',
      responseTime: Date.now() - start,
      details: {
        loadAverage: loadAvg,
        cores: cpuCount,
        averageLoadPercent: Math.round(avgLoad * 100) / 100
      }
    };
  }

  private async checkDiskHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    
    // Basic disk health check (would need fs-extra or similar for detailed disk info)
    return {
      service: 'disk',
      status: 'healthy',
      responseTime: Date.now() - start,
      details: {
        message: 'Disk health monitoring requires additional implementation'
      }
    };
  }

  private async checkProcessHealth(): Promise<HealthCheckResult> {
    const start = Date.now();
    const uptime = process.uptime();
    
    return {
      service: 'process',
      status: 'healthy',
      responseTime: Date.now() - start,
      details: {
        pid: process.pid,
        uptime: Math.round(uptime),
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  // Public API methods
  public recordRequest(success: boolean, responseTime: number): void {
    this.requestCount++;
    this.totalResponseTime += responseTime;
    
    if (success) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }
  }

  public getSystemMetrics(): SystemMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  public getPerformanceMetrics(): PerformanceMetrics | null {
    return this.performanceHistory[this.performanceHistory.length - 1] || null;
  }

  public getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => new Date(m.timestamp).getTime() > cutoff);
  }

  public getHealthStatus(): Map<string, HealthCheckResult> {
    return new Map(this.healthChecks);
  }

  public getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const healthValues = Array.from(this.healthChecks.values());
    
    if (healthValues.some(h => h.status === 'unhealthy')) {
      return 'unhealthy';
    }
    
    if (healthValues.some(h => h.status === 'degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  public getAlertConditions(): AlertCondition[] {
    return [...this.alertConditions];
  }

  public updateAlertCondition(id: string, updates: Partial<AlertCondition>): boolean {
    const index = this.alertConditions.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.alertConditions[index] = { ...this.alertConditions[index], ...updates };
    return true;
  }

  public getActiveAlerts(): Array<{ condition: AlertCondition; triggeredAt: Date }> {
    const alerts = [];
    
    for (const [alertKey, triggeredAt] of this.activeAlerts.entries()) {
      const [conditionId] = alertKey.split('_');
      const condition = this.alertConditions.find(c => c.id === conditionId);
      
      if (condition) {
        alerts.push({ condition, triggeredAt });
      }
    }
    
    return alerts;
  }

  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.logger.info('Monitoring service stopped');
  }
}