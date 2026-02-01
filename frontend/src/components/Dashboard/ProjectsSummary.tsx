/**
 * Projects Summary Component
 *
 * Compact list of projects for the sidebar.
 *
 * @module components/Dashboard/ProjectsSummary
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../../hooks/useProjects';
import './Summary.css';

/**
 * Props for ProjectsSummary component
 */
interface ProjectsSummaryProps {
  /** Whether to show in compact mode (default: false) */
  compact?: boolean;
  /** Maximum number of projects to show in compact mode (default: 5) */
  maxItems?: number;
}

/**
 * Compact list of projects for the sidebar.
 *
 * Shows project names with status indicators and supports
 * compact mode for sidebar display.
 *
 * @param props - Component props
 * @returns JSX element with projects summary
 *
 * @example
 * ```tsx
 * // In sidebar
 * <ProjectsSummary compact />
 *
 * // Full list
 * <ProjectsSummary />
 * ```
 */
export const ProjectsSummary: React.FC<ProjectsSummaryProps> = ({
  compact = false,
  maxItems = 5,
}) => {
  const navigate = useNavigate();
  const { projects, loading, error } = useProjects();

  /**
   * Handle clicking on a project
   */
  const handleProjectClick = (projectId: string): void => {
    navigate(`/projects/${projectId}`);
  };

  /**
   * Handle clicking "View All"
   */
  const handleViewAll = (): void => {
    navigate('/projects');
  };

  if (loading) {
    return (
      <div className="summary-loading" data-testid="projects-summary-loading">
        Loading projects...
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-error" data-testid="projects-summary-error">
        Error: {error}
      </div>
    );
  }

  const displayProjects = compact ? projects.slice(0, maxItems) : projects;
  const hasMore = compact && projects.length > maxItems;

  return (
    <div
      className={`summary-list ${compact ? 'compact' : ''}`}
      data-testid="projects-summary"
    >
      <div className="summary-header">
        <h3>Projects</h3>
        <span className="count-badge">{projects.length}</span>
      </div>

      {projects.length === 0 ? (
        <p className="summary-empty" data-testid="projects-empty">
          No projects yet
        </p>
      ) : (
        <ul className="summary-items">
          {displayProjects.map((project) => (
            <li
              key={project.id}
              className="summary-item"
              onClick={() => handleProjectClick(project.id)}
              data-testid={`project-item-${project.id}`}
            >
              <span className="item-name">{project.name}</span>
              <span
                className={`status-dot status-${project.status || 'inactive'}`}
                aria-label={`Status: ${project.status || 'inactive'}`}
              />
            </li>
          ))}
          {hasMore && (
            <li
              className="summary-more"
              onClick={handleViewAll}
              data-testid="projects-view-more"
            >
              +{projects.length - maxItems} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default ProjectsSummary;
