/**
 * Settings Services
 *
 * Exports for role and application settings management services.
 *
 * @module services/settings
 */

// Role Service exports
export {
  RoleService,
  getRoleService,
  resetRoleService,
  RoleNotFoundError,
  RoleValidationError,
  BuiltinRoleModificationError,
  DuplicateRoleNameError,
} from './role.service.js';

// Settings Service exports
export {
  SettingsService,
  getSettingsService,
  resetSettingsService,
  SettingsValidationError,
  SettingsFileError,
} from './settings.service.js';
