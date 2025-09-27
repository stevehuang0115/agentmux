import React from 'react';
import { Play, Square, MoreVertical } from 'lucide-react';
import { TeamMember } from '@/types';

interface TeamMemberRowProps {
  member: TeamMember;
  teamId: string;
  onStart?: (memberId: string) => Promise<void>;
  onStop?: (memberId: string) => Promise<void>;
}

export const TeamMemberRow: React.FC<TeamMemberRowProps> = ({ member, teamId, onStart, onStop }) => {
  const isActive = member.agentStatus === 'active';
  const isActivating = member.agentStatus === 'activating';
  const statusColor = isActive ? 'bg-emerald-500/10 text-emerald-400' : isActivating ? 'bg-yellow-500/10 text-yellow-400' : 'bg-gray-500/10 text-gray-300';

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStart) await onStart(member.id);
  };
  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStop) await onStop(member.id);
  };

  const avatar = member.avatar;
  return (
    <div className="member-row">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-background-dark border border-border-dark flex items-center justify-center overflow-hidden">
          {avatar ? (
            avatar.startsWith('http') || avatar.startsWith('data:') ? (
              <img src={avatar} alt={member.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm">{avatar}</span>
            )
          ) : (
            <span className="text-sm">{member.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="font-semibold">{member.name}</div>
          <div className="text-sm text-text-secondary-dark">Session: {member.sessionName || 'Inactive'}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>{isActive ? 'Started' : isActivating ? 'Activating' : 'Stopped'}</span>
        {isActive ? (
          <button className="icon-btn" title="Stop" onClick={handleStop}><Square className="w-4 h-4" /></button>
        ) : (
          <button className="icon-btn" title="Start" onClick={handleStart}><Play className="w-4 h-4" /></button>
        )}
        <button className="icon-btn" title="More"><MoreVertical className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default TeamMemberRow;

