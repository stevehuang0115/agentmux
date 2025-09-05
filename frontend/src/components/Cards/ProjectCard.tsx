import React from 'react';
import { FolderOpen, Users, Clock, Play } from 'lucide-react';
import clsx from 'clsx';
import { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  showStatus?: boolean;
  showTeams?: boolean;
  onClick?: () => void;
}

const statusColors = {
  active: 'status-active',
  paused: 'status-paused', 
  completed: 'status-completed'
};

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  showStatus = false,
  showTeams = false,
  onClick
}) => {
  const teamCount = Object.values(project.teams).flat().length;
  const lastUpdated = new Date(project.updatedAt).toLocaleDateString();

  return (
    <div 
      className={clsx(
        'project-card',
        onClick && 'project-card--clickable'
      )}
      onClick={onClick}
    >
      <div className="card-header">
        <div className="card-icon">
          <FolderOpen className="icon" />
        </div>
        {showStatus && (
          <div className={clsx('status-badge', statusColors[project.status])}>
            {project.status}
          </div>
        )}
      </div>

      <div className="card-content">
        <h3 className="card-title">{project.name}</h3>
        <p className="card-path">{project.path}</p>
        
        <div className="card-meta">
          {showTeams && teamCount > 0 && (
            <div className="meta-item">
              <Users className="meta-icon" />
              <span className="meta-text">{teamCount} teams</span>
            </div>
          )}
          
          <div className="meta-item">
            <Clock className="meta-icon" />
            <span className="meta-text">Updated {lastUpdated}</span>
          </div>
        </div>
      </div>

      <div className="card-actions">
        <button className="action-button action-button--primary">
          <Play className="action-icon" />
          Open
        </button>
      </div>
    </div>
  );
};