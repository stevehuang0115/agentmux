/**
 * TaskFlowView Component Tests
 *
 * @module components/Hierarchy/TaskFlowView.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  TaskFlowView,
  buildTaskTree,
  getTaskStatusLabel,
  computeCompletionPercent,
} from './TaskFlowView';
import type { TaskFlowItem, TaskFlowNode } from './TaskFlowView';

// =============================================================================
// Test data helpers
// =============================================================================

function createTestTask(overrides?: Partial<TaskFlowItem>): TaskFlowItem {
  return {
    id: 'task-1',
    taskName: 'Test task',
    status: 'assigned',
    assignedSessionName: 'dev-1',
    assignedTeamMemberId: 'member-1',
    assignedAt: '2026-03-06T10:00:00.000Z',
    ...overrides,
  };
}

function createTestTaskHierarchy(): TaskFlowItem[] {
  return [
    createTestTask({
      id: 'goal-1',
      taskName: 'Build Login Flow',
      status: 'working',
      assignedSessionName: 'tl-fe',
      childTaskIds: ['sub-1', 'sub-2', 'sub-3'],
    }),
    createTestTask({
      id: 'sub-1',
      taskName: 'Login Form UI',
      status: 'completed',
      assignedSessionName: 'dev-1',
      parentTaskId: 'goal-1',
      delegatedBy: 'tl-member',
      priority: 'high',
    }),
    createTestTask({
      id: 'sub-2',
      taskName: 'Auth API Integration',
      status: 'working',
      assignedSessionName: 'dev-2',
      parentTaskId: 'goal-1',
      priority: 'medium',
    }),
    createTestTask({
      id: 'sub-3',
      taskName: 'Write Auth Tests',
      status: 'assigned',
      assignedSessionName: 'qa-1',
      parentTaskId: 'goal-1',
      priority: 'low',
    }),
  ];
}

// =============================================================================
// Unit tests: helper functions
// =============================================================================

describe('buildTaskTree', () => {
  it('should return empty array for empty tasks', () => {
    expect(buildTaskTree([])).toEqual([]);
  });

  it('should build single root node', () => {
    const tasks = [createTestTask({ id: 'root' })];
    const tree = buildTaskTree(tasks);
    expect(tree).toHaveLength(1);
    expect(tree[0].task.id).toBe('root');
    expect(tree[0].children).toHaveLength(0);
    expect(tree[0].depth).toBe(0);
  });

  it('should build parent-child hierarchy', () => {
    const tasks = createTestTaskHierarchy();
    const tree = buildTaskTree(tasks);

    expect(tree).toHaveLength(1);
    expect(tree[0].task.id).toBe('goal-1');
    expect(tree[0].children).toHaveLength(3);
    expect(tree[0].children[0].task.id).toBe('sub-1');
    expect(tree[0].children[0].depth).toBe(1);
  });

  it('should handle flat tasks (no parentTaskId) as multiple roots', () => {
    const tasks = [
      createTestTask({ id: 't1', taskName: 'A' }),
      createTestTask({ id: 't2', taskName: 'B' }),
    ];
    const tree = buildTaskTree(tasks);
    expect(tree).toHaveLength(2);
  });
});

describe('getTaskStatusLabel', () => {
  it('should return "Completed" for completed', () => {
    expect(getTaskStatusLabel('completed')).toBe('Completed');
  });

  it('should return "Working" for working', () => {
    expect(getTaskStatusLabel('working')).toBe('Working');
  });

  it('should return "Input Required" for input_required', () => {
    expect(getTaskStatusLabel('input_required')).toBe('Input Required');
  });

  it('should return raw status for unknown status', () => {
    expect(getTaskStatusLabel('custom_status')).toBe('custom_status');
  });
});

describe('computeCompletionPercent', () => {
  it('should return 100 for completed leaf task', () => {
    const node: TaskFlowNode = {
      task: createTestTask({ status: 'completed' }),
      children: [],
      depth: 0,
    };
    expect(computeCompletionPercent(node)).toBe(100);
  });

  it('should return 0 for non-completed leaf task', () => {
    const node: TaskFlowNode = {
      task: createTestTask({ status: 'working' }),
      children: [],
      depth: 0,
    };
    expect(computeCompletionPercent(node)).toBe(0);
  });

  it('should compute percentage based on completed children', () => {
    const node: TaskFlowNode = {
      task: createTestTask({ id: 'parent' }),
      depth: 0,
      children: [
        { task: createTestTask({ id: 'c1', status: 'completed' }), children: [], depth: 1 },
        { task: createTestTask({ id: 'c2', status: 'working' }), children: [], depth: 1 },
        { task: createTestTask({ id: 'c3', status: 'completed' }), children: [], depth: 1 },
      ],
    };
    expect(computeCompletionPercent(node)).toBe(67); // 2/3 = 66.67 → rounds to 67
  });

  it('should return 0 when no children are completed', () => {
    const node: TaskFlowNode = {
      task: createTestTask({ id: 'parent' }),
      depth: 0,
      children: [
        { task: createTestTask({ id: 'c1', status: 'working' }), children: [], depth: 1 },
        { task: createTestTask({ id: 'c2', status: 'assigned' }), children: [], depth: 1 },
      ],
    };
    expect(computeCompletionPercent(node)).toBe(0);
  });
});

// =============================================================================
// Component tests
// =============================================================================

describe('TaskFlowView', () => {
  describe('Rendering', () => {
    it('should show empty message when no tasks', () => {
      render(<TaskFlowView tasks={[]} />);
      expect(screen.getByText('No tasks to display.')).toBeInTheDocument();
    });

    it('should render all tasks in the hierarchy', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      expect(screen.getByText('Build Login Flow')).toBeInTheDocument();
      // Parent tasks with childTaskIds are expanded by default
      expect(screen.getByText('Login Form UI')).toBeInTheDocument();
      expect(screen.getByText('Auth API Integration')).toBeInTheDocument();
      expect(screen.getByText('Write Auth Tests')).toBeInTheDocument();
    });

    it('should render assignee session names', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      expect(screen.getByText('tl-fe')).toBeInTheDocument();
      expect(screen.getByText('dev-1')).toBeInTheDocument();
      expect(screen.getByText('dev-2')).toBeInTheDocument();
      expect(screen.getByText('qa-1')).toBeInTheDocument();
    });

    it('should render priority badges', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('should render status labels', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      // Parent shows "Working (33%)" because 1 of 3 completed
      expect(screen.getByText(/Working.*33%/)).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Assigned')).toBeInTheDocument();
    });

    it('should have tree role', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);
      expect(screen.getByRole('tree')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should collapse a parent task when toggle is clicked', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      expect(screen.getByText('Login Form UI')).toBeInTheDocument();

      const collapseButton = screen.getByLabelText('Collapse');
      fireEvent.click(collapseButton);

      expect(screen.queryByText('Login Form UI')).not.toBeInTheDocument();
    });

    it('should expand collapsed parent when toggle is clicked', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      // Collapse first
      fireEvent.click(screen.getByLabelText('Collapse'));
      expect(screen.queryByText('Login Form UI')).not.toBeInTheDocument();

      // Expand
      fireEvent.click(screen.getByLabelText('Expand'));
      expect(screen.getByText('Login Form UI')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onTaskClick when a task is clicked', () => {
      const tasks = createTestTaskHierarchy();
      const handleClick = vi.fn();
      render(<TaskFlowView tasks={tasks} onTaskClick={handleClick} />);

      fireEvent.click(screen.getByText('Login Form UI'));
      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'sub-1', taskName: 'Login Form UI' })
      );
    });

    it('should not throw when onTaskClick is not provided', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);
      expect(() => fireEvent.click(screen.getByText('Login Form UI'))).not.toThrow();
    });
  });

  describe('Styling', () => {
    it('should apply custom className', () => {
      const tasks = createTestTaskHierarchy();
      const { container } = render(
        <TaskFlowView tasks={tasks} className="my-class" />
      );
      expect(container.firstChild).toHaveClass('my-class');
    });

    it('should render data-testid for each node', () => {
      const tasks = createTestTaskHierarchy();
      render(<TaskFlowView tasks={tasks} />);

      expect(screen.getByTestId('task-node-goal-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-node-sub-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-node-sub-2')).toBeInTheDocument();
      expect(screen.getByTestId('task-node-sub-3')).toBeInTheDocument();
    });
  });
});
