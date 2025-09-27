
import React from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';

interface TeamCardProps {
  team: Team;
  showMenu?: boolean;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team, showMenu = true }) => {
  return (
    <Link to={`/teams/${team.id}`} className="block">
        <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col h-full">
            <h3 className="font-semibold text-lg text-text-primary-dark">{team.name}</h3>
            <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary-dark">
                <Icon name="group" className="text-base" />
                <span>{team.members.length} Members</span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-text-secondary-dark flex-grow">
                <Icon name="folder_special" className="text-base" />
                <span>{team.assignedProject}</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                    {team.members.map(member => (
                        <img key={member.id} className="w-8 h-8 rounded-full border-2 border-surface-dark bg-cover bg-center" src={member.avatarUrl} alt={member.name} />
                    ))}
                </div>
                {showMenu && (
                  <button className="text-text-secondary-dark hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); }}>
                      <Icon name="more_vert" />
                  </button>
                )}
            </div>
        </div>
    </Link>
  );
};