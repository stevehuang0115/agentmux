import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, watch } from 'fs';
import { parse as parseYAML } from 'yaml';
import { TeamModel, ProjectModel, TicketModel } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
export class StorageService {
    agentmuxHome;
    teamsFile;
    projectsFile;
    runtimeFile;
    scheduledMessagesFile;
    deliveryLogsFile;
    constructor(agentmuxHome) {
        this.agentmuxHome = agentmuxHome || path.join(os.homedir(), '.agentmux');
        this.teamsFile = path.join(this.agentmuxHome, 'teams.json');
        this.projectsFile = path.join(this.agentmuxHome, 'projects.json');
        this.runtimeFile = path.join(this.agentmuxHome, 'runtime.json');
        this.scheduledMessagesFile = path.join(this.agentmuxHome, 'scheduled-messages.json');
        this.deliveryLogsFile = path.join(this.agentmuxHome, 'message-delivery-logs.json');
        this.ensureDirectories();
    }
    ensureDirectories() {
        if (!existsSync(this.agentmuxHome)) {
            mkdirSync(this.agentmuxHome, { recursive: true });
        }
    }
    async ensureFile(filePath, defaultContent = []) {
        if (!existsSync(filePath)) {
            await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
        }
    }
    // Team management
    async getTeams() {
        try {
            await this.ensureFile(this.teamsFile);
            const content = await fs.readFile(this.teamsFile, 'utf-8');
            const teams = JSON.parse(content);
            return teams.map(team => TeamModel.fromJSON(team).toJSON());
        }
        catch (error) {
            console.error('Error reading teams:', error);
            return [];
        }
    }
    async saveTeam(team) {
        try {
            const teams = await this.getTeams();
            const existingIndex = teams.findIndex(t => t.id === team.id);
            if (existingIndex >= 0) {
                teams[existingIndex] = team;
            }
            else {
                teams.push(team);
            }
            await fs.writeFile(this.teamsFile, JSON.stringify(teams, null, 2));
        }
        catch (error) {
            console.error('Error saving team:', error);
            throw error;
        }
    }
    async updateTeamStatus(id, status) {
        try {
            const teams = await this.getTeams();
            const team = teams.find(t => t.id === id);
            if (team) {
                const teamModel = TeamModel.fromJSON(team);
                teamModel.updateStatus(status);
                await this.saveTeam(teamModel.toJSON());
            }
        }
        catch (error) {
            console.error('Error updating team status:', error);
            throw error;
        }
    }
    async deleteTeam(id) {
        try {
            const teams = await this.getTeams();
            const filteredTeams = teams.filter(t => t.id !== id);
            await fs.writeFile(this.teamsFile, JSON.stringify(filteredTeams, null, 2));
        }
        catch (error) {
            console.error('Error deleting team:', error);
            throw error;
        }
    }
    // Project management
    async getProjects() {
        try {
            await this.ensureFile(this.projectsFile);
            const content = await fs.readFile(this.projectsFile, 'utf-8');
            const projects = JSON.parse(content);
            return projects.map(project => ProjectModel.fromJSON(project).toJSON());
        }
        catch (error) {
            console.error('Error reading projects:', error);
            return [];
        }
    }
    async addProject(projectPath) {
        try {
            // Resolve to absolute path to ensure .agentmux is created in the correct location
            // If path is relative, resolve it relative to the parent directory of the current working directory
            let resolvedProjectPath;
            if (path.isAbsolute(projectPath)) {
                resolvedProjectPath = projectPath;
            }
            else {
                // Resolve relative to parent directory (where sibling projects should be)
                const parentDir = path.dirname(process.cwd());
                resolvedProjectPath = path.resolve(parentDir, projectPath);
            }
            const projectName = path.basename(resolvedProjectPath);
            const projectId = uuidv4();
            const project = new ProjectModel({
                id: projectId,
                name: projectName,
                path: resolvedProjectPath,
                teams: {},
                status: 'active',
            });
            // Ensure project directory and .agentmux structure exists with template files
            mkdirSync(resolvedProjectPath, { recursive: true });
            const agentmuxDir = path.join(resolvedProjectPath, '.agentmux');
            if (!existsSync(agentmuxDir)) {
                mkdirSync(agentmuxDir, { recursive: true });
                mkdirSync(path.join(agentmuxDir, 'tasks'), { recursive: true });
                mkdirSync(path.join(agentmuxDir, 'specs'), { recursive: true });
                mkdirSync(path.join(agentmuxDir, 'memory'), { recursive: true });
                mkdirSync(path.join(agentmuxDir, 'prompts'), { recursive: true });
                // Create template files
                await this.createProjectTemplateFiles(agentmuxDir, projectName);
            }
            await this.saveProject(project.toJSON());
            return project.toJSON();
        }
        catch (error) {
            console.error('Error adding project:', error);
            throw error;
        }
    }
    async saveProject(project) {
        try {
            const projects = await this.getProjects();
            const existingIndex = projects.findIndex(p => p.id === project.id);
            if (existingIndex >= 0) {
                projects[existingIndex] = project;
            }
            else {
                projects.push(project);
            }
            await fs.writeFile(this.projectsFile, JSON.stringify(projects, null, 2));
        }
        catch (error) {
            console.error('Error saving project:', error);
            throw error;
        }
    }
    async deleteProject(id) {
        try {
            const projects = await this.getProjects();
            const filteredProjects = projects.filter(p => p.id !== id);
            await fs.writeFile(this.projectsFile, JSON.stringify(filteredProjects, null, 2));
        }
        catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }
    // Ticket management
    async getTickets(projectPath, filter) {
        try {
            const resolvedProjectPath = path.resolve(projectPath);
            const ticketsDir = path.join(resolvedProjectPath, '.agentmux', 'tasks');
            if (!existsSync(ticketsDir)) {
                return [];
            }
            const files = await fs.readdir(ticketsDir);
            const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
            const tickets = [];
            for (const file of yamlFiles) {
                try {
                    const filePath = path.join(ticketsDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const ticket = this.parseTicketYAML(content);
                    tickets.push(ticket);
                }
                catch (error) {
                    console.error(`Error parsing ticket file ${file}:`, error);
                }
            }
            // Apply filters
            let filteredTickets = tickets;
            if (filter) {
                if (filter.status) {
                    filteredTickets = filteredTickets.filter(t => t.status === filter.status);
                }
                if (filter.assignedTo) {
                    filteredTickets = filteredTickets.filter(t => t.assignedTo === filter.assignedTo);
                }
                if (filter.projectId) {
                    filteredTickets = filteredTickets.filter(t => t.projectId === filter.projectId);
                }
                if (filter.priority) {
                    filteredTickets = filteredTickets.filter(t => t.priority === filter.priority);
                }
            }
            return filteredTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        catch (error) {
            console.error('Error reading tickets:', error);
            return [];
        }
    }
    async saveTicket(projectPath, ticket) {
        try {
            const resolvedProjectPath = path.resolve(projectPath);
            const ticketsDir = path.join(resolvedProjectPath, '.agentmux', 'tasks');
            if (!existsSync(ticketsDir)) {
                mkdirSync(ticketsDir, { recursive: true });
            }
            const ticketModel = TicketModel.fromJSON(ticket);
            const filename = `${ticket.id}.yaml`;
            const filePath = path.join(ticketsDir, filename);
            await fs.writeFile(filePath, ticketModel.toYAML());
        }
        catch (error) {
            console.error('Error saving ticket:', error);
            throw error;
        }
    }
    async deleteTicket(projectPath, ticketId) {
        try {
            const resolvedProjectPath = path.resolve(projectPath);
            const ticketsDir = path.join(resolvedProjectPath, '.agentmux', 'tasks');
            const filename = `${ticketId}.yaml`;
            const filePath = path.join(ticketsDir, filename);
            if (existsSync(filePath)) {
                await fs.unlink(filePath);
            }
        }
        catch (error) {
            console.error('Error deleting ticket:', error);
            throw error;
        }
    }
    parseTicketYAML(content) {
        const lines = content.split('\n');
        let frontmatterEnd = -1;
        let frontmatterStart = -1;
        // Find YAML frontmatter
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                if (frontmatterStart === -1) {
                    frontmatterStart = i;
                }
                else {
                    frontmatterEnd = i;
                    break;
                }
            }
        }
        let frontmatter = {};
        let description = '';
        if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
            const yamlContent = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
            frontmatter = parseYAML(yamlContent) || {};
            description = lines.slice(frontmatterEnd + 1).join('\n').trim();
        }
        else {
            description = content.trim();
        }
        return {
            id: frontmatter.id || uuidv4(),
            title: frontmatter.title || 'Untitled',
            description: description,
            status: frontmatter.status || 'open',
            assignedTo: frontmatter.assignedTo,
            priority: frontmatter.priority || 'medium',
            labels: frontmatter.labels || [],
            projectId: frontmatter.projectId || '',
            createdAt: frontmatter.createdAt || new Date().toISOString(),
            updatedAt: frontmatter.updatedAt || new Date().toISOString(),
        };
    }
    // File watching
    watchProject(projectPath) {
        const resolvedProjectPath = path.resolve(projectPath);
        const agentmuxDir = path.join(resolvedProjectPath, '.agentmux');
        return watch(agentmuxDir, { recursive: true }, (eventType, filename) => {
            if (filename) {
                console.log(`File ${eventType}: ${filename} in project ${resolvedProjectPath}`);
                // Emit events that can be handled by WebSocket gateway
            }
        });
    }
    // Runtime state management
    async getRuntimeState() {
        try {
            await this.ensureFile(this.runtimeFile, {});
            const content = await fs.readFile(this.runtimeFile, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Error reading runtime state:', error);
            return {};
        }
    }
    async saveRuntimeState(state) {
        try {
            await fs.writeFile(this.runtimeFile, JSON.stringify(state, null, 2));
        }
        catch (error) {
            console.error('Error saving runtime state:', error);
            throw error;
        }
    }
    /**
     * Create template files for a new project
     */
    async createProjectTemplateFiles(agentmuxDir, projectName) {
        try {
            // Project specification template
            const projectSpecPath = path.join(agentmuxDir, 'specs', 'project.md');
            const projectSpecTemplate = `# ${projectName} - Project Specification

## Overview
Brief description of ${projectName} and its goals.

## Requirements
- List key functional requirements
- Non-functional requirements
- Technical constraints

## Architecture
High-level system architecture and technology stack.

## Implementation Plan
### Phase 1: Foundation
- Core functionality setup
- Basic project structure
- Initial testing framework

### Phase 2: Features
- Main feature implementation
- Integration and testing
- Performance optimization

### Phase 3: Polish
- UI/UX improvements
- Documentation completion
- Deployment preparation

## Acceptance Criteria
- [ ] All requirements implemented
- [ ] Tests passing (>90% coverage)
- [ ] Documentation complete
- [ ] Performance targets met
- [ ] Security review completed
`;
            await fs.writeFile(projectSpecPath, projectSpecTemplate, 'utf8');
            // README for the .agentmux directory
            const readmePath = path.join(agentmuxDir, 'README.md');
            const readmeTemplate = `# AgentMux Project Directory

This directory contains AgentMux-specific files for **${projectName}** project orchestration.

## Structure

- **specs/**: Project specifications and requirements
- **tasks/**: Task items in YAML + Markdown format  
- **memory/**: Agent memory and context files
- **prompts/**: Custom system prompts for team members

## Usage

AgentMux agents automatically read from these directories to understand:
- Project requirements and specifications
- Current tasks and their status
- Historical context and decisions
- Role-specific instructions

All files in this directory are monitored by AgentMux for real-time updates.

## Getting Started

1. Update \`specs/project.md\` with your project requirements
2. Create task items in \`tasks/\` directory for specific tasks
3. Customize team member prompts in \`prompts/\` as needed
4. Let AgentMux orchestrate your development workflow!
`;
            await fs.writeFile(readmePath, readmeTemplate, 'utf8');
            // Sample ticket template
            const sampleTicketPath = path.join(agentmuxDir, 'tasks', 'sample-setup-task.yaml');
            const ticketTemplate = `---
id: sample-setup-task
title: Project Setup and Configuration
status: todo
priority: high
assignedTo: ""
estimatedHours: 4
createdAt: ${new Date().toISOString()}
updatedAt: ${new Date().toISOString()}
tags:
  - setup
  - configuration
  - infrastructure
---

# Project Setup and Configuration

## Description
Set up the basic project infrastructure and configuration for ${projectName}.

## Acceptance Criteria
- [ ] Project structure created
- [ ] Build system configured
- [ ] Testing framework set up
- [ ] CI/CD pipeline configured
- [ ] Documentation structure established
- [ ] Development environment documented

## Implementation Notes
This is a foundational task that should be completed first before other development work begins.

## Test Plan
- Verify build process works correctly
- Confirm tests can be run successfully
- Check all documentation is accessible
- Validate development environment setup instructions
`;
            await fs.writeFile(sampleTicketPath, ticketTemplate, 'utf8');
            console.log(`Created AgentMux template files for project: ${projectName}`);
        }
        catch (error) {
            console.error('Error creating project template files:', error);
            // Don't throw - project can still work without template files
        }
    }
    // Scheduled Messages management
    async getScheduledMessages() {
        try {
            await this.ensureFile(this.scheduledMessagesFile, []);
            const content = await fs.readFile(this.scheduledMessagesFile, 'utf-8');
            // Handle empty content or malformed JSON
            if (!content.trim()) {
                await fs.writeFile(this.scheduledMessagesFile, JSON.stringify([], null, 2));
                return [];
            }
            try {
                return JSON.parse(content);
            }
            catch (parseError) {
                console.error('Error parsing scheduled messages JSON, resetting file:', parseError);
                // Reset the file with empty array if JSON is corrupted
                await fs.writeFile(this.scheduledMessagesFile, JSON.stringify([], null, 2));
                return [];
            }
        }
        catch (error) {
            console.error('Error reading scheduled messages:', error);
            return [];
        }
    }
    async saveScheduledMessage(scheduledMessage) {
        try {
            const messages = await this.getScheduledMessages();
            const existingIndex = messages.findIndex(m => m.id === scheduledMessage.id);
            if (existingIndex >= 0) {
                messages[existingIndex] = scheduledMessage;
            }
            else {
                messages.push(scheduledMessage);
            }
            await fs.writeFile(this.scheduledMessagesFile, JSON.stringify(messages, null, 2));
        }
        catch (error) {
            console.error('Error saving scheduled message:', error);
            throw error;
        }
    }
    async getScheduledMessage(id) {
        try {
            const messages = await this.getScheduledMessages();
            return messages.find(m => m.id === id);
        }
        catch (error) {
            console.error('Error getting scheduled message:', error);
            return undefined;
        }
    }
    async deleteScheduledMessage(id) {
        try {
            const messages = await this.getScheduledMessages();
            const filteredMessages = messages.filter(m => m.id !== id);
            if (filteredMessages.length === messages.length) {
                return false; // Message not found
            }
            await fs.writeFile(this.scheduledMessagesFile, JSON.stringify(filteredMessages, null, 2));
            return true;
        }
        catch (error) {
            console.error('Error deleting scheduled message:', error);
            throw error;
        }
    }
    // Message Delivery Logs management
    async getDeliveryLogs() {
        try {
            await this.ensureFile(this.deliveryLogsFile);
            const content = await fs.readFile(this.deliveryLogsFile, 'utf-8');
            const logs = JSON.parse(content);
            // Sort by sentAt (newest first)
            return logs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
        }
        catch (error) {
            console.error('Error reading delivery logs:', error);
            return [];
        }
    }
    async saveDeliveryLog(log) {
        try {
            const logs = await this.getDeliveryLogs();
            logs.unshift(log); // Add to beginning for newest first order
            // Keep only last 1000 logs to prevent file from getting too large
            const trimmedLogs = logs.slice(0, 1000);
            await fs.writeFile(this.deliveryLogsFile, JSON.stringify(trimmedLogs, null, 2));
        }
        catch (error) {
            console.error('Error saving delivery log:', error);
            throw error;
        }
    }
    async clearDeliveryLogs() {
        try {
            await fs.writeFile(this.deliveryLogsFile, JSON.stringify([], null, 2));
        }
        catch (error) {
            console.error('Error clearing delivery logs:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=storage.service.js.map