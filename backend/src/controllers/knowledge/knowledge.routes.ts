/**
 * Knowledge REST Routes
 *
 * Router configuration for knowledge document endpoints.
 * Provides CRUD access to the KnowledgeService for both UI and agent use.
 *
 * @module controllers/knowledge/knowledge.routes
 */

import { Router } from 'express';
import {
  createDocument,
  listDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  listCategories,
} from './knowledge.controller.js';

/**
 * Creates the knowledge router with all knowledge endpoints.
 *
 * Endpoints:
 * - POST   /documents      - Create a new document
 * - GET    /documents      - List documents with optional filtering
 * - GET    /documents/:id  - Get a single document
 * - PUT    /documents/:id  - Update a document
 * - DELETE /documents/:id  - Delete a document
 * - GET    /categories     - List all categories (defaults + in-use custom)
 *
 * @returns Express router configured with knowledge routes
 */
export function createKnowledgeRouter(): Router {
  const router = Router();

  router.post('/documents', createDocument);
  router.get('/documents', listDocuments);
  router.get('/documents/:id', getDocument);
  router.put('/documents/:id', updateDocument);
  router.delete('/documents/:id', deleteDocument);
  router.get('/categories', listCategories);

  return router;
}
