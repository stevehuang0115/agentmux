import React, { useState, useEffect } from 'react';
import { FolderOpen, Edit2 } from 'lucide-react';
import { TeamStats } from './TeamStats';
import { TeamDescription } from './TeamDescription';
import { AddMemberForm } from './AddMemberForm';
import { MembersList } from './MembersList';
import { Team, TeamMember } from '../../types';
import { FormSelect } from '../UI';
import { useProjects } from '../../hooks/useProjects';

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
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(team?.currentProject || '');
  const { projectOptions } = useProjects();
  const isOrchestratorTeam = team?.id === 'orchestrator' || team?.name === 'Orchestrator Team';

  useEffect(() => {
    setSelectedProjectId(team?.currentProject || '');
  }, [team?.currentProject]);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    if (onProjectChange) {
      onProjectChange(projectId || null);
    }
    setShowProjectSelector(false);
  };

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
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">Assigned Project</h4>
            <button
              onClick={() => setShowProjectSelector(!showProjectSelector)}
              className="p-1.5 hover:bg-background-dark rounded-lg transition-colors text-text-secondary-dark hover:text-primary"
              title="Change project"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
          {showProjectSelector ? (
            <div className="space-y-3">
              <FormSelect
                value={selectedProjectId}
                onChange={(e) => handleProjectSelect(e.target.value)}
              >
                <option value="">No project assigned</option>
                {projectOptions.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </FormSelect>
              <button
                onClick={() => setShowProjectSelector(false)}
                className="text-sm text-text-secondary-dark hover:text-primary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 cursor-pointer hover:bg-background-dark/50 -mx-3 px-3 py-2 rounded-lg transition-colors"
              onClick={() => setShowProjectSelector(true)}
              title="Click to change project"
            >
              <FolderOpen className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold text-white">{projectName || 'No Project Assigned'}</div>
                {!projectName && (
                  <div className="text-sm text-text-secondary-dark">Click to assign a project</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="bg-surface-dark border border-border-dark rounded-xl p-5">
          <h4 className="text-lg font-semibold mb-3">Recent Activity</h4>
          <p className="text-sm text-text-secondary-dark">No recent activity.</p>
        </div>
      </div>
    </div>
  );
};
