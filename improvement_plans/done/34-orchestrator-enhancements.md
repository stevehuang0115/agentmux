# Task: Enhance Orchestrator Capabilities

## Overview

Update the orchestrator prompt and add new MCP tools to enable the orchestrator to design tasks, create projects, manage roles and skills, and configure teams through conversational interaction.

## Priority

**Sprint 5** - Orchestrator Enhancement

## Dependencies

- `24-role-service.md` - Role service for role management
- `29-skill-service.md` - Skill service for skill management
- All previous backend services

## Files to Modify

### 1. Update `config/teams/prompts/orchestrator-prompt.md`

Add comprehensive instructions for the orchestrator:

```markdown
# Crewly Orchestrator

You are the Crewly Orchestrator, an AI coordinator that manages projects, tasks, teams, and AI agents. You communicate with users through a chat interface and use MCP tools to take actions.

## Your Capabilities

### Project Management
- Create new project folders and structures
- Set up project configurations
- Initialize Git repositories
- Create project documentation

### Task Design
- Break down project requirements into tasks
- Assign tasks to appropriate agents based on their roles
- Track task progress and dependencies
- Reprioritize tasks as needed

### Team Management
- Create and configure agent teams
- Assign roles to team members
- Balance workload across agents
- Monitor team performance

### Role & Skill Management
- Create new roles for specific domains
- Assign skills to roles
- Create custom skills for specialized tasks
- Configure skill execution parameters

## Communication Style

When responding to users, format your responses for the chat interface:

### Response Formatting

Use the `[CHAT_RESPONSE]` markers to format clean responses:

```
[CHAT_RESPONSE]
## Title

Your response content here with:
- Bullet points
- **Bold text** for emphasis
- Code blocks when appropriate

[/CHAT_RESPONSE]
```

### Status Updates

When performing actions, provide status updates:

```
[CHAT_RESPONSE]
## Creating Project

I'm setting up your new project:
- ✅ Created folder structure
- ✅ Initialized Git repository
- ⏳ Setting up configuration...
[/CHAT_RESPONSE]
```

### Asking for Input

When you need clarification:

```
[CHAT_RESPONSE]
## Project Configuration

I need a few details to set up your project:

1. **Project Name**: What should I call this project?
2. **Type**: Is this a web app, CLI tool, or library?
3. **Language**: TypeScript, Python, or another language?

Please provide these details and I'll create the project.
[/CHAT_RESPONSE]
```

## Available MCP Tools

You have access to the following tools:

### Project Tools
- `create_project_folder` - Create a new project directory
- `setup_project_structure` - Initialize project structure with templates
- `get_project_info` - Get information about a project

### Task Tools
- `create_task` - Create a new task
- `update_task` - Update task status or details
- `get_tasks` - List tasks with filters
- `assign_task` - Assign a task to an agent

### Team Tools
- `create_team` - Create a new team
- `add_team_member` - Add an agent to a team
- `get_team_info` - Get team information

### Role Tools
- `create_role` - Create a new agent role
- `update_role` - Update role properties
- `list_roles` - List all available roles
- `assign_skills` - Assign skills to a role

### Skill Tools
- `create_skill` - Create a new skill
- `update_skill` - Update skill properties
- `list_skills` - List available skills
- `get_skill` - Get skill details

### Agent Tools
- `get_agents` - List active agents
- `get_agent_status` - Check agent status
- `send_agent_message` - Send message to an agent

## Workflow Examples

### Creating a New Project

1. Ask user for project requirements
2. Use `create_project_folder` to create directory
3. Use `setup_project_structure` to initialize structure
4. Use `create_team` to set up project team
5. Use `create_task` to define initial tasks
6. Report completion to user

### Assigning Work

1. Understand the task requirements
2. Use `list_roles` to find appropriate roles
3. Use `get_agents` to find available agents
4. Use `assign_task` to assign work
5. Confirm assignment to user

### Creating a Custom Skill

1. Gather skill requirements from user
2. Use `create_skill` with prompt content
3. Optionally configure execution (script/browser)
4. Use `assign_skills` to make available to roles
5. Confirm creation to user

## Best Practices

1. **Be Proactive**: Suggest next steps and improvements
2. **Be Clear**: Explain what you're doing and why
3. **Ask When Needed**: Don't assume - clarify requirements
4. **Format Well**: Use markdown for readability
5. **Confirm Actions**: Report what actions you've taken
6. **Handle Errors**: Explain issues and suggest solutions

## Error Handling

When something goes wrong:

```
[CHAT_RESPONSE]
## Issue Encountered

I ran into a problem while [action]:

**Error**: [brief description]

**Possible causes**:
- [cause 1]
- [cause 2]

**Suggested fix**: [what the user can do]

Would you like me to try a different approach?
[/CHAT_RESPONSE]
```
```

### 2. Add New MCP Tools

**Update:** `mcp-server/src/tools/index.ts`

Add the following new tool definitions:

```typescript
// Role Management Tools

export const createRoleToolDefinition = {
  name: 'create_role',
  description: 'Create a new AI agent role with specific capabilities',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Internal name for the role (lowercase, hyphens)',
      },
      displayName: {
        type: 'string',
        description: 'Human-readable display name',
      },
      description: {
        type: 'string',
        description: 'Description of the role purpose',
      },
      category: {
        type: 'string',
        enum: ['development', 'management', 'quality', 'design', 'sales', 'support'],
        description: 'Role category',
      },
      systemPromptContent: {
        type: 'string',
        description: 'The system prompt content for this role (markdown)',
      },
      assignedSkills: {
        type: 'array',
        items: { type: 'string' },
        description: 'Skill IDs to assign to this role',
      },
    },
    required: ['name', 'displayName', 'description', 'category', 'systemPromptContent'],
  },
};

export const updateRoleToolDefinition = {
  name: 'update_role',
  description: 'Update an existing role',
  inputSchema: {
    type: 'object',
    properties: {
      roleId: { type: 'string', description: 'ID of the role to update' },
      displayName: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      systemPromptContent: { type: 'string' },
      assignedSkills: { type: 'array', items: { type: 'string' } },
    },
    required: ['roleId'],
  },
};

export const listRolesToolDefinition = {
  name: 'list_roles',
  description: 'List all available roles',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Filter by category' },
      search: { type: 'string', description: 'Search in name/description' },
    },
  },
};

// Skill Management Tools

export const createSkillToolDefinition = {
  name: 'create_skill',
  description: 'Create a new skill with instructions and optional execution config',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Skill name' },
      description: { type: 'string', description: 'What this skill does' },
      category: {
        type: 'string',
        enum: ['development', 'design', 'communication', 'research', 'content-creation', 'automation', 'analysis', 'integration'],
      },
      promptContent: { type: 'string', description: 'Skill instructions (markdown)' },
      triggers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords that trigger this skill',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Searchable tags',
      },
      executionType: {
        type: 'string',
        enum: ['prompt-only', 'script', 'browser', 'mcp-tool'],
        description: 'How this skill is executed',
      },
      scriptConfig: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          interpreter: { type: 'string', enum: ['bash', 'python', 'node'] },
        },
        description: 'Script configuration (if executionType is script)',
      },
      browserConfig: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          instructions: { type: 'string' },
        },
        description: 'Browser automation config (if executionType is browser)',
      },
    },
    required: ['name', 'description', 'category', 'promptContent'],
  },
};

export const executeSkillToolDefinition = {
  name: 'execute_skill',
  description: 'Execute a skill',
  inputSchema: {
    type: 'object',
    properties: {
      skillId: { type: 'string', description: 'ID of the skill to execute' },
      context: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          roleId: { type: 'string' },
          projectId: { type: 'string' },
          taskId: { type: 'string' },
          userInput: { type: 'string' },
        },
        description: 'Execution context',
      },
    },
    required: ['skillId'],
  },
};

export const listSkillsToolDefinition = {
  name: 'list_skills',
  description: 'List available skills',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      roleId: { type: 'string', description: 'Filter by assignable role' },
      search: { type: 'string' },
    },
  },
};

// Project Scaffolding Tools

export const createProjectFolderToolDefinition = {
  name: 'create_project_folder',
  description: 'Create a new project folder',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project name' },
      path: { type: 'string', description: 'Path where to create the project' },
      template: {
        type: 'string',
        enum: ['empty', 'typescript', 'react', 'node', 'python'],
        description: 'Project template to use',
      },
      initGit: { type: 'boolean', description: 'Initialize git repository' },
    },
    required: ['name', 'path'],
  },
};

export const setupProjectStructureToolDefinition = {
  name: 'setup_project_structure',
  description: 'Set up project structure with specific configuration',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: { type: 'string', description: 'Path to the project' },
      structure: {
        type: 'object',
        properties: {
          folders: {
            type: 'array',
            items: { type: 'string' },
            description: 'Folders to create',
          },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
            },
            description: 'Files to create',
          },
        },
      },
    },
    required: ['projectPath', 'structure'],
  },
};

// Enhanced Team Tools

export const createTeamForProjectToolDefinition = {
  name: 'create_team_for_project',
  description: 'Create a new team configured for a specific project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project to create team for' },
      teamName: { type: 'string', description: 'Name for the team' },
      roles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Role IDs to include in the team',
      },
      agentCount: {
        type: 'object',
        additionalProperties: { type: 'number' },
        description: 'Number of agents per role',
      },
    },
    required: ['projectId', 'teamName', 'roles'],
  },
};
```

### 3. Implement Tool Handlers

**Create:** `mcp-server/src/tools/role-tools.ts`

```typescript
import { getRoleService } from '../../../backend/src/services/settings/role.service.js';
import { CreateRoleInput, UpdateRoleInput } from '../../../backend/src/types/role.types.js';

export async function handleCreateRole(params: any): Promise<any> {
  const roleService = getRoleService();

  const input: CreateRoleInput = {
    name: params.name,
    displayName: params.displayName,
    description: params.description,
    category: params.category,
    systemPromptContent: params.systemPromptContent,
    assignedSkills: params.assignedSkills || [],
  };

  const role = await roleService.createRole(input);

  return {
    success: true,
    message: `Role "${role.displayName}" created successfully`,
    role: {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
      category: role.category,
    },
  };
}

export async function handleUpdateRole(params: any): Promise<any> {
  const roleService = getRoleService();

  const input: UpdateRoleInput = {};
  if (params.displayName) input.displayName = params.displayName;
  if (params.description) input.description = params.description;
  if (params.category) input.category = params.category;
  if (params.systemPromptContent) input.systemPromptContent = params.systemPromptContent;
  if (params.assignedSkills) input.assignedSkills = params.assignedSkills;

  const role = await roleService.updateRole(params.roleId, input);

  return {
    success: true,
    message: `Role "${role.displayName}" updated successfully`,
    role: {
      id: role.id,
      name: role.name,
      displayName: role.displayName,
    },
  };
}

export async function handleListRoles(params: any): Promise<any> {
  const roleService = getRoleService();

  const roles = await roleService.listRoles({
    category: params.category,
    search: params.search,
  });

  return {
    success: true,
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      displayName: r.displayName,
      description: r.description,
      category: r.category,
      skillCount: r.skillCount,
      isBuiltin: r.isBuiltin,
    })),
    count: roles.length,
  };
}
```

**Create:** `mcp-server/src/tools/skill-tools.ts`

```typescript
import { getSkillService } from '../../../backend/src/services/skill/skill.service.js';
import { getSkillExecutorService } from '../../../backend/src/services/skill/skill-executor.service.js';
import { CreateSkillInput, SkillExecutionContext } from '../../../backend/src/types/skill.types.js';

export async function handleCreateSkill(params: any): Promise<any> {
  const skillService = getSkillService();

  const input: CreateSkillInput = {
    name: params.name,
    description: params.description,
    category: params.category,
    promptContent: params.promptContent,
    triggers: params.triggers || [],
    tags: params.tags || [],
  };

  if (params.executionType && params.executionType !== 'prompt-only') {
    input.execution = {
      type: params.executionType,
    };

    if (params.scriptConfig) {
      input.execution.script = params.scriptConfig;
    }

    if (params.browserConfig) {
      input.execution.browser = params.browserConfig;
    }
  }

  const skill = await skillService.createSkill(input);

  return {
    success: true,
    message: `Skill "${skill.name}" created successfully`,
    skill: {
      id: skill.id,
      name: skill.name,
      category: skill.category,
    },
  };
}

export async function handleExecuteSkill(params: any): Promise<any> {
  const executor = getSkillExecutorService();

  const context: SkillExecutionContext = {
    agentId: params.context?.agentId || 'orchestrator',
    roleId: params.context?.roleId || 'orchestrator',
    projectId: params.context?.projectId,
    taskId: params.context?.taskId,
    userInput: params.context?.userInput,
  };

  const result = await executor.executeSkill(params.skillId, context);

  return result;
}

export async function handleListSkills(params: any): Promise<any> {
  const skillService = getSkillService();

  const skills = await skillService.listSkills({
    category: params.category,
    roleId: params.roleId,
    search: params.search,
  });

  return {
    success: true,
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      executionType: s.executionType,
      triggerCount: s.triggerCount,
      isBuiltin: s.isBuiltin,
      isEnabled: s.isEnabled,
    })),
    count: skills.length,
  };
}
```

**Create:** `mcp-server/src/tools/project-tools.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export async function handleCreateProjectFolder(params: any): Promise<any> {
  const projectPath = path.join(params.path, params.name);

  // Create project directory
  await fs.mkdir(projectPath, { recursive: true });

  // Apply template if specified
  if (params.template && params.template !== 'empty') {
    await applyProjectTemplate(projectPath, params.template);
  }

  // Initialize git if requested
  if (params.initGit) {
    await initGitRepository(projectPath);
  }

  return {
    success: true,
    message: `Project "${params.name}" created at ${projectPath}`,
    projectPath,
    template: params.template || 'empty',
    gitInitialized: params.initGit || false,
  };
}

export async function handleSetupProjectStructure(params: any): Promise<any> {
  const { projectPath, structure } = params;

  // Create folders
  if (structure.folders) {
    for (const folder of structure.folders) {
      await fs.mkdir(path.join(projectPath, folder), { recursive: true });
    }
  }

  // Create files
  if (structure.files) {
    for (const file of structure.files) {
      const filePath = path.join(projectPath, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }
  }

  return {
    success: true,
    message: 'Project structure created',
    foldersCreated: structure.folders?.length || 0,
    filesCreated: structure.files?.length || 0,
  };
}

async function applyProjectTemplate(projectPath: string, template: string): Promise<void> {
  const templates: Record<string, () => Promise<void>> = {
    typescript: () => createTypescriptTemplate(projectPath),
    react: () => createReactTemplate(projectPath),
    node: () => createNodeTemplate(projectPath),
    python: () => createPythonTemplate(projectPath),
  };

  if (templates[template]) {
    await templates[template]();
  }
}

async function createTypescriptTemplate(projectPath: string): Promise<void> {
  // Create basic TypeScript project structure
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });

  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: path.basename(projectPath),
      version: '1.0.0',
      type: 'module',
      scripts: {
        build: 'tsc',
        start: 'node dist/index.js',
      },
      devDependencies: {
        typescript: '^5.0.0',
      },
    }, null, 2)
  );

  await fs.writeFile(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './dist',
        strict: true,
      },
      include: ['src/**/*'],
    }, null, 2)
  );

  await fs.writeFile(
    path.join(projectPath, 'src', 'index.ts'),
    'console.log("Hello, World!");\n'
  );
}

// Similar implementations for other templates...

async function initGitRepository(projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['init'], { cwd: projectPath });
    git.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Git init failed with code ${code}`));
    });
  });
}
```

## Acceptance Criteria

- [ ] Orchestrator prompt updated with new capabilities
- [ ] All new MCP tool definitions created
- [ ] Role management tools implemented and tested
- [ ] Skill management tools implemented and tested
- [ ] Project scaffolding tools implemented and tested
- [ ] Team creation tool implemented
- [ ] Response formatting with [CHAT_RESPONSE] markers works
- [ ] Error handling provides clear feedback
- [ ] All tools have unit tests

## Testing Requirements

1. Unit tests for each tool handler
2. Integration tests for tool → service interactions
3. End-to-end tests for common workflows
4. Error handling tests
5. Response formatting tests

## Example Conversations

### Creating a Project
```
User: Create a new TypeScript project called my-app

Orchestrator:
[CHAT_RESPONSE]
## Creating Project: my-app

I'll set up a TypeScript project for you.

✅ Created project folder at ~/projects/my-app
✅ Initialized TypeScript configuration
✅ Set up package.json
✅ Created src/index.ts
✅ Initialized Git repository

**Next steps:**
1. `cd ~/projects/my-app`
2. `npm install`
3. `npm run build`

Would you like me to create a team to work on this project?
[/CHAT_RESPONSE]
```

### Creating a Custom Skill
```
User: Create a skill for generating API documentation

Orchestrator:
[CHAT_RESPONSE]
## Creating Skill: API Documentation

I'll create a skill for generating API documentation.

**Details:**
- **Name**: API Documentation Generator
- **Category**: Development
- **Triggers**: "api docs", "documentation", "openapi"

**Instructions included:**
- Analyze code for API endpoints
- Generate OpenAPI/Swagger specifications
- Create markdown documentation

✅ Skill created successfully

Would you like me to assign this skill to the Developer role?
[/CHAT_RESPONSE]
```

## Notes

- Orchestrator should use [CHAT_RESPONSE] markers for all user-facing output
- Tools should return structured data for the orchestrator to format
- Consider adding confirmation prompts for destructive actions
- Log all tool invocations for debugging
