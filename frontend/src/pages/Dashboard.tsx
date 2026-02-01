/**
 * Dashboard Page
 *
 * Chat-centric interface for interacting with the orchestrator.
 * Features a sidebar with navigation tabs and a main chat panel.
 *
 * @module pages/Dashboard
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ChatSidebar } from '../components/Chat/ChatSidebar';
import { ProjectsSummary } from '../components/Dashboard/ProjectsSummary';
import { TeamsSummary } from '../components/Dashboard/TeamsSummary';
import { useChat } from '../contexts/ChatContext';
import './Dashboard.css';

/**
 * View modes for the sidebar
 */
type SidebarView = 'chat' | 'projects' | 'teams';

/**
 * Dashboard component - main application interface
 *
 * Features:
 * - Chat-centric layout with orchestrator chat as main content
 * - Collapsible sidebar with navigation tabs
 * - Quick access to projects, teams, and settings
 *
 * @returns Dashboard component
 */
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isLoading, error } = useChat();

  /**
   * Handle sidebar toggle
   */
  const handleSidebarToggle = useCallback((): void => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  /**
   * Handle navigation tab click
   */
  const handleTabClick = useCallback((view: SidebarView): void => {
    setSidebarView(view);
  }, []);

  /**
   * Handle project click
   */
  const handleProjectClick = useCallback(
    (projectId: string): void => {
      navigate(`/projects/${projectId}`);
    },
    [navigate]
  );

  /**
   * Handle team click
   */
  const handleTeamClick = useCallback(
    (teamId: string): void => {
      navigate(`/teams/${teamId}`);
    },
    [navigate]
  );

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1 className="app-title">AgentMux</h1>
          <button
            className="sidebar-toggle"
            onClick={handleSidebarToggle}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Navigation tabs */}
            <nav className="sidebar-nav">
              <button
                className={`nav-tab ${sidebarView === 'chat' ? 'active' : ''}`}
                onClick={() => handleTabClick('chat')}
              >
                💬 Conversations
              </button>
              <button
                className={`nav-tab ${sidebarView === 'projects' ? 'active' : ''}`}
                onClick={() => handleTabClick('projects')}
              >
                📁 Projects
              </button>
              <button
                className={`nav-tab ${sidebarView === 'teams' ? 'active' : ''}`}
                onClick={() => handleTabClick('teams')}
              >
                👥 Teams
              </button>
            </nav>

            {/* Sidebar content */}
            <div className="sidebar-content">
              {sidebarView === 'chat' && <ChatSidebar />}
              {sidebarView === 'projects' && (
                <ProjectsSummary compact onProjectClick={handleProjectClick} />
              )}
              {sidebarView === 'teams' && (
                <TeamsSummary compact onTeamClick={handleTeamClick} />
              )}
            </div>

            {/* Sidebar footer */}
            <div className="sidebar-footer">
              <button
                className="footer-link"
                onClick={() => navigate('/settings')}
              >
                ⚙️ Settings
              </button>
              <button
                className="footer-link"
                onClick={() => navigate('/factory')}
              >
                🏭 3D Factory
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main content - Chat Panel */}
      <main className="dashboard-main">
        {/* Connection status banner */}
        {isLoading && (
          <div className="connection-banner warning">
            <span>⏳ Connecting to orchestrator...</span>
          </div>
        )}

        {error && (
          <div className="connection-banner error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <ChatPanel />
      </main>
    </div>
  );
};

export default Dashboard;
