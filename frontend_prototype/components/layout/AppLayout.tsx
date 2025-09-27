import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TerminalPanel } from './TerminalPanel';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../UI/Icon';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../UI/Button';

export const AppLayout: React.FC = () => {
  const [isTerminalOpen, setTerminalOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setSidebarCollapsed} 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-grow flex flex-col relative">
        <header className="md:hidden h-16 flex items-center justify-between px-4 bg-surface-dark/80 backdrop-blur-sm border-b border-border-dark sticky top-0 z-30">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)}>
                <Icon name="menu" />
            </Button>
            <h1 className="text-lg font-bold">AgentMux</h1>
             <div className="w-10 h-10"></div> {/* Spacer to center title */}
        </header>
        <main className="container mx-auto px-6 py-8 flex-grow">
          <Outlet />
        </main>
        <Button 
          onClick={() => setTerminalOpen(true)}
          size="icon"
          className="fixed bottom-8 right-8 rounded-full p-4 shadow-lg w-14 h-14 z-40"
          aria-label="Open Terminal"
        >
          <Icon name="terminal" />
        </Button>
      </div>
      <TerminalPanel isOpen={isTerminalOpen} onClose={() => setTerminalOpen(false)} />
    </div>
  );
};