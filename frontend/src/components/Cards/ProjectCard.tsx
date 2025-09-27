import React from 'react';
import { FolderOpen, Users, Clock } from 'lucide-react';
import { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  showStatus?: boolean;
  showTeams?: boolean;
  onClick?: () => void;
  progressPercent?: number; // 0-100 representing (open+in_progress)/total
  progressLabel?: string;   // optional label like "X of Y active"
  progressBreakdown?: {
    open: number;
    inProgress: number;
    pending: number;
    done: number;
    blocked: number;
    total: number;
  };
}

const statusColors = {
  active: { bg: 'bg-green-500/10', text: 'text-green-400' },
  paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  blocked: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  showStatus = false,
  showTeams = false,
  onClick,
  progressPercent,
  progressLabel,
  progressBreakdown
}) => {
  const teamCount = Object.values(project.teams || {}).flat().length;
  const lastUpdated = new Date(project.updatedAt).toLocaleDateString();
  const statusColor = statusColors[project.status as keyof typeof statusColors] || statusColors.active;

  // Prefer showing the end of the path. Keep last 3 segments or last 40 chars.
  const getPathLabel = (fullPath: string) => {
    if (!fullPath) return '';
    const segments = fullPath.split('/').filter(Boolean);
    const tail = segments.slice(-3).join('/');
    const label = segments.length > 3 ? `…/${tail}` : `/${segments.join('/')}`;
    if (label.length <= 60) return label;
    const last = label.slice(-60);
    return `…${last}`;
  };
  const pathLabel = getPathLabel(project.path);

  return (
    <div
      className={`bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col h-full ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{project.name}</h3>
        {showStatus && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor.bg} ${statusColor.text}`}>
            {project.status}
          </span>
        )}
      </div>

      <p
        className="text-sm text-text-secondary-dark flex-grow mb-4 whitespace-nowrap overflow-hidden text-ellipsis"
        title={project.path}
      >
        {pathLabel}
      </p>

      <div className="space-y-2 mb-4">
        {showTeams && teamCount > 0 && (
          <div className="flex items-center text-xs text-text-secondary-dark">
            <Users className="h-3 w-3 mr-1" />
            <span>{teamCount} teams</span>
          </div>
        )}

        <div className="flex items-center text-xs text-text-secondary-dark">
          <Clock className="h-3 w-3 mr-1" />
          <span>Updated {lastUpdated}</span>
        </div>
      </div>

      {typeof progressPercent === 'number' && (
        <div className="mt-auto">
          <div className="h-2 bg-background-dark rounded-full overflow-hidden" title={progressBreakdown ? `Open: ${progressBreakdown.open}, In progress: ${progressBreakdown.inProgress}, Pending: ${progressBreakdown.pending}, Done: ${progressBreakdown.done}, Blocked: ${progressBreakdown.blocked}` : undefined}>
            <div
              className="h-2 bg-primary"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
          {progressLabel && (
            <div className="mt-1 text-xs text-text-secondary-dark">{progressLabel}</div>
          )}
        </div>
      )}
    </div>
  );
};
