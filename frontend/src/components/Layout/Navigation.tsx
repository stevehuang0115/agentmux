import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
	Home,
	FolderOpen,
	Users,
	ClipboardList,
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
	{ name: 'Assignments', href: '/assignments', icon: ClipboardList },
	{ name: 'Schedules', href: '/scheduled-checkins', icon: Clock },
];

export const Navigation: React.FC = () => {
	const location = useLocation();
	const { isCollapsed, toggleSidebar } = useSidebar();

	return (
		<div className={clsx('navigation', isCollapsed && 'navigation--collapsed')}>
			{/* Logo Section */}
			<div className="nav-header">
				<div className="nav-logo">
					<div className="logo-icon">
						<div className="triangle"></div>
					</div>
					{!isCollapsed && <span className="logo-text">AgentMux</span>}
				</div>
			</div>

			{/* Main Navigation */}
			<nav className="nav-menu">
				<div className="nav-section">
					{navigationItems.map((item) => {
						const isActive =
							location.pathname === item.href ||
							(item.href !== '/' && location.pathname.startsWith(item.href));

						return (
							<NavLink
								key={item.name}
								to={item.href}
								className={clsx('nav-item', isActive && 'nav-item--active')}
								title={isCollapsed ? item.name : undefined}
							>
								<item.icon className="nav-icon" />
								{!isCollapsed && <span className="nav-label">{item.name}</span>}
							</NavLink>
						);
					})}
				</div>
			</nav>

			{/* Bottom Section - Toggle button only */}
			<button
				className="nav-footer nav-footer--toggle"
				onClick={toggleSidebar}
				aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			>
				<div className="nav-toggle-icon">
					{isCollapsed ? (
						<ChevronRight className="toggle-icon" />
					) : (
						<ChevronLeft className="toggle-icon" />
					)}
				</div>
			</button>
		</div>
	);
};
