import { FileStorage } from '../services/FileStorage.js';
import { TmuxManager } from '../tmux.js';
import { ActivityPoller } from '../services/ActivityPoller.js';
/**
 * MCP Server for AgentMux Integration
 * Phase 3 (Optional) - Provides Claude Code with AgentMux control capabilities
 *
 * Key Features:
 * - Project lifecycle management
 * - Team creation and assignment
 * - Tmux session monitoring
 * - Activity tracking and reporting
 * - Real-time status updates
 */
export declare class AgentMuxMCPServer {
    private server;
    private storage;
    private tmuxManager;
    private activityPoller;
    constructor(storage: FileStorage, tmuxManager: TmuxManager, activityPoller: ActivityPoller);
    private setupHandlers;
    private handleCreateProject;
    private handleListProjects;
    private handleGetProjectDetails;
    private handleCreateTeam;
    private handleListTeams;
    private handleAssignTeamToProject;
    private handleListAssignments;
    private handleGetActivityStatus;
    private handleGetActivityTimeline;
    private handleListTmuxSessions;
    private handleCaptureSessionOutput;
    private handlePauseTeam;
    private handleResumeTeam;
    private handleEndAssignment;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=MCPServer.d.ts.map