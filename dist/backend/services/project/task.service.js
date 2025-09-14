import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
export class TaskService {
    tasksDir;
    constructor(projectPath) {
        this.tasksDir = projectPath
            ? path.join(path.resolve(projectPath), '.agentmux', 'tasks')
            : path.join(process.cwd(), '.agentmux', 'tasks');
    }
    parseMarkdownContent(content) {
        const lines = content.split('\n');
        let title = '';
        let status = 'pending';
        let priority = 'medium';
        let assignee = '';
        let milestone = '';
        let description = '';
        let tasks = [];
        let acceptanceCriteria = [];
        let currentSection = '';
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Extract title from first h1
            if (trimmedLine.startsWith('# ') && !title) {
                title = trimmedLine.substring(2).trim();
                continue;
            }
            // Extract metadata
            if (trimmedLine.startsWith('**Status:**')) {
                status = trimmedLine.replace('**Status:**', '').trim();
                continue;
            }
            if (trimmedLine.startsWith('**Priority:**')) {
                priority = trimmedLine.replace('**Priority:**', '').trim();
                continue;
            }
            if (trimmedLine.startsWith('**Assignee:**')) {
                assignee = trimmedLine.replace('**Assignee:**', '').trim();
                continue;
            }
            if (trimmedLine.startsWith('**Milestone:**')) {
                milestone = trimmedLine.replace('**Milestone:**', '').trim();
                continue;
            }
            // Track sections
            if (trimmedLine.startsWith('## Description')) {
                currentSection = 'description';
                continue;
            }
            if (trimmedLine.startsWith('## Tasks')) {
                currentSection = 'tasks';
                continue;
            }
            if (trimmedLine.startsWith('## Acceptance Criteria')) {
                currentSection = 'acceptanceCriteria';
                continue;
            }
            if (trimmedLine.startsWith('## ')) {
                currentSection = '';
                continue;
            }
            // Extract content based on current section
            if (currentSection === 'description' && trimmedLine && !trimmedLine.startsWith('#')) {
                description += (description ? '\n' : '') + trimmedLine;
            }
            if (currentSection === 'tasks' && trimmedLine.startsWith('- ')) {
                tasks.push(trimmedLine.substring(2).trim());
            }
            if (currentSection === 'acceptanceCriteria' && trimmedLine.startsWith('- ')) {
                acceptanceCriteria.push(trimmedLine.substring(2).trim());
            }
        }
        return {
            title,
            status: status.toLowerCase(),
            priority: priority.toLowerCase(),
            assignee: assignee || undefined,
            milestone,
            description,
            tasks,
            acceptanceCriteria
        };
    }
    async getAllTasks() {
        if (!existsSync(this.tasksDir)) {
            return [];
        }
        const tasks = [];
        const milestones = await fs.readdir(this.tasksDir);
        for (const milestone of milestones) {
            const milestonePath = path.join(this.tasksDir, milestone);
            const stat = await fs.stat(milestonePath);
            if (!stat.isDirectory())
                continue;
            // Check if this is a status-based structure (has status folders) or direct markdown files
            const items = await fs.readdir(milestonePath);
            const statusFolders = ['open', 'in_progress', 'done', 'blocked'];
            const hasStatusFolders = items.some(item => statusFolders.includes(item));
            if (hasStatusFolders) {
                // Status-based structure: milestone/status/task.md
                for (const statusFolder of statusFolders) {
                    const statusPath = path.join(milestonePath, statusFolder);
                    if (existsSync(statusPath)) {
                        const statusStat = await fs.stat(statusPath);
                        if (statusStat.isDirectory()) {
                            const statusFiles = await fs.readdir(statusPath);
                            const markdownFiles = statusFiles.filter(file => file.endsWith('.md'));
                            for (const file of markdownFiles) {
                                const filePath = path.join(statusPath, file);
                                const content = await fs.readFile(filePath, 'utf-8');
                                const parsed = this.parseMarkdownContent(content);
                                const task = {
                                    id: path.basename(file, '.md'),
                                    title: parsed.title || path.basename(file, '.md').replace(/_/g, ' '),
                                    description: parsed.description,
                                    status: statusFolder, // Use folder name as status
                                    priority: parsed.priority,
                                    assignee: parsed.assignee,
                                    milestone: parsed.milestone || milestone,
                                    milestoneId: milestone,
                                    tasks: parsed.tasks,
                                    acceptanceCriteria: parsed.acceptanceCriteria,
                                    filePath,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString()
                                };
                                tasks.push(task);
                            }
                        }
                    }
                }
            }
            else {
                // Direct structure: milestone/task.md  
                const markdownFiles = items.filter(file => file.endsWith('.md'));
                for (const file of markdownFiles) {
                    const filePath = path.join(milestonePath, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const parsed = this.parseMarkdownContent(content);
                    const task = {
                        id: path.basename(file, '.md'),
                        title: parsed.title,
                        description: parsed.description,
                        status: parsed.status,
                        priority: parsed.priority,
                        assignee: parsed.assignee,
                        milestone: parsed.milestone,
                        milestoneId: milestone,
                        tasks: parsed.tasks,
                        acceptanceCriteria: parsed.acceptanceCriteria,
                        filePath,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    tasks.push(task);
                }
            }
        }
        return tasks.sort((a, b) => {
            // Sort by milestone first, then by task ID
            if (a.milestoneId !== b.milestoneId) {
                return a.milestoneId.localeCompare(b.milestoneId);
            }
            return a.id.localeCompare(b.id);
        });
    }
    async getMilestones() {
        const tasks = await this.getAllTasks();
        const milestoneMap = new Map();
        for (const task of tasks) {
            if (!milestoneMap.has(task.milestoneId)) {
                milestoneMap.set(task.milestoneId, {
                    id: task.milestoneId,
                    name: task.milestoneId,
                    title: task.milestoneId.replace(/_/g, ' ').replace(/^m\d+\s+/, '').replace(/^\w/, c => c.toUpperCase()),
                    tasks: []
                });
            }
            milestoneMap.get(task.milestoneId).tasks.push(task);
        }
        return Array.from(milestoneMap.values()).sort((a, b) => a.id.localeCompare(b.id));
    }
    async getTasksByStatus(status) {
        const tasks = await this.getAllTasks();
        return tasks.filter(task => task.status === status);
    }
    async getTasksByMilestone(milestoneId) {
        const tasks = await this.getAllTasks();
        return tasks.filter(task => task.milestoneId === milestoneId);
    }
}
//# sourceMappingURL=task.service.js.map