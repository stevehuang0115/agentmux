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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Team Members ({team.members?.length || 0})</h3>
          <AddMemberForm
            isVisible={showAddMember}
            onToggle={handleToggleAddMember}
            onAdd={handleAddMember}
            onCancel={handleCancelAddMember}
            isOrchestratorTeam={isOrchestratorTeam}
          />
        </div>
        <MembersList
          team={team}
          teamId={teamId}
          onUpdateMember={onUpdateMember}
          onDeleteMember={onDeleteMember}
          onStartMember={onStartMember}
          onStopMember={onStopMember}
        />
      </div>
      <div className="space-y-6">
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <h4 className="text-lg font-semibold mb-3">Assigned Project</h4>
          <p className="text-sm text-text-secondary-dark">{projectName || 'None'}</p>
        </div>
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <h4 className="text-lg font-semibold mb-3">Recent Activity</h4>
          <p className="text-sm text-text-secondary-dark">No recent activity.</p>
        </div>
      </div>
    </div>
  );
};
