export interface ProjectStartRequest {
    projectId: string;
    teamId: string;
}
export interface WorkflowStep {
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    message?: string;
    error?: string;
    timestamp: Date;
}
export interface WorkflowExecution {
    id: string;
    type: 'project_start';
    projectId: string;
    teamId: string;
    steps: WorkflowStep[];
    status: 'running' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
    orchestratorSession?: string;
}
export declare class WorkflowService {
    private static instance;
    private logger;
    private tmuxService;
    private storageService;
    private activeExecutions;
    private constructor();
    static getInstance(): WorkflowService;
    /**
     * Start a project with full orchestration workflow
     */
    startProject(request: ProjectStartRequest): Promise<{
        success: boolean;
        executionId: string;
        message?: string;
        error?: string;
    }>;
    /**
     * Get workflow execution status
     */
    getExecution(executionId: string): WorkflowExecution | null;
    /**
     * Get all active executions
     */
    getActiveExecutions(): WorkflowExecution[];
    /**
     * Cancel a running workflow
     */
    cancelExecution(executionId: string): Promise<boolean>;
    /**
     * Create the steps for project start workflow
     */
    private createProjectStartSteps;
    /**
     * Execute the project start workflow
     */
    private executeProjectStartWorkflow;
    /**
     * Execute a single workflow step
     */
    private executeStep;
    /**
     * Start background monitoring of team setup
     */
    private startTeamSetupMonitoring;
    /**
     * Get project by ID
     */
    private getProjectById;
    /**
     * Get team by ID
     */
    private getTeamById;
    /**
     * Send comprehensive project instructions to a team member
     */
    private sendTeamMemberPrompt;
    /**
     * Build comprehensive prompt for team members
     */
    private buildTeamMemberPrompt;
    /**
     * Cleanup resources
     */
    shutdown(): void;
}
//# sourceMappingURL=workflow.service.d.ts.map