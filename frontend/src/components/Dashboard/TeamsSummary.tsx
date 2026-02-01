/**
 * Teams Summary Component
 *
 * Compact list of teams for the sidebar.
 *
 * @module components/Dashboard/TeamsSummary
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeams } from '../../hooks/useTeams';
import './Summary.css';

/**
 * Props for TeamsSummary component
 */
interface TeamsSummaryProps {
  /** Whether to show in compact mode (default: false) */
  compact?: boolean;
  /** Maximum number of teams to show in compact mode (default: 5) */
  maxItems?: number;
}

/**
 * Compact list of teams for the sidebar.
 *
 * Shows team names with agent count and supports
 * compact mode for sidebar display.
 *
 * @param props - Component props
 * @returns JSX element with teams summary
 *
 * @example
 * ```tsx
 * // In sidebar
 * <TeamsSummary compact />
 *
 * // Full list
 * <TeamsSummary />
 * ```
 */
export const TeamsSummary: React.FC<TeamsSummaryProps> = ({
  compact = false,
  maxItems = 5,
}) => {
  const navigate = useNavigate();
  const { teams, loading, error } = useTeams();

  /**
   * Handle clicking on a team
   */
  const handleTeamClick = (teamId: string): void => {
    navigate(`/teams/${teamId}`);
  };

  /**
   * Handle clicking "View All"
   */
  const handleViewAll = (): void => {
    navigate('/teams');
  };

  /**
   * Get agent count for a team
   */
  const getAgentCount = (team: { members?: unknown[] }): number => {
    return team.members?.length ?? 0;
  };

  if (loading) {
    return (
      <div className="summary-loading" data-testid="teams-summary-loading">
        Loading teams...
      </div>
    );
  }

  if (error) {
    return (
      <div className="summary-error" data-testid="teams-summary-error">
        Error: {error}
      </div>
    );
  }

  const displayTeams = compact ? teams.slice(0, maxItems) : teams;
  const hasMore = compact && teams.length > maxItems;

  return (
    <div
      className={`summary-list ${compact ? 'compact' : ''}`}
      data-testid="teams-summary"
    >
      <div className="summary-header">
        <h3>Teams</h3>
        <span className="count-badge">{teams.length}</span>
      </div>

      {teams.length === 0 ? (
        <p className="summary-empty" data-testid="teams-empty">
          No teams yet
        </p>
      ) : (
        <ul className="summary-items">
          {displayTeams.map((team) => {
            const agentCount = getAgentCount(team);
            return (
              <li
                key={team.id}
                className="summary-item"
                onClick={() => handleTeamClick(team.id)}
                data-testid={`team-item-${team.id}`}
              >
                <span className="item-name">{team.name}</span>
                <span className="item-meta">
                  {agentCount} agent{agentCount !== 1 ? 's' : ''}
                </span>
              </li>
            );
          })}
          {hasMore && (
            <li
              className="summary-more"
              onClick={handleViewAll}
              data-testid="teams-view-more"
            >
              +{teams.length - maxItems} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default TeamsSummary;
