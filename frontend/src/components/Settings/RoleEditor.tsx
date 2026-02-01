/**
 * RoleEditor Component
 *
 * Modal dialog for creating or editing roles.
 *
 * @module components/Settings/RoleEditor
 */

import React, { useState, useEffect } from 'react';
import { useRole } from '../../hooks/useRole';
import { useSkills } from '../../hooks/useSkills';
import {
  CreateRoleInput,
  UpdateRoleInput,
  RoleCategory,
  ROLE_CATEGORIES,
  ROLE_CATEGORY_DISPLAY_NAMES,
} from '../../types/role.types';
import './RoleEditor.css';

/**
 * Props for RoleEditor component
 */
interface RoleEditorProps {
  /** Role ID to edit (null for creating new role) */
  roleId: string | null;
  /** Called when editor should close */
  onClose: () => void;
  /** Called when role is saved */
  onSave: (input: CreateRoleInput | UpdateRoleInput) => Promise<void>;
}

/**
 * Form data structure
 */
interface FormData {
  name: string;
  displayName: string;
  description: string;
  category: RoleCategory;
  systemPromptContent: string;
  assignedSkills: string[];
  isDefault: boolean;
}

/**
 * Modal dialog for creating or editing roles
 *
 * @param props - Component props
 * @returns RoleEditor component
 */
export const RoleEditor: React.FC<RoleEditorProps> = ({
  roleId,
  onClose,
  onSave,
}) => {
  const { role, isLoading } = useRole(roleId);
  const { skills } = useSkills();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    displayName: '',
    description: '',
    category: 'development',
    systemPromptContent: '',
    assignedSkills: [],
    isDefault: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreating = roleId === null;
  const isBuiltin = role?.isBuiltin ?? false;
  const isReadOnly = isBuiltin && !isCreating;

  // Populate form when role is loaded
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        category: role.category,
        systemPromptContent: role.systemPromptContent || '',
        assignedSkills: role.assignedSkills,
        isDefault: role.isDefault,
      });
    }
  }, [role]);

  /**
   * Handle form field change
   */
  const handleChange = (
    field: keyof FormData,
    value: string | boolean | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  /**
   * Handle skill checkbox toggle
   */
  const handleSkillToggle = (skillId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedSkills: prev.assignedSkills.includes(skillId)
        ? prev.assignedSkills.filter((id) => id !== skillId)
        : [...prev.assignedSkills, skillId],
    }));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (isCreating) {
        await onSave({
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description,
          category: formData.category,
          systemPromptContent: formData.systemPromptContent,
          assignedSkills: formData.assignedSkills,
          isDefault: formData.isDefault,
        } as CreateRoleInput);
      } else {
        await onSave({
          displayName: formData.displayName,
          description: formData.description,
          category: formData.category,
          systemPromptContent: formData.systemPromptContent,
          assignedSkills: formData.assignedSkills,
          isDefault: formData.isDefault,
        } as UpdateRoleInput);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle overlay click (close modal)
   */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (isLoading && roleId) {
    return (
      <div className="role-editor-overlay" onClick={handleOverlayClick}>
        <div className="role-editor-modal">
          <p className="loading-text">Loading role...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="role-editor-overlay" onClick={handleOverlayClick}>
      <div className="role-editor-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>
            {isCreating ? 'Create Role' : isReadOnly ? 'View Role' : 'Edit Role'}
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Basic Information</h3>

            <div className="form-row">
              <label htmlFor="displayName">Display Name *</label>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                disabled={isReadOnly}
                required
                placeholder="e.g., Senior Developer"
              />
            </div>

            {isCreating && (
              <div className="form-row">
                <label htmlFor="name">Internal Name *</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    handleChange(
                      'name',
                      e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                    )
                  }
                  pattern="[a-z0-9-]+"
                  required
                  placeholder="e.g., senior-developer"
                />
                <p className="hint">Lowercase letters, numbers, and hyphens only</p>
              </div>
            )}

            <div className="form-row">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isReadOnly}
                rows={2}
                placeholder="Brief description of this role's responsibilities"
              />
            </div>

            <div className="form-row">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as RoleCategory)}
                disabled={isReadOnly}
              >
                {ROLE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {ROLE_CATEGORY_DISPLAY_NAMES[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row checkbox-row">
              <input
                id="isDefault"
                type="checkbox"
                checked={formData.isDefault}
                onChange={(e) => handleChange('isDefault', e.target.checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="isDefault">Set as default role</label>
            </div>
          </div>

          <div className="form-section">
            <h3>System Prompt</h3>
            <div className="form-row">
              <textarea
                id="systemPrompt"
                value={formData.systemPromptContent}
                onChange={(e) => handleChange('systemPromptContent', e.target.value)}
                disabled={isReadOnly}
                rows={10}
                placeholder="# Role Name\n\nYou are a..."
                className="prompt-editor"
              />
              <p className="hint">
                Markdown supported. This prompt defines the agent's behavior.
              </p>
            </div>
          </div>

          <div className="form-section">
            <h3>Assigned Skills</h3>
            <div className="skills-grid">
              {skills?.map((skill) => (
                <label key={skill.id} className="skill-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.assignedSkills.includes(skill.id)}
                    onChange={() => handleSkillToggle(skill.id)}
                    disabled={isReadOnly}
                  />
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-description">{skill.description}</span>
                </label>
              ))}
              {(!skills || skills.length === 0) && (
                <p className="empty-skills">
                  No skills available. Create skills in the Skills tab.
                </p>
              )}
            </div>
          </div>

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="btn-primary"
                disabled={isSaving}
              >
                {isSaving
                  ? 'Saving...'
                  : isCreating
                  ? 'Create Role'
                  : 'Save Changes'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
};

export default RoleEditor;
