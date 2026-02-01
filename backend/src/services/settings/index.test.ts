/**
 * Settings Services Index Tests
 *
 * Tests for the settings services module exports.
 *
 * @module services/settings/index.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  RoleService,
  getRoleService,
  resetRoleService,
  RoleNotFoundError,
  RoleValidationError,
  BuiltinRoleModificationError,
  DuplicateRoleNameError,
  SettingsService,
  getSettingsService,
  resetSettingsService,
  SettingsValidationError,
  SettingsFileError,
} from './index.js';

describe('Settings Services Index', () => {
  describe('Role Service Exports', () => {
    it('should export RoleService class', () => {
      expect(RoleService).toBeDefined();
      expect(typeof RoleService).toBe('function');
    });

    it('should export getRoleService function', () => {
      expect(getRoleService).toBeDefined();
      expect(typeof getRoleService).toBe('function');
    });

    it('should export resetRoleService function', () => {
      expect(resetRoleService).toBeDefined();
      expect(typeof resetRoleService).toBe('function');
    });

    it('should export RoleNotFoundError class', () => {
      expect(RoleNotFoundError).toBeDefined();
      const error = new RoleNotFoundError('test-id');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RoleNotFoundError');
    });

    it('should export RoleValidationError class', () => {
      expect(RoleValidationError).toBeDefined();
      const error = new RoleValidationError(['error1', 'error2']);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RoleValidationError');
    });

    it('should export BuiltinRoleModificationError class', () => {
      expect(BuiltinRoleModificationError).toBeDefined();
      const error = new BuiltinRoleModificationError('delete');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BuiltinRoleModificationError');
    });

    it('should export DuplicateRoleNameError class', () => {
      expect(DuplicateRoleNameError).toBeDefined();
      const error = new DuplicateRoleNameError('developer');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DuplicateRoleNameError');
    });
  });

  describe('Settings Service Exports', () => {
    it('should export SettingsService class', () => {
      expect(SettingsService).toBeDefined();
      expect(typeof SettingsService).toBe('function');
    });

    it('should export getSettingsService function', () => {
      expect(getSettingsService).toBeDefined();
      expect(typeof getSettingsService).toBe('function');
    });

    it('should export resetSettingsService function', () => {
      expect(resetSettingsService).toBeDefined();
      expect(typeof resetSettingsService).toBe('function');
    });

    it('should export SettingsValidationError class', () => {
      expect(SettingsValidationError).toBeDefined();
      const error = new SettingsValidationError(['error1']);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SettingsValidationError');
    });

    it('should export SettingsFileError class', () => {
      expect(SettingsFileError).toBeDefined();
      const error = new SettingsFileError('read', 'path/to/file');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SettingsFileError');
    });
  });
});
