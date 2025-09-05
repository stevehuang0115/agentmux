import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { writeFile } from 'fs/promises';
import { LoggerService } from './logger.service.js';
export class TmuxService extends EventEmitter {
    sessions = new Map();
    outputBuffers = new Map();
    logger;
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
        try {
            this.logger.info('Initializing orchestrator with Claude', { sessionName, timeout });
            // Check if session exists
            if (!(await this.sessionExists(sessionName))) {
                return {
                    success: false,
                    error: `Session '${sessionName}' does not exist`
                };
            }
            // Source bashrc to ensure proper environment
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                'source ~/.bashrc',
                'Enter'
            ]);
            // Wait a moment for bashrc to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Start Claude with dangerous skip permissions
            await this.executeTmuxCommand([
                'send-keys',
                '-t', sessionName,
                'claude --dangerously-skip-permissions',
                'Enter'
            ]);
            this.logger.info('Claude initialization command sent', { sessionName });
            // Wait for Claude to be ready
            const isReady = await this.waitForClaudeReady(sessionName, timeout);
            if (isReady) {
                this.logger.info('Orchestrator Claude initialization complete', { sessionName });
                return {
                    success: true,
                    message: 'Orchestrator initialized with Claude successfully'
                };
            }
            else {
                this.logger.error('Timeout waiting for Claude to initialize', { sessionName, timeout });
                return {
                    success: false,
                    error: `Timeout waiting for Claude to initialize (${timeout}ms)`
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to initialize orchestrator', { sessionName, error: errorMessage });
            return {
                success: false,
                error: errorMessage
            };
        }
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
        const checkInterval = 2000; // Check every 2 seconds
        while (Date.now() - startTime < timeout) {
            try {
                const output = await this.capturePane(sessionName, 20);
                // Look for Claude ready indicators
                if (output.includes('Claude Code') ||
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
            // Check if session already exists
            if (await this.sessionExists(sessionName)) {
                this.logger.info('Team member session already exists', { sessionName });
                return {
                    success: true,
                    sessionName,
                    message: 'Session already exists'
                };
            }
            // Kill existing session if it exists (cleanup)
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
            await this.executeClaudeInitScript(sessionName);
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
            await this.executeClaudeInitScript(sessionName);
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
                // Split message into chunks and send each one
                for (let i = 0; i < cleanMessage.length; i += chunkSize) {
                    const chunk = cleanMessage.slice(i, i + chunkSize);
                    try {
                        await this.executeTmuxCommand([
                            'send-keys',
                            '-t', sessionName,
                            '-l', // Use literal flag to prevent flag interpretation
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
                // Send message directly with literal flag for smaller messages
                console.log(`Sending message (${cleanMessage.length} chars) to ${sessionName}`);
                try {
                    await this.executeTmuxCommand([
                        'send-keys',
                        '-t', sessionName,
                        '-l', // Use literal flag to prevent flag interpretation
                        cleanMessage
                    ]);
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
    async executeClaudeInitScript(sessionName) {
        try {
            const { readFile } = await import('fs/promises');
            const initScriptPath = '/Users/yellowsunhy/Desktop/projects/justslash/agentmux/config/initialize_claude.sh';
            // Read the script file
            const scriptContent = await readFile(initScriptPath, 'utf8');
            const commands = scriptContent.trim().split('\n');
            this.logger.info('Executing Claude initialization script', {
                sessionName,
                commandCount: commands.length
            });
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
    buildSystemPrompt(config) {
        const basePrompt = `
# AgentMux Agent: ${config.role.toUpperCase()}

You are a ${config.role} agent in the AgentMux system. You have access to MCP tools for team communication and project management.

## Your Role
${config.systemPrompt}

## MCP Tools Available
- send_message: Communicate with other agents
- get_tickets: Retrieve project tickets
- update_ticket: Modify ticket status and details
- report_progress: Update progress on assigned tasks
- get_team_status: Check status of other team members

## Git Discipline
- Commit changes every 30 minutes maximum
- Write descriptive commit messages
- Always check git status before major operations

## Communication Protocol
- Use send_message for inter-agent communication
- Report progress regularly using report_progress
- Check in with team leads when blocked

## Project Context
Session: ${config.name}
Role: ${config.role}
Project Path: ${config.projectPath || 'Not specified'}

Work autonomously within your role boundaries and communicate effectively with your team.
`;
        return basePrompt.trim();
    }
    /**
     * Write system prompt to temporary file
     */
    async writePromptFile(filePath, content) {
        await writeFile(filePath, content, 'utf8');
    }
}
//# sourceMappingURL=tmux.service.js.map