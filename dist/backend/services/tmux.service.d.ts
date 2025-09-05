import { EventEmitter } from 'events';
import { SessionInfo, TeamMemberSessionConfig } from '../types/index.js';
export interface OrchestratorConfig {
    sessionName: string;
    projectPath: string;
    windowName?: string;
}
export declare class TmuxService extends EventEmitter {
    private sessions;
    private outputBuffers;
    private logger;
    constructor();
    /**
     * Initialize tmux server if not running
     */
    initialize(): Promise<void>;
    /**
     * Ensure tmux server is running using the initialize_tmux.sh script
     */
    private ensureTmuxServer;
    /**
     * Create orchestrator session for project management
     */
    createOrchestratorSession(config: OrchestratorConfig): Promise<{
        success: boolean;
        sessionName: string;
        message?: string;
        error?: string;
    }>;
    /**
     * Initialize Claude in orchestrator session
     */
    initializeOrchestrator(sessionName: string, timeout?: number): Promise<{
        success: boolean;
        message?: string;
        error?: string;
    }>;
    /**
     * Send project start prompt to orchestrator
     */
    sendProjectStartPrompt(sessionName: string, projectData: {
        projectName: string;
        projectPath: string;
        teamDetails: any;
        requirements?: string;
    }): Promise<{
        success: boolean;
        message?: string;
        error?: string;
    }>;
    /**
     * Wait for Claude to be ready in a session
     */
    private waitForClaudeReady;
    /**
     * Build orchestrator prompt for project management
     */
    private buildOrchestratorPrompt;
    /**
     * Check if Claude Code CLI is installed
     */
    checkClaudeInstallation(): Promise<{
        installed: boolean;
        version?: string;
        message: string;
    }>;
    /**
     * Initialize Claude Code in an existing session
     */
    initializeClaudeInSession(sessionName: string): Promise<{
        success: boolean;
        message?: string;
        error?: string;
    }>;
    /**
     * Create a new tmux session for a team member
     */
    createTeamMemberSession(config: TeamMemberSessionConfig, sessionName: string): Promise<{
        success: boolean;
        sessionName?: string;
        message?: string;
        error?: string;
    }>;
    /**
     * Create a new tmux session with Claude Code
     */
    createSession(config: TeamMemberSessionConfig): Promise<string>;
    /**
     * Send a message to a specific tmux session
     */
    sendMessage(sessionName: string, message: string): Promise<void>;
    private sendMessageDirect;
    /**
     * Send individual key to a specific tmux session (without Enter)
     */
    sendKey(sessionName: string, key: string): Promise<void>;
    /**
     * Capture terminal output from a session
     */
    capturePane(sessionName: string, lines?: number): Promise<string>;
    /**
     * Kill a tmux session
     */
    killSession(sessionName: string): Promise<void>;
    /**
     * List all tmux sessions
     */
    listSessions(): Promise<SessionInfo[]>;
    /**
     * Check if a session exists
     */
    sessionExists(sessionName: string): Promise<boolean>;
    /**
     * Start streaming output for an existing session (public method)
     */
    enableOutputStreaming(sessionName: string): void;
    /**
     * Start streaming output from a session
     */
    private startOutputStreaming;
    /**
     * Execute tmux initialization script
     */
    private executeTmuxInitScript;
    /**
     * Execute Claude initialization script by reading commands line by line
     */
    private executeClaudeInitScript;
    /**
     * Execute a tmux command (now uses bashrc sourcing by default)
     */
    private executeTmuxCommand;
    /**
     * Execute a tmux command with bashrc sourced first
     */
    private executeTmuxCommandWithBashrc;
    /**
     * Build system prompt for Claude Code agent
     */
    private buildSystemPrompt;
    /**
     * Write system prompt to temporary file
     */
    private writePromptFile;
}
//# sourceMappingURL=tmux.service.d.ts.map