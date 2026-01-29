---
id: 06-memory-mcp-tools
title: Create MCP Tools for Memory Management
phase: 1
priority: P0
status: open
estimatedHours: 10
dependencies: [04-memory-service-coordinator]
blocks: [07-continuation-detection]
---

# Task: Create MCP Tools for Memory Management

## Objective
Implement MCP tools that allow agents to store, recall, and manage their memories during task execution.

## Background
Agents need to be able to:
- Store learnings and discoveries (`remember`)
- Retrieve relevant past knowledge (`recall`)
- Record learnings during task work (`record_learning`)
- Get their full context (`get_my_context`)

## Deliverables

### 1. Remember Tool

**Purpose:** Store new knowledge in memory

```typescript
// In mcp-server/src/server.ts

const rememberTool: MCPToolDefinition = {
  name: 'remember',
  description: `Store a piece of knowledge in your memory for future reference.

Use this when you:
- Discover a code pattern specific to this project
- Learn something important about how the codebase works
- Make or observe an architectural decision
- Find a gotcha or workaround
- Want to remember a preference or best practice

The knowledge will persist across sessions.`,

  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The knowledge to remember (be specific and actionable)',
      },
      category: {
        type: 'string',
        enum: ['pattern', 'decision', 'gotcha', 'fact', 'preference'],
        description: 'Type of knowledge',
      },
      scope: {
        type: 'string',
        enum: ['agent', 'project'],
        description: 'agent = your role knowledge, project = project-specific knowledge',
      },
      title: {
        type: 'string',
        description: 'Short title for the knowledge (optional)',
      },
      metadata: {
        type: 'object',
        description: 'Additional context (files, severity, rationale, etc.)',
      },
    },
    required: ['content', 'category', 'scope'],
  },
};

async function handleRemember(params: RememberToolParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const agentId = await this.getAgentIdFromSession(sessionName);
  const projectPath = await this.getProjectPathFromSession(sessionName);

  try {
    const memoryId = await this.memoryService.remember({
      agentId,
      projectPath,
      content: params.content,
      category: params.category,
      scope: params.scope,
      metadata: {
        title: params.title,
        ...params.metadata,
      },
    });

    return {
      success: true,
      message: `Knowledge stored successfully (ID: ${memoryId})`,
      data: { memoryId, scope: params.scope, category: params.category },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to store knowledge: ${error.message}`,
    };
  }
}
```

### 2. Recall Tool

**Purpose:** Retrieve relevant memories based on context

```typescript
const recallTool: MCPToolDefinition = {
  name: 'recall',
  description: `Retrieve relevant knowledge from your memory based on what you're working on.

Use this when you:
- Start working on a new task and want to check for relevant patterns
- Need to remember how something was done before
- Want to check for known gotchas before making changes
- Need to recall a previous decision

Returns relevant memories from your agent knowledge and/or project knowledge.`,

  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'What you are working on or looking for (be specific)',
      },
      scope: {
        type: 'string',
        enum: ['agent', 'project', 'both'],
        default: 'both',
        description: 'Where to search for memories',
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of memories to return',
      },
    },
    required: ['context'],
  },
};

async function handleRecall(params: RecallToolParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const agentId = await this.getAgentIdFromSession(sessionName);
  const projectPath = await this.getProjectPathFromSession(sessionName);

  try {
    const result = await this.memoryService.recall({
      agentId,
      projectPath,
      context: params.context,
      scope: params.scope || 'both',
      limit: params.limit || 10,
    });

    if (result.combined.length === 0) {
      return {
        success: true,
        message: 'No relevant memories found for this context.',
        data: { memories: [] },
      };
    }

    return {
      success: true,
      message: `Found ${result.agentMemories.length + result.projectMemories.length} relevant memories`,
      data: {
        agentMemories: result.agentMemories,
        projectMemories: result.projectMemories,
        formatted: result.combined,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to recall memories: ${error.message}`,
    };
  }
}
```

### 3. Record Learning Tool

**Purpose:** Record a learning during task work

```typescript
const recordLearningTool: MCPToolDefinition = {
  name: 'record_learning',
  description: `Record a learning or discovery while working on a task.

This is simpler than 'remember' - use it to quickly jot down learnings as you work.
Learnings are recorded in the project's learnings log and may also be added to your role knowledge.

Good learnings are:
- Specific and actionable
- Include context about when/why this applies
- Reference related files or components`,

  inputSchema: {
    type: 'object',
    properties: {
      learning: {
        type: 'string',
        description: 'What you learned (be specific)',
      },
      relatedTask: {
        type: 'string',
        description: 'Task ID this relates to (optional)',
      },
      relatedFiles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related file paths (optional)',
      },
    },
    required: ['learning'],
  },
};

async function handleRecordLearning(params: RecordLearningToolParams): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const agentId = await this.getAgentIdFromSession(sessionName);
  const projectPath = await this.getProjectPathFromSession(sessionName);

  try {
    await this.memoryService.recordLearning({
      agentId,
      projectPath,
      learning: params.learning,
      relatedTask: params.relatedTask,
      relatedFiles: params.relatedFiles,
    });

    return {
      success: true,
      message: 'Learning recorded successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to record learning: ${error.message}`,
    };
  }
}
```

### 4. Get My Context Tool

**Purpose:** Get full memory context for current session

```typescript
const getMyContextTool: MCPToolDefinition = {
  name: 'get_my_context',
  description: `Get your full knowledge context including agent knowledge and project knowledge.

Use this when you:
- Want to review what you know before starting a task
- Need a refresher on project patterns and decisions
- Want to check your performance metrics`,

  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

async function handleGetMyContext(): Promise<MCPToolResult> {
  const sessionName = this.getCallerSession();
  const agentId = await this.getAgentIdFromSession(sessionName);
  const projectPath = await this.getProjectPathFromSession(sessionName);

  try {
    const context = await this.memoryService.getFullContext(agentId, projectPath);

    return {
      success: true,
      message: 'Context retrieved successfully',
      data: { context },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get context: ${error.message}`,
    };
  }
}
```

### 5. Tool Registration

```typescript
// In MCP server initialization
registerTools() {
  // Existing tools...

  // Memory tools
  this.addTool('remember', this.handleRemember.bind(this));
  this.addTool('recall', this.handleRecall.bind(this));
  this.addTool('record_learning', this.handleRecordLearning.bind(this));
  this.addTool('get_my_context', this.handleGetMyContext.bind(this));
}
```

### 6. Session Adapter Integration

Update `SessionAdapter` to expose MemoryService:

```typescript
// In mcp-server/src/session-adapter.ts

class SessionAdapter {
  private memoryService: MemoryService;

  constructor() {
    this.memoryService = MemoryService.getInstance();
  }

  getMemoryService(): MemoryService {
    return this.memoryService;
  }
}
```

## Implementation Steps

1. **Add MemoryService to MCP server**
   - Import and initialize
   - Expose via SessionAdapter

2. **Implement remember tool**
   - Define tool schema
   - Implement handler
   - Test with both scopes

3. **Implement recall tool**
   - Define tool schema
   - Implement handler
   - Test search functionality

4. **Implement record_learning tool**
   - Define tool schema
   - Implement handler
   - Test learning recording

5. **Implement get_my_context tool**
   - Define tool schema
   - Implement handler
   - Test context retrieval

6. **Register all tools**
   - Add to tool registration
   - Update tool documentation

7. **Write tests**
   - Unit tests for each tool
   - Integration tests with MemoryService
   - Test error handling

## Acceptance Criteria

- [ ] `remember` tool stores knowledge correctly
- [ ] `recall` tool returns relevant memories
- [ ] `record_learning` tool records to learnings log
- [ ] `get_my_context` returns full context
- [ ] All tools have proper error handling
- [ ] Tool descriptions are clear and helpful
- [ ] Integration tests passing

## Notes

- Tools should be usable by agents without explicit prompting
- Consider rate limiting to prevent memory spam
- Log all memory operations for debugging
- Ensure tools work in all agent roles
