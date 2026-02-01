/**
 * SkillsTab Component
 *
 * Full skill management interface in Settings.
 * Provides filtering, CRUD operations, and skill execution.
 *
 * @module components/Settings/SkillsTab
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useSkills, type UseSkillsOptions } from '../../hooks/useSkills';
import type {
  Skill,
  SkillSummary,
  SkillCategory,
} from '../../types/skill.types';
import type { CreateSkillInput } from '../../services/skills.service';
import { getSkillCategoryLabel } from '../../types/skill.types';
import './SkillsTab.css';

/**
 * Build category options from skill types for consistency
 */
const buildCategoryOptions = (): { value: SkillCategory | ''; label: string }[] => {
  const categories: SkillCategory[] = [
    'development',
    'design',
    'communication',
    'research',
    'content-creation',
    'automation',
    'analysis',
    'integration',
  ];
  return [
    { value: '', label: 'All Categories' },
    ...categories.map((cat) => ({
      value: cat,
      label: getSkillCategoryLabel(cat),
    })),
  ];
};

/**
 * Category filter options derived from skill types
 */
const CATEGORY_OPTIONS = buildCategoryOptions();

/**
 * SkillsTab component for managing skills
 *
 * @returns SkillsTab component
 */
export const SkillsTab: React.FC = () => {
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillSummary | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Build hook options
  const hookOptions: UseSkillsOptions = useMemo(
    () => ({
      category: categoryFilter || undefined,
      search: searchQuery || undefined,
    }),
    [categoryFilter, searchQuery]
  );

  // Fetch skills
  const { skills, loading, error, refresh, create, update, remove } =
    useSkills(hookOptions);

  /**
   * Handle creating a new skill
   */
  const handleCreate = useCallback((): void => {
    setEditingSkill(null);
    setShowEditor(true);
  }, []);

  /**
   * Handle editing a skill
   */
  const handleEdit = useCallback((skill: SkillSummary): void => {
    setEditingSkill(skill);
    setShowEditor(true);
  }, []);

  /**
   * Handle saving skill (create or update)
   */
  const handleSave = useCallback(
    async (skillData: CreateSkillInput): Promise<void> => {
      try {
        if (editingSkill?.id) {
          await update(editingSkill.id, skillData);
        } else {
          await create(skillData);
        }
        setShowEditor(false);
        setEditingSkill(null);
      } catch (err) {
        console.error('Failed to save skill:', err);
      }
    },
    [editingSkill, update, create]
  );

  /**
   * Handle deleting a skill
   */
  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      try {
        await remove(id);
        setShowDeleteConfirm(null);
      } catch (err) {
        console.error('Failed to delete skill:', err);
      }
    },
    [remove]
  );

  return (
    <div className="skills-tab">
      <div className="skills-header">
        <h2>Skills Management</h2>
        <button className="btn-primary" onClick={handleCreate}>
          + New Skill
        </button>
      </div>

      {/* Filters */}
      <div className="skills-filters">
        <div className="filter-group">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as SkillCategory | '')}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="search-filter">Search</label>
          <input
            id="search-filter"
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="btn-secondary" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="error-banner">
          <span>Error: {error}</span>
          <button onClick={refresh}>Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading && skills.length === 0 && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading skills...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && skills.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>No Skills Found</h3>
          <p>
            {searchQuery || categoryFilter
              ? 'Try adjusting your filters'
              : 'Create your first skill to get started'}
          </p>
          {!searchQuery && !categoryFilter && (
            <button className="btn-primary" onClick={handleCreate}>
              Create Skill
            </button>
          )}
        </div>
      )}

      {/* Skills grid */}
      {skills.length > 0 && (
        <div className="skills-grid">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => handleEdit(skill)}
              onDelete={() => setShowDeleteConfirm(skill.id)}
            />
          ))}
        </div>
      )}

      {/* Skill Editor Modal */}
      {showEditor && (
        <SkillEditorModal
          skill={editingSkill}
          onSave={handleSave}
          onClose={() => {
            setShowEditor(false);
            setEditingSkill(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmModal
          skillId={showDeleteConfirm}
          skillName={skills.find((s) => s.id === showDeleteConfirm)?.name || ''}
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

// =============================================================================
// Skill Card Component
// =============================================================================

/**
 * Props for SkillCard component
 */
interface SkillCardProps {
  /** Skill to display */
  skill: SkillSummary;
  /** Called when edit is clicked */
  onEdit: () => void;
  /** Called when delete is clicked */
  onDelete: () => void;
}

/**
 * Card component for displaying a skill
 */
const SkillCard: React.FC<SkillCardProps> = ({ skill, onEdit, onDelete }) => {
  return (
    <div className="skill-card">
      <div className="skill-card-header">
        <h3>{skill.name}</h3>
        <span className={`category-badge category-${skill.category}`}>
          {getSkillCategoryLabel(skill.category)}
        </span>
      </div>

      <p className="skill-description">{skill.description}</p>

      <div className="skill-meta">
        <span className={`execution-type ${skill.executionType}`}>
          {skill.executionType}
        </span>
        <span className={`status-indicator ${skill.isEnabled ? 'enabled' : 'disabled'}`}>
          {skill.isEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="skill-card-footer">
        {skill.isBuiltin && <span className="builtin-badge">Built-in</span>}
        <div className="skill-actions">
          <button className="btn-icon" onClick={onEdit} title="Edit">
            ✏️
          </button>
          {!skill.isBuiltin && (
            <button className="btn-icon btn-danger" onClick={onDelete} title="Delete">
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Skill Editor Modal
// =============================================================================

/**
 * Props for SkillEditorModal component
 */
interface SkillEditorModalProps {
  /** Skill to edit (null for create) */
  skill: SkillSummary | null;
  /** Called when save is clicked */
  onSave: (data: CreateSkillInput) => Promise<void>;
  /** Called when close is clicked */
  onClose: () => void;
}

/**
 * Modal for creating or editing a skill
 */
const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  skill,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<CreateSkillInput>({
    name: skill?.name || '',
    displayName: skill?.name || '',
    description: skill?.description || '',
    category: skill?.category || 'development',
    promptContent: '',
    triggers: [],
    tags: [],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);

    // Validate required fields
    if (!formData.displayName.trim()) {
      setFormError('Display Name is required');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('ID is required');
      return;
    }
    if (!formData.description.trim()) {
      setFormError('Description is required');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle overlay click
   */
  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{skill ? 'Edit Skill' : 'Create Skill'}</h2>
          <button className="btn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {formError && <div className="form-error">{formError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="skill-display-name">Display Name *</label>
            <input
              id="skill-display-name"
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Code Review"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="skill-name">ID *</label>
            <input
              id="skill-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="code-review"
              required
              disabled={!!skill}
            />
            <p className="form-hint">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div className="form-group">
            <label htmlFor="skill-description">Description *</label>
            <textarea
              id="skill-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe what this skill does..."
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="skill-category">Category</label>
            <select
              id="skill-category"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value as SkillCategory })
              }
            >
              {CATEGORY_OPTIONS.filter((o) => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="skill-prompt">Instructions (Markdown)</label>
            <textarea
              id="skill-prompt"
              value={formData.promptContent}
              onChange={(e) =>
                setFormData({ ...formData, promptContent: e.target.value })
              }
              placeholder="# Skill Instructions&#10;&#10;Provide detailed instructions for this skill..."
              rows={6}
              className="prompt-editor"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// Delete Confirmation Modal
// =============================================================================

/**
 * Props for DeleteConfirmModal component
 */
interface DeleteConfirmModalProps {
  /** ID of skill to delete */
  skillId: string;
  /** Name of skill to delete */
  skillName: string;
  /** Called when delete is confirmed */
  onConfirm: () => void;
  /** Called when cancel is clicked */
  onCancel: () => void;
}

/**
 * Modal for confirming skill deletion
 */
const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  skillName,
  onConfirm,
  onCancel,
}) => {
  /**
   * Handle overlay click
   */
  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-content modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Delete Skill</h2>
        </div>

        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{skillName}</strong>? This
            action cannot be undone.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkillsTab;
