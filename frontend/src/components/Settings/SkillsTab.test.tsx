/**
 * SkillsTab Component Tests
 *
 * @module components/Settings/SkillsTab.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillsTab } from './SkillsTab';
import * as useSkillsModule from '../../hooks/useSkills';
import type { SkillSummary, SkillCategory } from '../../types/skill.types';

vi.mock('../../hooks/useSkills');

describe('SkillsTab', () => {
  const mockSkills: SkillSummary[] = [
    {
      id: 'skill-1',
      name: 'Code Review',
      description: 'Review code for quality',
      category: 'development' as SkillCategory,
      executionType: 'prompt-only',
      triggerCount: 2,
      roleCount: 3,
      isBuiltin: true,
      isEnabled: true,
    },
    {
      id: 'skill-2',
      name: 'UI Design',
      description: 'Design user interfaces',
      category: 'design' as SkillCategory,
      executionType: 'browser',
      triggerCount: 1,
      roleCount: 1,
      isBuiltin: false,
      isEnabled: true,
    },
  ];

  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should show loading state', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: [],
      selectedSkill: null,
      loading: true,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText('Loading skills...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: [],
      selectedSkill: null,
      loading: false,
      error: 'Failed to load',
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText(/Error loading skills/)).toBeInTheDocument();
  });

  it('should render skills list', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('UI Design')).toBeInTheDocument();
    expect(screen.getByText('Review code for quality')).toBeInTheDocument();
    expect(screen.getByText('Design user interfaces')).toBeInTheDocument();
  });

  it('should show skill counts and categories', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText('Available Skills (2)')).toBeInTheDocument();
    expect(screen.getByText('3 roles')).toBeInTheDocument();
    expect(screen.getByText('1 role')).toBeInTheDocument();
  });

  it('should show empty state when no skills', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: [],
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText('No skills configured yet.')).toBeInTheDocument();
  });

  it('should show filter message when no results', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: [],
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    // Type in search box to trigger filter
    const searchInput = screen.getByPlaceholderText('Search skills...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText('No skills match your filters.')).toBeInTheDocument();
  });

  it('should call refresh when button clicked', async () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('should filter by category', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    const categorySelect = screen.getByLabelText('Category:');
    fireEvent.change(categorySelect, { target: { value: 'development' } });

    // The hook should be called with the new category
    expect(useSkillsModule.useSkills).toHaveBeenCalledWith({
      category: 'development',
      search: undefined,
    });
  });

  it('should show builtin and custom badges', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('should show enabled status', () => {
    vi.mocked(useSkillsModule.useSkills).mockReturnValue({
      skills: mockSkills,
      selectedSkill: null,
      loading: false,
      error: null,
      refresh: mockRefresh,
      selectSkill: vi.fn(),
      clearSelection: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      execute: vi.fn(),
    });

    render(<SkillsTab />);

    const enabledIndicators = screen.getAllByText('Enabled');
    expect(enabledIndicators.length).toBe(2);
  });
});
