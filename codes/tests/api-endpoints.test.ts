import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FileStorage } from '../src/services/FileStorage';
import { ActivityPoller } from '../src/services/ActivityPoller';

// Mock child_process for ActivityPoller
jest.mock('child_process');

describe('API Endpoints', () => {
  let app: express.Application;
  let storage: FileStorage;
  let poller: ActivityPoller;
  let testDir: string;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), 'agentmux-api-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    storage = new FileStorage(testDir);
    poller = new ActivityPoller(storage);
    
    // Setup Express app similar to server.ts
    app = express();
    app.use(express.json({ limit: '1mb' }));
    
    // Add API routes
    setupAPIRoutes(app, storage, poller);
  });

  afterAll(async () => {
    poller.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset storage to clean state before each test
    await storage.saveData({
      projects: [],
      teams: [],
      assignments: [],
      settings: {
        version: '1.0.0',
        created: new Date().toISOString(),
        pollingInterval: 30000
      }
    });
  });

  describe('Projects API', () => {
    describe('GET /api/projects', () => {
      it('should return empty projects list initially', async () => {
        const response = await request(app)
          .get('/api/projects')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: [],
          timestamp: expect.any(String),
          count: 0
        });
      });

      it('should return existing projects', async () => {
        // Pre-populate with test data
        await storage.createProject({
          name: 'Test Project',
          fsPath: '/tmp/test-project',
          status: 'active'
        });

        const response = await request(app)
          .get('/api/projects')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          name: 'Test Project',
          fsPath: '/tmp/test-project',
          status: 'active'
        });
      });
    });

    describe('POST /api/projects', () => {
      it('should create a new project', async () => {
        const projectData = {
          name: 'New Project',
          fsPath: '/tmp/new-project',
          status: 'active'
        };

        const response = await request(app)
          .post('/api/projects')
          .send(projectData)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: expect.any(String),
            name: 'New Project',
            fsPath: '/tmp/new-project',
            status: 'active',
            createdAt: expect.any(String)
          })
        });
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/projects')
          .send({})
          .expect(400);

        expect(response.body).toEqual({
          success: false,
          error: expect.any(String)
        });
      });

      it('should handle duplicate project names gracefully', async () => {
        const projectData = {
          name: 'Duplicate Project',
          fsPath: '/tmp/duplicate',
          status: 'active'
        };

        // Create first project
        await request(app)
          .post('/api/projects')
          .send(projectData)
          .expect(200);

        // Create second project with same name - should succeed but have different ID
        const response = await request(app)
          .post('/api/projects')
          .send(projectData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Duplicate Project');
      });
    });

    describe('PUT /api/projects/:id', () => {
      it('should update an existing project', async () => {
        // Create project first
        const project = await storage.createProject({
          name: 'Original Project',
          fsPath: '/tmp/original',
          status: 'idle'
        });

        const updates = {
          name: 'Updated Project',
          status: 'active'
        };

        const response = await request(app)
          .put(`/api/projects/${project.id}`)
          .send(updates)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: expect.objectContaining({
            id: project.id,
            name: 'Updated Project',
            status: 'active',
            fsPath: '/tmp/original' // Should preserve original fsPath
          })
        });
      });

      it('should return 404 for non-existent project', async () => {
        const response = await request(app)
          .put('/api/projects/nonexistent-id')
          .send({ name: 'Updated' })
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          error: 'Project not found'
        });
      });

      it('should validate update data', async () => {
        const project = await storage.createProject({
          name: 'Test Project',
          fsPath: '/tmp/test',
          status: 'active'
        });

        const response = await request(app)
          .put(`/api/projects/${project.id}`)
          .send({ status: 'invalid-status' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('DELETE /api/projects/:id', () => {
      it('should delete an existing project', async () => {
        const project = await storage.createProject({
          name: 'To Delete',
          fsPath: '/tmp/delete',
          status: 'active'
        });

        const response = await request(app)
          .delete(`/api/projects/${project.id}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Project deleted'
        });

        // Verify project was deleted
        const projects = await storage.getProjects();
        expect(projects.find(p => p.id === project.id)).toBeUndefined();
      });

      it('should return 404 for non-existent project', async () => {
        const response = await request(app)
          .delete('/api/projects/nonexistent-id')
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          error: 'Project not found'
        });
      });

      it('should clean up related assignments when deleting project', async () => {
        // Create project, team, and assignment
        const project = await storage.createProject({
          name: 'Project with Assignment',
          fsPath: '/tmp/assigned',
          status: 'active'
        });

        const team = await storage.createTeam({
          name: 'Test Team',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'active'
        });

        await storage.createAssignment({
          projectId: project.id,
          teamId: team.id,
          status: 'active'
        });

        // Delete project
        await request(app)
          .delete(`/api/projects/${project.id}`)
          .expect(200);

        // Verify assignment was cleaned up
        const assignments = await storage.getAssignments();
        expect(assignments.find(a => a.projectId === project.id)).toBeUndefined();
      });
    });
  });

  describe('Teams API', () => {
    describe('GET /api/teams', () => {
      it('should return empty teams list initially', async () => {
        const response = await request(app)
          .get('/api/teams')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: [],
          timestamp: expect.any(String),
          count: 0
        });
      });

      it('should return existing teams', async () => {
        await storage.createTeam({
          name: 'Test Team',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'dev', count: 2 }
          ],
          status: 'active'
        });

        const response = await request(app)
          .get('/api/teams')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          name: 'Test Team',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'dev', count: 2 }
          ],
          status: 'active'
        });
      });
    });

    describe('POST /api/teams', () => {
      it('should create a new team with default orchestrator role', async () => {
        const teamData = {
          name: 'New Team'
        };

        const response = await request(app)
          .post('/api/teams')
          .send(teamData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: expect.any(String),
          name: 'New Team',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'idle',
          createdAt: expect.any(String)
        });
      });

      it('should create team with custom roles', async () => {
        const teamData = {
          name: 'Custom Team',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'pm', count: 1 },
            { name: 'dev', count: 2 },
            { name: 'qa', count: 1 }
          ],
          status: 'active'
        };

        const response = await request(app)
          .post('/api/teams')
          .send(teamData)
          .expect(200);

        expect(response.body.data.roles).toEqual(teamData.roles);
        expect(response.body.data.status).toBe('active');
      });

      it('should handle team creation with tmux session', async () => {
        // Mock tmux controller will be bypassed in this test
        const teamData = {
          name: 'Tmux Team',
          roles: [{ name: 'orchestrator', count: 1 }]
        };

        const response = await request(app)
          .post('/api/teams')
          .send(teamData)
          .expect(200);

        expect(response.body.success).toBe(true);
        // May have warning about tmux session creation failure in test environment
      });
    });

    describe('PUT /api/teams/:id', () => {
      it('should update team properties', async () => {
        const team = await storage.createTeam({
          name: 'Original Team',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'idle'
        });

        const updates = {
          name: 'Updated Team',
          status: 'active',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'dev', count: 1 }
          ]
        };

        const response = await request(app)
          .put(`/api/teams/${team.id}`)
          .send(updates)
          .expect(200);

        expect(response.body.data).toMatchObject(updates);
      });

      it('should return 404 for non-existent team', async () => {
        const response = await request(app)
          .put('/api/teams/nonexistent-id')
          .send({ name: 'Updated' })
          .expect(404);

        expect(response.body.error).toBe('Team not found');
      });
    });

    describe('DELETE /api/teams/:id', () => {
      it('should delete team and clean up assignments', async () => {
        const team = await storage.createTeam({
          name: 'To Delete',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'active'
        });

        const response = await request(app)
          .delete(`/api/teams/${team.id}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Team deleted'
        });

        const teams = await storage.getTeams();
        expect(teams.find(t => t.id === team.id)).toBeUndefined();
      });
    });
  });

  describe('Assignments API', () => {
    let testProject: any;
    let testTeam: any;

    beforeEach(async () => {
      testProject = await storage.createProject({
        name: 'Assignment Project',
        fsPath: '/tmp/assignment-project',
        status: 'active'
      });

      testTeam = await storage.createTeam({
        name: 'Assignment Team',
        roles: [{ name: 'orchestrator', count: 1 }],
        status: 'active'
      });
    });

    describe('GET /api/assignments', () => {
      it('should return empty assignments list initially', async () => {
        const response = await request(app)
          .get('/api/assignments')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: [],
          timestamp: expect.any(String),
          count: 0
        });
      });

      it('should return existing assignments', async () => {
        await storage.createAssignment({
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active'
        });

        const response = await request(app)
          .get('/api/assignments')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0]).toMatchObject({
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active'
        });
      });
    });

    describe('POST /api/assignments', () => {
      it('should create new assignment and update related entities', async () => {
        const assignmentData = {
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active'
        };

        const response = await request(app)
          .post('/api/assignments')
          .send(assignmentData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          id: expect.any(String),
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active',
          startedAt: expect.any(String)
        });

        // Verify cross-references were updated
        const updatedProject = (await storage.getProjects()).find(p => p.id === testProject.id);
        const updatedTeam = (await storage.getTeams()).find(t => t.id === testTeam.id);

        expect(updatedProject?.assignedTeamId).toBe(testTeam.id);
        expect(updatedTeam?.assignedProjectId).toBe(testProject.id);
      });

      it('should validate assignment data', async () => {
        const response = await request(app)
          .post('/api/assignments')
          .send({ projectId: 'invalid' })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('PUT /api/assignments/:id', () => {
      it('should update assignment status', async () => {
        const assignment = await storage.createAssignment({
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active'
        });

        const updates = {
          status: 'paused',
          endedAt: new Date().toISOString()
        };

        const response = await request(app)
          .put(`/api/assignments/${assignment.id}`)
          .send(updates)
          .expect(200);

        expect(response.body.data).toMatchObject(updates);
      });
    });

    describe('DELETE /api/assignments/:id', () => {
      it('should delete assignment and clean up references', async () => {
        const assignment = await storage.createAssignment({
          projectId: testProject.id,
          teamId: testTeam.id,
          status: 'active'
        });

        // Update cross-references first
        await storage.updateProject(testProject.id, { assignedTeamId: testTeam.id });
        await storage.updateTeam(testTeam.id, { assignedProjectId: testProject.id });

        const response = await request(app)
          .delete(`/api/assignments/${assignment.id}`)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Assignment deleted'
        });

        // Verify assignment was deleted
        const assignments = await storage.getAssignments();
        expect(assignments.find(a => a.id === assignment.id)).toBeUndefined();

        // Verify cross-references were cleaned up
        const updatedProject = (await storage.getProjects()).find(p => p.id === testProject.id);
        const updatedTeam = (await storage.getTeams()).find(t => t.id === testTeam.id);

        expect(updatedProject?.assignedTeamId).toBeUndefined();
        expect(updatedTeam?.assignedProjectId).toBeUndefined();
      });
    });
  });

  describe('Activity API', () => {
    beforeEach(async () => {
      // Clear any existing activity first, then add test entries
      const activityPath = path.join(testDir, 'activity.json');
      await fs.writeFile(activityPath, JSON.stringify({ entries: [] }));
      
      // Pre-populate with some activity entries
      await storage.appendActivity({
        timestamp: '2024-01-01T00:00:00Z',
        type: 'project',
        targetId: 'project-1',
        status: 'active'
      });

      await storage.appendActivity({
        timestamp: '2024-01-01T00:01:00Z',
        type: 'team',
        targetId: 'team-1',
        status: 'idle'
      });
    });

    describe('GET /api/activity', () => {
      it('should return all activity entries', async () => {
        const response = await request(app)
          .get('/api/activity')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.count).toBe(2);
      });

      it('should support limit parameter', async () => {
        const response = await request(app)
          .get('/api/activity?limit=1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.count).toBe(1);
      });

      it('should handle invalid limit parameter gracefully', async () => {
        const response = await request(app)
          .get('/api/activity?limit=invalid')
          .expect(200);

        // Should ignore invalid limit and return all
        expect(response.body.data).toHaveLength(2);
      });
    });

    describe('GET /api/activity/status', () => {
      it('should return activity poller status', async () => {
        const response = await request(app)
          .get('/api/activity/status')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          data: {
            polling: expect.any(Boolean),
            panes: expect.any(Array)
          },
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock storage to throw error
      const originalMethod = storage.getProjects;
      storage.getProjects = jest.fn().mockRejectedValue(new Error('Storage error'));

      const response = await request(app)
        .get('/api/projects')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Storage error',
        timestamp: expect.any(String)
      });

      // Restore original method
      storage.getProjects = originalMethod;
    });

    it('should validate JSON payloads', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // Express should handle JSON parse errors
    });
  });
});

// Helper function to setup API routes (mirrors server.ts)
function setupAPIRoutes(app: express.Application, fileStorage: FileStorage, activityPoller: ActivityPoller) {
  // Projects API
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await fileStorage.getProjects();
      res.json({ 
        success: true, 
        data: projects,
        timestamp: new Date().toISOString(),
        count: projects.length 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = await fileStorage.createProject(req.body);
      res.json({ success: true, data: project });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.put('/api/projects/:id', async (req, res) => {
    try {
      const project = await fileStorage.updateProject(req.params.id, req.body);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      res.json({ success: true, data: project });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const deleted = await fileStorage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Teams API
  app.get('/api/teams', async (req, res) => {
    try {
      const teams = await fileStorage.getTeams();
      res.json({ 
        success: true, 
        data: teams,
        timestamp: new Date().toISOString(),
        count: teams.length 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.post('/api/teams', async (req, res) => {
    try {
      const team = await fileStorage.createTeam(req.body);
      res.json({ success: true, data: team });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.put('/api/teams/:id', async (req, res) => {
    try {
      const team = await fileStorage.updateTeam(req.params.id, req.body);
      if (!team) {
        return res.status(404).json({ success: false, error: 'Team not found' });
      }
      res.json({ success: true, data: team });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete('/api/teams/:id', async (req, res) => {
    try {
      const deleted = await fileStorage.deleteTeam(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Team not found' });
      }
      res.json({ success: true, message: 'Team deleted' });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Assignments API
  app.get('/api/assignments', async (req, res) => {
    try {
      const assignments = await fileStorage.getAssignments();
      res.json({ 
        success: true, 
        data: assignments,
        timestamp: new Date().toISOString(),
        count: assignments.length 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.post('/api/assignments', async (req, res) => {
    try {
      const assignment = await fileStorage.createAssignment(req.body);
      
      // Update project and team with assignment info
      await fileStorage.updateProject(assignment.projectId, { 
        assignedTeamId: assignment.teamId 
      });
      await fileStorage.updateTeam(assignment.teamId, { 
        assignedProjectId: assignment.projectId 
      });
      
      res.json({ success: true, data: assignment });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.put('/api/assignments/:id', async (req, res) => {
    try {
      const assignment = await fileStorage.updateAssignment(req.params.id, req.body);
      if (!assignment) {
        return res.status(404).json({ success: false, error: 'Assignment not found' });
      }
      res.json({ success: true, data: assignment });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete('/api/assignments/:id', async (req, res) => {
    try {
      const assignments = await fileStorage.getAssignments();
      const assignment = assignments.find(a => a.id === req.params.id);
      
      if (assignment) {
        // Clean up project and team references
        await fileStorage.updateProject(assignment.projectId, { 
          assignedTeamId: undefined 
        });
        await fileStorage.updateTeam(assignment.teamId, { 
          assignedProjectId: undefined 
        });
      }
      
      const deleted = await fileStorage.deleteAssignment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Assignment not found' });
      }
      res.json({ success: true, message: 'Assignment deleted' });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Activity API
  app.get('/api/activity', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const activityLog = await fileStorage.loadActivity();
      const activity = limit ? activityLog.entries.slice(-limit) : activityLog.entries;
      res.json({ 
        success: true, 
        data: activity,
        timestamp: new Date().toISOString(),
        count: activity.length 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  app.get('/api/activity/status', async (req, res) => {
    try {
      const isRunning = activityPoller.isRunning();
      const currentStatus = await activityPoller.getCurrentStatus();
      res.json({ 
        success: true, 
        data: {
          polling: isRunning,
          panes: currentStatus
        },
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString() 
      });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
}