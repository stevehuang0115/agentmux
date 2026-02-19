/**
 * Knowledge Service
 *
 * Manages Company Knowledge documents — markdown files with YAML frontmatter
 * stored at global (~/.crewly/docs/) or project ({projectPath}/.crewly/docs/) scope.
 * Provides CRUD operations with a JSON index for fast listing.
 *
 * @module services/knowledge/knowledge.service
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { atomicWriteFile, safeReadJson } from '../../utils/file-io.utils.js';
import { CREWLY_CONSTANTS } from '../../constants.js';
import type {
  KnowledgeDocument,
  KnowledgeDocumentSummary,
  KnowledgeFrontmatter,
  KnowledgeIndex,
  KnowledgeIndexEntry,
  KnowledgeScope,
  CreateKnowledgeDocumentParams,
  UpdateKnowledgeDocumentParams,
  KnowledgeDocumentFilters,
} from '../../types/knowledge.types.js';
import {
  DEFAULT_KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_CONSTANTS,
} from '../../types/knowledge.types.js';

/** Separator between YAML frontmatter and markdown content */
const FRONTMATTER_SEPARATOR = '---';

/**
 * Build an empty index structure.
 *
 * @returns A fresh KnowledgeIndex
 */
function emptyIndex(): KnowledgeIndex {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

/**
 * Knowledge Service singleton.
 *
 * Follows the same singleton + filesystem pattern used by SOPService.
 */
export class KnowledgeService {
  private static instance: KnowledgeService | null = null;
  private readonly logger: ComponentLogger;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('KnowledgeService');
  }

  /**
   * Get the singleton instance.
   *
   * @returns KnowledgeService instance
   */
  static getInstance(): KnowledgeService {
    if (!KnowledgeService.instance) {
      KnowledgeService.instance = new KnowledgeService();
    }
    return KnowledgeService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    KnowledgeService.instance = null;
  }

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve the docs directory for a given scope.
   *
   * @param scope - 'global' or 'project'
   * @param projectPath - Required when scope is 'project'
   * @returns Absolute path to the docs directory
   */
  private docsDir(scope: KnowledgeScope, projectPath?: string): string {
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project scope');
      }
      return path.join(projectPath, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, CREWLY_CONSTANTS.PATHS.DOCS_DIR);
    }
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(home, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, CREWLY_CONSTANTS.PATHS.DOCS_DIR);
  }

  /**
   * Resolve the index file path for a given scope.
   *
   * @param scope - 'global' or 'project'
   * @param projectPath - Required when scope is 'project'
   * @returns Absolute path to the index JSON file
   */
  private indexPath(scope: KnowledgeScope, projectPath?: string): string {
    if (scope === 'project') {
      if (!projectPath) {
        throw new Error('projectPath is required for project scope');
      }
      return path.join(projectPath, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, CREWLY_CONSTANTS.PATHS.DOCS_INDEX_FILE);
    }
    const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(home, CREWLY_CONSTANTS.PATHS.CREWLY_HOME, CREWLY_CONSTANTS.PATHS.DOCS_INDEX_FILE);
  }

  /**
   * Resolve the file path for a specific document.
   *
   * @param id - Document identifier
   * @param scope - Document scope
   * @param projectPath - Project path for project-scoped docs
   * @returns Absolute path to the .md file
   */
  private docFilePath(id: string, scope: KnowledgeScope, projectPath?: string): string {
    return path.join(this.docsDir(scope, projectPath), `${id}.md`);
  }

  /**
   * Ensure the docs directory exists.
   *
   * @param scope - Document scope
   * @param projectPath - Project path for project-scoped docs
   */
  private async ensureDocsDir(scope: KnowledgeScope, projectPath?: string): Promise<void> {
    const dir = this.docsDir(scope, projectPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Index helpers
  // ---------------------------------------------------------------------------

  /**
   * Read the knowledge index, returning an empty index if the file doesn't exist.
   *
   * @param scope - Document scope
   * @param projectPath - Project path for project-scoped docs
   * @returns The knowledge index
   */
  private async readIndex(scope: KnowledgeScope, projectPath?: string): Promise<KnowledgeIndex> {
    const indexFile = this.indexPath(scope, projectPath);
    return safeReadJson<KnowledgeIndex>(indexFile, emptyIndex());
  }

  /**
   * Write the knowledge index atomically.
   *
   * @param scope - Document scope
   * @param projectPath - Project path for project-scoped docs
   * @param index - The index data to write
   */
  private async writeIndex(scope: KnowledgeScope, projectPath?: string, index?: KnowledgeIndex): Promise<void> {
    const indexFile = this.indexPath(scope, projectPath);
    const dir = path.dirname(indexFile);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const data = index || emptyIndex();
    data.updatedAt = new Date().toISOString();
    await atomicWriteFile(indexFile, JSON.stringify(data, null, 2));
  }

  // ---------------------------------------------------------------------------
  // File I/O helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a knowledge document from its markdown file content.
   *
   * @param raw - Raw file content with YAML frontmatter
   * @param scope - Document scope
   * @param projectPath - Optional project path
   * @returns Parsed KnowledgeDocument or null if parsing fails
   */
  private parseDocumentFile(raw: string, scope: KnowledgeScope, projectPath?: string): KnowledgeDocument | null {
    try {
      const parts = raw.split(FRONTMATTER_SEPARATOR);
      if (parts.length < 3) {
        return null;
      }
      // parts[0] is empty (before first ---), parts[1] is YAML, parts[2..] is content
      const yamlStr = parts[1];
      const content = parts.slice(2).join(FRONTMATTER_SEPARATOR).trim();
      const frontmatter = parseYAML(yamlStr) as KnowledgeFrontmatter;

      if (!frontmatter || !frontmatter.id || !frontmatter.title) {
        return null;
      }

      return {
        id: frontmatter.id,
        title: frontmatter.title,
        category: frontmatter.category || 'General',
        tags: frontmatter.tags || [],
        content,
        scope,
        projectPath: scope === 'project' ? projectPath : undefined,
        createdBy: frontmatter.createdBy || 'unknown',
        updatedBy: frontmatter.updatedBy || frontmatter.createdBy || 'unknown',
        createdAt: frontmatter.createdAt || new Date().toISOString(),
        updatedAt: frontmatter.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to parse document file', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Serialize a knowledge document to markdown with YAML frontmatter.
   *
   * @param doc - The document to serialize
   * @returns Markdown string with frontmatter
   */
  private serializeDocument(doc: KnowledgeDocument): string {
    const frontmatter: KnowledgeFrontmatter = {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    const yamlStr = stringifyYAML(frontmatter).trim();
    return `${FRONTMATTER_SEPARATOR}\n${yamlStr}\n${FRONTMATTER_SEPARATOR}\n${doc.content}`;
  }

  /**
   * Build an index entry from a knowledge document.
   *
   * @param doc - The document
   * @returns Index entry with preview
   */
  private buildIndexEntry(doc: KnowledgeDocument): KnowledgeIndexEntry {
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      tags: doc.tags,
      preview: doc.content.slice(0, KNOWLEDGE_CONSTANTS.PREVIEW_LENGTH),
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * List all documents for a given scope, optionally filtered.
   *
   * @param scope - 'global' or 'project'
   * @param projectPath - Required when scope is 'project'
   * @param filters - Optional category/search filters
   * @returns Array of document summaries
   */
  async listDocuments(
    scope: KnowledgeScope,
    projectPath?: string,
    filters?: KnowledgeDocumentFilters,
  ): Promise<KnowledgeDocumentSummary[]> {
    const index = await this.readIndex(scope, projectPath);
    let entries = index.entries;

    if (filters?.category) {
      entries = entries.filter((e) => e.category === filters.category);
    }

    if (filters?.search) {
      const query = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)) ||
          e.preview.toLowerCase().includes(query),
      );
    }

    return entries.map((e) => ({
      ...e,
      scope,
    }));
  }

  /**
   * Get a single document by ID.
   *
   * @param id - Document identifier
   * @param scope - Document scope
   * @param projectPath - Required when scope is 'project'
   * @returns Full document or null if not found
   */
  async getDocument(
    id: string,
    scope: KnowledgeScope,
    projectPath?: string,
  ): Promise<KnowledgeDocument | null> {
    const filePath = this.docFilePath(id, scope, projectPath);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return this.parseDocumentFile(raw, scope, projectPath);
    } catch {
      return null;
    }
  }

  /**
   * Create a new knowledge document.
   *
   * @param params - Document creation parameters
   * @returns The generated document ID
   * @throws Error if validation fails
   */
  async createDocument(params: CreateKnowledgeDocumentParams): Promise<string> {
    const { title, content, category, scope, projectPath, tags = [], createdBy } = params;

    // Validation
    if (!title || title.length > KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH) {
      throw new Error(`Title is required and must be at most ${KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH} characters`);
    }
    if (content.length > KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH) {
      throw new Error(`Content must be at most ${KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH} characters`);
    }
    if (tags.length > KNOWLEDGE_CONSTANTS.MAX_TAGS) {
      throw new Error(`Maximum ${KNOWLEDGE_CONSTANTS.MAX_TAGS} tags allowed`);
    }
    if (scope === 'project' && !projectPath) {
      throw new Error('projectPath is required for project scope');
    }

    await this.ensureDocsDir(scope, projectPath);

    const id = uuidv4();
    const now = new Date().toISOString();

    const doc: KnowledgeDocument = {
      id,
      title,
      content,
      category: category || 'General',
      tags,
      scope,
      projectPath: scope === 'project' ? projectPath : undefined,
      createdBy: createdBy || 'user',
      updatedBy: createdBy || 'user',
      createdAt: now,
      updatedAt: now,
    };

    // Write document file
    const filePath = this.docFilePath(id, scope, projectPath);
    await atomicWriteFile(filePath, this.serializeDocument(doc));

    // Update index
    const index = await this.readIndex(scope, projectPath);
    index.entries.push(this.buildIndexEntry(doc));
    await this.writeIndex(scope, projectPath, index);

    this.logger.info('Document created', { id, title, scope });
    return id;
  }

  /**
   * Update an existing knowledge document.
   *
   * @param id - Document identifier
   * @param params - Update parameters
   * @throws Error if document not found or validation fails
   */
  async updateDocument(id: string, params: UpdateKnowledgeDocumentParams): Promise<void> {
    const { scope, projectPath, updatedBy } = params;

    const existing = await this.getDocument(id, scope, projectPath);
    if (!existing) {
      throw new Error(`Document '${id}' not found`);
    }

    if (params.title !== undefined && params.title.length > KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH) {
      throw new Error(`Title must be at most ${KNOWLEDGE_CONSTANTS.MAX_TITLE_LENGTH} characters`);
    }
    if (params.content !== undefined && params.content.length > KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH) {
      throw new Error(`Content must be at most ${KNOWLEDGE_CONSTANTS.MAX_CONTENT_LENGTH} characters`);
    }
    if (params.tags !== undefined && params.tags.length > KNOWLEDGE_CONSTANTS.MAX_TAGS) {
      throw new Error(`Maximum ${KNOWLEDGE_CONSTANTS.MAX_TAGS} tags allowed`);
    }

    const updated: KnowledgeDocument = {
      ...existing,
      title: params.title ?? existing.title,
      content: params.content ?? existing.content,
      category: params.category ?? existing.category,
      tags: params.tags ?? existing.tags,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };

    // Write updated document file
    const filePath = this.docFilePath(id, scope, projectPath);
    await atomicWriteFile(filePath, this.serializeDocument(updated));

    // Update index entry
    const index = await this.readIndex(scope, projectPath);
    const entryIdx = index.entries.findIndex((e) => e.id === id);
    const newEntry = this.buildIndexEntry(updated);
    if (entryIdx >= 0) {
      index.entries[entryIdx] = newEntry;
    } else {
      index.entries.push(newEntry);
    }
    await this.writeIndex(scope, projectPath, index);

    this.logger.info('Document updated', { id, scope });
  }

  /**
   * Delete a knowledge document.
   *
   * @param id - Document identifier
   * @param scope - Document scope
   * @param projectPath - Required when scope is 'project'
   * @throws Error if document not found
   */
  async deleteDocument(id: string, scope: KnowledgeScope, projectPath?: string): Promise<void> {
    const filePath = this.docFilePath(id, scope, projectPath);
    try {
      await fs.unlink(filePath);
    } catch {
      throw new Error(`Document '${id}' not found`);
    }

    // Remove from index
    const index = await this.readIndex(scope, projectPath);
    index.entries = index.entries.filter((e) => e.id !== id);
    await this.writeIndex(scope, projectPath, index);

    this.logger.info('Document deleted', { id, scope });
  }

  /**
   * List all categories in use for a given scope, merged with defaults.
   *
   * @param scope - Document scope
   * @param projectPath - Required when scope is 'project'
   * @returns Array of category names (defaults + custom in-use)
   */
  async listCategories(scope: KnowledgeScope, projectPath?: string): Promise<string[]> {
    const index = await this.readIndex(scope, projectPath);
    const inUse = new Set(index.entries.map((e) => e.category));
    const all = new Set<string>([...DEFAULT_KNOWLEDGE_CATEGORIES, ...inUse]);
    return [...all].sort();
  }
}
