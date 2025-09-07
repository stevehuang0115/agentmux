export interface TaskAssignmentData {
    projectName: string;
    projectPath: string;
    taskId: string;
    taskTitle: string;
    taskDescription?: string;
    taskPriority?: string;
    taskMilestone?: string;
}
export declare class PromptTemplateService {
    private templatesPath;
    constructor(templatesPath?: string);
    /**
     * Load and process orchestrator task assignment template
     */
    getOrchestratorTaskAssignmentPrompt(data: TaskAssignmentData): Promise<string>;
    /**
     * Extract and process team member task assignment prompt from orchestrator template
     */
    getTeamMemberTaskAssignmentPrompt(data: TaskAssignmentData): Promise<string>;
    /**
     * Process template by replacing placeholders with actual values
     */
    private processTemplate;
}
//# sourceMappingURL=prompt-template.service.d.ts.map