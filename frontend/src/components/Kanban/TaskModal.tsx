import React, { useState, useEffect } from 'react';
import { KanbanTask } from './KanbanBoard';

interface TaskModalProps {
  task?: KanbanTask | null;
  onSubmit: (taskData: Omit<KanbanTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ task, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo' as KanbanTask['status'],
    priority: 'medium' as KanbanTask['priority'],
    assignee: '',
    tags: [] as string[],
    dueDate: '',
    teamId: '',
    projectId: ''
  });
  const [tagInput, setTagInput] = useState('');
  const [availableAssignees, setAvailableAssignees] = useState<string[]>([]);
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [availableProjects, setAvailableProjects] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchAvailableOptions();
    
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee || '',
        tags: task.tags,
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        teamId: task.teamId || '',
        projectId: task.projectId || ''
      });
    }
  }, [task]);

  const fetchAvailableOptions = async () => {
    try {
      // Fetch available assignees (team members)
      const assigneesResponse = await fetch('/api/users');
      if (assigneesResponse.ok) {
        const assigneesData = await assigneesResponse.json();
        setAvailableAssignees(assigneesData.map((user: any) => user.name));
      }

      // Fetch available teams
      const teamsResponse = await fetch('/api/teams');
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        setAvailableTeams(teamsData);
      }

      // Fetch available projects
      const projectsResponse = await fetch('/api/projects');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setAvailableProjects(projectsData);
      }
    } catch (error) {
      console.error('Error fetching available options:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tagInput.trim()]
        }));
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    onSubmit({
      ...formData,
      dueDate: formData.dueDate || undefined
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content task-modal">
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'Create New Task'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Task title"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Task description"
                rows={4}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="assignee">Assignee</label>
              <select
                id="assignee"
                name="assignee"
                value={formData.assignee}
                onChange={handleInputChange}
              >
                <option value="">Unassigned</option>
                {availableAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="teamId">Team</label>
              <select
                id="teamId"
                name="teamId"
                value={formData.teamId}
                onChange={handleInputChange}
              >
                <option value="">Select Team</option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="projectId">Project</label>
              <select
                id="projectId"
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
              >
                <option value="">Select Project</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tags">Tags</label>
              <input
                type="text"
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag and press Enter"
              />
              <div className="tags-container">
                {formData.tags.map((tag) => (
                  <span key={tag} className="tag-item">
                    {tag}
                    <button
                      type="button"
                      className="remove-tag"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={!formData.title.trim()}
            >
              {task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};