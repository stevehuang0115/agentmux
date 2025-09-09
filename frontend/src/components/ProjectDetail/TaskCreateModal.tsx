import React, { useState } from 'react';
import { FormPopup, FormGroup, FormLabel, FormInput, FormTextarea, FormRow, Dropdown } from '../UI';
import { TaskCreateModalProps, TaskCreateFormData } from './types';

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<TaskCreateFormData>({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Task title is required');
      return;
    }
    
    onSubmit({
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      assignedTo: formData.assignedTo.trim() || undefined
    });
  };

  const handleChange = (field: keyof TaskCreateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <FormPopup
      isOpen={true}
      onClose={onClose}
      title="Create New Task"
      subtitle="Add a new task to the project backlog"
      onSubmit={handleSubmit}
      submitText="Create Task"
      size="md"
    >
      <FormGroup>
        <FormLabel htmlFor="title" required>
          Task Title
        </FormLabel>
        <FormInput
          id="title"
          value={formData.title}
          onChange={e => handleChange('title', e.target.value)}
          placeholder="Enter task title..."
          required
        />
      </FormGroup>

      <FormGroup>
        <FormLabel htmlFor="description">
          Description
        </FormLabel>
        <FormTextarea
          id="description"
          value={formData.description}
          onChange={e => handleChange('description', e.target.value)}
          placeholder="Enter task description..."
          rows={4}
        />
      </FormGroup>

      <FormRow>
        <FormGroup>
          <FormLabel htmlFor="priority">
            Priority
          </FormLabel>
          <Dropdown
            id="priority"
            value={formData.priority}
            onChange={(value) => handleChange('priority', value as 'low' | 'medium' | 'high')}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }
            ]}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel htmlFor="assignedTo">
            Assign To
          </FormLabel>
          <FormInput
            id="assignedTo"
            value={formData.assignedTo}
            onChange={e => handleChange('assignedTo', e.target.value)}
            placeholder="Team member name..."
          />
        </FormGroup>
      </FormRow>
    </FormPopup>
  );
};

export default TaskCreateModal;
export { TaskCreateModal };