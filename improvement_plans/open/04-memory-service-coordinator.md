---
id: 04-memory-service-coordinator
title: Create Unified MemoryService Coordinator
phase: 1
priority: P0
status: open
estimatedHours: 6
dependencies: [02-agent-memory-service, 03-project-memory-service]
blocks: [05-memory-prompt-integration, 06-memory-mcp-tools]
---

# Task: Create Unified MemoryService Coordinator

## Objective
Create a unified `MemoryService` that coordinates both agent-level and project-level memory services, providing a single interface for memory operations.

## Background
With separate services for agent and project memory, we need a coordinator that:
- Provides a unified API for callers
- Handles cross-cutting concerns (logging, validation)
- Generates combined context from both sources

## Deliverables

### 1. MemoryService Class

**Location:** `backend/src/services/memory/memory.service.ts`

```typescript
interface IMemoryService {
  // Unified remember/recall
  remember(params: RememberParams): Promise<string>;
  recall(params: RecallParams): Promise<RecallResult>;

  // Context generation
  getFullContext(agentId: string, projectPath: string): Promise<string>;

  // Learning recording
  recordLearning(params: LearningParams): Promise<void>;

  // Initialization
  initializeForSession(agentId: string, role: string, projectPath: string): Promise<void>;

  // Access to individual services
  getAgentMemory(): IAgentMemoryService;
  getProjectMemory(): IProjectMemoryService;
}

interface RememberParams {
  agentId: string;
  projectPath?: string;
  content: string;
  category: 'fact' | 'pattern' | 'decision' | 'gotcha' | 'preference';
  scope: 'agent' | 'project';
  metadata?: Record<string, any>;
}

interface RecallParams {
  agentId: string;
  projectPath?: string;
  context: string;  // What the agent is working on
  scope: 'agent' | 'project' | 'both';
  limit?: number;
}

interface RecallResult {
  agentMemories: string[];
  projectMemories: string[];
  combined: string;
}

interface LearningParams {
  agentId: string;
  projectPath: string;
  learning: string;
  relatedTask?: string;
  relatedFiles?: string[];
}
```

### 2. Implementation

```typescript
class MemoryService implements IMemoryService {
  private static instance: MemoryService;
  private agentMemory: AgentMemoryService;
  private projectMemory: ProjectMemoryService;
  private logger: Logger;

  private constructor() {
    this.agentMemory = AgentMemoryService.getInstance();
    this.projectMemory = ProjectMemoryService.getInstance();
    this.logger = LoggerService.getInstance().createLogger('MemoryService');
  }

  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  async remember(params: RememberParams): Promise<string> {
    this.logger.debug('Remember called', {
      agentId: params.agentId,
      scope: params.scope,
      category: params.category
    });

    if (params.scope === 'agent') {
      return this.rememberForAgent(params);
    } else {
      return this.rememberForProject(params);
    }
  }

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
        throw new Error(`Category ${params.category} not valid for agent scope`);
    }
  }

  private async rememberForProject(params: RememberParams): Promise<string> {
    if (!params.projectPath) {
      throw new Error('projectPath required for project scope');
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

      default:
        throw new Error(`Category ${params.category} not valid for project scope`);
    }
  }

  async recall(params: RecallParams): Promise<RecallResult> {
    const result: RecallResult = {
      agentMemories: [],
      projectMemories: [],
      combined: '',
    };

    if (params.scope === 'agent' || params.scope === 'both') {
      const knowledge = await this.agentMemory.getRoleKnowledge(params.agentId);
      result.agentMemories = this.filterRelevant(knowledge, params.context, params.limit);
    }

    if ((params.scope === 'project' || params.scope === 'both') && params.projectPath) {
      const searchResults = await this.projectMemory.searchAll(params.projectPath, params.context);
      result.projectMemories = this.formatSearchResults(searchResults, params.limit);
    }

    result.combined = this.combineMemories(result);
    return result;
  }

  async getFullContext(agentId: string, projectPath: string): Promise<string> {
    const [agentContext, projectContext] = await Promise.all([
      this.agentMemory.generateAgentContext(agentId),
      this.projectMemory.generateProjectContext(projectPath),
    ]);

    return `
${agentContext}

---

${projectContext}
`.trim();
  }

  async recordLearning(params: LearningParams): Promise<void> {
    // Record to project learnings
    await this.projectMemory.recordLearning(
      params.projectPath,
      params.agentId,
      params.learning,
      {
        relatedTask: params.relatedTask,
        relatedFiles: params.relatedFiles,
      }
    );

    // Also potentially add to agent knowledge if it's role-relevant
    if (this.isRoleRelevant(params.learning)) {
      await this.agentMemory.addRoleKnowledge(params.agentId, {
        category: 'best-practice',
        content: params.learning,
        learnedFrom: params.relatedTask,
        confidence: 0.3,  // Lower initial confidence for auto-extracted
      });
    }
  }

  async initializeForSession(agentId: string, role: string, projectPath: string): Promise<void> {
    await Promise.all([
      this.agentMemory.initializeAgent(agentId, role),
      this.projectMemory.initializeProject(projectPath),
    ]);

    this.logger.info('Memory initialized for session', { agentId, role, projectPath });
  }
}
```

### 3. Barrel Export

**Location:** `backend/src/services/memory/index.ts`

```typescript
export { MemoryService } from './memory.service';
export { AgentMemoryService } from './agent-memory.service';
export { ProjectMemoryService } from './project-memory.service';
export * from './memory.types';
```

## Implementation Steps

1. **Create coordinator class**
   - Singleton pattern
   - Inject both sub-services

2. **Implement unified remember**
   - Route to appropriate service
   - Validate parameters
   - Handle edge cases

3. **Implement unified recall**
   - Combine results from both sources
   - Filter by relevance
   - Format combined output

4. **Implement context generation**
   - Parallel fetch from both services
   - Combine with proper formatting

5. **Implement learning recording**
   - Write to project learnings
   - Extract role-relevant to agent memory

6. **Add logging**
   - Debug logs for all operations
   - Error logging with context

7. **Write tests**
   - Integration tests with both services
   - Test unified API

## Acceptance Criteria

- [ ] `MemoryService` coordinator implemented
- [ ] Unified `remember` routes correctly
- [ ] Unified `recall` combines both sources
- [ ] Context generation parallel and complete
- [ ] Learning recording cross-posts appropriately
- [ ] Comprehensive logging
- [ ] Integration tests passing

## Notes

- This is the main entry point for memory operations
- MCP tools will use this coordinator
- Prompt builder will use `getFullContext`
- Consider caching for frequently accessed contexts
