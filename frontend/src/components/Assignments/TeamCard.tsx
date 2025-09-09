import React from 'react';
import { Users, FolderOpen, Activity, UserMinus } from 'lucide-react';
import { TeamCardProps } from './types';

export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  projects,
  onUnassignTeam,
}) => {
  const assignedProject = projects.find(p => p.id === team.currentProject);

  return (
    <div key={team.id} className="assignment-card team-card">
      <div className="assignment-header">
        <div className="team-info">
          <Users size={20} />
          <h3>{team.name}</h3>
        </div>
        <div className="team-header-actions">
          <div className={`status-badge team-status-${team.members.some(m => m.agentStatus === 'active') ? 'active' : 'inactive'}`}>
            {team.members.some(m => m.agentStatus === 'active') ? 'active' : 'inactive'}
          </div>
          <button
            className="unassign-team-btn"
            onClick={(e) => {
              e.stopPropagation();
              onUnassignTeam(team.id, team.name, team.currentProject);
            }}
            title="Unassign team from project"
          >
            <UserMinus size={16} />
          </button>
        </div>
      </div>
      <p className="assignment-description">{team.description}</p>
      <div className="assignment-meta">
        <div className="team-project">
          <FolderOpen size={14} />
          <span>Project: {assignedProject?.name || 'Unknown'}</span>
        </div>
        <div className="team-members-count">
          <Activity size={14} />
          <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      {team.members.length > 0 && (
        <div className="team-members-preview">
          {team.members.slice(0, 4).map(member => (
            <span key={member.id} className="member-chip">
              <span className={`status-dot status-${member.agentStatus}`}></span>
              {member.name} ({member.role})
            </span>
          ))}
          {team.members.length > 4 && (
            <span className="more-members">+{team.members.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );
};