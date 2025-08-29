# AgentMux Lightweight: Implementation Plan

## 1. Development Phases

### Phase 1: Core Foundation (Week 1-2)

**Goal**: Basic working system with essential features

#### Backend Setup

-   [ ] Express.js server with TypeScript
-   [ ] JSON file storage system (FileStorage class)
-   [ ] Basic tmux controller (create/list/kill sessions)
-   [ ] REST API endpoints for projects, teams, assignments
-   [ ] Static file serving for React app

#### Frontend Setup

-   [ ] React app with TypeScript (Vite or CRA)
-   [ ] Tailwind CSS setup
-   [ ] Basic routing (React Router)
-   [ ] API service layer with fetch
-   [ ] Simple state management with React Context

#### Core Features

-   [ ] Project CRUD operations
-   [ ] Team CRUD operations
-   [ ] Assignment creation and management
-   [ ] Basic tmux session creation for teams
-   [ ] Simple activity polling (30-second intervals)

**Deliverable**: Working dashboard where you can create projects, teams, and assign them

### Phase 2: User Experience (Week 3-4)

**Goal**: Polish the core workflows and add essential UX features

#### UI Components

-   [ ] Project and Team cards with status indicators
-   [ ] Assignment board with drag & drop
-   [ ] Modal dialogs for forms
-   [ ] Status badges and activity indicators
-   [ ] Loading states and error handling

#### Activity System

-   [ ] Activity poller service
-   [ ] tmux pane monitoring (byte count changes)
-   [ ] Activity timeline visualization
-   [ ] Status aggregation (pane → team → project)

#### Spec Management

-   [ ] Spec file editor (Monaco or simple textarea)
-   [ ] File tree navigation
-   [ ] Auto-save functionality
-   [ ] Path-jailed file operations

**Deliverable**: Polished UI with activity monitoring and spec editing

### Phase 3: Reliability & Polish (Week 5-6)

**Goal**: Production-ready reliability and user experience

#### Error Handling

-   [ ] Comprehensive error boundaries
-   [ ] Graceful degradation for tmux failures
-   [ ] User-friendly error messages
-   [ ] Recovery workflows for common issues

#### Performance

-   [ ] Optimize polling frequency
-   [ ] Cache tmux session data
-   [ ] Debounce API calls
-   [ ] Lazy load components

#### CLI & Packaging

-   [ ] NPX package structure
-   [ ] CLI entry point with port detection
-   [ ] Auto-browser opening
-   [ ] Graceful shutdown handling

**Deliverable**: NPX-installable package ready for users

### Phase 4: Optional Enhancements (Week 7+)

**Goal**: Nice-to-have features based on user feedback

#### Advanced Features

-   [ ] Team templates and duplication
-   [ ] Project archiving
-   [ ] Basic MCP server for Claude integration
-   [ ] Simple scheduling (check every N minutes)
-   [ ] Activity export/logging

#### Developer Experience

-   [ ] Better debugging tools
-   [ ] Configuration options
-   [ ] Documentation and examples
-   [ ] Video tutorials

## 2. Technical Implementation Details

### Project Structure

```
agentmux-lightweight/
├── package.json
├── src/
│   ├── server/
│   │   ├── index.ts              # Express server entry
│   │   ├── api/                  # REST API routes
│   │   │   ├── projects.ts
│   │   │   ├── teams.ts
│   │   │   ├── assignments.ts
│   │   │   └── activity.ts
│   │   ├── services/
│   │   │   ├── FileStorage.ts    # JSON file operations
│   │   │   ├── TmuxController.ts # tmux session management
│   │   │   └── ActivityPoller.ts # Activity monitoring
│   │   └── types/                # TypeScript interfaces
│   └── client/
│       ├── src/
│       │   ├── components/       # React components
│       │   ├── hooks/           # Custom React hooks
│       │   ├── services/        # API client
│       │   ├── types/           # TypeScript interfaces
│       │   └── App.tsx
│       └── public/
├── dist/                        # Built output
└── bin/
    └── agentmux                 # CLI entry point
```

### Key Implementation Decisions

#### Storage Strategy

```typescript
// Simple JSON file approach
class FileStorage {
	private dataPath = path.join(os.homedir(), '.agentmux', 'data.json');
	private activityPath = path.join(os.homedir(), '.agentmux', 'activity.json');

	async loadData(): Promise<AgentMuxData> {
		try {
			const data = await fs.readFile(this.dataPath, 'utf8');
			return JSON.parse(data);
		} catch {
			return this.getDefaultData();
		}
	}

	async saveData(data: AgentMuxData): Promise<void> {
		await fs.writeFile(this.dataPath, JSON.stringify(data, null, 2));
	}
}
```

#### Activity Polling

```typescript
class ActivityPoller {
	private interval: NodeJS.Timeout | null = null;
	private lastByteCounts = new Map<string, number>();

	start() {
		this.interval = setInterval(async () => {
			await this.checkAllPanes();
		}, 30000); // 30 seconds
	}

	private async checkAllPanes() {
		const sessions = await this.tmux.listSessions();
		for (const session of sessions) {
			for (const pane of session.panes) {
				await this.checkPane(pane.id);
			}
		}
	}

	private async checkPane(paneId: string) {
		const byteCount = await this.tmux.getPaneByteCount(paneId);
		const lastCount = this.lastByteCounts.get(paneId) || 0;
		const isActive = byteCount > lastCount;

		this.lastByteCounts.set(paneId, byteCount);

		if (isActive !== this.getLastStatus(paneId)) {
			await this.recordActivity(paneId, isActive);
		}
	}
}
```

#### Simple State Management

```typescript
// React Context instead of complex state management
interface AppState {
	projects: Project[];
	teams: Team[];
	assignments: Assignment[];
	activity: ActivityEntry[];
	loading: boolean;
	error?: string;
}

interface AppActions {
	createProject: (project: Omit<Project, 'id'>) => Promise<void>;
	createTeam: (team: Omit<Team, 'id'>) => Promise<void>;
	createAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
	refreshData: () => Promise<void>;
}

const AppContext = createContext<AppState & AppActions>();

export function AppProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<AppState>(initialState);

	// Implementation of actions...

	return <AppContext.Provider value={{ ...state, ...actions }}>{children}</AppContext.Provider>;
}
```

### API Design Principles

#### RESTful & Simple

```typescript
// Clear, predictable API structure
app.get('/api/projects', async (req, res) => {
	const projects = await storage.getProjects();
	res.json({ success: true, data: projects });
});

app.post('/api/projects', async (req, res) => {
	try {
		const project = await storage.createProject(req.body);
		res.json({ success: true, data: project });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
});

// Consistent error handling
app.use((error, req, res, next) => {
	console.error(error);
	res.status(500).json({
		success: false,
		error: 'Internal server error',
	});
});
```

#### Frontend API Client

```typescript
class ApiClient {
	private baseURL = '/api';

	async get<T>(endpoint: string): Promise<T> {
		const response = await fetch(`${this.baseURL}${endpoint}`);
		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error);
		}

		return result.data;
	}

	async post<T>(endpoint: string, data: any): Promise<T> {
		const response = await fetch(`${this.baseURL}${endpoint}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
		});

		const result = await response.json();

		if (!result.success) {
			throw new Error(result.error);
		}

		return result.data;
	}
}
```

## 3. Testing Strategy (Simplified)

### Unit Tests (Jest)

-   [ ] FileStorage operations
-   [ ] TmuxController commands
-   [ ] API route handlers
-   [ ] React component rendering
-   [ ] Custom hooks behavior

### Integration Tests

-   [ ] Full API workflows (create project → team → assignment)
-   [ ] tmux session lifecycle
-   [ ] File system operations
-   [ ] Activity polling accuracy

### E2E Tests (Playwright - minimal)

-   [ ] Happy path: create project, team, assign, monitor
-   [ ] Error scenarios: tmux not available, permission issues
-   [ ] Browser compatibility (Chrome, Firefox)

### Manual Testing Checklist

-   [ ] NPX installation and startup
-   [ ] All user flows from user-flows.md
-   [ ] Error recovery scenarios
-   [ ] Performance with multiple projects/teams
-   [ ] Cross-platform compatibility (macOS, Linux)

## 4. Deployment & Distribution

### NPM Package Structure

```json
{
	"name": "agentmux",
	"version": "1.0.0",
	"description": "Simple dashboard for AI agent teams",
	"bin": {
		"agentmux": "./bin/agentmux"
	},
	"files": ["dist/", "bin/", "README.md"],
	"engines": {
		"node": ">=18.0.0"
	},
	"dependencies": {
		"express": "^4.18.0",
		"cors": "^2.8.5"
	}
}
```

### CLI Entry Point

```javascript
#!/usr/bin/env node
const { startServer } = require('../dist/server/index.js');
const open = require('open');
const getPort = require('get-port');

async function main() {
	console.log('Starting AgentMux...');

	// Check tmux availability
	try {
		require('child_process').execSync('tmux -V', { stdio: 'ignore' });
	} catch {
		console.error('Error: tmux is required but not found');
		console.error('Install tmux: brew install tmux (macOS) or apt install tmux (Ubuntu)');
		process.exit(1);
	}

	// Find available port
	const port = await getPort({ port: 3000 });

	// Start server
	await startServer({ port });

	// Open browser
	const url = `http://localhost:${port}`;
	console.log(`AgentMux running at ${url}`);
	await open(url);

	// Handle shutdown
	process.on('SIGINT', () => {
		console.log('\nShutting down AgentMux...');
		process.exit(0);
	});
}

main().catch(console.error);
```

### Build Process

```bash
# Build both server and client
npm run build:server  # TypeScript compilation
npm run build:client  # React build
npm run package      # Combine into dist/

# Test package locally
npm pack
npm install -g agentmux-1.0.0.tgz
agentmux

# Publish to npm
npm publish --access public
```

## 5. Success Metrics & Validation

### Technical Metrics

-   [ ] Startup time < 10 seconds
-   [ ] Memory usage < 100MB
-   [ ] CPU usage < 5% when idle
-   [ ] API response time < 200ms
-   [ ] UI interaction latency < 100ms

### User Experience Metrics

-   [ ] Time to first assignment < 5 minutes
-   [ ] Success rate for common workflows > 95%
-   [ ] Error recovery success rate > 90%
-   [ ] User satisfaction score > 4/5

### Validation Checklist

-   [ ] Works on fresh macOS system
-   [ ] Works on fresh Ubuntu system
-   [ ] Works with tmux 3.2, 3.3, 3.4
-   [ ] Works with Node.js 18, 20
-   [ ] Handles common error scenarios gracefully
-   [ ] Documentation is clear and complete

## 6. Risk Mitigation

### Technical Risks

-   **tmux compatibility issues**: Test with multiple tmux versions
-   **File system permissions**: Graceful error handling and clear messages
-   **Port conflicts**: Automatic port detection and fallback
-   **Process management**: Proper cleanup on shutdown

### User Experience Risks

-   **Confusing UI**: User testing with target audience
-   **Complex setup**: One-command installation and startup
-   **Data loss**: Auto-save and backup mechanisms
-   **Performance issues**: Load testing with realistic scenarios

### Mitigation Strategies

-   Comprehensive error handling at all levels
-   Clear documentation and troubleshooting guides
-   Fallback mechanisms for common failures
-   User feedback collection and rapid iteration

This implementation plan reduces the original complexity by focusing on essential features while maintaining the core value proposition of AgentMux.
