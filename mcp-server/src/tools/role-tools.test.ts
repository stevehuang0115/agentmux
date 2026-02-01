/**
 * Role Tools Tests
 *
 * Unit tests for the role management MCP tool handlers.
 *
 * @module tools/role-tools.test
 */

import { handleCreateRole, handleUpdateRole, handleListRoles } from './role-tools.js';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Role Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCreateRole', () => {
    it('should create a role successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'role-123',
              name: 'api-developer',
              displayName: 'API Developer',
              category: 'development',
            },
          }),
      });

      const result = await handleCreateRole({
        name: 'api-developer',
        displayName: 'API Developer',
        description: 'Specializes in RESTful API development',
        category: 'development',
        systemPromptContent: '# API Developer\nYou are an expert API developer...',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('API Developer');
      expect(result.role).toBeDefined();
      expect((result.role as Record<string, unknown>).id).toBe('role-123');
    });

    it('should handle creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: 'Role name already exists',
          }),
      });

      const result = await handleCreateRole({
        name: 'existing-role',
        displayName: 'Existing Role',
        description: 'A role that already exists',
        category: 'development',
        systemPromptContent: '# Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await handleCreateRole({
        name: 'test-role',
        displayName: 'Test Role',
        description: 'A test role',
        category: 'development',
        systemPromptContent: '# Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should pass assigned skills in the request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'role-123',
              name: 'skilled-developer',
              displayName: 'Skilled Developer',
              category: 'development',
            },
          }),
      });

      await handleCreateRole({
        name: 'skilled-developer',
        displayName: 'Skilled Developer',
        description: 'A developer with skills',
        category: 'development',
        systemPromptContent: '# Skilled Developer',
        assignedSkills: ['skill-1', 'skill-2'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('skill-1'),
        })
      );
    });
  });

  describe('handleUpdateRole', () => {
    it('should update a role successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'role-123',
              name: 'api-developer',
              displayName: 'Senior API Developer',
            },
          }),
      });

      const result = await handleUpdateRole({
        roleId: 'role-123',
        displayName: 'Senior API Developer',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Senior API Developer');
    });

    it('should handle update failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: () =>
          Promise.resolve({
            error: 'Role not found',
          }),
      });

      const result = await handleUpdateRole({
        roleId: 'non-existent',
        displayName: 'New Name',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should only send provided fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'role-123',
              name: 'test-role',
              displayName: 'Test Role',
            },
          }),
      });

      await handleUpdateRole({
        roleId: 'role-123',
        description: 'Updated description',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toHaveProperty('description');
      expect(callBody).not.toHaveProperty('displayName');
      expect(callBody).not.toHaveProperty('category');
    });
  });

  describe('handleListRoles', () => {
    it('should list all roles', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'role-1',
                name: 'developer',
                displayName: 'Developer',
                description: 'A developer role',
                category: 'development',
                skillCount: 5,
                isBuiltin: true,
              },
              {
                id: 'role-2',
                name: 'qa',
                displayName: 'QA Engineer',
                description: 'A QA role',
                category: 'quality',
                skillCount: 3,
                isBuiltin: false,
              },
            ],
          }),
      });

      const result = await handleListRoles({});

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(Array.isArray(result.roles)).toBe(true);
    });

    it('should filter by category', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'role-1',
                name: 'developer',
                displayName: 'Developer',
                category: 'development',
              },
            ],
          }),
      });

      await handleListRoles({ category: 'development' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development'),
        expect.any(Object)
      );
    });

    it('should filter by search term', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      await handleListRoles({ search: 'api' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=api'),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [],
          }),
      });

      const result = await handleListRoles({ search: 'nonexistent' });

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.roles).toEqual([]);
    });

    it('should handle list failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: () =>
          Promise.resolve({
            error: 'Database error',
          }),
      });

      const result = await handleListRoles({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
