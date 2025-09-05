import { EventEmitter } from 'events';
export interface FileChangeEvent {
    type: 'created' | 'modified' | 'deleted';
    filepath: string;
    relativePath: string;
    timestamp: Date;
    projectId: string;
    category: 'specs' | 'tasks' | 'memory' | 'prompts' | 'other';
}
export interface WatcherStats {
    totalWatched: number;
    activeProjects: number;
    eventsToday: number;
    lastEvent: Date | null;
}
export declare class FileWatcherService extends EventEmitter {
    private logger;
    private config;
    private storage;
    private watchers;
    private projectWatchers;
    private eventCounts;
    private debounceTimers;
    private lastEvents;
    constructor();
    /**
     * Start watching a project's .agentmux directory
     */
    watchProject(projectId: string, projectPath: string): Promise<void>;
    /**
     * Stop watching a project
     */
    stopWatchingProject(projectId: string): Promise<void>;
    /**
     * Create a file system watcher for a specific directory
     */
    private createWatcher;
    /**
     * Handle file change events with debouncing
     */
    private handleFileChange;
    /**
     * Process the actual file change event
     */
    private processFileChange;
    /**
     * Determine the type of change (created, modified, deleted)
     */
    private determineChangeType;
    /**
     * Categorize file based on its path
     */
    private categorizeFile;
    /**
     * Check if a file should be ignored
     */
    private shouldIgnoreFile;
    /**
     * Trigger specific actions based on file type
     */
    private triggerFileSpecificActions;
    /**
     * Update statistics for the file change
     */
    private updateStats;
    /**
     * Get watcher statistics
     */
    getStats(): WatcherStats;
    /**
     * Get watched projects
     */
    getWatchedProjects(): string[];
    /**
     * Check if a project is being watched
     */
    isWatching(projectId: string): boolean;
    /**
     * Watch all existing projects
     */
    watchAllProjects(): Promise<void>;
    /**
     * Cleanup all watchers
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=file-watcher.service.d.ts.map