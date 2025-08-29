# AgentMux Lightweight: Technical Architecture

## 1. Overview

A dramatically simplified architecture that delivers the core AgentMux experience with minimal complexity:

-   **Single Process**: Node.js Express server with embedded React frontend
-   **File Storage**: Simple JSON files instead of database
-   **HTTP Polling**: Replace WebSockets with simple 30-second polling
-   **Local Only**: No authentication, bind to localhost only

## 2. Architecture Diagram

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
│  ├─ Static File Serving                                    │
│  ├─ Tmux Controller                                        │
│  ├─ Activity Poller                                        │
│  └─ File Storage Manager                                   │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                                 │
│  ├─ ~/.agentmux/data.json                                  │
│  ├─ ~/.agentmux/activity.json                              │
│  └─ Project filesystem integration                         │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    tmux     │
                    │  sessions   │
                    └─────────────┘
```

## 3. Technology Stack

### Backend

-   **Runtime**: Node.js 18+
-   **Framework**: Express.js 4.x
-   **Process Management**: Built-in child_process for tmux
-   **Storage**: Native fs module with JSON
-   **Logging**: Simple console + file logging

### Frontend

-   **Framework**: React 18 (create-react-app or Vite)
-   **Styling**: Tailwind CSS
-   **State**: React Context + useState (no Zustand)
-   **HTTP Client**: Native fetch API
-   **UI Components**: Headless UI or similar lightweight library

### Development

-   **Build**: Vite or simple webpack
-   **TypeScript**: Yes, but minimal complexity
-   **Testing**: Jest for critical paths only
-   **Linting**: ESLint + Prettier

## 4. Data Models (Simplified)

### Storage Structure

```typescript
// ~/.agentmux/data.json
interface AgentMuxData {
	projects: Project[];
	teams: Team[];
	assignments: Assignment[];
	settings: Settings;
}

interface Project {
	id: string;
	name: string;
	fsPath: string;
	status: 'active' | 'idle' | 'archived';
	createdAt: string;
	lastActivity?: string;
}

interface Team {
	id: string;
	name: string;
	roles: Role[];
	tmuxSession?: string;
	status: 'active' | 'idle' | 'paused' | 'stopped';
	createdAt: string;
	lastActivity?: string;
}

interface Role {
	name: string; // 'orchestrator', 'pm', 'dev', 'qa'
	count: number;
	tmuxWindows?: string[]; // window IDs
}

interface Assignment {
	id: string;
	projectId: string;
	teamId: string;
	status: 'active' | 'paused' | 'ended';
	startedAt: string;
	endedAt?: string;
}

// ~/.agentmux/activity.json
interface ActivityLog {
	entries: ActivityEntry[];
}

interface ActivityEntry {
	timestamp: string;
	type: 'project' | 'team' | 'pane';
	targetId: string;
	status: 'active' | 'idle';
	metadata?: Record<string, any>;
}
```

## 5. API Design (Simplified)

### REST Endpoints

```
GET    /api/health
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
DELETE /api/projects/:id

GET    /api/teams
POST   /api/teams
GET    /api/teams/:id
PATCH  /api/teams/:id
DELETE /api/teams/:id

GET    /api/assignments
POST   /api/assignments
PATCH  /api/assignments/:id
DELETE /api/assignments/:id

GET    /api/activity
POST   /api/activity/refresh

GET    /api/specs/:projectId/*
PUT    /api/specs/:projectId/*
```

### Response Format

```typescript
interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
}
```

## 6. Core Services

### TmuxController

```typescript
class TmuxController {
	async createSession(teamId: string, roles: Role[]): Promise<string>;
	async killSession(sessionId: string): Promise<void>;
	async listSessions(): Promise<TmuxSession[]>;
	async sendKeys(paneId: string, text: string): Promise<void>;
	async getPaneActivity(paneId: string): Promise<number>; // byte count
}
```

### ActivityPoller

```typescript
class ActivityPoller {
	private interval: NodeJS.Timeout;

	start(): void; // Poll every 30 seconds
	stop(): void;
	async checkAllPanes(): Promise<ActivityEntry[]>;
	private async checkPane(paneId: string): Promise<ActivityEntry | null>;
}
```

### FileStorage

```typescript
class FileStorage {
	async loadData(): Promise<AgentMuxData>;
	async saveData(data: AgentMuxData): Promise<void>;
	async loadActivity(): Promise<ActivityLog>;
	async appendActivity(entry: ActivityEntry): Promise<void>;
	async writeSpec(projectId: string, path: string, content: string): Promise<void>;
	async readSpec(projectId: string, path: string): Promise<string>;
}
```

## 7. Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── Dashboard.tsx
│   ├── ProjectCard.tsx
│   ├── TeamCard.tsx
│   ├── AssignmentBoard.tsx
│   ├── SpecEditor.tsx
│   └── StatusIndicator.tsx
├── hooks/
│   ├── useProjects.ts
│   ├── useTeams.ts
│   ├── useAssignments.ts
│   └── usePolling.ts
├── services/
│   └── api.ts
└── App.tsx
```

### State Management

```typescript
// Simple React Context instead of complex state management
interface AppState {
	projects: Project[];
	teams: Team[];
	assignments: Assignment[];
	activity: ActivityEntry[];
	loading: boolean;
	error?: string;
}

const AppContext = createContext<AppState & AppActions>();
```

### Polling Strategy

```typescript
// Custom hook for polling
function usePolling(interval = 30000) {
	useEffect(() => {
		const timer = setInterval(async () => {
			await refreshAllData();
		}, interval);

		return () => clearInterval(timer);
	}, [interval]);
}
```

## 8. Activity Detection (Simplified)

### Algorithm

1. Every 30 seconds, poll all active tmux panes
2. Get byte count using `tmux display-message -p '#{history_bytes}'`
3. Compare with previous reading
4. If changed: mark as Active, if unchanged: mark as Idle
5. Aggregate pane status to team status, team status to project status

### Privacy

-   No content is ever read or stored
-   Only byte counts are compared
-   Activity log stores timestamps and status only

## 9. Security (Minimal)

### Local Only

-   Bind to 127.0.0.1 only
-   No authentication needed
-   No CORS configuration needed

### File System

-   Spec writes are path-jailed to project directory
-   No symlink following
-   Basic path traversal protection (`../` blocked)

### Command Execution

-   All tmux commands use argv arrays
-   No string interpolation or shell injection possible
-   Whitelist of allowed tmux commands

## 10. Error Handling

### Strategy

-   Fail gracefully with user-friendly messages
-   Log errors to file for debugging
-   Retry transient failures (tmux commands)
-   Clear recovery paths for common issues

### Common Scenarios

-   tmux not installed → Clear error message with install instructions
-   Permission denied → Helpful message about file permissions
-   Port in use → Try next available port automatically
-   Project path missing → Offer to recreate or rebind

## 11. Performance Considerations

### Optimizations

-   Lazy load project specs (only when viewed)
-   Cache tmux session list between polls
-   Debounce rapid API calls
-   Limit activity log size (rotate after 1000 entries)

### Resource Limits

-   Max 50 projects
-   Max 20 teams
-   Max 100 tmux panes monitored
-   Activity log capped at 1000 entries

## 12. Development Workflow

### Setup

```bash
git clone <repo>
cd agentmux-lightweight
npm install
npm run dev  # Starts both backend and frontend
```

### Build

```bash
npm run build    # Builds React app
npm run package  # Creates distributable package
```

### Testing

```bash
npm test         # Jest unit tests
npm run test:e2e # Basic Playwright tests
```

## 13. Deployment (NPX Package)

### Package Structure

```
agentmux/
├── dist/
│   ├── server.js     # Express server
│   ├── public/       # Built React app
│   └── package.json
└── bin/
    └── agentmux      # CLI entry point
```

### CLI Entry Point

```bash
#!/usr/bin/env node
const { startServer } = require('./dist/server.js')
startServer()
```

This simplified architecture reduces complexity by ~70% while maintaining the core user experience and value proposition.
