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
}

export const ScheduledMessageCard: React.FC<ScheduledMessageCardProps> = ({
  message,
  onEdit,
  onDelete,
  onToggleActive,
  onRunNow,
  formatDate
}) => {
  const isActive = message.isActive;
  const cardClass = `scheduled-message-card ${!isActive ? 'completed' : ''}`;

  return (
    <div className={cardClass}>
      <div className="message-header">
        <div className="message-info">
          <h3 className="message-name">{message.name}</h3>
          <div className="message-status">
            <div className={`status-indicator ${isActive ? 'active' : 'completed'}`}>
              <CheckCircle className="status-icon" />
              {isActive ? 'Active' : 'Completed'}
            </div>
            {!isActive && (
              <div className="message-type">
                {message.isRecurring ? 'Recurring (Deactivated)' : 'One-time (Executed)'}
              </div>
            )}
          </div>
        </div>
        
        <div className="message-actions">
          <button
            className="action-btn toggle-btn"
            onClick={() => onToggleActive(message.id, message.isActive)}
            title={isActive ? "Disable" : "Re-activate"}
          >
            {isActive ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {isActive && (
            <>
              <button
                className="action-btn edit-btn"
                onClick={() => onEdit(message)}
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                className="action-btn run-btn"
                onClick={() => onRunNow(message.id, message.name)}
                title="Run now"
              >
                <Play size={16} />
              </button>
            </>
          )}
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(message.id, message.name)}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="message-content">
        <div className="message-target">
          <strong>Target Team:</strong> {message.targetTeam}
          {message.targetProject && (
            <><br/><strong>Target Project:</strong> {message.targetProject}</>
          )}
        </div>
        
        <div className="message-text">
          <strong>Message:</strong>
          <div className="message-preview">{message.message}</div>
        </div>
        
        <div className="message-schedule">
          <strong>{isActive ? 'Schedule:' : 'Original Schedule:'}</strong>
          {message.isRecurring ? 'Recurring' : 'One-time'} - 
          Every {message.delayAmount} {message.delayUnit}
        </div>
      </div>

      <div className="message-meta">
        {message.lastRun && (
          <div className="meta-item">
            <Clock size={14} />
            <span>
              {isActive ? 'Last run:' : 'Last executed:'} {formatDate(message.lastRun)}
            </span>
          </div>
        )}
        {message.nextRun && isActive && (
          <div className="meta-item">
            <Clock size={14} />
            <span>Next run: {formatDate(message.nextRun)}</span>
          </div>
        )}
        {!isActive && (
          <div className="meta-item">
            <span>Status: {message.isRecurring ? 'Recurring message was deactivated' : 'One-time message completed'}</span>
          </div>
        )}
      </div>
    </div>
  );
};