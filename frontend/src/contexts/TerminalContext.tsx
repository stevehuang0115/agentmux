import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TerminalContextType {
  isTerminalOpen: boolean;
  selectedSession: string;
  openTerminal: () => void;
  closeTerminal: () => void;
  setSelectedSession: (sessionName: string) => void;
  openTerminalWithSession: (sessionName: string) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const useTerminal = () => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};

interface TerminalProviderProps {
  children: ReactNode;
}

export const TerminalProvider: React.FC<TerminalProviderProps> = ({ children }) => {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('agentmux-orc');

  const openTerminal = () => setIsTerminalOpen(true);
  const closeTerminal = () => setIsTerminalOpen(false);

  const openTerminalWithSession = (sessionName: string) => {
    console.log('TerminalContext: openTerminalWithSession called with:', sessionName);
    setSelectedSession(sessionName);
    setIsTerminalOpen(true);
    console.log('TerminalContext: Terminal opened and session set to:', sessionName);
  };

  const value: TerminalContextType = {
    isTerminalOpen,
    selectedSession,
    openTerminal,
    closeTerminal,
    setSelectedSession,
    openTerminalWithSession,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};