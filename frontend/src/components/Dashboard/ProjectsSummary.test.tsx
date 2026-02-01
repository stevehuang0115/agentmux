/**
 * ProjectsSummary Component Tests
 *
 * @module components/Dashboard/ProjectsSummary.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectsSummary } from './ProjectsSummary';
import * as useProjectsHook from '../../hooks/useProjects';

// Mock the useProjects hook
vi.mock('../../hooks/useProjects');

describe('ProjectsSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should show loading state', () => {
    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary />);

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: [],
      loading: false,
      error: 'Failed to load',
      refresh: vi.fn(),
    });

    render(<ProjectsSummary />);

    expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary />);

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('should render projects list', () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project Alpha', status: 'active' },
      { id: 'proj-2', name: 'Project Beta', status: 'paused' },
    ];

    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: mockProjects as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary />);

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // count badge
  });

  it('should limit projects in compact mode', () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project 1', status: 'active' },
      { id: 'proj-2', name: 'Project 2', status: 'active' },
      { id: 'proj-3', name: 'Project 3', status: 'active' },
      { id: 'proj-4', name: 'Project 4', status: 'active' },
      { id: 'proj-5', name: 'Project 5', status: 'active' },
      { id: 'proj-6', name: 'Project 6', status: 'active' },
      { id: 'proj-7', name: 'Project 7', status: 'active' },
    ];

    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: mockProjects as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary compact />);

    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 5')).toBeInTheDocument();
    expect(screen.queryByText('Project 6')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('should call onProjectClick when project is clicked', () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project Alpha', status: 'active' },
    ];
    const handleClick = vi.fn();

    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: mockProjects as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary onProjectClick={handleClick} />);

    fireEvent.click(screen.getByText('Project Alpha'));

    expect(handleClick).toHaveBeenCalledWith('proj-1');
  });

  it('should handle keyboard navigation', () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project Alpha', status: 'active' },
    ];
    const handleClick = vi.fn();

    vi.mocked(useProjectsHook.useProjects).mockReturnValue({
      projects: mockProjects as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<ProjectsSummary onProjectClick={handleClick} />);

    const item = screen.getByText('Project Alpha').closest('li');
    fireEvent.keyDown(item!, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledWith('proj-1');
  });
});
