import React from 'react';
import { RecentActivityPanelProps } from './types';

export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      <div className="text-center py-8 text-gray-500">
        <svg 
          className="mx-auto h-12 w-12 text-gray-400 mb-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <p className="text-sm">Activity tracking coming soon</p>
      </div>
    </div>
  );
};