import React from 'react';
import { Terminal } from 'lucide-react';
import { Button } from '../UI/Button';
import { TeamHeaderProps } from './types';

export const TeamHeader: React.FC<TeamHeaderProps> = ({
  team,
  teamStatus,
  orchestratorSessionActive,
  onStartTeam,
  onStopTeam,
  onViewTerminal,
  onDeleteTeam,
}) => {
  const isOrchestratorTeam = team?.id === 'orchestrator' || team?.name === 'Orchestrator Team';

  return (
    <div className="page-header">
      <div className="header-info">
        <h1 className="page-title">{team.name}</h1>
      </div>
      <div className="header-controls">
        {/* Team action buttons in header */}
        {teamStatus === 'idle' ? (
          <Button variant="success" onClick={onStartTeam}>
            Start Team
          </Button>
        ) : (
          <Button variant="secondary" onClick={onStopTeam}>
            Stop Team
          </Button>
        )}
        
        {/* Show View Terminal button for Orchestrator Team */}
        {isOrchestratorTeam && (
          <Button variant="primary" onClick={onViewTerminal} icon={Terminal}>
            View Terminal
          </Button>
        )}
        
        {/* Delete Team button - hide for Orchestrator Team */}
        {!isOrchestratorTeam && (
          <Button variant="danger" onClick={onDeleteTeam}>
            Delete Team
          </Button>
        )}
      </div>
    </div>
  );
};