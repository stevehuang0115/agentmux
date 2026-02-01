# Task 61: Chat-Centric Dashboard Integration

## Overview

Transform the Dashboard from a traditional project/team grid layout to a chat-centric interface with the orchestrator.

## Problem

The current Dashboard shows projects and teams in a grid layout. The original plan specified a chat-based interface where users interact conversationally with the orchestrator.

## Current State

```typescript
// frontend/src/pages/Dashboard.tsx
// Shows traditional dashboard with:
// - Project cards grid
// - Team cards grid
// - Status widgets
// NO ChatPanel integration
```

**Planned Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  AgentMux                              [Settings] [Terminal]│
├─────────────┬───────────────────────────────────────────────┤
│  Sidebar    │  Chat with Orchestrator                       │
│  ─────────  │  ─────────────────────────                   │
│  > Projects │  [Orchestrator]: Welcome! How can I help?    │
│  > Teams    │  [You]: Create a new project for my app      │
│  > Recent   │  [Orchestrator]: I'll help you create that.  │
│    Convos   │                                               │
└─────────────┴───────────────────────────────────────────────┘
```

## Implementation

### Create New Dashboard Layout

**`frontend/src/pages/Dashboard.tsx`**

```typescript
/**
 * Dashboard Page
 *
 * Chat-centric interface for interacting with the orchestrator.
 *
 * @module pages/Dashboard
 */

import React, { useState } from 'react';
import { ChatPanel } from '../components/Chat/ChatPanel.js';
import { ChatSidebar } from '../components/Chat/ChatSidebar.js';
import { useChat } from '../contexts/ChatContext.js';
import { ProjectsSummary } from '../components/Dashboard/ProjectsSummary.js';
import { TeamsSummary } from '../components/Dashboard/TeamsSummary.js';
import './Dashboard.css';

/**
 * View modes for the sidebar
 */
type SidebarView = 'chat' | 'projects' | 'teams';

/**
 * Dashboard component - main application interface
 */
export const Dashboard: React.FC = () => {
  const [sidebarView, setSidebarView] = useState<SidebarView>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isConnected, connectionError } = useChat();

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <h1 className="app-title">AgentMux</h1>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
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
                onClick={() => setSidebarView('chat')}
              >
                💬 Conversations
              </button>
              <button
                className={`nav-tab ${sidebarView === 'projects' ? 'active' : ''}`}
                onClick={() => setSidebarView('projects')}
              >
                📁 Projects
              </button>
              <button
                className={`nav-tab ${sidebarView === 'teams' ? 'active' : ''}`}
                onClick={() => setSidebarView('teams')}
              >
                👥 Teams
              </button>
            </nav>

            {/* Sidebar content */}
            <div className="sidebar-content">
              {sidebarView === 'chat' && <ChatSidebar />}
              {sidebarView === 'projects' && <ProjectsSummary compact />}
              {sidebarView === 'teams' && <TeamsSummary compact />}
            </div>
          </>
        )}
      </aside>

      {/* Main content - Chat Panel */}
      <main className="dashboard-main">
        {/* Connection status banner */}
        {!isConnected && (
          <div className="connection-banner warning">
            <span>⚠️ {connectionError || 'Connecting to orchestrator...'}</span>
          </div>
        )}

        <ChatPanel />
      </main>
    </div>
  );
};

export default Dashboard;
```

### Update Dashboard CSS

**`frontend/src/pages/Dashboard.css`**

```css
.dashboard-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.dashboard-sidebar {
  width: 280px;
  min-width: 280px;
  background: var(--sidebar-bg, #f8fafc);
  border-right: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  transition: width 0.2s, min-width 0.2s;
}

.dashboard-sidebar.collapsed {
  width: 60px;
  min-width: 60px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.app-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--primary-color, #3b82f6);
}

.dashboard-sidebar.collapsed .app-title {
  display: none;
}

.sidebar-toggle {
  background: transparent;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
}

.sidebar-toggle:hover {
  background: var(--bg-hover, #f1f5f9);
}

/* Navigation tabs */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  gap: 0.25rem;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  transition: background 0.15s, color 0.15s;
}

.nav-tab:hover {
  background: var(--bg-hover, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-tab.active {
  background: var(--primary-light, #dbeafe);
  color: var(--primary-color, #3b82f6);
  font-weight: 500;
}

/* Sidebar content */
.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

/* Main content area */
.dashboard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--main-bg, #ffffff);
  overflow: hidden;
}

/* Connection status banner */
.connection-banner {
  padding: 0.5rem 1rem;
  text-align: center;
  font-size: 0.875rem;
}

.connection-banner.warning {
  background: #fef3c7;
  color: #92400e;
  border-bottom: 1px solid #fcd34d;
}

.connection-banner.error {
  background: #fef2f2;
  color: #991b1b;
  border-bottom: 1px solid #fecaca;
}

.connection-banner.success {
  background: #d1fae5;
  color: #065f46;
  border-bottom: 1px solid #6ee7b7;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 50;
    transform: translateX(0);
  }

  .dashboard-sidebar.collapsed {
    transform: translateX(-100%);
    width: 280px;
  }

  .dashboard-main {
    width: 100%;
  }
}
```

### Create Helper Components

**`frontend/src/components/Dashboard/ProjectsSummary.tsx`**

```typescript
/**
 * Projects Summary Component
 *
 * Compact list of projects for the sidebar.
 *
 * @module components/Dashboard/ProjectsSummary
 */

import React from 'react';
import { useProjects } from '../../hooks/useProjects.js';
import './Summary.css';

interface ProjectsSummaryProps {
  compact?: boolean;
}

export const ProjectsSummary: React.FC<ProjectsSummaryProps> = ({ compact = false }) => {
  const { projects, loading } = useProjects();

  if (loading) {
    return <div className="summary-loading">Loading projects...</div>;
  }

  return (
    <div className={`summary-list ${compact ? 'compact' : ''}`}>
      <div className="summary-header">
        <h3>Projects</h3>
        <span className="count-badge">{projects.length}</span>
      </div>

      {projects.length === 0 ? (
        <p className="summary-empty">No projects yet</p>
      ) : (
        <ul className="summary-items">
          {projects.slice(0, compact ? 5 : undefined).map((project) => (
            <li key={project.id} className="summary-item">
              <span className="item-name">{project.name}</span>
              <span className={`status-dot status-${project.status}`} />
            </li>
          ))}
          {compact && projects.length > 5 && (
            <li className="summary-more">+{projects.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
};
```

**`frontend/src/components/Dashboard/TeamsSummary.tsx`**

```typescript
/**
 * Teams Summary Component
 *
 * Compact list of teams for the sidebar.
 *
 * @module components/Dashboard/TeamsSummary
 */

import React from 'react';
import { useTeams } from '../../hooks/useTeams.js';
import './Summary.css';

interface TeamsSummaryProps {
  compact?: boolean;
}

export const TeamsSummary: React.FC<TeamsSummaryProps> = ({ compact = false }) => {
  const { teams, loading } = useTeams();

  if (loading) {
    return <div className="summary-loading">Loading teams...</div>;
  }

  return (
    <div className={`summary-list ${compact ? 'compact' : ''}`}>
      <div className="summary-header">
        <h3>Teams</h3>
        <span className="count-badge">{teams.length}</span>
      </div>

      {teams.length === 0 ? (
        <p className="summary-empty">No teams yet</p>
      ) : (
        <ul className="summary-items">
          {teams.slice(0, compact ? 5 : undefined).map((team) => (
            <li key={team.id} className="summary-item">
              <span className="item-name">{team.name}</span>
              <span className="item-meta">{team.agents?.length || 0} agents</span>
            </li>
          ))}
          {compact && teams.length > 5 && (
            <li className="summary-more">+{teams.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
};
```

**`frontend/src/components/Dashboard/Summary.css`**

```css
.summary-list {
  background: var(--card-bg, #ffffff);
  border-radius: 8px;
  padding: 0.75rem;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.summary-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #1e293b);
}

.count-badge {
  font-size: 0.75rem;
  background: var(--bg-secondary, #f1f5f9);
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  color: var(--text-secondary, #64748b);
}

.summary-items {
  list-style: none;
  padding: 0;
  margin: 0;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  cursor: pointer;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item:hover {
  background: var(--bg-hover, #f8fafc);
  margin: 0 -0.5rem;
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  border-radius: 4px;
}

.item-name {
  font-size: 0.875rem;
  color: var(--text-primary, #1e293b);
}

.item-meta {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-active { background: #22c55e; }
.status-inactive { background: #94a3b8; }
.status-pending { background: #f59e0b; }

.summary-empty {
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem 0;
}

.summary-more {
  font-size: 0.75rem;
  color: var(--primary-color, #3b82f6);
  text-align: center;
  padding: 0.5rem 0;
  cursor: pointer;
}

.summary-loading {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary, #64748b);
  font-size: 0.875rem;
}
```

### Update ChatPanel Integration

Ensure ChatPanel uses the chat context properly:

```typescript
// frontend/src/components/Chat/ChatPanel.tsx should use:
import { useChat } from '../../contexts/ChatContext.js';

export const ChatPanel: React.FC = () => {
  const {
    messages,
    sendMessage,
    isLoading,
    currentConversation,
  } = useChat();

  // ... chat UI implementation
};
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/pages/Dashboard.tsx` | Replace with chat-centric layout |
| `frontend/src/pages/Dashboard.css` | Update styles |
| `frontend/src/pages/Dashboard.test.tsx` | Update tests |
| `frontend/src/components/Dashboard/ProjectsSummary.tsx` | Create |
| `frontend/src/components/Dashboard/ProjectsSummary.test.tsx` | Create |
| `frontend/src/components/Dashboard/TeamsSummary.tsx` | Create |
| `frontend/src/components/Dashboard/TeamsSummary.test.tsx` | Create |
| `frontend/src/components/Dashboard/Summary.css` | Create |

## Acceptance Criteria

- [ ] Dashboard shows chat interface as main content
- [ ] Sidebar has tabs for Conversations, Projects, Teams
- [ ] ChatPanel displays full chat with orchestrator
- [ ] Chat messages render properly
- [ ] Message input works and sends to orchestrator
- [ ] Connection status banner shows when disconnected
- [ ] Sidebar collapses on mobile
- [ ] Projects and Teams summaries show in sidebar
- [ ] Clicking project/team switches context
- [ ] All existing Dashboard tests updated

## Dependencies

- Task 33: Frontend Chat Components
- Task 38: Frontend Chat Provider

## Priority

**Critical** - Core user experience for the AI Employee Hub
