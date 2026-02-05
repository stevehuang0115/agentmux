/**
 * Skills Service
 *
 * Frontend service for skill management API calls.
 * Provides CRUD operations and skill execution functionality.
 *
 * @module services/skills
 */

import type { SkillSummary, SkillCategory } from '../types/skill.types';

const API_BASE = '/api/skills';

/**
 * Skill with full details including prompt content
 */
export interface SkillWithPrompt extends SkillSummary {
  promptContent?: string;
}

/**
 * Input for creating a new skill
 */
export interface CreateSkillInput {
  name: string;
  displayName: string;
  description: string;
  category: SkillCategory;
  promptContent?: string;
  tags?: string[];
  triggers?: string[];
  assignableRoles?: string[];
}

/**
 * Input for updating an existing skill
 */
export interface UpdateSkillInput {
  name?: string;
  displayName?: string;
  description?: string;
  category?: SkillCategory;
  promptContent?: string;
  tags?: string[];
  triggers?: string[];
  assignableRoles?: string[];
  isEnabled?: boolean;
}

/**
 * Options for filtering skills
 */
export interface SkillFilterOptions {
  category?: SkillCategory;
  roleId?: string;
  search?: string;
}

/**
 * Result of skill execution
 */
export interface SkillExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

/**
 * Fetch all skills with optional filtering
 *
 * @param options - Filter options
 * @returns Promise resolving to array of skill summaries
 */
export async function getSkills(options?: SkillFilterOptions): Promise<SkillSummary[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set('category', options.category);
  if (options?.roleId) params.set('roleId', options.roleId);
  if (options?.search) params.set('search', options.search);

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch skills: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Fetch a single skill by ID with full details
 *
 * @param id - Skill ID
 * @returns Promise resolving to full skill details
 */
export async function getSkillById(id: string): Promise<SkillWithPrompt> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Skill not found: ${id}`);
    }
    throw new Error(`Failed to fetch skill: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Create a new skill
 *
 * @param skill - Skill creation data
 * @returns Promise resolving to created skill
 */
export async function createSkill(skill: CreateSkillInput): Promise<SkillWithPrompt> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(skill),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create skill: ${error}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Update an existing skill
 *
 * @param id - Skill ID
 * @param updates - Skill update data
 * @returns Promise resolving to updated skill
 */
export async function updateSkill(id: string, updates: UpdateSkillInput): Promise<SkillWithPrompt> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update skill: ${error}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Delete a skill
 *
 * @param id - Skill ID
 * @returns Promise resolving when deleted
 */
export async function deleteSkill(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete skill: ${response.statusText}`);
  }
}

/**
 * Get skills by category
 *
 * @param category - Skill category
 * @returns Promise resolving to skills in category
 */
export async function getSkillsByCategory(category: SkillCategory): Promise<SkillSummary[]> {
  return getSkills({ category });
}

/**
 * Get skills assigned to a role
 *
 * @param roleId - Role ID
 * @returns Promise resolving to skills for role
 */
export async function getSkillsForRole(roleId: string): Promise<SkillSummary[]> {
  return getSkills({ roleId });
}

/**
 * Execute a skill
 *
 * @param id - Skill ID
 * @param context - Execution context
 * @returns Promise resolving to execution result
 */
export async function executeSkill(
  id: string,
  context?: Record<string, unknown>
): Promise<SkillExecutionResult> {
  const response = await fetch(`${API_BASE}/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to execute skill: ${error}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Refresh skills from disk
 *
 * Tells the backend to reload all skills from the filesystem,
 * picking up any new skills added to config/skills/ or ~/.agentmux/skills/
 *
 * @returns Promise resolving when refresh is complete
 */
export async function refreshSkillsFromDisk(): Promise<void> {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh skills: ${error}`);
  }
}

/**
 * MCP server installation status
 */
export interface McpServerStatus {
  /** Package name (e.g., @anthropic/mcp-server-playwright) */
  packageName: string;
  /** Whether the MCP server is installed/configured */
  isInstalled: boolean;
  /** The configured name in Claude settings (if installed) */
  configuredName?: string;
  /** Where the MCP server was found ('global' or 'project') */
  source?: 'global' | 'project';
}

/**
 * Response from MCP status check
 */
export interface McpStatusResponse {
  statuses: McpServerStatus[];
  allConfiguredServers: string[];
  /** Whether global Claude settings were found */
  globalSettingsFound: boolean;
  /** Whether project-level Claude settings were found */
  projectSettingsFound: boolean;
  /** The project path that was checked (if any) */
  projectPath: string | null;
}

/**
 * Check MCP server installation status
 *
 * Checks if the specified MCP server packages are installed in Claude Code.
 * Can check both global settings (~/.claude/settings.json) and project-level
 * settings (<projectPath>/.claude/settings.json).
 *
 * @param packages - Array of package names to check
 * @param projectPath - Optional project path to also check project-level settings
 * @returns Promise resolving to MCP status information
 */
export async function checkMcpStatus(packages: string[], projectPath?: string): Promise<McpStatusResponse> {
  const params = new URLSearchParams();
  if (packages.length > 0) {
    params.set('packages', packages.join(','));
  }
  if (projectPath) {
    params.set('projectPath', projectPath);
  }

  const url = `${API_BASE}/mcp-status?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to check MCP status: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data;
}

/**
 * Skills service object for convenience
 */
export const skillsService = {
  getAll: getSkills,
  getById: getSkillById,
  create: createSkill,
  update: updateSkill,
  delete: deleteSkill,
  getByCategory: getSkillsByCategory,
  getForRole: getSkillsForRole,
  execute: executeSkill,
  refreshFromDisk: refreshSkillsFromDisk,
  checkMcpStatus,
};

export default skillsService;
