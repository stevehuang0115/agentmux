import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, watch, FSWatcher, readFileSync } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { Team, Project, Ticket, TicketFilter, ScheduledMessage, MessageDeliveryLog } from '../../types/index.js';
import { TeamModel, ProjectModel, TicketModel, ScheduledMessageModel, MessageDeliveryLogModel } from '../../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { AGENTMUX_CONSTANTS, RUNTIME_TYPES, type AgentStatus, type WorkingStatus, type RuntimeType } from '../../constants.js';
import { AGENTMUX_CONSTANTS as CONFIG_CONSTANTS } from '../../constants.js';
import { LoggerService, ComponentLogger } from './logger.service.js';

export class StorageService {
  private static instance: StorageService | null = null;
  private static instanceHome: string | null = null;

  private agentmuxHome: string;
  private teamsFile: string;
  private fileLocks: Map<string, Promise<void>> = new Map();
  private logger: ComponentLogger;

  // Helper function to create default orchestrator object
  private createDefaultOrchestrator() {
    return {
      sessionName: CONFIG_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
      agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE, // Default to inactive until started
      workingStatus: AGENTMUX_CONSTANTS.WORKING_STATUSES.IDLE,
      runtimeType: RUNTIME_TYPES.CLAUDE_CODE, // Default to claude-code
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  private projectsFile: string;
  private runtimeFile: string;
  private scheduledMessagesFile: string;
  private deliveryLogsFile: string;

  constructor(agentmuxHome?: string) {
    this.logger = LoggerService.getInstance().createComponentLogger('StorageService');
    this.agentmuxHome = agentmuxHome || path.join(os.homedir(), '.agentmux');
    this.teamsFile = path.join(this.agentmuxHome, 'teams.json');
    this.projectsFile = path.join(this.agentmuxHome, 'projects.json');
    this.runtimeFile = path.join(this.agentmuxHome, 'runtime.json');
    this.scheduledMessagesFile = path.join(this.agentmuxHome, 'scheduled-messages.json');
    this.deliveryLogsFile = path.join(this.agentmuxHome, 'message-delivery-logs.json');

    this.ensureDirectories();
    this.logger.info('StorageService initialized', { agentmuxHome: this.agentmuxHome });
  }

  /**
   * Get singleton instance of StorageService to prevent multiple instances
   * from interfering with each other's file operations
   */
  public static getInstance(agentmuxHome?: string): StorageService {
    const homeDir = agentmuxHome || path.join(os.homedir(), '.agentmux');
    
    // Return existing instance if it matches the same home directory
    if (StorageService.instance && StorageService.instanceHome === homeDir) {
      return StorageService.instance;
    }
    
    // Create new instance if none exists or home directory changed
    StorageService.instance = new StorageService(homeDir);
    StorageService.instanceHome = homeDir;
    
    return StorageService.instance;
  }

  /**
   * Clear singleton instance (useful for testing)
   */
  public static clearInstance(): void {
    StorageService.instance = null;
    StorageService.instanceHome = null;
  }

  private ensureDirectories(): void {
    if (!existsSync(this.agentmuxHome)) {
      mkdirSync(this.agentmuxHome, { recursive: true });
    }
  }

  private async ensureFile(filePath: string, defaultContent: any = []): Promise<void> {
    const fileName = path.basename(filePath);

    if (!existsSync(filePath)) {
      this.logger.info('Creating new storage file', { file: fileName });
      await this.atomicWriteFile(filePath, JSON.stringify(defaultContent, null, 2));
    } else {
      // File exists - validate it's not corrupted
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        // If file is empty or corrupted, but not the default content we expect, preserve it
        // Only overwrite if file is truly empty/invalid and we're setting defaults
        if (!content.trim() || content.trim() === '' || parsed === null || parsed === undefined) {
          this.logger.warn('Storage file exists but appears empty/corrupted, creating backup and initializing with defaults', {
            file: fileName,
            contentLength: content?.length || 0,
          });
          // Backup even empty files for debugging
          const backupPath = `${filePath}.empty.${Date.now()}`;
          try {
            await fs.copyFile(filePath, backupPath);
            this.logger.info('Backed up empty file', { backupPath });
          } catch {
            // Ignore backup errors
          }
          await this.atomicWriteFile(filePath, JSON.stringify(defaultContent, null, 2));
        }
      } catch (error) {
        // File exists but can't be parsed - back it up and create new one
        this.logger.warn('Storage file exists but cannot be parsed, backing up and reinitializing', {
          file: fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        const backupPath = `${filePath}.backup.${Date.now()}`;
        try {
          await fs.copyFile(filePath, backupPath);
          this.logger.info('Backed up corrupted file', { backupPath });
        } catch (backupError) {
          this.logger.error('Failed to backup corrupted file', {
            error: backupError instanceof Error ? backupError.message : String(backupError),
          });
        }
        await this.atomicWriteFile(filePath, JSON.stringify(defaultContent, null, 2));
      }
    }
  }

  /**
   * Atomic write operation with file locking to prevent race conditions
   * @param filePath - Path to the file to write
   * @param content - Content to write to the file
   */
  private async atomicWriteFile(filePath: string, content: string): Promise<void> {
    // Use file-based locking to prevent concurrent writes
    const lockKey = filePath;
    
    // Wait for any existing write operation on this file to complete
    if (this.fileLocks.has(lockKey)) {
      await this.fileLocks.get(lockKey);
    }
    
    // Create a new lock for this write operation
    const writeOperation = this.performAtomicWrite(filePath, content);
    this.fileLocks.set(lockKey, writeOperation);
    
    try {
      await writeOperation;
    } finally {
      // Clean up the lock after operation completes
      this.fileLocks.delete(lockKey);
    }
  }
  
  /**
   * Performs the actual atomic write using a temporary file and rename
   * @param filePath - Target file path
   * @param content - Content to write
   */
  private async performAtomicWrite(filePath: string, content: string): Promise<void> {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;
    
    try {
      // Write to temporary file first
      await fs.writeFile(tempPath, content, 'utf8');
      
      // Ensure data is written to disk before rename
      const fileHandle = await fs.open(tempPath, 'r+');
      await fileHandle.sync();
      await fileHandle.close();
      
      // Atomically move temp file to target (this is atomic on most filesystems)
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await fs.unlink(tempPath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  // Team management
  async getTeams(): Promise<Team[]> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);

      // Handle both old array format and new object format
      if (Array.isArray(data)) {
        // Convert old format to new format
        this.logger.info('Converting teams.json from old array format to new object format');
        const newData = {
          teams: data,
          orchestrator: this.createDefaultOrchestrator()
        };
        await this.atomicWriteFile(this.teamsFile, JSON.stringify(newData, null, 2));
        const processedTeams = data.map((team: Team) => {
          return TeamModel.fromJSON(team).toJSON();
        });
        return processedTeams;
      }

      const teams = data.teams || [];

      const processedTeams = teams.map((team: Team) => {
        const processedTeam = TeamModel.fromJSON(team).toJSON();
        return processedTeam;
      });

      this.logger.debug('Retrieved teams from storage', { count: processedTeams.length });
      return processedTeams;
    } catch (error) {
      this.logger.error('Error reading teams', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async saveTeam(team: Team): Promise<void> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);

      let teamsData = data;
      if (!data.teams) {
        // Convert old format or initialize
        teamsData = {
          teams: Array.isArray(data) ? data : [],
          orchestrator: data.orchestrator || this.createDefaultOrchestrator()
        };
      }

      const teams = teamsData.teams;
      const existingIndex = teams.findIndex((t: Team) => t.id === team.id);
      const isUpdate = existingIndex >= 0;

      if (isUpdate) {
        teams[existingIndex] = team;
      } else {
        teams.push(team);
      }

      teamsData.teams = teams;

      await this.atomicWriteFile(this.teamsFile, JSON.stringify(teamsData, null, 2));

      this.logger.info('Team saved successfully', {
        teamId: team.id,
        teamName: team.name,
        action: isUpdate ? 'updated' : 'created',
        totalTeams: teams.length,
        memberCount: team.members?.length || 0,
        filePath: this.teamsFile,
      });
    } catch (error) {
      this.logger.error('Error saving team', {
        teamId: team.id,
        teamName: team.name,
        error: error instanceof Error ? error.message : String(error),
        filePath: this.teamsFile,
      });
      throw error;
    }
  }


  async deleteTeam(id: string): Promise<void> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);
      
      let teamsData = data;
      if (!data.teams) {
        teamsData = {
          teams: Array.isArray(data) ? data : [],
          orchestrator: data.orchestrator || this.createDefaultOrchestrator()
        };
      }
      
      const filteredTeams = teamsData.teams.filter((t: Team) => t.id !== id);
      teamsData.teams = filteredTeams;
      await this.atomicWriteFile(this.teamsFile, JSON.stringify(teamsData, null, 2));
    } catch (error) {
      console.error('Error deleting team:', error);
      throw error;
    }
  }

  // Project management
  async getProjects(): Promise<Project[]> {
    try {
      await this.ensureFile(this.projectsFile);
      const content = await fs.readFile(this.projectsFile, 'utf-8');
      const projects = JSON.parse(content) as Project[];
      this.logger.debug('Retrieved projects from storage', { count: projects.length });
      return projects.map(project => ProjectModel.fromJSON(project).toJSON());
    } catch (error) {
      this.logger.error('Error reading projects', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async addProject(projectPath: string): Promise<Project> {
    try {
      // Resolve to absolute path to ensure .agentmux is created in the correct location
      // If path is relative, resolve it relative to the parent directory of the current working directory
      let resolvedProjectPath: string;
      if (path.isAbsolute(projectPath)) {
        resolvedProjectPath = projectPath;
      } else {
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
        status: 'stopped',
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
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  }

  async saveProject(project: Project): Promise<void> {
    try {
      const projects = await this.getProjects();
      const existingIndex = projects.findIndex(p => p.id === project.id);
      const isUpdate = existingIndex >= 0;

      if (isUpdate) {
        projects[existingIndex] = project;
      } else {
        projects.push(project);
      }

      const newContent = JSON.stringify(projects, null, 2);
      await this.atomicWriteFile(this.projectsFile, newContent);

      this.logger.info('Project saved successfully', {
        projectId: project.id,
        projectName: project.name,
        action: isUpdate ? 'updated' : 'created',
        totalProjects: projects.length,
        filePath: this.projectsFile,
      });
    } catch (error) {
      this.logger.error('Error saving project', {
        projectId: project.id,
        projectName: project.name,
        error: error instanceof Error ? error.message : String(error),
        filePath: this.projectsFile,
      });
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      const projects = await this.getProjects();
      const filteredProjects = projects.filter(p => p.id !== id);
      await this.atomicWriteFile(this.projectsFile, JSON.stringify(filteredProjects, null, 2));
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  // Ticket management
  async getTickets(projectPath: string, filter?: TicketFilter): Promise<Ticket[]> {
    try {
      const resolvedProjectPath = path.resolve(projectPath);
      const ticketsDir = path.join(resolvedProjectPath, '.agentmux', 'tasks');
      
      if (!existsSync(ticketsDir)) {
        return [];
      }

      const files = await fs.readdir(ticketsDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
      
      const tickets: Ticket[] = [];
      
      for (const file of yamlFiles) {
        try {
          const filePath = path.join(ticketsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const ticket = this.parseTicketYAML(content);
          tickets.push(ticket);
        } catch (error) {
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
    } catch (error) {
      console.error('Error reading tickets:', error);
      return [];
    }
  }

  async saveTicket(projectPath: string, ticket: Ticket): Promise<void> {
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
    } catch (error) {
      console.error('Error saving ticket:', error);
      throw error;
    }
  }

  async deleteTicket(projectPath: string, ticketId: string): Promise<void> {
    try {
      const resolvedProjectPath = path.resolve(projectPath);
      const ticketsDir = path.join(resolvedProjectPath, '.agentmux', 'tasks');
      const filename = `${ticketId}.yaml`;
      const filePath = path.join(ticketsDir, filename);
      
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }
  }

  private parseTicketYAML(content: string): Ticket {
    const lines = content.split('\n');
    let frontmatterEnd = -1;
    let frontmatterStart = -1;

    // Find YAML frontmatter
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (frontmatterStart === -1) {
          frontmatterStart = i;
        } else {
          frontmatterEnd = i;
          break;
        }
      }
    }

    let frontmatter: any = {};
    let description = '';

    if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
      const yamlContent = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
      frontmatter = parseYAML(yamlContent) || {};
      description = lines.slice(frontmatterEnd + 1).join('\n').trim();
    } else {
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
  watchProject(projectPath: string): FSWatcher {
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
  async getRuntimeState(): Promise<any> {
    try {
      await this.ensureFile(this.runtimeFile, {});
      const content = await fs.readFile(this.runtimeFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading runtime state:', error);
      return {};
    }
  }

  async saveRuntimeState(state: any): Promise<void> {
    try {
      await this.atomicWriteFile(this.runtimeFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving runtime state:', error);
      throw error;
    }
  }

  /**
   * Create template files for a new project
   */
  private async createProjectTemplateFiles(agentmuxDir: string, projectName: string): Promise<void> {
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
    } catch (error) {
      console.error('Error creating project template files:', error);
      // Don't throw - project can still work without template files
    }
  }

  // Scheduled Messages management
  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    try {
      await this.ensureFile(this.scheduledMessagesFile, []);
      const content = await fs.readFile(this.scheduledMessagesFile, 'utf-8');
      
      // Handle empty content or malformed JSON
      if (!content.trim()) {
        await this.atomicWriteFile(this.scheduledMessagesFile, JSON.stringify([], null, 2));
        return [];
      }
      
      try {
        return JSON.parse(content) as ScheduledMessage[];
      } catch (parseError) {
        console.error('Error parsing scheduled messages JSON, resetting file:', parseError);
        // Reset the file with empty array if JSON is corrupted
        await this.atomicWriteFile(this.scheduledMessagesFile, JSON.stringify([], null, 2));
        return [];
      }
    } catch (error) {
      console.error('Error reading scheduled messages:', error);
      return [];
    }
  }

  async saveScheduledMessage(scheduledMessage: ScheduledMessage): Promise<void> {
    try {
      const messages = await this.getScheduledMessages();
      const existingIndex = messages.findIndex(m => m.id === scheduledMessage.id);
      
      if (existingIndex >= 0) {
        messages[existingIndex] = scheduledMessage;
      } else {
        messages.push(scheduledMessage);
      }

      await this.atomicWriteFile(this.scheduledMessagesFile, JSON.stringify(messages, null, 2));
    } catch (error) {
      console.error('Error saving scheduled message:', error);
      throw error;
    }
  }

  async getScheduledMessage(id: string): Promise<ScheduledMessage | undefined> {
    try {
      const messages = await this.getScheduledMessages();
      return messages.find(m => m.id === id);
    } catch (error) {
      console.error('Error getting scheduled message:', error);
      return undefined;
    }
  }

  async deleteScheduledMessage(id: string): Promise<boolean> {
    try {
      const messages = await this.getScheduledMessages();
      const filteredMessages = messages.filter(m => m.id !== id);
      
      if (filteredMessages.length === messages.length) {
        return false; // Message not found
      }

      await this.atomicWriteFile(this.scheduledMessagesFile, JSON.stringify(filteredMessages, null, 2));
      return true;
    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      throw error;
    }
  }

  // Message Delivery Logs management
  async getDeliveryLogs(): Promise<MessageDeliveryLog[]> {
    try {
      await this.ensureFile(this.deliveryLogsFile);
      const content = await fs.readFile(this.deliveryLogsFile, 'utf-8');
      const logs = JSON.parse(content) as MessageDeliveryLog[];
      // Sort by sentAt (newest first)
      return logs.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    } catch (error) {
      console.error('Error reading delivery logs:', error);
      return [];
    }
  }

  async saveDeliveryLog(log: MessageDeliveryLog): Promise<void> {
    try {
      const logs = await this.getDeliveryLogs();
      logs.unshift(log); // Add to beginning for newest first order
      
      // Keep only last 1000 logs to prevent file from getting too large
      const trimmedLogs = logs.slice(0, 1000);
      
      await this.atomicWriteFile(this.deliveryLogsFile, JSON.stringify(trimmedLogs, null, 2));
    } catch (error) {
      console.error('Error saving delivery log:', error);
      throw error;
    }
  }

  async clearDeliveryLogs(): Promise<void> {
    try {
      await this.atomicWriteFile(this.deliveryLogsFile, JSON.stringify([], null, 2));
    } catch (error) {
      console.error('Error clearing delivery logs:', error);
      throw error;
    }
  }

  // Orchestrator management
  async getOrchestratorStatus(): Promise<{ sessionName: string; agentStatus: AgentStatus; workingStatus: WorkingStatus; runtimeType: RuntimeType; createdAt: string; updatedAt: string } | null> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.orchestrator) {
        return data.orchestrator;
      }
      
      // If no orchestrator in new format, create one with inactive status
      const orchestrator = this.createDefaultOrchestrator();
      await this.updateAgentStatus(CONFIG_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE);
      return orchestrator;
    } catch (error) {
      console.error('Error reading orchestrator status:', error);
      return null;
    }
  }

  /**
   * Update agent status for orchestrator or any team member
   * @param sessionName - Session name of the agent (CONFIG_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME for orchestrator)
   * @param status - New agent status (AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE | AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVATING | AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE)
   */
  async updateAgentStatus(sessionName: string, status: AgentStatus): Promise<void> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);
      
      let teamsData = data;
      if (!data.teams) {
        // Convert old format
        teamsData = {
          teams: Array.isArray(data) ? data : [],
          orchestrator: this.createDefaultOrchestrator()
        };
      }
      
      // Handle orchestrator
      if (sessionName === CONFIG_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) {
        if (!teamsData.orchestrator) {
          teamsData.orchestrator = this.createDefaultOrchestrator();
        }
        teamsData.orchestrator.agentStatus = status;
        teamsData.orchestrator.updatedAt = new Date().toISOString();
      } else {
        // Handle regular team members
        let memberFound = false;
        for (const team of teamsData.teams) {
          for (const member of team.members || []) {
            if (member.sessionName === sessionName) {
              member.agentStatus = status;
              member.updatedAt = new Date().toISOString();
              memberFound = true;
              break;
            }
          }
          if (memberFound) break;
        }
        
        if (!memberFound) {
          console.warn(`Agent with session ${sessionName} not found in teams data`);
        }
      }
      
      await this.atomicWriteFile(this.teamsFile, JSON.stringify(teamsData, null, 2));
    } catch (error) {
      console.error('Error updating agent status:', error);
      throw error;
    }
  }

  /**
   * Update team member runtime type
   */
  async updateTeamMemberRuntimeType(teamId: string, memberId: string, runtimeType: RuntimeType): Promise<void> {
    try {
      const teams = await this.getTeams();
      const team = teams.find(t => t.id === teamId);
      
      if (!team) {
        throw new Error(`Team not found: ${teamId}`);
      }
      
      const member = team.members.find(m => m.id === memberId);
      if (!member) {
        throw new Error(`Team member not found: ${memberId} in team ${teamId}`);
      }
      
      member.runtimeType = runtimeType;
      member.updatedAt = new Date().toISOString();
      
      await this.saveTeam(team);
    } catch (error) {
      console.error('Error updating team member runtime type:', error);
      throw error;
    }
  }

  /**
   * Update orchestrator runtime type
   */
  async updateOrchestratorRuntimeType(runtimeType: RuntimeType): Promise<void> {
    try {
      await this.ensureFile(this.teamsFile, { teams: [], orchestrator: this.createDefaultOrchestrator() });
      const content = await fs.readFile(this.teamsFile, 'utf-8');
      const data = JSON.parse(content);
      
      let teamsData = data;
      if (!data.teams) {
        // Convert old format
        teamsData = {
          teams: Array.isArray(data) ? data : [],
          orchestrator: this.createDefaultOrchestrator()
        };
      }
      
      if (!teamsData.orchestrator) {
        teamsData.orchestrator = this.createDefaultOrchestrator();
      }
      
      teamsData.orchestrator.runtimeType = runtimeType;
      teamsData.orchestrator.updatedAt = new Date().toISOString();
      
      await this.atomicWriteFile(this.teamsFile, JSON.stringify(teamsData, null, 2));
    } catch (error) {
      console.error('Error updating orchestrator runtime type:', error);
      throw error;
    }
  }


  /**
   * @deprecated Use updateAgentStatus instead
   */
  async updateOrchestratorStatus(status: string): Promise<void> {
    return this.updateAgentStatus(CONFIG_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME, status as AgentStatus);
  }
}