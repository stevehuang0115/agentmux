import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { IconButton } from './UI';

interface OrchestratorStatus {
  sessionId: string;
  status: 'activating' | 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export const OrchestratorStatusBanner: React.FC = () => {
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOrchestratorStatus = async () => {
    try {
      const response = await fetch('/api/teams/activity-check');
      const data = await response.json();
      
      if (data.success && data.data && data.data.orchestrator) {
        // Map the new response format to the old format for backward compatibility
        const orchestratorData: OrchestratorStatus = {
          sessionId: data.data.orchestrator.sessionName || 'agentmux-orc',
          status: data.data.orchestrator.running ? 'active' : 'inactive',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setOrchestratorStatus(orchestratorData);
      }
    } catch (error) {
      console.error('Error fetching orchestrator status:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrchestratorStatus();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    fetchOrchestratorStatus();
    
    // Poll every 30 seconds for status updates (reduced frequency)
    const interval = setInterval(fetchOrchestratorStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Reset dismissed state when status changes to show banner again
  useEffect(() => {
    if (orchestratorStatus?.status !== 'active') {
      setDismissed(false);
    }
  }, [orchestratorStatus?.status]);

  // Don't show banner if orchestrator is active, doesn't exist, or was dismissed
  if (!orchestratorStatus || orchestratorStatus.status === 'active' || dismissed) {
    return null;
  }

  const isActivating = orchestratorStatus.status === 'activating';
  const isInactive = orchestratorStatus.status === 'inactive';

  return (
    <div className={`orchestrator-status-banner ${isActivating ? 'warning' : 'error'}`}>
      <div className="banner-content">
        <AlertTriangle className="banner-icon" size={20} />
        <div className="banner-text">
          <span className="banner-title">
            {isActivating ? 'Orchestrator Initializing' : 'Orchestrator Not Running'}
          </span>
          <span className="banner-message">
            {isActivating 
              ? 'The AgentMux orchestrator is starting up. This may take a few moments...'
              : 'The AgentMux orchestrator is not running. Check the application logs for issues.'
            }
          </span>
        </div>
      </div>
      <div className="banner-actions">
        <IconButton
          icon={RefreshCw}
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
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