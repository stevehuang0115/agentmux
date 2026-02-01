/**
 * ProjectsSummary Component Tests
 *
 * @module components/Dashboard/ProjectsSummary.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectsSummary } from './ProjectsSummary';
import * as useProjectsModule from '../../hooks/useProjects';
import type { Project } from '../../types';

vi.mock('../../hooks/useProjects');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProjectsSummary', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Project One',
      description: 'Description 1',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'project-2',
      name: 'Project Two',
      description: 'Description 2',
      status: 'inactive',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'project-3',
      name: 'Project Three',
      description: 'Description 3',
      status: 'active',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ];

  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  it('should show loading state', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: [],
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    expect(screen.getByTestId('projects-summary-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: [],
      loading: false,
      error: 'Failed to load',
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    expect(screen.getByTestId('projects-summary-error')).toBeInTheDocument();
    expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
  });

  it('should show empty state when no projects', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    expect(screen.getByTestId('projects-empty')).toBeInTheDocument();
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('should render projects list', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: mockProjects,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
    expect(screen.getByText('Project Three')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // count badge
  });

  it('should navigate to project on click', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: mockProjects,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    fireEvent.click(screen.getByTestId('project-item-project-1'));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/project-1');
  });

  it('should show limited items in compact mode', () => {
    const manyProjects = Array.from({ length: 8 }, (_, i) => ({
      id: `project-${i + 1}`,
      name: `Project ${i + 1}`,
      description: `Description ${i + 1}`,
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }));

    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: manyProjects,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary compact maxItems={5} />);

    // Should show 5 projects + "more" link
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Project 5')).toBeInTheDocument();
    expect(screen.queryByText('Project 6')).not.toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('should navigate to projects page on "more" click', () => {
    const manyProjects = Array.from({ length: 8 }, (_, i) => ({
      id: `project-${i + 1}`,
      name: `Project ${i + 1}`,
      description: `Description ${i + 1}`,
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }));

    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: manyProjects,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary compact maxItems={5} />);

    fireEvent.click(screen.getByTestId('projects-view-more'));

    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('should show status indicators', () => {
    vi.mocked(useProjectsModule.useProjects).mockReturnValue({
      projects: mockProjects,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<ProjectsSummary />);

    const activeStatus = screen.getAllByLabelText('Status: active');
    const inactiveStatus = screen.getAllByLabelText('Status: inactive');

    expect(activeStatus.length).toBe(2);
    expect(inactiveStatus.length).toBe(1);
  });
});
