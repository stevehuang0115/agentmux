import React, { useState, useEffect } from 'react';
import { Project, Team, Ticket } from '../types';
import { apiService } from '../services/api.service';
import { useTerminal } from '../contexts/TerminalContext';
import { webSocketService } from '../services/websocket.service';
import { 
  AssignmentFilters, 
  ViewToggle, 
  AssignmentsList,
  Assignment,
  OrchestratorCommand,
  EnhancedTeamMember 
} from '../components/Assignments';
import { EnhancedAssignmentsList } from '../components/Assignments/EnhancedAssignmentsList';

export const Assignments: React.FC = () => {
  const { openTerminalWithSession } = useTerminal();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [enhancedMembers, setEnhancedMembers] = useState<EnhancedTeamMember[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'projects' | 'teams' | 'enhanced'>('enhanced');

  useEffect(() => {
    loadData();
    initializeWebSocket();
    
    return () => {
      // Clean up WebSocket listeners
      webSocketService.off('team_activity_updated', handleTeamActivityUpdate);
    };
  }, []);


  const loadData = async () => {
    await Promise.all([
      fetchAssignments(),
      loadProjects(),
      loadTeams(),
      fetchEnhancedTeamData()
    ]);
  };

  const loadProjects = async () => {
    try {
      const projectsData = await apiService.getProjects();
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const loadTeams = async () => {
    try {
      const teamsData = await apiService.getTeams();
      setTeams(teamsData);
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch('/api/assignments');
      if (response.ok) {
        const assignmentsData = await response.json();
        setAssignments(assignmentsData);
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchEnhancedTeamData = async () => {
    // Note: This function is now handled by WebSocket events
    // Initial data will be populated via WebSocket team_activity_updated events
    console.log('Enhanced team data will be loaded via WebSocket events');
  };

  const initializeWebSocket = async () => {
    try {
      if (!webSocketService.isConnected()) {
        await webSocketService.connect();
      }
      
      // Listen for team activity updates
      webSocketService.on('team_activity_updated', handleTeamActivityUpdate);
      
      console.log('WebSocket initialized for team activity monitoring');
    } catch (error) {
      console.error('Failed to initialize WebSocket for team activity:', error);
    }
  };

  const handleTeamActivityUpdate = (activityData: any) => {
    console.log('Received team activity update:', activityData);
    
    // Update enhanced members data
    if (activityData.members) {
      setEnhancedMembers(activityData.members);
    }
  };


  const handleMemberClick = (memberId: string, memberName: string, teamId: string) => {
    // Generate session name to match backend logic: team.name + member.name (lowercase, spaces to hyphens)
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const teamNameFormatted = team.name.replace(/\s+/g, '-').toLowerCase();
      const memberNameFormatted = memberName.replace(/\s+/g, '-').toLowerCase();
      const sessionName = `${teamNameFormatted}-${memberNameFormatted}`;
      openTerminalWithSession(sessionName);
    }
  };

  const handleOrchestratorClick = () => {
    openTerminalWithSession('agentmux-orc');
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: Assignment['status']) => {
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setAssignments(prev =>
          prev.map(assignment =>
            assignment.id === assignmentId
              ? { ...assignment, status: newStatus }
              : assignment
          )
        );
        if (selectedAssignment?.id === assignmentId) {
          setSelectedAssignment(prev => prev ? { ...prev, status: newStatus } : null);
        }
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  const handleUnassignTeam = async (teamId: string, teamName: string, projectId?: string) => {
    if (!projectId) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to unassign "${teamName}" from their current project?\n\nThis will send a command to the orchestrator to delete the team's tmux sessions.`
    );
    
    if (!confirmed) return;
    
    try {
      // Send unassign command to orchestrator to delete tmux sessions
      const response = await fetch('/api/orchestrator/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: `unassign_team ${teamId} ${projectId}` }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute orchestrator command');
      }
      
      // Unassign team from project
      await apiService.unassignTeamFromProject(projectId, teamId);
      
      // Reload data to reflect changes
      await loadData();
      
      alert(`✅ Team "${teamName}" has been unassigned and their tmux sessions have been terminated.`);
      
    } catch (error) {
      console.error('Failed to unassign team:', error);
      alert('❌ Failed to unassign team: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };


  const assignedProjects = projects.filter(project => 
    teams.some(team => team.currentProject === project.id)
  );

  const assignedTeams = teams.filter(team => team.currentProject);

  return (
    <div className="page assignments-page">
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">Assignments</h1>
          <p className="page-description">Track and manage project assignments and team orchestration</p>
        </div>
      </div>
      
      <div className="assignments-layout">
        {/* Projects & Teams Panel - Full Width */}
        <div className="assignments-panel">
          <div className="panel-header">
            <h2>Active Projects & Teams</h2>
            <div className="header-controls">
              <button 
                className={`view-toggle ${viewMode === 'enhanced' ? 'active' : ''}`}
                onClick={() => setViewMode('enhanced' as any)}
              >
                Task View
              </button>
              <ViewToggle
                viewMode={viewMode === 'enhanced' ? 'projects' : viewMode}
                assignedProjects={assignedProjects}
                assignedTeams={assignedTeams}
                onViewModeChange={(mode) => setViewMode(mode === 'projects' ? 'enhanced' as any : mode)}
              />
            </div>
          </div>

          {viewMode !== 'enhanced' && (
            <AssignmentFilters
              filterStatus={filterStatus}
              filterTeam={filterTeam}
              assignments={assignments}
              onStatusChange={setFilterStatus}
              onTeamChange={setFilterTeam}
            />
          )}

          {viewMode === 'enhanced' ? (
            <EnhancedAssignmentsList
              projects={projects}
              teams={teams}
              enhancedMembers={enhancedMembers}
              onMemberClick={handleMemberClick}
            />
          ) : (
            <AssignmentsList
              viewMode={viewMode}
              assignedProjects={assignedProjects}
              assignedTeams={assignedTeams}
              teams={teams}
              projects={projects}
              onMemberClick={handleMemberClick}
              onOrchestratorClick={handleOrchestratorClick}
              onUnassignTeam={handleUnassignTeam}
            />
          )}
        </div>
      </div>
    </div>
  );
};