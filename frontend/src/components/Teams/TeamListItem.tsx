import React from 'react';
import { Users } from 'lucide-react';
import { Team } from '@/types';

interface TeamListItemProps {
  team: Team;
  onClick?: () => void;
}

export const TeamListItem: React.FC<TeamListItemProps> = ({ team, onClick }) => {
  const members = team.members || [];
  const isActive = members.some(m => m.agentStatus === 'active' || m.sessionName);

  return (
    <div
      className="flex items-center justify-between p-5 rounded-xl border border-border-dark bg-surface-dark hover:border-primary/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-background-dark border border-border-dark flex items-center justify-center">
          <Users className="w-4 h-4 text-text-secondary-dark" />
        </div>
        <div>
          <div className="font-semibold">{team.name}</div>
          {team.description && (
            <div className="text-sm text-text-secondary-dark">{team.description}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary-dark">{members.length} members</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
          {isActive ? 'active' : 'inactive'}
        </span>
      </div>
    </div>
  );
};

export default TeamListItem;
