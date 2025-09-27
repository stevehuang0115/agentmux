import React, { useState } from 'react';
import { FolderOpen } from 'lucide-react';
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
  onViewTerminal?: (member: TeamMember) => void;
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
  onViewTerminal,
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
        </div>
        <MembersList
          team={team}
          teamId={teamId}
          onUpdateMember={onUpdateMember}
          onDeleteMember={onDeleteMember}
          onStartMember={onStartMember}
          onStopMember={onStopMember}
          onViewTerminal={onViewTerminal}
        />
      </div>
      <div className="space-y-6">
        <div className="bg-surface-dark border border-border-dark rounded-xl p-6">
          <h4 className="text-lg font-semibold mb-4">Assigned Project</h4>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold text-white">{projectName || 'No Project Assigned'}</div>
              {projectName && <div className="text-sm text-text-secondary-dark">Web App Redesign</div>}
            </div>
          </div>
        </div>
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <h4 className="text-lg font-semibold mb-3">Recent Activity</h4>
          <p className="text-sm text-text-secondary-dark">No recent activity.</p>
        </div>
      </div>
    </div>
  );
};
