/**
 * Orchestrator Status Banner
 *
 * Displays a warning/error banner when the orchestrator is not active.
 * Uses the shared useOrchestratorStatus hook for consistent status across the app.
 *
 * @module components/OrchestratorStatusBanner
 */

import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { IconButton } from './UI';
import { useOrchestratorStatus } from '../hooks/useOrchestratorStatus';

export const OrchestratorStatusBanner: React.FC = () => {
  const { status, isLoading, refresh } = useOrchestratorStatus();
  const [dismissed, setDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Reset dismissed state when status goes non-active
  const isActive = status?.isActive ?? true;
  const agentStatus = status?.agentStatus;

  // Don't show banner while loading, if active, if no status yet, or if dismissed
  if (isLoading || isActive || !status || dismissed) {
    return null;
  }

  const isActivating = agentStatus === 'activating' || agentStatus === 'starting' || agentStatus === 'started';

  const bgColor = isActivating
    ? 'bg-yellow-500/10 border-yellow-500/30'
    : 'bg-rose-500/10 border-rose-500/30';

  const iconColor = isActivating ? 'text-yellow-400' : 'text-rose-400';
  const titleColor = isActivating ? 'text-yellow-300' : 'text-rose-300';
  const messageColor = isActivating ? 'text-yellow-200/80' : 'text-rose-200/80';

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${bgColor}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={`shrink-0 ${iconColor}`} size={18} />
        <div className="flex items-center gap-2 text-sm">
          <span className={`font-semibold ${titleColor}`}>
            {isActivating ? 'Orchestrator Initializing' : 'Orchestrator Not Running'}
          </span>
          <span className={messageColor}>
            {isActivating
              ? 'The AgentMux orchestrator is starting up. This may take a few moments...'
              : 'The AgentMux orchestrator is not running. Check the application logs for issues.'
            }
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton
          icon={RefreshCw}
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          className={isRefreshing ? 'animate-spin' : ''}
          aria-label="Refresh status"
        />
        <IconButton
          icon={X}
          onClick={() => setDismissed(true)}
          variant="ghost"
          size="sm"
          aria-label="Dismiss banner"
        />
      </div>
    </div>
  );
};
