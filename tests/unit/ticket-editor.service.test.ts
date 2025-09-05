import { TicketEditorService } from '../../backend/src/services/ticket-editor.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

// Mock fs modules
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('TicketEditorService', () => {
  let ticketService: TicketEditorService;
  let testProjectPath: string;

  beforeEach(() => {
    testProjectPath = '/test/project/path';
    ticketService = new TicketEditorService(testProjectPath);
    jest.clearAllMocks();
  });

  describe('Ticket Creation', () => {
    test('should create a new ticket with all required fields', async () => {
      const ticketTemplate = {
        title: 'Test Ticket',
        description: 'This is a test ticket',
        priority: 'high' as const,
        status: 'open' as const,
        assignedTo: 'developer-1',
        tags: ['backend', 'api'],
        estimatedHours: 8
      };

      // Mock directory creation
      mockExistsSync.mockReturnValue(false);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      const result = await ticketService.createTicket(ticketTemplate);

      expect(result).toMatchObject({
        title: 'Test Ticket',
        description: 'This is a test ticket',
        priority: 'high',
        status: 'open',
        assignedTo: 'developer-1',
        tags: ['backend', 'api'],
        estimatedHours: 8,
        actualHours: 0
      });

      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.agentmux', 'tickets'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should create subtasks correctly', async () => {
      const ticketTemplate = {
        title: 'Test with Subtasks',
        description: 'Test ticket with subtasks',
        priority: 'medium' as const,
        status: 'in_progress' as const,
        subtasks: [
          { title: 'Subtask 1', completed: false },
          { title: 'Subtask 2', completed: true }
        ]
      };

      mockExistsSync.mockReturnValue(true);
      mockFs.writeFile.mockResolvedValue();

      const result = await ticketService.createTicket(ticketTemplate);

      expect((result as any).subtasks).toHaveLength(2);
      expect((result as any).subtasks[0]).toMatchObject({
        title: 'Subtask 1',
        completed: false
      });
      expect((result as any).subtasks[0].id).toBeDefined();
      expect((result as any).subtasks[1]).toMatchObject({
        title: 'Subtask 2',
        completed: true
      });
    });
  });

  describe('Ticket Retrieval', () => {
    test('should get a ticket by ID', async () => {
      const ticketId = 'test-ticket-id';
      const mockTicketData = {
        id: ticketId,
        title: 'Test Ticket',
        description: 'Test description',
        status: 'todo',
        priority: 'medium'
      };

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(`
id: ${ticketId}
title: Test Ticket
description: Test description
status: todo
priority: medium
`);

      const result = await ticketService.getTicket(ticketId);

      expect(result).toMatchObject({
        id: ticketId,
        title: 'Test Ticket',
        description: 'Test description',
        status: 'todo',
        priority: 'medium'
      });

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(testProjectPath, '.agentmux', 'tickets', `${ticketId}.yaml`),
        'utf-8'
      );
    });

    test('should return null for non-existent ticket', async () => {
      const ticketId = 'non-existent';
      mockExistsSync.mockReturnValue(false);

      const result = await ticketService.getTicket(ticketId);

      expect(result).toBeNull();
    });

    test('should handle file read errors gracefully', async () => {
      const ticketId = 'error-ticket';
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockRejectedValue(new Error('File read error'));

      const result = await ticketService.getTicket(ticketId);

      expect(result).toBeNull();
    });
  });

  describe('Ticket Updates', () => {
    test('should update ticket successfully', async () => {
      const ticketId = 'update-ticket-id';
      const existingTicket = {
        id: ticketId,
        title: 'Original Title',
        description: 'Original description',
        status: 'todo',
        priority: 'low',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const updates = {
        title: 'Updated Title',
        status: 'in_progress' as const,
        priority: 'high' as const
      };

      // Mock getting existing ticket
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(`
id: ${ticketId}
title: Original Title
description: Original description
status: todo
priority: low
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
`);
      mockFs.writeFile.mockResolvedValue();

      const result = await ticketService.updateTicket(ticketId, updates);

      expect(result).toMatchObject({
        id: ticketId,
        title: 'Updated Title',
        description: 'Original description', // unchanged
        status: 'in_progress',
        priority: 'high',
        createdAt: '2024-01-01T00:00:00.000Z'
      });

      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(
        new Date('2024-01-01T00:00:00.000Z').getTime()
      );

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should throw error for non-existent ticket update', async () => {
      const ticketId = 'non-existent';
      mockExistsSync.mockReturnValue(false);

      await expect(ticketService.updateTicket(ticketId, { title: 'New Title' }))
        .rejects.toThrow('Ticket non-existent not found');
    });
  });

  describe('Ticket Filtering', () => {
    test('should get all tickets with filters', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['ticket1.yaml', 'ticket2.yaml', 'ticket3.yaml', 'readme.txt'] as any);

      // Mock ticket files
      mockFs.readFile
        .mockResolvedValueOnce(`
id: ticket1
title: Frontend Task
status: todo
priority: high
assignedTo: frontend-dev
`)
        .mockResolvedValueOnce(`
id: ticket2
title: Backend Task
status: in-progress
priority: medium
assignedTo: backend-dev
`)
        .mockResolvedValueOnce(`
id: ticket3
title: QA Task
status: done
priority: high
assignedTo: qa-tester
`);

      // Test status filter
      const todoTickets = await ticketService.getAllTickets({ status: 'todo' });
      expect(todoTickets).toHaveLength(1);
      expect(todoTickets[0].title).toBe('Frontend Task');

      // Reset mocks and test priority filter
      jest.clearAllMocks();
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['ticket1.yaml', 'ticket2.yaml', 'ticket3.yaml'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(`
id: ticket1
title: Frontend Task
status: todo
priority: high
assignedTo: frontend-dev
`)
        .mockResolvedValueOnce(`
id: ticket2
title: Backend Task
status: in-progress
priority: medium
assignedTo: backend-dev
`)
        .mockResolvedValueOnce(`
id: ticket3
title: QA Task
status: done
priority: high
assignedTo: qa-tester
`);

      const highPriorityTickets = await ticketService.getAllTickets({ priority: 'high' });
      expect(highPriorityTickets).toHaveLength(2);
    });

    test('should return empty array when tickets directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      mockFs.mkdir.mockResolvedValue(undefined);

      const result = await ticketService.getAllTickets();

      expect(result).toEqual([]);
    });
  });

  describe('Subtask Management', () => {
    test('should add subtask to existing ticket', async () => {
      const ticketId = 'subtask-ticket';
      const existingTicket = {
        id: ticketId,
        title: 'Parent Ticket',
        description: 'Parent description',
        status: 'in-progress',
        priority: 'medium',
        subtasks: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(`
id: ${ticketId}
title: Parent Ticket
description: Parent description
status: in-progress
priority: medium
subtasks: []
createdAt: '2024-01-01T00:00:00.000Z'
updatedAt: '2024-01-01T00:00:00.000Z'
`);
      mockFs.writeFile.mockResolvedValue();

      const result = await ticketService.addSubtask(ticketId, 'New Subtask');

      expect((result as any).subtasks).toHaveLength(1);
      expect((result as any).subtasks[0]).toMatchObject({
        title: 'New Subtask',
        completed: false
      });
      expect((result as any).subtasks[0].id).toBeDefined();
    });

    test('should toggle subtask completion', async () => {
      const ticketId = 'toggle-ticket';
      const subtaskId = 'subtask-1';

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(`
id: ${ticketId}
title: Parent Ticket
subtasks:
  - id: ${subtaskId}
    title: Test Subtask
    completed: false
`);
      mockFs.writeFile.mockResolvedValue();

      const result = await ticketService.toggleSubtask(ticketId, subtaskId);

      expect((result as any).subtasks[0].completed).toBe(true);
    });
  });

  describe('Ticket Deletion', () => {
    test('should delete ticket successfully', async () => {
      const ticketId = 'delete-ticket';
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockResolvedValue();

      const result = await ticketService.deleteTicket(ticketId);

      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join(testProjectPath, '.agentmux', 'tickets', `${ticketId}.yaml`)
      );
    });

    test('should return false for non-existent ticket deletion', async () => {
      const ticketId = 'non-existent';
      mockExistsSync.mockReturnValue(false);

      const result = await ticketService.deleteTicket(ticketId);

      expect(result).toBe(false);
    });

    test('should handle deletion errors gracefully', async () => {
      const ticketId = 'error-ticket';
      mockExistsSync.mockReturnValue(true);
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));

      const result = await ticketService.deleteTicket(ticketId);

      expect(result).toBe(false);
    });
  });

  describe('Template Management', () => {
    test('should create ticket template', async () => {
      const templateName = 'bug-report';
      const template = {
        title: 'Bug Report Template',
        description: 'Template for bug reports',
        priority: 'medium' as const,
        status: 'open' as const,
        tags: ['bug', 'triage']
      };

      mockExistsSync.mockReturnValue(false);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      await ticketService.createTicketTemplate(templateName, template);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(testProjectPath, '.agentmux', 'tickets', 'templates'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(testProjectPath, '.agentmux', 'tickets', 'templates', `${templateName}.yaml`),
        expect.any(String),
        'utf-8'
      );
    });

    test('should get ticket template', async () => {
      const templateName = 'feature-request';
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(`
title: Feature Request Template
description: Template for feature requests
priority: low
status: todo
tags: [feature, enhancement]
`);

      const result = await ticketService.getTicketTemplate(templateName);

      expect(result).toMatchObject({
        title: 'Feature Request Template',
        description: 'Template for feature requests',
        priority: 'low',
        status: 'todo',
        tags: ['feature', 'enhancement']
      });
    });

    test('should get all templates', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue([
        'bug-report.yaml',
        'feature-request.yaml',
        'task.yaml',
        'readme.txt'
      ] as any);

      const result = await ticketService.getAllTemplates();

      expect(result).toEqual(['bug-report', 'feature-request', 'task']);
    });

    test('should return empty array when templates directory does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await ticketService.getAllTemplates();

      expect(result).toEqual([]);
    });
  });

  describe('Helper Methods', () => {
    test('should get tickets by assignee', async () => {
      const assignee = 'developer-1';
      
      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['ticket1.yaml'] as any);
      mockFs.readFile.mockResolvedValue(`
id: ticket1
title: Test Ticket
assignedTo: ${assignee}
status: in-progress
priority: medium
`);

      const result = await ticketService.getTicketsByAssignee(assignee);

      expect(result).toHaveLength(1);
      expect(result[0].assignedTo).toBe(assignee);
    });

    test('should get tickets by status', async () => {
      const status = 'done';

      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['ticket1.yaml'] as any);
      mockFs.readFile.mockResolvedValue(`
id: ticket1
title: Completed Ticket
status: ${status}
priority: low
`);

      const result = await ticketService.getTicketsByStatus(status);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(status);
    });

    test('should get tickets by priority', async () => {
      const priority = 'urgent';

      mockExistsSync.mockReturnValue(true);
      mockFs.readdir.mockResolvedValue(['ticket1.yaml'] as any);
      mockFs.readFile.mockResolvedValue(`
id: ticket1
title: Urgent Ticket
status: todo
priority: ${priority}
`);

      const result = await ticketService.getTicketsByPriority(priority);

      expect(result).toHaveLength(1);
      expect(result[0].priority).toBe(priority);
    });
  });
});