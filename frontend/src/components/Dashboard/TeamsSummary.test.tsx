/**
 * TeamsSummary Component Tests
 *
 * @module components/Dashboard/TeamsSummary.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamsSummary } from './TeamsSummary';
import * as useTeamsHook from '../../hooks/useTeams';

// Mock the useTeams hook
vi.mock('../../hooks/useTeams');

describe('TeamsSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should show loading state', () => {
    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary />);

    expect(screen.getByText('Loading teams...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: [],
      loading: false,
      error: 'Failed to load',
      refresh: vi.fn(),
    });

    render(<TeamsSummary />);

    expect(screen.getByText('Failed to load teams')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary />);

    expect(screen.getByText('No teams yet')).toBeInTheDocument();
  });

  it('should render teams list', () => {
    const mockTeams = [
      { id: 'team-1', name: 'Team Alpha', members: [{ agentStatus: 'active' }] },
      { id: 'team-2', name: 'Team Beta', members: [{ agentStatus: 'inactive' }] },
    ];

    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: mockTeams as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary />);

    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Beta')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // count badge
  });

  it('should show active agent count', () => {
    const mockTeams = [
      {
        id: 'team-1',
        name: 'Team Alpha',
        members: [
          { agentStatus: 'active' },
          { agentStatus: 'active' },
          { agentStatus: 'inactive' },
        ],
      },
    ];

    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: mockTeams as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary />);

    expect(screen.getByText('2/3 active')).toBeInTheDocument();
  });

  it('should limit teams in compact mode', () => {
    const mockTeams = [
      { id: 'team-1', name: 'Team 1', members: [] },
      { id: 'team-2', name: 'Team 2', members: [] },
      { id: 'team-3', name: 'Team 3', members: [] },
      { id: 'team-4', name: 'Team 4', members: [] },
      { id: 'team-5', name: 'Team 5', members: [] },
      { id: 'team-6', name: 'Team 6', members: [] },
      { id: 'team-7', name: 'Team 7', members: [] },
    ];

    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: mockTeams as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary compact />);

    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 5')).toBeInTheDocument();
    expect(screen.queryByText('Team 6')).not.toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('should call onTeamClick when team is clicked', () => {
    const mockTeams = [{ id: 'team-1', name: 'Team Alpha', members: [] }];
    const handleClick = vi.fn();

    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: mockTeams as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary onTeamClick={handleClick} />);

    fireEvent.click(screen.getByText('Team Alpha'));

    expect(handleClick).toHaveBeenCalledWith('team-1');
  });

  it('should handle keyboard navigation', () => {
    const mockTeams = [{ id: 'team-1', name: 'Team Alpha', members: [] }];
    const handleClick = vi.fn();

    vi.mocked(useTeamsHook.useTeams).mockReturnValue({
      teams: mockTeams as any,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<TeamsSummary onTeamClick={handleClick} />);

    const item = screen.getByText('Team Alpha').closest('li');
    fireEvent.keyDown(item!, { key: 'Enter' });

    expect(handleClick).toHaveBeenCalledWith('team-1');
  });
});
