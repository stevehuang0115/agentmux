import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AssignmentFilters } from './AssignmentFilters';
import { Assignment } from './types';

const mockAssignments: Assignment[] = [
  {
    id: '1',
    title: 'Test Assignment 1',
    description: 'Description 1',
    status: 'todo',
    priority: 'high',
    teamId: 'team-1',
    teamName: 'Team Alpha',
    createdAt: '2023-01-01',
    tags: []
  },
  {
    id: '2',
    title: 'Test Assignment 2',
    description: 'Description 2',
    status: 'in-progress',
    priority: 'medium',
    teamId: 'team-2',
    teamName: 'Team Beta',
    createdAt: '2023-01-02',
    tags: []
  }
];

describe('AssignmentFilters', () => {
  const mockOnStatusChange = vi.fn();
  const mockOnTeamChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render status and team filter dropdowns', () => {
    render(
      <AssignmentFilters
        filterStatus="all"
        filterTeam="all"
        assignments={mockAssignments}
        onStatusChange={mockOnStatusChange}
        onTeamChange={mockOnTeamChange}
      />
    );

    expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Teams')).toBeInTheDocument();
  });

  it('should call onStatusChange when status filter changes', () => {
    render(
      <AssignmentFilters
        filterStatus="all"
        filterTeam="all"
        assignments={mockAssignments}
        onStatusChange={mockOnStatusChange}
        onTeamChange={mockOnTeamChange}
      />
    );

    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'in-progress' } });

    expect(mockOnStatusChange).toHaveBeenCalledWith('in-progress');
  });

  it('should call onTeamChange when team filter changes', () => {
    render(
      <AssignmentFilters
        filterStatus="all"
        filterTeam="all"
        assignments={mockAssignments}
        onStatusChange={mockOnStatusChange}
        onTeamChange={mockOnTeamChange}
      />
    );

    const teamSelect = screen.getByDisplayValue('All Teams');
    fireEvent.change(teamSelect, { target: { value: 'Team Alpha' } });

    expect(mockOnTeamChange).toHaveBeenCalledWith('Team Alpha');
  });

  it('should display unique team names as options', () => {
    render(
      <AssignmentFilters
        filterStatus="all"
        filterTeam="all"
        assignments={mockAssignments}
        onStatusChange={mockOnStatusChange}
        onTeamChange={mockOnTeamChange}
      />
    );

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });
});