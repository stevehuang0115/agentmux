/**
 * TeamOverview Component
 *
 * Displays team members list and project assignment section.
 * Allows changing the assigned project through an inline selector.
 *
 * @module components/TeamDetail/TeamOverview
 */

import React, { useState, useEffect } from 'react';
import { FolderOpen, Edit2 } from 'lucide-react';
import { MembersList } from './MembersList';
import { Team, TeamMember } from '../../types';
import { FormSelect } from '../UI';
import { useProjects } from '../../hooks/useProjects';

/**
 * Props for TeamOverview component
 */
interface TeamOverviewProps {
  /** Team data to display */
  team: Team;
  /** Team identifier */
  teamId: string;
  /** Current project name to display */
  projectName: string | null;
  /** Handler for updating team members */
  onUpdateMember: (memberId: string, updates: Partial<TeamMember>) => void;
  /** Handler for deleting team members */
  onDeleteMember: (memberId: string) => void;
  /** Handler for starting a team member */
  onStartMember: (memberId: string) => Promise<void>;
  /** Handler for stopping a team member */
  onStopMember: (memberId: string) => Promise<void>;
  /** Handler for project assignment changes */
  onProjectChange?: (projectId: string | null) => void;
  /** Handler for viewing a member's terminal */
  onViewTerminal?: (member: TeamMember) => void;
}

/**
 * TeamOverview component - displays team members and project assignment
 *
 * @param props - Component props
 * @returns TeamOverview component
 */
export const TeamOverview: React.FC<TeamOverviewProps> = ({
  team,
  teamId,
  projectName,
  onUpdateMember,
  onDeleteMember,
  onStartMember,
  onStopMember,
  onProjectChange,
  onViewTerminal,
}) => {
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(team?.currentProject || '');
  const { projectOptions } = useProjects();

  useEffect(() => {
    setSelectedProjectId(team?.currentProject || '');
  }, [team?.currentProject]);

  /**
   * Handle project selection change
   *
   * @param projectId - The selected project ID or empty string for no project
   */
  const handleProjectSelect = (projectId: string): void => {
    setSelectedProjectId(projectId);
    if (onProjectChange) {
      onProjectChange(projectId || null);
    }
    setShowProjectSelector(false);
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
