/**
 * Skills Service Tests
 *
 * Tests for the frontend skills service API calls.
 *
 * @module services/skills.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
  getSkillsByCategory,
  getSkillsForRole,
} from './skills.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('skills.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getSkills', () => {
    it('should fetch all skills', async () => {
      const mockSkills = [
        { id: 'skill-1', name: 'test-skill', displayName: 'Test Skill' },
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkills }),
      });

      const result = await getSkills();

      expect(mockFetch).toHaveBeenCalledWith('/api/skills');
      expect(result).toEqual(mockSkills);
    });

    it('should include query params when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await getSkills({ category: 'development', search: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test')
      );
    });

    it('should throw on error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(getSkills()).rejects.toThrow('Failed to fetch skills');
    });
  });

  describe('getSkillById', () => {
    it('should fetch skill by id', async () => {
      const mockSkill = { id: 'skill-1', name: 'Test Skill', promptContent: 'Test' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkill }),
      });

      const result = await getSkillById('skill-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/skills/skill-1');
      expect(result).toEqual(mockSkill);
    });

    it('should throw on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(getSkillById('missing')).rejects.toThrow('Skill not found');
    });
  });

  describe('createSkill', () => {
    it('should create a new skill', async () => {
      const newSkill = {
        name: 'new-skill',
        displayName: 'New Skill',
        description: 'Test',
        category: 'development' as const,
      };
      const createdSkill = { id: 'skill-1', ...newSkill };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: createdSkill }),
      });

      const result = await createSkill(newSkill);

      expect(mockFetch).toHaveBeenCalledWith('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkill),
      });
      expect(result).toEqual(createdSkill);
    });

    it('should throw on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Validation error'),
      });

      await expect(createSkill({
        name: 'test',
        displayName: 'Test',
        description: 'Test',
        category: 'development',
      })).rejects.toThrow('Failed to create skill');
    });
  });

  describe('updateSkill', () => {
    it('should update an existing skill', async () => {
      const updates = { displayName: 'Updated Skill' };
      const updatedSkill = { id: 'skill-1', name: 'skill-1', ...updates };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: updatedSkill }),
      });

      const result = await updateSkill('skill-1', updates);

      expect(mockFetch).toHaveBeenCalledWith('/api/skills/skill-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      expect(result).toEqual(updatedSkill);
    });
  });

  describe('deleteSkill', () => {
    it('should delete a skill', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      await deleteSkill('skill-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/skills/skill-1', {
        method: 'DELETE',
      });
    });

    it('should throw on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(deleteSkill('missing')).rejects.toThrow('Failed to delete skill');
    });
  });

  describe('executeSkill', () => {
    it('should execute skill with context', async () => {
      const mockResult = { success: true, output: 'Done' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await executeSkill('skill-1', { input: 'test' });

      expect(mockFetch).toHaveBeenCalledWith('/api/skills/skill-1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { input: 'test' } }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should execute skill without context', async () => {
      const mockResult = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await executeSkill('skill-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/skills/skill-1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: undefined }),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getSkillsByCategory', () => {
    it('should fetch skills by category', async () => {
      const mockSkills = [{ id: 'skill-1', category: 'development' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkills }),
      });

      const result = await getSkillsByCategory('development');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development')
      );
      expect(result).toEqual(mockSkills);
    });
  });

  describe('getSkillsForRole', () => {
    it('should fetch skills for role', async () => {
      const mockSkills = [{ id: 'skill-1' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkills }),
      });

      const result = await getSkillsForRole('developer');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('roleId=developer')
      );
      expect(result).toEqual(mockSkills);
    });
  });
});
