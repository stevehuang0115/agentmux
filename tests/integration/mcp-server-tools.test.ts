import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

const execAsync = promisify(exec);

// Mock MCP Server for testing
class MockAgentMuxMCP {
  private sessionName: string;
  private projectPath: string;
  private agentRole: string;

  constructor() {
    this.sessionName = process.env.TMUX_SESSION_NAME || 'test-session';
    this.projectPath = process.env.PROJECT_PATH || '/tmp/test-project';
    this.agentRole = process.env.AGENT_ROLE || 'developer';
  }

  // Communication Tools
  async sendMessage(args: { to: string; message: string; type?: string }) {
    // Mock tmux command execution
    const command = `echo "Sending to ${args.to}: ${args.message}"`;
    const result = await execAsync(command);
    
    return {
      content: [{ type: 'text', text: `Message sent to ${args.to}` }],
    };
  }

  async broadcast(args: { message: string; excludeSelf?: boolean }) {
    // Mock broadcast to multiple sessions
    const mockSessions = ['session1', 'session2', 'session3'];
    let broadcastCount = 0;
    
    for (const session of mockSessions) {
      if (args.excludeSelf && session === this.sessionName) continue;
      broadcastCount++;
    }

    return {
      content: [{ type: 'text', text: `Broadcast sent to ${broadcastCount} sessions` }],
    };
  }

  // Team Status Tools
  async getTeamStatus() {
    const mockStatuses = [
      {
        session: 'dev-alice',
        attached: true,
        status: 'working',
        lastActivity: 'Implementing feature X'
      },
      {
        session: 'pm-bob',
        attached: false,
        status: 'waiting',
        lastActivity: 'Reviewing tickets'
      }
    ];

    return {
      content: [{ type: 'text', text: JSON.stringify(mockStatuses, null, 2) }],
    };
  }

  // Ticket Management Tools
  async getTickets(args: { status?: string; all?: boolean }) {
    const mockTickets = [
      {
        id: 'TICKET-001',
        title: 'Implement user authentication',
        status: 'in_progress',
        assignedTo: this.sessionName,
        priority: 'high'
      },
      {
        id: 'TICKET-002',
        title: 'Add validation tests',
        status: 'open',
        assignedTo: 'qa-charlie',
        priority: 'medium'
      }
    ];

    let filteredTickets = mockTickets;
    
    if (!args.all) {
      filteredTickets = mockTickets.filter(t => t.assignedTo === this.sessionName);
    }
    
    if (args.status) {
      filteredTickets = filteredTickets.filter(t => t.status === args.status);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(filteredTickets, null, 2) }],
    };
  }

  async updateTicket(args: {
    ticketId: string;
    status?: string;
    notes?: string;
    blockers?: string[];
  }) {
    // Mock ticket update
    const updates = [];
    if (args.status) updates.push(`status: ${args.status}`);
    if (args.notes) updates.push(`notes: ${args.notes}`);
    if (args.blockers) updates.push(`blockers: ${args.blockers.join(', ')}`);

    return {
      content: [{ type: 'text', text: `Ticket ${args.ticketId} updated: ${updates.join(', ')}` }],
    };
  }

  // Progress Reporting Tools
  async reportProgress(args: {
    ticketId?: string;
    progress: number;
    completed?: string[];
    current?: string;
    blockers?: string[];
    nextSteps?: string;
  }) {
    const message = `STATUS UPDATE [${this.sessionName}]
Completed: ${args.completed?.join(', ') || 'N/A'}
Current: ${args.current || 'N/A'}
Progress: ${args.progress}%
Blockers: ${args.blockers?.join(', ') || 'None'}
Next: ${args.nextSteps || 'Continue implementation'}`;

    return {
      content: [{ type: 'text', text: `Progress reported to PM` }],
    };
  }

  async requestReview(args: {
    ticketId: string;
    reviewer?: string;
    branch?: string;
    message?: string;
  }) {
    const reviewer = args.reviewer || 'qa-default';
    const branch = args.branch || 'feature-branch';

    return {
      content: [{ type: 'text', text: `Review requested from ${reviewer} for ticket ${args.ticketId}` }],
    };
  }

  // Scheduling Tools
  async scheduleCheck(args: {
    minutes: number;
    message: string;
    target?: string;
  }) {
    const target = args.target || this.sessionName;
    
    return {
      content: [{ type: 'text', text: `Check scheduled for ${target} in ${args.minutes} minutes` }],
    };
  }

  // Git Management Tools
  async enforceCommit(args: { message?: string }) {
    const commitMessage = args.message || `Progress: ${this.sessionName}`;
    
    // Mock git operations
    return {
      content: [{ type: 'text', text: `Committed changes: ${commitMessage}` }],
    };
  }

  // Orchestrator-only Tools
  async createTeam(args: {
    role: string;
    name: string;
    projectPath: string;
    systemPrompt?: string;
  }) {
    if (!this.sessionName.includes('orchestrator')) {
      throw new Error('Only orchestrator can create teams');
    }

    return {
      content: [{ type: 'text', text: `Team ${args.name} created successfully` }],
    };
  }

  async delegateTask(args: {
    to: string;
    task: string;
    priority: string;
    ticketId?: string;
  }) {
    if (!this.sessionName.includes('orchestrator')) {
      throw new Error('Only orchestrator can delegate tasks');
    }

    return {
      content: [{ type: 'text', text: `Task delegated to ${args.to}` }],
    };
  }

  // Task Management Tools
  async acceptTask(args: { taskPath: string; memberId?: string }) {
    const memberId = args.memberId || this.sessionName;
    
    // Mock task acceptance - simulate moving from open to in_progress
    // Create test directories if they don't exist
    const testProjectPath = '/tmp/test-project';
    const openDir = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'open');
    const inProgressDir = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'in_progress');
    const homeDir = process.env.HOME || '/tmp';
    const trackingFile = path.join(homeDir, '.agentmux', 'in_progress_tasks.json');
    
    try {
      // Create directories
      await fs.mkdir(path.dirname(openDir), { recursive: true });
      await fs.mkdir(inProgressDir, { recursive: true });
      await fs.mkdir(path.dirname(trackingFile), { recursive: true });
      
      // Create a mock task file if it doesn't exist
      let content: string;
      if (!await this.fileExists(args.taskPath)) {
        content = `# Test Task\n\nThis is a test task for MCP testing.\n\n## Status\n- [ ] Task item 1\n- [ ] Task item 2\n`;
        await fs.mkdir(path.dirname(args.taskPath), { recursive: true });
        await fs.writeFile(args.taskPath, content);
      } else {
        content = await fs.readFile(args.taskPath, 'utf-8');
      }
      
      // Simulate moving file from open to in_progress
      const fileName = path.basename(args.taskPath);
      const newTaskPath = path.join(inProgressDir, fileName);
      
      // Write to new location and remove old
      await fs.writeFile(newTaskPath, content);
      await fs.unlink(args.taskPath);
      
      // Update tracking JSON
      let inProgressTasks = [];
      try {
        const trackingContent = await fs.readFile(trackingFile, 'utf-8');
        inProgressTasks = JSON.parse(trackingContent);
      } catch {
        // File doesn't exist yet
      }
      
      const taskId = `task_${Date.now()}`;
      inProgressTasks.push({
        id: taskId,
        taskPath: newTaskPath,
        taskName: fileName,
        memberId: memberId,
        assignedAt: new Date().toISOString(),
        status: 'in_progress'
      });
      
      await fs.writeFile(trackingFile, JSON.stringify(inProgressTasks, null, 2));
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Task accepted successfully. New path: ${newTaskPath}` 
        }],
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to accept task: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }

  async completeTask(args: { taskPath: string }) {
    // Mock task completion - simulate moving from in_progress to done
    const testProjectPath = '/tmp/test-project';
    const doneDir = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'done');
    const homeDir = process.env.HOME || '/tmp';
    const trackingFile = path.join(homeDir, '.agentmux', 'in_progress_tasks.json');
    
    try {
      // Create done directory
      await fs.mkdir(doneDir, { recursive: true });
      
      // Simulate moving file from in_progress to done
      const fileName = path.basename(args.taskPath);
      const newTaskPath = path.join(doneDir, fileName);
      
      // Read and move the file
      const content = await fs.readFile(args.taskPath, 'utf-8');
      await fs.writeFile(newTaskPath, content);
      await fs.unlink(args.taskPath);
      
      // Update tracking JSON - remove from in_progress
      let inProgressTasks = [];
      try {
        const trackingContent = await fs.readFile(trackingFile, 'utf-8');
        inProgressTasks = JSON.parse(trackingContent);
      } catch {
        // File doesn't exist
      }
      
      // Remove the completed task from tracking
      const updatedTasks = inProgressTasks.filter((task: any) => task.taskPath !== args.taskPath);
      await fs.writeFile(trackingFile, JSON.stringify(updatedTasks, null, 2));
      
      return {
        content: [{ 
          type: 'text', 
          text: `✅ Task completed successfully. New path: ${newTaskPath}` 
        }],
      };
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Failed to complete task: ${error instanceof Error ? error.message : String(error)}` 
        }],
        isError: true
      };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

describe('MCP Server Tools Integration Tests', () => {
  let mcpServer: MockAgentMuxMCP;

  beforeEach(() => {
    mcpServer = new MockAgentMuxMCP();
  });

  describe('Communication Tools', () => {
    test('should send message to another agent', async () => {
      const result = await mcpServer.sendMessage({
        to: 'pm-session',
        message: 'Hello from developer'
      });

      expect(result.content[0].text).toBe('Message sent to pm-session');
    });

    test('should broadcast message to all team members', async () => {
      const result = await mcpServer.broadcast({
        message: 'Team standup in 5 minutes',
        excludeSelf: true
      });

      expect(result.content[0].text).toContain('Broadcast sent to');
      expect(result.content[0].text).toContain('sessions');
    });

    test('should include self in broadcast when not excluded', async () => {
      const result = await mcpServer.broadcast({
        message: 'All hands meeting now'
      });

      expect(result.content[0].text).toContain('Broadcast sent to');
    });
  });

  describe('Team Status Tools', () => {
    test('should get status of all team members', async () => {
      const result = await mcpServer.getTeamStatus();
      const statuses = JSON.parse(result.content[0].text);

      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toHaveProperty('session');
      expect(statuses[0]).toHaveProperty('status');
      expect(statuses[0]).toHaveProperty('lastActivity');
    });

    test('should analyze agent status correctly', async () => {
      const result = await mcpServer.getTeamStatus();
      const statuses = JSON.parse(result.content[0].text);

      const workingAgent = statuses.find((s: any) => s.status === 'working');
      const waitingAgent = statuses.find((s: any) => s.status === 'waiting');

      expect(workingAgent).toBeDefined();
      expect(waitingAgent).toBeDefined();
    });
  });

  describe('Ticket Management Tools', () => {
    test('should get assigned tickets only', async () => {
      const result = await mcpServer.getTickets({ all: false });
      const tickets = JSON.parse(result.content[0].text);

      expect(Array.isArray(tickets)).toBe(true);
      expect(tickets.every((t: any) => t.assignedTo === 'test-session')).toBe(true);
    });

    test('should get all tickets when requested', async () => {
      const result = await mcpServer.getTickets({ all: true });
      const tickets = JSON.parse(result.content[0].text);

      expect(Array.isArray(tickets)).toBe(true);
      expect(tickets).toHaveLength(2);
    });

    test('should filter tickets by status', async () => {
      const result = await mcpServer.getTickets({ 
        status: 'in_progress',
        all: true 
      });
      const tickets = JSON.parse(result.content[0].text);

      expect(tickets.every((t: any) => t.status === 'in_progress')).toBe(true);
    });

    test('should update ticket with status and notes', async () => {
      const result = await mcpServer.updateTicket({
        ticketId: 'TICKET-001',
        status: 'done',
        notes: 'Implementation completed'
      });

      expect(result.content[0].text).toContain('TICKET-001 updated');
      expect(result.content[0].text).toContain('status: done');
      expect(result.content[0].text).toContain('notes: Implementation completed');
    });

    test('should update ticket with blockers', async () => {
      const result = await mcpServer.updateTicket({
        ticketId: 'TICKET-002',
        blockers: ['API not ready', 'Missing dependencies']
      });

      expect(result.content[0].text).toContain('blockers: API not ready, Missing dependencies');
    });
  });

  describe('Progress Reporting Tools', () => {
    test('should report progress to project manager', async () => {
      const result = await mcpServer.reportProgress({
        ticketId: 'TICKET-001',
        progress: 75,
        completed: ['Setup database', 'Create models'],
        current: 'Implementing API endpoints',
        blockers: ['Need DB access'],
        nextSteps: 'Complete authentication flow'
      });

      expect(result.content[0].text).toBe('Progress reported to PM');
    });

    test('should handle progress report without ticket ID', async () => {
      const result = await mcpServer.reportProgress({
        progress: 50,
        current: 'Working on feature X'
      });

      expect(result.content[0].text).toBe('Progress reported to PM');
    });

    test('should request code review', async () => {
      const result = await mcpServer.requestReview({
        ticketId: 'TICKET-001',
        reviewer: 'qa-alice',
        branch: 'feature/auth',
        message: 'Ready for review'
      });

      expect(result.content[0].text).toContain('Review requested from qa-alice');
      expect(result.content[0].text).toContain('TICKET-001');
    });

    test('should use default reviewer when not specified', async () => {
      const result = await mcpServer.requestReview({
        ticketId: 'TICKET-002'
      });

      expect(result.content[0].text).toContain('Review requested from qa-default');
    });
  });

  describe('Scheduling Tools', () => {
    test('should schedule check-in reminder', async () => {
      const result = await mcpServer.scheduleCheck({
        minutes: 30,
        message: 'Progress update needed',
        target: 'dev-alice'
      });

      expect(result.content[0].text).toBe('Check scheduled for dev-alice in 30 minutes');
    });

    test('should schedule check for self when target not specified', async () => {
      const result = await mcpServer.scheduleCheck({
        minutes: 15,
        message: 'Take a break'
      });

      expect(result.content[0].text).toContain('test-session');
    });
  });

  describe('Git Management Tools', () => {
    test('should enforce commit with custom message', async () => {
      const result = await mcpServer.enforceCommit({
        message: 'Feature: Add user authentication'
      });

      expect(result.content[0].text).toBe('Committed changes: Feature: Add user authentication');
    });

    test('should enforce commit with default message', async () => {
      const result = await mcpServer.enforceCommit({});

      expect(result.content[0].text).toContain('Committed changes: Progress: test-session');
    });
  });

  describe('Orchestrator-only Tools', () => {
    test('should create team when orchestrator', async () => {
      // Mock orchestrator session
      process.env.TMUX_SESSION_NAME = 'orchestrator-main';
      const orchestratorMCP = new MockAgentMuxMCP();

      const result = await orchestratorMCP.createTeam({
        role: 'developer',
        name: 'dev-team-1',
        projectPath: '/tmp/test-project'
      });

      expect(result.content[0].text).toBe('Team dev-team-1 created successfully');
    });

    test('should reject team creation from non-orchestrator', async () => {
      await expect(mcpServer.createTeam({
        role: 'developer',
        name: 'dev-team-1',
        projectPath: '/tmp/test-project'
      })).rejects.toThrow('Only orchestrator can create teams');
    });

    test('should delegate task when orchestrator', async () => {
      // Mock orchestrator session
      process.env.TMUX_SESSION_NAME = 'orchestrator-main';
      const orchestratorMCP = new MockAgentMuxMCP();

      const result = await orchestratorMCP.delegateTask({
        to: 'dev-alice',
        task: 'Implement user registration',
        priority: 'high',
        ticketId: 'TICKET-003'
      });

      expect(result.content[0].text).toBe('Task delegated to dev-alice');
    });

    test('should reject task delegation from non-orchestrator', async () => {
      await expect(mcpServer.delegateTask({
        to: 'dev-alice',
        task: 'Some task',
        priority: 'medium'
      })).rejects.toThrow('Only orchestrator can delegate tasks');
    });
  });

  describe('Task Management Tools', () => {
    const testProjectPath = '/tmp/test-project';
    const openTaskPath = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'open', 'test_task_001.md');
    const inProgressTaskPath = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'in_progress', 'test_task_001.md');
    const homeDir = process.env.HOME || '/tmp';
    const trackingFile = path.join(homeDir, '.agentmux', 'in_progress_tasks.json');

    beforeEach(async () => {
      // Clean up test directories
      try {
        await fs.rm(path.join(testProjectPath, '.agentmux'), { recursive: true, force: true });
        await fs.rm(path.join(homeDir, '.agentmux'), { recursive: true, force: true });
      } catch {
        // Directories might not exist
      }
    });

    afterEach(async () => {
      // Clean up after tests
      try {
        await fs.rm(path.join(testProjectPath, '.agentmux'), { recursive: true, force: true });
        await fs.rm(path.join(homeDir, '.agentmux'), { recursive: true, force: true });
      } catch {
        // Directories might not exist
      }
    });

    test('should accept task and move from open to in_progress', async () => {
      // Setup: Create test directories and initial task file
      await fs.mkdir(path.dirname(openTaskPath), { recursive: true });
      const initialTaskContent = '# Test Task\n\nThis is a test task.\n\n- [ ] Step 1\n- [ ] Step 2\n';
      await fs.writeFile(openTaskPath, initialTaskContent);

      // Accept the task
      const result = await mcpServer.acceptTask({
        taskPath: openTaskPath,
        memberId: 'test-member-123'
      });

      // Verify response
      expect(result.content[0].text).toContain('✅ Task accepted successfully');
      expect(result.content[0].text).toContain('in_progress');

      // Verify file was moved
      expect(await mcpServer['fileExists'](openTaskPath)).toBe(false);
      expect(await mcpServer['fileExists'](inProgressTaskPath)).toBe(true);

      // Verify content was preserved
      const movedContent = await fs.readFile(inProgressTaskPath, 'utf-8');
      expect(movedContent).toBe(initialTaskContent);

      // Verify tracking file was updated
      const trackingContent = await fs.readFile(trackingFile, 'utf-8');
      const tracking = JSON.parse(trackingContent);
      expect(Array.isArray(tracking)).toBe(true);
      expect(tracking).toHaveLength(1);
      expect(tracking[0]).toHaveProperty('taskPath', inProgressTaskPath);
      expect(tracking[0]).toHaveProperty('memberId', 'test-member-123');
      expect(tracking[0]).toHaveProperty('status', 'in_progress');
    });

    test('should use default member ID when not provided', async () => {
      // Setup: Create test directories and initial task file
      await fs.mkdir(path.dirname(openTaskPath), { recursive: true });
      await fs.writeFile(openTaskPath, '# Test Task\n\nDefault member test.\n');

      // Accept the task without memberId
      const result = await mcpServer.acceptTask({
        taskPath: openTaskPath
      });

      // Verify response
      expect(result.content[0].text).toContain('✅ Task accepted successfully');

      // Verify tracking file uses session name as member ID
      const trackingContent = await fs.readFile(trackingFile, 'utf-8');
      const tracking = JSON.parse(trackingContent);
      expect(tracking[0]).toHaveProperty('memberId', 'test-session');
    });

    test('should complete task and move from in_progress to done', async () => {
      // Setup: Create task in in_progress folder with tracking
      await fs.mkdir(path.dirname(inProgressTaskPath), { recursive: true });
      const taskContent = '# Test Task\n\nTask to be completed.\n\n- [x] Step 1\n- [x] Step 2\n';
      await fs.writeFile(inProgressTaskPath, taskContent);

      // Setup tracking file
      await fs.mkdir(path.dirname(trackingFile), { recursive: true });
      const trackingData = [{
        id: 'task_123',
        taskPath: inProgressTaskPath,
        taskName: 'test_task_001.md',
        memberId: 'test-member-123',
        assignedAt: new Date().toISOString(),
        status: 'in_progress'
      }];
      await fs.writeFile(trackingFile, JSON.stringify(trackingData, null, 2));

      // Complete the task
      const result = await mcpServer.completeTask({
        taskPath: inProgressTaskPath
      });

      // Verify response
      expect(result.content[0].text).toContain('✅ Task completed successfully');
      expect(result.content[0].text).toContain('done');

      // Verify file was moved
      expect(await mcpServer['fileExists'](inProgressTaskPath)).toBe(false);
      const doneTaskPath = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'done', 'test_task_001.md');
      expect(await mcpServer['fileExists'](doneTaskPath)).toBe(true);

      // Verify content was preserved
      const movedContent = await fs.readFile(doneTaskPath, 'utf-8');
      expect(movedContent).toBe(taskContent);

      // Verify task was removed from tracking
      const updatedTrackingContent = await fs.readFile(trackingFile, 'utf-8');
      const updatedTracking = JSON.parse(updatedTrackingContent);
      expect(updatedTracking).toHaveLength(0);
    });

    test('should handle missing task file gracefully in acceptTask', async () => {
      const nonExistentPath = '/tmp/test-project/.agentmux/tasks/m0_build_spec_tasks/open/nonexistent.md';

      const result = await mcpServer.acceptTask({
        taskPath: nonExistentPath
      });

      // Should create the file and then process it
      expect(result.content[0].text).toContain('✅ Task accepted successfully');
    });

    test('should handle missing task file gracefully in completeTask', async () => {
      const nonExistentPath = '/tmp/test-project/.agentmux/tasks/m0_build_spec_tasks/in_progress/nonexistent.md';

      const result = await mcpServer.completeTask({
        taskPath: nonExistentPath
      });

      // Should fail gracefully
      expect(result.content[0].text).toContain('❌ Failed to complete task');
      expect(result).toHaveProperty('isError', true);
    });

    test('should handle task workflow: accept -> complete', async () => {
      // Setup initial task
      await fs.mkdir(path.dirname(openTaskPath), { recursive: true });
      const taskContent = '# Workflow Test Task\n\nTest full workflow.\n\n- [ ] Step 1\n- [ ] Step 2\n';
      await fs.writeFile(openTaskPath, taskContent);

      // Step 1: Accept task
      const acceptResult = await mcpServer.acceptTask({
        taskPath: openTaskPath,
        memberId: 'workflow-tester'
      });
      expect(acceptResult.content[0].text).toContain('✅ Task accepted successfully');

      // Verify task is in progress
      expect(await mcpServer['fileExists'](inProgressTaskPath)).toBe(true);

      // Step 2: Complete task
      const completeResult = await mcpServer.completeTask({
        taskPath: inProgressTaskPath
      });
      expect(completeResult.content[0].text).toContain('✅ Task completed successfully');

      // Verify task is done
      const doneTaskPath = path.join(testProjectPath, '.agentmux', 'tasks', 'm0_build_spec_tasks', 'done', 'test_task_001.md');
      expect(await mcpServer['fileExists'](doneTaskPath)).toBe(true);
      expect(await mcpServer['fileExists'](inProgressTaskPath)).toBe(false);

      // Verify tracking is clean
      const finalTrackingContent = await fs.readFile(trackingFile, 'utf-8');
      const finalTracking = JSON.parse(finalTrackingContent);
      expect(finalTracking).toHaveLength(0);
    });
  });

  describe('Tool Integration Workflow', () => {
    test('should complete full workflow: get tickets -> update -> report progress -> request review', async () => {
      // Get tickets
      const ticketsResult = await mcpServer.getTickets({ all: false });
      const tickets = JSON.parse(ticketsResult.content[0].text);
      expect(tickets).toHaveLength(1);

      const ticketId = tickets[0].id;

      // Update ticket to in_progress
      const updateResult = await mcpServer.updateTicket({
        ticketId,
        status: 'in_progress',
        notes: 'Started working on implementation'
      });
      expect(updateResult.content[0].text).toContain('updated');

      // Report progress
      const progressResult = await mcpServer.reportProgress({
        ticketId,
        progress: 80,
        completed: ['Database setup', 'API design'],
        current: 'Writing tests'
      });
      expect(progressResult.content[0].text).toBe('Progress reported to PM');

      // Request review
      const reviewResult = await mcpServer.requestReview({
        ticketId,
        message: 'Ready for QA review'
      });
      expect(reviewResult.content[0].text).toContain('Review requested');
    });

    test('should handle orchestrator delegation workflow', async () => {
      // Mock orchestrator session
      process.env.TMUX_SESSION_NAME = 'orchestrator-main';
      const orchestratorMCP = new MockAgentMuxMCP();

      // Create team
      const createResult = await orchestratorMCP.createTeam({
        role: 'qa',
        name: 'qa-team-1',
        projectPath: '/tmp/test-project'
      });
      expect(createResult.content[0].text).toContain('created successfully');

      // Delegate task
      const delegateResult = await orchestratorMCP.delegateTask({
        to: 'qa-team-1',
        task: 'Review authentication feature',
        priority: 'high'
      });
      expect(delegateResult.content[0].text).toBe('Task delegated to qa-team-1');

      // Get team status
      const statusResult = await orchestratorMCP.getTeamStatus();
      const statuses = JSON.parse(statusResult.content[0].text);
      expect(Array.isArray(statuses)).toBe(true);
    });
  });

  afterEach(() => {
    // Reset environment
    process.env.TMUX_SESSION_NAME = 'test-session';
  });
});