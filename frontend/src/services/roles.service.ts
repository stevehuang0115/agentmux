/**
 * Roles Service
 *
 * API client for role management endpoints.
 *
 * @module services/roles.service
 */

import axios from 'axios';
import {
  Role,
  RoleSummary,
  RoleWithPrompt,
  CreateRoleInput,
  UpdateRoleInput,
} from '../types/role.types';
import { ApiResponse } from '../types';

/** Base URL for roles API */
const ROLES_API_BASE = '/api/settings/roles';

/**
 * Roles service for managing agent roles via API
 */
class RolesService {
  /**
   * Get all roles as summaries
   *
   * @returns Promise resolving to array of role summaries
   * @throws Error if request fails
   */
  async listRoles(): Promise<RoleSummary[]> {
    const response = await axios.get<ApiResponse<RoleSummary[]>>(ROLES_API_BASE);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get roles');
    }
    return response.data.data;
  }

  /**
   * Get a single role with its prompt content
   *
   * @param id - Role ID
   * @returns Promise resolving to role with prompt
   * @throws Error if role not found or request fails
   */
  async getRole(id: string): Promise<RoleWithPrompt> {
    const response = await axios.get<ApiResponse<RoleWithPrompt>>(`${ROLES_API_BASE}/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Role not found');
    }
    return response.data.data;
  }

  /**
   * Create a new role
   *
   * @param input - Role creation input
   * @returns Promise resolving to created role
   * @throws Error if validation fails or request fails
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    const response = await axios.post<ApiResponse<Role>>(ROLES_API_BASE, input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create role');
    }
    return response.data.data;
  }

  /**
   * Update an existing role
   *
   * @param id - Role ID to update
   * @param input - Role update input
   * @returns Promise resolving to updated role
   * @throws Error if role not found, is builtin, or request fails
   */
  async updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
    const response = await axios.put<ApiResponse<Role>>(`${ROLES_API_BASE}/${id}`, input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update role');
    }
    return response.data.data;
  }

  /**
   * Delete a role
   *
   * @param id - Role ID to delete
   * @throws Error if role not found, is builtin, or request fails
   */
  async deleteRole(id: string): Promise<void> {
    const response = await axios.delete<ApiResponse<void>>(`${ROLES_API_BASE}/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete role');
    }
  }

  /**
   * Assign skills to a role
   *
   * @param id - Role ID
   * @param skillIds - Skill IDs to assign
   * @returns Promise resolving to updated role
   * @throws Error if request fails
   */
  async assignSkills(id: string, skillIds: string[]): Promise<Role> {
    const response = await axios.post<ApiResponse<Role>>(
      `${ROLES_API_BASE}/${id}/skills`,
      { skillIds }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to assign skills');
    }
    return response.data.data;
  }

  /**
   * Remove skills from a role
   *
   * @param id - Role ID
   * @param skillIds - Skill IDs to remove
   * @returns Promise resolving to updated role
   * @throws Error if request fails
   */
  async removeSkills(id: string, skillIds: string[]): Promise<Role> {
    const response = await axios.delete<ApiResponse<Role>>(
      `${ROLES_API_BASE}/${id}/skills`,
      { data: { skillIds } }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to remove skills');
    }
    return response.data.data;
  }

  /**
   * Set a role as the default
   *
   * @param id - Role ID to set as default
   * @returns Promise resolving to updated role
   * @throws Error if request fails
   */
  async setDefaultRole(id: string): Promise<Role> {
    const response = await axios.post<ApiResponse<Role>>(
      `${ROLES_API_BASE}/${id}/default`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to set default role');
    }
    return response.data.data;
  }
}

/** Singleton instance */
export const rolesService = new RolesService();

export default rolesService;
