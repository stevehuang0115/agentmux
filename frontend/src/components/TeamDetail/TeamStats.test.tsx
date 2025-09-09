import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TeamStats } from './TeamStats';
import { Team, TeamMember } from '../../types';

const mockMember: TeamMember = {
  id: '1',
  name: 'Test Member',
  sessionName: 'test-session',
  role: 'developer',
  systemPrompt: 'test prompt',
  agentStatus: 'active',
  workingStatus: 'idle',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const mockTeam: Team = {
  id: 'test-team',
  name: 'Test Team',
  description: 'A test team',
  members: [mockMember],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('TeamStats', () => {
  it('renders team status correctly', () => {
    render(<TeamStats team={mockTeam} teamStatus="active" projectName="Test Project" />);
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('displays correct active member count', () => {
    render(<TeamStats team={mockTeam} teamStatus="active" projectName="Test Project" />);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
  });

  it('displays project name when provided', () => {
    render(<TeamStats team={mockTeam} teamStatus="active" projectName="Test Project" />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('displays "None" when no project is provided', () => {
    render(<TeamStats team={mockTeam} teamStatus="active" projectName={null} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('displays formatted creation date', () => {
    render(<TeamStats team={mockTeam} teamStatus="active" projectName="Test Project" />);
    expect(screen.getByText('12/31/2023')).toBeInTheDocument();
  });

  it('handles team with no members', () => {
    const emptyTeam = { ...mockTeam, members: [] };
    render(<TeamStats team={emptyTeam} teamStatus="idle" projectName="Test Project" />);
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });
});