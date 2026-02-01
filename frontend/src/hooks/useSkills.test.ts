/**
 * Tests for useSkills Hook
 *
 * @module hooks/useSkills.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSkills } from './useSkills';

describe('useSkills Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useSkills());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.skills).toBe(null);
    });

    it('should load skills on mount', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.skills).not.toBe(null);
      expect(result.current.skills?.length).toBeGreaterThan(0);
    });

    it('should have no error on successful load', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('Skills Data', () => {
    it('should return mock skills', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const skills = result.current.skills;
      expect(skills).toBeDefined();

      // Check structure of skills
      if (skills && skills.length > 0) {
        const skill = skills[0];
        expect(skill).toHaveProperty('id');
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('displayName');
        expect(skill).toHaveProperty('description');
        expect(skill).toHaveProperty('type');
        expect(skill).toHaveProperty('isEnabled');
      }
    });

    it('should include file operations skill', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const fileOpsSkill = result.current.skills?.find((s) => s.id === 'file-operations');
      expect(fileOpsSkill).toBeDefined();
      expect(fileOpsSkill?.displayName).toBe('File Operations');
    });

    it('should include git operations skill', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const gitOpsSkill = result.current.skills?.find((s) => s.id === 'git-operations');
      expect(gitOpsSkill).toBeDefined();
      expect(gitOpsSkill?.displayName).toBe('Git Operations');
    });
  });

  describe('refreshSkills', () => {
    it('should refresh skills', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialSkills = result.current.skills;

      await act(async () => {
        await result.current.refreshSkills();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Skills should be reloaded (same mock data)
      expect(result.current.skills).toBeDefined();
      expect(result.current.skills?.length).toBe(initialSkills?.length);
    });
  });

  describe('Skill Types', () => {
    it('should have builtin skills', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const builtinSkills = result.current.skills?.filter((s) => s.type === 'builtin');
      expect(builtinSkills?.length).toBeGreaterThan(0);
    });

    it('should have enabled skills', async () => {
      const { result } = renderHook(() => useSkills());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const enabledSkills = result.current.skills?.filter((s) => s.isEnabled);
      expect(enabledSkills?.length).toBeGreaterThan(0);
    });
  });
});
