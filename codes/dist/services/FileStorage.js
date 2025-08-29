"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorage = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class FileStorage {
    constructor(dataDir, config) {
        this.activityWriteLock = Promise.resolve();
        this.dataDir = dataDir || path.join(os.homedir(), '.agentmux');
        this.dataPath = path.join(this.dataDir, 'data.json');
        this.activityPath = path.join(this.dataDir, 'activity.json');
        this.config = {
            maxActivityEntries: config?.maxActivityEntries || 1000,
            backupBeforeSave: config?.backupBeforeSave ?? true,
            dataDirectory: this.dataDir
        };
    }
    async ensureDataDir() {
        try {
            await fs_1.promises.mkdir(this.dataDir, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    getDefaultData() {
        return {
            projects: [],
            teams: [],
            assignments: [],
            settings: {
                version: '1.0.0',
                created: new Date().toISOString(),
                pollingInterval: 30000
            }
        };
    }
    validateData(data) {
        // Validate projects
        data.projects.forEach((project, index) => {
            if (!project.id)
                throw new Error(`Project ${index}: ID is required`);
            if (!project.name)
                throw new Error(`Project ${index}: name is required`);
            if (!project.fsPath)
                throw new Error(`Project ${index}: fsPath is required`);
            if (!project.status)
                throw new Error(`Project ${index}: status is required`);
            if (!project.createdAt)
                throw new Error(`Project ${index}: createdAt is required`);
            if (!['active', 'idle', 'archived'].includes(project.status)) {
                throw new Error(`Project ${index}: invalid status`);
            }
        });
        // Validate teams
        data.teams.forEach((team, index) => {
            if (!team.id)
                throw new Error(`Team ${index}: ID is required`);
            if (!team.name)
                throw new Error(`Team ${index}: name is required`);
            if (!Array.isArray(team.roles))
                throw new Error(`Team ${index}: roles must be an array`);
            if (!team.status)
                throw new Error(`Team ${index}: status is required`);
            if (!team.createdAt)
                throw new Error(`Team ${index}: createdAt is required`);
            if (!['active', 'idle', 'paused', 'stopped'].includes(team.status)) {
                throw new Error(`Team ${index}: invalid status`);
            }
            // Validate roles
            team.roles.forEach((role, roleIndex) => {
                if (!role.name)
                    throw new Error(`Team ${index}, Role ${roleIndex}: name is required`);
                if (typeof role.count !== 'number' || role.count < 0) {
                    throw new Error(`Team ${index}, Role ${roleIndex}: count must be a non-negative number`);
                }
            });
            // Check for required orchestrator role
            const hasOrchestrator = team.roles.some(role => role.name === 'orchestrator' && role.count > 0);
            if (!hasOrchestrator) {
                throw new Error(`Team ${index}: must have at least one orchestrator role`);
            }
        });
        // Validate assignments
        data.assignments.forEach((assignment, index) => {
            if (!assignment.id)
                throw new Error(`Assignment ${index}: ID is required`);
            if (!assignment.projectId)
                throw new Error(`Assignment ${index}: projectId is required`);
            if (!assignment.teamId)
                throw new Error(`Assignment ${index}: teamId is required`);
            if (!assignment.status)
                throw new Error(`Assignment ${index}: status is required`);
            if (!assignment.startedAt)
                throw new Error(`Assignment ${index}: startedAt is required`);
            if (!['active', 'paused', 'ended'].includes(assignment.status)) {
                throw new Error(`Assignment ${index}: invalid status`);
            }
        });
    }
    async loadData() {
        await this.ensureDataDir();
        try {
            const content = await fs_1.promises.readFile(this.dataPath, 'utf8');
            const data = JSON.parse(content);
            return data;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, return default data
                return this.getDefaultData();
            }
            else {
                console.warn('Failed to load data file, returning default data:', error);
                return this.getDefaultData();
            }
        }
    }
    async saveData(data) {
        await this.ensureDataDir();
        // Validate data before saving
        this.validateData(data);
        // Create backup if file exists and backup is enabled
        if (this.config.backupBeforeSave) {
            try {
                await fs_1.promises.access(this.dataPath);
                const backupPath = this.dataPath + '.backup';
                await fs_1.promises.copyFile(this.dataPath, backupPath);
            }
            catch (error) {
                // Backup failed or original file doesn't exist, continue
            }
        }
        const content = JSON.stringify(data, null, 2);
        await fs_1.promises.writeFile(this.dataPath, content, 'utf8');
    }
    async loadActivity() {
        await this.ensureDataDir();
        try {
            const content = await fs_1.promises.readFile(this.activityPath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return { entries: [] };
            }
            else {
                console.warn('Failed to load activity file, returning empty log:', error);
                return { entries: [] };
            }
        }
    }
    async appendActivity(entry) {
        // Use a lock to prevent concurrent writes
        this.activityWriteLock = this.activityWriteLock.then(async () => {
            await this.ensureDataDir();
            const activity = await this.loadActivity();
            activity.entries.push(entry);
            // Rotate if too large
            if (activity.entries.length > this.config.maxActivityEntries) {
                const keepCount = this.config.maxActivityEntries;
                activity.entries = activity.entries.slice(-keepCount);
            }
            const content = JSON.stringify(activity, null, 2);
            await fs_1.promises.writeFile(this.activityPath, content, 'utf8');
        });
        await this.activityWriteLock;
    }
    async getProjectPath(projectId) {
        const data = await this.loadData();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }
        return project.fsPath;
    }
    validateSpecPath(specPath) {
        // Prevent path traversal attacks
        const normalizedPath = path.normalize(specPath);
        if (normalizedPath.startsWith('../') ||
            normalizedPath.includes('/../') ||
            normalizedPath.includes('..\\') ||
            normalizedPath.startsWith('..\\') ||
            normalizedPath === '..' ||
            path.isAbsolute(specPath)) {
            throw new Error(`Path traversal not allowed: ${specPath}`);
        }
    }
    async writeSpec(projectId, specPath, content) {
        this.validateSpecPath(specPath);
        const projectPath = await this.getProjectPath(projectId);
        const fullPath = path.join(projectPath, specPath);
        // Ensure directory exists
        await fs_1.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs_1.promises.writeFile(fullPath, content, 'utf8');
    }
    async readSpec(projectId, specPath) {
        this.validateSpecPath(specPath);
        const projectPath = await this.getProjectPath(projectId);
        const fullPath = path.join(projectPath, specPath);
        try {
            return await fs_1.promises.readFile(fullPath, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Spec file not found: ${specPath}`);
            }
            throw error;
        }
    }
    // Helper methods for API endpoints
    async getProjects() {
        const data = await this.loadData();
        return data.projects;
    }
    async createProject(projectData) {
        const data = await this.loadData();
        const project = {
            id: projectData.id || `project-${Date.now()}`,
            name: projectData.name || '',
            fsPath: projectData.fsPath || '',
            status: projectData.status || 'idle',
            createdAt: new Date().toISOString(),
            lastActivity: projectData.lastActivity,
            assignedTeamId: projectData.assignedTeamId
        };
        data.projects.push(project);
        await this.saveData(data);
        return project;
    }
    async updateProject(projectId, updates) {
        const data = await this.loadData();
        const projectIndex = data.projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
            return null;
        }
        data.projects[projectIndex] = { ...data.projects[projectIndex], ...updates };
        await this.saveData(data);
        return data.projects[projectIndex];
    }
    async deleteProject(projectId) {
        const data = await this.loadData();
        const projectIndex = data.projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
            return false;
        }
        data.projects.splice(projectIndex, 1);
        // Also remove any assignments for this project
        data.assignments = data.assignments.filter(a => a.projectId !== projectId);
        await this.saveData(data);
        return true;
    }
    async getTeams() {
        const data = await this.loadData();
        return data.teams;
    }
    async createTeam(teamData) {
        const data = await this.loadData();
        const team = {
            id: teamData.id || `team-${Date.now()}`,
            name: teamData.name || '',
            roles: teamData.roles || [{ name: 'orchestrator', count: 1 }],
            tmuxSession: teamData.tmuxSession,
            tmuxSessionName: teamData.tmuxSessionName,
            status: teamData.status || 'idle',
            createdAt: new Date().toISOString(),
            lastActivity: teamData.lastActivity,
            assignedProjectId: teamData.assignedProjectId
        };
        data.teams.push(team);
        await this.saveData(data);
        return team;
    }
    async updateTeam(teamId, updates) {
        const data = await this.loadData();
        const teamIndex = data.teams.findIndex(t => t.id === teamId);
        if (teamIndex === -1) {
            return null;
        }
        data.teams[teamIndex] = { ...data.teams[teamIndex], ...updates };
        await this.saveData(data);
        return data.teams[teamIndex];
    }
    async deleteTeam(teamId) {
        const data = await this.loadData();
        const teamIndex = data.teams.findIndex(t => t.id === teamId);
        if (teamIndex === -1) {
            return false;
        }
        data.teams.splice(teamIndex, 1);
        // Also remove any assignments for this team
        data.assignments = data.assignments.filter(a => a.teamId !== teamId);
        await this.saveData(data);
        return true;
    }
    async getAssignments() {
        const data = await this.loadData();
        return data.assignments;
    }
    async createAssignment(assignmentData) {
        const data = await this.loadData();
        const assignment = {
            id: assignmentData.id || `assignment-${Date.now()}`,
            projectId: assignmentData.projectId || '',
            teamId: assignmentData.teamId || '',
            status: assignmentData.status || 'active',
            startedAt: new Date().toISOString(),
            endedAt: assignmentData.endedAt
        };
        data.assignments.push(assignment);
        await this.saveData(data);
        return assignment;
    }
    async updateAssignment(assignmentId, updates) {
        const data = await this.loadData();
        const assignmentIndex = data.assignments.findIndex(a => a.id === assignmentId);
        if (assignmentIndex === -1) {
            return null;
        }
        data.assignments[assignmentIndex] = { ...data.assignments[assignmentIndex], ...updates };
        await this.saveData(data);
        return data.assignments[assignmentIndex];
    }
    async deleteAssignment(assignmentId) {
        const data = await this.loadData();
        const assignmentIndex = data.assignments.findIndex(a => a.id === assignmentId);
        if (assignmentIndex === -1) {
            return false;
        }
        data.assignments.splice(assignmentIndex, 1);
        await this.saveData(data);
        return true;
    }
    async getActivity(limit) {
        const activity = await this.loadActivity();
        if (limit && limit > 0) {
            return activity.entries.slice(-limit);
        }
        return activity.entries;
    }
}
exports.FileStorage = FileStorage;
//# sourceMappingURL=FileStorage.js.map