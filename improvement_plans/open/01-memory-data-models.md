---
id: 01-memory-data-models
title: Design Memory Data Models and Storage Schema
phase: 1
priority: P0
status: open
estimatedHours: 8
dependencies: []
blocks: [02-agent-memory-service, 03-project-memory-service]
---

# Task: Design Memory Data Models and Storage Schema

## Objective
Define the data structures and file formats for the two-level memory system (agent-level and project-level).

## Background
Currently, AgentMux stores memory as unstructured logs in `project/.agentmux/memory/`. We need structured, queryable memory that persists across sessions.

## Deliverables

### 1. Agent-Level Memory Schema

**Location:** `~/.agentmux/agents/{agentId}/`

```typescript
// File: backend/src/types/memory.types.ts

interface AgentMemory {
  agentId: string;
  role: string;
  createdAt: string;
  updatedAt: string;

  // Role knowledge - things learned about the role
  roleKnowledge: RoleKnowledgeEntry[];

  // Preferences - how the agent likes to work
  preferences: AgentPreferences;

  // Performance metrics
  performance: PerformanceMetrics;
}

interface RoleKnowledgeEntry {
  id: string;
  category: 'best-practice' | 'anti-pattern' | 'tool-usage' | 'workflow';
  content: string;
  learnedFrom?: string;  // Task ID where this was learned
  confidence: number;    // 0-1, increases with reinforcement
  createdAt: string;
  lastUsed?: string;
}

interface AgentPreferences {
  codingStyle?: {
    language?: string;
    testingFramework?: string;
    lintingRules?: string;
  };
  communicationStyle?: {
    verbosity: 'concise' | 'detailed';
    askBeforeAction: boolean;
  };
  workPatterns?: {
    commitFrequency?: string;
    breakdownSize?: 'small' | 'medium' | 'large';
  };
}

interface PerformanceMetrics {
  tasksCompleted: number;
  averageIterations: number;
  qualityGatePassRate: number;
  commonErrors: ErrorPattern[];
}

interface ErrorPattern {
  pattern: string;
  occurrences: number;
  lastOccurred: string;
  resolution?: string;
}
```

**File Structure:**
```
~/.agentmux/agents/{agentId}/
├── memory.json           # Main memory file (AgentMemory)
├── role-knowledge.json   # Detailed knowledge entries
├── preferences.json      # Agent preferences
├── performance.json      # Performance metrics
└── sop-custom/           # Agent-created SOPs
    └── {sop-name}.md
```

### 2. Project-Level Memory Schema

**Location:** `project/.agentmux/knowledge/`

```typescript
interface ProjectMemory {
  projectId: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;

  // Code patterns specific to this project
  patterns: PatternEntry[];

  // Architecture decisions made
  decisions: DecisionEntry[];

  // Known issues and workarounds
  gotchas: GotchaEntry[];

  // Component/service relationships
  relationships: RelationshipEntry[];
}

interface PatternEntry {
  id: string;
  category: 'api' | 'component' | 'service' | 'testing' | 'styling' | 'other';
  title: string;
  description: string;
  example?: string;
  files?: string[];      // Related file paths
  discoveredBy: string;  // Agent ID
  createdAt: string;
}

interface DecisionEntry {
  id: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  decidedBy: string;     // Agent ID or 'user'
  decidedAt: string;
  affectedAreas?: string[];
}

interface GotchaEntry {
  id: string;
  title: string;
  problem: string;
  solution: string;
  severity: 'low' | 'medium' | 'high';
  discoveredBy: string;
  createdAt: string;
}

interface RelationshipEntry {
  id: string;
  from: string;          // Component/service name
  to: string;
  relationshipType: 'depends-on' | 'uses' | 'extends' | 'implements';
  description?: string;
}
```

**File Structure:**
```
project/.agentmux/knowledge/
├── index.json           # ProjectMemory summary
├── patterns.json        # All PatternEntry records
├── decisions.json       # All DecisionEntry records
├── gotchas.json         # All GotchaEntry records
├── relationships.json   # All RelationshipEntry records
└── learnings.md         # Append-only human-readable log
```

### 3. Learnings Log Format

The `learnings.md` file serves as an append-only, human-readable record:

```markdown
# Project Learnings

## 2026-01-29

### [backend-dev] API Error Handling Pattern
Discovered that all API endpoints use `handleApiError()` wrapper from `utils/api-errors.ts`.
When adding new endpoints, always wrap the handler.

**Related files:** `backend/src/utils/api-errors.ts`, `backend/src/controllers/*.ts`

---

### [frontend-dev] State Management
This project uses React Context for global state, not Redux.
Context providers are in `src/contexts/`.

**Decision:** Use existing pattern, don't introduce Redux.

---
```

## Implementation Steps

1. **Create type definitions**
   - Add `memory.types.ts` to `backend/src/types/`
   - Export all interfaces

2. **Define constants**
   - Add memory-related constants to `config/constants.ts`
   - File paths, default values, limits

3. **Design migration strategy**
   - How to handle existing `memory/` logs
   - Optional: Extract learnings from existing logs

4. **Document storage limits**
   - Max entries per category
   - Auto-pruning strategy for old/low-confidence entries

## Acceptance Criteria

- [ ] All TypeScript interfaces defined in `memory.types.ts`
- [ ] Constants added to `config/constants.ts`
- [ ] File structure documented
- [ ] Migration strategy defined (if needed)
- [ ] Storage limits documented
- [ ] Unit tests for type validation helpers

## Notes

- Keep individual JSON files small (<1MB) for fast loading
- Use append-only pattern for `learnings.md` to preserve history
- Consider adding TTL (time-to-live) for low-confidence entries
- Ensure atomic writes to prevent corruption
