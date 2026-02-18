---
id: 03-project-memory-service
title: Implement MemoryService for Project-Level Memory
phase: 1
priority: P0
status: open
estimatedHours: 12
dependencies: [01-memory-data-models]
blocks: [05-memory-prompt-integration, 06-memory-mcp-tools]
---

# Task: Implement MemoryService for Project-Level Memory

## Objective
Create the service that manages project-level persistent memory stored in `project/.crewly/knowledge/`.

## Background
Project-level memory stores patterns, decisions, gotchas, and relationships specific to each project. This enables any agent working on the project to benefit from previous discoveries.

## Deliverables

### 1. ProjectMemoryService Class

**Location:** `backend/src/services/memory/project-memory.service.ts`

```typescript
interface IProjectMemoryService {
  // Initialization
  initializeProject(projectPath: string): Promise<void>;

  // Patterns
  addPattern(projectPath: string, pattern: Omit<PatternEntry, 'id' | 'createdAt'>): Promise<string>;
  getPatterns(projectPath: string, category?: string): Promise<PatternEntry[]>;
  searchPatterns(projectPath: string, query: string): Promise<PatternEntry[]>;

  // Decisions
  addDecision(projectPath: string, decision: Omit<DecisionEntry, 'id' | 'decidedAt'>): Promise<string>;
  getDecisions(projectPath: string): Promise<DecisionEntry[]>;

  // Gotchas
  addGotcha(projectPath: string, gotcha: Omit<GotchaEntry, 'id' | 'createdAt'>): Promise<string>;
  getGotchas(projectPath: string, severity?: string): Promise<GotchaEntry[]>;

  // Relationships
  addRelationship(projectPath: string, relationship: Omit<RelationshipEntry, 'id'>): Promise<string>;
  getRelationships(projectPath: string, componentName?: string): Promise<RelationshipEntry[]>;

  // Learnings Log
  recordLearning(projectPath: string, agentId: string, learning: string, metadata?: Record<string, any>): Promise<void>;
  getRecentLearnings(projectPath: string, limit?: number): Promise<string>;

  // Context Generation
  generateProjectContext(projectPath: string): Promise<string>;

  // Search
  searchAll(projectPath: string, query: string): Promise<SearchResults>;
}
```

### 2. Implementation Details

#### Directory Management

```typescript
class ProjectMemoryService implements IProjectMemoryService {
  private readonly KNOWLEDGE_DIR = 'knowledge';

  private getKnowledgePath(projectPath: string): string {
    return path.join(projectPath, '.crewly', this.KNOWLEDGE_DIR);
  }

  async initializeProject(projectPath: string): Promise<void> {
    const knowledgePath = this.getKnowledgePath(projectPath);
    await fs.mkdir(knowledgePath, { recursive: true });

    // Initialize empty files if they don't exist
    const files = ['patterns.json', 'decisions.json', 'gotchas.json', 'relationships.json'];
    for (const file of files) {
      const filePath = path.join(knowledgePath, file);
      if (!await this.fileExists(filePath)) {
        await this.writeJson(filePath, []);
      }
    }

    // Initialize learnings.md
    const learningsPath = path.join(knowledgePath, 'learnings.md');
    if (!await this.fileExists(learningsPath)) {
      await fs.writeFile(learningsPath, '# Project Learnings\n\n');
    }
  }
}
```

#### Pattern Management

```typescript
async addPattern(
  projectPath: string,
  pattern: Omit<PatternEntry, 'id' | 'createdAt'>
): Promise<string> {
  const patterns = await this.getPatterns(projectPath);

  // Check for existing similar pattern
  const existing = patterns.find(p =>
    p.title.toLowerCase() === pattern.title.toLowerCase() ||
    this.isSimilarContent(p.description, pattern.description)
  );

  if (existing) {
    // Update existing pattern if new info provided
    if (pattern.example && !existing.example) {
      existing.example = pattern.example;
      await this.savePatterns(projectPath, patterns);
    }
    return existing.id;
  }

  const newPattern: PatternEntry = {
    ...pattern,
    id: generateUUID(),
    createdAt: new Date().toISOString(),
  };

  patterns.push(newPattern);
  await this.savePatterns(projectPath, patterns);

  // Also record as learning
  await this.recordLearning(
    projectPath,
    pattern.discoveredBy,
    `Discovered pattern: ${pattern.title} - ${pattern.description}`,
    { type: 'pattern', patternId: newPattern.id }
  );

  return newPattern.id;
}

async searchPatterns(projectPath: string, query: string): Promise<PatternEntry[]> {
  const patterns = await this.getPatterns(projectPath);
  const queryLower = query.toLowerCase();

  return patterns.filter(p =>
    p.title.toLowerCase().includes(queryLower) ||
    p.description.toLowerCase().includes(queryLower) ||
    p.category.toLowerCase().includes(queryLower)
  );
}
```

#### Learnings Log

```typescript
async recordLearning(
  projectPath: string,
  agentId: string,
  learning: string,
  metadata?: Record<string, any>
): Promise<void> {
  const learningsPath = path.join(this.getKnowledgePath(projectPath), 'learnings.md');

  const date = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].split('.')[0];

  const entry = `
## ${date}

### [${agentId}] ${time}
${learning}
${metadata?.relatedFiles ? `\n**Related files:** ${metadata.relatedFiles.join(', ')}` : ''}
${metadata?.type ? `\n**Type:** ${metadata.type}` : ''}

---
`;

  await fs.appendFile(learningsPath, entry);
}

async getRecentLearnings(projectPath: string, limit: number = 10): Promise<string> {
  const learningsPath = path.join(this.getKnowledgePath(projectPath), 'learnings.md');

  try {
    const content = await fs.readFile(learningsPath, 'utf-8');
    const entries = content.split('---').filter(e => e.trim());

    // Get last N entries
    const recent = entries.slice(-limit).join('\n---\n');
    return recent;
  } catch {
    return '';
  }
}
```

#### Context Generation

```typescript
async generateProjectContext(projectPath: string): Promise<string> {
  const [patterns, decisions, gotchas, relationships] = await Promise.all([
    this.getPatterns(projectPath),
    this.getDecisions(projectPath),
    this.getGotchas(projectPath),
    this.getRelationships(projectPath),
  ]);

  const recentLearnings = await this.getRecentLearnings(projectPath, 5);

  let context = '## Project Knowledge Base\n\n';

  // High-severity gotchas first
  const criticalGotchas = gotchas.filter(g => g.severity === 'high');
  if (criticalGotchas.length > 0) {
    context += '### Critical Gotchas (Must Know!)\n';
    criticalGotchas.forEach(g => {
      context += `- **${g.title}**: ${g.problem} → ${g.solution}\n`;
    });
    context += '\n';
  }

  // Key patterns
  if (patterns.length > 0) {
    context += '### Code Patterns\n';
    patterns.slice(0, 10).forEach(p => {
      context += `- **[${p.category}] ${p.title}**: ${p.description}\n`;
      if (p.example) {
        context += `  Example: \`${p.example}\`\n`;
      }
    });
    context += '\n';
  }

  // Important decisions
  if (decisions.length > 0) {
    context += '### Architecture Decisions\n';
    decisions.slice(0, 5).forEach(d => {
      context += `- **${d.title}**: ${d.decision} (${d.rationale})\n`;
    });
    context += '\n';
  }

  // Component relationships
  if (relationships.length > 0) {
    context += '### Component Relationships\n';
    relationships.forEach(r => {
      context += `- ${r.from} ${r.relationshipType} ${r.to}\n`;
    });
    context += '\n';
  }

  // Recent learnings
  if (recentLearnings) {
    context += '### Recent Learnings\n';
    context += recentLearnings;
  }

  return context;
}
```

### 3. File Structure

```
backend/src/services/memory/
├── agent-memory.service.ts
├── agent-memory.service.test.ts
├── project-memory.service.ts      # This task
├── project-memory.service.test.ts
├── memory.types.ts
└── index.ts
```

## Implementation Steps

1. **Create service file**
   - Implement `ProjectMemoryService` class
   - Follow singleton pattern

2. **Implement directory initialization**
   - Create knowledge/ directory structure
   - Initialize empty files

3. **Implement CRUD for each entity**
   - Patterns: add, get, search
   - Decisions: add, get
   - Gotchas: add, get by severity
   - Relationships: add, get by component

4. **Implement learnings log**
   - Append-only markdown format
   - Retrieve recent entries

5. **Implement context generation**
   - Compile all knowledge
   - Prioritize critical gotchas
   - Format for prompt injection

6. **Implement search**
   - Cross-entity search
   - Keyword matching

7. **Write tests**
   - Unit tests for all methods
   - Test concurrent writes
   - Test search accuracy

## Acceptance Criteria

- [ ] `ProjectMemoryService` class implemented
- [ ] All interface methods functional
- [ ] Knowledge directory created on project init
- [ ] Append-only learnings log working
- [ ] Context generation produces useful prompt sections
- [ ] Search returns relevant results
- [ ] Unit tests with >80% coverage

## Notes

- Initialize knowledge directory when project is added to Crewly
- Coordinate with `ContextLoaderService` to include knowledge in context
- Consider adding validation for relationship cycles
- Learnings.md should be human-readable for debugging
