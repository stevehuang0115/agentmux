import React, { useState, useEffect } from 'react';
import { Users, FolderOpen, Activity, Clock, UserMinus } from 'lucide-react';
import { Project, Team, Ticket } from '../types';
import { apiService } from '../services/api.service';
import { useTerminal } from '../contexts/TerminalContext';

interface Assignment {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high';
  teamId: string;
  teamName: string;
  createdAt: string;
  dueDate?: string;
  tags: string[];
}

interface OrchestratorCommand {
  id: string;
  command: string;
  timestamp: string;
  output?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export const Assignments: React.FC = () => {
  const { openTerminalWithSession } = useTerminal();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'projects' | 'teams'>('projects');

  useEffect(() => {
    loadData();
  }, []);


  const loadData = async () => {
    await Promise.all([
      fetchAssignments(),
      loadProjects(),
      loadTeams()
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

  const getPriorityColor = (priority: Assignment['priority']) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: Assignment['status']) => {
    switch (status) {
      case 'todo': return '#6b7280';
      case 'in-progress': return '#3b82f6';
      case 'review': return '#f59e0b';
      case 'done': return '#10b981';
      default: return '#6b7280';
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus !== 'all' && assignment.status !== filterStatus) return false;
    if (filterTeam !== 'all' && assignment.teamId !== filterTeam) return false;
    return true;
  });

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
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'projects' ? 'active' : ''}`}
                onClick={() => setViewMode('projects')}
              >
                <FolderOpen size={16} />
                Projects ({assignedProjects.length})
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'teams' ? 'active' : ''}`}
                onClick={() => setViewMode('teams')}
              >
                <Users size={16} />
                Teams ({assignedTeams.length})
              </button>
            </div>
          </div>

          <div className="filter-controls">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="all">All Teams</option>
              {Array.from(new Set(assignments.map(a => a.teamName))).map(teamName => (
                <option key={teamName} value={teamName}>{teamName}</option>
              ))}
            </select>
          </div>

          <div className="assignments-list">
            {viewMode === 'projects' ? (
              <div className="projects-view">
                {assignedProjects.length === 0 ? (
                  <div className="empty-state">
                    <FolderOpen size={48} />
                    <h3>No Projects Assigned</h3>
                    <p>No teams have been assigned to any projects yet.</p>
                  </div>
                ) : (
                  assignedProjects.map((project) => {
                    const projectTeams = teams.filter(team => team.currentProject === project.id);
                    return (
                      <div key={project.id} className="assignment-card project-card">
                        <div className="assignment-header">
                          <div className="project-info">
                            <FolderOpen size={20} />
                            <h3>{project.name}</h3>
                          </div>
                          <div className={`status-badge project-status-${project.status}`}>
                            {project.status}
                          </div>
                        </div>
                        <p className="assignment-description">{project.description}</p>
                        <div className="assignment-meta">
                          <div className="project-teams">
                            <Users size={14} />
                            <span>{projectTeams.length} team{projectTeams.length !== 1 ? 's' : ''} assigned</span>
                          </div>
                          <div className="project-path">
                            <Clock size={14} />
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {projectTeams.length > 0 && (
                          <div className="project-teams-list">
                            {projectTeams.map(team => (
                              <div key={team.id} className="team-with-members">
                                <div className="team-header-item">
                                  <span 
                                    className="team-chip clickable"
                                    onClick={() => handleOrchestratorClick()}
                                    title="Click to view orchestrator terminal"
                                  >
                                    <span className={`status-dot status-${team.status}`}></span>
                                    {team.name} ({team.members.length} members)
                                  </span>
                                  <button
                                    className="unassign-team-btn small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnassignTeam(team.id, team.name, project.id);
                                    }}
                                    title="Unassign team from project"
                                  >
                                    <UserMinus size={12} />
                                  </button>
                                </div>
                                {team.members.length > 0 && (
                                  <div className="team-members-tree">
                                    {team.members.map(member => (
                                      <div 
                                        key={member.id} 
                                        className="member-tree-item clickable"
                                        onClick={() => handleMemberClick(member.id, member.name, team.id)}
                                        title={`Click to view ${member.name}'s terminal`}
                                      >
                                        <span className={`member-status-dot status-${member.status}`}></span>
                                        <span className="member-name">{member.name}</span>
                                        <span className="member-role">({member.role})</span>
                                        {member.sessionName && (
                                          <span className="session-indicator" title={`Session: ${member.sessionName}`}>
                                            <Activity size={12} />
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="teams-view">
                {assignedTeams.length === 0 ? (
                  <div className="empty-state">
                    <Users size={48} />
                    <h3>No Teams Assigned</h3>
                    <p>No teams have been assigned to projects yet.</p>
                  </div>
                ) : (
                  assignedTeams.map((team) => {
                    const assignedProject = projects.find(p => p.id === team.currentProject);
                    return (
                      <div key={team.id} className="assignment-card team-card">
                        <div className="assignment-header">
                          <div className="team-info">
                            <Users size={20} />
                            <h3>{team.name}</h3>
                          </div>
                          <div className="team-header-actions">
                            <div className={`status-badge team-status-${team.status}`}>
                              {team.status}
                            </div>
                            <button
                              className="unassign-team-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnassignTeam(team.id, team.name, team.currentProject);
                              }}
                              title="Unassign team from project"
                            >
                              <UserMinus size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="assignment-description">{team.description}</p>
                        <div className="assignment-meta">
                          <div className="team-project">
                            <FolderOpen size={14} />
                            <span>Project: {assignedProject?.name || 'Unknown'}</span>
                          </div>
                          <div className="team-members-count">
                            <Activity size={14} />
                            <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        {team.members.length > 0 && (
                          <div className="team-members-preview">
                            {team.members.slice(0, 4).map(member => (
                              <span key={member.id} className="member-chip">
                                <span className={`status-dot status-${member.status}`}></span>
                                {member.name} ({member.role})
                              </span>
                            ))}
                            {team.members.length > 4 && (
                              <span className="more-members">+{team.members.length - 4} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};