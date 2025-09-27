
import React from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { Task } from '../../types';

const priorityColors: Record<string, string> = {
  High: 'bg-red-500/20 text-red-400',
  Medium: 'bg-yellow-500/20 text-yellow-400',
  Low: 'bg-green-500/20 text-green-400',
};

export const KanbanCard: React.FC<{task: Task; onClick: () => void}> = ({ task, onClick }) => (
    <div onClick={onClick} className={`bg-surface-dark p-4 rounded-lg border border-border-dark hover:border-primary/50 cursor-pointer shadow-sm transition-all ${task.status === 'Done' ? 'opacity-70' : ''} ${task.status === 'Blocked' ? 'border-red-500/50 hover:border-red-500/80' : ''}`}>
        <p className={`font-semibold text-sm leading-snug ${task.status === 'Done' ? 'line-through text-text-secondary-dark' : ''}`}>{task.title}</p>
        <div className="flex items-center justify-between mt-3 gap-2">
            <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${priorityColors[task.priority]}`}>{task.priority}</span>
                 <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary/80 border border-primary/30">{task.milestone.split(':')[0]}</span>
                {task.dependencies.length > 0 && (
                    <div className="flex items-center gap-1 text-primary" title={`${task.dependencies.length} dependencies`}>
                        <Icon name="link" className="text-base" />
                        <span className="text-xs font-medium">{task.dependencies.length}</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1">
                <img className="w-6 h-6 rounded-full bg-cover bg-center ring-2 ring-surface-dark" src={task.assignee} alt="assignee" />
                <button onClick={(e) => { e.stopPropagation(); /* Logic to start/pause task */ }} className="w-7 h-7 flex items-center justify-center rounded-full text-text-secondary-dark hover:bg-primary/10 hover:text-primary transition-colors">
                    <Icon name={task.status === 'In Progress' ? 'pause' : 'play_arrow'} className="text-xl" />
                </button>
            </div>
        </div>
    </div>
);