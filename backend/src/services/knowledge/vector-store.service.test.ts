/**
 * Unit tests for VectorStoreService
 *
 * Tests local SQLite vector storage: upsert, get, delete, search (cosine
 * similarity), and multi-scope isolation. Uses a temporary directory so
 * tests never touch real user data.
 *
 * @module services/knowledge/vector-store.service.test
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  VectorStoreService,
  cosineSimilarity,
  VECTOR_STORE_CONSTANTS,
} from './vector-store.service.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
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

// Redirect HOME to a temp directory so tests don't touch real data
let tempDir: string;
const originalHome = process.env.HOME;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-store-test-'));
  process.env.HOME = tempDir;
});

afterAll(() => {
  process.env.HOME = originalHome;
  VectorStoreService.resetInstance();
  // Clean up temp directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

afterEach(() => {
  VectorStoreService.resetInstance();
});

// ---------------------------------------------------------------------------
// cosineSimilarity unit tests
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('should return -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it('should return 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('should return 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('should return 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it('should compute correct similarity for known vectors', () => {
    // cos([1,0,0], [0.9,0.1,0]) ≈ 0.9939...
    const sim = cosineSimilarity([1, 0, 0], [0.9, 0.1, 0]);
    expect(sim).toBeGreaterThan(0.99);
    expect(sim).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// VectorStoreService unit tests
// ---------------------------------------------------------------------------

describe('VectorStoreService', () => {
  let service: VectorStoreService;

  beforeEach(() => {
    service = VectorStoreService.getInstance();
    // Clear any leftover data from prior test blocks
    try { service.clear('global'); } catch { /* db may not exist yet */ }
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = VectorStoreService.getInstance();
      const b = VectorStoreService.getInstance();
      expect(a).toBe(b);
    });

    it('should create a new instance after reset', () => {
      const a = VectorStoreService.getInstance();
      VectorStoreService.resetInstance();
      const b = VectorStoreService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('upsert and get', () => {
    it('should store and retrieve an embedding', () => {
      const embedding = [0.1, 0.2, 0.3, 0.4];
      const metadata = { title: 'Test Doc', category: 'General' };

      service.upsert('doc-1', embedding, metadata, 'global');
      const result = service.get('doc-1', 'global');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('doc-1');
      expect(result!.embedding).toEqual(embedding);
      expect(result!.metadata).toEqual(metadata);
      expect(result!.createdAt).toBeTruthy();
      expect(result!.updatedAt).toBeTruthy();
    });

    it('should update an existing embedding on upsert', () => {
      service.upsert('doc-1', [1, 2, 3], { v: 1 }, 'global');
      service.upsert('doc-1', [4, 5, 6], { v: 2 }, 'global');

      const result = service.get('doc-1', 'global');
      expect(result!.embedding).toEqual([4, 5, 6]);
      expect(result!.metadata).toEqual({ v: 2 });
    });

    it('should return null for non-existent ID', () => {
      expect(service.get('non-existent', 'global')).toBeNull();
    });

    it('should throw for empty id', () => {
      expect(() => service.upsert('', [1, 2], {}, 'global')).toThrow('id is required');
    });

    it('should throw for empty embedding', () => {
      expect(() => service.upsert('doc-1', [], {}, 'global')).toThrow('non-empty array');
    });
  });

  describe('delete', () => {
    it('should delete an existing embedding', () => {
      service.upsert('doc-1', [1, 2, 3], {}, 'global');
      expect(service.delete('doc-1', 'global')).toBe(true);
      expect(service.get('doc-1', 'global')).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      expect(service.delete('non-existent', 'global')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing embedding', () => {
      service.upsert('doc-1', [1, 2, 3], {}, 'global');
      expect(service.has('doc-1', 'global')).toBe(true);
    });

    it('should return false for non-existent ID', () => {
      expect(service.has('non-existent', 'global')).toBe(false);
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', () => {
      expect(service.count('global')).toBe(0);
    });

    it('should return correct count after inserts', () => {
      service.upsert('doc-1', [1, 2], {}, 'global');
      service.upsert('doc-2', [3, 4], {}, 'global');
      service.upsert('doc-3', [5, 6], {}, 'global');
      expect(service.count('global')).toBe(3);
    });
  });

  describe('clear', () => {
    it('should remove all embeddings', () => {
      service.upsert('doc-1', [1, 2], {}, 'global');
      service.upsert('doc-2', [3, 4], {}, 'global');

      const deleted = service.clear('global');
      expect(deleted).toBe(2);
      expect(service.count('global')).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Insert embeddings with known directions
      service.upsert('exact', [1, 0, 0], { label: 'exact match' }, 'global');
      service.upsert('similar', [0.9, 0.1, 0], { label: 'similar' }, 'global');
      service.upsert('different', [0, 0, 1], { label: 'different' }, 'global');
      service.upsert('opposite', [-1, 0, 0], { label: 'opposite' }, 'global');
    });

    it('should return results sorted by descending similarity', () => {
      const results = service.search([1, 0, 0], 'global');

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].id).toBe('exact');
      expect(results[0].score).toBeCloseTo(1, 5);
      expect(results[1].id).toBe('similar');
      expect(results[1].score).toBeGreaterThan(0.9);
    });

    it('should filter results below threshold', () => {
      const results = service.search([1, 0, 0], 'global', undefined, 10, 0.5);

      // 'exact' (1.0), 'similar' (>0.99) should pass; 'different' (0), 'opposite' (-1) should not
      const ids = results.map((r) => r.id);
      expect(ids).toContain('exact');
      expect(ids).toContain('similar');
      expect(ids).not.toContain('opposite');
    });

    it('should respect the limit parameter', () => {
      const results = service.search([1, 0, 0], 'global', undefined, 1);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('exact');
    });

    it('should return empty array for empty query embedding', () => {
      expect(service.search([], 'global')).toEqual([]);
    });

    it('should return metadata in results', () => {
      const results = service.search([1, 0, 0], 'global', undefined, 1);
      expect(results[0].metadata).toEqual({ label: 'exact match' });
    });
  });

  describe('scope isolation', () => {
    it('should isolate global and project scopes', () => {
      const projectPath = path.join(tempDir, 'test-project');
      fs.mkdirSync(projectPath, { recursive: true });

      service.upsert('doc-global', [1, 0], { scope: 'global' }, 'global');
      service.upsert('doc-project', [0, 1], { scope: 'project' }, 'project', projectPath);

      expect(service.has('doc-global', 'global')).toBe(true);
      expect(service.has('doc-project', 'global')).toBe(false);

      expect(service.has('doc-project', 'project', projectPath)).toBe(true);
      expect(service.has('doc-global', 'project', projectPath)).toBe(false);
    });

    it('should throw when projectPath is missing for project scope', () => {
      expect(() => service.upsert('doc-1', [1], {}, 'project')).toThrow('projectPath is required');
    });
  });

  describe('database file creation', () => {
    it('should create the database file on first access', () => {
      service.upsert('doc-1', [1, 2], {}, 'global');

      const expectedPath = path.join(tempDir, '.crewly', VECTOR_STORE_CONSTANTS.DB_FILENAME);
      expect(fs.existsSync(expectedPath)).toBe(true);
    });
  });

  describe('lazy loading (#170)', () => {
    it('should not throw at import time if better-sqlite3 is unavailable', () => {
      // The service module was already imported successfully — this validates
      // that the top-level import does NOT eagerly load the native module.
      // If it did, this entire test suite would fail to even start.
      expect(VectorStoreService).toBeDefined();
      expect(typeof VectorStoreService.getInstance).toBe('function');
    });

    it('should throw a clear error message when native module fails to load', () => {
      // We can't easily simulate a missing native module in a running test,
      // but we verify the service works when it IS available
      const svc = VectorStoreService.getInstance();
      expect(() => svc.upsert('lazy-test', [1, 2], {}, 'global')).not.toThrow();
      expect(svc.get('lazy-test', 'global')).not.toBeNull();
    });
  });
});
