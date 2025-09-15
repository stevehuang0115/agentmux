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
  const cardClass = `scheduled-message-card ${!isActive ? 'completed' : ''} ${onCardClick ? 'clickable' : ''}`;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card click if action button was clicked
    if ((e.target as Element).closest('.message-actions')) {
      return;
    }
    onCardClick?.(message);
  };

  return (
    <div className={cardClass} onClick={handleCardClick}>
      {/* Compact Header */}
      <div className="message-header">
        <div className="message-info">
          <h3 className="message-name">{message.name}</h3>
          <div className={`status-indicator ${isActive ? 'active' : 'completed'}`}>
            <CheckCircle className="status-icon" />
            {isActive ? 'Active' : 'Completed'}
          </div>
        </div>

        <div className="message-actions">
          <button
            className="action-btn toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(message.id, message.isActive);
            }}
            title={isActive ? "Disable" : "Re-activate"}
          >
            {isActive ? <Pause size={16} /> : <Play size={16} />}
          </button>
          {isActive && (
            <>
              <button
                className="action-btn edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(message);
                }}
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                className="action-btn run-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRunNow(message.id, message.name);
                }}
                title="Run now"
              >
                <Play size={16} />
              </button>
            </>
          )}
          <button
            className="action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(message.id, message.name);
            }}
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Compact Content */}
      <div className="message-content-compact">
        <div className="message-details-row">
          <div className="detail-item">
            <span className="detail-label">Target:</span>
            <span className="detail-value">{message.targetTeam}</span>
          </div>
          {message.targetProject && (
            <div className="detail-item">
              <span className="detail-label">Project:</span>
              <span className="detail-value">{message.targetProject}</span>
            </div>
          )}
        </div>

        <div className="schedule-row">
          <div className="detail-item">
            <span className="detail-label">Schedule:</span>
            <span className="detail-value">
              {message.isRecurring ? 'Every' : 'Once after'} {message.delayAmount} {message.delayUnit}
            </span>
          </div>
          {message.nextRun && isActive && (
            <div className="detail-item">
              <Clock size={14} className="schedule-icon" />
              <span className="detail-value next-run">Next: {formatDate(message.nextRun)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};