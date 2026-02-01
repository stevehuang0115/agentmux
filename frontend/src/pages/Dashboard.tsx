/**
 * Dashboard Page
 *
 * Main landing page showing projects and teams overview.
 * Features card-based layout with quick access to recent items.
 *
 * @module pages/Dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectCard } from '../components/Cards/ProjectCard';
import { TeamCard } from '../components/Cards/TeamCard';
import { CreateCard } from '../components/Cards/CreateCard';
import { apiService } from '../services/api.service';
import type { Project, Team } from '../types';
import './Dashboard.css';

/**
 * Maximum number of items to show in each section
 */
const MAX_ITEMS_PER_SECTION = 4;

/**
 * Dashboard component - main application landing page
 *
 * Features:
 * - Projects section with card grid
 * - Teams section with card grid
 * - Quick create cards for new items
 * - View All navigation buttons
 *
 * @returns Dashboard component
 */
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch projects and teams data
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [projectsData, teamsData] = await Promise.all([
        apiService.getProjects(),
        apiService.getTeams(),
      ]);

      setProjects(projectsData.slice(0, MAX_ITEMS_PER_SECTION));
      setTeams(teamsData.slice(0, MAX_ITEMS_PER_SECTION));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      console.error('Dashboard: Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Handle project card click
   */
  const handleProjectClick = useCallback(
    (projectId: string) => {
      navigate(`/projects/${projectId}`);
    },
    [navigate]
  );

  /**
   * Handle team card click
   */
  const handleTeamClick = useCallback(
    (teamId: string) => {
      navigate(`/teams/${teamId}`);
    },
    [navigate]
  );

  /**
   * Handle create project click
   */
  const handleCreateProject = useCallback(() => {
    navigate('/projects?create=true');
  }, [navigate]);

  /**
   * Handle create team click
   */
  const handleCreateTeam = useCallback(() => {
    navigate('/teams?create=true');
  }, [navigate]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error">
          <p>Error: {error}</p>
          <button className="btn-primary" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Projects Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Projects</h2>
          <button
            className="btn-secondary"
            onClick={() => navigate('/projects')}
          >
            View All
          </button>
        </div>
        <div className="cards-grid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showStatus
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
          <CreateCard title="New Project" onClick={handleCreateProject} />
        </div>
        {projects.length === 0 && (
          <p className="empty-message">
            No projects yet. Create your first project to get started.
          </p>
        )}
      </section>

      {/* Teams Section */}
      <section className="dashboard-section">
        <div className="section-header">
          <h2>Teams</h2>
          <button
            className="btn-secondary"
            onClick={() => navigate('/teams')}
          >
            View All
          </button>
        </div>
        <div className="cards-grid">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onClick={() => handleTeamClick(team.id)}
            />
          ))}
          <CreateCard title="New Team" onClick={handleCreateTeam} />
        </div>
        {teams.length === 0 && (
          <p className="empty-message">
            No teams yet. Create your first team to get started.
          </p>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
