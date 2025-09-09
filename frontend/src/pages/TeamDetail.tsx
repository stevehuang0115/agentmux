import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Team, TeamMember } from '../types/index';
import { useTerminal } from '../contexts/TerminalContext';
import { StartTeamModal } from '../components/StartTeamModal';
import { TeamHeader, TeamOverview, Terminal, TeamStatus } from '../components/TeamDetail';
import { safeParseJSON } from '../utils/api';

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openTerminalWithSession } = useTerminal();
  const [team, setTeam] = useState<Team | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [orchestratorSessionActive, setOrchestratorSessionActive] = useState(false);
  const [showStartTeamModal, setShowStartTeamModal] = useState(false);
  const [startTeamLoading, setStartTeamLoading] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTeamData();
      fetchTerminals();
      // Check orchestrator session status if this is the orchestrator team
      if (id === 'orchestrator' || (team?.name === 'Orchestrator Team')) {
        checkOrchestratorSession();
      }
    }
  }, [id, team?.name]);

  useEffect(() => {
    if (team?.currentProject) {
      fetchProjectName(team.currentProject);
    } else {
      setProjectName(null);
    }
  }, [team?.currentProject]);

  useEffect(() => {
    if (selectedTerminal) {
      fetchTerminalOutput();
    }
  }, [selectedTerminal]);

  const fetchTeamData = async () => {
    try {
      const response = await fetch(`/api/teams/${id}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTeam(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTerminals = async () => {
    try {
      const response = await fetch(`/api/teams/${id}/terminals`);
      if (response.ok) {
        const result = await safeParseJSON(response);
        if (result.success && result.data) {
          setTerminals(result.data);
          if (result.data.length > 0 && !selectedTerminal) {
            setSelectedTerminal(result.data[0].id);
          }
        }
      } else {
        // Endpoint might not exist, set empty array
        setTerminals([]);
      }
    } catch (error) {
      // Set empty array on error to prevent crashes
      setTerminals([]);
    }
  };

  const fetchTerminalOutput = async () => {
    try {
      const response = await fetch(`/api/terminals/${selectedTerminal}/output`);
      if (response.ok) {
        const output = await response.text();
        setTerminalOutput(output);
      } else {
        setTerminalOutput('Terminal output not available');
      }
    } catch (error) {
      console.error('Error fetching terminal output:', error);
      setTerminalOutput('Error loading terminal output');
    }
  };

  const checkOrchestratorSession = async () => {
    try {
      const response = await fetch('/api/terminal/sessions');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const hasOrcSession = result.data.some((session: any) => 
            session.sessionName === 'agentmux-orc'
          );
          setOrchestratorSessionActive(hasOrcSession);
        }
      }
    } catch (error) {
      console.error('Error checking orchestrator session:', error);
      setOrchestratorSessionActive(false);
    }
  };

  const fetchProjectName = async (projectId: string) => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const result = await response.json();
        const projectsData = result.success ? (result.data || []) : (result || []);
        const project = projectsData.find((p: any) => p.id === projectId);
        setProjectName(project ? project.name : projectId);
      } else {
        setProjectName(projectId);
      }
    } catch (error) {
      console.error('Error fetching project name:', error);
      setProjectName(projectId);
    }
  };

  const handleStartTeam = () => {
    setShowStartTeamModal(true);
  };

  const handleStartTeamSubmit = async (projectId: string, enableGitReminder: boolean) => {
    setStartTeamLoading(true);
    try {
      const response = await fetch(`/api/teams/${id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          enableGitReminder,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setShowStartTeamModal(false);
        fetchTeamData();
        fetchTerminals();
        // Show success message
        alert(result.message || 'Team started successfully!');
      } else {
        alert(result.error || 'Failed to start team');
      }
    } catch (error) {
      console.error('Error starting team:', error);
      alert('Error starting team. Please try again.');
    } finally {
      setStartTeamLoading(false);
    }
  };

  const handleStopTeam = async () => {
    try {
      const response = await fetch(`/api/teams/${id}/stop`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchTeamData();
      }
    } catch (error) {
      console.error('Error stopping team:', error);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    
    // Prevent deletion of orchestrator team
    if (team.id === 'orchestrator' || team.name === 'Orchestrator Team') {
      alert('The Orchestrator Team cannot be deleted as it is required for system operations.');
      return;
    }
    
    const confirmMessage = `Are you sure you want to delete team "${team.name}"?\n\nThis will:\n- Delete the team and all its members\n- Kill all associated tmux sessions\n- Remove all team data permanently\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // First stop the team to ensure sessions are terminated
      await fetch(`/api/teams/${id}/stop`, {
        method: 'POST',
      });

      // Then delete the team (this will also cleanup tmux sessions)
      const response = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        // Navigate back to teams page
        navigate('/teams');
      } else {
        const error = await response.text();
        alert('Failed to delete team: ' + error);
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getTeamStatus = (): TeamStatus => {
    // For Orchestrator Team, check tmux session status
    if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
      return orchestratorSessionActive ? 'active' : 'idle';
    }
    
    // For other teams, check if any members have active sessions
    const hasActiveSessions = team?.members?.some(m => m.sessionName);
    if (hasActiveSessions) {
      return 'active';
    }
    
    // No active sessions, team is idle
    return 'idle';
  };

  const handleViewTerminal = () => {
    // For Orchestrator Team, open terminal with agentmux-orc session
    if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
      openTerminalWithSession('agentmux-orc');
    }
  };

  const handleAddMember = async (member: { name: string; role: string }) => {
    if (!member.name.trim() || !member.role.trim()) {
      alert('Please fill in both name and role');
      return;
    }

    try {
      const response = await fetch(`/api/teams/${id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(member),
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const error = await response.text();
        alert('Failed to add member: ' + error);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    }
  };

  const handleUpdateMember = async (memberId: string, updates: Partial<TeamMember>) => {
    try {
      const response = await fetch(`/api/teams/${id}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const error = await response.text();
        alert('Failed to update member: ' + error);
      }
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Failed to update member');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${id}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const error = await response.text();
        alert('Failed to remove member: ' + error);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleStartMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${id}/members/${memberId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // Refresh team data to show updated status
        fetchTeamData();
        console.log(`Member ${memberId} started successfully`);
      } else {
        alert(result.error || 'Failed to start team member');
      }
    } catch (error) {
      console.error('Error starting team member:', error);
      alert('Error starting team member. Please try again.');
    }
  };

  const handleStopMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${id}/members/${memberId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // Refresh team data to show updated status
        fetchTeamData();
        console.log(`Member ${memberId} stopped successfully`);
      } else {
        alert(result.error || 'Failed to stop team member');
      }
    } catch (error) {
      console.error('Error stopping team member:', error);
      alert('Error stopping team member. Please try again.');
    }
  };



  if (loading) {
    return (
      <div className="team-detail">
        <div className="loading-state">Loading team details...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="team-detail">
        <div className="error-state">
          <h2>Team not found</h2>
          <p>The requested team could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-detail">
      <TeamHeader
        team={team}
        teamStatus={getTeamStatus()}
        orchestratorSessionActive={orchestratorSessionActive}
        onStartTeam={handleStartTeam}
        onStopTeam={handleStopTeam}
        onViewTerminal={handleViewTerminal}
        onDeleteTeam={handleDeleteTeam}
      />

      <TeamOverview
        team={team}
        teamId={id!}
        teamStatus={getTeamStatus()}
        projectName={projectName}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
        onStartMember={handleStartMember}
        onStopMember={handleStopMember}
      />

      {/* Start Team Modal */}
      <StartTeamModal
        isOpen={showStartTeamModal}
        onClose={() => setShowStartTeamModal(false)}
        onStartTeam={handleStartTeamSubmit}
        team={team}
        loading={startTeamLoading}
      />
    </div>
  );
};