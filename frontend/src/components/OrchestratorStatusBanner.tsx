import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { IconButton } from './UI';
import { webSocketService } from '../services/websocket.service';

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
    // Note: Initial orchestrator status is now provided via WebSocket events
    // The WebSocket listener will handle all status updates
    console.log('Orchestrator status will be loaded via WebSocket events');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchOrchestratorStatus();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const initializeWebSocket = async () => {
    try {
      if (!webSocketService.isConnected()) {
        await webSocketService.connect();
      }
      
      // Listen for orchestrator status updates
      webSocketService.on('orchestrator_status_changed', handleOrchestratorStatusUpdate);
      
      console.log('WebSocket initialized for orchestrator status monitoring');
    } catch (error) {
      console.error('Failed to initialize WebSocket for orchestrator status:', error);
    }
  };

  const handleOrchestratorStatusUpdate = (orchestratorData: any) => {
    console.log('Received orchestrator status update:', orchestratorData);
    
    // Convert the new format to the expected format
    const orchestratorStatus: OrchestratorStatus = {
      sessionId: orchestratorData.sessionName || 'agentmux-orc',
      status: orchestratorData.running ? 'active' : 'inactive',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    setOrchestratorStatus(orchestratorStatus);
  };

  useEffect(() => {
    fetchOrchestratorStatus();
    initializeWebSocket();
    
    return () => {
      // Clean up WebSocket listeners
      webSocketService.off('orchestrator_status_changed', handleOrchestratorStatusUpdate);
    };
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