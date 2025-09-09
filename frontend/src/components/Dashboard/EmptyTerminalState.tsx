import React from 'react';
import { ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { EmptyTerminalStateProps } from './types';

export const EmptyTerminalState: React.FC<EmptyTerminalStateProps> = ({
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-8 text-center ${className}`}>
      <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">No terminal selected</h3>
      <p className="mt-1 text-sm text-gray-500">
        Select a team from the Teams tab to view its terminal.
      </p>
    </div>
  );
};