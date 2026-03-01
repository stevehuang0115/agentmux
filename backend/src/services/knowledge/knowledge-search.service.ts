/**
 * Knowledge Search Service
 *
 * Provides pluggable search strategies for knowledge documents.
 * Uses keyword matching by default (zero dependencies), with optional
 * Gemini embedding-based semantic search when GEMINI_API_KEY is set.
 *
 * @module services/knowledge/knowledge-search.service
 */

import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { KnowledgeService } from './knowledge.service.js';
import type {
  KnowledgeDocumentSummary,
  KnowledgeScope,
} from '../../types/knowledge.types.js';
import { EMBEDDING_CONSTANTS, ENV_CONSTANTS } from '../../constants.js';

/** Default number of results returned by search */
const DEFAULT_SEARCH_LIMIT = 5;

/**
 * A document scored by a search strategy.
 */
export interface ScoredDocument {
  /** The matched document summary */
  document: KnowledgeDocumentSummary;
  /** Relevance score (higher is more relevant) */
  score: number;
}

/**
 * Strategy interface for scoring documents against a query.
 */
export interface KnowledgeSearchStrategy {
  /**
   * Score documents against a query. Returns documents sorted by relevance.
   *
   * @param query - The search query
   * @param documents - Candidate documents to score
   * @returns Documents sorted by descending score
   */
  search(query: string, documents: KnowledgeDocumentSummary[]): Promise<ScoredDocument[]>;
}

/**
 * Keyword-based search strategy (default, zero dependencies).
 *
 * Splits the query into words and scores documents by matching against
 * title (3x weight), tags (2x weight), and preview (1x weight).
 */
export class KeywordSearchStrategy implements KnowledgeSearchStrategy {
  /**
   * Score documents using keyword matching.
   *
   * @param query - Search query text
   * @param documents - Documents to score
   * @returns Scored documents sorted by relevance
   */
  async search(query: string, documents: KnowledgeDocumentSummary[]): Promise<ScoredDocument[]> {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (queryWords.length === 0) {
      return [];
    }

    const scored: ScoredDocument[] = [];

    for (const doc of documents) {
      const titleLower = doc.title.toLowerCase();
      const previewLower = doc.preview.toLowerCase();
      const tagsLower = doc.tags.map((t) => t.toLowerCase());

      let score = 0;

      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 3;
        }
        if (tagsLower.some((tag) => tag.includes(word))) {
          score += 2;
        }
        if (previewLower.includes(word)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ document: doc, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score);
  }
}

/**
 * Cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity in range [-1, 1]
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Gemini embedding-based semantic search strategy.
 *
 * Calls the Gemini Embedding API to embed query text, then computes
 * cosine similarity against document embeddings. Falls back to
 * KeywordSearchStrategy if the API call fails.
 */
export class GeminiEmbeddingStrategy implements KnowledgeSearchStrategy {
  private readonly apiKey: string;
  private readonly fallback: KeywordSearchStrategy;
  private readonly logger: ComponentLogger;

  /**
   * Creates a GeminiEmbeddingStrategy instance.
   *
   * @param apiKey - Gemini API key for embedding requests
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.fallback = new KeywordSearchStrategy();
    this.logger = LoggerService.getInstance().createComponentLogger('GeminiEmbeddingStrategy');
  }

  /**
   * Embed a single text string via the Gemini API.
   *
   * @param text - Text to embed
   * @returns Embedding vector, or null on failure
   */
  private async embed(text: string): Promise<number[] | null> {
    try {
      const url = `${EMBEDDING_CONSTANTS.GEMINI_ENDPOINT}/${EMBEDDING_CONSTANTS.GEMINI_MODEL}:embedContent?key=${this.apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EMBEDDING_CONSTANTS.TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${EMBEDDING_CONSTANTS.GEMINI_MODEL}`,
            content: { parts: [{ text }] },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          let responseBody = '';
          try { responseBody = (await response.text()).slice(0, 200); } catch { /* ignore */ }
          this.logger.warn('Gemini embedding API returned non-OK status', {
            status: response.status,
            statusText: response.statusText,
            model: EMBEDDING_CONSTANTS.GEMINI_MODEL,
            textLength: text.length,
            responseBody,
          });
          return null;
        }

        const data = (await response.json()) as { embedding?: { values?: number[] } };
        return data.embedding?.values ?? null;
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      this.logger.warn('Gemini embedding API call failed', {
        error: error instanceof Error ? error.message : String(error),
        model: EMBEDDING_CONSTANTS.GEMINI_MODEL,
        textLength: text.length,
        isTimeout: error instanceof Error && error.name === 'AbortError',
      });
      return null;
    }
  }

  /**
   * Score documents using Gemini embeddings and cosine similarity.
   * Falls back to keyword search if embedding fails.
   *
   * @param query - Search query text
   * @param documents - Documents to score
   * @returns Scored documents sorted by relevance
   */
  async search(query: string, documents: KnowledgeDocumentSummary[]): Promise<ScoredDocument[]> {
    const queryEmbedding = await this.embed(query);

    if (!queryEmbedding) {
      this.logger.debug('Falling back to keyword search due to embedding failure');
      return this.fallback.search(query, documents);
    }

    const scored: ScoredDocument[] = [];

    for (const doc of documents) {
      const docText = `${doc.title} ${doc.tags.join(' ')} ${doc.preview}`;
      const docEmbedding = await this.embed(docText);

      if (!docEmbedding) {
        continue;
      }

      const score = cosineSimilarity(queryEmbedding, docEmbedding);
      if (score > 0) {
        scored.push({ document: doc, score });
      }
    }

    if (scored.length === 0) {
      this.logger.debug('No embedding results, falling back to keyword search');
      return this.fallback.search(query, documents);
    }

    return scored.sort((a, b) => b.score - a.score);
  }
}

/**
 * Knowledge Search Service singleton.
 *
 * Factory that selects the appropriate search strategy based on
 * environment configuration. Provides a high-level search interface
 * over the KnowledgeService document store.
 *
 * @example
 * ```typescript
 * const results = await KnowledgeSearchService.getInstance().search(
 *   'deployment runbook',
 *   'global',
 * );
 * ```
 */
export class KnowledgeSearchService {
  private static instance: KnowledgeSearchService | null = null;
  private readonly strategy: KnowledgeSearchStrategy;
  private readonly logger: ComponentLogger;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('KnowledgeSearchService');

    const geminiKey = process.env[ENV_CONSTANTS.GEMINI_API_KEY];
    if (geminiKey) {
      this.logger.info('Using Gemini embedding search strategy');
      this.strategy = new GeminiEmbeddingStrategy(geminiKey);
    } else {
      this.logger.info('Using keyword search strategy (no GEMINI_API_KEY set)');
      this.strategy = new KeywordSearchStrategy();
    }
  }

  /**
   * Get the singleton instance.
   *
   * @returns KnowledgeSearchService instance
   */
  static getInstance(): KnowledgeSearchService {
    if (!KnowledgeSearchService.instance) {
      KnowledgeSearchService.instance = new KnowledgeSearchService();
    }
    return KnowledgeSearchService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    KnowledgeSearchService.instance = null;
  }

  /**
   * Search knowledge documents using the configured strategy.
   *
   * @param query - Search query text
   * @param scope - Document scope ('global' or 'project')
   * @param projectPath - Project path (required when scope is 'project')
   * @param category - Optional category filter
   * @param limit - Maximum number of results (default 5)
   * @returns Matching document summaries sorted by relevance
   */
  async search(
    query: string,
    scope: KnowledgeScope,
    projectPath?: string,
    category?: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<KnowledgeDocumentSummary[]> {
    this.logger.debug('Searching knowledge documents', { query, scope, category });

    const knowledgeService = KnowledgeService.getInstance();
    const candidates = await knowledgeService.listDocuments(scope, projectPath, { category });

    if (candidates.length === 0) {
      return [];
    }

    const scored = await this.strategy.search(query, candidates);
    return scored.slice(0, limit).map((s) => s.document);
  }
}
