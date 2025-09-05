import React, { useState } from 'react';
import { FolderOpen, AlertCircle } from 'lucide-react';
import { FormPopup, FormGroup, FormLabel, FormError, Button } from '../UI';

interface ProjectCreatorProps {
  onSave: (path: string) => Promise<void>;
  onClose: () => void;
}

export const ProjectCreator: React.FC<ProjectCreatorProps> = ({
  onSave,
  onClose
}) => {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!path.trim()) {
      setError('Please enter a project path');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onSave(path.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      // Check if the File System Access API is supported
      if ('showDirectoryPicker' in window && window.showDirectoryPicker) {
        const directoryHandle = await window.showDirectoryPicker();
        setPath(directoryHandle.name);
      } else {
        // Fallback for browsers that don't support the File System Access API
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.addEventListener('change', (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            // Get the directory path from the first file
            const firstFile = files[0];
            const pathParts = firstFile.webkitRelativePath.split('/');
            const folderName = pathParts[0];
            setPath(folderName);
          }
        });
        
        input.click();
      }
    } catch (err) {
      // User cancelled the dialog or error occurred
      console.log('Folder selection cancelled or failed:', err);
    }
  };

  return (
    <FormPopup
      isOpen={true}
      onClose={onClose}
      title="Create New Project"
      onSubmit={handleSubmit}
      submitText={loading ? 'Creating...' : 'Create Project'}
      submitDisabled={loading || !path.trim()}
      loading={loading}
      size="md"
    >
      <FormGroup>
        <FormLabel htmlFor="project-path" required>
          Project Path
        </FormLabel>
        <div className="field-input-group">
          <input
            id="project-path"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/Users/name/my-project"
            className="field-input"
            disabled={loading}
            required
            style={{ flex: 1 }}
          />
          <Button
            type="button"
            onClick={handleSelectFolder}
            variant="outline"
            size="sm"
            disabled={loading}
            icon={FolderOpen}
          >
            Browse
          </Button>
        </div>
        <p className="field-help">
          Enter the absolute path to your project directory. AgentMux will create a 
          <code>.agentmux</code> subdirectory for configuration and tickets.
        </p>
        {error && (
          <FormError>
            <AlertCircle className="error-icon" />
            {error}
          </FormError>
        )}
      </FormGroup>
    </FormPopup>
  );
};