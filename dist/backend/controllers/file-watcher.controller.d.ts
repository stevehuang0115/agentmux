import { Request, Response } from 'express';
export declare class FileWatcherController {
    private fileWatcher;
    private gitIntegration;
    private logger;
    private storage;
    constructor();
    /**
     * Start watching a project
     */
    startWatching(req: Request, res: Response): Promise<void>;
    /**
     * Stop watching a project
     */
    stopWatching(req: Request, res: Response): Promise<void>;
    /**
     * Get file watcher statistics
     */
    getStats(req: Request, res: Response): Promise<void>;
    /**
     * Get list of watched projects
     */
    getWatchedProjects(req: Request, res: Response): Promise<void>;
    /**
     * Start watching all active projects
     */
    startWatchingAll(req: Request, res: Response): Promise<void>;
    /**
     * Get git status for a project
     */
    getGitStatus(req: Request, res: Response): Promise<void>;
    /**
     * Commit changes for a project
     */
    commitChanges(req: Request, res: Response): Promise<void>;
    /**
     * Start scheduled commits for a project
     */
    startScheduledCommits(req: Request, res: Response): Promise<void>;
    /**
     * Stop scheduled commits for a project
     */
    stopScheduledCommits(req: Request, res: Response): Promise<void>;
    /**
     * Get projects with scheduled commits
     */
    getScheduledProjects(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=file-watcher.controller.d.ts.map