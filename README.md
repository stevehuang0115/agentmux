# AgentMux

AgentMux orchestrates multiple Claude Code instances via terminal sessions, enabling autonomous team collaboration with web-based monitoring and filesystem-based persistence.

## Features

- **Multi-Agent Orchestration**: Coordinate multiple Claude Code agents with different roles
- **Web Dashboard**: Real-time monitoring and control via browser interface
- **Terminal Streaming**: Live terminal output from all agent sessions via WebSocket
- **Ticket Management**: Filesystem-based task tracking with YAML tickets
- **MCP Integration**: Agents communicate via Model Context Protocol tools
- **Automated Check-ins**: Scheduled progress updates and git commit reminders
- **Project-based Workflows**: Organized team assignments per project
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Quick Start

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Start the system
npm start

# Or run in development mode
npm run dev
```

This will:
1. Start backend server on port 3000
2. Start MCP server on port 3001
3. Open dashboard in browser
4. Create `~/.agentmux` configuration directory

## Architecture

```
User → Web Dashboard → Backend Server → PTY Sessions (Claude Code agents)
                           ↓
                      MCP Server ← All agents connect here for tools
                           ↓
                    Filesystem Storage (~/.agentmux & project/.agentmux)
```

### Session Backend

AgentMux uses **node-pty** as the default session backend for managing terminal sessions. This provides:

- **Direct PTY access**: No intermediate process for input/output
- **Cross-platform support**: Works on Windows, macOS, and Linux
- **Real-time streaming**: WebSocket-based terminal output
- **Better input reliability**: Direct file descriptor writes avoid race conditions

## Running AgentMux

### Production Mode

```bash
# Build and start
npm run build
npm start

# Or use the CLI directly
npx agentmux start
```

### Development Mode

```bash
# Start all services with hot-reload
npm run dev

# Or start services individually:
npm run dev:backend   # Backend server with nodemon
npm run dev:frontend  # Vite dev server for React dashboard
npm run dev:mcp       # MCP server with nodemon
```

### Using PM2 (Process Manager)

```bash
# Start with PM2
npm run start:pm2

# View logs
npm run logs:pm2

# Monitor processes
npm run monit:pm2

# Stop all services
npm run stop:pm2
```

### Using Docker

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run

# Or use docker-compose
npm run docker:compose:up
npm run docker:compose:logs
npm run docker:compose:down
```

## Session Backend Configuration

AgentMux supports two session backend implementations:

### PTY Backend (Default - Recommended)

The PTY backend uses `node-pty` for direct terminal management. This is the default and recommended option.

**Advantages:**
- Cross-platform (Windows, macOS, Linux)
- Better input reliability (direct PTY writes)
- Real-time WebSocket streaming
- No external dependencies
- Simpler architecture

**Limitations:**
- Sessions don't persist across backend restarts
- Single-process architecture (sessions tied to backend process)

### tmux Backend (Dormant)

The tmux backend is available but currently disabled. It can be re-enabled for environments that require session persistence.

**Advantages:**
- Session persistence across restarts
- External debugging via `tmux attach`
- Multi-client session access

**Limitations:**
- Unix-only (requires WSL on Windows)
- More complex input handling
- Requires tmux installation

### Switching Between Backends

To switch from PTY to tmux backend, edit `backend/src/services/session/session-backend.factory.ts`:

```typescript
// 1. Uncomment the tmux import at the top:
import { TmuxSessionBackend } from './tmux/index.js';

// 2. In the createSessionBackend function, uncomment the tmux case:
case 'tmux':
  sessionBackendInstance = new TmuxSessionBackend();
  currentBackendType = 'tmux';
  logger.info('Tmux session backend created');
  return sessionBackendInstance;

// 3. Change the default backend type if desired:
export async function createSessionBackend(
  type: SessionBackendType = 'tmux'  // Change default here
): Promise<ISessionBackend> {
```

After making changes, rebuild the backend:

```bash
npm run build:backend
```

## Team Roles

- **Orchestrator**: Coordinates all teams and manages high-level strategy
- **Project Manager**: Manages timeline, quality, and team coordination
- **Developer**: Implements features and writes code
- **QA Engineer**: Tests features and ensures quality standards

## Development

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run PTY-specific tests
npm run test:pty

# Run input reliability tests
npm run test:reliability

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
agentmux/
├── backend/          # Express API server & services
│   └── src/services/session/  # Session backend implementations
│       ├── pty/      # PTY backend (node-pty) - ACTIVE
│       └── tmux/     # tmux backend - DORMANT
├── frontend/         # React dashboard (Vite + TypeScript)
├── mcp-server/       # MCP tools for agent communication
├── cli/              # Command-line interface
├── tests/            # Unit & integration tests
└── specs/            # Technical specifications
```

## Usage

1. **Start AgentMux**: `npm start` or `npx agentmux start`
2. **Select Project**: Choose a project folder in the dashboard
3. **Create Teams**: Add agents with specific roles and system prompts
4. **Monitor Progress**: Watch real-time terminal output and team communication
5. **Manage Tickets**: Create and track tasks via the filesystem-based system

## Configuration

Configuration is stored in `~/.agentmux/config.env`:

```bash
WEB_PORT=3000
AGENTMUX_MCP_PORT=3001
AGENTMUX_HOME=~/.agentmux
DEFAULT_CHECK_INTERVAL=30  # minutes
AUTO_COMMIT_INTERVAL=30    # minutes
```

### Session Backend Environment Variables

```bash
# Session backend type (currently only 'pty' is active)
SESSION_BACKEND_TYPE=pty

# PTY-specific options
PTY_COLS=120           # Terminal columns
PTY_ROWS=40            # Terminal rows
```

## MCP Server Integration

AgentMux includes a Model Context Protocol (MCP) server that provides specialized tools for AI agents to collaborate autonomously. The MCP server enables Claude Code and other AI tools to communicate, manage tasks, and coordinate workflows through a standardized interface.

### Available MCP Tools

The AgentMux MCP server provides 14 specialized tools:

#### Communication Tools

- **`send_message`** - Send targeted messages to specific team members
- **`broadcast`** - Send messages to all team members simultaneously
- **`get_team_status`** - Check current status and activity of all team members

#### Task Management Tools

- **`get_tickets`** - Retrieve project tickets (filtered by status or assignment)
- **`update_ticket`** - Update ticket status, add notes, and track blockers
- **`report_progress`** - Report implementation progress to project manager
- **`request_review`** - Request code reviews from QA or team members

#### Project Tools

- **`schedule_check`** - Schedule automated check-ins and reminders
- **`enforce_commit`** - Force git commits (enforces 30-minute commit rule)
- **`load_project_context`** - Load comprehensive project information
- **`get_context_summary`** - Get role-specific project context summary
- **`refresh_agent_context`** - Update agent context with latest project state

#### Orchestrator Tools (Admin Only)

- **`create_team`** - Create new agent teams with specific roles
- **`delegate_task`** - Assign tasks to team members with priority levels

### Setting Up MCP Server

#### For Claude Code

1. **Install AgentMux globally:**

```bash
npm install -g agentmux
```

2. **Start AgentMux (backend + MCP server):**

```bash
npx agentmux start
# Backend starts on port 3000, MCP server on port 3001
```

3. **Configure Claude Code MCP settings:**

```bash
## List existing
claude mcp list

## Add
claude mcp add --transport http agentmux http://localhost:8789/mcp --scope user

## Remove
claude mcp remove "agentmux" -s local
claude mcp remove "agentmux" -s user
```

Create or update your Claude Code configuration file (`~/.claude-code/config.json`):

```json
{
	"mcpServers": {
		"agentmux": {
			"transport": {
				"type": "http",
				"url": "http://localhost:3001"
			},
			"env": {
				"SESSION_NAME": "your-session-name",
				"PROJECT_PATH": "/path/to/your/project",
				"AGENT_ROLE": "developer"
			}
		}
	}
}
```

#### For Gemini CLI

1. **Install and configure Gemini CLI with MCP support:**

```bash
npm install -g @google-ai/generativelanguage-cli
```

```bash
## List existing
gemini mcp list

## Add
gemini mcp add --transport http agentmux http://localhost:8789/mcp --scope user

## Remove
gemini mcp remove "agentmux" --scope user
```

2. **Create MCP configuration file** (`~/.gemini-cli/mcp.json`):

```json
{
	"mcpServers": {
		"agentmux": {
			"httpUrl": "http://localhost:3001/mcp"
		}
	}
}
```

3. **Start Gemini CLI with MCP:**

```bash
gemini-cli --mcp-config ~/.gemini-cli/mcp.json
```

### MCP Server Environment Variables

Configure these environment variables for proper MCP server operation:

```bash
# Required
SESSION_NAME="your-session-name"          # Unique identifier for this agent
PROJECT_PATH="/path/to/project"           # Project root directory
AGENT_ROLE="developer"                    # Agent role: orchestrator, pm, developer, qa

# Optional
API_PORT="3000"                           # AgentMux backend API port
AGENTMUX_MCP_PORT="3001"                  # MCP server HTTP port
```

### Testing MCP Connection

1. **Verify MCP server is running:**

```bash
curl http://localhost:3001/health
# Should return: {"status": "ok", "mcp": "running"}
```

2. **Test MCP tools list:**

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

3. **Verify AgentMux backend is running:**

```bash
curl http://localhost:3000/api/projects
# Should return project list
```

4. **Test tool availability in Claude Code:**

```
Use the get_team_status tool to check connection
```

5. **Test communication between agents:**

```
Use send_message tool: {"to": "other-agent", "message": "Hello from MCP!"}
```

### MCP Tool Usage Examples

#### Basic Communication

```javascript
// Send message to specific team member
await mcp.send_message({
	to: 'frontend-dev',
	message: 'API endpoints ready for integration',
});

// Broadcast to all team members
await mcp.broadcast({
	message: 'Deploy to staging complete - please test',
	excludeSelf: true,
});
```

#### Task Management

```javascript
// Get assigned tickets
const tickets = await mcp.get_tickets({
	status: 'in_progress',
});

// Report progress to PM
await mcp.report_progress({
	ticketId: 'TASK-123',
	progress: 75,
	completed: ['API implementation', 'Unit tests'],
	current: 'Integration testing',
	nextSteps: 'Complete E2E tests',
});

// Request code review
await mcp.request_review({
	ticketId: 'TASK-123',
	reviewer: 'qa-engineer',
	branch: 'feature/user-auth',
	message: 'Ready for QA - all tests passing',
});
```

#### Project Context

```javascript
// Load comprehensive project context
const context = await mcp.load_project_context({
	includeFiles: true,
	includeGitHistory: true,
	includeTickets: true,
});

// Get role-specific summary
const summary = await mcp.get_context_summary();
```

### MCP Server Architecture

The MCP server integrates with AgentMux's architecture:

```
AI Agent (Claude Code/Gemini)
    ↓ MCP Protocol
MCP Server (port 3001)
    ↓ PTY commands & file operations
AgentMux Backend (port 3000)
    ↓
Project Files & Agent Sessions (node-pty)
```

### Troubleshooting MCP Issues

1. **Connection Issues:**

   - Verify AgentMux is running: `npx agentmux status`
   - Check MCP server is accessible: `curl http://localhost:3001/health`
   - Check backend server is accessible: `curl http://localhost:3000/health`
   - Validate environment variables are set correctly

2. **Tool Errors:**

   - Check agent has proper permissions for the tool
   - Verify project path exists and is accessible
   - Review MCP server logs: `npx agentmux logs`

3. **Communication Problems:**
   - Ensure PTY sessions exist (check dashboard)
   - Check session names match SESSION_NAME
   - Verify target agents are active

## Commands

- `npx agentmux start` - Start all services and open dashboard
- `npx agentmux stop` - Stop all services and agent sessions
- `npx agentmux status` - Show status of running services
- `npx agentmux logs` - View aggregated logs from all components

## Debug

1. Terminal 1 - Start MCP Server:

```bash
cd agentmux
npm run build:mcp
node dist/mcp-server/index.js
```

2. Terminal 2 - Start Frontend:

```bash
cd agentmux/frontend
npm run dev
```

3. VS Code Debugger - Start Backend:

   1. Set breakpoints in your backend TypeScript files
   2. Go to Run and Debug (Ctrl+Shift+D)
   3. Select "Debug Backend (External MCP/Frontend)"
   4. Press F5 or click the play button

## Testing

```bash
# Run all tests
npm test

# Run backend unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run PTY session tests
npm run test:pty

# Run input reliability tests (stress testing)
npm run test:reliability

# Run frontend tests
cd frontend && npm test

# Run E2E tests
npm run test:e2e
```

## License

MIT
