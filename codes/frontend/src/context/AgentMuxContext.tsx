'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Project, Team, Assignment, ActivityEntry } from '../types/agentmux';
import { agentMuxAPI } from '../services/agentmux-api';

// Phase 1 State Management with HTTP Polling (no WebSockets)
interface AgentMuxState {
  // Data
  projects: Project[];
  teams: Team[];
  assignments: Assignment[];
  activity: ActivityEntry[];
  
  // UI State
  loading: boolean;
  error?: string;
  isConnected: boolean;
  
  // Selected items
  selectedProject?: Project;
  selectedTeam?: Team;
  selectedAssignment?: Assignment;
}

interface AgentMuxActions {
  // Data refresh
  refreshData: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  
  // Project operations
  createProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (project: Project | undefined) => void;
  
  // Team operations
  createTeam: (team: Omit<Team, 'id' | 'createdAt'>) => Promise<void>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  selectTeam: (team: Team | undefined) => void;
  
  // Assignment operations
  createAssignment: (projectId: string, teamId: string) => Promise<void>;
  updateAssignment: (id: string, updates: Partial<Assignment>) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  selectAssignment: (assignment: Assignment | undefined) => void;
  
  // Error handling
  clearError: () => void;
}

const AgentMuxContext = createContext<AgentMuxState & AgentMuxActions | null>(null);

interface AgentMuxProviderProps {
  children: ReactNode;
  pollingInterval?: number;
}

export function AgentMuxProvider({ 
  children, 
  pollingInterval = 30000 
}: AgentMuxProviderProps) {
  const [state, setState] = useState<AgentMuxState>({
    projects: [],
    teams: [],
    assignments: [],
    activity: [],
    loading: false,
    isConnected: false,
  });

  // Error handler
  const handleError = (error: unknown) => {
    console.error('AgentMux API Error:', error);
    setState(prev => ({
      ...prev,
      error: error instanceof Error ? error.message : 'An error occurred',
      loading: false,
      isConnected: false,
    }));
  };

  // Clear error
  const clearError = () => {
    setState(prev => ({ ...prev, error: undefined }));
  };

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      console.log('🔄 AgentMux: Starting data refresh...');
      setState(prev => ({ ...prev, loading: true, error: undefined }));
      
      const data = await agentMuxAPI.getAllData();
      console.log('📊 AgentMux: Received data:', { 
        projects: data.projects.length, 
        teams: data.teams.length, 
        assignments: data.assignments.length 
      });
      
      setState(prev => ({
        ...prev,
        projects: data.projects,
        teams: data.teams,
        assignments: data.assignments,
        loading: false,
        isConnected: true,
      }));
    } catch (error) {
      console.error('❌ AgentMux API Error:', error);
      handleError(error);
    }
  }, []);

  // Refresh activity
  const refreshActivity = useCallback(async () => {
    try {
      const activity = await agentMuxAPI.getActivity();
      setState(prev => ({ ...prev, activity }));
    } catch (error) {
      handleError(error);
    }
  }, []);

  // Project operations
  const createProject = async (project: Omit<Project, 'id' | 'createdAt'>) => {
    try {
      const newProject = await agentMuxAPI.createProject(project);
      setState(prev => ({
        ...prev,
        projects: [...prev.projects, newProject],
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    try {
      const updatedProject = await agentMuxAPI.updateProject(id, updates);
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === id ? updatedProject : p),
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await agentMuxAPI.deleteProject(id);
      setState(prev => ({
        ...prev,
        projects: prev.projects.filter(p => p.id !== id),
        selectedProject: prev.selectedProject?.id === id ? undefined : prev.selectedProject,
      }));
    } catch (error) {
      handleError(error);
    }
  };

  // Team operations
  const createTeam = async (team: Omit<Team, 'id' | 'createdAt'>) => {
    try {
      const newTeam = await agentMuxAPI.createTeam(team);
      setState(prev => ({
        ...prev,
        teams: [...prev.teams, newTeam],
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const updateTeam = async (id: string, updates: Partial<Team>) => {
    try {
      const updatedTeam = await agentMuxAPI.updateTeam(id, updates);
      setState(prev => ({
        ...prev,
        teams: prev.teams.map(t => t.id === id ? updatedTeam : t),
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      await agentMuxAPI.deleteTeam(id);
      setState(prev => ({
        ...prev,
        teams: prev.teams.filter(t => t.id !== id),
        selectedTeam: prev.selectedTeam?.id === id ? undefined : prev.selectedTeam,
      }));
    } catch (error) {
      handleError(error);
    }
  };

  // Assignment operations
  const createAssignment = async (projectId: string, teamId: string) => {
    try {
      const assignment = await agentMuxAPI.createAssignment({
        projectId,
        teamId,
        status: 'active',
        startedAt: new Date().toISOString(),
      });
      setState(prev => ({
        ...prev,
        assignments: [...prev.assignments, assignment],
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    try {
      const updatedAssignment = await agentMuxAPI.updateAssignment(id, updates);
      setState(prev => ({
        ...prev,
        assignments: prev.assignments.map(a => a.id === id ? updatedAssignment : a),
      }));
    } catch (error) {
      handleError(error);
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      await agentMuxAPI.deleteAssignment(id);
      setState(prev => ({
        ...prev,
        assignments: prev.assignments.filter(a => a.id !== id),
        selectedAssignment: prev.selectedAssignment?.id === id ? undefined : prev.selectedAssignment,
      }));
    } catch (error) {
      handleError(error);
    }
  };

  // Selection operations
  const selectProject = (project: Project | undefined) => {
    setState(prev => ({ ...prev, selectedProject: project }));
  };

  const selectTeam = (team: Team | undefined) => {
    setState(prev => ({ ...prev, selectedTeam: team }));
  };

  const selectAssignment = (assignment: Assignment | undefined) => {
    setState(prev => ({ ...prev, selectedAssignment: assignment }));
  };

  // HTTP Polling Setup (replaces WebSocket)
  useEffect(() => {
    let mounted = true;
    
    // Initial data load
    refreshData();
    
    // Set up polling interval
    const interval = setInterval(async () => {
      if (mounted) {
        try {
          // Health check first
          await agentMuxAPI.health();
          await refreshData();
          await refreshActivity();
        } catch {
          if (mounted) {
            setState(prev => ({ ...prev, isConnected: false }));
          }
        }
      }
    }, pollingInterval);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pollingInterval, refreshActivity, refreshData]);

  const contextValue = {
    ...state,
    refreshData,
    refreshActivity,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    createTeam,
    updateTeam,
    deleteTeam,
    selectTeam,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    selectAssignment,
    clearError,
  };

  return (
    <AgentMuxContext.Provider value={contextValue}>
      {children}
    </AgentMuxContext.Provider>
  );
}

export function useAgentMux() {
  const context = useContext(AgentMuxContext);
  if (!context) {
    throw new Error('useAgentMux must be used within AgentMuxProvider');
  }
  return context;
}