import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import TeamsView from './TeamsView';
import { Team } from '../../types';

// Mock the lucide-react icons
vi.mock('lucide-react', () => ({
  UserMinus: ({ className }: { className?: string }) => <div data-testid="user-minus-icon" className={className} />
}));

describe('TeamsView', () => {
  const mockOpenTerminalWithSession = vi.fn();
  const mockOnUnassignTeam = vi.fn();

  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Frontend Team',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      members: [
        {
          id: 'member-1',
          name: 'John Doe',
          role: 'Developer',
          agentStatus: 'active',
          sessionName: 'john-session'
        },
        {
          id: 'member-2',
          name: 'Jane Smith',
          role: 'Designer',
          agentStatus: 'inactive',
          sessionName: 'jane-session'
        }
      ]
    },
    {
      id: 'team-2',
      name: 'Backend Team',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
      members: [
        {
          id: 'member-3',
          name: 'Bob Johnson',
          role: 'Developer',
          agentStatus: 'inactive',
          sessionName: undefined // Test fallback to name
        }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders teams view with header', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getByText('Assigned Teams')).toBeInTheDocument();
    expect(screen.getByText('Teams currently working on this project')).toBeInTheDocument();
  });

  it('renders assigned teams correctly', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    // Check team names
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Backend Team')).toBeInTheDocument();

    // Check member counts
    expect(screen.getByText('Members (2)')).toBeInTheDocument();
    expect(screen.getByText('Members (1)')).toBeInTheDocument();

    // Check member names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();

    // Check member roles
    expect(screen.getAllByText('Developer')).toHaveLength(2);
    expect(screen.getByText('Designer')).toBeInTheDocument();
  });

  it('displays correct team status based on member activity', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    // Frontend Team should be active (has at least one active member)
    const frontendTeamCard = screen.getByText('Frontend Team').closest('.assigned-team-card');
    expect(frontendTeamCard).toHaveClass('status-active');

    // Backend Team should be inactive (no active members)
    const backendTeamCard = screen.getByText('Backend Team').closest('.assigned-team-card');
    expect(backendTeamCard).toHaveClass('status-inactive');
  });

  it('displays member statuses correctly', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    // Check for status text
    expect(screen.getAllByText('active')).toHaveLength(2); // One for team status, one for member status
    expect(screen.getAllByText('inactive')).toHaveLength(3); // One for team status, two for member statuses
  });

  it('displays team creation and update dates', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    // Check for date labels
    expect(screen.getAllByText('Created:')).toHaveLength(2);
    expect(screen.getAllByText('Last Activity:')).toHaveLength(2);

    // Check for formatted dates (will be in MM/DD/YYYY format)
    expect(screen.getAllByText('1/1/2024')).toHaveLength(2); // Both teams created on same date
    expect(screen.getByText('1/2/2024')).toBeInTheDocument(); // Frontend team updated
    expect(screen.getByText('1/3/2024')).toBeInTheDocument(); // Backend team updated
  });

  it('calls onUnassignTeam when unassign button is clicked', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    const unassignButtons = screen.getAllByText('Unassign');
    fireEvent.click(unassignButtons[0]);

    expect(mockOnUnassignTeam).toHaveBeenCalledWith('team-1', 'Frontend Team');
  });

  it('calls openTerminalWithSession when member is clicked', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    const johnMember = screen.getByText('John Doe').closest('.member-item');
    fireEvent.click(johnMember!);

    expect(mockOpenTerminalWithSession).toHaveBeenCalledWith('john-session');
  });

  it('uses member name as fallback when sessionName is not available', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    const bobMember = screen.getByText('Bob Johnson').closest('.member-item');
    fireEvent.click(bobMember!);

    expect(mockOpenTerminalWithSession).toHaveBeenCalledWith('Bob Johnson');
  });

  it('shows empty state when no teams are assigned', () => {
    render(
      <TeamsView
        assignedTeams={[]}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getByText('No teams assigned')).toBeInTheDocument();
    expect(screen.getByText('Assign teams to this project to start collaborative development.')).toBeInTheDocument();
    expect(screen.getByText('👥')).toBeInTheDocument();
  });

  it('sets correct tooltips for unassign buttons', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    const unassignButtons = screen.getAllByRole('button', { name: /unassign/i });
    expect(unassignButtons[0]).toHaveAttribute('title', 'Unassign Frontend Team from project');
    expect(unassignButtons[1]).toHaveAttribute('title', 'Unassign Backend Team from project');
  });

  it('sets correct tooltips for member items', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    const johnMember = screen.getByText('John Doe').closest('.member-item');
    expect(johnMember).toHaveAttribute('title', 'Click to open terminal session: john-session');

    const bobMember = screen.getByText('Bob Johnson').closest('.member-item');
    expect(bobMember).toHaveAttribute('title', 'No session available');
  });

  it('renders UserMinus icons in unassign buttons', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getAllByTestId('user-minus-icon')).toHaveLength(2);
  });

  it('handles teams with no members gracefully', () => {
    const teamsWithoutMembers: Team[] = [
      {
        id: 'team-empty',
        name: 'Empty Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        members: []
      }
    ];

    render(
      <TeamsView
        assignedTeams={teamsWithoutMembers}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getByText('Empty Team')).toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
  });

  it('handles undefined members array gracefully', () => {
    const teamsWithUndefinedMembers: Team[] = [
      {
        id: 'team-undefined',
        name: 'Undefined Members Team',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        members: undefined as any
      }
    ];

    render(
      <TeamsView
        assignedTeams={teamsWithUndefinedMembers}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getByText('Undefined Members Team')).toBeInTheDocument();
    expect(screen.queryByText('Members')).not.toBeInTheDocument();
  });

  it('applies correct CSS classes for layout and styling', () => {
    render(
      <TeamsView
        assignedTeams={mockTeams}
        onUnassignTeam={mockOnUnassignTeam}
        openTerminalWithSession={mockOpenTerminalWithSession}
      />
    );

    expect(screen.getByRole('generic')).toHaveClass('teams-view');
    expect(screen.getByText('Assigned Teams').closest('div')).toHaveClass('teams-header');
    expect(screen.getByText('Frontend Team').closest('.assigned-team-card')).toBeInTheDocument();
  });
});