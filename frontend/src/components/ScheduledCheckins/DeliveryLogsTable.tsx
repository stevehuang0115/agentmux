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
    <section className="mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Message Delivery Logs</h3>
        <button
          className="px-4 py-2 rounded-lg border border-border-dark text-sm text-text-primary-dark hover:border-primary/50"
          onClick={handleClearLogs}
        >
          Clear Logs
        </button>
      </div>

      {deliveryLogs.length > 0 ? (
        <div className="bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-dark">
              <thead className="bg-background-dark">
                <tr>
                  <th scope="col" className="py-3.5 px-4 text-left text-sm font-semibold text-text-primary-dark">Time</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Message</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Target</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-text-primary-dark">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-dark">
                {deliveryLogs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-text-secondary-dark">{formatDate(log.sentAt)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-text-primary-dark">
                      <div className="font-medium">{log.messageName}</div>
                      <div className="text-text-secondary-dark">{log.message.substring(0, 100)}...</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-text-secondary-dark">
                      <div>{log.targetTeam}</div>
                      {log.targetProject && <div className="text-text-secondary-dark">{log.targetProject}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${log.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {log.success ? 'Delivered' : 'Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState type="logs" />
      )}
    </section>
  );
};
