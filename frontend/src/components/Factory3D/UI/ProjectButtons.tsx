/**
 * ProjectButtons - Camera focus buttons for each project zone.
 *
 * Allows quick navigation to specific project areas.
 */

import React, { useMemo } from 'react';
import { useFactory } from '../../../contexts/FactoryContext';
import { ZONE_COLORS, BossModeType } from '../../../types/factory.types';

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
    setBossModeType,
    bossNextTarget,
    bossPrevTarget,
    getCurrentTargetName,
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
    <div className="absolute top-4 right-4 flex flex-col gap-2 max-w-[180px]">
      {/* Camera Controls Section */}
      <div className="bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark p-2 shadow-lg">
        <div className="grid grid-cols-2 gap-1.5">
          {/* Overview button */}
          <button
            onClick={() => setCameraTarget('overview')}
            className="px-2 py-1.5 bg-surface-dark hover:bg-primary/20 rounded border border-transparent hover:border-primary/50 transition-all text-xs font-medium text-text-primary"
          >
            Overview
          </button>

          {/* Bird's Eye view button */}
          <button
            onClick={() => setCameraTarget('birdseye')}
            className="px-2 py-1.5 bg-surface-dark hover:bg-primary/20 rounded border border-transparent hover:border-primary/50 transition-all text-xs font-medium text-text-primary"
          >
            Bird's Eye
          </button>

          {/* Outdoor view button */}
          <button
            onClick={() => setCameraTarget('outdoor')}
            className="px-2 py-1.5 bg-surface-dark hover:bg-primary/20 rounded border border-transparent hover:border-primary/50 transition-all text-xs font-medium text-text-primary"
          >
            Outdoor
          </button>

          {/* Boss mode toggle */}
          <button
            onClick={toggleBossMode}
            className={`px-2 py-1.5 rounded border transition-all text-xs font-medium ${
              bossModeState.isActive
                ? 'bg-primary/30 border-primary text-primary'
                : 'bg-surface-dark hover:bg-primary/20 border-transparent hover:border-primary/50 text-text-muted'
            }`}
          >
            {bossModeState.isActive ? 'Stop' : 'Boss Mode'}
          </button>
        </div>
      </div>

      {/* Boss Mode Controls - shown when active */}
      {bossModeState.isActive && (
        <div className="bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-primary/50 p-2 shadow-lg">
          {/* Current target name */}
          <div className="text-center mb-2 px-2">
            <span className="text-[10px] text-text-muted uppercase tracking-wide">Viewing</span>
            <div className="text-sm font-medium text-primary truncate">
              {getCurrentTargetName() || 'Loading...'}
            </div>
            <div className="text-[10px] text-text-muted">
              {bossModeState.currentTargetIndex + 1} / {bossModeState.targets.length}
            </div>
          </div>

          {/* Auto/Manual toggle */}
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setBossModeType('auto')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                bossModeState.mode === 'auto'
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark hover:bg-primary/20 text-text-muted'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => setBossModeType('manual')}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                bossModeState.mode === 'manual'
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark hover:bg-primary/20 text-text-muted'
              }`}
            >
              Manual
            </button>
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-1">
            <button
              onClick={bossPrevTarget}
              className="flex-1 px-3 py-1.5 bg-surface-dark hover:bg-primary/20 rounded border border-transparent hover:border-primary/50 transition-all text-xs font-medium text-text-primary"
            >
              ← Prev
            </button>
            <button
              onClick={bossNextTarget}
              className="flex-1 px-3 py-1.5 bg-surface-dark hover:bg-primary/20 rounded border border-transparent hover:border-primary/50 transition-all text-xs font-medium text-text-primary"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Project Buttons Section - scrollable */}
      {buttons.length > 0 && (
        <div className="bg-surface-dark/90 backdrop-blur-sm rounded-lg border border-border-dark shadow-lg overflow-hidden">
          <div className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-border-dark scrollbar-track-transparent p-1.5 space-y-1">
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
        </div>
      )}
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
    projectName.length > 12
      ? projectName.substring(0, 11) + '…'
      : projectName;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1.5 w-full bg-transparent hover:bg-primary/10 rounded border border-transparent hover:border-primary/30 transition-all text-left"
      title={projectName}
    >
      {/* Color indicator */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cssColor }}
      />

      {/* Project name */}
      <span className="text-xs text-text-primary flex-1 truncate">
        {displayName}
      </span>

      {/* Agent count badge */}
      {agentCount > 0 && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary font-medium">
          {agentCount}
        </span>
      )}
    </button>
  );
};

export default ProjectButtons;
