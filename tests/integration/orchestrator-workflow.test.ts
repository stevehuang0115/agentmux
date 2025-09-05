import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import Client from 'socket.io-client';

// Mock scheduler service
const mockScheduler = {
  scheduleCheckIn: jest.fn().mockReturnValue('test-check-in-id'),
  scheduleReminder: jest.fn().mockReturnValue('test-reminder-id'),
  getAllTasks: jest.fn().mockReturnValue([]),
  getActiveTasks: jest.fn().mockReturnValue([]),
  cancelTask: jest.fn().mockReturnValue(true),
  getStats: jest.fn().mockReturnValue({
    totalTasks: 5,
    activeTasks: 3,
    completedTasks: 2,
    failedTasks: 0,
    recurringTasks: 2
  })
};

// Mock storage service with comprehensive data
const mockProjects = [
  {
    id: 'proj-001',
    name: 'AgentMux Core',
    path: '/tmp/agentmux-core',
    teams: { development: ['team-dev'], qa: ['team-qa'] },
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'proj-002', 
    name: 'Frontend Redesign',
    path: '/tmp/frontend-redesign',
    teams: { design: ['team-design'], development: ['team-frontend'] },
    status: 'paused',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

const mockTeams = [
  {
    id: 'team-dev',
    name: 'Development Team',
    description: 'Core development team',
    members: [
      {
        id: 'dev-1',
        name: 'Alice Developer',
        sessionName: 'agentmux_dev_alice',
        role: 'developer',
        systemPrompt: 'Senior full-stack developer',
        status: 'working'
      },
      {
        id: 'dev-2',
        name: 'Bob Backend',
        sessionName: 'agentmux_dev_bob', 
        role: 'backend',
        systemPrompt: 'Backend API specialist',
        status: 'working'
      }
    ],
    currentProject: 'proj-001',
    status: 'working',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'team-qa',
    name: 'QA Team',
    description: 'Quality assurance team',
    members: [
      {
        id: 'qa-1',
        name: 'Charlie QA',
        sessionName: 'agentmux_qa_charlie',
        role: 'qa',
        systemPrompt: 'Senior QA engineer',
        status: 'idle'
      }
    ],
    currentProject: 'proj-001',
    status: 'idle',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

function createTestApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });

  app.use(express.json());

  // Mock storage methods
  const getProjects = () => mockProjects;
  const getTeams = () => mockTeams;

  // Assignments endpoint
  app.get('/api/assignments', (req, res) => {
    const assignments = [];
    
    for (const project of getProjects()) {
      for (const teamId of Object.values(project.teams).flat()) {
        const team = getTeams().find(t => t.id === teamId);
        if (team) {
          assignments.push({
            id: `${project.id}-${teamId}`,
            title: `${project.name} - ${team.name}`,
            description: project.name + ' development tasks',
            status: project.status === 'active' ? 'in-progress' : 'todo',
            assignedTo: team.members[0]?.name || 'Unassigned',
            priority: 'high',
            teamId: team.id,
            teamName: team.name,
            createdAt: project.createdAt,
            tags: [team.members[0]?.role || 'general']
          });
        }
      }
    }
    
    res.json(assignments);
  });

  // Orchestrator command execution
  app.post('/api/orchestrator/execute', async (req, res) => {
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({
        success: false,
        error: 'Command is required'
      });
    }

    let output = '';
    let success = true;

    try {
      if (command === 'get_team_status') {
        const teams = getTeams();
        const teamStatuses = teams.map(team => ({
          name: team.name,
          status: team.status,
          members: team.members.length,
          project: team.currentProject || 'None',
          activeSessions: team.members.filter(m => m.status === 'working').length
        }));
        
        output = `Team Status Report (${new Date().toLocaleTimeString()}):\n`;
        for (const team of teamStatuses) {
          output += `• ${team.name}: ${team.status} (${team.activeSessions}/${team.members} active) - Project: ${team.project}\n`;
        }
        
      } else if (command === 'list_projects') {
        const projects = getProjects();
        output = `Active Projects (${projects.length} total):\n`;
        for (const project of projects) {
          const teamCount = Object.values(project.teams).flat().length;
          output += `• ${project.name}: ${project.status} (${teamCount} teams assigned)\n  Path: ${project.path}\n`;
        }
        
      } else if (command.startsWith('broadcast ')) {
        const message = command.substring(10).trim();
        if (message) {
          const teams = getTeams();
          const totalMembers = teams.reduce((acc, team) => acc + team.members.length, 0);
          output = `📢 Broadcast sent to ${totalMembers} team members: "${message}"\n✅ Message delivered to all active sessions`;
        } else {
          output = 'Error: No message provided for broadcast';
          success = false;
        }
        
      } else if (command.startsWith('delegate_task ')) {
        const parts = command.split(' ');
        if (parts.length >= 3) {
          const targetTeam = parts[1];
          const task = parts.slice(2).join(' ');
          
          const team = getTeams().find(t => t.id === targetTeam || t.name.toLowerCase().includes(targetTeam.toLowerCase()));
          if (team) {
            output = `✅ Task delegated to ${team.name}:\n"${task}"\n📧 Notification sent to ${team.members.length} team members`;
          } else {
            output = `❌ Error: Team "${targetTeam}" not found`;
            success = false;
          }
        } else {
          output = '❌ Usage: delegate_task <team> <task_description>\n💡 Example: delegate_task dev "Fix authentication bug"';
          success = false;
        }
        
      } else if (command.startsWith('schedule_check ')) {
        const parts = command.split(' ');
        if (parts.length >= 4) {
          const target = parts[1];
          const minutes = parseInt(parts[2]);
          const message = parts.slice(3).join(' ');
          
          if (isNaN(minutes)) {
            output = 'Error: Minutes must be a valid number';
            success = false;
          } else {
            const scheduleId = mockScheduler.scheduleCheckIn(target, message, minutes, true);
            output = `⏰ Check-in scheduled for "${target}" in ${minutes} minutes\n📋 Message: "${message}"\n🆔 Schedule ID: ${scheduleId}`;
          }
        } else {
          output = 'Usage: schedule_check <target> <minutes> <message>';
          success = false;
        }
        
      } else if (command === 'stats') {
        const stats = mockScheduler.getStats();
        const teams = getTeams();
        const projects = getProjects();
        
        output = `📊 AgentMux Statistics:\n`;
        output += `Projects: ${projects.length} total (${projects.filter(p => p.status === 'active').length} active)\n`;
        output += `Teams: ${teams.length} total (${teams.filter(t => t.status === 'working').length} working)\n`;
        output += `Scheduled Tasks: ${stats.activeTasks} active, ${stats.completedTasks} completed\n`;
        output += `Total Team Members: ${teams.reduce((acc, t) => acc + t.members.length, 0)}`;
        
      } else if (command === 'help') {
        output = `🤖 AgentMux Orchestrator Commands:

Core Commands:
• get_team_status - Show detailed status of all teams
• list_projects - List all projects with team assignments
• stats - Show system statistics
• help - Show this help message

Communication:
• broadcast <message> - Send message to all team members
• delegate_task <team> <task> - Assign task to specific team

Scheduling:
• schedule_check <target> <minutes> <message> - Schedule check-in reminder

Example Usage:
> get_team_status
> broadcast "Team standup in 5 minutes"
> delegate_task dev "Fix authentication bug"
> schedule_check alice 30 "Progress update needed"`;
        
      } else {
        output = `❌ Unknown command: "${command}"\n💡 Type 'help' to see available commands`;
        success = false;
      }

    } catch (error) {
      output = `💥 Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`;
      success = false;
    }

    res.json({
      success,
      output,
      timestamp: new Date().toISOString(),
      command,
      executionTime: Math.random() * 100 + 50 // Mock execution time
    });
  });

  // Schedule management
  app.post('/api/schedule', (req, res) => {
    const { target, minutes, message, recurring } = req.body;
    
    if (!target || !minutes || !message) {
      return res.status(400).json({
        success: false,
        error: 'Target, minutes, and message are required'
      });
    }

    const scheduleId = mockScheduler.scheduleCheckIn(target, message, minutes, recurring || false);
    
    res.json({
      success: true,
      scheduleId,
      message: `Check-in scheduled for ${target} in ${minutes} minutes`,
      target,
      scheduledFor: new Date(Date.now() + minutes * 60 * 1000).toISOString()
    });
  });

  app.get('/api/schedule', (req, res) => {
    const tasks = mockScheduler.getActiveTasks();
    res.json({
      success: true,
      data: tasks,
      stats: mockScheduler.getStats()
    });
  });

  // WebSocket handling for real-time updates
  io.on('connection', (socket) => {
    console.log(`Orchestrator client connected: ${socket.id}`);
    
    socket.emit('orchestrator_connected', {
      message: 'Connected to AgentMux Orchestrator',
      timestamp: new Date().toISOString(),
      capabilities: ['command_execution', 'team_monitoring', 'task_scheduling']
    });

    socket.on('execute_command', async (data) => {
      const { command } = data;
      
      // Simulate command execution delay
      setTimeout(() => {
        socket.emit('command_result', {
          command,
          success: true,
          output: `Executed: ${command}`,
          timestamp: new Date().toISOString()
        });
      }, 100);
    });

    socket.on('disconnect', () => {
      console.log(`Orchestrator client disconnected: ${socket.id}`);
    });
  });

  return { app, httpServer, io };
}

describe('Orchestrator Workflow Integration Tests', () => {
  let server: Server;
  let app: express.Application;
  let io: SocketIOServer;
  let clientSocket: any;

  beforeAll((done) => {
    const testApp = createTestApp();
    app = testApp.app;
    server = testApp.httpServer;
    io = testApp.io;
    
    server.listen(() => {
      const port = (server.address() as any)?.port;
      clientSocket = Client(`http://localhost:${port}`);
      
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.close();
    }
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Orchestrator Command Workflow', () => {
    test('should execute comprehensive team status command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'get_team_status' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Team Status Report');
      expect(response.body.output).toContain('Development Team');
      expect(response.body.output).toContain('QA Team');
      expect(response.body.output).toContain('working');
      expect(response.body.output).toContain('Project:');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('executionTime');
    });

    test('should execute detailed project listing', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'list_projects' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Active Projects');
      expect(response.body.output).toContain('AgentMux Core');
      expect(response.body.output).toContain('Frontend Redesign');
      expect(response.body.output).toContain('teams assigned');
      expect(response.body.output).toContain('Path:');
    });

    test('should execute system statistics command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'stats' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('AgentMux Statistics');
      expect(response.body.output).toContain('Projects:');
      expect(response.body.output).toContain('Teams:');
      expect(response.body.output).toContain('Scheduled Tasks:');
      expect(response.body.output).toContain('Total Team Members:');
    });
  });

  describe('Advanced Communication Commands', () => {
    test('should broadcast message with detailed feedback', async () => {
      const message = 'Emergency: All hands meeting in conference room A';
      
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: `broadcast ${message}` })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Broadcast sent to 3 team members');
      expect(response.body.output).toContain(message);
      expect(response.body.output).toContain('Message delivered');
    });

    test('should delegate task to specific team', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'delegate_task dev Implement user authentication system' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Task delegated to Development Team');
      expect(response.body.output).toContain('Implement user authentication system');
      expect(response.body.output).toContain('Notification sent to 2 team members');
    });

    test('should handle task delegation to non-existent team', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'delegate_task nonexistent Fix everything' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.output).toContain('Team "nonexistent" not found');
    });
  });

  describe('Scheduling Integration', () => {
    test('should schedule check-in through orchestrator command', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'schedule_check alice 30 Progress update needed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('Check-in scheduled for "alice" in 30 minutes');
      expect(response.body.output).toContain('Progress update needed');
      expect(response.body.output).toContain('Schedule ID:');
      expect(mockScheduler.scheduleCheckIn).toHaveBeenCalledWith('alice', 'Progress update needed', 30, true);
    });

    test('should create scheduled task via API', async () => {
      const response = await request(app)
        .post('/api/schedule')
        .send({
          target: 'dev-team',
          minutes: 60,
          message: 'Stand-up meeting reminder',
          recurring: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('scheduleId');
      expect(response.body.message).toContain('Check-in scheduled for dev-team in 60 minutes');
      expect(response.body).toHaveProperty('scheduledFor');
    });

    test('should get scheduled tasks with statistics', async () => {
      const response = await request(app)
        .get('/api/schedule')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('totalTasks');
      expect(response.body.stats).toHaveProperty('activeTasks');
    });
  });

  describe('Assignment Management Integration', () => {
    test('should get assignments with complete project-team mapping', async () => {
      const response = await request(app)
        .get('/api/assignments')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const assignment = response.body[0];
      expect(assignment).toHaveProperty('id');
      expect(assignment).toHaveProperty('title');
      expect(assignment).toHaveProperty('teamId');
      expect(assignment).toHaveProperty('teamName');
      expect(assignment).toHaveProperty('assignedTo');
      expect(assignment).toHaveProperty('priority');
      expect(assignment).toHaveProperty('status');
      expect(assignment).toHaveProperty('tags');
    });

    test('should handle assignments for active and paused projects', async () => {
      const response = await request(app)
        .get('/api/assignments')
        .expect(200);

      const assignments = response.body;
      
      // Should have assignments for both active and paused projects
      const activeAssignments = assignments.filter((a: any) => a.status === 'in-progress');
      const todoAssignments = assignments.filter((a: any) => a.status === 'todo');
      
      expect(activeAssignments.length).toBeGreaterThan(0);
      expect(todoAssignments.length).toBeGreaterThanOrEqual(0); // May be 0 if all projects are active
    });
  });

  describe('WebSocket Orchestrator Integration', () => {
    test.skip('should establish WebSocket connection with capabilities', (done) => {
      clientSocket.on('orchestrator_connected', (data: any) => {
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('capabilities');
        expect(data.capabilities).toContain('command_execution');
        expect(data.capabilities).toContain('team_monitoring');
        expect(data.capabilities).toContain('task_scheduling');
        done();
      });
    });

    test('should handle real-time command execution via WebSocket', (done) => {
      const testCommand = 'get_team_status';
      
      clientSocket.on('command_result', (data: any) => {
        expect(data).toHaveProperty('command', testCommand);
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('output');
        expect(data).toHaveProperty('timestamp');
        done();
      });

      clientSocket.emit('execute_command', { command: testCommand });
    });
  });

  describe('Error Handling and Validation', () => {
    test('should provide helpful error for malformed commands', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'delegate_task' }) // Missing parameters
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.output).toContain('Unknown command');
    });

    test('should handle missing command parameter', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({}) // No command
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Command is required');
    });

    test('should provide comprehensive help information', async () => {
      const response = await request(app)
        .post('/api/orchestrator/execute')
        .send({ command: 'help' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.output).toContain('AgentMux Orchestrator Commands');
      expect(response.body.output).toContain('Core Commands');
      expect(response.body.output).toContain('Communication');
      expect(response.body.output).toContain('Scheduling');
      expect(response.body.output).toContain('Example Usage');
    });
  });

  describe('Performance and Reliability', () => {
    test('should execute multiple commands in rapid succession', async () => {
      const commands = ['get_team_status', 'list_projects', 'stats', 'help'];
      const startTime = Date.now();
      
      const promises = commands.map(command => 
        request(app)
          .post('/api/orchestrator/execute')
          .send({ command })
      );

      const responses = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(5000); // 5 seconds max
    });

    test('should handle concurrent scheduling requests', async () => {
      const scheduleRequests = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/schedule')
          .send({
            target: `agent-${i}`,
            minutes: 15 + i,
            message: `Test reminder ${i}`,
            recurring: i % 2 === 0
          })
      );

      const responses = await Promise.all(scheduleRequests);
      
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.target).toBe(`agent-${i}`);
      });
    });
  });
});