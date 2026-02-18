---
id: 05-memory-prompt-integration
title: Integrate Memory into PromptBuilderService
phase: 1
priority: P0
status: open
estimatedHours: 6
dependencies: [04-memory-service-coordinator]
blocks: [07-continuation-detection]
---

# Task: Integrate Memory into PromptBuilderService

## Objective
Modify the existing `PromptBuilderService` to include agent and project memory in the prompts sent to agents.

## Background
Currently, `PromptBuilderService` loads:
- Role-specific prompts from config files
- Project context via `ContextLoaderService`

We need to add memory context so agents have access to their accumulated knowledge.

## Current State

**File:** `backend/src/services/ai/prompt-builder.service.ts`

Current prompt structure:
1. Base role instructions
2. Project context (specs, tickets, git history)
3. Communication protocols
4. MCP tool availability

## Deliverables

### 1. Modified PromptBuilderService

```typescript
class PromptBuilderService {
  private memoryService: MemoryService;
  private contextLoader: ContextLoaderService;

  constructor() {
    this.memoryService = MemoryService.getInstance();
    this.contextLoader = ContextLoaderService.getInstance();
  }

  async buildSystemPrompt(
    teamMember: TeamMember,
    project: Project,
    options?: PromptOptions
  ): Promise<string> {
    // 1. Load base role prompt
    const basePrompt = await this.loadRolePrompt(teamMember.role);

    // 2. Load project context (existing)
    const projectContext = await this.contextLoader.loadProjectContext(project.path);

    // 3. NEW: Load memory context
    const memoryContext = await this.buildMemoryContext(
      teamMember.id,
      project.path,
      options
    );

    // 4. Load SOPs (if available)
    const sopContext = await this.buildSOPContext(teamMember.role, options?.taskContext);

    // 5. Compose final prompt
    return this.composePrompt({
      basePrompt,
      projectContext,
      memoryContext,
      sopContext,
      teamMember,
      project,
    });
  }

  private async buildMemoryContext(
    agentId: string,
    projectPath: string,
    options?: PromptOptions
  ): Promise<string> {
    // Initialize memory if needed
    await this.memoryService.initializeForSession(
      agentId,
      options?.role || 'developer',
      projectPath
    );

    // Get full context
    const fullContext = await this.memoryService.getFullContext(agentId, projectPath);

    if (!fullContext || fullContext.trim().length === 0) {
      return '';
    }

    return `
## Your Knowledge Base

This is your accumulated knowledge from previous sessions. Use it to work more effectively.

${fullContext}

**Note:** You can add new knowledge using the \`remember\` tool and recall specific memories using the \`recall\` tool.
`;
  }

  private composePrompt(parts: PromptParts): string {
    return `
# System Prompt

${parts.basePrompt}

---

## Current Project: ${parts.project.name}

${parts.projectContext}

---

${parts.memoryContext}

---

${parts.sopContext}

---

## Your Identity

- **Session Name:** ${parts.teamMember.sessionName}
- **Member ID:** ${parts.teamMember.id}
- **Role:** ${parts.teamMember.role}
- **Team:** ${parts.teamMember.teamId || 'Independent'}

## Communication

Use MCP tools for all team communication:
- \`send_message\` to communicate with other agents
- \`report_progress\` to update on task status
- \`remember\` to store important learnings
- \`recall\` to retrieve relevant knowledge

`.trim();
  }
}
```

### 2. Prompt Options Interface

```typescript
interface PromptOptions {
  role?: string;
  taskContext?: string;        // Current task for SOP selection
  includeMemory?: boolean;     // Default: true
  includeSOPs?: boolean;       // Default: true
  memoryLimit?: number;        // Max memory entries
  freshContext?: boolean;      // Force reload context
}
```

### 3. Integration Points

#### When Agent Starts

```typescript
// In agent initialization flow
async function initializeAgent(teamMember: TeamMember, project: Project) {
  // Build prompt with memory
  const systemPrompt = await promptBuilder.buildSystemPrompt(
    teamMember,
    project,
    { includeMemory: true, includeSOPs: true }
  );

  // Inject into session
  await sessionManager.injectPrompt(teamMember.sessionName, systemPrompt);
}
```

#### When Continuation Prompt is Needed

```typescript
// For continuation service (future task)
async function buildContinuationPrompt(
  teamMember: TeamMember,
  project: Project,
  currentTask: Task
): Promise<string> {
  const memoryContext = await memoryService.getFullContext(
    teamMember.id,
    project.path
  );

  return `
# Continue Your Work

${memoryContext}

## Current Task
${currentTask.title}

## Instructions
Continue working on your assigned task. Use your knowledge base above to guide your approach.
`;
}
```

### 4. Update ContextLoaderService

Ensure `ContextLoaderService` doesn't duplicate memory loading:

```typescript
class ContextLoaderService {
  async loadProjectContext(projectPath: string): Promise<string> {
    // Load these (existing):
    // - Specs from .crewly/specs/
    // - Tickets from .crewly/tasks/
    // - Git history
    // - Dependencies

    // DO NOT load from .crewly/knowledge/ - that's handled by MemoryService

    return contextString;
  }
}
```

## Implementation Steps

1. **Review current PromptBuilderService**
   - Understand existing structure
   - Identify injection points

2. **Add MemoryService dependency**
   - Import and initialize
   - Handle missing memory gracefully

3. **Implement buildMemoryContext**
   - Get full context from MemoryService
   - Format for prompt inclusion

4. **Update composePrompt**
   - Add memory section
   - Add SOP section placeholder
   - Update agent identity section

5. **Update ContextLoaderService**
   - Ensure no overlap with memory
   - Document separation of concerns

6. **Add options support**
   - Memory inclusion toggle
   - Memory limit support
   - Fresh context option

7. **Write tests**
   - Test prompt composition
   - Test memory inclusion
   - Test graceful degradation

## Acceptance Criteria

- [ ] `PromptBuilderService` includes memory context
- [ ] Memory context formatted clearly in prompts
- [ ] Options allow toggling memory inclusion
- [ ] No duplication between context and memory
- [ ] Graceful handling when memory is empty
- [ ] Tests for all prompt variations
- [ ] Documentation updated

## Notes

- Keep prompt size reasonable (memory is summarized)
- Memory section should be clearly labeled
- Include instructions for using memory tools
- Consider token limits for large knowledge bases
