
import React from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
import { Task } from '../../types';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

const statusInfo = {
    'In Progress': { icon: 'sync', color: 'text-primary' },
    'Open': { icon: 'radio_button_unchecked', color: 'text-text-secondary-dark' },
    'Done': { icon: 'check_circle', color: 'text-green-400' },
    'Blocked': { icon: 'block', color: 'text-red-400' },
}

const priorityInfo = {
    'High': { icon: 'priority_high', color: 'text-red-400' },
    'Medium': { icon: 'signal_cellular_alt_2_bar', color: 'text-yellow-400' },
    'Low': { icon: 'signal_cellular_alt_1_bar', color: 'text-green-400' },
}

const dependencyStatusColors = {
    'Done': 'bg-green-500/20 text-green-400',
    'In Progress': 'bg-blue-500/20 text-blue-400',
    'Open': 'bg-yellow-500/20 text-yellow-400'
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, task }) => {
  if (!isOpen || !task) return null;

  const currentStatus = statusInfo[task.status];
  const currentPriority = priorityInfo[task.priority];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-surface-dark w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border-dark flex-shrink-0">
                <div className="flex items-center gap-4">
                    <span className="bg-primary/10 text-primary p-2 rounded-lg">
                        <Icon name="task_alt" />
                    </span>
                    <div>
                        <h3 className="text-xl font-bold">{task.title}</h3>
                        <p className="text-sm text-text-secondary-dark">In <a className="text-primary hover:underline" href="#">Project Phoenix</a></p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="w-8 h-8"><Icon name="more_horiz" /></Button>
                    <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8"><Icon name="close" /></Button>
                </div>
            </div>
            <div className="flex-grow p-6 overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-6">
                        <div>
                            <label className="text-xs font-semibold text-text-secondary-dark">Status</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Icon name={currentStatus.icon} className={`${currentStatus.color} text-xl`} />
                                <p className="text-sm font-medium">{task.status}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-text-secondary-dark">Priority</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Icon name={currentPriority.icon} className={`${currentPriority.color} text-xl`} />
                                <p className="text-sm font-medium">{task.priority}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-text-secondary-dark">Milestone</label>
                            <div className="flex items-center gap-2 mt-1">
                                <Icon name="flag" className="text-primary/80 text-xl" />
                                <p className="text-sm font-medium">{task.milestone}</p>
                            </div>
                        </div>
                    </div>
                    <Button variant="secondary" size="sm" icon="edit">
                        Edit
                    </Button>
                </div>
                <h4 className="text-lg font-semibold mb-4">Description</h4>
                <p className="text-text-secondary-dark leading-relaxed prose prose-invert max-w-none text-sm">
                    {task.description}
                </p>

                {task.dependencies.length > 0 && (
                    <>
                        <h4 className="text-lg font-semibold mt-8 mb-4">Dependencies ({task.dependencies.length})</h4>
                        <div className="space-y-3">
                            {task.dependencies.map(dep => (
                                <a key={dep.id} className="flex items-center gap-3 p-3 bg-background-dark rounded-lg border border-border-dark hover:border-primary/50 transition-colors" href="#">
                                    <Icon name="task_alt" className="text-primary" />
                                    <span className="font-medium text-sm">{dep.title}</span>
                                    <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${dependencyStatusColors[dep.status]}`}>{dep.status}</span>
                                </a>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    </div>
  );
};