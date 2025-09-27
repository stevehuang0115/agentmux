import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ProjectCard } from '@/components/Cards/ProjectCard';
import { TeamCard } from '@/components/Cards/TeamCard';
import { CreateCard } from '@/components/Cards/CreateCard';
import { Team, Project, ApiResponse } from '@/types';
import axios from 'axios';
import { FolderOpen, Users, ArrowRight } from 'lucide-react';

const API_BASE = '/api';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsResponse, teamsResponse] = await Promise.all([
        axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`),
        axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`)
      ]);

      if (projectsResponse.data.success) {
        setProjects(projectsResponse.data.data || []);
      }
      
      if (teamsResponse.data.success) {
        setTeams(teamsResponse.data.data || []);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToProjects = () => navigate('/projects');
  const navigateToTeams = () => navigate('/teams');
  const navigateToProject = (projectId: string) => navigate(`/projects/${projectId}`);
  const navigateToTeam = (teamId: string) => navigate(`/teams/${teamId}`);
  
  const openProjectCreator = () => {
    // This would open a modal or navigate to project creation
    navigate('/projects?create=true');
  };
  
  const openTeamCreator = () => {
    navigate('/teams?create=true');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p className="ml-3 text-text-secondary-dark">Loading dashboard...</p>
      </div>
    );
  }

  // Show top 2 projects and teams on dashboard like prototype
  const topProjects = projects.slice(0, 2);
  const topTeams = teams.slice(0, 2);

  const StatCard: React.FC<{title: string, value: string | number}> = ({title, value}) => (
    <div className="bg-surface-dark p-6 rounded-lg border border-border-dark transition-all hover:shadow-lg hover:border-primary/50">
      <p className="text-sm font-medium text-text-secondary-dark">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-text-secondary-dark mt-1">Welcome back. Here's a summary of your teams and projects.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Projects" value={projects.length} />
        <StatCard title="Teams" value={teams.length} />
        <StatCard title="Active Projects" value={projects.filter(p => p.status === 'active').length} />
        <StatCard title="Running Agents" value={teams.flatMap(t => t.members).filter(m => m.agentStatus === 'active').length} />
      </div>

      <div className="space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Projects</h3>
            <Link to="/projects" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {topProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                showStatus
                showTeams
                onClick={() => navigateToProject(project.id)}
              />
            ))}
            <CreateCard
              title="Create New Project"
              onClick={openProjectCreator}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Teams</h3>
            <Link to="/teams" className="text-sm font-semibold text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {topTeams.map(team => (
              <TeamCard
                key={team.id}
                team={team}
                onClick={() => navigateToTeam(team.id)}
              />
            ))}
            <CreateCard
              title="Create New Team"
              onClick={openTeamCreator}
            />
          </div>
        </section>
      </div>
    </div>
  );
};