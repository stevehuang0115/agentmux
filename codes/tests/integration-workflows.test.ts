import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FileStorage } from '../src/services/FileStorage';
import { ActivityPoller } from '../src/services/ActivityPoller';

// Mock child_process for ActivityPoller
jest.mock('child_process');

describe('Integration Workflows', () => {
  let app: express.Application;
  let storage: FileStorage;
  let poller: ActivityPoller;
  let testDir: string;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), 'agentmux-integration-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    storage = new FileStorage(testDir);
    poller = new ActivityPoller(storage);
    
    // Setup Express app with all routes
    app = express();
    app.use(express.json({ limit: '1mb' }));
    
    setupFullAPIRoutes(app, storage, poller);
  });

  afterAll(async () => {
    poller.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Reset to clean state
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

    // Clear activity log
    const activityPath = path.join(testDir, 'activity.json');
    await fs.writeFile(activityPath, JSON.stringify({ entries: [] }));
  });

  describe('Complete Project-Team-Assignment Workflow', () => {
    it('should handle full lifecycle from creation to completion', async () => {
      // Step 1: Create a project
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Full Stack App',
          fsPath: '/tmp/fullstack-app',
          status: 'idle'
        })
        .expect(200);

      const project = projectResponse.body.data;
      expect(project).toMatchObject({
        id: expect.any(String),
        name: 'Full Stack App',
        fsPath: '/tmp/fullstack-app',
        status: 'idle'
      });

      // Step 2: Create a team with multiple roles
      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Development Team Alpha',
          roles: [
            { name: 'orchestrator', count: 1 },
            { name: 'pm', count: 1 },
            { name: 'dev', count: 2 },
            { name: 'qa', count: 1 }
          ],
          status: 'idle'
        })
        .expect(200);

      const team = teamResponse.body.data;
      expect(team).toMatchObject({
        id: expect.any(String),
        name: 'Development Team Alpha',
        roles: [
          { name: 'orchestrator', count: 1 },
          { name: 'pm', count: 1 },
          { name: 'dev', count: 2 },
          { name: 'qa', count: 1 }
        ],
        status: 'idle'
      });

      // Step 3: Assign team to project
      const assignmentResponse = await request(app)
        .post('/api/assignments')
        .send({
          projectId: project.id,
          teamId: team.id,
          status: 'active'
        })
        .expect(200);

      const assignment = assignmentResponse.body.data;
      expect(assignment).toMatchObject({
        id: expect.any(String),
        projectId: project.id,
        teamId: team.id,
        status: 'active',
        startedAt: expect.any(String)
      });

      // Step 4: Verify cross-references were created
      const updatedProjectResponse = await request(app)
        .get(`/api/projects`)
        .expect(200);

      const updatedProject = updatedProjectResponse.body.data.find((p: any) => p.id === project.id);
      expect(updatedProject.assignedTeamId).toBe(team.id);

      const updatedTeamResponse = await request(app)
        .get(`/api/teams`)
        .expect(200);

      const updatedTeam = updatedTeamResponse.body.data.find((t: any) => t.id === team.id);
      expect(updatedTeam.assignedProjectId).toBe(project.id);

      // Step 5: Update project status to active
      await request(app)
        .put(`/api/projects/${project.id}`)
        .send({ status: 'active' })
        .expect(200);

      // Step 6: Update team status to active
      await request(app)
        .put(`/api/teams/${team.id}`)
        .send({ status: 'active' })
        .expect(200);

      // Step 7: Pause the assignment
      await request(app)
        .put(`/api/assignments/${assignment.id}`)
        .send({ status: 'paused' })
        .expect(200);

      // Step 8: End the assignment
      const endTime = new Date().toISOString();
      const endedAssignmentResponse = await request(app)
        .put(`/api/assignments/${assignment.id}`)
        .send({ 
          status: 'ended',
          endedAt: endTime
        })
        .expect(200);

      expect(endedAssignmentResponse.body.data.status).toBe('ended');
      expect(endedAssignmentResponse.body.data.endedAt).toBe(endTime);

      // Step 9: Clean up - delete assignment (should clean up references)
      await request(app)
        .delete(`/api/assignments/${assignment.id}`)
        .expect(200);

      // Verify references were cleaned up
      const finalProjectResponse = await request(app).get(`/api/projects`).expect(200);
      const finalProject = finalProjectResponse.body.data.find((p: any) => p.id === project.id);
      expect(finalProject.assignedTeamId).toBeUndefined();

      const finalTeamResponse = await request(app).get(`/api/teams`).expect(200);
      const finalTeam = finalTeamResponse.body.data.find((t: any) => t.id === team.id);
      expect(finalTeam.assignedProjectId).toBeUndefined();

      // Step 10: Archive project
      await request(app)
        .put(`/api/projects/${project.id}`)
        .send({ status: 'archived' })
        .expect(200);

      // Step 11: Stop team
      await request(app)
        .put(`/api/teams/${team.id}`)
        .send({ status: 'stopped' })
        .expect(200);
    });

    it('should handle multiple concurrent assignments', async () => {
      // Create multiple projects and teams
      const projects = [];
      const teams = [];

      for (let i = 1; i <= 3; i++) {
        const projectResponse = await request(app)
          .post('/api/projects')
          .send({
            name: `Project ${i}`,
            fsPath: `/tmp/project-${i}`,
            status: 'active'
          })
          .expect(200);
        projects.push(projectResponse.body.data);

        const teamResponse = await request(app)
          .post('/api/teams')
          .send({
            name: `Team ${i}`,
            roles: [{ name: 'orchestrator', count: 1 }],
            status: 'active'
          })
          .expect(200);
        teams.push(teamResponse.body.data);
      }

      // Create assignments for each project-team pair
      const assignments = [];
      for (let i = 0; i < 3; i++) {
        const assignmentResponse = await request(app)
          .post('/api/assignments')
          .send({
            projectId: projects[i].id,
            teamId: teams[i].id,
            status: 'active'
          })
          .expect(200);
        assignments.push(assignmentResponse.body.data);
      }

      // Verify all assignments exist
      const allAssignmentsResponse = await request(app)
        .get('/api/assignments')
        .expect(200);

      expect(allAssignmentsResponse.body.data).toHaveLength(3);

      // Verify each assignment has correct cross-references
      for (let i = 0; i < 3; i++) {
        const projectResponse = await request(app).get('/api/projects').expect(200);
        const project = projectResponse.body.data.find((p: any) => p.id === projects[i].id);
        expect(project.assignedTeamId).toBe(teams[i].id);

        const teamResponse = await request(app).get('/api/teams').expect(200);
        const team = teamResponse.body.data.find((t: any) => t.id === teams[i].id);
        expect(team.assignedProjectId).toBe(projects[i].id);
      }
    });
  });

  describe('Data Consistency and Validation Workflows', () => {
    it('should prevent invalid assignments', async () => {
      // Try to create assignment with non-existent project
      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Valid Team',
          roles: [{ name: 'orchestrator', count: 1 }]
        })
        .expect(200);

      const invalidAssignmentResponse = await request(app)
        .post('/api/assignments')
        .send({
          projectId: 'nonexistent-project',
          teamId: teamResponse.body.data.id,
          status: 'active'
        })
        .expect(400);

      expect(invalidAssignmentResponse.body.success).toBe(false);
    });

    it('should validate team role requirements', async () => {
      // Try to create team without orchestrator role
      const invalidTeamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Invalid Team',
          roles: [{ name: 'dev', count: 2 }] // Missing orchestrator
        })
        .expect(400);

      expect(invalidTeamResponse.body.success).toBe(false);
      expect(invalidTeamResponse.body.error).toMatch(/orchestrator/i);
    });

    it('should maintain referential integrity during cascading deletes', async () => {
      // Create project, team, and assignment
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Cascade Test Project',
          fsPath: '/tmp/cascade-test',
          status: 'active'
        })
        .expect(200);

      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Cascade Test Team',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'active'
        })
        .expect(200);

      await request(app)
        .post('/api/assignments')
        .send({
          projectId: projectResponse.body.data.id,
          teamId: teamResponse.body.data.id,
          status: 'active'
        })
        .expect(200);

      // Delete project - should cascade delete assignments
      await request(app)
        .delete(`/api/projects/${projectResponse.body.data.id}`)
        .expect(200);

      // Verify assignment was deleted
      const assignmentsResponse = await request(app)
        .get('/api/assignments')
        .expect(200);

      expect(assignmentsResponse.body.data).toHaveLength(0);

      // Verify team still exists but has no assigned project
      const teamsResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      const team = teamsResponse.body.data.find((t: any) => t.id === teamResponse.body.data.id);
      expect(team).toBeDefined();
      expect(team.assignedProjectId).toBeUndefined();
    });
  });

  describe('Activity Monitoring Integration', () => {
    it('should track activity across project lifecycle', async () => {
      // Create project and team
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Activity Test Project',
          fsPath: '/tmp/activity-test',
          status: 'active'
        })
        .expect(200);

      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Activity Test Team',
          roles: [{ name: 'orchestrator', count: 1 }],
          status: 'active'
        })
        .expect(200);

      // Manually add some activity entries to simulate poller
      await storage.appendActivity({
        timestamp: new Date().toISOString(),
        type: 'project',
        targetId: projectResponse.body.data.id,
        status: 'active',
        metadata: { action: 'project_created' }
      });

      await storage.appendActivity({
        timestamp: new Date().toISOString(),
        type: 'team',
        targetId: teamResponse.body.data.id,
        status: 'active',
        metadata: { action: 'team_created' }
      });

      // Create assignment
      await request(app)
        .post('/api/assignments')
        .send({
          projectId: projectResponse.body.data.id,
          teamId: teamResponse.body.data.id,
          status: 'active'
        })
        .expect(200);

      await storage.appendActivity({
        timestamp: new Date().toISOString(),
        type: 'pane',
        targetId: teamResponse.body.data.id,
        status: 'active',
        metadata: { 
          action: 'assignment_created',
          projectId: projectResponse.body.data.id
        }
      });

      // Check activity log
      const activityResponse = await request(app)
        .get('/api/activity')
        .expect(200);

      expect(activityResponse.body.data).toHaveLength(3);
      expect(activityResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'project',
            targetId: projectResponse.body.data.id,
            status: 'active'
          }),
          expect.objectContaining({
            type: 'team', 
            targetId: teamResponse.body.data.id,
            status: 'active'
          }),
          expect.objectContaining({
            type: 'pane',
            targetId: teamResponse.body.data.id,
            status: 'active'
          })
        ])
      );
    });

    it('should provide activity status for monitoring', async () => {
      // Check initial poller status
      const statusResponse = await request(app)
        .get('/api/activity/status')
        .expect(200);

      expect(statusResponse.body).toEqual({
        success: true,
        data: {
          polling: expect.any(Boolean),
          panes: expect.any(Array)
        },
        timestamp: expect.any(String)
      });

      // Start poller if not already running
      if (!poller.isRunning()) {
        poller.start();
      }

      const runningStatusResponse = await request(app)
        .get('/api/activity/status')
        .expect(200);

      expect(runningStatusResponse.body.data.polling).toBe(true);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle partial failures gracefully', async () => {
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Error Test Project',
          fsPath: '/tmp/error-test',
          status: 'active'
        })
        .expect(200);

      // Mock a storage error during team creation
      const originalCreateTeam = storage.createTeam;
      storage.createTeam = jest.fn().mockRejectedValueOnce(new Error('Storage failed'));

      const teamResponse = await request(app)
        .post('/api/teams')
        .send({
          name: 'Error Test Team',
          roles: [{ name: 'orchestrator', count: 1 }]
        })
        .expect(400);

      expect(teamResponse.body.success).toBe(false);
      expect(teamResponse.body.error).toBe('Storage failed');

      // Restore original method
      storage.createTeam = originalCreateTeam;

      // Verify project still exists
      const projectsResponse = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(projectsResponse.body.data).toHaveLength(1);
      expect(projectsResponse.body.data[0].id).toBe(projectResponse.body.data.id);
    });

    it('should handle concurrent modifications', async () => {
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Concurrent Test',
          fsPath: '/tmp/concurrent',
          status: 'idle'
        })
        .expect(200);

      // Make multiple concurrent updates
      const updatePromises = [
        request(app)
          .put(`/api/projects/${projectResponse.body.data.id}`)
          .send({ status: 'active' }),
        request(app)
          .put(`/api/projects/${projectResponse.body.data.id}`)
          .send({ name: 'Updated Concurrent Test' }),
        request(app)
          .put(`/api/projects/${projectResponse.body.data.id}`)
          .send({ lastActivity: new Date().toISOString() })
      ];

      const results = await Promise.allSettled(updatePromises);

      // All updates should succeed (last writer wins)
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(200);
        }
      });

      // Verify final state
      const finalResponse = await request(app)
        .get('/api/projects')
        .expect(200);

      const finalProject = finalResponse.body.data[0];
      expect(finalProject.id).toBe(projectResponse.body.data.id);
    });

    it('should recover from invalid state transitions', async () => {
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'State Test Project',
          fsPath: '/tmp/state-test',
          status: 'active'
        })
        .expect(200);

      // Try invalid status transition
      const invalidUpdateResponse = await request(app)
        .put(`/api/projects/${projectResponse.body.data.id}`)
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(invalidUpdateResponse.body.success).toBe(false);

      // Verify project state wasn't corrupted
      const projectsResponse = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(projectsResponse.body.data[0].status).toBe('active');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle moderate data volumes efficiently', async () => {
      const startTime = Date.now();

      // Create multiple projects and teams
      const createPromises = [];
      
      for (let i = 1; i <= 20; i++) {
        createPromises.push(
          request(app)
            .post('/api/projects')
            .send({
              name: `Perf Test Project ${i}`,
              fsPath: `/tmp/perf-project-${i}`,
              status: 'active'
            })
        );

        createPromises.push(
          request(app)
            .post('/api/teams')
            .send({
              name: `Perf Test Team ${i}`,
              roles: [{ name: 'orchestrator', count: 1 }],
              status: 'active'
            })
        );
      }

      const results = await Promise.all(createPromises);
      const creationTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Should complete in reasonable time (adjust threshold as needed)
      expect(creationTime).toBeLessThan(5000); // 5 seconds

      // Verify data integrity
      const projectsResponse = await request(app).get('/api/projects').expect(200);
      const teamsResponse = await request(app).get('/api/teams').expect(200);

      expect(projectsResponse.body.data).toHaveLength(20);
      expect(teamsResponse.body.data).toHaveLength(20);
    });

    it('should maintain responsiveness under load', async () => {
      // Create some initial data
      const projectResponse = await request(app)
        .post('/api/projects')
        .send({
          name: 'Load Test Project',
          fsPath: '/tmp/load-test',
          status: 'active'
        })
        .expect(200);

      // Make many concurrent read requests
      const readPromises = [];
      for (let i = 0; i < 50; i++) {
        readPromises.push(request(app).get('/api/projects'));
        readPromises.push(request(app).get('/api/teams'));
        readPromises.push(request(app).get('/api/assignments'));
        readPromises.push(request(app).get('/api/activity'));
      }

      const startTime = Date.now();
      const results = await Promise.all(readPromises);
      const responseTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Should handle concurrent load efficiently
      expect(responseTime).toBeLessThan(3000); // 3 seconds for 200 requests
    });
  });
});

// Helper function to setup all API routes
function setupFullAPIRoutes(app: express.Application, fileStorage: FileStorage, activityPoller: ActivityPoller) {
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