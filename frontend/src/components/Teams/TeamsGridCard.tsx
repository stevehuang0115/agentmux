import React from 'react';
import { Users, FolderOpen } from 'lucide-react';
import { Team } from '@/types';
import { OverflowMenu } from '@/components/UI/OverflowMenu';

interface TeamsGridCardProps {
  team: Team;
  projectName?: string;
  onClick?: () => void;
  onViewTeam?: (teamId: string) => void;
  onEditTeam?: (teamId: string) => void;
  onDeleteTeam?: (teamId: string) => void;
}

export const TeamsGridCard: React.FC<TeamsGridCardProps> = ({ team, projectName, onClick, onViewTeam, onEditTeam, onDeleteTeam }) => {
  const members = team.members || [];
  const avatars = members.slice(0, 3);
  const extra = Math.max(members.length - 3, 0);

  return (
    <div
      className={`relative bg-surface-dark border border-border-dark rounded-2xl p-5 hover:border-primary/50 transition-colors cursor-pointer flex flex-col min-h-[200px]`}
      onClick={onClick}
    >
      <div className="text-lg font-semibold mb-3">{team.name}</div>

      {projectName && (
        <div className="flex items-center gap-2 text-text-secondary-dark text-sm mb-4">
          <FolderOpen className="w-4 h-4" />
          <span>Project {projectName}</span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center">
          {avatars.map((m, idx) => (
            m.avatar ? (
              (m.avatar.startsWith('http') || m.avatar.startsWith('data:')) ? (
                <img key={m.id} src={m.avatar} alt={m.name} title={m.name} className="w-8 h-8 rounded-full ring-2 ring-surface-dark object-cover"
                     style={{ marginLeft: idx === 0 ? 0 : -6 }} />
              ) : (
                <div key={m.id} title={m.name}
                     className="w-8 h-8 rounded-full bg-background-dark border border-border-dark flex items-center justify-center ring-2 ring-surface-dark"
                     style={{ marginLeft: idx === 0 ? 0 : -6 }}>{m.avatar}</div>
              )
            ) : (
              <div key={m.id} title={m.name}
                   className="w-8 h-8 rounded-full bg-background-dark border border-border-dark flex items-center justify-center ring-2 ring-surface-dark"
                   style={{ marginLeft: idx === 0 ? 0 : -6 }}>{m.name.charAt(0).toUpperCase()}</div>
            )
          ))}
          {extra > 0 && (
            <div className="w-8 h-8 rounded-full bg-background-dark border border-border-dark flex items-center justify-center text-xs text-text-secondary-dark ring-2 ring-surface-dark" style={{ marginLeft: -6 }}>+{extra}</div>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <OverflowMenu
            align="bottom-right"
            items={[
              { label: 'Edit Team', onClick: () => onEditTeam && onEditTeam(team.id) },
              { label: 'View Team', onClick: () => onViewTeam && onViewTeam(team.id) },
              ...(onDeleteTeam ? [{ label: 'Delete Team', danger: true, onClick: () => onDeleteTeam(team.id) }] : [])
            ]}
          />
        </div>
      </div>
    </div>
  );
};

export default TeamsGridCard;
