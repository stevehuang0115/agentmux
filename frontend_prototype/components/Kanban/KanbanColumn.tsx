
import React from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { Task } from '../../types';
import { KanbanCard } from './KanbanCard';

export const KanbanColumn: React.FC<{title: string; tasks: Task[]; onTaskClick: (task: Task) => void;}> = ({ title, tasks, onTaskClick }) => (
    <div className={`w-80 bg-background-dark rounded-lg flex flex-col flex-shrink-0 ${title === 'Done' ? 'h-full max-h-[calc(100vh-22rem)]' : ''}`}>
        <div className="p-4 flex items-center justify-between border-b border-border-dark">
            <h3 className="font-semibold text-text-primary-dark">{title} <span className="text-sm font-normal text-text-secondary-dark">({tasks.length})</span></h3>
            <button className="text-text-secondary-dark hover:text-primary transition-colors"><Icon name="more_horiz" /></button>
        </div>
        <div className={`p-4 flex-grow space-y-4 overflow-y-auto ${title === 'Done' ? 'pr-2' : ''}`}>
            {tasks.map(task => <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />)}
        </div>
    </div>
);