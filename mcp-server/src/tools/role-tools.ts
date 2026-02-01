/**
 * Role Management Tool Handlers
 *
 * Handles MCP tool calls for role management operations including
 * creating, updating, and listing roles.
 *
 * @module tools/role-tools
 */

import {
  CreateRoleToolParams,
  UpdateRoleToolParams,
  ListRolesToolParams,
  ToolResultData,
} from '../types.js';

// Service imports will be dynamically resolved at runtime
// since the backend services are in a separate module
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';

/**
 * API response wrapper type
 */
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/**
 * Role data from API
 */
interface RoleData {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  skillCount?: number;
  isBuiltin?: boolean;
}

/**
 * Handle the create_role MCP tool call
 *
 * Creates a new AI agent role with the specified properties.
 *
 * @param params - Role creation parameters
 * @returns Tool result with created role information
 *
 * @example
 * ```typescript
 * const result = await handleCreateRole({
 *   name: 'api-developer',
 *   displayName: 'API Developer',
 *   description: 'Specializes in RESTful API development',
 *   category: 'development',
 *   systemPromptContent: '# API Developer\nYou are an expert API developer...',
 * });
 * ```
 */
export async function handleCreateRole(params: CreateRoleToolParams): Promise<ToolResultData> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/settings/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name,
        displayName: params.displayName,
        description: params.description,
        category: params.category,
        systemPromptContent: params.systemPromptContent,
        assignedSkills: params.assignedSkills || [],
      }),
    });

    const data = (await response.json()) as ApiResponse<RoleData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to create role: ${response.statusText}`,
      };
    }

    const roleData = data.data;
    if (!roleData) {
      return {
        success: false,
        error: 'No role data returned from server',
      };
    }

    return {
      success: true,
      message: `Role "${params.displayName}" created successfully`,
      role: {
        id: roleData.id,
        name: roleData.name,
        displayName: roleData.displayName,
        category: roleData.category,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating role',
    };
  }
}

/**
 * Handle the update_role MCP tool call
 *
 * Updates an existing role with the specified changes.
 *
 * @param params - Role update parameters
 * @returns Tool result with updated role information
 *
 * @example
 * ```typescript
 * const result = await handleUpdateRole({
 *   roleId: 'role-123',
 *   displayName: 'Senior API Developer',
 *   assignedSkills: ['skill-1', 'skill-2'],
 * });
 * ```
 */
export async function handleUpdateRole(params: UpdateRoleToolParams): Promise<ToolResultData> {
  try {
    const updatePayload: Record<string, unknown> = {};

    if (params.displayName !== undefined) updatePayload.displayName = params.displayName;
    if (params.description !== undefined) updatePayload.description = params.description;
    if (params.category !== undefined) updatePayload.category = params.category;
    if (params.systemPromptContent !== undefined) {
      updatePayload.systemPromptContent = params.systemPromptContent;
    }
    if (params.assignedSkills !== undefined) updatePayload.assignedSkills = params.assignedSkills;

    const response = await fetch(`${BACKEND_API_URL}/api/settings/roles/${params.roleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const data = (await response.json()) as ApiResponse<RoleData>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to update role: ${response.statusText}`,
      };
    }

    const roleData = data.data;
    if (!roleData) {
      return {
        success: false,
        error: 'No role data returned from server',
      };
    }

    return {
      success: true,
      message: `Role "${roleData.displayName}" updated successfully`,
      role: {
        id: roleData.id,
        name: roleData.name,
        displayName: roleData.displayName,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating role',
    };
  }
}

/**
 * Handle the list_roles MCP tool call
 *
 * Lists all available roles, optionally filtered by category or search term.
 *
 * @param params - Role list filter parameters
 * @returns Tool result with list of roles
 *
 * @example
 * ```typescript
 * const result = await handleListRoles({
 *   category: 'development',
 *   search: 'api',
 * });
 * ```
 */
export async function handleListRoles(params: ListRolesToolParams): Promise<ToolResultData> {
  try {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.set('category', params.category);
    if (params.search) queryParams.set('search', params.search);

    const url = `${BACKEND_API_URL}/api/settings/roles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as ApiResponse<RoleData[]>;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Failed to list roles: ${response.statusText}`,
      };
    }

    const roles = data.data || [];

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
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error listing roles',
    };
  }
}
