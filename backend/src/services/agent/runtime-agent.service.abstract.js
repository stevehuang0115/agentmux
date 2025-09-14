import { readFile } from 'fs/promises';
import * as path from 'path';
import { LoggerService } from '../core/logger.service.js';
/**
 * Abstract base class for AI runtime services that handles tmux session initialization,
 * detection, and interaction patterns for different AI CLI tools.
 *
 * Uses Template Method pattern for maximum code reuse while allowing runtime-specific customization.
 */
export class RuntimeAgentService {
    logger;
    tmuxCommand;
    projectRoot;
    runtimeConfig = null;
    // State management for detection to prevent concurrent attempts
    detectionInProgress = new Map();
    detectionResults = new Map();
    constructor(tmuxCommandService, projectRoot) {
        this.logger = LoggerService.getInstance().createComponentLogger(`${this.constructor.name}`);
        this.tmuxCommand = tmuxCommandService;
        this.projectRoot = projectRoot;
        this.initializeRuntimeConfig();
    }
    /**
     * Template method for executing runtime initialization script.
     * Most logic is shared, only runtime-specific parts are delegated to abstract methods.
     */
    async executeRuntimeInitScript(sessionName, targetPath) {
        try {
            const config = this.getRuntimeConfig();
            const commands = await this.loadInitScript(config.initScript);
            this.logger.info('Executing runtime initialization script', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                script: config.initScript,
                commandCount: commands.length,
                targetPath: targetPath || process.cwd(),
            });
            // Clear the commandline before execute
            await this.tmuxCommand.clearCurrentCommandLine(sessionName);
            await this.executeCommands(sessionName, commands, targetPath);
            this.logger.info('Runtime initialization script completed', {
                sessionName,
                runtimeType: this.getRuntimeType(),
            });
        }
        catch (error) {
            this.logger.error('Failed to execute runtime initialization script', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Template method for detecting if runtime is running.
     * Handles caching and concurrent access, delegates actual detection to concrete classes.
     */
    async detectRuntimeWithCommand(sessionName, forceRefresh = false) {
        try {
            const cacheKey = `${sessionName}-${this.getRuntimeType()}`;
            // Handle cache
            if (forceRefresh) {
                this.detectionResults.delete(cacheKey);
                this.logger.debug('Cleared cached detection result due to forceRefresh', {
                    sessionName,
                    runtimeType: this.getRuntimeType(),
                });
            }
            if (!forceRefresh) {
                const cached = this.detectionResults.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < 30000) {
                    this.logger.debug('Using cached runtime detection result', {
                        sessionName,
                        runtimeType: this.getRuntimeType(),
                        isRuntimeRunning: cached.isRuntimeRunning,
                        age: Date.now() - cached.timestamp,
                    });
                    return cached.isRuntimeRunning;
                }
            }
            // Check if detection is already in progress
            if (this.detectionInProgress.get(cacheKey)) {
                this.logger.debug('Runtime detection already in progress, waiting for completion', {
                    sessionName,
                    runtimeType: this.getRuntimeType(),
                });
                let attempts = 0;
                while (this.detectionInProgress.get(cacheKey) && attempts < 30) {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    attempts++;
                }
                const result = this.detectionResults.get(cacheKey);
                if (result && Date.now() - result.timestamp < 60000) {
                    return result.isRuntimeRunning;
                }
            }
            this.detectionInProgress.set(cacheKey, true);
            this.logger.debug('Starting runtime detection', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                forceRefresh,
            });
            // Delegate actual detection to concrete implementation
            const isRuntimeRunning = await this.detectRuntimeSpecific(sessionName);
            // Cache the result
            this.detectionResults.set(cacheKey, {
                isRuntimeRunning,
                timestamp: Date.now(),
            });
            this.logger.debug('Runtime detection completed', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                isRuntimeRunning,
            });
            return isRuntimeRunning;
        }
        catch (error) {
            this.logger.error('Error detecting runtime', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
        finally {
            this.detectionInProgress.set(`${sessionName}-${this.getRuntimeType()}`, false);
        }
    }
    /**
     * Simplified method for waiting for runtime to be ready.
     * Checks at regular intervals until timeout, looking for ready patterns in the terminal output.
     */
    async waitForRuntimeReady(sessionName, timeout, checkInterval = 2000 // Check every 2 seconds
    ) {
        const startTime = Date.now();
        this.logger.info('Waiting for runtime to be ready', {
            sessionName,
            runtimeType: this.getRuntimeType(),
            timeout,
            checkInterval,
        });
        // Keep checking until timeout
        while (Date.now() - startTime < timeout) {
            try {
                // Capture terminal output
                const output = await this.tmuxCommand.capturePane(sessionName, 30);
                // Get runtime-specific ready patterns
                const readyPatterns = this.getRuntimeReadyPatterns();
                // Check if any ready pattern is found in the output
                const hasReadySignal = readyPatterns.some((pattern) => output.includes(pattern));
                if (hasReadySignal) {
                    const detectedPattern = readyPatterns.find((p) => output.includes(p));
                    this.logger.info('Runtime ready pattern detected', {
                        sessionName,
                        runtimeType: this.getRuntimeType(),
                        detectedPattern,
                        totalElapsed: Date.now() - startTime,
                    });
                    return true;
                }
            }
            catch (error) {
                this.logger.warn('Error while checking runtime ready signal', {
                    sessionName,
                    runtimeType: this.getRuntimeType(),
                    error: String(error),
                });
            }
            // Wait for next check interval
            await new Promise((resolve) => setTimeout(resolve, checkInterval));
        }
        // Timeout reached
        this.logger.warn('Timeout waiting for runtime ready signal', {
            sessionName,
            runtimeType: this.getRuntimeType(),
            timeout,
            checkInterval,
            totalElapsed: Date.now() - startTime,
        });
        return false;
    }
    /**
     * Clear cached detection results for a session
     */
    clearDetectionCache(sessionName) {
        const cacheKey = `${sessionName}-${this.getRuntimeType()}`;
        this.detectionResults.delete(cacheKey);
        this.detectionInProgress.set(cacheKey, false);
        this.logger.debug('Cleared runtime detection cache', {
            sessionName,
            runtimeType: this.getRuntimeType(),
        });
    }
    /**
     * Get runtime configuration
     */
    getRuntimeConfiguration() {
        return this.runtimeConfig;
    }
    // Protected helper methods for concrete classes to use
    /**
     * Initialize runtime configuration from config file
     */
    async initializeRuntimeConfig() {
        try {
            const configPath = path.join(this.projectRoot, 'config', 'runtime-config.json');
            const configContent = await readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            const runtimeKey = this.getRuntimeType();
            this.runtimeConfig = config.runtimes[runtimeKey] || null;
            if (this.runtimeConfig) {
                this.logger.info('Runtime configuration loaded', {
                    runtimeType: runtimeKey,
                    initScript: this.runtimeConfig.initScript,
                });
            }
            else {
                this.logger.error('Runtime configuration not found', {
                    runtimeType: runtimeKey,
                    availableRuntimes: Object.keys(config.runtimes),
                });
            }
        }
        catch (error) {
            this.logger.error('Failed to load runtime configurations', {
                runtimeType: this.getRuntimeType(),
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Get runtime configuration with fallback
     */
    getRuntimeConfig() {
        if (!this.runtimeConfig) {
            this.logger.warn('Runtime config not loaded, using fallback', {
                runtimeType: this.getRuntimeType(),
            });
            return {
                displayName: this.getRuntimeType(),
                initScript: 'initialize_claude.sh', // Default fallback
                welcomeMessage: 'Welcome',
                timeout: 120000,
                description: `Default ${this.getRuntimeType()} configuration`,
            };
        }
        return this.runtimeConfig;
    }
    /**
     * Load initialization script commands from file
     */
    async loadInitScript(scriptName) {
        const scriptPath = path.join(this.projectRoot, 'config', scriptName);
        const scriptContent = await readFile(scriptPath, 'utf8');
        return scriptContent
            .trim()
            .split('\n')
            .filter((line) => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('#');
        });
    }
    /**
     * Execute commands in tmux session with proper timing
     */
    async executeCommands(sessionName, commands, targetPath) {
        // Change to target directory first
        const cdPath = targetPath || process.cwd();
        this.logger.info('Changing directory before runtime init', {
            sessionName,
            runtimeType: this.getRuntimeType(),
            cdPath,
        });
        await this.tmuxCommand.sendKey(sessionName, `cd "${cdPath}"`);
        await this.tmuxCommand.sendEnter(sessionName);
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Execute each command
        for (const command of commands) {
            this.logger.info('Sending command to session', {
                sessionName,
                runtimeType: this.getRuntimeType(),
                command,
            });
            await this.tmuxCommand.sendKey(sessionName, command);
            await this.tmuxCommand.sendEnter(sessionName);
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}
//# sourceMappingURL=runtime-agent.service.abstract.js.map