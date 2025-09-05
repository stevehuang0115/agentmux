import React from 'react';
import { KanbanTask } from './KanbanBoard';

interface KanbanCardProps {
  task: KanbanTask;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd
}) => {
  const getPriorityColor = (priority: KanbanTask['priority']) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDueDate = (dueDate?: string) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else if (diffDays <= 7) {
      return `Due in ${diffDays} days`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      className="kanban-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="card-header">
        <div className="card-title">
          <h4>{task.title}</h4>
          <div
            className="priority-indicator"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
            title={`Priority: ${task.priority}`}
          />
        </div>
        
        <div className="card-actions">
          <button
            className="action-button edit-button"
            onClick={onEdit}
            title="Edit task"
          >
            ✏️
          </button>
          <button
            className="action-button delete-button"
            onClick={onDelete}
            title="Delete task"
          >
            🗑️
          </button>
        </div>
      </div>

      {task.description && (
        <div className="card-description">
          <p>{task.description}</p>
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="card-tags">
          {task.tags.map((tag, index) => (
            <span key={index} className="task-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="card-footer">
        <div className="card-meta">
          {task.assignee && (
            <div className="assignee">
              <span className="assignee-avatar">
                {task.assignee.charAt(0).toUpperCase()}
              </span>
              <span className="assignee-name">{task.assignee}</span>
            </div>
          )}
          
          {task.dueDate && (
            <div className={`due-date ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
              📅 {formatDueDate(task.dueDate)}
            </div>
          )}
        </div>

        <div className="card-timestamp">
          Updated {new Date(task.updatedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};