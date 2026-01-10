import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TaskDetailModal } from './TaskDetailModal';

const mockTask = {
  id: '1',
  title: 'Test Task',
  description: 'Test description',
  status: 'open',
  priority: 'medium',
  milestoneId: 'm1_foundation',
  acceptanceCriteria: ['Criteria 1', 'Criteria 2'],
  tasks: ['Subtask 1', 'Subtask 2'],
  assignee: 'John Doe'
};

describe('TaskDetailModal', () => {
  it('renders when open with task data', () => {
    render(
      <TaskDetailModal
        isOpen={true}
        onClose={vi.fn()}
        task={mockTask}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <TaskDetailModal
        isOpen={false}
        onClose={vi.fn()}
        task={mockTask}
      />
    );

    expect(screen.queryByText('Test Task')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onCloseMock = vi.fn();
    render(
      <TaskDetailModal
        isOpen={true}
        onClose={onCloseMock}
        task={mockTask}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('calls onAssign when start task button is clicked', () => {
    const onAssignMock = vi.fn();
    render(
      <TaskDetailModal
        isOpen={true}
        onClose={vi.fn()}
        task={mockTask}
        onAssign={onAssignMock}
      />
    );

    fireEvent.click(screen.getByText('Start Task'));
    expect(onAssignMock).toHaveBeenCalledWith(mockTask);
  });

  it('shows acceptance criteria when provided', () => {
    render(
      <TaskDetailModal
        isOpen={true}
        onClose={vi.fn()}
        task={mockTask}
      />
    );

    expect(screen.getByText('Acceptance Criteria (2)')).toBeInTheDocument();
    expect(screen.getByText('Criteria 1')).toBeInTheDocument();
    expect(screen.getByText('Criteria 2')).toBeInTheDocument();
  });

  it('shows subtasks when provided', () => {
    render(
      <TaskDetailModal
        isOpen={true}
        onClose={vi.fn()}
        task={mockTask}
      />
    );

    expect(screen.getByText('Subtasks (2)')).toBeInTheDocument();
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();
    expect(screen.getByText('Subtask 2')).toBeInTheDocument();
  });
});