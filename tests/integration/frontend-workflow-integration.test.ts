import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Frontend Workflow Integration Tests
 * 
 * These tests validate the complete frontend workflows requested:
 * 1. Create project (with temporary directories for testing)
 * 2. Create team (via running tmux sessions) 
 * 3. Assign Team to project
 * 
 * This test suite focuses on end-to-end workflows that the frontend
 * would execute when users interact with the AgentMux dashboard.
 */

// Mock services for testing
const mockServices = {
  storage: {
    projects: [] as any[],
    teams: [] as any[],
    tickets: [] as any[],
    
    addProject: jest.fn(),
    getProjects: jest.fn(),
    saveProject: jest.fn(),
    saveTeam: jest.fn(),
    getTeams: jest.fn(),
    deleteTeam: jest.fn(),
    saveTicket: jest.fn(),
    getTickets: jest.fn()
  },
  
  tmux: {
    activeSessions: [] as string[],
    createSession: jest.fn(),
    killSession: jest.fn()
  }
};

// Create test application that mimics the frontend API requirements
function createFrontendTestApp() {
  const app = express();
  app.use(express.json());

  // Project Management - Create project with temporary directory
  app.post('/api/projects', async (req, res) => {
    const { path: projectPath, name, description } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({
        success: false,
        error: 'Project path is required'
      });
    }

    try {
      // Validate that the directory exists (frontend would create temp dirs)
      await fs.access(projectPath);
      
      const project = {
        id: `project-${Date.now()}`,
        name: name || path.basename(projectPath),
        description: description || `Project at ${projectPath}`,
        path: projectPath,
        status: 'active',
        teams: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store project
      mockServices.storage.projects.push(project);
      
      res.status(201).json({
        success: true,
        data: project,
        message: 'Project created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `Failed to create project: ${(error as Error).message}`
      });
    }
  });

  app.get('/api/projects', (req, res) => {
    res.json({
      success: true,
      data: mockServices.storage.projects
    });
  });

  app.get('/api/projects/:id', (req, res) => {
    const project = mockServices.storage.projects.find(p => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    res.json({
      success: true,
      data: project
    });
  });

  // Team Management - Create team via tmux sessions
  app.post('/api/teams', async (req, res) => {
    const { name, role, systemPrompt, projectPath } = req.body;

    if (!name || !role || !systemPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, role, systemPrompt'
      });
    }

    // Check for duplicate team names
    if (mockServices.storage.teams.find(t => t.name === name)) {
      return res.status(500).json({
        success: false,
        error: `Team with name "${name}" already exists`
      });
    }

    const teamId = `team-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const sessionName = `agentmux_${role}_${teamId.slice(-8)}`;

    // Simulate tmux session creation
    mockServices.tmux.activeSessions.push(sessionName);
    
    const team = {
      id: teamId,
      name,
      sessionName,
      role,
      systemPrompt,
      status: 'working',
      currentProject: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockServices.storage.teams.push(team);
    
    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created and tmux session started successfully'
    });
  });

  app.get('/api/teams', (req, res) => {
    res.json({
      success: true,
      data: mockServices.storage.teams
    });
  });

  app.delete('/api/teams/:id', (req, res) => {
    const teamIndex = mockServices.storage.teams.findIndex(t => t.id === req.params.id);
    if (teamIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    const team = mockServices.storage.teams[teamIndex];
    
    // Remove tmux session
    const sessionIndex = mockServices.tmux.activeSessions.indexOf(team.sessionName);
    if (sessionIndex !== -1) {
      mockServices.tmux.activeSessions.splice(sessionIndex, 1);
    }
    
    // Remove team
    mockServices.storage.teams.splice(teamIndex, 1);
    
    res.json({
      success: true,
      message: 'Team terminated and tmux session killed'
    });
  });

  // Team Assignment - Assign team to project
  app.post('/api/projects/:id/assign-teams', (req, res) => {
    const { teamAssignments } = req.body;
    const projectIndex = mockServices.storage.projects.findIndex(p => p.id === req.params.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Update project with team assignments
    const project = mockServices.storage.projects[projectIndex];
    project.teams = { ...project.teams, ...teamAssignments };
    project.updatedAt = new Date().toISOString();

    // Update teams with project assignment
    if (teamAssignments) {
      Object.entries(teamAssignments).forEach(([role, teamIds]: [string, any]) => {
        teamIds.forEach((teamId: string) => {
          const teamIndex = mockServices.storage.teams.findIndex(t => t.id === teamId);
          if (teamIndex !== -1) {
            mockServices.storage.teams[teamIndex].currentProject = req.params.id;
            mockServices.storage.teams[teamIndex].updatedAt = new Date().toISOString();
          }
        });
      });
    }
    
    res.json({
      success: true,
      data: project,
      message: 'Teams assigned to project successfully'
    });
  });

  app.post('/api/projects/:id/start', (req, res) => {
    const { teamAssignments } = req.body;
    const projectIndex = mockServices.storage.projects.findIndex(p => p.id === req.params.id);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const project = mockServices.storage.projects[projectIndex];
    project.status = 'active';
    
    if (teamAssignments) {
      project.teams = { ...project.teams, ...teamAssignments };
    }
    
    project.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: project,
      message: 'Project started with team assignments'
    });
  });

  return app;
}

describe('Frontend Workflow Integration Tests', () => {
  let app: express.Application;
  let testWorkspaceDir: string;
  let testProject1Path: string;
  let testProject2Path: string;

  beforeAll(async () => {
    app = createFrontendTestApp();
    testWorkspaceDir = '/tmp/frontend-workflow-test';
    testProject1Path = path.join(testWorkspaceDir, 'frontend-project-1');
    testProject2Path = path.join(testWorkspaceDir, 'frontend-project-2');

    // Clean and create test workspace
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
    await fs.mkdir(testWorkspaceDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directories
    try {
      await fs.rm(testWorkspaceDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  });

  beforeEach(() => {
    // Clear mock data before each test
    mockServices.storage.projects.length = 0;
    mockServices.storage.teams.length = 0;
    mockServices.storage.tickets.length = 0;
    mockServices.tmux.activeSessions.length = 0;
  });

  describe('1. Create Project (with temporary directories)', () => {
    test('should create project with real temporary directory', async () => {
      // Create temporary project directory (simulating frontend behavior)
      await fs.mkdir(testProject1Path, { recursive: true });
      await fs.writeFile(
        path.join(testProject1Path, 'package.json'),
        JSON.stringify({ name: 'frontend-test-project', version: '1.0.0' }, null, 2)
      );

      const response = await request(app)
        .post('/api/projects')
        .send({
          path: testProject1Path,
          name: 'Frontend Test Project',
          description: 'A project created by the frontend with a temporary directory'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.path).toBe(testProject1Path);
      expect(response.body.data.name).toBe('Frontend Test Project');
      expect(response.body.data.description).toContain('temporary directory');

      // Verify directory and files exist
      const stats = await fs.stat(testProject1Path);
      expect(stats.isDirectory()).toBe(true);
      
      const packageJsonExists = await fs.access(path.join(testProject1Path, 'package.json')).then(() => true, () => false);
      expect(packageJsonExists).toBe(true);
    });

    test('should create multiple projects with different temporary directories', async () => {
      // Create first project directory
      await fs.mkdir(testProject1Path, { recursive: true });
      await fs.writeFile(path.join(testProject1Path, 'README.md'), '# Project 1');

      // Create second project directory  
      await fs.mkdir(testProject2Path, { recursive: true });
      await fs.writeFile(path.join(testProject2Path, 'main.py'), 'print("Project 2")');

      // Create both projects
      const project1Response = await request(app)
        .post('/api/projects')
        .send({
          path: testProject1Path,
          name: 'Multi Project 1'
        })
        .expect(201);

      const project2Response = await request(app)
        .post('/api/projects')
        .send({
          path: testProject2Path,
          name: 'Multi Project 2'
        })
        .expect(201);

      // Verify both projects were created
      expect(project1Response.body.data.name).toBe('Multi Project 1');
      expect(project2Response.body.data.name).toBe('Multi Project 2');

      // List projects to verify both exist
      const listResponse = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(2);
      expect(listResponse.body.data.map((p: any) => p.name)).toContain('Multi Project 1');
      expect(listResponse.body.data.map((p: any) => p.name)).toContain('Multi Project 2');
    });

    test('should handle invalid directory paths', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          path: '/invalid/nonexistent/directory',
          name: 'Invalid Project'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to create project');
    });
  });

  describe('2. Create Team (via running tmux sessions)', () => {
    test('should create team with tmux session simulation', async () => {
      const teamData = {
        name: 'Frontend Development Team',
        role: 'developer',
        systemPrompt: 'You are a frontend developer focused on React and TypeScript development.',
        projectPath: testProject1Path
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

      // Verify tmux session was "created"
      expect(mockServices.tmux.activeSessions).toContain(response.body.data.sessionName);
    });

    test('should create teams with different roles and tmux sessions', async () => {
      const teamConfigs = [
        {
          name: 'Backend Development Team',
          role: 'developer',
          systemPrompt: 'You are a backend developer specializing in Node.js and databases.'
        },
        {
          name: 'QA Testing Team', 
          role: 'tester',
          systemPrompt: 'You are a QA engineer focused on comprehensive testing and quality assurance.'
        },
        {
          name: 'UI/UX Design Team',
          role: 'designer', 
          systemPrompt: 'You are a UI/UX designer creating intuitive and accessible user interfaces.'
        }
      ];

      for (const config of teamConfigs) {
        const response = await request(app)
          .post('/api/teams')
          .send(config)
          .expect(201);

        expect(response.body.data.role).toBe(config.role);
        expect(response.body.data.sessionName).toMatch(new RegExp(`^agentmux_${config.role}_`));
        expect(mockServices.tmux.activeSessions).toContain(response.body.data.sessionName);
      }

      // Verify all teams and sessions were created
      expect(mockServices.storage.teams).toHaveLength(3);
      expect(mockServices.tmux.activeSessions).toHaveLength(3);

      // List teams to verify they all exist
      const listResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(3);
      const roles = listResponse.body.data.map((t: any) => t.role);
      expect(roles).toContain('developer');
      expect(roles).toContain('tester');
      expect(roles).toContain('designer');
    });

    test('should prevent duplicate team names', async () => {
      // Create first team
      await request(app)
        .post('/api/teams')
        .send({
          name: 'Duplicate Team Name',
          role: 'developer',
          systemPrompt: 'First team with this name'
        })
        .expect(201);

      // Try to create second team with same name
      const response = await request(app)
        .post('/api/teams')
        .send({
          name: 'Duplicate Team Name',
          role: 'tester', 
          systemPrompt: 'Second team with same name'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    test('should terminate team and kill tmux session', async () => {
      // Create team first
      const createResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Team To Delete',
          role: 'developer',
          systemPrompt: 'This team will be deleted'
        })
        .expect(201);

      const teamId = createResponse.body.data.id;
      const sessionName = createResponse.body.data.sessionName;

      // Verify session exists
      expect(mockServices.tmux.activeSessions).toContain(sessionName);

      // Delete team
      const deleteResponse = await request(app)
        .delete(`/api/teams/${teamId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toContain('terminated');

      // Verify team and session are gone
      expect(mockServices.storage.teams).toHaveLength(0);
      expect(mockServices.tmux.activeSessions).not.toContain(sessionName);
    });
  });

  describe('3. Assign Team to Project', () => {
    let projectId: string;
    let developmentTeamId: string;
    let testingTeamId: string;

    beforeEach(async () => {
      // Create project
      await fs.mkdir(testProject1Path, { recursive: true });
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          path: testProject1Path,
          name: 'Assignment Test Project'
        })
        .expect(201);
      projectId = projectResponse.body.data.id;

      // Create development team
      const devTeamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Development Team',
          role: 'developer',
          systemPrompt: 'Development team for assignment testing'
        })
        .expect(201);
      developmentTeamId = devTeamResponse.body.data.id;

      // Create testing team
      const testTeamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Testing Team',
          role: 'tester',
          systemPrompt: 'Testing team for assignment testing'
        })
        .expect(201);
      testingTeamId = testTeamResponse.body.data.id;
    });

    test('should assign single team to project', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/assign-teams`)
        .send({
          teamAssignments: {
            'developer': [developmentTeamId]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toHaveProperty('developer');
      expect(response.body.data.teams.developer).toContain(developmentTeamId);

      // Verify team knows about project assignment
      const teamResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      const assignedTeam = teamResponse.body.data.find((t: any) => t.id === developmentTeamId);
      expect(assignedTeam.currentProject).toBe(projectId);
    });

    test('should assign multiple teams with different roles to project', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/assign-teams`)
        .send({
          teamAssignments: {
            'developer': [developmentTeamId],
            'tester': [testingTeamId]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.teams.developer).toContain(developmentTeamId);
      expect(response.body.data.teams.tester).toContain(testingTeamId);

      // Verify both teams know about project assignment
      const teamsResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      const teams = teamsResponse.body.data;
      const devTeam = teams.find((t: any) => t.id === developmentTeamId);
      const testTeam = teams.find((t: any) => t.id === testingTeamId);

      expect(devTeam.currentProject).toBe(projectId);
      expect(testTeam.currentProject).toBe(projectId);
    });

    test('should start project with team assignments', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({
          teamAssignments: {
            'developer': [developmentTeamId],
            'tester': [testingTeamId]
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.teams.developer).toContain(developmentTeamId);
      expect(response.body.data.teams.tester).toContain(testingTeamId);
    });

    test('should handle assignment to non-existent project', async () => {
      const response = await request(app)
        .post('/api/projects/non-existent-id/assign-teams')
        .send({
          teamAssignments: {
            'developer': [developmentTeamId]
          }
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('Complete Frontend Workflow Integration', () => {
    test('should execute complete project setup workflow', async () => {
      // Step 1: Create temporary project directory (frontend creates this)
      await fs.mkdir(testProject1Path, { recursive: true });
      await fs.writeFile(
        path.join(testProject1Path, 'project-config.json'),
        JSON.stringify({ 
          type: 'web-application',
          stack: ['React', 'Node.js', 'PostgreSQL']
        }, null, 2)
      );

      // Step 2: Register project via API
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          path: testProject1Path,
          name: 'Complete Workflow Project',
          description: 'End-to-end workflow test project'
        })
        .expect(201);

      const projectId = projectResponse.body.data.id;

      // Step 3: Create multiple teams with tmux sessions
      const teamCreations = [
        {
          name: 'Frontend Development Team',
          role: 'developer',
          systemPrompt: 'Frontend React specialist'
        },
        {
          name: 'Backend Development Team', 
          role: 'developer',
          systemPrompt: 'Backend Node.js specialist'
        },
        {
          name: 'Quality Assurance Team',
          role: 'tester',
          systemPrompt: 'QA testing specialist'
        }
      ];

      const teamIds: string[] = [];
      for (const teamConfig of teamCreations) {
        const teamResponse = await request(app)
          .post('/api/teams')
          .send(teamConfig)
          .expect(201);
        teamIds.push(teamResponse.body.data.id);
      }

      // Step 4: Assign all teams to the project
      const assignmentResponse = await request(app)
        .post(`/api/projects/${projectId}/assign-teams`)
        .send({
          teamAssignments: {
            'frontend': [teamIds[0]],
            'backend': [teamIds[1]],
            'testing': [teamIds[2]]
          }
        })
        .expect(200);

      // Step 5: Start project with all assignments
      const startResponse = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .expect(200);

      // Verify complete workflow
      expect(projectResponse.body.success).toBe(true);
      expect(assignmentResponse.body.success).toBe(true);
      expect(startResponse.body.success).toBe(true);

      // Verify project has teams assigned
      const finalProjectResponse = await request(app)
        .get(`/api/projects/${projectId}`)
        .expect(200);

      expect(finalProjectResponse.body.data.status).toBe('active');
      expect(Object.keys(finalProjectResponse.body.data.teams)).toHaveLength(3);

      // Verify all teams are assigned to project
      const teamsResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      const assignedTeams = teamsResponse.body.data.filter((t: any) => t.currentProject === projectId);
      expect(assignedTeams).toHaveLength(3);

      // Verify tmux sessions are active
      expect(mockServices.tmux.activeSessions).toHaveLength(3);

      // Verify project directory still exists and has files
      const configExists = await fs.access(path.join(testProject1Path, 'project-config.json'))
        .then(() => true, () => false);
      expect(configExists).toBe(true);
    });
  });
});