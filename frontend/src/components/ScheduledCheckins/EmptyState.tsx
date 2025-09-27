import React from 'react';
import { Plus, Clock, CheckCircle } from 'lucide-react';

interface EmptyStateProps {
  type: 'active' | 'completed' | 'logs';
  onCreateMessage?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, onCreateMessage }) => {
  if (type === 'active') {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center">
          <Clock className="w-6 h-6 text-text-secondary-dark" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No active messages</h3>
        <p className="text-sm text-text-secondary-dark max-w-md mx-auto">
          Create your first scheduled message to send messages to teams and projects
        </p>
        <button
          className="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          onClick={onCreateMessage}
        >
          <Plus className="w-5 h-5" />
          Create Scheduled Message
        </button>
      </div>
    );
  }

  if (type === 'completed') {
    return (
      <div className="text-center py-16">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-text-secondary-dark" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No completed messages</h3>
        <p className="text-sm text-text-secondary-dark max-w-md mx-auto">
          Completed one-time messages and deactivated recurring messages will appear here
        </p>
      </div>
    );
  }

  if (type === 'logs') {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-text-secondary-dark">No delivery logs yet</p>
      </div>
    );
  }

  return null;
};
