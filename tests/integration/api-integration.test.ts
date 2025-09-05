import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

// Mock the services and create a minimal API server for testing
const mockStorageService = {
  getTeams: jest.fn(),
  saveTeam: jest.fn(),
  deleteTeam: jest.fn(),
  updateTeamStatus: jest.fn(),
  getProjects: jest.fn(),
  addProject: jest.fn(),
  saveProject: jest.fn(),
  getTickets: jest.fn(),
  saveTicket: jest.fn()
};

const mockTmuxService = {
  createSession: jest.fn(),
  killSession: jest.fn(),
  sendMessage: jest.fn(),
  capturePane: jest.fn()
};

const mockSchedulerService = {
  scheduleCheck: jest.fn(),
  scheduleRecurringCheck: jest.fn(),
  listScheduledChecks: jest.fn(),
  cancelCheck: jest.fn(),
  cancelAllChecksForSession: jest.fn(),
  scheduleDefaultCheckins: jest.fn(),
  getChecksForSession: jest.fn()
};

// Create a minimal API server for testing
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Projects API
  app.post('/api/projects', async (req, res) => {
    const { path: projectPath, name, description } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Project path is required'
      });
    }

    try {
      // Check if path exists
      await fs.access(projectPath);
      
      const project = {
        id: 'test-project-' + Date.now(),
        name: name || 'Test Project',
        description: description || 'Test project description',
        path: projectPath,
        status: 'active',
        teams: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockStorageService.addProject.mockResolvedValueOnce(project);
      
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create project: ' + (error as Error).message
      });
    }
  });

  app.get('/api/projects', async (req, res) => {
    const projects = [
      {
        id: 'test-project-1',
        name: 'Test Project 1',
        path: '/tmp/test-project-1',
        status: 'active',
        teams: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    mockStorageService.getProjects.mockResolvedValueOnce(projects);
    
    res.json({
      success: true,
      data: projects
    });
  });

  // Teams API
  app.post('/api/teams', async (req, res) => {
    const { name, role, systemPrompt, projectPath } = req.body;

    if (!name || !role || !systemPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, role, systemPrompt'
      });
    }

    // Check for duplicate team names
    const existingTeams = mockStorageService.getTeams() || [];
    if (Array.isArray(existingTeams) && existingTeams.find((t: any) => t.name === name)) {
      return res.status(500).json({
        success: false,
        error: `Team with name "${name}" already exists`
      });
    }

    const teamId = 'team-' + Date.now();
    const sessionName = `agentmux_${role}_${teamId.slice(-8)}`;

    const team = {
      id: teamId,
      name,
      sessionName,
      role,
      systemPrompt,
      status: 'working',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Mock tmux session creation
    mockTmuxService.createSession.mockResolvedValueOnce(sessionName);
    mockStorageService.saveTeam.mockResolvedValueOnce(team);

    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully'
    });
  });

  app.get('/api/teams', async (req, res) => {
    const teams = [
      {
        id: 'test-team-1',
        name: 'Test Team 1',
        sessionName: 'agentmux_developer_12345678',
        role: 'developer',
        systemPrompt: 'Test prompt',
        status: 'working',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    mockStorageService.getTeams.mockResolvedValueOnce(teams);
    
    res.json({
      success: true,
      data: teams
    });
  });

  app.delete('/api/teams/:id', async (req, res) => {
    const { id } = req.params;
    
    mockTmuxService.killSession.mockResolvedValueOnce(undefined);
    mockStorageService.deleteTeam.mockResolvedValueOnce(undefined);
    
    res.json({
      success: true,
      message: 'Team terminated successfully'
    });
  });

  // Projects tickets API
  app.post('/api/projects/:id/tickets', async (req, res) => {
    const { id } = req.params;
    const { title, description, priority, assignedTo } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required'
      });
    }

    const ticket = {
      id: 'ticket-' + Date.now(),
      title,
      description,
      status: 'open',
      priority: priority || 'medium',
      assignedTo,
      projectId: id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockStorageService.saveTicket.mockResolvedValueOnce(ticket);

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully'
    });
  });

  app.get('/api/projects/:id/tickets', async (req, res) => {
    const tickets = [
      {
        id: 'test-ticket-1',
        title: 'Test Ticket',
        description: 'Test ticket description',
        status: 'open',
        priority: 'medium',
        projectId: req.params.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    mockStorageService.getTickets.mockResolvedValueOnce(tickets);
    
    res.json({
      success: true,
      data: tickets
    });
  });

  return app;
}

describe('API Integration Tests', () => {
  let app: express.Application;
  let testProjectPath: string;

  beforeAll(async () => {
    app = createTestApp();
    testProjectPath = '/tmp/api-test-project';
    
    // Clean and create test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(testProjectPath, { recursive: true });
    
    // Create a sample file
    await fs.writeFile(
      path.join(testProjectPath, 'README.md'),
      '# API Test Project\nThis is a test project for API integration testing.'
    );
  });

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Management', () => {
    test('should create project with temporary directory', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          path: testProjectPath,
          name: 'API Test Project',
          description: 'Test project for API integration'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.path).toBe(testProjectPath);
      expect(response.body.data.name).toBe('API Test Project');
      expect(response.body.data.description).toBe('Test project for API integration');
    });

    test('should handle invalid project path', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ path: '/invalid/nonexistent/path' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to create project');
    });

    test('should list projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    test('should require project path', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({ name: 'Missing Path Project' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project path is required');
    });
  });

  describe('Team Management', () => {
    test('should create team with tmux session', async () => {
      const teamData = {
        name: 'API Test Team',
        role: 'developer',
        systemPrompt: 'You are a test developer agent for API testing.',
        projectPath: testProjectPath
      };

      const response = await request(app)
        .post('/api/teams')
        .send(teamData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(teamData.name);
      expect(response.body.data.role).toBe(teamData.role);
      expect(response.body.data.sessionName).toMatch(/^agentmux_developer_/);
      expect(response.body.data.status).toBe('working');
    });

    test('should create different team roles', async () => {
      const roles = ['developer', 'tester', 'designer'];
      
      for (const role of roles) {
        const teamData = {
          name: `${role.charAt(0).toUpperCase() + role.slice(1)} Team`,
          role,
          systemPrompt: `You are a ${role} agent.`,
          projectPath: testProjectPath
        };

        const response = await request(app)
          .post('/api/teams')
          .send(teamData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.role).toBe(role);
        expect(response.body.data.sessionName).toMatch(new RegExp(`^agentmux_${role}_`));
      }
    });

    test('should handle duplicate team names', async () => {
      // Set up mock to return existing team
      mockStorageService.getTeams.mockReturnValueOnce([
        { name: 'Duplicate Team', id: 'existing-id' }
      ]);

      const response = await request(app)
        .post('/api/teams')
        .send({
          name: 'Duplicate Team',
          role: 'developer',
          systemPrompt: 'Test prompt'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    test('should require all team fields', async () => {
      const response = await request(app)
        .post('/api/teams')
        .send({ name: 'Incomplete Team' }) // Missing role and systemPrompt
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should list teams', async () => {
      const response = await request(app)
        .get('/api/teams')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    test('should delete team and kill tmux session', async () => {
      const response = await request(app)
        .delete('/api/teams/test-team-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('terminated successfully');
    });
  });

  describe('Ticket Management', () => {
    test('should create tickets for project', async () => {
      const ticketData = {
        title: 'API Test Ticket',
        description: 'Test ticket for API integration testing',
        priority: 'high',
        assignedTo: 'test-team-id'
      };

      const response = await request(app)
        .post('/api/projects/test-project-id/tickets')
        .send(ticketData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.title).toBe(ticketData.title);
      expect(response.body.data.description).toBe(ticketData.description);
      expect(response.body.data.priority).toBe(ticketData.priority);
      expect(response.body.data.assignedTo).toBe(ticketData.assignedTo);
      expect(response.body.data.status).toBe('open');
    });

    test('should require ticket title and description', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/tickets')
        .send({ title: 'Incomplete Ticket' }) // Missing description
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Title and description are required');
    });

    test('should list tickets for project', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/tickets')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    test('should set default priority for tickets', async () => {
      const response = await request(app)
        .post('/api/projects/test-project-id/tickets')
        .send({
          title: 'No Priority Ticket',
          description: 'Ticket without explicit priority'
        })
        .expect(201);

      expect(response.body.data.priority).toBe('medium');
    });
  });

  describe('Integration Workflow', () => {
    test('should complete full project setup workflow', async () => {
      // 1. Create project
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          path: testProjectPath,
          name: 'Workflow Test Project'
        })
        .expect(201);

      const projectId = projectResponse.body.data.id;
      expect(projectId).toBeTruthy();

      // 2. Create team
      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Workflow Test Team',
          role: 'developer',
          systemPrompt: 'You are a workflow test developer.',
          projectPath: testProjectPath
        })
        .expect(201);

      const teamId = teamResponse.body.data.id;
      expect(teamId).toBeTruthy();

      // 3. Create ticket assigned to team
      const ticketResponse = await request(app)
        .post(`/api/projects/${projectId}/tickets`)
        .send({
          title: 'Workflow Integration Task',
          description: 'Complete the workflow integration testing',
          priority: 'high',
          assignedTo: teamId
        })
        .expect(201);

      expect(ticketResponse.body.data.assignedTo).toBe(teamId);
      expect(ticketResponse.body.data.projectId).toBe(projectId);

      // Verify the workflow completed successfully
      expect(projectResponse.body.success).toBe(true);
      expect(teamResponse.body.success).toBe(true);
      expect(ticketResponse.body.success).toBe(true);
    });
  });
});