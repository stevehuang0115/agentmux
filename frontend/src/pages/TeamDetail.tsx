import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Team, TeamMember } from '../types/index';
import { useTerminal } from '../contexts/TerminalContext';
import { StartTeamModal } from '../components/StartTeamModal';
import { TeamModal } from '../components/Modals/TeamModal';
import { TeamHeader, TeamOverview, TeamStatus } from '../components/TeamDetail';
import { useAlert, useConfirm } from '../components/UI/Dialog';
import { safeParseJSON } from '../utils/api';

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openTerminalWithSession } = useTerminal();
  const [team, setTeam] = useState<Team | null>(null);
  // Terminal functionality moved to centralized TerminalPanel
  const [loading, setLoading] = useState(true);
  const [orchestratorSessionActive, setOrchestratorSessionActive] = useState(false);
  const [showStartTeamModal, setShowStartTeamModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [startTeamLoading, setStartTeamLoading] = useState(false);
  const [stopTeamLoading, setStopTeamLoading] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const { showSuccess, showError, showWarning, AlertComponent } = useAlert();
  const { showConfirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    if (id) {
      fetchTeamData();
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

  // Terminal output handled by centralized WebSocket system

  const fetchTeamData = async () => {
    try {
      const response = await fetch(`/api/teams/${id}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Migrate team members to include default avatars if missing
          const avatarChoices = [
            'https://picsum.photos/seed/1/64',
            'https://picsum.photos/seed/2/64',
            'https://picsum.photos/seed/3/64',
            'https://picsum.photos/seed/4/64',
            'https://picsum.photos/seed/5/64',
            'https://picsum.photos/seed/6/64',
          ];

          const migratedTeam = {
            ...result.data,
            members: result.data.members.map((member: any, index: number) => ({
              ...member,
              avatar: member.avatar || avatarChoices[index % avatarChoices.length]
            }))
          };

          setTeam(migratedTeam);
        }
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Terminal fetching logic removed - using centralized WebSocket system

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
        // Terminal functionality moved to centralized WebSocket system
        // Show success message
        showSuccess(result.message || 'Team started successfully!');
      } else {
        showError(result.error || 'Failed to start team');
      }
    } catch (error) {
      console.error('Error starting team:', error);
      showError('Error starting team. Please try again.');
    } finally {
      setStartTeamLoading(false);
    }
  };

  const handleOpenEditTeam = () => {
    setShowEditTeamModal(true);
  };

  const handleEditTeamSubmit = async (teamData: any) => {
    if (!team) return;
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
      });
      if (response.ok) {
        fetchTeamData();
        setShowEditTeamModal(false);
      } else {
        const err = await response.json();
        showError(err.error || 'Failed to update team');
      }
    } catch (e) {
      console.error('Error updating team:', e);
      showError('Failed to update team');
    }
  };

  const handleStopTeam = async () => {
    setStopTeamLoading(true);
    try {
      // Special handling for orchestrator team
      if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
        const response = await fetch('/api/orchestrator/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          fetchTeamData();
          checkOrchestratorSession();
        } else {
          const result = await response.json();
          showError(result.error || 'Failed to stop orchestrator');
        }
      } else {
        // Regular team stop
        const response = await fetch(`/api/teams/${id}/stop`, {
          method: 'POST',
        });
        if (response.ok) {
          fetchTeamData();
        }
      }
    } catch (error) {
      console.error('Error stopping team:', error);
    } finally {
      setStopTeamLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    
    // Prevent deletion of orchestrator team
    if (team.id === 'orchestrator' || team.name === 'Orchestrator Team') {
      showWarning('The Orchestrator Team cannot be deleted as it is required for system operations.');
      return;
    }

    const executeDelete = async () => {
      try {
      // First stop the team to ensure sessions are terminated
      await fetch(`/api/teams/${id}/stop`, {
        method: 'POST',
      });

      // Then delete the team (this will also cleanup terminal sessions)
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
        showError('Failed to delete team: ' + error);
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Failed to delete team: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
    };

    showConfirm(
      `Are you sure you want to delete team "${team.name}"?\n\nThis will:\n• Delete the team and all its members\n• Kill all associated terminal sessions\n• Remove all team data permanently\n\nThis action cannot be undone.`,
      executeDelete,
      { type: 'error', title: 'Delete Team', confirmText: 'Delete', cancelText: 'Cancel' }
    );
  };

  const getTeamStatus = (): TeamStatus => {
    // For Orchestrator Team, check terminal session status
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

  const handleViewMemberTerminal = (member: TeamMember) => {
    // Open terminal for specific team member session
    if (member.sessionName) {
      console.log('Opening terminal for member session:', member.sessionName);
      openTerminalWithSession(member.sessionName);
    }
  };

  const handleAddMember = async (member: { name: string; role: string }) => {
    if (!member.name.trim() || !member.role.trim()) {
      showWarning('Please fill in both name and role');
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
        showError('Failed to add member: ' + error);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showError('Failed to add member');
    }
  };

  const handleUpdateMember = async (memberId: string, updates: Partial<TeamMember>) => {
    try {
      // If updating runtime type, use the specific runtime endpoint
      if ('runtimeType' in updates && updates.runtimeType) {
        const response = await fetch(`/api/teams/${id}/members/${memberId}/runtime`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ runtimeType: updates.runtimeType }),
        });

        if (response.ok) {
          fetchTeamData();
          return;
        } else {
          const result = await response.json();
          showError('Failed to update member runtime: ' + (result.error || 'Unknown error'));
          return;
        }
      }

      // For other updates, use the general member update endpoint
      const response = await fetch(`/api/teams/${id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const error = await response.text();
        showError('Failed to update member: ' + error);
      }
    } catch (error) {
      console.error('Error updating member:', error);
      showError('Failed to update member');
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
        showError('Failed to remove member: ' + error);
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showError('Failed to remove member');
    }
  };

  const handleStartMember = async (memberId: string) => {
    try {
      // Special handling for orchestrator team
      if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
        const response = await fetch('/api/orchestrator/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (response.ok) {
          // Refresh team data and orchestrator session status
          fetchTeamData();
          checkOrchestratorSession();
          console.log('Orchestrator setup successfully');
        } else {
          showError(result.error || 'Failed to setup orchestrator');
        }
      } else {
        // Regular team member start
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
          showError(result.error || 'Failed to start team member');
        }
      }
    } catch (error) {
      console.error('Error starting team member:', error);
      showError('Error starting team member. Please try again.');
    }
  };

  const handleStopMember = async (memberId: string) => {
    try {
      // Special handling for orchestrator team
      if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
        const response = await fetch('/api/orchestrator/stop', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (response.ok) {
          // Refresh team data and orchestrator session status
          fetchTeamData();
          checkOrchestratorSession();
          console.log('Orchestrator stopped successfully');
        } else {
          showError(result.error || 'Failed to stop orchestrator');
        }
      } else {
        // Regular team member stop
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
          showError(result.error || 'Failed to stop team member');
        }
      }
    } catch (error) {
      console.error('Error stopping team member:', error);
      showError('Error stopping team member. Please try again.');
    }
  };

  const handleProjectChange = async (projectId: string | null) => {
    try {
      const response = await fetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentProject: projectId
        }),
      });

      if (response.ok) {
        // Refresh team data to reflect the change
        await fetchTeamData();
      } else {
        const result = await response.json();
        showError(result.error || 'Failed to update team project');
      }
    } catch (error) {
      console.error('Error updating team project:', error);
      showError('Error updating team project. Please try again.');
    }
  };



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-text-secondary-dark">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Team not found</h2>
          <p className="text-text-secondary-dark">The requested team could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 text-sm text-text-secondary-dark mb-1">
        <Link to="/teams" className="hover:text-primary">Teams</Link>
        <span className="text-text-secondary-dark">/</span>
        <span className="text-text-primary-dark">{team.name}</span>
      </div>
      <TeamHeader
        team={team}
        teamStatus={getTeamStatus()}
        orchestratorSessionActive={orchestratorSessionActive}
        onStartTeam={handleStartTeam}
        onStopTeam={handleStopTeam}
        onViewTerminal={handleViewTerminal}
        onDeleteTeam={handleDeleteTeam}
        onEditTeam={handleOpenEditTeam}
        isStoppingTeam={stopTeamLoading}
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
        onViewTerminal={handleViewMemberTerminal}
      />

      {/* Start Team Modal */}
      <StartTeamModal
        isOpen={showStartTeamModal}
        onClose={() => setShowStartTeamModal(false)}
        onStartTeam={handleStartTeamSubmit}
        team={team}
        loading={startTeamLoading}
      />

      {/* Edit Team Modal (reuses TeamModal) */}
      {showEditTeamModal && (
        <TeamModal
          isOpen={showEditTeamModal}
          onClose={() => setShowEditTeamModal(false)}
          onSubmit={handleEditTeamSubmit}
          team={team}
        />
      )}

      {/* Global alert/confirm dialogs */}
      <AlertComponent />
      <ConfirmComponent />
    </div>
  );
};
