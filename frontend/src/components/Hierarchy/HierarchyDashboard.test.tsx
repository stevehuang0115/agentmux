/**
 * HierarchyDashboard Component Tests
 *
 * @module components/Hierarchy/HierarchyDashboard.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HierarchyDashboard, computeTeamStats } from './HierarchyDashboard';
import type { Team, TeamMember } from '@/types';

// =============================================================================
// Test data helpers
// =============================================================================

function createTestMember(overrides?: Partial<TeamMember>): TeamMember {
  return {
    id: 'member-1',
    name: 'Dev Worker',
    sessionName: 'dev-session-1',
    role: 'developer',
    systemPrompt: '',
    agentStatus: 'active',
    workingStatus: 'idle',
    runtimeType: 'claude-code',
    createdAt: '2026-03-06T10:00:00.000Z',
    updatedAt: '2026-03-06T10:00:00.000Z',
    ...overrides,
  };
}

function createFlatTeam(): Team {
  return {
    id: 'team-1',
    name: 'Dev Team',
    members: [
      createTestMember({ id: 'dev-1', name: 'Alice', agentStatus: 'active', workingStatus: 'in_progress' }),
      createTestMember({ id: 'dev-2', name: 'Bob', agentStatus: 'active', workingStatus: 'idle' }),
      createTestMember({ id: 'dev-3', name: 'Charlie', agentStatus: 'inactive', workingStatus: 'idle' }),
    ],
    projectIds: [],
    createdAt: '2026-03-06T10:00:00.000Z',
    updatedAt: '2026-03-06T10:00:00.000Z',
  };
}

function createHierarchicalTeam(): Team {
  return {
    id: 'team-h1',
    name: 'FE Team',
    hierarchical: true,
    leaderId: 'tl-1',
    members: [
      createTestMember({
        id: 'orc',
        name: 'Orchestrator',
        role: 'orchestrator',
        hierarchyLevel: 0,
        parentMemberId: undefined,
        canDelegate: true,
        subordinateIds: ['tl-1'],
        agentStatus: 'active',
      }),
      createTestMember({
        id: 'tl-1',
        name: 'FE Lead',
        role: 'team-leader',
        hierarchyLevel: 1,
        parentMemberId: 'orc',
        canDelegate: true,
        subordinateIds: ['w-1', 'w-2'],
        agentStatus: 'active',
        workingStatus: 'in_progress',
      }),
      createTestMember({
        id: 'w-1',
        name: 'Dev1',
        role: 'developer',
        hierarchyLevel: 2,
        parentMemberId: 'tl-1',
        agentStatus: 'active',
        workingStatus: 'in_progress',
      }),
      createTestMember({
        id: 'w-2',
        name: 'Dev2',
        role: 'developer',
        hierarchyLevel: 2,
        parentMemberId: 'tl-1',
        agentStatus: 'inactive',
        workingStatus: 'idle',
      }),
    ],
    projectIds: [],
    createdAt: '2026-03-06T10:00:00.000Z',
    updatedAt: '2026-03-06T10:00:00.000Z',
  };
}

// =============================================================================
// Unit tests: helper functions
// =============================================================================

describe('computeTeamStats', () => {
  it('should compute stats for flat team', () => {
    const members = createFlatTeam().members;
    const stats = computeTeamStats(members);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.inactive).toBe(1);
    expect(stats.working).toBe(1);
    expect(stats.hierarchyDepth).toBe(1); // no hierarchy levels set → maxLevel=0, depth=1
  });

  it('should compute stats for hierarchical team', () => {
    const members = createHierarchicalTeam().members;
    const stats = computeTeamStats(members);
    expect(stats.total).toBe(4);
    expect(stats.active).toBe(3);
    expect(stats.inactive).toBe(1);
    expect(stats.working).toBe(2);
    expect(stats.hierarchyDepth).toBe(3); // levels 0,1,2 → depth=3
  });

  it('should return zeros for empty members', () => {
    const stats = computeTeamStats([]);
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.inactive).toBe(0);
    expect(stats.working).toBe(0);
    expect(stats.hierarchyDepth).toBe(1);
  });
});

// =============================================================================
// Component tests
// =============================================================================

describe('HierarchyDashboard', () => {
  describe('Flat team rendering', () => {
    it('should render flat view for non-hierarchical team', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);

      expect(screen.getByTestId('flat-view')).toBeInTheDocument();
      expect(screen.queryByTestId('hierarchy-view')).not.toBeInTheDocument();
    });

    it('should render team name', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);
      expect(screen.getByText('Dev Team')).toBeInTheDocument();
    });

    it('should not show Hierarchical badge', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);
      expect(screen.queryByText('Hierarchical')).not.toBeInTheDocument();
    });

    it('should render all members in flat view', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);
      expect(screen.getByTestId('flat-member-dev-1')).toBeInTheDocument();
      expect(screen.getByTestId('flat-member-dev-2')).toBeInTheDocument();
      expect(screen.getByTestId('flat-member-dev-3')).toBeInTheDocument();
    });

    it('should show stats row with Inactive stat (not Depth)', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
      expect(screen.queryByText('Depth')).not.toBeInTheDocument();
    });

    it('should show empty message when no members', () => {
      const emptyTeam: Team = {
        ...createFlatTeam(),
        members: [],
      };
      render(<HierarchyDashboard team={emptyTeam} />);
      expect(screen.getByText('No team members.')).toBeInTheDocument();
    });
  });

  describe('Hierarchical team rendering', () => {
    it('should render hierarchy view for hierarchical team', () => {
      render(<HierarchyDashboard team={createHierarchicalTeam()} />);

      expect(screen.getByTestId('hierarchy-view')).toBeInTheDocument();
      expect(screen.queryByTestId('flat-view')).not.toBeInTheDocument();
    });

    it('should show Hierarchical badge', () => {
      render(<HierarchyDashboard team={createHierarchicalTeam()} />);
      expect(screen.getByText('Hierarchical')).toBeInTheDocument();
    });

    it('should show Depth stat instead of Inactive', () => {
      render(<HierarchyDashboard team={createHierarchicalTeam()} />);
      expect(screen.getByText('Depth')).toBeInTheDocument();
      expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
    });

    it('should render team tree with members', () => {
      render(<HierarchyDashboard team={createHierarchicalTeam()} />);
      expect(screen.getByText('Orchestrator')).toBeInTheDocument();
      expect(screen.getByText('FE Lead')).toBeInTheDocument();
      expect(screen.getByText('Dev1')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onMemberClick when flat member is clicked', () => {
      const handleClick = vi.fn();
      render(<HierarchyDashboard team={createFlatTeam()} onMemberClick={handleClick} />);

      fireEvent.click(screen.getByTestId('flat-member-dev-1'));
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'dev-1', name: 'Alice' })
      );
    });

    it('should call onMemberClick when hierarchy node is clicked', () => {
      const handleClick = vi.fn();
      render(<HierarchyDashboard team={createHierarchicalTeam()} onMemberClick={handleClick} />);

      fireEvent.click(screen.getByText('Dev1'));
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w-1', name: 'Dev1' })
      );
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      render(<HierarchyDashboard team={createFlatTeam()} className="my-class" />);
      expect(screen.getByTestId('hierarchy-dashboard')).toHaveClass('my-class');
    });

    it('should render stats row', () => {
      render(<HierarchyDashboard team={createFlatTeam()} />);
      expect(screen.getByTestId('stats-row')).toBeInTheDocument();
    });
  });
});
