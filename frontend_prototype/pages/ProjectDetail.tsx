
import React from 'react';
import { useParams } from 'react-router-dom';
import { projects } from '../constants';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';

export const ProjectDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const project = projects.find(p => p.id === id);

    if (!project) {
        return <p>Project details could not be loaded.</p>;
    }
    
    return (
        <div className="space-y-10">
            <section>
                <h3 className="text-xl font-semibold mb-4">Project Metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark">
                        <p className="text-sm font-medium text-text-secondary-dark">Overall Progress</p>
                        <p className="text-3xl font-bold mt-1">{project.progress}%</p>
                    </div>
                    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark">
                        <p className="text-sm font-medium text-text-secondary-dark">Tasks Completed</p>
                        <p className="text-3xl font-bold mt-1">15/20</p>
                    </div>
                    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark">
                        <p className="text-sm font-medium text-text-secondary-dark">Assigned Teams</p>
                        <p className="text-3xl font-bold mt-1">{project.teams.length}</p>
                    </div>
                </div>
            </section>
            
            <section>
                <h3 className="text-xl font-semibold mb-4">Specification Management</h3>
                <div className="bg-surface-dark rounded-lg border border-border-dark divide-y divide-border-dark">
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="font-semibold">Project Goal</p>
                            <p className="text-sm text-text-secondary-dark mt-1">Develop a scalable e-commerce platform with enhanced user experience.</p>
                        </div>
                        <Button variant="secondary" size="sm">Edit</Button>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="font-semibold">User Journey</p>
                            <p className="text-sm text-text-secondary-dark mt-1">User journey mapping and analysis for improved navigation and checkout process.</p>
                        </div>
                        <Button variant="secondary" size="sm">Edit</Button>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-semibold mb-4">Generate Project Tasks</h3>
                <div className="bg-surface-dark p-6 rounded-lg border border-border-dark flex flex-col sm:flex-row gap-4">
                    <Button className="w-full sm:w-auto flex-1">
                        Generate Tasks from Goal
                    </Button>
                    <Button variant="secondary" className="w-full sm:w-auto flex-1">
                        Generate Tasks from User Journey
                    </Button>
                </div>
            </section>
        </div>
    );
};