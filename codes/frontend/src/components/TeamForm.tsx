'use client';

import React, { useState } from 'react';
import { useAgentMux } from '../context/AgentMuxContext';
import { Team, Role } from '../types/agentmux';

interface TeamFormProps {
  team?: Team;
  isOpen: boolean;
  onClose: () => void;
}

export const TeamForm: React.FC<TeamFormProps> = ({
  team,
  isOpen,
  onClose
}) => {
  const { createTeam, updateTeam, loading } = useAgentMux();
  
  const [formData, setFormData] = useState({
    name: team?.name || '',
    status: team?.status || 'active' as const
  });

  const [roles, setRoles] = useState<Role[]>(
    team?.roles || [{ name: 'orchestrator', count: 1 }]
  );

  const [error, setError] = useState<string>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    if (!formData.name.trim()) {
      setError('Team name is required');
      return;
    }

    if (roles.length === 0) {
      setError('At least one role is required');
      return;
    }

    // Validate orchestrator requirement
    const hasOrchestrator = roles.some(role => role.name === 'orchestrator' && role.count > 0);
    if (!hasOrchestrator) {
      setError('Team must have at least 1 Orchestrator role');
      return;
    }

    try {
      const teamData = {
        ...formData,
        roles: roles.filter(role => role.count > 0)
      };

      if (team) {
        await updateTeam(team.id, teamData);
      } else {
        await createTeam(teamData);
      }
      onClose();
      setFormData({ name: '', status: 'active' });
      setRoles([{ name: 'orchestrator', count: 1 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (index: number, field: 'name' | 'count', value: string | number) => {
    setRoles(prev => prev.map((role, i) => 
      i === index ? { ...role, [field]: value } : role
    ));
  };

  const addRole = () => {
    setRoles(prev => [...prev, { name: 'dev', count: 1 }]);
  };

  const removeRole = (index: number) => {
    if (roles.length > 1) {
      setRoles(prev => prev.filter((_, i) => i !== index));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {team ? 'Edit Team' : 'Create Team'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Frontend Dev Team"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="active">Active</option>
              <option value="idle">Idle</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Team Roles *
              </label>
              <button
                type="button"
                onClick={addRole}
                className="text-green-600 hover:text-green-800 text-sm"
              >
                + Add Role
              </button>
            </div>
            
            <div className="space-y-2">
              {roles.map((role, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <select
                    value={role.name}
                    onChange={(e) => handleRoleChange(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="orchestrator">Orchestrator</option>
                    <option value="pm">Project Manager</option>
                    <option value="dev">Developer</option>
                    <option value="qa">QA Engineer</option>
                    <option value="custom">Custom Role</option>
                  </select>
                  
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={role.count}
                    onChange={(e) => handleRoleChange(index, 'count', parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                  />
                  
                  {roles.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRole(index)}
                      className="text-red-500 hover:text-red-700 px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <p className="text-sm text-gray-500 mt-1">
              Note: Each team requires at least 1 Orchestrator role
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : team ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};