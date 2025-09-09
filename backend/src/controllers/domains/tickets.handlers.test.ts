import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as ticketsHandlers from './tickets.handlers.js';
import type { ApiContext } from '../types.js';

jest.mock('../../services/ticket-editor.service.js', () => ({
  TicketEditorService: jest.fn().mockImplementation(() => ({
    createTicket: jest.fn(),
    getAllTickets: jest.fn(),
    getTicket: jest.fn(),
    updateTicket: jest.fn(),
    deleteTicket: jest.fn(),
    addSubtask: jest.fn(),
    toggleSubtask: jest.fn(),
    createTicketTemplate: jest.fn(),
    getAllTemplates: jest.fn(),
    getTicketTemplate: jest.fn()
  }))
}));

describe('Tickets Handlers', () => {
  let mockApiContext: Partial<ApiContext>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockStorageService: any;
  let mockTicketService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { TicketEditorService } = require('../../services/ticket-editor.service.js');
    mockTicketService = new TicketEditorService();

    mockStorageService = {
      getProjects: jest.fn()
    };

    mockApiContext = {
      storageService: mockStorageService
    } as any;

    mockRequest = {
      params: { projectId: 'project-1', ticketId: 'ticket-1', templateName: 'template-1', subtaskId: 'subtask-1' },
      body: { title: 'Test Ticket', description: 'Test Description' },
      query: { status: 'open', assignedTo: 'alice', priority: 'high' }
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('createTicket', () => {
    it('should create a ticket successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTicket = { id: 'ticket-1', title: 'Test Ticket' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.createTicket.mockResolvedValue(mockTicket);

      await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockStorageService.getProjects).toHaveBeenCalled();
      expect(mockTicketService.createTicket).toHaveBeenCalledWith(mockRequest.body);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });

    it('should return 404 when project not found', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });

    it('should handle service errors', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.createTicket.mockRejectedValue(new Error('Service error'));

      await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create ticket'
      });
    });
  });

  describe('getTickets', () => {
    it('should get tickets with filters successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTickets = [
        { id: 'ticket-1', title: 'Ticket 1' },
        { id: 'ticket-2', title: 'Ticket 2' }
      ];

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getAllTickets.mockResolvedValue(mockTickets);

      await ticketsHandlers.getTickets.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.getAllTickets).toHaveBeenCalledWith({
        status: 'open',
        assignedTo: 'alice',
        priority: 'high'
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTickets
      });
    });

    it('should return 404 when project not found', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      await ticketsHandlers.getTickets.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });
  });

  describe('getTicket', () => {
    it('should get a single ticket successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTicket = { id: 'ticket-1', title: 'Test Ticket' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getTicket.mockResolvedValue(mockTicket);

      await ticketsHandlers.getTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.getTicket).toHaveBeenCalledWith('ticket-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });

    it('should return 404 when ticket not found', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getTicket.mockResolvedValue(null);

      await ticketsHandlers.getTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found'
      });
    });
  });

  describe('updateTicket', () => {
    it('should update ticket successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockUpdatedTicket = { id: 'ticket-1', title: 'Updated Ticket' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.updateTicket.mockResolvedValue(mockUpdatedTicket);

      await ticketsHandlers.updateTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.updateTicket).toHaveBeenCalledWith('ticket-1', mockRequest.body);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedTicket
      });
    });

    it('should return 404 when ticket not found for update', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.updateTicket.mockResolvedValue(null);

      await ticketsHandlers.updateTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found'
      });
    });

    it('should handle update errors with custom message', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const error = new Error('Custom update error');

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.updateTicket.mockRejectedValue(error);

      await ticketsHandlers.updateTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Custom update error'
      });
    });
  });

  describe('deleteTicket', () => {
    it('should delete ticket successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.deleteTicket.mockResolvedValue(true);

      await ticketsHandlers.deleteTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.deleteTicket).toHaveBeenCalledWith('ticket-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { deleted: true }
      });
    });

    it('should return 404 when ticket not found for deletion', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.deleteTicket.mockResolvedValue(false);

      await ticketsHandlers.deleteTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found'
      });
    });
  });

  describe('addSubtask', () => {
    it('should add subtask successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTicketWithSubtask = { id: 'ticket-1', subtasks: [{ id: 'subtask-1', title: 'Test Subtask' }] };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.addSubtask.mockResolvedValue(mockTicketWithSubtask);

      mockRequest.body = { title: 'Test Subtask' };

      await ticketsHandlers.addSubtask.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.addSubtask).toHaveBeenCalledWith('ticket-1', 'Test Subtask');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicketWithSubtask
      });
    });

    it('should return 404 when ticket not found for subtask addition', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.addSubtask.mockResolvedValue(null);

      await ticketsHandlers.addSubtask.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket not found'
      });
    });
  });

  describe('toggleSubtask', () => {
    it('should toggle subtask successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTicket = { id: 'ticket-1', subtasks: [{ id: 'subtask-1', completed: true }] };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.toggleSubtask.mockResolvedValue(mockTicket);

      await ticketsHandlers.toggleSubtask.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.toggleSubtask).toHaveBeenCalledWith('ticket-1', 'subtask-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTicket
      });
    });

    it('should return 404 when ticket or subtask not found', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.toggleSubtask.mockResolvedValue(null);

      await ticketsHandlers.toggleSubtask.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Ticket or subtask not found'
      });
    });
  });

  describe('createTicketTemplate', () => {
    it('should create ticket template successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.createTicketTemplate.mockResolvedValue(undefined);

      await ticketsHandlers.createTicketTemplate.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.createTicketTemplate).toHaveBeenCalledWith('template-1', mockRequest.body);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { templateName: 'template-1', created: true }
      });
    });

    it('should return 404 when project not found for template creation', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      await ticketsHandlers.createTicketTemplate.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });
  });

  describe('getTicketTemplates', () => {
    it('should get all ticket templates successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTemplates = [
        { name: 'template-1', title: 'Template 1' },
        { name: 'template-2', title: 'Template 2' }
      ];

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getAllTemplates.mockResolvedValue(mockTemplates);

      await ticketsHandlers.getTicketTemplates.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.getAllTemplates).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplates
      });
    });

    it('should return 404 when project not found for template listing', async () => {
      mockStorageService.getProjects.mockResolvedValue([]);

      await ticketsHandlers.getTicketTemplates.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Project not found'
      });
    });
  });

  describe('getTicketTemplate', () => {
    it('should get ticket template successfully', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      const mockTemplate = { name: 'template-1', title: 'Template 1' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getTicketTemplate.mockResolvedValue(mockTemplate);

      await ticketsHandlers.getTicketTemplate.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTicketService.getTicketTemplate).toHaveBeenCalledWith('template-1');
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockTemplate
      });
    });

    it('should return 404 when template not found', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };

      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.getTicketTemplate.mockResolvedValue(null);

      await ticketsHandlers.getTicketTemplate.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template not found'
      });
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockStorageService.getProjects.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create ticket'
      });
    });

    it('should handle service initialization errors', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      mockStorageService.getProjects.mockResolvedValue([mockProject]);

      const { TicketEditorService } = require('../../services/ticket-editor.service.js');
      TicketEditorService.mockImplementation(() => {
        throw new Error('Service initialization error');
      });

      await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to create ticket'
      });
    });
  });

  describe('Context preservation', () => {
    it('should preserve context when handling tickets', async () => {
      const contextAwareController = {
        storageService: {
          getProjects: jest.fn().mockResolvedValue([{ id: 'project-1', path: '/test/path' }])
        }
      } as any;

      mockTicketService.createTicket.mockResolvedValue({ id: 'ticket-1' });

      await ticketsHandlers.createTicket.call(
        contextAwareController,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(contextAwareController.storageService.getProjects).toHaveBeenCalled();
    });
  });

  describe('All handlers availability', () => {
    it('should have all expected handler functions', () => {
      expect(typeof ticketsHandlers.createTicket).toBe('function');
      expect(typeof ticketsHandlers.getTickets).toBe('function');
      expect(typeof ticketsHandlers.getTicket).toBe('function');
      expect(typeof ticketsHandlers.updateTicket).toBe('function');
      expect(typeof ticketsHandlers.deleteTicket).toBe('function');
      expect(typeof ticketsHandlers.addSubtask).toBe('function');
      expect(typeof ticketsHandlers.toggleSubtask).toBe('function');
      expect(typeof ticketsHandlers.createTicketTemplate).toBe('function');
      expect(typeof ticketsHandlers.getTicketTemplates).toBe('function');
      expect(typeof ticketsHandlers.getTicketTemplate).toBe('function');
    });

    it('should handle async operations properly', async () => {
      const mockProject = { id: 'project-1', path: '/test/path' };
      mockStorageService.getProjects.mockResolvedValue([mockProject]);
      mockTicketService.createTicket.mockResolvedValue({ id: 'ticket-1' });

      const result = await ticketsHandlers.createTicket.call(
        mockApiContext as ApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(result).toBeUndefined();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'ticket-1' }
      });
    });
  });
});