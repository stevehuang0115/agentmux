import React from 'react';
import { Terminal, Play, Square } from 'lucide-react';
import { Button } from '../UI/Button';
import { OverflowMenu } from '../UI/OverflowMenu';
import { TeamHeaderProps } from './types';

export const TeamHeader: React.FC<TeamHeaderProps> = ({
  team,
  teamStatus,
  orchestratorSessionActive,
  onStartTeam,
  onStopTeam,
  onViewTerminal,
  onDeleteTeam,
  onEditTeam,
}) => {
  const isOrchestratorTeam = team?.id === 'orchestrator' || team?.name === 'Orchestrator Team';
  const members = team?.members || [];
  const activeMembers = members.filter(m => m.agentStatus === 'active' || m.sessionName).length;

  return (
    <div className="page-header">
      <div className="header-info">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="page-title mb-0">{team.name}</h1>
        </div>
      </div>
      <div className="header-controls">
        {teamStatus === 'idle' ? (
          <Button variant="success" onClick={onStartTeam} icon={Play}>
            Start Team
          </Button>
        ) : (
          <Button variant="danger" onClick={onStopTeam} icon={Square}>
            Stop Team
          </Button>
        )}
        {isOrchestratorTeam && (
          <Button variant="primary" onClick={onViewTerminal} icon={Terminal}>
            View Terminal
          </Button>
        )}
        {/* Three-dot menu with edit/delete actions */}
        <OverflowMenu
          align="bottom-right"
          items={[
            { label: 'Edit Team', onClick: onEditTeam },
            ...(isOrchestratorTeam ? [] : [{ label: 'Delete Team', danger: true, onClick: onDeleteTeam }])
          ]}
        />
      </div>
    </div>
  );
};
