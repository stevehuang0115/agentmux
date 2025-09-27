
import React, { useState } from 'react';
import { useParams, Link, NavLink, Outlet } from 'react-router-dom';
import { projects } from '../constants';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../components/UI/Icon';
import { ProjectStatus } from '../types';
import { EditProjectModal } from '../components/Modals/EditProjectModal';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';

export const ProjectLayout: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const project = projects.find(p => p.id === id);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    if (!project) {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold">Project not found</h2>
                <Link to="/projects" className="text-primary hover:underline mt-4 inline-block">Back to Projects</Link>
            </div>
        );
    }
    
    const activeTabClass = "border-primary text-primary";
    const inactiveTabClass = "border-transparent text-text-secondary-dark hover:text-primary hover:border-primary/50";

    return (
        <>
            <div className="max-w-7xl mx-auto flex flex-col h-full">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-3 text-sm text-text-secondary-dark">
                            <Link to="/projects" className="hover:text-primary">Projects</Link>
                            <Icon name="chevron_right" className="text-base" />
                            <span className="text-text-primary-dark font-medium">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <h2 className="text-3xl font-bold tracking-tight mt-2">{project.name}</h2>
                        </div>
                        <p className="text-sm text-text-secondary-dark mt-1">Path: {project.path}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsEditModalOpen(true)} variant="secondary" icon="edit">
                            Edit Project
                        </Button>
                        {project.status === ProjectStatus.Running && (
                            <Button variant="danger" icon="stop">
                                Stop
                            </Button>
                        )}
                        {project.status === ProjectStatus.Paused && (
                            <Button variant="primary" icon="play_arrow">
                                Start
                            </Button>
                        )}
                    </div>
                </div>
                <div className="border-b border-border-dark">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <NavLink to={`/projects/${id}`} end className={({ isActive }) => `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${isActive ? activeTabClass : inactiveTabClass}`}>Overview</NavLink>
                        <NavLink to={`/projects/${id}/tasks`} className={({ isActive }) => `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${isActive ? activeTabClass : inactiveTabClass}`}>Tasks</NavLink>
                        <NavLink to={`/projects/${id}/teams`} className={({ isActive }) => `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${isActive ? activeTabClass : inactiveTabClass}`}>Teams</NavLink>
                    </nav>
                </div>
                <div className="py-8 flex-grow">
                    <Outlet />
                </div>
            </div>
            <EditProjectModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} project={project} />
        </>
    );
};
