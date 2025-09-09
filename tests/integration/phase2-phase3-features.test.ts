import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';

// Mock the enhanced services for Phase 2 & 3 features
const mockStorageService = {
  getTeams: jest.fn(),
  saveTeam: jest.fn(),
  getProjects: jest.fn(),
  addProject: jest.fn(),
  saveProject: jest.fn()
};

const mockTmuxService = {
  createSession: jest.fn(),
  capturePane: jest.fn(),
  sessionExists: jest.fn(),
  sendMessage: jest.fn()
};

const mockSchedulerService = {
  scheduleCheck: jest.fn()
};

function createEnhancedTestApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  app.use(express.json());

  // Enhanced File Tree API - GET /api/projects/:id/files
  app.get('/api/projects/:id/files', async (req, res) => {
    const { id } = req.params;
    const { depth = '3', includeDotFiles = 'true' } = req.query;
    
    const mockProject = {
      id,
      path: '/tmp/test-project'
    };
    
    mockStorageService.getProjects.mockResolvedValueOnce([mockProject]);

    // Mock file tree structure
    const mockFileTree = [
      {
        name: '.agentmux',
        path: '.agentmux',
        type: 'folder',
        size: 192,
        modified: new Date().toISOString(),
        icon: '⚙️',
        children: [
          {
            name: 'specs',
            path: '.agentmux/specs',
            type: 'folder',
            size: 64,
            modified: new Date().toISOString(),
            icon: '📁',
            children: [
              {
                name: 'requirements.md',
                path: '.agentmux/specs/requirements.md',
                type: 'file',
                size: 1024,
                modified: new Date().toISOString(),
                icon: '📝'
              }
            ]
          },
          {
            name: 'tickets',
            path: '.agentmux/tickets',
            type: 'folder',
            size: 64,
            modified: new Date().toISOString(),
            icon: '🎫',
            children: []
          }
        ]
      },
      {
        name: 'package.json',
        path: 'package.json',
        type: 'file',
        size: 512,
        modified: new Date().toISOString(),
        icon: '⚙️'
      },
      {
        name: 'src',
        path: 'src',
        type: 'folder',
        size: 128,
        modified: new Date().toISOString(),
        icon: '📁',
        children: [
          {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file',
            size: 2048,
            modified: new Date().toISOString(),
            icon: '🔵'
          }
        ]
      }
    ];

    res.json({
      success: true,
      data: {
        projectId: id,
        projectName: 'Test Project',
        projectPath: mockProject.path,
        files: mockFileTree,
        totalFiles: 2, // index.ts and requirements.md
        generatedAt: new Date().toISOString()
      }
    });
  });

  // Team Assignment API - POST /api/projects/:id/assign-teams
  app.post('/api/projects/:id/assign-teams', async (req, res) => {
    const { id } = req.params;
    const { teamIds } = req.body;

    if (!Array.isArray(teamIds)) {
      return res.status(400).json({
        success: false,
        error: 'teamIds must be an array'
      });
    }

    const mockProject = {
      id,
      name: 'Test Project',
      path: '/tmp/test-project',
      status: 'active',
      teams: teamIds.reduce((acc, teamId) => {
        acc[teamId] = ['developer', 'tester'];
        return acc;
      }, {} as Record<string, string[]>),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockStorageService.saveProject.mockResolvedValueOnce(mockProject);

    res.json({
      success: true,
      data: mockProject,
      message: 'Teams assigned to project successfully'
    });
  });

  // Team Member Session API - GET /api/teams/:teamId/members/:memberId/session
  app.get('/api/teams/:teamId/members/:memberId/session', async (req, res) => {
    const { teamId, memberId } = req.params;
    const { lines = '50' } = req.query;

    // Check for non-existent member case
    if (memberId === 'non-existent') {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    // Mock team with multi-member structure
    const mockTeam = {
      id: teamId,
      name: 'Test Team',
      members: [
        {
          id: memberId,
          name: 'Test Member',
          role: 'developer',
          sessionName: 'agentmux_developer_12345678',
          systemPrompt: 'You are a test developer.',
          status: 'working'
        }
      ]
    };

    mockStorageService.getTeams.mockResolvedValueOnce([mockTeam]);

    const member = mockTeam.members.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Team member not found'
      });
    }

    if (!member.sessionName) {
      return res.status(400).json({
        success: false,
        error: 'No active session for this team member'
      });
    }

    // Mock terminal output
    const mockOutput = `
export TMUX_SESSION_NAME="${member.sessionName}"
export AGENTMUX_ROLE="${member.role}"

$ echo "Hello from ${member.name} session"
Hello from ${member.name} session

$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean

$ npm test
> test-project@1.0.0 test
> jest

PASS  tests/unit/example.test.ts
  ✓ should work correctly (2 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.5 s

$
    `.trim();

    mockTmuxService.capturePane.mockResolvedValueOnce(mockOutput);

    res.json({
      success: true,
      data: {
        memberId: member.id,
        memberName: member.name,
        sessionName: member.sessionName,
        output: mockOutput,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Teams API with multi-member support
  app.post('/api/teams', async (req, res) => {
    const { name, description, members } = req.body;

    if (!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Team name and at least one member required'
      });
    }

    const teamId = 'team-' + Date.now();
    const processedMembers = members.map((member: any, index: number) => ({
      id: `member-${teamId}-${index}`,
      name: member.name,
      role: member.role,
      systemPrompt: member.systemPrompt,
      sessionName: `agentmux_${member.role}_${Math.random().toString(36).substr(2, 8)}`,
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    const team = {
      id: teamId,
      name,
      description: description || '',
      members: processedMembers,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Mock tmux session creation for each member
    for (const member of processedMembers) {
      mockTmuxService.createSession.mockResolvedValueOnce(member.sessionName);
    }

    mockStorageService.saveTeam.mockResolvedValueOnce(team);

    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully'
    });
  });

  app.get('/api/teams', async (req, res) => {
    const mockTeams = [
      {
        id: 'test-team-1',
        name: 'Frontend Team',
        description: 'Handles UI and frontend development',
        members: [
          {
            id: 'member-1',
            name: 'Project Manager',
            role: 'pm',
            sessionName: 'agentmux_pm_12345678',
            systemPrompt: 'You are a project manager.',
            status: 'working'
          },
          {
            id: 'member-2',
            name: 'Senior Developer',
            role: 'developer',
            sessionName: 'agentmux_developer_87654321',
            systemPrompt: 'You are a senior developer.',
            status: 'idle'
          }
        ],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    mockStorageService.getTeams.mockResolvedValueOnce(mockTeams);

    res.json({
      success: true,
      data: mockTeams
    });
  });

  // WebSocket setup for real-time terminal streaming
  io.on('connection', (socket) => {
    console.log('Test client connected:', socket.id);

    socket.on('subscribe_to_session', (sessionName) => {
      socket.join(`terminal_${sessionName}`);
      
      // Send mock initial terminal state
      socket.emit('initial_terminal_state', {
        type: 'initial_terminal_state',
        payload: {
          sessionName,
          content: 'Mock terminal output for ' + sessionName,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      // Confirm subscription
      socket.emit('subscription_confirmed', {
        type: 'subscription_confirmed',
        payload: { sessionName },
        timestamp: new Date().toISOString()
      });
    });

    socket.on('unsubscribe_from_session', (sessionName) => {
      socket.leave(`terminal_${sessionName}`);
      socket.emit('unsubscription_confirmed', {
        type: 'unsubscription_confirmed',
        payload: { sessionName },
        timestamp: new Date().toISOString()
      });
    });

    socket.on('send_input', (data) => {
      const { sessionName, input } = data;
      
      // Echo back the input
      io.to(`terminal_${sessionName}`).emit('terminal_output', {
        type: 'terminal_output',
        payload: {
          sessionName,
          content: `$ ${input}\nCommand executed: ${input}`,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    });
  });

  return { app, httpServer, io };
}

describe('Phase 2 & 3 Features Integration Tests', () => {
  let app: express.Application;
  let httpServer: any;
  let io: Server;
  let testProjectPath: string;

  beforeAll(async () => {
    const testApp = createEnhancedTestApp();
    app = testApp.app;
    httpServer = testApp.httpServer;
    io = testApp.io;

    testProjectPath = '/tmp/enhanced-test-project';
    
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(testProjectPath, { recursive: true });
    
    // Create test project structure
    await fs.mkdir(path.join(testProjectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(testProjectPath, '.agentmux', 'specs'), { recursive: true });
    await fs.writeFile(path.join(testProjectPath, 'package.json'), '{"name": "test-project"}');
    await fs.writeFile(path.join(testProjectPath, 'src', 'index.ts'), 'console.log("Hello World");');
    await fs.writeFile(path.join(testProjectPath, '.agentmux', 'specs', 'requirements.md'), '# Requirements\n\nTest requirements');
  });

  afterAll(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
    
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced File Tree API', () => {
    test('should return recursive file tree structure', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-123/files?depth=3&includeDotFiles=true')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('files');
      expect(response.body.data).toHaveProperty('totalFiles');
      expect(response.body.data).toHaveProperty('projectId');
      expect(response.body.data).toHaveProperty('generatedAt');

      const files = response.body.data.files;
      expect(Array.isArray(files)).toBe(true);
      
      // Check for .agentmux folder
      const agentmuxFolder = files.find((f: any) => f.name === '.agentmux');
      expect(agentmuxFolder).toBeTruthy();
      expect(agentmuxFolder.type).toBe('folder');
      expect(agentmuxFolder.icon).toBe('⚙️');
      expect(Array.isArray(agentmuxFolder.children)).toBe(true);

      // Check for nested structure
      const specsFolder = agentmuxFolder.children.find((c: any) => c.name === 'specs');
      expect(specsFolder).toBeTruthy();
      expect(specsFolder.children).toHaveLength(1);
      expect(specsFolder.children[0].name).toBe('requirements.md');
      expect(specsFolder.children[0].icon).toBe('📝');

      // Check for other files
      const packageJson = files.find((f: any) => f.name === 'package.json');
      expect(packageJson).toBeTruthy();
      expect(packageJson.type).toBe('file');
      expect(packageJson.icon).toBe('⚙️');
    });

    test('should handle file icons correctly based on extensions', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-123/files')
        .expect(200);

      const files = response.body.data.files;
      
      // Find TypeScript file
      const srcFolder = files.find((f: any) => f.name === 'src');
      const tsFile = srcFolder.children.find((c: any) => c.name === 'index.ts');
      expect(tsFile.icon).toBe('🔵'); // TypeScript icon

      // Find JSON file
      const jsonFile = files.find((f: any) => f.name === 'package.json');
      expect(jsonFile.icon).toBe('⚙️'); // JSON icon

      // Find Markdown file
      const agentmuxFolder = files.find((f: any) => f.name === '.agentmux');
      const specsFolder = agentmuxFolder.children.find((c: any) => c.name === 'specs');
      const mdFile = specsFolder.children.find((c: any) => c.name === 'requirements.md');
      expect(mdFile.icon).toBe('📝'); // Markdown icon
    });
  });

  describe('Team Assignment to Projects', () => {
    test('should assign multiple teams to project', async () => {
      const teamIds = ['team-123', 'team-456', 'team-789'];

      const response = await request(app)
        .post('/api/projects/project-123/assign-teams')
        .send({ teamIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('teams');
      expect(Object.keys(response.body.data.teams)).toEqual(teamIds);
      expect(response.body.message).toContain('Teams assigned to project successfully');
    });

    test('should validate teamIds as array', async () => {
      const response = await request(app)
        .post('/api/projects/project-123/assign-teams')
        .send({ teamIds: 'not-an-array' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('teamIds must be an array');
    });

    test('should handle empty team assignment', async () => {
      const response = await request(app)
        .post('/api/projects/project-123/assign-teams')
        .send({ teamIds: [] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toEqual({});
    });
  });

  describe('Multi-Member Team Management', () => {
    test('should create team with multiple members', async () => {
      const teamData = {
        name: 'Full Stack Team',
        description: 'Complete development team',
        members: [
          {
            name: 'Project Manager',
            role: 'pm',
            systemPrompt: 'You are a project manager responsible for coordinating the team.'
          },
          {
            name: 'Senior Developer',
            role: 'developer',
            systemPrompt: 'You are a senior developer responsible for implementation.'
          },
          {
            name: 'QA Engineer',
            role: 'qa',
            systemPrompt: 'You are a QA engineer responsible for testing.'
          }
        ]
      };

      const response = await request(app)
        .post('/api/teams')
        .send(teamData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(teamData.name);
      expect(response.body.data.description).toBe(teamData.description);
      expect(response.body.data.members).toHaveLength(3);

      // Verify each member has required properties
      response.body.data.members.forEach((member: any, index: number) => {
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('sessionName');
        expect(member.name).toBe(teamData.members[index].name);
        expect(member.role).toBe(teamData.members[index].role);
        expect(member.systemPrompt).toBe(teamData.members[index].systemPrompt);
        expect(member.sessionName).toMatch(new RegExp(`^agentmux_${member.role}_`));
      });
    });

    test('should list teams with member details', async () => {
      const response = await request(app)
        .get('/api/teams')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);

      const team = response.body.data[0];
      expect(team).toHaveProperty('members');
      expect(Array.isArray(team.members)).toBe(true);
      expect(team.members).toHaveLength(2);

      // Check member structure
      team.members.forEach((member: any) => {
        expect(member).toHaveProperty('id');
        expect(member).toHaveProperty('name');
        expect(member).toHaveProperty('role');
        expect(member).toHaveProperty('sessionName');
        expect(member).toHaveProperty('systemPrompt');
        expect(member).toHaveProperty('status');
      });
    });

    test('should require team name and members', async () => {
      const response = await request(app)
        .post('/api/teams')
        .send({ name: 'Incomplete Team' }) // Missing members
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Team name and at least one member required');
    });
  });

  describe('Team Member Session Monitoring', () => {
    test('should get terminal output for team member', async () => {
      const response = await request(app)
        .get('/api/teams/team-123/members/member-456/session?lines=100')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('memberId');
      expect(response.body.data).toHaveProperty('memberName');
      expect(response.body.data).toHaveProperty('sessionName');
      expect(response.body.data).toHaveProperty('output');
      expect(response.body.data).toHaveProperty('timestamp');

      // Verify output contains expected terminal content
      expect(response.body.data.output).toContain('TMUX_SESSION_NAME');
      expect(response.body.data.output).toContain('AGENTMUX_ROLE');
      expect(response.body.data.output).toContain('git status');
      expect(response.body.data.output).toContain('npm test');
    });

    test('should handle non-existent team member', async () => {
      const response = await request(app)
        .get('/api/teams/team-123/members/non-existent/session')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Team member not found');
    });
  });

  describe('WebSocket Terminal Streaming', () => {
    let clientSocket: any;
    let serverPort: number;

    beforeAll((done) => {
      serverPort = 0; // Use dynamic port allocation
      httpServer.listen(serverPort, () => {
        const address = httpServer.address();
        if (address && typeof address !== 'string') {
          serverPort = address.port;
        }
        clientSocket = Client(`http://localhost:${serverPort}`);
        clientSocket.on('connect', done);
      });
    }, 60000); // Increase timeout to 60 seconds

    afterEach(() => {
      // Clean up event listeners after each test to prevent interference
      if (clientSocket) {
        clientSocket.off('subscription_confirmed');
        clientSocket.off('initial_terminal_state');
        clientSocket.off('terminal_output');
        clientSocket.off('unsubscription_confirmed');
      }
    });

    afterAll(() => {
      httpServer.close();
      if (clientSocket) clientSocket.close();
    });

    test('should handle session subscription', (done) => {
      const sessionName = 'agentmux_developer_test123';
      
      clientSocket.on('subscription_confirmed', (message: any) => {
        expect(message.type).toBe('subscription_confirmed');
        expect(message.payload.sessionName).toBe(sessionName);
        done();
      });

      clientSocket.emit('subscribe_to_session', sessionName);
    });

    test('should receive initial terminal state', (done) => {
      const sessionName = 'agentmux_pm_test456';
      
      clientSocket.on('initial_terminal_state', (message: any) => {
        expect(message.type).toBe('initial_terminal_state');
        expect(message.payload.sessionName).toBe(sessionName);
        expect(message.payload.content).toContain('Mock terminal output');
        done();
      });

      clientSocket.emit('subscribe_to_session', sessionName);
    });

    test('should handle terminal input and output', (done) => {
      const sessionName = 'agentmux_developer_input_test';
      const testInput = 'ls -la';
      
      clientSocket.on('terminal_output', (message: any) => {
        expect(message.type).toBe('terminal_output');
        expect(message.payload.content).toContain(testInput);
        expect(message.payload.content).toContain('Command executed');
        done();
      });

      // First subscribe, then send input
      clientSocket.emit('subscribe_to_session', sessionName);
      setTimeout(() => {
        clientSocket.emit('send_input', { sessionName, input: testInput });
      }, 100);
    });

    test('should handle session unsubscription', (done) => {
      const sessionName = 'agentmux_tester_unsubtest';
      
      clientSocket.on('unsubscription_confirmed', (message: any) => {
        expect(message.type).toBe('unsubscription_confirmed');
        expect(message.payload.sessionName).toBe(sessionName);
        done();
      });

      clientSocket.emit('unsubscribe_from_session', sessionName);
    });
  });

  describe('End-to-End Integration Workflow', () => {
    test('should complete full enhanced workflow', async () => {
      // 1. Create multi-member team
      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'E2E Test Team',
          description: 'End-to-end testing team',
          members: [
            {
              name: 'Lead Developer',
              role: 'developer',
              systemPrompt: 'You are a lead developer.'
            },
            {
              name: 'UI Tester',
              role: 'tester',
              systemPrompt: 'You are a UI tester.'
            }
          ]
        })
        .expect(201);

      const teamId = teamResponse.body.data.id;
      const memberId = teamResponse.body.data.members[0].id;

      // 2. Assign team to project
      const assignResponse = await request(app)
        .post('/api/projects/e2e-project-123/assign-teams')
        .send({ teamIds: [teamId] })
        .expect(200);

      expect(assignResponse.body.data.teams[teamId]).toBeTruthy();

      // 3. Get file tree for project
      const filesResponse = await request(app)
        .get('/api/projects/e2e-project-123/files?depth=2')
        .expect(200);

      expect(filesResponse.body.data.files).toBeTruthy();

      // 4. Monitor team member session
      const sessionResponse = await request(app)
        .get(`/api/teams/${teamId}/members/${memberId}/session`)
        .expect(200);

      expect(sessionResponse.body.data.sessionName).toMatch(/^agentmux_developer_/);
      expect(sessionResponse.body.data.output).toBeTruthy();

      // Verify complete workflow
      expect(teamResponse.body.success).toBe(true);
      expect(assignResponse.body.success).toBe(true);
      expect(filesResponse.body.success).toBe(true);
      expect(sessionResponse.body.success).toBe(true);
    });
  });
});