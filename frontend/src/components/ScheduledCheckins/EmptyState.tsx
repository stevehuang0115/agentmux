import React from 'react';
import { Plus } from 'lucide-react';

interface EmptyStateProps {
  type: 'active' | 'completed' | 'logs';
  onCreateMessage?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, onCreateMessage }) => {
  if (type === 'active') {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏰</div>
        <h3 className="empty-title">No active messages</h3>
        <p className="empty-description">
          Create your first scheduled message to send messages to teams and projects
        </p>
        <button 
          className="primary-button"
          onClick={onCreateMessage}
        >
          <Plus className="button-icon" />
          Create Scheduled Message
        </button>
      </div>
    );
  }

  if (type === 'completed') {
    return (
      <div className="empty-state">
        <div className="empty-icon">✅</div>
        <h3 className="empty-title">No completed messages</h3>
        <p className="empty-description">
          Completed one-time messages and deactivated recurring messages will appear here
        </p>
      </div>
    );
  }

  if (type === 'logs') {
    return (
      <div className="empty-logs">
        <p>No delivery logs yet</p>
      </div>
    );
  }

  return null;
};