
import React, { useState } from 'react';
import { Project } from '../../types';
import { teams } from '../../constants';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Select } from '../UI/Select';

interface AssignTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const AssignTeamModal: React.FC<AssignTeamModalProps> = ({ isOpen, onClose, project }) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');

  if (!isOpen) return null;

  const availableTeams = teams.filter(t => t.assignedProject !== project.name);

  const handleAssign = () => {
    // In a real app, this would trigger an API call.
    // For now, we'll just log it and close the modal.
    const teamName = teams.find(t => t.id === selectedTeamId)?.name;
    alert(`Team "${teamName}" assigned to ${project.name}! (This is a mock action and won't persist)`);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-text-primary-dark">Assign Team to {project.name}</h3>
              <p className="text-sm text-text-secondary-dark mt-1">Select an existing team to assign to this project.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
              <Icon name="close" />
            </Button>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-1.5" htmlFor="team-select">Team</label>
              <Select id="team-select" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}>
                <option value="">Select a team</option>
                {availableTeams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!selectedTeamId}>
            Assign Team
          </Button>
        </div>
      </div>
    </div>
  );
};