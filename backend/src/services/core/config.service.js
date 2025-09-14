import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
export class ConfigService {
    static instance;
    config;
    configPath;
    constructor() {
        this.configPath = this.resolveConfigPath();
        this.config = this.loadConfig();
    }
    static getInstance() {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }
    resolveConfigPath() {
        const possiblePaths = [
            process.env.CONFIG_PATH,
            path.join(process.cwd(), 'config.json'),
            path.join(process.cwd(), 'config', 'app.json'),
            path.join(process.cwd(), '.agentmux', 'config.json'),
        ].filter(Boolean);
        for (const configPath of possiblePaths) {
            if (existsSync(configPath)) {
                return configPath;
            }
        }
        // Return default path if no config file exists
        return path.join(process.cwd(), 'config.json');
    }
    getDefaultConfig() {
        return {
            server: {
                port: parseInt(process.env.PORT || '3000', 10),
                host: process.env.HOST || 'localhost',
                nodeEnv: process.env.NODE_ENV || 'development',
                corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
                trustProxy: process.env.TRUST_PROXY === 'true',
            },
            mcp: {
                port: parseInt(process.env.AGENTMUX_MCP_PORT || '3001', 10),
                enabled: process.env.MCP_ENABLED !== 'false',
                maxConnections: parseInt(process.env.MCP_MAX_CONNECTIONS || '100', 10),
                timeoutMs: parseInt(process.env.MCP_TIMEOUT || '30000', 10),
            },
            storage: {
                dataPath: process.env.DATA_PATH || path.join(process.cwd(), 'data'),
                backupEnabled: process.env.BACKUP_ENABLED === 'true',
                backupInterval: parseInt(process.env.BACKUP_INTERVAL || '3600000', 10), // 1 hour
                maxBackups: parseInt(process.env.MAX_BACKUPS || '10', 10),
            },
            git: {
                autoCommitEnabled: process.env.GIT_AUTO_COMMIT !== 'false',
                autoCommitInterval: parseInt(process.env.GIT_AUTO_COMMIT_INTERVAL || '30', 10),
                defaultBranch: process.env.GIT_DEFAULT_BRANCH || 'main',
                pushToRemote: process.env.GIT_PUSH_TO_REMOTE === 'true',
            },
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: process.env.LOG_FORMAT || 'simple',
                enableFileLogging: process.env.FILE_LOGGING === 'true',
                logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
                maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
                maxSize: process.env.LOG_MAX_SIZE || '10m',
            },
            monitoring: {
                metricsEnabled: process.env.METRICS_ENABLED === 'true',
                healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
                performanceTrackingEnabled: process.env.PERF_TRACKING === 'true',
                memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '512', 10), // MB
                cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80', 10), // %
            },
            security: {
                rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
                rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 min
                rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
                enableHelmet: process.env.HELMET_ENABLED !== 'false',
                sessionSecret: process.env.SESSION_SECRET,
            },
            websocket: {
                enabled: process.env.WEBSOCKET_ENABLED !== 'false',
                pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
                pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
                maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10),
            },
            agents: {
                maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '50', 10),
                defaultTimeout: parseInt(process.env.AGENT_DEFAULT_TIMEOUT || '300000', 10), // 5 min
                maxMemoryPerAgent: parseInt(process.env.MAX_MEMORY_PER_AGENT || '256', 10), // MB
                contextRefreshInterval: parseInt(process.env.CONTEXT_REFRESH_INTERVAL || '1800000', 10), // 30 min
            },
        };
    }
    loadConfig() {
        try {
            const defaultConfig = this.getDefaultConfig();
            if (!existsSync(this.configPath)) {
                console.log(`No config file found at ${this.configPath}, using default configuration`);
                return defaultConfig;
            }
            const fileContent = require('fs').readFileSync(this.configPath, 'utf-8');
            const fileConfig = JSON.parse(fileContent);
            // Deep merge with defaults
            return this.mergeConfigs(defaultConfig, fileConfig);
        }
        catch (error) {
            console.error('Error loading configuration, falling back to defaults:', error);
            return this.getDefaultConfig();
        }
    }
    mergeConfigs(defaultConfig, fileConfig) {
        const merged = { ...defaultConfig };
        for (const [key, value] of Object.entries(fileConfig)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            }
            else {
                merged[key] = value;
            }
        }
        return merged;
    }
    getConfig() {
        return this.config;
    }
    get(section) {
        return this.config[section];
    }
    async updateConfig(updates) {
        // Update in-memory config
        this.config = this.mergeConfigs(this.config, updates);
        // Write to file
        try {
            const configData = JSON.stringify(this.config, null, 2);
            await fs.writeFile(this.configPath, configData, 'utf-8');
            console.log(`Configuration updated and saved to ${this.configPath}`);
        }
        catch (error) {
            console.error('Failed to save configuration:', error);
            throw new Error('Failed to save configuration');
        }
    }
    async createDefaultConfigFile() {
        if (existsSync(this.configPath)) {
            console.log(`Configuration file already exists at ${this.configPath}`);
            return;
        }
        try {
            const defaultConfig = this.getDefaultConfig();
            const configData = JSON.stringify(defaultConfig, null, 2);
            // Ensure directory exists
            const configDir = path.dirname(this.configPath);
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(this.configPath, configData, 'utf-8');
            console.log(`Default configuration file created at ${this.configPath}`);
        }
        catch (error) {
            console.error('Failed to create default configuration file:', error);
            throw new Error('Failed to create configuration file');
        }
    }
    validateConfig() {
        const errors = [];
        const config = this.config;
        // Validate server config
        if (config.server.port < 1 || config.server.port > 65535) {
            errors.push('Server port must be between 1 and 65535');
        }
        if (!['development', 'production', 'test'].includes(config.server.nodeEnv)) {
            errors.push('NODE_ENV must be development, production, or test');
        }
        // Validate MCP config
        if (config.mcp.port < 1 || config.mcp.port > 65535) {
            errors.push('MCP port must be between 1 and 65535');
        }
        if (config.mcp.port === config.server.port) {
            errors.push('MCP port cannot be the same as server port');
        }
        // Validate logging config
        if (!['error', 'warn', 'info', 'debug'].includes(config.logging.level)) {
            errors.push('Log level must be error, warn, info, or debug');
        }
        // Validate monitoring thresholds
        if (config.monitoring.memoryThreshold < 64) {
            errors.push('Memory threshold should be at least 64MB');
        }
        if (config.monitoring.cpuThreshold < 1 || config.monitoring.cpuThreshold > 100) {
            errors.push('CPU threshold must be between 1 and 100');
        }
        // Validate security config
        if (config.server.nodeEnv === 'production' && !config.security.sessionSecret) {
            errors.push('Session secret is required in production');
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    getEnvironmentInfo() {
        return {
            nodeVersion: process.version,
            platform: process.platform,
            architecture: process.arch,
            nodeEnv: this.config.server.nodeEnv,
            processId: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            configPath: this.configPath,
            configLastModified: existsSync(this.configPath)
                ? require('fs').statSync(this.configPath).mtime
                : null,
        };
    }
    isDevelopment() {
        return this.config.server.nodeEnv === 'development';
    }
    isProduction() {
        return this.config.server.nodeEnv === 'production';
    }
    isTest() {
        return this.config.server.nodeEnv === 'test';
    }
}
//# sourceMappingURL=config.service.js.map