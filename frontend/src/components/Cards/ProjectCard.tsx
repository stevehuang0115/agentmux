import React from 'react';
import { FolderOpen } from 'lucide-react';
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

      {/* Progress Section */}
      {typeof progressPercent === 'number' && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-text-secondary-dark">Progress</p>
            <p className="text-xs font-semibold">{progressPercent}%</p>
          </div>
          <div className="w-full bg-background-dark rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
              title={progressBreakdown ? `Open: ${progressBreakdown.open}, In progress: ${progressBreakdown.inProgress}, Pending: ${progressBreakdown.pending}, Done: ${progressBreakdown.done}, Blocked: ${progressBreakdown.blocked}` : undefined}
            />
          </div>
        </div>
      )}

      {/* Bottom Section with Avatars and Date */}
      <div className="mt-auto flex items-center justify-between">
        {/* Member Avatars */}
        <div className="flex -space-x-3">
          {assignedTeams.flatMap(team => team.members || []).slice(0, 3).map((member, index) => (
            <div
              key={`${member.id}-${index}`}
              className="w-8 h-8 rounded-full border-2 border-surface-dark bg-cover bg-center overflow-hidden"
              title={member.name}
            >
              {member.avatar ? (
                member.avatar.startsWith('http') || member.avatar.startsWith('data:') ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-white">
                    {member.avatar}
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xs font-bold text-white">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Updated Date */}
        <p className="text-sm text-text-secondary-dark">
          Updated {lastUpdated}
        </p>
      </div>
    </div>
  );
};
