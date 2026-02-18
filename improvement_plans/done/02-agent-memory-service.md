---
id: 02-agent-memory-service
title: Implement MemoryService for Agent-Level Memory
phase: 1
priority: P0
status: open
estimatedHours: 12
dependencies: [01-memory-data-models]
blocks: [05-memory-prompt-integration, 06-memory-mcp-tools]
---

# Task: Implement MemoryService for Agent-Level Memory

## Objective
Create the service that manages agent-level persistent memory stored in `~/.crewly/agents/{agentId}/`.

## Background
Agent-level memory stores role-specific knowledge, preferences, and performance metrics that persist across projects. This enables agents to become more effective over time.

## Deliverables

### 1. AgentMemoryService Class

**Location:** `backend/src/services/memory/agent-memory.service.ts`

```typescript
interface IAgentMemoryService {
  // Initialization
  initializeAgent(agentId: string, role: string): Promise<void>;

  // Role Knowledge
  addRoleKnowledge(agentId: string, entry: Omit<RoleKnowledgeEntry, 'id' | 'createdAt'>): Promise<string>;
  getRoleKnowledge(agentId: string, category?: string): Promise<RoleKnowledgeEntry[]>;
  reinforceKnowledge(agentId: string, entryId: string): Promise<void>;

  // Preferences
  updatePreferences(agentId: string, preferences: Partial<AgentPreferences>): Promise<void>;
  getPreferences(agentId: string): Promise<AgentPreferences>;

  // Performance
  recordTaskCompletion(agentId: string, metrics: TaskCompletionMetrics): Promise<void>;
  recordError(agentId: string, errorPattern: string, resolution?: string): Promise<void>;
  getPerformanceMetrics(agentId: string): Promise<PerformanceMetrics>;

  // Context Generation
  generateAgentContext(agentId: string): Promise<string>;

  // Maintenance
  pruneStaleEntries(agentId: string, olderThan: Date): Promise<number>;
}
```

### 2. Implementation Details

#### File Operations

```typescript
class AgentMemoryService implements IAgentMemoryService {
  private readonly basePath: string;  // ~/.crewly/agents

  private getAgentPath(agentId: string): string {
    return path.join(this.basePath, agentId);
  }

  private async ensureAgentDirectory(agentId: string): Promise<void> {
    const agentPath = this.getAgentPath(agentId);
    await fs.mkdir(agentPath, { recursive: true });
    await fs.mkdir(path.join(agentPath, 'sop-custom'), { recursive: true });
  }

  private async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return defaultValue;
    }
  }

  private async writeJson<T>(filePath: string, data: T): Promise<void> {
    // Atomic write pattern
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    await fs.rename(tempPath, filePath);
  }
}
```

#### Knowledge Management

```typescript
async addRoleKnowledge(
  agentId: string,
  entry: Omit<RoleKnowledgeEntry, 'id' | 'createdAt'>
): Promise<string> {
  const knowledge = await this.getRoleKnowledgeFile(agentId);

  // Check for similar existing entry
  const existing = this.findSimilarEntry(knowledge, entry.content);
  if (existing) {
    // Reinforce existing rather than duplicate
    await this.reinforceKnowledge(agentId, existing.id);
    return existing.id;
  }

  const newEntry: RoleKnowledgeEntry = {
    ...entry,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
    confidence: 0.5,  // Start at medium confidence
  };

  knowledge.push(newEntry);
  await this.saveRoleKnowledgeFile(agentId, knowledge);

  return newEntry.id;
}

async reinforceKnowledge(agentId: string, entryId: string): Promise<void> {
  const knowledge = await this.getRoleKnowledgeFile(agentId);
  const entry = knowledge.find(e => e.id === entryId);

  if (entry) {
    // Increase confidence, cap at 1.0
    entry.confidence = Math.min(entry.confidence + 0.1, 1.0);
    entry.lastUsed = new Date().toISOString();
    await this.saveRoleKnowledgeFile(agentId, knowledge);
  }
}
```

#### Context Generation

```typescript
async generateAgentContext(agentId: string): Promise<string> {
  const knowledge = await this.getRoleKnowledge(agentId);
  const preferences = await this.getPreferences(agentId);
  const performance = await this.getPerformanceMetrics(agentId);

  // Filter to high-confidence knowledge
  const relevantKnowledge = knowledge
    .filter(k => k.confidence >= 0.6)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20);  // Top 20 entries

  return `
## Your Role Knowledge

${relevantKnowledge.map(k => `- [${k.category}] ${k.content}`).join('\n')}

## Your Preferences

${this.formatPreferences(preferences)}

## Your Performance

- Tasks completed: ${performance.tasksCompleted}
- Average iterations: ${performance.averageIterations.toFixed(1)}
- Quality gate pass rate: ${(performance.qualityGatePassRate * 100).toFixed(0)}%

${performance.commonErrors.length > 0 ? `
### Common Errors to Avoid
${performance.commonErrors.slice(0, 5).map(e => `- ${e.pattern} → ${e.resolution || 'No resolution recorded'}`).join('\n')}
` : ''}
`.trim();
}
```

### 3. File Structure

```
backend/src/services/memory/
├── agent-memory.service.ts     # Main service
├── agent-memory.service.test.ts
├── memory.types.ts             # Re-export from types/
└── index.ts                    # Barrel export
```

## Implementation Steps

1. **Create service file structure**
   - Create `memory/` directory in services
   - Add barrel exports

2. **Implement core file operations**
   - Read/write JSON with atomic writes
   - Directory initialization
   - Error handling

3. **Implement knowledge management**
   - Add, retrieve, reinforce knowledge
   - Similarity detection to avoid duplicates

4. **Implement preferences management**
   - CRUD for preferences
   - Default preferences

5. **Implement performance tracking**
   - Record task completions
   - Track error patterns
   - Calculate metrics

6. **Implement context generation**
   - Compile relevant memories
   - Format for prompt injection

7. **Implement maintenance**
   - Prune stale/low-confidence entries
   - Storage limits enforcement

8. **Write tests**
   - Unit tests for all methods
   - Test file corruption recovery
   - Test concurrent access

## Acceptance Criteria

- [ ] `AgentMemoryService` class implemented
- [ ] All interface methods functional
- [ ] Atomic file writes prevent corruption
- [ ] Similarity detection prevents duplicates
- [ ] Context generation produces valid prompt sections
- [ ] Pruning removes stale entries correctly
- [ ] Unit tests with >80% coverage
- [ ] Integration with existing `StorageService` patterns

## Notes

- Follow existing singleton pattern from `StorageService`
- Use same file locking approach for concurrent access
- Consider caching frequently accessed data in memory
- Log all memory operations for debugging
