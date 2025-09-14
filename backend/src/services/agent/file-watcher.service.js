import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { LoggerService } from '../core/logger.service.js';
import { ConfigService } from '../core/config.service.js';
import { StorageService } from '../core/storage.service.js';
export class FileWatcherService extends EventEmitter {
    logger;
    config;
    storage;
    watchers = new Map();
    projectWatchers = new Map(); // projectId -> Set of watched paths
    eventCounts = new Map();
    debounceTimers = new Map();
    lastEvents = new Map();
    constructor() {
        super();
        this.logger = LoggerService.getInstance();
        this.config = ConfigService.getInstance();
        this.storage = new StorageService();
        // Cleanup on process exit
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }
    /**
     * Start watching a project's .agentmux directory
     */
    async watchProject(projectId, projectPath) {
        try {
            const resolvedProjectPath = path.resolve(projectPath);
            const agentmuxPath = path.join(resolvedProjectPath, '.agentmux');
            // Check if directory exists
            if (!fs.existsSync(agentmuxPath)) {
                this.logger.warn(`AgentMux directory does not exist: ${agentmuxPath}`);
                return;
            }
            // Stop existing watcher if any
            await this.stopWatchingProject(projectId);
            const watcherId = `project_${projectId}`;
            const projectWatchPaths = new Set();
            // Watch main .agentmux directory
            const mainWatcher = this.createWatcher(agentmuxPath, projectId, 'main');
            this.watchers.set(`${watcherId}_main`, mainWatcher);
            projectWatchPaths.add(agentmuxPath);
            // Watch subdirectories
            const subdirs = ['specs', 'tasks', 'memory', 'prompts'];
            for (const subdir of subdirs) {
                const subdirPath = path.join(agentmuxPath, subdir);
                if (fs.existsSync(subdirPath)) {
                    const subWatcher = this.createWatcher(subdirPath, projectId, subdir);
                    this.watchers.set(`${watcherId}_${subdir}`, subWatcher);
                    projectWatchPaths.add(subdirPath);
                }
            }
            this.projectWatchers.set(projectId, projectWatchPaths);
            this.logger.info(`Started file watching for project ${projectId}`, {
                projectPath,
                watchedPaths: Array.from(projectWatchPaths)
            });
        }
        catch (error) {
            this.logger.error(`Failed to start watching project ${projectId}:`, { error: error instanceof Error ? error.message : String(error), projectId });
            throw error;
        }
    }
    /**
     * Stop watching a project
     */
    async stopWatchingProject(projectId) {
        const watcherId = `project_${projectId}`;
        const watcherKeys = Array.from(this.watchers.keys()).filter(key => key.startsWith(watcherId));
        for (const key of watcherKeys) {
            const watcher = this.watchers.get(key);
            if (watcher) {
                watcher.close();
                this.watchers.delete(key);
            }
        }
        this.projectWatchers.delete(projectId);
        this.logger.info(`Stopped file watching for project ${projectId}`);
    }
    /**
     * Create a file system watcher for a specific directory
     */
    createWatcher(dirPath, projectId, category) {
        const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
            if (!filename)
                return;
            const filepath = path.join(dirPath, filename);
            const relativePath = path.relative(dirPath, filepath);
            // Filter out unwanted files
            if (this.shouldIgnoreFile(filename, relativePath)) {
                return;
            }
            this.handleFileChange(eventType, filepath, relativePath, projectId, category);
        });
        watcher.on('error', (error) => {
            this.logger.error(`File watcher error for ${dirPath}:`, { error: error instanceof Error ? error.message : String(error), dirPath });
        });
        return watcher;
    }
    /**
     * Handle file change events with debouncing
     */
    handleFileChange(eventType, filepath, relativePath, projectId, category) {
        const debounceKey = `${projectId}:${filepath}`;
        // Clear existing debounce timer
        const existingTimer = this.debounceTimers.get(debounceKey);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        // Set new debounce timer
        const timer = setTimeout(async () => {
            try {
                await this.processFileChange(eventType, filepath, relativePath, projectId, category);
                this.debounceTimers.delete(debounceKey);
            }
            catch (error) {
                this.logger.error(`Error processing file change:`, { error: error instanceof Error ? error.message : String(error) });
            }
        }, 500); // 500ms debounce
        this.debounceTimers.set(debounceKey, timer);
    }
    /**
     * Process the actual file change event
     */
    async processFileChange(eventType, filepath, relativePath, projectId, category) {
        const fileExists = fs.existsSync(filepath);
        const changeType = this.determineChangeType(eventType, fileExists, filepath);
        const event = {
            type: changeType,
            filepath,
            relativePath,
            timestamp: new Date(),
            projectId,
            category: category === 'main' ? this.categorizeFile(relativePath) : category
        };
        // Update statistics
        this.updateStats(projectId, event);
        // Log the event
        this.logger.info(`File ${changeType}: ${relativePath}`, {
            projectId,
            category: event.category,
            filepath
        });
        // Emit event for WebSocket broadcasting
        this.emit('fileChange', event);
        // Trigger specific actions based on file type
        await this.triggerFileSpecificActions(event);
    }
    /**
     * Determine the type of change (created, modified, deleted)
     */
    determineChangeType(eventType, fileExists, filepath) {
        if (eventType === 'rename') {
            return fileExists ? 'created' : 'deleted';
        }
        else {
            return fileExists ? 'modified' : 'deleted';
        }
    }
    /**
     * Categorize file based on its path
     */
    categorizeFile(relativePath) {
        const parts = relativePath.split(path.sep);
        const firstPart = parts[0]?.toLowerCase();
        switch (firstPart) {
            case 'specs': return 'specs';
            case 'tasks': return 'tasks';
            case 'memory': return 'memory';
            case 'prompts': return 'prompts';
            default: return 'other';
        }
    }
    /**
     * Check if a file should be ignored
     */
    shouldIgnoreFile(filename, relativePath) {
        // Ignore patterns
        const ignorePatterns = [
            /^\./, // Hidden files
            /~$/, // Backup files
            /\.tmp$/, // Temporary files
            /\.lock$/, // Lock files
            /node_modules/, // Node modules
            /\.git/, // Git directory
            /\.DS_Store/, // macOS files
            /Thumbs\.db/, // Windows files
        ];
        return ignorePatterns.some(pattern => pattern.test(filename) || pattern.test(relativePath));
    }
    /**
     * Trigger specific actions based on file type
     */
    async triggerFileSpecificActions(event) {
        try {
            switch (event.category) {
                case 'specs':
                    // Trigger agent context refresh when specs change
                    this.emit('contextRefresh', { projectId: event.projectId, reason: 'specs_changed' });
                    break;
                case 'tasks':
                    // Trigger task cache refresh
                    this.emit('tasksChanged', { projectId: event.projectId, filepath: event.filepath });
                    break;
                case 'memory':
                    // Trigger memory context update
                    this.emit('memoryUpdated', { projectId: event.projectId, filepath: event.filepath });
                    break;
                case 'prompts':
                    // Trigger system prompt reload
                    this.emit('promptsChanged', { projectId: event.projectId, filepath: event.filepath });
                    break;
            }
            // Always emit a general project change event
            this.emit('projectChanged', {
                projectId: event.projectId,
                category: event.category,
                changeType: event.type
            });
        }
        catch (error) {
            this.logger.error(`Error triggering file-specific actions:`, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Update statistics for the file change
     */
    updateStats(projectId, event) {
        const today = new Date().toDateString();
        const key = `${projectId}:${today}`;
        const currentCount = this.eventCounts.get(key) || 0;
        this.eventCounts.set(key, currentCount + 1);
        this.lastEvents.set(projectId, event.timestamp);
    }
    /**
     * Get watcher statistics
     */
    getStats() {
        const today = new Date().toDateString();
        let eventsToday = 0;
        for (const [key, count] of this.eventCounts.entries()) {
            if (key.endsWith(today)) {
                eventsToday += count;
            }
        }
        const lastEventTimes = Array.from(this.lastEvents.values());
        const lastEvent = lastEventTimes.length > 0 ?
            new Date(Math.max(...lastEventTimes.map(d => d.getTime()))) : null;
        return {
            totalWatched: this.watchers.size,
            activeProjects: this.projectWatchers.size,
            eventsToday,
            lastEvent
        };
    }
    /**
     * Get watched projects
     */
    getWatchedProjects() {
        return Array.from(this.projectWatchers.keys());
    }
    /**
     * Check if a project is being watched
     */
    isWatching(projectId) {
        return this.projectWatchers.has(projectId);
    }
    /**
     * Watch all existing projects
     */
    async watchAllProjects() {
        try {
            const projects = await this.storage.getProjects();
            for (const project of projects) {
                if (project.status === 'active' && fs.existsSync(project.path)) {
                    await this.watchProject(project.id, project.path);
                }
            }
            this.logger.info(`Started watching ${projects.length} projects`);
        }
        catch (error) {
            this.logger.error('Failed to watch all projects:', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    /**
     * Cleanup all watchers
     */
    async cleanup() {
        this.logger.info('Cleaning up file watchers...');
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        // Close all watchers
        for (const [key, watcher] of this.watchers.entries()) {
            try {
                watcher.close();
                this.logger.debug(`Closed watcher: ${key}`);
            }
            catch (error) {
                this.logger.error(`Error closing watcher ${key}:`, { error: error instanceof Error ? error.message : String(error), key });
            }
        }
        this.watchers.clear();
        this.projectWatchers.clear();
        this.logger.info('File watcher cleanup complete');
    }
}
//# sourceMappingURL=file-watcher.service.js.map