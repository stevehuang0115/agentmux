/**
 * KnowledgeScopeToggle Component Tests
 *
 * Tests for the scope toggle component that switches between
 * Global and Project scopes, with an optional project dropdown.
 *
 * @module components/Knowledge/KnowledgeScopeToggle.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeScopeToggle } from './KnowledgeScopeToggle';
import type { Project } from '../../types';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Globe: () => <svg data-testid="globe-icon" />,
  FolderOpen: () => <svg data-testid="folder-open-icon" />,
}));

/**
 * Create a mock project object for testing.
 *
 * @param overrides - Partial overrides for the default mock project
 * @returns A complete Project object
 */
function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Test Project',
    path: '/home/user/projects/test',
    teams: {},
    ...overrides,
  };
}

describe('KnowledgeScopeToggle', () => {
  const defaultProps = {
    scope: 'global' as const,
    onScopeChange: vi.fn(),
    projects: [] as Project[],
    selectedProjectPath: '',
    onProjectChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render Global and Project buttons', () => {
      render(<KnowledgeScopeToggle {...defaultProps} />);

      expect(screen.getByText('Global')).toBeInTheDocument();
      expect(screen.getByText('Project')).toBeInTheDocument();
    });

    it('should render Global and Project as tabs', () => {
      render(<KnowledgeScopeToggle {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /global/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /project/i })).toBeInTheDocument();
    });

    it('should render the tab list with appropriate label', () => {
      render(<KnowledgeScopeToggle {...defaultProps} />);

      expect(screen.getByRole('tablist', { name: /document scope/i })).toBeInTheDocument();
    });

    it('should render Globe icon for Global button', () => {
      render(<KnowledgeScopeToggle {...defaultProps} />);

      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });

    it('should render FolderOpen icon for Project button', () => {
      render(<KnowledgeScopeToggle {...defaultProps} />);

      expect(screen.getByTestId('folder-open-icon')).toBeInTheDocument();
    });
  });

  describe('Scope Selection', () => {
    it('should mark Global tab as selected when scope is global', () => {
      render(<KnowledgeScopeToggle {...defaultProps} scope="global" />);

      const globalTab = screen.getByRole('tab', { name: /global/i });
      const projectTab = screen.getByRole('tab', { name: /project/i });

      expect(globalTab).toHaveAttribute('aria-selected', 'true');
      expect(projectTab).toHaveAttribute('aria-selected', 'false');
    });

    it('should mark Project tab as selected when scope is project', () => {
      render(<KnowledgeScopeToggle {...defaultProps} scope="project" />);

      const globalTab = screen.getByRole('tab', { name: /global/i });
      const projectTab = screen.getByRole('tab', { name: /project/i });

      expect(globalTab).toHaveAttribute('aria-selected', 'false');
      expect(projectTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should call onScopeChange with "global" when Global is clicked', () => {
      const onScopeChange = vi.fn();
      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          onScopeChange={onScopeChange}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: /global/i }));

      expect(onScopeChange).toHaveBeenCalledTimes(1);
      expect(onScopeChange).toHaveBeenCalledWith('global');
    });

    it('should call onScopeChange with "project" when Project is clicked', () => {
      const onScopeChange = vi.fn();
      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="global"
          onScopeChange={onScopeChange}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: /project/i }));

      expect(onScopeChange).toHaveBeenCalledTimes(1);
      expect(onScopeChange).toHaveBeenCalledWith('project');
    });
  });

  describe('Project Dropdown', () => {
    it('should show project dropdown when scope is "project"', () => {
      const projects = [
        createMockProject({ id: 'p1', name: 'Alpha', path: '/alpha' }),
        createMockProject({ id: 'p2', name: 'Beta', path: '/beta' }),
      ];

      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          projects={projects}
        />,
      );

      const select = screen.getByRole('combobox', { name: /select project/i });
      expect(select).toBeInTheDocument();
    });

    it('should hide project dropdown when scope is "global"', () => {
      const projects = [
        createMockProject({ id: 'p1', name: 'Alpha', path: '/alpha' }),
      ];

      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="global"
          projects={projects}
        />,
      );

      expect(screen.queryByRole('combobox', { name: /select project/i })).not.toBeInTheDocument();
    });

    it('should render project options in the dropdown', () => {
      const projects = [
        createMockProject({ id: 'p1', name: 'Alpha', path: '/alpha' }),
        createMockProject({ id: 'p2', name: 'Beta', path: '/beta' }),
      ];

      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          projects={projects}
        />,
      );

      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('should render placeholder option in the dropdown', () => {
      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          projects={[createMockProject()]}
        />,
      );

      expect(screen.getByText('Select a project...')).toBeInTheDocument();
    });

    it('should call onProjectChange when a project is selected', () => {
      const onProjectChange = vi.fn();
      const projects = [
        createMockProject({ id: 'p1', name: 'Alpha', path: '/alpha' }),
        createMockProject({ id: 'p2', name: 'Beta', path: '/beta' }),
      ];

      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          projects={projects}
          onProjectChange={onProjectChange}
        />,
      );

      const select = screen.getByRole('combobox', { name: /select project/i });
      fireEvent.change(select, { target: { value: '/beta' } });

      expect(onProjectChange).toHaveBeenCalledTimes(1);
      expect(onProjectChange).toHaveBeenCalledWith('/beta');
    });

    it('should set selected value to the selectedProjectPath prop', () => {
      const projects = [
        createMockProject({ id: 'p1', name: 'Alpha', path: '/alpha' }),
        createMockProject({ id: 'p2', name: 'Beta', path: '/beta' }),
      ];

      render(
        <KnowledgeScopeToggle
          {...defaultProps}
          scope="project"
          projects={projects}
          selectedProjectPath="/beta"
        />,
      );

      const select = screen.getByRole('combobox', { name: /select project/i }) as HTMLSelectElement;
      expect(select.value).toBe('/beta');
    });
  });
});
