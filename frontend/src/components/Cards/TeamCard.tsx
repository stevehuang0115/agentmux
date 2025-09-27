import React from 'react';
import { Users, FolderOpen, User } from 'lucide-react';
import { Team, TeamMember } from '@/types';
import { useTerminal } from '@/contexts/TerminalContext';

interface TeamCardProps {
  team: Team;
  onMemberClick?: (member: TeamMember) => void;
  onClick?: () => void;
}

const statusColors = {
  idle: 'bg-gray-500/10 text-gray-400',
  working: 'bg-green-500/10 text-green-400',
  blocked: 'bg-yellow-500/10 text-yellow-400',
  terminated: 'bg-red-500/10 text-red-400',
  ready: 'bg-green-500/10 text-green-400',
  activating: 'bg-orange-500/10 text-orange-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  inactive: 'bg-gray-500/10 text-gray-400',
  completed: 'bg-blue-500/10 text-blue-400'
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

  const isActive = members.some(m => m.agentStatus === 'active' || m.sessionName);
  const statusBadge = (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
      {isActive ? 'active' : 'inactive'}
    </span>
  );

  return (
    <div
      className={`bg-surface-dark p-5 rounded-xl border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col h-full ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users className="h-5 w-5 mr-3 text-text-secondary-dark" />
          <h3 className="font-semibold text-lg">{team.name}</h3>
        </div>
        {statusBadge}
      </div>

      <p className="text-sm text-text-secondary-dark mb-4">
        {members.length} member{members.length !== 1 ? 's' : ''}
      </p>

      {team.currentProject && (
        <div className="flex items-center mb-4 p-2 bg-background-dark rounded">
          <FolderOpen className="h-4 w-4 mr-2 text-text-secondary-dark" />
          <span className="text-xs text-text-secondary-dark" title={team.currentProject}>
            {team.currentProject.length > 25 ?
              `${team.currentProject.substring(0, 25)}...` :
              team.currentProject}
          </span>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex-grow">
          <h4 className="text-sm font-medium mb-2 text-text-secondary-dark">Team Members</h4>
          <div className="space-y-2">
            {members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between p-2 rounded hover:bg-background-dark transition-colors ${member.sessionName ? 'cursor-pointer' : ''}`}
                onClick={(e) => handleMemberClick(e, member)}
                title={member.sessionName ?
                  `${member.name} - Active session: ${member.sessionName} (Click to open terminal)` :
                  `${member.name} - No active session`
                }
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-background-dark flex items-center justify-center mr-2">
                    <User className="h-3 w-3 text-text-secondary-dark" />
                  </div>
                  <div className="text-xs">
                    <div className="font-medium">{member.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: roleColors[member.role] || '#9ab0d9' }}
                    >
                      {member.role}
                    </div>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${member.sessionName ? 'bg-green-400' : 'bg-gray-500'}`}></div>
              </div>
            ))}
            {members.length > 3 && (
              <div className="text-xs text-text-secondary-dark text-center py-1">
                +{members.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
