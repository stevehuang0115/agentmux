
import React from 'react';
import { ScheduledMessage } from '../../types';
import { Icon } from '../UI/Icon';
import { Button } from '../UI/Button';

interface ScheduleDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ScheduledMessage | null;
}

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({ isOpen, onClose, message }) => {
  if (!isOpen || !message) return null;

  const statusInfo = {
    'Active': { className: 'bg-green-500/10 text-green-400' },
    'Completed': { className: 'bg-blue-500/10 text-blue-400' },
  };
  const currentStatus = statusInfo[message.status];

  return (
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-xl m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border-dark">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-text-primary-dark">Schedule Details</h3>
              <p className="text-sm text-text-secondary-dark mt-1">{message.name}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
              <Icon name="close" />
            </Button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold uppercase text-text-secondary-dark tracking-wider">Target</label>
              <div className="flex items-center gap-2 mt-1">
                <Icon name={message.targetType === 'Team' ? 'group' : 'folder'} className="text-primary text-xl" />
                <p className="text-sm font-medium">{message.targetType}: {message.targetName}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-text-secondary-dark tracking-wider">Schedule</label>
              <div className="flex items-center gap-2 mt-1">
                <Icon name="schedule" className="text-primary text-xl" />
                <p className="text-sm font-medium">{message.schedule}</p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-text-secondary-dark tracking-wider">Status</label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${currentStatus.className}`}>
                  {message.status}
                </span>
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-semibold uppercase text-text-secondary-dark tracking-wider">Message Content</label>
            <div className="mt-2 p-4 bg-background-dark rounded-lg border border-border-dark">
              <p className="text-sm text-text-secondary-dark whitespace-pre-wrap font-mono">{message.message}</p>
            </div>
          </div>
        </div>

        <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="secondary" icon="edit">Edit</Button>
            {message.status === 'Active' && <Button variant="secondary" icon="pause">Pause</Button>}
            <Button variant="danger-ghost" icon="delete">Delete</Button>
          </div>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};
