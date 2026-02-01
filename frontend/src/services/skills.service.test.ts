/**
 * Skills Service Tests
 *
 * @module services/skills.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSkills,
  getSkillById,
  getSkillWithPrompt,
  createSkill,
  updateSkill,
  deleteSkill,
  executeSkill,
  skillsService,
} from './skills.service';

describe('skills.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getSkills', () => {
    it('should fetch all skills', async () => {
      const mockSkills = [{ id: '1', name: 'test-skill' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkills }),
      });

      const result = await getSkills();

      expect(fetch).toHaveBeenCalledWith('/api/skills');
      expect(result).toEqual(mockSkills);
    });

    it('should include query params when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await getSkills({ category: 'development', search: 'test' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development')
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test')
      );
    });

    it('should filter by roleId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await getSkills({ roleId: 'role-1' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('roleId=role-1')
      );
    });

    it('should throw on error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      await expect(getSkills()).rejects.toThrow('Failed to fetch skills');
    });

    it('should return empty array when data is undefined', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getSkills();
      expect(result).toEqual([]);
    });
  });

  describe('getSkillById', () => {
    it('should fetch skill by id', async () => {
      const mockSkill = { id: 'skill-1', name: 'Test Skill' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkill }),
      });

      const result = await getSkillById('skill-1');

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1');
      expect(result).toEqual(mockSkill);
    });

    it('should throw on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(getSkillById('missing')).rejects.toThrow('Skill not found');
    });

    it('should throw on other errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getSkillById('skill-1')).rejects.toThrow('Failed to fetch skill');
    });

    it('should throw on missing data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await expect(getSkillById('skill-1')).rejects.toThrow('Invalid response');
    });
  });

  describe('getSkillWithPrompt', () => {
    it('should fetch skill with prompt content', async () => {
      const mockSkill = {
        id: 'skill-1',
        name: 'Test Skill',
        promptContent: 'Test prompt',
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockSkill }),
      });

      const result = await getSkillWithPrompt('skill-1');

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1/prompt');
      expect(result).toEqual(mockSkill);
    });

    it('should throw on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(getSkillWithPrompt('missing')).rejects.toThrow('Skill not found');
    });
  });

  describe('createSkill', () => {
    it('should create a new skill', async () => {
      const newSkill = {
        name: 'new-skill',
        description: 'Test',
        category: 'development' as const,
        promptContent: 'Prompt',
      };
      const createdSkill = { id: 'skill-1', ...newSkill };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: createdSkill }),
      });

      const result = await createSkill(newSkill);

      expect(fetch).toHaveBeenCalledWith('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkill),
      });
      expect(result).toEqual(createdSkill);
    });

    it('should throw with error message from API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Skill already exists' }),
      });

      await expect(
        createSkill({
          name: 'existing',
          description: 'Test',
          category: 'development',
          promptContent: 'Test',
        })
      ).rejects.toThrow('Skill already exists');
    });
  });

  describe('updateSkill', () => {
    it('should update a skill', async () => {
      const updates = { description: 'Updated' };
      const updatedSkill = { id: 'skill-1', ...updates };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: updatedSkill }),
      });

      const result = await updateSkill('skill-1', updates);

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      expect(result).toEqual(updatedSkill);
    });

    it('should throw on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.reject(),
      });

      await expect(updateSkill('skill-1', {})).rejects.toThrow('Failed to update skill');
    });
  });

  describe('deleteSkill', () => {
    it('should delete a skill', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
      });

      await expect(deleteSkill('skill-1')).resolves.toBeUndefined();

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1', {
        method: 'DELETE',
      });
    });

    it('should throw on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Cannot delete builtin skill' }),
      });

      await expect(deleteSkill('builtin')).rejects.toThrow('Cannot delete builtin skill');
    });
  });

  describe('executeSkill', () => {
    it('should execute skill with context', async () => {
      const mockResult = { success: true, output: 'Done' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      const result = await executeSkill('skill-1', { input: 'test' });

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { input: 'test' } }),
      });
      expect(result).toEqual(mockResult);
    });

    it('should execute skill without context', async () => {
      const mockResult = { success: true };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      });

      await executeSkill('skill-1');

      expect(fetch).toHaveBeenCalledWith('/api/skills/skill-1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: undefined }),
      });
    });

    it('should throw on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Error',
        json: () => Promise.resolve({ error: 'Execution failed' }),
      });

      await expect(executeSkill('skill-1')).rejects.toThrow('Execution failed');
    });

    it('should return default error result when data is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await executeSkill('skill-1');
      expect(result).toEqual({ success: false, error: 'Unknown error' });
    });
  });

  describe('skillsService object', () => {
    it('should expose all functions', () => {
      expect(skillsService.getAll).toBe(getSkills);
      expect(skillsService.getById).toBe(getSkillById);
      expect(skillsService.getWithPrompt).toBe(getSkillWithPrompt);
      expect(skillsService.create).toBe(createSkill);
      expect(skillsService.update).toBe(updateSkill);
      expect(skillsService.delete).toBe(deleteSkill);
      expect(skillsService.execute).toBe(executeSkill);
    });
  });
});
