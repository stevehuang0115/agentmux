import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { MonitoringService } from '../../services/monitoring.service.js';
import { ConfigService } from '../../services/config.service.js';
import { LoggerService } from '../../services/logger.service.js';
import { ApiResponse } from '../../types/index.js';

export async function getSystemHealth(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const monitoring = MonitoringService.getInstance();
    const config = ConfigService.getInstance();
    const healthStatus = monitoring.getHealthStatus();
    const overallHealth = monitoring.getOverallHealth();
    const systemMetrics = monitoring.getSystemMetrics();
    const performanceMetrics = monitoring.getPerformanceMetrics();
    const environmentInfo = config.getEnvironmentInfo();
    res.json({ success: true, data: { status: overallHealth, timestamp: new Date().toISOString(), services: Object.fromEntries(healthStatus), metrics: { system: systemMetrics, performance: performanceMetrics }, environment: environmentInfo } } as ApiResponse);
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({ success: false, error: 'Failed to get system health' } as ApiResponse);
  }
}

export async function getSystemMetrics(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { hours } = req.query as any;
    const monitoring = MonitoringService.getInstance();
    const hoursToFetch = hours ? parseInt(hours) : 1;
    const metricsHistory = monitoring.getMetricsHistory(hoursToFetch);
    const currentMetrics = monitoring.getSystemMetrics();
    const performanceMetrics = monitoring.getPerformanceMetrics();
    res.json({ success: true, data: { current: { system: currentMetrics, performance: performanceMetrics }, history: metricsHistory, period: `${hoursToFetch} hours` } } as ApiResponse);
  } catch (error) {
    console.error('Error getting system metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to get system metrics' } as ApiResponse);
  }
}

export async function getSystemConfiguration(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const config = ConfigService.getInstance();
    const appConfig = config.getConfig();
    const validation = config.validateConfig();
    const environmentInfo = config.getEnvironmentInfo();
    res.json({ success: true, data: { config: appConfig, validation, environment: environmentInfo } } as ApiResponse);
  } catch (error) {
    console.error('Error getting system configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to get system configuration' } as ApiResponse);
  }
}

export async function updateSystemConfiguration(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const config = ConfigService.getInstance();
    const updates = req.body as any;
    await config.updateConfig(updates);
    const validation = config.validateConfig();
    res.json({ success: true, data: { updated: true, validation, timestamp: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error updating system configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to update system configuration' } as ApiResponse);
  }
}

export async function getSystemLogs(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { level, limit } = req.query as any;
    const logger = LoggerService.getInstance();
    const logs = await logger.getRecentLogs(level, limit ? parseInt(limit) : 100);
    res.json({ success: true, data: { logs, count: logs.length, level: level || 'all', limit: limit || 100 } } as ApiResponse);
  } catch (error) {
    console.error('Error getting system logs:', error);
    res.status(500).json({ success: false, error: 'Failed to get system logs' } as ApiResponse);
  }
}

export async function getAlerts(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const monitoring = MonitoringService.getInstance();
    const activeAlerts = monitoring.getActiveAlerts();
    const alertConditions = monitoring.getAlertConditions();
    res.json({ success: true, data: { active: activeAlerts, conditions: alertConditions, count: activeAlerts.length } } as ApiResponse);
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to get alerts' } as ApiResponse);
  }
}

export async function updateAlertCondition(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const { conditionId } = req.params as any;
    const updates = req.body as any;
    const monitoring = MonitoringService.getInstance();
    const success = monitoring.updateAlertCondition(conditionId, updates);
    if (!success) { res.status(404).json({ success: false, error: 'Alert condition not found' } as ApiResponse); return; }
    res.json({ success: true, data: { conditionId, updated: true, timestamp: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error updating alert condition:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert condition' } as ApiResponse);
  }
}

export async function createDefaultConfig(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const config = ConfigService.getInstance();
    await config.createDefaultConfigFile();
    res.json({ success: true, data: { message: 'Default configuration file created', timestamp: new Date().toISOString() } } as ApiResponse);
  } catch (error) {
    console.error('Error creating default configuration:', error);
    res.status(500).json({ success: false, error: 'Failed to create default configuration' } as ApiResponse);
  }
}

export async function healthCheck(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const monitoring = MonitoringService.getInstance();
    const overallHealth = monitoring.getOverallHealth();
    const uptime = process.uptime();
    const statusCode = overallHealth === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json({ success: overallHealth !== 'unhealthy', data: { status: overallHealth, uptime: Math.round(uptime), timestamp: new Date().toISOString(), version: process.env.npm_package_version || '1.0.0' } } as ApiResponse);
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(503).json({ success: false, error: 'Health check failed' } as ApiResponse);
  }
}

export async function getClaudeStatus(this: ApiContext, req: Request, res: Response): Promise<void> {
  try {
    const claudeStatus = await this.tmuxService.checkClaudeInstallation();
    res.json({ success: true, data: claudeStatus } as ApiResponse);
  } catch (error) {
    console.error('Error checking Claude status:', error);
    res.status(500).json({ success: false, error: (error as Error).message || 'Failed to check Claude status' } as ApiResponse);
  }
}
