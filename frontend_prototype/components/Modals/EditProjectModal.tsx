
import React from 'react';
import { Project } from '../../types';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Icon } from '../UI/Icon';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Button } from '../UI/Button';
// Fix: Correcting import path casing from 'ui' to 'UI'
import { Input } from '../UI/Input';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, project }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-dark rounded-xl border border-border-dark shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold">Edit Project</h3>
              <p className="text-sm text-text-secondary-dark mt-1">Modify project name and settings.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 -mt-1 -mr-1">
              <Icon name="close" />
            </Button>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-text-secondary-dark" htmlFor="projectName">Project Name</label>
              <Input className="mt-1" id="projectName" type="text" defaultValue={project.name} />
            </div>
          </div>
          <div className="mt-8 border-t border-border-dark pt-6">
            <h4 className="text-lg font-semibold text-red-400">Danger Zone</h4>
            <p className="text-sm text-text-secondary-dark mt-1">This action cannot be undone.</p>
            <div className="mt-4">
              <Button variant="danger" icon="delete" className="w-full">
                Delete Project
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-background-dark px-6 py-4 rounded-b-xl border-t border-border-dark flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
};