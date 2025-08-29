# AgentMux Lightweight: Product Requirements Document

Version 1.0 Lightweight  
Last Updated: December 2024

## 1. Vision & Goals

**AgentMux Lightweight** provides a simple web dashboard for managing AI coding agent teams without the complexity of raw tmux. The core experience remains the same: define Projects, create Teams, assign them together, and monitor their activity status.

### Key Principles

-   **Simplicity First**: Minimal moving parts, maximum usability
-   **Local Development**: Designed for single developer use on local machine
-   **tmux Abstraction**: Hide terminal complexity behind intuitive UI
-   **Quick Setup**: `npx agentmux` and you're running in 30 seconds

## 2. Core User Journey

1. **Start AgentMux**: Run `npx agentmux` → opens dashboard at localhost:3000
2. **Create Project**: Name + filesystem path + optional specs
3. **Create Team**: Name + roles (Orchestrator required, others optional)
4. **Assign Team to Project**: Drag & drop or click assign
5. **Monitor Status**: See working/idle indicators, basic activity timeline
6. **Manage**: Pause, dismiss, reassign teams as needed

## 3. Features (Simplified)

### Core Dashboard

-   **Projects Tab**: List projects with status, path, last activity
-   **Teams Tab**: List teams with status, assigned project, activity
-   **Assignment Board**: Visual representation of Project ↔ Team links

### Project Management

-   Create project with name and filesystem path
-   Write/edit spec files (CLAUDE.md, etc.) directly in UI
-   Archive completed projects
-   Basic status: Active, Idle, Archived

### Team Management

-   Create team with customizable roles
-   Required: 1 Orchestrator, optional: PM, Dev, QA, etc.
-   Team controls: Start, Pause, Dismiss, Duplicate
-   Basic status: Active, Idle, Paused, Stopped

### Activity Monitoring

-   **Simple Status**: Working (green), Idle (yellow), Stopped (red)
-   **Basic Timeline**: Last 24 hours of activity dots
-   **Manual Refresh**: "Check Now" button for immediate status update
-   **No Real-time**: Status updates every 30 seconds via polling

### Spec File Management

-   Write specs directly in dashboard with syntax highlighting
-   Auto-save to project filesystem
-   Path-jailed to project directory for security
-   Support for common formats: .md, .txt, .json

## 4. Technical Requirements (Simplified)

### Architecture

-   **Single Node.js Process**: Express server with embedded React frontend
-   **No Database**: JSON file storage in `~/.agentmux/data.json`
-   **No WebSockets**: Simple HTTP polling every 30 seconds
-   **No Authentication**: Local-only, bind to 127.0.0.1 only

### Dependencies

-   Node.js 18+
-   tmux 3.2+ (checked on startup)
-   Modern browser (Chrome, Firefox, Safari)

### Storage

```
~/.agentmux/
├── data.json          # All projects, teams, assignments
├── activity.json      # Simple activity log
└── logs/
    └── agentmux.log   # Basic application logs
```

### Activity Detection

-   Poll tmux panes every 30 seconds for byte count changes
-   Simple algorithm: change detected = Active, no change = Idle
-   No content inspection, privacy-first approach

## 5. What's NOT Included (Scope Reduction)

### Removed Complexity

-   ❌ Real-time WebSocket updates
-   ❌ Complex cron-based scheduling
-   ❌ Database migrations and schema management
-   ❌ Multi-user authentication
-   ❌ Advanced metrics and monitoring
-   ❌ MCP server (optional add-on only)
-   ❌ Complex role-based permissions
-   ❌ Advanced activity analytics
-   ❌ Template system for projects/teams
-   ❌ Export/import functionality
-   ❌ Headless mode and API tokens

### Simplified Alternatives

-   **Scheduling**: Simple "Check every N minutes" instead of cron
-   **Real-time**: 30-second polling instead of WebSockets
-   **Storage**: JSON files instead of SQL database
-   **Auth**: Local-only instead of token-based security
-   **Monitoring**: Basic status instead of detailed metrics

## 6. Success Metrics (Adjusted)

-   **Setup Time**: < 60 seconds from `npx agentmux` to working dashboard
-   **UI Responsiveness**: < 500ms for all interactions (relaxed from 200ms)
-   **Resource Usage**: < 100MB RAM, < 5% CPU when idle
-   **Reliability**: Works consistently on macOS and Linux
-   **Usability**: 90% of users can assign team to project without help

## 7. Implementation Priority

### Phase 1 (MVP)

1. Basic Express server with React frontend
2. Project CRUD with filesystem integration
3. Team CRUD with tmux session management
4. Assignment workflow (drag & drop)
5. Basic activity polling and status display

### Phase 2 (Polish)

1. Spec file editor with syntax highlighting
2. Activity timeline visualization
3. Team duplication and templates
4. Better error handling and user feedback
5. Basic logging and troubleshooting

### Phase 3 (Optional)

1. Simple MCP server for Claude integration
2. Basic scheduling (check every N minutes)
3. Project archiving and history
4. Performance optimizations
5. Windows WSL support

## 8. Non-Goals (Explicit)

-   Multi-user collaboration
-   Remote tmux management
-   Complex scheduling and automation
-   Advanced security and authentication
-   Scalability beyond single developer use
-   Integration with external services
-   Mobile/tablet support
-   Offline functionality

This lightweight approach reduces implementation complexity by ~70% while maintaining 90% of the core user value.
