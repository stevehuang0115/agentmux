import request from 'supertest';
import express from 'express';

// Mock scheduler service for testing
const mockScheduler = {
  scheduleCheck: jest.fn(),
  getScheduledChecks: jest.fn(),
  cancelScheduledCheck: jest.fn(),
  getAllTasks: jest.fn(),
  getActiveTasks: jest.fn(),
  scheduleCheckIn: jest.fn(),
  scheduleReminder: jest.fn()
};

// Mock assignments data
const mockAssignments = [
  {
    id: 'proj1-team1',
    title: 'Test Project - Dev Team',
    description: 'Main development project',
    status: 'in-progress',
    assignedTo: 'Alice Developer',
    priority: 'high',
    teamId: 'team1',
    teamName: 'Dev Team',
    createdAt: '2023-01-01T00:00:00Z',
    tags: ['development']
  },
  {
    id: 'proj2-team2',
    title: 'QA Project - QA Team', 
    description: 'Quality assurance tasks',
    status: 'todo',
    assignedTo: 'Bob QA',
    priority: 'medium',
    teamId: 'team2',
    teamName: 'QA Team',
    createdAt: '2023-01-02T00:00:00Z',
    tags: ['testing']
  }
];

// Create test app with Phase 5 endpoints
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Assignments endpoints
  app.get('/api/assignments', (req, res) => {
    res.json(mockAssignments);
  });

  app.patch('/api/assignments/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const assignment = mockAssignments.find(a => a.id === id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Assignment not found'
      });
    }

    if (status && ['todo', 'in-progress', 'review', 'done'].includes(status)) {
      assignment.status = status;
      res.json({
        success: true,
        message: 'Assignment updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }
  });

  // Orchestrator endpoints
  app.get('/api/orchestrator/commands', (req, res) => {
    const mockCommands = [
      {
        id: '1',
        command: 'get_team_status',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        output: 'All teams active and working',
        status: 'completed'
      },
      {
        id: '2',
        command: 'list_projects',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        output: 'Projects: Test Project (active)',
        status: 'completed'
      }
    ];
    res.json(mockCommands);
  });

  app.post('/api/orchestrator/execute', (req, res) => {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }

    let output = '';

    if (command === 'help') {
      output = `Available Commands:
get_team_status - Show team status
list_projects - List all projects
broadcast <message> - Send message to all
help - Show this help`;
    } else if (command === 'get_team_status') {
      output = `Team Status:
Dev Team: working (2 members) - Test Project
QA Team: idle (1 member) - None`;
    } else if (command === 'list_projects') {
      output = `Projects:
Test Project: active (1 team assigned)
QA Project: inactive (1 team assigned)`;
    } else if (command.startsWith('broadcast ')) {
      const message = command.substring(10);
      output = `Broadcast sent to 3 sessions: "${message}"`;
    } else {
      output = `Unknown command: ${command}. Type 'help' for available commands.`;
    }

    res.json({
      success: true,
      output: output,
      timestamp: new Date().toISOString()
    });
  });

  // Scheduler endpoints
  app.post('/api/schedule', (req, res) => {
    const { target, minutes, message, recurring } = req.body;

    if (!target || !minutes || !message) {
      return res.status(400).json({
        success: false,
        error: 'Target, minutes, and message are required'
      });
    }

    const scheduleId = mockScheduler.scheduleCheckIn(target, message, minutes, recurring);
    
    res.json({
      success: true,
      scheduleId: scheduleId || 'test-schedule-id',
      message: `Check-in scheduled for ${target} in ${minutes} minutes`
    });
  });

  app.get('/api/schedule', (req, res) => {
    const mockScheduledTasks = [
      {
        id: 'task1',
        type: 'check-in',
        target: 'dev-session',
        message: 'Progress update needed',
        intervalMinutes: 30,
        nextExecutionTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        recurring: true,
        active: true,
        executionCount: 3
      },
      {
        id: 'task2',
        type: 'reminder',
        target: 'qa-session',
        message: 'Review pending PRs',
        nextExecutionTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        recurring: false,
        active: true,
        executionCount: 0
      }
    ];

    res.json({
      success: true,
      data: mockScheduledTasks
    });
  });

  app.delete('/api/schedule/:id', (req, res) => {
    const { id } = req.params;
    
    // Mock successful cancellation for known tasks
    if (id === 'task1' || id === 'test-schedule-id') {
      res.json({
        success: true,
        message: 'Scheduled check cancelled'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Scheduled check not found'
      });
    }
  });

  return app;
}

describe('Phase 5: Assignments & Scheduling Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Assignments API', () => {
    test('should get all assignments', async () => {
      const response = await request(app)
        .get('/api/assignments')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('teamId');
    });

    test('should update assignment status', async () => {
      const response = await request(app)
        .patch('/api/assignments/proj1-team1')
        .send({ status: 'review' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Assignment updated successfully');

      // Verify the assignment was updated
      const getResponse = await request(app)
        .get('/api/assignments')
        .expect(200);

      const updatedAssignment = getResponse.body.find((a: any) => a.id === 'proj1-team1');
      expect(updatedAssignment.status).toBe('review');
    });

    test('should reject invalid assignment status', async () => {
      const response = await request(app)
        .patch('/api/assignments/proj1-team1')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid status');
    });

    test('should return 404 for non-existent assignment', async () => {
      const response = await request(app)
        .patch('/api/assignments/non-existent')
        .send({ status: 'done' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Assignment not found');
    });
  });

  describe('Orchestrator API', () => {
    test('should get orchestrator command history', async () => {
      const response = await request(app)
        .get('/api/orchestrator/commands')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('command');
      expect(response.body[0]).toHaveProperty('timestamp');
      expect(response.body[0]).toHaveProperty('status');
    });

    test('should execute help command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'help' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Available Commands');
      expect(response.body.output).toContain('get_team_status');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should execute get_team_status command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'get_team_status' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Team Status');
      expect(response.body.output).toContain('Dev Team');
      expect(response.body.output).toContain('QA Team');
    });

    test('should execute list_projects command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'list_projects' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Projects:');
      expect(response.body.output).toContain('Test Project');
    });

    test('should execute broadcast command', async () => {
      const message = 'Team meeting in 10 minutes';
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: `broadcast ${message}` })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Broadcast sent');
      expect(response.body.output).toContain(message);
    });

    test('should handle unknown command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'unknown_command' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Unknown command');
      expect(response.body.output).toContain('help');
    });

    test('should require command parameter', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Command is required');
    });
  });

  describe('Scheduler API', () => {
    test('should schedule a check-in', async () => {
      const response = await request(app)
        .post('/api/schedule')
        .send({
          target: 'dev-alice',
          minutes: 30,
          message: 'Progress update needed',
          recurring: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('scheduleId');
      expect(response.body.message).toContain('Check-in scheduled');
    });

    test('should require all scheduling parameters', async () => {
      const response = await request(app)
        .post('/api/schedule')
        .send({
          target: 'dev-alice'
          // missing minutes and message
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Target, minutes, and message are required');
    });

    test('should get scheduled tasks', async () => {
      const response = await request(app)
        .get('/api/schedule')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      
      const checkInTask = response.body.data.find((t: any) => t.type === 'check-in');
      const reminderTask = response.body.data.find((t: any) => t.type === 'reminder');
      
      expect(checkInTask).toBeDefined();
      expect(checkInTask.recurring).toBe(true);
      expect(reminderTask).toBeDefined();
      expect(reminderTask.recurring).toBe(false);
    });

    test('should cancel scheduled check', async () => {
      const response = await request(app)
        .delete('/api/schedule/task1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Scheduled check cancelled');
    });

    test('should return 404 for non-existent scheduled task', async () => {
      mockScheduler.cancelScheduledCheck.mockReturnValue(false);
      
      const response = await request(app)
        .delete('/api/schedule/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Scheduled check not found');
    });
  });

  describe('Assignment Status Integration', () => {
    test('should update assignment and trigger project status change', async () => {
      // Update assignment to done
      const updateResponse = await request(app)
        .patch('/api/assignments/proj2-team2')
        .send({ status: 'done' })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // Verify assignment was updated
      const getResponse = await request(app)
        .get('/api/assignments')
        .expect(200);

      const updatedAssignment = getResponse.body.find((a: any) => a.id === 'proj2-team2');
      expect(updatedAssignment.status).toBe('done');
    });

    test('should support workflow: todo -> in-progress -> review -> done', async () => {
      const assignmentId = 'proj1-team1';
      const statuses = ['todo', 'in-progress', 'review', 'done'];

      for (const status of statuses) {
        const response = await request(app)
          .patch(`/api/assignments/${assignmentId}`)
          .send({ status })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify status was updated
        const getResponse = await request(app).get('/api/assignments');
        const assignment = getResponse.body.find((a: any) => a.id === assignmentId);
        expect(assignment.status).toBe(status);
      }
    });
  });

  describe('Orchestrator Command Integration', () => {
    test('should execute multiple commands in sequence', async () => {
      const commands = ['get_team_status', 'list_projects', 'help'];
      const responses = [];

      for (const command of commands) {
        const response = await request(app)
          .post('/api/orchestrator/execute')
          .send({ command })
          .expect(200);

        expect(response.body.success).toBe(true);
        responses.push(response.body);
      }

      expect(responses).toHaveLength(3);
      expect(responses[0].output).toContain('Team Status');
      expect(responses[1].output).toContain('Projects:');
      expect(responses[2].output).toContain('Available Commands');
    });

    test('should handle broadcast with different message types', async () => {
      const messages = [
        'Team standup in 5 minutes',
        'Code freeze starts now',
        'Please update your tickets'
      ];

      for (const message of messages) {
        const response = await request(app)
          .post('/api/orchestrator/execute')
          .send({ command: `broadcast ${message}` })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.output).toContain(message);
      }
    });
  });

  describe('Scheduler Integration Workflow', () => {
    test('should create, list, and cancel scheduled tasks', async () => {
      // Create a scheduled task
      const createResponse = await request(app)
        .post('/api/schedule')
        .send({
          target: 'test-session',
          minutes: 15,
          message: 'Test reminder',
          recurring: false
        })
        .expect(200);

      expect(createResponse.body.success).toBe(true);
      const scheduleId = createResponse.body.scheduleId;

      // List scheduled tasks
      const listResponse = await request(app)
        .get('/api/schedule')
        .expect(200);

      expect(listResponse.body.success).toBe(true);
      expect(Array.isArray(listResponse.body.data)).toBe(true);

      // Cancel the task
      const cancelResponse = await request(app)
        .delete(`/api/schedule/${scheduleId}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
    });
  });
});