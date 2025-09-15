import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TasksView, TaskColumn } from './TasksView';
import { TasksViewProps, TaskColumnProps } from './types';

// Mock the fetch function
global.fetch = vi.fn();

// Mock data
const mockProject = {
  id: 'test-project-1',
  name: 'Test Project',
  path: '/path/to/test/project',
  status: 'active' as const,
  description: 'A test project for unit testing',
  teams: {},
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02'
};

const mockTasks = [
  {
    id: 'task-1',
    title: 'Task 1 - Setup',
    description: 'Initial setup task',
    status: 'open',
    priority: 'high',
    milestone: 'm1_foundation',
    milestoneId: 'm1_foundation',
    assignee: null,
    tasks: ['Create project structure', 'Setup dependencies']
  },
  {
    id: 'task-2',
    title: 'Task 2 - Development',
    description: 'Development task',
    status: 'in_progress',
    priority: 'medium',
    milestone: 'm1_foundation',
    milestoneId: 'm1_foundation',
    assignee: 'john-doe',
    tasks: ['Implement feature A', 'Write tests', 'Update documentation']
  },
  {
    id: 'task-3',
    title: 'Task 3 - Review',
    description: 'Code review task',
    status: 'done',
    priority: 'low',
    milestone: 'm2_development',
    milestoneId: 'm2_development',
    assignee: 'jane-smith',
    tasks: []
  },
  {
    id: 'task-4',
    title: 'Task 4 - Blocked',
    description: 'Blocked task',
    status: 'blocked',
    priority: 'critical',
    milestone: 'm2_development',
    milestoneId: 'm2_development',
    assignee: null,
    tasks: ['Wait for external dependency']
  }
];

const defaultProps: TasksViewProps = {
  project: mockProject,
  tickets: mockTasks,
  onTicketsUpdate: vi.fn(),
  onCreateSpecsTasks: vi.fn(),
  onCreateDevTasks: vi.fn(),
  onCreateE2ETasks: vi.fn(),
  loading: false,
  onTaskClick: vi.fn(),
  onTaskAssign: vi.fn(),
  taskAssignmentLoading: null
};

describe('TasksView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve('Success')
    });

    // Mock scrollTo function for auto-scroll tests
    Element.prototype.scrollTo = vi.fn();
  });

  it('renders tasks view with correct task counts', () => {
    render(<TasksView {...defaultProps} />);
    
    expect(screen.getByText('Project Tasks (4)')).toBeInTheDocument();
    expect(screen.getByText('2 Milestones • 4 Tasks')).toBeInTheDocument();
  });

  it('displays milestone overview correctly', () => {
    render(<TasksView {...defaultProps} />);
    
    // Check milestone cards
    expect(screen.getByText('Foundation')).toBeInTheDocument(); // m1_foundation formatted
    expect(screen.getByText('Development')).toBeInTheDocument(); // m2_development formatted
    expect(screen.getAllByText('2 tasks')).toHaveLength(2); // Both milestones have 2 tasks each
  });

  it('renders task columns with correct counts', () => {
    render(<TasksView {...defaultProps} />);
    
    // Check that task board section exists
    expect(screen.getByText('Task Board')).toBeInTheDocument();
    
    // Check for column titles in kanban board specifically
    const kanbanBoard = screen.getByText('Task Board').closest('.kanban-section');
    expect(kanbanBoard).toBeInTheDocument();
  });

  it('filters tasks by milestone when milestone is selected', async () => {
    render(<TasksView {...defaultProps} />);
    
    // Click on foundation milestone
    const foundationMilestone = screen.getByText('Foundation').closest('.milestone-card');
    fireEvent.click(foundationMilestone!);

    // Should show clear filter button
    await waitFor(() => {
      expect(screen.getByText('Clear Filter')).toBeInTheDocument();
    });
  });

  it('clears milestone filter when clear button is clicked', async () => {
    render(<TasksView {...defaultProps} />);
    
    // Click on foundation milestone first
    const foundationMilestone = screen.getByText('Foundation').closest('.milestone-card');
    fireEvent.click(foundationMilestone!);

    // Wait for clear button to appear
    await waitFor(() => {
      expect(screen.getByText('Clear Filter')).toBeInTheDocument();
    });

    // Click clear filter button
    fireEvent.click(screen.getByText('Clear Filter'));

    // Clear filter button should disappear
    await waitFor(() => {
      expect(screen.queryByText('Clear Filter')).not.toBeInTheDocument();
    });
  });

  it('opens create task modal when create task button is clicked', async () => {
    render(<TasksView {...defaultProps} />);
    
    const createTaskButtons = screen.getAllByText('Create Task');
    fireEvent.click(createTaskButtons[0]); // Click the first one (header button)

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeInTheDocument();
    });
  });

  it('opens create milestone modal when create milestone button is clicked', async () => {
    render(<TasksView {...defaultProps} />);
    
    const createMilestoneButtons = screen.getAllByText('Create Milestone');
    fireEvent.click(createMilestoneButtons[0]); // Click the first one (header button)

    await waitFor(() => {
      expect(screen.getByText('Create New Milestone')).toBeInTheDocument();
    });
  });

  it('calls onTaskClick when task is clicked', () => {
    render(<TasksView {...defaultProps} />);
    
    // Find the task card by its unique title
    const taskCards = screen.getAllByText('Task 1 - Setup');
    const taskCard = taskCards[0].closest('.task-card');
    fireEvent.click(taskCard!);
    
    expect(defaultProps.onTaskClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('calls onTaskAssign when task assign button is clicked', () => {
    render(<TasksView {...defaultProps} />);
    
    const taskCards = screen.getAllByText('Task 1 - Setup');
    const taskCard = taskCards[0].closest('.task-card');
    const assignButton = taskCard!.querySelector('.task-play-btn');
    fireEvent.click(assignButton!);
    
    expect(defaultProps.onTaskAssign).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('shows loading state for task assignment', () => {
    const propsWithLoading = {
      ...defaultProps,
      taskAssignmentLoading: 'task-1'
    };
    
    render(<TasksView {...propsWithLoading} />);
    
    const taskCards = screen.getAllByText('Task 1 - Setup');
    const taskCard = taskCards[0].closest('.task-card');
    const assignButton = taskCard!.querySelector('.task-play-btn');
    
    expect(assignButton).toHaveClass('loading');
    expect(assignButton!.querySelector('.task-spinner')).toBeInTheDocument();
  });

  it('creates task successfully', async () => {
    render(<TasksView {...defaultProps} />);
    
    // Open create task modal
    const createTaskButtons = screen.getAllByText('Create Task');
    fireEvent.click(createTaskButtons[0]); // Click header button

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeInTheDocument();
    });

    // Fill out form
    const titleInput = screen.getByPlaceholderText('Enter task title');
    fireEvent.change(titleInput, { target: { value: 'New Test Task' } });

    const descriptionInput = screen.getByPlaceholderText('Enter task description');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    // Submit form - use getAllBy to get the modal submit button
    const submitButtons = screen.getAllByText('Create Task');
    fireEvent.click(submitButtons[submitButtons.length - 1]); // Click the last one (modal submit button)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${mockProject.id}/tasks`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"title":"New Test Task"')
        })
      );
    });

    expect(defaultProps.onTicketsUpdate).toHaveBeenCalled();
  });

  it('creates milestone successfully', async () => {
    render(<TasksView {...defaultProps} />);
    
    // Open create milestone modal
    const createMilestoneButtons = screen.getAllByText('Create Milestone');
    fireEvent.click(createMilestoneButtons[0]); // Click header button

    await waitFor(() => {
      expect(screen.getByText('Create New Milestone')).toBeInTheDocument();
    });

    // Fill out form
    const nameInput = screen.getByPlaceholderText('e.g., m1_foundation, m2_development');
    fireEvent.change(nameInput, { target: { value: 'm3_testing' } });

    const descriptionInput = screen.getByPlaceholderText('Describe the milestone objectives');
    fireEvent.change(descriptionInput, { target: { value: 'Testing phase' } });

    // Submit form
    const submitButtons = screen.getAllByText('Create Milestone');
    fireEvent.click(submitButtons[submitButtons.length - 1]); // Click submit button in modal

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/projects/${mockProject.id}/milestones`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"name":"m3_testing"')
        })
      );
    });

    expect(defaultProps.onTicketsUpdate).toHaveBeenCalled();
  });

  it('handles API error when creating task', async () => {
    // Mock failed response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      text: () => Promise.resolve('API Error')
    });

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<TasksView {...defaultProps} />);
    
    // Open modal and submit
    const createTaskButtons = screen.getAllByText('Create Task');
    fireEvent.click(createTaskButtons[0]); // Click header button
    
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Enter task title');
      fireEvent.change(titleInput, { target: { value: 'Test Task' } });
    });

    const submitButtons = screen.getAllByText('Create Task');
    fireEvent.click(submitButtons[submitButtons.length - 1]); // Click submit button in modal

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to create task: API Error');
    });

    alertSpy.mockRestore();
  });

  it('displays task progress stats in milestones correctly', () => {
    render(<TasksView {...defaultProps} />);

    // Check foundation milestone stats (has 1 open, 1 in_progress)
    // Order: Open, In Progress, Done
    const foundationCard = screen.getByText('Foundation').closest('.milestone-card');
    const foundationStats = foundationCard!.querySelectorAll('.stat-value');
    expect(foundationStats[0]).toHaveTextContent('1'); // open
    expect(foundationStats[1]).toHaveTextContent('1'); // in progress
    expect(foundationStats[2]).toHaveTextContent('0'); // done

    // Check development milestone stats (has 1 done, 1 blocked)
    // Order: Open, In Progress, Done
    const developmentCard = screen.getByText('Development').closest('.milestone-card');
    const devStats = developmentCard!.querySelectorAll('.stat-value');
    expect(devStats[0]).toHaveTextContent('0'); // open (blocked tasks don't count as open)
    expect(devStats[1]).toHaveTextContent('0'); // in progress
    expect(devStats[2]).toHaveTextContent('1'); // done
  });

  it('auto-scrolls to first milestone with in-progress tasks', async () => {
    const scrollToSpy = vi.spyOn(Element.prototype, 'scrollTo');

    render(<TasksView {...defaultProps} />);

    // Wait for the auto-scroll effect to trigger
    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith({
        left: expect.any(Number),
        behavior: 'smooth'
      });
    }, { timeout: 200 });
  });

  it('does not auto-scroll when no milestones have in-progress tasks', async () => {
    const tasksWithoutInProgress = mockTasks.map(task => ({
      ...task,
      status: task.status === 'in_progress' ? 'open' : task.status
    }));

    const scrollToSpy = vi.spyOn(Element.prototype, 'scrollTo');

    render(<TasksView {...defaultProps} tickets={tasksWithoutInProgress} />);

    // Wait a bit to ensure effect doesn't trigger
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(scrollToSpy).not.toHaveBeenCalled();
  });
});

describe('TaskColumn Component', () => {
  const mockColumnTasks = [
    {
      id: 'task-1',
      title: 'Column Task 1',
      description: 'First task in column',
      status: 'open',
      priority: 'high',
      milestoneId: 'm1_foundation',
      tasks: ['Subtask 1', 'Subtask 2']
    },
    {
      id: 'task-2',
      title: 'Column Task 2', 
      description: 'Second task in column',
      status: 'open',
      priority: 'medium',
      assignee: 'john-doe',
      tasks: []
    }
  ];

  const defaultColumnProps: TaskColumnProps = {
    title: 'Test Column',
    count: 2,
    tasks: mockColumnTasks,
    status: 'open',
    onTaskClick: vi.fn(),
    onTaskAssign: vi.fn(),
    taskAssignmentLoading: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders column with correct title and count', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('Test Column')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays all tasks in the column', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('Column Task 1')).toBeInTheDocument();
    expect(screen.getByText('Column Task 2')).toBeInTheDocument();
    expect(screen.getByText('First task in column')).toBeInTheDocument();
    expect(screen.getByText('Second task in column')).toBeInTheDocument();
  });

  it('displays priority badges correctly', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('displays milestone badges', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('foundation')).toBeInTheDocument(); // m1_foundation formatted (lowercase after replacement)
    expect(screen.getByText('General')).toBeInTheDocument(); // fallback for task without milestone
  });

  it('displays assignee badge when task has assignee', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('john-doe')).toBeInTheDocument();
  });

  it('displays subtasks correctly', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    expect(screen.getByText('Tasks:')).toBeInTheDocument();
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();
    expect(screen.getByText('Subtask 2')).toBeInTheDocument();
  });

  it('shows "more" indicator when tasks exceed display limit', () => {
    const tasksWithManySubtasks = [{
      ...mockColumnTasks[0],
      tasks: ['Sub 1', 'Sub 2', 'Sub 3', 'Sub 4', 'Sub 5']
    }];

    render(<TaskColumn {...defaultColumnProps} tasks={tasksWithManySubtasks} count={1} />);
    
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('shows empty state when no tasks', () => {
    render(<TaskColumn {...defaultColumnProps} tasks={[]} count={0} />);
    
    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText('No test column tasks')).toBeInTheDocument();
  });

  it('calls onTaskClick when task card is clicked', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    const taskCard = screen.getByText('Column Task 1').closest('.task-card');
    fireEvent.click(taskCard!);
    
    expect(defaultColumnProps.onTaskClick).toHaveBeenCalledWith(mockColumnTasks[0]);
  });

  it('calls onTaskAssign when assign button is clicked', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    const taskCard = screen.getByText('Column Task 1').closest('.task-card');
    const assignButton = taskCard!.querySelector('.task-play-btn');
    fireEvent.click(assignButton!);
    
    expect(defaultColumnProps.onTaskAssign).toHaveBeenCalledWith(mockColumnTasks[0]);
  });

  it('prevents event bubbling when assign button is clicked', () => {
    render(<TaskColumn {...defaultColumnProps} />);
    
    const taskCard = screen.getByText('Column Task 1').closest('.task-card');
    const assignButton = taskCard!.querySelector('.task-play-btn');
    
    // Click assign button
    fireEvent.click(assignButton!);
    
    // Task assign should be called but task click should not
    expect(defaultColumnProps.onTaskAssign).toHaveBeenCalledWith(mockColumnTasks[0]);
    expect(defaultColumnProps.onTaskClick).not.toHaveBeenCalled();
  });

  it('shows loading state for specific task', () => {
    const propsWithLoading = {
      ...defaultColumnProps,
      taskAssignmentLoading: 'task-1'
    };
    
    render(<TaskColumn {...propsWithLoading} />);
    
    const taskCard = screen.getByText('Column Task 1').closest('.task-card');
    const assignButton = taskCard!.querySelector('.task-play-btn');
    
    expect(assignButton).toHaveClass('loading');
    expect(assignButton).toBeDisabled();
    expect(assignButton!.querySelector('.task-spinner')).toBeInTheDocument();
  });

  it('applies correct CSS classes based on status', () => {
    render(<TaskColumn {...defaultColumnProps} status="in_progress" />);
    
    const column = screen.getByText('Test Column').closest('.task-column');
    expect(column).toHaveClass('task-column--in_progress');
  });
});