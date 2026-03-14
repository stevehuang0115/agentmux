/**
 * Vector Store Service
 *
 * Provides local, on-device vector storage using SQLite (better-sqlite3).
 * Stores document embeddings and performs cosine-similarity search entirely
 * offline — no external vector database or cloud API is needed at query time.
 *
 * Storage locations:
 * - Global scope: ~/.crewly/vector-store.db
 * - Project scope: {projectPath}/.crewly/vector-store.db
 *
 * @module services/knowledge/vector-store.service
 */

import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { CREWLY_CONSTANTS } from '../../constants.js';

/**
 * Lazy-loaded better-sqlite3 module reference.
 *
 * Uses dynamic require so that a native-module load failure does NOT
 * cascade to every test file that transitively imports this service.
 * The module is loaded on first actual database access, not at import time.
 *
 * @see https://github.com/stevehuang0115/crewly/issues/170
 */
let _BetterSqlite3: typeof import('better-sqlite3') | null = null;

/**
 * Load better-sqlite3 on demand. Throws a clear error if the native module
 * is not available (e.g. needs `npm rebuild better-sqlite3`).
 */
function getBetterSqlite3(): typeof import('better-sqlite3') {
  if (!_BetterSqlite3) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      _BetterSqlite3 = require('better-sqlite3');
    } catch (err) {
      throw new Error(
        'better-sqlite3 native module failed to load. Run `npm rebuild better-sqlite3` to fix. ' +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return _BetterSqlite3!;
}

/** Type alias for a better-sqlite3 Database instance */
type DatabaseType = import('better-sqlite3').Database;

/** Constants for the vector store */
export const VECTOR_STORE_CONSTANTS = {
  /** SQLite database filename */
  DB_FILENAME: 'vector-store.db',
  /** Default number of results for similarity search */
  DEFAULT_SEARCH_LIMIT: 10,
  /** Minimum cosine similarity threshold for search results */
  DEFAULT_SIMILARITY_THRESHOLD: 0.1,
  /** Maximum metadata JSON size (bytes) */
  MAX_METADATA_SIZE: 65536,
} as const;

/**
 * A stored embedding record with metadata.
 */
export interface VectorRecord {
  /** Unique identifier (typically document ID) */
  id: string;
  /** The embedding vector as a Float64 array */
  embedding: number[];
  /** Optional metadata associated with the embedding */
  metadata: Record<string, unknown>;
  /** ISO timestamp of when the embedding was stored */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * A search result with cosine similarity score.
 */
export interface VectorSearchResult {
  /** Unique identifier */
  id: string;
  /** Cosine similarity score (higher is more similar) */
  score: number;
  /** Associated metadata */
  metadata: Record<string, unknown>;
}

/**
 * Raw row shape returned by SQLite queries.
 */
interface EmbeddingRow {
  id: string;
  embedding: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

/**
 * Compute cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity in range [-1, 1], or 0 if vectors are incompatible
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
 * VectorStoreService provides local SQLite-based vector storage.
 *
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * Embeddings are stored as JSON arrays and cosine similarity is computed
 * in JavaScript for portability (no native vector extension required).
 *
 * Each scope (global / project) gets its own database file so project
 * data stays isolated and portable.
 *
 * @example
 * ```typescript
 * const store = VectorStoreService.getInstance();
 * store.upsert('doc-123', embedding, { title: 'My Doc' }, 'global');
 * const results = store.search(queryEmbedding, 'global', 5);
 * ```
 */
export class VectorStoreService {
  private static instance: VectorStoreService | null = null;
  private readonly logger: ComponentLogger;
  /** Cache of open database connections by resolved db path */
  private readonly databases: Map<string, DatabaseType> = new Map();

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('VectorStoreService');
  }

  /**
   * Get the singleton instance.
   *
   * @returns VectorStoreService instance
   */
  static getInstance(): VectorStoreService {
    if (!VectorStoreService.instance) {
      VectorStoreService.instance = new VectorStoreService();
    }
    return VectorStoreService.instance;
  }

  /**
   * Reset the singleton and close all open databases (for testing).
   */
  static resetInstance(): void {
    if (VectorStoreService.instance) {
      VectorStoreService.instance.closeAll();
    }
    VectorStoreService.instance = null;
  }

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the database file path for a given scope.
   *
   * @param scope - 'global' or 'project'
   * @param projectPath - Required when scope is 'project'
   * @returns Absolute path to the SQLite database file
   * @throws Error if projectPath is missing for project scope
   */
  private dbPath(scope: 'global' | 'project', projectPath?: string): string {
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project scope');
      }
      return path.join(projectPath, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, VECTOR_STORE_CONSTANTS.DB_FILENAME);
    }
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(home, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, VECTOR_STORE_CONSTANTS.DB_FILENAME);
  }

  // ---------------------------------------------------------------------------
  // Database management
  // ---------------------------------------------------------------------------

  /**
   * Open or retrieve a cached SQLite database connection.
   * Creates the parent directory and schema if they don't exist.
   *
   * @param scope - Document scope
   * @param projectPath - Project path for project-scoped databases
   * @returns Open Database instance
   */
  private getDb(scope: 'global' | 'project', projectPath?: string): DatabaseType {
    const dbFile = this.dbPath(scope, projectPath);

    const cached = this.databases.get(dbFile);
    if (cached) {
      return cached;
    }

    // Ensure parent directory exists
    const dir = path.dirname(dbFile);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const Database = getBetterSqlite3();
    const db = new Database(dbFile);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');

    // Create schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_embeddings_updated_at ON embeddings(updated_at);
    `);

    this.databases.set(dbFile, db);
    this.logger.info('Opened vector store database', { path: dbFile, scope });
    return db;
  }

  /**
   * Close all open database connections.
   */
  closeAll(): void {
    for (const [dbPath, db] of this.databases) {
      try {
        db.close();
        this.logger.debug('Closed vector store database', { path: dbPath });
      } catch (error) {
        this.logger.warn('Error closing database', {
          path: dbPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.databases.clear();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Store or update an embedding for a document.
   *
   * @param id - Document identifier
   * @param embedding - The embedding vector (array of numbers)
   * @param metadata - Optional metadata to associate with the embedding
   * @param scope - Storage scope ('global' or 'project')
   * @param projectPath - Required when scope is 'project'
   * @throws Error if embedding is empty or metadata exceeds size limit
   */
  upsert(
    id: string,
    embedding: number[],
    metadata: Record<string, unknown>,
    scope: 'global' | 'project',
    projectPath?: string,
  ): void {
    if (!id) {
      throw new Error('id is required');
    }
    if (!embedding || embedding.length === 0) {
      throw new Error('embedding must be a non-empty array');
    }

    const metadataJson = JSON.stringify(metadata);
    if (metadataJson.length > VECTOR_STORE_CONSTANTS.MAX_METADATA_SIZE) {
      throw new Error(`metadata exceeds maximum size of ${VECTOR_STORE_CONSTANTS.MAX_METADATA_SIZE} bytes`);
    }

    const db = this.getDb(scope, projectPath);
    const now = new Date().toISOString();
    const embeddingJson = JSON.stringify(embedding);

    const stmt = db.prepare(`
      INSERT INTO embeddings (id, embedding, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        embedding = excluded.embedding,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, embeddingJson, metadataJson, now, now);
    this.logger.debug('Upserted embedding', { id, scope, dimensions: embedding.length });
  }

  /**
   * Retrieve a stored embedding by document ID.
   *
   * @param id - Document identifier
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @returns The vector record, or null if not found
   */
  get(id: string, scope: 'global' | 'project', projectPath?: string): VectorRecord | null {
    const db = this.getDb(scope, projectPath);
    const row = db.prepare('SELECT * FROM embeddings WHERE id = ?').get(id) as EmbeddingRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      embedding: JSON.parse(row.embedding) as number[],
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Delete an embedding by document ID.
   *
   * @param id - Document identifier
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @returns True if a record was deleted, false if not found
   */
  delete(id: string, scope: 'global' | 'project', projectPath?: string): boolean {
    const db = this.getDb(scope, projectPath);
    const result = db.prepare('DELETE FROM embeddings WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Check whether an embedding exists for a given document ID.
   *
   * @param id - Document identifier
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @returns True if the embedding exists
   */
  has(id: string, scope: 'global' | 'project', projectPath?: string): boolean {
    const db = this.getDb(scope, projectPath);
    const row = db.prepare('SELECT 1 FROM embeddings WHERE id = ?').get(id);
    return row !== undefined;
  }

  /**
   * Return the total number of stored embeddings.
   *
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @returns Count of stored embeddings
   */
  count(scope: 'global' | 'project', projectPath?: string): number {
    const db = this.getDb(scope, projectPath);
    const row = db.prepare('SELECT COUNT(*) as cnt FROM embeddings').get() as { cnt: number };
    return row.cnt;
  }

  /**
   * Search for the most similar embeddings using cosine similarity.
   *
   * Loads all embeddings from the store, computes cosine similarity
   * against the query vector, and returns the top results above the
   * similarity threshold.
   *
   * @param queryEmbedding - The query embedding vector
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @param limit - Maximum number of results (default 10)
   * @param threshold - Minimum similarity threshold (default 0.1)
   * @returns Matching records sorted by descending similarity
   */
  search(
    queryEmbedding: number[],
    scope: 'global' | 'project',
    projectPath?: string,
    limit: number = VECTOR_STORE_CONSTANTS.DEFAULT_SEARCH_LIMIT,
    threshold: number = VECTOR_STORE_CONSTANTS.DEFAULT_SIMILARITY_THRESHOLD,
  ): VectorSearchResult[] {
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    const db = this.getDb(scope, projectPath);
    const rows = db.prepare('SELECT id, embedding, metadata FROM embeddings').all() as EmbeddingRow[];

    const results: VectorSearchResult[] = [];

    for (const row of rows) {
      const storedEmbedding = JSON.parse(row.embedding) as number[];
      const score = cosineSimilarity(queryEmbedding, storedEmbedding);

      if (score >= threshold) {
        results.push({
          id: row.id,
          score,
          metadata: JSON.parse(row.metadata) as Record<string, unknown>,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Delete all embeddings from the store.
   *
   * @param scope - Storage scope
   * @param projectPath - Required when scope is 'project'
   * @returns Number of records deleted
   */
  clear(scope: 'global' | 'project', projectPath?: string): number {
    const db = this.getDb(scope, projectPath);
    const result = db.prepare('DELETE FROM embeddings').run();
    return result.changes;
  }
}
