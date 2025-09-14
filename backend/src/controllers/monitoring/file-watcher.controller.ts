import { Request, Response } from 'express';
import { FileWatcherService, GitIntegrationService, LoggerService, StorageService } from '../../services/index.js';

export class FileWatcherController {
  private fileWatcher: FileWatcherService;
  private gitIntegration: GitIntegrationService;
  private logger: LoggerService;
  private storage: StorageService;

  constructor() {
    this.fileWatcher = new FileWatcherService();
    this.gitIntegration = new GitIntegrationService();
    this.logger = LoggerService.getInstance();
    this.storage = StorageService.getInstance();
  }

  /**
   * Start watching a project
   */
  async startWatching(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { projectPath } = req.body;

      if (!projectId || !projectPath) {
        res.status(400).json({ error: 'Project ID and path are required' });
        return;
      }

      await this.fileWatcher.watchProject(projectId, projectPath);
      
      res.json({
        success: true,
        message: `Started watching project ${projectId}`,
        stats: this.fileWatcher.getStats()
      });
    } catch (error) {
      this.logger.error('Failed to start watching project:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to start watching project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Stop watching a project
   */
  async stopWatching(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      await this.fileWatcher.stopWatchingProject(projectId);
      
      res.json({
        success: true,
        message: `Stopped watching project ${projectId}`,
        stats: this.fileWatcher.getStats()
      });
    } catch (error) {
      this.logger.error('Failed to stop watching project:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to stop watching project',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get file watcher statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.fileWatcher.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get watcher stats:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to get watcher stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get list of watched projects
   */
  async getWatchedProjects(req: Request, res: Response): Promise<void> {
    try {
      const watchedProjects = this.fileWatcher.getWatchedProjects();
      
      res.json({
        success: true,
        data: watchedProjects
      });
    } catch (error) {
      this.logger.error('Failed to get watched projects:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to get watched projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start watching all active projects
   */
  async startWatchingAll(req: Request, res: Response): Promise<void> {
    try {
      await this.fileWatcher.watchAllProjects();
      
      res.json({
        success: true,
        message: 'Started watching all active projects',
        stats: this.fileWatcher.getStats()
      });
    } catch (error) {
      this.logger.error('Failed to start watching all projects:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to start watching all projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get git status for a project
   */
  async getGitStatus(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath } = req.body;

      if (!projectPath) {
        res.status(400).json({ error: 'Project path is required' });
        return;
      }

      const gitStatus = await this.gitIntegration.getGitStatus(projectPath);
      
      res.json({
        success: true,
        data: gitStatus
      });
    } catch (error) {
      this.logger.error('Failed to get git status:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to get git status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Commit changes for a project
   */
  async commitChanges(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath, message, autoGenerate, author } = req.body;

      if (!projectPath) {
        res.status(400).json({ error: 'Project path is required' });
        return;
      }

      const commitResult = await this.gitIntegration.commitChanges(projectPath, {
        message,
        autoGenerate,
        author
      });
      
      res.json({
        success: true,
        message: commitResult === 'no-changes' ? 'No changes to commit' : 'Changes committed successfully',
        data: { commitResult }
      });
    } catch (error) {
      this.logger.error('Failed to commit changes:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to commit changes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start scheduled commits for a project
   */
  async startScheduledCommits(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath, intervalMinutes, enabled, autoMessage, branchStrategy } = req.body;

      if (!projectPath) {
        res.status(400).json({ error: 'Project path is required' });
        return;
      }

      await this.gitIntegration.startScheduledCommits(projectPath, {
        enabled: enabled !== undefined ? enabled : true,
        intervalMinutes: intervalMinutes || 30,
        autoMessage: autoMessage !== undefined ? autoMessage : true,
        branchStrategy: branchStrategy || 'feature'
      });
      
      res.json({
        success: true,
        message: `Started scheduled commits for project`,
        data: {
          projectPath,
          intervalMinutes: intervalMinutes || 30
        }
      });
    } catch (error) {
      this.logger.error('Failed to start scheduled commits:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to start scheduled commits',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Stop scheduled commits for a project
   */
  async stopScheduledCommits(req: Request, res: Response): Promise<void> {
    try {
      const { projectPath } = req.body;

      if (!projectPath) {
        res.status(400).json({ error: 'Project path is required' });
        return;
      }

      this.gitIntegration.stopScheduledCommits(projectPath);
      
      res.json({
        success: true,
        message: `Stopped scheduled commits for project`,
        data: { projectPath }
      });
    } catch (error) {
      this.logger.error('Failed to stop scheduled commits:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to stop scheduled commits',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get projects with scheduled commits
   */
  async getScheduledProjects(req: Request, res: Response): Promise<void> {
    try {
      const scheduledProjects = this.gitIntegration.getScheduledProjects();
      
      res.json({
        success: true,
        data: scheduledProjects
      });
    } catch (error) {
      this.logger.error('Failed to get scheduled projects:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        error: 'Failed to get scheduled projects',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}