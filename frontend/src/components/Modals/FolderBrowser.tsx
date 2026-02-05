import React, { useState, useEffect, useCallback } from 'react';
import { Folder, ChevronRight, ChevronUp, Home, RefreshCw, X, FolderPlus } from 'lucide-react';

interface DirectoryEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  isHidden: boolean;
}

interface FolderBrowserProps {
  /** Called when a folder is selected (basic mode) */
  onSelect?: (path: string) => void;
  /** Called to directly create a project (project creation mode) */
  onCreateProject?: (path: string) => Promise<void>;
  onClose: () => void;
  initialPath?: string;
  /** Title for the modal */
  title?: string;
  /** Text for the action button */
  actionButtonText?: string;
}

/**
 * A modal folder browser that navigates the server filesystem.
 * Uses backend API to get full paths (not limited by browser security).
 *
 * Can be used in two modes:
 * 1. Basic selection mode: Pass onSelect to get the selected path
 * 2. Project creation mode: Pass onCreateProject to directly create a project
 */
export const FolderBrowser: React.FC<FolderBrowserProps> = ({
  onSelect,
  onCreateProject,
  onClose,
  initialPath,
  title = 'Select Folder',
  actionButtonText
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [creating, setCreating] = useState(false);

  // Determine the mode and button text
  const isProjectMode = !!onCreateProject;
  const buttonText = actionButtonText || (isProjectMode ? 'Create Project Here' : 'Select');

  const loadDirectory = useCallback(async (path?: string) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (path) {
        params.set('path', path);
      }
      if (showHidden) {
        params.set('showHidden', 'true');
      }

      const response = await fetch(`/api/directories?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCurrentPath(data.data.currentPath);
        setParentPath(data.data.parentPath);
        setEntries(data.data.entries);
      } else {
        setError(data.error || 'Failed to load directory');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  // Initial load
  useEffect(() => {
    loadDirectory(initialPath);
  }, [initialPath, loadDirectory]);

  const handleNavigate = (path: string) => {
    loadDirectory(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath);
    }
  };

  const handleGoHome = () => {
    loadDirectory();
  };

  const handleSelectCurrent = async () => {
    if (isProjectMode && onCreateProject) {
      setCreating(true);
      setError('');
      try {
        await onCreateProject(currentPath);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create project');
        setCreating(false);
      }
    } else if (onSelect) {
      onSelect(currentPath);
      onClose();
    }
  };

  const handleSelectEntry = (entry: DirectoryEntry) => {
    if (entry.type === 'directory') {
      // Navigate into the directory
      handleNavigate(entry.path);
    }
  };

  const handleDoubleClick = async (entry: DirectoryEntry) => {
    if (entry.type === 'directory') {
      if (isProjectMode && onCreateProject) {
        setCreating(true);
        setError('');
        try {
          await onCreateProject(entry.path);
          onClose();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create project');
          setCreating(false);
        }
      } else if (onSelect) {
        onSelect(entry.path);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-background-dark/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-surface-dark border border-border-dark rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border-dark flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            className="text-text-secondary-dark hover:text-text-primary-dark transition-colors"
            onClick={onClose}
            disabled={creating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-border-dark flex items-center gap-2">
          <button
            className="p-2 hover:bg-border-dark/50 rounded-lg transition-colors disabled:opacity-50"
            onClick={handleGoUp}
            disabled={!parentPath || loading}
            title="Go up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-border-dark/50 rounded-lg transition-colors"
            onClick={handleGoHome}
            disabled={loading}
            title="Go to home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-border-dark/50 rounded-lg transition-colors"
            onClick={() => loadDirectory(currentPath)}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-sm text-text-secondary-dark cursor-pointer">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded border-border-dark"
            />
            Show hidden
          </label>
        </div>

        {/* Current path */}
        <div className="px-4 py-2 bg-background-dark/50 border-b border-border-dark">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary-dark">Path:</span>
            <code className="bg-background-dark px-2 py-1 rounded text-xs flex-1 overflow-x-auto whitespace-nowrap">
              {currentPath}
            </code>
          </div>
        </div>

        {/* Directory listing */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">
              {error}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-secondary-dark text-sm">
              Empty directory
            </div>
          ) : (
            <div className="space-y-1">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-border-dark/50 transition-colors ${
                    entry.isHidden ? 'opacity-60' : ''
                  }`}
                  onClick={() => handleSelectEntry(entry)}
                  onDoubleClick={() => handleDoubleClick(entry)}
                >
                  <Folder className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="flex-1 truncate">{entry.name}</span>
                  <ChevronRight className="w-4 h-4 text-text-secondary-dark" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-dark flex flex-col gap-3">
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary-dark">
              Double-click to {isProjectMode ? 'create project in' : 'select'} a folder
            </p>
            <div className="flex gap-2">
              <button
                className="bg-transparent border border-border-dark text-text-primary-dark font-semibold py-2 px-4 rounded-lg hover:bg-border-dark/50 transition-colors disabled:opacity-50"
                onClick={onClose}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className="bg-primary text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSelectCurrent}
                disabled={creating || loading}
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    <span>{buttonText}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
