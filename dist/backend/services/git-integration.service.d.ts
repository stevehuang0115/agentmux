export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: number;
    unstaged: number;
    untracked: number;
    hasChanges: boolean;
    lastCommit?: {
        hash: string;
        message: string;
        author: string;
        date: Date;
    };
}
export interface GitCommitOptions {
    message?: string;
    autoGenerate?: boolean;
    author?: string;
    co_authors?: string[];
    includeUntracked?: boolean;
    dryRun?: boolean;
}
export interface ScheduledCommitConfig {
    enabled: boolean;
    intervalMinutes: number;
    autoMessage: boolean;
    branchStrategy: 'main' | 'feature' | 'task';
}
export declare class GitIntegrationService {
    private logger;
    private config;
    private storage;
    private projectPath;
    private commitTimers;
    private lastCommitTimes;
    private defaultCommitConfig;
    constructor(projectPath?: string);
    /**
     * Get git status for a project
     */
    getGitStatus(projectPath?: string): Promise<GitStatus>;
    /**
     * Commit changes with auto-generated or custom message
     */
    commitChanges(projectPath: string, options?: GitCommitOptions): Promise<string>;
    /**
     * Generate intelligent commit message based on changes
     */
    private generateCommitMessage;
    /**
     * Build git commit command with options
     */
    private buildCommitCommand;
    /**
     * Start scheduled commits for a project
     */
    startScheduledCommits(projectPath: string, config?: Partial<ScheduledCommitConfig>): Promise<void>;
    /**
     * Stop scheduled commits for a project
     */
    stopScheduledCommits(projectPath: string): void;
    /**
     * Perform a scheduled commit
     */
    private performScheduledCommit;
    /**
     * Get projects with scheduled commits
     */
    getScheduledProjects(): string[];
    /**
     * Check if a path is a git repository
     */
    isGitRepository(projectPath?: string): Promise<boolean>;
    /**
     * Get repository statistics
     */
    getRepositoryStats(): Promise<{
        totalCommits: number;
        contributors: number;
        branches: number;
    }>;
    /**
     * Get last commit information
     */
    getLastCommitInfo(): Promise<{
        hash: string;
        message: string;
        author: string;
        date: Date;
    } | null>;
    /**
     * Commit changes (alias for commitChanges)
     */
    commit(options?: GitCommitOptions): Promise<string>;
    /**
     * Initialize git repository
     */
    initializeGitRepository(): Promise<void>;
    /**
     * Start auto commit timer (alias for startScheduledCommits)
     */
    startAutoCommitTimer(intervalMinutes?: number): Promise<void>;
    /**
     * Get commit history
     */
    getCommitHistory(limit?: number): Promise<Array<{
        hash: string;
        message: string;
        author: string;
        date: Date;
    }>>;
    /**
     * Create a new branch
     */
    createBranch(branchName: string, fromBranch?: string): Promise<void>;
    /**
     * Create pull request (placeholder - would integrate with GitHub/GitLab API)
     */
    createPullRequest(options: {
        title: string;
        description: string;
        sourceBranch: string;
        targetBranch: string;
    }): Promise<{
        url: string;
        number: number;
    }>;
    cleanup(): void;
}
//# sourceMappingURL=git-integration.service.d.ts.map