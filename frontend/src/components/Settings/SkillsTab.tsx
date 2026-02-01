/**
 * SkillsTab Component
 *
 * Skills management tab for viewing and managing agent skills.
 * Placeholder for Sprint 2 - Skills System implementation.
 *
 * @module components/Settings/SkillsTab
 */

import React from 'react';
import { useSkills } from '../../hooks/useSkills';
import './SkillsTab.css';

/**
 * Skills management tab for viewing and managing agent skills
 *
 * @returns SkillsTab component
 */
export const SkillsTab: React.FC = () => {
  const { skills, isLoading, error } = useSkills();

  if (isLoading) {
    return <div className="loading">Loading skills...</div>;
  }

  if (error) {
    return <div className="error">Error loading skills: {error}</div>;
  }

  return (
    <div className="skills-tab">
      <div className="skills-header">
        <h2>Skills Management</h2>
        <p className="coming-soon-badge">Coming in Sprint 2</p>
      </div>

      <div className="skills-info">
        <p>
          Skills define what capabilities agents have available to them.
          Each role can have multiple skills assigned, determining what
          actions the agent can perform.
        </p>
      </div>

      <div className="skills-list">
        <h3>Available Skills</h3>
        {skills && skills.length > 0 ? (
          <div className="skill-items">
            {skills.map((skill) => (
              <div key={skill.id} className="skill-item">
                <div className="skill-item-header">
                  <span className="skill-name">{skill.displayName}</span>
                  <span className={`skill-type ${skill.type}`}>
                    {skill.type}
                  </span>
                </div>
                <p className="skill-description">{skill.description}</p>
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
            <p>No skills configured yet.</p>
          </div>
        )}
      </div>

      <div className="skills-placeholder">
        <h3>Upcoming Features</h3>
        <ul>
          <li>Create custom skills with scripts and prompts</li>
          <li>Enable/disable skills per agent or role</li>
          <li>Configure skill execution permissions</li>
          <li>Import skills from external sources</li>
          <li>Skill execution history and analytics</li>
        </ul>
      </div>
    </div>
  );
};

export default SkillsTab;
