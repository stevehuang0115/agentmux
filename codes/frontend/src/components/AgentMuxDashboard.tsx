'use client';

import React, { useState } from 'react';
import { useAgentMux } from '../context/AgentMuxContext';
import { ProjectCard } from './ProjectCard';
import { TeamCard } from './TeamCard';
import { AssignmentBoard } from './AssignmentBoard';

type TabType = 'projects' | 'teams' | 'assignments';

interface AgentMuxDashboardProps {
  className?: string;
}

export const AgentMuxDashboard: React.FC<AgentMuxDashboardProps> = ({
  className = ''
}) => {
  const {
    projects,
    teams,
    assignments,
    loading,
    error,
    isConnected,
    refreshData,
    clearError
  } = useAgentMux();

  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [showNewTeamForm, setShowNewTeamForm] = useState(false);

  // Connection status
  const connectionStatus = isConnected ? 'ONLINE' : 'OFFLINE';
  const connectionColor = isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';

  return (
    <div className={`agentmux-dashboard h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="header bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">AgentMux</h1>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={refreshData}
              disabled={loading}
              className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? '↻' : '⟳'} Refresh
            </button>
            
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${connectionColor}`}>
              {connectionStatus}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
            <div className="flex justify-between items-start">
              <span>{error}</span>
              <button 
                onClick={clearError}
                className="text-red-500 hover:text-red-700 ml-2"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="nav-tabs bg-gray-50 border-b px-6">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'projects'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Projects ({projects.length})
          </button>
          
          <button
            onClick={() => setActiveTab('teams')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'teams'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Teams ({teams.length})
          </button>
          
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Assignment Board ({assignments.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content flex-1 overflow-auto p-6">
        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="projects-tab">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
              <button
                onClick={() => setShowNewProjectForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                + New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="empty-state text-center py-12">
                <div className="text-4xl mb-4">📁</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first project to get started with AgentMux
                </p>
                <button
                  onClick={() => setShowNewProjectForm(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Create Project
                </button>
              </div>
            ) : (
              <div className="projects-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map(project => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="teams-tab">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Teams</h2>
              <button
                onClick={() => setShowNewTeamForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                + New Team
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="empty-state text-center py-12">
                <div className="text-4xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No teams yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first team with roles to start working on projects
                </p>
                <button
                  onClick={() => setShowNewTeamForm(true)}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                >
                  Create Team
                </button>
              </div>
            ) : (
              <div className="teams-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map(team => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assignment Board Tab */}
        {activeTab === 'assignments' && (
          <div className="assignments-tab">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Assignment Board</h2>
              <p className="text-gray-600">
                Assign teams to projects by dragging and dropping or clicking the intersection cells
              </p>
            </div>

            <AssignmentBoard
              projects={projects}
              teams={teams}
              assignments={assignments}
            />
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-overlay fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-900">Loading...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};