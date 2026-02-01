/**
 * Dashboard Page
 *
 * Chat-centric interface for interacting with the orchestrator.
 * Features a collapsible sidebar with conversations, projects, and teams,
 * and a main chat panel for communication with the AI orchestrator.
 *
 * @module pages/Dashboard
 */

import React, { useState } from 'react';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ChatSidebar } from '../components/Chat/ChatSidebar';
import { ProjectsSummary } from '../components/Dashboard/ProjectsSummary';
import { TeamsSummary } from '../components/Dashboard/TeamsSummary';
import { useChat } from '../contexts/ChatContext';
import './Dashboard.css';

/**
 * View modes for the sidebar content
 */
type SidebarView = 'chat' | 'projects' | 'teams';

/**
 * Dashboard component - main application interface.
 *
 * Provides a chat-centric layout with:
 * - Collapsible sidebar with navigation tabs
 * - Conversations list in ChatSidebar
 * - Projects and Teams summaries
 * - Main chat panel for orchestrator communication
 *
 * @returns JSX element with dashboard layout
 *
 * @example
 * ```tsx
 * <ChatProvider>
 *   <Dashboard />
 * </ChatProvider>
 * ```
 */
export const Dashboard: React.FC = () => {
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { error, isLoading } = useChat();

  /**
   * Determine connection status based on error state
   */
  const connectionError = error && !isLoading ? error : null;

  return (
    <div className="dashboard-layout" data-testid="dashboard-layout">
      {/* Sidebar */}
      <aside
        className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
        data-testid="dashboard-sidebar"
      >
        <div className="sidebar-header">
          <h1 className="app-title">AgentMux</h1>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-testid="sidebar-toggle"
          >
            {sidebarCollapsed ? '\u2192' : '\u2190'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {/* Navigation tabs */}
            <nav className="sidebar-nav" data-testid="sidebar-nav">
              <button
                className={`nav-tab ${sidebarView === 'chat' ? 'active' : ''}`}
                onClick={() => setSidebarView('chat')}
                data-testid="nav-tab-chat"
              >
                Conversations
              </button>
              <button
                className={`nav-tab ${sidebarView === 'projects' ? 'active' : ''}`}
                onClick={() => setSidebarView('projects')}
                data-testid="nav-tab-projects"
              >
                Projects
              </button>
              <button
                className={`nav-tab ${sidebarView === 'teams' ? 'active' : ''}`}
                onClick={() => setSidebarView('teams')}
                data-testid="nav-tab-teams"
              >
                Teams
              </button>
            </nav>

            {/* Sidebar content */}
            <div className="sidebar-content" data-testid="sidebar-content">
              {sidebarView === 'chat' && <ChatSidebar />}
              {sidebarView === 'projects' && <ProjectsSummary compact />}
              {sidebarView === 'teams' && <TeamsSummary compact />}
            </div>
          </>
        )}
      </aside>

      {/* Main content - Chat Panel */}
      <main className="dashboard-main" data-testid="dashboard-main">
        {/* Connection status banner */}
        {connectionError && (
          <div
            className="connection-banner error"
            role="alert"
            data-testid="connection-banner"
          >
            <span>{connectionError}</span>
          </div>
        )}

        <ChatPanel />
      </main>
    </div>
  );
};

export default Dashboard;
