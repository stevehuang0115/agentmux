import React, { useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { FolderBrowser } from './FolderBrowser';

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
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);

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

  const handleSelectFolder = () => {
    setShowFolderBrowser(true);
  };

  const handleFolderSelected = (selectedPath: string) => {
    setPath(selectedPath);
    setError('');
    setShowFolderBrowser(false);
  };

  const handleCreateProjectFromBrowser = async (selectedPath: string) => {
    // Directly create project from folder browser and close everything
    await onSave(selectedPath);
    // onSave will handle navigation/closing the parent
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
                  Enter the <strong>full absolute path</strong> to your project directory, or use Browse to navigate to it.
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

      {/* Folder Browser Modal - Direct project creation mode */}
      {showFolderBrowser && (
        <FolderBrowser
          title="Create New Project"
          onCreateProject={handleCreateProjectFromBrowser}
          onClose={() => setShowFolderBrowser(false)}
        />
      )}
    </div>
  );
};