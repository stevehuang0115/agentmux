/**
 * Knowledge Controller Tests
 *
 * Tests for the REST controller functions that handle HTTP requests
 * for the Company Knowledge document system.
 *
 * @module controllers/knowledge/knowledge.controller.test
 */

import type { Request, Response, NextFunction } from 'express';
import {
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  listCategories,
} from './knowledge.controller.js';

// Mock dependencies
jest.mock('../../services/knowledge/knowledge.service.js', () => {
  const mockService = {
    createDocument: jest.fn(),
    listDocuments: jest.fn(),
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
    deleteDocument: jest.fn(),
    listCategories: jest.fn(),
  };
  return {
    KnowledgeService: {
      getInstance: () => mockService,
    },
  };
});

jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      }),
    }),
  },
}));

import { KnowledgeService } from '../../services/knowledge/knowledge.service.js';

/**
 * Create a mock Express Request object.
 *
 * @param overrides - Properties to override on the default request
 * @returns Mocked Request
 */
const mockReq = (overrides = {}): Request =>
  ({
    params: {},
    query: {},
    body: {},
    ...overrides,
  }) as unknown as Request;

/**
 * Create a mock Express Response object with jest.fn() spies.
 *
 * @returns Mocked Response with status and json spies
 */
const mockRes = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe('Knowledge Controller', () => {
  let mockNext: NextFunction;
  let mockKnowledgeService: ReturnType<typeof KnowledgeService.getInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn() as NextFunction;
    mockKnowledgeService = KnowledgeService.getInstance();
  });

  describe('createDocument', () => {
    it('should create a document and return 201 with id', async () => {
      const req = mockReq({
        body: {
          title: 'Test Doc',
          content: 'Test content',
          category: 'SOPs',
          scope: 'global',
          tags: ['test'],
          createdBy: 'tester',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.createDocument as jest.Mock).mockResolvedValue('new-doc-id');

      await createDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'new-doc-id' },
      });
    });

    it('should return 400 if title is missing', async () => {
      const req = mockReq({
        body: {
          content: 'Some content',
        },
      });
      const res = mockRes();

      await createDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Missing required parameters'),
        }),
      );
    });

    it('should return 400 if content is missing', async () => {
      const req = mockReq({
        body: {
          title: 'Valid Title',
        },
      });
      const res = mockRes();

      await createDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Missing required parameters'),
        }),
      );
    });

    it('should return 400 when service throws a "required" error', async () => {
      const req = mockReq({
        body: {
          title: 'Doc',
          content: 'Content',
          scope: 'project',
          // Missing projectPath
        },
      });
      const res = mockRes();

      (mockKnowledgeService.createDocument as jest.Mock).mockRejectedValue(
        new Error('projectPath is required for project scope'),
      );

      await createDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('required'),
        }),
      );
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        body: {
          title: 'Doc',
          content: 'Content',
        },
      });
      const res = mockRes();

      const unexpectedError = new Error('Disk I/O failure');
      (mockKnowledgeService.createDocument as jest.Mock).mockRejectedValue(unexpectedError);

      await createDocument(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });

    it('should use default values for optional fields', async () => {
      const req = mockReq({
        body: {
          title: 'Minimal Doc',
          content: 'Minimal content',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.createDocument as jest.Mock).mockResolvedValue('minimal-id');

      await createDocument(req, res, mockNext);

      expect(mockKnowledgeService.createDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Minimal Doc',
          content: 'Minimal content',
          category: 'General',
          scope: 'global',
          tags: [],
          createdBy: 'user',
        }),
      );
    });
  });

  describe('listDocuments', () => {
    it('should return list of documents', async () => {
      const req = mockReq({
        query: {},
      });
      const res = mockRes();

      const mockDocs = [
        { id: 'doc-1', title: 'Doc 1', scope: 'global' },
        { id: 'doc-2', title: 'Doc 2', scope: 'global' },
      ];
      (mockKnowledgeService.listDocuments as jest.Mock).mockResolvedValue(mockDocs);

      await listDocuments(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDocs,
      });
    });

    it('should pass category and search filters', async () => {
      const req = mockReq({
        query: {
          category: 'SOPs',
          search: 'deploy',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.listDocuments as jest.Mock).mockResolvedValue([]);

      await listDocuments(req, res, mockNext);

      expect(mockKnowledgeService.listDocuments).toHaveBeenCalledWith(
        'global',
        undefined,
        {
          category: 'SOPs',
          search: 'deploy',
        },
      );
    });

    it('should return 400 if project scope without projectPath', async () => {
      const req = mockReq({
        query: {
          scope: 'project',
        },
      });
      const res = mockRes();

      await listDocuments(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('projectPath is required'),
        }),
      );
    });

    it('should pass projectPath for project-scoped queries', async () => {
      const req = mockReq({
        query: {
          scope: 'project',
          projectPath: '/my/project',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.listDocuments as jest.Mock).mockResolvedValue([]);

      await listDocuments(req, res, mockNext);

      expect(mockKnowledgeService.listDocuments).toHaveBeenCalledWith(
        'project',
        '/my/project',
        expect.any(Object),
      );
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        query: {},
      });
      const res = mockRes();

      const error = new Error('Index read failure');
      (mockKnowledgeService.listDocuments as jest.Mock).mockRejectedValue(error);

      await listDocuments(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDocument', () => {
    it('should return document when found', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: {},
      });
      const res = mockRes();

      const mockDoc = {
        id: 'doc-1',
        title: 'Found Doc',
        content: 'Document content',
        scope: 'global',
      };
      (mockKnowledgeService.getDocument as jest.Mock).mockResolvedValue(mockDoc);

      await getDocument(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDoc,
      });
    });

    it('should return 404 when not found', async () => {
      const req = mockReq({
        params: { id: 'nonexistent' },
        query: {},
      });
      const res = mockRes();

      (mockKnowledgeService.getDocument as jest.Mock).mockResolvedValue(null);

      await getDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Document not found',
        }),
      );
    });

    it('should return 400 for project scope without projectPath', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: { scope: 'project' },
      });
      const res = mockRes();

      await getDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('projectPath is required'),
        }),
      );
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: {},
      });
      const res = mockRes();

      const error = new Error('Read error');
      (mockKnowledgeService.getDocument as jest.Mock).mockRejectedValue(error);

      await getDocument(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDocument', () => {
    it('should update and return success', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        body: {
          title: 'Updated Title',
          content: 'Updated content',
          scope: 'global',
          updatedBy: 'admin',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.updateDocument as jest.Mock).mockResolvedValue(undefined);

      await updateDocument(req, res, mockNext);

      expect(mockKnowledgeService.updateDocument).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({
          title: 'Updated Title',
          content: 'Updated content',
          scope: 'global',
          updatedBy: 'admin',
        }),
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 when document not found', async () => {
      const req = mockReq({
        params: { id: 'nonexistent' },
        body: {
          title: 'Updated',
          scope: 'global',
          updatedBy: 'user',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.updateDocument as jest.Mock).mockRejectedValue(
        new Error("Document 'nonexistent' not found"),
      );

      await updateDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not found'),
        }),
      );
    });

    it('should return 400 for project scope without projectPath', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        body: {
          title: 'Updated',
          scope: 'project',
          updatedBy: 'user',
        },
      });
      const res = mockRes();

      await updateDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('projectPath is required'),
        }),
      );
    });

    it('should use default updatedBy when not provided', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        body: {
          title: 'Updated',
          scope: 'global',
        },
      });
      const res = mockRes();

      (mockKnowledgeService.updateDocument as jest.Mock).mockResolvedValue(undefined);

      await updateDocument(req, res, mockNext);

      expect(mockKnowledgeService.updateDocument).toHaveBeenCalledWith(
        'doc-1',
        expect.objectContaining({
          updatedBy: 'user',
        }),
      );
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        body: {
          title: 'Updated',
          scope: 'global',
          updatedBy: 'user',
        },
      });
      const res = mockRes();

      const error = new Error('Write failure');
      (mockKnowledgeService.updateDocument as jest.Mock).mockRejectedValue(error);

      await updateDocument(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteDocument', () => {
    it('should delete and return success', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: {},
      });
      const res = mockRes();

      (mockKnowledgeService.deleteDocument as jest.Mock).mockResolvedValue(undefined);

      await deleteDocument(req, res, mockNext);

      expect(mockKnowledgeService.deleteDocument).toHaveBeenCalledWith('doc-1', 'global', undefined);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 when document not found', async () => {
      const req = mockReq({
        params: { id: 'nonexistent' },
        query: {},
      });
      const res = mockRes();

      (mockKnowledgeService.deleteDocument as jest.Mock).mockRejectedValue(
        new Error("Document 'nonexistent' not found"),
      );

      await deleteDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('not found'),
        }),
      );
    });

    it('should return 400 for project scope without projectPath', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: { scope: 'project' },
      });
      const res = mockRes();

      await deleteDocument(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('projectPath is required'),
        }),
      );
    });

    it('should pass projectPath for project-scoped deletes', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: { scope: 'project', projectPath: '/my/project' },
      });
      const res = mockRes();

      (mockKnowledgeService.deleteDocument as jest.Mock).mockResolvedValue(undefined);

      await deleteDocument(req, res, mockNext);

      expect(mockKnowledgeService.deleteDocument).toHaveBeenCalledWith(
        'doc-1',
        'project',
        '/my/project',
      );
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        params: { id: 'doc-1' },
        query: {},
      });
      const res = mockRes();

      const error = new Error('Unlink failure');
      (mockKnowledgeService.deleteDocument as jest.Mock).mockRejectedValue(error);

      await deleteDocument(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('listCategories', () => {
    it('should return categories array', async () => {
      const req = mockReq({
        query: {},
      });
      const res = mockRes();

      const mockCategories = ['Architecture', 'General', 'Onboarding', 'Runbooks', 'SOPs', 'Team Norms'];
      (mockKnowledgeService.listCategories as jest.Mock).mockResolvedValue(mockCategories);

      await listCategories(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockCategories,
      });
    });

    it('should return 400 for project scope without projectPath', async () => {
      const req = mockReq({
        query: { scope: 'project' },
      });
      const res = mockRes();

      await listCategories(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('projectPath is required'),
        }),
      );
    });

    it('should pass scope and projectPath to service', async () => {
      const req = mockReq({
        query: { scope: 'project', projectPath: '/my/project' },
      });
      const res = mockRes();

      (mockKnowledgeService.listCategories as jest.Mock).mockResolvedValue(['General']);

      await listCategories(req, res, mockNext);

      expect(mockKnowledgeService.listCategories).toHaveBeenCalledWith('project', '/my/project');
    });

    it('should call next for unexpected errors', async () => {
      const req = mockReq({
        query: {},
      });
      const res = mockRes();

      const error = new Error('Category read failure');
      (mockKnowledgeService.listCategories as jest.Mock).mockRejectedValue(error);

      await listCategories(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
