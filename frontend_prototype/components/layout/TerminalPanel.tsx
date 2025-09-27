
import React from 'react';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../UI/Icon';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Select } from '../UI/Select';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Input } from '../UI/Input';

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ isOpen, onClose }) => {
  return (
    <div 
      className={`fixed inset-0 bg-black/50 z-50 flex justify-end transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-2xl h-full bg-background-dark shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-border-dark flex-shrink-0">
          <div className="flex items-center gap-4">
            <Icon name="terminal" className="text-primary" />
            <div className="relative">
              <Select className="bg-surface-dark border-border-dark text-sm !py-1.5">
                <option>Orchestrator</option>
                <option>frontend-dev-1</option>
                <option>backend-dev-1</option>
                <option>qa-agent-1</option>
              </Select>
            </div>
          </div>
          <button onClick={onClose} className="text-text-secondary-dark hover:text-text-primary-dark">
            <Icon name="close" />
          </button>
        </header>
        <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-text-secondary-dark">
          <p><span className="text-primary">&gt;</span> Connecting to agent 'Orchestrator'...</p>
          <p><span className="text-green-400">✔</span> Connection established.</p>
          <p><span className="text-primary">&gt;</span> Initializing project 'Project Phoenix'...</p>
          <p>[Orchestrator]: Setting up project environment.</p>
          <p>[Orchestrator]: Assigning task 'Create Login Page' to 'frontend-dev-1'.</p>
          <p>[frontend-dev-1]: Acknowledged. Starting work on 'Create Login Page'.</p>
          <p><span className="text-primary">&gt;</span> git commit -m "feat: create basic login component"</p>
          <p className="text-yellow-400">[WARN] ESLint found 3 issues.</p>
          <p>[frontend-dev-1]: Pushing changes to remote repository.</p>
          <p className="blinking-cursor text-primary">_</p>
        </div>
        <footer className="p-4 border-t border-border-dark flex-shrink-0">
          <div className="relative">
            <Input className="bg-surface-dark border-border-dark pl-10 font-mono text-sm" placeholder="Type a command..." type="text"/>
            <Icon name="chevron_right" className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
          </div>
        </footer>
      </div>
    </div>
  );
};