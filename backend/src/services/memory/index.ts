/**
 * Memory Services Module
 *
 * Provides services for managing agent and project memory.
 *
 * @module services/memory
 */

export { AgentMemoryService, type IAgentMemoryService, type TaskCompletionMetrics } from './agent-memory.service.js';
export { ProjectMemoryService, type IProjectMemoryService, type SearchResults } from './project-memory.service.js';
export { MemoryService, type IMemoryService, type RememberParams, type RecallParams, type RecallResult, type LearningParams, type RememberCategory, type MemoryScope as UnifiedMemoryScope } from './memory.service.js';

// Re-export memory types for convenience
export type {
  AgentMemory,
  ProjectMemory,
  RoleKnowledgeEntry,
  PatternEntry,
  DecisionEntry,
  GotchaEntry,
  RelationshipEntry,
  LearningEntry,
  AgentPreferences,
  PerformanceMetrics,
  MemoryQueryOptions,
  MemoryQueryResult,
  MemoryScope,
  RoleKnowledgeCategory,
  PatternCategory,
  GotchaSeverity,
  RelationshipType,
  LearningCategory,
} from '../../types/memory.types.js';
