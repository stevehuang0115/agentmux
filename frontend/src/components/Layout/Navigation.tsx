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
					<div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
						<div className="w-3 h-3 bg-white rounded-sm"></div>
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
				<div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href !== '/' && location.pathname.startsWith(item.href));

              return (
                <div key={item.name}>
                  <NavLink
                    to={item.href}
                    className={clsx(
                      'group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-surface-dark text-text-primary-dark border border-border-dark ring-1 ring-primary/30'
                        : 'text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                  </NavLink>

                  {/* Nest project sub-nav directly under Projects item when viewing a project */}
                  {!isCollapsed && item.href === '/projects' && activeProjectId && (
                    <div className="mt-1 ml-6 space-y-1">
                      <NavLink
                        to={`/projects/${activeProjectId}#detail`}
                        className={() =>
                          clsx(
                            'group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeHash === 'detail'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark'
                          )
                        }
                      >
                        Overview
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#editor`}
                        className={() =>
                          clsx(
                            'group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeHash === 'editor'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark'
                          )
                        }
                      >
                        Editor
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#tasks`}
                        className={() =>
                          clsx(
                            'group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeHash === 'tasks'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark'
                          )
                        }
                      >
                        Tasks
                      </NavLink>
                      <NavLink
                        to={`/projects/${activeProjectId}#teams`}
                        className={() =>
                          clsx(
                            'group flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeHash === 'teams'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-text-secondary-dark hover:bg-background-dark/60 hover:text-text-primary-dark'
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
