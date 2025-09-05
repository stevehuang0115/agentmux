import React, { useState } from 'react';
import { FolderOpenIcon, PlusIcon } from '@heroicons/react/24/outline';

interface ProjectSelectorProps {
  onProjectSelect: (path: string) => void;
  className?: string;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onProjectSelect,
  className = '',
}) => {
  const [selectedPath, setSelectedPath] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectFolder = async () => {
    setIsSelecting(true);
    
    try {
      // In a real implementation, this would use a file picker API
      // For now, we'll use a simple input field
      const path = prompt('Enter the absolute path to your project folder:');
      
      if (path && path.trim()) {
        setSelectedPath(path.trim());
        onProjectSelect(path.trim());
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      alert('Failed to select folder. Please try again.');
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center mb-4">
        <FolderOpenIcon className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-900">Select Project</h3>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose a project folder to start AgentMux orchestration.
        </p>

        {selectedPath && (
          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-sm font-medium text-gray-700">Selected:</p>
            <p className="text-sm text-gray-900 font-mono break-all">{selectedPath}</p>
          </div>
        )}

        <button
          onClick={handleSelectFolder}
          disabled={isSelecting}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          {isSelecting ? 'Selecting...' : 'Select Project Folder'}
        </button>

        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Requirements:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Must be an absolute path</li>
            <li>Directory must exist and be accessible</li>
            <li>Will create .agentmux/ subdirectory if needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};