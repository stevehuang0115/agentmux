/**
 * Knowledge Controller Barrel Export Tests
 *
 * Verifies that the barrel export from the knowledge controller index
 * correctly re-exports the createKnowledgeRouter function.
 *
 * @module controllers/knowledge/index.test
 */

// Mock controller functions to avoid pulling in real dependencies
jest.mock('./knowledge.controller.js', () => ({
  createDocument: jest.fn(),
  listDocuments: jest.fn(),
  getDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  listCategories: jest.fn(),
}));

import { createKnowledgeRouter as DirectCreateKnowledgeRouter } from './knowledge.routes.js';
import { createKnowledgeRouter as BarrelCreateKnowledgeRouter } from './index.js';

describe('Knowledge Controller Barrel Export', () => {
  it('should export createKnowledgeRouter from the index', () => {
    expect(BarrelCreateKnowledgeRouter).toBeDefined();
  });

  it('should export the same function as the direct import', () => {
    expect(BarrelCreateKnowledgeRouter).toBe(DirectCreateKnowledgeRouter);
  });

  it('should be a function', () => {
    expect(typeof BarrelCreateKnowledgeRouter).toBe('function');
  });

  it('should return a router when called', () => {
    const router = BarrelCreateKnowledgeRouter();
    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });
});
