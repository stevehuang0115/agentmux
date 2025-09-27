
import React, { useState, useMemo } from 'react';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../components/UI/Icon';
import { TaskModal } from '../components/Kanban/TaskModal';
import { KanbanColumn } from '../components/Kanban/KanbanColumn';
import { taskData } from '../constants';
import { Task } from '../types';

export const ProjectTasks: React.FC = () => {
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [activeFilter, setActiveFilter] = useState<'All' | 'Completed' | string>('All');

    const milestones = useMemo(() => {
        const allMilestones = [...new Set(taskData.map(task => task.milestone))];
        return allMilestones.sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || '0');
            const numB = parseInt(b.match(/\d+/)?.[0] || '0');
            return numA - numB;
        });
    }, []);

    const milestoneCounts = useMemo(() => {
        return milestones.reduce((acc, milestone) => {
            acc[milestone] = taskData.filter(task => task.milestone === milestone && task.status !== 'Done').length;
            return acc;
        }, {} as Record<string, number>);
    }, [milestones]);

    const filteredTasks = useMemo(() => {
        if (activeFilter === 'All') {
            return taskData;
        }
        if (activeFilter === 'Completed') {
            return taskData.filter(task => task.status === 'Done');
        }
        return taskData.filter(task => task.milestone === activeFilter);
    }, [activeFilter]);
    
    const taskColumns = useMemo(() => {
        const columns: Record<Task['status'], Task[]> = {
            'Open': [],
            'In Progress': [],
            'Done': [],
            'Blocked': []
        };
        filteredTasks.forEach(task => {
            if (columns[task.status]) {
                columns[task.status].push(task);
            }
        });
        return columns;
    }, [filteredTasks]);

    const columnOrder: Array<Task['status']> = ['Open', 'In Progress', 'Done', 'Blocked'];

    return (
        <>
            <div className="flex flex-col h-full -my-8">
                <div className="px-0 pt-4 pb-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                        <span className="text-sm font-medium text-text-secondary-dark flex-shrink-0">Milestones:</span>
                        
                        <button 
                            onClick={() => setActiveFilter('All')}
                            className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${activeFilter === 'All' ? 'bg-primary/10 text-primary border border-primary/50' : 'bg-surface-dark border border-border-dark hover:bg-background-dark hover:border-primary/50 hover:text-primary'}`}
                        >
                            All
                        </button>

                        {milestones.map(milestone => {
                            const count = milestoneCounts[milestone];
                            const isActive = activeFilter === milestone;
                            const isDisabled = count === 0;

                            return (
                                <button 
                                    key={milestone}
                                    onClick={() => !isDisabled && setActiveFilter(milestone)}
                                    disabled={isDisabled}
                                    className={`flex items-center gap-2 px-3 py-1 text-sm font-semibold rounded-full transition-colors ${isActive ? 'bg-primary/10 text-primary border border-primary/50' : 'bg-surface-dark border border-border-dark'} ${isDisabled ? 'text-text-secondary-dark cursor-not-allowed opacity-60' : 'hover:bg-background-dark hover:border-primary/50 hover:text-primary'}`}
                                >
                                    <span>{milestone}</span>
                                    <span className={`text-xs font-normal px-1.5 py-0.5 rounded-full ${isActive ? 'text-white bg-primary' : 'text-text-secondary-dark bg-background-dark'}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                        
                        <button 
                            onClick={() => setActiveFilter('Completed')}
                            className={`flex items-center gap-1.5 px-3 py-1 text-sm font-semibold rounded-full transition-colors ${activeFilter === 'Completed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-surface-dark border border-border-dark hover:bg-green-500/20 hover:text-green-400 hover:border-green-500/30'}`}
                        >
                            <Icon name="check_circle" className="text-base" />
                            <span>Completed</span>
                        </button>
                    </div>
                </div>
                <div className="flex-grow overflow-x-auto">
                    <div className="inline-grid grid-flow-col auto-cols-min gap-6 pb-8">
                        {columnOrder.map(status => (
                            <KanbanColumn
                                key={status}
                                title={status}
                                tasks={taskColumns[status] || []}
                                onTaskClick={setSelectedTask}
                            />
                        ))}
                    </div>
                </div>
            </div>
            {selectedTask && <TaskModal isOpen={!!selectedTask} onClose={() => setSelectedTask(null)} task={selectedTask} />}
        </>
    );
};