import React, { useState, useEffect } from 'react';
import { X, Users, Check } from 'lucide-react';
import { Team, Project } from '@/types';
import { apiService } from '@/services/api.service';

interface TeamAssignmentModalProps {
  project: Project;
  onClose: () => void;
  onAssignmentComplete: () => void;
}

export const TeamAssignmentModal: React.FC<TeamAssignmentModalProps> = ({
  project,
  onClose,
  onAssignmentComplete,
}) => {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const teams = await apiService.getTeams();
      setAllTeams(teams);
      
      // Pre-select teams that are already assigned to this project
      const assignedTeamIds = new Set(
        teams
          .filter(team => team.currentProject === project.id)
          .map(team => team.id)
      );
      setSelectedTeams(assignedTeamIds);
    } catch (err) {
      setError('Failed to load teams');
      console.error('Error loading teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = (teamId: string) => {
    const newSelected = new Set(selectedTeams);
    if (newSelected.has(teamId)) {
      newSelected.delete(teamId);
    } else {
      newSelected.add(teamId);
    }
    setSelectedTeams(newSelected);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Call the API to assign teams to project
      await apiService.assignTeamsToProject(project.id, Array.from(selectedTeams));
      
      onAssignmentComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign teams');
      console.error('Error assigning teams:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getRoleColor = (role: string) => {
    const roleColors: Record<string, string> = {
      orchestrator: '#8b5cf6',
      pm: '#3b82f6',
      developer: '#10b981',
      qa: '#f59e0b',
      tester: '#ef4444',
      designer: '#ec4899'
    };
    return roleColors[role] || '#6b7280';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Active', color: '#10b981' },
      inactive: { label: 'Inactive', color: '#6b7280' },
      completed: { label: 'Completed', color: '#3b82f6' }
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content team-assignment-modal">
        <div className="modal-header">
          <div className="modal-title">
            <Users className="title-icon" />
            <div>
              <h2>Assign Teams</h2>
              <p>Select teams to assign to "{project.name}"</p>
            </div>
          </div>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading teams...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>Error: {error}</p>
              <button onClick={loadTeams} className="retry-button">
                Retry
              </button>
            </div>
          ) : allTeams.length === 0 ? (
            <div className="empty-state">
              <Users size={48} />
              <h3>No Teams Available</h3>
              <p>Create some teams first before assigning them to projects.</p>
            </div>
          ) : (
            <div className="teams-selection">
              <div className="selection-header">
                <h3>Available Teams ({allTeams.length})</h3>
                <p>Selected: {selectedTeams.size} team{selectedTeams.size !== 1 ? 's' : ''}</p>
              </div>
              
              <div className="teams-grid">
                {allTeams.map((team) => {
                  const isSelected = selectedTeams.has(team.id);
                  const isCurrentlyAssigned = team.currentProject === project.id;
                  const isAssignedToOtherProject = team.currentProject && team.currentProject !== project.id;
                  
                  return (
                    <div
                      key={team.id}
                      className={`team-selection-card ${isSelected ? 'selected' : ''} ${
                        isAssignedToOtherProject ? 'unavailable' : ''
                      }`}
                      onClick={() => !isAssignedToOtherProject && handleTeamToggle(team.id)}
                    >
                      {isSelected && (
                        <div className="selection-indicator">
                          <Check size={16} />
                        </div>
                      )}
                      
                      <div className="team-card-header">
                        <div className="team-info">
                          <h4 className="team-name">{team.name}</h4>
                          {team.description && (
                            <p className="team-description">{team.description}</p>
                          )}
                        </div>
                        
                        <div className="team-status">
                          <span 
                            className="status-badge"
                            style={{ backgroundColor: getStatusBadge(team.status).color }}
                          >
                            {getStatusBadge(team.status).label}
                          </span>
                        </div>
                      </div>

                      <div className="team-members-summary">
                        <div className="members-count">
                          <Users size={14} />
                          <span>{team.members?.length || 0} member{(team.members?.length || 0) !== 1 ? 's' : ''}</span>
                        </div>
                        
                        {team.members && team.members.length > 0 && (
                          <div className="member-roles">
                            {team.members.slice(0, 3).map((member, index) => (
                              <span
                                key={index}
                                className="role-badge"
                                style={{ color: getRoleColor(member.role) }}
                              >
                                {member.role}
                              </span>
                            ))}
                            {team.members.length > 3 && (
                              <span className="more-roles">+{team.members.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>

                      {isCurrentlyAssigned && (
                        <div className="assignment-status current-project">
                          Currently assigned to this project
                        </div>
                      )}

                      {isAssignedToOtherProject && (
                        <div className="assignment-status other-project">
                          Assigned to another project
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button 
            className="primary-button" 
            onClick={handleSave}
            disabled={saving || allTeams.length === 0}
          >
            {saving ? (
              <>
                <div className="button-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Assign {selectedTeams.size} Team{selectedTeams.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};