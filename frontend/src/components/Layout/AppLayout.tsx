import React from 'react';
import { Outlet } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { Navigation } from './Navigation';
import { TerminalPanel } from '../TerminalPanel/TerminalPanel';
import { OrchestratorStatusBanner } from '../OrchestratorStatusBanner';
import { useTerminal } from '../../contexts/TerminalContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { IconButton } from '../UI';
import clsx from 'clsx';

export const AppLayout: React.FC = () => {
  const { isTerminalOpen, openTerminal, closeTerminal } = useTerminal();
  const { isCollapsed } = useSidebar();

  const toggleTerminal = () => {
    if (isTerminalOpen) {
      closeTerminal();
    } else {
      openTerminal();
    }
  };

  return (
    <div className="flex min-h-screen bg-background-dark">
      <div className={clsx('transition-all duration-200', isCollapsed ? 'w-16' : 'w-64')}>
        <Navigation />
      </div>
      <main className="flex-1 flex flex-col">
        <OrchestratorStatusBanner />
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>

      {/* Terminal Toggle Button */}
      <IconButton
        className={`fixed bottom-6 right-6 z-40 ${isTerminalOpen ? 'bg-primary/90' : ''}`}
        icon={Terminal}
        onClick={toggleTerminal}
        variant="primary"
        aria-label={isTerminalOpen ? 'Close Terminal' : 'Open Terminal'}
      />

      {/* Terminal Side Panel with Overlay */}
      <>
        {isTerminalOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={closeTerminal}
          />
        )}
        <TerminalPanel
          isOpen={isTerminalOpen}
          onClose={closeTerminal}
        />
      </>
    </div>
  );
};