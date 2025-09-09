import React from 'react';
import { TeamMemberCard } from '../TeamMemberCard';
import { MembersListProps } from './types';

export const MembersList: React.FC<MembersListProps> = ({
  team,
  teamId,
  onUpdateMember,
  onDeleteMember,
  onStartMember,
  onStopMember,
}) => {
  return (
    <div className="members-list">
      {team?.members?.map((member) => (
        <TeamMemberCard
          key={member.id}
          member={member}
          onUpdate={onUpdateMember}
          onDelete={onDeleteMember}
          onStart={onStartMember}
          onStop={onStopMember}
          teamId={teamId}
        />
      ))}
      
      {!team?.members?.length && (
        <div className="empty-state">
          <p>No team members yet. Add members to get started.</p>
        </div>
      )}
    </div>
  );
};