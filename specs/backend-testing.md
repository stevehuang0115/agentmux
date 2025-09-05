# AgentMux Backend API Testing Plan

## Overview

This document provides comprehensive test cases for all backend API endpoints following the user journey from project setup through team orchestration.

## Test Environment Setup

### Prerequisites

```bash
# Start backend server
npm run dev:backend  # Runs on port 3000

# Initialize test environment
export TEST_PROJECT_PATH="/tmp/test-project"
mkdir -p ~/.agentmux
echo "[]" > ~/.agentmux/teams.json
echo "[]" > ~/.agentmux/projects.json
```

## API Test Cases

### 1. Team Management APIs

#### 1.1 Create Team

```typescript
// POST /api/teams
describe('POST /api/teams', () => {
	test('Create new frontend team', async () => {
		const response = await fetch('http://localhost:3000/api/teams', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Frontend Team',
				type: 'frontend',
				members: [
					{
						role: 'pm',
						sessionName: 'frontend-pm',
						systemPrompt: 'You are a Frontend PM...',
					},
					{
						role: 'developer',
						sessionName: 'frontend-dev',
						systemPrompt: 'You are a Frontend Developer...',
					},
					{
						role: 'qa',
						sessionName: 'frontend-qa',
						systemPrompt: 'You are a QA Engineer...',
					},
				],
			}),
		});

		expect(response.status).toBe(201);
		const team = await response.json();
		expect(team).toMatchObject({
			id: expect.any(String),
			name: 'Frontend Team',
			status: 'idle',
			members: expect.arrayContaining([expect.objectContaining({ role: 'pm' })]),
		});

		// Verify saved to filesystem
		const teams = JSON.parse(await fs.readFile('~/.agentmux/teams.json', 'utf-8'));
		expect(teams).toContainEqual(expect.objectContaining({ id: team.id }));
	});

	test('Reject team with invalid role', async () => {
		const response = await fetch('http://localhost:3000/api/teams', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Invalid Team',
				members: [{ role: 'invalid-role' }],
			}),
		});

		expect(response.status).toBe(400);
		const error = await response.json();
		expect(error.message).toContain('Invalid role');
	});
});
```

#### 1.2 List Teams

```typescript
// GET /api/teams
describe('GET /api/teams', () => {
	test('List all teams with status', async () => {
		const response = await fetch('http://localhost:3000/api/teams');

		expect(response.status).toBe(200);
		const teams = await response.json();
		expect(teams).toBeInstanceOf(Array);
		expect(teams[0]).toHaveProperty('id');
		expect(teams[0]).toHaveProperty('status');
		expect(teams[0]).toHaveProperty('currentProject');
	});

	test('Filter teams by status', async () => {
		const response = await fetch('http://localhost:3000/api/teams?status=working');

		const teams = await response.json();
		teams.forEach((team) => {
			expect(team.status).toBe('working');
		});
	});
});
```

#### 1.3 Update Team Status

```typescript
// PATCH /api/teams/:id/status
describe('PATCH /api/teams/:id/status', () => {
	test('Update team status to working', async () => {
		const teamId = 'frontend-team-uuid';

		const response = await fetch(`http://localhost:3000/api/teams/${teamId}/status`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'working' }),
		});

		expect(response.status).toBe(200);
		const team = await response.json();
		expect(team.status).toBe('working');
		expect(team.lastActive).toBeDefined();
	});

	test('Reject invalid status', async () => {
		const response = await fetch(`http://localhost:3000/api/teams/test-id/status`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'invalid-status' }),
		});

		expect(response.status).toBe(400);
	});
});
```

### 2. Project Management APIs

#### 2.1 Create Project

```typescript
// POST /api/projects
describe('POST /api/projects', () => {
	test('Add new project with folder selection', async () => {
		const response = await fetch('http://localhost:3000/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'My Web App',
				path: '/Users/test/projects/my-web-app',
				description: 'E-commerce refactor project',
			}),
		});

		expect(response.status).toBe(201);
		const project = await response.json();
		expect(project).toMatchObject({
			id: expect.any(String),
			name: 'My Web App',
			path: '/Users/test/projects/my-web-app',
			status: 'planning',
			teams: {},
		});

		// Verify .agentmux directory created
		const agentmuxPath = '/Users/test/projects/my-web-app/.agentmux';
		expect(fs.existsSync(`${agentmuxPath}/specs`)).toBe(true);
		expect(fs.existsSync(`${agentmuxPath}/tickets`)).toBe(true);
		expect(fs.existsSync(`${agentmuxPath}/memory`)).toBe(true);
	});

	test('Reject duplicate project path', async () => {
		const response = await fetch('http://localhost:3000/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				path: '/Users/test/projects/my-web-app', // Already exists
			}),
		});

		expect(response.status).toBe(409);
		const error = await response.json();
		expect(error.message).toContain('already exists');
	});
});
```

#### 2.2 Assign Teams to Project

```typescript
// POST /api/projects/:id/teams
describe('POST /api/projects/:id/teams', () => {
	test('Assign frontend team to project', async () => {
		const projectId = 'project-uuid';
		const teamId = 'frontend-team-uuid';

		const response = await fetch(`http://localhost:3000/api/projects/${projectId}/teams`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				teamIds: [teamId],
				teamType: 'frontend',
			}),
		});

		expect(response.status).toBe(200);
		const project = await response.json();
		expect(project.teams.frontend).toContain(teamId);
	});

	test('Prevent assigning busy team', async () => {
		const response = await fetch(`http://localhost:3000/api/projects/project-2/teams`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				teamIds: ['busy-team-id'], // Team already working
			}),
		});

		expect(response.status).toBe(400);
		const error = await response.json();
		expect(error.message).toContain('already assigned');
	});
});
```

#### 2.3 Start Project

```typescript
// POST /api/projects/:id/start
describe('POST /api/projects/:id/start', () => {
	test('Start project with assigned teams', async () => {
		const projectId = 'project-uuid';

		const response = await fetch(`http://localhost:3000/api/projects/${projectId}/start`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				orchestratorPrompt: 'Custom orchestrator instructions...',
			}),
		});

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result).toMatchObject({
			success: true,
			orchestratorSession: 'orchestrator',
			message: expect.stringContaining('started'),
		});

		// Verify tmux session created
		const sessions = await execAsync('tmux list-sessions -F "#{session_name}"');
		expect(sessions.stdout).toContain('orchestrator');

		// Verify orchestrator briefing sent
		await new Promise((resolve) => setTimeout(resolve, 6000));
		const paneContent = await execAsync('tmux capture-pane -t orchestrator:0 -p');
		expect(paneContent.stdout).toContain('project specification');
	});

	test('Reject starting project without teams', async () => {
		const response = await fetch(`http://localhost:3000/api/projects/no-teams-project/start`, {
			method: 'POST',
		});

		expect(response.status).toBe(400);
		const error = await response.json();
		expect(error.message).toContain('No teams assigned');
	});
});
```

### 3. Ticket Management APIs

#### 3.1 Create Ticket

```typescript
// POST /api/projects/:id/tickets
describe('POST /api/projects/:id/tickets', () => {
	test('Create new ticket', async () => {
		const projectId = 'project-uuid';

		const response = await fetch(`http://localhost:3000/api/projects/${projectId}/tickets`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: 'Convert HomePage to functional component',
				description: 'Refactor class component to use hooks',
				acceptanceCriteria: [
					'Uses function syntax',
					'State managed with useState',
					'All tests pass',
				],
				priority: 'high',
				type: 'feature',
			}),
		});

		expect(response.status).toBe(201);
		const ticket = await response.json();
		expect(ticket).toMatchObject({
			id: expect.any(String),
			title: 'Convert HomePage to functional component',
			status: 'todo',
			priority: 'high',
		});

		// Verify ticket file created
		const ticketPath = `/Users/test/projects/my-web-app/.agentmux/tickets/${ticket.id}.yaml`;
		expect(fs.existsSync(ticketPath)).toBe(true);
	});
});
```

#### 3.2 Update Ticket

```typescript
// PATCH /api/tickets/:id
describe('PATCH /api/tickets/:id', () => {
	test('Update ticket status and assignee', async () => {
		const ticketId = 'ticket-001';

		const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				status: 'in_progress',
				assignedTo: 'frontend-dev',
				notes: 'Started implementation',
			}),
		});

		expect(response.status).toBe(200);
		const ticket = await response.json();
		expect(ticket.status).toBe('in_progress');
		expect(ticket.assignedTo).toBe('frontend-dev');
		expect(ticket.updatedAt).toBeDefined();
	});

	test('Add comment to ticket', async () => {
		const response = await fetch(`http://localhost:3000/api/tickets/ticket-001`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				comment: {
					author: 'frontend-pm',
					content: 'Please prioritize performance',
				},
			}),
		});

		const ticket = await response.json();
		expect(ticket.comments).toContainEqual(
			expect.objectContaining({
				author: 'frontend-pm',
				content: 'Please prioritize performance',
			})
		);
	});
});
```

### 4. Scheduler APIs

#### 4.1 Schedule Check-in

```typescript
// POST /api/schedule
describe('POST /api/schedule', () => {
	test('Schedule orchestrator check-in', async () => {
		const response = await fetch('http://localhost:3000/api/schedule', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				targetSession: 'orchestrator:0',
				minutes: 15,
				message: 'Check project progress and team status',
			}),
		});

		expect(response.status).toBe(201);
		const schedule = await response.json();
		expect(schedule).toMatchObject({
			id: expect.any(String),
			targetSession: 'orchestrator:0',
			scheduledFor: expect.any(String),
			message: expect.stringContaining('Check project'),
		});
	});

	test('List scheduled check-ins', async () => {
		const response = await fetch('http://localhost:3000/api/schedule');

		expect(response.status).toBe(200);
		const schedules = await response.json();
		expect(schedules).toBeInstanceOf(Array);
		expect(schedules[0]).toHaveProperty('scheduledFor');
		expect(schedules[0]).toHaveProperty('remaining');
	});
});
```

### 5. Terminal APIs

#### 5.1 Capture Terminal Output

```typescript
// GET /api/terminal/:session/capture
describe('GET /api/terminal/:session/capture', () => {
	test('Get terminal output from session', async () => {
		const response = await fetch(
			'http://localhost:3000/api/terminal/orchestrator/capture?lines=50'
		);

		expect(response.status).toBe(200);
		const output = await response.json();
		expect(output).toHaveProperty('session', 'orchestrator');
		expect(output).toHaveProperty('content');
		expect(output.content).toBeInstanceOf(String);
	});

	test('Handle non-existent session', async () => {
		const response = await fetch('http://localhost:3000/api/terminal/non-existent/capture');

		expect(response.status).toBe(404);
		const error = await response.json();
		expect(error.message).toContain('Session not found');
	});
});
```

### 6. WebSocket Integration Tests

#### 6.1 Terminal Streaming

```typescript
// WebSocket terminal streaming
describe('WebSocket Terminal Streaming', () => {
	test('Subscribe to terminal output', async () => {
		const ws = new WebSocket('ws://localhost:3000');

		await new Promise((resolve) => {
			ws.on('open', resolve);
		});

		// Subscribe to session
		ws.send(
			JSON.stringify({
				type: 'terminal:subscribe',
				sessionName: 'orchestrator',
			})
		);

		// Wait for initial content
		const message = await new Promise((resolve) => {
			ws.on('message', (data) => {
				const msg = JSON.parse(data);
				if (msg.type === 'terminal:initial') {
					resolve(msg);
				}
			});
		});

		expect(message.sessionName).toBe('orchestrator');
		expect(message.content).toBeDefined();

		ws.close();
	});

	test('Send input to terminal', async () => {
		const ws = new WebSocket('ws://localhost:3000');

		await new Promise((resolve) => ws.on('open', resolve));

		ws.send(
			JSON.stringify({
				type: 'terminal:input',
				sessionName: 'orchestrator',
				input: 'echo "Test input"',
			})
		);

		// Verify input was sent
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const output = await fetch(
			'http://localhost:3000/api/terminal/orchestrator/capture?lines=5'
		);
		const result = await output.json();

		expect(result.content).toContain('Test input');

		ws.close();
	});
});
```

### 7. End-to-End Workflow Test

```typescript
describe('Complete User Journey API Flow', () => {
	test('Full project setup and start', async () => {
		// 1. Create team
		const teamResponse = await fetch('http://localhost:3000/api/teams', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'E2E Test Team',
				type: 'frontend',
				members: [
					{ role: 'pm', sessionName: 'e2e-pm' },
					{ role: 'developer', sessionName: 'e2e-dev' },
				],
			}),
		});
		const team = await teamResponse.json();

		// 2. Create project
		const projectResponse = await fetch('http://localhost:3000/api/projects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'E2E Test Project',
				path: '/tmp/e2e-test-project',
			}),
		});
		const project = await projectResponse.json();

		// 3. Assign team to project
		await fetch(`http://localhost:3000/api/projects/${project.id}/teams`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				teamIds: [team.id],
				teamType: 'frontend',
			}),
		});

		// 4. Start project
		const startResponse = await fetch(
			`http://localhost:3000/api/projects/${project.id}/start`,
			{
				method: 'POST',
			}
		);
		const startResult = await startResponse.json();

		expect(startResult.success).toBe(true);
		expect(startResult.orchestratorSession).toBe('orchestrator');

		// 5. Verify orchestrator is running
		await new Promise((resolve) => setTimeout(resolve, 7000));
		const captureResponse = await fetch(
			'http://localhost:3000/api/terminal/orchestrator/capture'
		);
		const output = await captureResponse.json();

		expect(output.content).toContain('project specification');

		// 6. Verify schedule was created
		const scheduleResponse = await fetch('http://localhost:3000/api/schedule');
		const schedules = await scheduleResponse.json();

		expect(schedules).toContainEqual(
			expect.objectContaining({
				targetSession: 'orchestrator:0',
			})
		);
	});
});
```

## Test Utilities

```typescript
// test/utils/api-test-helpers.ts
export class ApiTestHelper {
	private baseUrl = 'http://localhost:3000';

	async createTestTeam(name: string): Promise<any> {
		const response = await fetch(`${this.baseUrl}/api/teams`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name,
				type: 'frontend',
				members: [
					{ role: 'pm', sessionName: `${name}-pm` },
					{ role: 'developer', sessionName: `${name}-dev` },
				],
			}),
		});
		return response.json();
	}

	async createTestProject(path: string): Promise<any> {
		const response = await fetch(`${this.baseUrl}/api/projects`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: path.split('/').pop(),
				path,
			}),
		});
		return response.json();
	}

	async cleanupTestData(): Promise<void> {
		// Clean up test teams
		await fs.writeFile('~/.agentmux/teams.json', '[]');
		await fs.writeFile('~/.agentmux/projects.json', '[]');

		// Kill test tmux sessions
		const sessions = await execAsync('tmux list-sessions -F "#{session_name}"');
		for (const session of sessions.stdout.split('\n')) {
			if (session.includes('test') || session.includes('e2e')) {
				await execAsync(`tmux kill-session -t ${session}`).catch(() => {});
			}
		}
	}
}
```

## Running the Tests

```json
// package.json
{
	"scripts": {
		"test:api": "jest test/api --runInBand",
		"test:api:watch": "jest test/api --watch --runInBand",
		"test:api:coverage": "jest test/api --coverage --runInBand"
	}
}
```

The `--runInBand` flag ensures tests run sequentially to avoid conflicts with shared resources like tmux sessions and filesystem storage.
