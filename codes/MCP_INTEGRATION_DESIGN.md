# AgentMux MCP Server Architecture Design

## Overview

This document outlines the design for integrating Model Context Protocol (MCP) server capabilities into AgentMux, enabling Claude agents to interact with AgentMux projects, teams, and tmux sessions through standardized MCP interfaces.

## Architecture Integration

### Current AgentMux Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    AgentMux Process                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React SPA)                                       │
│  ├─ Dashboard Components                                     │
│  ├─ Project/Team Management                                 │
│  ├─ Assignment Board                                        │
│  └─ Spec Editor                                            │
├─────────────────────────────────────────────────────────────┤
│  Backend (Express.js)                                       │
│  ├─ REST API (/api/*)                                      │
│  ├─ WebSocket Handler                                       │
│  ├─ Tmux Controller                                        │
│  ├─ Activity Poller                                        │
│  └─ File Storage Manager                                   │
└─────────────────────────────────────────────────────────────┘
```

### Proposed MCP Integration
```
┌─────────────────────────────────────────────────────────────┐
│                    AgentMux Process                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React SPA)                                       │
│  └─ [Same as current]                                      │
├─────────────────────────────────────────────────────────────┤
│  Backend (Express.js)                                       │
│  ├─ REST API (/api/*)                                      │
│  ├─ WebSocket Handler                                       │
│  ├─ MCP Server (NEW)                 ┌─────────────────────┐ │
│  │   ├─ Project Management Tools     │                     │ │
│  │   ├─ Team Management Tools        │   Claude Client     │ │
│  │   ├─ Tmux Integration Tools       │     (External)      │ │
│  │   ├─ Activity Resources           │                     │ │
│  │   └─ Spec Management Prompts      │                     │ │
│  ├─ Tmux Controller                  └─────────────────────┘ │
│  ├─ Activity Poller                                         │
│  └─ File Storage Manager                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    tmux     │
                    │  sessions   │
                    └─────────────┘
```

## MCP Server Components

### 1. Tools (Agent-Executable Actions)

#### Project Management Tools
```typescript
interface ProjectManagementTools {
  // Project CRUD operations
  "create-project": (name: string, fsPath: string, description?: string) => Project;
  "update-project": (projectId: string, updates: Partial<Project>) => Project;
  "delete-project": (projectId: string) => boolean;
  "list-projects": (status?: ProjectStatus) => Project[];
  "get-project": (projectId: string) => Project;
  
  // Spec file operations
  "write-spec": (projectId: string, filePath: string, content: string) => boolean;
  "read-spec": (projectId: string, filePath: string) => string;
  "list-specs": (projectId: string) => string[];
}
```

#### Team Management Tools
```typescript
interface TeamManagementTools {
  // Team CRUD operations
  "create-team": (name: string, roles: Role[]) => Team;
  "update-team": (teamId: string, updates: Partial<Team>) => Team;
  "delete-team": (teamId: string) => boolean;
  "list-teams": (status?: TeamStatus) => Team[];
  "get-team": (teamId: string) => Team;
  
  // Team control operations
  "start-team": (teamId: string) => boolean;
  "pause-team": (teamId: string) => boolean;
  "stop-team": (teamId: string) => boolean;
  "duplicate-team": (teamId: string, newName: string) => Team;
}
```

#### Assignment Management Tools
```typescript
interface AssignmentTools {
  "create-assignment": (projectId: string, teamId: string) => Assignment;
  "update-assignment": (assignmentId: string, updates: Partial<Assignment>) => Assignment;
  "delete-assignment": (assignmentId: string) => boolean;
  "list-assignments": (status?: AssignmentStatus) => Assignment[];
  "get-assignment": (assignmentId: string) => Assignment;
}
```

#### Tmux Integration Tools
```typescript
interface TmuxTools {
  // Session management
  "list-tmux-sessions": () => TmuxSession[];
  "create-tmux-session": (name: string) => boolean;
  "kill-tmux-session": (sessionName: string) => boolean;
  
  // Window/Pane operations
  "create-window": (sessionName: string, windowName: string, workingDir?: string) => boolean;
  "kill-window": (sessionName: string, windowId: string) => boolean;
  "send-keys": (target: string, keys: string) => boolean;
  "capture-pane": (target: string, lines?: number) => string;
  
  // Activity monitoring
  "check-pane-activity": (target: string) => ActivityStatus;
  "get-session-activity": (sessionName: string) => SessionActivity;
}
```

### 2. Resources (Context Data)

#### Project Resources
```typescript
interface ProjectResources {
  // Static resources
  "project://all": () => Project[];
  "project://active": () => Project[];
  
  // Dynamic resources with parameters
  "project://{projectId}": (projectId: string) => Project;
  "project://{projectId}/specs": (projectId: string) => string[];
  "project://{projectId}/specs/{filePath}": (projectId: string, filePath: string) => string;
  "project://{projectId}/activity": (projectId: string) => ActivityEntry[];
}
```

#### Team Resources
```typescript
interface TeamResources {
  "team://all": () => Team[];
  "team://active": () => Team[];
  "team://{teamId}": (teamId: string) => Team;
  "team://{teamId}/session": (teamId: string) => TmuxSession;
  "team://{teamId}/activity": (teamId: string) => ActivityEntry[];
}
```

#### Activity Resources
```typescript
interface ActivityResources {
  "activity://recent": () => ActivityEntry[];
  "activity://live": () => LiveActivityStatus;
  "activity://summary": () => ActivitySummary;
}
```

### 3. Prompts (Interaction Templates)

#### Project Management Prompts
```typescript
interface ProjectPrompts {
  "setup-new-project": {
    args: { name: string; type: 'web' | 'api' | 'cli' | 'other' };
    generates: SystemMessage[];
  };
  
  "analyze-project-structure": {
    args: { projectId: string };
    generates: SystemMessage[];
  };
  
  "suggest-team-composition": {
    args: { projectId: string; complexity: 'simple' | 'medium' | 'complex' };
    generates: SystemMessage[];
  };
}
```

#### Team Coordination Prompts
```typescript
interface TeamPrompts {
  "start-team-session": {
    args: { teamId: string; projectId: string };
    generates: SystemMessage[];
  };
  
  "team-status-report": {
    args: { teamId: string; timeRange?: string };
    generates: SystemMessage[];
  };
  
  "handoff-instructions": {
    args: { fromRole: string; toRole: string; context: string };
    generates: SystemMessage[];
  };
}
```

## Implementation Structure

### Core MCP Server Class
```typescript
// src/services/McpServer.ts
import { McpServer } from '@modelcontextprotocol/typescript-sdk';

export class AgentMuxMcpServer {
  private server: McpServer;
  private fileStorage: FileStorage;
  private tmuxController: TmuxController;
  private activityPoller: ActivityPoller;

  constructor(
    fileStorage: FileStorage,
    tmuxController: TmuxController,
    activityPoller: ActivityPoller
  ) {
    this.server = new McpServer({
      name: "agentmux",
      version: "1.0.0"
    });
    
    this.fileStorage = fileStorage;
    this.tmuxController = tmuxController;
    this.activityPoller = activityPoller;
    
    this.registerTools();
    this.registerResources();
    this.registerPrompts();
  }

  private registerTools() {
    // Project management tools
    this.registerProjectTools();
    
    // Team management tools
    this.registerTeamTools();
    
    // Assignment tools
    this.registerAssignmentTools();
    
    // Tmux integration tools
    this.registerTmuxTools();
  }

  private registerResources() {
    // Project resources
    this.registerProjectResources();
    
    // Team resources
    this.registerTeamResources();
    
    // Activity resources
    this.registerActivityResources();
  }

  private registerPrompts() {
    // Project management prompts
    this.registerProjectPrompts();
    
    // Team coordination prompts
    this.registerTeamPrompts();
  }

  async start(transport: Transport) {
    await this.server.connect(transport);
  }

  async stop() {
    await this.server.close();
  }
}
```

### Tool Implementation Examples

#### Project Management Tools
```typescript
private registerProjectTools() {
  this.server.registerTool(
    "create-project",
    {
      title: "Create New Project",
      description: "Create a new AgentMux project with specified name and filesystem path",
      inputSchema: z.object({
        name: z.string().min(1).max(100),
        fsPath: z.string().min(1),
        description: z.string().optional()
      })
    },
    async ({ name, fsPath, description }) => {
      try {
        const project = await this.fileStorage.createProject({
          name,
          fsPath,
          description,
          status: 'idle'
        });
        
        return {
          content: [{
            type: "text",
            text: `Project "${name}" created successfully with ID: ${project.id}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to create project: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  this.server.registerTool(
    "list-projects",
    {
      title: "List Projects",
      description: "List all AgentMux projects with optional status filter",
      inputSchema: z.object({
        status: z.enum(['active', 'idle', 'archived']).optional()
      })
    },
    async ({ status }) => {
      const projects = await this.fileStorage.getProjects();
      const filteredProjects = status 
        ? projects.filter(p => p.status === status)
        : projects;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(filteredProjects, null, 2)
        }]
      };
    }
  );
}
```

#### Tmux Integration Tools
```typescript
private registerTmuxTools() {
  this.server.registerTool(
    "send-keys",
    {
      title: "Send Keys to Tmux Pane",
      description: "Send keyboard input to a specific tmux pane",
      inputSchema: z.object({
        target: z.string().regex(/^[^:]+:\d+(\.\d+)?$/), // session:window.pane format
        keys: z.string().min(1)
      })
    },
    async ({ target, keys }) => {
      try {
        const success = await this.tmuxController.sendKeys(target, keys);
        
        return {
          content: [{
            type: "text",
            text: success 
              ? `Successfully sent keys to ${target}`
              : `Failed to send keys to ${target}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error sending keys: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );

  this.server.registerTool(
    "capture-pane",
    {
      title: "Capture Tmux Pane Content",
      description: "Capture the current content of a tmux pane",
      inputSchema: z.object({
        target: z.string().regex(/^[^:]+:\d+(\.\d+)?$/),
        lines: z.number().min(1).max(1000).optional().default(100)
      })
    },
    async ({ target, lines }) => {
      try {
        const content = await this.tmuxController.capturePane(target, lines);
        
        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text", 
            text: `Error capturing pane: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}
```

### Resource Implementation Examples

#### Project Resources
```typescript
private registerProjectResources() {
  // Static resource for all projects
  this.server.registerResource(
    "project://all",
    undefined, // No template parameters
    {
      title: "All Projects",
      description: "Complete list of all AgentMux projects"
    },
    async () => {
      const projects = await this.fileStorage.getProjects();
      
      return {
        contents: [{
          uri: "project://all",
          text: JSON.stringify(projects, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  );

  // Dynamic resource for individual projects
  this.server.registerResource(
    "project-detail",
    new ResourceTemplate("project://{projectId}", { list: undefined }),
    {
      title: "Project Details",
      description: "Detailed information about a specific project"
    },
    async (uri, { projectId }) => {
      const projects = await this.fileStorage.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(project, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  );

  // Project spec files resource
  this.server.registerResource(
    "project-spec",
    new ResourceTemplate("project://{projectId}/specs/{filePath}", { list: undefined }),
    {
      title: "Project Specification File",
      description: "Content of a project specification file"
    },
    async (uri, { projectId, filePath }) => {
      try {
        const content = await this.fileStorage.readSpec(projectId, filePath);
        
        return {
          contents: [{
            uri: uri.href,
            text: content,
            mimeType: filePath.endsWith('.md') ? "text/markdown" : "text/plain"
          }]
        };
      } catch (error) {
        throw new Error(`Failed to read spec file: ${error.message}`);
      }
    }
  );
}
```

### Prompt Implementation Examples

#### Team Coordination Prompts
```typescript
private registerTeamPrompts() {
  this.server.registerPrompt(
    "start-team-session",
    {
      title: "Start Team Session",
      description: "Generate instructions for starting a new team session",
      argsSchema: z.object({
        teamId: z.string(),
        projectId: z.string(),
        objectives: z.string().optional()
      })
    },
    async ({ teamId, projectId, objectives }) => {
      const team = await this.getTeam(teamId);
      const project = await this.getProject(projectId);
      
      if (!team || !project) {
        throw new Error("Team or project not found");
      }

      return {
        messages: [
          {
            role: "system" as const,
            content: {
              type: "text",
              text: `You are starting a new session for team "${team.name}" working on project "${project.name}".

Team Composition:
${team.roles.map(role => `- ${role.name}: ${role.count} member(s)`).join('\n')}

Project Details:
- Path: ${project.fsPath}
- Status: ${project.status}
- Description: ${project.description || 'No description'}

Session Objectives:
${objectives || 'No specific objectives provided'}

Your tmux session is: ${team.tmuxSessionName || 'Not yet created'}

Please coordinate with your team members and begin working on the assigned project.`
            }
          }
        ]
      };
    }
  );
}
```

## Integration with Existing AgentMux

### Server Integration Points

#### 1. Server Startup (src/server.ts)
```typescript
// Add MCP server initialization
import { AgentMuxMcpServer } from './services/McpServer';

// After existing service initialization
const mcpServer = new AgentMuxMcpServer(
  fileStorage,
  tmuxController, 
  activityPoller
);

// Optional: Start MCP server on different port or transport
if (process.env.MCP_ENABLED === 'true') {
  const mcpPort = process.env.MCP_PORT || 3002;
  // Initialize MCP server transport (stdio, http, etc.)
}
```

#### 2. Transport Configuration
```typescript
// Support multiple transport types
export enum McpTransportType {
  STDIO = 'stdio',
  HTTP = 'http', 
  WEBSOCKET = 'websocket'
}

export class McpTransportFactory {
  static create(type: McpTransportType, options: any) {
    switch (type) {
      case McpTransportType.STDIO:
        return new StdioServerTransport();
      case McpTransportType.HTTP:
        return new SSEServerTransport(options.port || 3002);
      case McpTransportType.WEBSOCKET:
        return new WebSocketServerTransport(options.port || 3003);
      default:
        throw new Error(`Unsupported transport type: ${type}`);
    }
  }
}
```

### Configuration Management

#### Environment Variables
```bash
# MCP Configuration
MCP_ENABLED=true
MCP_TRANSPORT=stdio  # stdio | http | websocket
MCP_PORT=3002        # For HTTP/WebSocket transports
MCP_DEBUG=false      # Enable debug logging
```

#### Runtime Configuration
```typescript
interface McpConfig {
  enabled: boolean;
  transport: McpTransportType;
  port?: number;
  debug: boolean;
  allowedOrigins?: string[];
  authentication?: {
    required: boolean;
    method: 'api-key' | 'jwt';
  };
}
```

## Security Considerations

### 1. Access Control
- All MCP operations should respect existing AgentMux permissions
- Implement rate limiting for MCP requests
- Validate all input parameters rigorously

### 2. Resource Protection
- Path-jail all file operations to project directories
- Sanitize tmux targets to prevent command injection
- Limit resource access to authorized projects/teams

### 3. Audit Logging
```typescript
interface McpAuditLog {
  timestamp: string;
  clientId: string;
  operation: string;
  resource: string;
  success: boolean;
  error?: string;
}
```

## Testing Strategy

### 1. Unit Tests
- Test each MCP tool individually
- Mock AgentMux services for isolation
- Validate input/output schemas

### 2. Integration Tests
- Test MCP server with real AgentMux backend
- Verify resource access permissions
- Test transport layer communication

### 3. E2E Tests
- Test with actual Claude clients
- Validate complete workflows
- Performance and reliability testing

## Deployment Considerations

### 1. Optional Feature Flag
- MCP server should be optional and disabled by default
- Enable through configuration or environment variable
- Graceful degradation when disabled

### 2. Performance Impact
- MCP server should not affect AgentMux core performance
- Consider resource isolation and limits
- Monitor memory and CPU usage

### 3. Backwards Compatibility
- MCP integration should not break existing functionality
- Maintain all current REST API endpoints
- WebSocket connections should remain unaffected

## Future Enhancements

### 1. Advanced Features
- Streaming updates for long-running operations
- Batch operations for multiple projects/teams
- Custom user-defined tools and resources

### 2. Claude Agent Templates
- Pre-built agent configurations for common tasks
- Role-specific prompts and tool access
- Project template integration

### 3. Monitoring and Analytics
- MCP usage metrics
- Performance monitoring
- Agent behavior analytics

This design provides a comprehensive foundation for MCP integration while maintaining AgentMux's core simplicity and functionality.