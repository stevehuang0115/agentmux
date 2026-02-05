/**
 * Role Management Service
 *
 * Handles CRUD operations for AI agent roles, loading from configuration
 * directories, and managing role-to-skill assignments.
 *
 * @module services/settings/role.service
 */

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  Role,
  RoleWithPrompt,
  RoleSummary,
  CreateRoleInput,
  UpdateRoleInput,
  RoleFilter,
  RoleStorageFormat,
  roleToSummary,
  validateCreateRoleInput,
  validateUpdateRoleInput,
  matchesRoleFilter,
  roleToStorageFormat,
  storageFormatToRole,
} from '../../types/role.types.js';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Error thrown when a role is not found
 */
export class RoleNotFoundError extends Error {
  constructor(id: string) {
    super(`Role not found: ${id}`);
    this.name = 'RoleNotFoundError';
  }
}

/**
 * Error thrown when role validation fails
 */
export class RoleValidationError extends Error {
  public readonly errors: string[];

  constructor(errors: string[]) {
    super(`Role validation failed: ${errors.join(', ')}`);
    this.name = 'RoleValidationError';
    this.errors = errors;
  }
}

/**
 * Error thrown when attempting to modify a built-in role
 */
export class BuiltinRoleModificationError extends Error {
  constructor(action: string) {
    super(`Cannot ${action} a built-in role`);
    this.name = 'BuiltinRoleModificationError';
  }
}

/**
 * Error thrown when a role with the same name already exists
 */
export class DuplicateRoleNameError extends Error {
  constructor(name: string) {
    super(`A role with name "${name}" already exists`);
    this.name = 'DuplicateRoleNameError';
  }
}

// ============================================================================
// RoleService Class
// ============================================================================

/**
 * Service for managing AI agent roles
 *
 * Handles:
 * - Loading built-in roles from config/roles/
 * - Managing user-created roles in ~/.agentmux/roles/
 * - CRUD operations for roles
 * - Role-to-skill assignment management
 *
 * @example
 * ```typescript
 * const service = getRoleService();
 * await service.initialize();
 *
 * // List all roles
 * const roles = await service.listRoles();
 *
 * // Create a new role
 * const newRole = await service.createRole({
 *   name: 'my-role',
 *   displayName: 'My Role',
 *   description: 'A custom role',
 *   category: 'development',
 *   systemPromptContent: 'You are a helpful assistant.',
 * });
 * ```
 */
export class RoleService {
  private readonly builtinRolesDir: string;
  private readonly userRolesDir: string;
  private rolesCache: Map<string, Role> = new Map();
  private promptCache: Map<string, string> = new Map();
  private initialized = false;

  /**
   * Create a new RoleService instance
   *
   * @param options - Configuration options
   * @param options.builtinRolesDir - Directory for built-in roles
   * @param options.userRolesDir - Directory for user-created roles
   */
  constructor(options?: {
    builtinRolesDir?: string;
    userRolesDir?: string;
  }) {
    this.builtinRolesDir = options?.builtinRolesDir ??
      path.join(process.cwd(), 'config', 'roles');
    this.userRolesDir = options?.userRolesDir ??
      path.join(process.env.HOME || '~', '.agentmux', 'roles');
  }

  /**
   * Initialize the service by loading all roles
   * Must be called before using other methods
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.rolesCache.clear();
    this.promptCache.clear();

    // Load built-in roles
    const builtinRoles = await this.loadBuiltinRoles();
    for (const role of builtinRoles) {
      this.rolesCache.set(role.id, role);
    }

    // Load user roles
    const userRoles = await this.loadUserRoles();
    for (const role of userRoles) {
      this.rolesCache.set(role.id, role);
    }

    this.initialized = true;
  }

  /**
   * Get all roles, optionally filtered
   *
   * @param filter - Optional filter criteria
   * @param includeHidden - Whether to include hidden roles (default: false for UI)
   * @returns Array of role summaries
   */
  async listRoles(filter?: RoleFilter, includeHidden: boolean = false): Promise<RoleSummary[]> {
    await this.ensureInitialized();

    let roles = Array.from(this.rolesCache.values());

    // Filter out hidden roles unless explicitly requested
    if (!includeHidden) {
      roles = roles.filter(role => !role.isHidden);
    }

    const filteredRoles = filter
      ? roles.filter(role => matchesRoleFilter(role, filter))
      : roles;

    return filteredRoles.map(roleToSummary);
  }

  /**
   * Get a role by ID with full prompt content
   *
   * @param id - The role ID
   * @returns The role with prompt content, or null if not found
   */
  async getRole(id: string): Promise<RoleWithPrompt | null> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(id);
    if (!role) {
      return null;
    }

    const promptContent = await this.loadPromptContent(role.systemPromptFile, role.isBuiltin, role.name);
    return {
      ...role,
      systemPromptContent: promptContent,
    };
  }

  /**
   * Get a role by name (includes hidden roles)
   *
   * @param name - The role name
   * @returns The role with prompt content, or null if not found
   */
  async getRoleByName(name: string): Promise<RoleWithPrompt | null> {
    await this.ensureInitialized();

    const role = Array.from(this.rolesCache.values()).find(r => r.name === name);
    if (!role) {
      return null;
    }

    return this.getRole(role.id);
  }

  /**
   * Get the prompt file path for a role
   * Used by PromptBuilderService and AgentRegistrationService
   *
   * @param roleName - The role name (e.g., 'orchestrator', 'tpm', 'developer')
   * @returns The full path to the prompt file, or null if role not found
   */
  async getPromptFilePath(roleName: string): Promise<string | null> {
    await this.ensureInitialized();

    const role = Array.from(this.rolesCache.values()).find(r => r.name === roleName);
    if (!role) {
      return null;
    }

    // Built-in roles use subdirectory structure: config/roles/{role}/prompt.md
    // User roles use flat structure: ~/.agentmux/roles/{promptFile}
    if (role.isBuiltin) {
      return path.join(this.builtinRolesDir, role.name, role.systemPromptFile);
    }
    return path.join(this.userRolesDir, role.systemPromptFile);
  }

  /**
   * Get the built-in roles directory path
   *
   * @returns The path to built-in roles directory
   */
  getBuiltinRolesDir(): string {
    return this.builtinRolesDir;
  }

  /**
   * Create a new user-defined role
   *
   * @param input - The role creation input
   * @returns The created role
   * @throws {RoleValidationError} If input validation fails
   * @throws {DuplicateRoleNameError} If a role with the same name exists
   */
  async createRole(input: CreateRoleInput): Promise<Role> {
    await this.ensureInitialized();

    // Validate input
    const errors = validateCreateRoleInput(input);
    if (errors.length > 0) {
      throw new RoleValidationError(errors);
    }

    // Check for duplicate name
    const existingRole = await this.getRoleByName(input.name);
    if (existingRole) {
      throw new DuplicateRoleNameError(input.name);
    }

    // Ensure user roles directory exists
    await this.ensureUserRolesDir();

    // Generate ID and create role
    const id = this.generateRoleId(input.name);
    const now = new Date().toISOString();
    const promptFileName = `${input.name}-prompt.md`;

    const role: Role = {
      id,
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      category: input.category,
      systemPromptFile: promptFileName,
      assignedSkills: input.assignedSkills ?? [],
      isDefault: input.isDefault ?? false,
      isHidden: false,
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    };

    // If this role is set as default, unset other defaults
    if (role.isDefault) {
      await this.unsetAllDefaults();
    }

    // Save role and prompt
    await this.saveRole(role, input.systemPromptContent);

    // Update cache
    this.rolesCache.set(role.id, role);
    this.promptCache.set(role.systemPromptFile, input.systemPromptContent);

    return role;
  }

  /**
   * Update an existing role
   *
   * For builtin roles: Creates an override in ~/.agentmux/roles/ (original stays intact)
   * For user roles: Updates the role directly
   *
   * @param id - The role ID
   * @param input - The update input
   * @returns The updated role
   * @throws {RoleNotFoundError} If the role is not found
   * @throws {RoleValidationError} If input validation fails
   */
  async updateRole(id: string, input: UpdateRoleInput): Promise<Role> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(id);
    if (!role) {
      throw new RoleNotFoundError(id);
    }

    // Validate input
    const errors = validateUpdateRoleInput(input);
    if (errors.length > 0) {
      throw new RoleValidationError(errors);
    }

    // Build updated role
    const now = new Date().toISOString();
    const updatedRole: Role = {
      ...role,
      displayName: input.displayName ?? role.displayName,
      description: input.description ?? role.description,
      category: input.category ?? role.category,
      assignedSkills: input.assignedSkills ?? role.assignedSkills,
      isDefault: input.isDefault ?? role.isDefault,
      updatedAt: now,
    };

    // If this role is being set as default, unset other defaults
    if (input.isDefault === true && !role.isDefault) {
      await this.unsetAllDefaults();
    }

    // Get prompt content (use new or existing)
    const existingPromptContent = role.isBuiltin
      ? await this.loadPromptContent(role.systemPromptFile, true, role.name)
      : await this.loadPromptContent(role.systemPromptFile, false);
    const promptContent = input.systemPromptContent ?? existingPromptContent;

    // Save to user directory (creates override for builtin roles)
    await this.saveRoleOverride(updatedRole, promptContent);

    // Update cache
    this.rolesCache.set(id, updatedRole);
    if (input.systemPromptContent) {
      const cacheKey = role.isBuiltin ? `override:${role.name}` : role.systemPromptFile;
      this.promptCache.set(cacheKey, input.systemPromptContent);
    }

    return updatedRole;
  }

  /**
   * Check if a builtin role has a user override
   *
   * @param id - The role ID
   * @returns True if the role has a user override
   */
  async hasOverride(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(id);
    if (!role || !role.isBuiltin) {
      return false;
    }

    const overridePath = path.join(this.userRolesDir, role.name, 'role.json');
    try {
      await fs.access(overridePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset a builtin role to its default (removes user override)
   *
   * @param id - The role ID
   * @returns The reset role (original builtin values)
   * @throws {RoleNotFoundError} If the role is not found
   */
  async resetToDefault(id: string): Promise<Role> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(id);
    if (!role) {
      throw new RoleNotFoundError(id);
    }

    if (!role.isBuiltin) {
      // Non-builtin roles can't be "reset" - they have no default
      return role;
    }

    // Delete the override directory
    const overrideDir = path.join(this.userRolesDir, role.name);
    try {
      await fs.rm(overrideDir, { recursive: true, force: true });
    } catch {
      // Override doesn't exist, that's fine
    }

    // Clear override from cache
    const cacheKey = `override:${role.name}`;
    this.promptCache.delete(cacheKey);

    // Reload the original builtin role
    const roleJsonPath = path.join(this.builtinRolesDir, role.name, 'role.json');
    const content = await fs.readFile(roleJsonPath, 'utf-8');
    const stored: RoleStorageFormat = JSON.parse(content);
    const originalRole = storageFormatToRole(stored, true);

    // Update cache with original
    this.rolesCache.set(id, originalRole);

    return originalRole;
  }

  /**
   * Delete a user-created role (built-in roles cannot be deleted)
   *
   * @param id - The role ID
   * @throws {RoleNotFoundError} If the role is not found
   * @throws {BuiltinRoleModificationError} If attempting to delete a built-in role
   */
  async deleteRole(id: string): Promise<void> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(id);
    if (!role) {
      throw new RoleNotFoundError(id);
    }

    if (role.isBuiltin) {
      throw new BuiltinRoleModificationError('delete');
    }

    // Delete files
    const jsonPath = path.join(this.userRolesDir, `${role.name}.json`);
    const promptPath = path.join(this.userRolesDir, role.systemPromptFile);

    try {
      await fs.unlink(jsonPath);
    } catch {
      // Ignore if file doesn't exist
    }

    try {
      await fs.unlink(promptPath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Update cache
    this.rolesCache.delete(id);
    this.promptCache.delete(role.systemPromptFile);
  }

  /**
   * Assign skills to a role
   *
   * @param roleId - The role ID
   * @param skillIds - Array of skill IDs to assign
   * @returns The updated role
   * @throws {RoleNotFoundError} If the role is not found
   * @throws {BuiltinRoleModificationError} If attempting to modify a built-in role
   */
  async assignSkills(roleId: string, skillIds: string[]): Promise<Role> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    if (role.isBuiltin) {
      throw new BuiltinRoleModificationError('modify skills for');
    }

    // Merge skills without duplicates
    const newSkills = [...new Set([...role.assignedSkills, ...skillIds])];

    return this.updateRole(roleId, { assignedSkills: newSkills });
  }

  /**
   * Remove skills from a role
   *
   * @param roleId - The role ID
   * @param skillIds - Array of skill IDs to remove
   * @returns The updated role
   * @throws {RoleNotFoundError} If the role is not found
   * @throws {BuiltinRoleModificationError} If attempting to modify a built-in role
   */
  async removeSkills(roleId: string, skillIds: string[]): Promise<Role> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    if (role.isBuiltin) {
      throw new BuiltinRoleModificationError('modify skills for');
    }

    // Filter out removed skills
    const newSkills = role.assignedSkills.filter(s => !skillIds.includes(s));

    return this.updateRole(roleId, { assignedSkills: newSkills });
  }

  /**
   * Set the default role
   *
   * @param roleId - The role ID to set as default
   * @returns The updated role
   * @throws {RoleNotFoundError} If the role is not found
   */
  async setDefaultRole(roleId: string): Promise<Role> {
    await this.ensureInitialized();

    const role = this.rolesCache.get(roleId);
    if (!role) {
      throw new RoleNotFoundError(roleId);
    }

    // Unset all existing defaults
    await this.unsetAllDefaults();

    // Set the new default
    const now = new Date().toISOString();
    const updatedRole: Role = {
      ...role,
      isDefault: true,
      updatedAt: now,
    };

    // Save if user role
    if (!role.isBuiltin) {
      const promptContent = await this.loadPromptContent(role.systemPromptFile, false);
      await this.saveRole(updatedRole, promptContent);
    }

    // Update cache
    this.rolesCache.set(roleId, updatedRole);

    return updatedRole;
  }

  /**
   * Get the current default role
   *
   * @returns The default role, or null if none is set
   */
  async getDefaultRole(): Promise<Role | null> {
    await this.ensureInitialized();

    const roles = Array.from(this.rolesCache.values());
    return roles.find(role => role.isDefault) ?? null;
  }

  /**
   * Refresh the roles cache by reloading from disk
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Ensure the service is initialized.
   * Auto-initializes if not already done.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Load built-in roles from the config directory
   * Loads from subdirectories (config/roles/{role}/role.json)
   */
  private async loadBuiltinRoles(): Promise<Role[]> {
    const roles: Role[] = [];

    try {
      const entries = await fs.readdir(this.builtinRolesDir, { withFileTypes: true });

      for (const entry of entries) {
        // Load from subdirectories containing role.json
        if (entry.isDirectory()) {
          try {
            // Check for user override first
            const overridePath = path.join(this.userRolesDir, entry.name, 'role.json');
            let roleJsonPath: string;
            let hasOverride = false;

            try {
              await fs.access(overridePath);
              roleJsonPath = overridePath;
              hasOverride = true;
            } catch {
              // No override, use builtin
              roleJsonPath = path.join(this.builtinRolesDir, entry.name, 'role.json');
            }

            const content = await fs.readFile(roleJsonPath, 'utf-8');
            const stored: RoleStorageFormat = JSON.parse(content);
            const role = storageFormatToRole(stored, true);

            // Mark if this role has a user override
            if (hasOverride) {
              (role as any).hasOverride = true;
            }

            roles.push(role);
          } catch {
            // Skip directories without role.json
          }
        }
      }
    } catch {
      // Directory doesn't exist - no builtin roles
    }

    return roles;
  }

  /**
   * Load user-created roles from the user directory
   */
  private async loadUserRoles(): Promise<Role[]> {
    const roles: Role[] = [];

    try {
      const files = await fs.readdir(this.userRolesDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.userRolesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const stored: RoleStorageFormat = JSON.parse(content);
          const role = storageFormatToRole(stored, false);
          roles.push(role);
        } catch (err) {
          console.warn(`Failed to load user role from ${file}:`, err);
        }
      }
    } catch {
      // Directory doesn't exist - no user roles
    }

    return roles;
  }

  /**
   * Save a role and its prompt content to disk
   *
   * @param role - The role to save
   * @param promptContent - The prompt content to save
   */
  private async saveRole(role: Role, promptContent: string): Promise<void> {
    await this.ensureUserRolesDir();

    // Save JSON file
    const jsonPath = path.join(this.userRolesDir, `${role.name}.json`);
    const storageFormat = roleToStorageFormat(role);
    await fs.writeFile(jsonPath, JSON.stringify(storageFormat, null, 2), 'utf-8');

    // Save prompt file
    const promptPath = path.join(this.userRolesDir, role.systemPromptFile);
    await fs.writeFile(promptPath, promptContent, 'utf-8');
  }

  /**
   * Save a role override to user directory
   * Uses subdirectory structure: ~/.agentmux/roles/{role-name}/role.json + prompt.md
   *
   * @param role - The role to save
   * @param promptContent - The prompt content
   */
  private async saveRoleOverride(role: Role, promptContent: string): Promise<void> {
    await this.ensureUserRolesDir();

    // Create role subdirectory
    const roleDir = path.join(this.userRolesDir, role.name);
    await fs.mkdir(roleDir, { recursive: true });

    // Save role.json
    const jsonPath = path.join(roleDir, 'role.json');
    const storageFormat = roleToStorageFormat(role);
    // Override uses prompt.md in same directory
    storageFormat.systemPromptFile = 'prompt.md';
    await fs.writeFile(jsonPath, JSON.stringify(storageFormat, null, 2), 'utf-8');

    // Save prompt.md
    const promptPath = path.join(roleDir, 'prompt.md');
    await fs.writeFile(promptPath, promptContent, 'utf-8');
  }

  /**
   * Load prompt content from a file
   * For built-in roles, checks for user override first, then falls back to builtin
   * For user roles, loads from ~/.agentmux/roles/
   *
   * @param promptFile - The prompt file name (e.g., "prompt.md")
   * @param isBuiltin - Whether this is a built-in role
   * @param roleName - The role name (directory name)
   * @returns The prompt content
   */
  private async loadPromptContent(promptFile: string, isBuiltin: boolean, roleName?: string): Promise<string> {
    // Check cache first
    const cacheKey = `${isBuiltin ? 'builtin' : 'user'}:${roleName || 'unknown'}:${promptFile}`;
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    // For builtin roles, check for user override first
    if (isBuiltin && roleName) {
      const overridePath = path.join(this.userRolesDir, roleName, 'prompt.md');
      try {
        const content = await fs.readFile(overridePath, 'utf-8');
        this.promptCache.set(cacheKey, content);
        return content;
      } catch {
        // No override, continue to load builtin
      }
    }

    const dir = isBuiltin ? this.builtinRolesDir : this.userRolesDir;
    // For built-in roles, load from subdirectory; for user roles, use subdirectory too
    const promptPath = roleName
      ? path.join(dir, roleName, promptFile)
      : path.join(dir, promptFile);

    try {
      const content = await fs.readFile(promptPath, 'utf-8');
      this.promptCache.set(cacheKey, content);
      return content;
    } catch {
      return '';
    }
  }

  /**
   * Ensure the user roles directory exists
   */
  private async ensureUserRolesDir(): Promise<void> {
    try {
      await fs.mkdir(this.userRolesDir, { recursive: true });
    } catch {
      // Ignore if already exists
    }
  }

  /**
   * Generate a unique role ID
   *
   * @param name - The role name
   * @returns A unique ID
   */
  private generateRoleId(name: string): string {
    return `${this.sanitizeRoleName(name)}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Sanitize a role name for use in file names
   *
   * @param name - The role name
   * @returns The sanitized name
   */
  private sanitizeRoleName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Unset isDefault on all roles
   */
  private async unsetAllDefaults(): Promise<void> {
    for (const [id, role] of this.rolesCache.entries()) {
      if (role.isDefault) {
        const updatedRole = { ...role, isDefault: false, updatedAt: new Date().toISOString() };
        this.rolesCache.set(id, updatedRole);

        if (!role.isBuiltin) {
          const promptContent = await this.loadPromptContent(role.systemPromptFile, false);
          await this.saveRole(updatedRole, promptContent);
        }
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let roleServiceInstance: RoleService | null = null;

/**
 * Get the singleton RoleService instance
 *
 * @returns The RoleService instance
 */
export function getRoleService(): RoleService {
  if (!roleServiceInstance) {
    roleServiceInstance = new RoleService();
  }
  return roleServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRoleService(): void {
  roleServiceInstance = null;
}
