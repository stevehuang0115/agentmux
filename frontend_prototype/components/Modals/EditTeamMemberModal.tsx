
import React, { useState, useEffect } from 'react';
import { TeamMember } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
import { availableAvatars } from '../../constants';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Input } from '../UI/Input';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Select } from '../UI/Select';

interface EditTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember;
}

type MemberFormState = {
  name: string;
  role: string;
  runtime: string;
  avatarUrl: string;
};

const runtimes = ['Claude Code', 'Gemini CLI', 'GPT-4 Turbo'];

export const EditTeamMemberModal: React.FC<EditTeamMemberModalProps> = ({ isOpen, onClose, member }) => {
  const [formData, setFormData] = useState<MemberFormState>({
    name: '',
    role: '',
    runtime: 'Gemini CLI',
    avatarUrl: '',
  });

  useEffect(() => {
    if (member && isOpen) {
      setFormData({
        name: member.name,
        role: member.role,
        runtime: 'Gemini CLI', // This can be expanded if member type includes runtime
        avatarUrl: member.avatarUrl,
      });
    }
  }, [member, isOpen]);

  const handleFieldChange = (field: keyof MemberFormState, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-lg m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-text-primary-dark">Edit Team Member</h3>
              <p className="text-sm text-text-secondary-dark mt-1">Modify details for {member.name}.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
              <Icon name="close" />
            </Button>
          </div>
          <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            <div className="p-4 border border-border-dark rounded-lg space-y-4 bg-background-dark/50">
                <div>
                    <label className="block text-sm font-medium text-text-secondary-dark mb-2">Avatar</label>
                    <div className="flex items-center gap-4">
                        <img src={formData.avatarUrl} alt="Selected Avatar" className="w-12 h-12 rounded-full ring-2 ring-primary/50" />
                        <div className="flex flex-wrap gap-2 flex-1">
                            {availableAvatars.map(avatar => (
                                <img
                                    key={avatar}
                                    src={avatar}
                                    alt="Avatar option"
                                    onClick={() => handleFieldChange('avatarUrl', avatar)}
                                    className={`w-9 h-9 rounded-full cursor-pointer transition-all ${formData.avatarUrl === avatar ? 'ring-2 ring-primary' : 'ring-2 ring-transparent hover:ring-primary/50'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="member-name">Agent Name</label>
                        <Input value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} className="bg-surface-dark" id="member-name" placeholder="e.g., Agent Smith" type="text" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="member-role">Role</label>
                        <Input value={formData.role} onChange={e => handleFieldChange('role', e.target.value)} className="bg-surface-dark" id="member-role" placeholder="e.g., Frontend Developer" type="text" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="runtime-type">Runtime Type</label>
                    <Select value={formData.runtime} onChange={e => handleFieldChange('runtime', e.target.value)} className="bg-surface-dark" id="runtime-type">
                        {runtimes.map(r => <option key={r}>{r}</option>)}
                    </Select>
                </div>
            </div>
          </div>
        </div>
        <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose} icon="save">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};