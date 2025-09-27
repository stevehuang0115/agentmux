import React, { useState, useEffect } from 'react';
import { Team, TeamMember, Project, ApiResponse } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProjectSelector } from './ProjectSelector';
import { TeamCreator } from './TeamCreator';
import { TeamList } from './TeamList';
import {
  LoadingSpinner,
  DashboardHeader,
  DashboardNavigation,
  ProjectInfoPanel,
  QuickActionsPanel,
  RecentActivityPanel,
  TerminalPanel,
  EmptyTerminalState
} from './Dashboard/index';
import axios from 'axios';
import { useAlert } from './UI/Dialog';

const API_BASE = '/api';

export const Dashboard: React.FC = () => {
  const { showError, AlertComponent } = useAlert();
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
      showError('Failed to add project. Please check the path and try again.');
    }
  };

  const handleTeamCreate = async (teamData: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => {
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
      showError('Failed to create team. Please try again.');
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
      showError('Failed to terminate team. Please try again.');
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
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <DashboardHeader
        connected={connected}
        selectedProject={selectedProject}
        teamsCount={teams.length}
      />

      <DashboardNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

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
                  <ProjectInfoPanel
                    project={selectedProject}
                    teamsCount={teams.length}
                    totalMembers={teams.reduce((acc, team) => acc + team.members.length, 0)}
                  />

                  <QuickActionsPanel
                    selectedMember={selectedMember}
                    onManageTeamsClick={() => setActiveTab('teams')}
                    onTerminalClick={() => selectedMember && setActiveTab('terminal')}
                    onProjectSettingsClick={() => {/* TODO: Implement project settings */}}
                  />

                  <RecentActivityPanel />
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
          <TerminalPanel
            selectedMember={selectedMember}
            terminalData={terminalData.get(selectedMember.sessionName) || []}
            onTerminalInput={handleTerminalInput}
          />
        )}

        {activeTab === 'terminal' && !selectedMember && (
          <EmptyTerminalState />
        )}
      <AlertComponent />
      </main>
    </div>
  );
};