/**
 * Dashboard Page
 *
 * Main landing page showing projects and teams overview.
 * Features card-based layout with quick access to recent items.
 *
 * @module pages/Dashboard
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
   * Track mount status using ref to prevent state updates after unmount
   * This ref persists across retries and component lifecycle
   */
  const isMountedRef = useRef(true);

  /**
   * Fetch projects and teams data
   * Respects mount status to prevent state updates after unmount
   */
  const fetchData = useCallback(async () => {
    try {
      const [projectsData, teamsData] = await Promise.all([
        apiService.getProjects(),
        apiService.getTeams(),
      ]);

      if (isMountedRef.current) {
        setProjects(projectsData.slice(0, MAX_ITEMS_PER_SECTION));
        setTeams(teamsData.slice(0, MAX_ITEMS_PER_SECTION));
        setLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        setLoading(false);
        console.error('Dashboard: Failed to fetch data:', err);
      }
    }
  }, []);

  /**
   * Fetch data on mount and cleanup mount status on unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  /**
   * Retry fetching data after an error
   * Reuses the same fetchData function to avoid code duplication
   */
  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
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

  /**
   * Handle view all projects click
   */
  const handleViewAllProjects = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  /**
   * Handle view all teams click
   */
  const handleViewAllTeams = useCallback(() => {
    navigate('/teams');
  }, [navigate]);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading" role="status" aria-busy="true">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="dashboard-error" role="alert">
          <p>Error: {error}</p>
          <button type="button" className="btn-primary" onClick={handleRetry}>
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
            type="button"
            className="btn-secondary"
            onClick={handleViewAllProjects}
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
            type="button"
            className="btn-secondary"
            onClick={handleViewAllTeams}
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
