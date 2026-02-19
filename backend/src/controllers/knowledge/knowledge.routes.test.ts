/**
 * Knowledge Routes Tests
 *
 * Tests that the knowledge router is created with the expected
 * HTTP method and path combinations for document CRUD and category listing.
 *
 * @module controllers/knowledge/knowledge.routes.test
 */

// Mock controller functions before importing the router
jest.mock('./knowledge.controller.js', () => ({
  createDocument: jest.fn((_req, res) => res.status(201).json({ success: true })),
  listDocuments: jest.fn((_req, res) => res.json({ success: true })),
  getDocument: jest.fn((_req, res) => res.json({ success: true })),
  updateDocument: jest.fn((_req, res) => res.json({ success: true })),
  deleteDocument: jest.fn((_req, res) => res.json({ success: true })),
  listCategories: jest.fn((_req, res) => res.json({ success: true })),
}));

import { createKnowledgeRouter } from './knowledge.routes.js';
import { Router } from 'express';

/**
 * Extract registered routes from an Express Router's internal stack.
 *
 * @param router - Express Router instance
 * @returns Array of objects with method and path properties
 */
function getRegisteredRoutes(router: Router): Array<{ method: string; path: string }> {
  const routes: Array<{ method: string; path: string }> = [];
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;

  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods);
      for (const method of methods) {
        routes.push({
          method: method.toUpperCase(),
          path: layer.route.path,
        });
      }
    }
  }

  return routes;
}

describe('Knowledge Routes', () => {
  describe('createKnowledgeRouter', () => {
    it('should return a Router instance', () => {
      const router = createKnowledgeRouter();
      expect(router).toBeDefined();
      // Router is a function (middleware)
      expect(typeof router).toBe('function');
    });

    it('should register POST /documents route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'POST', path: '/documents' });
    });

    it('should register GET /documents route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'GET', path: '/documents' });
    });

    it('should register GET /documents/:id route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'GET', path: '/documents/:id' });
    });

    it('should register PUT /documents/:id route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'PUT', path: '/documents/:id' });
    });

    it('should register DELETE /documents/:id route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'DELETE', path: '/documents/:id' });
    });

    it('should register GET /categories route', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toContainEqual({ method: 'GET', path: '/categories' });
    });

    it('should have exactly 6 routes registered', () => {
      const router = createKnowledgeRouter();
      const routes = getRegisteredRoutes(router);

      expect(routes).toHaveLength(6);
    });
  });
});
