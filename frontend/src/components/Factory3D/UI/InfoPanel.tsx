/**
 * InfoPanel - Displays agent status counts and statistics.
 *
 * Shows active, idle, and dormant agent counts with
 * color-coded indicators.
 */

import React from 'react';
import { useFactory } from '../../../contexts/FactoryContext';

/**
 * InfoPanel - Statistics panel overlay.
 *
 * Features:
 * - Active/Idle/Dormant agent counts
 * - Color-coded status indicators
 * - Collapsible on mobile
 *
 * @returns JSX element with stats panel
 */
export const InfoPanel: React.FC = () => {
  const { stats, isLoading, error } = useFactory();

  if (isLoading) {
    return (
      <div className="absolute top-4 left-4 bg-surface-dark/90 backdrop-blur-sm rounded-lg p-4 border border-border-dark">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute top-4 left-4 bg-surface-dark/90 backdrop-blur-sm rounded-lg p-4 border border-red-500/50">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="absolute top-4 left-4 bg-surface-dark/90 backdrop-blur-sm rounded-lg p-4 border border-border-dark min-w-[160px]">
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Agent Status
      </h3>

      <div className="space-y-2">
        {/* Active */}
        <StatusRow
          label="Active"
          count={stats.activeCount}
          color="bg-green-500"
          textColor="text-green-400"
        />

        {/* Idle */}
        <StatusRow
          label="Idle"
          count={stats.idleCount}
          color="bg-yellow-500"
          textColor="text-yellow-400"
        />

        {/* Dormant */}
        <StatusRow
          label="Dormant"
          count={stats.dormantCount}
          color="bg-red-500"
          textColor="text-red-400"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-border-dark my-3" />

      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-muted">Total Agents</span>
        <span className="text-sm font-bold text-text-primary">
          {stats.activeCount + stats.idleCount + stats.dormantCount}
        </span>
      </div>

      {/* Token count */}
      {stats.totalTokens > 0 && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-text-muted">Session Tokens</span>
          <span className="text-sm text-primary">
            {formatNumber(stats.totalTokens)}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * StatusRow - Individual status count row.
 */
interface StatusRowProps {
  label: string;
  count: number;
  color: string;
  textColor: string;
}

const StatusRow: React.FC<StatusRowProps> = ({
  label,
  count,
  color,
  textColor,
}) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <span className={`text-sm font-semibold ${textColor}`}>{count}</span>
    </div>
  );
};

/**
 * Format large numbers for display.
 */
function formatNumber(num: number): string {
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default InfoPanel;
