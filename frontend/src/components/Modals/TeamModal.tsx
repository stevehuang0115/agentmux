import React, { useState, useEffect } from 'react';
import { FormPopup, Dropdown, Button } from '../UI';

interface Project {
  id: string;
  name: string;
  path: string;
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
  const [formData, setFormData] = useState({
    name: '',
    projectPath: '',
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [availableRoles, setAvailableRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchAvailableRoles();
    if (team) {
      setFormData({
        name: team.name || '',
        projectPath: team.currentProject || team.projectPath || '',
      });
      if (team.members && Array.isArray(team.members)) {
        // Ensure all members have runtimeType (for backward compatibility)
        const migratedMembers = team.members.map(member => ({
          ...member,
          runtimeType: member.runtimeType || 'claude-code'
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
        runtimeType: 'claude-code'
      }));
      
      if (defaultMembers.length > 0) {
        setMembers(defaultMembers);
      }
    }
  }, [availableRoles, members.length, team]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const result = await response.json();
        const projectsData = result.success ? (result.data || []) : (result || []);
        setProjects(Array.isArray(projectsData) ? projectsData : []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchAvailableRoles = async () => {
    try {
      const response = await fetch('/api/config/available_team_roles.json');
      if (response.ok) {
        const result = await response.json();
        if (result.roles && Array.isArray(result.roles)) {
          setAvailableRoles(result.roles);
        }
      }
    } catch (error) {
      console.error('Error fetching available roles:', error);
      setAvailableRoles([]);
    }
  };

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
      runtimeType: 'claude-code'
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
        alert('All team members must have a name');
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



  return (
    <FormPopup
      isOpen={isOpen}
      onClose={onClose}
      title={team ? 'Edit Team' : 'Create New Team'}
      subtitle={team ? 'Modify team configuration and members' : 'Set up a new collaborative team'}
      size="xl"
      onSubmit={handleSubmit}
      submitText={team ? 'Save Changes' : 'Create Team'}
      submitDisabled={!formData.name.trim() || members.length === 0}
      loading={loading}
    >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="name">Team Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter team name (e.g., Frontend Team)"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="projectPath">Assigned Project</label>
              <Dropdown
                id="projectPath"
                name="projectPath"
                value={formData.projectPath}
                onChange={(value) => setFormData(prev => ({ ...prev, projectPath: value }))}
                placeholder="No project assigned"
                options={projects.map(project => ({
                  value: project.id,
                  label: project.name
                }))}
              />
            </div>
          </div>

          <div className="team-members-section">
            <div className="flex items-center justify-between p-5 border-b border-border-dark">
              <h3 className="text-xl font-semibold">Team Members ({members.length})</h3>
              <Button type="button" variant="primary" size="sm" onClick={addMember}>
                Add Member
              </Button>
            </div>

            <div className="team-members-list">
              {members.map((member, index) => (
                <div key={member.id} className="team-member-card">
                  <div className="member-form space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Avatar</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        {avatarChoices.map((url) => (
                          <button key={url} type="button" className={`w-8 h-8 rounded-full border ${member.avatar === url ? 'border-primary ring-2 ring-primary/40' : 'border-border-dark'} overflow-hidden`}
                            onClick={() => handleMemberChange(member.id, 'avatar', url)}
                          >
                            <img src={url} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-group">
                        <label>Agent Name</label>
                        <input type="text" value={member.name} onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)} placeholder="Member name" required />
                      </div>
                      <div className="form-group">
                        <label>Role</label>
                        <Dropdown
                          value={member.role}
                          onChange={(value) => handleMemberChange(member.id, 'role', value)}
                          required
                          options={availableRoles.filter(r => !r.hidden).map(r => ({ value: r.key, label: r.displayName }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <div className="form-group">
                        <label>Runtime Type</label>
                        <Dropdown
                          value={member.runtimeType}
                          onChange={(value) => handleMemberChange(member.id, 'runtimeType', value)}
                          required
                          options={[
                            { value: 'claude-code', label: 'Claude CLI' },
                            { value: 'gemini-cli', label: 'Gemini CLI' },
                            { value: 'codex-cli', label: 'Codex CLI' }
                          ]}
                        />
                      </div>
                      {members.length > 1 && (
                        <div className="flex justify-end">
                          <button type="button" className="text-sm text-text-secondary-dark hover:text-red-400" onClick={() => removeMember(member.id)}>
                            Delete Member
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
    </FormPopup>
  );
};
