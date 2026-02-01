/**
 * Tests for SkillsTab Component
 *
 * @module components/Settings/SkillsTab.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SkillsTab } from './SkillsTab';
import * as useSkillsHook from '../../hooks/useSkills';

describe('SkillsTab', () => {
  const mockSkills = [
    {
      id: 'file-operations',
      name: 'file-operations',
      displayName: 'File Operations',
      description: 'Read, write, and manage files',
      type: 'builtin' as const,
      isEnabled: true,
    },
    {
      id: 'git-operations',
      name: 'git-operations',
      displayName: 'Git Operations',
      description: 'Perform git version control operations',
      type: 'builtin' as const,
      isEnabled: true,
    },
    {
      id: 'browser-automation',
      name: 'browser-automation',
      displayName: 'Browser Automation',
      description: 'Control web browsers programmatically',
      type: 'builtin' as const,
      isEnabled: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useSkillsHook, 'useSkills').mockReturnValue({
      skills: mockSkills,
      isLoading: false,
      error: null,
      refreshSkills: vi.fn(),
    });
  });

  describe('Rendering', () => {
    it('should render skills management header', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Skills Management')).toBeInTheDocument();
    });

    it('should show coming soon badge', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Coming in Sprint 2')).toBeInTheDocument();
    });

    it('should render info section', () => {
      render(<SkillsTab />);

      expect(screen.getByText(/Skills define what capabilities/)).toBeInTheDocument();
    });

    it('should render Available Skills section', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Available Skills')).toBeInTheDocument();
    });

    it('should render upcoming features section', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Upcoming Features')).toBeInTheDocument();
    });
  });

  describe('Skills List', () => {
    it('should render all skills', () => {
      render(<SkillsTab />);

      expect(screen.getByText('File Operations')).toBeInTheDocument();
      expect(screen.getByText('Git Operations')).toBeInTheDocument();
      expect(screen.getByText('Browser Automation')).toBeInTheDocument();
    });

    it('should show skill descriptions', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Read, write, and manage files')).toBeInTheDocument();
      expect(screen.getByText('Perform git version control operations')).toBeInTheDocument();
    });

    it('should show skill types', () => {
      render(<SkillsTab />);

      const builtinBadges = screen.getAllByText('builtin');
      expect(builtinBadges.length).toBe(3);
    });

    it('should show enabled status for enabled skills', () => {
      render(<SkillsTab />);

      const enabledBadges = screen.getAllByText('Enabled');
      expect(enabledBadges.length).toBe(2); // File Operations and Git Operations
    });

    it('should show disabled status for disabled skills', () => {
      render(<SkillsTab />);

      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  describe('Upcoming Features', () => {
    it('should list upcoming features', () => {
      render(<SkillsTab />);

      expect(screen.getByText(/Create custom skills/)).toBeInTheDocument();
      expect(screen.getByText(/Enable\/disable skills/)).toBeInTheDocument();
      expect(screen.getByText(/Configure skill execution/)).toBeInTheDocument();
      expect(screen.getByText(/Import skills/)).toBeInTheDocument();
      expect(screen.getByText(/Skill execution history/)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading state', () => {
      vi.spyOn(useSkillsHook, 'useSkills').mockReturnValue({
        skills: null,
        isLoading: true,
        error: null,
        refreshSkills: vi.fn(),
      });

      render(<SkillsTab />);

      expect(screen.getByText('Loading skills...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state', () => {
      vi.spyOn(useSkillsHook, 'useSkills').mockReturnValue({
        skills: null,
        isLoading: false,
        error: 'Failed to load skills',
        refreshSkills: vi.fn(),
      });

      render(<SkillsTab />);

      expect(screen.getByText(/Error loading skills/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no skills', () => {
      vi.spyOn(useSkillsHook, 'useSkills').mockReturnValue({
        skills: [],
        isLoading: false,
        error: null,
        refreshSkills: vi.fn(),
      });

      render(<SkillsTab />);

      expect(screen.getByText('No skills configured yet.')).toBeInTheDocument();
    });
  });
});
