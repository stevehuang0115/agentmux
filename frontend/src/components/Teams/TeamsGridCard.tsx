import React from 'react';
import { Users, FolderOpen } from 'lucide-react';
import { Team } from '@/types';
import { OverflowMenu } from '@/components/UI/OverflowMenu';
import { MemberAvatar } from '@/components/common/MemberAvatar';

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
  const hasActiveMembers = members.some(member => member.agentStatus === 'active');

  return (
    <div
      className={`relative bg-surface-dark border border-border-dark rounded-2xl p-5 hover:border-primary/50 transition-colors cursor-pointer flex flex-col min-h-[200px]`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold">{team.name}</div>
        {hasActiveMembers && (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400">
            Active
          </span>
        )}
      </div>

      {projectName && (
        <div className="flex items-center gap-2 text-text-secondary-dark text-sm mb-4">
          <FolderOpen className="w-4 h-4" />
          <span>Project {projectName}</span>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center">
          {avatars.map((m, idx) => (
            <div key={m.id} style={{ marginLeft: idx === 0 ? 0 : -6 }}>
              <MemberAvatar
                name={m.name}
                avatar={m.avatar}
                size="sm"
                ringClass="ring-2 ring-surface-dark"
              />
            </div>
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
