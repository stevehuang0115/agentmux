/**
 * Tests for SkillsTab Component
 *
 * @module components/Settings/SkillsTab.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillsTab } from './SkillsTab';
import * as useSkillsHook from '../../hooks/useSkills';
import type { SkillSummary } from '../../types/skill.types';

// Mock the useSkills hook
vi.mock('../../hooks/useSkills');

describe('SkillsTab', () => {
  const mockSkills: SkillSummary[] = [
    {
      id: 'file-operations',
      name: 'file-operations',
      description: 'Read, write, and manage files',
      category: 'development',
      executionType: 'script',
      triggerCount: 3,
      roleCount: 2,
      isBuiltin: true,
      isEnabled: true,
    },
    {
      id: 'git-operations',
      name: 'git-operations',
      description: 'Perform git version control operations',
      category: 'development',
      executionType: 'script',
      triggerCount: 5,
      roleCount: 3,
      isBuiltin: true,
      isEnabled: true,
    },
    {
      id: 'browser-automation',
      name: 'browser-automation',
      description: 'Control web browsers programmatically',
      category: 'automation',
      executionType: 'browser',
      triggerCount: 2,
      roleCount: 1,
      isBuiltin: false,
      isEnabled: false,
    },
  ];

  const mockHookResult = {
    skills: mockSkills,
    selectedSkill: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    selectSkill: vi.fn(),
    clearSelection: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    execute: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSkillsHook.useSkills).mockReturnValue(mockHookResult);
  });

  describe('Rendering', () => {
    it('should render skills management header', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Skills Management')).toBeInTheDocument();
    });

    it('should render New Skill button', () => {
      render(<SkillsTab />);

      expect(screen.getByText('+ New Skill')).toBeInTheDocument();
    });

    it('should render category filter', () => {
      render(<SkillsTab />);

      expect(screen.getByLabelText('Category')).toBeInTheDocument();
    });

    it('should render search filter', () => {
      render(<SkillsTab />);

      expect(screen.getByPlaceholderText('Search skills...')).toBeInTheDocument();
    });

    it('should render refresh button', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('Skills List', () => {
    it('should render all skills in grid', () => {
      render(<SkillsTab />);

      expect(screen.getByText('file-operations')).toBeInTheDocument();
      expect(screen.getByText('git-operations')).toBeInTheDocument();
      expect(screen.getByText('browser-automation')).toBeInTheDocument();
    });

    it('should show skill descriptions', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Read, write, and manage files')).toBeInTheDocument();
      expect(screen.getByText('Perform git version control operations')).toBeInTheDocument();
    });

    it('should show category badges', () => {
      render(<SkillsTab />);

      // 2 skill cards + 1 in category filter dropdown = 3 total
      const devBadges = screen.getAllByText('Development');
      expect(devBadges.length).toBe(3);
      // 1 skill card + 1 in category filter dropdown = 2 total
      const automationBadges = screen.getAllByText('Automation');
      expect(automationBadges.length).toBe(2);
    });

    it('should show execution type', () => {
      render(<SkillsTab />);

      const scriptBadges = screen.getAllByText('script');
      expect(scriptBadges.length).toBe(2);
      expect(screen.getByText('browser')).toBeInTheDocument();
    });

    it('should show enabled status for enabled skills', () => {
      render(<SkillsTab />);

      const enabledBadges = screen.getAllByText('Enabled');
      expect(enabledBadges.length).toBe(2);
    });

    it('should show disabled status for disabled skills', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    it('should show built-in badge for builtin skills', () => {
      render(<SkillsTab />);

      const builtinBadges = screen.getAllByText('Built-in');
      expect(builtinBadges.length).toBe(2);
    });
  });

  describe('Loading State', () => {
    it('should show loading state', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        skills: [],
        loading: true,
      });

      render(<SkillsTab />);

      expect(screen.getByText('Loading skills...')).toBeInTheDocument();
    });

    it('should show Refreshing button text when loading', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        loading: true,
      });

      render(<SkillsTab />);

      expect(screen.getByText('Refreshing...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error banner', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        skills: [],
        error: 'Failed to load skills',
      });

      render(<SkillsTab />);

      expect(screen.getByText('Error: Failed to load skills')).toBeInTheDocument();
    });

    it('should show retry button in error banner', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        skills: [],
        error: 'Failed to load skills',
      });

      render(<SkillsTab />);

      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no skills', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        skills: [],
      });

      render(<SkillsTab />);

      expect(screen.getByText('No Skills Found')).toBeInTheDocument();
    });

    it('should show filter hint when filtered with no results', () => {
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        skills: [],
      });

      render(<SkillsTab />);

      const searchInput = screen.getByPlaceholderText('Search skills...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call refresh when refresh button is clicked', () => {
      render(<SkillsTab />);

      fireEvent.click(screen.getByText('Refresh'));

      expect(mockHookResult.refresh).toHaveBeenCalled();
    });

    it('should open create modal when New Skill button is clicked', () => {
      render(<SkillsTab />);

      fireEvent.click(screen.getByText('+ New Skill'));

      expect(screen.getByText('Create Skill')).toBeInTheDocument();
    });

    it('should open edit modal when edit button is clicked', () => {
      render(<SkillsTab />);

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      expect(screen.getByText('Edit Skill')).toBeInTheDocument();
    });

    it('should open delete confirmation when delete button is clicked', () => {
      render(<SkillsTab />);

      const deleteButtons = screen.getAllByTitle('Delete');
      fireEvent.click(deleteButtons[0]);

      expect(screen.getByText('Delete Skill')).toBeInTheDocument();
    });

    it('should not show delete button for builtin skills', () => {
      render(<SkillsTab />);

      // Only non-builtin skills should have delete button
      const deleteButtons = screen.getAllByTitle('Delete');
      expect(deleteButtons.length).toBe(1); // Only browser-automation is not builtin
    });
  });

  describe('Create Modal', () => {
    it('should close modal when Cancel is clicked', () => {
      render(<SkillsTab />);

      fireEvent.click(screen.getByText('+ New Skill'));
      expect(screen.getByText('Create Skill')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Create Skill')).not.toBeInTheDocument();
    });

    it('should show form validation error for empty name', async () => {
      render(<SkillsTab />);

      fireEvent.click(screen.getByText('+ New Skill'));
      fireEvent.click(screen.getByText('Save Skill'));

      // HTML5 validation prevents submission
      expect(screen.getByText('Create Skill')).toBeInTheDocument();
    });

    it('should call create when form is submitted', async () => {
      const createMock = vi.fn().mockResolvedValue({});
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        create: createMock,
      });

      render(<SkillsTab />);

      fireEvent.click(screen.getByText('+ New Skill'));

      const displayNameInput = screen.getByLabelText('Display Name *');
      fireEvent.change(displayNameInput, { target: { value: 'New Skill' } });

      const idInput = screen.getByLabelText('ID *');
      fireEvent.change(idInput, { target: { value: 'new-skill' } });

      const descInput = screen.getByLabelText('Description *');
      fireEvent.change(descInput, { target: { value: 'A new skill' } });

      fireEvent.click(screen.getByText('Save Skill'));

      await waitFor(() => {
        expect(createMock).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Confirmation', () => {
    it('should call remove when delete is confirmed', async () => {
      const removeMock = vi.fn().mockResolvedValue({});
      vi.mocked(useSkillsHook.useSkills).mockReturnValue({
        ...mockHookResult,
        remove: removeMock,
      });

      render(<SkillsTab />);

      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete Skill')).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(removeMock).toHaveBeenCalledWith('browser-automation');
      });
    });

    it('should close modal when cancel is clicked', () => {
      render(<SkillsTab />);

      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);

      expect(screen.getByText('Delete Skill')).toBeInTheDocument();

      fireEvent.click(screen.getAllByText('Cancel')[0]);

      expect(screen.queryByText('Delete Skill')).not.toBeInTheDocument();
    });
  });
});
