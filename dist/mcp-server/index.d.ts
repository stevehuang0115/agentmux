#!/usr/bin/env node
declare class AgentMuxMCP {
    private server;
    private sessionName;
    private apiBaseUrl;
    private projectPath;
    private agentRole;
    private requestQueue;
    private lastCleanup;
    constructor();
    private registerTools;
    /**
     * Communication Tools
     */
    private sendMessage;
    private broadcast;
    /**
     * Team Status Tools
     */
    private getTeamStatus;
    private analyzeAgentStatus;
    private extractLastActivity;
    /**
     * Ticket Management Tools
     */
    private getTickets;
    private updateTicket;
    /**
     * Progress Reporting Tools
     */
    private reportProgress;
    private requestReview;
    /**
     * Scheduling Tools
     */
    private scheduleCheck;
    /**
     * Git Management Tools
     */
    private enforceCommit;
    /**
     * Orchestrator-only Tools
     */
    private createTeam;
    private delegateTask;
    /**
     * Context Loading Tools
     */
    private loadProjectContext;
    private getContextSummary;
    private refreshAgentContext;
    private extractContextSection;
    /**
     * Task Management Tools
     */
    private assignTask;
    private acceptTask;
    private completeTask;
    private blockTask;
    private takeNextTask;
    private syncTaskStatus;
    private checkTeamProgress;
    private readTaskFile;
    private reportReady;
    private registerAgentStatus;
    /**
     * Resource Management
     */
    private cleanup;
    private checkRateLimit;
    /**
     * Helper Functions
     */
    private findProjectManager;
    private findQAEngineer;
    private getActiveSessions;
    private parseTicketFile;
    private extractSection;
    private generateTicketFile;
    private getDefaultPrompt;
    private writeSystemPrompt;
    private logMessage;
    private logScheduledCheck;
    private getToolDefinitions;
    start(): Promise<void>;
    private startHttpServer;
}
export default AgentMuxMCP;
//# sourceMappingURL=index.d.ts.map