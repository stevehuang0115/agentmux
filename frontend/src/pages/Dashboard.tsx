import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Show top 6 projects and teams on dashboard
  const topProjects = projects.slice(0, 6);
  const topTeams = teams.slice(0, 6);

  return (
    <div className="page dashboard">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Manage your projects and teams from the central hub
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <section className="dashboard-stats">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Projects</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{teams.length}</div>
            <div className="stat-label">Teams</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">
              {teams.filter(t => t.status === 'working').length}
            </div>
            <div className="stat-label">Working</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">
              {projects.filter(p => p.status === 'active').length}
            </div>
            <div className="stat-label">Running</div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <div className="section-info">
            <h2 className="section-title">
              <FolderOpen className="section-icon" />
              Projects
            </h2>
            <p className="section-description">
              {projects.length} total projects
            </p>
          </div>
          <button 
            className="section-action"
            onClick={navigateToProjects}
          >
            View All
            <ArrowRight className="action-icon" />
          </button>
        </div>

        <div className="cards-grid">
          {topProjects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project}
              showStatus
              showTeams
              onClick={() => navigateToProject(project.id)}
            />
          ))}
          
          <CreateCard
            title="New Project"
            onClick={openProjectCreator}
          />
        </div>
      </section>

      {/* Teams Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <div className="section-info">
            <h2 className="section-title">
              <Users className="section-icon" />
              Teams
            </h2>
            <p className="section-description">
              {teams.length} active teams
            </p>
          </div>
          <button 
            className="section-action"
            onClick={navigateToTeams}
          >
            View All
            <ArrowRight className="action-icon" />
          </button>
        </div>

        <div className="cards-grid">
          {topTeams.map((team) => (
            <TeamCard 
              key={team.id} 
              team={team}
              onClick={() => navigateToTeam(team.id)}
            />
          ))}
          
          <CreateCard
            title="New Team"
            onClick={openTeamCreator}
          />
        </div>
      </section>
    </div>
  );
};