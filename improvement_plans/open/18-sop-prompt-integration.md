---
id: 18-sop-prompt-integration
title: Integrate SOPs into Prompt Generation
phase: 4
priority: P1
status: open
estimatedHours: 6
dependencies: [16-sop-service, 17-sop-library]
blocks: []
---

# Task: Integrate SOPs into Prompt Generation

## Objective
Modify the PromptBuilderService to include relevant SOPs in agent prompts.

## Background
With SOPService implemented and SOP library created, we need to inject relevant SOPs into agent prompts based on their role and current task context.

## Deliverables

### 1. Update PromptBuilderService

```typescript
// backend/src/services/ai/prompt-builder.service.ts

class PromptBuilderService {
  private sopService: SOPService;
  private memoryService: MemoryService;

  async buildSystemPrompt(
    teamMember: TeamMember,
    project: Project,
    options?: PromptOptions
  ): Promise<string> {
    // 1. Load base role prompt (existing)
    const basePrompt = await this.loadRolePrompt(teamMember.role);

    // 2. Load project context (existing)
    const projectContext = await this.contextLoader.loadProjectContext(project.path);

    // 3. Load memory context (from earlier task)
    const memoryContext = await this.buildMemoryContext(
      teamMember.id,
      project.path,
      options
    );

    // 4. NEW: Load SOP context
    const sopContext = await this.buildSOPContext(
      teamMember.role,
      options?.taskContext,
      options?.taskType
    );

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

  private async buildSOPContext(
    role: string,
    taskContext?: string,
    taskType?: string
  ): Promise<string> {
    if (!this.sopService) {
      return '';
    }

    try {
      const sopContext = await this.sopService.generateSOPContext({
        role,
        taskContext: taskContext || '',
        taskType,
      });

      if (!sopContext || sopContext.trim().length === 0) {
        return '';
      }

      return sopContext;
    } catch (error) {
      this.logger.warn('Failed to load SOP context', { error });
      return '';
    }
  }

  private composePrompt(parts: PromptParts): string {
    return `
# System Prompt

${parts.basePrompt}

---

## Current Project: ${parts.project.name}

${parts.projectContext}

---

${parts.memoryContext ? `${parts.memoryContext}\n\n---\n\n` : ''}

${parts.sopContext ? `${parts.sopContext}\n\n---\n\n` : ''}

## Your Identity

- **Session Name:** ${parts.teamMember.sessionName}
- **Member ID:** ${parts.teamMember.id}
- **Role:** ${parts.teamMember.role}
- **Team:** ${parts.teamMember.teamId || 'Independent'}

## Important Guidelines

1. Follow the SOPs provided above for your role
2. Use your knowledge base to inform decisions
3. Communicate progress regularly using MCP tools
4. Ask for help when blocked for more than 30 minutes
5. Commit code at least every 30 minutes

## Available Tools

Use these MCP tools for coordination:
- \`send_message\` - Communicate with other agents
- \`report_progress\` - Update on task status
- \`remember\` - Store important learnings
- \`recall\` - Retrieve relevant knowledge
- \`complete_task\` - Mark task as done (runs quality gates)
- \`check_quality_gates\` - Verify code quality

`.trim();
  }
}
```

### 2. Update Prompt Options

```typescript
interface PromptOptions {
  role?: string;
  taskContext?: string;        // For SOP matching
  taskType?: string;           // For SOP matching
  includeMemory?: boolean;     // Default: true
  includeSOPs?: boolean;       // Default: true
  sopLimit?: number;           // Max SOPs to include
  freshContext?: boolean;      // Force reload
}
```

### 3. Continuation Prompt Integration

When building continuation prompts, include relevant SOPs:

```typescript
// In ContinuationService
private async buildContinuationPrompt(params: BuildPromptParams): Promise<string> {
  const { analysis, currentTask, projectPath, agentId } = params;
  const role = await this.getAgentRole(params.sessionName);

  // Get memory context
  const memoryContext = await this.memoryService.getFullContext(agentId, projectPath);

  // Get relevant SOPs for the error/situation
  const sopContext = await this.sopService.generateSOPContext({
    role,
    taskContext: this.getSituationContext(analysis),
    taskType: currentTask?.type,
  });

  // Load template and substitute
  const template = await this.loadTemplate('continue-work.md');

  return this.substituteVariables(template, {
    CURRENT_TASK: currentTask?.title || 'Unknown task',
    ITERATIONS: analysis.iterations.toString(),
    MAX_ITERATIONS: analysis.maxIterations.toString(),
    PROJECT_KNOWLEDGE: memoryContext,
    SOP_GUIDANCE: sopContext,
    HINTS: this.getHintsForConclusion(analysis.conclusion),
  });
}

private getSituationContext(analysis: AgentStateAnalysis): string {
  // Map analysis to SOP-relevant context
  switch (analysis.conclusion) {
    case 'STUCK_OR_ERROR':
      return 'debugging error handling troubleshooting';
    case 'INCOMPLETE':
      return 'continuing work completing task progress';
    case 'WAITING_INPUT':
      return 'communication asking questions escalation';
    default:
      return '';
  }
}
```

### 4. Update Continuation Template

**File:** `config/continuation/prompts/continue-work.md` (update)

```markdown
# Continue Your Work

You were working on: {{CURRENT_TASK}}

## Progress
- Iteration: {{ITERATIONS}} of {{MAX_ITERATIONS}}

## Quality Gates Status
{{QUALITY_GATES}}

{{#if SOP_GUIDANCE}}
## Relevant Procedures

Follow these SOPs for your current situation:

{{SOP_GUIDANCE}}
{{/if}}

## Instructions

1. Review your progress so far
2. Follow the SOPs above for guidance
3. Continue working on the task
4. Run quality checks before marking complete
5. Call `complete_task` when ALL gates pass

## Hints
{{HINTS}}

## Your Project Knowledge
{{PROJECT_KNOWLEDGE}}
```

### 5. MCP Tool: get_sops

Add tool for agents to request SOPs:

```typescript
const getSOPsTool: MCPToolDefinition = {
  name: 'get_sops',
  description: `Get relevant Standard Operating Procedures for your current situation.

Use this when you need guidance on:
- How to approach a task
- Best practices for your role
- How to handle errors or blockers
- Communication protocols`,

  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'Describe what you need guidance on',
      },
      category: {
        type: 'string',
        enum: ['workflow', 'quality', 'communication', 'escalation', 'tools', 'debugging', 'testing', 'git'],
        description: 'Specific category of SOPs (optional)',
      },
    },
    required: ['context'],
  },
};

async function handleGetSOPs(params: GetSOPsParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const role = await this.getAgentRole(sessionName);

  const sopContext = await this.sopService.generateSOPContext({
    role,
    taskContext: params.context,
    taskType: params.category,
  });

  if (!sopContext || sopContext.trim().length === 0) {
    return {
      success: true,
      message: 'No specific SOPs found for this context. Use general best practices.',
    };
  }

  return {
    success: true,
    message: 'Relevant SOPs found:',
    data: { sopContext },
  };
}
```

## Implementation Steps

1. **Update PromptBuilderService**
   - Add SOPService dependency
   - Implement buildSOPContext
   - Update composePrompt

2. **Update PromptOptions**
   - Add SOP-related options
   - Update all callers

3. **Update continuation prompts**
   - Add SOP_GUIDANCE variable
   - Include in template

4. **Implement get_sops tool**
   - Define tool schema
   - Implement handler
   - Register tool

5. **Test integration**
   - Verify SOPs appear in prompts
   - Test SOP matching
   - Test get_sops tool

## Acceptance Criteria

- [ ] SOPs included in system prompts
- [ ] SOPs match based on role and context
- [ ] Continuation prompts include relevant SOPs
- [ ] get_sops tool works
- [ ] Graceful handling when no SOPs found
- [ ] Tests passing

## Notes

- Keep SOP content concise in prompts
- Don't overwhelm with too many SOPs
- Log which SOPs were included
- Consider token limits
