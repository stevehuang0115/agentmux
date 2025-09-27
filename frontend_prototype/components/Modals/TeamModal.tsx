
import React, { useState, useEffect } from 'react';
import { Project, Team } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { projects, availableAvatars } from '../../constants';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Input } from '../UI/Input';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Select } from '../UI/Select';

type MemberFormState = {
  id: string;
  name: string;
  role: string;
  runtime: string;
  avatarUrl: string;
};

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  team?: Team;
}

const runtimes = ['Claude Code', 'Gemini CLI', 'GPT-4 Turbo'];

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, team }) => {
  const isEditMode = !!team;
  const [teamName, setTeamName] = useState('');
  const [assignedProject, setAssignedProject] = useState('');
  const [members, setMembers] = useState<MemberFormState[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && team) {
        setTeamName(team.name);
        setAssignedProject(team.assignedProject);
        setMembers(
          team.members.map(m => ({
            id: m.id,
            name: m.name,
            role: m.role,
            avatarUrl: m.avatarUrl,
            runtime: 'Gemini CLI', // Placeholder, as this isn't in the base TeamMember type
          }))
        );
      } else {
        setTeamName('');
        setAssignedProject('');
        setMembers([
          { id: `new-${Date.now()}`, name: '', role: '', runtime: runtimes[0], avatarUrl: availableAvatars[0] },
        ]);
      }
    }
  }, [isOpen, team, isEditMode]);

  const handleAddMember = () => {
    setMembers([
      ...members,
      { id: `new-${Date.now()}`, name: '', role: '', runtime: runtimes[0], avatarUrl: availableAvatars[members.length % availableAvatars.length] },
    ]);
  };
  
  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleMemberChange = (index: number, field: keyof MemberFormState, value: string) => {
    const updatedMembers = [...members];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setMembers(updatedMembers);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-text-primary-dark">{isEditMode ? 'Edit Team' : 'Create New Team'}</h3>
              <p className="text-sm text-text-secondary-dark mt-1">
                {isEditMode ? `Modify the details for the ${team.name} team.` : 'Configure the details for your new AI agent team.'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
              <Icon name="close" />
            </Button>
          </div>
          <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            <div className={`grid grid-cols-1 ${isEditMode ? 'md:grid-cols-2' : ''} gap-6`}>
              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="team-name">Team Name</label>
                <Input 
                  id="team-name" 
                  placeholder="e.g., Frontend Wizards" 
                  type="text" 
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
              {isEditMode && (
                 <div>
                    <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="project">Assigned Project</label>
                    <Select 
                        id="project"
                        value={assignedProject}
                        onChange={(e) => setAssignedProject(e.target.value)}
                    >
                        {projects.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </Select>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-2">Team Members</label>
              <div className="space-y-4">
                {members.map((member, index) => (
                    <div key={member.id} className="p-4 border border-border-dark rounded-lg space-y-4 bg-background-dark/50">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary-dark mb-2">Avatar</label>
                            <div className="flex items-center gap-4">
                                <img src={member.avatarUrl} alt="Selected Avatar" className="w-12 h-12 rounded-full ring-2 ring-primary/50" />
                                <div className="flex flex-wrap gap-2 flex-1">
                                    {availableAvatars.map(avatar => (
                                        <img
                                            key={avatar}
                                            src={avatar}
                                            alt="Avatar option"
                                            onClick={() => handleMemberChange(index, 'avatarUrl', avatar)}
                                            className={`w-9 h-9 rounded-full cursor-pointer transition-all ${member.avatarUrl === avatar ? 'ring-2 ring-primary' : 'ring-2 ring-transparent hover:ring-primary/50'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor={`member-name-${index}`}>Agent Name</label>
                                <Input value={member.name} onChange={e => handleMemberChange(index, 'name', e.target.value)} className="bg-surface-dark" id={`member-name-${index}`} placeholder="e.g., Agent Smith" type="text" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor={`member-role-${index}`}>Role</label>
                                <Input value={member.role} onChange={e => handleMemberChange(index, 'role', e.target.value)} className="bg-surface-dark" id={`member-role-${index}`} placeholder="e.g., Frontend Developer" type="text" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor={`runtime-type-${index}`}>Runtime Type</label>
                            <Select value={member.runtime} onChange={e => handleMemberChange(index, 'runtime', e.target.value)} className="bg-surface-dark" id={`runtime-type-${index}`}>
                                {runtimes.map(r => <option key={r}>{r}</option>)}
                            </Select>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={() => handleRemoveMember(index)} variant="danger-ghost" size="sm" icon="delete" className="h-auto !p-0">
                                Delete Member
                            </Button>
                        </div>
                    </div>
                ))}
                <button onClick={handleAddMember} className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-border-dark rounded-lg text-text-secondary-dark hover:text-primary hover:border-primary transition-colors">
                  <Icon name="add" />
                  <span>Add Team Member</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose} icon={isEditMode ? 'save' : 'add'}>
            {isEditMode ? 'Save Changes' : 'Create Team'}
          </Button>
        </div>
      </div>
    </div>
  );
};