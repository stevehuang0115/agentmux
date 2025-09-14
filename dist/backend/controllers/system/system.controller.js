import { MonitoringService, ConfigService, LoggerService } from '../../services/index.js';
export async function getSystemHealth(req, res) {
    try {
        const monitoring = MonitoringService.getInstance();
        const config = ConfigService.getInstance();
        const healthStatus = monitoring.getHealthStatus();
        const overallHealth = monitoring.getOverallHealth();
        const systemMetrics = monitoring.getSystemMetrics();
        const performanceMetrics = monitoring.getPerformanceMetrics();
        const environmentInfo = config.getEnvironmentInfo();
        res.json({ success: true, data: { status: overallHealth, timestamp: new Date().toISOString(), services: Object.fromEntries(healthStatus), metrics: { system: systemMetrics, performance: performanceMetrics }, environment: environmentInfo } });
    }
    catch (error) {
        console.error('Error getting system health:', error);
        res.status(500).json({ success: false, error: 'Failed to get system health' });
    }
}
export async function getSystemMetrics(req, res) {
    try {
        const { hours } = req.query;
        const monitoring = MonitoringService.getInstance();
        const hoursToFetch = hours ? parseInt(hours) : 1;
        const metricsHistory = monitoring.getMetricsHistory(hoursToFetch);
        const currentMetrics = monitoring.getSystemMetrics();
        const performanceMetrics = monitoring.getPerformanceMetrics();
        res.json({ success: true, data: { current: { system: currentMetrics, performance: performanceMetrics }, history: metricsHistory, period: `${hoursToFetch} hours` } });
    }
    catch (error) {
        console.error('Error getting system metrics:', error);
        res.status(500).json({ success: false, error: 'Failed to get system metrics' });
    }
}
export async function getSystemConfiguration(req, res) {
    try {
        const config = ConfigService.getInstance();
        const appConfig = config.getConfig();
        const validation = config.validateConfig();
        const environmentInfo = config.getEnvironmentInfo();
        res.json({ success: true, data: { config: appConfig, validation, environment: environmentInfo } });
    }
    catch (error) {
        console.error('Error getting system configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to get system configuration' });
    }
}
export async function updateSystemConfiguration(req, res) {
    try {
        const config = ConfigService.getInstance();
        const updates = req.body;
        await config.updateConfig(updates);
        const validation = config.validateConfig();
        res.json({ success: true, data: { updated: true, validation, timestamp: new Date().toISOString() } });
    }
    catch (error) {
        console.error('Error updating system configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to update system configuration' });
    }
}
export async function getSystemLogs(req, res) {
    try {
        const { level, limit } = req.query;
        const logger = LoggerService.getInstance();
        const logs = await logger.getRecentLogs(level, limit ? parseInt(limit) : 100);
        res.json({ success: true, data: { logs, count: logs.length, level: level || 'all', limit: limit || 100 } });
    }
    catch (error) {
        console.error('Error getting system logs:', error);
        res.status(500).json({ success: false, error: 'Failed to get system logs' });
    }
}
export async function getAlerts(req, res) {
    try {
        const monitoring = MonitoringService.getInstance();
        const activeAlerts = monitoring.getActiveAlerts();
        const alertConditions = monitoring.getAlertConditions();
        res.json({ success: true, data: { active: activeAlerts, conditions: alertConditions, count: activeAlerts.length } });
    }
    catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({ success: false, error: 'Failed to get alerts' });
    }
}
export async function updateAlertCondition(req, res) {
    try {
        const { conditionId } = req.params;
        const updates = req.body;
        const monitoring = MonitoringService.getInstance();
        const success = monitoring.updateAlertCondition(conditionId, updates);
        if (!success) {
            res.status(404).json({ success: false, error: 'Alert condition not found' });
            return;
        }
        res.json({ success: true, data: { conditionId, updated: true, timestamp: new Date().toISOString() } });
    }
    catch (error) {
        console.error('Error updating alert condition:', error);
        res.status(500).json({ success: false, error: 'Failed to update alert condition' });
    }
}
export async function createDefaultConfig(req, res) {
    try {
        const config = ConfigService.getInstance();
        await config.createDefaultConfigFile();
        res.json({ success: true, data: { message: 'Default configuration file created', timestamp: new Date().toISOString() } });
    }
    catch (error) {
        console.error('Error creating default configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to create default configuration' });
    }
}
export async function healthCheck(req, res) {
    try {
        const monitoring = MonitoringService.getInstance();
        const overallHealth = monitoring.getOverallHealth();
        const uptime = process.uptime();
        const statusCode = overallHealth === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json({ success: overallHealth !== 'unhealthy', data: { status: overallHealth, uptime: Math.round(uptime), timestamp: new Date().toISOString(), version: process.env.npm_package_version || '1.0.0' } });
    }
    catch (error) {
        console.error('Error in health check:', error);
        res.status(503).json({ success: false, error: 'Health check failed' });
    }
}
export async function getClaudeStatus(req, res) {
    try {
        const claudeStatus = await this.tmuxService.checkClaudeInstallation();
        res.json({ success: true, data: claudeStatus });
    }
    catch (error) {
        console.error('Error checking Claude status:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to check Claude status' });
    }
}
//# sourceMappingURL=system.controller.js.map