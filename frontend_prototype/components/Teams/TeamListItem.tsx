
import React from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';

interface TeamListItemProps {
  team: Team;
}

export const TeamListItem: React.FC<TeamListItemProps> = ({ team }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-surface-dark rounded-lg border border-border-dark hover:bg-background-dark hover:border-primary/50 transition-colors group">
      <Link to={`/teams/${team.id}`} className="flex items-center gap-4 flex-grow">
        <div className="p-3 bg-background-dark rounded-lg border border-transparent group-hover:border-primary/20 transition-colors">
            <Icon name="group" className="text-text-secondary-dark group-hover:text-primary transition-colors" />
        </div>
        <div>
            <p className="font-semibold text-text-primary-dark">{team.name}</p>
            <p className="text-sm text-text-secondary-dark">{team.assignedProject}</p>
        </div>
      </Link>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex -space-x-2">
            {team.members.slice(0, 4).map(member => (
                <img key={member.id} className="w-8 h-8 rounded-full border-2 border-surface-dark bg-cover bg-center" src={member.avatarUrl} alt={member.name} />
            ))}
             {team.members.length > 4 && (
                <div className="w-8 h-8 rounded-full border-2 border-surface-dark bg-background-dark flex items-center justify-center text-xs font-medium text-text-secondary-dark">
                    +{team.members.length - 4}
                </div>
            )}
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-text-secondary-dark w-28">
            <Icon name="group" className="text-base" />
            <span>{team.members.length} Members</span>
        </div>
        <button 
            className="text-text-secondary-dark hover:text-primary transition-colors p-2 rounded-full hover:bg-background-dark"
            onClick={(e) => { e.preventDefault(); alert('Team menu clicked'); }}>
            <Icon name="more_vert" />
        </button>
      </div>
    </div>
  );
};