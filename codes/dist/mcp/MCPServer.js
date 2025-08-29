"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentMuxMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
/**
 * MCP Server for AgentMux Integration
 * Phase 3 (Optional) - Provides Claude Code with AgentMux control capabilities
 *
 * Key Features:
 * - Project lifecycle management
 * - Team creation and assignment
 * - Tmux session monitoring
 * - Activity tracking and reporting
 * - Real-time status updates
 */
class AgentMuxMCPServer {
    constructor(storage, tmuxManager, activityPoller) {
        this.storage = storage;
        this.tmuxManager = tmuxManager;
        this.activityPoller = activityPoller;
        this.server = new index_js_1.Server({
            name: 'agentmux-mcp-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
                resources: {},
                prompts: {}
            }
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                // Project Management Tools
                {
                    name: 'create_project',
                    description: 'Create a new AgentMux project with specified path and configuration',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Project name' },
                            path: { type: 'string', description: 'Filesystem path for project' },
                            description: { type: 'string', description: 'Optional project description' }
                        },
                        required: ['name', 'path']
                    }
                },
                {
                    name: 'list_projects',
                    description: 'List all AgentMux projects with their current status',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            status: {
                                type: 'string',
                                enum: ['active', 'idle', 'archived'],
                                description: 'Filter by project status (optional)'
                            }
                        }
                    }
                },
                {
                    name: 'get_project_details',
                    description: 'Get detailed information about a specific project',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            projectId: { type: 'string', description: 'Project ID' }
                        },
                        required: ['projectId']
                    }
                },
                // Team Management Tools
                {
                    name: 'create_team',
                    description: 'Create a new AgentMux team with specified roles and configuration',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', description: 'Team name' },
                            roles: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string', description: 'Role name (orchestrator, pm, dev, qa)' },
                                        required: { type: 'boolean', description: 'Whether role is required' }
                                    },
                                    required: ['name', 'required']
                                },
                                description: 'Team roles configuration'
                            }
                        },
                        required: ['name', 'roles']
                    }
                },
                {
                    name: 'list_teams',
                    description: 'List all AgentMux teams with their current status',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            status: {
                                type: 'string',
                                enum: ['active', 'idle', 'paused', 'stopped'],
                                description: 'Filter by team status (optional)'
                            }
                        }
                    }
                },
                // Assignment Management Tools
                {
                    name: 'assign_team_to_project',
                    description: 'Assign a team to work on a project, creating tmux session',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            teamId: { type: 'string', description: 'Team ID' },
                            projectId: { type: 'string', description: 'Project ID' }
                        },
                        required: ['teamId', 'projectId']
                    }
                },
                {
                    name: 'list_assignments',
                    description: 'List all current project-team assignments',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            status: {
                                type: 'string',
                                enum: ['active', 'paused', 'completed'],
                                description: 'Filter by assignment status (optional)'
                            }
                        }
                    }
                },
                // Activity Monitoring Tools
                {
                    name: 'get_activity_status',
                    description: 'Get real-time activity status for all teams and projects',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            teamId: { type: 'string', description: 'Filter by team ID (optional)' },
                            projectId: { type: 'string', description: 'Filter by project ID (optional)' }
                        }
                    }
                },
                {
                    name: 'get_activity_timeline',
                    description: 'Get activity timeline for projects and teams',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: { type: 'number', description: 'Number of entries to return (default: 50)' },
                            teamId: { type: 'string', description: 'Filter by team ID (optional)' },
                            projectId: { type: 'string', description: 'Filter by project ID (optional)' }
                        }
                    }
                },
                // Tmux Integration Tools
                {
                    name: 'list_tmux_sessions',
                    description: 'List all active tmux sessions managed by AgentMux',
                    inputSchema: {
                        type: 'object',
                        properties: {}
                    }
                },
                {
                    name: 'capture_session_output',
                    description: 'Capture output from a specific tmux session/window/pane',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sessionName: { type: 'string', description: 'Tmux session name' },
                            windowIndex: { type: 'number', description: 'Window index (optional)' },
                            paneIndex: { type: 'number', description: 'Pane index (optional)' },
                            lines: { type: 'number', description: 'Number of lines to capture (optional)' }
                        },
                        required: ['sessionName']
                    }
                },
                // Control Tools
                {
                    name: 'pause_team',
                    description: 'Pause a team\'s work temporarily',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            teamId: { type: 'string', description: 'Team ID' }
                        },
                        required: ['teamId']
                    }
                },
                {
                    name: 'resume_team',
                    description: 'Resume a paused team\'s work',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            teamId: { type: 'string', description: 'Team ID' }
                        },
                        required: ['teamId']
                    }
                },
                {
                    name: 'end_assignment',
                    description: 'End a team\'s assignment to a project',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            assignmentId: { type: 'string', description: 'Assignment ID' }
                        },
                        required: ['assignmentId']
                    }
                }
            ]
        }));
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'create_project':
                        return await this.handleCreateProject(args);
                    case 'list_projects':
                        return await this.handleListProjects(args);
                    case 'get_project_details':
                        return await this.handleGetProjectDetails(args);
                    case 'create_team':
                        return await this.handleCreateTeam(args);
                    case 'list_teams':
                        return await this.handleListTeams(args);
                    case 'assign_team_to_project':
                        return await this.handleAssignTeamToProject(args);
                    case 'list_assignments':
                        return await this.handleListAssignments(args);
                    case 'get_activity_status':
                        return await this.handleGetActivityStatus(args);
                    case 'get_activity_timeline':
                        return await this.handleGetActivityTimeline(args);
                    case 'list_tmux_sessions':
                        return await this.handleListTmuxSessions(args);
                    case 'capture_session_output':
                        return await this.handleCaptureSessionOutput(args);
                    case 'pause_team':
                        return await this.handlePauseTeam(args);
                    case 'resume_team':
                        return await this.handleResumeTeam(args);
                    case 'end_assignment':
                        return await this.handleEndAssignment(args);
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                console.error('MCP tool error:', error);
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, error instanceof Error ? error.message : 'Unknown error');
            }
        });
    }
    // Project Management Handlers
    async handleCreateProject(args) {
        const { name, path, description } = args;
        const project = await this.storage.createProject({
            name,
            path,
            description,
            status: 'idle'
        });
        return {
            content: [{
                    type: 'text',
                    text: `Created project "${project.name}" with ID: ${project.id}\nPath: ${project.path}\nStatus: ${project.status}`
                }]
        };
    }
    async handleListProjects(args) {
        const projects = await this.storage.getProjects();
        const filtered = args.status ? projects.filter(p => p.status === args.status) : projects;
        const projectList = filtered.map(p => ({
            id: p.id,
            name: p.name,
            path: p.path,
            status: p.status,
            assignedTeamId: p.assignedTeamId,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        }));
        return {
            content: [{
                    type: 'text',
                    text: `Found ${projectList.length} projects:\n${JSON.stringify(projectList, null, 2)}`
                }]
        };
    }
    async handleGetProjectDetails(args) {
        const { projectId } = args;
        const projects = await this.storage.getProjects();
        const project = projects.find(p => p.id === projectId);
        if (!project) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Project not found: ${projectId}`);
        }
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(project, null, 2)
                }]
        };
    }
    // Team Management Handlers
    async handleCreateTeam(args) {
        const { name, roles } = args;
        const team = await this.storage.createTeam({
            name,
            roles: roles.map((role) => ({
                name: role.name,
                required: role.required
            })),
            status: 'idle'
        });
        return {
            content: [{
                    type: 'text',
                    text: `Created team "${team.name}" with ID: ${team.id}\nRoles: ${team.roles.map(r => `${r.name} (${r.required ? 'required' : 'optional'})`).join(', ')}\nStatus: ${team.status}`
                }]
        };
    }
    async handleListTeams(args) {
        const teams = await this.storage.getTeams();
        const filtered = args.status ? teams.filter(t => t.status === args.status) : teams;
        const teamList = filtered.map(t => ({
            id: t.id,
            name: t.name,
            roles: t.roles,
            status: t.status,
            tmuxSessionName: t.tmuxSessionName,
            assignedProjectId: t.assignedProjectId,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString()
        }));
        return {
            content: [{
                    type: 'text',
                    text: `Found ${teamList.length} teams:\n${JSON.stringify(teamList, null, 2)}`
                }]
        };
    }
    // Assignment Management Handlers
    async handleAssignTeamToProject(args) {
        const { teamId, projectId } = args;
        // Get team and project
        const teams = await this.storage.getTeams();
        const projects = await this.storage.getProjects();
        const team = teams.find(t => t.id === teamId);
        const project = projects.find(p => p.id === projectId);
        if (!team) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Team not found: ${teamId}`);
        }
        if (!project) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Project not found: ${projectId}`);
        }
        // Create assignment
        const assignment = await this.storage.createAssignment({
            teamId,
            projectId,
            status: 'active'
        });
        // Create tmux session for team
        const sessionName = `agentmux-${team.name}-${Date.now()}`;
        // Update team with session name
        await this.storage.updateTeam(teamId, {
            tmuxSessionName: sessionName,
            status: 'active',
            assignedProjectId: projectId
        });
        // Update project status
        await this.storage.updateProject(projectId, {
            status: 'active',
            assignedTeamId: teamId
        });
        return {
            content: [{
                    type: 'text',
                    text: `Assigned team "${team.name}" to project "${project.name}"\nAssignment ID: ${assignment.id}\nTmux session: ${sessionName}\nStatus: Active`
                }]
        };
    }
    async handleListAssignments(args) {
        const assignments = await this.storage.getAssignments();
        const filtered = args.status ? assignments.filter(a => a.status === args.status) : assignments;
        const assignmentList = filtered.map(a => ({
            id: a.id,
            teamId: a.teamId,
            projectId: a.projectId,
            status: a.status,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString()
        }));
        return {
            content: [{
                    type: 'text',
                    text: `Found ${assignmentList.length} assignments:\n${JSON.stringify(assignmentList, null, 2)}`
                }]
        };
    }
    // Activity Monitoring Handlers
    async handleGetActivityStatus(args) {
        const { teamId, projectId } = args;
        const status = await this.activityPoller.getCurrentStatus();
        let filtered = status;
        if (teamId || projectId) {
            const teams = await this.storage.getTeams();
            filtered = status.filter(s => {
                if (teamId) {
                    const team = teams.find(t => t.id === teamId && t.tmuxSessionName === s.sessionName);
                    if (!team)
                        return false;
                }
                if (projectId) {
                    const team = teams.find(t => t.tmuxSessionName === s.sessionName && t.assignedProjectId === projectId);
                    if (!team)
                        return false;
                }
                return true;
            });
        }
        return {
            content: [{
                    type: 'text',
                    text: `Activity Status:\n${JSON.stringify(filtered, null, 2)}`
                }]
        };
    }
    async handleGetActivityTimeline(args) {
        const { limit = 50, teamId, projectId } = args;
        let activities = await this.storage.getActivity(limit);
        if (teamId) {
            activities = activities.filter(a => a.teamId === teamId);
        }
        if (projectId) {
            activities = activities.filter(a => a.projectId === projectId);
        }
        return {
            content: [{
                    type: 'text',
                    text: `Activity Timeline (${activities.length} entries):\n${JSON.stringify(activities, null, 2)}`
                }]
        };
    }
    // Tmux Integration Handlers
    async handleListTmuxSessions(args) {
        const sessions = await this.tmuxManager.listSessions();
        return {
            content: [{
                    type: 'text',
                    text: `Active Tmux Sessions:\n${JSON.stringify(sessions, null, 2)}`
                }]
        };
    }
    async handleCaptureSessionOutput(args) {
        const { sessionName, windowIndex = 0, paneIndex = 0, lines } = args;
        try {
            const target = `${sessionName}:${windowIndex}.${paneIndex}`;
            const output = await this.tmuxManager.capturePane(target, lines);
            return {
                content: [{
                        type: 'text',
                        text: `Output from ${target}:\n${output}`
                    }]
            };
        }
        catch (error) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Failed to capture session output: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    // Control Handlers
    async handlePauseTeam(args) {
        const { teamId } = args;
        const updatedTeam = await this.storage.updateTeam(teamId, { status: 'paused' });
        if (!updatedTeam) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Team not found: ${teamId}`);
        }
        return {
            content: [{
                    type: 'text',
                    text: `Paused team "${updatedTeam.name}" (ID: ${teamId})`
                }]
        };
    }
    async handleResumeTeam(args) {
        const { teamId } = args;
        const updatedTeam = await this.storage.updateTeam(teamId, { status: 'active' });
        if (!updatedTeam) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Team not found: ${teamId}`);
        }
        return {
            content: [{
                    type: 'text',
                    text: `Resumed team "${updatedTeam.name}" (ID: ${teamId})`
                }]
        };
    }
    async handleEndAssignment(args) {
        const { assignmentId } = args;
        const updatedAssignment = await this.storage.updateAssignment(assignmentId, {
            status: 'completed'
        });
        if (!updatedAssignment) {
            throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Assignment not found: ${assignmentId}`);
        }
        // Update related team and project
        const team = await this.storage.updateTeam(updatedAssignment.teamId, {
            status: 'idle',
            assignedProjectId: undefined
        });
        const project = await this.storage.updateProject(updatedAssignment.projectId, {
            status: 'idle',
            assignedTeamId: undefined
        });
        return {
            content: [{
                    type: 'text',
                    text: `Ended assignment ${assignmentId}\nTeam and project set to idle status`
                }]
        };
    }
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.log('AgentMux MCP Server started');
    }
    async stop() {
        await this.server.close();
        console.log('AgentMux MCP Server stopped');
    }
}
exports.AgentMuxMCPServer = AgentMuxMCPServer;
//# sourceMappingURL=MCPServer.js.map