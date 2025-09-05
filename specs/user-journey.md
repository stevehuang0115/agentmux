# AgentMux User Journey - Complete Workflow

## Overview

This document describes the complete user journey from starting AgentMux to having autonomous AI agents working on a project. It covers the initial setup, team configuration, project assignment, and the orchestration process.

## Phase 1: Starting AgentMux

### Step 1.1: Launch the Application

```bash
$ npx agentmux start
```

**What happens:**

1. CLI checks for `~/.agentmux/` directory, creates if missing
2. Initializes default config files:
    - `~/.agentmux/teams.json` (empty array)
    - `~/.agentmux/projects.json` (empty array)
    - `~/.agentmux/runtime.json` (ports and PIDs)
3. Starts backend server on port 3000
4. Starts MCP server on port 3001
5. Opens browser to `http://localhost:3000`

**Console output:**

```
🚀 AgentMux is running:
   Web Dashboard: http://localhost:3000
   MCP Server:    http://localhost:3001
   Config Dir:    ~/.agentmux
```

## Phase 2: Web Dashboard Initial Setup

### Step 2.1: Dashboard Landing

User sees the main dashboard with:

-   Empty Projects section with "New Project" card
-   Empty Teams section with "New Team" card
-   No active assignments

### Step 2.2: Create a Team

User clicks "New Team" button:

**Team Creation Form:**

```
Team Name: [Frontend Team]
Team Type: [Frontend/Backend/Fullstack]
Roles to Include:
  ☑ Project Manager
  ☑ Developer
  ☑ QA Engineer
```

**System generates:**

-   Team ID: `frontend-team-uuid`
-   Member configurations:
    -   `frontend-pm` (Project Manager)
    -   `frontend-dev` (Developer)
    -   `frontend-qa` (QA Engineer)

**Data saved to `~/.agentmux/teams.json`:**

```json
{
	"id": "frontend-team-uuid",
	"name": "Frontend Team",
	"type": "frontend",
	"members": [
		{
			"role": "pm",
			"sessionName": "frontend-pm",
			"systemPrompt": "You are a Frontend Project Manager..."
		},
		{
			"role": "developer",
			"sessionName": "frontend-dev",
			"systemPrompt": "You are a Frontend Developer..."
		},
		{
			"role": "qa",
			"sessionName": "frontend-qa",
			"systemPrompt": "You are a Frontend QA Engineer..."
		}
	],
	"status": "idle"
}
```

### Step 2.3: Add a Project

User clicks "New Project" button:

**Project Selection Dialog:**

1. File browser opens
2. User navigates to `/Users/username/projects/my-web-app`
3. Clicks "Select This Folder"

**System actions:**

1. Creates project structure:

    ```
    /Users/username/projects/my-web-app/.agentmux/
    ├── specs/
    │   └── README.md
    ├── tickets/
    ├── memory/
    └── prompts/
    ```

2. Saves to `~/.agentmux/projects.json`:
    ```json
    {
    	"id": "project-uuid",
    	"name": "my-web-app",
    	"path": "/Users/username/projects/my-web-app",
    	"status": "planning",
    	"teams": {}
    }
    ```

## Phase 3: Project Configuration

### Step 3.1: Navigate to Project Detail

User clicks on the project card → Project Detail page opens

**Project Detail View:**

-   Editor tab (active) - shows file tree of `.agentmux/` folder
-   Tasks tab - empty kanban board
-   "Assign Team" button (visible)
-   "Start Project" button (hidden)

### Step 3.2: Create Project Spec

User selects `specs/` folder and creates `project-spec.md`:

```markdown
# Project: E-commerce Frontend Refactor

## Objective

Refactor the existing e-commerce frontend to use modern React patterns and improve performance.

## Requirements

1. Convert class components to functional components with hooks
2. Implement React Query for API state management
3. Add comprehensive error boundaries
4. Improve bundle size by 30%

## Technical Constraints

-   Must maintain backwards compatibility with existing API
-   Cannot break existing tests
-   Must support IE11 (unfortunately)

## Deliverables

1. Refactored components in `/src/components`
2. New state management layer
3. Performance metrics report
4. Updated documentation

## Success Criteria

-   All existing tests pass
-   Lighthouse score > 90
-   Bundle size < 200KB gzipped
```

### Step 3.3: Assign Team to Project

User clicks "Assign Team" button:

**Team Assignment Modal:**

```
Available Teams:
☑ Frontend Team (3 members)
☐ Backend Team (not created)

[Cancel] [Assign Selected]
```

User selects Frontend Team and clicks "Assign Selected"

**System updates `projects.json`:**

```json
{
	"id": "project-uuid",
	"teams": {
		"frontend": ["frontend-team-uuid"]
	}
}
```

**UI changes:**

-   "Start Project" button becomes visible
-   Team badge appears on project card

## Phase 4: Starting the Project

### Step 4.1: User Clicks "Start Project"

**Backend orchestration begins:**

#### 4.1.1: Create Orchestrator Session

```bash
# Backend executes:
tmux new-session -d -s "orchestrator" -c "/Users/username/projects/my-web-app"

# Set environment variables
tmux send-keys -t "orchestrator:0" "export TMUX_SESSION_NAME='orchestrator'" Enter
tmux send-keys -t "orchestrator:0" "export MCP_SERVER_URL='http://localhost:3001'" Enter
tmux send-keys -t "orchestrator:0" "export PROJECT_PATH='/Users/username/projects/my-web-app'" Enter
tmux send-keys -t "orchestrator:0" "export AGENT_ROLE='orchestrator'" Enter
```

#### 4.1.2: Start Claude Code in Orchestrator

```bash
# Write orchestrator system prompt
cat > /Users/username/projects/my-web-app/.agentmux/prompts/orchestrator.md << 'EOF'
You are the Orchestrator for AgentMux. Your responsibilities:
- Deploy and coordinate agent teams
- Monitor project progress
- Resolve cross-team dependencies
- Ensure quality standards

You have access to MCP tools to:
- create_team: Create new agent sessions
- send_message: Communicate with agents
- delegate_task: Assign work to teams
- schedule_check: Set up regular check-ins

Git Discipline:
- Ensure all agents commit every 30 minutes
- Verify feature branches are used
- Monitor for uncommitted work
EOF

# Start Claude Code
tmux send-keys -t "orchestrator:0" \
  "claude-code --system-prompt-file .agentmux/prompts/orchestrator.md --mcp-server localhost:3001" Enter
```

#### 4.1.3: Send Initial Project Brief

After 5 seconds (allowing Claude Code to start):

```bash
tmux send-keys -t "orchestrator:0" "You are now the orchestrator for the project at /Users/username/projects/my-web-app

Please review the project specification at .agentmux/specs/project-spec.md

Your assigned team structure:
- Frontend Team:
  - Project Manager (frontend-pm)
  - Developer (frontend-dev)
  - QA Engineer (frontend-qa)

Please:
1. Create the team member sessions using the create_team MCP tool
2. Brief each team member on their responsibilities
3. Delegate initial tasks based on the specification
4. Set up regular check-ins with the PM

Begin by analyzing the specification and creating your team."

# Wait 0.5 seconds then send Enter
sleep 0.5
tmux send-keys -t "orchestrator:0" Enter
```

### Step 4.2: Orchestrator Creates Team Sessions

The orchestrator Claude instance will now use MCP tools to create team sessions:

#### 4.2.1: Orchestrator Creates PM Session

```typescript
// Orchestrator calls via MCP:
create_team({
	role: 'pm',
	name: 'frontend-pm',
	projectPath: '/Users/username/projects/my-web-app',
	systemPrompt: `You are the Frontend Project Manager for the e-commerce refactor project.
  
Your responsibilities:
- Coordinate between developer and QA
- Track ticket progress
- Report status to orchestrator
- Ensure 30-minute commit rule
- Maintain high quality standards

Review the spec at .agentmux/specs/project-spec.md and create tickets for the team.`,
});
```

**System executes:**

```bash
tmux new-session -d -s "frontend-pm" -c "/Users/username/projects/my-web-app"
# Sets environment variables
# Starts Claude Code with PM prompt
```

#### 4.2.2: Orchestrator Creates Developer Session

```typescript
// Orchestrator calls via MCP:
create_team({
	role: 'developer',
	name: 'frontend-dev',
	projectPath: '/Users/username/projects/my-web-app',
	systemPrompt: `You are the Frontend Developer for the e-commerce refactor project.

Your responsibilities:
- Implement features according to tickets
- Write clean, tested code
- Commit every 30 minutes
- Work in feature branches
- Report progress to PM

Wait for task assignment from the PM.`,
});
```

#### 4.2.3: Orchestrator Creates QA Session

```typescript
// Similar process for QA engineer
create_team({
	role: 'qa',
	name: 'frontend-qa',
	projectPath: '/Users/username/projects/my-web-app',
	systemPrompt: `You are the QA Engineer...`,
});
```

### Step 4.3: Initial Team Coordination

#### 4.3.1: Orchestrator Briefs PM

```typescript
// Orchestrator calls via MCP:
send_message({
	to: 'frontend-pm:0',
	message: `Hello PM. I'm the orchestrator for this project. 

Please review the specification at .agentmux/specs/project-spec.md and:
1. Create tickets for each major deliverable
2. Assign initial tasks to the developer
3. Set up a testing plan with QA
4. Report back with your initial plan

Use the get_tickets and update_ticket MCP tools to manage tasks.`,
});
```

#### 4.3.2: PM Creates Tickets

The PM Claude instance creates ticket files:

`/Users/username/projects/my-web-app/.agentmux/tickets/ticket-001.yaml`:

```yaml
---
id: ticket-001
title: Convert HomePage component to functional component
status: todo
priority: high
assignedTo: frontend-dev
type: feature
---

## Description
Convert the existing HomePage class component to a functional component using React hooks.

## Acceptance Criteria
- [ ] Component uses function syntax
- [ ] State managed with useState
- [ ] Lifecycle methods replaced with useEffect
- [ ] All existing tests pass
- [ ] No regression in functionality

## Test Plan
1. Run existing component tests
2. Verify all interactive elements work
3. Check performance metrics
```

#### 4.3.3: PM Assigns Work to Developer

```typescript
// PM calls via MCP:
send_message({
	to: 'frontend-dev:0',
	message: `Hello Developer. I've created your first ticket.

Please work on ticket-001: Convert HomePage component to functional component.

You can retrieve it using:
get_tickets({ status: "todo" })

Remember to:
- Create a feature branch before starting
- Commit every 30 minutes
- Update ticket status as you progress
- Request review when complete`,
});
```

### Step 4.4: Schedule Automatic Check-ins

#### 4.4.1: Backend Schedules Orchestrator Check-in

The backend automatically schedules a 15-minute check-in:

```typescript
// backend/src/services/scheduler.service.ts
scheduleCheck(
	'orchestrator:0',
	15,
	`Check project progress:
1. Get status from all teams using get_team_status
2. Review any blockers
3. Ensure teams are committing regularly
4. Check ticket progress
5. Report any issues back to the dashboard`
);
```

**Implementation via subprocess:**

```bash
nohup bash -c "sleep 900 && \
  tmux send-keys -t 'orchestrator:0' 'SCHEDULED CHECK: Check project progress...' && \
  sleep 0.5 && \
  tmux send-keys -t 'orchestrator:0' Enter" > /dev/null 2>&1 &
```

#### 4.4.2: Orchestrator Sets PM Check-ins

```typescript
// Orchestrator calls via MCP:
schedule_check({
	minutes: 30,
	target: 'frontend-pm:0',
	message: 'Status update: Check developer progress, update tickets, report blockers',
});
```

## Phase 5: Ongoing Operations

### Step 5.1: Web Dashboard Monitoring

User returns to the Assignments page:

**Assignments View:**

-   Left panel shows active project with team assignments
-   Right panel shows orchestrator terminal output
-   User can see real-time agent communication

**Terminal Output Example:**

```
[Orchestrator] Team sessions created successfully
[Orchestrator] Briefing PM on project requirements...
[PM] Creating initial ticket batch...
[PM] Assigned ticket-001 to frontend-dev
[Developer] Starting work on ticket-001
[Developer] Created feature branch: feature/homepage-refactor
[Developer] Progress: 25% - Analyzing existing component
```

### Step 5.2: User Interaction via Dashboard

User can send messages to orchestrator:

**Terminal Input:**

```
User: "Please prioritize performance improvements"
```

**Orchestrator responds:**

```
Orchestrator: "Understood. I'll instruct the PM to prioritize performance-related tickets."
```

**Orchestrator then messages PM:**

```typescript
send_message({
	to: 'frontend-pm:0',
	message:
		'Priority change: Please focus on performance improvements first. Reorder tickets accordingly.',
});
```

### Step 5.3: Automatic Progress Tracking

Every 15 minutes, the scheduled check-in triggers:

**Orchestrator Check-in Process:**

1. Calls `get_team_status()` to check all sessions
2. Reviews recent terminal output from each agent
3. Checks git status in project
4. Updates dashboard via API
5. Intervenes if issues detected (uncommitted work, errors, blocked agents)

## Phase 6: Task Completion Flow

### Step 6.1: Developer Completes Task

```typescript
// Developer calls via MCP after implementation:
update_ticket({
	ticketId: 'ticket-001',
	status: 'review',
	notes: 'HomePage component converted. All tests passing.',
});

request_review({
	ticketId: 'ticket-001',
	reviewer: 'frontend-qa',
	branch: 'feature/homepage-refactor',
});
```

### Step 6.2: QA Reviews and Tests

```typescript
// QA receives review request and tests the implementation
// After testing, QA calls:
update_ticket({
	ticketId: 'ticket-001',
	status: 'done',
	notes: 'All tests pass. Performance improved by 15%. Approved for merge.',
});
```

### Step 6.3: PM Reports Completion

```typescript
// PM reports to orchestrator:
report_progress({
	progress: 25,
	completed: ['ticket-001: HomePage component refactored'],
	current: 'Assigning next component refactor',
	blockers: [],
	nextSteps: 'Continue with remaining components',
});
```

## Key System Behaviors

### Automatic Git Commits

Every 30 minutes, each developer agent automatically:

```bash
git add -A
git commit -m "Progress: [description] - frontend-dev"
```

### Error Recovery

If an agent encounters an error:

1. Reports to PM via `report_progress` with blockers
2. PM escalates to orchestrator if needed
3. Orchestrator can restart sessions or reassign work

### Session Persistence

-   All tmux sessions persist even if browser closes
-   User can reconnect and see ongoing work
-   Agents continue working autonomously

### Scaling Teams

Orchestrator can dynamically create additional agents:

```typescript
// If workload increases:
create_team({
	role: 'developer',
	name: 'frontend-dev-2',
	projectPath: '/Users/username/projects/my-web-app',
	systemPrompt: 'You are an additional Frontend Developer...',
});
```
