import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import { EnhancedAssignmentsList } from './EnhancedAssignmentsList';
import { EnhancedTeamMember } from './types';
import { Project, Team } from '../../types';

describe('EnhancedAssignmentsList', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Test Project 1',
      path: '/test/project1',
      teams: { 'team-1': ['member-1'] },
      status: 'active',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ];

  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Test Team',
      members: [
        {
          id: 'member-1',
          name: 'John Doe',
          sessionName: 'test-team-john',
          role: 'developer' as const,
          systemPrompt: 'Test prompt',
          agentStatus: 'active' as const,
          workingStatus: 'idle' as const,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ],
      projectIds: ['project-1'],
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z'
    }
  ];

  const mockEnhancedMembers: EnhancedTeamMember[] = [
    {
      teamId: 'team-1',
      teamName: 'Test Team',
      memberId: 'member-1',
      memberName: 'John Doe',
      role: 'developer',
      sessionName: 'test-team-john',
      agentStatus: 'active',
      workingStatus: 'in_progress',
      lastActivityCheck: '2023-01-01T12:00:00Z',
      activityDetected: true,
      currentTask: {
        id: 'task-1',
        taskName: 'Implement feature X',
        taskFilePath: '/project/.crewly/tasks/m1/in_progress/task-1.md',
        assignedAt: '2023-01-01T10:00:00Z',
        status: 'assigned'
      }
    }
  ];

  const mockOnMemberClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project with team members and their tasks', () => {
    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={mockEnhancedMembers}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    expect(screen.getByText('Test Team')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('(developer)')).toBeInTheDocument();
    expect(screen.getByText('Working on: Implement feature X')).toBeInTheDocument();
  });

  it('shows idle status for members without tasks', () => {
    const idleMember: EnhancedTeamMember[] = [
      {
        ...mockEnhancedMembers[0],
        workingStatus: 'idle',
        currentTask: null
      }
    ];

    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={idleMember}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('shows inactive status for inactive members', () => {
    const inactiveMember: EnhancedTeamMember[] = [
      {
        ...mockEnhancedMembers[0],
        agentStatus: 'inactive',
        workingStatus: 'idle',
        currentTask: null
      }
    ];

    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={inactiveMember}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('handles member click', () => {
    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={mockEnhancedMembers}
        onMemberClick={mockOnMemberClick}
      />
    );

    const memberItem = screen.getByText('John Doe').closest('.member-item');
    fireEvent.click(memberItem!);

    expect(mockOnMemberClick).toHaveBeenCalledWith('member-1', 'John Doe', 'team-1');
  });

  it('shows empty state when no projects with members', () => {
    render(
      <EnhancedAssignmentsList
        projects={[]}
        teams={[]}
        enhancedMembers={[]}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('No Active Project Assignments')).toBeInTheDocument();
  });

  it('displays error information for members with errors', () => {
    const memberWithError: EnhancedTeamMember[] = [
      {
        ...mockEnhancedMembers[0],
        error: 'Connection timeout'
      }
    ];

    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={memberWithError}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('formats time ago correctly', () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    
    const memberWithRecentTask: EnhancedTeamMember[] = [
      {
        ...mockEnhancedMembers[0],
        currentTask: {
          ...mockEnhancedMembers[0].currentTask!,
          assignedAt: twoHoursAgo.toISOString()
        },
        lastActivityCheck: twoHoursAgo.toISOString()
      }
    ];

    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={mockTeams}
        enhancedMembers={memberWithRecentTask}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText(/Started 2h ago/)).toBeInTheDocument();
  });

  it('groups multiple teams under same project correctly', () => {
    const multiTeamProject: Team[] = [
      ...mockTeams,
      {
        id: 'team-2',
        name: 'Frontend Team',
        members: [
          {
            id: 'member-2',
            name: 'Jane Smith',
            sessionName: 'frontend-jane',
            role: 'frontend-developer' as const,
            systemPrompt: 'Frontend prompt',
            agentStatus: 'active' as const,
            workingStatus: 'idle' as const,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z'
          }
        ],
        projectIds: ['project-1'],
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z'
      }
    ];

    const multiTeamMembers: EnhancedTeamMember[] = [
      ...mockEnhancedMembers,
      {
        teamId: 'team-2',
        teamName: 'Frontend Team',
        memberId: 'member-2',
        memberName: 'Jane Smith',
        role: 'frontend-developer',
        sessionName: 'frontend-jane',
        agentStatus: 'active',
        workingStatus: 'idle',
        lastActivityCheck: '2023-01-01T12:00:00Z',
        activityDetected: false,
        currentTask: null
      }
    ];

    render(
      <EnhancedAssignmentsList
        projects={mockProjects}
        teams={multiTeamProject}
        enhancedMembers={multiTeamMembers}
        onMemberClick={mockOnMemberClick}
      />
    );

    expect(screen.getByText('Test Team')).toBeInTheDocument();
    expect(screen.getByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});