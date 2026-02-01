/**
 * Teams Summary Component
 *
 * Compact list of teams for the sidebar.
 *
 * @module components/Dashboard/TeamsSummary
 */

import React from 'react';
import { useTeams } from '../../hooks/useTeams';
import './Summary.css';

/**
 * Props for TeamsSummary component
 */
interface TeamsSummaryProps {
  /** Show compact version for sidebar */
  compact?: boolean;
  /** Called when a team is clicked */
  onTeamClick?: (teamId: string) => void;
}

/**
 * Displays a compact list of teams
 *
 * @param props - Component props
 * @returns TeamsSummary component
 */
export const TeamsSummary: React.FC<TeamsSummaryProps> = ({
  compact = false,
  onTeamClick,
}) => {
  const { teams, loading, error } = useTeams();

  if (loading) {
    return <div className="summary-loading">Loading teams...</div>;
  }

  if (error) {
    return <div className="summary-error">Failed to load teams</div>;
  }

  /**
   * Handle team click
   */
  const handleClick = (teamId: string): void => {
    onTeamClick?.(teamId);
  };

  /**
   * Count active agents in a team
   */
  const getActiveAgentCount = (members: Array<{ agentStatus: string }>): number => {
    return members.filter((m) => m.agentStatus === 'active').length;
  };

  const displayTeams = compact ? teams.slice(0, 5) : teams;

  return (
    <div className={`summary-list ${compact ? 'compact' : ''}`}>
      <div className="summary-header">
        <h3>Teams</h3>
        <span className="count-badge">{teams.length}</span>
      </div>

      {teams.length === 0 ? (
        <p className="summary-empty">No teams yet</p>
      ) : (
        <ul className="summary-items">
          {displayTeams.map((team) => (
            <li
              key={team.id}
              className="summary-item"
              onClick={() => handleClick(team.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(team.id)}
            >
              <span className="item-name">{team.name}</span>
              <span className="item-meta">
                {getActiveAgentCount(team.members)}/{team.members.length} active
              </span>
            </li>
          ))}
          {compact && teams.length > 5 && (
            <li className="summary-more">+{teams.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default TeamsSummary;
