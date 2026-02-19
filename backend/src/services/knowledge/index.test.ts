/**
 * Knowledge Service Barrel Export Tests
 *
 * Verifies that the barrel export from the knowledge service index
 * correctly re-exports the KnowledgeService class.
 *
 * @module services/knowledge/index.test
 */

jest.mock('../core/logger.service.js', () => ({
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

jest.mock('../../utils/file-io.utils.js');
jest.mock('../../constants.js', () => ({
  CREWLY_CONSTANTS: {
    PATHS: {
      CREWLY_HOME: '.crewly',
      DOCS_DIR: 'docs',
      DOCS_INDEX_FILE: 'docs-index.json',
    },
  },
}));

import { KnowledgeService as DirectKnowledgeService } from './knowledge.service.js';
import { KnowledgeService as BarrelKnowledgeService } from './index.js';

describe('Knowledge Service Barrel Export', () => {
  it('should export KnowledgeService from the index', () => {
    expect(BarrelKnowledgeService).toBeDefined();
  });

  it('should export the same class as the direct import', () => {
    expect(BarrelKnowledgeService).toBe(DirectKnowledgeService);
  });

  it('should be a class with getInstance static method', () => {
    expect(typeof BarrelKnowledgeService.getInstance).toBe('function');
  });

  it('should be a class with resetInstance static method', () => {
    expect(typeof BarrelKnowledgeService.resetInstance).toBe('function');
  });
});
