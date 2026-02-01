/**
 * Tool Handlers Index
 *
 * Centralizes exports for all MCP tool handlers.
 *
 * @module tools
 */

// Role Management Tools
export { handleCreateRole, handleUpdateRole, handleListRoles } from './role-tools.js';

// Skill Management Tools
export { handleCreateSkill, handleExecuteSkill, handleListSkills } from './skill-tools.js';

// Project Management Tools
export {
  handleCreateProjectFolder,
  handleSetupProjectStructure,
  handleCreateTeamForProject,
} from './project-tools.js';

// Tool Definition Constants

/**
 * Create role tool definition for MCP tools/list response
 */
export const createRoleToolDefinition = {
  name: 'create_role',
  description: 'Create a new AI agent role with specific capabilities',
  inputSchema: {
    type: 'object' as const,
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

/**
 * Update role tool definition for MCP tools/list response
 */
export const updateRoleToolDefinition = {
  name: 'update_role',
  description: 'Update an existing role',
  inputSchema: {
    type: 'object' as const,
    properties: {
      roleId: { type: 'string', description: 'ID of the role to update' },
      displayName: { type: 'string', description: 'Human-readable display name' },
      description: { type: 'string', description: 'Description of the role purpose' },
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
    required: ['roleId'],
  },
};

/**
 * List roles tool definition for MCP tools/list response
 */
export const listRolesToolDefinition = {
  name: 'list_roles',
  description: 'List all available roles',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: { type: 'string', description: 'Filter by category' },
      search: { type: 'string', description: 'Search in name/description' },
    },
    required: [] as string[],
  },
};

/**
 * Create skill tool definition for MCP tools/list response
 */
export const createSkillToolDefinition = {
  name: 'create_skill',
  description: 'Create a new skill with instructions and optional execution config',
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Skill name' },
      description: { type: 'string', description: 'What this skill does' },
      category: {
        type: 'string',
        enum: [
          'development',
          'design',
          'communication',
          'research',
          'content-creation',
          'automation',
          'analysis',
          'integration',
        ],
        description: 'Skill category',
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

/**
 * Execute skill tool definition for MCP tools/list response
 */
export const executeSkillToolDefinition = {
  name: 'execute_skill',
  description: 'Execute a skill',
  inputSchema: {
    type: 'object' as const,
    properties: {
      skillId: { type: 'string', description: 'ID of the skill to execute' },
      context: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent executing the skill' },
          roleId: { type: 'string', description: 'Role context' },
          projectId: { type: 'string', description: 'Project context' },
          taskId: { type: 'string', description: 'Task context' },
          userInput: { type: 'string', description: 'User input for the skill' },
        },
        description: 'Execution context',
      },
    },
    required: ['skillId'],
  },
};

/**
 * List skills tool definition for MCP tools/list response
 */
export const listSkillsToolDefinition = {
  name: 'list_skills',
  description: 'List available skills',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: { type: 'string', description: 'Filter by category' },
      roleId: { type: 'string', description: 'Filter by assignable role' },
      search: { type: 'string', description: 'Search in name/description' },
    },
    required: [] as string[],
  },
};

/**
 * Create project folder tool definition for MCP tools/list response
 */
export const createProjectFolderToolDefinition = {
  name: 'create_project_folder',
  description: 'Create a new project folder',
  inputSchema: {
    type: 'object' as const,
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

/**
 * Setup project structure tool definition for MCP tools/list response
 */
export const setupProjectStructureToolDefinition = {
  name: 'setup_project_structure',
  description: 'Set up project structure with specific configuration',
  inputSchema: {
    type: 'object' as const,
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
        description: 'Project structure configuration',
      },
    },
    required: ['projectPath', 'structure'],
  },
};

/**
 * Create team for project tool definition for MCP tools/list response
 */
export const createTeamForProjectToolDefinition = {
  name: 'create_team_for_project',
  description: 'Create a new team configured for a specific project',
  inputSchema: {
    type: 'object' as const,
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

/**
 * Array of all new tool definitions for easy inclusion
 */
export const orchestratorToolDefinitions = [
  createRoleToolDefinition,
  updateRoleToolDefinition,
  listRolesToolDefinition,
  createSkillToolDefinition,
  executeSkillToolDefinition,
  listSkillsToolDefinition,
  createProjectFolderToolDefinition,
  setupProjectStructureToolDefinition,
  createTeamForProjectToolDefinition,
];
