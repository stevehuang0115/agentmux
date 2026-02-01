import React, { useState, useEffect } from 'react';
import { FormLabel, FormInput, FormSelect, Button } from '../UI';
import { useAlert } from '../UI/Dialog';
import { useRoles } from '../../hooks/useRoles';
import { useProjects } from '../../hooks/useProjects';
import type { Project } from '../../types';

interface TeamRole {
  key: string;
  displayName: string;
  promptFile: string;
  description: string;
  category: string;
  hidden?: boolean;
  isDefault?: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  runtimeType: 'claude-code' | 'gemini-cli' | 'codex-cli';
  avatar?: string;
}

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  team?: any;
}

// Will be loaded from configuration

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, onSubmit, team }) => {
  const { showWarning, AlertComponent } = useAlert();
  const { roles: fetchedRoles, isLoading: rolesLoading } = useRoles();
  const { projects, isLoading: projectsLoading } = useProjects();
  const [formData, setFormData] = useState({
    name: '',
    projectPath: '',
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  // Transform fetched roles into TeamRole format
  const availableRoles: TeamRole[] = (fetchedRoles || []).map(role => ({
    key: role.name,
    displayName: role.displayName,
    promptFile: `${role.name}-prompt.md`,
    description: role.description || '',
    category: role.category,
    hidden: false,
    isDefault: role.isDefault,
  }));

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        projectPath: team.currentProject || team.projectPath || '',
      });
      if (team.members && Array.isArray(team.members)) {
        // Ensure all members have runtimeType and avatar (for backward compatibility)
        const migratedMembers = team.members.map((member: TeamMember, index: number) => ({
          ...member,
          runtimeType: member.runtimeType || 'claude-code',
          avatar: member.avatar || avatarChoices[index % avatarChoices.length]
        }));
        setMembers(migratedMembers);
      }
    }
  }, [team]);

  // Initialize default members when roles are loaded and no existing team
  useEffect(() => {
    if (availableRoles.length > 0 && members.length === 0 && !team) {
      const defaultRoles = availableRoles.filter(role => role.isDefault);

      const defaultMembers: TeamMember[] = defaultRoles.map((role, index) => ({
        id: (index + 1).toString(),
        name: role.displayName,
        role: role.key,
        systemPrompt: `Load from ${role.promptFile}`,
        runtimeType: 'claude-code',
        avatar: avatarChoices[index % avatarChoices.length]
      }));

      if (defaultMembers.length > 0) {
        setMembers(defaultMembers);
      }
    }
  }, [availableRoles, members.length, team]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMemberChange = (memberId: string, field: keyof TeamMember, value: string) => {
    setMembers(prev => prev.map(member => {
      if (member.id === memberId) {
        const updatedMember = { ...member, [field]: value };
        
        // Auto-update system prompt when role changes
        if (field === 'role') {
          const selectedRole = availableRoles.find(role => role.key === value);
          if (selectedRole) {
            updatedMember.systemPrompt = `Load from ${selectedRole.promptFile}`;
          }
        }
        
        return updatedMember;
      }
      return member;
    }));
  };

  const avatarChoices = [
    'https://picsum.photos/seed/1/64',
    'https://picsum.photos/seed/2/64',
    'https://picsum.photos/seed/3/64',
    'https://picsum.photos/seed/4/64',
    'https://picsum.photos/seed/5/64',
    'https://picsum.photos/seed/6/64',
  ];

  const addMember = () => {
    const newId = (Math.max(...members.map(m => parseInt(m.id))) + 1).toString();
    const fullstackDevRole = availableRoles.find(role => role.key === 'fullstack-dev');
    const newMember: TeamMember = {
      id: newId,
      name: 'Fullstack Developer',
      role: 'fullstack-dev',
      systemPrompt: fullstackDevRole ? `Load from ${fullstackDevRole.promptFile}` : 'Default fullstack developer prompt',
      runtimeType: 'claude-code',
      avatar: avatarChoices[members.length % avatarChoices.length]
    };
    setMembers(prev => [...prev, newMember]);
  };

  const removeMember = (memberId: string) => {
    if (members.length > 1) {
      setMembers(prev => prev.filter(member => member.id !== memberId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || members.length === 0) return;

    // Validate all members have required fields
    for (const member of members) {
      if (!member.name.trim()) {
        showWarning('All team members must have a name');
        return;
      }
    }

    setLoading(true);
    try {
      // Convert selected project ID to proper format
      const selectedProject = projects.find(p => p.id === formData.projectPath);
      const submitData = {
        ...formData,
        members: members.map(member => ({
          name: member.name,
          role: member.role,
          systemPrompt: member.systemPrompt,
          runtimeType: member.runtimeType,
          avatar: member.avatar
        })),
        currentProject: formData.projectPath || undefined, // Send project ID, not path
        projectPath: selectedProject ? selectedProject.path : undefined, // Keep path for backend processing
      };
      await onSubmit(submitData);
    } catch (error) {
      console.error('Error submitting team:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(e);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-text-primary-dark">
                  {team ? 'Edit Team' : 'Create New Team'}
                </h3>
                <p className="text-sm text-text-secondary-dark mt-1">
                  {team ? 'Modify team configuration and members' : 'Configure the details for your new AI agent team.'}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 -mt-1 -mr-1 rounded-lg hover:bg-background-dark flex items-center justify-center text-text-secondary-dark hover:text-text-primary-dark"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <FormLabel htmlFor="team-name">Team Name</FormLabel>
                <FormInput
                  id="team-name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  name="name"
                  placeholder="e.g., Frontend Wizards"
                  required
                />
              </div>

              <div>
                <FormLabel htmlFor="project-assignment">Assigned Project</FormLabel>
                <FormSelect
                  id="project-assignment"
                  value={formData.projectPath || ''}
                  onChange={handleInputChange}
                  name="projectPath"
                >
                  <option value="">No project assigned</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </FormSelect>
                <p className="text-xs text-text-secondary-dark mt-1">
                  Optionally assign a project for this team to work on
                </p>
              </div>

              <div>
                <FormLabel>Team Members</FormLabel>
                <div className="space-y-4">
                  {members.map((member, index) => (
                    <div key={member.id} className="p-4 border border-border-dark rounded-lg space-y-4 bg-background-dark/50">
                      <div>
                        <FormLabel>Avatar</FormLabel>
                        <div className="flex items-center gap-4">
                          <img
                            src={member.avatar || avatarChoices[0]}
                            alt="Selected Avatar"
                            className="w-12 h-12 rounded-full ring-2 ring-primary/50"
                          />
                          <div className="flex flex-wrap gap-2 flex-1">
                            {avatarChoices.map((url) => (
                              <img
                                key={url}
                                src={url}
                                alt="Avatar option"
                                onClick={() => handleMemberChange(member.id, 'avatar', url)}
                                className={`w-9 h-9 rounded-full cursor-pointer transition-all ${member.avatar === url ? 'ring-2 ring-primary' : 'ring-2 ring-transparent hover:ring-primary/50'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FormLabel htmlFor={`member-name-${index}`}>Agent Name</FormLabel>
                          <FormInput
                            id={`member-name-${index}`}
                            type="text"
                            value={member.name}
                            onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                            placeholder="e.g., Agent Smith"
                            required
                          />
                        </div>
                        <div>
                          <FormLabel htmlFor={`member-role-${index}`}>Role</FormLabel>
                          <FormSelect
                            id={`member-role-${index}`}
                            value={member.role}
                            onChange={(e) => handleMemberChange(member.id, 'role', e.target.value)}
                            required
                          >
                            <option value="">Select role</option>
                            {availableRoles.filter(r => !r.hidden).map(r => (
                              <option key={r.key} value={r.key}>{r.displayName}</option>
                            ))}
                          </FormSelect>
                        </div>
                      </div>
                      <div>
                        <FormLabel htmlFor={`runtime-type-${index}`}>Runtime Type</FormLabel>
                        <FormSelect
                          id={`runtime-type-${index}`}
                          value={member.runtimeType}
                          onChange={(e) => handleMemberChange(member.id, 'runtimeType', e.target.value)}
                          required
                        >
                          <option value="claude-code">Claude CLI</option>
                          <option value="gemini-cli">Gemini CLI</option>
                          <option value="codex-cli">Codex CLI</option>
                        </FormSelect>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="text-text-secondary-dark hover:text-red-500 h-auto p-0 text-sm flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Member
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMember}
                    className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-border-dark rounded-lg text-text-secondary-dark hover:text-primary hover:border-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add Team Member</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              onClick={handleFormSubmit}
              disabled={!formData.name.trim() || members.length === 0 || loading || rolesLoading || projectsLoading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={team ? "M5 13l4 4L19 7" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                  </svg>
                  {team ? 'Save Changes' : 'Create Team'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <AlertComponent />
    </>
  );
};
