---
id: 16-sop-service
title: Implement SOPService
phase: 4
priority: P1
status: open
estimatedHours: 10
dependencies: [15-sop-data-model]
blocks: [18-sop-prompt-integration]
---

# Task: Implement SOPService

## Objective
Create the service that loads, indexes, and retrieves SOPs based on context.

## Background
The SOPService manages all SOP operations:
- Load SOPs from filesystem
- Build and maintain index
- Match SOPs to context
- Allow agents to create custom SOPs

## Deliverables

### 1. SOPService Interface

```typescript
// backend/src/services/sop/sop.service.ts

interface ISOPService {
  // Initialization
  initialize(): Promise<void>;
  rebuildIndex(): Promise<void>;

  // Retrieval
  getSOP(id: string): Promise<SOP | null>;
  getSOPsByRole(role: string): Promise<SOP[]>;
  getSOPsByCategory(category: SOPCategory): Promise<SOP[]>;

  // Matching
  findRelevantSOPs(params: SOPMatchParams): Promise<SOP[]>;
  generateSOPContext(params: SOPMatchParams): Promise<string>;

  // Management
  createCustomSOP(sop: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<string>;
  updateSOP(id: string, updates: Partial<SOP>): Promise<void>;
  deleteSOP(id: string): Promise<void>;

  // Index
  getIndex(): Promise<SOPIndex>;
  searchSOPs(query: string): Promise<SOPIndexEntry[]>;
}

interface SOPMatchParams {
  role: string;
  taskContext?: string;
  taskType?: string;
  filePatterns?: string[];
  maxResults?: number;
}
```

### 2. Implementation

```typescript
import * as path from 'path';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import matter from 'gray-matter';

class SOPService implements ISOPService {
  private static instance: SOPService;
  private index: SOPIndex | null = null;
  private sopCache: Map<string, SOP> = new Map();
  private logger: Logger;

  private readonly basePath: string;
  private readonly systemPath: string;
  private readonly customPath: string;
  private readonly indexPath: string;

  private constructor() {
    this.basePath = path.join(getCrewlyHome(), 'sops');
    this.systemPath = path.join(this.basePath, 'system');
    this.customPath = path.join(this.basePath, 'custom');
    this.indexPath = path.join(this.basePath, 'index.json');
    this.logger = LoggerService.getInstance().createLogger('SOPService');
  }

  static getInstance(): SOPService {
    if (!SOPService.instance) {
      SOPService.instance = new SOPService();
    }
    return SOPService.instance;
  }

  async initialize(): Promise<void> {
    // Ensure directories exist
    await fs.mkdir(this.systemPath, { recursive: true });
    await fs.mkdir(this.customPath, { recursive: true });

    // Copy bundled system SOPs if not present
    await this.ensureSystemSOPs();

    // Build index if not exists or outdated
    await this.ensureIndex();

    this.logger.info('SOPService initialized');
  }

  async rebuildIndex(): Promise<void> {
    const entries: SOPIndexEntry[] = [];

    // Index system SOPs
    await this.indexDirectory(this.systemPath, entries, true);

    // Index custom SOPs
    await this.indexDirectory(this.customPath, entries, false);

    this.index = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      sops: entries,
    };

    await this.saveIndex();
    this.logger.info('SOP index rebuilt', { count: entries.length });
  }

  private async indexDirectory(
    dirPath: string,
    entries: SOPIndexEntry[],
    isSystem: boolean
  ): Promise<void> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          await this.indexDirectory(itemPath, entries, isSystem);
        } else if (item.name.endsWith('.md')) {
          const sop = await this.loadSOPFile(itemPath);
          if (sop) {
            entries.push({
              id: sop.id,
              path: path.relative(this.basePath, itemPath),
              role: sop.role,
              category: sop.category,
              priority: sop.priority,
              triggers: sop.triggers,
              title: sop.title,
              isSystem,
            });
          }
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  }

  private async loadSOPFile(filePath: string): Promise<SOP | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { data, content: body } = matter(content);

      return {
        id: data.id,
        version: data.version || 1,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        createdBy: data.createdBy || 'system',
        role: data.role,
        category: data.category,
        priority: data.priority || SOP_CONSTANTS.DEFAULT_PRIORITY,
        title: data.title,
        description: data.description || '',
        content: body,
        triggers: data.triggers || [],
        conditions: data.conditions,
        tags: data.tags || [],
        relatedSOPs: data.relatedSOPs,
        examples: data.examples,
      };
    } catch (error) {
      this.logger.warn('Failed to load SOP', { filePath, error });
      return null;
    }
  }

  async getSOP(id: string): Promise<SOP | null> {
    // Check cache
    if (this.sopCache.has(id)) {
      return this.sopCache.get(id)!;
    }

    // Find in index
    const index = await this.getIndex();
    const entry = index.sops.find(e => e.id === id);
    if (!entry) return null;

    // Load file
    const filePath = path.join(this.basePath, entry.path);
    const sop = await this.loadSOPFile(filePath);

    if (sop) {
      this.sopCache.set(id, sop);
    }

    return sop;
  }

  async findRelevantSOPs(params: SOPMatchParams): Promise<SOP[]> {
    const index = await this.getIndex();
    const { role, taskContext, taskType, maxResults = SOP_CONSTANTS.MAX_SOPS_IN_PROMPT } = params;

    // Filter and score entries
    const scored = index.sops
      .filter(entry => this.matchesRole(entry, role))
      .map(entry => ({
        entry,
        score: this.scoreRelevance(entry, taskContext || '', taskType),
      }))
      .filter(s => s.score >= SOP_CONSTANTS.MIN_TRIGGER_MATCH_SCORE)
      .sort((a, b) => {
        // Sort by score, then priority
        if (b.score !== a.score) return b.score - a.score;
        return b.entry.priority - a.entry.priority;
      })
      .slice(0, maxResults);

    // Load full SOPs
    const sops: SOP[] = [];
    for (const { entry } of scored) {
      const sop = await this.getSOP(entry.id);
      if (sop) sops.push(sop);
    }

    return sops;
  }

  private matchesRole(entry: SOPIndexEntry, role: string): boolean {
    if (entry.role === 'all') return true;
    if (entry.role === role) return true;

    // Handle role hierarchies
    const roleHierarchy: Record<string, string[]> = {
      'frontend-developer': ['developer'],
      'backend-developer': ['developer'],
      'developer': [],
      'pm': [],
      'qa': [],
    };

    const parentRoles = roleHierarchy[role] || [];
    return parentRoles.includes(entry.role);
  }

  private scoreRelevance(entry: SOPIndexEntry, context: string, taskType?: string): number {
    let score = 0;
    const contextLower = context.toLowerCase();
    const words = contextLower.split(/\s+/);

    // Score trigger matches
    for (const trigger of entry.triggers) {
      if (contextLower.includes(trigger.toLowerCase())) {
        score += 0.3;
      }
      if (words.includes(trigger.toLowerCase())) {
        score += 0.2;
      }
    }

    // Score category match
    if (taskType && entry.category === taskType) {
      score += 0.3;
    }

    // Normalize score
    return Math.min(score, 1.0);
  }

  async generateSOPContext(params: SOPMatchParams): Promise<string> {
    const sops = await this.findRelevantSOPs(params);

    if (sops.length === 0) {
      return '';
    }

    let context = '## Relevant Standard Operating Procedures\n\n';
    context += 'Follow these procedures for your current work:\n\n';

    for (const sop of sops) {
      // Truncate content if too long
      const content = sop.content.length > SOP_CONSTANTS.MAX_SOP_CONTENT_LENGTH
        ? sop.content.substring(0, SOP_CONSTANTS.MAX_SOP_CONTENT_LENGTH) + '\n\n*[Content truncated]*'
        : sop.content;

      context += `### ${sop.title}\n\n`;
      context += `*Category: ${sop.category} | Priority: ${sop.priority}*\n\n`;
      context += content;
      context += '\n\n---\n\n';
    }

    return context;
  }

  async createCustomSOP(
    sopData: Omit<SOP, 'id' | 'createdAt' | 'updatedAt' | 'version'>
  ): Promise<string> {
    const id = `custom-${generateShortId()}`;
    const now = new Date().toISOString();

    const sop: SOP = {
      ...sopData,
      id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Create file
    const filePath = path.join(this.customPath, `${id}.md`);
    const content = this.sopToMarkdown(sop);
    await fs.writeFile(filePath, content);

    // Update index
    await this.rebuildIndex();

    this.logger.info('Custom SOP created', { id, title: sop.title });
    return id;
  }

  private sopToMarkdown(sop: SOP): string {
    const frontmatter = {
      id: sop.id,
      version: sop.version,
      createdAt: sop.createdAt,
      updatedAt: sop.updatedAt,
      createdBy: sop.createdBy,
      role: sop.role,
      category: sop.category,
      priority: sop.priority,
      title: sop.title,
      description: sop.description,
      triggers: sop.triggers,
      conditions: sop.conditions,
      tags: sop.tags,
      relatedSOPs: sop.relatedSOPs,
    };

    return `---\n${yaml.stringify(frontmatter)}---\n\n${sop.content}`;
  }

  async getIndex(): Promise<SOPIndex> {
    if (!this.index) {
      await this.ensureIndex();
    }
    return this.index!;
  }

  private async ensureIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      this.index = JSON.parse(content);
    } catch {
      await this.rebuildIndex();
    }
  }

  private async saveIndex(): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
  }
}
```

### 3. File Structure

```
backend/src/services/sop/
├── sop.service.ts
├── sop.service.test.ts
├── sop.types.ts
└── index.ts
```

## Implementation Steps

1. **Create service class**
   - Singleton pattern
   - Path configuration

2. **Implement initialization**
   - Create directories
   - Copy system SOPs
   - Build index

3. **Implement index management**
   - Scan directories
   - Parse frontmatter
   - Build index

4. **Implement retrieval**
   - getSOP by ID
   - getSOPsByRole
   - getSOPsByCategory

5. **Implement matching**
   - Role filtering
   - Trigger scoring
   - Context generation

6. **Implement custom SOP creation**
   - Generate ID
   - Write file
   - Update index

7. **Write tests**
   - Index building
   - SOP matching
   - Context generation

## Acceptance Criteria

- [ ] Service initializes correctly
- [ ] Index builds from filesystem
- [ ] getSOP retrieves by ID
- [ ] findRelevantSOPs matches correctly
- [ ] generateSOPContext produces valid prompt
- [ ] Custom SOP creation works
- [ ] Tests passing

## Notes

- Cache loaded SOPs for performance
- Rebuild index on file changes
- Keep system SOPs in bundled assets
- Log all SOP operations
