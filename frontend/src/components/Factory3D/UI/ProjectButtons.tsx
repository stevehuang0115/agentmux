/**
 * ProjectButtons - Camera focus buttons for each project zone.
 *
 * Allows quick navigation to specific project areas.
 */

import React, { useMemo } from 'react';
import { useFactory } from '../../../contexts/FactoryContext';
import { ZONE_COLORS } from '../../../types/factory.types';

/**
 * ProjectButtons - Project navigation buttons.
 *
 * Features:
 * - One button per project zone
 * - Color-coded to match zone
 * - Overview button to reset view
 * - Boss mode toggle
 *
 * @returns JSX element with project buttons
 */
export const ProjectButtons: React.FC = () => {
  const {
    projects,
    zones,
    setCameraTarget,
    bossModeState,
    toggleBossMode,
  } = useFactory();

  // Build button data
  const buttons = useMemo(() => {
    return projects.map((projectName, i) => {
      const zone = zones.get(projectName);
      return {
        projectName,
        color: zone?.color || ZONE_COLORS[i % ZONE_COLORS.length],
        agentCount: zone?.workstations.filter((ws) => ws.assignedAgentId).length || 0,
      };
    });
  }, [projects, zones]);

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2">
      {/* Overview button */}
      <button
        onClick={() => setCameraTarget('overview')}
        className="px-3 py-2 bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all text-sm font-medium text-text-primary"
      >
        Overview
      </button>

      {/* Bird's Eye view button */}
      <button
        onClick={() => setCameraTarget('birdseye')}
        className="px-3 py-2 bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all text-sm font-medium text-text-primary"
      >
        Bird's Eye
      </button>

      {/* Outdoor view button */}
      <button
        onClick={() => setCameraTarget('outdoor')}
        className="px-3 py-2 bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all text-sm font-medium text-text-primary"
      >
        Outdoor
      </button>

      {/* Boss mode toggle */}
      <button
        onClick={toggleBossMode}
        className={`px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
          bossModeState.isActive
            ? 'bg-primary/20 border-primary text-primary'
            : 'bg-surface-dark/90 backdrop-blur-sm border-border-dark hover:border-primary/50 text-text-muted'
        }`}
      >
        {bossModeState.isActive ? 'Stop Tour' : 'Boss Mode'}
      </button>

      {/* Divider */}
      {buttons.length > 0 && (
        <div className="border-t border-border-dark my-1" />
      )}

      {/* Project buttons */}
      {buttons.map((btn) => (
        <ProjectButton
          key={btn.projectName}
          projectName={btn.projectName}
          color={btn.color}
          agentCount={btn.agentCount}
          onClick={() => setCameraTarget(btn.projectName)}
        />
      ))}
    </div>
  );
};

/**
 * ProjectButton - Individual project focus button.
 */
interface ProjectButtonProps {
  projectName: string;
  color: number;
  agentCount: number;
  onClick: () => void;
}

const ProjectButton: React.FC<ProjectButtonProps> = ({
  projectName,
  color,
  agentCount,
  onClick,
}) => {
  // Convert hex color to CSS
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;

  // Truncate long names
  const displayName =
    projectName.length > 15
      ? projectName.substring(0, 14) + '...'
      : projectName;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark hover:border-primary/50 hover:bg-surface-dark transition-all text-left"
      title={projectName}
    >
      {/* Color indicator */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: cssColor }}
      />

      {/* Project name */}
      <span className="text-sm text-text-primary flex-1 truncate">
        {displayName}
      </span>

      {/* Agent count badge */}
      {agentCount > 0 && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
          {agentCount}
        </span>
      )}
    </button>
  );
};

export default ProjectButtons;
