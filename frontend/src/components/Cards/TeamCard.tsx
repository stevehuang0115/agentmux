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
        <div className="mt-4">
          <div className="flex items-center gap-1">
            {members.slice(0, 4).map((member) => {
              // Get initials from member name
              const initials = member.name
                .split(' ')
                .map(word => word.charAt(0).toUpperCase())
                .join('')
                .slice(0, 2);

              return (
                <div
                  key={member.id}
                  className={`w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-xs font-medium text-text-primary-dark ${member.sessionName ? 'cursor-pointer' : ''}`}
                  onClick={(e) => handleMemberClick(e, member)}
                  title={member.sessionName ?
                    `${member.name} (${member.role}) - Active session: ${member.sessionName} (Click to open terminal)` :
                    `${member.name} (${member.role}) - No active session`
                  }
                >
                  {initials}
                </div>
              );
            })}
            {members.length > 4 && (
              <div className="w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-xs font-medium text-text-secondary-dark">
                +{members.length - 4}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
