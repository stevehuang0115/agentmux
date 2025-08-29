'use client';

import React, { useState } from 'react';
import { Team, TeamStatus, Role } from '../types/agentmux';
import { useAgentMux } from '../context/AgentMuxContext';
import { TerminalViewer } from './TerminalViewer';

interface TeamCardProps {
  team: Team;
}

export const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  const { updateTeam, deleteTeam, assignments, projects } = useAgentMux();
  const [isEditing, setIsEditing] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [editRoles, setEditRoles] = useState<Role[]>([...team.roles]);

  // Find assignment and project for this team
  const assignment = assignments.find(a => a.teamId === team.id && a.status === 'active');
  const assignedProject = assignment ? projects.find(p => p.id === assignment.projectId) : null;

  // Status styling
  const getStatusStyle = (status: TeamStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'idle':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paused':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'stopped':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (roleName: string) => {
    switch (roleName.toLowerCase()) {
      case 'orchestrator': return '🎯';
      case 'pm': return '📋';
      case 'dev': return '💻';
      case 'qa': return '🧪';
      default: return '👤';
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    
    // Ensure at least one orchestrator
    const hasOrchestrator = editRoles.some(role => 
      role.name.toLowerCase() === 'orchestrator' && role.count > 0
    );
    
    if (!hasOrchestrator) {
      alert('Team must have at least one Orchestrator role');
      return;
    }

    await updateTeam(team.id, {
      name: editName.trim(),
      roles: editRoles,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(team.name);
    setEditRoles([...team.roles]);
    setIsEditing(false);
  };

  const handleStart = async () => {
    await updateTeam(team.id, { status: 'active' });
  };

  const handlePause = async () => {
    await updateTeam(team.id, { status: 'paused' });
  };

  const handleStop = async () => {
    if (confirm(`Stop team "${team.name}"? This will end any active assignments.`)) {
      await updateTeam(team.id, { status: 'stopped' });
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete team "${team.name}"? This cannot be undone.`)) {
      await deleteTeam(team.id);
    }
  };

  const addRole = () => {
    setEditRoles([...editRoles, { name: 'custom', count: 1 }]);
  };

  const updateRole = (index: number, updates: Partial<Role>) => {
    const newRoles = [...editRoles];
    newRoles[index] = { ...newRoles[index], ...updates };
    setEditRoles(newRoles);
  };

  const removeRole = (index: number) => {
    // Prevent removing orchestrator
    if (editRoles[index].name.toLowerCase() === 'orchestrator') {
      alert('Cannot remove Orchestrator role');
      return;
    }
    
    setEditRoles(editRoles.filter((_, i) => i !== index));
  };

  return (
    <div 
      className="team-card bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4"
      data-testid={`team-${team.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full font-semibold text-lg text-gray-900 border-b border-green-300 focus:outline-none focus:border-green-500"
              autoFocus
            />
          ) : (
            <h3 className="font-semibold text-lg text-gray-900 truncate">
              {team.name}
            </h3>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-400 hover:text-green-600 p-1"
              title="Edit team"
            >
              ✏️
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusStyle(team.status)}`}
          data-testid={`team-${team.id}-status`}
        >
          {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
        </span>

        {assignedProject && (
          <span className="text-sm text-blue-600 font-medium">
            Project: {assignedProject.name}
          </span>
        )}
      </div>

      {/* Roles */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-2">Roles</label>
        <div className="space-y-2">
          {(isEditing ? editRoles : team.roles).map((role, index) => (
            <div 
              key={`${role.name}-${index}`}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              {isEditing ? (
                <div className="flex items-center space-x-2 flex-1">
                  <span className="text-lg">{getRoleIcon(role.name)}</span>
                  <input
                    type="text"
                    value={role.name}
                    onChange={(e) => updateRole(index, { name: e.target.value })}
                    className="flex-1 text-sm bg-white border border-gray-200 rounded px-2 py-1"
                    disabled={role.name.toLowerCase() === 'orchestrator'}
                  />
                  <input
                    type="number"
                    value={role.count}
                    min="0"
                    onChange={(e) => updateRole(index, { count: parseInt(e.target.value) || 0 })}
                    className="w-16 text-sm bg-white border border-gray-200 rounded px-2 py-1"
                  />
                  {role.name.toLowerCase() !== 'orchestrator' && (
                    <button
                      onClick={() => removeRole(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getRoleIcon(role.name)}</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {role.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({role.count})
                  </span>
                </div>
              )}
            </div>
          ))}

          {isEditing && (
            <button
              onClick={addRole}
              className="w-full p-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-green-300 hover:text-green-600 text-sm"
            >
              + Add Role
            </button>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-500 mb-4">
        <div>Created: {new Date(team.createdAt).toLocaleDateString()}</div>
        {team.lastActivity && (
          <div>Last active: {new Date(team.lastActivity).toLocaleString()}</div>
        )}
        {team.tmuxSession && (
          <div className="flex items-center justify-between">
            <span>tmux: {team.tmuxSession}</span>
            <button
              onClick={() => setShowTerminal(true)}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
            >
              View Terminal 🖥️
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        {isEditing ? (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={!editName.trim()}
              className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex space-x-2">
            {team.status === 'idle' || team.status === 'paused' ? (
              <button
                onClick={handleStart}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                ▶️ Start
              </button>
            ) : team.status === 'active' ? (
              <button
                onClick={handlePause}
                className="text-orange-600 hover:text-orange-800 text-sm font-medium"
              >
                ⏸️ Pause
              </button>
            ) : null}
            
            {team.status !== 'stopped' && (
              <button
                onClick={handleStop}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                ⏹️ Stop
              </button>
            )}
          </div>
        )}

        <div className="flex space-x-2">
          {!isEditing && (
            <button
              onClick={() => {/* TODO: Duplicate team */}}
              className="text-gray-500 hover:text-blue-600 text-sm"
              title="Duplicate team"
            >
              📋
            </button>
          )}
          
          {!isEditing && (
            <button
              onClick={handleDelete}
              className="text-gray-500 hover:text-red-600 text-sm"
              title="Delete team"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Terminal Modal */}
      {showTerminal && team.tmuxSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                {team.name} - Terminal ({team.tmuxSession})
              </h3>
              <button
                onClick={() => setShowTerminal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="flex-1 p-4">
              <TerminalViewer
                sessionName={team.tmuxSession}
                windowIndex={0}
                height="100%"
                className="h-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};