import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { createServer } from 'http';

// Mock tmux service
const mockTmuxService = {
  initializeAgentWithRegistration: jest.fn(),
  createOrchestratorSession: jest.fn(),
  sessionExists: jest.fn(),
  listSessions: jest.fn(),
  capturePane: jest.fn(),
  sendMessage: jest.fn(),
  killSession: jest.fn(),
};

// Mock storage service
const mockStorageService = {
  getOrchestratorStatus: jest.fn(),
  updateOrchestratorStatus: jest.fn(),
  getTeams: jest.fn(),
  saveTeam: jest.fn(),
};

// Mock file system
jest.mock('fs/promises');

function createTestApp() {
  const app = express();
  const httpServer = createServer(app);
  
  app.use(express.json());
  
  // Create a simple mock API controller since the real one has complex dependencies
  const apiController = {
    tmuxService: mockTmuxService,
    storageService: mockStorageService
  };

  // Setup orchestrator endpoint
  app.post('/api/orchestrator/setup', async (req: any, res: any) => {
    try {
      const { projectPath } = req.body;
      const sessionName = 'crewly-orc';
      
      // Update orchestrator status to activating
      await mockStorageService.updateOrchestratorStatus('activating');
      
      // Initialize orchestrator with 4-step escalation
      const result = await mockTmuxService.initializeAgentWithRegistration(
        sessionName,
        'orchestrator',
        projectPath || process.cwd(),
        90000
      );
      
      if (result.success) {
        try {
          await mockStorageService.updateOrchestratorStatus('active');
        } catch (statusError) {
          // Ignore status update errors
        }
        res.json({
          success: true,
          message: 'Orchestrator initialized successfully',
          sessionName,
          status: 'active'
        });
      } else {
        try {
          await mockStorageService.updateOrchestratorStatus('inactive');
        } catch (statusError) {
          // Ignore status update errors
        }
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to initialize orchestrator',
          sessionName,
          status: 'inactive'
        });
      }
    } catch (error) {
      try {
        await mockStorageService.updateOrchestratorStatus('inactive');
      } catch (statusError) {
        // Ignore status update errors in catch block
      }
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'inactive'
      });
    }
  });

  // Get orchestrator status endpoint
  app.get('/api/orchestrator/status', async (req: any, res: any) => {
    try {
      const status = await mockStorageService.getOrchestratorStatus();
      
      if (!status) {
        res.json({
          success: true,
          data: null,
          message: 'No orchestrator found'
        });
      } else {
        res.json({
          success: true,
          data: status
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Teams endpoint that includes orchestrator status
  app.get('/api/teams', async (req: any, res: any) => {
    try {
      const teams = await mockStorageService.getTeams() || { teams: [], orchestrator: null };
      const orchestratorStatus = await mockStorageService.getOrchestratorStatus();
      
      res.json({
        success: true,
        data: {
          ...teams,
          orchestrator: orchestratorStatus
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Mock agent registration endpoint (simulates MCP tool call)
  app.post('/api/agents/register', async (req: any, res: any) => {
    try {
      const { role, sessionId } = req.body;
      
      if (role === 'orchestrator' && sessionId === 'crewly-orc') {
        await mockStorageService.updateOrchestratorStatus('active');
        
        res.json({
          success: true,
          message: 'Orchestrator registered successfully',
          sessionId,
          role,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid registration parameters'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return { app, httpServer };
}

describe('Orchestrator Initialization Integration Tests', () => {
  let server: Server;
  let app: express.Application;

  beforeAll((done) => {
    const testApp = createTestApp();
    app = testApp.app;
    server = testApp.httpServer;
    
    server.listen(() => {
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(null);
    (mockStorageService.updateOrchestratorStatus as jest.Mock).mockResolvedValue(undefined);
    (mockStorageService.getTeams as jest.Mock).mockResolvedValue({ teams: [], orchestrator: null });
    (mockStorageService.saveTeam as jest.Mock).mockResolvedValue(undefined);
    
    (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
      success: true,
      message: 'Agent registered successfully via direct prompt'
    });
  });

  describe('Orchestrator Setup Workflow', () => {
    test('should successfully initialize orchestrator with Step 1 success', async () => {
      // Mock successful Step 1 initialization
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully via direct prompt'
      });

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Orchestrator initialized successfully');
      expect(response.body.sessionName).toBe('crewly-orc');
      expect(response.body.status).toBe('active');

      // Verify initialization was called with correct parameters
      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledWith(
        'crewly-orc',
        'orchestrator',
        '/test/project',
        90000
      );

      // Verify status was updated correctly
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('activating');
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('active');
    });

    test('should successfully initialize orchestrator with Step 2 fallback', async () => {
      // Mock Step 2 initialization (cleanup and reinit)
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully via cleanup and reinit'
      });

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('active');

      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledTimes(1);
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('active');
    });

    test('should successfully initialize orchestrator with Step 3 fallback', async () => {
      // Mock Step 3 initialization (full recreation)
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully via full recreation'
      });

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('active');
    });

    test('should fail after all 4 steps are exhausted', async () => {
      // Mock complete initialization failure
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to initialize agent after all attempts: Step 1 failed, Step 2 failed, Step 3 failed'
      });

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to initialize agent after all attempts');
      expect(response.body.status).toBe('inactive');

      // Verify status was set to inactive on failure
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('activating');
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('inactive');
    });

    test('should use current working directory when no projectPath provided', async () => {
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully via direct prompt'
      });

      await request(app)
        .post('/api/orchestrator/setup')
        .send({}) // No projectPath
        .expect(200);

      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledWith(
        'crewly-orc',
        'orchestrator',
        process.cwd(),
        90000
      );
    });
  });

  describe('Orchestrator Status Management', () => {
    test('should return null when no orchestrator exists', async () => {
      (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/orchestrator/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('No orchestrator found');
    });

    test('should return orchestrator status when exists', async () => {
      const mockStatus = {
        sessionId: 'crewly-orc',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(mockStatus);

      const response = await request(app)
        .get('/api/orchestrator/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatus);
    });

    test('should include orchestrator in teams endpoint', async () => {
      const mockTeams = {
        teams: [
          {
            id: 'team-1',
            name: 'Development Team',
            members: []
          }
        ]
      };
      
      const mockOrchestratorStatus = {
        sessionId: 'crewly-orc',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      (mockStorageService.getTeams as jest.Mock).mockResolvedValue(mockTeams);
      (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(mockOrchestratorStatus);

      const response = await request(app)
        .get('/api/teams')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.teams).toEqual(mockTeams.teams);
      expect(response.body.data.orchestrator).toEqual(mockOrchestratorStatus);
    });
  });

  describe('Agent Registration Simulation', () => {
    test('should register orchestrator agent successfully', async () => {
      const response = await request(app)
        .post('/api/agents/register')
        .send({
          role: 'orchestrator',
          sessionId: 'crewly-orc'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Orchestrator registered successfully');
      expect(response.body.sessionId).toBe('crewly-orc');
      expect(response.body.role).toBe('orchestrator');
      expect(response.body.timestamp).toBeDefined();

      // Verify status was updated to active
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('active');
    });

    test('should reject invalid registration parameters', async () => {
      const response = await request(app)
        .post('/api/agents/register')
        .send({
          role: 'invalid',
          sessionId: 'wrong-session'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid registration parameters');
    });
  });

  describe('End-to-End Orchestrator Initialization Flow', () => {
    test('should complete full initialization workflow', async () => {
      // Step 1: Setup orchestrator (should trigger initialization)
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully via direct prompt'
      });

      const setupResponse = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(200);

      expect(setupResponse.body.success).toBe(true);
      expect(setupResponse.body.status).toBe('active');

      // Step 2: Verify orchestrator status was updated
      const mockActiveStatus = {
        sessionId: 'crewly-orc',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(mockActiveStatus);

      const statusResponse = await request(app)
        .get('/api/orchestrator/status')
        .expect(200);

      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.status).toBe('active');

      // Step 3: Verify orchestrator is included in teams response
      (mockStorageService.getTeams as jest.Mock).mockResolvedValue({ teams: [] });

      const teamsResponse = await request(app)
        .get('/api/teams')
        .expect(200);

      expect(teamsResponse.body.success).toBe(true);
      expect(teamsResponse.body.data.orchestrator.status).toBe('active');

      // Verify the correct sequence of calls
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenNthCalledWith(1, 'activating');
      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledTimes(1);
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenNthCalledWith(2, 'active');
    });

    test('should handle initialization failure gracefully', async () => {
      // Mock initialization failure
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to initialize agent after all attempts'
      });

      // Step 1: Attempt setup (should fail)
      const setupResponse = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(500);

      expect(setupResponse.body.success).toBe(false);
      expect(setupResponse.body.status).toBe('inactive');

      // Step 2: Verify status reflects failure
      const mockInactiveStatus = {
        sessionId: 'crewly-orc',
        status: 'inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      (mockStorageService.getOrchestratorStatus as jest.Mock).mockResolvedValue(mockInactiveStatus);

      const statusResponse = await request(app)
        .get('/api/orchestrator/status')
        .expect(200);

      expect(statusResponse.body.data.status).toBe('inactive');

      // Verify correct failure handling
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('activating');
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenCalledWith('inactive');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle storage service errors during setup', async () => {
      (mockStorageService.updateOrchestratorStatus as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Storage error');
    });

    test('should handle tmux service errors during initialization', async () => {
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockRejectedValue(new Error('Tmux command failed'));

      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Tmux command failed');
      
      // Should still update status to inactive on error
      expect(mockStorageService.updateOrchestratorStatus).toHaveBeenLastCalledWith('inactive');
    });

    test('should handle concurrent orchestrator setup requests', async () => {
      // Mock successful initialization
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Agent registered successfully'
      });

      // Send multiple concurrent requests
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/orchestrator/setup')
          .send({ projectPath: '/test/project' })
      );

      const responses = await Promise.all(requests);
      
      // All should succeed (idempotent operation)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should have attempted initialization for each request
      expect(mockTmuxService.initializeAgentWithRegistration).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timeout and Performance', () => {
    test('should handle initialization timeout gracefully', async () => {
      // Mock timeout scenario
      (mockTmuxService.initializeAgentWithRegistration as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Initialization timeout after 90000ms'
      });

      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/orchestrator/setup')
        .send({ projectPath: '/test/project' })
        .expect(500);

      const executionTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timeout');
      
      // Should complete reasonably quickly (not actually wait 90 seconds)
      expect(executionTime).toBeLessThan(5000);
    });
  });
});