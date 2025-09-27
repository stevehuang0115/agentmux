
import React from 'react';
import { Link } from 'react-router-dom';
import { Project, ProjectStatus } from '../../types';

interface ProjectCardProps {
  project: Project;
}

const statusColors: Record<ProjectStatus, { bg: string; text: string; }> = {
  [ProjectStatus.Running]: { bg: 'bg-green-500/10', text: 'text-green-400' },
  [ProjectStatus.Paused]: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  [ProjectStatus.Completed]: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  [ProjectStatus.Blocked]: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const color = statusColors[project.status];

  return (
    <Link to={`/projects/${project.id}`} className="block">
        <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{project.name}</h3>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${color.bg} ${color.text}`}>{project.status}</span>
            </div>
            <p className="text-sm text-text-secondary-dark flex-grow">{project.description}</p>
            <div className="mt-6">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-xs text-text-secondary-dark">Progress</p>
                    <p className="text-xs font-semibold">{project.progress}%</p>
                </div>
                <div className="w-full bg-background-dark rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${project.progress}%` }}></div>
                </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-3">
                    {project.teams.flatMap(t => t.members).slice(0, 3).map((member, index) => (
                         <img key={index} className="w-8 h-8 rounded-full border-2 border-surface-dark bg-cover bg-center" src={member.avatarUrl} alt={member.name} />
                    ))}
                </div>
                <p className="text-sm text-text-secondary-dark">
                    {project.status === ProjectStatus.Completed ? `Completed: ${project.completedDate}` : `Due: ${project.dueDate}`}
                </p>
            </div>
        </div>
    </Link>
  );
};