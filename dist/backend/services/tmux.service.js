import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { readFile, writeFile, access } from 'fs/promises';
import * as path from 'path';
import { LoggerService } from './logger.service.js';
export class TmuxService extends EventEmitter {
    sessions = new Map();
    outputBuffers = new Map();
    logger;
    // State management for detection to prevent concurrent attempts
    detectionInProgress = new Map();
    detectionResults = new Map();
    constructor() {
        super();
        this.logger = LoggerService.getInstance().createComponentLogger('TmuxService');
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
            this.logger.error('Failed to initialize tmux server', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Create orchestrator session for project management
     */
    async createOrchestratorSession(config) {
        try {
            this.logger.info('Creating orchestrator session', { sessionName: config.sessionName, projectPath: config.projectPath });
            // Check if session already exists
            if (await this.sessionExists(config.sessionName)) {
                this.logger.info('Orchestrator session already exists', { sessionName: config.sessionName });
                return {
                    success: true,
                    sessionName: config.sessionName,
                    message: 'Orchestrator session already running'
                };
            }
            // Create new tmux session for orchestrator
            const createCommand = [
                'new-session',
                '-d',
                '-s', config.sessionName,
                '-c', config.projectPath
            ];
            await this.executeTmuxCommand(createCommand);
            this.logger.info('Orchestrator session created', { sessionName: config.sessionName });
            // Rename the window if specified
            if (config.windowName) {
                await this.executeTmuxCommand([
                    'rename-window',
                    '-t', `${config.sessionName}:0`,
                    config.windowName
                ]);
                this.logger.info('Orchestrator window renamed', { sessionName: config.sessionName, windowName: config.windowName });
            }
            return {
                success: true,
                sessionName: config.sessionName,
                message: 'Orchestrator session created successfully'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to create orchestrator session', {
                sessionName: config.sessionName,
                error: errorMessage
            });
            return {
                success: false,
                sessionName: config.sessionName,
                error: errorMessage
            };
        }
    }
    /**
     * Initialize Claude in orchestrator session
     */
    async initializeOrchestrator(sessionName, timeout = 30000) {
        // Use the new robust agent initialization system with orchestrator role
        const projectPath = process.cwd(); // Orchestrator works from current project directory
        return await this.initializeAgentWithRegistration(sessionName, 'orchestrator', projectPath, timeout);
    }
    /**
     * Send project start prompt to orchestrator
     */
    async sendProjectStartPrompt(sessionName, projectData) {
        try {
            this.logger.info('Sending project start prompt to orchestrator', { sessionName, projectName: projectData.projectName });
            // Check if session exists
            if (!(await this.sessionExists(sessionName))) {
                return {
                    success: false,
                    error: `Session '${sessionName}' does not exist`
                };
            }
            // Build the orchestrator prompt
            const prompt = this.buildOrchestratorPrompt(projectData);
            // Send the prompt to Claude
            await this.sendMessage(sessionName, prompt);
            this.logger.info('Project start prompt sent successfully', { sessionName, projectName: projectData.projectName });
            return {
                success: true,
                message: 'Project start prompt sent to orchestrator'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to send project start prompt', { sessionName, error: errorMessage });
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Wait for Claude to be ready in a session
     */
    async waitForClaudeReady(sessionName, timeout) {
        const startTime = Date.now();
        const checkInterval = 3000; // Check every 3 seconds for Claude ready signal
        while (Date.now() - startTime < timeout) {
            try {
                const output = await this.capturePane(sessionName, 20);
                // Look for Claude ready indicators - specifically the welcome message
                if (output.includes('Welcome to Claude Code!') ||
                    output.includes('claude-code>') ||
                    output.includes('Ready to assist') ||
                    output.includes('How can I help')) {
                    this.logger.info('Claude ready signal detected', { sessionName });
                    return true;
                }
                // Check for error indicators
                if (output.includes('command not found: claude') ||
                    output.includes('No such file or directory') ||
                    output.includes('Permission denied')) {
                    this.logger.error('Claude initialization error detected', { sessionName, output: output.slice(-200) });
                    return false;
                }
                // Wait before next check
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            catch (error) {
                this.logger.warn('Error while waiting for Claude ready signal', { sessionName, error: String(error) });
            }
        }
        this.logger.warn('Timeout waiting for Claude ready signal', { sessionName, timeout });
        return false;
    }
    /**
     * Build orchestrator prompt for project management
     */
    buildOrchestratorPrompt(projectData) {
        const { projectName, projectPath, teamDetails, requirements } = projectData;
        const teamMembers = Array.isArray(teamDetails.members)
            ? teamDetails.members.map((member) => `- ${member.name}: ${member.role} (${member.skills || 'General'})`).join('\n')
            : 'No team members specified';
        const prompt = `I need you to build a full-stack application. The specifications are in ${projectPath}

Please:
1. Create a ${teamDetails.name || 'development team'} (${teamMembers.replace(/- /g, '').replace(/\n/g, ' + ')})
2. Have them build according to the specs in ${projectPath}/.agentmux/specs/
3. Ensure 30-minute git commits
4. Coordinate the team to work on Phase 1 simultaneously

## Project: ${projectName}
**Path**: ${projectPath}
**Requirements**: ${requirements || 'See project documentation in .agentmux/specs/'}

## Team Structure
${teamMembers}

## Your Role as Orchestrator
You are managing the "${projectName}" project. The team sessions have been created for you. Monitor progress, coordinate work between team members, and ensure git commits happen every 30 minutes.

The team is ready to start. Begin by reviewing the project specs and coordinating the team to start Phase 1 development.

Start all teams on Phase 1 simultaneously.`.trim();
        return prompt;
    }
    /**
     * Check if Claude Code CLI is installed
     */
    async checkClaudeInstallation() {
        try {
            // Use direct shell command instead of tmux run-shell for better reliability
            const { spawn } = await import('child_process');
            return new Promise((resolve) => {
                const whichProcess = spawn('which', ['claude']);
                let stdout = '';
                let stderr = '';
                whichProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                whichProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                whichProcess.on('close', (code) => {
                    if (code === 0 && stdout.trim()) {
                        // Claude CLI found, try to get version
                        const versionProcess = spawn('claude', ['--version']);
                        let versionOutput = '';
                        versionProcess.stdout.on('data', (data) => {
                            versionOutput += data.toString();
                        });
                        versionProcess.on('close', (versionCode) => {
                            resolve({
                                installed: true,
                                version: versionCode === 0 ? versionOutput.trim() : 'unknown',
                                message: 'Claude Code CLI is available'
                            });
                        });
                        // Timeout for version check
                        setTimeout(() => {
                            versionProcess.kill();
                            resolve({
                                installed: true,
                                message: 'Claude Code CLI found but version check timed out'
                            });
                        }, 5000);
                    }
                    else {
                        resolve({
                            installed: false,
                            message: 'Claude Code CLI not found. Please install Claude Code to enable agent functionality.'
                        });
                    }
                });
                // Timeout for which command
                setTimeout(() => {
                    whichProcess.kill();
                    resolve({
                        installed: false,
                        message: 'Claude Code installation check timed out'
                    });
                }, 5000);
            });
        }
        catch (error) {
            return {
                installed: false,
                message: `Failed to check Claude installation: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    /**
     * Initialize Claude Code in an existing session
     */
    async initializeClaudeInSession(sessionName) {
        try {
            this.logger.info('Initializing Claude Code in session', { sessionName });
            // Start Claude Code
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                'claude code',
                'Enter'
            ]);
            // Wait for Claude to be ready
            const isReady = await this.waitForClaudeReady(sessionName, 45000);
            if (isReady) {
                this.logger.info('Claude Code initialized successfully', { sessionName });
                return {
                    success: true,
                    message: 'Claude Code initialized and ready'
                };
            }
            else {
                return {
                    success: false,
                    error: 'Claude Code failed to initialize within timeout'
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to initialize Claude Code in session', { sessionName, error: errorMessage });
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Create a new tmux session for a team member
     */
    async createTeamMemberSession(config, sessionName) {
        try {
            this.logger.info('Creating team member session', { sessionName, role: config.role });
            // Kill existing session if it exists to ensure clean initialization  
            if (await this.sessionExists(sessionName)) {
                this.logger.info('Team member session already exists, killing for clean restart', { sessionName });
            }
            await this.killSession(sessionName);
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Create new tmux session
            const createCommand = [
                'new-session',
                '-d',
                '-s', sessionName,
                '-c', config.projectPath || process.cwd(),
            ];
            await this.executeTmuxCommand(createCommand);
            // Set environment variables for MCP connection
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                `export TMUX_SESSION_NAME="${sessionName}"`,
                'Enter'
            ]);
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                `export AGENTMUX_ROLE="${config.role}"`,
                'Enter'
            ]);
            // Use the robust 4-step escalation system for agent initialization
            const initResult = await this.initializeAgentWithRegistration(sessionName, config.role, config.projectPath, 90000, config.memberId);
            if (!initResult.success) {
                throw new Error(`Agent initialization failed: ${initResult.message}`);
            }
            this.logger.info('Agent initialized successfully with registration', {
                sessionName,
                role: config.role,
                message: initResult.message
            });
            // Start streaming output
            this.startOutputStreaming(sessionName);
            this.logger.info('Team member session created successfully', { sessionName, role: config.role });
            return {
                success: true,
                sessionName,
                message: 'Team member session created successfully'
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to create team member session', {
                sessionName,
                role: config.role,
                error: errorMessage
            });
            return {
                success: false,
                sessionName,
                error: errorMessage
            };
        }
    }
    /**
     * Create a new tmux session with Claude Code
     */
    async createSession(config) {
        try {
            const sessionName = config.name.replace(/\s+/g, '_').toLowerCase();
            // Kill existing session if it exists
            await this.killSession(sessionName);
            // Create new tmux session
            const createCommand = [
                'new-session',
                '-d',
                '-s', sessionName,
                '-c', config.projectPath || process.cwd(),
            ];
            await this.executeTmuxCommand(createCommand);
            // Set environment variables for MCP connection
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                `export TMUX_SESSION_NAME="${sessionName}"`,
                'Enter'
            ]);
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                `export AGENTMUX_ROLE="${config.role}"`,
                'Enter'
            ]);
            // Read and execute initialize_claude.sh commands line by line
            await this.executeClaudeInitScript(sessionName, config.projectPath);
            // Start streaming output
            this.startOutputStreaming(sessionName);
            return sessionName;
        }
        catch (error) {
            console.error('Error creating tmux session:', error);
            throw error;
        }
    }
    /**
     * Send a message to a specific tmux session
     */
    async sendMessage(sessionName, message) {
        try {
            // For all messages, send directly without using temporary files
            // The previous file-based approach was causing issues where cat commands
            // were being sent instead of the actual message content
            await this.sendMessageDirect(sessionName, message);
            this.emit('message_sent', { sessionName, message });
            console.log(`Message sent to ${sessionName}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
        }
        catch (error) {
            console.error('Error sending message to tmux session:', error);
            throw error;
        }
    }
    async sendMessageDirect(sessionName, message) {
        try {
            // Clean the message to ensure it works with tmux
            const cleanMessage = message
                .replace(/\r\n/g, '\n') // Normalize line endings
                .replace(/\r/g, '\n') // Handle Mac line endings
                .trim(); // Remove leading/trailing whitespace
            // For very large messages, split into smaller chunks
            const chunkSize = 1500; // Smaller, more conservative chunk size
            if (cleanMessage.length > chunkSize) {
                console.log(`Sending large message (${cleanMessage.length} chars) to ${sessionName} in chunks`);
                // Split message into chunks and send each one (without literal flag to avoid paste behavior)
                for (let i = 0; i < cleanMessage.length; i += chunkSize) {
                    const chunk = cleanMessage.slice(i, i + chunkSize);
                    try {
                        await this.executeTmuxCommand([
                            'send-keys',
                            '-t', sessionName,
                            chunk
                        ]);
                    }
                    catch (error) {
                        console.error(`Error sending chunk ${Math.floor(i / chunkSize) + 1} to ${sessionName}:`, error);
                        throw error;
                    }
                    // Small delay between chunks to avoid overwhelming tmux
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            else {
                // Send message without literal flag to avoid paste behavior in Claude Code
                console.log(`Sending message (${cleanMessage.length} chars) to ${sessionName}`);
                try {
                    // Split into smaller chunks to avoid paste behavior
                    const maxChunk = 200; // Much smaller chunks to avoid paste detection
                    const chunks = [];
                    for (let i = 0; i < cleanMessage.length; i += maxChunk) {
                        chunks.push(cleanMessage.substring(i, i + maxChunk));
                    }
                    for (const chunk of chunks) {
                        await this.executeTmuxCommand([
                            'send-keys',
                            '-t', sessionName,
                            chunk
                        ]);
                        // Small delay between chunks to ensure proper input
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                catch (error) {
                    console.error(`Error sending message to ${sessionName}:`, error);
                    throw error;
                }
            }
            // CRITICAL: Wait for terminal/Claude to process the message before sending Enter
            // This delay allows the UI to register the text input properly
            await new Promise(resolve => setTimeout(resolve, 500));
            // Send Enter key separately to execute the message
            try {
                await this.executeTmuxCommand([
                    'send-keys',
                    '-t', sessionName,
                    'Enter'
                ]);
                console.log(`Enter key sent to ${sessionName}`);
            }
            catch (error) {
                console.error(`Error sending Enter key to ${sessionName}:`, error);
                throw error;
            }
        }
        catch (error) {
            console.error(`Failed to send message to ${sessionName}:`, error);
            throw error;
        }
    }
    /**
     * Send individual key to a specific tmux session (without Enter)
     */
    async sendKey(sessionName, key) {
        try {
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                key
            ]);
            this.emit('key_sent', { sessionName, key });
        }
        catch (error) {
            console.error('Error sending key to tmux session:', error);
            throw error;
        }
    }
    /**
     * Capture terminal output from a session
     */
    async capturePane(sessionName, lines = 100) {
        try {
            const output = await this.executeTmuxCommand([
                'capture-pane',
                '-t', sessionName,
                '-p',
                '-S', `-${lines}`
            ]);
            return output.trim();
        }
        catch (error) {
            console.error('Error capturing pane:', error);
            return '';
        }
    }
    /**
     * Kill a tmux session
     */
    async killSession(sessionName) {
        try {
            await this.executeTmuxCommand([
                'kill-session',
                '-t', sessionName
            ]);
            // Clean up local tracking
            this.sessions.delete(sessionName);
            this.outputBuffers.delete(sessionName);
            this.emit('session_killed', { sessionName });
        }
        catch (error) {
            // Session might not exist, that's ok
            console.log(`Session ${sessionName} does not exist or was already killed`);
        }
    }
    /**
     * List all tmux sessions
     */
    async listSessions() {
        try {
            const output = await this.executeTmuxCommand([
                'list-sessions',
                '-F', '#{session_name}:#{session_created}:#{session_attached}:#{session_windows}'
            ]);
            if (!output.trim()) {
                return [];
            }
            return output.trim().split('\n').map(line => {
                const [sessionName, created, attached, windows] = line.split(':');
                return {
                    sessionName,
                    pid: 0, // tmux doesn't provide PID in this format
                    windows: parseInt(windows) || 1,
                    created: new Date(parseInt(created) * 1000).toISOString(),
                    attached: attached === '1',
                };
            });
        }
        catch (error) {
            console.error('Error listing sessions:', error);
            return [];
        }
    }
    /**
     * Check if a session exists
     */
    async sessionExists(sessionName) {
        try {
            await this.executeTmuxCommand([
                'has-session',
                '-t', sessionName
            ]);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Start streaming output for an existing session (public method)
     */
    enableOutputStreaming(sessionName) {
        this.startOutputStreaming(sessionName);
    }
    /**
     * Start streaming output from a session
     */
    startOutputStreaming(sessionName) {
        // Create a recurring capture to stream output
        const interval = setInterval(async () => {
            try {
                if (!await this.sessionExists(sessionName)) {
                    clearInterval(interval);
                    return;
                }
                const output = await this.capturePane(sessionName, 10);
                const previousBuffer = this.outputBuffers.get(sessionName) || [];
                const currentLines = output.split('\n');
                // Only emit new lines
                if (JSON.stringify(currentLines) !== JSON.stringify(previousBuffer)) {
                    this.outputBuffers.set(sessionName, currentLines);
                    const terminalOutput = {
                        sessionName,
                        content: output,
                        timestamp: new Date().toISOString(),
                        type: 'stdout'
                    };
                    this.emit('output', terminalOutput);
                }
            }
            catch (error) {
                console.error(`Error streaming output for session ${sessionName}:`, error);
                clearInterval(interval);
            }
        }, 1000); // Check every second
    }
    /**
     * Execute tmux initialization script
     */
    async executeTmuxInitScript() {
        try {
            const { readFile } = await import('fs/promises');
            const initScriptPath = '/Users/yellowsunhy/Desktop/projects/justslash/agentmux/config/initialize_tmux.sh';
            // Read the script file
            const scriptContent = await readFile(initScriptPath, 'utf8');
            this.logger.info('Executing tmux initialization script', {
                scriptPath: initScriptPath
            });
            // Execute the script using bash
            const { spawn } = await import('child_process');
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
                        this.logger.info('tmux initialization script completed successfully', { output: output.trim() });
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
                    this.logger.error('Failed to spawn bash for tmux init script', { error: errorMessage });
                    reject(new Error(errorMessage));
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to execute tmux initialization script', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Execute Claude initialization script by reading commands line by line
     */
    async executeClaudeInitScript(sessionName, targetPath) {
        try {
            const { readFile } = await import('fs/promises');
            const initScriptPath = '/Users/yellowsunhy/Desktop/projects/justslash/agentmux/config/initialize_claude.sh';
            // Read the script file
            const scriptContent = await readFile(initScriptPath, 'utf8');
            const commands = scriptContent.trim().split('\n');
            this.logger.info('Executing Claude initialization script', {
                sessionName,
                commandCount: commands.length,
                targetPath: targetPath || process.cwd()
            });
            // First, change to target directory to scope Claude access
            const cdPath = targetPath || process.cwd();
            this.logger.info('Changing directory before Claude init', { sessionName, cdPath });
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                `cd "${cdPath}"`,
                'Enter'
            ]);
            // Wait for cd command to execute
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Execute each command line by line with tmux send-keys
            for (const command of commands) {
                const trimmedCommand = command.trim();
                if (trimmedCommand && !trimmedCommand.startsWith('#')) { // Skip empty lines and comments
                    this.logger.info('Sending command to session', { sessionName, command: trimmedCommand });
                    await this.executeTmuxCommand([
                        'send-keys',
                        '-t', sessionName,
                        trimmedCommand,
                        'Enter'
                    ]);
                    // Wait a moment between commands to ensure proper execution
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            this.logger.info('Claude initialization script completed', { sessionName });
        }
        catch (error) {
            this.logger.error('Failed to execute Claude initialization script', {
                sessionName,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Execute a tmux command (now uses bashrc sourcing by default)
     */
    async executeTmuxCommand(args) {
        // All tmux commands now use bashrc sourcing to ensure tmux is available
        return this.executeTmuxCommandWithBashrc(args);
    }
    /**
     * Execute a tmux command with bashrc sourced first
     */
    async executeTmuxCommandWithBashrc(args) {
        return new Promise((resolve, reject) => {
            // Properly escape arguments for shell execution
            const escapedArgs = args.map(arg => {
                // If arg contains special characters, quote it
                if (arg.includes(' ') || arg.includes('#') || arg.includes(':') || arg.includes('{') || arg.includes('}')) {
                    return `'${arg.replace(/'/g, "'\"'\"'")}'`;
                }
                return arg;
            });
            const tmuxCmd = `tmux ${escapedArgs.join(' ')}`;
            const shellCommand = `source ~/.bashrc 2>/dev/null || true; ${tmuxCmd}`;
            const process = spawn('bash', ['-c', shellCommand]);
            let output = '';
            let error = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.stderr.on('data', (data) => {
                error += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    reject(new Error(`tmux command failed: ${error || `exit code ${code}`}`));
                }
            });
            process.on('error', (err) => {
                reject(new Error(`Failed to spawn bash for tmux: ${err.message}`));
            });
        });
    }
    /**
     * Build system prompt for Claude Code agent
     */
    async buildSystemPrompt(config) {
        // Try to load role-specific prompt from config/prompts directory
        const promptFileName = `${config.role.toLowerCase().replace(/\s+/g, '-')}-prompt.md`;
        const promptPath = path.resolve(process.cwd(), 'config', 'prompts', promptFileName);
        try {
            await access(promptPath);
            let promptContent = await readFile(promptPath, 'utf8');
            // Replace template variables
            promptContent = promptContent.replace(/\{\{SESSION_ID\}\}/g, config.name || 'unknown');
            return promptContent.trim();
        }
        catch (error) {
            // Fallback to generic prompt if specific role prompt not found
            this.logger.warn(`Role-specific prompt not found: ${promptPath}, using fallback`, { role: config.role });
            const fallbackPrompt = `
# AgentMux Agent: ${config.role.toUpperCase()}

You are a ${config.role} agent in the AgentMux system.

## IMPORTANT: Registration Required
Immediately call the 'register_agent_status' tool with your role to register as active, then await further instructions.

Example:
register_agent_status({ "role": "${config.role}" })

After registration, respond with "Agent registered and awaiting instructions" and do nothing else until you receive explicit task assignments.

## Project Context
- Session: ${config.name}
- Role: ${config.role}
- Project Path: ${config.projectPath || 'Not specified'}

Do not take autonomous action. Wait for explicit instructions.
`;
            return fallbackPrompt.trim();
        }
    }
    /**
     * Write system prompt to temporary file
     */
    async writePromptFile(filePath, content) {
        await writeFile(filePath, content, 'utf8');
    }
    /**
     * Initialize agent with progressive escalation until registration succeeds
     */
    async initializeAgentWithRegistration(sessionName, role, projectPath, timeout = 90000, memberId) {
        const startTime = Date.now();
        this.logger.info('Starting agent initialization with registration', {
            sessionName,
            role,
            timeout
        });
        // Clear detection cache to ensure fresh Claude detection
        this.detectionResults.delete(sessionName);
        this.detectionInProgress.set(sessionName, false);
        this.logger.debug('Cleared Claude detection cache', { sessionName });
        // Step 1: Try direct prompt (10 seconds)
        try {
            this.logger.info('Step 1: Attempting direct registration prompt', { sessionName });
            const step1Success = await this.tryDirectRegistration(sessionName, role, 15000, memberId);
            if (step1Success) {
                return { success: true, message: 'Agent registered successfully via direct prompt' };
            }
        }
        catch (error) {
            this.logger.warn('Step 1 failed', { sessionName, error: error instanceof Error ? error.message : String(error) });
        }
        // Step 2: Ctrl+C cleanup + reinit (30 seconds)
        if (Date.now() - startTime < timeout - 35000) {
            try {
                this.logger.info('Step 2: Attempting cleanup and reinitialization', { sessionName });
                const step2Success = await this.tryCleanupAndReinit(sessionName, role, 30000, projectPath, memberId);
                if (step2Success) {
                    return { success: true, message: 'Agent registered successfully after cleanup and reinit' };
                }
            }
            catch (error) {
                this.logger.warn('Step 2 failed', { sessionName, error: error instanceof Error ? error.message : String(error) });
            }
        }
        // Step 3: Full session recreation (45 seconds)
        if (Date.now() - startTime < timeout - 50000) {
            try {
                this.logger.info('Step 3: Attempting full session recreation', { sessionName });
                const step3Success = await this.tryFullRecreation(sessionName, role, 45000, projectPath, memberId);
                if (step3Success) {
                    return { success: true, message: 'Agent registered successfully after full recreation' };
                }
            }
            catch (error) {
                this.logger.warn('Step 3 failed', { sessionName, error: error instanceof Error ? error.message : String(error) });
            }
        }
        // Step 4: Give up
        const errorMsg = `Failed to initialize agent after all escalation attempts (${Math.round((Date.now() - startTime) / 1000)}s)`;
        this.logger.error(errorMsg, { sessionName, role });
        return { success: false, error: errorMsg };
    }
    /**
     * Step 1: Try direct registration prompt
     */
    async tryDirectRegistration(sessionName, role, timeout, memberId) {
        // First check if Claude is running before sending the prompt
        const claudeRunning = await this.detectClaudeWithSlashCommand(sessionName);
        if (!claudeRunning) {
            this.logger.debug('Claude not detected in Step 1, skipping direct registration', { sessionName });
            return false;
        }
        this.logger.debug('Claude detected, sending registration prompt', { sessionName });
        // Send Ctrl+C to cancel any pending slash command from detection
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
        await new Promise(resolve => setTimeout(resolve, 500));
        const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
        await this.sendMessage(sessionName, prompt);
        return await this.waitForRegistration(sessionName, role, timeout);
    }
    /**
     * Step 2: Cleanup with Ctrl+C and reinitialize
     */
    async tryCleanupAndReinit(sessionName, role, timeout, projectPath, memberId) {
        // Send 3 Ctrl+C signals
        for (let i = 0; i < 3; i++) {
            await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Reinitialize Claude using the initialization script
        await this.executeClaudeInitScript(sessionName, projectPath);
        // Wait for Claude to be ready (check for "Welcome to Claude Code!")
        const isReady = await this.waitForClaudeReady(sessionName, 45000);
        if (!isReady) {
            throw new Error('Failed to reinitialize Claude within timeout');
        }
        // Additional verification: Use `/` detection to confirm Claude is responding
        this.logger.debug('Claude welcome detected, verifying with slash command', { sessionName });
        const claudeResponding = await this.detectClaudeWithSlashCommand(sessionName);
        if (!claudeResponding) {
            throw new Error('Claude not responding to commands after initialization');
        }
        this.logger.debug('Claude confirmed ready, sending registration prompt', { sessionName });
        // Send Ctrl+C to cancel any pending slash command from detection
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
        await new Promise(resolve => setTimeout(resolve, 500));
        // Send registration prompt
        const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
        await this.sendMessage(sessionName, prompt);
        return await this.waitForRegistration(sessionName, role, timeout);
    }
    /**
     * Step 3: Kill session and recreate completely
     */
    async tryFullRecreation(sessionName, role, timeout, projectPath, memberId) {
        // Kill existing session
        await this.killSession(sessionName);
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Recreate session based on role
        if (role === 'orchestrator') {
            const config = {
                sessionName,
                projectPath: projectPath || process.cwd()
            };
            const createResult = await this.createOrchestratorSession(config);
            if (!createResult.success) {
                throw new Error(`Failed to recreate orchestrator session: ${createResult.error}`);
            }
            // Initialize Claude for orchestrator using script (stay in agentmux project)
            await this.executeClaudeInitScript(sessionName, process.cwd());
            // Wait for Claude to be ready
            const isReady = await this.waitForClaudeReady(sessionName, 45000);
            if (!isReady) {
                throw new Error('Failed to initialize Claude in recreated orchestrator session within timeout');
            }
            // Additional verification: Use `/` detection to confirm Claude is responding
            this.logger.debug('Claude ready detected for orchestrator, verifying with slash command', { sessionName });
            const claudeResponding = await this.detectClaudeWithSlashCommand(sessionName);
            if (!claudeResponding) {
                throw new Error('Claude not responding to commands after orchestrator recreation');
            }
            this.logger.debug('Claude confirmed ready for orchestrator in Step 3, sending registration prompt', { sessionName });
            // Send Ctrl+C to cancel any pending slash command from detection  
            await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        else {
            // For other roles, create basic session and initialize Claude
            await this.executeTmuxCommand(['new-session', '-d', '-s', sessionName, '-c', projectPath || process.cwd()]);
            // Initialize Claude using the initialization script
            await this.executeClaudeInitScript(sessionName, projectPath);
            // Wait for Claude to be ready
            const isReady = await this.waitForClaudeReady(sessionName, 45000);
            if (!isReady) {
                throw new Error('Failed to initialize Claude in recreated session within timeout');
            }
            // Additional verification: Use `/` detection to confirm Claude is responding
            this.logger.debug('Claude ready detected, verifying with slash command', { sessionName });
            const claudeResponding = await this.detectClaudeWithSlashCommand(sessionName);
            if (!claudeResponding) {
                throw new Error('Claude not responding to commands after full recreation');
            }
            this.logger.debug('Claude confirmed ready in Step 3, sending registration prompt', { sessionName });
            // Send Ctrl+C to cancel any pending slash command from detection
            await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        // Send registration prompt
        const prompt = await this.loadRegistrationPrompt(role, sessionName, memberId);
        await this.sendMessage(sessionName, prompt);
        return await this.waitForRegistration(sessionName, role, timeout);
    }
    /**
     * Load registration prompt from config files
     */
    async loadRegistrationPrompt(role, sessionName, memberId) {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const promptPath = path.join(process.cwd(), 'config', 'prompts', `${role}-prompt.md`);
            let prompt = await fs.readFile(promptPath, 'utf8');
            // Replace session ID and member ID placeholders
            prompt = prompt.replace(/\{\{SESSION_ID\}\}/g, sessionName);
            if (memberId) {
                prompt = prompt.replace(/\{\{MEMBER_ID\}\}/g, memberId);
            }
            else {
                // For orchestrator or cases without member ID, remove the memberId parameter
                prompt = prompt.replace(/,\s*"memberId":\s*"\{\{MEMBER_ID\}\}"/g, '');
            }
            return prompt;
        }
        catch (error) {
            // Fallback to inline prompt if file doesn't exist
            this.logger.warn('Could not load prompt from config, using fallback', { role, error: error instanceof Error ? error.message : String(error) });
            return `Please immediately run: register_agent_status with parameters {"role": "${role}", "sessionId": "${sessionName}"}`;
        }
    }
    /**
     * Wait for agent registration to complete
     */
    async waitForRegistration(sessionName, role, timeout) {
        const startTime = Date.now();
        const checkInterval = 5000; // Check every 5 seconds to prevent overlapping with `/` detection
        while (Date.now() - startTime < timeout) {
            try {
                if (await this.checkAgentRegistration(sessionName, role)) {
                    this.logger.info('Agent registration confirmed', { sessionName, role });
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            catch (error) {
                this.logger.warn('Error checking registration', { sessionName, role, error: error instanceof Error ? error.message : String(error) });
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }
        this.logger.warn('Timeout waiting for agent registration', { sessionName, role, timeout });
        return false;
    }
    /**
     * Check if agent is properly registered
     */
    async checkAgentRegistration(sessionName, role) {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');
            const os = await import('os');
            // Step 1: Check if tmux session exists
            if (!(await this.sessionExists(sessionName))) {
                this.logger.debug('Session does not exist', { sessionName });
                return false;
            }
            // Step 2: Use `/` command to detect if Claude is running
            const claudeRunning = await this.detectClaudeWithSlashCommand(sessionName);
            if (!claudeRunning) {
                this.logger.debug('Claude not detected in session', { sessionName });
                return false;
            }
            // Step 3: Check registration status
            if (role === 'orchestrator') {
                // For orchestrator, check teams.json orchestrator status
                try {
                    const teamsPath = path.join(os.homedir(), '.agentmux', 'teams.json');
                    const teamsData = await fs.readFile(teamsPath, 'utf8');
                    const data = JSON.parse(teamsData);
                    // Handle both new format and old format
                    if (data.orchestrator) {
                        return data.orchestrator.status === 'active';
                    }
                    // Also check terminal output for confirmation messages
                    const output = await this.capturePane(sessionName, 15);
                    const registrationIndicators = [
                        'registered as the orchestrator',
                        'Perfect! I\'m now registered',
                        'I\'m now registered as the orchestrator',
                        'registered successfully',
                        'I\'m ready to coordinate',
                        'ready to coordinate and manage',
                        'registered as active',
                        'registration complete'
                    ];
                    const outputLower = output.toLowerCase();
                    for (const indicator of registrationIndicators) {
                        if (outputLower.includes(indicator.toLowerCase())) {
                            this.logger.info('Found orchestrator registration confirmation', {
                                sessionName,
                                indicator,
                                output: output.slice(-200)
                            });
                            return true;
                        }
                    }
                }
                catch (error) {
                    this.logger.debug('Could not check orchestrator status in teams.json', { error: error instanceof Error ? error.message : String(error) });
                }
                return false;
            }
            // For team members, check teams.json
            const teamsPath = path.join(os.homedir(), '.agentmux', 'teams.json');
            try {
                const teamsData = await fs.readFile(teamsPath, 'utf8');
                const data = JSON.parse(teamsData);
                // Handle both new format (data.teams) and old format (array)
                const teams = data.teams || (Array.isArray(data) ? data : []);
                // Find team member with matching sessionName
                for (const team of teams) {
                    if (team.members) {
                        for (const member of team.members) {
                            if (member.sessionName === sessionName && member.role === role) {
                                return true;
                            }
                        }
                    }
                }
            }
            catch (error) {
                this.logger.debug('Could not read teams.json', { error: error instanceof Error ? error.message : String(error) });
            }
            return false;
        }
        catch (error) {
            this.logger.error('Error checking agent registration', { sessionName, role, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
    /**
     * Detect if Claude Code is running using the `/` command trick
     */
    async detectClaudeWithSlashCommand(sessionName) {
        try {
            // First check if we have a recent cached result
            const cached = this.detectionResults.get(sessionName);
            if (cached && (Date.now() - cached.timestamp) < 30000) {
                this.logger.debug('Using cached Claude detection result (immediate)', { sessionName, isClaudeRunning: cached.isClaudeRunning, age: Date.now() - cached.timestamp });
                return cached.isClaudeRunning;
            }
            // Check if detection is already in progress
            if (this.detectionInProgress.get(sessionName)) {
                this.logger.debug('Claude detection already in progress, using cached result if available', { sessionName });
                // Return cached result if recent (within last 30 seconds)
                const cached = this.detectionResults.get(sessionName);
                if (cached && (Date.now() - cached.timestamp) < 30000) {
                    this.logger.debug('Using cached Claude detection result', { sessionName, isClaudeRunning: cached.isClaudeRunning, age: Date.now() - cached.timestamp });
                    return cached.isClaudeRunning;
                }
                // Wait for ongoing detection to complete
                let attempts = 0;
                while (this.detectionInProgress.get(sessionName) && attempts < 20) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    attempts++;
                }
                // Return cached result if detection completed
                const result = this.detectionResults.get(sessionName);
                if (result && (Date.now() - result.timestamp) < 30000) {
                    this.logger.debug('Using cached result after waiting', { sessionName, isClaudeRunning: result.isClaudeRunning });
                    return result.isClaudeRunning;
                }
            }
            // Set detection in progress
            this.detectionInProgress.set(sessionName, true);
            this.logger.debug('Starting Claude detection via slash command', { sessionName });
            // Step 1: Capture current terminal content length
            const beforeOutput = await this.capturePane(sessionName, 50);
            const beforeLength = beforeOutput.length;
            // Step 2: Send `/` command
            await this.executeTmuxCommand(['send-keys', '-t', sessionName, '/']);
            // Step 3: Wait for response
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Step 4: Capture terminal content after
            const afterOutput = await this.capturePane(sessionName, 50);
            const afterLength = afterOutput.length;
            const lengthDifference = afterLength - beforeLength;
            this.logger.debug('Claude detection via slash command completed', {
                sessionName,
                beforeLength,
                afterLength,
                lengthDifference
            });
            // Analyze the difference:
            // 0 difference = unresponsive
            // < 3 chars = regular terminal (just echoed `/`)
            // > 3 chars = Claude Code (command palette appeared)
            let isClaudeRunning = false;
            if (lengthDifference === 0) {
                this.logger.debug('Terminal appears unresponsive', { sessionName });
                isClaudeRunning = false;
            }
            else if (lengthDifference < 3) {
                this.logger.debug('Regular terminal detected (not Claude)', { sessionName, lengthDifference });
                isClaudeRunning = false;
            }
            else {
                this.logger.debug('Claude Code detected (command palette)', { sessionName, lengthDifference });
                isClaudeRunning = true;
                // Send Escape to close the command palette
                await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'Escape']);
            }
            // Cache the result
            this.detectionResults.set(sessionName, {
                isClaudeRunning,
                timestamp: Date.now()
            });
            return isClaudeRunning;
        }
        catch (error) {
            this.logger.error('Error detecting Claude with slash command', { sessionName, error: error instanceof Error ? error.message : String(error) });
            return false;
        }
        finally {
            // Always clear the detection in progress flag
            this.detectionInProgress.set(sessionName, false);
        }
    }
}
//# sourceMappingURL=tmux.service.js.map