import React from 'react';
import clsx from 'clsx';
import { TerminalEmulator } from '../TerminalEmulator';
import { TerminalPanelProps } from './types';

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  selectedMember,
  terminalData,
  onTerminalInput
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Terminal: {selectedMember.name}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>
              Role: <span className="font-medium">{selectedMember.role}</span>
            </span>
            <span>
              Agent Status: <span className={clsx(
                'font-medium',
                selectedMember.agentStatus === 'active' ? 'text-green-600' :
                selectedMember.agentStatus === 'activating' ? 'text-orange-600' :
                selectedMember.agentStatus === 'inactive' ? 'text-gray-600' : 'text-gray-600'
              )}>{selectedMember.agentStatus}</span>
            </span>
            <span>
              Working Status: <span className={clsx(
                'font-medium',
                selectedMember.workingStatus === 'in_progress' ? 'text-green-600' :
                selectedMember.workingStatus === 'idle' ? 'text-gray-600' : 'text-gray-600'
              )}>{selectedMember.workingStatus}</span>
            </span>
          </div>
        </div>
        
        <TerminalEmulator
          sessionName={selectedMember.sessionName}
          terminalData={terminalData}
          onInput={onTerminalInput}
          className="w-full"
        />
      </div>
    </div>
  );
};