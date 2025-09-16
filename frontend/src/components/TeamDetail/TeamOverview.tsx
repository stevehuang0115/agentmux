import React, { useState } from 'react';
import { TeamStats } from './TeamStats';
import { TeamDescription } from './TeamDescription';
import { AddMemberForm } from './AddMemberForm';
import { MembersList } from './MembersList';
import { Team, TeamMember } from '../../types';

interface TeamOverviewProps {
  team: Team;
  teamId: string;
  teamStatus: string;
  projectName: string | null;
  onAddMember: (member: { name: string; role: string }) => void;
  onUpdateMember: (memberId: string, updates: Partial<TeamMember>) => void;
  onDeleteMember: (memberId: string) => void;
  onStartMember: (memberId: string) => Promise<void>;
  onStopMember: (memberId: string) => Promise<void>;
  onProjectChange?: (projectId: string | null) => void;
}

export const TeamOverview: React.FC<TeamOverviewProps> = ({
  team,
  teamId,
  teamStatus,
  projectName,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onStartMember,
  onStopMember,
  onProjectChange,
}) => {
  const [showAddMember, setShowAddMember] = useState(false);
  const isOrchestratorTeam = team?.id === 'orchestrator' || team?.name === 'Orchestrator Team';

  const handleToggleAddMember = () => {
    setShowAddMember(!showAddMember);
  };

  const handleCancelAddMember = () => {
    setShowAddMember(false);
  };

  const handleAddMember = (member: { name: string; role: string }) => {
    onAddMember(member);
    setShowAddMember(false);
  };

  return (
    <div className="tab-content">
      {/* Team Stats Section */}
      <TeamStats
        team={team}
        teamStatus={teamStatus}
        projectName={projectName}
        onProjectChange={onProjectChange}
      />

      {/* Team Description Section */}
      <TeamDescription description={team?.description} />

      {/* Team Members Section */}
      <div className="members-section">
        <AddMemberForm
          isVisible={showAddMember}
          onToggle={handleToggleAddMember}
          onAdd={handleAddMember}
          onCancel={handleCancelAddMember}
          isOrchestratorTeam={isOrchestratorTeam}
        />

        <MembersList
          team={team}
          teamId={teamId}
          onUpdateMember={onUpdateMember}
          onDeleteMember={onDeleteMember}
          onStartMember={onStartMember}
          onStopMember={onStopMember}
        />
      </div>
    </div>
  );
};