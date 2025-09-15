import React, { useState, useEffect } from 'react';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Team, TeamMember } from '@/types';

interface TeamCreatorProps {
  onTeamCreate: (team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>) => void;
  projectPath?: string;
  className?: string;
}

interface TeamRole {
  key: string;
  displayName: string;
  promptFile: string;
  description: string;
  category: string;
  hidden?: boolean;
  isDefault?: boolean;
}

export const TeamCreator: React.FC<TeamCreatorProps> = ({
  onTeamCreate,
  projectPath,
  className = '',
}) => {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [memberName, setMemberName] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('tpm');
  const [systemPrompt, setSystemPrompt] = useState('Load from tpm-prompt.md');
  const [isCreating, setIsCreating] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available roles from configuration
  useEffect(() => {
    const fetchAvailableRoles = async () => {
      try {
        const response = await fetch('/api/config/available_team_roles.json');
        if (response.ok) {
          const result = await response.json();
          if (result.roles && Array.isArray(result.roles)) {
            // Filter out hidden roles for the dropdown
            const visibleRoles = result.roles.filter(role => !role.hidden);
            setAvailableRoles(visibleRoles);

            // Set default role to first available role or first default role
            const defaultRole = visibleRoles.find(r => r.isDefault) || visibleRoles[0];
            if (defaultRole) {
              setRole(defaultRole.key);
              setSystemPrompt(`Load from ${defaultRole.promptFile}`);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching available roles:', error);
        // Fallback to a basic set if loading fails
        setAvailableRoles([
          { key: 'tpm', displayName: 'Technical Product Manager', promptFile: 'tpm-prompt.md', description: 'Technical product manager', category: 'management' },
          { key: 'architect', displayName: 'System Architect', promptFile: 'architect-prompt.md', description: 'System architect', category: 'development' },
          { key: 'fullstack-dev', displayName: 'Fullstack Developer', promptFile: 'fullstack-dev-prompt.md', description: 'Full-stack developer', category: 'development' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableRoles();
  }, []);

  const handleRoleChange = (newRole: TeamMember['role']) => {
    setRole(newRole);
    const roleConfig = availableRoles.find(r => r.key === newRole);
    if (roleConfig) {
      setSystemPrompt(`Load from ${roleConfig.promptFile}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamName.trim() || !memberName.trim() || !systemPrompt.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    
    try {
      // Create a team with a single member
      const member: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'> = {
        name: memberName.trim(),
        sessionName: `${teamName.toLowerCase().replace(/\s+/g, '-')}-${role}`,
        role,
        systemPrompt: systemPrompt.trim(),
        agentStatus: 'inactive',
        workingStatus: 'idle',
        runtimeType: 'claude-code',
        currentTickets: []
      };

      onTeamCreate({
        name: teamName.trim(),
        description: description.trim() || undefined,
        members: [member as any], // Type assertion for now, backend will add ids
        currentProject: projectPath
      });
      
      // Reset form
      setTeamName('');
      setDescription('');
      setMemberName('');

      // Reset to default role
      const defaultRole = availableRoles.find(r => r.isDefault) || availableRoles[0];
      if (defaultRole) {
        setRole(defaultRole.key);
        setSystemPrompt(`Load from ${defaultRole.promptFile}`);
      } else {
        setRole('tpm');
        setSystemPrompt('Load from tpm-prompt.md');
      }
    } catch (error) {
      console.error('Error creating team:', error);
      alert('Failed to create team. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <UserGroupIcon className="h-6 w-6 text-green-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Create Team</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
            Team Name *
          </label>
          <input
            type="text"
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Frontend Team, Backend Team"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Team Description
          </label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the team's purpose"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="memberName" className="block text-sm font-medium text-gray-700 mb-1">
            First Member Name *
          </label>
          <input
            type="text"
            id="memberName"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="e.g., John Smith, Senior Dev"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role *
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as TeamMember['role'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          >
            {loading ? (
              <option value="">Loading roles...</option>
            ) : (
              availableRoles.map((roleOption) => (
                <option key={roleOption.key} value={roleOption.key}>
                  {roleOption.displayName}
                </option>
              ))
            )}
          </select>
          {!loading && availableRoles.find(opt => opt.key === role) && (
            <p className="mt-1 text-xs text-gray-500">
              {availableRoles.find(opt => opt.key === role)?.description}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 mb-1">
            System Prompt *
          </label>
          <textarea
            id="systemPrompt"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Define the agent's role and responsibilities..."
            required
          />
        </div>

        {projectPath && (
          <div className="bg-blue-50 rounded-md p-3">
            <p className="text-sm font-medium text-blue-800">Project Context:</p>
            <p className="text-sm text-blue-700 font-mono break-all">{projectPath}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isCreating || !teamName.trim() || !memberName.trim() || !systemPrompt.trim()}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {isCreating ? 'Creating Team...' : 'Create Team'}
        </button>
      </form>
    </div>
  );
};