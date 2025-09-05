import React from 'react';
import { Outlet } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { Navigation } from './Navigation';
import { TerminalPanel } from '../TerminalPanel/TerminalPanel';
import { useTerminal } from '../../contexts/TerminalContext';
import { IconButton } from '../UI';

export const AppLayout: React.FC = () => {
  const { isTerminalOpen, openTerminal, closeTerminal } = useTerminal();

  const toggleTerminal = () => {
    if (isTerminalOpen) {
      closeTerminal();
    } else {
      openTerminal();
    }
  };

  return (
    <div className="app-layout">
      <div className="app-sidebar">
        <Navigation />
      </div>
      <main className="app-main">
        <Outlet />
      </main>
      
      {/* Terminal Toggle Button */}
      <IconButton
        className={`terminal-toggle-btn ${isTerminalOpen ? 'active' : ''}`}
        icon={Terminal}
        onClick={toggleTerminal}
        variant="primary"
        aria-label={isTerminalOpen ? 'Close Terminal' : 'Open Terminal'}
      />

      {/* Terminal Side Panel */}
      <TerminalPanel
        isOpen={isTerminalOpen}
        onClose={closeTerminal}
      />
    </div>
  );
};