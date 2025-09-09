import React from 'react';
import { ScoreCard, ScoreCardGrid } from '../UI/ScoreCard';
import { TeamStatsProps } from './types';
import '../../components/UI/ScoreCard.css';

export const TeamStats: React.FC<TeamStatsProps> = ({
  team,
  teamStatus,
  projectName,
}) => {
  const activeMembers = team?.members?.filter(m => m.sessionName).length || 0;
  const totalMembers = team?.members?.length || 0;

  return (
    <ScoreCardGrid variant="horizontal">
      <ScoreCard 
        label="Team Status" 
        variant="horizontal"
      >
        <span className={`status-badge status-${teamStatus}`}>
          {teamStatus?.toUpperCase()}
        </span>
      </ScoreCard>
      
      <ScoreCard 
        label="Active Members" 
        variant="horizontal"
      >
        <span className="score-card__value--number">
          {activeMembers} / {totalMembers}
        </span>
      </ScoreCard>
      
      <ScoreCard 
        label="Project" 
        value={projectName || 'None'}
        variant="horizontal"
      />
      
      <ScoreCard 
        label="Created" 
        value={team?.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}
        variant="horizontal"
      />
    </ScoreCardGrid>
  );
};