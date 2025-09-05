# AgentMux E2E Integration Tests with Playwright

## Overview

End-to-end tests that validate the complete user journey from launching AgentMux through autonomous agent operation, testing frontend UI, backend APIs, and tmux orchestration together.

## Test Setup

### Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	timeout: 60000,
	expect: {
		timeout: 10000,
	},
	use: {
		baseURL: 'http://localhost:3000',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	webServer: {
		command: 'npm run start:test',
		port: 3000,
		timeout: 30000,
		reuseExistingServer: !process.env.CI,
	},
});
```

### Test Utilities

```typescript
// e2e/utils/test-helpers.ts
import { Page, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export class AgentMuxTestHelper {
	constructor(private page: Page) {}

	async cleanupEnvironment() {
		// Clean config files
		await fs.writeFile(`${process.env.HOME}/.agentmux/teams.json`, '[]');
		await fs.writeFile(`${process.env.HOME}/.agentmux/projects.json`, '[]');

		// Kill all test tmux sessions
		const { stdout } = await execAsync(
			'tmux list-sessions -F "#{session_name}" 2>/dev/null || true'
		);
		for (const session of stdout.split('\n').filter((s) => s)) {
			if (session.includes('test-') || session === 'orchestrator') {
				await execAsync(`tmux kill-session -t ${session} 2>/dev/null || true`);
			}
		}
	}

	async waitForTmuxSession(sessionName: string, timeout = 10000) {
		const start = Date.now();
		while (Date.now() - start < timeout) {
			const { stdout } = await execAsync(
				'tmux list-sessions -F "#{session_name}" 2>/dev/null || true'
			);
			if (stdout.includes(sessionName)) return true;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		throw new Error(`Tmux session ${sessionName} not created within timeout`);
	}

	async getTmuxOutput(sessionName: string, lines = 50): Promise<string> {
		const { stdout } = await execAsync(`tmux capture-pane -t ${sessionName}:0 -p -S -${lines}`);
		return stdout;
	}

	async createTestProject(path: string) {
		await fs.mkdir(`${path}/.agentmux/specs`, { recursive: true });
		await fs.mkdir(`${path}/.agentmux/tickets`, { recursive: true });
		await execAsync(`cd ${path} && git init`);

		// Create test spec
		await fs.writeFile(
			`${path}/.agentmux/specs/project-spec.md`,
			`
# Test Project Specification

## Objective
Test project for E2E testing

## Requirements
1. Feature A
2. Feature B

## Deliverables
1. Implementation
2. Tests
    `
		);
	}
}
```

## E2E Test Cases

### Test 1: Complete Project Setup Flow

```typescript
// e2e/project-setup.spec.ts
import { test, expect } from '@playwright/test';
import { AgentMuxTestHelper } from './utils/test-helpers';

test.describe('Project Setup Flow', () => {
	let helper: AgentMuxTestHelper;

	test.beforeEach(async ({ page }) => {
		helper = new AgentMuxTestHelper(page);
		await helper.cleanupEnvironment();
		await page.goto('/');
	});

	test.afterEach(async () => {
		await helper.cleanupEnvironment();
	});

	test('Complete journey from start to running agents', async ({ page }) => {
		// Step 1: Verify dashboard loads
		await expect(page.locator('h1')).toContainText('Dashboard');
		await expect(page.locator('.dashboard-section')).toHaveCount(2);

		// Step 2: Create a team
		await page.click('button:has-text("New Team")');

		// Fill team creation form
		await page.fill('input[name="teamName"]', 'Test Frontend Team');
		await page.selectOption('select[name="teamType"]', 'frontend');
		await page.check('input[value="pm"]');
		await page.check('input[value="developer"]');
		await page.check('input[value="qa"]');
		await page.click('button:has-text("Create Team")');

		// Verify team created
		await expect(page.locator('.team-card')).toContainText('Test Frontend Team');

		// Step 3: Add a project
		const testProjectPath = '/tmp/test-e2e-project';
		await helper.createTestProject(testProjectPath);

		await page.click('button:has-text("New Project")');

		// Mock file picker (since we can't interact with native dialog)
		await page.evaluate((path) => {
			window.__mockSelectedPath = path;
		}, testProjectPath);

		await page.fill('input[name="projectPath"]', testProjectPath);
		await page.fill('input[name="projectName"]', 'Test E2E Project');
		await page.click('button:has-text("Add Project")');

		// Verify project created
		await expect(page.locator('.project-card')).toContainText('Test E2E Project');

		// Step 4: Navigate to project detail
		await page.click('.project-card:has-text("Test E2E Project")');

		// Verify project detail page
		await expect(page.locator('h1')).toContainText('Test E2E Project');
		await expect(page.locator('.project-path')).toContainText(testProjectPath);

		// Step 5: Assign team to project
		await page.click('button:has-text("Assign Team")');

		// Select team in modal
		await page.check('.team-select-item:has-text("Test Frontend Team")');
		await page.click('button:has-text("Assign Selected")');

		// Verify Start Project button appears
		await expect(page.locator('button:has-text("Start Project")')).toBeVisible();

		// Step 6: Start the project
		await page.click('button:has-text("Start Project")');

		// Wait for loading state
		await expect(page.locator('.loading-spinner')).toBeVisible();
		await expect(page.locator('.loading-spinner')).toBeHidden({ timeout: 15000 });

		// Verify orchestrator session created
		await helper.waitForTmuxSession('orchestrator');

		// Step 7: Verify orchestrator received briefing
		await page.waitForTimeout(7000); // Wait for Claude Code to start

		const orchOutput = await helper.getTmuxOutput('orchestrator');
		expect(orchOutput).toContain('project specification');
		expect(orchOutput).toContain('Frontend Team');

		// Step 8: Navigate to Assignments page
		await page.click('a:has-text("Assignments")');

		// Verify orchestrator terminal is visible
		await expect(page.locator('.orchestrator-terminal')).toBeVisible();
		await expect(page.locator('.terminal-viewer')).toContainText('orchestrator');

		// Step 9: Verify schedule was created
		const schedules = await page.locator('.scheduled-checks .schedule-item').count();
		expect(schedules).toBeGreaterThan(0);
	});
});
```

### Test 2: Team Creation and Management

```typescript
// e2e/team-management.spec.ts
test.describe('Team Management', () => {
	test('Create team and view member details', async ({ page }) => {
		await page.goto('/teams');

		// Create team
		await page.click('button:has-text("New Team")');
		await page.fill('input[name="teamName"]', 'Backend Team');
		await page.selectOption('select[name="teamType"]', 'backend');
		await page.check('input[value="pm"]');
		await page.check('input[value="developer"]');

		// Add custom system prompt for PM
		await page.click('button:has-text("Customize PM Prompt")');
		await page.fill(
			'textarea[name="pmPrompt"]',
			'You are a Backend PM focused on API design...'
		);

		await page.click('button:has-text("Create Team")');

		// Navigate to team detail
		await page.click('.team-card:has-text("Backend Team")');

		// Verify team members
		await expect(page.locator('.member-card')).toHaveCount(2);
		await expect(page.locator('.member-card:has-text("Project Manager")')).toBeVisible();
		await expect(page.locator('.member-card:has-text("Developer")')).toBeVisible();

		// Click on PM member
		await page.click('.member-card:has-text("Project Manager")');

		// Verify system instructions panel
		await expect(page.locator('.instructions-panel')).toBeVisible();
		await expect(page.locator('.instructions-panel textarea')).toContainText(
			'Backend PM focused on API design'
		);

		// Update system prompt
		await page.fill('.instructions-panel textarea', 'Updated PM instructions...');
		await page.click('button:has-text("Save Instructions")');

		// Verify save confirmation
		await expect(page.locator('.toast-success')).toContainText('Instructions saved');
	});
});
```

### Test 3: Project Editor and Specs

```typescript
// e2e/project-editor.spec.ts
test.describe('Project Editor', () => {
	test('Edit project specifications', async ({ page }) => {
		// Setup project
		const projectPath = '/tmp/test-editor-project';
		await helper.createTestProject(projectPath);

		// Navigate to project
		await page.goto('/');
		await page.click('button:has-text("New Project")');
		await page.fill('input[name="projectPath"]', projectPath);
		await page.click('button:has-text("Add Project")');
		await page.click('.project-card');

		// Verify Editor tab is active
		await expect(page.locator('.tabs .tab.active')).toContainText('Editor');

		// Verify file tree
		await expect(page.locator('.file-tree')).toBeVisible();
		await expect(page.locator('.file-tree-item:has-text("specs")')).toBeVisible();

		// Click on specs folder
		await page.click('.file-tree-item:has-text("specs")');

		// Select project-spec.md
		await page.click('.file-tree-item:has-text("project-spec.md")');

		// Verify markdown editor loads
		await expect(page.locator('.markdown-editor')).toBeVisible();
		await expect(page.locator('.markdown-editor textarea')).toContainText(
			'Test Project Specification'
		);

		// Edit the spec
		await page.fill(
			'.markdown-editor textarea',
			`
# Updated Project Specification

## New Objective
Updated test project for E2E testing

## Requirements
1. New Feature A
2. New Feature B
3. Performance improvements
    `
		);

		// Save changes
		await page.click('button:has-text("Save")');
		await expect(page.locator('.toast-success')).toContainText('File saved');

		// Verify file was actually saved
		const savedContent = await fs.readFile(
			`${projectPath}/.agentmux/specs/project-spec.md`,
			'utf-8'
		);
		expect(savedContent).toContain('Updated Project Specification');
	});
});
```

### Test 4: Task Management (Kanban Board)

```typescript
// e2e/task-management.spec.ts
test.describe('Task Management', () => {
	test('Create and manage tickets on kanban board', async ({ page }) => {
		// Navigate to project tasks
		await page.goto('/projects/test-project');
		await page.click('.tab:has-text("Tasks")');

		// Verify kanban columns
		await expect(page.locator('.kanban-column')).toHaveCount(4);
		await expect(page.locator('.kanban-column:has-text("Not Started")')).toBeVisible();

		// Create new ticket
		await page.click('button:has-text("New Ticket")');

		// Fill ticket form
		await page.fill('input[name="title"]', 'Implement user authentication');
		await page.fill('textarea[name="description"]', 'Add JWT-based auth system');
		await page.fill('input[name="acceptanceCriteria[0]"]', 'Login endpoint works');
		await page.click('button:has-text("Add Criteria")');
		await page.fill('input[name="acceptanceCriteria[1]"]', 'Tokens expire correctly');
		await page.selectOption('select[name="priority"]', 'high');
		await page.click('button:has-text("Create Ticket")');

		// Verify ticket appears in Not Started column
		await expect(
			page.locator('.kanban-column:has-text("Not Started") .ticket-card')
		).toContainText('Implement user authentication');

		// Drag ticket to In Progress
		const ticket = page.locator('.ticket-card:has-text("Implement user authentication")');
		const inProgressColumn = page.locator('.kanban-column:has-text("In Progress")');

		await ticket.dragTo(inProgressColumn);

		// Verify ticket moved
		await expect(
			page.locator('.kanban-column:has-text("In Progress") .ticket-card')
		).toContainText('Implement user authentication');

		// Click ticket to view details
		await ticket.click();

		// Verify ticket detail modal
		await expect(page.locator('.ticket-detail-modal')).toBeVisible();
		await expect(page.locator('.ticket-detail-modal')).toContainText('JWT-based auth system');

		// Assign to team member
		await page.selectOption('select[name="assignedTo"]', 'frontend-dev');
		await page.click('button:has-text("Save Changes")');

		// Verify assignment saved
		await expect(ticket).toContainText('frontend-dev');
	});
});
```

### Test 5: Terminal Interaction

```typescript
// e2e/terminal-interaction.spec.ts
test.describe('Terminal Interaction', () => {
	test('Send messages to orchestrator via terminal', async ({ page }) => {
		// Start a project first
		await helper.cleanupEnvironment();
		const projectPath = '/tmp/test-terminal-project';
		await helper.createTestProject(projectPath);

		// Quick setup: create team and project via API
		await fetch('http://localhost:3000/api/teams', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Terminal Test Team',
				type: 'frontend',
				members: [{ role: 'pm', sessionName: 'test-pm' }],
			}),
		});

		// Navigate to Assignments
		await page.goto('/assignments');

		// Start orchestrator manually for testing
		await execAsync('tmux new-session -d -s orchestrator -c /tmp');
		await helper.waitForTmuxSession('orchestrator');

		// Verify terminal is visible
		await expect(page.locator('.orchestrator-terminal')).toBeVisible();

		// Type message in terminal input
		await page.fill('.terminal-input input', 'Please check the status of all teams');
		await page.press('.terminal-input input', 'Enter');

		// Wait for message to appear
		await page.waitForTimeout(2000);

		// Verify message was sent
		const terminalContent = await page.locator('.terminal-viewer').textContent();
		expect(terminalContent).toContain('Please check the status of all teams');

		// Test terminal resize
		await page.click('button[aria-label="Expand terminal"]');
		await expect(page.locator('.orchestrator-terminal')).toHaveClass(/expanded/);

		// Test hide/show terminal
		await page.click('button[aria-label="Hide terminal"]');
		await expect(page.locator('.orchestrator-terminal')).not.toBeVisible();

		await page.click('button:has-text("Show Orchestrator")');
		await expect(page.locator('.orchestrator-terminal')).toBeVisible();
	});
});
```

### Test 6: Multi-Agent Coordination

```typescript
// e2e/multi-agent.spec.ts
test.describe('Multi-Agent Coordination', () => {
	test('Orchestrator creates team sessions', async ({ page }) => {
		// This test simulates the full orchestration flow
		const projectPath = '/tmp/test-multi-agent';
		await helper.createTestProject(projectPath);

		// Create and assign team
		await page.goto('/');

		// Quick create team
		await page.click('button:has-text("New Team")');
		await page.fill('input[name="teamName"]', 'Multi Agent Team');
		await page.check('input[value="pm"]');
		await page.check('input[value="developer"]');
		await page.click('button:has-text("Create Team")');

		// Quick create project
		await page.click('button:has-text("New Project")');
		await page.fill('input[name="projectPath"]', projectPath);
		await page.click('button:has-text("Add Project")');

		// Assign and start
		await page.click('.project-card');
		await page.click('button:has-text("Assign Team")');
		await page.check('.team-select-item');
		await page.click('button:has-text("Assign Selected")');
		await page.click('button:has-text("Start Project")');

		// Wait for orchestrator to create team sessions
		await page.waitForTimeout(10000);

		// Navigate to Teams page to see active sessions
		await page.goto('/teams');
		await page.click('.team-card:has-text("Multi Agent Team")');

		// Verify team members show as active
		await expect(
			page.locator('.member-card:has-text("Project Manager") .status-indicator')
		).toHaveClass(/active/);
		await expect(
			page.locator('.member-card:has-text("Developer") .status-indicator')
		).toHaveClass(/active/);

		// Click on PM to see terminal
		await page.click('.member-card:has-text("Project Manager")');

		// Verify PM terminal shows briefing from orchestrator
		await page.waitForTimeout(3000);
		const pmTerminal = await page.locator('.terminal-viewer').textContent();
		expect(pmTerminal).toContain('review the specification');

		// Verify tmux sessions were actually created
		const sessions = await execAsync('tmux list-sessions -F "#{session_name}"');
		expect(sessions.stdout).toContain('multi-agent-pm');
		expect(sessions.stdout).toContain('multi-agent-dev');
	});
});
```

### Test 7: Schedule Management

```typescript
// e2e/schedule-management.spec.ts
test.describe('Schedule Management', () => {
	test('View and manage scheduled check-ins', async ({ page }) => {
		// Start project with orchestrator
		await setupTestProject(page);

		// Navigate to Assignments
		await page.goto('/assignments');

		// Verify scheduled check-in exists
		await expect(page.locator('.scheduled-checks')).toBeVisible();
		await expect(page.locator('.schedule-item')).toHaveCount(1);

		// Verify check-in details
		const scheduleItem = page.locator('.schedule-item').first();
		await expect(scheduleItem).toContainText('orchestrator');
		await expect(scheduleItem).toContainText('15 minutes');

		// Add manual check-in
		await page.click('button:has-text("Schedule Check-in")');
		await page.selectOption('select[name="targetSession"]', 'frontend-pm');
		await page.fill('input[name="minutes"]', '30');
		await page.fill('textarea[name="message"]', 'Check ticket progress and report blockers');
		await page.click('button:has-text("Schedule")');

		// Verify new schedule added
		await expect(page.locator('.schedule-item')).toHaveCount(2);
		await expect(page.locator('.schedule-item:has-text("frontend-pm")')).toBeVisible();

		// Cancel a schedule
		await page.click('.schedule-item:has-text("frontend-pm") button[aria-label="Cancel"]');
		await page.click('button:has-text("Confirm Cancel")');

		// Verify schedule removed
		await expect(page.locator('.schedule-item')).toHaveCount(1);
	});
});
```

### Test 8: Error Handling and Recovery

```typescript
// e2e/error-handling.spec.ts
test.describe('Error Handling', () => {
	test('Handle tmux session crashes gracefully', async ({ page }) => {
		// Start a project
		await setupTestProject(page);

		// Kill orchestrator session to simulate crash
		await execAsync('tmux kill-session -t orchestrator');

		// Navigate to Assignments
		await page.goto('/assignments');

		// Verify error state shown
		await expect(page.locator('.error-banner')).toContainText(
			'Orchestrator session not running'
		);

		// Click restart button
		await page.click('button:has-text("Restart Orchestrator")');

		// Wait for restart
		await page.waitForTimeout(5000);

		// Verify session restored
		await expect(page.locator('.error-banner')).not.toBeVisible();
		await expect(page.locator('.orchestrator-terminal')).toBeVisible();

		const sessions = await execAsync('tmux list-sessions -F "#{session_name}"');
		expect(sessions.stdout).toContain('orchestrator');
	});

	test('Handle API errors gracefully', async ({ page }) => {
		// Try to create team with invalid data
		await page.goto('/teams');
		await page.click('button:has-text("New Team")');
		await page.fill('input[name="teamName"]', ''); // Empty name
		await page.click('button:has-text("Create Team")');

		// Verify validation error
		await expect(page.locator('.field-error')).toContainText('Team name is required');

		// Try to start project without teams
		await page.goto('/projects/unassigned-project');
		await page.click('button:has-text("Start Project")');

		// Verify error message
		await expect(page.locator('.toast-error')).toContainText('No teams assigned to project');
	});
});
```

## Test Helpers

```typescript
// e2e/utils/setup-helpers.ts
export async function setupTestProject(page: Page) {
	const helper = new AgentMuxTestHelper(page);
	const projectPath = '/tmp/test-setup-project';

	await helper.cleanupEnvironment();
	await helper.createTestProject(projectPath);

	// Quick API setup
	const teamRes = await fetch('http://localhost:3000/api/teams', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: 'Setup Test Team',
			type: 'frontend',
			members: [
				{ role: 'pm', sessionName: 'setup-pm' },
				{ role: 'developer', sessionName: 'setup-dev' },
			],
		}),
	});
	const team = await teamRes.json();

	const projectRes = await fetch('http://localhost:3000/api/projects', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: 'Setup Test Project',
			path: projectPath,
		}),
	});
	const project = await projectRes.json();

	await fetch(`http://localhost:3000/api/projects/${project.id}/teams`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			teamIds: [team.id],
			teamType: 'frontend',
		}),
	});

	await fetch(`http://localhost:3000/api/projects/${project.id}/start`, {
		method: 'POST',
	});

	await helper.waitForTmuxSession('orchestrator');

	return { projectPath, project, team };
}
```

## Running the Tests

```json
// package.json
{
	"scripts": {
		"test:e2e": "playwright test",
		"test:e2e:ui": "playwright test --ui",
		"test:e2e:debug": "playwright test --debug",
		"test:e2e:headed": "playwright test --headed",
		"test:e2e:report": "playwright show-report"
	}
}
```

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v3

            - uses: actions/setup-node@v3
              with:
                  node-version: '18'

            - name: Install dependencies
              run: npm ci

            - name: Install Playwright
              run: npx playwright install --with-deps

            - name: Install tmux
              run: sudo apt-get install -y tmux

            - name: Run E2E tests
              run: npm run test:e2e

            - uses: actions/upload-artifact@v3
              if: always()
              with:
                  name: playwright-report
                  path: playwright-report/
                  retention-days: 30
```
