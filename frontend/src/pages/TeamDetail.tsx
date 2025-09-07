import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Terminal } from 'lucide-react';
import { Team, TeamMember } from '../types/index';
import { TeamMemberCard } from '../components/TeamMemberCard';
import { useTerminal } from '../contexts/TerminalContext';
import { Button } from '../components/UI/Button';
import { StartTeamModal } from '../components/StartTeamModal';
import { ScoreCard, ScoreCardGrid } from '../components/UI/ScoreCard';
import { safeParseJSON } from '../utils/api';
import '../components/UI/ScoreCard.css';

interface Terminal {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  lastOutput: string;
}

export const TeamDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { openTerminalWithSession } = useTerminal();
  const [team, setTeam] = useState<Team | null>(null);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', role: '' });
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

  const getTeamStatus = () => {
    // For Orchestrator Team, check tmux session status
    if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
      return orchestratorSessionActive ? 'active' : 'idle';
    }
    
    // For other teams, check if any members have active sessions
    const hasActiveSessions = team?.members?.some(m => m.sessionName);
    if (hasActiveSessions) {
      return 'active';
    }
    
    // Fall back to the team status from the API
    return team?.status || 'idle';
  };

  const handleViewTerminal = () => {
    // For Orchestrator Team, open terminal with agentmux-orc session
    if (team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') {
      openTerminalWithSession('agentmux-orc');
    }
  };

  const renderCombinedOverviewTab = () => (
    <div className="tab-content">
      {/* Team Stats Section */}
      <ScoreCardGrid variant="horizontal">
        <ScoreCard 
          label="Team Status" 
          variant="horizontal"
        >
          <span className={`status-badge status-${getTeamStatus()}`}>
            {getTeamStatus()?.toUpperCase()}
          </span>
        </ScoreCard>
        
        <ScoreCard 
          label="Active Members" 
          variant="horizontal"
        >
          <span className="score-card__value--number">
            {team?.members?.filter(m => m.sessionName).length || 0} / {team?.members?.length || 0}
          </span>
        </ScoreCard>
        
        <ScoreCard 
          label="Project" 
          value={projectName || 'None'}
          variant="horizontal"
        />
        
        <ScoreCard 
          label="Created" 
          value={team?.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'N/A'}
          variant="horizontal"
        />
      </ScoreCardGrid>

      {/* Team Description Section */}
      {team?.description && (
        <div className="team-description">
          <h3>Description</h3>
          <p>{team.description}</p>
        </div>
      )}

      {/* Team Members Section */}
      <div className="members-section">
        <div className="members-header">
          <h3>Team Members</h3>
          {/* Hide Add Member button for Orchestrator Team */}
          {!(team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') && (
            <Button 
              variant="primary"
              onClick={() => setShowAddMember(!showAddMember)}
              icon={Plus}
            >
              Add Member
            </Button>
          )}
        </div>

        {showAddMember && (
          <div className="add-member-form">
            <div className="form-row">
              <input
                type="text"
                placeholder="Member name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="form-input"
              />
              <input
                type="text"
                placeholder="Role (e.g., Developer, PM, QA)"
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                className="form-input"
              />
              <Button 
                variant="success"
                onClick={handleAddMember}
              >
                Add
              </Button>
              <Button 
                variant="secondary"
                onClick={() => {
                  setShowAddMember(false);
                  setNewMember({ name: '', role: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="members-list">
          {team?.members?.map((member) => (
            <TeamMemberCard
              key={member.id}
              member={member}
              onUpdate={handleUpdateMember}
              onDelete={handleDeleteMember}
              onStart={handleStartMember}
              onStop={handleStopMember}
              teamId={id}
            />
          ))}
          
          {!team?.members?.length && (
            <div className="empty-state">
              <p>No team members yet. Add members to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const handleAddMember = async () => {
    if (!newMember.name.trim() || !newMember.role.trim()) {
      alert('Please fill in both name and role');
      return;
    }

    try {
      const response = await fetch(`/api/teams/${id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newMember),
      });

      if (response.ok) {
        setNewMember({ name: '', role: '' });
        setShowAddMember(false);
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
      <div className="page-header">
        <div className="header-info">
          <h1 className="page-title">{team.name}</h1>
        </div>
        <div className="header-controls">
          {/* Team action buttons in header */}
          {getTeamStatus() === 'idle' ? (
            <Button variant="success" onClick={handleStartTeam}>
              Start Team
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleStopTeam}>
              Stop Team
            </Button>
          )}
          
          {/* Show View Terminal button for Orchestrator Team */}
          {(team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') && (
            <Button variant="primary" onClick={handleViewTerminal} icon={Terminal}>
              View Terminal
            </Button>
          )}
          
          {/* Delete Team button - hide for Orchestrator Team */}
          {!(team?.id === 'orchestrator' || team?.name === 'Orchestrator Team') && (
            <Button variant="danger" onClick={handleDeleteTeam}>
              Delete Team
            </Button>
          )}
        </div>
      </div>

      {/* Overview Content */}
      {renderCombinedOverviewTab()}

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