import React from 'react';
import { MessageDeliveryLog } from './types';
import { EmptyState } from './EmptyState';

interface DeliveryLogsTableProps {
  deliveryLogs: MessageDeliveryLog[];
  formatDate: (dateString: string) => string;
  onClearLogs: () => Promise<void>;
}

export const DeliveryLogsTable: React.FC<DeliveryLogsTableProps> = ({
  deliveryLogs,
  formatDate,
  onClearLogs
}) => {
  const handleClearLogs = async () => {
    if (confirm('Clear all delivery logs?')) {
      await onClearLogs();
    }
  };

  return (
    <div className="delivery-logs-section">
      <div className="section-header">
        <h2>Message Delivery Logs</h2>
        <button
          className="btn btn-secondary"
          onClick={handleClearLogs}
          style={{ padding: '0.75rem 1.5rem' }}
        >
          Clear Logs
        </button>
      </div>
      
      {deliveryLogs.length > 0 ? (
        <div className="delivery-logs-table">
          <div className="table-header">
            <div className="col-time">Time</div>
            <div className="col-message">Message</div>
            <div className="col-target">Target</div>
            <div className="col-status">Status</div>
          </div>
          {deliveryLogs.slice(0, 50).map((log) => (
            <div key={log.id} className={`table-row ${log.success ? 'success' : 'error'}`}>
              <div className="col-time">{formatDate(log.sentAt)}</div>
              <div className="col-message">
                <div className="message-name">{log.messageName}</div>
                <div className="message-content">{log.message.substring(0, 100)}...</div>
              </div>
              <div className="col-target">
                <div className="target-team">{log.targetTeam}</div>
                {log.targetProject && <div className="target-project">{log.targetProject}</div>}
              </div>
              <div className="col-status">
                {log.success ? (
                  <span className="status-success">✓ Delivered</span>
                ) : (
                  <span className="status-error" title={log.error}>✗ Failed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState type="logs" />
      )}
    </div>
  );
};