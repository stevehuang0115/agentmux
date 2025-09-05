import React, { useState } from 'react';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Team, TeamMember } from '@/types';

interface TeamCreatorProps {
  onTeamCreate: (team: Omit<Team, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  projectPath?: string;
  className?: string;
}

const roleOptions = [
  { value: 'orchestrator', label: 'Orchestrator', description: 'Coordinates all teams and manages high-level strategy' },
  { value: 'tpm', label: 'Technical Product Manager', description: 'Scopes projects and translates business logic to technical specs' },
  { value: 'pgm', label: 'Program Manager', description: 'Tracks progress and creates detailed tasks from specs' },
  { value: 'developer', label: 'Developer', description: 'Implements features and writes code' },
  { value: 'qa', label: 'QA Engineer', description: 'Tests features and ensures quality standards' },
  { value: 'tester', label: 'Tester', description: 'Performs manual and automated testing' },
  { value: 'designer', label: 'Designer', description: 'Creates UI/UX designs and prototypes' },
];

const defaultPrompts = {
  orchestrator: `You are the Orchestrator Agent responsible for:\n- Overall project coordination and strategy\n- Creating and managing teams\n- Delegating high-level tasks\n- Monitoring project progress\n- Making architectural decisions`,
  tpm: `You are a Technical Product Manager (TPM) responsible for:\n- Scoping projects and analyzing technical complexity\n- Translating business requirements into technical specifications\n- Defining system architecture and technical design patterns\n- Acting as technical lead and providing implementation guidance\n- Creating detailed technical design documents\n- Assessing technical feasibility and risk analysis`,
  pgm: `You are a Program Manager (PgM) responsible for:\n- Tracking project progress and milestone completion\n- Creating detailed, actionable task tickets from technical specs\n- Breaking down complex designs into executable development tasks\n- Ensuring 100% clear requirements for developer success\n- Coordinating between team roles and managing dependencies\n- Enforcing 30-minute git commits and quality standards`,
  developer: `You are a Software Developer responsible for:\n- Implementing features according to specifications\n- Writing clean, maintainable code\n- Committing every 30 minutes without fail\n- Working in feature branches\n- Reporting progress to PgM regularly`,
  qa: `You are a QA Engineer responsible for:\n- Testing all implemented features thoroughly\n- Verifying acceptance criteria are met\n- Documenting test results\n- Reporting issues immediately\n- Ensuring quality standards are maintained`,
  tester: `You are a Tester responsible for:\n- Performing manual testing of features\n- Creating and executing test cases\n- Identifying bugs and edge cases\n- Validating user experience flows\n- Documenting test results clearly`,
  designer: `You are a Designer responsible for:\n- Creating user-centered design solutions\n- Developing wireframes and prototypes\n- Ensuring consistent visual design\n- Collaborating with developers on implementation\n- Validating design against user needs`
};

export const TeamCreator: React.FC<TeamCreatorProps> = ({
  onTeamCreate,
  projectPath,
  className = '',
}) => {
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [memberName, setMemberName] = useState('');
  const [role, setRole] = useState<TeamMember['role']>('developer');
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompts.developer);
  const [isCreating, setIsCreating] = useState(false);

  const handleRoleChange = (newRole: TeamMember['role']) => {
    setRole(newRole);
    setSystemPrompt(defaultPrompts[newRole]);
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
        status: 'idle',
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
      setRole('developer');
      setSystemPrompt(defaultPrompts.developer);
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
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {roleOptions.find(opt => opt.value === role) && (
            <p className="mt-1 text-xs text-gray-500">
              {roleOptions.find(opt => opt.value === role)?.description}
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