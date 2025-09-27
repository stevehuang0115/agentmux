
import React from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../types';

interface DashboardTeamCardProps {
  team: Team;
}

export const DashboardTeamCard: React.FC<DashboardTeamCardProps> = ({ team }) => {
  return (
    <Link to={`/teams/${team.id}`} className="block h-full">
        <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col h-full">
            <h4 className="font-semibold text-lg">{team.name}</h4>
            <p className="text-sm text-text-secondary-dark mt-1 flex-grow">{team.description}</p>
            <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">{team.status}</span>
                <div className="flex -space-x-2">
                    {team.members.map(member => (
                        <img key={member.id} className="w-8 h-8 rounded-full border-2 border-surface-dark bg-cover bg-center" src={member.avatarUrl} alt={member.name} />
                    ))}
                </div>
            </div>
        </div>
    </Link>
  );
};