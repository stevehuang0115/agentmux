/**
 * Knowledge Document Types
 *
 * Type definitions for the Company Knowledge system, which stores
 * markdown documents with YAML frontmatter for team documentation,
 * SOPs, architecture notes, runbooks, and other company knowledge.
 *
 * @module types/knowledge.types
 */

/**
 * Scope of a knowledge document — global (company-wide) or project-specific.
 */
export type KnowledgeScope = 'global' | 'project';

/**
 * Default document categories available in the knowledge system.
 */
export const DEFAULT_KNOWLEDGE_CATEGORIES = [
  'SOPs',
  'Team Norms',
  'Architecture',
  'Onboarding',
  'Runbooks',
  'General',
] as const;

/**
 * Type for default knowledge categories.
 */
export type DefaultKnowledgeCategory = (typeof DEFAULT_KNOWLEDGE_CATEGORIES)[number];

/**
 * Constants for the knowledge document system.
 */
export const KNOWLEDGE_CONSTANTS = {
  /** Maximum content length for a document (500KB) */
  MAX_CONTENT_LENGTH: 512000,
  /** Maximum title length */
  MAX_TITLE_LENGTH: 200,
  /** Maximum number of tags per document */
  MAX_TAGS: 20,
  /** Maximum tag length */
  MAX_TAG_LENGTH: 50,
  /** Maximum category name length */
  MAX_CATEGORY_LENGTH: 50,
  /** Preview length for document summaries */
  PREVIEW_LENGTH: 200,
} as const;

/**
 * YAML frontmatter stored at the top of each knowledge document file.
 */
export interface KnowledgeFrontmatter {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Document category (from defaults or custom) */
  category: string;
  /** Optional tags for filtering/search */
  tags: string[];
  /** Who created the document (user or agent session name) */
  createdBy: string;
  /** Who last updated the document */
  updatedBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Full knowledge document including frontmatter and markdown content.
 */
export interface KnowledgeDocument {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Document category */
  category: string;
  /** Tags for filtering/search */
  tags: string[];
  /** Full markdown content (body only, excluding frontmatter) */
  content: string;
  /** Document scope */
  scope: KnowledgeScope;
  /** Project path if scope is 'project' */
  projectPath?: string;
  /** Who created the document */
  createdBy: string;
  /** Who last updated the document */
  updatedBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Summary of a knowledge document for list views (no full content).
 */
export interface KnowledgeDocumentSummary {
  /** Unique document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Document category */
  category: string;
  /** Tags for filtering/search */
  tags: string[];
  /** First N characters of content for preview */
  preview: string;
  /** Document scope */
  scope: KnowledgeScope;
  /** Who created the document */
  createdBy: string;
  /** Who last updated the document */
  updatedBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Entry in the knowledge index file for fast listing.
 */
export interface KnowledgeIndexEntry {
  /** Document identifier */
  id: string;
  /** Document title */
  title: string;
  /** Document category */
  category: string;
  /** Tags */
  tags: string[];
  /** Content preview */
  preview: string;
  /** Who created the document */
  createdBy: string;
  /** Who last updated the document */
  updatedBy: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Cached embedding vector for semantic search (set by GeminiEmbeddingStrategy) */
  embedding?: number[];
}

/**
 * JSON index stored per scope for fast document listing.
 */
export interface KnowledgeIndex {
  /** Schema version for future migrations */
  version: number;
  /** Last time the index was updated */
  updatedAt: string;
  /** Array of document index entries */
  entries: KnowledgeIndexEntry[];
}

/**
 * Parameters for creating a new knowledge document.
 */
export interface CreateKnowledgeDocumentParams {
  /** Document title */
  title: string;
  /** Markdown content */
  content: string;
  /** Document category */
  category: string;
  /** Document scope */
  scope: KnowledgeScope;
  /** Project path (required when scope is 'project') */
  projectPath?: string;
  /** Tags for filtering/search */
  tags?: string[];
  /** Who is creating the document */
  createdBy: string;
}

/**
 * Parameters for updating an existing knowledge document.
 */
export interface UpdateKnowledgeDocumentParams {
  /** Updated title */
  title?: string;
  /** Updated markdown content */
  content?: string;
  /** Updated category */
  category?: string;
  /** Updated tags */
  tags?: string[];
  /** Document scope */
  scope: KnowledgeScope;
  /** Project path (required when scope is 'project') */
  projectPath?: string;
  /** Who is updating the document */
  updatedBy: string;
}

/**
 * Filters for listing knowledge documents.
 */
export interface KnowledgeDocumentFilters {
  /** Filter by category */
  category?: string;
  /** Search query (matches title, tags, preview) */
  search?: string;
}
