/**
 * RolesTab Component
 *
 * Roles management tab for viewing and editing agent roles.
 *
 * @module components/Settings/RolesTab
 */

import React, { useState, useMemo } from 'react';
import { useRoles } from '../../hooks/useRoles';
import {
  RoleSummary,
  RoleCategory,
  ROLE_CATEGORY_ICONS,
  ROLE_CATEGORY_DISPLAY_NAMES,
} from '../../types/role.types';
import { RoleEditor } from './RoleEditor';
import './RolesTab.css';

/**
 * Roles management tab for viewing and editing agent roles
 *
 * @returns RolesTab component
 */
export const RolesTab: React.FC = () => {
  const { roles, isLoading, error, createRole, updateRole, deleteRole } = useRoles();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState('');

  /**
   * Filter roles by search query
   */
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    if (!filter) return roles;

    const lowerFilter = filter.toLowerCase();
    return roles.filter(
      (role) =>
        role.displayName.toLowerCase().includes(lowerFilter) ||
        role.description.toLowerCase().includes(lowerFilter) ||
        role.category.toLowerCase().includes(lowerFilter)
    );
  }, [roles, filter]);

  /**
   * Group roles by category
   */
  const groupedRoles = useMemo(() => {
    return filteredRoles.reduce((acc, role) => {
      const category = role.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(role);
      return acc;
    }, {} as Record<RoleCategory, RoleSummary[]>);
  }, [filteredRoles]);

  /**
   * Handle create new role
   */
  const handleCreateNew = () => {
    setSelectedRoleId(null);
    setIsCreating(true);
    setIsEditorOpen(true);
  };

  /**
   * Handle edit role
   */
  const handleEdit = (roleId: string) => {
    setSelectedRoleId(roleId);
    setIsCreating(false);
    setIsEditorOpen(true);
  };

  /**
   * Handle delete role
   */
  const handleDelete = async (roleId: string, isBuiltin: boolean) => {
    if (isBuiltin) {
      window.alert('Built-in roles cannot be deleted');
      return;
    }

    if (window.confirm('Are you sure you want to delete this role?')) {
      await deleteRole(roleId);
    }
  };

  /**
   * Handle editor close
   */
  const handleEditorClose = () => {
    setIsEditorOpen(false);
    setSelectedRoleId(null);
    setIsCreating(false);
  };

  /**
   * Get category label with icon
   */
  const getCategoryLabel = (category: RoleCategory): string => {
    const icon = ROLE_CATEGORY_ICONS[category] || '👤';
    const name = ROLE_CATEGORY_DISPLAY_NAMES[category] || category;
    return `${icon} ${name}`;
  };

  if (isLoading) {
    return <div className="loading">Loading roles...</div>;
  }

  if (error) {
    return <div className="error">Error loading roles: {error}</div>;
  }

  return (
    <div className="roles-tab">
      <div className="roles-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search roles..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search roles"
          />
        </div>
        <button className="btn-primary" onClick={handleCreateNew}>
          + Create Role
        </button>
      </div>

      <div className="roles-list">
        {Object.entries(groupedRoles).map(([category, categoryRoles]) => (
          <div key={category} className="role-category">
            <h3>{getCategoryLabel(category as RoleCategory)}</h3>
            <div className="role-cards">
              {categoryRoles.map((role) => (
                <div
                  key={role.id}
                  className={`role-card ${role.isBuiltin ? 'builtin' : 'custom'}`}
                >
                  <div className="role-card-header">
                    <h4>{role.displayName}</h4>
                    <div className="role-badges">
                      {role.isDefault && <span className="default-badge">Default</span>}
                      {role.isBuiltin && <span className="builtin-badge">Built-in</span>}
                    </div>
                  </div>
                  <p className="role-description">{role.description}</p>
                  <div className="role-meta">
                    <span>{role.skillCount} skills assigned</span>
                  </div>
                  <div className="role-actions">
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => handleEdit(role.id)}
                    >
                      {role.isBuiltin ? 'View' : 'Edit'}
                    </button>
                    {!role.isBuiltin && (
                      <button
                        className="btn-danger btn-small"
                        onClick={() => handleDelete(role.id, role.isBuiltin)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredRoles.length === 0 && (
          <div className="empty-state">
            <p>No roles found matching your search.</p>
          </div>
        )}
      </div>

      {isEditorOpen && (
        <RoleEditor
          roleId={isCreating ? null : selectedRoleId}
          onClose={handleEditorClose}
          onSave={async (input) => {
            if (isCreating) {
              await createRole(input as Parameters<typeof createRole>[0]);
            } else if (selectedRoleId) {
              await updateRole(selectedRoleId, input as Parameters<typeof updateRole>[1]);
            }
          }}
        />
      )}
    </div>
  );
};

export default RolesTab;
