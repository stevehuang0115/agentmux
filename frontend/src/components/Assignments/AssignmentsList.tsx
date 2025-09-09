import React from 'react';
import { FolderOpen, Users } from 'lucide-react';
import { AssignmentsListProps } from './types';
import { ProjectCard } from './ProjectCard';
import { TeamCard } from './TeamCard';
import { EmptyState } from './EmptyState';

export const AssignmentsList: React.FC<AssignmentsListProps> = ({
  viewMode,
  assignedProjects,
  assignedTeams,
  teams,
  projects,
  onMemberClick,
  onOrchestratorClick,
  onUnassignTeam,
}) => {
  return (
    <div className="assignments-list">
      {viewMode === 'projects' ? (
        <div className="projects-view">
          {assignedProjects.length === 0 ? (
            <EmptyState
              type="projects"
              icon={FolderOpen}
              title="No Projects Assigned"
              description="No teams have been assigned to any projects yet."
            />
          ) : (
            assignedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                teams={teams}
                onMemberClick={onMemberClick}
                onOrchestratorClick={onOrchestratorClick}
                onUnassignTeam={onUnassignTeam}
              />
            ))
          )}
        </div>
      ) : (
        <div className="teams-view">
          {assignedTeams.length === 0 ? (
            <EmptyState
              type="teams"
              icon={Users}
              title="No Teams Assigned"
              description="No teams have been assigned to projects yet."
            />
          ) : (
            assignedTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                projects={projects}
                onUnassignTeam={onUnassignTeam}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};