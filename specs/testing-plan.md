# AgentMux Lightweight: Testing Plan

## 1. Testing Strategy Overview

### Goals

-   Ensure core user workflows work reliably
-   Catch critical bugs before release
-   Maintain confidence during refactoring
-   Keep testing overhead minimal and practical

### Principles

-   **Focus on critical paths**: Test what users actually do
-   **Practical over comprehensive**: Cover 80% of issues with 20% of effort
-   **Fast feedback**: Tests should run quickly and reliably
-   **Real environment**: Test against actual tmux, not mocks where possible

### Testing Pyramid (Simplified)

```
        E2E Tests (5%)
    ─────────────────────
   Integration Tests (25%)
  ─────────────────────────
 Unit Tests (70%)
```

## 2. Unit Tests (Jest)

### Backend Services

#### FileStorage Tests

```typescript
describe('FileStorage', () => {
	test('loads default data when file missing');
	test('saves and loads projects correctly');
	test('handles corrupted JSON gracefully');
	test('creates directory if missing');
	test('appends activity entries');
	test('rotates activity log when too large');
});
```

#### TmuxController Tests

```typescript
describe('TmuxController', () => {
	test('creates session with correct structure');
	test('lists active sessions');
	test('kills session cleanly');
	test('sends keys to specific pane');
	test('gets pane byte count');
	test('handles tmux not available');
	test('handles invalid session/pane IDs');
});
```

#### ActivityPoller Tests

```typescript
describe('ActivityPoller', () => {
	test('detects activity changes');
	test('aggregates pane activity to team status');
	test('handles polling errors gracefully');
	test('respects polling interval');
	test('cleans up on stop');
});
```

#### API Routes Tests

```typescript
describe('API Routes', () => {
	describe('Projects', () => {
		test('GET /api/projects returns all projects');
		test('POST /api/projects creates project');
		test('PATCH /api/projects/:id updates project');
		test('DELETE /api/projects/:id removes project');
		test('validates required fields');
		test('handles invalid project IDs');
	});

	describe('Teams', () => {
		test('creates team with roles');
		test('updates team status');
		test('prevents duplicate team names');
	});

	describe('Assignments', () => {
		test('creates assignment between project and team');
		test('prevents double assignment');
		test('ends assignment properly');
	});
});
```

### Frontend Components

#### Core Components Tests

```typescript
describe('ProjectCard', () => {
	test('displays project info correctly');
	test('shows correct status badge');
	test('handles assign button click');
	test('displays last activity time');
});

describe('AssignmentBoard', () => {
	test('renders grid correctly');
	test('handles drag and drop assignment');
	test('shows assignment conflicts');
	test('updates on assignment changes');
});

describe('SpecEditor', () => {
	test('loads file content');
	test('auto-saves changes');
	test('handles file save errors');
	test('syntax highlighting works');
});
```

#### Custom Hooks Tests

```typescript
describe('useProjects', () => {
	test('fetches projects on mount');
	test('creates new project');
	test('updates project status');
	test('handles API errors');
});

describe('usePolling', () => {
	test('polls at specified interval');
	test('stops polling on unmount');
	test('handles polling errors');
});
```

### Test Coverage Goals

-   **Critical paths**: 95% coverage
-   **API routes**: 90% coverage
-   **Core services**: 85% coverage
-   **UI components**: 70% coverage
-   **Overall**: 80% coverage

## 3. Integration Tests

### API Integration Tests

```typescript
describe('Full API Workflows', () => {
	beforeEach(() => {
		// Setup test database and tmux environment
	});

	test('complete project lifecycle', async () => {
		// Create project
		const project = await api.post('/projects', testProject);
		expect(project.status).toBe('unassigned');

		// Create team
		const team = await api.post('/teams', testTeam);
		expect(team.status).toBe('idle');

		// Create assignment
		const assignment = await api.post('/assignments', {
			projectId: project.id,
			teamId: team.id,
		});

		// Verify tmux session created
		const sessions = await tmux.listSessions();
		expect(sessions).toContainEqual(expect.objectContaining({ name: `team-${team.id}` }));

		// Verify status updates
		const updatedProject = await api.get(`/projects/${project.id}`);
		expect(updatedProject.status).toBe('active');
	});

	test('activity polling integration', async () => {
		// Setup active assignment
		// Simulate tmux activity
		// Verify activity detection
		// Check status aggregation
	});

	test('spec file operations', async () => {
		// Create project
		// Write spec file
		// Verify file on filesystem
		// Read spec file back
		// Test path jailing
	});
});
```

### tmux Integration Tests

```typescript
describe('tmux Integration', () => {
	let testSession: string;

	beforeEach(async () => {
		// Create isolated test tmux session
		testSession = await tmux.createSession('test-session');
	});

	afterEach(async () => {
		// Clean up test session
		await tmux.killSession(testSession);
	});

	test('session lifecycle management', async () => {
		// Test session creation, window management, cleanup
	});

	test('activity detection accuracy', async () => {
		// Send commands to pane
		// Verify byte count changes
		// Test idle detection
	});
});
```

### File System Integration Tests

```typescript
describe('File System Operations', () => {
	test('project directory handling', async () => {
		// Test project creation with various paths
		// Verify directory permissions
		// Test path validation
	});

	test('spec file security', async () => {
		// Test path traversal prevention
		// Verify file permissions
		// Test symlink handling
	});
});
```

## 4. End-to-End Tests (Playwright)

### Setup

```typescript
// playwright.config.ts
export default {
	testDir: './e2e',
	timeout: 30000,
	use: {
		baseURL: 'http://localhost:3000',
		headless: true,
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
	],
};
```

### Core User Journeys

#### Happy Path Test

```typescript
test('complete user workflow', async ({ page }) => {
	// Start AgentMux
	await page.goto('/');

	// Create project
	await page.click('[data-testid="new-project"]');
	await page.fill('[data-testid="project-name"]', 'Test Project');
	await page.fill('[data-testid="project-path"]', '/tmp/test-project');
	await page.click('[data-testid="create-project"]');

	// Verify project appears
	await expect(page.locator('[data-testid="project-card"]')).toContainText('Test Project');

	// Create team
	await page.click('[data-testid="teams-tab"]');
	await page.click('[data-testid="new-team"]');
	await page.fill('[data-testid="team-name"]', 'Test Team');
	await page.click('[data-testid="create-team"]');

	// Assign team to project
	await page.click('[data-testid="assignment-board-tab"]');
	await page.dragAndDrop(
		'[data-testid="team-Test Team"]',
		'[data-testid="project-Test Project"]'
	);

	// Verify assignment
	await expect(page.locator('[data-testid="assignment-active"]')).toBeVisible();

	// Check activity monitoring
	await page.waitForTimeout(35000); // Wait for polling cycle
	await expect(page.locator('[data-testid="status-indicator"]')).toHaveClass(/active|idle/);
});
```

#### Spec Editor Test

```typescript
test('spec file editing', async ({ page }) => {
	// Setup project
	await createTestProject(page);

	// Open spec editor
	await page.click('[data-testid="edit-specs"]');

	// Edit CLAUDE.md
	await page.click('[data-testid="file-CLAUDE.md"]');
	await page.fill('[data-testid="editor"]', '# Test Spec\n\nThis is a test.');

	// Verify auto-save
	await page.waitForSelector('[data-testid="saved-indicator"]');

	// Verify file on filesystem
	const content = await fs.readFile('/tmp/test-project/CLAUDE.md', 'utf8');
	expect(content).toContain('This is a test.');
});
```

#### Error Handling Test

```typescript
test('handles tmux unavailable', async ({ page }) => {
	// Mock tmux unavailable
	await mockTmuxUnavailable();

	await page.goto('/');

	// Should show error message
	await expect(page.locator('[data-testid="error-banner"]')).toContainText('tmux is required');

	// Should provide installation instructions
	await expect(page.locator('[data-testid="install-help"]')).toBeVisible();
});
```

### Browser Compatibility Tests

```typescript
test.describe('Cross-browser compatibility', () => {
	['chromium', 'firefox'].forEach((browserName) => {
		test(`works in ${browserName}`, async ({ page }) => {
			// Run core workflow in each browser
		});
	});
});
```

## 5. Performance Tests

### Load Testing

```typescript
describe('Performance', () => {
	test('handles multiple projects and teams', async () => {
		// Create 20 projects, 10 teams
		// Measure response times
		// Verify UI remains responsive
	});

	test('polling performance', async () => {
		// Setup 50 tmux panes
		// Run activity polling
		// Measure CPU and memory usage
		// Ensure < 5% CPU, < 100MB RAM
	});

	test('UI responsiveness', async () => {
		// Measure interaction latencies
		// Ensure < 100ms for common actions
	});
});
```

### Memory Leak Tests

```typescript
test('no memory leaks', async () => {
	// Run for extended period
	// Monitor memory usage
	// Ensure stable memory consumption
});
```

## 6. Security Tests

### Path Traversal Tests

```typescript
describe('Security', () => {
	test('prevents path traversal in spec files', async () => {
		const maliciousPath = '../../../etc/passwd';
		const response = await api.put(`/api/specs/project-id/${maliciousPath}`, {
			content: 'malicious',
		});
		expect(response.status).toBe(400);
	});

	test('validates tmux command injection', async () => {
		const maliciousInput = 'test; rm -rf /';
		// Verify command is properly escaped
	});
});
```

### Input Validation Tests

```typescript
test('validates all user inputs', async () => {
	// Test XSS prevention
	// Test SQL injection (though we use JSON)
	// Test command injection
	// Test file path validation
});
```

## 7. Cross-Platform Tests

### Operating System Matrix

```yaml
# GitHub Actions matrix
strategy:
    matrix:
        os: [macos-latest, ubuntu-latest]
        node: [18, 20]
        tmux: ['3.2', '3.3', '3.4']
```

### Platform-Specific Tests

```typescript
describe('Platform compatibility', () => {
	test('works on macOS', async () => {
		// Test macOS-specific paths and behaviors
	});

	test('works on Linux', async () => {
		// Test Linux-specific paths and behaviors
	});

	test('handles different tmux versions', async () => {
		// Test tmux version compatibility
	});
});
```

## 8. Test Data Management

### Test Fixtures

```typescript
// test/fixtures/projects.ts
export const testProjects = [
	{
		id: 'project-1',
		name: 'Test Project 1',
		fsPath: '/tmp/test-project-1',
		status: 'unassigned',
	},
	// ... more test data
];

// test/fixtures/teams.ts
export const testTeams = [
	{
		id: 'team-1',
		name: 'Test Team 1',
		roles: [
			{ name: 'orchestrator', count: 1 },
			{ name: 'dev', count: 1 },
		],
	},
	// ... more test data
];
```

### Test Database Setup

```typescript
// test/setup.ts
beforeEach(async () => {
	// Clean test data directory
	await fs.rm('/tmp/agentmux-test', { recursive: true, force: true });
	await fs.mkdir('/tmp/agentmux-test', { recursive: true });

	// Setup test data files
	await storage.saveData({
		projects: [],
		teams: [],
		assignments: [],
		settings: defaultSettings,
	});
});
```

## 9. Test Automation & CI

### GitHub Actions Workflow

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
    test:
        runs-on: ${{ matrix.os }}
        strategy:
            matrix:
                os: [macos-latest, ubuntu-latest]
                node: [18, 20]

        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: ${{ matrix.node }}

            - name: Install tmux
              run: |
                  if [[ "$RUNNER_OS" == "macOS" ]]; then
                    brew install tmux
                  else
                    sudo apt-get install tmux
                  fi

            - name: Install dependencies
              run: npm ci

            - name: Run unit tests
              run: npm run test:unit

            - name: Run integration tests
              run: npm run test:integration

            - name: Run E2E tests
              run: npm run test:e2e

            - name: Upload coverage
              uses: codecov/codecov-action@v3
```

### Test Scripts

```json
{
	"scripts": {
		"test": "npm run test:unit && npm run test:integration",
		"test:unit": "jest --testPathPattern=unit",
		"test:integration": "jest --testPathPattern=integration",
		"test:e2e": "playwright test",
		"test:watch": "jest --watch",
		"test:coverage": "jest --coverage",
		"test:ci": "jest --ci --coverage --watchAll=false"
	}
}
```

## 10. Manual Testing Checklist

### Pre-Release Checklist

-   [ ] Fresh install via `npx agentmux` works
-   [ ] All core user workflows complete successfully
-   [ ] Error messages are helpful and actionable
-   [ ] Performance is acceptable on target hardware
-   [ ] Works with minimum supported versions (Node 18, tmux 3.2)
-   [ ] No console errors in browser
-   [ ] Graceful shutdown preserves data
-   [ ] Activity monitoring is accurate

### Exploratory Testing Areas

-   [ ] Edge cases in project/team naming
-   [ ] Large numbers of projects/teams
-   [ ] Network interruptions during polling
-   [ ] Filesystem permission issues
-   [ ] tmux session conflicts
-   [ ] Browser refresh/back button behavior
-   [ ] Concurrent usage scenarios

## 11. Test Maintenance

### Test Review Process

-   Review tests with each feature addition
-   Remove obsolete tests promptly
-   Keep test data fresh and realistic
-   Monitor test execution time
-   Fix flaky tests immediately

### Test Metrics to Track

-   Test execution time
-   Test flakiness rate
-   Code coverage trends
-   Bug escape rate (bugs found in production)
-   Time to fix failing tests

## 12. Testing Tools & Dependencies

```json
{
	"devDependencies": {
		"jest": "^29.0.0",
		"@testing-library/react": "^13.0.0",
		"@testing-library/jest-dom": "^5.0.0",
		"@playwright/test": "^1.40.0",
		"supertest": "^6.0.0",
		"msw": "^1.0.0",
		"tmp": "^0.2.0"
	}
}
```

This testing plan provides comprehensive coverage while remaining practical and maintainable for a lightweight implementation. It focuses on the critical paths users will actually follow while ensuring the system is robust and reliable.
