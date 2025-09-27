import React from 'react';
import { NavLink, useLocation, useMatch } from 'react-router-dom';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Icon } from '../UI/Icon';
// FIX: Corrected import path casing to 'UI' for consistency.
import { Button } from '../UI/Button';

const mainNavItems = [
  { name: 'Dashboard', path: '/', icon: 'dashboard' },
  { name: 'Projects', path: '/projects', icon: 'folder' },
  { name: 'Teams', path: '/teams', icon: 'group' },
  { name: 'Schedules', path: '/schedules', icon: 'schedule' },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed, isMobileOpen, onMobileClose }) => {
  const location = useLocation();
  const projectMatch = useMatch('/projects/:id/*');
  const projectId = projectMatch?.params.id;

  const activeLinkClass = "bg-primary/10 text-primary font-semibold";
  const inactiveLinkClass = "text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark transition-colors";

  const projectNavItems = projectId ? [
      { name: 'Overview', path: `/projects/${projectId}` },
      { name: 'Tasks', path: `/projects/${projectId}/tasks` },
      { name: 'Teams', path: `/projects/${projectId}/teams` },
  ] : [];

  const handleLinkClick = () => {
    onMobileClose();
  };

  const SidebarContent = (
    <>
      <div className="h-16 flex items-center justify-between px-6 gap-4 border-b border-border-dark flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white p-2 rounded-lg">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
          <h1 className={`text-xl font-bold whitespace-nowrap ${isCollapsed ? 'md:hidden' : ''}`}>AgentMux</h1>
        </div>
        <Button variant="ghost" size="icon" onClick={onMobileClose} className="md:hidden -mr-2">
            <Icon name="close" />
        </Button>
      </div>
      <nav className="flex-grow p-4 overflow-y-auto">
        <ul className="space-y-2">
          {mainNavItems.map(item => (
            <li key={item.name}>
              {item.name !== 'Projects' ? (
                <NavLink 
                  to={item.path} 
                  end={item.path === '/'}
                  onClick={handleLinkClick}
                  className={({ isActive }) => `flex items-center gap-3 px-4 py-2 rounded-lg ${isCollapsed ? 'md:justify-center': ''} ${isActive ? activeLinkClass : inactiveLinkClass}`}
                >
                  <Icon name={item.icon} />
                  <span className={`${isCollapsed ? 'md:hidden' : ''}`}>{item.name}</span>
                </NavLink>
              ) : (
                <div>
                    <NavLink 
                        to={item.path} 
                        end={location.pathname === '/projects'}
                        onClick={handleLinkClick}
                        className={({ isActive }) => `flex items-center gap-3 px-4 py-2 rounded-lg w-full ${isCollapsed ? 'md:justify-center': ''} ${(isActive || !!projectId) ? activeLinkClass : inactiveLinkClass}`}
                    >
                        <Icon name={item.icon} />
                        <span className={`${isCollapsed ? 'md:hidden' : ''}`}>{item.name}</span>
                    </NavLink>
                    {projectId && (
                        <ul className={`mt-2 ml-4 space-y-1 border-l border-border-dark pl-4 ${isCollapsed ? 'md:hidden' : ''}`}>
                            {projectNavItems.map(subItem => (
                                <li key={subItem.name}>
                                    <NavLink 
                                        to={subItem.path} 
                                        end={subItem.name === 'Overview'}
                                        onClick={handleLinkClick}
                                        className={({ isActive }) => `block px-4 py-2 text-sm rounded-lg transition-colors ${isActive ? 'text-primary font-medium bg-primary/10' : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'}`}
                                    >
                                        {subItem.name}
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-border-dark hidden md:block">
        <Button 
          variant="ghost" 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className={`w-full text-sm ${isCollapsed ? 'justify-center' : 'justify-between'}`}
        >
          <span className={`${isCollapsed ? 'hidden' : ''}`}>Collapse</span>
          <Icon name={isCollapsed ? 'menu' : 'menu_open'} />
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onMobileClose}
        aria-hidden="true"
      ></div>

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-surface-dark border-r border-border-dark transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:transition-all ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        {SidebarContent}
      </aside>
    </>
  );
};