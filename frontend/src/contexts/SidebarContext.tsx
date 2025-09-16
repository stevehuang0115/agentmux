import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  expandSidebar: () => void;
  collapseSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

interface SidebarProviderProps {
  children: ReactNode;
}

/**
 * Provider component for managing sidebar collapse/expand state
 *
 * @param children - Child components that need access to sidebar state
 * @returns JSX element wrapping children with sidebar context
 */
export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  /**
   * Toggle sidebar between collapsed and expanded states
   */
  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  /**
   * Expand the sidebar (set collapsed to false)
   */
  const expandSidebar = () => {
    setIsCollapsed(false);
  };

  /**
   * Collapse the sidebar (set collapsed to true)
   */
  const collapseSidebar = () => {
    setIsCollapsed(true);
  };

  const value: SidebarContextType = {
    isCollapsed,
    toggleSidebar,
    expandSidebar,
    collapseSidebar,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};

/**
 * Hook to access sidebar context
 *
 * @returns SidebarContextType object with sidebar state and control functions
 * @throws Error if used outside of SidebarProvider
 */
export const useSidebar = (): SidebarContextType => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};