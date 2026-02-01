/**
 * Projects Summary Component
 *
 * Compact list of projects for the sidebar.
 *
 * @module components/Dashboard/ProjectsSummary
 */

import React, { useCallback } from 'react';
import { useProjects } from '../../hooks/useProjects';
import './Summary.css';

/**
 * Props for ProjectsSummary component
 */
interface ProjectsSummaryProps {
  /** Show compact version for sidebar */
  compact?: boolean;
  /** Called when a project is clicked */
  onProjectClick?: (projectId: string) => void;
}

/**
 * Displays a compact list of projects
 *
 * @param props - Component props
 * @returns ProjectsSummary component
 */
export const ProjectsSummary: React.FC<ProjectsSummaryProps> = ({
  compact = false,
  onProjectClick,
}) => {
  const { projects, isLoading, error } = useProjects();

  if (isLoading) {
    return <div className="summary-loading">Loading projects...</div>;
  }

  if (error) {
    return <div className="summary-error">Failed to load projects</div>;
  }

  /**
   * Handle project click
   */
  const handleClick = useCallback(
    (projectId: string): void => {
      onProjectClick?.(projectId);
    },
    [onProjectClick]
  );

  const displayProjects = compact ? projects.slice(0, 5) : projects;

  return (
    <div className={`summary-list ${compact ? 'compact' : ''}`}>
      <div className="summary-header">
        <h3>Projects</h3>
        <span className="count-badge">{projects.length}</span>
      </div>

      {projects.length === 0 ? (
        <p className="summary-empty">No projects yet</p>
      ) : (
        <ul className="summary-items">
          {displayProjects.map((project) => (
            <li
              key={project.id}
              className="summary-item"
              onClick={() => handleClick(project.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(project.id)}
              aria-label={`${project.name}, status: ${project.status}`}
            >
              <span className="item-name">{project.name}</span>
              <span
                className={`status-dot status-${project.status}`}
                aria-hidden="true"
              />
            </li>
          ))}
          {compact && projects.length > 5 && (
            <li className="summary-more">+{projects.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ProjectsSummary;
