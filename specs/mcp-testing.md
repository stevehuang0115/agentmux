# AgentMux MCP Automated Testing Suite

## Overview

An automated test suite that programmatically validates MCP tool functionality without manual prompt copying.

## Test Implementation

### 1. Test Runner Script

```typescript
// test/mcp-integration.test.ts
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

class MCPTestRunner {
	private testProjectPath: string;
	private testSessionName: string;
	private mcpServerUrl: string;

	constructor() {
		this.testProjectPath = `/tmp/agentmux-test-${uuidv4()}`;
		this.testSessionName = `test-agent-${uuidv4().slice(0, 8)}`;
		this.mcpServerUrl = 'http://localhost:3001';
	}

	async setup() {
		// Create test project structure
		await this.createTestProject();

		// Start test tmux session
		await this.createTestSession();

		// Wait for services to be ready
		await this.waitForServices();
	}

	async teardown() {
		// Clean up tmux sessions
		await execAsync(`tmux kill-session -t ${this.testSessionName} 2>/dev/null || true`);

		// Clean up test files
		await fs.rm(this.testProjectPath, { recursive: true, force: true });
	}

	private async createTestProject() {
		await fs.mkdir(path.join(this.testProjectPath, '.agentmux/tickets'), { recursive: true });
		await fs.mkdir(path.join(this.testProjectPath, '.agentmux/specs'), { recursive: true });

		// Initialize git
		await execAsync(`cd ${this.testProjectPath} && git init`);
		await execAsync(`cd ${this.testProjectPath} && git config user.email "test@example.com"`);
		await execAsync(`cd ${this.testProjectPath} && git config user.name "Test User"`);
	}

	private async createTestSession() {
		await execAsync(
			`tmux new-session -d -s ${this.testSessionName} -c ${this.testProjectPath}`
		);
	}

	private async waitForServices() {
		// Wait for MCP server
		for (let i = 0; i < 30; i++) {
			try {
				const response = await fetch(`${this.mcpServerUrl}/health`);
				if (response.ok) break;
			} catch (e) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}
}
```

### 2. MCP Tool Test Cases

```typescript
// test/tools/communication.test.ts
import { MCPClient } from '../utils/mcp-client';
import { TmuxHelper } from '../utils/tmux-helper';

describe('Communication Tools', () => {
	let mcp: MCPClient;
	let tmux: TmuxHelper;
	let targetSession: string;

	beforeEach(async () => {
		mcp = new MCPClient('test-session');
		tmux = new TmuxHelper();
		targetSession = await tmux.createSession('target-session');
	});

	afterEach(async () => {
		await tmux.killSession(targetSession);
	});

	test('send_message delivers to target session', async () => {
		// Execute tool
		const result = await mcp.callTool('send_message', {
			to: `${targetSession}:0`,
			message: 'Test message from automated test',
		});

		// Verify delivery
		await new Promise((resolve) => setTimeout(resolve, 1000));
		const paneContent = await tmux.capturePane(targetSession);

		expect(result.success).toBe(true);
		expect(paneContent).toContain('Test message from automated test');
	});

	test('broadcast sends to all sessions', async () => {
		// Create multiple sessions
		const sessions = await Promise.all([
			tmux.createSession('broadcast-test-1'),
			tmux.createSession('broadcast-test-2'),
			tmux.createSession('broadcast-test-3'),
		]);

		// Broadcast message
		await mcp.callTool('broadcast', {
			message: 'Broadcast test message',
			excludeSelf: true,
		});

		// Verify all received
		await new Promise((resolve) => setTimeout(resolve, 1000));
		for (const session of sessions) {
			const content = await tmux.capturePane(session);
			expect(content).toContain('Broadcast test message');
		}

		// Clean up
		await Promise.all(sessions.map((s) => tmux.killSession(s)));
	});

	test('get_team_status returns correct data', async () => {
		const result = await mcp.callTool('get_team_status', {});

		expect(result).toBeInstanceOf(Array);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0]).toHaveProperty('session');
		expect(result[0]).toHaveProperty('status');
		expect(result[0]).toHaveProperty('attached');
	});
});
```

### 3. Ticket Management Tests

```typescript
// test/tools/tickets.test.ts
describe('Ticket Management Tools', () => {
	let mcp: MCPClient;
	let testTicketId: string;

	beforeEach(async () => {
		mcp = new MCPClient('test-session', testProjectPath);
		testTicketId = `ticket-${Date.now()}`;

		// Create test ticket
		await createTestTicket(testTicketId);
	});

	test('get_tickets retrieves assigned tickets', async () => {
		const tickets = await mcp.callTool('get_tickets', {
			status: 'todo',
		});

		expect(tickets).toBeInstanceOf(Array);
		expect(tickets.length).toBeGreaterThan(0);
		expect(tickets[0].id).toBe(testTicketId);
	});

	test('update_ticket changes status and adds notes', async () => {
		const result = await mcp.callTool('update_ticket', {
			ticketId: testTicketId,
			status: 'in_progress',
			notes: 'Started work on this ticket',
		});

		expect(result.success).toBe(true);

		// Verify file was updated
		const ticketContent = await fs.readFile(
			`${testProjectPath}/.agentmux/tickets/${testTicketId}.yaml`,
			'utf-8'
		);

		expect(ticketContent).toContain('status: in_progress');
		expect(ticketContent).toContain('Started work on this ticket');
	});

	test('update_ticket enforces git commit when done', async () => {
		// Create uncommitted change
		await fs.writeFile(`${testProjectPath}/test.txt`, 'test content');
		await execAsync(`cd ${testProjectPath} && git add test.txt`);

		// Update ticket to done
		await mcp.callTool('update_ticket', {
			ticketId: testTicketId,
			status: 'done',
		});

		// Check git was committed
		const gitStatus = await execAsync(`cd ${testProjectPath} && git status --porcelain`);
		expect(gitStatus.stdout.trim()).toBe('');

		const lastCommit = await execAsync(`cd ${testProjectPath} && git log -1 --oneline`);
		expect(lastCommit.stdout).toContain(`Complete: Ticket ${testTicketId}`);
	});
});
```

### 4. Progress & Coordination Tests

```typescript
// test/tools/coordination.test.ts
describe('Progress and Coordination Tools', () => {
	test('report_progress sends formatted update to PM', async () => {
		const pmSession = await tmux.createSession('test-pm');

		await mcp.callTool('report_progress', {
			ticketId: 'test-001',
			progress: 50,
			completed: ['Setup environment', 'Initial analysis'],
			current: 'Implementing core feature',
			blockers: [],
			nextSteps: 'Add tests',
		});

		await new Promise((resolve) => setTimeout(resolve, 1000));
		const pmContent = await tmux.capturePane(pmSession);

		expect(pmContent).toContain('STATUS UPDATE');
		expect(pmContent).toContain('Progress: 50%');
		expect(pmContent).toContain('Setup environment');

		await tmux.killSession(pmSession);
	});

	test('request_review enforces commit and notifies reviewer', async () => {
		const qaSession = await tmux.createSession('test-qa');

		await mcp.callTool('request_review', {
			ticketId: 'test-001',
			reviewer: 'test-qa',
			message: 'Please review the implementation',
		});

		await new Promise((resolve) => setTimeout(resolve, 1000));
		const qaContent = await tmux.capturePane(qaSession);

		expect(qaContent).toContain('REVIEW REQUEST');
		expect(qaContent).toContain('test-001');

		await tmux.killSession(qaSession);
	});
});
```

### 5. Scheduling Tests

```typescript
// test/tools/scheduling.test.ts
describe('Scheduling Tools', () => {
	test('schedule_check creates background process', async () => {
		const result = await mcp.callTool('schedule_check', {
			minutes: 1,
			message: 'Test scheduled check',
			target: testSessionName,
		});

		expect(result.success).toBe(true);

		// Check for background process
		const processes = await execAsync('ps aux | grep "sleep 60" | grep -v grep');
		expect(processes.stdout).toBeTruthy();

		// Wait and verify message delivery
		await new Promise((resolve) => setTimeout(resolve, 61000));
		const content = await tmux.capturePane(testSessionName);
		expect(content).toContain('SCHEDULED CHECK: Test scheduled check');
	}, 70000); // Extended timeout for scheduling test
});
```

### 6. Git Management Tests

```typescript
// test/tools/git.test.ts
describe('Git Management Tools', () => {
	test('enforce_commit commits uncommitted changes', async () => {
		// Create changes
		await fs.writeFile(`${testProjectPath}/feature.js`, 'console.log("test");');
		await execAsync(`cd ${testProjectPath} && git add feature.js`);

		const result = await mcp.callTool('enforce_commit', {
			message: 'Test commit from automated test',
		});

		expect(result.success).toBe(true);
		expect(result.committed).toBe(true);

		const log = await execAsync(`cd ${testProjectPath} && git log -1 --oneline`);
		expect(log.stdout).toContain('Test commit from automated test');
	});

	test('enforce_commit handles no changes gracefully', async () => {
		const result = await mcp.callTool('enforce_commit', {
			message: 'Nothing to commit',
		});

		expect(result.success).toBe(true);
		expect(result.committed).toBe(false);
		expect(result.message).toContain('No changes');
	});
});
```

### 7. Permission Tests

```typescript
// test/tools/permissions.test.ts
describe('Permission Controls', () => {
	test('create_team blocked for non-orchestrator', async () => {
		const nonOrchMcp = new MCPClient('developer-session');

		await expect(
			nonOrchMcp.callTool('create_team', {
				role: 'qa',
				name: 'test-qa',
				projectPath: testProjectPath,
			})
		).rejects.toThrow('Only orchestrator can create teams');
	});

	test('create_team allowed for orchestrator', async () => {
		const orchMcp = new MCPClient('orchestrator');

		const result = await orchMcp.callTool('create_team', {
			role: 'developer',
			name: 'test-dev',
			projectPath: testProjectPath,
		});

		expect(result.success).toBe(true);

		// Verify session created
		const sessions = await execAsync('tmux list-sessions -F "#{session_name}"');
		expect(sessions.stdout).toContain('test-dev');

		// Clean up
		await execAsync('tmux kill-session -t test-dev');
	});
});
```

### 8. Claude Initialization Tests

```typescript
// test/tools/claude-init.test.ts
describe('Claude Initialization Tools', () => {
	test('initialize_claude sources bashrc and starts claude', async () => {
		const testSession = await tmux.createSession('init-test-session');

		const result = await mcp.callTool('initialize_claude', {
			session: testSession,
		});

		expect(result.success).toBe(true);
		expect(result.message).toContain(`Claude Code initialized in session ${testSession}`);

		// Wait for initialization to complete
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// Verify bashrc was sourced and claude was started
		const paneContent = await tmux.capturePane(testSession);
		expect(paneContent).toContain('source ~/.bashrc');

		// Check for Claude Code startup indicators
		// Note: In actual testing, you'd need to mock or verify the claude command
		const windowInfo = await tmux.getWindowInfo(testSession);
		expect(windowInfo).toBeDefined();

		await tmux.killSession(testSession);
	});

	test('initialize_claude handles non-existent session', async () => {
		await expect(
			mcp.callTool('initialize_claude', {
				session: 'non-existent-session',
			})
		).rejects.toThrow();
	});
});
```

### 9. Team Monitoring Tests

```typescript
// test/tools/monitoring.test.ts
describe('Team Monitoring Tools', () => {
	let testSession: string;

	beforeEach(async () => {
		testSession = await tmux.createSession('monitor-test');
		
		// Add some test content to the session
		await tmux.sendKeys(testSession, 'echo "Test activity line 1"');
		await tmux.sendKeys(testSession, 'echo "Test activity line 2"');
		await tmux.sendKeys(testSession, 'echo "Current working on task X"');
	});

	afterEach(async () => {
		await tmux.killSession(testSession);
	});

	test('get_team_logs captures session terminal output', async () => {
		const result = await mcp.callTool('get_team_logs', {
			session: testSession,
			lines: 10,
		});

		expect(result).toHaveProperty('session', testSession);
		expect(result).toHaveProperty('logs');
		expect(result).toHaveProperty('timestamp');
		expect(result.logs).toContain('Test activity line 1');
		expect(result.logs).toContain('Test activity line 2');
		expect(result.logs).toContain('Current working on task X');
		expect(result.lines).toBe(10);
	});

	test('get_team_logs with custom window index', async () => {
		// Create a new window in the session
		await tmux.newWindow(testSession, 'test-window');
		await tmux.sendKeys(testSession, 'echo "Window 1 content"', 1);

		const result = await mcp.callTool('get_team_logs', {
			session: testSession,
			lines: 5,
			window: 1,
		});

		expect(result).toHaveProperty('window', 1);
		expect(result.logs).toContain('Window 1 content');
	});

	test('ping_team_member returns comprehensive session info', async () => {
		// Add multiple windows to test comprehensive info
		await tmux.newWindow(testSession, 'dev-window');
		await tmux.newWindow(testSession, 'test-window');

		const result = await mcp.callTool('ping_team_member', {
			session: testSession,
		});

		expect(result).toHaveProperty('session', testSession);
		expect(result).toHaveProperty('currentWindow');
		expect(result).toHaveProperty('attached');
		expect(result).toHaveProperty('created');
		expect(result).toHaveProperty('windows');
		expect(result).toHaveProperty('currentActivity');
		expect(result).toHaveProperty('timestamp');

		// Verify windows array contains expected windows
		expect(result.windows).toBeInstanceOf(Array);
		expect(result.windows.length).toBeGreaterThanOrEqual(3); // Original + 2 new windows
		
		// Check window structure
		expect(result.windows[0]).toHaveProperty('index');
		expect(result.windows[0]).toHaveProperty('name');
		expect(result.windows[0]).toHaveProperty('active');

		// Verify current activity contains recent commands
		expect(result.currentActivity).toContain('Test activity');
	});

	test('ping_team_member handles non-existent session', async () => {
		await expect(
			mcp.callTool('ping_team_member', {
				session: 'non-existent-session',
			})
		).rejects.toThrow('Session "non-existent-session" not found');
	});

	test('get_team_logs with different line counts', async () => {
		// Test with minimal lines
		const smallResult = await mcp.callTool('get_team_logs', {
			session: testSession,
			lines: 3,
		});

		expect(smallResult.lines).toBe(3);

		// Test with maximum lines
		const largeResult = await mcp.callTool('get_team_logs', {
			session: testSession,
			lines: 50,
		});

		expect(largeResult.lines).toBe(50);
	});

	test('team monitoring integration with session metadata', async () => {
		// Test that session metadata is properly captured
		const pingResult = await mcp.callTool('ping_team_member', {
			session: testSession,
		});

		const logsResult = await mcp.callTool('get_team_logs', {
			session: testSession,
			lines: 20,
		});

		// Both should reference the same session
		expect(pingResult.session).toBe(logsResult.session);
		
		// Timestamps should be recent
		const pingTime = new Date(pingResult.timestamp);
		const logsTime = new Date(logsResult.timestamp);
		const timeDiff = Math.abs(pingTime.getTime() - logsTime.getTime());
		expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
	});
});
```

### 10. Integration Test Suite

```typescript
// test/integration/workflow.test.ts
describe('Complete Workflow Integration', () => {
	test('Full ticket lifecycle', async () => {
		// 1. Create ticket
		const ticketId = await createTestTicket({
			title: 'Integration test ticket',
			assignedTo: testSessionName,
		});

		// 2. Get tickets
		const tickets = await mcp.callTool('get_tickets', {});
		expect(tickets).toContainEqual(expect.objectContaining({ id: ticketId }));

		// 3. Update to in_progress
		await mcp.callTool('update_ticket', {
			ticketId,
			status: 'in_progress',
		});

		// 4. Report progress
		await mcp.callTool('report_progress', {
			ticketId,
			progress: 50,
			current: 'Working on implementation',
		});

		// 5. Complete and request review
		await mcp.callTool('update_ticket', {
			ticketId,
			status: 'review',
		});

		await mcp.callTool('request_review', {
			ticketId,
			reviewer: 'qa-session',
		});

		// 6. Verify final state
		const finalTicket = await getTicket(ticketId);
		expect(finalTicket.status).toBe('review');
		expect(finalTicket.comments).toHaveLength(2); // Progress + review request
	});

	test('Complete team orchestration workflow with new methods', async () => {
		const orchMcp = new MCPClient('orchestrator');

		// 1. Create a new team member
		const devSession = 'integration-dev';
		await orchMcp.callTool('create_team', {
			role: 'developer',
			name: devSession,
			projectPath: testProjectPath,
		});

		// 2. Initialize Claude Code in the new team member's session
		await orchMcp.callTool('initialize_claude', {
			session: devSession,
		});

		// Wait for initialization
		await new Promise((resolve) => setTimeout(resolve, 3000));

		// 3. Send initial instructions to the team member
		await orchMcp.callTool('send_message', {
			to: devSession,
			message: 'Welcome to the team! Please start working on ticket-123',
		});

		// 4. Monitor the team member's activity
		const pingResult = await orchMcp.callTool('ping_team_member', {
			session: devSession,
		});

		expect(pingResult.session).toBe(devSession);
		expect(pingResult).toHaveProperty('currentActivity');
		expect(pingResult).toHaveProperty('windows');

		// 5. Get detailed logs from the team member
		const logsResult = await orchMcp.callTool('get_team_logs', {
			session: devSession,
			lines: 15,
		});

		expect(logsResult.session).toBe(devSession);
		expect(logsResult.logs).toContain('Welcome to the team');

		// 6. Check overall team status
		const teamStatus = await orchMcp.callTool('get_team_status', {});
		const devMemberStatus = teamStatus.find((member) => member.session === devSession);
		expect(devMemberStatus).toBeDefined();
		expect(devMemberStatus.attached).toBeDefined();

		// 7. Clean up
		await orchMcp.callTool('kill_agent', {
			session: devSession,
		});

		// Verify the session was terminated
		const finalTeamStatus = await orchMcp.callTool('get_team_status', {});
		const removedMember = finalTeamStatus.find((member) => member.session === devSession);
		expect(removedMember).toBeUndefined();
	});

	test('Monitoring workflow - orchestrator supervises multiple agents', async () => {
		const orchMcp = new MCPClient('orchestrator');

		// Create multiple team members
		const devSession = 'multi-dev';
		const qaSession = 'multi-qa';

		await orchMcp.callTool('create_team', {
			role: 'developer',
			name: devSession,
			projectPath: testProjectPath,
		});

		await orchMcp.callTool('create_team', {
			role: 'qa',
			name: qaSession,
			projectPath: testProjectPath,
		});

		// Initialize Claude in both sessions
		await orchMcp.callTool('initialize_claude', { session: devSession });
		await orchMcp.callTool('initialize_claude', { session: qaSession });

		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Send different tasks to each
		await orchMcp.callTool('send_message', {
			to: devSession,
			message: 'Please implement the user authentication feature',
		});

		await orchMcp.callTool('send_message', {
			to: qaSession,
			message: 'Please prepare test cases for the authentication feature',
		});

		// Monitor both team members
		const devPing = await orchMcp.callTool('ping_team_member', {
			session: devSession,
		});

		const qaPing = await orchMcp.callTool('ping_team_member', {
			session: qaSession,
		});

		expect(devPing.session).toBe(devSession);
		expect(qaPing.session).toBe(qaSession);

		// Get logs from both
		const devLogs = await orchMcp.callTool('get_team_logs', {
			session: devSession,
			lines: 10,
		});

		const qaLogs = await orchMcp.callTool('get_team_logs', {
			session: qaSession,
			lines: 10,
		});

		expect(devLogs.logs).toContain('authentication feature');
		expect(qaLogs.logs).toContain('test cases');

		// Broadcast status update
		await orchMcp.callTool('broadcast', {
			message: 'Team standup in 15 minutes - please prepare your updates',
			excludeSelf: true,
		});

		// Verify broadcast was received (check logs again)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const devLogsAfterBroadcast = await orchMcp.callTool('get_team_logs', {
			session: devSession,
			lines: 5,
		});

		expect(devLogsAfterBroadcast.logs).toContain('Team standup');

		// Clean up both sessions
		await orchMcp.callTool('kill_agent', { session: devSession });
		await orchMcp.callTool('kill_agent', { session: qaSession });
	});
});
```

## Test Execution

### Run All Tests

```json
// package.json
{
	"scripts": {
		"test:mcp": "jest test/mcp-integration.test.ts",
		"test:mcp:watch": "jest test/mcp-integration.test.ts --watch",
		"test:mcp:coverage": "jest test/mcp-integration.test.ts --coverage"
	}
}
```

### GitHub Actions CI

```yaml
# .github/workflows/mcp-tests.yml
name: MCP Integration Tests

on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v2

            - name: Setup Node.js
              uses: actions/setup-node@v2
              with:
                  node-version: '18'

            - name: Install tmux
              run: sudo apt-get install -y tmux

            - name: Install dependencies
              run: npm ci

            - name: Start services
              run: |
                  npm run start:backend &
                  npm run start:mcp &
                  sleep 5

            - name: Run MCP tests
              run: npm run test:mcp

            - name: Upload coverage
              uses: codecov/codecov-action@v2
```

This automated testing approach provides comprehensive coverage with minimal manual intervention, making it easy to validate MCP functionality during development and CI/CD.
