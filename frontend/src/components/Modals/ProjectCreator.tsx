import React, { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';

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
      if ('showDirectoryPicker' in window && (window as any).showDirectoryPicker) {
        const directoryHandle = await (window as any).showDirectoryPicker();
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
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Create New Project</h3>
            <button
              className="text-text-secondary-dark hover:text-text-primary-dark transition-colors"
              onClick={onClose}
              disabled={loading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary-dark mb-2" htmlFor="project-path">
                  Project Path <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    className="w-full bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:border-primary placeholder-text-secondary-dark/50"
                    id="project-path"
                    placeholder="/Users/name/my-project"
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="bg-background-dark border border-border-dark text-text-secondary-dark font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-border-dark/50 hover:text-text-primary-dark transition-colors text-sm whitespace-nowrap"
                    onClick={handleSelectFolder}
                    disabled={loading}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Browse</span>
                  </button>
                </div>
                <p className="text-xs text-text-secondary-dark mt-2">
                  Enter the absolute path to your project directory.
                  AgentMux will create a <code className="bg-background-dark px-1 rounded text-xs">.agentmux</code> subdirectory
                  for configuration and tickets.
                </p>
                {error && (
                  <p className="text-red-400 text-sm mt-2">{error}</p>
                )}
              </div>
            </div>
          </form>
        </div>
        <div className="bg-background-dark/50 px-6 py-4 border-t border-border-dark flex justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            className="bg-transparent border border-border-dark text-text-primary-dark font-semibold py-2 px-4 rounded-lg hover:bg-border-dark/50 transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-primary text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={loading || !path.trim()}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <span>Create Project</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};