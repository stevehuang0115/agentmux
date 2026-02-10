/**
 * Tests for Memory Controller barrel export
 *
 * Verifies that all expected symbols are exported from the index module.
 *
 * @module controllers/memory/index.test
 */

import * as memoryIndex from './index.js';

// Mock dependencies that the controller imports
jest.mock('../../services/core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));

jest.mock('../../services/memory/memory.service.js', () => ({
  MemoryService: {
    getInstance: () => ({
      remember: jest.fn(),
      recall: jest.fn(),
      recordLearning: jest.fn(),
    }),
  },
}));

describe('Memory Controller index exports', () => {
  it('should export createMemoryRouter', () => {
    expect(memoryIndex.createMemoryRouter).toBeDefined();
    expect(typeof memoryIndex.createMemoryRouter).toBe('function');
  });

  it('should export remember handler', () => {
    expect(memoryIndex.remember).toBeDefined();
    expect(typeof memoryIndex.remember).toBe('function');
  });

  it('should export recall handler', () => {
    expect(memoryIndex.recall).toBeDefined();
    expect(typeof memoryIndex.recall).toBe('function');
  });

  it('should export recordLearning handler', () => {
    expect(memoryIndex.recordLearning).toBeDefined();
    expect(typeof memoryIndex.recordLearning).toBe('function');
  });
});
