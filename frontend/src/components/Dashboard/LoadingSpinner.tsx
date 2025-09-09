import React from 'react';
import { LoadingSpinnerProps } from './types';

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Loading AgentMux...',
  className = ''
}) => {
  return (
    <div className={`min-h-screen bg-gray-100 flex items-center justify-center ${className}`}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
};