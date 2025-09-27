
import React, { useState, useMemo } from 'react';
import { projects } from '../constants';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { ProjectCard } from '../components/Cards/ProjectCard';
import { ProjectStatus } from '../types';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../components/UI/Icon';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../components/UI/Button';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Input } from '../components/UI/Input';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Select } from '../components/UI/Select';

export const Projects: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'All'>('All');

  const filteredProjects = useMemo(() => {
    return projects
      .filter(p => statusFilter === 'All' || p.status === statusFilter)
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Manage your team's projects and track their progress.</p>
        </div>
        <Button icon="add">
          Create New Project
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full md:w-auto md:flex-grow max-w-md">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-dark" />
          <Input 
            className="bg-surface-dark border-border-dark pl-10 text-sm" 
            placeholder="Search projects..." 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
            <Select 
              className="bg-surface-dark border-border-dark text-sm !py-2.5"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'All')}
            >
              <option value="All">All Statuses</option>
              {Object.values(ProjectStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
};