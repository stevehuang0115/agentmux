import React from 'react';
import { Edit, Trash2, Clock, Play, Pause, CheckCircle } from 'lucide-react';
import { ScheduledMessage } from './types';

interface ScheduledMessageCardProps {
  message: ScheduledMessage;
  onEdit: (message: ScheduledMessage) => void;
  onDelete: (id: string, name: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onRunNow: (id: string, name: string) => void;
  formatDate: (dateString: string) => string;
  onCardClick?: (message: ScheduledMessage) => void;
}

export const ScheduledMessageCard: React.FC<ScheduledMessageCardProps> = ({
  message,
  onEdit,
  onDelete,
  onToggleActive,
  onRunNow,
  formatDate,
  onCardClick
}) => {
  const isActive = message.isActive;
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if action button was clicked
    if ((e.target as Element).closest('[data-actions]')) {
      return;
    }
    onCardClick?.(message);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`bg-surface-dark p-5 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50 flex flex-col justify-between ${onCardClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg truncate">{message.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isActive ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-300'}`}>
              <CheckCircle className="w-3.5 h-3.5" />
              {isActive ? 'Active' : 'Completed'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" data-actions>
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-primary/50"
            onClick={(e) => { e.stopPropagation(); onToggleActive(message.id, message.isActive); }}
            title={isActive ? 'Disable' : 'Re-activate'}
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          {isActive && (
            <>
              <button
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-primary/50"
                onClick={(e) => { e.stopPropagation(); onEdit(message); }}
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border-dark text-text-secondary-dark hover:text-text-primary-dark hover:border-primary/50"
                onClick={(e) => { e.stopPropagation(); onRunNow(message.id, message.name); }}
                title="Run now"
              >
                <Play className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border-dark text-text-secondary-dark hover:text-red-300 hover:border-red-500/50"
            onClick={(e) => { e.stopPropagation(); onDelete(message.id, message.name); }}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary-dark">Target:</span>
            <span className="font-medium">{message.targetTeam}</span>
          </div>
          {message.targetProject && (
            <div className="flex items-center gap-2">
              <span className="text-text-secondary-dark">Project:</span>
              <span className="font-medium">{message.targetProject}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary-dark">Schedule:</span>
            <span className="font-medium">
              {message.isRecurring ? 'Every' : 'Once after'} {message.delayAmount} {message.delayUnit}
            </span>
          </div>
          {message.nextRun && isActive && (
            <div className="flex items-center gap-2 text-text-secondary-dark">
              <Clock className="w-4 h-4" />
              <span className="font-medium text-text-primary-dark">Next: {formatDate(message.nextRun)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
