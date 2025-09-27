
import React from 'react';
import { Link } from 'react-router-dom';
import { projects, teams } from '../constants';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { ProjectCard } from '../components/Cards/ProjectCard';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { DashboardTeamCard } from '../components/Cards/DashboardTeamCard';
// FIX: Corrected import path casing to 'Cards' for consistency.
import { CreateCard } from '../components/Cards/CreateCard';
import { ProjectStatus, TeamMemberStatus } from '../types';


const StatCard: React.FC<{title: string, value: string | number}> = ({title, value}) => (
    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50">
        <p className="text-sm font-medium text-text-secondary-dark">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
);

export const Dashboard: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Welcome back, Olivia. Here's a summary of your teams and projects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Projects" value={projects.length} />
        <StatCard title="Teams" value={teams.length} />
        <StatCard title="Active Projects" value={projects.filter(p => p.status === ProjectStatus.Running).length} />
        <StatCard title="Running Agents" value={teams.flatMap(t => t.members).filter(m => m.status === TeamMemberStatus.Started).length} />
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Projects</h3>
            <Link to="/projects" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.slice(0, 2).map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            <CreateCard label="Create New Project" icon="add_circle" />
          </div>
        </section>
        
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Teams</h3>
            <Link to="/teams" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.slice(0, 2).map(team => (
              <DashboardTeamCard key={team.id} team={team} />
            ))}
            <CreateCard label="Create New Team" icon="group_add" />
          </div>
        </section>
      </div>
    </div>
  );
};