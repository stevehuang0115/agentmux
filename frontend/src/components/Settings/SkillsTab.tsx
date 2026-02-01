/**
 * SkillsTab Component
 *
 * Skills management tab for viewing and managing agent skills.
 * Now connected to real API through the useSkills hook.
 *
 * @module components/Settings/SkillsTab
 */

import React, { useState } from 'react';
import { useSkills } from '../../hooks/useSkills';
import {
  getSkillCategoryLabel,
  getSkillCategoryIcon,
  getExecutionTypeLabel,
  type SkillCategory,
} from '../../types/skill.types';
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
 * Skills management tab for viewing and managing agent skills.
 *
 * @returns SkillsTab component
 */
export const SkillsTab: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { skills, loading, error, refresh } = useSkills({
    category: categoryFilter || undefined,
    search: searchQuery || undefined,
  });

  if (loading) {
    return <div className="loading">Loading skills...</div>;
  }

  if (error) {
    return <div className="error">Error loading skills: {error}</div>;
  }

  return (
    <div className="skills-tab">
      <div className="skills-header">
        <h2>Skills Management</h2>
        <button onClick={refresh} className="refresh-button">
          Refresh
        </button>
      </div>

      <div className="skills-info">
        <p>
          Skills define what capabilities agents have available to them.
          Each role can have multiple skills assigned, determining what
          actions the agent can perform.
        </p>
      </div>

      <div className="skills-filters">
        <div className="filter-group">
          <label htmlFor="category-filter">Category:</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as SkillCategory | '')}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="search-filter">Search:</label>
          <input
            id="search-filter"
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="skills-list">
        <h3>Available Skills ({skills.length})</h3>
        {skills.length > 0 ? (
          <div className="skill-items">
            {skills.map((skill) => (
              <div key={skill.id} className="skill-item">
                <div className="skill-item-header">
                  <span className="skill-icon">
                    {getSkillCategoryIcon(skill.category)}
                  </span>
                  <span className="skill-name">{skill.name}</span>
                  <span className={`skill-type ${skill.isBuiltin ? 'builtin' : 'custom'}`}>
                    {skill.isBuiltin ? 'Built-in' : 'Custom'}
                  </span>
                </div>
                <p className="skill-description">{skill.description}</p>
                <div className="skill-meta">
                  <span className="skill-category">
                    {getSkillCategoryLabel(skill.category)}
                  </span>
                  <span className="skill-execution">
                    {getExecutionTypeLabel(skill.executionType)}
                  </span>
                  <span className="skill-roles">
                    {skill.roleCount} role{skill.roleCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="skill-status">
                  <span className={`status-indicator ${skill.isEnabled ? 'enabled' : 'disabled'}`}>
                    {skill.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>
              {categoryFilter || searchQuery
                ? 'No skills match your filters.'
                : 'No skills configured yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsTab;
