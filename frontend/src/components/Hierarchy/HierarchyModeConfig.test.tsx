/**
 * HierarchyModeConfig Component Tests
 *
 * @module components/Hierarchy/HierarchyModeConfig.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HierarchyModeConfig, getEligibleLeaders } from './HierarchyModeConfig';
import type { HierarchyConfig } from './HierarchyModeConfig';
import type { TeamMember } from '@/types';

// =============================================================================
// Test data helpers
// =============================================================================

function createTestMember(overrides?: Partial<TeamMember>): TeamMember {
  return {
    id: 'member-1',
    name: 'Dev Worker',
    sessionName: 'dev-session-1',
    role: 'developer',
    systemPrompt: 'You are a developer',
    agentStatus: 'active',
    workingStatus: 'idle',
    runtimeType: 'claude-code',
    createdAt: '2026-03-06T10:00:00.000Z',
    updatedAt: '2026-03-06T10:00:00.000Z',
    ...overrides,
  };
}

function createTestMembers(): TeamMember[] {
  return [
    createTestMember({ id: 'dev-1', name: 'Alice', role: 'developer' }),
    createTestMember({ id: 'dev-2', name: 'Bob', role: 'qa' }),
    createTestMember({ id: 'dev-3', name: 'Charlie', role: 'designer' }),
  ];
}

// =============================================================================
// Unit tests: helper functions
// =============================================================================

describe('getEligibleLeaders', () => {
  it('should return all non-orchestrator members', () => {
    const members = [
      createTestMember({ id: 'orc', role: 'orchestrator' }),
      createTestMember({ id: 'dev', role: 'developer' }),
      createTestMember({ id: 'qa', role: 'qa' }),
    ];
    const eligible = getEligibleLeaders(members);
    expect(eligible).toHaveLength(2);
    expect(eligible.map(m => m.id)).toEqual(['dev', 'qa']);
  });

  it('should return empty array when only orchestrator', () => {
    const members = [createTestMember({ id: 'orc', role: 'orchestrator' })];
    expect(getEligibleLeaders(members)).toHaveLength(0);
  });

  it('should return empty array for empty input', () => {
    expect(getEligibleLeaders([])).toHaveLength(0);
  });
});

// =============================================================================
// Component tests
// =============================================================================

describe('HierarchyModeConfig', () => {
  const defaultConfig: HierarchyConfig = { hierarchical: false, leaderId: null, leaderIds: [] };

  describe('Rendering', () => {
    it('should render the toggle and title', () => {
      render(
        <HierarchyModeConfig
          config={defaultConfig}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.getByText('Hierarchical Mode')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should not show leader selection when disabled', () => {
      render(
        <HierarchyModeConfig
          config={defaultConfig}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.queryByTestId('leader-select')).not.toBeInTheDocument();
    });

    it('should show leader toggle buttons when enabled', () => {
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: null, leaderIds: [] }}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.getByTestId('leader-select')).toBeInTheDocument();
    });

    it('should show no-leaders message when no eligible members', () => {
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: null, leaderIds: [] }}
          onChange={vi.fn()}
          members={[]}
        />
      );
      expect(screen.getByTestId('no-leaders-message')).toBeInTheDocument();
    });

    it('should render member toggle buttons', () => {
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: null, leaderIds: [] }}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.getByText('Alice (developer)')).toBeInTheDocument();
      expect(screen.getByText('Bob (qa)')).toBeInTheDocument();
      expect(screen.getByText('Charlie (designer)')).toBeInTheDocument();
    });

    it('should show hierarchy preview when leaders are selected', () => {
      const members = createTestMembers();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1'] }}
          onChange={vi.fn()}
          members={members}
        />
      );
      expect(screen.getByTestId('hierarchy-preview')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('2 workers')).toBeInTheDocument();
    });

    it('should show multiple leaders in preview', () => {
      const members = createTestMembers();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1', 'dev-2'] }}
          onChange={vi.fn()}
          members={members}
        />
      );
      expect(screen.getByTestId('hierarchy-preview')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should show Primary badge on first leader', () => {
      const members = createTestMembers();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1', 'dev-2'] }}
          onChange={vi.fn()}
          members={members}
        />
      );
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });
  });

  describe('Toggle interaction', () => {
    it('should call onChange with hierarchical=true when toggled on', () => {
      const handleChange = vi.fn();
      render(
        <HierarchyModeConfig
          config={defaultConfig}
          onChange={handleChange}
          members={createTestMembers()}
        />
      );

      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ hierarchical: true })
      );
    });

    it('should call onChange with hierarchical=false when toggled off', () => {
      const handleChange = vi.fn();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1'] }}
          onChange={handleChange}
          members={createTestMembers()}
        />
      );

      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ hierarchical: false, leaderId: null, leaderIds: [] })
      );
    });

    it('should set aria-checked correctly', () => {
      const { rerender } = render(
        <HierarchyModeConfig
          config={defaultConfig}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

      rerender(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: null, leaderIds: [] }}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Leader selection (multi-TL)', () => {
    it('should add a leader when toggle button is clicked', () => {
      const handleChange = vi.fn();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: null, leaderIds: [] }}
          onChange={handleChange}
          members={createTestMembers()}
        />
      );

      fireEvent.click(screen.getByTestId('leader-toggle-dev-2'));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ leaderIds: ['dev-2'], leaderId: 'dev-2' })
      );
    });

    it('should remove a leader when toggled off', () => {
      const handleChange = vi.fn();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1'] }}
          onChange={handleChange}
          members={createTestMembers()}
        />
      );

      fireEvent.click(screen.getByTestId('leader-toggle-dev-1'));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ leaderIds: [], leaderId: null })
      );
    });

    it('should support selecting multiple leaders', () => {
      const handleChange = vi.fn();
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1', leaderIds: ['dev-1'] }}
          onChange={handleChange}
          members={createTestMembers()}
        />
      );

      fireEvent.click(screen.getByTestId('leader-toggle-dev-2'));
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({ leaderIds: ['dev-1', 'dev-2'], leaderId: 'dev-1' })
      );
    });

    it('should fall back to leaderId when leaderIds is undefined (backward compat)', () => {
      render(
        <HierarchyModeConfig
          config={{ hierarchical: true, leaderId: 'dev-1' }}
          onChange={vi.fn()}
          members={createTestMembers()}
        />
      );
      // Should show dev-1 as selected via the fallback
      expect(screen.getByTestId('hierarchy-preview')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      render(
        <HierarchyModeConfig
          config={defaultConfig}
          onChange={vi.fn()}
          members={[]}
          className="my-class"
        />
      );
      expect(screen.getByTestId('hierarchy-mode-config')).toHaveClass('my-class');
    });
  });
});
