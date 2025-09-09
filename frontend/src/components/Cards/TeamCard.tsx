import React from 'react';
import { Users, Activity, FolderOpen, User, Play } from 'lucide-react';
import clsx from 'clsx';
import { Team, TeamMember } from '@/types';
import { useTerminal } from '@/contexts/TerminalContext';

interface TeamCardProps {
  team: Team;
  onMemberClick?: (member: TeamMember) => void;
  onClick?: () => void;
}

const statusColors = {
  idle: 'bg-gray-100 text-gray-800',
  working: 'bg-green-100 text-green-800', 
  blocked: 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800',
  ready: 'bg-green-100 text-green-800',
  activating: 'bg-orange-100 text-orange-800',
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800',
  completed: 'bg-blue-100 text-blue-800'
};

const roleColors: Record<string, string> = {
  orchestrator: '#8b5cf6',
  tpm: '#3b82f6',
  pgm: '#0ea5e9',
  developer: '#10b981',
  qa: '#f59e0b',
  tester: '#ef4444',
  designer: '#ec4899'
};

export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  onMemberClick,
  onClick
}) => {
  const { openTerminalWithSession } = useTerminal();
  const lastActivity = new Date(team.updatedAt).toLocaleDateString();
  const members = team.members || [];

  const handleMemberClick = (e: React.MouseEvent, member: TeamMember) => {
    e.stopPropagation(); // Prevent team card click
    
    // If member has active session, open terminal with that session
    if (member.sessionName) {
      console.log('TeamCard: Opening terminal for session:', member.sessionName);
      openTerminalWithSession(member.sessionName);
    } else if (onMemberClick) {
      // Fallback to existing member click handler if no session
      onMemberClick(member);
    }
  };

  return (
    <div 
      className={clsx(
        'team-card',
        onClick && 'team-card--clickable'
      )}
      onClick={onClick}
    >
      <div className="team-card-header">
        <div className="team-info">
          <div className="team-icon">
            <Users className="icon" />
          </div>
          <div className="team-content">
            <h3 className="team-title">{team.name}</h3>
            <div className="team-meta-line">
              <span className="team-member-count">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {team.currentProject && (
        <div className="project-assignment">
          <FolderOpen className="project-icon" />
          <span className="project-name" title={team.currentProject}>
            {team.currentProject.length > 25 ? 
              `${team.currentProject.substring(0, 25)}...` : 
              team.currentProject}
          </span>
        </div>
      )}

      {members.length > 0 && (
        <div className="team-members-compact">
          <h4 className="members-title">Team Members</h4>
          <div className="members-compact-list">
            {members.map((member) => (
              <div 
                key={member.id}
                className={clsx(
                  'member-compact-item',
                  member.sessionName && 'clickable'
                )}
                onClick={(e) => handleMemberClick(e, member)}
                style={{ 
                  cursor: member.sessionName ? 'pointer' : 'default'
                }}
                title={member.sessionName ? 
                  `${member.name} - Active session: ${member.sessionName} (Click to open terminal)` : 
                  `${member.name} - No active session`
                }
              >
                <div className="member-avatar">
                  <User className="avatar-icon" />
                </div>
                <div className="member-info-compact">
                  <span className="member-name">{member.name}</span>
                  <span 
                    className="member-role"
                    style={{ color: roleColors[member.role] || '#6b7280' }}
                  >
                    {member.role}
                  </span>
                </div>
                <div className="member-status-compact">
                  <div className={clsx(
                    'session-indicator',
                    member.sessionName ? 'active' : 'inactive'
                  )}>
                    <div className="session-dot"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};