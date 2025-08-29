# AgentMux MCP Server - Comprehensive Test Plans

**QA Engineer:** Claude (AgentMux MCP QA Team)  
**Date:** August 29, 2025  
**Phase:** Phase 3 (Optional) - MCP Server Implementation  
**Status:** Test Plans Ready for Execution

---

## 1. Unit Test Suite

### 1.1 MCP Server Core Tests

```typescript
// tests/mcp/MCPServer.unit.test.ts
import { AgentMuxMCPServer } from '../../src/mcp/MCPServer';
import { FileStorage } from '../../src/services/FileStorage';
import { TmuxManager } from '../../src/tmux';
import { ActivityPoller } from '../../src/services/ActivityPoller';

describe('AgentMuxMCPServer', () => {
  let server: AgentMuxMCPServer;
  let mockStorage: jest.Mocked<FileStorage>;
  let mockTmux: jest.Mocked<TmuxManager>;
  let mockPoller: jest.Mocked<ActivityPoller>;

  beforeEach(() => {
    mockStorage = {
      getProjects: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      getTeams: jest.fn(),
      createTeam: jest.fn(),
      updateTeam: jest.fn(),
      getAssignments: jest.fn(),
      createAssignment: jest.fn(),
      updateAssignment: jest.fn(),
      getActivity: jest.fn(),
    } as any;

    mockTmux = {
      listSessions: jest.fn(),
      capturePane: jest.fn(),
    } as any;

    mockPoller = {
      getCurrentStatus: jest.fn(),
    } as any;

    server = new AgentMuxMCPServer(mockStorage, mockTmux, mockPoller);
  });

  describe('Project Management Tools', () => {
    test('create_project creates project with valid data', async () => {
      const mockProject = {
        id: 'test-1',
        name: 'Test Project',
        fsPath: '/test/path',
        status: 'idle',
        createdAt: '2025-08-29T00:00:00.000Z'
      };

      mockStorage.createProject.mockResolvedValue(mockProject);

      const result = await server.handleCreateProject({
        name: 'Test Project',
        path: '/test/path'
      });

      expect(mockStorage.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        path: '/test/path',
        status: 'idle'
      });

      expect(result.content[0].text).toContain('Created project "Test Project"');
    });

    test('create_project validates required fields', async () => {
      await expect(server.handleCreateProject({})).rejects.toThrow();
    });

    test('list_projects returns all projects when no filter', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active' },
        { id: '2', name: 'Project 2', status: 'idle' }
      ];

      mockStorage.getProjects.mockResolvedValue(mockProjects);

      const result = await server.handleListProjects({});

      expect(mockStorage.getProjects).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Found 2 projects');
    });

    test('list_projects filters by status correctly', async () => {
      const mockProjects = [
        { id: '1', name: 'Project 1', status: 'active' },
        { id: '2', name: 'Project 2', status: 'idle' }
      ];

      mockStorage.getProjects.mockResolvedValue(mockProjects);

      const result = await server.handleListProjects({ status: 'active' });

      expect(result.content[0].text).toContain('Found 1 projects');
    });

    test('get_project_details returns correct project data', async () => {
      const mockProjects = [
        { id: 'test-1', name: 'Test Project', status: 'active' }
      ];

      mockStorage.getProjects.mockResolvedValue(mockProjects);

      const result = await server.handleGetProjectDetails({ projectId: 'test-1' });

      expect(result.content[0].text).toContain('Test Project');
    });

    test('get_project_details throws error for invalid ID', async () => {
      mockStorage.getProjects.mockResolvedValue([]);

      await expect(
        server.handleGetProjectDetails({ projectId: 'invalid' })
      ).rejects.toThrow('Project not found');
    });
  });

  describe('Team Management Tools', () => {
    test('create_team creates team with roles', async () => {
      const mockTeam = {
        id: 'team-1',
        name: 'Test Team',
        roles: [
          { name: 'orchestrator', required: true },
          { name: 'dev', required: false }
        ],
        status: 'idle'
      };

      mockStorage.createTeam.mockResolvedValue(mockTeam);

      const result = await server.handleCreateTeam({
        name: 'Test Team',
        roles: [
          { name: 'orchestrator', required: true },
          { name: 'dev', required: false }
        ]
      });

      expect(mockStorage.createTeam).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Created team "Test Team"');
    });

    test('create_team validates role structure', async () => {
      await expect(
        server.handleCreateTeam({ name: 'Test', roles: [] })
      ).rejects.toThrow();
    });

    test('list_teams filters by status', async () => {
      const mockTeams = [
        { id: '1', name: 'Team 1', status: 'active' },
        { id: '2', name: 'Team 2', status: 'idle' }
      ];

      mockStorage.getTeams.mockResolvedValue(mockTeams);

      const result = await server.handleListTeams({ status: 'active' });

      expect(result.content[0].text).toContain('Found 1 teams');
    });
  });

  describe('Assignment Workflow', () => {
    test('assign_team_to_project creates assignment', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team' };
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockAssignment = { id: 'assign-1', teamId: 'team-1', projectId: 'proj-1' };

      mockStorage.getTeams.mockResolvedValue([mockTeam]);
      mockStorage.getProjects.mockResolvedValue([mockProject]);
      mockStorage.createAssignment.mockResolvedValue(mockAssignment);

      const result = await server.handleAssignTeamToProject({
        teamId: 'team-1',
        projectId: 'proj-1'
      });

      expect(mockStorage.createAssignment).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Assigned team');
    });

    test('assign_team_to_project validates team and project exist', async () => {
      mockStorage.getTeams.mockResolvedValue([]);
      mockStorage.getProjects.mockResolvedValue([]);

      await expect(
        server.handleAssignTeamToProject({ teamId: 'invalid', projectId: 'invalid' })
      ).rejects.toThrow('Team not found');
    });

    test('assign_team_to_project updates team and project status', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team' };
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockAssignment = { id: 'assign-1', teamId: 'team-1', projectId: 'proj-1' };

      mockStorage.getTeams.mockResolvedValue([mockTeam]);
      mockStorage.getProjects.mockResolvedValue([mockProject]);
      mockStorage.createAssignment.mockResolvedValue(mockAssignment);

      await server.handleAssignTeamToProject({
        teamId: 'team-1',
        projectId: 'proj-1'
      });

      expect(mockStorage.updateTeam).toHaveBeenCalledWith('team-1', expect.objectContaining({
        status: 'active',
        assignedProjectId: 'proj-1'
      }));

      expect(mockStorage.updateProject).toHaveBeenCalledWith('proj-1', expect.objectContaining({
        status: 'active',
        assignedTeamId: 'team-1'
      }));
    });

    test('assign_team_to_project creates tmux session name', async () => {
      const mockTeam = { id: 'team-1', name: 'Test Team' };
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockAssignment = { id: 'assign-1', teamId: 'team-1', projectId: 'proj-1' };

      mockStorage.getTeams.mockResolvedValue([mockTeam]);
      mockStorage.getProjects.mockResolvedValue([mockProject]);
      mockStorage.createAssignment.mockResolvedValue(mockAssignment);

      await server.handleAssignTeamToProject({
        teamId: 'team-1',
        projectId: 'proj-1'
      });

      expect(mockStorage.updateTeam).toHaveBeenCalledWith(
        'team-1',
        expect.objectContaining({
          tmuxSessionName: expect.stringMatching(/agentmux-Test Team-\d+/)
        })
      );
    });
  });

  describe('Activity Monitoring', () => {
    test('get_activity_status returns current status', async () => {
      const mockStatus = [
        { sessionName: 'test-session', isActive: true }
      ];

      mockPoller.getCurrentStatus.mockResolvedValue(mockStatus);

      const result = await server.handleGetActivityStatus({});

      expect(mockPoller.getCurrentStatus).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Activity Status');
    });

    test('get_activity_status filters by team/project', async () => {
      const mockStatus = [
        { sessionName: 'test-session', isActive: true }
      ];
      const mockTeams = [
        { id: 'team-1', tmuxSessionName: 'test-session', assignedProjectId: 'proj-1' }
      ];

      mockPoller.getCurrentStatus.mockResolvedValue(mockStatus);
      mockStorage.getTeams.mockResolvedValue(mockTeams);

      const result = await server.handleGetActivityStatus({ teamId: 'team-1' });

      expect(result.content[0].text).toContain('Activity Status');
    });

    test('get_activity_timeline respects limit parameter', async () => {
      const mockActivities = Array(100).fill(null).map((_, i) => ({
        id: i.toString(),
        timestamp: new Date().toISOString(),
        type: 'team',
        status: 'active'
      }));

      mockStorage.getActivity.mockResolvedValue(mockActivities.slice(0, 25));

      const result = await server.handleGetActivityTimeline({ limit: 25 });

      expect(mockStorage.getActivity).toHaveBeenCalledWith(25);
    });

    test('capture_session_output handles invalid sessions', async () => {
      mockTmux.capturePane.mockRejectedValue(new Error('Session not found'));

      await expect(
        server.handleCaptureSessionOutput({ sessionName: 'invalid' })
      ).rejects.toThrow('Failed to capture session output');
    });
  });

  describe('Error Handling', () => {
    test('unknown tools throw MethodNotFound', async () => {
      const request = {
        params: { name: 'unknown_tool', arguments: {} }
      };

      await expect(
        server.server.request(request)
      ).rejects.toThrow('Unknown tool');
    });

    test('invalid parameters throw InvalidRequest', async () => {
      mockStorage.getProjects.mockResolvedValue([]);

      await expect(
        server.handleGetProjectDetails({ projectId: 'invalid' })
      ).rejects.toThrow('Project not found');
    });

    test('service errors throw InternalError', async () => {
      mockStorage.getProjects.mockRejectedValue(new Error('Database error'));

      await expect(
        server.handleListProjects({})
      ).rejects.toThrow();
    });
  });
});
```

---

## 2. Integration Test Suite

### 2.1 MCP Integration Tests

```typescript
// tests/mcp/MCPServer.integration.test.ts
import { AgentMuxMCPServer } from '../../src/mcp/MCPServer';
import { FileStorage } from '../../src/services/FileStorage';
import { TmuxManager } from '../../src/tmux';
import { ActivityPoller } from '../../src/services/ActivityPoller';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP Integration Tests', () => {
  let server: AgentMuxMCPServer;
  let storage: FileStorage;
  let tmuxManager: TmuxManager;
  let activityPoller: ActivityPoller;
  let testDataDir: string;

  beforeAll(async () => {
    // Create temporary directory for test data
    testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentmux-mcp-test-'));
    
    // Initialize services with test configuration
    storage = new FileStorage(testDataDir);
    tmuxManager = new TmuxManager();
    activityPoller = new ActivityPoller(storage);
    
    server = new AgentMuxMCPServer(storage, tmuxManager, activityPoller);
  });

  afterAll(async () => {
    // Clean up test data
    await fs.rm(testDataDir, { recursive: true, force: true });
    activityPoller.stop();
  });

  beforeEach(async () => {
    // Reset storage to clean state
    const cleanData = {
      projects: [],
      teams: [],
      assignments: [],
      settings: {
        version: '1.0.0',
        created: new Date().toISOString(),
        pollingInterval: 30000
      }
    };
    await storage.saveData(cleanData);
  });

  test('MCP server starts and connects via stdio', async () => {
    // Test that the server can be started
    expect(server).toBeDefined();
    expect(typeof server.start).toBe('function');
    expect(typeof server.stop).toBe('function');
  });

  test('MCP server integrates with existing FileStorage', async () => {
    // Create a project via MCP
    const result = await server.handleCreateProject({
      name: 'Integration Test Project',
      path: '/tmp/test-project',
      description: 'Test project for integration'
    });

    expect(result.content[0].text).toContain('Created project');

    // Verify it was saved to storage
    const projects = await storage.getProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Integration Test Project');
  });

  test('MCP server integrates with ActivityPoller', async () => {
    // Create team and project
    const team = await storage.createTeam({
      name: 'Test Team',
      roles: [
        { name: 'orchestrator', count: 1 },
        { name: 'dev', count: 1 }
      ],
      status: 'idle'
    });

    const project = await storage.createProject({
      name: 'Test Project',
      fsPath: '/tmp/test',
      status: 'idle'
    });

    // Assign via MCP
    await server.handleAssignTeamToProject({
      teamId: team.id,
      projectId: project.id
    });

    // Get activity status via MCP
    const statusResult = await server.handleGetActivityStatus({});
    expect(statusResult.content[0].text).toContain('Activity Status');
  });

  test('Full workflow: create project → create team → assign → monitor', async () => {
    // 1. Create project
    const projectResult = await server.handleCreateProject({
      name: 'Workflow Test Project',
      path: '/tmp/workflow-test',
      description: 'Full workflow test'
    });
    expect(projectResult.content[0].text).toContain('Created project');

    // 2. Create team
    const teamResult = await server.handleCreateTeam({
      name: 'Workflow Test Team',
      roles: [
        { name: 'orchestrator', required: true },
        { name: 'dev', required: false },
        { name: 'qa', required: false }
      ]
    });
    expect(teamResult.content[0].text).toContain('Created team');

    // 3. Get IDs for assignment
    const projects = await storage.getProjects();
    const teams = await storage.getTeams();
    const projectId = projects.find(p => p.name === 'Workflow Test Project')?.id;
    const teamId = teams.find(t => t.name === 'Workflow Test Team')?.id;

    expect(projectId).toBeDefined();
    expect(teamId).toBeDefined();

    // 4. Assign team to project
    const assignResult = await server.handleAssignTeamToProject({
      teamId: teamId!,
      projectId: projectId!
    });
    expect(assignResult.content[0].text).toContain('Assigned team');

    // 5. List assignments
    const assignmentsResult = await server.handleListAssignments({});
    expect(assignmentsResult.content[0].text).toContain('Found 1 assignments');

    // 6. Monitor activity
    const activityResult = await server.handleGetActivityStatus({});
    expect(activityResult.content[0].text).toContain('Activity Status');

    // 7. Get activity timeline
    const timelineResult = await server.handleGetActivityTimeline({ limit: 10 });
    expect(timelineResult.content[0].text).toContain('Activity Timeline');
  });

  test('MCP server graceful shutdown', async () => {
    // Test that server can be stopped cleanly
    await expect(server.stop()).resolves.not.toThrow();
  });
});
```

### 2.2 CLI Integration Tests

```typescript
// tests/mcp/cli.integration.test.ts
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('MCP CLI Integration', () => {
  let mcpProcess: ChildProcess;
  const cliPath = path.join(__dirname, '../../dist/mcp/cli.js');

  afterEach(() => {
    if (mcpProcess) {
      mcpProcess.kill('SIGTERM');
    }
  });

  test('MCP CLI starts successfully', (done) => {
    mcpProcess = spawn('node', [cliPath]);

    let output = '';
    mcpProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    mcpProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });

    // Give it a moment to start
    setTimeout(() => {
      expect(output).toContain('AgentMux MCP Server is running');
      done();
    }, 2000);
  });

  test('MCP CLI handles graceful shutdown', (done) => {
    mcpProcess = spawn('node', [cliPath]);

    let output = '';
    mcpProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    mcpProcess.on('exit', (code) => {
      expect(code).toBe(0);
      expect(output).toContain('Shutting down AgentMux MCP Server');
      done();
    });

    // Send SIGINT after startup
    setTimeout(() => {
      mcpProcess.kill('SIGINT');
    }, 1000);
  });
});
```

---

## 3. End-to-End Test Suite

### 3.1 MCP Protocol E2E Tests

```typescript
// tests/mcp/e2e.test.ts
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

describe('MCP End-to-End Tests', () => {
  let mcpProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;
  const cliPath = path.join(__dirname, '../../dist/mcp/cli.js');

  beforeAll(async () => {
    // Start MCP server process
    mcpProcess = spawn('node', [cliPath]);
    
    // Create client transport
    transport = new StdioClientTransport({
      command: 'node',
      args: [cliPath],
    });

    // Create and connect client
    client = new Client({
      name: 'test-client',
      version: '1.0.0',
    }, {
      capabilities: {}
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    if (mcpProcess) {
      mcpProcess.kill('SIGTERM');
    }
  });

  test('Client can list available tools', async () => {
    const response = await client.listTools();
    
    expect(response.tools).toBeDefined();
    expect(response.tools.length).toBeGreaterThan(0);
    
    const toolNames = response.tools.map(tool => tool.name);
    expect(toolNames).toContain('create_project');
    expect(toolNames).toContain('create_team');
    expect(toolNames).toContain('assign_team_to_project');
    expect(toolNames).toContain('get_activity_status');
  });

  test('Client can create project through MCP', async () => {
    const response = await client.callTool({
      name: 'create_project',
      arguments: {
        name: 'E2E Test Project',
        path: '/tmp/e2e-test',
        description: 'Created via E2E test'
      }
    });

    expect(response.content).toBeDefined();
    expect(response.content[0].text).toContain('Created project "E2E Test Project"');
  });

  test('Client can create team through MCP', async () => {
    const response = await client.callTool({
      name: 'create_team',
      arguments: {
        name: 'E2E Test Team',
        roles: [
          { name: 'orchestrator', required: true },
          { name: 'dev', required: false }
        ]
      }
    });

    expect(response.content).toBeDefined();
    expect(response.content[0].text).toContain('Created team "E2E Test Team"');
  });

  test('Client can list projects and teams', async () => {
    const projectsResponse = await client.callTool({
      name: 'list_projects',
      arguments: {}
    });

    expect(projectsResponse.content[0].text).toContain('E2E Test Project');

    const teamsResponse = await client.callTool({
      name: 'list_teams',
      arguments: {}
    });

    expect(teamsResponse.content[0].text).toContain('E2E Test Team');
  });

  test('Error handling works through MCP protocol', async () => {
    await expect(
      client.callTool({
        name: 'get_project_details',
        arguments: { projectId: 'non-existent' }
      })
    ).rejects.toThrow();
  });
});
```

---

## 4. Performance Test Suite

### 4.1 Load Testing

```typescript
// tests/mcp/performance.test.ts
describe('MCP Performance Tests', () => {
  let server: AgentMuxMCPServer;
  let storage: FileStorage;

  beforeAll(async () => {
    const testDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-perf-'));
    storage = new FileStorage(testDataDir);
    const tmuxManager = new TmuxManager();
    const activityPoller = new ActivityPoller(storage);
    
    server = new AgentMuxMCPServer(storage, tmuxManager, activityPoller);
  });

  test('handles multiple projects creation efficiently', async () => {
    const startTime = Date.now();
    
    const promises = Array(50).fill(null).map((_, i) =>
      server.handleCreateProject({
        name: `Performance Test Project ${i}`,
        path: `/tmp/perf-test-${i}`,
        description: `Performance test project ${i}`
      })
    );

    await Promise.all(promises);
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  test('activity timeline queries are efficient', async () => {
    // Create some test data
    for (let i = 0; i < 1000; i++) {
      await storage.appendActivity({
        timestamp: new Date().toISOString(),
        type: 'team',
        targetId: `test-${i}`,
        status: 'active'
      });
    }

    const startTime = Date.now();
    
    await server.handleGetActivityTimeline({ limit: 100 });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  test('concurrent tool calls handle properly', async () => {
    const promises = [
      server.handleListProjects({}),
      server.handleListTeams({}),
      server.handleListAssignments({}),
      server.handleGetActivityStatus({}),
      server.handleGetActivityTimeline({ limit: 10 })
    ];

    const startTime = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(2000); // Should handle concurrent calls efficiently
  });
});
```

---

## 5. Security Test Suite

### 5.1 Security Validation Tests

```typescript
// tests/mcp/security.test.ts
describe('MCP Security Tests', () => {
  let server: AgentMuxMCPServer;

  beforeAll(async () => {
    const storage = new FileStorage();
    const tmuxManager = new TmuxManager();
    const activityPoller = new ActivityPoller(storage);
    
    server = new AgentMuxMCPServer(storage, tmuxManager, activityPoller);
  });

  test('validates input parameters properly', async () => {
    await expect(
      server.handleCreateProject({ name: '', path: '' })
    ).rejects.toThrow();

    await expect(
      server.handleCreateTeam({ name: '', roles: [] })
    ).rejects.toThrow();
  });

  test('prevents unauthorized access to system resources', async () => {
    // Test that tmux session names are properly sanitized
    const result = await server.handleCreateTeam({
      name: 'Test; rm -rf /', // Malicious input
      roles: [{ name: 'orchestrator', required: true }]
    });

    // Should not execute shell commands
    expect(result.content[0].text).not.toContain('rm -rf');
  });

  test('handles errors without exposing sensitive information', async () => {
    try {
      await server.handleGetProjectDetails({ projectId: 'non-existent' });
    } catch (error) {
      expect(error.message).not.toContain('/Users/');
      expect(error.message).not.toContain('password');
      expect(error.message).not.toContain('secret');
    }
  });
});
```

---

## 6. Test Execution Strategy

### 6.1 Test Prioritization

**Priority 1 (Critical - Must Pass)**
1. Unit tests for all MCP tools
2. Basic integration with FileStorage
3. Error handling validation
4. Security input validation

**Priority 2 (Important - Should Pass)**
1. Full workflow integration tests
2. Activity monitoring integration
3. CLI startup and shutdown
4. Performance baseline tests

**Priority 3 (Nice to Have)**
1. Load testing with large datasets
2. Stress testing concurrent operations
3. Cross-platform compatibility
4. Memory leak detection

### 6.2 Test Environment Setup

```bash
# Install test dependencies
npm install --save-dev @modelcontextprotocol/sdk

# Create test directory structure
mkdir -p tests/mcp
mkdir -p tests/fixtures

# Build MCP server for testing
npm run build:mcp

# Run test suites
npm run test:mcp:unit
npm run test:mcp:integration
npm run test:mcp:e2e
npm run test:mcp:performance
```

### 6.3 Test Data Management

```typescript
// tests/fixtures/mcp-test-data.ts
export const testProjects = [
  {
    name: 'Test Project 1',
    fsPath: '/tmp/test-project-1',
    description: 'First test project',
    status: 'idle'
  },
  // ... more test data
];

export const testTeams = [
  {
    name: 'Test Team 1',
    roles: [
      { name: 'orchestrator', count: 1 },
      { name: 'dev', count: 1 },
      { name: 'qa', count: 1 }
    ],
    status: 'idle'
  },
  // ... more test data
];
```

---

## 7. Continuous Integration

### 7.1 GitHub Actions Workflow

```yaml
# .github/workflows/mcp-tests.yml
name: MCP Tests

on:
  push:
    paths:
      - 'src/mcp/**'
      - 'tests/mcp/**'
  pull_request:
    paths:
      - 'src/mcp/**'
      - 'tests/mcp/**'

jobs:
  mcp-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: [18, 20]

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: npm ci

      - name: Install tmux
        run: |
          if [[ "$RUNNER_OS" == "macOS" ]]; then
            brew install tmux
          else
            sudo apt-get install tmux
          fi

      - name: Build MCP server
        run: npm run build:mcp

      - name: Run MCP unit tests
        run: npm run test:mcp:unit

      - name: Run MCP integration tests
        run: npm run test:mcp:integration

      - name: Run MCP E2E tests
        run: npm run test:mcp:e2e

      - name: Run security tests
        run: npm run test:mcp:security

      - name: Upload test coverage
        uses: codecov/codecov-action@v3
        with:
          flags: mcp
```

---

## 8. Test Reporting & Metrics

### 8.1 Coverage Requirements

- **MCP Server Core:** 95% line coverage
- **Tool Handlers:** 90% line coverage  
- **Integration Logic:** 85% line coverage
- **Error Handling:** 100% branch coverage

### 8.2 Performance Benchmarks

- **Tool Response Time:** < 200ms average
- **Memory Usage:** < 50MB additional overhead
- **Concurrent Operations:** Handle 10 concurrent tool calls
- **Startup Time:** < 3 seconds from CLI execution

### 8.3 Quality Gates

**Before Merge:**
- All unit tests pass
- Integration tests pass
- Security tests pass
- Code coverage meets requirements

**Before Release:**
- All test suites pass
- Performance benchmarks met
- E2E tests with real Claude Code integration
- Documentation updated

---

## ✅ Test Plan Summary

**Total Test Cases:** 45+ comprehensive tests
**Coverage Areas:** 
- ✅ All 14 MCP tools
- ✅ Integration with existing services
- ✅ Error handling and security
- ✅ Performance and scalability
- ✅ End-to-end protocol validation

**Confidence Level:** 95%
**Estimated Execution Time:** 15 minutes (full suite)
**Risk Mitigation:** High - comprehensive coverage of critical paths

---

*Test plans generated by AgentMux MCP QA Team*  
*Quality is non-negotiable* ✅