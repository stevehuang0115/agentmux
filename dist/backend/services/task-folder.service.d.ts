export declare class TaskFolderService {
    /**
     * Creates the status folder structure for a milestone
     * Creates: open/, in_progress/, done/, blocked/ folders
     */
    createMilestoneStatusFolders(milestonePath: string): Promise<void>;
    /**
     * Creates m0_defining_project milestone with status folders
     */
    createM0DefininingProjectMilestone(projectPath: string): Promise<string>;
    /**
     * Ensures all existing milestone folders have status subfolders
     */
    ensureStatusFoldersForProject(projectPath: string): Promise<void>;
    /**
     * Moves a task file between status folders
     */
    moveTaskToStatus(taskFilePath: string, newStatus: 'open' | 'in_progress' | 'done' | 'blocked'): Promise<string>;
    /**
     * Creates a task file in the specified status folder
     */
    createTaskFile(milestonePath: string, taskFileName: string, taskContent: string, status?: 'open' | 'in_progress' | 'done' | 'blocked'): Promise<string>;
    /**
     * Lists all task files in a specific status folder
     */
    getTasksInStatus(milestonePath: string, status: 'open' | 'in_progress' | 'done' | 'blocked'): Promise<string[]>;
    /**
     * Gets task file path by scanning all status folders for a task
     */
    findTaskFile(milestonePath: string, taskFileName: string): Promise<string | null>;
    /**
     * Gets the current status of a task based on which folder it's in
     */
    getTaskStatus(milestonePath: string, taskFileName: string): Promise<'open' | 'in_progress' | 'done' | 'blocked' | 'not_found'>;
    /**
     * Creates a task file from a JSON step configuration
     */
    generateTaskFileContent(step: any, projectName: string, projectPath: string, projectId: string, initialGoal?: string, userJourney?: string): string;
}
//# sourceMappingURL=task-folder.service.d.ts.map