import React, { useState } from 'react';
import { Plus, FolderOpen, Play } from 'lucide-react';
import { Project } from '../../types';
import { 
  Button, 
  FormPopup, 
  FormGroup, 
  FormRow, 
  FormLabel, 
  FormInput, 
  FormTextarea,
  FormHelp 
} from '../UI';
import { TasksViewProps, TaskColumnProps, TaskFormData, MilestoneFormData } from './types';

export const TasksView: React.FC<TasksViewProps> = ({ 
  project, 
  tickets, 
  onTicketsUpdate, 
  onCreateSpecsTasks, 
  onCreateDevTasks, 
  onCreateE2ETasks, 
  loading, 
  onTaskClick, 
  onTaskAssign, 
  taskAssignmentLoading 
}) => {
  const [selectedMilestoneFilter, setSelectedMilestoneFilter] = useState<string | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMilestoneModalOpen, setIsCreateMilestoneModalOpen] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState<TaskFormData>({
    title: '',
    status: 'open',
    priority: 'medium',
    targetRole: '',
    milestone: '',
    description: ''
  });
  const [createMilestoneForm, setCreateMilestoneForm] = useState<MilestoneFormData>({
    name: '',
    description: ''
  });
  
  // Filter tickets based on selected milestone
  const filteredTickets = selectedMilestoneFilter 
    ? tickets.filter(t => (t.milestone || t.milestoneId || 'Uncategorized') === selectedMilestoneFilter)
    : tickets;
  
  // Group tasks by status for kanban board
  const tasksByStatus = {
    open: filteredTickets.filter(t => t.status === 'open' || t.status === 'pending'),
    in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
    done: filteredTickets.filter(t => t.status === 'done' || t.status === 'completed'),
    blocked: filteredTickets.filter(t => t.status === 'blocked')
  };

  // Group tasks by milestone for milestone view
  const tasksByMilestone = tickets.reduce((acc, task) => {
    const milestone = task.milestone || task.milestoneId || 'Uncategorized';
    if (!acc[milestone]) {
      acc[milestone] = [];
    }
    acc[milestone].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  // Helper function to extract sequence number from milestone name
  const getMilestoneSequence = (milestone: string): number => {
    const match = milestone.match(/^m(\d+)/i);
    return match ? parseInt(match[1], 10) : 999; // Put uncategorized at end
  };

  // Sort milestones by sequence number
  const sortedMilestones = Object.entries(tasksByMilestone).sort(([a], [b]) => {
    return getMilestoneSequence(a) - getMilestoneSequence(b);
  });

  // Get available milestones for form dropdown
  const availableMilestones = Object.keys(tasksByMilestone);

  // Handle Create Task
  const handleCreateTask = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createTaskForm),
      });

      if (response.ok) {
        setIsCreateTaskModalOpen(false);
        setCreateTaskForm({
          title: '',
          status: 'open',
          priority: 'medium',
          targetRole: '',
          milestone: '',
          description: ''
        });
        onTicketsUpdate(); // Refresh tasks
      } else {
        const error = await response.text();
        alert('Failed to create task: ' + error);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task');
    }
  };

  // Handle Create Milestone
  const handleCreateMilestone = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createMilestoneForm),
      });

      if (response.ok) {
        setIsCreateMilestoneModalOpen(false);
        setCreateMilestoneForm({
          name: '',
          description: ''
        });
        onTicketsUpdate(); // Refresh tasks
      } else {
        const error = await response.text();
        alert('Failed to create milestone: ' + error);
      }
    } catch (error) {
      console.error('Error creating milestone:', error);
      alert('Failed to create milestone');
    }
  };

  return (
    <div className="tasks-view">
      <div className="tasks-header">
        <div className="tasks-title-section">
          <h3>Project Tasks ({tickets.length})</h3>
          <div className="tasks-info">
            <span className="tasks-summary">
              {Object.keys(tasksByMilestone).length} Milestones • {tickets.length} Tasks
            </span>
          </div>
        </div>
        
        <div className="task-creation-controls">
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setIsCreateTaskModalOpen(true)}
            title="Create a new task"
          >
            Create Task
          </Button>
          <Button
            variant="secondary"
            icon={FolderOpen}
            onClick={() => setIsCreateMilestoneModalOpen(true)}
            title="Create a new milestone"
          >
            Create Milestone
          </Button>
        </div>
      </div>
      
      {/* Milestone Overview */}
      <div className="milestones-section">
        <div className="milestones-header">
          <h4>Milestones Overview</h4>
          {selectedMilestoneFilter && (
            <Button
              variant="secondary"
              onClick={() => setSelectedMilestoneFilter(null)}
              title="Clear milestone filter"
            >
              Clear Filter
            </Button>
          )}
        </div>
        <div className="milestones-grid">
          {sortedMilestones.map(([milestone, tasks]: [string, any[]], index) => {
            const sequenceNumber = getMilestoneSequence(milestone);
            const displayNumber = sequenceNumber !== 999 ? sequenceNumber : null;
            
            return (
              <div 
                key={milestone} 
                className={`milestone-card milestone-card-compact ${selectedMilestoneFilter === milestone ? 'milestone-card--active' : ''}`}
                onClick={() => setSelectedMilestoneFilter(selectedMilestoneFilter === milestone ? null : milestone)}
              >
                <div className="milestone-header">
                  <h5 className="milestone-title">
                    {displayNumber !== null && <span className="milestone-sequence">{displayNumber}. </span>}
                    {milestone.replace(/_/g, ' ').replace(/^m\d+\s*/, '').replace(/^\w/, c => c.toUpperCase())}
                  </h5>
                  <span className="milestone-count">{tasks.length} tasks</span>
                </div>
                <div className="milestone-progress">
                  <div className="progress-stats">
                    <span className="stat">
                      <span className="stat-value">{tasks.filter(t => t.status === 'done').length}</span>
                      <span className="stat-label">Done</span>
                    </span>
                    <span className="stat">
                      <span className="stat-value">{tasks.filter(t => t.status === 'in_progress').length}</span>
                      <span className="stat-label">In Progress</span>
                    </span>
                    <span className="stat">
                      <span className="stat-value">{tasks.filter(t => t.status === 'open' || t.status === 'pending').length}</span>
                      <span className="stat-label">Open</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-section">
        <h4>Task Board</h4>
        <div className="kanban-board">
          <TaskColumn
            title="Open"
            count={tasksByStatus.open.length}
            tasks={tasksByStatus.open}
            status="open"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="In Progress"
            count={tasksByStatus.in_progress.length}
            tasks={tasksByStatus.in_progress}
            status="in_progress"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="Done"
            count={tasksByStatus.done.length}
            tasks={tasksByStatus.done}
            status="done"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
          <TaskColumn
            title="Blocked"
            count={tasksByStatus.blocked.length}
            tasks={tasksByStatus.blocked}
            status="blocked"
            onTaskClick={onTaskClick}
            onTaskAssign={onTaskAssign}
            taskAssignmentLoading={taskAssignmentLoading}
          />
        </div>
      </div>

      {/* Create Task Modal */}
      <FormPopup
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onSubmit={handleCreateTask}
        title="Create New Task"
        submitText="Create Task"
      >
        <FormGroup>
          <FormRow>
            <div>
              <FormLabel>Title</FormLabel>
              <FormInput
                type="text"
                value={createTaskForm.title}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, title: e.target.value })}
                placeholder="Enter task title"
                required
              />
            </div>
          </FormRow>
          <FormRow>
            <div>
              <FormLabel>Status</FormLabel>
              <select
                value={createTaskForm.status}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, status: e.target.value })}
                className="form-input"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div>
              <FormLabel>Priority</FormLabel>
              <select
                value={createTaskForm.priority}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, priority: e.target.value })}
                className="form-input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </FormRow>
          <FormRow>
            <div>
              <FormLabel>Target Role</FormLabel>
              <FormInput
                type="text"
                value={createTaskForm.targetRole}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, targetRole: e.target.value })}
                placeholder="e.g., frontend-developer, backend-developer, qa"
              />
            </div>
            <div>
              <FormLabel>Milestone</FormLabel>
              <select
                value={createTaskForm.milestone}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, milestone: e.target.value })}
                className="form-input"
              >
                <option value="">Select milestone</option>
                {availableMilestones.map(milestone => (
                  <option key={milestone} value={milestone}>{milestone}</option>
                ))}
              </select>
            </div>
          </FormRow>
          <FormRow>
            <div>
              <FormLabel>Description</FormLabel>
              <FormTextarea
                value={createTaskForm.description}
                onChange={(e) => setCreateTaskForm({ ...createTaskForm, description: e.target.value })}
                placeholder="Enter task description"
                rows={4}
              />
            </div>
          </FormRow>
        </FormGroup>
      </FormPopup>

      {/* Create Milestone Modal */}
      <FormPopup
        isOpen={isCreateMilestoneModalOpen}
        onClose={() => setIsCreateMilestoneModalOpen(false)}
        onSubmit={handleCreateMilestone}
        title="Create New Milestone"
        submitText="Create Milestone"
      >
        <FormGroup>
          <FormRow>
            <div>
              <FormLabel>Milestone Name</FormLabel>
              <FormInput
                type="text"
                value={createMilestoneForm.name}
                onChange={(e) => setCreateMilestoneForm({ ...createMilestoneForm, name: e.target.value })}
                placeholder="e.g., m1_foundation, m2_development"
                required
              />
              <FormHelp>
                Use format like m0_*, m1_*, etc. This will create the folder structure for task organization.
              </FormHelp>
            </div>
          </FormRow>
          <FormRow>
            <div>
              <FormLabel>Description</FormLabel>
              <FormTextarea
                value={createMilestoneForm.description}
                onChange={(e) => setCreateMilestoneForm({ ...createMilestoneForm, description: e.target.value })}
                placeholder="Describe the milestone objectives"
                rows={3}
              />
            </div>
          </FormRow>
        </FormGroup>
      </FormPopup>
    </div>
  );
};

// Task Column Component for the new task system
export const TaskColumn: React.FC<TaskColumnProps> = ({ 
  title, 
  count, 
  tasks, 
  status, 
  onTaskClick, 
  onTaskAssign, 
  taskAssignmentLoading 
}) => {
  return (
    <div className={`task-column task-column--${status}`}>
      <div className="column-header">
        <h4 className="column-title">{title}</h4>
        <span className="task-count">{count}</span>
      </div>
      <div className="column-content">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className="task-card task-card-clickable" 
            onClick={() => onTaskClick(task)}
          >
            <div className="task-header">
              <h5 className="task-title">{task.title}</h5>
              <div className="task-actions">
                <button
                  className={`task-play-btn ${taskAssignmentLoading === task.id ? 'loading' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskAssign(task);
                  }}
                  disabled={taskAssignmentLoading === task.id}
                  title="Assign this task to the orchestrator team"
                >
                  {taskAssignmentLoading === task.id ? (
                    <div className="task-spinner" />
                  ) : (
                    <Play className="task-play-icon" />
                  )}
                </button>
                <div className="task-badges">
                  {task.priority && (
                    <span className={`priority-badge priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="task-description">{task.description}</p>
            
            <div className="task-meta">
              <div className="task-milestone">
                <span className="milestone-badge">
                  {task.milestoneId?.replace(/_/g, ' ').replace(/^m\d+\s*/, '') || 'General'}
                </span>
              </div>
              {task.assignee && (
                <div className="task-assignee">
                  <span className="assignee-badge">
                    {task.assignee}
                  </span>
                </div>
              )}
            </div>

            {task.tasks && task.tasks.length > 0 && (
              <div className="task-subtasks">
                <div className="subtasks-header">
                  <span className="subtasks-title">Tasks:</span>
                </div>
                <div className="subtasks-list">
                  {task.tasks.slice(0, 3).map((subtask: string, index: number) => (
                    <div key={index} className="subtask-item">
                      <span className="subtask-text">{subtask.replace(/^\[x\]\s*|\[\s*\]\s*/i, '')}</span>
                    </div>
                  ))}
                  {task.tasks.length > 3 && (
                    <div className="subtask-more">
                      +{task.tasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="column-empty-state">
            <div className="column-empty-icon">📋</div>
            <p>No {title.toLowerCase()} tasks</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Default export
export default TasksView;