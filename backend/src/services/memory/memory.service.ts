/**
 * Memory Service Coordinator
 *
 * Provides a unified interface for both agent-level and project-level memory services.
 * Handles cross-cutting concerns like logging, validation, and combined context generation.
 *
 * @module services/memory/memory.service
 */

import { AgentMemoryService, IAgentMemoryService } from './agent-memory.service.js';
import { ProjectMemoryService, IProjectMemoryService, SearchResults } from './project-memory.service.js';
import { LoggerService } from '../core/logger.service.js';
import type {
  RoleKnowledgeEntry,
  RoleKnowledgeCategory,
  PatternCategory,
  GotchaSeverity,
  AgentPreferences,
} from '../../types/memory.types.js';

/**
 * Categories for the unified remember operation
 */
export type RememberCategory = 'fact' | 'pattern' | 'decision' | 'gotcha' | 'preference' | 'relationship';

/**
 * Scope for memory operations
 */
export type MemoryScope = 'agent' | 'project' | 'both';

/**
 * Parameters for the remember operation
 */
export interface RememberParams {
  /** Agent identifier */
  agentId: string;
  /** Project path (required for project scope) */
  projectPath?: string;
  /** Content to remember */
  content: string;
  /** Category of memory */
  category: RememberCategory;
  /** Scope: agent or project */
  scope: 'agent' | 'project';
  /** Additional metadata */
  metadata?: {
    /** Task ID where this was learned */
    taskId?: string;
    /** Title for patterns/decisions/gotchas */
    title?: string;
    /** Pattern category */
    patternCategory?: PatternCategory;
    /** Code example */
    example?: string;
    /** Related files */
    files?: string[];
    /** Rationale for decisions */
    rationale?: string;
    /** Alternatives considered for decisions */
    alternatives?: string[];
    /** Areas affected by decisions */
    affectedAreas?: string[];
    /** Solution for gotchas */
    solution?: string;
    /** Severity for gotchas */
    severity?: GotchaSeverity;
    /** Relationship type */
    relationshipType?: 'depends-on' | 'uses' | 'extends' | 'implements' | 'calls' | 'imported-by';
    /** Target component for relationships */
    targetComponent?: string;
  };
}

/**
 * Parameters for the recall operation
 */
export interface RecallParams {
  /** Agent identifier */
  agentId: string;
  /** Project path (required for project/both scope) */
  projectPath?: string;
  /** Context/query for finding relevant memories */
  context: string;
  /** Scope: agent, project, or both */
  scope: MemoryScope;
  /** Maximum number of results */
  limit?: number;
}

/**
 * Result of a recall operation
 */
export interface RecallResult {
  /** Memories from agent level */
  agentMemories: string[];
  /** Memories from project level */
  projectMemories: string[];
  /** Combined formatted result */
  combined: string;
}

/**
 * Parameters for recording a learning
 */
export interface LearningParams {
  /** Agent identifier */
  agentId: string;
  /** Agent's role */
  agentRole: string;
  /** Project path */
  projectPath: string;
  /** The learning content */
  learning: string;
  /** Related task/ticket ID */
  relatedTask?: string;
  /** Related file paths */
  relatedFiles?: string[];
}

/**
 * Interface for the unified Memory Service
 */
export interface IMemoryService {
  remember(params: RememberParams): Promise<string>;
  recall(params: RecallParams): Promise<RecallResult>;
  getFullContext(agentId: string, projectPath: string): Promise<string>;
  recordLearning(params: LearningParams): Promise<void>;
  initializeForSession(agentId: string, role: string, projectPath: string): Promise<void>;
  getAgentMemoryService(): IAgentMemoryService;
  getProjectMemoryService(): IProjectMemoryService;
}

/**
 * Unified Memory Service Coordinator
 *
 * Provides a single entry point for all memory operations, coordinating
 * between agent-level and project-level memory services.
 *
 * @example
 * ```typescript
 * const memoryService = MemoryService.getInstance();
 *
 * // Initialize for a session
 * await memoryService.initializeForSession('dev-001', 'developer', '/path/to/project');
 *
 * // Remember something
 * await memoryService.remember({
 *   agentId: 'dev-001',
 *   projectPath: '/path/to/project',
 *   content: 'Always use async/await instead of callbacks',
 *   category: 'pattern',
 *   scope: 'project',
 *   metadata: { title: 'Async Pattern' }
 * });
 *
 * // Get full context for prompts
 * const context = await memoryService.getFullContext('dev-001', '/path/to/project');
 * ```
 */
export class MemoryService implements IMemoryService {
  private static instance: MemoryService | null = null;

  private readonly agentMemory: AgentMemoryService;
  private readonly projectMemory: ProjectMemoryService;
  private readonly logger = LoggerService.getInstance().createComponentLogger('MemoryService');

  /**
   * Creates a new MemoryService instance
   */
  private constructor() {
    this.agentMemory = AgentMemoryService.getInstance();
    this.projectMemory = ProjectMemoryService.getInstance();
  }

  /**
   * Gets the singleton instance of MemoryService
   *
   * @returns The singleton MemoryService instance
   */
  public static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * Clears the singleton instance (useful for testing)
   */
  public static clearInstance(): void {
    MemoryService.instance = null;
    AgentMemoryService.clearInstance();
    ProjectMemoryService.clearInstance();
  }

  /**
   * Gets the underlying AgentMemoryService
   *
   * @returns The AgentMemoryService instance
   */
  public getAgentMemoryService(): IAgentMemoryService {
    return this.agentMemory;
  }

  /**
   * Gets the underlying ProjectMemoryService
   *
   * @returns The ProjectMemoryService instance
   */
  public getProjectMemoryService(): IProjectMemoryService {
    return this.projectMemory;
  }

  /**
   * Maps RememberCategory to RoleKnowledgeCategory for agent memory
   */
  private mapToKnowledgeCategory(category: RememberCategory): RoleKnowledgeCategory {
    switch (category) {
      case 'fact':
        return 'best-practice';
      case 'pattern':
        return 'workflow';
      case 'preference':
        return 'workflow';
      default:
        return 'best-practice';
    }
  }

  /**
   * Parses a preference string into AgentPreferences
   */
  private parsePreference(content: string): Partial<AgentPreferences> {
    // Simple parsing - in practice this would be more sophisticated
    const preferences: Partial<AgentPreferences> = {};

    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('concise') || lowerContent.includes('brief')) {
      preferences.communicationStyle = {
        verbosity: 'concise',
        askBeforeAction: true,
      };
    } else if (lowerContent.includes('detailed') || lowerContent.includes('verbose')) {
      preferences.communicationStyle = {
        verbosity: 'detailed',
        askBeforeAction: true,
      };
    }

    if (lowerContent.includes('small task') || lowerContent.includes('small chunk')) {
      preferences.workPatterns = { breakdownSize: 'small' };
    } else if (lowerContent.includes('large task') || lowerContent.includes('large chunk')) {
      preferences.workPatterns = { breakdownSize: 'large' };
    }

    return preferences;
  }

  /**
   * Checks if a learning is role-relevant (should be stored in agent memory)
   */
  private isRoleRelevant(learning: string): boolean {
    const roleKeywords = [
      'always', 'never', 'should', 'must', 'prefer', 'avoid',
      'best practice', 'pattern', 'convention', 'standard',
      'remember to', 'don\'t forget', 'important to'
    ];

    const lowerLearning = learning.toLowerCase();
    return roleKeywords.some(keyword => lowerLearning.includes(keyword));
  }

  /**
   * Filters memories by relevance to a context
   */
  private filterRelevant(knowledge: RoleKnowledgeEntry[], context: string, limit?: number): string[] {
    const contextWords = context.toLowerCase().split(/\s+/);

    const scored = knowledge.map(entry => {
      const contentWords = entry.content.toLowerCase().split(/\s+/);
      const matchCount = contextWords.filter(word =>
        contentWords.some(cw => cw.includes(word) || word.includes(cw))
      ).length;
      return {
        entry,
        score: matchCount * entry.confidence,
      };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || 10)
      .map(s => `[${s.entry.category}] ${s.entry.content}`);
  }

  /**
   * Formats search results into strings
   */
  private formatSearchResults(results: SearchResults, limit?: number): string[] {
    const formatted: string[] = [];
    const maxPerType = Math.ceil((limit || 10) / 4);

    results.patterns.slice(0, maxPerType).forEach(p => {
      formatted.push(`[pattern] ${p.title}: ${p.description}`);
    });

    results.decisions.slice(0, maxPerType).forEach(d => {
      formatted.push(`[decision] ${d.title}: ${d.decision}`);
    });

    results.gotchas.slice(0, maxPerType).forEach(g => {
      formatted.push(`[gotcha] ${g.title}: ${g.problem} → ${g.solution}`);
    });

    results.relationships.slice(0, maxPerType).forEach(r => {
      formatted.push(`[relationship] ${r.from} ${r.relationshipType} ${r.to}`);
    });

    return formatted.slice(0, limit || 10);
  }

  /**
   * Combines agent and project memories into a formatted string
   */
  private combineMemories(result: RecallResult): string {
    const sections: string[] = [];

    if (result.agentMemories.length > 0) {
      sections.push('### From Your Experience\n' + result.agentMemories.map(m => `- ${m}`).join('\n'));
    }

    if (result.projectMemories.length > 0) {
      sections.push('### From Project Knowledge\n' + result.projectMemories.map(m => `- ${m}`).join('\n'));
    }

    return sections.join('\n\n');
  }

  // ========================= PUBLIC INTERFACE =========================

  /**
   * Unified remember operation - stores content in appropriate memory
   *
   * @param params - Remember parameters
   * @returns ID of the stored memory entry
   *
   * @example
   * ```typescript
   * // Remember a pattern for the project
   * await memoryService.remember({
   *   agentId: 'dev-001',
   *   projectPath: '/path/to/project',
   *   content: 'Use error wrapper for all API endpoints',
   *   category: 'pattern',
   *   scope: 'project',
   *   metadata: {
   *     title: 'API Error Handling',
   *     patternCategory: 'api',
   *     example: 'handleApiError(handler)'
   *   }
   * });
   * ```
   */
  public async remember(params: RememberParams): Promise<string> {
    this.logger.debug('Remember called', {
      agentId: params.agentId,
      scope: params.scope,
      category: params.category,
    });

    if (params.scope === 'agent') {
      return this.rememberForAgent(params);
    } else {
      return this.rememberForProject(params);
    }
  }

  /**
   * Stores memory at agent level
   */
  private async rememberForAgent(params: RememberParams): Promise<string> {
    switch (params.category) {
      case 'fact':
      case 'pattern':
        return this.agentMemory.addRoleKnowledge(params.agentId, {
          category: this.mapToKnowledgeCategory(params.category),
          content: params.content,
          learnedFrom: params.metadata?.taskId,
          confidence: 0.5,
        });

      case 'preference':
        await this.agentMemory.updatePreferences(
          params.agentId,
          this.parsePreference(params.content)
        );
        return 'preference-updated';

      default:
        throw new Error(`Category '${params.category}' is not valid for agent scope. Use 'fact', 'pattern', or 'preference'.`);
    }
  }

  /**
   * Stores memory at project level
   */
  private async rememberForProject(params: RememberParams): Promise<string> {
    if (!params.projectPath) {
      throw new Error('projectPath is required for project scope');
    }

    switch (params.category) {
      case 'pattern':
        return this.projectMemory.addPattern(params.projectPath, {
          category: params.metadata?.patternCategory || 'other',
          title: params.metadata?.title || 'Untitled Pattern',
          description: params.content,
          example: params.metadata?.example,
          files: params.metadata?.files,
          discoveredBy: params.agentId,
        });

      case 'decision':
        return this.projectMemory.addDecision(params.projectPath, {
          title: params.metadata?.title || 'Untitled Decision',
          decision: params.content,
          rationale: params.metadata?.rationale || '',
          alternatives: params.metadata?.alternatives,
          decidedBy: params.agentId,
          affectedAreas: params.metadata?.affectedAreas,
        });

      case 'gotcha':
        return this.projectMemory.addGotcha(params.projectPath, {
          title: params.metadata?.title || 'Gotcha',
          problem: params.content,
          solution: params.metadata?.solution || '',
          severity: params.metadata?.severity || 'medium',
          discoveredBy: params.agentId,
        });

      case 'relationship':
        if (!params.metadata?.targetComponent) {
          throw new Error('targetComponent is required in metadata for relationship category');
        }
        return this.projectMemory.addRelationship(params.projectPath, {
          from: params.content, // content is the source component
          to: params.metadata.targetComponent,
          relationshipType: params.metadata?.relationshipType || 'uses',
        });

      default:
        throw new Error(`Category '${params.category}' is not valid for project scope. Use 'pattern', 'decision', 'gotcha', or 'relationship'.`);
    }
  }

  /**
   * Unified recall operation - retrieves relevant memories
   *
   * @param params - Recall parameters
   * @returns Recall results from appropriate scopes
   *
   * @example
   * ```typescript
   * const memories = await memoryService.recall({
   *   agentId: 'dev-001',
   *   projectPath: '/path/to/project',
   *   context: 'error handling in API endpoints',
   *   scope: 'both',
   *   limit: 10
   * });
   * console.log(memories.combined);
   * ```
   */
  public async recall(params: RecallParams): Promise<RecallResult> {
    this.logger.debug('Recall called', {
      agentId: params.agentId,
      scope: params.scope,
      context: params.context.substring(0, 50),
    });

    const result: RecallResult = {
      agentMemories: [],
      projectMemories: [],
      combined: '',
    };

    // Fetch from agent memory
    if (params.scope === 'agent' || params.scope === 'both') {
      const knowledge = await this.agentMemory.getRoleKnowledge(params.agentId);
      result.agentMemories = this.filterRelevant(knowledge, params.context, params.limit);
    }

    // Fetch from project memory
    if ((params.scope === 'project' || params.scope === 'both') && params.projectPath) {
      const searchResults = await this.projectMemory.searchAll(params.projectPath, params.context);
      result.projectMemories = this.formatSearchResults(searchResults, params.limit);
    }

    result.combined = this.combineMemories(result);
    return result;
  }

  /**
   * Generates combined context from both agent and project memory
   *
   * @param agentId - Agent identifier
   * @param projectPath - Project path
   * @returns Combined context string for prompt injection
   */
  public async getFullContext(agentId: string, projectPath: string): Promise<string> {
    this.logger.debug('Getting full context', { agentId, projectPath });

    const [agentContext, projectContext] = await Promise.all([
      this.agentMemory.generateAgentContext(agentId),
      this.projectMemory.generateProjectContext(projectPath),
    ]);

    const sections: string[] = [];

    if (agentContext) {
      sections.push('# Your Agent Memory\n\n' + agentContext);
    }

    if (projectContext) {
      sections.push('# Project Knowledge\n\n' + projectContext);
    }

    return sections.join('\n\n---\n\n').trim();
  }

  /**
   * Records a learning to both project learnings and potentially agent memory
   *
   * @param params - Learning parameters
   */
  public async recordLearning(params: LearningParams): Promise<void> {
    this.logger.debug('Recording learning', {
      agentId: params.agentId,
      projectPath: params.projectPath,
    });

    // Record to project learnings (always)
    await this.projectMemory.recordLearning(
      params.projectPath,
      params.agentId,
      params.agentRole,
      params.learning,
      {
        relatedTask: params.relatedTask,
        relatedFiles: params.relatedFiles,
      }
    );

    // Also add to agent knowledge if it's role-relevant
    if (this.isRoleRelevant(params.learning)) {
      try {
        await this.agentMemory.addRoleKnowledge(params.agentId, {
          category: 'best-practice',
          content: params.learning,
          learnedFrom: params.relatedTask,
          confidence: 0.3, // Lower initial confidence for auto-extracted
        });
        this.logger.debug('Also added to agent knowledge', { agentId: params.agentId });
      } catch (error) {
        // Don't fail if agent memory write fails
        this.logger.warn('Failed to add learning to agent memory', { error });
      }
    }
  }

  /**
   * Initializes memory for a new session
   *
   * @param agentId - Agent identifier
   * @param role - Agent's role
   * @param projectPath - Project path
   */
  public async initializeForSession(agentId: string, role: string, projectPath: string): Promise<void> {
    this.logger.info('Initializing memory for session', { agentId, role, projectPath });

    await Promise.all([
      this.agentMemory.initializeAgent(agentId, role),
      this.projectMemory.initializeProject(projectPath),
    ]);

    this.logger.info('Memory initialized for session', { agentId, role, projectPath });
  }
}
