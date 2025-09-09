import React from 'react';
import { AssignmentFiltersProps } from './types';

export const AssignmentFilters: React.FC<AssignmentFiltersProps> = ({
  filterStatus,
  filterTeam,
  assignments,
  onStatusChange,
  onTeamChange,
}) => {
  const uniqueTeamNames = Array.from(new Set(assignments.map(a => a.teamName)));

  return (
    <div className="filter-controls">
      <select
        value={filterStatus}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="all">All Status</option>
        <option value="todo">Todo</option>
        <option value="in-progress">In Progress</option>
        <option value="review">Review</option>
        <option value="done">Done</option>
      </select>
      <select
        value={filterTeam}
        onChange={(e) => onTeamChange(e.target.value)}
      >
        <option value="all">All Teams</option>
        {uniqueTeamNames.map(teamName => (
          <option key={teamName} value={teamName}>{teamName}</option>
        ))}
      </select>
    </div>
  );
};