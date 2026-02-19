/**
 * Unit tests for KnowledgeSearchService
 *
 * Tests keyword search strategy, Gemini embedding strategy (with mocked fetch),
 * and the KnowledgeSearchService factory logic.
 *
 * @module services/knowledge/knowledge-search.service.test
 */

import {
  KeywordSearchStrategy,
  GeminiEmbeddingStrategy,
  KnowledgeSearchService,
} from './knowledge-search.service.js';
import type { KnowledgeDocumentSummary } from '../../types/knowledge.types.js';

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

// Mock KnowledgeService
const mockListDocuments = jest.fn();
jest.mock('./knowledge.service.js', () => ({
  KnowledgeService: {
    getInstance: () => ({
      listDocuments: mockListDocuments,
    }),
  },
}));

/** Helper to create a test document summary */
function makeDoc(
  overrides: Partial<KnowledgeDocumentSummary> = {},
): KnowledgeDocumentSummary {
  return {
    id: overrides.id ?? 'doc-1',
    title: overrides.title ?? 'Test Document',
    category: overrides.category ?? 'General',
    tags: overrides.tags ?? [],
    preview: overrides.preview ?? 'Some preview text',
    scope: overrides.scope ?? 'global',
    createdBy: overrides.createdBy ?? 'user',
    updatedBy: overrides.updatedBy ?? 'user',
    createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2024-01-01T00:00:00Z',
  };
}

describe('KeywordSearchStrategy', () => {
  const strategy = new KeywordSearchStrategy();

  it('should return empty array for empty query', async () => {
    const docs = [makeDoc()];
    const results = await strategy.search('', docs);
    expect(results).toHaveLength(0);
  });

  it('should return empty array for single-character words', async () => {
    const docs = [makeDoc()];
    const results = await strategy.search('a b c', docs);
    expect(results).toHaveLength(0);
  });

  it('should match title with 3x weight', async () => {
    const doc = makeDoc({ title: 'Deploy Runbook', preview: 'other content', tags: [] });
    const results = await strategy.search('deploy', [doc]);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(3);
  });

  it('should match tags with 2x weight', async () => {
    const doc = makeDoc({ title: 'Other', tags: ['deployment'], preview: 'other' });
    const results = await strategy.search('deployment', [doc]);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(2);
  });

  it('should match preview with 1x weight', async () => {
    const doc = makeDoc({ title: 'Other', tags: [], preview: 'contains deployment info' });
    const results = await strategy.search('deployment', [doc]);
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(1);
  });

  it('should accumulate scores across fields', async () => {
    const doc = makeDoc({
      title: 'Deployment Guide',
      tags: ['deployment'],
      preview: 'How to deployment',
    });
    const results = await strategy.search('deployment', [doc]);
    expect(results).toHaveLength(1);
    // title: 3 + tag: 2 + preview: 1 = 6
    expect(results[0].score).toBe(6);
  });

  it('should sort results by score descending', async () => {
    const docs = [
      makeDoc({ id: 'low', title: 'Other', tags: [], preview: 'deploy info' }),
      makeDoc({ id: 'high', title: 'Deploy Guide', tags: ['deploy'], preview: 'deploy' }),
    ];
    const results = await strategy.search('deploy', docs);
    expect(results[0].document.id).toBe('high');
    expect(results[1].document.id).toBe('low');
  });

  it('should exclude documents with zero score', async () => {
    const docs = [
      makeDoc({ id: 'match', title: 'Deploy', tags: [], preview: '' }),
      makeDoc({ id: 'no-match', title: 'Cooking Recipes', tags: ['food'], preview: 'pasta' }),
    ];
    const results = await strategy.search('deploy', docs);
    expect(results).toHaveLength(1);
    expect(results[0].document.id).toBe('match');
  });

  it('should handle multiple query words', async () => {
    const doc = makeDoc({ title: 'Deploy API', tags: [], preview: '' });
    const results = await strategy.search('deploy api', [doc]);
    // 'deploy' in title: 3, 'api' in title: 3 => 6
    expect(results[0].score).toBe(6);
  });
});

describe('GeminiEmbeddingStrategy', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should fall back to keyword search when embedding fails', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const strategy = new GeminiEmbeddingStrategy('fake-key');
    const doc = makeDoc({ title: 'Deploy Guide', tags: [], preview: '' });
    const results = await strategy.search('deploy', [doc]);

    // Should fall back to keyword strategy and still find the doc
    expect(results).toHaveLength(1);
    expect(results[0].document.id).toBe('doc-1');
  });

  it('should fall back when API returns non-OK status', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const strategy = new GeminiEmbeddingStrategy('bad-key');
    const doc = makeDoc({ title: 'Deploy Guide', tags: [], preview: '' });
    const results = await strategy.search('deploy', [doc]);

    expect(results).toHaveLength(1);
  });

  it('should use cosine similarity when embeddings succeed', async () => {
    // Mock fetch to return embeddings
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      // First call: query embedding. Second call: doc embedding.
      // Use vectors with known cosine similarity
      const values = callCount === 1 ? [1, 0, 0] : [0.9, 0.1, 0];
      return {
        ok: true,
        json: async () => ({ embedding: { values } }),
      } as unknown as Response;
    });

    const strategy = new GeminiEmbeddingStrategy('good-key');
    const doc = makeDoc({ title: 'Deploy', tags: [], preview: 'guide' });
    const results = await strategy.search('deploy', [doc]);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should fall back to keyword when no embedding results match', async () => {
    // Query embedding succeeds but doc embedding fails
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          json: async () => ({ embedding: { values: [1, 0, 0] } }),
        } as unknown as Response;
      }
      return { ok: false, status: 500 } as Response;
    });

    const strategy = new GeminiEmbeddingStrategy('key');
    const doc = makeDoc({ title: 'Deploy Guide', tags: [], preview: '' });
    const results = await strategy.search('deploy', [doc]);

    // Falls back to keyword search
    expect(results).toHaveLength(1);
  });
});

describe('KnowledgeSearchService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    KnowledgeSearchService.resetInstance();
    mockListDocuments.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    KnowledgeSearchService.resetInstance();
  });

  it('should return singleton instance', () => {
    const a = KnowledgeSearchService.getInstance();
    const b = KnowledgeSearchService.getInstance();
    expect(a).toBe(b);
  });

  it('should use keyword strategy when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = KnowledgeSearchService.getInstance();

    const docs = [makeDoc({ title: 'Deploy Runbook' })];
    mockListDocuments.mockResolvedValue(docs);

    const results = await service.search('deploy', 'global');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Deploy Runbook');
  });

  it('should return empty array when no documents exist', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = KnowledgeSearchService.getInstance();

    mockListDocuments.mockResolvedValue([]);

    const results = await service.search('deploy', 'global');
    expect(results).toHaveLength(0);
  });

  it('should respect limit parameter', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = KnowledgeSearchService.getInstance();

    const docs = [
      makeDoc({ id: '1', title: 'Deploy A' }),
      makeDoc({ id: '2', title: 'Deploy B' }),
      makeDoc({ id: '3', title: 'Deploy C' }),
    ];
    mockListDocuments.mockResolvedValue(docs);

    const results = await service.search('deploy', 'global', undefined, undefined, 2);
    expect(results).toHaveLength(2);
  });

  it('should pass category filter to listDocuments', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = KnowledgeSearchService.getInstance();

    mockListDocuments.mockResolvedValue([]);

    await service.search('deploy', 'global', undefined, 'Runbooks');
    expect(mockListDocuments).toHaveBeenCalledWith('global', undefined, { category: 'Runbooks' });
  });

  it('should pass projectPath for project scope', async () => {
    delete process.env.GEMINI_API_KEY;
    const service = KnowledgeSearchService.getInstance();

    mockListDocuments.mockResolvedValue([]);

    await service.search('deploy', 'project', '/path/to/project');
    expect(mockListDocuments).toHaveBeenCalledWith('project', '/path/to/project', { category: undefined });
  });
});
