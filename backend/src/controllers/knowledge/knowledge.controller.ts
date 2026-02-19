/**
 * Knowledge REST Controller
 *
 * Handles HTTP requests for the Company Knowledge document system.
 * Provides CRUD operations for knowledge documents with scope-based
 * storage (global or project-specific).
 *
 * @module controllers/knowledge/knowledge.controller
 */

import type { Request, Response, NextFunction } from 'express';
import { KnowledgeService } from '../../services/knowledge/knowledge.service.js';
import { LoggerService } from '../../services/core/logger.service.js';
import type {
  KnowledgeScope,
  CreateKnowledgeDocumentParams,
  UpdateKnowledgeDocumentParams,
} from '../../types/knowledge.types.js';

const logger = LoggerService.getInstance().createComponentLogger('KnowledgeController');

/**
 * Validate and extract scope/projectPath from request.
 *
 * @param scope - Scope value from query or body
 * @param projectPath - Project path from query or body
 * @returns Validated scope and projectPath
 */
function validateScope(scope: string | undefined, projectPath: string | undefined): {
  scope: KnowledgeScope;
  projectPath: string | undefined;
} {
  const resolvedScope: KnowledgeScope = scope === 'project' ? 'project' : 'global';
  if (resolvedScope === 'project' && !projectPath) {
    throw new Error('projectPath is required when scope is "project"');
  }
  return { scope: resolvedScope, projectPath };
}

/**
 * POST /api/knowledge/documents
 *
 * Create a new knowledge document.
 *
 * @param req - Request with body: { title, content, category, scope, projectPath?, tags?, createdBy }
 * @param res - Response returning { success, data: { id } }
 * @param next - Next function for error propagation
 */
export async function createDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, content, category, scope, projectPath, tags, createdBy } = req.body;

    if (!title || !content) {
      res.status(400).json({ success: false, error: 'Missing required parameters: title, content' });
      return;
    }

    const params: CreateKnowledgeDocumentParams = {
      title,
      content,
      category: category || 'General',
      scope: scope === 'project' ? 'project' : 'global',
      projectPath,
      tags: tags || [],
      createdBy: createdBy || 'user',
    };

    const service = KnowledgeService.getInstance();
    const id = await service.createDocument(params);

    logger.info('Document created via REST', { id, title, scope: params.scope });
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error('Failed to create document', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/knowledge/documents
 *
 * List knowledge documents with optional filtering.
 *
 * @param req - Request with query: { scope?, projectPath?, category?, search? }
 * @param res - Response returning { success, data: KnowledgeDocumentSummary[] }
 * @param next - Next function for error propagation
 */
export async function listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resolvedScope: KnowledgeScope = (req.query.scope as string) === 'project' ? 'project' : 'global';
    const resolvedProjectPath = req.query.projectPath as string | undefined;

    if (resolvedScope === 'project' && !resolvedProjectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required when scope is "project"' });
      return;
    }

    const service = KnowledgeService.getInstance();
    const documents = await service.listDocuments(resolvedScope, resolvedProjectPath, {
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
    });

    res.json({ success: true, data: documents });
  } catch (error) {
    logger.error('Failed to list documents', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/knowledge/documents/:id
 *
 * Get a single knowledge document by ID.
 *
 * @param req - Request with params: { id } and query: { scope?, projectPath? }
 * @param res - Response returning { success, data: KnowledgeDocument }
 * @param next - Next function for error propagation
 */
export async function getDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const resolvedScope: KnowledgeScope = (req.query.scope as string) === 'project' ? 'project' : 'global';
    const resolvedProjectPath = req.query.projectPath as string | undefined;

    if (resolvedScope === 'project' && !resolvedProjectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required when scope is "project"' });
      return;
    }

    const service = KnowledgeService.getInstance();
    const doc = await service.getDocument(id, resolvedScope, resolvedProjectPath);

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error('Failed to get document', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * PUT /api/knowledge/documents/:id
 *
 * Update an existing knowledge document.
 *
 * @param req - Request with params: { id } and body: { title?, content?, category?, tags?, scope, projectPath?, updatedBy }
 * @param res - Response returning { success: true }
 * @param next - Next function for error propagation
 */
export async function updateDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { title, content, category, tags, scope, projectPath, updatedBy } = req.body;

    const resolvedScope: KnowledgeScope = scope === 'project' ? 'project' : 'global';

    if (resolvedScope === 'project' && !projectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required when scope is "project"' });
      return;
    }

    const params: UpdateKnowledgeDocumentParams = {
      title,
      content,
      category,
      tags,
      scope: resolvedScope,
      projectPath,
      updatedBy: updatedBy || 'user',
    };

    const service = KnowledgeService.getInstance();
    await service.updateDocument(id, params);

    logger.info('Document updated via REST', { id, scope: resolvedScope });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error('Failed to update document', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * DELETE /api/knowledge/documents/:id
 *
 * Delete a knowledge document.
 *
 * @param req - Request with params: { id } and query: { scope?, projectPath? }
 * @param res - Response returning { success: true }
 * @param next - Next function for error propagation
 */
export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const resolvedScope: KnowledgeScope = (req.query.scope as string) === 'project' ? 'project' : 'global';
    const resolvedProjectPath = req.query.projectPath as string | undefined;

    if (resolvedScope === 'project' && !resolvedProjectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required when scope is "project"' });
      return;
    }

    const service = KnowledgeService.getInstance();
    await service.deleteDocument(id, resolvedScope, resolvedProjectPath);

    logger.info('Document deleted via REST', { id, scope: resolvedScope });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error('Failed to delete document', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}

/**
 * GET /api/knowledge/categories
 *
 * List all categories (default + custom in-use) for a given scope.
 *
 * @param req - Request with query: { scope?, projectPath? }
 * @param res - Response returning { success, data: string[] }
 * @param next - Next function for error propagation
 */
export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resolvedScope: KnowledgeScope = (req.query.scope as string) === 'project' ? 'project' : 'global';
    const resolvedProjectPath = req.query.projectPath as string | undefined;

    if (resolvedScope === 'project' && !resolvedProjectPath) {
      res.status(400).json({ success: false, error: 'projectPath is required when scope is "project"' });
      return;
    }

    const service = KnowledgeService.getInstance();
    const categories = await service.listCategories(resolvedScope, resolvedProjectPath);

    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to list categories', {
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
}
