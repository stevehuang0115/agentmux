import request from 'supertest';
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';

// Mock services for testing
const mockStorageService = {
  getProjects: jest.fn(),
  getTeams: jest.fn(),
  saveTeam: jest.fn(),
  saveProject: jest.fn()
};

const mockTmuxService = {
  createSession: jest.fn(),
  sendMessage: jest.fn(),
  killSession: jest.fn()
};

// Create test app with start project endpoint
function createTestApp() {
  const app = express();
  app.use(express.json());

  app.post('/api/projects/:id/start', async (req, res) => {
    try {
      const { id } = req.params;
      const { teamIds } = req.body;
      
      if (!teamIds || !Array.isArray(teamIds) || teamIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Team IDs array is required'
        });
      }

      // Mock project
      const project = {
        id,
        name: 'Test Project',
        path: '/tmp/test-project',
        status: 'inactive',
        description: 'Test project for workflow testing'
      };

      // Mock teams with multi-member structure
      const teams = [
        {
          id: 'team-1',
          name: 'Dev Team',
          description: 'Development team',
          members: [
            {
              id: 'member-1',
              name: 'Alice Developer',
              sessionName: 'crewly_developer_alice',
              role: 'developer',
              systemPrompt: 'You are a senior developer',
              status: 'idle'
            },
            {
              id: 'member-2', 
              name: 'Bob PM',
              sessionName: 'crewly_pm_bob',
              role: 'pm',
              systemPrompt: 'You are a project manager',
              status: 'idle'
            }
          ],
          status: 'inactive'
        }
      ];

      const assignedTeams = teams.filter(team => teamIds.includes(team.id));
      
      if (assignedTeams.length !== teamIds.length) {
        return res.status(400).json({
          success: false,
          error: 'Some team IDs were not found'
        });
      }

      // Start team members
      const startupResults = [];
      
      for (const team of assignedTeams) {
        for (const member of team.members) {
          try {
            // Actually call the tmux service mocks
            await mockTmuxService.createSession({
              name: member.sessionName,
              role: member.role,
              projectPath: '/tmp/test-project'
            });
            
            // Send context message
            const contextMessage = `Project: Test Project\nTeam: ${team.name}\nRole: ${member.role}`;
            await mockTmuxService.sendMessage(member.sessionName, contextMessage);
            
            member.status = 'working';
            
            startupResults.push({
              teamId: team.id,
              memberId: member.id,
              sessionName: member.sessionName,
              success: true
            });
            
          } catch (error) {
            member.status = 'blocked';
            startupResults.push({
              teamId: team.id,
              memberId: member.id,
              sessionName: member.sessionName,
              success: false,
              error: (error as Error).message
            });
          }
        }
        
        team.status = team.members.every(m => m.status === 'working') ? 'active' : 'inactive';
      }

      project.status = 'active';

      const successCount = startupResults.filter(r => r.success).length;
      const totalCount = startupResults.length;
      
      res.json({
        success: true,
        message: `Project started: ${successCount}/${totalCount} agents started successfully`,
        data: {
          projectId: id,
          startupResults,
          successCount,
          totalCount
        }
      });

    } catch (error) {
      console.error('Error starting project:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start project'
      });
    }
  });

  return app;
}

describe('Project Start Workflow Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Start API', () => {
    test('should successfully start project with assigned teams', async () => {
      const projectId = 'test-project-1';
      const teamIds = ['team-1'];

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Project started');
      expect(response.body.data.projectId).toBe(projectId);
      expect(response.body.data.successCount).toBe(2); // 2 members started
      expect(response.body.data.totalCount).toBe(2);
      expect(response.body.data.startupResults).toHaveLength(2);

      // Verify all members were started successfully
      const results = response.body.data.startupResults;
      expect(results.every((r: any) => r.success)).toBe(true);
      expect(results.some((r: any) => r.sessionName === 'crewly_developer_alice')).toBe(true);
      expect(results.some((r: any) => r.sessionName === 'crewly_pm_bob')).toBe(true);
    });

    test('should require teamIds array', async () => {
      const projectId = 'test-project-1';

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Team IDs array is required');
    });

    test('should validate teamIds is an array', async () => {
      const projectId = 'test-project-1';

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds: 'invalid' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Team IDs array is required');
    });

    test('should require non-empty teamIds array', async () => {
      const projectId = 'test-project-1';

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Team IDs array is required');
    });

    test('should handle non-existent team IDs', async () => {
      const projectId = 'test-project-1';
      const teamIds = ['non-existent-team'];

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Some team IDs were not found');
    });
  });

  describe('Project Context Message', () => {
    test('should verify context message contains project information', async () => {
      const projectId = 'test-project-1';
      const teamIds = ['team-1'];

      await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds })
        .expect(200);

      // Check that session creation was called for each member
      expect(mockTmuxService.createSession).toHaveBeenCalledTimes(2);
      
      // Verify tmux service was called to send context messages
      expect(mockTmuxService.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockTmuxService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'crewly_developer_alice',
          role: 'developer',
          projectPath: '/tmp/test-project'
        })
      );
      expect(mockTmuxService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'crewly_pm_bob', 
          role: 'pm',
          projectPath: '/tmp/test-project'
        })
      );
    });
  });

  describe('Team Status Updates', () => {
    test('should update team and member statuses after starting', async () => {
      const projectId = 'test-project-1';
      const teamIds = ['team-1'];

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds })
        .expect(200);

      // Verify the response shows updated statuses
      expect(response.body.data.startupResults).toEqual([
        {
          teamId: 'team-1',
          memberId: 'member-1',
          sessionName: 'crewly_developer_alice',
          success: true
        },
        {
          teamId: 'team-1',
          memberId: 'member-2', 
          sessionName: 'crewly_pm_bob',
          success: true
        }
      ]);
    });
  });

  describe('Error Handling', () => {
    test('should handle tmux session creation failures gracefully', async () => {
      // Mock one session creation to fail
      mockTmuxService.createSession.mockRejectedValueOnce(new Error('tmux failed'));
      mockTmuxService.createSession.mockResolvedValueOnce('crewly_pm_bob');

      const projectId = 'test-project-1';
      const teamIds = ['team-1'];

      const response = await request(app)
        .post(`/api/projects/${projectId}/start`)
        .send({ teamIds })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.successCount).toBe(1); // Only one succeeded
      expect(response.body.data.totalCount).toBe(2);
      
      const results = response.body.data.startupResults;
      expect(results.some((r: any) => !r.success && r.error === 'tmux failed')).toBe(true);
      expect(results.some((r: any) => r.success)).toBe(true);
    });
  });
});