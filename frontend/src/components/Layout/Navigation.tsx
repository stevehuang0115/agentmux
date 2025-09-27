import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
	Home,
	FolderOpen,
	Users,
	Clock,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useSidebar } from '../../contexts/SidebarContext';

const navigationItems = [
	{ name: 'Dashboard', href: '/', icon: Home },
	{ name: 'Projects', href: '/projects', icon: FolderOpen },
	{ name: 'Teams', href: '/teams', icon: Users },
	{ name: 'Schedules', href: '/scheduled-checkins', icon: Clock },
];

export const Navigation: React.FC = () => {
  const location = useLocation();
  const { isCollapsed, toggleSidebar } = useSidebar();

  // Detect when viewing a specific project to show contextual sub-navigation
  const projectMatch = location.pathname.match(/\/projects\/([^/]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;
  const activeHash = (location.hash || '#detail').replace('#', '') as 'detail' | 'editor' | 'tasks' | 'teams';

	return (
    <div className={clsx(
            'flex flex-col h-screen max-h-screen bg-surface-dark/95 border-r border-border-dark overflow-hidden w-full'
        )}>
			{/* Logo Section */}
			<div className="flex items-center p-4 border-b border-border-dark">
				<div className="flex items-center">
					<div className="bg-primary text-white p-2 rounded-lg">
						<svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
							<path d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
						</svg>
					</div>
					{!isCollapsed && (
						<span className="ml-3 text-lg font-bold text-text-primary-dark">
							AgentMux
						</span>
					)}
				</div>
			</div>

			{/* Main Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto">
				<div className="space-y-2">
            {navigationItems.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));

              return (
                <div key={item.name}>
                  <NavLink
                    to={item.href}
                    className={clsx(
                      'group flex items-center px-4 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <item.icon className={clsx("h-5 w-5 flex-shrink-0", isActive ? "text-primary" : "")} />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                  </NavLink>

                  {/* Nest project sub-nav directly under Projects item when viewing a project */}
                  {!isCollapsed && item.href === '/projects' && activeProjectId && (
                    <div className="mt-2 ml-4 space-y-1 border-l border-border-dark pl-4">
                      <NavLink
                        to={`/projects/${activeProjectId}#detail`}
                        className={() =>
                          clsx(
                            'block px-4 py-2 text-sm rounded-lg transition-colors',
                            activeHash === 'detail'
                              ? 'text-primary font-medium bg-primary/10'
                              : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'
                          )
                        }
                      >
                        Overview
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#editor`}
                        className={() =>
                          clsx(
                            'block px-4 py-2 text-sm rounded-lg transition-colors',
                            activeHash === 'editor'
                              ? 'text-primary font-medium bg-primary/10'
                              : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'
                          )
                        }
                      >
                        Editor
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#tasks`}
                        className={() =>
                          clsx(
                            'block px-4 py-2 text-sm rounded-lg transition-colors',
                            activeHash === 'tasks'
                              ? 'text-primary font-medium bg-primary/10'
                              : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'
                          )
                        }
                      >
                        Tasks
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#teams`}
                        className={() =>
                          clsx(
                            'block px-4 py-2 text-sm rounded-lg transition-colors',
                            activeHash === 'teams'
                              ? 'text-primary font-medium bg-primary/10'
                              : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-primary-dark'
                          )
                        }
                      >
                        Teams
                      </NavLink>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

			{/* Bottom Section - Toggle button */}
			<div className="p-2 border-t border-border-dark">
				<button
					className="flex items-center justify-center w-full p-2 text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark rounded-lg transition-colors"
					onClick={toggleSidebar}
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{isCollapsed ? (
						<ChevronRight className="h-5 w-5" />
					) : (
						<>
							<ChevronLeft className="h-5 w-5 mr-3" />
							<span className="text-sm">Collapse</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
};
