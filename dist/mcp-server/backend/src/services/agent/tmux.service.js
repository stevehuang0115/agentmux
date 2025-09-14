import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { LoggerService } from '../core/logger.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { AgentRegistrationService } from './agent-registration.service.js';
import { PromptBuilderService } from '../ai/prompt-builder.service.js';
import { StorageService } from '../core/storage.service.js';
import { ENV_CONSTANTS, AGENT_TIMEOUTS, ORCHESTRATOR_ROLE } from '../../constants.js';
/**
 * Refactored TmuxService that acts as a facade, coordinating specialized services
 * to provide a high-level API for tmux session management and agent initialization.
 *
 * This service retains the public-facing API while delegating actual work to specialized services:
 * - TmuxCommandService: Low-level tmux operations
 * - RuntimeServiceFactory: Creates runtime-specific services
 * - AgentRegistrationService: Agent initialization and registration
 * - PromptBuilderService: Prompt generation and management
 */
export class TmuxService extends EventEmitter {
    sessions = new Map();
    outputBuffers = new Map();
    logger;
    // Specialized services
    tmuxCommand;
    agentRegistration;
    promptBuilder;
    storageService;
    // Memory management
    cleanupInterval;
    MAX_BUFFER_SIZE = 100; // Max lines per session buffer
    CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    // Session creation queue to prevent concurrent session creation conflicts
    sessionCreationQueue = [];
    isProcessingQueue = false;
    SESSION_CREATION_DELAY = 3000; // 3 seconds between sessions
    // Concurrency controls to prevent system overload
    MAX_CONCURRENT_INITIALIZING = 2; // Max sessions initializing simultaneously
    activeSessions = new Set(); // Track sessions currently initializing
    // Project root path resolution
    projectRoot;
    constructor() {
        super();
        this.logger = LoggerService.getInstance().createComponentLogger('TmuxService');
        // Resolve project root - go up from current file to find package.json
        this.projectRoot = this.findProjectRoot();
        // Initialize specialized services
        this.tmuxCommand = new TmuxCommandService();
        this.storageService = StorageService.getInstance();
        // AgentRegistrationService now uses factory pattern internally
        this.agentRegistration = new AgentRegistrationService(this.tmuxCommand, this.projectRoot, this.storageService);
        this.promptBuilder = new PromptBuilderService(this.projectRoot);
        // Start periodic cleanup to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            this.cleanupMemory();
        }, this.CLEANUP_INTERVAL);
    }
    /**
     * Find the project root by looking for package.json
     */
    findProjectRoot() {
        // Get current file directory
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        // Walk up directories to find package.json
        let dir = currentDir;
        while (dir !== path.dirname(dir)) {
            try {
                const packagePath = path.join(dir, 'package.json');
                // Synchronously check if package.json exists
                require('fs').accessSync(packagePath);
                return dir;
            }
            catch {
                dir = path.dirname(dir);
            }
        }
        // Fallback to current working directory
        return process.cwd();
    }
    /**
     * Clean up memory to prevent accumulation of old data
     */
    cleanupMemory() {
        try {
            // Trim output buffers to prevent excessive memory usage
            for (const [sessionName, buffer] of this.outputBuffers.entries()) {
                if (buffer.length > this.MAX_BUFFER_SIZE) {
                    // Keep only the most recent lines
                    const trimmedBuffer = buffer.slice(-this.MAX_BUFFER_SIZE);
                    this.outputBuffers.set(sessionName, trimmedBuffer);
                }
            }
            // Clean up detection cache in runtime services (handled automatically by factory caching)
            // Clean up buffers for sessions that no longer exist
            const activeSessions = new Set(this.sessions.keys());
            for (const sessionName of this.outputBuffers.keys()) {
                if (!activeSessions.has(sessionName)) {
                    this.outputBuffers.delete(sessionName);
                }
            }
            this.logger.debug('Memory cleanup completed', {
                outputBuffersCount: this.outputBuffers.size,
                activeSessionsCount: this.sessions.size,
            });
        }
        catch (error) {
            this.logger.error('Error during memory cleanup', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Destroy the service and clean up resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        // Clean up all buffers
        this.outputBuffers.clear();
        this.sessions.clear();
        this.logger.info('TmuxService destroyed and resources cleaned up');
    }
    /**
     * Force immediate memory cleanup (for emergency situations)
     */
    forceCleanup() {
        this.cleanupMemory();
        // More aggressive cleanup if needed
        if (global.gc) {
            global.gc();
            this.logger.info('Forced garbage collection completed');
        }
    }
    /**
     * Initialize tmux server if not running
     */
    async initialize() {
        await this.ensureTmuxServer();
    }
    /**
     * Ensure tmux server is running using the initialize_tmux.sh script
     */
    async ensureTmuxServer() {
        try {
            this.logger.info('Initializing tmux server using script...');
            await this.executeTmuxInitScript();
            this.logger.info('tmux server initialization script completed');
        }
        catch (error) {
            this.logger.error('Failed to initialize tmux server', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Create orchestrator session for project management
     */
    async createOrchestratorSession(config) {
        try {
            this.logger.info('Creating orchestrator session', {
                sessionName: config.sessionName,
                projectPath: config.projectPath,
            });
            // Check if session already exists
            if (await this.tmuxCommand.sessionExists(config.sessionName)) {
                this.logger.info('Orchestrator session already exists', {
                    sessionName: config.sessionName,
                });
                return {
                    success: true,
                    sessionName: config.sessionName,
                    message: 'Orchestrator session already running',
                };
            }
            // Create new tmux session for orchestrator
            await this.tmuxCommand.createSession(config.sessionName, config.projectPath, config.windowName);
            this.logger.info('Orchestrator session created', { sessionName: config.sessionName });
            // Read orchestrator configuration from teams.json to get runtime type
            const orchestratorConfig = await this.storageService.getOrchestratorStatus();
            const runtimeType = orchestratorConfig?.runtimeType || 'claude-code';
            // Initialize runtime in the orchestrator session using the configured runtime type
            this.logger.info('Initializing runtime in orchestrator session', {
                sessionName: config.sessionName,
                runtimeType
            });
            const runtimeService = RuntimeServiceFactory.create(runtimeType, this.tmuxCommand, this.projectRoot);
            await runtimeService.executeRuntimeInitScript(config.sessionName, config.projectPath);
            this.logger.info('Runtime initialized successfully in orchestrator session', {
                sessionName: config.sessionName,
                runtimeType
            });
            return {
                success: true,
                sessionName: config.sessionName,
                message: 'Orchestrator session created successfully',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to create orchestrator session', {
                sessionName: config.sessionName,
                error: errorMessage,
            });
            return {
                success: false,
                sessionName: config.sessionName,
                error: errorMessage,
            };
        }
    }
    /**
     * Initialize orchestrator session with appropriate runtime
     */
    async initializeOrchestrator(sessionName, timeout = AGENT_TIMEOUTS.ORCHESTRATOR_INITIALIZATION) {
        // Get orchestrator's runtime type from storage
        let runtimeType = 'claude-code'; // Default fallback
        try {
            const orchestratorStatus = await this.storageService.getOrchestratorStatus();
            if (orchestratorStatus?.runtimeType) {
                runtimeType = orchestratorStatus.runtimeType;
                this.logger.info('Using orchestrator runtime type from storage', {
                    sessionName,
                    runtimeType
                });
            }
            else {
                this.logger.warn('No runtime type found in orchestrator status, using default', {
                    sessionName,
                    runtimeType
                });
            }
        }
        catch (error) {
            this.logger.warn('Failed to get orchestrator runtime type from storage, using default', {
                sessionName,
                runtimeType,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        // Use the agent registration system with orchestrator role and runtime type
        const projectPath = process.cwd(); // Orchestrator works from current project directory
        return await this.agentRegistration.initializeAgentWithRegistration(sessionName, ORCHESTRATOR_ROLE, projectPath, timeout, undefined, // memberId (not used for orchestrator)
        runtimeType // Cast to RuntimeType
        );
    }
    /**
     * Send project start prompt to orchestrator
     */
    async sendProjectStartPrompt(sessionName, projectData) {
        try {
            this.logger.info('Sending project start prompt to orchestrator', {
                sessionName,
                projectName: projectData.projectName,
            });
            // Check if session exists
            if (!(await this.tmuxCommand.sessionExists(sessionName))) {
                return {
                    success: false,
                    error: `Session '${sessionName}' does not exist`,
                };
            }
            // Build the orchestrator prompt using the prompt builder
            const prompt = this.promptBuilder.buildOrchestratorPrompt(projectData);
            // Send the prompt to Claude
            await this.sendMessage(sessionName, prompt);
            this.logger.info('Project start prompt sent successfully', {
                sessionName,
                projectName: projectData.projectName,
            });
            return {
                success: true,
                message: 'Project start prompt sent to orchestrator',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to send project start prompt', {
                sessionName,
                error: errorMessage,
            });
            return {
                success: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Check if Claude Code CLI is installed
     */
    async checkClaudeInstallation() {
        const claudeService = RuntimeServiceFactory.create('claude-code', this.tmuxCommand, this.projectRoot);
        return await claudeService.checkClaudeInstallation();
    }
    /**
     * Initialize Claude Code in an existing session
     */
    async initializeClaudeInSession(sessionName) {
        const claudeService = RuntimeServiceFactory.create('claude-code', this.tmuxCommand, this.projectRoot);
        return await claudeService.initializeClaudeInSession(sessionName);
    }
    /**
     * Create a new tmux session for a team member (queued to prevent concurrent creation conflicts)
     */
    async createTeamMemberSession(config, sessionName) {
        return new Promise((resolve, reject) => {
            this.sessionCreationQueue.push(async () => {
                try {
                    const result = await this.createTeamMemberSessionInternal(config, sessionName);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            });
            this.processSessionCreationQueue();
        });
    }
    /**
     * Internal method for creating team member session (called by queue processor)
     */
    async createTeamMemberSessionInternal(config, sessionName) {
        // Add concurrency control - wait if too many sessions are initializing
        while (this.activeSessions.size >= this.MAX_CONCURRENT_INITIALIZING) {
            this.logger.info('Waiting for session slot to become available', {
                sessionName,
                activeCount: this.activeSessions.size,
                maxAllowed: this.MAX_CONCURRENT_INITIALIZING,
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        this.activeSessions.add(sessionName);
        try {
            this.logger.info('Creating team member session (queued with concurrency control)', {
                sessionName,
                role: config.role,
                activeSessionsCount: this.activeSessions.size,
            });
            // Kill existing session if it exists to ensure clean initialization
            if (await this.tmuxCommand.sessionExists(sessionName)) {
                this.logger.info('Team member session already exists, killing for clean restart', {
                    sessionName,
                });
            }
            await this.tmuxCommand.killSession(sessionName);
            // Wait for cleanup
            await new Promise((resolve) => setTimeout(resolve, 1000));
            // Create new tmux session
            await this.tmuxCommand.createSession(sessionName, config.projectPath || process.cwd());
            // Set environment variables for MCP connection
            await this.tmuxCommand.setEnvironmentVariable(sessionName, ENV_CONSTANTS.TMUX_SESSION_NAME, sessionName);
            await this.tmuxCommand.setEnvironmentVariable(sessionName, ENV_CONSTANTS.AGENTMUX_ROLE, config.role);
            // Use the optimized agent registration system for initialization
            const initResult = await this.agentRegistration.initializeAgentWithRegistration(sessionName, config.role, config.projectPath, AGENT_TIMEOUTS.REGULAR_AGENT_INITIALIZATION, config.memberId, config.runtimeType || 'claude-code' // Use configured runtime type, fallback to claude-code
            );
            if (!initResult.success) {
                throw new Error(`Agent initialization failed: ${initResult.error}`);
            }
            this.logger.info('Agent initialized successfully with registration', {
                sessionName,
                role: config.role,
                message: initResult.message,
            });
            // Start optimized streaming output
            this.startOutputStreaming(sessionName);
            this.logger.info('Team member session created successfully', {
                sessionName,
                role: config.role,
            });
            return {
                success: true,
                sessionName,
                message: 'Team member session created successfully',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to create team member session', {
                sessionName,
                role: config.role,
                error: errorMessage,
            });
            return {
                success: false,
                sessionName,
                error: errorMessage,
            };
        }
        finally {
            // Always remove from active sessions when done (success or failure)
            this.activeSessions.delete(sessionName);
            this.logger.debug('Released session slot', {
                sessionName,
                remainingActiveCount: this.activeSessions.size,
            });
        }
    }
    /**
     * Process the session creation queue to serialize session creation
     */
    async processSessionCreationQueue() {
        if (this.isProcessingQueue || this.sessionCreationQueue.length === 0) {
            return;
        }
        this.isProcessingQueue = true;
        this.logger.info('Starting session creation queue processing', {
            queueLength: this.sessionCreationQueue.length,
        });
        while (this.sessionCreationQueue.length > 0) {
            const sessionCreator = this.sessionCreationQueue.shift();
            try {
                await sessionCreator();
                this.logger.debug('Session creation completed, waiting before next session', {
                    remainingInQueue: this.sessionCreationQueue.length,
                    delayMs: this.SESSION_CREATION_DELAY,
                });
                // Add delay between sessions to prevent resource conflicts
                if (this.sessionCreationQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, this.SESSION_CREATION_DELAY));
                }
            }
            catch (error) {
                this.logger.error('Session creation failed in queue', {
                    error: error instanceof Error ? error.message : String(error),
                    remainingInQueue: this.sessionCreationQueue.length,
                });
            }
        }
        this.isProcessingQueue = false;
        this.logger.info('Session creation queue processing completed');
    }
    /**
     * Create a new tmux session with Claude Code (legacy compatibility)
     */
    async createSession(config) {
        try {
            const sessionName = config.name.replace(/\s+/g, '_').toLowerCase();
            // Kill existing session if it exists
            await this.tmuxCommand.killSession(sessionName);
            // Create new tmux session
            await this.tmuxCommand.createSession(sessionName, config.projectPath || process.cwd());
            // Set environment variables for MCP connection
            await this.tmuxCommand.setEnvironmentVariable(sessionName, ENV_CONSTANTS.TMUX_SESSION_NAME, sessionName);
            await this.tmuxCommand.setEnvironmentVariable(sessionName, ENV_CONSTANTS.AGENTMUX_ROLE, config.role);
            // Get runtime type from config or default to claude-code
            const runtimeType = config.runtimeType || 'claude-code';
            // Initialize runtime using the configured runtime type
            this.logger.info('Initializing runtime in team member session', {
                sessionName,
                runtimeType,
                memberRole: config.role
            });
            const runtimeService = RuntimeServiceFactory.create(runtimeType, this.tmuxCommand, this.projectRoot);
            await runtimeService.executeRuntimeInitScript(sessionName, config.projectPath);
            // Start streaming output
            this.startOutputStreaming(sessionName);
            return sessionName;
        }
        catch (error) {
            this.logger.error('Error creating tmux session:', error);
            throw error;
        }
    }
    /**
     * Send a message to a specific tmux session
     */
    async sendMessage(sessionName, message) {
        try {
            // Clear current command line first (important for sessions running interactive programs like Gemini CLI)
            await this.tmuxCommand.clearCurrentCommandLine(sessionName);
            await this.tmuxCommand.sendMessage(sessionName, message);
            // Send Enter key separately to execute the message
            await this.tmuxCommand.sendEnter(sessionName);
            this.emit('message_sent', { sessionName, message });
            this.logger.debug('Message sent successfully', {
                sessionName,
                messageLength: message.length,
            });
        }
        catch (error) {
            this.logger.error('Error sending message to tmux session:', error);
            throw error;
        }
    }
    /**
     * Send individual key to a specific tmux session (without Enter)
     */
    async sendKey(sessionName, key) {
        await this.tmuxCommand.sendKey(sessionName, key);
        this.emit('key_sent', { sessionName, key });
    }
    /**
     * Capture terminal output from a session
     */
    async capturePane(sessionName, lines = 100) {
        return await this.tmuxCommand.capturePane(sessionName, lines);
    }
    /**
     * Kill a tmux session
     */
    async killSession(sessionName) {
        await this.tmuxCommand.killSession(sessionName);
        // Clean up local tracking
        this.sessions.delete(sessionName);
        this.outputBuffers.delete(sessionName);
        this.emit('session_killed', { sessionName });
    }
    /**
     * List all tmux sessions
     */
    async listSessions() {
        return await this.tmuxCommand.listSessions();
    }
    /**
     * Check if a session exists
     */
    async sessionExists(sessionName) {
        return await this.tmuxCommand.sessionExists(sessionName);
    }
    /**
     * Check multiple sessions at once (highly optimized for bulk checking)
     * Returns a Map with sessionName -> boolean for each session
     */
    async bulkSessionExists(sessionNames) {
        return await this.tmuxCommand.bulkSessionExists(sessionNames);
    }
    /**
     * Start streaming output for an existing session (public method)
     */
    enableOutputStreaming(sessionName) {
        this.startOutputStreaming(sessionName);
    }
    /**
     * Start optimized streaming output from a session with reduced frequency and jitter
     */
    startOutputStreaming(sessionName) {
        // Add jitter to prevent synchronized polling across multiple sessions
        const baseInterval = 3000; // Increased from 1000ms to 3000ms to reduce load
        const jitter = Math.random() * 1000; // Random 0-1000ms jitter
        const pollInterval = baseInterval + jitter;
        this.logger.debug('Starting output streaming with optimized timing', {
            sessionName,
            pollInterval: Math.round(pollInterval),
        });
        // Create a recurring capture to stream output
        const interval = setInterval(async () => {
            try {
                if (!(await this.tmuxCommand.sessionExists(sessionName))) {
                    this.logger.debug('Session no longer exists, stopping output streaming', {
                        sessionName,
                    });
                    clearInterval(interval);
                    return;
                }
                const output = await this.tmuxCommand.capturePane(sessionName, 10);
                const previousBuffer = this.outputBuffers.get(sessionName) || [];
                const currentLines = output.split('\n');
                // Only emit new lines and prevent excessive buffer growth
                if (JSON.stringify(currentLines) !== JSON.stringify(previousBuffer)) {
                    // Trim buffer to prevent memory accumulation
                    const trimmedLines = currentLines.length > this.MAX_BUFFER_SIZE
                        ? currentLines.slice(-this.MAX_BUFFER_SIZE)
                        : currentLines;
                    this.outputBuffers.set(sessionName, trimmedLines);
                    const terminalOutput = {
                        sessionName,
                        content: output,
                        timestamp: new Date().toISOString(),
                        type: 'stdout',
                    };
                    this.emit('output', terminalOutput);
                }
            }
            catch (error) {
                this.logger.error(`Error streaming output for session ${sessionName}:`, error);
                clearInterval(interval);
            }
        }, pollInterval);
    }
    /**
     * Execute tmux initialization script
     */
    async executeTmuxInitScript() {
        try {
            const { readFile } = await import('fs/promises');
            const initScriptPath = path.join(this.projectRoot, 'config', 'initialize_tmux.sh');
            // Read the script file
            const scriptContent = await readFile(initScriptPath, 'utf8');
            this.logger.info('Executing tmux initialization script', {
                scriptPath: initScriptPath,
            });
            // Execute the script using bash
            return new Promise((resolve, reject) => {
                const process = spawn('bash', [initScriptPath]);
                let output = '';
                let error = '';
                process.stdout.on('data', (data) => {
                    output += data.toString();
                    this.logger.info('tmux init script output', { output: data.toString().trim() });
                });
                process.stderr.on('data', (data) => {
                    error += data.toString();
                    this.logger.warn('tmux init script stderr', { error: data.toString().trim() });
                });
                process.on('close', (code) => {
                    if (code === 0) {
                        this.logger.info('tmux initialization script completed successfully', {
                            output: output.trim(),
                        });
                        resolve();
                    }
                    else {
                        const errorMessage = `tmux init script failed with exit code ${code}: ${error}`;
                        this.logger.error('tmux initialization script failed', { code, error });
                        reject(new Error(errorMessage));
                    }
                });
                process.on('error', (err) => {
                    const errorMessage = `Failed to spawn bash for tmux init script: ${err.message}`;
                    this.logger.error('Failed to spawn bash for tmux init script', {
                        error: errorMessage,
                    });
                    reject(new Error(errorMessage));
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to execute tmux initialization script', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * Get the underlying TmuxCommandService instance for specialized operations
     * @returns TmuxCommandService instance
     */
    getTmuxCommandService() {
        return this.tmuxCommand;
    }
}
//# sourceMappingURL=tmux.service.js.map