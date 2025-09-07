import React, { useState, useEffect } from 'react';
import { Team, TeamMember, Project, ApiResponse } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProjectSelector } from './ProjectSelector';
import { TeamCreator } from './TeamCreator';
import { TeamList } from './TeamList';
import { TerminalEmulator } from './TerminalEmulator';
import axios from 'axios';
import clsx from 'clsx';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';

const API_BASE = '/api';

export const Dashboard: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  // const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'terminal'>('overview');

  const { 
    connected, 
    subscribeToTerminal, 
    // unsubscribeFromTerminal, 
    sendInput, 
    terminalData 
  } = useWebSocket();

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [teamsResponse, projectsResponse] = await Promise.all([
        axios.get<ApiResponse<Team[]>>(`${API_BASE}/teams`),
        axios.get<ApiResponse<Project[]>>(`${API_BASE}/projects`)
      ]);

      if (teamsResponse.data.success) {
        setTeams(teamsResponse.data.data || []);
      }
      
      if (projectsResponse.data.success) {
        // setProjects(projectsResponse.data.data || []);
        if (projectsResponse.data.data?.length === 1) {
          setSelectedProject(projectsResponse.data.data[0]);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = async (path: string) => {
    try {
      const response = await axios.post<ApiResponse<Project>>(`${API_BASE}/projects`, { path });
      
      if (response.data.success && response.data.data) {
        setSelectedProject(response.data.data);
        // setProjects(prev => [...prev, response.data.data!]);
      }
    } catch (error) {
      console.error('Error adding project:', error);
      alert('Failed to add project. Please check the path and try again.');
    }
  };

  const handleTeamCreate = async (teamData: Omit<Team, 'id' | 'sessionName' | 'status' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await axios.post<ApiResponse<Team>>(`${API_BASE}/teams`, {
        ...teamData,
        projectPath: selectedProject?.path
      });
      
      if (response.data.success && response.data.data) {
        setTeams(prev => [...prev, response.data.data!]);
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team. Please try again.');
    }
  };

  const handleTeamTerminate = async (teamId: string) => {
    try {
      const response = await axios.delete<ApiResponse>(`${API_BASE}/teams/${teamId}`);
      
      if (response.data.success) {
        setTeams(prev => prev.filter(t => t.id !== teamId));
        // Clear selected member if it belonged to the terminated team
        if (selectedMember) {
          const terminatedTeam = teams.find(t => t.id === teamId);
          if (terminatedTeam?.members.find(m => m.id === selectedMember.id)) {
            setSelectedMember(null);
          }
        }
      }
    } catch (error) {
      console.error('Error terminating team:', error);
      alert('Failed to terminate team. Please try again.');
    }
  };

  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMember(member);
    setActiveTab('terminal');
    
    // Subscribe to terminal output
    if (member.sessionName) {
      subscribeToTerminal(member.sessionName);
    }
  };

  const handleTerminalInput = (input: string) => {
    if (selectedMember?.sessionName) {
      sendInput(selectedMember.sessionName, input);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading AgentMux...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">AgentMux</h1>
              <div className={clsx(
                'ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              )}>
                {connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {selectedProject && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Project:</span> {selectedProject.name}
                </div>
              )}
              <div className="text-sm text-gray-600">
                <span className="font-medium">Teams:</span> {teams.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['overview', 'teams', 'terminal'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={clsx(
                  'py-3 px-1 border-b-2 font-medium text-sm capitalize transition-colors',
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {!selectedProject ? (
              <ProjectSelector 
                onProjectSelect={handleProjectSelect}
                className="lg:col-span-2"
              />
            ) : (
              <>
                {/* Left Column - Team Management */}
                <div className="space-y-6">
                  <TeamCreator 
                    onTeamCreate={handleTeamCreate}
                    projectPath={selectedProject.path}
                  />
                  <TeamList 
                    teams={teams}
                    onMemberSelect={handleMemberSelect}
                    onTeamTerminate={handleTeamTerminate}
                  />
                </div>

                {/* Right Column - Project Info & Actions */}
                <div className="space-y-6">
                  {/* Project Information Panel */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{selectedProject.name}</h3>
                          <p className="text-sm text-gray-600">Project Overview</p>
                        </div>
                      </div>
                      <span className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        selectedProject.status === 'active' ? 'bg-green-100 text-green-800' :
                        selectedProject.status === 'paused' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {selectedProject.status}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Project Path</label>
                        <code className="mt-1 block w-full text-sm bg-gray-50 rounded border p-2 break-all">
                          {selectedProject.path}
                        </code>
                      </div>

                      {selectedProject.description && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Description</label>
                          <p className="mt-1 text-sm text-gray-600">{selectedProject.description}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Teams</label>
                          <p className="text-2xl font-bold text-blue-600">{teams.length}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Total Members</label>
                          <p className="text-2xl font-bold text-green-600">
                            {teams.reduce((acc, team) => acc + team.members.length, 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Panel */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => setActiveTab('teams')}
                        className="w-full flex items-center justify-between p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.239" />
                          </svg>
                          <span>Manage Teams</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <button
                        onClick={() => selectedMember && setActiveTab('terminal')}
                        disabled={!selectedMember}
                        className={clsx(
                          "w-full flex items-center justify-between p-3 text-left rounded-lg border transition-colors",
                          selectedMember 
                            ? "border-gray-200 hover:bg-gray-50" 
                            : "border-gray-100 bg-gray-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center space-x-3">
                          <svg className={clsx("w-5 h-5", selectedMember ? "text-green-600" : "text-gray-400")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className={selectedMember ? "" : "text-gray-500"}>
                            {selectedMember ? `Terminal: ${selectedMember.name}` : 'Select a member for terminal'}
                          </span>
                        </div>
                        {selectedMember && (
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>

                      <button
                        onClick={() => {/* TODO: Implement project settings */}}
                        className="w-full flex items-center justify-between p-3 text-left rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>Project Settings</span>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity Panel (placeholder for future) */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div className="text-center py-8 text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm">Activity tracking coming soon</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-8">
            <TeamList 
              teams={teams}
              onMemberSelect={handleMemberSelect}
              onTeamTerminate={handleTeamTerminate}
            />
            
            {selectedProject && (
              <TeamCreator 
                onTeamCreate={handleTeamCreate}
                projectPath={selectedProject.path}
              />
            )}
          </div>
        )}

        {activeTab === 'terminal' && selectedMember && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Terminal: {selectedMember.name}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Role: <span className="font-medium">{selectedMember.role}</span></span>
                  <span>Status: <span className={clsx(
                    'font-medium',
                    selectedMember.status === 'working' ? 'text-green-600' :
                    selectedMember.status === 'blocked' ? 'text-yellow-600' :
                    selectedMember.status === 'terminated' ? 'text-red-600' :
                    selectedMember.status === 'ready' ? 'text-green-600' :
                    selectedMember.status === 'activating' ? 'text-orange-600' :
                    selectedMember.status === 'active' ? 'text-emerald-600' : 'text-gray-600'
                  )}>{selectedMember.status}</span></span>
                </div>
              </div>
              
              <TerminalEmulator
                sessionName={selectedMember.sessionName}
                terminalData={terminalData.get(selectedMember.sessionName) || []}
                onInput={handleTerminalInput}
                className="w-full"
              />
            </div>
          </div>
        )}

        {activeTab === 'terminal' && !selectedMember && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No terminal selected</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a team from the Teams tab to view its terminal.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};