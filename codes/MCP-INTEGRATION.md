# AgentMux MCP Integration Guide

**Phase 3 (Optional)** - Model Context Protocol integration for Claude Code compatibility

## Overview

The AgentMux MCP Server provides Claude Code with powerful orchestration capabilities, allowing AI agents to manage development teams through a standardized protocol. This integration enables Claude to:

- Create and manage development projects
- Orchestrate multi-agent teams with defined roles
- Monitor real-time team activity through tmux sessions
- Control team workflows and handle error recovery
- Share context bidirectionally between Claude and agent teams

## Architecture

```
Claude Code (Client) ←→ MCP Protocol ←→ AgentMux MCP Server ←→ AgentMux Core
                                            ↓
                                    FileStorage + ActivityPoller
                                            ↓
                                      Tmux Sessions
                                            ↓
                                    Agent Team Workers
```

### Key Components

1. **AgentMuxMCPServer** (`src/mcp/MCPServer.ts`)
   - Main MCP server implementation
   - Exposes 15+ tools for project/team management
   - Handles authentication and error recovery

2. **ClaudeProtocol** (`src/mcp/protocols/ClaudeProtocol.ts`)
   - Standard workflow patterns for Claude agents
   - Communication protocols between roles
   - Error recovery procedures

3. **MCP CLI** (`src/mcp/cli.ts`)
   - Standalone entry point for MCP server
   - Independent of main AgentMux web interface

## Available MCP Tools

### Project Management
- `create_project` - Create new coding projects
- `list_projects` - List all projects with status filtering  
- `get_project_details` - Get detailed project information

### Team Management  
- `create_team` - Create teams with role definitions
- `list_teams` - List teams with status filtering
- `assign_team_to_project` - Link teams to projects

### Activity Monitoring
- `get_activity_status` - Real-time activity monitoring
- `get_activity_timeline` - Historical activity analysis  
- `list_tmux_sessions` - Active session management
- `capture_session_output` - Get current work context

### Team Control
- `pause_team` - Temporarily halt team work
- `resume_team` - Continue paused work
- `end_assignment` - Complete project assignments

## Standard Workflows

### 1. Project Initialization

```javascript
// Step 1: Create project
await mcp_call('create_project', {
  name: 'My Project',
  path: '/path/to/project',
  description: 'Project description'
});

// Step 2: Create team with required roles
await mcp_call('create_team', {
  name: 'Development Team',
  roles: [
    { name: 'orchestrator', required: true },
    { name: 'dev', required: false },
    { name: 'qa', required: false }
  ]
});

// Step 3: Assign team to project
await mcp_call('assign_team_to_project', {
  teamId: 'team-id',
  projectId: 'project-id'
});
```

### 2. Activity Monitoring

```javascript
// Continuous monitoring pattern
setInterval(async () => {
  // Check team activity every 60 seconds
  const status = await mcp_call('get_activity_status', {});
  
  // Get recent timeline every 5 minutes  
  const timeline = await mcp_call('get_activity_timeline', { limit: 20 });
  
  // Capture output if needed for debugging
  if (needsDebugging) {
    const output = await mcp_call('capture_session_output', {
      sessionName: 'team-session-name'
    });
  }
}, 60000);
```

### 3. Error Recovery

```javascript
// Detect and handle team being stuck
const activities = await mcp_call('get_activity_timeline', { limit: 10 });
const recentActivity = activities.filter(a => 
  Date.now() - new Date(a.timestamp).getTime() < 600000 // 10 minutes
);

if (recentActivity.length === 0) {
  // Team may be stuck, capture current state
  const output = await mcp_call('capture_session_output', {
    sessionName: 'team-session'
  });
  
  // Analyze output for errors/blocks
  if (containsErrors(output)) {
    // Restart assignment
    await mcp_call('end_assignment', { assignmentId: 'assignment-id' });
    // Create new team if needed
  } else {
    // Just resume if temporarily idle
    await mcp_call('resume_team', { teamId: 'team-id' });
  }
}
```

## Team Role Definitions

### Orchestrator (Required)
- **Purpose**: Coordinates team activities and reports progress
- **Responsibilities**: 
  - Task prioritization and assignment
  - Inter-role communication
  - Progress reporting to Claude
  - Escalation of blockers
- **Communication**: Status updates every 30 minutes via activity log

### Developer (Optional)
- **Purpose**: Implements features and fixes bugs
- **Responsibilities**:
  - Code implementation
  - Technical decision making
  - Unit testing
  - Code documentation
- **Communication**: Progress updates every 60 minutes to orchestrator

### QA (Optional)  
- **Purpose**: Tests and validates work quality
- **Responsibilities**:
  - Test case development
  - Bug detection and reporting
  - Quality metrics tracking
  - Validation of deliverables
- **Communication**: Test results reported every build cycle

### PM (Optional)
- **Purpose**: Planning and project documentation
- **Responsibilities**:
  - Requirement analysis
  - Timeline estimation  
  - Documentation maintenance
  - Stakeholder communication
- **Communication**: Planning updates and milestone tracking

## Integration Patterns

### Claude Code Integration
When Claude Code detects AgentMux MCP server:

1. **Startup**: Show available projects/teams in sidebar
2. **Project Context**: Display team progress for current project
3. **Collaboration**: Coordinate user work with team activities
4. **Quality Assurance**: Pause teams during user testing/builds

### Context Sharing
Claude can share context with teams through:

```javascript
// Format context for team consumption
const context = {
  projectId: 'proj-123',
  objectives: [
    'Implement user authentication',
    'Add password reset functionality',
    'Write comprehensive tests'
  ],
  constraints: [
    'Use existing JWT library',
    'Follow security best practices',
    'Maintain API compatibility'
  ]
};

// Teams access this context through their tmux sessions
```

### Activity Analysis
Claude analyzes team progress through:

```javascript  
const analysis = {
  activeTeams: activities.filter(a => a.status === 'active').length,
  idleTeams: activities.filter(a => a.status === 'idle').length,
  recentProgress: getProgressTrend(activities),
  potentialBlockers: identifyBlockers(activities)
};
```

## Configuration

### MCP Server Configuration
```typescript
// Start MCP server with custom settings
const mcpServer = new AgentMuxMCPServer(
  fileStorage,     // Data persistence
  tmuxManager,     // Session management  
  activityPoller   // Real-time monitoring
);

await mcpServer.start(); // Starts stdio transport
```

### Claude Code Configuration
```json
{
  "mcp": {
    "servers": {
      "agentmux": {
        "command": "node",
        "args": ["path/to/agentmux/dist/mcp/cli.js"],
        "description": "AgentMux team orchestration"
      }
    }
  }
}
```

## Best Practices

### For Claude Agents
1. **Respect Team Autonomy** - Monitor progress, don't micromanage individual tasks
2. **Share Context Bidirectionally** - Keep teams informed, learn from team progress  
3. **Handle Errors Gracefully** - Implement proper recovery workflows
4. **Monitor Activity Patterns** - Look for trends, not just current status
5. **Coordinate Resource Usage** - Pause teams during critical user work

### For Team Development
1. **Clear Role Separation** - Each role has distinct responsibilities
2. **Regular Communication** - Orchestrator coordinates all team communication
3. **Activity Documentation** - All work should be visible in session output
4. **Error Escalation** - Escalate blockers through orchestrator to Claude
5. **Objective Focus** - Stay aligned with project objectives provided by Claude

### For Integration
1. **Graceful Degradation** - Function without MCP if server unavailable
2. **Performance Monitoring** - Track MCP call latency and success rates
3. **Security Boundaries** - Validate all inputs from Claude agents
4. **Resource Management** - Limit concurrent teams based on system capacity
5. **Data Consistency** - Maintain consistency between MCP and core AgentMux state

## Security Considerations

### Input Validation
- All MCP tool parameters are validated before execution
- File paths are sanitized to prevent traversal attacks
- Team/project IDs are validated against existing records

### Resource Limits
- Maximum number of concurrent teams (configurable)
- Session output capture limits (prevent memory exhaustion)
- Activity log rotation (prevent disk space issues)

### Access Control
- MCP server runs with limited filesystem permissions
- Only project-specific directories are accessible
- Tmux sessions are isolated per team

## Troubleshooting

### Common Issues

1. **MCP Server Won't Start**
   - Check Node.js version (18+ required)
   - Verify tmux is installed and accessible
   - Check permissions on ~/.agentmux directory

2. **Teams Not Responding**
   - Verify tmux sessions exist: `tmux list-sessions`
   - Check activity poller is running
   - Review activity logs for errors

3. **Claude Can't Connect**
   - Verify MCP server configuration in Claude Code
   - Check stdio transport is working
   - Review MCP server logs for connection errors

4. **Performance Issues**  
   - Reduce activity polling frequency
   - Limit number of concurrent teams
   - Check system resource usage

### Debugging

```bash
# Start MCP server with debug logging
DEBUG=agentmux:* node dist/mcp/cli.js

# Monitor tmux sessions
tmux list-sessions
tmux capture-pane -t session-name -p

# Check activity logs
tail -f ~/.agentmux/activity.json

# Test MCP tools directly
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node dist/mcp/cli.js
```

## Future Enhancements

### Planned Features (Phase 4)
- **Advanced Role Templates** - Predefined role configurations for common project types
- **Team Performance Analytics** - Metrics and insights on team productivity
- **Multi-Project Coordination** - Teams working on multiple projects simultaneously  
- **Integration Webhooks** - External service notifications for team events
- **Custom Tool Extensions** - Plugin system for domain-specific tools

### Experimental Features
- **AI-Powered Team Optimization** - Automatic team composition suggestions
- **Predictive Error Detection** - Machine learning-based blocker prediction
- **Cross-Team Collaboration** - Coordination between multiple teams on shared projects
- **Resource Auto-Scaling** - Dynamic team sizing based on workload

## Contributing

### Adding New MCP Tools
1. Define tool schema in `MCPServer.ts`
2. Implement handler method
3. Add to protocol documentation
4. Write integration tests
5. Update workflow templates

### Testing MCP Integration
```bash
# Unit tests
npm run test:mcp

# Integration tests with mock Claude agent
npm run test:mcp:integration  

# End-to-end tests
npm run test:mcp:e2e
```

This MCP integration transforms AgentMux from a simple tmux orchestrator into a powerful AI agent coordination platform, enabling Claude Code to manage complex development workflows through standardized protocols.