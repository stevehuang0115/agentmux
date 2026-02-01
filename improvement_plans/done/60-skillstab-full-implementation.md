# Task 60: SkillsTab Full Implementation

## Overview

Remove the "Coming in Sprint 2" placeholder and implement full skill management functionality in the SkillsTab component.

## Problem

The SkillsTab component shows a placeholder badge and limited functionality instead of full skill management.

## Current State

```typescript
// frontend/src/components/Settings/SkillsTab.tsx
<p className="coming-soon-badge">Coming in Sprint 2</p>
```

The component:
- Shows "Coming in Sprint 2" badge
- Has basic skill list but limited interactivity
- Missing skill creation, editing, and deletion

## Implementation

### Update SkillsTab Component

**`frontend/src/components/Settings/SkillsTab.tsx`**

```typescript
/**
 * SkillsTab Component
 *
 * Full skill management interface in Settings.
 *
 * @module components/Settings/SkillsTab
 */

import React, { useState, useMemo } from 'react';
import { useSkills, type UseSkillsOptions } from '../../hooks/useSkills.js';
import type { Skill, SkillSummary, SkillCategory } from '../../types/skill.types.js';
import './SkillsTab.css';

/**
 * Category filter options
 */
const CATEGORY_OPTIONS: { value: SkillCategory | ''; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'communication', label: 'Communication' },
  { value: 'research', label: 'Research' },
  { value: 'content-creation', label: 'Content Creation' },
  { value: 'automation', label: 'Automation' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'integration', label: 'Integration' },
];

/**
 * SkillsTab component for managing skills
 */
export const SkillsTab: React.FC = () => {
  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Build hook options
  const hookOptions: UseSkillsOptions = useMemo(() => ({
    category: categoryFilter || undefined,
    search: searchQuery || undefined,
  }), [categoryFilter, searchQuery]);

  // Fetch skills
  const {
    skills,
    selectedSkill,
    loading,
    error,
    refresh,
    selectSkill,
    clearSelection,
    create,
    update,
    remove,
  } = useSkills(hookOptions);

  /**
   * Handle creating a new skill
   */
  const handleCreate = (): void => {
    setEditingSkill(null);
    setShowEditor(true);
  };

  /**
   * Handle editing a skill
   */
  const handleEdit = async (id: string): Promise<void> => {
    await selectSkill(id);
    setEditingSkill(selectedSkill);
    setShowEditor(true);
  };

  /**
   * Handle saving skill (create or update)
   */
  const handleSave = async (skillData: Partial<Skill>): Promise<void> => {
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
      // TODO: Show error toast
    }
  };

  /**
   * Handle deleting a skill
   */
  const handleDelete = async (id: string): Promise<void> => {
    try {
      await remove(id);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete skill:', err);
      // TODO: Show error toast
    }
  };

  /**
   * Get category badge class
   */
  const getCategoryClass = (category: string): string => {
    return `category-badge category-${category}`;
  };

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
          <span>⚠️ {error}</span>
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
              onEdit={() => handleEdit(skill.id)}
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
          skillName={skills.find((s) => s.id === showDeleteConfirm)?.displayName || ''}
          onConfirm={() => handleDelete(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

/**
 * Skill card component
 */
interface SkillCardProps {
  skill: SkillSummary;
  onEdit: () => void;
  onDelete: () => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, onEdit, onDelete }) => {
  return (
    <div className="skill-card">
      <div className="skill-card-header">
        <h3>{skill.displayName}</h3>
        <span className={`category-badge category-${skill.category}`}>
          {skill.category}
        </span>
      </div>

      <p className="skill-description">{skill.description}</p>

      {skill.tags && skill.tags.length > 0 && (
        <div className="skill-tags">
          {skill.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

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

/**
 * Skill editor modal
 */
interface SkillEditorModalProps {
  skill: Skill | null;
  onSave: (data: Partial<Skill>) => Promise<void>;
  onClose: () => void;
}

const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  skill,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<Partial<Skill>>(
    skill || {
      name: '',
      displayName: '',
      description: '',
      category: 'development',
      promptFile: '',
      tags: [],
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{skill ? 'Edit Skill' : 'Create Skill'}</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="skill-name">Name (ID)</label>
            <input
              id="skill-name"
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="code-review"
              required
              disabled={!!skill}
            />
          </div>

          <div className="form-group">
            <label htmlFor="skill-display-name">Display Name</label>
            <input
              id="skill-display-name"
              type="text"
              value={formData.displayName || ''}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Code Review"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="skill-description">Description</label>
            <textarea
              id="skill-description"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this skill does..."
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="skill-category">Category</label>
            <select
              id="skill-category"
              value={formData.category || 'development'}
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
            <label htmlFor="skill-prompt">Prompt File Path</label>
            <input
              id="skill-prompt"
              type="text"
              value={formData.promptFile || ''}
              onChange={(e) => setFormData({ ...formData, promptFile: e.target.value })}
              placeholder="config/skills/code-review/instructions.md"
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

/**
 * Delete confirmation modal
 */
interface DeleteConfirmModalProps {
  skillId: string;
  skillName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  skillName,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Delete Skill</h2>
        </div>

        <p>
          Are you sure you want to delete <strong>{skillName}</strong>? This action
          cannot be undone.
        </p>

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
```

### Create/Update CSS

**`frontend/src/components/Settings/SkillsTab.css`**

```css
.skills-tab {
  padding: 1rem;
}

.skills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.skills-header h2 {
  margin: 0;
}

.skills-filters {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.filter-group select,
.filter-group input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  min-width: 150px;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.skill-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.skill-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.skill-card-header h3 {
  margin: 0;
  font-size: 1rem;
}

.category-badge {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  text-transform: capitalize;
}

.category-development { background: #dbeafe; color: #1e40af; }
.category-design { background: #fce7f3; color: #9d174d; }
.category-communication { background: #d1fae5; color: #065f46; }
.category-automation { background: #fef3c7; color: #92400e; }
.category-integration { background: #e0e7ff; color: #3730a3; }

.skill-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  flex-grow: 1;
  margin-bottom: 0.75rem;
}

.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

.tag {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.skill-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border-color);
  padding-top: 0.75rem;
  margin-top: auto;
}

.builtin-badge {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.skill-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-icon {
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
}

.btn-icon:hover {
  background: var(--bg-hover);
  border-radius: 4px;
}

/* Empty and loading states */
.empty-state,
.loading-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Error banner */
.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-content {
  background: var(--card-bg);
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-small {
  max-width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.modal-content form {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--border-color);
}

.modal-content > p {
  padding: 1rem;
}
```

## Files to Modify

| File | Action |
|------|--------|
| `frontend/src/components/Settings/SkillsTab.tsx` | Replace with full implementation |
| `frontend/src/components/Settings/SkillsTab.css` | Add/update styles |
| `frontend/src/components/Settings/SkillsTab.test.tsx` | Update tests |

## Acceptance Criteria

- [ ] "Coming in Sprint 2" badge removed
- [ ] Skills grid displays all skills from API
- [ ] Category filter works correctly
- [ ] Search filter works correctly
- [ ] Create skill modal opens and submits
- [ ] Edit skill modal loads existing data
- [ ] Delete confirmation modal works
- [ ] Built-in skills show badge and can't be deleted
- [ ] Loading and error states display properly
- [ ] Empty state shows when no skills match filter
- [ ] Responsive grid layout works on mobile

## Dependencies

- Task 58: Frontend Skills Service
- Task 59: useSkills Real API Integration

## Priority

**Medium** - Required for complete Settings page functionality
