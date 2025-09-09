import React from 'react';
import { FolderOpen, Users } from 'lucide-react';
import { ViewToggleProps } from './types';

export const ViewToggle: React.FC<ViewToggleProps> = ({
  viewMode,
  assignedProjects,
  assignedTeams,
  onViewModeChange,
}) => {
  return (
    <div className="view-toggle">
      <button 
        className={`toggle-btn ${viewMode === 'projects' ? 'active' : ''}`}
        onClick={() => onViewModeChange('projects')}
      >
        <FolderOpen size={16} />
        Projects ({assignedProjects.length})
      </button>
      <button 
        className={`toggle-btn ${viewMode === 'teams' ? 'active' : ''}`}
        onClick={() => onViewModeChange('teams')}
      >
        <Users size={16} />
        Teams ({assignedTeams.length})
      </button>
    </div>
  );
};