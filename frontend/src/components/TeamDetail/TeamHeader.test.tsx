import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { TeamHeader } from './TeamHeader';
import { Team } from '../../types';

const mockTeam: Team = {
  id: 'test-team',
  name: 'Test Team',
  description: 'A test team',
  members: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockProps = {
  team: mockTeam,
  teamStatus: 'idle',
  orchestratorSessionActive: false,
  onStartTeam: vi.fn(),
  onStopTeam: vi.fn(),
  onViewTerminal: vi.fn(),
  onDeleteTeam: vi.fn(),
};

describe('TeamHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders team name correctly', () => {
    render(<TeamHeader {...mockProps} />);
    expect(screen.getByText('Test Team')).toBeInTheDocument();
  });

  it('shows Start Team button when team status is idle', () => {
    render(<TeamHeader {...mockProps} teamStatus="idle" />);
    expect(screen.getByText('Start Team')).toBeInTheDocument();
  });

  it('shows Stop Team button when team status is active', () => {
    render(<TeamHeader {...mockProps} teamStatus="active" />);
    expect(screen.getByText('Stop Team')).toBeInTheDocument();
  });

  it('calls onStartTeam when Start Team button is clicked', () => {
    render(<TeamHeader {...mockProps} teamStatus="idle" />);
    fireEvent.click(screen.getByText('Start Team'));
    expect(mockProps.onStartTeam).toHaveBeenCalled();
  });

  it('shows View Terminal button for orchestrator team', () => {
    const orchestratorTeam = { ...mockTeam, id: 'orchestrator', name: 'Orchestrator Team' };
    render(<TeamHeader {...mockProps} team={orchestratorTeam} />);
    expect(screen.getByText('View Terminal')).toBeInTheDocument();
  });

  it('does not show Delete Team button for orchestrator team', () => {
    const orchestratorTeam = { ...mockTeam, id: 'orchestrator', name: 'Orchestrator Team' };
    render(<TeamHeader {...mockProps} team={orchestratorTeam} />);
    expect(screen.queryByText('Delete Team')).not.toBeInTheDocument();
  });

  it('shows Delete Team button for regular teams', () => {
    render(<TeamHeader {...mockProps} />);
    expect(screen.getByText('Delete Team')).toBeInTheDocument();
  });
});