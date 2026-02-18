import React from 'react';
import clsx from 'clsx';
import { DashboardHeaderProps } from './types';

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  connected,
  selectedProject,
  teamsCount
}) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">Crewly</h1>
            <div className={clsx(
              'ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            )}>
              {connected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedProject && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Project:</span> {selectedProject.name}
              </div>
            )}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Teams:</span> {teamsCount}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};