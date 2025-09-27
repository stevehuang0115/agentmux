import React from 'react';
import { FolderOpen, Users, Clock } from 'lucide-react';
import { Project, Team } from '@/types';

interface ProjectCardProps {
  project: Project;
  showStatus?: boolean;
  showTeams?: boolean;
  assignedTeams?: Team[];
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
  active: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Running' },
  paused: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Stopped' },
  completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Completed' },
  blocked: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Blocked' },
  stopped: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Stopped' },
};

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  showStatus = false,
  showTeams = false,
  assignedTeams = [],
  onClick,
  progressPercent,
  progressLabel,
  progressBreakdown
}) => {
  const teamCount = assignedTeams.length || Object.values(project.teams || {}).flat().length;
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
            {statusColor.label}
          </span>
        )}
      </div>

      <p
        className="text-sm text-text-secondary-dark flex-grow mb-4 whitespace-nowrap overflow-hidden text-ellipsis"
        title={project.path}
      >
        {pathLabel}
      </p>

      <div className="space-y-3 mb-4">
        {showTeams && assignedTeams.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center text-xs text-text-secondary-dark">
              <Users className="h-3 w-3 mr-1" />
              <span>{assignedTeams.length} team{assignedTeams.length !== 1 ? 's' : ''} assigned</span>
            </div>
            <div className="flex items-center gap-1">
              {assignedTeams.slice(0, 4).map((team) => {
                // Get initials from team name
                const initials = team.name
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase())
                  .join('')
                  .slice(0, 2);

                return (
                  <div
                    key={team.id}
                    className="w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-xs font-medium text-text-primary-dark"
                    title={team.name}
                  >
                    {initials}
                  </div>
                );
              })}
              {assignedTeams.length > 4 && (
                <div className="w-8 h-8 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center text-xs font-medium text-text-secondary-dark">
                  +{assignedTeams.length - 4}
                </div>
              )}
            </div>
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
