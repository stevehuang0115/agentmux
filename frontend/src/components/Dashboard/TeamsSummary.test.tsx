/**
 * TeamsSummary Component Tests
 *
 * @module components/Dashboard/TeamsSummary.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TeamsSummary } from './TeamsSummary';
import * as useTeamsModule from '../../hooks/useTeams';
import type { Team } from '../../types';

vi.mock('../../hooks/useTeams');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TeamsSummary', () => {
  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Frontend Team',
      members: [
        { id: 'agent-1', name: 'Dev Agent', role: 'developer', agentStatus: 'active' },
        { id: 'agent-2', name: 'Test Agent', role: 'tester', agentStatus: 'active' },
      ],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'team-2',
      name: 'Backend Team',
      members: [
        { id: 'agent-3', name: 'API Agent', role: 'developer', agentStatus: 'inactive' },
      ],
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'team-3',
      name: 'Empty Team',
      members: [],
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
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: [],
      loading: true,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    expect(screen.getByTestId('teams-summary-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading teams...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: [],
      loading: false,
      error: 'Failed to load',
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    expect(screen.getByTestId('teams-summary-error')).toBeInTheDocument();
    expect(screen.getByText(/Error: Failed to load/)).toBeInTheDocument();
  });

  it('should show empty state when no teams', () => {
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: [],
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    expect(screen.getByTestId('teams-empty')).toBeInTheDocument();
    expect(screen.getByText('No teams yet')).toBeInTheDocument();
  });

  it('should render teams list', () => {
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: mockTeams,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(screen.getByText('Empty Team')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // count badge
  });

  it('should navigate to team on click', () => {
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: mockTeams,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    fireEvent.click(screen.getByTestId('team-item-team-1'));

    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
  });

  it('should show agent counts', () => {
    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: mockTeams,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary />);

    expect(screen.getByText('2 agents')).toBeInTheDocument();
    expect(screen.getByText('1 agent')).toBeInTheDocument();
    expect(screen.getByText('0 agents')).toBeInTheDocument();
  });

  it('should show limited items in compact mode', () => {
    const manyTeams = Array.from({ length: 8 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      members: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }));

    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: manyTeams,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary compact maxItems={5} />);

    // Should show 5 teams + "more" link
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 5')).toBeInTheDocument();
    expect(screen.queryByText('Team 6')).not.toBeInTheDocument();
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('should navigate to teams page on "more" click', () => {
    const manyTeams = Array.from({ length: 8 }, (_, i) => ({
      id: `team-${i + 1}`,
      name: `Team ${i + 1}`,
      members: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }));

    vi.mocked(useTeamsModule.useTeams).mockReturnValue({
      teams: manyTeams,
      loading: false,
      error: null,
      refresh: mockRefresh,
    });

    renderWithRouter(<TeamsSummary compact maxItems={5} />);

    fireEvent.click(screen.getByTestId('teams-view-more'));

    expect(mockNavigate).toHaveBeenCalledWith('/teams');
  });
});
